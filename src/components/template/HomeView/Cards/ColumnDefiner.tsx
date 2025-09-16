import React, { useState, useEffect } from 'react'
import { CASHFLOW_COLUMN_NAMES } from '@/constants/columnCategories.constant'

export interface ColumnDefinition {
    id: string
    name: string
    required: boolean
    order: number
    dataType: 'string' | 'number' | 'date' | 'boolean'
    allowEmpty: boolean
    maxCommas?: number // Número máximo de comas permitidas en este campo
}

interface ColumnDefinerProps {
    onColumnsChange: (columns: ColumnDefinition[]) => void
    initialColumns?: ColumnDefinition[]
    disabled?: boolean
}

const DEFAULT_COLUMNS: ColumnDefinition[] = [
    {
        id: 'fecha',
        name: 'Fecha',
        required: true,
        order: 1,
        dataType: 'date',
        allowEmpty: false,
        maxCommas: 0,
    },
    {
        id: 'categoria',
        name: 'Categoría',
        required: true,
        order: 2,
        dataType: 'string',
        allowEmpty: false,
        maxCommas: 2, // Por defecto permite hasta 2 comas en categorías
    },
    {
        id: 'importe',
        name: 'Importe',
        required: true,
        order: 3,
        dataType: 'number',
        allowEmpty: false,
        maxCommas: 0,
    },
    {
        id: 'identificador',
        name: 'Identificador',
        required: false,
        order: 4,
        dataType: 'string',
        allowEmpty: true,
        maxCommas: 0,
    },
    {
        id: 'estado',
        name: 'Estado',
        required: false,
        order: 5,
        dataType: 'string',
        allowEmpty: true,
        maxCommas: 0,
    },
    {
        id: 'tipo',
        name: 'Tipo',
        required: false,
        order: 6,
        dataType: 'string',
        allowEmpty: true,
        maxCommas: 0,
    },
    {
        id: 'cuenta',
        name: 'Cuenta',
        required: false,
        order: 7,
        dataType: 'string',
        allowEmpty: true,
        maxCommas: 0,
    },
    {
        id: 'beneficiario',
        name: 'Beneficiario',
        required: false,
        order: 8,
        dataType: 'string',
        allowEmpty: true,
        maxCommas: 1, // Beneficiario puede tener nombres con coma
    },
    {
        id: 'divisa',
        name: 'Divisa',
        required: false,
        order: 9,
        dataType: 'string',
        allowEmpty: true,
        maxCommas: 0,
    },
    {
        id: 'numero',
        name: 'Número',
        required: false,
        order: 10,
        dataType: 'string',
        allowEmpty: true,
        maxCommas: 0,
    },
    {
        id: 'notas',
        name: 'Notas',
        required: false,
        order: 11,
        dataType: 'string',
        allowEmpty: true,
        maxCommas: 3, // Notas pueden tener múltiples comas
    },
]

