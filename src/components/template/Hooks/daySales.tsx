import { useState, useEffect } from 'react'
import { fetchSalesStats } from '../../../api/api'
import { FormatNumber } from '../../../utils/hooks/formatNumber'
import FormatCurrency from '@/utils/hooks/formatCurrency'

interface SalesData {
    cantidad: number
    monto: number | string
}

interface SalesStats {
    salesToday: SalesData | null
}

const daySales = (userId: string): SalesStats => {
    const [daySales, setDaySales] = useState<SalesStats>({
        salesToday: null,
    })

    useEffect(() => {
        if (!userId) return

        fetchSalesStats(userId)
            .then((data) => {
                const formatCurrency = FormatCurrency('es-AR')
                const { formatNumber } = FormatNumber()

                const formattedCantidad =
                    formatNumber(data.salesToday?.cantidad) || 0
                const formattedMonto =
                    formatCurrency(data.salesToday?.monto) || 0

                setDaySales({
                    salesToday: data.salesToday
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

    return daySales
}

export default daySales
