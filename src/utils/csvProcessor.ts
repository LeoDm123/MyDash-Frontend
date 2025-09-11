import { createDataset, addMovementsToDataset } from '@/api/api'

// Tipos para el CSV de entrada
interface CSVRow {
    fecha: string
    categoria: string
    subcategoria: string
    egreso: string | number
    ingreso: string | number
    saldo: string | number
    notas: string
}

// Tipos para el schema de MongoDB
interface Movement {
    fecha: Date
    categoria: {
        grupo: string
        subgrupo?: string
    }
    tipo: 'ingreso' | 'egreso'
    monto: number
    saldo?: number
    nota?: string
}

// Tipo compatible con la API
interface APIMovement {
    fecha: string | Date
    categoria: any
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
    currency: string
    datasetType: string
    movements: Movement[]
    periodStart?: Date
    periodEnd?: Date
}

/**
 * Parsea el contenido de un archivo CSV y lo convierte a texto
 */
export function parseCSVFile(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader()

        reader.onload = (event) => {
            const content = event.target?.result as string
            resolve(content)
        }

        reader.onerror = () => {
            reject(new Error('Error al leer el archivo'))
        }

        reader.readAsText(file, 'UTF-8')
    })
}

/**
 * Parsea el contenido CSV y lo convierte a un array de objetos
 */
export function parseCSVContent(csvContent: string): CSVRow[] {
    const lines = csvContent.split('\n').filter((line) => line.trim() !== '')

    if (lines.length < 2) {
        throw new Error(
            'El archivo CSV debe tener al menos una fila de encabezados y una fila de datos',
        )
    }

    // Obtener encabezados
    const headers = lines[0].split(',').map((h) => h.trim().toLowerCase())
    console.log('Encabezados encontrados:', headers)

    // Verificar si tiene encabezados o si son datos directos
    const hasHeaders = headers.some((header) =>
        [
            'fecha',
            'categoria',
            'subcategoria',
            'egreso',
            'ingreso',
            'saldo',
            'notas',
        ].includes(header),
    )

    let startIndex = 1
    if (!hasHeaders) {
        // Si no tiene encabezados, empezar desde la primera fila
        startIndex = 0
        console.log(
            'No se detectaron encabezados, procesando desde la primera fila',
        )
    }

    // Parsear filas de datos
    const rows: CSVRow[] = []

    for (let i = startIndex; i < lines.length; i++) {
        const line = lines[i].trim()
        if (!line) continue

        const values = line.split(',').map((v) => v.trim())

        // Verificar que tenga al menos 7 columnas (fecha, categoria, subcategoria, egreso, ingreso, saldo, notas)
        if (values.length < 7) {
            console.warn(
                `Fila ${i + 1} tiene menos columnas de las esperadas (${values.length}/7), saltando...`,
            )
            continue
        }

        // Mapear por posición fija: fecha, categoría, subcategoría, egreso, ingreso, saldo, notas
        const row: CSVRow = {
            fecha: values[0] || '', // fecha
            categoria: values[1] || '', // categoría
            subcategoria: values[2] || '', // subcategoría
            egreso: values[3] || '0', // egreso
            ingreso: values[4] || '0', // ingreso
            saldo: values[5] || '0', // saldo
            notas: values[6] || '', // notas
        }

        console.log(`Fila ${i + 1} procesada:`, row)
        rows.push(row)
    }

    console.log(`Total filas procesadas: ${rows.length}`)
    return rows
}

/**
 * Convierte una fila CSV a un movimiento del schema de MongoDB
 */
