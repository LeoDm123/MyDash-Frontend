import { createDataset, addMovementsToDataset } from '@/api/api'
import * as XLSX from 'xlsx'

// Tipos para el nuevo formato Excel de entrada
interface NewFormatExcelRow {
    fecha: string
    tipo: string
    nota: string
    divisa: string
    montoOriginal: number
    montoARS: number
}

// Tipos para el schema de MongoDB (reutilizamos los existentes)
interface Movement {
    fecha: string
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
    fecha: string
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
    periodStart?: string
    periodEnd?: string
}

/**
 * Parsea el contenido de un archivo Excel y lo convierte a un array de objetos
 */
export function parseExcelFile(file: File): Promise<NewFormatExcelRow[]> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader()

        reader.onload = (event) => {
            try {
                const data = event.target?.result
                const workbook = XLSX.read(data, { type: 'array' })
                
                // Obtener la primera hoja
                const sheetName = workbook.SheetNames[0]
                const worksheet = workbook.Sheets[sheetName]
                
                // Convertir a JSON
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 })
                
                console.log('Datos Excel parseados:', jsonData)
                
                // Procesar los datos
                const rows = processExcelData(jsonData)
                resolve(rows)
            } catch (error) {
                console.error('Error procesando archivo Excel:', error)
                reject(new Error('Error al procesar el archivo Excel'))
            }
        }

        reader.onerror = () => {
            reject(new Error('Error al leer el archivo'))
        }

        reader.readAsArrayBuffer(file)
    })
}

/**
 * Procesa los datos Excel convertidos a JSON
 */
