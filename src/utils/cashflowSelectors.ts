import { Dataset, Movimiento } from '@/@types/cashflow'

const toDate = (value: string): Date => {
    if (!value) return new Date(NaN)
    // Admite 'DD/MM/AA' o 'DD/MM/AAAA'
    if (typeof value === 'string' && value.includes('/')) {
        const parts = value.split('/')
        if (parts.length === 3) {
            const [dd, mm, yy] = parts
            const year = yy.length === 2 ? Number(yy) + 2000 : Number(yy)
            const month = Number(mm)
            const day = Number(dd)
            if (
                Number.isFinite(year) &&
                Number.isFinite(month) &&
                Number.isFinite(day)
            ) {
                return new Date(Date.UTC(year, month - 1, day))
            }
        }
    }
    // Fallback: intentar parsear directamente
    const d = new Date(value)
    return d
}

// clave AAAA-MM
const ymKey = (d: Date) =>
    `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
// clave AAAA-MM-DD
const ymdKey = (d: Date) =>
    `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`

export function groupByMonth(movs: Movimiento[]) {
    const map = new Map<string, { ingresos: number; egresos: number }>()
    for (const m of movs) {
        const k = ymKey(toDate(m.fecha))
        const acc = map.get(k) ?? { ingresos: 0, egresos: 0 }
        if (m.tipo === 'ingreso') acc.ingresos += m.monto
        else acc.egresos += m.monto
        map.set(k, acc)
    }
    // salida ordenada por mes asc
    return [...map.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, v]) => ({ month, ...v, neto: v.ingresos - v.egresos }))
}

/** Agrupa por día (AAAA-MM-DD) sumando ingresos y egresos */
export function groupByDay(movs: Movimiento[]) {
    const map = new Map<string, { ingresos: number; egresos: number }>()
    for (const m of movs) {
        const k = ymdKey(toDate(m.fecha))
        const acc = map.get(k) ?? { ingresos: 0, egresos: 0 }
        if (m.tipo === 'ingreso') acc.ingresos += m.monto
        else acc.egresos += m.monto
        map.set(k, acc)
    }
    return [...map.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, v]) => ({ date, ...v, neto: v.ingresos - v.egresos }))
}

/**
 * Devuelve dos arreglos por separado, uno con ingresos por mes y otro con egresos por mes.
 * Cada arreglo contiene objetos { month: 'AAAA-MM', monto: number } ordenados ascendentemente por mes.
 */
export function groupByMonthSeparated(movs: Movimiento[]) {
    const map = new Map<string, { ingresos: number; egresos: number }>()
    for (const m of movs) {
        const k = ymKey(toDate(m.fecha))
        const acc = map.get(k) ?? { ingresos: 0, egresos: 0 }
        if (m.tipo === 'ingreso') acc.ingresos += m.monto
        else acc.egresos += m.monto
        map.set(k, acc)
    }

    const sorted = [...map.entries()].sort(([a], [b]) => a.localeCompare(b))

    const ingresos = sorted.map(([month, v]) => ({ month, monto: v.ingresos }))
    const egresos = sorted.map(([month, v]) => ({ month, monto: v.egresos }))

    return { ingresos, egresos }
}

export function gastosPorCategoria(movs: Movimiento[]) {
    const map = new Map<string, number>()
    let totalGastos = 0
    for (const m of movs) {
        if (m.tipo !== 'egreso') continue
        totalGastos += m.monto
        const k = (m.categoria?.grupo || 'SinClasificar').trim()
        map.set(k, (map.get(k) ?? 0) + m.monto)
    }
    const items = [...map.entries()]
        .map(([categoria, monto]) => ({
            categoria,
            monto,
            pct: totalGastos > 0 ? (monto / totalGastos) * 100 : 0,
        }))
        .sort((a, b) => b.monto - a.monto)
    return { items, totalGastos }
}

/**
 * Estructura de dos niveles para gráfico de torta anidado:
 * - categories: resumen por categoría (inner ring)
 * - subcategories: detalle por subcategoría (outer ring), con categoría padre en `parent`
 */
export function gastosPorCategoriaYSubcategoria(movs: Movimiento[]) {
    type Totals = { monto: number }
    const catMap = new Map<string, Totals>()
    const subMap = new Map<string, Totals>() // key: `${categoria}||${subcategoria}`
    let totalGastos = 0

    for (const m of movs) {
        if (m.tipo !== 'egreso') continue
        totalGastos += m.monto
        const categoria = (m.categoria?.grupo || 'SinClasificar').trim()
        const subcategoria = (m.categoria?.subgrupo || 'Otros').trim()

        const cat = catMap.get(categoria) ?? { monto: 0 }
        cat.monto += m.monto
        catMap.set(categoria, cat)

        const subKey = `${categoria}||${subcategoria}`
        const sub = subMap.get(subKey) ?? { monto: 0 }
        sub.monto += m.monto
        subMap.set(subKey, sub)
    }

    const categories = [...catMap.entries()]
        .map(([categoria, t]) => ({
            categoria,
            monto: t.monto,
            pct: totalGastos > 0 ? (t.monto / totalGastos) * 100 : 0,
        }))
        .sort((a, b) => b.monto - a.monto)

    const subcategories = [...subMap.entries()]
        .map(([key, t]) => {
            const [categoria, subcategoria] = key.split('||')
            return {
                categoria,
                subcategoria,
                monto: t.monto,
                pct: totalGastos > 0 ? (t.monto / totalGastos) * 100 : 0,
            }
        })
        .sort((a, b) => b.monto - a.monto)

    return { categories, subcategories, totalGastos }
}

export function ingresosGastosTotals(movs: Movimiento[]) {
    let ingresos = 0,
        egresos = 0
    for (const m of movs)
        m.tipo === 'ingreso' ? (ingresos += m.monto) : (egresos += m.monto)
    return {
        ingresos,
        egresos,
        ratioPct: egresos > 0 ? (ingresos / egresos) * 100 : 0,
    }
}

/**
 * Evolución de saldo diario.
 * Si el dataset no trae saldo por movimiento, lo calculamos acumulando:
 * saldo_día = saldo_día_anterior + (ingresos - egresos) del día
 */
export function saldoDiario(movs: Movimiento[], saldoInicial = 0) {
    const dayMap = new Map<string, { delta: number }>()
    for (const m of movs) {
        const k = ymdKey(toDate(m.fecha))
        const acc = dayMap.get(k) ?? { delta: 0 }
        acc.delta += m.tipo === 'ingreso' ? m.monto : -m.monto
        dayMap.set(k, acc)
    }
    const days = [...dayMap.entries()].sort(([a], [b]) => a.localeCompare(b))
    const out: { date: string; saldo: number; delta: number }[] = []
    let running = saldoInicial
    for (const [date, { delta }] of days) {
        running += delta
        out.push({ date, saldo: running, delta })
    }
    return out
}

/** Promedio de movimientos diarios: totalMovimientos / díasConMovs */
export function promedioMovimientosDiarios(movs: Movimiento[]) {
    const daySet = new Set<string>()
    for (const m of movs) daySet.add(ymdKey(toDate(m.fecha)))
    const dias = daySet.size
    const total = movs.length
    return {
        promedio: dias > 0 ? total / dias : 0,
        diasConMovimientos: dias,
        totalMovimientos: total,
    }
}
