import { useMemo } from 'react'
import { promedioMovimientosDiarios } from '@/utils/cashflowSelectors'
import { Movimiento } from '@/@types/cashflow'

interface Props {
    movements: Movimiento[]
}

export default function AvgDailyMovementsCard({ movements }: Props) {
    const { promedio, diasConMovimientos, totalMovimientos } = useMemo(
        () => promedioMovimientosDiarios(movements),
        [movements],
    )

    return (
        <div className="rounded-2xl p-4 shadow-sm bg-white dark:bg-zinc-900">
            <div className="text-sm text-gray-500 mb-1">
                Promedio de movimientos diarios
            </div>
            <div className="text-3xl font-semibold">{promedio.toFixed(2)}</div>
            <div className="text-xs text-gray-500 mt-2">
                {totalMovimientos} movimientos en {diasConMovimientos} días con
                actividad
            </div>
        </div>
    )
}
