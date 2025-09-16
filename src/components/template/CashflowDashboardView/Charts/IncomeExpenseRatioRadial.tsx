import { useMemo } from 'react'
import {
    RadialBarChart,
    RadialBar,
    PolarAngleAxis,
    ResponsiveContainer,
} from 'recharts'
import { ingresosGastosTotals } from '@/utils/cashflowSelectors'
import { Movimiento } from '@/@types/cashflow'
const formatPct = (v: number) => `${v.toFixed(1)}%`

interface Props {
    movements: Movimiento[]
    locale?: string // reservado si quisieras textos localizados
}

export default function IncomeExpenseRatioRadial({ movements }: Props) {
    const { ratioPct } = useMemo(
        () => ingresosGastosTotals(movements),
        [movements],
    )
    const capped = Math.min(ratioPct, 200)
    const data = [{ name: 'Ingresos/Gastos', value: capped }]

    return (
        <div className="w-full h-64 flex flex-col items-center justify-center gap-2">
            <div className="text-sm text-gray-500">Ingresos/Gastos</div>
            <div className="text-2xl font-semibold">{formatPct(ratioPct)}</div>
            <div className="w-full h-40">
                <ResponsiveContainer>
                    <RadialBarChart
                        innerRadius="70%"
                        outerRadius="100%"
                        data={data}
                        startAngle={180}
                        endAngle={0}
                    >
                        <PolarAngleAxis
                            type="number"
                            domain={[0, 200]}
                            tick={false}
                        />
                        <RadialBar dataKey="value" />
                    </RadialBarChart>
                </ResponsiveContainer>
            </div>
            <div className="text-xs text-gray-500">
                &gt; 100% indica ingresos &gt; gastos
            </div>
        </div>
    )
}
