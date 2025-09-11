import { createDataset, addMovementsToDataset } from '@/api/api'

/**
 * ============================================
 *  Tipos
 * ============================================
 */

type CurrencyCode = 'ARS' | 'USD' | 'EUR' | string

interface CSVRow {
    identificador: string
    fecha: string // DD/MM/YY o DD/MM/YYYY, texto literal
    estado: string
    tipo: string
    cuenta: string
    beneficiario: string
    categoria: string
    importe: number
    divisa: CurrencyCode
    numero: string
    notas: string
}

interface Category {
    grupo: string
    subgrupo?: string
}

interface Movement {
    fecha: string
    categoria: Category
    tipo: 'ingreso' | 'egreso'
    monto: number
    saldo?: number
    nota?: string
    externalId?: string
}

interface APIMovement {
    fecha: string
    categoria: Category
    tipo: 'ingreso' | 'egreso'
    monto: number
    saldo?: number
    nota?: string
    source?: string
    externalId?: string
}

interface ProcessedDataset {
    datasetName: string
    originalFileName: string
    importedBy?: string
    currency: CurrencyCode
    datasetType: string
    movements: Movement[]
    periodStart?: string
    periodEnd?: string
}

/**
 * ============================================
 *  Helpers
 * ============================================
 */

const looksLikeNumber = (val: string): boolean => {
    const trimmed = (val ?? '').trim()
    return /^-?\d+(?:\.\d+)?$/.test(trimmed)
}

/**
 * Clave auxiliar de ordenamiento (usa YYMMDD o YYYYMMDD si viene con 4 dígitos).
 * No altera la fecha original.
 */
const toSortableKeyYY = (d: string): string => {
    const [dd, mm, yy] = (d || '').split('/')
    if (!dd || !mm || !yy) return d
    return `${yy.padStart(2, '0')}${mm.padStart(2, '0')}${dd.padStart(2, '0')}`
}

function parseCSVLine(line: string): string[] {
    const values: string[] = []
    let currentValue = ''
    let inQuotes = false
    let escapeNext = false

    for (let i = 0; i < line.length; i++) {
        const char = line[i]

        if (escapeNext) {
            currentValue += char
            escapeNext = false
            continue
        }

        if (char === '\\') {
            escapeNext = true
            continue
        }

        if (char === '"') {
            inQuotes = !inQuotes
            continue
        }

        if (char === ',' && !inQuotes) {
            values.push(currentValue.trim())
            currentValue = ''
            continue
        }

        currentValue += char
    }

    values.push(currentValue.trim())
    return values
}

export function parseCSVFile(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = (event) => {
            const content = event.target?.result as string
            resolve(content)
        }
        reader.onerror = () => reject(new Error('Error al leer el archivo'))
        reader.readAsText(file, 'UTF-8')
    })
}

/**
 * ============================================
 *  Parseo CSV -> CSVRow[]
 * ============================================
 */
export function parseCSVContent(csvContent: string): CSVRow[] {
    const rawLines = csvContent
        .split('\n')
        .map((l) => l.replace(/\r$/, ''))
        .filter((line) => line.trim() !== '')

    if (rawLines.length < 1) {
        throw new Error('El archivo CSV no tiene filas')
    }

    const headerTokens = parseCSVLine(rawLines[0]).map((h) =>
        h.trim().toLowerCase(),
    )
    const isHeader = headerTokens.some((h) =>
        [
            'identificador',
            'fecha',
            'estado',
            'tipo',
            'cuenta',
            'beneficiario',
            'categoría',
            'categoria',
            'importe',
            'divisa',
            'número',
            'numero',
            'notas',
        ].includes(h),
    )

    const startIndex = isHeader ? 1 : 0
    const rows: CSVRow[] = []

    for (let i = startIndex; i < rawLines.length; i++) {
        const line = rawLines[i].trim()
        if (!line) continue

        const tokens = parseCSVLine(line).map((t) => t.trim())

        if (tokens.length < 8) {
            console.warn(`Fila ${i + 1}: tokens insuficientes`, {
                line,
                tokens,
            })
            continue
        }

        const identificador = tokens[0] ?? ''
        const fecha = tokens[1] ?? '' // 🔴 se guarda tal cual viene
        const estado = tokens[2] ?? ''
        const tipo = tokens[3] ?? ''
        const cuenta = tokens[4] ?? ''
        const beneficiario = tokens[5] ?? ''

        let importeIdx = -1
        for (let j = 6; j < tokens.length; j++) {
            if (looksLikeNumber(tokens[j])) {
                importeIdx = j
                break
            }
        }
        if (importeIdx === -1) {
            console.warn(`Fila ${i + 1}: no se encontró importe.`, tokens)
            continue
        }

        const categoriaCompleta = tokens.slice(6, importeIdx).join(', ').trim()

        const importeStr = (tokens[importeIdx] ?? '')
            .replace(/[^\d.-]/g, '')
            .trim()
        const importe = parseFloat(importeStr || '0') || 0

        const divisa = (tokens[importeIdx + 1] ?? '').trim() || 'ARS'
        const numero = (tokens[importeIdx + 2] ?? '').trim()
        const notas =
            tokens.length > importeIdx + 3
                ? tokens
                      .slice(importeIdx + 3)
                      .join(', ')
                      .trim()
                : ''

        const row: CSVRow = {
            identificador,
            fecha,
            estado,
            tipo,
            cuenta,
            beneficiario,
            categoria: categoriaCompleta,
            importe,
            divisa,
            numero,
            notas,
        }

        rows.push(row)
    }

    if (rows.length === 0) {
        throw new Error('No se encontraron filas válidas después del parseo')
    }

    return rows
}

