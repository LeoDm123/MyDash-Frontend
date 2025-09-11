import React, { useMemo, useState } from 'react'
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
} from 'recharts'
import { Dataset } from '@/@types/cashflow'
import { groupByDay } from '@/utils/cashflowSelectors'
import PercentageIndicator from '@/components/ui/PercentageIndicator'
import { FormatCurrency } from '@/utils/hooks/formatCurrency'
import Dialog from '@/components/ui/Dialog'

interface IncomeMiniChartProps {
    dataset: Dataset
    previousDataset?: Dataset | null
    locale?: string // "es-AR"
}

const IncomeMiniChart: React.FC<IncomeMiniChartProps> = ({
    dataset,
    previousDataset,
    locale = 'es-AR',
}) => {
    const [isOpen, setIsOpen] = useState(false)
    const [selectedDate, setSelectedDate] = useState<string | null>(null)

    // Agrupar por día y construir acumulado de ingresos
    const currentDays = groupByDay(dataset.movements)
    const prevDays = previousDataset
        ? groupByDay(previousDataset.movements)
        : []

    const len = currentDays.length
    const chartData = currentDays.map((d, i) => {
        const prevPoint = prevDays[i]
        return {
            date: d.date,
            current: d.ingresos,
            previous: prevPoint ? prevPoint.ingresos : null,
        }
    })

    const formatCurrency = useMemo(() => FormatCurrency(locale), [locale])

    const customTooltipFormatter = (value: number, name: string) => {
        return [formatCurrency(Number(value)), name]
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
            const [year, month, day] = parts
            return `${day} de ${monthNames[parseInt(month) - 1]} ${year}`
        }
        return fechaStr
    }

    const currentValue = currentDays.reduce((s, it) => s + it.ingresos, 0)
    const previousValue = prevDays
        .slice(0, len)
        .reduce((s, it) => s + it.ingresos, 0)
    const diffAmount = currentValue - previousValue
    const variation =
        previousValue !== 0 ? (diffAmount / previousValue) * 100 : 0

    // Obtener movimientos por fecha AAAA-MM-DD
    const movementsBySelectedDate = useMemo(() => {
        if (!selectedDate) return [] as Dataset['movements']
        const toIsoYmdFromDmy = (dmy: string): string => {
            if (typeof dmy === 'string' && dmy.includes('/')) {
                const parts = dmy.split('/')
                if (parts.length === 3) {
                    const [dd, mm, yy] = parts
                    const year =
                        yy.length === 2 ? Number(yy) + 2000 : Number(yy)
                    const y = String(year).padStart(4, '0')
                    const m = String(Number(mm)).padStart(2, '0')
                    const d = String(Number(dd)).padStart(2, '0')
                    return `${y}-${m}-${d}`
                }
            }
            const date = new Date(dmy)
            if (!isNaN(date.getTime())) {
                const y = date.getUTCFullYear()
                const m = String(date.getUTCMonth() + 1).padStart(2, '0')
                const day = String(date.getUTCDate()).padStart(2, '0')
                return `${y}-${m}-${day}`
            }
            return dmy
        }
        return dataset.movements.filter(
            (m) =>
                toIsoYmdFromDmy(m.fecha as any) === selectedDate &&
                m.tipo === 'ingreso',
        )
    }, [selectedDate, dataset.movements])

    const totalSelected = useMemo(() => {
        return movementsBySelectedDate.reduce(
            (sum, m) => sum + Number(m.monto || 0),
            0,
        )
    }, [movementsBySelectedDate])

    const handlePointClick = (state: any) => {
        const dateYmd = state?.activeLabel as string | undefined
        if (!dateYmd) return
        setSelectedDate(dateYmd)
        setIsOpen(true)
    }

    return (
        <div className="flex items-center gap-4  bg-white rounded-lg shadow-sm">
            {/* Indicador (20%) */}
            <div className="w-1/5 min-w-[160px]">
                <h3 className="text-sm font-medium text-gray-600">Ingresos</h3>
                <p className="text-2xl font-bold text-green-600">
                    ${currentValue.toLocaleString()}
                </p>
                {previousDataset && (
                    <div className="flex items-center gap-2">
                        <PercentageIndicator
                            value={variation}
                            isPositive={true}
                        />
                        <span className="text-xs text-gray-500">
                            ({diffAmount >= 0 ? '+' : ''}$
                            {Math.abs(diffAmount).toLocaleString()})
                        </span>
                    </div>
                )}
                <p className="text-xs text-gray-500">vs periodo anterior</p>
            </div>

            {/* Gráfico (80%) */}
            <div className="w-4/5 h-24">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} onClick={handlePointClick}>
                        {/* Actual */}
                        <Area
                            type="monotone"
                            dataKey="current"
                            name="Actual"
                            stroke="rgba(16,185,129,1)"
                            fill="rgba(16,185,129,0.5)"
                            strokeWidth={3}
                            dot={false}
                            connectNulls
                        />
                        {/* Anterior */}
                        {previousDataset && (
                            <Area
                                type="monotone"
                                dataKey="previous"
                                name="Anterior"
                                stroke="rgba(50,50,50,0.5)"
                                fill="rgba(50,50,50,0.3)"
                                strokeWidth={2}
                                dot={false}
                                isAnimationActive={false}
                                connectNulls
                            />
                        )}
                        <XAxis dataKey="date" hide />
                        <YAxis hide />
                        <Tooltip
                            labelFormatter={formatXAxis}
                            formatter={customTooltipFormatter}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
            <Dialog
                isOpen={isOpen}
                onRequestClose={() => setIsOpen(false)}
                width={720}
            >
                <div className="p-2">
                    <h3 className="text-lg font-semibold">
                        Movimientos del día
                    </h3>
                    {selectedDate && (
                        <div className="flex items-center justify-between">
                            <p className="text-sm text-gray-500">
                                {(() => {
                                    const [y, m, d] = selectedDate.split('-')
                                    return `${d}-${m}-${y}`
                                })()}{' '}
                                · {movementsBySelectedDate.length} movimiento(s)
                            </p>
                            <p>
                                Total:{' '}
                                <span className="font-medium text-green-600 font-semibold ">
                                    {formatCurrency(totalSelected)}
                                </span>
                            </p>
                        </div>
                    )}
                    <div className="max-h-96 overflow-auto divide-y">
                        {movementsBySelectedDate.map((m, idx) => (
                            <div
                                key={idx}
                                className="py-3 flex items-center justify-between"
                            >
                                <div className="min-w-0 mr-6">
                                    <p className="text-sm font-medium text-gray-800 truncate">
                                        {m.categoria?.grupo || 'Sin categoría'}
                                        {m.categoria?.subgrupo
                                            ? ` · ${m.categoria.subgrupo}`
                                            : ''}
                                    </p>
                                    {m.nota && (
                                        <p className="text-xs text-gray-500 truncate">
                                            {m.nota}
                                        </p>
                                    )}
                                </div>
                                <div className="text-sm text-gray-600">
                                    {m.tipo === 'ingreso' ? '+' : ''}
                                    {formatCurrency(m.monto)}
                                </div>
                            </div>
                        ))}
                        {movementsBySelectedDate.length === 0 && (
                            <div className="py-8 text-center text-sm text-gray-500">
                                Sin movimientos
                            </div>
                        )}
                    </div>
                </div>
            </Dialog>
        </div>
    )
}

export default IncomeMiniChart
