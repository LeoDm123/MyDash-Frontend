import React, { useCallback, useMemo, useState, useEffect } from 'react'
import HomeCard from './HomeCard'
import ColumnDefiner, { ColumnDefinition } from './ColumnDefiner'
import { processAndUploadCSV } from '@/utils/csvMMEXProcessor'
import { processAndUploadNewFormatExcel } from '@/utils/excelNewFormatProcessor'
import { useAppSelector } from '@/store'

interface UploaderCardProps {
    onSubmit?: (file: File, datasetType?: string) => void | Promise<void>
    disabled?: boolean
    title?: string
    helperText?: string
}

const ACCEPTED_EXTENSIONS = ['.csv', '.xml', '.xlsx']
const ACCEPTED_MIME_TYPES = [
    'text/csv',
    'application/vnd.ms-excel',
    'application/xml',
    'text/xml',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]

const DATASET_TYPES = [
    { value: 'cashflow', label: 'Flujo de Caja' },
    { value: 'inventory', label: 'Inventario' },
    { value: 'investment', label: 'Inversiones' },
    { value: 'humanResources', label: 'Recursos Humanos' },
    { value: 'marketing', label: 'Marketing' },
    { value: 'sales', label: 'Ventas' },
    { value: 'other', label: 'Otro' },
]

function isAcceptedFile(file: File): boolean {
    const lowerName = file.name.toLowerCase()
    const hasAcceptedExt = ACCEPTED_EXTENSIONS.some((ext) =>
        lowerName.endsWith(ext),
    )
    const hasAcceptedMime = ACCEPTED_MIME_TYPES.includes(file.type)
    return hasAcceptedExt || hasAcceptedMime
}

function getFileType(file: File): 'csv' | 'xlsx' | 'xml' | 'unknown' {
    const lowerName = file.name.toLowerCase()

    if (lowerName.endsWith('.csv') || file.type === 'text/csv') {
        return 'csv'
    }

    if (
        lowerName.endsWith('.xlsx') ||
        file.type ===
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        file.type === 'application/vnd.ms-excel'
    ) {
        return 'xlsx'
    }

    if (
        lowerName.endsWith('.xml') ||
        file.type === 'application/xml' ||
        file.type === 'text/xml'
    ) {
        return 'xml'
    }

    return 'unknown'
}

function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    const value = bytes / Math.pow(k, i)
    return `${value.toFixed(1)} ${sizes[i]}`
}

