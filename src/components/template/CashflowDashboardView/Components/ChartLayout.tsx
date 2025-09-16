import { useMemo, useState } from 'react'
import { useDatasets } from '@/utils/hooks/useDatasets'
import { Dataset } from '@/@types/cashflow'
import { FormatCurrency } from '@/utils/hooks/formatCurrency'
import { Card } from '@/components/ui'

// Gráficos/KPIs principales
import MonthlyNetCashBar from '../Charts/MonthlyNetCashbar'
import ExpenseDistributionPie from '../Charts/ExpenseDistributionPie'
import IncomeExpenseRatioRadial from '../Charts/IncomeExpenseRatioRadial'
import DailyBalanceLine from '../Charts/DailyBalanceLine'
import AvgDailyMovementsCard from '../Charts/AvgDailyMovementsCard'

// Mini charts
import NetIncomeMiniChart from '../Charts/MiniCharts/NetIncomeMiniChart'
import IncomeMiniChart from '../Charts/MiniCharts/IncomeMiniChart'
import ExpensesMiniChart from '../Charts/MiniCharts/ExpensesMiniChart'

// Función para generar datos de ejemplo para los mini charts
const generateMiniChartData = () => {
    const months = [
        'Jan',
        'Feb',
        'Mar',
        'Apr',
        'May',
        'Jun',
        'Jul',
        'Aug',
        'Sep',
    ]
    return months.map((month) => ({
        month,
        value: Math.floor(Math.random() * 2000) + 500, // Valores entre 500 y 2500
    }))
}

export default function ChartLayout() {
    const { datasets, loading, error } = useDatasets()
    console.log('datasets', datasets)
    const [selectedId, setSelectedId] = useState<string | null>(null)
    const [locale, setLocale] = useState<string>('es-AR')
    const [netCashGranularity, setNetCashGranularity] = useState<
        'month' | 'day'
    >('month')
    const [expensesGranularity, setExpensesGranularity] = useState<
        'month' | 'day'
    >('month')

    const activeDataset = useMemo<Dataset | null>(() => {
        if (!datasets || datasets.length === 0) return null
        return selectedId
            ? (datasets.find((d) => d._id === selectedId) ?? datasets[0])
            : datasets[0]
    }, [datasets, selectedId])

    const previousDataset = useMemo<Dataset | null>(() => {
        if (!datasets || datasets.length < 2 || !activeDataset) return null
        const sortedDatasets = [...datasets].sort(
            (a, b) =>
                new Date(a.periodStart).getTime() -
                new Date(b.periodStart).getTime(),
        )
        const currentIndex = sortedDatasets.findIndex(
            (d) => d._id === activeDataset._id,
        )
        return currentIndex > 0 ? sortedDatasets[currentIndex - 1] : null
    }, [datasets, activeDataset])

    const formatCurrency = useMemo(() => FormatCurrency(locale), [locale])
    const miniChartData = useMemo(() => generateMiniChartData(), [])

    if (loading) {
        return (
            <div className="p-6 space-y-4">
                <div className="h-6 w-64 bg-gray-200 dark:bg-zinc-800 rounded animate-pulse" />
                <div className="h-10 w-full bg-gray-200 dark:bg-zinc-800 rounded animate-pulse" />
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    <div className="h-80 bg-gray-200 dark:bg-zinc-800 rounded-xl animate-pulse" />
                    <div className="h-80 bg-gray-200 dark:bg-zinc-800 rounded-xl animate-pulse" />
                    <div className="h-80 xl:col-span-2 bg-gray-200 dark:bg-zinc-800 rounded-xl animate-pulse" />
                </div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="p-6">
                <p className="text-red-600">Error: {error}</p>
            </div>
        )
    }

    if (!activeDataset) {
        return (
            <div className="p-6">
                <p className="text-sm text-gray-600">
                    No hay datasets disponibles.
                </p>
            </div>
        )
    }

    const { datasetName, periodStart, periodEnd, movements } = activeDataset

    return (
        <div className="space-y-2 mb-4">
            {/* Header */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">
                        {datasetName}
                    </h1>
                    <p className="text-sm text-gray-500">
                        {new Date(periodStart).toLocaleDateString('es-AR', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                        })}{' '}
                        →{' '}
                        {new Date(periodEnd).toLocaleDateString('es-AR', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                        })}
                    </p>
                </div>

                <div className="flex gap-2">
                    <select
                        className="border rounded-lg px-3 py-2 bg-white"
                        value={selectedId ?? activeDataset._id}
                        onChange={(e) => setSelectedId(e.target.value)}
                    >
                        {datasets.map((d) => (
                            <option key={d._id} value={d._id}>
                                {d.datasetName}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Mini Charts Section */}
            <Card className="shadow-md">
                <div className="grid grid-rows-1 md:grid-rows-3 gap-2">
                    <IncomeMiniChart
                        dataset={activeDataset}
                        previousDataset={previousDataset}
                    />
                    <ExpensesMiniChart
                        dataset={activeDataset}
                        previousDataset={previousDataset}
                    />
                    <NetIncomeMiniChart
                        dataset={activeDataset}
                        previousDataset={previousDataset}
                    />
                </div>
            </Card>

            {/* Gráficos principales */}
            {movements.length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                    <Card className="shadow-md">
                        <MonthlyNetCashBar
                            movements={movements}
                            locale={locale}
                            granularity={netCashGranularity}
                        />
                    </Card>

                    <Card className="shadow-md">
                        <ExpenseDistributionPie
                            movements={movements}
                            locale={locale}
                        />
                    </Card>

                    <Card className="lg:col-span-2 shadow-md">
                        <DailyBalanceLine
                            movements={movements}
                            locale={locale}
                        />
                    </Card>
                </div>
            )}
        </div>
    )
}
