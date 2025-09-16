import React, { useEffect, useRef } from 'react'
import Chart from 'chart.js/auto'
import { useChartData } from '../../Hooks/useChartData'

const PaymentsChart: React.FC<{ onSelectedValue: string }> = ({
    onSelectedValue,
}) => {
    const LOCAL_STORAGE_USER_KEY = 'user'
    const storedUserJson = localStorage.getItem(LOCAL_STORAGE_USER_KEY)
    const storedUser = storedUserJson ? JSON.parse(storedUserJson) : {}

    const payments = useChartData(storedUser.id, onSelectedValue)
    const chartRef = useRef<Chart>()

    useEffect(() => {
        const ctx = document.getElementById(
            'paymentsChart',
        ) as HTMLCanvasElement

        if (ctx) {
            if (!chartRef.current) {
                chartRef.current = new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: [],
                        datasets: [
                            {
                                label: 'Ventas totales',
                                data: [],
                                backgroundColor: 'rgba(21,46,77,0.8)',
                                borderColor: 'rgba(18,38,63,0.8)',
                                borderWidth: 2,
                                tension: 0.45,
                                fill: true,
                            },
                        ],
                    },
                    options: {
                        scales: {
                            y: {
                                beginAtZero: true,
                            },
                        },
                    },
                })
            }

            if (payments && payments.dias && payments.dias.labels.length > 0) {
                const { labels, values } = payments.dias
                chartRef.current.data.labels = labels
                chartRef.current.data.datasets[0].data = values
                chartRef.current.update()
            }
        }
    }, [payments, onSelectedValue])

    return (
        <div>
            <canvas id="paymentsChart" width="100%" height="50%"></canvas>
            {!payments ||
                !payments.dias ||
                (payments.dias.labels.length === 0 && (
                    <p>No hay datos disponibles para mostrar.</p>
                ))}
        </div>
    )
}

export default PaymentsChart