const UploaderCard: React.FC<UploaderCardProps> = ({
    onSubmit,
    disabled = false,
    title = 'Cargar archivo',
    helperText = 'Arrastrá y soltá un archivo .csv, .xlsx o .xml, o hacé clic para seleccionarlo',
}) => {
    const [file, setFile] = useState<File | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)
    const [dragActive, setDragActive] = useState<boolean>(false)
    const [submitting, setSubmitting] = useState<boolean>(false)
    const [datasetType, setDatasetType] = useState<string>('cashflow')
    const [csvHeaders, setCsvHeaders] = useState<string[]>([])
    const [csvData, setCsvData] = useState<string[][]>([])
    const [csvHasHeaders, setCsvHasHeaders] = useState<boolean>(false)
    const [expectedColumns, setExpectedColumns] = useState<ColumnDefinition[]>(
        [],
    )
    const [columnMatch, setColumnMatch] = useState<{
        isValid: boolean
        matches: { [key: string]: boolean }
        missing: string[]
        extra: string[]
        orderErrors: string[]
        typeErrors: string[]
        smartMatches: {
            [key: string]: {
                csvIndex: number
                csvHeader: string
                confidence: number
            }
        }
    } | null>(null)
    const [showColumnDefiner, setShowColumnDefiner] = useState<boolean>(true)

    // Verificar coincidencia cuando cambien las columnas esperadas
    useEffect(() => {
        if (expectedColumns.length > 0 && csvHeaders.length > 0) {
            console.log('Validando estructura actualizada...')

            // Limpiar mensajes anteriores antes de validar
            setError(null)
            setSuccess(null)

            const match = checkColumnMatch(csvHeaders, expectedColumns, csvData)
            console.log('Resultado de validación:', match)
            setColumnMatch(match)

            if (!match.isValid) {
                let errorMessage = 'La estructura definida tiene problemas:'
                if (match.missing.length > 0) {
                    errorMessage += ` Faltan columnas requeridas: ${match.missing.join(', ')}.`
                }
                if (match.typeErrors.length > 0) {
                    errorMessage += ` Errores de tipo: ${match.typeErrors.join('; ')}.`
                }
                if (match.commaErrors.length > 0) {
                    errorMessage += ` Errores de comas: ${match.commaErrors.join('; ')}.`
                }
                setError(errorMessage)
            } else {
                setSuccess(
                    '✓ Estructura válida: El archivo CSV coincide perfectamente con la estructura definida',
                )
            }
        }
    }, [expectedColumns, csvHeaders, csvData])

    // Obtener el usuario autenticado del localStorage
    const getUserFromLocalStorage = () => {
        try {
            const userData = localStorage.getItem('user')
            if (userData) {
                const user = JSON.parse(userData)
                return user?.email || 'anonymous@example.com'
            }
        } catch (error) {
            console.warn('Error al obtener usuario del localStorage:', error)
        }
        return 'anonymous@example.com'
    }

    const importedBy = getUserFromLocalStorage()
    console.log('Usuario obtenido del localStorage:', importedBy)

    const acceptAttr = useMemo(
        () =>
            `${ACCEPTED_MIME_TYPES.join(',')},${ACCEPTED_EXTENSIONS.join(',')}`,
        [],
    )

    const reset = () => {
        setFile(null)
        setError(null)
        setSuccess(null)
        setDragActive(false)
        setCsvHeaders([])
        setCsvData([])
        setCsvHasHeaders(false)
        setColumnMatch(null)
        setShowColumnDefiner(true)
    }

    const analyzeCSVStructure = async (
        file: File,
    ): Promise<{
        headers: string[]
        hasHeaders: boolean
        dataRows: string[][]
        totalRows: number
    }> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = (event) => {
                try {
                    const content = event.target?.result as string
                    const lines = content
                        .split('\n')
                        .filter((line) => line.trim() !== '')

                    if (lines.length === 0) {
                        reject(new Error('El archivo CSV está vacío'))
                        return
                    }

                    // Parsear todas las líneas
                    const allRows = lines.map((line) =>
                        line
                            .replace(/\r$/, '')
                            .split(',')
                            .map((cell) => cell.trim().replace(/"/g, '')),
                    )

                    // Detectar si la primera fila son headers o datos
                    const firstRow = allRows[0]
                    const isFirstRowHeaders = detectIfHeaders(
                        firstRow,
                        allRows.slice(1),
                    )

                    if (isFirstRowHeaders) {
                        resolve({
                            headers: firstRow,
                            hasHeaders: true,
                            dataRows: allRows.slice(1),
                            totalRows: allRows.length - 1,
                        })
                    } else {
                        // Si no hay headers, generar nombres genéricos
                        const genericHeaders = firstRow.map(
                            (_, index) => `Columna ${index + 1}`,
                        )
                        resolve({
                            headers: genericHeaders,
                            hasHeaders: false,
                            dataRows: allRows,
                            totalRows: allRows.length,
                        })
                    }
                } catch (error) {
                    reject(error)
                }
            }
            reader.onerror = () => reject(new Error('Error al leer el archivo'))
            reader.readAsText(file, 'UTF-8')
        })
    }

    const detectIfHeaders = (
        firstRow: string[],
        dataRows: string[][],
    ): boolean => {
        // Si solo hay una fila, asumir que son datos
        if (dataRows.length === 0) return false

        // Verificar si la primera fila contiene valores que parecen headers
        const headerIndicators = [
            'fecha',
            'categoria',
            'importe',
            'identificador',
            'estado',
            'tipo',
            'cuenta',
            'beneficiario',
            'divisa',
            'numero',
            'notas',
            'egreso',
            'ingreso',
            'saldo',
            'subcategoria',
            'subcategoría',
        ]

        const firstRowLower = firstRow.map((cell) => cell.toLowerCase().trim())
        const hasHeaderKeywords = firstRowLower.some((cell) =>
            headerIndicators.some((keyword) => cell.includes(keyword)),
        )

        // Verificar si los datos de las siguientes filas parecen datos (números, fechas, etc.)
        const dataRowsSample = dataRows.slice(0, Math.min(3, dataRows.length))
        const hasNumericData = dataRowsSample.some((row) =>
            row.some((cell) => /^\d+(\.\d+)?$/.test(cell.trim())),
        )

        // Si la primera fila tiene palabras clave de headers Y hay datos numéricos en las siguientes filas
        return hasHeaderKeywords && hasNumericData
    }

    // Función para proponer automáticamente una estructura de columnas basándose en el análisis completo del CSV
    const proposeColumnStructure = (
        csvHeaders: string[],
        csvData: string[][],
    ): ColumnDefinition[] => {
        const proposedColumns: ColumnDefinition[] = []

        csvHeaders.forEach((header, index) => {
            // Obtener TODOS los datos de la columna para análisis completo
            const columnData = csvData.map((row) => row[index] || '')

            // Análisis completo de la columna
            const analysis = analyzeColumnData(columnData)

            console.log(`Análisis columna ${index} (${header}):`, analysis)

            // Crear la definición de columna propuesta
            const proposedColumn: ColumnDefinition = {
                id: `proposed_${index}`,
                name: header.trim() || `Columna ${index + 1}`,
                required: analysis.isRequired,
                order: index + 1,
                dataType: analysis.detectedType,
                allowEmpty: analysis.allowEmpty,
            }

            proposedColumns.push(proposedColumn)
        })

        return proposedColumns
    }

    // Función para analizar completamente una columna
    const analyzeColumnData = (
        columnData: string[],
    ): {
        detectedType: 'date' | 'number' | 'string' | 'boolean'
        isRequired: boolean
        allowEmpty: boolean
        emptyCount: number
        totalCount: number
        confidence: number
    } => {
        const totalCount = columnData.length
        const nonEmptyData = columnData.filter(
            (cell) => cell && cell.trim() !== '',
        )
        const emptyCount = totalCount - nonEmptyData.length

        // Calcular porcentaje de valores vacíos
        const emptyPercentage = emptyCount / totalCount

        // Determinar si permite vacíos basándose en el porcentaje
        // Si más del 20% está vacío, probablemente permite vacíos
        const allowEmpty = emptyPercentage > 0.2

        // Determinar si es requerido
        // Si menos del 10% está vacío, es requerido
        const isRequired = emptyPercentage < 0.1

        // Detectar tipo de dato usando todos los datos no vacíos
        const detectedType = detectColumnTypeFromAllData(nonEmptyData)

        // Calcular confianza basándose en consistencia del tipo
        const confidence = calculateTypeConfidence(nonEmptyData, detectedType)

        return {
            detectedType,
            isRequired,
            allowEmpty,
            emptyCount,
            totalCount,
            confidence,
        }
    }

    // Función mejorada para detectar tipo de dato usando todos los datos
    const detectColumnTypeFromAllData = (
        data: string[],
    ): 'date' | 'number' | 'string' | 'boolean' => {
        if (data.length === 0) return 'string'

        // Detectar fechas
        const datePatterns = [
            /^\d{1,2}\/\d{1,2}\/\d{2,4}$/, // DD/MM/YY o DD/MM/YYYY
            /^\d{4}-\d{2}-\d{2}$/, // YYYY-MM-DD
            /^\d{1,2}-\d{1,2}-\d{2,4}$/, // DD-MM-YY o DD-MM-YYYY
        ]
        const dateCount = data.filter((cell) =>
            datePatterns.some((pattern) => pattern.test(cell.trim())),
        ).length
        if (dateCount >= data.length * 0.8) return 'date'

        // Detectar números
        const numberCount = data.filter((cell) =>
            /^-?\d+(\.\d+)?$/.test(cell.trim()),
        ).length
        if (numberCount >= data.length * 0.8) return 'number'

        // Detectar booleanos
        const booleanValues = [
            'true',
            'false',
            '1',
            '0',
            'si',
            'no',
            'sí',
            'verdadero',
            'falso',
        ]
        const booleanCount = data.filter((cell) =>
            booleanValues.includes(cell.toLowerCase().trim()),
        ).length
        if (booleanCount >= data.length * 0.8) return 'boolean'

        return 'string'
    }

    // Función para calcular la confianza del tipo detectado
    const calculateTypeConfidence = (
        data: string[],
        detectedType: string,
    ): number => {
        if (data.length === 0) return 0

        let matchingCount = 0

        switch (detectedType) {
            case 'date':
                const datePatterns = [
                    /^\d{1,2}\/\d{1,2}\/\d{2,4}$/,
                    /^\d{4}-\d{2}-\d{2}$/,
                    /^\d{1,2}-\d{1,2}-\d{2,4}$/,
                ]
                matchingCount = data.filter((cell) =>
                    datePatterns.some((pattern) => pattern.test(cell.trim())),
                ).length
                break

            case 'number':
                matchingCount = data.filter((cell) =>
                    /^-?\d+(\.\d+)?$/.test(cell.trim()),
                ).length
                break

            case 'boolean':
                const booleanValues = [
                    'true',
                    'false',
                    '1',
                    '0',
                    'si',
                    'no',
                    'sí',
                    'verdadero',
                    'falso',
                ]
                matchingCount = data.filter((cell) =>
                    booleanValues.includes(cell.toLowerCase().trim()),
                ).length
                break

            case 'string':
            default:
                matchingCount = data.length // Los strings son flexibles
                break
        }

        return matchingCount / data.length
    }

    // Función para detectar automáticamente el tipo de una columna basándose en su contenido
    // Analiza específicamente la segunda línea (índice 1) asumiendo que la primera son headers
    const detectColumnType = (
        columnData: string[],
    ): 'date' | 'number' | 'string' | 'boolean' => {
        if (columnData.length === 0) return 'string'

        // Si solo hay una fila (headers), analizar esa fila
        // Si hay más de una fila, analizar específicamente la segunda fila (índice 1)
        const dataToAnalyze =
            columnData.length === 1 ? columnData : [columnData[1]]

        const nonEmptyData = dataToAnalyze.filter(
            (cell) => cell && cell.trim() !== '',
        )
        if (nonEmptyData.length === 0) return 'string'

        // Detectar fechas
        const datePatterns = [
            /^\d{1,2}\/\d{1,2}\/\d{2,4}$/, // DD/MM/YY o DD/MM/YYYY
            /^\d{4}-\d{2}-\d{2}$/, // YYYY-MM-DD
            /^\d{1,2}-\d{1,2}-\d{2,4}$/, // DD-MM-YY o DD-MM-YYYY
        ]
        const dateCount = nonEmptyData.filter((cell) =>
            datePatterns.some((pattern) => pattern.test(cell.trim())),
        ).length
        if (dateCount >= nonEmptyData.length * 0.8) return 'date'

        // Detectar números
        const numberCount = nonEmptyData.filter((cell) =>
            /^-?\d+(\.\d+)?$/.test(cell.trim()),
        ).length
        if (numberCount >= nonEmptyData.length * 0.8) return 'number'

        // Detectar booleanos
        const booleanValues = [
            'true',
            'false',
            '1',
            '0',
            'si',
            'no',
            'sí',
            'verdadero',
            'falso',
        ]
        const booleanCount = nonEmptyData.filter((cell) =>
            booleanValues.includes(cell.toLowerCase().trim()),
        ).length
        if (booleanCount >= nonEmptyData.length * 0.8) return 'boolean'

        return 'string'
    }

    // Función para encontrar la mejor coincidencia entre columnas CSV y esperadas
    // Prioriza el orden de las columnas y luego valida por tipo
    const findBestColumnMatch = (
        csvHeaders: string[],
        csvData: string[][],
        expectedColumns: ColumnDefinition[],
    ): {
        [key: string]: {
            csvIndex: number
            csvHeader: string
            confidence: number
        }
    } => {
        const matches: {
            [key: string]: {
                csvIndex: number
                csvHeader: string
                confidence: number
            }
        } = {}

        // Ordenar columnas esperadas por orden
        const sortedExpected = [...expectedColumns].sort(
            (a, b) => a.order - b.order,
        )

        sortedExpected.forEach((expectedCol, expectedIndex) => {
            let bestMatch = { csvIndex: -1, csvHeader: '', confidence: 0 }

            csvHeaders.forEach((csvHeader, csvIndex) => {
                // Usar específicamente la segunda fila (índice 1) para detectar el tipo
                const columnData =
                    csvData.length > 1
                        ? [csvData[1][csvIndex]]
                        : csvData.map((row) => row[csvIndex])
                const detectedType = detectColumnType(columnData)

                // Debug: mostrar qué está analizando
                console.log(
                    `Analizando columna ${csvIndex} (${csvHeader}): valor="${columnData[0]}", tipo detectado=${detectedType}, esperado=${expectedCol.dataType}`,
                )

                let confidence = 0

                // PRIORIDAD 1: Coincidencia exacta de posición (peso máximo)
                if (csvIndex === expectedIndex) {
                    confidence = 1.0
                }
                // PRIORIDAD 2: Coincidencia exacta de tipo (peso alto)
                else if (detectedType === expectedCol.dataType) {
                    confidence = 0.8
                }
                // PRIORIDAD 3: Coincidencia parcial de tipo (peso medio)
                else if (
                    (expectedCol.dataType === 'string' &&
                        detectedType !== 'date') ||
                    (expectedCol.dataType === 'number' &&
                        detectedType === 'number') ||
                    (expectedCol.dataType === 'date' &&
                        detectedType === 'date') ||
                    (expectedCol.dataType === 'boolean' &&
                        detectedType === 'boolean')
                ) {
                    confidence = 0.6
                }

                // Bonus por coincidencia de nombre (peso adicional)
                if (
                    csvHeader
                        .toLowerCase()
                        .includes(expectedCol.name.toLowerCase()) ||
                    expectedCol.name
                        .toLowerCase()
                        .includes(csvHeader.toLowerCase())
                ) {
                    confidence += 0.2
                }

                if (confidence > bestMatch.confidence) {
                    bestMatch = { csvIndex, csvHeader, confidence }
                }
            })

            if (bestMatch.confidence > 0.5) {
                matches[expectedCol.name] = bestMatch
            }
        })

        return matches
    }

    const checkColumnMatch = (
        csvHeaders: string[],
        expectedColumns: ColumnDefinition[],
        dataRows: string[][] = [],
    ) => {
        const matches: { [key: string]: boolean } = {}
        const missing: string[] = []
        const extra: string[] = []
        const orderErrors: string[] = []
        const typeErrors: string[] = []
        const commaErrors: string[] = []

        // Ordenar columnas esperadas por orden
        const sortedExpected = [...expectedColumns].sort(
            (a, b) => a.order - b.order,
        )

        // Verificar que todas las columnas esperadas estén presentes por posición
        expectedColumns.forEach((expectedCol) => {
            const csvIndex = expectedCol.order - 1 // Convertir a índice 0-based

            // Verificar si la columna existe en esa posición
            const hasColumn = csvIndex < csvHeaders.length
            matches[expectedCol.name] = hasColumn

            if (!hasColumn && expectedCol.required) {
                missing.push(expectedCol.name)
            }
        })

        // Verificar tipos de datos y comas si tenemos datos para analizar
        if (dataRows.length > 0) {
            expectedColumns.forEach((expectedCol) => {
                const csvIndex = expectedCol.order - 1

                if (csvIndex < dataRows[0].length) {
                    // Usar específicamente la segunda fila para validación de tipos
                    const columnData =
                        dataRows.length > 1
                            ? [dataRows[1][csvIndex] || '']
                            : dataRows
                                  .slice(0, Math.min(10, dataRows.length))
                                  .map((row) => row[csvIndex] || '')

                    if (columnData.length > 0) {
                        console.log(
                            `Validando columna "${expectedCol.name}" (posición ${csvIndex + 1}):`,
                            {
                                columnData,
                                expectedType: expectedCol.dataType,
                                allowEmpty: expectedCol.allowEmpty,
                                maxCommas: expectedCol.maxCommas,
                            },
                        )

                        const typeValidation = validateDataType(
                            columnData,
                            expectedCol.dataType,
                            expectedCol.allowEmpty,
                        )
                        if (!typeValidation.isValid) {
                            typeErrors.push(
                                `Columna "${expectedCol.name}" (posición ${csvIndex + 1}): ${typeValidation.error}`,
                            )
                        }

                        // Validar número de comas si es campo de texto
                        if (
                            expectedCol.dataType === 'string' &&
                            expectedCol.maxCommas !== undefined
                        ) {
                            const sampleValue = columnData[0] || ''
                            const commaCount = (sampleValue.match(/,/g) || [])
                                .length

                            if (commaCount > expectedCol.maxCommas) {
                                commaErrors.push(
                                    `Columna "${expectedCol.name}" (posición ${csvIndex + 1}): Contiene ${commaCount} comas, máximo permitido ${expectedCol.maxCommas}`,
                                )
                            }
                        }
                    }
                }
            })
        }

        // Generar información sobre las columnas detectadas
        expectedColumns.forEach((expectedCol) => {
            const csvIndex = expectedCol.order - 1
            if (csvIndex < csvHeaders.length) {
                const csvHeader = csvHeaders[csvIndex]
                const detectedType =
                    dataRows.length > 1
                        ? detectColumnType([dataRows[1][csvIndex]])
                        : 'string'

                orderErrors.push(
                    `✓ "${expectedCol.name}" → "${csvHeader}" (tipo: ${detectedType})`,
                )
            }
        })

        const isValid =
            missing.length === 0 &&
            typeErrors.length === 0 &&
            commaErrors.length === 0

        return {
            isValid,
            matches,
            missing,
            extra,
            orderErrors,
            typeErrors,
            commaErrors, // Nuevo campo para errores de comas
            smartMatches: {}, // No necesario para validación simple
        }
    }

    const validateDataType = (
        data: string[],
        expectedType: string,
        allowEmpty: boolean = true,
    ): { isValid: boolean; error?: string } => {
        if (data.length === 0) return { isValid: true }

        // Filtrar datos vacíos o nulos
        const nonEmptyData = data.filter(
            (cell) => cell !== null && cell !== undefined && cell.trim() !== '',
        )

        // Si no se permiten vacíos y hay datos vacíos, es error
        if (!allowEmpty && nonEmptyData.length < data.length) {
            const emptyCount = data.length - nonEmptyData.length
            return {
                isValid: false,
                error: `Se encontraron ${emptyCount} valores vacíos, pero esta columna no permite datos vacíos`,
            }
        }

        // Si no hay datos no vacíos para validar, está bien (siempre que se permitan vacíos)
        if (nonEmptyData.length === 0) {
            return allowEmpty
                ? { isValid: true }
                : {
                      isValid: false,
                      error: 'No se encontraron datos válidos en esta columna',
                  }
        }

        switch (expectedType) {
            case 'number':
                const numericData = nonEmptyData.filter((cell) =>
                    /^-?\d+(\.\d+)?$/.test(cell.trim()),
                )
                if (numericData.length < nonEmptyData.length * 0.8) {
                    // Al menos 80% debe ser numérico
                    return {
                        isValid: false,
                        error: `Se esperaba datos numéricos, pero solo ${numericData.length}/${nonEmptyData.length} valores son números`,
                    }
                }
                break

            case 'date':
                const datePatterns = [
                    /^\d{1,2}\/\d{1,2}\/\d{2,4}$/, // DD/MM/YY o DD/MM/YYYY
                    /^\d{4}-\d{2}-\d{2}$/, // YYYY-MM-DD
                    /^\d{1,2}-\d{1,2}-\d{2,4}$/, // DD-MM-YY o DD-MM-YYYY
                ]
                const dateData = nonEmptyData.filter((cell) =>
                    datePatterns.some((pattern) => pattern.test(cell.trim())),
                )
                if (dateData.length < nonEmptyData.length * 0.8) {
                    return {
                        isValid: false,
                        error: `Se esperaba fechas, pero solo ${dateData.length}/${nonEmptyData.length} valores parecen fechas`,
                    }
                }
                break

            case 'boolean':
                const booleanData = nonEmptyData.filter((cell) =>
                    [
                        'true',
                        'false',
                        '1',
                        '0',
                        'si',
                        'no',
                        'sí',
                        'verdadero',
                        'falso',
                    ].includes(cell.toLowerCase().trim()),
                )
                if (booleanData.length < nonEmptyData.length * 0.8) {
                    return {
                        isValid: false,
                        error: `Se esperaba valores booleanos, pero solo ${booleanData.length}/${nonEmptyData.length} valores son booleanos`,
                    }
                }
                break

            case 'string':
            default:
                // Los strings son más flexibles, no necesitan validación estricta
                break
        }

        return { isValid: true }
    }

    const handleFiles = useCallback(async (f: File | null) => {
        console.log('handleFiles llamado con:', f)
        if (!f) {
            console.log('No hay archivo')
            return
        }
        console.log('Archivo recibido:', f.name, f.type)
        if (!isAcceptedFile(f)) {
            console.log('Archivo no aceptado')
            setError(
                'Formato inválido. Solo se permiten archivos .csv, .xlsx o .xml',
            )
            setFile(null)
            return
        }
        console.log('Archivo aceptado, estableciendo estado')
        setError(null)
        setSuccess(null)
        setFile(f)

        // Si es un archivo CSV, analizar estructura completa
        const fileType = getFileType(f)
        if (fileType === 'csv') {
            try {
                const analysis = await analyzeCSVStructure(f)
                setCsvHeaders(analysis.headers)
                setCsvData(analysis.dataRows)
                setCsvHasHeaders(analysis.hasHeaders)

                // Proponer automáticamente la estructura de columnas
                const proposedStructure = proposeColumnStructure(
                    analysis.headers,
                    analysis.dataRows,
                )
                setExpectedColumns(proposedStructure)

                // Mostrar automáticamente el definidor de columnas con la estructura propuesta
                setShowColumnDefiner(true)

                console.log('Análisis CSV:', analysis)
                console.log('Estructura propuesta:', proposedStructure)

                setSuccess(
                    `Estructura de columnas propuesta automáticamente basándose en el análisis completo de ${analysis.dataRows.length} filas. Puedes ajustarla a continuación.`,
                )
            } catch (error) {
                console.error('Error analizando CSV:', error)
                setError('Error al leer el archivo CSV')
                setSuccess(null)
            }
        } else {
            // Para otros tipos de archivo, no verificar columnas
            setShowColumnDefiner(false)
            setColumnMatch(null)
        }

        console.log('Estado del archivo establecido:', f?.name)
    }, [])

    const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selected = e.target.files?.[0] || null
        handleFiles(selected)
    }

    const onDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault()
        if (disabled) return
        setDragActive(true)
    }

    const onDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault()
        setDragActive(false)
    }

    const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault()
        console.log('Archivo soltado:', e.dataTransfer.files)
        if (disabled) return
        setDragActive(false)
        const dropped = e.dataTransfer.files?.[0] || null
        console.log('Archivo procesado:', dropped)
        handleFiles(dropped)
    }

    const handleSubmit = async () => {
        if (!file) return

        // Para archivos CSV, verificar que la estructura coincida
        const fileType = getFileType(file)
        if (fileType === 'csv' && (!columnMatch || !columnMatch.isValid)) {
            setError('El archivo CSV no coincide con la estructura definida')
            return
        }

        try {
            setSubmitting(true)
            setError(null)
            setSuccess(null)

            // Si hay una función onSubmit personalizada, usarla
            if (onSubmit) {
                await onSubmit(file, datasetType)
                setSuccess('Archivo procesado exitosamente')
            } else {
                // Determinar el tipo de archivo y usar el procesador correspondiente
                let dataset

                if (fileType === 'xlsx') {
                    console.log(
                        'Procesando archivo Excel con procesador de Excel',
                    )
                    dataset = await processAndUploadNewFormatExcel(
                        file,
                        undefined,
                        importedBy,
                        datasetType,
                    )
                } else if (fileType === 'csv' || fileType === 'xml') {
                    console.log(
                        'Procesando archivo CSV/XML con procesador de CSV',
                    )
                    console.log('Headers del CSV:', csvHeaders)
                    console.log('Columnas esperadas:', expectedColumns)
                    console.log('CSV tiene headers:', csvHasHeaders)

                    // Debug: mostrar qué columnas están disponibles para mapear
                    console.log('Columnas disponibles para mapeo:')
                    expectedColumns.forEach((col) => {
                        const csvIndex = col.order - 1
                        if (csvIndex >= 0 && csvIndex < csvHeaders.length) {
                            console.log(
                                `  ${col.name.toLowerCase()} → "${csvHeaders[csvIndex]}" (índice ${csvIndex})`,
                            )
                        } else {
                            console.log(
                                `  ${col.name.toLowerCase()} → NO MAPEADO (índice ${csvIndex} fuera de rango)`,
                            )
                        }
                    })

                    // Si el CSV no tiene headers específicos o tiene headers genéricos,
                    // usar el procesador sin mapeo (que asume un formato fijo)
                    const hasGenericHeaders = csvHeaders.some(
                        (header) =>
                            header.startsWith('Columna ') ||
                            header.match(/^columna\s*\d+$/i),
                    )

                    if (!csvHasHeaders || hasGenericHeaders) {
                        console.log(
                            'Usando procesador CSV sin mapeo (headers genéricos o sin headers)',
                        )
                        dataset = await processAndUploadCSV(
                            file,
                            undefined,
                            importedBy,
                            datasetType,
                            undefined, // Sin mapeo
                            expectedColumns.map((col) => ({
                                name: col.name,
                                maxCommas: col.maxCommas,
                                order: col.order,
                            })), // Definiciones de columnas
                        )
                    } else {
                        console.log(
                            'Usando procesador CSV con mapeo (headers específicos)',
                        )

                        // Función para normalizar nombres de columnas
                        const normalizeColumnName = (name: string): string => {
                            return name
                                .toLowerCase()
                                .replace(/á/g, 'a')
                                .replace(/é/g, 'e')
                                .replace(/í/g, 'i')
                                .replace(/ó/g, 'o')
                                .replace(/ú/g, 'u')
                                .replace(/ñ/g, 'n')
                                .trim()
                        }

                        // Crear mapeo basado en el orden de las columnas definidas
                        const columnMapping = expectedColumns.reduce(
                            (acc, col) => {
                                // Usar el orden de la columna como índice CSV (0-based)
                                const csvIndex = col.order - 1

                                // Verificar que el índice existe en el CSV
                                if (
                                    csvIndex >= 0 &&
                                    csvIndex < csvHeaders.length
                                ) {
                                    // El procesador espera nombres de columnas CSV tal como aparecen en el archivo
                                    const normalizedName = normalizeColumnName(
                                        col.name,
                                    )
                                    acc[normalizedName] = csvHeaders[csvIndex]
                                    console.log(
                                        `Mapeando campo "${normalizedName}" → columna CSV "${csvHeaders[csvIndex]}"`,
                                    )
                                } else {
                                    console.warn(
                                        `No se pudo mapear columna "${col.name}" - índice ${csvIndex} fuera de rango (CSV tiene ${csvHeaders.length} columnas)`,
                                    )
                                }

                                return acc
                            },
                            {} as any,
                        )

                        console.log('Mapeo de columnas creado:', columnMapping)

                        // Debug: mostrar qué campos están mapeados
                        console.log('Campos mapeados:')
                        Object.keys(columnMapping).forEach((field) => {
                            console.log(`  ${field}: "${columnMapping[field]}"`)
                        })

                        // Debug: mostrar qué campos faltan
                        const requiredFields = ['fecha', 'categoria']
                        const missingFields = requiredFields.filter(
                            (field) => !columnMapping[field],
                        )
                        if (missingFields.length > 0) {
                            console.log('Campos faltantes:', missingFields)
                        }

                        // Verificar que los campos requeridos estén mapeados
                        // Basándose en la estructura real: fecha, categoria, subcategoria, egreso/ingreso, nota
                        if (missingFields.length > 0) {
                            throw new Error(
                                `Faltan campos requeridos en el mapeo: ${missingFields.join(', ')}`,
                            )
                        }

                        // Verificar que al menos uno de egreso, ingreso o importe esté presente
                        const hasEgreso = columnMapping['egreso']
                        const hasIngreso = columnMapping['ingreso']
                        const hasImporte = columnMapping['importe']

                        if (!hasEgreso && !hasIngreso && !hasImporte) {
                            throw new Error(
                                'Se requiere al menos una columna de egreso, ingreso o importe para el monto',
                            )
                        }

                        // Crear un mapeo personalizado para la estructura específica
                        const customColumnMapping = {
                            fecha: columnMapping['fecha'],
                            categoria: columnMapping['categoria'],
                            subcategoria: columnMapping['subcategoria'],
                            egreso: columnMapping['egreso'],
                            ingreso: columnMapping['ingreso'],
                            importe: columnMapping['importe'],
                            nota: columnMapping['nota'],
                        }

                        console.log(
                            'Mapeo personalizado creado:',
                            customColumnMapping,
                        )

                        // Usar el procesador con mapeo personalizado
                        dataset = await processAndUploadCSV(
                            file,
                            undefined,
                            importedBy,
                            datasetType,
                            customColumnMapping,
                            expectedColumns.map((col) => ({
                                name: col.name,
                                maxCommas: col.maxCommas,
                                order: col.order,
                            })), // Definiciones de columnas
                        )
                    }
                } else {
                    throw new Error('Tipo de archivo no soportado')
                }

                dataset.movements.slice(0, 3).forEach((mov, index) => {})

                setSuccess(
                    `Dataset "${dataset.datasetName}" creado exitosamente con ${dataset.movements.length} movimientos`,
                )
                // Resetear el formulario después de un breve delay
                setTimeout(() => {
                    reset()
                }, 3000)
            }
        } catch (error: any) {
            console.error('Error procesando archivo:', error)
            setError(error.message || 'Error al procesar el archivo')
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <HomeCard header={title} colorLevel="tertiary">
            <div
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                style={{
                    border: dragActive
                        ? '2px dashed #6b7280'
                        : '2px dashed #9ca3af',
                    borderRadius: 12,
                    padding: 16,
                    background: dragActive
                        ? 'rgba(107, 114, 128, 0.1)'
                        : 'transparent',
                }}
            >
                <label
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 8,
                        cursor: disabled ? 'not-allowed' : 'pointer',
                        textAlign: 'center',
                    }}
                >
                    <input
                        type="file"
                        accept={acceptAttr}
                        onChange={onInputChange}
                        disabled={disabled}
                        style={{ display: 'none' }}
                    />
                    <div style={{ fontWeight: 600 }}>Soltá tu archivo aquí</div>
                    <div style={{ fontSize: 12, color: '#9ca3af' }}>
                        {helperText}
                    </div>
                </label>
            </div>

            {/* Select de tipo de dataset */}
            <div style={{ marginTop: 16 }}>
                <label
                    style={{
                        display: 'block',
                        marginBottom: 8,
                        fontWeight: 600,
                    }}
                >
                    Tipo de Dataset:
                </label>
                <select
                    value={datasetType}
                    onChange={(e) => setDatasetType(e.target.value)}
                    disabled={disabled || submitting}
                    style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        backgroundColor: 'white',
                        fontSize: '14px',
                    }}
                >
                    {DATASET_TYPES.map((type) => (
                        <option key={type.value} value={type.value}>
                            {type.label}
                        </option>
                    ))}
                </select>
            </div>

            {file && (
                <div
                    style={{
                        marginTop: 16,
                        display: 'flex',
                        gap: 12,
                        alignItems: 'center',
                    }}
                >
                    <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600 }}>{file.name}</div>
                        <div style={{ fontSize: 12, color: '#9ca3af' }}>
                            {formatFileSize(file.size)}
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={reset}
                        disabled={disabled || submitting}
                        style={{
                            background: 'transparent',
                            border: '1px solid #e5e7eb',
                            borderRadius: 8,
                            padding: '6px 10px',
                            color: '#6b7280',
                        }}
                    >
                        Quitar
                    </button>
                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={(() => {
                            const isDisabled =
                                disabled ||
                                submitting ||
                                (getFileType(file) === 'csv' &&
                                    (!columnMatch || !columnMatch.isValid))
                            console.log('Botón deshabilitado:', isDisabled, {
                                disabled,
                                submitting,
                                fileType: getFileType(file),
                                columnMatch: columnMatch?.isValid,
                            })
                            return isDisabled
                        })()}
                        style={{
                            background: '#2563eb',
                            color: '#fff',
                            border: 'none',
                            borderRadius: 8,
                            padding: '6px 12px',
                            opacity:
                                getFileType(file) === 'csv' &&
                                (!columnMatch || !columnMatch.isValid)
                                    ? 0.5
                                    : 1,
                        }}
                    >
                        {submitting ? 'Enviando…' : 'Enviar'}
                    </button>
                </div>
            )}

            {/* Mensaje de estructura propuesta automáticamente */}
            {csvHeaders.length > 0 && expectedColumns.length > 0 && (
                <div style={{ marginTop: 16 }}>
                    <div
                        style={{
                            padding: 12,
                            backgroundColor: '#f0f9ff',
                            border: '1px solid #0ea5e9',
                            borderRadius: 8,
                            marginBottom: 12,
                        }}
                    >
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                            }}
                        >
                            <span style={{ fontSize: 16 }}>🎯</span>
                            <span
                                style={{
                                    fontSize: 14,
                                    fontWeight: 600,
                                    color: '#0c4a6e',
                                }}
                            >
                                Estructura Propuesta Automáticamente
                            </span>
                        </div>
                        <p
                            style={{
                                margin: '4px 0 0 0',
                                fontSize: 12,
                                color: '#0c4a6e',
                            }}
                        >
                            Se analizaron {csvData.length} filas y se detectaron{' '}
                            {expectedColumns.length} columnas. La estructura se
                            propuso automáticamente basándose en el análisis
                            completo del documento. Puedes ajustarla a
                            continuación:
                        </p>
                    </div>
                </div>
            )}

            {/* Definidor de columnas con estructura propuesta */}
            {showColumnDefiner &&
                (() => {
                    console.log(
                        'UploaderCard: pasando columnas al ColumnDefiner:',
                        expectedColumns,
                    )
                    return (
                        <div style={{ marginTop: 16 }}>
                            <ColumnDefiner
                                onColumnsChange={setExpectedColumns}
                                initialColumns={expectedColumns}
                                disabled={disabled || submitting}
                            />
                        </div>
                    )
                })()}

            {/* Validación en tiempo real de la estructura */}
            {columnMatch && csvHeaders.length > 0 && (
                <div style={{ marginTop: 16 }}>
                    <div
                        style={{
                            padding: 16,
                            borderRadius: 8,
                            backgroundColor: columnMatch.isValid
                                ? '#f0fdf4'
                                : '#fef2f2',
                            border: `1px solid ${columnMatch.isValid ? '#bbf7d0' : '#fecaca'}`,
                        }}
                    >
                        <h4
                            style={{
                                margin: '0 0 8px 0',
                                fontSize: 14,
                                fontWeight: 600,
                                color: columnMatch.isValid
                                    ? '#166534'
                                    : '#dc2626',
                            }}
                        >
                            {columnMatch.isValid
                                ? '✅ Estructura Válida'
                                : '⚠ Problemas Detectados'}
                        </h4>

                        {columnMatch.isValid ? (
                            <p
                                style={{
                                    margin: 0,
                                    fontSize: 12,
                                    color: '#166534',
                                }}
                            >
                                La estructura definida es válida y coincide con
                                el archivo CSV.
                            </p>
                        ) : (
                            <div>
                                <p
                                    style={{
                                        margin: '0 0 8px 0',
                                        fontSize: 12,
                                        color: '#dc2626',
                                    }}
                                >
                                    Se detectaron problemas con la estructura
                                    definida:
                                </p>

                                {columnMatch.missing.length > 0 && (
                                    <div style={{ marginBottom: 8 }}>
                                        <strong
                                            style={{
                                                color: '#dc2626',
                                                fontSize: 12,
                                            }}
                                        >
                                            Columnas faltantes:
                                        </strong>
                                        <div
                                            style={{
                                                fontSize: 11,
                                                color: '#dc2626',
                                                marginTop: 2,
                                            }}
                                        >
                                            {columnMatch.missing.join(', ')}
                                        </div>
                                    </div>
                                )}

                                {columnMatch.typeErrors.length > 0 && (
                                    <div>
                                        <strong
                                            style={{
                                                color: '#dc2626',
                                                fontSize: 12,
                                            }}
                                        >
                                            Errores de tipo:
                                        </strong>
                                        <div
                                            style={{
                                                fontSize: 11,
                                                color: '#dc2626',
                                                marginTop: 2,
                                            }}
                                        >
                                            {columnMatch.typeErrors.map(
                                                (error, index) => (
                                                    <div key={index}>
                                                        • {error}
                                                    </div>
                                                ),
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {error && (
                <div style={{ marginTop: 12, color: '#dc2626', fontSize: 13 }}>
                    {error}
                </div>
            )}

            {success && (
                <div style={{ marginTop: 12, color: '#059669', fontSize: 13 }}>
                    {success}
                </div>
            )}
        </HomeCard>
    )
}

export default UploaderCard
