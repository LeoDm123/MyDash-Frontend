import React, { useState, useEffect } from 'react'
import HomeCard from './HomeCard'
import DateDropdown from '../Dropdown/DateDropdown'
import daySales from '../../Hooks/daySales'
import yesterdaySales from '../../Hooks/yesterdaySales'
import weekSales from '../../Hooks/weekSales'
import monthSales from '../../Hooks/monthSales'
import PaymentsChart from '../Charts/PaymentsChart'
import QuantityChart from '../Charts/QuantityChart'

const CardStack: React.FC = () => {
    const LOCAL_STORAGE_USER_KEY: string = 'user'
    const storedUser: any = JSON.parse(
        localStorage.getItem(LOCAL_STORAGE_USER_KEY) || '',
    )

    const [selectedValue, setSelectedValue] = useState<string>('day')

    const { salesToday: daySalesData } = daySales(storedUser.id)
    const { salesLastDay: yesterdaySalesData } = yesterdaySales(storedUser.id)
    const { salesLast7Days: weekSalesData } = weekSales(storedUser.id)
    const { salesLastMonth: monthSalesData } = monthSales(storedUser.id)

    const handleSelectedValueChange = (value: string) => {
        setSelectedValue(value)
    }

    const renderSalesData = () => {
        switch (selectedValue) {
            case 'day':
                return {
                    salesQty: daySalesData?.cantidad,
                    netSales: daySalesData?.monto,
                    transactionsQty: daySalesData?.cantidad,
                    netTransactions: daySalesData?.monto,
                }
            case 'yesterday':
                return {
                    salesQty: yesterdaySalesData?.cantidad,
                    netSales: yesterdaySalesData?.monto,
                    transactionsQty: yesterdaySalesData?.cantidad,
                    netTransactions: yesterdaySalesData?.monto,
                }
            case 'week':
                return {
                    salesQty: weekSalesData?.cantidad,
                    netSales: weekSalesData?.monto,
                    transactionsQty: weekSalesData?.cantidad,
                    netTransactions: weekSalesData?.monto,
                }
            case 'month':
                return {
                    salesQty: daySalesData?.cantidad,
                    netSales: monthSalesData?.monto,
                    transactionsQty: monthSalesData?.cantidad,
                    netTransactions: monthSalesData?.monto,
                }
            default:
                return {}
        }
    }

    const { salesQty, netSales, transactionsQty, netTransactions } =
        renderSalesData()

    return (
        <div className="hv-container">
            <div>
                <DateDropdown
                    onSelectedValueChange={handleSelectedValueChange}
                />
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap' }}>
                <div style={{ width: '50%', padding: '5px' }}>
                    <HomeCard header="Ventas" colorLevel="primary">
                        <p>Cantidad Total: {transactionsQty}</p>
                        <p>Monto Total: {netSales}</p>
                    </HomeCard>
                    <div style={{ paddingRight: '10px, ', marginTop: '50px' }}>
                        <PaymentsChart onSelectedValue={selectedValue} />
                    </div>
                </div>
                <div style={{ width: '50%', padding: '5px' }}>
                    <HomeCard header="Transacciones" colorLevel="secondary">
                        <p>Cantidad Total: {transactionsQty}</p>
                        <p>Monto Total: {netTransactions}</p>
                    </HomeCard>
                    <div style={{ paddingLeft: '10px', marginTop: '50px' }}>
                        <QuantityChart onSelectedValue={selectedValue} />
                    </div>
                </div>
            </div>
        </div>
    )
}

export default CardStack