function csvRowToMovement(row: CSVRow): Movement | null {
    try {
        // Parsear fecha - manejar formato DD/MM/YY
        let fecha: Date

        if (row.fecha.includes('/')) {
            // Formato DD/MM/YY o DD/MM/YYYY
            const parts = row.fecha.split('/')
            if (parts.length === 3) {
                const day = parseInt(parts[0])
                const month = parseInt(parts[1]) - 1 // Los meses en JS van de 0-11
                let year = parseInt(parts[2])

                // Si el año es de 2 dígitos, asumir 20XX
                if (year < 100) {
                    year += 2000
                }

                fecha = new Date(year, month, day)
            } else {
                fecha = new Date(row.fecha)
            }
        } else {
            // Formato estándar YYYY-MM-DD
            fecha = new Date(row.fecha)
        }

        if (isNaN(fecha.getTime())) {
            console.warn(`Fecha inválida en fila: ${row.fecha}`)
            return null
        }

        // Parsear montos
        const egreso =
            parseFloat(String(row.egreso).replace(/[^\d.-]/g, '')) || 0
        const ingreso =
            parseFloat(String(row.ingreso).replace(/[^\d.-]/g, '')) || 0
        const saldo =
            parseFloat(String(row.saldo).replace(/[^\d.-]/g, '')) || undefined

        // Determinar tipo y monto
        let tipo: 'ingreso' | 'egreso'
        let monto: number

        if (egreso > 0 && ingreso > 0) {
            // Si ambos tienen valor, priorizar el mayor
            if (egreso > ingreso) {
                tipo = 'egreso'
                monto = egreso
            } else {
                tipo = 'ingreso'
                monto = ingreso
            }
        } else if (egreso > 0) {
            tipo = 'egreso'
            monto = egreso
        } else if (ingreso > 0) {
            tipo = 'ingreso'
            monto = ingreso
        } else {
            // Si ambos son 0, saltar esta fila
            return null
        }

        // Limpiar y validar categoría
        const categoria = row.categoria.trim()
        if (!categoria) {
            console.warn(`Categoría vacía en fila con fecha: ${row.fecha}`)
            return null
        }

        const subcategoria = row.subcategoria.trim() || undefined
        const nota = row.notas.trim() || undefined

        return {
            fecha,
            categoria: {
                grupo: categoria,
                subgrupo: subcategoria,
            },
            tipo,
            monto: Math.abs(monto), // Asegurar que sea positivo
            saldo,
            nota,
        }
    } catch (error) {
        console.error(`Error procesando fila:`, row, error)
        return null
    }
}

/**
 * Procesa un archivo CSV completo y lo convierte al schema de MongoDB
 */
export function processCSVToDataset(
    csvContent: string,
    fileName: string,
    datasetName?: string,
    importedBy?: string,
    datasetType: string = 'cashflow',
): ProcessedDataset {
    const rows = parseCSVContent(csvContent)

    if (rows.length === 0) {
        throw new Error('No se encontraron datos válidos en el archivo CSV')
    }

    // Convertir filas a movimientos
    const movements: Movement[] = []
    const validMovements: Movement[] = []

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i]
        const movement = csvRowToMovement(row)
        if (movement) {
            movements.push(movement)
            validMovements.push(movement)
        } else {
            console.log(`✗ Movimiento ${i + 1} inválido, saltando`)
        }
    }

    if (validMovements.length === 0) {
        throw new Error(
            'No se pudieron procesar movimientos válidos del archivo CSV',
        )
    }

    // Ordenar movimientos por fecha
    validMovements.sort((a, b) => a.fecha.getTime() - b.fecha.getTime())

    // Calcular totales
    let ingresos = 0
    let egresos = 0

    for (const movement of validMovements) {
        if (movement.tipo === 'ingreso') {
            ingresos += movement.monto
        } else {
            egresos += movement.monto
        }
    }

    // Determinar fechas de inicio y fin
    const fechas = validMovements
        .map((m) => m.fecha)
        .sort((a, b) => a.getTime() - b.getTime())
    const periodStart = fechas[0]
    const periodEnd = fechas[fechas.length - 1]

    // Generar nombre del dataset: usar el nombre del archivo sin extensión
    const finalDatasetName =
        fileName.replace(/\.[^/.]+$/, '') ||
        `Dataset_${new Date().toISOString().split('T')[0]}`
    console.log('Nombre del dataset generado:', finalDatasetName)

    const result = {
        datasetName: finalDatasetName,
        originalFileName: fileName,
        importedBy,
        currency: 'ARS',
        datasetType,
        movements: validMovements,
        periodStart,
        periodEnd,
    }

    return result
}

/**
 * Convierte movimientos al formato de la API
 */
function convertMovementsToAPI(movements: Movement[]): APIMovement[] {
    const apiMovements = movements.map((movement, index) => {
        const apiMovement = {
            fecha: movement.fecha,
            categoria: movement.categoria,
            tipo: movement.tipo,
            monto: movement.monto,
            saldo: movement.saldo,
            nota: movement.nota,
            source: 'csv-import',
            externalId: undefined,
        }

        if (index < 3) {
        }

        return apiMovement
    })

    return apiMovements
}

