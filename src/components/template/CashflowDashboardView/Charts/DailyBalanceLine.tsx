import { useMemo, useState } from 'react'
import {
    AreaChart,
    Area,
    CartesianGrid,
    Tooltip,
    XAxis,
    YAxis,
    ResponsiveContainer,
    ReferenceLine,
    Legend,
    Brush,
} from 'recharts'
import { saldoDiario, groupByMonth } from '@/utils/cashflowSelectors'
import { Movimiento } from '@/@types/cashflow'
import { FormatCurrency } from '@/utils/hooks/formatCurrency'

interface Props {
    movements: Movimiento[]
    locale?: string // "es-AR"
    saldoInicial?: number
    granularidad?: 'month' | 'day'
}

export default function DailyBalanceArea({
    movements,
    locale = 'es-AR',
    saldoInicial = 0,
    granularidad = 'month',
}: Props) {
    const [highlightedArea, setHighlightedArea] = useState<string | null>(null)
    const [selectedGranularidad, setSelectedGranularidad] = useState<
        'month' | 'day'
    >(granularidad)

    // Normalizador: convierte fechas DD/MM/AA(AA) a 'YYYY-MM-DD'
    const toIsoYmdFromDmy = (dmy: string): string => {
        // Espera 'DD/MM/AA' o 'DD/MM/AAAA'
        const parts = (dmy || '').split('/')
        if (parts.length !== 3) {
            // fallback a Date parseable
            const d = new Date(dmy)
            if (!isNaN(d.getTime())) {
                const y = d.getUTCFullYear()
                const m = String(d.getUTCMonth() + 1).padStart(2, '0')
                const day = String(d.getUTCDate()).padStart(2, '0')
                return `${y}-${m}-${day}`
            }
            return dmy
        }
        const [dd, mm, yy] = parts
        const year = yy
        const y = String(year).padStart(4, '0')
        const m = String(Number(mm)).padStart(2, '0')
        const d = String(Number(dd)).padStart(2, '0')
        return `${y}-${m}-${d}`
    }

    const normalizedMovements = useMemo<Movimiento[]>(() => {
        return movements.map((m) => ({
            ...m,
            fecha: toIsoYmdFromDmy(m.fecha as any),
        }))
    }, [movements])

    const data = useMemo(() => {
        if (selectedGranularidad === 'month') {
            // Procesar datos mensuales
            const monthlyData = groupByMonth(normalizedMovements)
            let acumulado = saldoInicial

            return monthlyData.map((m) => {
                acumulado += m.ingresos - m.egresos
                return {
                    date: m.month,
                    ingresos: m.ingresos,
                    egresos: m.egresos,
                    saldo: acumulado,
                    neto: m.ingresos - m.egresos,
                }
            })
        } else {
            // Procesar datos diarios (lógica original)
            const saldo = saldoDiario(normalizedMovements, saldoInicial)
            const ingresosPorDia = new Map<string, number>()
            const egresosPorDia = new Map<string, number>()

            for (const m of normalizedMovements) {
                const key = m.fecha // ya es 'YYYY-MM-DD'
                if (m.tipo === 'ingreso') {
                    ingresosPorDia.set(
                        key,
                        (ingresosPorDia.get(key) ?? 0) + m.monto,
                    )
                } else {
                    egresosPorDia.set(
                        key,
                        (egresosPorDia.get(key) ?? 0) + m.monto,
                    )
                }
            }

            const base = saldo.map((d) => ({
                ...d,
                ingresos: ingresosPorDia.get(d.date) ?? 0,
                egresos: egresosPorDia.get(d.date) ?? 0,
            }))

            let acumulado = saldoInicial
            return base.map((d) => {
                acumulado += d.ingresos - d.egresos
                return {
                    ...d,
                    saldo: acumulado,
                    neto: d.ingresos - d.egresos,
                }
            })
        }
    }, [movements, saldoInicial, selectedGranularidad])

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

    const formatYAxis = (value: number) => {
        const absoluteValue = Math.abs(value)
        const sign = value < 0 ? '-' : ''

        if (absoluteValue >= 1000000) {
            return `${sign}$${(absoluteValue / 1000000).toFixed(1)}M`
        } else if (absoluteValue >= 1000) {
            return `${sign}$${(absoluteValue / 1000).toFixed(0)}K`
        }
        return `${sign}$${absoluteValue}`
    }

    const formatCurrency = useMemo(() => FormatCurrency(locale), [locale])

    const customTooltipFormatter = (value: number, name: string) => {
        return [formatCurrency(Number(value)), name]
    }

    // Función para manejar el evento de la leyenda
    const handleLegendMouseEnter = (o: any) => {
        setHighlightedArea(o.dataKey)
    }

    // Función para manejar cuando el mouse sale de la leyenda
    const handleLegendMouseLeave = () => {
        setHighlightedArea(null)
    }

    // Calcular opacidad según si está resaltado o no
    const getOpacity = (dataKey: string) => {
        return highlightedArea === null || highlightedArea === dataKey ? 1 : 0.3
    }

    return (
        <div className="w-full">
            {/* Header con título y selector de granularidad */}
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-500">
                    Evolución del Saldo
                </h3>
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
            <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                        data={data}
                        margin={{
                            top: 20,
                            right: 0,
                            left: 10,
                            bottom: 0,
                        }}
                    >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                            dataKey="date"
                            axisLine={{ stroke: '#fff' }}
                            tickFormatter={formatXAxis}
                        />
                        <YAxis
                            tickFormatter={(v) => formatYAxis(Number(v))}
                            axisLine={{ stroke: '#fff' }}
                        />
                        <Tooltip
                            labelFormatter={formatXAxis}
                            formatter={customTooltipFormatter}
                        />
                        <Brush dataKey="fecha" height={30} />
                        <Legend
                            onMouseEnter={handleLegendMouseEnter}
                            onMouseLeave={handleLegendMouseLeave}
                        />
                        <ReferenceLine y={0} stroke="#999" />

                        {/* Área para ingresos (absoluta, parte desde 0) */}
                        <Area
                            type="monotone"
                            dataKey="ingresos"
                            name="Ingresos"
                            stroke="rgba(92, 191, 129, 1)"
                            fill="rgba(92, 191, 129, 0.3)"
                            strokeWidth={2}
                            fillOpacity={getOpacity('ingresos')}
                            strokeOpacity={getOpacity('ingresos')}
                            activeDot={{ r: 6 }}
                        />

                        {/* Área para egresos (absoluta, parte desde 0) */}
                        <Area
                            type="monotone"
                            dataKey="egresos"
                            name="Egresos"
                            stroke="rgba(234, 123, 123, 1)"
                            fill="rgba(234, 123, 123, 0.3)"
                            strokeWidth={2}
                            fillOpacity={getOpacity('egresos')}
                            strokeOpacity={getOpacity('egresos')}
                            activeDot={{ r: 6 }}
                        />

                        {/* Área para el saldo acumulado (depende de ingresos - egresos) */}
                        <Area
                            type="monotone"
                            dataKey="saldo"
                            name="Saldo Acumulado"
                            stroke="rgba(74, 144, 226, 1)"
                            fill="rgba(74, 144, 226, 0.3)"
                            strokeWidth={2}
                            fillOpacity={getOpacity('saldo')}
                            strokeOpacity={getOpacity('saldo')}
                            activeDot={{ r: 6 }}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    )
}
