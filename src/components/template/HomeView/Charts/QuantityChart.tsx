import React, { useEffect, useRef } from 'react'
import Chart from 'chart.js/auto'
import { useChartData } from '../../Hooks/useChartData'

const QuantityChart: React.FC<{ onSelectedValue: string }> = ({
    onSelectedValue,
}) => {
    const LOCAL_STORAGE_USER_KEY = 'user'
    const storedUserJson = localStorage.getItem(LOCAL_STORAGE_USER_KEY)
    const storedUser = storedUserJson ? JSON.parse(storedUserJson) : {}

    const payments = useChartData(storedUser.id, onSelectedValue)
    const chartRef = useRef<Chart>()

    useEffect(() => {
        const ctx = document.getElementById(
            'QuantityChart',
        ) as HTMLCanvasElement

        if (ctx) {
            if (!chartRef.current) {
                chartRef.current = new Chart(ctx, {
                    type: 'bar',
                    data: {
                        labels: [],
                        datasets: [
                            {
                                label: 'Transacciones totales',
                                data: [],
                                backgroundColor: 'rgba(44, 97, 162,0.8)',
                                borderColor: 'rgba(44, 97, 162,0.8)',
                                borderWidth: 2,
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
                const { labels, quantity } = payments.dias
                chartRef.current.data.labels = labels
                chartRef.current.data.datasets[0].data = quantity
                chartRef.current.update()
            }
        }
    }, [payments, onSelectedValue])

    return (
        <div>
            <canvas id="QuantityChart" width="100%" height="50%"></canvas>
            {!payments ||
                !payments.dias ||
                (payments.dias.labels.length === 0 && (
                    <p>No hay datos disponibles para mostrar.</p>
                ))}
        </div>
    )
}

export default QuantityChart
