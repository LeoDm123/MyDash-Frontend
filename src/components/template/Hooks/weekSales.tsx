import { useState, useEffect } from 'react'
import { fetchSalesStats } from '../../../api/api'
import FormatCurrency from '../../../utils/hooks/formatCurrency'
import { FormatNumber } from '../../../utils/hooks/formatNumber'

interface SalesData {
    cantidad: number
    monto: number | string
}

interface SalesStats {
    salesLast7Days: SalesData | null
}

const weekSales = (userId: string): SalesStats => {
    const [weekSales, setWeekSales] = useState<SalesStats>({
        salesLast7Days: null,
    })

    useEffect(() => {
        if (!userId) return

        fetchSalesStats(userId)
            .then((data) => {
                const formatCurrency = FormatCurrency('es-AR')
                const { formatNumber } = FormatNumber()

                const formattedCantidad =
                    formatNumber(data.salesLast7Days?.cantidad) || 0
                const formattedMonto =
                    formatCurrency(data.salesLast7Days?.monto) || 0

                setWeekSales({
                    salesLast7Days: data.salesLast7Days
                        ? {
                              cantidad: Number(formattedCantidad),
                              monto: formattedMonto,
                          }
                        : null,
                })
            })
            .catch((error) => {
                console.error('Error fetching sales stats:', error)
            })
    }, [userId])

    return weekSales
}

export default weekSales
