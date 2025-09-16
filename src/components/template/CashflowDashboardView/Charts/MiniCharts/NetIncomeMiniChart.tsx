import React, { useMemo } from 'react'
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
} from 'recharts'
import { Dataset } from '@/@types/cashflow'
import { saldoDiario } from '@/utils/cashflowSelectors'
import PercentageIndicator from '@/components/ui/PercentageIndicator'
import { FormatCurrency } from '@/utils/hooks/formatCurrency'

interface NetIncomeMiniChartProps {
    dataset: Dataset
    previousDataset?: Dataset | null
    locale?: string // "es-AR"
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

const NetIncomeMiniChart: React.FC<NetIncomeMiniChartProps> = ({
    dataset,
    previousDataset,
    locale = 'es-AR',
}) => {
    // Serie diaria acumulada (saldo) desde los movimientos del dataset activo
    const currentSaldo = saldoDiario(dataset.movements, 0)
    const prevSaldo = previousDataset
        ? saldoDiario(previousDataset.movements, 0)
        : []

    // Alinear por el mismo periodo/longitud del dataset actual
    const len = currentSaldo.length
    const chartData = currentSaldo.map((x, i) => ({
        date: x.date,
        current: x.saldo,
        previous: prevSaldo[i]?.saldo ?? null,
    }))

    const formatCurrency = useMemo(() => FormatCurrency(locale), [locale])

    const customTooltipFormatter = (value: number, name: string) => {
        return [formatCurrency(Number(value)), name]
    }

    const currentValue = len > 0 ? currentSaldo[len - 1].saldo : 0
    const previousValue =
        prevSaldo.length > 0
            ? prevSaldo[Math.min(prevSaldo.length, len) - 1].saldo
            : 0
    const diffAmount = currentValue - previousValue
    const variation =
        previousValue !== 0 ? (diffAmount / previousValue) * 100 : 0
    const variationColor = diffAmount >= 0 ? '#10b981' : '#ef4444'

    return (
        <div className="flex items-center gap-4 bg-white rounded-lg shadow-sm">
            {/* Indicador (20%) */}
            <div className="w-1/5 min-w-[160px]">
                <h3 className="text-sm font-medium text-gray-600">Balance</h3>
                <p className="text-2xl font-bold text-blue-600">
                    ${currentValue.toLocaleString()}
                </p>
                {previousDataset && (
                    <div className=" flex items-center gap-2">
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
                    <AreaChart data={chartData}>
                        {/* Serie acumulada del dataset activo */}
                        <Area
                            type="monotone"
                            dataKey="current"
                            name="Actual"
                            stroke="rgba(74, 144, 226, 1)"
                            fill="rgba(74, 144, 226, 0.6)"
                            strokeWidth={3}
                            dot={false}
                            connectNulls
                        />
                        {/* Serie año anterior (si existe) */}
                        {previousDataset && (
                            <Area
                                type="monotone"
                                dataKey="previous"
                                name="Anterior"
                                stroke="rgba(50,50,50,0.5)"
                                fill="rgba(50, 50, 50, 0.3)"
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
        </div>
    )
}

export default NetIncomeMiniChart
