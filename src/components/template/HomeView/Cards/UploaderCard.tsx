import React, { useCallback, useMemo, useState } from 'react'
import HomeCard from './HomeCard'
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
    }

    const handleFiles = useCallback((f: File | null) => {
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
                const fileType = getFileType(file)
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
                    dataset = await processAndUploadCSV(
                        file,
                        undefined,
                        importedBy,
                        datasetType,
                    )
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
                        disabled={disabled || submitting}
                        style={{
                            background: '#2563eb',
                            color: '#fff',
                            border: 'none',
                            borderRadius: 8,
                            padding: '6px 12px',
                        }}
                    >
                        {submitting ? 'Enviando…' : 'Enviar'}
                    </button>
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
