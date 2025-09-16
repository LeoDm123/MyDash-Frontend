import React, { useMemo, useState } from 'react'
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend,
    Brush,
} from 'recharts'
import { Movimiento } from '@/@types/cashflow'
import { FormatCurrency } from '@/utils/hooks/formatCurrency'

interface Props {
    movements: Movimiento[]
    maxCategorias?: number
    locale?: string
    granularidad?: 'month' | 'day'
}

// Función para agrupar montos por fecha y categoría según tipo (ingreso/egreso)
const procesarDatosParaAreaChart = (
    movimientos: Movimiento[],
    maxCategorias: number = 8,
    granularidad: 'month' | 'day' = 'month',
    tipo: 'ingreso' | 'egreso' = 'egreso',
) => {
    // Filtrar por tipo seleccionado
    const filtrados = movimientos.filter((m) => m.tipo === tipo)

    // Obtener las categorías más significativas
    const totalesPorCategoria: { [key: string]: number } = {}
    filtrados.forEach((movimiento) => {
        const categoria = movimiento.categoria.grupo
        totalesPorCategoria[categoria] =
            (totalesPorCategoria[categoria] || 0) + movimiento.monto
    })

    // Ordenar categorías por monto total y tomar las más importantes
    const categoriasPrincipales = Object.entries(totalesPorCategoria)
        .sort((a, b) => b[1] - a[1])
        .slice(0, maxCategorias)
        .map(([categoria]) => categoria)

    // Agrupar por fecha (mes o día)
    const valoresPorFecha: { [key: string]: { [key: string]: number } } = {}

    const toIsoYmdFromDmy = (dmy: string): string => {
        const parts = (dmy || '').split('/')
        if (parts.length === 3) {
            const [dd, mm, yy] = parts
            const year = yy.length === 2 ? Number(yy) + 2000 : Number(yy)
            const y = String(year).padStart(4, '0')
            const m = String(Number(mm)).padStart(2, '0')
            const d = String(Number(dd)).padStart(2, '0')
            return `${y}-${m}-${d}`
        }
        const date = new Date(dmy)
        if (!isNaN(date.getTime())) {
            const y = date.getUTCFullYear()
            const m = String(date.getUTCMonth() + 1).padStart(2, '0')
            const d = String(date.getUTCDate()).padStart(2, '0')
            return `${y}-${m}-${d}`
        }
        return dmy
    }

    filtrados.forEach((movimiento) => {
        const iso = toIsoYmdFromDmy(movimiento.fecha as any)
        const [y, m, d] = iso.split('-')
        const clave =
            granularidad === 'day' && d ? `${y}-${m}-${d}` : `${y}-${m}`
        const categoria = movimiento.categoria.grupo

        if (!categoriasPrincipales.includes(categoria)) return

        if (!valoresPorFecha[clave]) {
            valoresPorFecha[clave] = {}
            // Inicializar todas las categorías para este período
            categoriasPrincipales.forEach((cat) => {
                valoresPorFecha[clave][cat] = 0
            })
        }

        valoresPorFecha[clave][categoria] += movimiento.monto
    })

    // Convertir a array y ordenar por fecha
    const datos = Object.entries(valoresPorFecha)
        .map(([fechaClave, gastos]) => {
            return {
                fecha: fechaClave,
                ...gastos,
                total: Object.values(gastos).reduce(
                    (sum, current) => sum + current,
                    0,
                ),
            }
        })
        .sort((a, b) => a.fecha.localeCompare(b.fecha))

    return {
        datos,
        categorias: categoriasPrincipales,
    }
}

// Colores para las diferentes categorías
const COLORS = [
    '#8884d8',
    '#82ca9d',
    '#ffc658',
    '#ff8042',
    '#0088fe',
    '#00c49f',
    '#ffbb28',
    '#ff6b6b',
]

