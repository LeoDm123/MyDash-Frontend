// types/cashflow.ts
export interface Categoria {
    grupo: string
    subgrupo: string | null
}

export interface Movimiento {
    fecha: string // ISO (ej. "2024-06-15")
    tipo: 'ingreso' | 'egreso'
    monto: number // positivo (ya normalizado)
    categoria: Categoria
    saldo?: number | null
    nota?: string
}

export interface Dataset {
    _id: string
    datasetName: string
    currency: string // "ARS" por defecto
    periodStart: string // ISO date
    periodEnd: string // ISO date
    movements: Movimiento[]
}
