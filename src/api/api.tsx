const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL as string
const AUTH_TOKEN: string | undefined = import.meta.env.VITE_AUTH_TOKEN as string

//AUTH SERVICES
export const fetchLoginUser = async (
    email: string,
    password: string,
): Promise<any> => {
    const LOGIN_ENDPOINT: string = '/auth/userLogin'

    try {
        const response = await fetch(`${API_BASE_URL}${LOGIN_ENDPOINT}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, password }),
        })

        if (!response.ok) {
            throw new Error(`Error al iniciar sesion: ${response.status}`)
        }

        const data = await response.json()
        return data
    } catch (error) {
        console.error('Error al iniciar sesion:', error)
        throw error
    }
}

//DATASET
export const createDataset = async (datasetData: {
    datasetName: string
    originalFileName?: string
    importedBy?: string
    currency?: string
    datasetType: string
    movements: Array<{
        fecha: string | Date
        categoria: any
        tipo: 'ingreso' | 'egreso'
        monto: number
        saldo?: number
        nota?: string
        source?: string
        externalId?: string
    }>
}): Promise<any> => {
    const CREATE_DATASET_ENDPOINT: string = '/dataSet/createDataset'

    try {
        const response = await fetch(
            `${API_BASE_URL}${CREATE_DATASET_ENDPOINT}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(AUTH_TOKEN
                        ? { Authorization: `Bearer ${AUTH_TOKEN}` }
                        : {}),
                },
                body: JSON.stringify(datasetData),
            },
        )

        if (!response.ok) {
            if (response.status === 400) {
                const errorData = await response.json()
                throw new Error(`Datos inválidos: ${errorData.msg}`)
            } else if (response.status === 409) {
                const errorData = await response.json()
                throw new Error(`Dataset duplicado: ${errorData.msg}`)
            } else {
                throw new Error(`Error al crear dataset: ${response.status}`)
            }
        }

        const data = await response.json()
        return data
    } catch (error) {
        console.error('Error en createDataset:', error)
        throw error
    }
}

export const addMovementsToDataset = async (
    datasetId: string,
    movements: Array<{
        fecha: string | Date
        categoria: any
        tipo: 'ingreso' | 'egreso'
        monto: number
        saldo?: number
        nota?: string
    }>,
): Promise<any> => {
    const ADD_MOVEMENTS_ENDPOINT: string = `/dataSet/addMovements/${datasetId}`

    try {
        const response = await fetch(
            `${API_BASE_URL}${ADD_MOVEMENTS_ENDPOINT}`,
            {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    ...(AUTH_TOKEN
                        ? { Authorization: `Bearer ${AUTH_TOKEN}` }
                        : {}),
                },
                body: JSON.stringify({
                    movements: movements.map((m) => ({
                        ...m,
                        fecha:
                            m.fecha instanceof Date
                                ? m.fecha.toISOString()
                                : m.fecha,
                    })),
                }),
            },
        )

        if (!response.ok) {
            // Manejar errores específicos basados en el status code
            if (response.status === 400) {
                const errorData = await response.json()
                throw new Error(`Datos inválidos: ${errorData.msg}`)
            } else if (response.status === 404) {
                throw new Error('Dataset no encontrado')
            } else {
                throw new Error(
                    `Error al agregar movimientos: ${response.status}`,
                )
            }
        }

        const data = await response.json()
        return data
    } catch (error) {
        console.error('Error en addMovementsToDataset:', error)
        throw error
    }
}

export const fetchDatasets = async (): Promise<any> => {
    const DATASETS_ENDPOINT: string = '/dataSet/getDatasets'

    try {
        const response = await fetch(`${API_BASE_URL}${DATASETS_ENDPOINT}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                ...(AUTH_TOKEN
                    ? { Authorization: `Bearer ${AUTH_TOKEN}` }
                    : {}),
            },
        })

        if (!response.ok) {
            throw new Error(`Error al obtener datasets: ${response.status}`)
        }

        const data = await response.json()
        return data
    } catch (error) {
        console.error('Error en fetchDatasets:', error)
        throw error
    }
}

export const fetchDataSetByEmail = async (email: string): Promise<any> => {
    const FETCH_DATASETS_BY_EMAIL_ENDPOINT: string = `/dataSet/getDatasetsByEmail/${email}`

    try {
        const response = await fetch(
            `${API_BASE_URL}${FETCH_DATASETS_BY_EMAIL_ENDPOINT}`,
            {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    ...(AUTH_TOKEN
                        ? { Authorization: `Bearer ${AUTH_TOKEN}` }
                        : {}),
                },
            },
        )

        if (!response.ok) {
            throw new Error(
                `Error al obtener datasets por email: ${response.status}`,
            )
        }

        const data = await response.json()
        return data
    } catch (error) {
        console.error('Error en fetchDataSetByEmail:', error)
        throw error
    }
}

export const getDatasetById = async (datasetId: string): Promise<any> => {
    const GET_DATASET_ENDPOINT: string = `/dataSet/getDatasetById/${datasetId}`

    try {
        const response = await fetch(`${API_BASE_URL}${GET_DATASET_ENDPOINT}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                ...(AUTH_TOKEN
                    ? { Authorization: `Bearer ${AUTH_TOKEN}` }
                    : {}),
            },
        })

        if (!response.ok) {
            // Manejar errores específicos basados en el status code
            if (response.status === 404) {
                throw new Error('Dataset no encontrado')
            } else {
                throw new Error(`Error al obtener dataset: ${response.status}`)
            }
        }

        const data = await response.json()
        return data
    } catch (error) {
        console.error('Error en getDatasetById:', error)
        throw error
    }
}

export const getDatasetByEmail = async (email: string): Promise<any> => {
    const GET_DATASET_ENDPOINT: string = `/dataSet//getDatasetsByEmail/${email}`

    try {
        const response = await fetch(`${API_BASE_URL}${GET_DATASET_ENDPOINT}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                ...(AUTH_TOKEN
                    ? { Authorization: `Bearer ${AUTH_TOKEN}` }
                    : {}),
            },
        })

        if (!response.ok) {
            // Manejar errores específicos basados en el status code
            if (response.status === 404) {
                throw new Error('Dataset no encontrado')
            } else {
                throw new Error(`Error al obtener dataset: ${response.status}`)
            }
        }

        const data = await response.json()
        return data
    } catch (error) {
        console.error('Error en getDatasetByEmail:', error)
        throw error
    }
}
