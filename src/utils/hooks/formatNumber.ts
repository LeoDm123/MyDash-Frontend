import { useState } from 'react'

export function FormatNumber(decimales: number = 0) {
    const formatNumber = (numero: number): string => {
        const options = {
            minimumFractionDigits: decimales,
            maximumFractionDigits: decimales,
        }
        return numero.toLocaleString('es-AR', options)
    }

    return { formatNumber }
}
