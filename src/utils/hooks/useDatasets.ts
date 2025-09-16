import { useEffect, useState } from 'react'
import { fetchDataSetByEmail } from '@/api/api'
import type { Dataset } from '@/@types/cashflow'

// Custom Hook
export const useDatasets = () => {
    const [datasets, setDatasets] = useState<Dataset[]>([])
    const [loading, setLoading] = useState<boolean>(true)
    const [error, setError] = useState<string | null>(null)
    const [count, setCount] = useState<number>(0)
    const [selectedType, setSelectedType] = useState<string>('all')

    useEffect(() => {
        let isMounted = true // para evitar actualizar estado tras un unmount

        const load = async () => {
            setLoading(true)
            setError(null)
            try {
                // Obtener el email del usuario del localStorage
                const getUserFromLocalStorage = () => {
                    try {
                        const userData = localStorage.getItem('user')
                        if (userData) {
                            const user = JSON.parse(userData)
                            return user?.email || null
                        }
                    } catch (error) {
                        console.warn(
                            'Error al obtener usuario del localStorage:',
                            error,
                        )
                    }
                    return null
                }

                const userEmail = getUserFromLocalStorage()

                if (!userEmail) {
                    throw new Error(
                        'No se encontró el email del usuario en localStorage',
                    )
                }

                const data = await fetchDataSetByEmail(userEmail)

                if (isMounted && data) {
                    setDatasets(data.datasets || [])
                    setCount(data.count || data.datasets?.length || 0)
                    setSelectedType(data.datasetType || 'all')
                }
            } catch (err: any) {
                if (isMounted) {
                    setError(err.message || 'Error desconocido')
                    console.error('Error al obtener datasets:', err)
                }
            } finally {
                if (isMounted) {
                    setLoading(false)
                }
            }
        }

        load()

        return () => {
            isMounted = false
        }
    }, [])

    return { datasets, loading, error, count, selectedType }
}