export default function ExpenseAreaChart({
    movements,
    maxCategorias = 8,
    locale = 'es-AR',
    granularidad = 'month',
}: Props) {
    const [highlightedCategory, setHighlightedCategory] = useState<
        string | null
    >(null)
    const [selectedGranularidad, setSelectedGranularidad] = useState<
        'month' | 'day'
    >(granularidad)
    const [selectedTipo, setSelectedTipo] = useState<'ingreso' | 'egreso'>(
        'egreso',
    )
    const formatCurrency = useMemo(() => FormatCurrency(locale), [locale])

    // Procesar datos para el área chart
    const { datos, categorias } = useMemo(
        () =>
            procesarDatosParaAreaChart(
                movements,
                maxCategorias,
                selectedGranularidad,
                selectedTipo,
            ),
        [movements, maxCategorias, selectedGranularidad, selectedTipo],
    )

    // Función para formatear el tooltip
    const customTooltipFormatter = (value: number, name: string) => {
        return [formatCurrency(value), name]
    }

    // Función para formatear el eje Y
    const formatYAxis = (value: number) => {
        if (value >= 1000000) {
            return `$${(value / 1000000).toFixed(1)}M`
        } else if (value >= 1000) {
            return `$${(value / 1000).toFixed(0)}K`
        }
        return `$${value}`
    }

    // Formatear el nombre del mes para el eje X
    const formatXAxis = (fechaStr: string) => {
        const parts = fechaStr.split('-')
        const monthNames = [
            'Ene',
            'Feb',
            'Mar',
            'Abr',
            'May',
            'Jun',
            'Jul',
            'Ago',
            'Sep',
            'Oct',
            'Nov',
            'Dic',
        ]
        if (parts.length === 2) {
            const [year, month] = parts
            return `${monthNames[parseInt(month) - 1]} ${year}`
        }
        if (parts.length === 3) {
            const [y, month, day] = parts
            return `${day}/${month}`
        }
        return fechaStr
    }

    // Función para manejar el evento de la leyenda
    const handleLegendMouseEnter = (o: any) => {
        setHighlightedCategory(o.dataKey)
    }

    // Función para manejar cuando el mouse sale de la leyenda
    const handleLegendMouseLeave = () => {
        setHighlightedCategory(null)
    }

    // Calcular opacidad según si está resaltado o no
    const getOpacity = (category: string) => {
        return highlightedCategory === null || highlightedCategory === category
            ? 1
            : 0.2
    }

    return (
        <div className="w-full">
            {/* Header con título y selector de granularidad */}
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-500">
                    Distribución por Categoría
                </h3>
                <div className="flex items-center gap-2">
                    <select
                        value={selectedTipo}
                        onChange={(e) =>
                            setSelectedTipo(
                                e.target.value as 'ingreso' | 'egreso',
                            )
                        }
                        className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="egreso">Gastos</option>
                        <option value="ingreso">Ingresos</option>
                    </select>
                    <select
                        value={selectedGranularidad}
                        onChange={(e) =>
                            setSelectedGranularidad(
                                e.target.value as 'month' | 'day',
                            )
                        }
                        className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="month">Mensual</option>
                        <option value="day">Diaria</option>
                    </select>
                </div>
            </div>
            <div className="h-80">
                {datos.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart
                            data={datos}
                            margin={{
                                top: 20,
                                right: 0,
                                left: 0,
                                bottom: 0,
                            }}
                        >
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis
                                dataKey="fecha"
                                tickFormatter={formatXAxis}
                                axisLine={{ stroke: '#fff' }}
                            />
                            <YAxis
                                tickFormatter={formatYAxis}
                                axisLine={{ stroke: '#fff' }}
                            />
                            <Tooltip
                                formatter={customTooltipFormatter}
                                labelFormatter={formatXAxis}
                            />
                            <Brush dataKey="fecha" height={30} />
                            <Legend
                                onMouseEnter={handleLegendMouseEnter}
                                onMouseLeave={handleLegendMouseLeave}
                            />
                            {categorias.map((categoria, index) => (
                                <Area
                                    key={categoria}
                                    type="monotone"
                                    dataKey={categoria}
                                    stackId="1"
                                    stroke={COLORS[index % COLORS.length]}
                                    fill={COLORS[index % COLORS.length]}
                                    name={categoria}
                                    fillOpacity={getOpacity(categoria)}
                                    strokeOpacity={getOpacity(categoria)}
                                />
                            ))}
                        </AreaChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="flex items-center justify-center h-full text-gray-500">
                        No hay datos de gastos para visualizar
                    </div>
                )}
            </div>
        </div>
    )
}