/**
 * CSVRow -> Movement
 */
function csvRowToMovement(row: CSVRow): Movement | null {
    try {
        const fecha = (row.fecha ?? '').trim()
        if (!fecha) return null

        const tipo: 'ingreso' | 'egreso' =
            row.importe >= 0 ? 'ingreso' : 'egreso'
        const monto = Math.abs(row.importe || 0)
        if (monto === 0) return null

        const categoriaCompleta = (row.categoria ?? '').trim()
        if (!categoriaCompleta) return null

        const colonIdx = categoriaCompleta.indexOf(':')
        const grupo =
            colonIdx >= 0
                ? categoriaCompleta.slice(0, colonIdx).trim()
                : categoriaCompleta
        const subgrupo =
            colonIdx >= 0
                ? categoriaCompleta.slice(colonIdx + 1).trim() || undefined
                : undefined

        const nota = (row.notas ?? '').trim() || undefined

        return {
            fecha, // 🔴 se conserva exactamente como viene del CSV
            categoria: { grupo, subgrupo },
            tipo,
            monto,
            nota,
            externalId: (row.identificador ?? '').trim() || undefined,
        }
    } catch {
        return null
    }
}

function convertMovementsToAPI(movements: Movement[]): APIMovement[] {
    return movements.map((movement) => ({
        fecha: movement.fecha,
        categoria: movement.categoria,
        tipo: movement.tipo,
        monto: movement.monto,
        saldo: movement.saldo,
        nota: movement.nota,
        source: 'csv-import',
        externalId: movement.externalId,
    }))
}

function splitMovementsIntoBatches(
    movements: APIMovement[],
    batchSize: number = 1000,
): APIMovement[][] {
    const batches: APIMovement[][] = []
    for (let i = 0; i < movements.length; i += batchSize) {
        batches.push(movements.slice(i, i + batchSize))
    }
    return batches
}

/**
 * ============================================
 *  CSV -> Dataset listo para API
 * ============================================
 */
export function processCSVToDataset(
    csvContent: string,
    fileName: string,
    datasetName?: string,
    importedBy?: string,
    datasetType: string = 'cashflow',
): ProcessedDataset {
    const rows = parseCSVContent(csvContent)

    const valid: Array<{ row: CSVRow; movement: Movement }> = []
    for (const r of rows) {
        const mv = csvRowToMovement(r)
        if (mv) valid.push({ row: r, movement: mv })
    }

    const filteredMovements: Movement[] = valid.map((v) => v.movement)

    // Ordenar por fecha con clave auxiliar (no se modifica el valor original)
    filteredMovements.sort((a, b) =>
        toSortableKeyYY(a.fecha).localeCompare(toSortableKeyYY(b.fecha)),
    )

    const fechasOrdenadas = filteredMovements
        .map((m) => m.fecha)
        .sort((a, b) => toSortableKeyYY(a).localeCompare(toSortableKeyYY(b)))
    const periodStart = fechasOrdenadas[0]
    const periodEnd = fechasOrdenadas[fechasOrdenadas.length - 1]

    const currency: CurrencyCode = rows[0]?.divisa || 'ARS'

    const finalDatasetName =
        datasetName ||
        fileName.replace(/\.[^/.]+$/, '') ||
        `Dataset_${new Date().toISOString().split('T')[0]}`

    return {
        datasetName: finalDatasetName,
        originalFileName: fileName,
        importedBy,
        currency,
        datasetType,
        movements: filteredMovements,
        periodStart,
        periodEnd,
    }
}

/**
 * ============================================
 *  Proceso y subida end-to-end
 * ============================================
 */
export async function processAndUploadCSV(
    file: File,
    datasetName?: string,
    importedBy?: string,
    datasetType: string = 'cashflow',
): Promise<ProcessedDataset> {
    const csvContent = await parseCSVFile(file)
    const dataset = processCSVToDataset(
        csvContent,
        file.name,
        datasetName,
        importedBy,
        datasetType,
    )

    const apiMovements = convertMovementsToAPI(dataset.movements)
    const BATCH_SIZE = 500
    const needsBatching = apiMovements.length > BATCH_SIZE

    if (needsBatching) {
        const batches = splitMovementsIntoBatches(apiMovements, BATCH_SIZE)
        let datasetId: string | null = null

        for (let i = 0; i < batches.length; i++) {
            if (i === 0) {
                const apiData = { ...dataset, movements: batches[i] }
                const response = (await createDataset(apiData as any)) as any
                datasetId = response.datasetId
                if (!datasetId)
                    throw new Error('No se pudo obtener el ID del dataset')
            } else {
                if (!datasetId) throw new Error('DatasetId inválido')
                await addMovementsToDataset(datasetId, batches[i])
            }
            if (i < batches.length - 1) {
                await new Promise((resolve) => setTimeout(resolve, 1000))
            }
        }
    } else {
        const apiData = { ...dataset, movements: apiMovements }
        await createDataset(apiData as any)
    }

    return dataset
}