/**
 * Función para dividir movimientos en lotes más pequeños
 */
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
 * Función principal para procesar y subir un archivo CSV
 */
export async function processAndUploadCSV(
    file: File,
    datasetName?: string,
    importedBy?: string,
    datasetType: string = 'cashflow',
): Promise<ProcessedDataset> {
    try {
        console.log('=== INICIANDO PROCESO COMPLETO ===')
        console.log('Archivo recibido:', file.name, file.type, file.size)
        console.log('Dataset Name:', datasetName)
        console.log('Imported By:', importedBy)
        console.log('Dataset Type:', datasetType)

        // Parsear archivo
        console.log('1. Parseando archivo...')
        const csvContent = await parseCSVFile(file)
        console.log('Archivo parseado exitosamente')

        // Procesar datos
        console.log('2. Procesando datos CSV...')
        const dataset = processCSVToDataset(
            csvContent,
            file.name,
            datasetName,
            importedBy,
            datasetType,
        )
        console.log('Datos procesados exitosamente')

        // Convertir movimientos al formato de la API
        console.log('3. Convirtiendo a formato API...')
        const apiMovements = convertMovementsToAPI(dataset.movements)

        // Verificar si necesitamos dividir en lotes
        const BATCH_SIZE = 500 // Reducir el tamaño del lote para evitar errores 413
        const needsBatching = apiMovements.length > BATCH_SIZE

        if (needsBatching) {
            const batches = splitMovementsIntoBatches(apiMovements, BATCH_SIZE)

            let datasetId: string | null = null

            // Enviar cada lote por separado
            for (let i = 0; i < batches.length; i++) {
                if (i === 0) {
                    // Primer lote: crear el dataset
                    const apiData = {
                        datasetName: dataset.datasetName,
                        originalFileName: dataset.originalFileName,
                        importedBy: dataset.importedBy,
                        currency: dataset.currency,
                        datasetType: dataset.datasetType,
                        movements: batches[i],
                    }

                    console.log('=== DATOS ENVIADOS A LA API (PRIMER LOTE) ===')
                    console.log('Dataset Name:', apiData.datasetName)
                    console.log('Original File Name:', apiData.originalFileName)
                    console.log('Imported By:', apiData.importedBy)
                    console.log('Currency:', apiData.currency)
                    console.log('Dataset Type:', apiData.datasetType)
                    console.log('Movements Count:', apiData.movements.length)
                    console.log('Primer movimiento:', apiData.movements[0])

                    const response = await createDataset(apiData)
                    console.log(
                        'Respuesta completa de createDataset:',
                        response,
                    )

                    // Intentar obtener el ID de diferentes formas posibles
                    datasetId = response.datasetId

                    if (!datasetId) {
                        throw new Error(
                            'No se pudo obtener el ID del dataset creado',
                        )
                    }
                } else {
                    // Lotes siguientes: agregar movimientos al dataset existente
                    if (!datasetId) {
                        throw new Error(
                            'No se pudo obtener el ID del dataset para agregar movimientos',
                        )
                    }

                    await addMovementsToDataset(datasetId, batches[i])
                }

                // Pequeña pausa entre lotes para no sobrecargar el servidor
                if (i < batches.length - 1) {
                    await new Promise((resolve) => setTimeout(resolve, 1000))
                }
            }
        } else {
            console.log('4. Enviando dataset completo...')
            const apiData = {
                datasetName: dataset.datasetName,
                originalFileName: dataset.originalFileName,
                importedBy: dataset.importedBy,
                currency: dataset.currency,
                datasetType: dataset.datasetType,
                movements: apiMovements,
            }

            console.log('=== DATOS ENVIADOS A LA API (SIN LOTES) ===')
            console.log('Dataset Name:', apiData.datasetName)
            console.log('Original File Name:', apiData.originalFileName)
            console.log('Imported By:', apiData.importedBy)
            console.log('Currency:', apiData.currency)
            console.log('Dataset Type:', apiData.datasetType)
            console.log('Movements Count:', apiData.movements.length)
            console.log('Primer movimiento:', apiData.movements[0])

            await createDataset(apiData)
            console.log('✓ Dataset creado exitosamente')
        }

        return dataset
    } catch (error) {
        console.error('❌ Error procesando CSV:', error)
        throw error
    }
}
