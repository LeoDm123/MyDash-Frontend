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

function parseCSVLineWithCorrection(
    line: string,
    expectedColumns: number,
): string[] {
    const tokens = parseCSVLine(line)

    // Si el número de tokens coincide con las columnas esperadas, no hay problema
    if (tokens.length === expectedColumns) {
        return tokens
    }

    // Si hay más tokens de los esperados, buscar comas extra en campos de texto
    if (tokens.length > expectedColumns) {
        // Buscar el primer campo numérico para identificar dónde debería estar
        let firstNumericIndex = -1
        for (let i = 0; i < tokens.length; i++) {
            const token = tokens[i].trim()
            if (/^-?\d+(\.\d+)?$/.test(token)) {
                firstNumericIndex = i
                break
            }
        }

        if (firstNumericIndex > 0) {
            // Todo lo que está antes del primer número debería ser un solo campo de texto
            const textPart = tokens.slice(0, firstNumericIndex).join(',')
            const numericPart = tokens.slice(firstNumericIndex)

            return [textPart, ...numericPart]
        }
    }

    return tokens
}

/**
 * Función inteligente para parsear CSV que detecta comas dentro de cualquier columna configurada
 * Implementa la lógica: contar comas totales vs columnas esperadas - 1
 * Si hay más comas, buscar columnas configuradas y ajustar el parseo
 */