function processExcelData(jsonData: any[]): NewFormatExcelRow[] {
    if (jsonData.length < 2) {
        throw new Error(
            'El archivo Excel debe tener al menos una fila de encabezados y una fila de datos',
        )
    }

    // Obtener encabezados (primera fila)
    const headers = jsonData[0].map((h: any) =>
        String(h).trim().toLowerCase().replace(/"/g, ''),
    )
    console.log('Encabezados encontrados:', headers)

    // Verificar si tiene encabezados o si son datos directos
    const hasHeaders = headers.some((header: string) =>
        [
            'fecha',
            'tipo',
            'nota',
            'divisa',
            'monto original',
            'monto ars',
        ].includes(header),
    )

    let startIndex = 1
    if (!hasHeaders) {
        startIndex = 0
        console.log(
            'No se detectaron encabezados, procesando desde la primera fila',
        )
    }

    // Parsear filas de datos
    const rows: NewFormatExcelRow[] = []

    for (let i = startIndex; i < jsonData.length; i++) {
        const rowData = jsonData[i]
        if (!rowData || rowData.length === 0) continue

        // Convertir todos los valores a string para procesamiento
        const values = rowData.map((val: any) => String(val || '').trim())

        // DEBUG: Mostrar los valores crudos para diagnóstico
        console.log(`Fila ${i + 1} valores crudos:`, values)

        // Verificar que tengamos exactamente 6 valores
        if (values.length !== 6) {
            console.warn(
                `Fila ${i + 1} no tiene 6 columnas (${values.length}), ajustando...`,
                values,
            )

            // Si tenemos menos de 6 valores, completar con strings vacíos
            while (values.length < 6) {
                values.push('')
            }

            // Si tenemos más de 6 valores, truncar a 6
            if (values.length > 6) {
                values.splice(6)
            }
        }

        // Convertir montos a números
        let montoOriginal = 0
        let montoARS = 0

        try {
            const montoOriginalStr = (values[4] || '0')
                .replace(/"/g, '')
                .replace(/,/g, '.')
                .replace(/[^\d.-]/g, '')
            montoOriginal = parseFloat(montoOriginalStr) || 0
        } catch (error) {
            console.warn(
                `Error parseando monto original en fila ${i + 1}:`,
                values[4],
            )
            montoOriginal = 0
        }

        try {
            const montoARSStr = (values[5] || '0')
                .replace(/"/g, '')
                .replace(/,/g, '.')
                .replace(/[^\d.-]/g, '')
            montoARS = parseFloat(montoARSStr) || 0
        } catch (error) {
            console.warn(
                `Error parseando monto ARS en fila ${i + 1}:`,
                values[5],
            )
            montoARS = 0
        }

        // Limpiar comillas de todos los campos de texto
        const cleanValue = (value: string) =>
            value.replace(/^"+|"+$/g, '').trim()

        // Mapear por posición según el nuevo formato
        const row: NewFormatExcelRow = {
            fecha: cleanValue(values[0] || ''),
            tipo: cleanValue(values[1] || ''),
            nota: cleanValue(values[2] || ''),
            divisa: cleanValue(values[3] || ''),
            montoOriginal: montoOriginal,
            montoARS: montoARS,
        }

        // DEBUG: Verificar si la fecha está vacía
        if (!row.fecha) {
            console.warn(`Fila ${i + 1} tiene fecha vacía. Valores:`, values)
        }

        console.log(`Fila ${i + 1} procesada:`, row)
        rows.push(row)
    }

    console.log(`Total filas procesadas: ${rows.length}`)
    return rows
}


/**
 * Convierte una fila Excel del nuevo formato a un movimiento del schema de MongoDB
 */
function newFormatExcelRowToMovement(row: NewFormatExcelRow): Movement | null {
    try {
        // Mantener la fecha como string
        const fecha = row.fecha.trim()

        if (!fecha) {
            console.warn(`Fecha vacía en fila: ${row.nota}`)
            return null
        }

        // Usar el monto ARS como el monto principal
        const monto = row.montoARS

        // Si el monto es 0, saltar esta fila
        if (monto === 0) {
            console.warn(`Monto cero en fila con fecha: ${fecha}, saltando`)
            return null
        }

        // Determinar tipo basado en el campo "tipo" del CSV
        let tipo: 'ingreso' | 'egreso'
        let montoFinal: number

        const tipoCSV = row.tipo.trim().toLowerCase()

        if (
            tipoCSV === 'ingreso' ||
            tipoCSV === 'income' ||
            tipoCSV === 'deposit'
        ) {
            tipo = 'ingreso'
            montoFinal = Math.abs(monto) // Siempre positivo
        } else if (
            tipoCSV === 'egreso' ||
            tipoCSV === 'expense' ||
            tipoCSV === 'withdrawal'
        ) {
            tipo = 'egreso'
            montoFinal = Math.abs(monto) // Siempre positivo
        } else {
            // Si no reconocemos el tipo, usar el signo del monto como fallback
            if (monto >= 0) {
                tipo = 'ingreso'
                montoFinal = monto
            } else {
                tipo = 'egreso'
                montoFinal = Math.abs(monto)
            }
        }

        // Crear categoría basada en el tipo de transacción
        // Por ahora usamos el tipo como grupo, pero esto se puede mejorar
        const grupo = row.tipo.trim() || 'Sin categoría'
        const subgrupo = undefined // Se puede extraer de la nota si es necesario

        const nota = row.nota.trim() || undefined

        return {
            fecha, // string en lugar de Date
            categoria: {
                grupo,
                subgrupo,
            },
            tipo,
            monto: montoFinal,
            nota,
        }
    } catch (error) {
        console.error(`Error procesando fila:`, row, error)
        return null
    }
}

/**
 * Procesa un archivo Excel del nuevo formato y lo convierte al schema de MongoDB
 */
export function processNewFormatExcelToDataset(
    rows: NewFormatExcelRow[],
    fileName: string,
    datasetName?: string,
    importedBy?: string,
    datasetType: string = 'cashflow',
): ProcessedDataset {

    if (rows.length === 0) {
        throw new Error('No se encontraron datos válidos en el archivo CSV')
    }

    // Convertir filas a movimientos
    const movements: Movement[] = []
    const validMovements: Movement[] = []

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i]
        const movement = newFormatExcelRowToMovement(row)

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
    validMovements.sort((a, b) => {
        // Convertir fechas string a formato comparable (YYYYMMDD)
        const dateA = a.fecha.split('/').reverse().join('')
        const dateB = b.fecha.split('/').reverse().join('')
        return dateA.localeCompare(dateB)
    })

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
        .sort((a, b) => {
            const dateA = a.split('/').reverse().join('')
            const dateB = b.split('/').reverse().join('')
            return dateA.localeCompare(dateB)
        })

    const periodStart = fechas[0]
    const periodEnd = fechas[fechas.length - 1]

    // Determinar divisa (asumimos ARS ya que usamos monto ARS)
    const divisa = 'ARS'

    // Generar nombre del dataset
    const finalDatasetName =
        datasetName ||
        fileName.replace(/\.[^/.]+$/, '') ||
        `Dataset_${new Date().toISOString().split('T')[0]}`

    console.log('Nombre del dataset generado:', finalDatasetName)

    const result = {
        datasetName: finalDatasetName,
        originalFileName: fileName,
        importedBy,
        currency: divisa,
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
            source: 'csv-import-new-format',
            externalId: undefined,
        }

        if (index < 3) {
            console.log(`Movimiento ${index + 1} convertido:`, apiMovement)
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
 * Función principal para procesar y subir un archivo Excel del nuevo formato
 */
export async function processAndUploadNewFormatExcel(
    file: File,
    datasetName?: string,
    importedBy?: string,
    datasetType: string = 'cashflow',
): Promise<ProcessedDataset> {
    try {
        console.log('=== INICIANDO PROCESO COMPLETO (NUEVO FORMATO EXCEL) ===')
        console.log('Archivo recibido:', file.name, file.type, file.size)
        console.log('Dataset Name:', datasetName)
        console.log('Imported By:', importedBy)
        console.log('Dataset Type:', datasetType)

        // Parsear archivo Excel
        console.log('1. Parseando archivo Excel...')
        const rows = await parseExcelFile(file)
        console.log('Archivo Excel parseado exitosamente')

        // Procesar datos
        console.log('2. Procesando datos Excel...')
        const dataset = processNewFormatExcelToDataset(
            rows,
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
        const BATCH_SIZE = 500
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
