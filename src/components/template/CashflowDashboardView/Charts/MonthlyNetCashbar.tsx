import { useMemo, useState } from 'react'
import {
    Bar,
    BarChart,
    CartesianGrid,
    Tooltip,
    XAxis,
    YAxis,
    Legend,
    ResponsiveContainer,
    ReferenceLine,
    Brush,
} from 'recharts'
import { groupByMonth, groupByDay } from '@/utils/cashflowSelectors'
import { Movimiento } from '@/@types/cashflow'

interface Props {
    movements: Movimiento[]
    locale?: string
    granularity?: 'month' | 'day'
}

export default function MonthlyNetCashBar({
    movements,
    locale = 'es-AR',
    granularity = 'month',
}: Props) {
    const [selectedGranularity, setSelectedGranularity] = useState<
        'month' | 'day'
    >(granularity)

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
        const d = new Date(dmy)
        if (!isNaN(d.getTime())) {
            const y = d.getUTCFullYear()
            const m = String(d.getUTCMonth() + 1).padStart(2, '0')
            const day = String(d.getUTCDate()).padStart(2, '0')
            return `${y}-${m}-${day}`
        }
        return dmy
    }

    const normalizedMovements = useMemo<Movimiento[]>(() => {
        return movements.map((m) => ({
            ...m,
            fecha: toIsoYmdFromDmy(m.fecha as any),
        }))
    }, [movements])

    const data = useMemo(() => {
        if (selectedGranularity === 'day') {
            return groupByDay(normalizedMovements).map((d) => ({
                month: d.date,
                ingreso: d.ingresos,
                egreso: -d.egresos,
            }))
        }
        return groupByMonth(normalizedMovements).map((m) => ({
            month: m.month,
            ingreso: m.ingresos,
            egreso: -m.egresos,
        }))
    }, [normalizedMovements, selectedGranularity])

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

    return (
        <div className="w-full">
            {/* Header con título y selector de granularidad */}
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-500">
                    Flujo de Caja Neto
                </h3>
                <select
                    value={selectedGranularity}
                    onChange={(e) =>
                        setSelectedGranularity(
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
                <ResponsiveContainer width={'100%'}>
                    <BarChart
                        data={data}
                        stackOffset="sign"
                        margin={{
                            top: 20,
                            right: 0,
                            left: 0,
                            bottom: 0,
                        }}
                    >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                            dataKey="month"
                            axisLine={{ stroke: '#fff' }}
                            tickFormatter={formatXAxis}
                        />
                        <YAxis
                            tickFormatter={(v) => formatYAxis(Number(v))}
                            axisLine={{ stroke: '#fff' }}
                        />
                        <Tooltip
                            formatter={(v: number) => formatYAxis(v)}
                            labelFormatter={formatXAxis}
                        />
                        <Legend layout="horizontal" />
                        <ReferenceLine y={0} stroke="#999" />
                        <Brush dataKey="month" height={30} />
                        <Bar
                            dataKey="ingreso"
                            name="Ingreso"
                            type="monotone"
                            fill="rgba(92, 191, 129, 0.6)"
                            stackId="cash"
                        />
                        <Bar
                            dataKey="egreso"
                            name="Egreso"
                            fill="rgba(234, 123, 123, 0.6)"
                            stackId="cash"
                        />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    )
}
