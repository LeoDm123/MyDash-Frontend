import { useState, useEffect } from 'react'
import { fetchSalesStats } from '../../../api/api'
import FormatCurrency from '../../../utils/hooks/formatCurrency'
import { FormatNumber } from '@/utils/hooks/formatNumber'

interface SalesData {
    cantidad: number
    monto: number | string
}

interface SalesStats {
    salesLastDay: SalesData | null
}

const yesterdaySales = (userId: string): SalesStats => {
    const [yesterdaySales, setYesterdaySales] = useState<SalesStats>({
        salesLastDay: null,
    })

    useEffect(() => {
        if (!userId) return

        fetchSalesStats(userId)
            .then((data) => {
                const formatCurrency = FormatCurrency('es-AR')
                const { formatNumber } = FormatNumber()

                const formattedCantidad =
                    formatNumber(data.salesLastDay?.cantidad) || 0
                const formattedMonto =
                    formatCurrency(data.salesLastDay?.monto) || 0

                setYesterdaySales({
                    salesLastDay: data.salesLastDay
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

    return yesterdaySales
}

export default yesterdaySales
