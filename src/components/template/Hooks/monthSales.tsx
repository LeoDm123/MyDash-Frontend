import { useState, useEffect } from 'react'
import { fetchSalesStats } from '../../../api/api'
import FormatCurrency from '../../../utils/hooks/formatCurrency'
import { FormatNumber } from '../../../utils/hooks/formatNumber'

interface SalesData {
    cantidad: number
    monto: number | string
}

interface SalesStats {
    salesLastMonth: SalesData | null
}

const monthSales = (userId: string): SalesStats => {
    const [monthSales, setMonthSales] = useState<SalesStats>({
        salesLastMonth: null,
    })

    useEffect(() => {
        if (!userId) return

        fetchSalesStats(userId)
            .then((data) => {
                const formatCurrency = FormatCurrency('es-AR')
                const { formatNumber } = FormatNumber()

                const formattedCantidad =
                    formatNumber(data.salesLastMonth?.cantidad) || 0
                const formattedMonto =
                    formatCurrency(data.salesLastMonth?.monto) || 0

                setMonthSales({
                    salesLastMonth: data.salesLastMonth
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

    return monthSales
}

export default monthSales
