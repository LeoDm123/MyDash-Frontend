import React, { useState, useEffect } from 'react'

export interface ColumnMapping {
    identificador: string
    fecha: string
    estado: string
    tipo: string
    cuenta: string
    beneficiario: string
    categoria: string
    importe: string
    divisa: string
    numero: string
    notas: string
}

interface ColumnMapperProps {
    csvHeaders: string[]
    onMappingChange: (mapping: ColumnMapping) => void
    initialMapping?: Partial<ColumnMapping>
    disabled?: boolean
}

const REQUIRED_FIELDS = [
    { key: 'fecha', label: 'Fecha', required: true },
    { key: 'categoria', label: 'Categoría', required: true },
    { key: 'importe', label: 'Importe', required: true },
]

const OPTIONAL_FIELDS = [
    { key: 'identificador', label: 'Identificador' },
    { key: 'estado', label: 'Estado' },
    { key: 'tipo', label: 'Tipo' },
    { key: 'cuenta', label: 'Cuenta' },
    { key: 'beneficiario', label: 'Beneficiario' },
    { key: 'divisa', label: 'Divisa' },
    { key: 'numero', label: 'Número' },
    { key: 'notas', label: 'Notas' },
]

const ColumnMapper: React.FC<ColumnMapperProps> = ({
    csvHeaders,
    onMappingChange,
    initialMapping = {},
    disabled = false,
}) => {
    const [mapping, setMapping] = useState<ColumnMapping>({
        identificador: '',
        fecha: '',
        estado: '',
        tipo: '',
        cuenta: '',
        beneficiario: '',
        categoria: '',
        importe: '',
        divisa: '',
        numero: '',
        notas: '',
        ...initialMapping,
    })

    // Auto-mapear columnas si no hay mapeo inicial
    useEffect(() => {
        if (!initialMapping.fecha && csvHeaders.length > 0) {
            const autoMapping: Partial<ColumnMapping> = {}

            // Buscar coincidencias exactas o similares
            csvHeaders.forEach((header, index) => {
                const lowerHeader = header.toLowerCase().trim()

                // Mapeo inteligente basado en palabras clave
                if (
                    lowerHeader.includes('fecha') ||
                    lowerHeader.includes('date')
                ) {
                    autoMapping.fecha = header
                } else if (
                    lowerHeader.includes('categoria') ||
                    lowerHeader.includes('category')
                ) {
                    autoMapping.categoria = header
                } else if (
                    lowerHeader.includes('importe') ||
                    lowerHeader.includes('amount') ||
                    lowerHeader.includes('monto')
                ) {
                    autoMapping.importe = header
                } else if (
                    lowerHeader.includes('identificador') ||
                    lowerHeader.includes('id')
                ) {
                    autoMapping.identificador = header
                } else if (
                    lowerHeader.includes('estado') ||
                    lowerHeader.includes('status')
                ) {
                    autoMapping.estado = header
                } else if (
                    lowerHeader.includes('tipo') ||
                    lowerHeader.includes('type')
                ) {
                    autoMapping.tipo = header
                } else if (
                    lowerHeader.includes('cuenta') ||
                    lowerHeader.includes('account')
                ) {
                    autoMapping.cuenta = header
                } else if (
                    lowerHeader.includes('beneficiario') ||
                    lowerHeader.includes('beneficiary')
                ) {
                    autoMapping.beneficiario = header
                } else if (
                    lowerHeader.includes('divisa') ||
                    lowerHeader.includes('currency')
                ) {
                    autoMapping.divisa = header
                } else if (
                    lowerHeader.includes('numero') ||
                    lowerHeader.includes('number')
                ) {
                    autoMapping.numero = header
                } else if (
                    lowerHeader.includes('notas') ||
                    lowerHeader.includes('notes') ||
                    lowerHeader.includes('comentario')
                ) {
                    autoMapping.notas = header
                }
            })

            // Si no se encontraron coincidencias, usar las primeras columnas para campos requeridos
            if (!autoMapping.fecha && csvHeaders[0])
                autoMapping.fecha = csvHeaders[0]
            if (!autoMapping.categoria && csvHeaders[1])
                autoMapping.categoria = csvHeaders[1]
            if (!autoMapping.importe && csvHeaders[2])
                autoMapping.importe = csvHeaders[2]

            setMapping((prev) => ({ ...prev, ...autoMapping }))
        }
    }, [csvHeaders, initialMapping])

    // Notificar cambios al componente padre
    useEffect(() => {
        onMappingChange(mapping)
    }, [mapping, onMappingChange])

    const handleMappingChange = (field: keyof ColumnMapping, value: string) => {
        setMapping((prev) => ({
            ...prev,
            [field]: value,
        }))
    }

    const isMappingValid = () => {
        return REQUIRED_FIELDS.every(
            (field) => mapping[field.key as keyof ColumnMapping] !== '',
        )
    }

    const getFieldStyle = (field: {
        key: string
        label: string
        required?: boolean
    }) => {
        const isRequired = field.required
        const hasValue = mapping[field.key as keyof ColumnMapping] !== ''
        const isValid = !isRequired || hasValue

        return {
            marginBottom: 12,
            padding: 12,
            border: `1px solid ${isValid ? '#d1d5db' : '#dc2626'}`,
            borderRadius: 8,
            backgroundColor: disabled ? '#f9fafb' : 'white',
        }
    }

    return (
        <div style={{ padding: 16 }}>
            <div style={{ marginBottom: 16 }}>
                <h3
                    style={{
                        margin: 0,
                        fontSize: 16,
                        fontWeight: 600,
                        color: '#374151',
                    }}
                >
                    Mapeo de Columnas
                </h3>
                <p
                    style={{
                        margin: '4px 0 0 0',
                        fontSize: 12,
                        color: '#6b7280',
                    }}
                >
                    Selecciona qué columna del CSV corresponde a cada campo
                    requerido
                </p>
            </div>

            {/* Campos requeridos */}
            <div style={{ marginBottom: 20 }}>
                <h4
                    style={{
                        margin: '0 0 12px 0',
                        fontSize: 14,
                        fontWeight: 600,
                        color: '#374151',
                    }}
                >
                    Campos Requeridos *
                </h4>
                {REQUIRED_FIELDS.map((field) => (
                    <div key={field.key} style={getFieldStyle(field)}>
                        <label
                            style={{
                                display: 'block',
                                marginBottom: 4,
                                fontWeight: 500,
                                color: '#374151',
                                fontSize: 13,
                            }}
                        >
                            {field.label} *
                        </label>
                        <select
                            value={mapping[field.key as keyof ColumnMapping]}
                            onChange={(e) =>
                                handleMappingChange(
                                    field.key as keyof ColumnMapping,
                                    e.target.value,
                                )
                            }
                            disabled={disabled}
                            style={{
                                width: '100%',
                                padding: '6px 8px',
                                border: '1px solid #d1d5db',
                                borderRadius: 4,
                                fontSize: 13,
                                backgroundColor: disabled ? '#f9fafb' : 'white',
                            }}
                        >
                            <option value="">Seleccionar columna...</option>
                            {csvHeaders.map((header, index) => (
                                <option key={index} value={header}>
                                    Columna {index + 1}: {header}
                                </option>
                            ))}
                        </select>
                    </div>
                ))}
            </div>

            {/* Campos opcionales */}
            <div>
                <h4
                    style={{
                        margin: '0 0 12px 0',
                        fontSize: 14,
                        fontWeight: 600,
                        color: '#374151',
                    }}
                >
                    Campos Opcionales
                </h4>
                {OPTIONAL_FIELDS.map((field) => (
                    <div key={field.key} style={getFieldStyle(field)}>
                        <label
                            style={{
                                display: 'block',
                                marginBottom: 4,
                                fontWeight: 500,
                                color: '#374151',
                                fontSize: 13,
                            }}
                        >
                            {field.label}
                        </label>
                        <select
                            value={mapping[field.key as keyof ColumnMapping]}
                            onChange={(e) =>
                                handleMappingChange(
                                    field.key as keyof ColumnMapping,
                                    e.target.value,
                                )
                            }
                            disabled={disabled}
                            style={{
                                width: '100%',
                                padding: '6px 8px',
                                border: '1px solid #d1d5db',
                                borderRadius: 4,
                                fontSize: 13,
                                backgroundColor: disabled ? '#f9fafb' : 'white',
                            }}
                        >
                            <option value="">No mapear</option>
                            {csvHeaders.map((header, index) => (
                                <option key={index} value={header}>
                                    Columna {index + 1}: {header}
                                </option>
                            ))}
                        </select>
                    </div>
                ))}
            </div>

            {/* Estado de validación */}
            <div
                style={{
                    marginTop: 16,
                    padding: 12,
                    borderRadius: 8,
                    backgroundColor: isMappingValid() ? '#f0fdf4' : '#fef2f2',
                    border: `1px solid ${isMappingValid() ? '#bbf7d0' : '#fecaca'}`,
                }}
            >
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        color: isMappingValid() ? '#166534' : '#dc2626',
                        fontSize: 13,
                        fontWeight: 500,
                    }}
                >
                    <span>{isMappingValid() ? '✓' : '⚠'}</span>
                    <span>
                        {isMappingValid()
                            ? 'Mapeo completo y válido'
                            : 'Faltan campos requeridos'}
                    </span>
                </div>
            </div>
        </div>
    )
}

export default ColumnMapper
