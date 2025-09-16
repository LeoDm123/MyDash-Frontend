export const FormatCurrency = (
    locale: string = 'es-AR',
    currency: string = 'ARS',
    minimumFractionDigits = 2,
) => {
    return (value: number) =>
        new Intl.NumberFormat(locale, {
            style: 'currency',
            currency,
            minimumFractionDigits,
        }).format(value)
}