const ColumnDefiner: React.FC<ColumnDefinerProps> = ({
    onColumnsChange,
    initialColumns = DEFAULT_COLUMNS,
    disabled = false,
}) => {
    const [columns, setColumns] = useState<ColumnDefinition[]>(initialColumns)

    // Actualizar columnas cuando cambien las initialColumns
    useEffect(() => {
        console.log('ColumnDefiner: actualizando columnas con:', initialColumns)
        setColumns(initialColumns)
    }, [initialColumns])

    // Notificar cambios al componente padre
    useEffect(() => {
        onColumnsChange(columns)
    }, [columns, onColumnsChange])

    const handleColumnChange = (
        id: string,
        field: keyof ColumnDefinition,
        value: any,
    ) => {
        setColumns((prev) =>
            prev.map((col) =>
                col.id === id ? { ...col, [field]: value } : col,
            ),
        )
    }

    const handleOrderChange = (id: string, newOrder: number) => {
        setColumns((prev) => {
            const sorted = [...prev].sort((a, b) => a.order - b.order)
            const currentIndex = sorted.findIndex((col) => col.id === id)
            const targetIndex = newOrder - 1

            if (
                currentIndex === -1 ||
                targetIndex < 0 ||
                targetIndex >= sorted.length
            ) {
                return prev
            }

            // Reorganizar órdenes
            const reordered = [...sorted]
            const [movedItem] = reordered.splice(currentIndex, 1)
            reordered.splice(targetIndex, 0, movedItem)

            // Actualizar órdenes
            return reordered.map((col, index) => ({
                ...col,
                order: index + 1,
            }))
        })
    }

    const addColumn = () => {
        const newId = `custom_${Date.now()}`
        const newOrder = Math.max(...columns.map((c) => c.order)) + 1

        // Buscar un nombre disponible que no esté siendo usado
        const usedNames = columns.map((c) => c.name)
        const availableName =
            CASHFLOW_COLUMN_NAMES.find((name) => !usedNames.includes(name)) ||
            'Nueva Columna'

        const newColumn: ColumnDefinition = {
            id: newId,
            name: availableName,
            required: false,
            order: newOrder,
            dataType: 'string',
            allowEmpty: true,
        }
        setColumns((prev) => [...prev, newColumn])
    }

    const removeColumn = (id: string) => {
        // No permitir eliminar si solo queda una columna
        if (columns.length <= 1) return

        setColumns((prev) => {
            const filtered = prev.filter((col) => col.id !== id)
            // Reordenar
            return filtered.map((col, index) => ({
                ...col,
                order: index + 1,
            }))
        })
    }

    const isColumnCustom = (id: string) => id.startsWith('custom_')

    const getColumnStyle = (column: ColumnDefinition) => ({
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: 12,
        marginBottom: 8,
        border: '1px solid #d1d5db',
        borderRadius: 8,
        backgroundColor: disabled ? '#f9fafb' : 'white',
    })

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
                    Definir Estructura de Columnas
                </h3>
                <p
                    style={{
                        margin: '4px 0 0 0',
                        fontSize: 12,
                        color: '#6b7280',
                    }}
                >
                    Define qué columnas esperas en tu archivo CSV y en qué orden
                </p>
            </div>

            {/* Lista de columnas */}
            <div style={{ marginBottom: 16 }}>
                {columns
                    .sort((a, b) => a.order - b.order)
                    .map((column) => (
                        <div key={column.id} style={getColumnStyle(column)}>
                            {/* Número de orden */}
                            <div
                                style={{
                                    minWidth: 24,
                                    height: 24,
                                    borderRadius: '50%',
                                    backgroundColor: column.required
                                        ? '#dc2626'
                                        : '#6b7280',
                                    color: 'white',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: 12,
                                    fontWeight: 600,
                                }}
                            >
                                {column.order}
                            </div>

                            {/* Nombre de la columna */}
                            <select
                                value={column.name}
                                onChange={(e) =>
                                    handleColumnChange(
                                        column.id,
                                        'name',
                                        e.target.value,
                                    )
                                }
                                disabled={disabled}
                                style={{
                                    flex: 1,
                                    padding: '6px 8px',
                                    border: '1px solid #d1d5db',
                                    borderRadius: 4,
                                    fontSize: 13,
                                    backgroundColor: disabled
                                        ? '#f9fafb'
                                        : 'white',
                                }}
                            >
                                {CASHFLOW_COLUMN_NAMES.map((name) => (
                                    <option key={name} value={name}>
                                        {name}
                                    </option>
                                ))}
                            </select>

                            {/* Tipo de datos */}
                            <select
                                value={column.dataType}
                                onChange={(e) =>
                                    handleColumnChange(
                                        column.id,
                                        'dataType',
                                        e.target.value,
                                    )
                                }
                                disabled={disabled}
                                style={{
                                    padding: '6px 8px',
                                    border: '1px solid #d1d5db',
                                    borderRadius: 4,
                                    fontSize: 13,
                                    backgroundColor: disabled
                                        ? '#f9fafb'
                                        : 'white',
                                    minWidth: 80,
                                }}
                            >
                                <option value="string">Texto</option>
                                <option value="number">Número</option>
                                <option value="date">Fecha</option>
                                <option value="boolean">Booleano</option>
                            </select>

                            {/* Checkbox requerido */}
                            <label
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 4,
                                    fontSize: 13,
                                    color: '#374151',
                                    cursor: disabled
                                        ? 'not-allowed'
                                        : 'pointer',
                                }}
                            >
                                <input
                                    type="checkbox"
                                    checked={column.required}
                                    onChange={(e) =>
                                        handleColumnChange(
                                            column.id,
                                            'required',
                                            e.target.checked,
                                        )
                                    }
                                    disabled={disabled}
                                />
                                Requerido
                            </label>

                            {/* Checkbox permitir datos vacíos */}
                            <label
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 4,
                                    fontSize: 13,
                                    color: '#374151',
                                    cursor: disabled
                                        ? 'not-allowed'
                                        : 'pointer',
                                }}
                            >
                                <input
                                    type="checkbox"
                                    checked={column.allowEmpty}
                                    onChange={(e) =>
                                        handleColumnChange(
                                            column.id,
                                            'allowEmpty',
                                            e.target.checked,
                                        )
                                    }
                                    disabled={disabled}
                                />
                                Permitir vacíos
                            </label>

                            {/* Campo para máximo de comas */}
                            {column.dataType === 'string' && (
                                <div
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 4,
                                        fontSize: 12,
                                        color: '#374151',
                                    }}
                                >
                                    <label style={{ fontSize: 12 }}>
                                        Máx. comas:
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        max="10"
                                        value={column.maxCommas || 0}
                                        onChange={(e) =>
                                            handleColumnChange(
                                                column.id,
                                                'maxCommas',
                                                parseInt(e.target.value) || 0,
                                            )
                                        }
                                        disabled={disabled}
                                        style={{
                                            width: 50,
                                            padding: '2px 4px',
                                            border: '1px solid #d1d5db',
                                            borderRadius: 4,
                                            fontSize: 12,
                                            backgroundColor: disabled
                                                ? '#f9fafb'
                                                : 'white',
                                        }}
                                    />
                                </div>
                            )}

                            {/* Selector de orden */}
                            <select
                                value={column.order}
                                onChange={(e) =>
                                    handleOrderChange(
                                        column.id,
                                        parseInt(e.target.value),
                                    )
                                }
                                disabled={disabled}
                                style={{
                                    padding: '4px 6px',
                                    border: '1px solid #d1d5db',
                                    borderRadius: 4,
                                    fontSize: 12,
                                    backgroundColor: disabled
                                        ? '#f9fafb'
                                        : 'white',
                                }}
                            >
                                {columns.map((_, index) => (
                                    <option key={index} value={index + 1}>
                                        Posición {index + 1}
                                    </option>
                                ))}
                            </select>

                            {/* Botón eliminar (disponible para todas las columnas si hay más de una) */}
                            {columns.length > 1 && (
                                <button
                                    type="button"
                                    onClick={() => removeColumn(column.id)}
                                    disabled={disabled}
                                    style={{
                                        background: '#dc2626',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: 4,
                                        padding: '4px 8px',
                                        fontSize: 12,
                                        cursor: disabled
                                            ? 'not-allowed'
                                            : 'pointer',
                                        opacity: disabled ? 0.5 : 1,
                                    }}
                                >
                                    ✕
                                </button>
                            )}
                        </div>
                    ))}
            </div>

            {/* Botón agregar columna */}
            <button
                type="button"
                onClick={addColumn}
                disabled={disabled}
                style={{
                    background: '#2563eb',
                    color: 'white',
                    border: 'none',
                    borderRadius: 6,
                    padding: '8px 12px',
                    fontSize: 13,
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    opacity: disabled ? 0.5 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                }}
            >
                + Agregar Columna
            </button>

            {/* Resumen de estructura */}
            <div
                style={{
                    marginTop: 16,
                    padding: 12,
                    backgroundColor: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: 8,
                }}
            >
                <h4
                    style={{
                        margin: '0 0 8px 0',
                        fontSize: 13,
                        fontWeight: 600,
                        color: '#374151',
                    }}
                >
                    Estructura Definida:
                </h4>
                <div style={{ fontSize: 12, color: '#6b7280' }}>
                    {columns
                        .sort((a, b) => a.order - b.order)
                        .map((col, index) => (
                            <span key={col.id}>
                                {index + 1}. {col.name} ({col.dataType})
                                {col.required && ' *'}
                                {col.allowEmpty && ' [vacíos OK]'}
                                {index < columns.length - 1 && ', '}
                            </span>
                        ))}
                </div>
            </div>
        </div>
    )
}

export default ColumnDefiner