function parseCSVLineWithSmartCategoryDetection(
    line: string,
    expectedColumns: number,
    columnCommasConfig?: { [columnIndex: number]: number },
): string[] {
    // Contar comas totales en la línea
    const totalCommas = (line.match(/,/g) || []).length

    console.log(`Línea: "${line}"`)
    console.log(
        `Comas totales: ${totalCommas}, Columnas esperadas: ${expectedColumns}`,
    )

    // Si las comas son exactamente columnas - 1, parsear normalmente
    if (totalCommas === expectedColumns - 1) {
        return parseCSVLine(line)
    }

    // Si hay más comas de las esperadas, hay comas dentro de algún campo
    if (totalCommas > expectedColumns - 1) {
        console.log(
            `Detectadas comas extra (${totalCommas} > ${expectedColumns - 1}). Buscando columnas con configuración de comas...`,
        )

        const tokens = parseCSVLine(line)
        const extraCommas = totalCommas - (expectedColumns - 1)

        console.log(
            `Tokens encontrados: ${tokens.length}, esperados: ${expectedColumns}`,
        )
        console.log(`Comas extra detectadas: ${extraCommas}`)

        // Si no hay configuración de comas, usar detección automática
        if (
            !columnCommasConfig ||
            Object.keys(columnCommasConfig).length === 0
        ) {
            console.log(
                'Sin configuración de comas, usando detección automática',
            )
            // Buscar el campo que contiene ":" (formato categoría:subcategoría)
            for (let i = 0; i < tokens.length; i++) {
                if (tokens[i].includes(':')) {
                    console.log(
                        `Columna con ":" detectada automáticamente en índice: ${i}`,
                    )
                    // Aplicar lógica inteligente para esta columna específica
                    const beforeTarget = tokens.slice(0, i)

                    // Lógica inteligente: determinar cuántos tokens tomar para la categoría
                    let tokensToTake = 1 // Al menos el token actual

                    // Si hay comas extra, intentar tomar tokens adicionales pero con validación
                    for (let j = 1; j <= extraCommas; j++) {
                        const nextTokenIndex = i + j
                        if (nextTokenIndex < tokens.length) {
                            const nextToken = tokens[nextTokenIndex]

                            // Si el siguiente token es un número, probablemente es el importe
                            if (/^-?\d+(\.\d+)?$/.test(nextToken)) {
                                console.log(
                                    `Detectado número en posición ${nextTokenIndex}: "${nextToken}" - probablemente importe, parando aquí`,
                                )
                                break
                            }

                            // Si el siguiente token contiene ":" o parece ser parte de la categoría, incluirlo
                            if (
                                nextToken.includes(':') ||
                                /^[a-zA-Z\s,áéíóúÁÉÍÓÚñÑ]+$/.test(nextToken)
                            ) {
                                tokensToTake++
                                console.log(
                                    `Incluyendo token ${nextTokenIndex}: "${nextToken}" en categoría`,
                                )
                            } else {
                                console.log(
                                    `Token ${nextTokenIndex}: "${nextToken}" no parece ser parte de la categoría, parando aquí`,
                                )
                                break
                            }
                        }
                    }

                    const targetTokens = tokens.slice(i, i + tokensToTake)
                    const targetWithCommas = targetTokens.join(', ')
                    const afterTarget = tokens.slice(i + tokensToTake)

                    console.log(
                        `Antes columna objetivo: [${beforeTarget.join(', ')}]`,
                    )
                    console.log(
                        `Columna objetivo con comas: "${targetWithCommas}"`,
                    )
                    console.log(
                        `Después columna objetivo: [${afterTarget.join(', ')}]`,
                    )

                    return [...beforeTarget, targetWithCommas, ...afterTarget]
                }
            }
            // Si no encuentra ":", usar fallback
            return parseCSVLineWithCorrection(line, expectedColumns)
        }

        // Buscar la primera columna configurada que pueda tener comas extra
        let targetColumnIndex = -1
        let targetMaxCommas = 0

        for (const [columnIndex, maxCommas] of Object.entries(
            columnCommasConfig,
        )) {
            const index = parseInt(columnIndex)
            if (index < tokens.length && maxCommas > 0) {
                targetColumnIndex = index
                targetMaxCommas = maxCommas
                console.log(
                    `Columna objetivo: índice ${index}, máximo ${maxCommas} comas`,
                )
                break
            }
        }

        if (targetColumnIndex === -1) {
            console.log('No se encontró columna configurada para comas extra')
            return parseCSVLineWithCorrection(line, expectedColumns)
        }

        // Validar que no exceda el máximo permitido
        if (extraCommas > targetMaxCommas) {
            console.log(
                `ERROR: Comas extra (${extraCommas}) exceden el máximo permitido (${targetMaxCommas}) para columna ${targetColumnIndex}`,
            )
            return parseCSVLineWithCorrection(line, expectedColumns)
        }

        // Ajustar el parseo para la columna objetivo
        const beforeTarget = tokens.slice(0, targetColumnIndex)

        // Lógica inteligente: determinar cuántos tokens tomar para la columna objetivo
        let tokensToTake = 1 // Al menos el token actual

        // Si hay comas extra, intentar tomar tokens adicionales pero con validación
        for (let j = 1; j <= extraCommas; j++) {
            const nextTokenIndex = targetColumnIndex + j
            if (nextTokenIndex < tokens.length) {
                const nextToken = tokens[nextTokenIndex]

                // Si el siguiente token es un número, probablemente es el importe
                if (/^-?\d+(\.\d+)?$/.test(nextToken)) {
                    console.log(
                        `Detectado número en posición ${nextTokenIndex}: "${nextToken}" - probablemente importe, parando aquí`,
                    )
                    break
                }

                // Si el siguiente token contiene ":" o parece ser parte de la categoría, incluirlo
                if (
                    nextToken.includes(':') ||
                    /^[a-zA-Z\s,áéíóúÁÉÍÓÚñÑ]+$/.test(nextToken)
                ) {
                    tokensToTake++
                    console.log(
                        `Incluyendo token ${nextTokenIndex}: "${nextToken}" en columna objetivo`,
                    )
                } else {
                    console.log(
                        `Token ${nextTokenIndex}: "${nextToken}" no parece ser parte de la columna objetivo, parando aquí`,
                    )
                    break
                }
            }
        }

        const targetTokens = tokens.slice(
            targetColumnIndex,
            targetColumnIndex + tokensToTake,
        )
        const targetWithCommas = targetTokens.join(', ')
        const afterTarget = tokens.slice(targetColumnIndex + tokensToTake)

        console.log(`Antes columna objetivo: [${beforeTarget.join(', ')}]`)
        console.log(`Columna objetivo con comas: "${targetWithCommas}"`)
        console.log(`Después columna objetivo: [${afterTarget.join(', ')}]`)

        return [...beforeTarget, targetWithCommas, ...afterTarget]
    }

    // Fallback al parseo normal
    return parseCSVLine(line)
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
export function parseCSVContent(
    csvContent: string,
    columnDefinitions?: Array<{
        name: string
        maxCommas?: number
        order: number
    }>,
): CSVRow[] {
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

    // Crear mapa de configuración de comas para todas las columnas
    const columnCommasConfig: { [columnIndex: number]: number } = {}

    if (isHeader && columnDefinitions) {
        columnDefinitions.forEach((def) => {
            if (def.maxCommas !== undefined) {
                // Buscar la columna en el header por nombre
                const columnIndex = headerTokens.findIndex((h) =>
                    h.toLowerCase().includes(def.name.toLowerCase()),
                )
                if (columnIndex !== -1) {
                    columnCommasConfig[columnIndex] = def.maxCommas
                    console.log(
                        `Configuración de comas para "${def.name}" (índice ${columnIndex}): máximo ${def.maxCommas}`,
                    )
                }
            }
        })
    }

    const startIndex = isHeader ? 1 : 0
    const rows: CSVRow[] = []

    // Determinar el número esperado de columnas basado en el header
    let expectedColumns = headerTokens.length
    if (!isHeader) {
        // Si no hay header, usar la primera línea como referencia
        const firstDataLine = rawLines[0]
        expectedColumns = parseCSVLine(firstDataLine).length
    }

    console.log(`Número esperado de columnas: ${expectedColumns}`)
    console.log(`Header tokens: [${headerTokens.join(', ')}]`)

    for (let i = startIndex; i < rawLines.length; i++) {
        const line = rawLines[i].trim()
        if (!line) continue

        // Usar la función inteligente de parseo
        const tokens = parseCSVLineWithSmartCategoryDetection(
            line,
            expectedColumns,
            columnCommasConfig,
        ).map((t) => t.trim())

        console.log(`Fila ${i + 1} - Tokens después del parseo inteligente:`, {
            lineaOriginal: line,
            tokensRaw: parseCSVLine(line),
            tokensProcesados: tokens,
            tokensLength: tokens.length,
            expectedColumns,
        })

        if (tokens.length < 8) {
            console.warn(`Fila ${i + 1}: tokens insuficientes`, {
                line,
                tokens,
            })
            continue
        }

        // Usar la estructura de columnas definida para mapear campos
        const getFieldByOrder = (fieldName: string): string => {
            if (!columnDefinitions) {
                // Fallback a estructura fija si no hay definiciones
                const fieldMap: { [key: string]: number } = {
                    Identificador: 0,
                    Fecha: 1,
                    Estado: 2,
                    Tipo: 3,
                    Cuenta: 4,
                    Beneficiario: 5,
                }
                const idx = fieldMap[fieldName] ?? -1
                return idx >= 0 ? (tokens[idx] ?? '') : ''
            }

            // Buscar la columna por nombre en las definiciones
            const columnDef = columnDefinitions.find(
                (def) => def.name === fieldName,
            )
            if (columnDef) {
                const idx = columnDef.order - 1 // Convertir a índice 0-based
                return idx < tokens.length ? (tokens[idx] ?? '') : ''
            }

            return ''
        }

        const identificador = getFieldByOrder('Identificador')
        const fecha = getFieldByOrder('Fecha')
        const estado = getFieldByOrder('Estado')
        const tipo = getFieldByOrder('Tipo')
        const cuenta = getFieldByOrder('Cuenta')
        const beneficiario = getFieldByOrder('Beneficiario')

        console.log(`Campos mapeados usando estructura:`, {
            identificador,
            fecha,
            estado,
            tipo,
            cuenta,
            beneficiario,
            columnDefinitions: columnDefinitions?.map((def) => ({
                name: def.name,
                order: def.order,
            })),
        })

        console.log(`Fila ${i + 1} - Tokens procesados:`, {
            identificador,
            fecha,
            estado,
            tipo,
            cuenta,
            beneficiario,
            tokensCompletos: tokens,
            tokensLength: tokens.length,
        })

        // Buscar importe usando estructura de columnas
        let importeIdx = -1
        const importeField = getFieldByOrder('Importe')

        if (importeField) {
            importeIdx = tokens.indexOf(importeField)
            console.log(
                `Importe encontrado usando estructura en índice ${importeIdx}: "${importeField}"`,
            )
        } else {
            // Fallback: buscar primer número
            for (let j = 0; j < tokens.length; j++) {
                const token = tokens[j]
                if (token && looksLikeNumber(token)) {
                    importeIdx = j
                    console.log(
                        `Importe encontrado por búsqueda en índice ${j}: "${token}"`,
                    )
                    break
                }
            }
        }

        if (importeIdx === -1) {
            console.warn(`Fila ${i + 1}: no se encontró importe.`, tokens)
            continue
        }

        console.log(
            `Fila ${i + 1} - Importe encontrado en índice ${importeIdx}:`,
            tokens[importeIdx],
        )

        console.log(`Fila ${i + 1} - Análisis de estructura:`, {
            totalTokens: tokens.length,
            importeIdx,
            estructura: {
                '0-5': tokens.slice(0, 6), // identificador, fecha, estado, tipo, cuenta, beneficiario
                categoria: tokens.slice(6, importeIdx), // categoría
                importe: tokens[importeIdx], // importe
                divisa: tokens[importeIdx + 1], // divisa
                numero: tokens[importeIdx + 2], // número
                notas: tokens.slice(importeIdx + 3), // notas
            },
        })

        // Construir categoría usando estructura de columnas
        const categoriaField = getFieldByOrder('Categoría')
        let categoriaCompleta = categoriaField

        // Si no se encontró categoría por estructura, buscar entre beneficiario e importe
        if (!categoriaCompleta) {
            const beneficiarioIdx = tokens.indexOf(beneficiario)
            const categoriaStartIdx = beneficiarioIdx + 1
            categoriaCompleta = tokens
                .slice(categoriaStartIdx, importeIdx)
                .join(', ')
                .trim()

            console.log(`Categoría construida por posición:`, {
                beneficiarioIdx,
                categoriaStartIdx,
                categoriaCompleta,
                tokensUsados: tokens.slice(categoriaStartIdx, importeIdx),
            })
        } else {
            console.log(
                `Categoría encontrada por estructura: "${categoriaCompleta}"`,
            )
        }

        const importeStr = (tokens[importeIdx] ?? '')
            .replace(/[^\d.-]/g, '')
            .trim()
        const importe = parseFloat(importeStr || '0') || 0

        const divisa = (tokens[importeIdx + 1] ?? '').trim() || 'ARS'
        const numero = (tokens[importeIdx + 2] ?? '').trim()

        // Construir notas usando estructura de columnas
        const notasField = getFieldByOrder('Notas')
        let notas = notasField

        // Si no se encontraron notas por estructura, usar lógica de búsqueda
        if (!notas) {
            // Lógica mejorada para encontrar notas: buscar después de importe, divisa, número
            let notasTokens: string[] = []
            let notasStartIdx = importeIdx + 3

            // Estrategia 1: Si hay tokens después de número, tomarlos como notas
            if (tokens.length > notasStartIdx) {
                notasTokens = tokens.slice(notasStartIdx)
                console.log(
                    `Estrategia 1: Notas después de número (índice ${notasStartIdx})`,
                )
            }

            // Estrategia 2: Si no hay tokens después de número, pero hay tokens después de divisa, tomarlos como notas
            else if (tokens.length > importeIdx + 2 && !numero) {
                notasTokens = tokens.slice(importeIdx + 2)
                console.log(
                    `Estrategia 2: Notas después de divisa (índice ${importeIdx + 2})`,
                )
            }

            // Estrategia 3: Si no hay tokens después de divisa, pero hay tokens después de importe, tomarlos como notas
            else if (tokens.length > importeIdx + 1 && !divisa) {
                notasTokens = tokens.slice(importeIdx + 1)
                console.log(
                    `Estrategia 3: Notas después de importe (índice ${importeIdx + 1})`,
                )
            }

            // Estrategia 4: Buscar tokens que parezcan notas (texto largo con espacios)
            else {
                console.log(`Estrategia 4: Buscando tokens que parezcan notas`)
                for (let k = importeIdx + 1; k < tokens.length; k++) {
                    const token = tokens[k]
                    // Si el token es largo y contiene espacios, probablemente es una nota
                    if (token && token.length > 10 && token.includes(' ')) {
                        notasTokens = tokens.slice(k)
                        console.log(
                            `Encontradas notas desde índice ${k}: "${token}"`,
                        )
                        break
                    }
                }
            }

            notas = notasTokens.join(', ').trim()
            console.log(`Notas construidas por búsqueda: "${notas}"`)
        } else {
            console.log(`Notas encontradas por estructura: "${notas}"`)
        }

        console.log(`Fila ${i + 1} - Construcción de notas:`, {
            notas,
            notasEncontradasPorEstructura: !!notasField,
        })

        console.log(`Fila ${i + 1} - Campos finales:`, {
            identificador,
            fecha,
            categoriaCompleta,
            importe,
            divisa,
            numero,
            notas,
            notasTokens: tokens.slice(importeIdx + 3),
            notasLength: tokens.length - (importeIdx + 3),
        })

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

        console.log(`Fila ${i + 1} - CSVRow creado:`, {
            identificador: row.identificador,
            notas: row.notas,
            notasLength: row.notas?.length || 0,
        })

        rows.push(row)
    }

    if (rows.length === 0) {
        throw new Error('No se encontraron filas válidas después del parseo')
    }

    return rows
}

/**
 * ============================================
 *  Parseo CSV con mapeo de columnas personalizado
 * ============================================
 */
export function parseCSVContentWithMapping(
    csvContent: string,
    columnMapping: any,
): CSVRow[] {
    const rawLines = csvContent
        .split('\n')
        .map((l) => l.replace(/\r$/, ''))
        .filter((line) => line.trim() !== '')

    if (rawLines.length < 1) {
        throw new Error('El archivo CSV no tiene filas')
    }

    const headerTokens = parseCSVLine(rawLines[0]).map((h) => h.trim())
    const expectedColumns = headerTokens.length

    // Crear un mapa de índices basado en el mapeo de columnas
    const columnIndexMap: { [key: string]: number } = {}
    headerTokens.forEach((header, index) => {
        columnIndexMap[header] = index
    })

    // Verificar que las columnas mapeadas existan
    // Manejar estructura personalizada con egreso/ingreso separados
    const requiredFields = ['fecha', 'categoria']
    for (const field of requiredFields) {
        if (
            !columnMapping[field] ||
            columnIndexMap[columnMapping[field]] === undefined
        ) {
            throw new Error(
                `La columna mapeada para '${field}' no existe en el CSV`,
            )
        }
    }

    // Verificar que al menos uno de egreso, ingreso o importe esté presente
    const hasEgreso =
        columnMapping['egreso'] &&
        columnIndexMap[columnMapping['egreso']] !== undefined
    const hasIngreso =
        columnMapping['ingreso'] &&
        columnIndexMap[columnMapping['ingreso']] !== undefined
    const hasImporte =
        columnMapping['importe'] &&
        columnIndexMap[columnMapping['importe']] !== undefined
    if (!hasEgreso && !hasIngreso && !hasImporte) {
        throw new Error(
            'Se requiere al menos una columna de egreso, ingreso o importe',
        )
    }

    const startIndex = 1 // Asumir que siempre hay header
    const rows: CSVRow[] = []

    for (let i = startIndex; i < rawLines.length; i++) {
        const line = rawLines[i].trim()
        if (!line) continue

        const tokens = parseCSVLineWithSmartCategoryDetection(
            line,
            expectedColumns,
            undefined, // No tenemos configuración de comas en este contexto
        ).map((t) => t.trim())

        if (tokens.length < 3) {
            console.warn(`Fila ${i + 1}: tokens insuficientes`, {
                line,
                tokens,
            })
            continue
        }

        // Mapear las columnas usando el mapeo proporcionado
        const getValue = (field: string): string => {
            const columnName = columnMapping[field]
            if (!columnName) return ''
            const index = columnIndexMap[columnName]
            return tokens[index] || ''
        }

        const fecha = getValue('fecha')
        const categoria = getValue('categoria')
        const subcategoria = getValue('subcategoria')
        const nota = getValue('nota')

        // Debug específico para separación de categorías
        if (categoria.includes(':')) {
            const colonIdx = categoria.indexOf(':')
            const grupo = categoria.slice(0, colonIdx).trim()
            const subgrupo = categoria.slice(colonIdx + 1).trim()
        }

        // Manejar diferentes casos de monto y tipo
        let importe = 0
        let tipo = ''

        // Caso 1: Columna "Importe" - tipo determinado por signo
        if (getValue('importe')) {
            const importeStr = getValue('importe')
                .replace(/[^\d.-]/g, '')
                .trim()
            importe = parseFloat(importeStr || '0') || 0

            // Tipo determinado únicamente por el signo del importe
            tipo = importe >= 0 ? 'ingreso' : 'egreso'

            importe = Math.abs(importe)
        }
        // Caso 2: Columnas separadas "Egreso" e "Ingreso"
        else {
            const egresoStr = getValue('egreso')
                .replace(/[^\d.-]/g, '')
                .trim()
            const ingresoStr = getValue('ingreso')
                .replace(/[^\d.-]/g, '')
                .trim()

            const egreso = parseFloat(egresoStr || '0') || 0
            const ingreso = parseFloat(ingresoStr || '0') || 0

            if (egreso > 0 && ingreso > 0) {
                // Si ambos tienen valor, usar el mayor
                if (egreso >= ingreso) {
                    importe = egreso
                    tipo = 'egreso'
                } else {
                    importe = ingreso
                    tipo = 'ingreso'
                }
            } else if (egreso > 0) {
                importe = egreso
                tipo = 'egreso'
            } else if (ingreso > 0) {
                importe = ingreso
                tipo = 'ingreso'
            }
        }

        // Validar campos requeridos
        if (!fecha || !categoria || importe === 0) {
            console.warn(`Fila ${i + 1}: campos requeridos faltantes`, {
                fecha,
                categoria,
                importe,
                tipo,
            })
            continue
        }

        const row: CSVRow = {
            identificador: getValue('identificador') || '',
            fecha,
            estado: getValue('estado') || '',
            tipo: tipo,
            cuenta: getValue('cuenta') || '',
            beneficiario: getValue('beneficiario') || '',
            categoria: categoria,
            importe,
            divisa: getValue('divisa') || 'ARS',
            numero: getValue('numero') || '',
            notas: nota,
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
        console.log('csvRowToMovement - Input row:', {
            fecha: row.fecha,
            categoria: row.categoria,
            importe: row.importe,
            notas: row.notas,
            identificador: row.identificador,
        })

        const fecha = (row.fecha ?? '').trim()
        if (!fecha) return null

        // Usar el tipo que ya se determinó correctamente en el procesador
        const tipo: 'ingreso' | 'egreso' = row.tipo as 'ingreso' | 'egreso'
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

        console.log('csvRowToMovement - Procesado:', {
            fecha,
            grupo,
            subgrupo,
            tipo,
            monto,
            nota,
            notaOriginal: row.notas,
        })

        return {
            fecha, // 🔴 se conserva exactamente como viene del CSV
            categoria: { grupo, subgrupo },
            tipo,
            monto,
            nota,
            externalId: (row.identificador ?? '').trim() || undefined,
        }
    } catch (error) {
        console.error('Error en csvRowToMovement:', error)
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
    columnMapping?: any,
    columnDefinitions?: Array<{
        name: string
        maxCommas?: number
        order: number
    }>,
): ProcessedDataset {
    const rows = columnMapping
        ? parseCSVContentWithMapping(csvContent, columnMapping)
        : parseCSVContent(csvContent, columnDefinitions)

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
    columnMapping?: any,
    columnDefinitions?: Array<{
        name: string
        maxCommas?: number
        order: number
    }>,
): Promise<ProcessedDataset> {
    const csvContent = await parseCSVFile(file)
    const dataset = processCSVToDataset(
        csvContent,
        file.name,
        datasetName,
        importedBy,
        datasetType,
        columnMapping,
        columnDefinitions,
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
