import React from 'react'

interface PercentageIndicatorProps {
    value: number
    isPositive?: boolean
    className?: string
}

const PercentageIndicator: React.FC<PercentageIndicatorProps> = ({
    value,
    isPositive = true,
    className = '',
}) => {
    const isPositiveValue = value >= 0
    const shouldShowPositive = isPositive ? isPositiveValue : !isPositiveValue

    return (
        <div
            className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium shadow-sm ${className}`}
            style={{
                backgroundColor: shouldShowPositive ? '#b5ecc8' : '#ecb4b4',
                color: shouldShowPositive ? '#16a34a' : '#dc2626',
            }}
        >
            {/* Triángulo indicador */}
            <div
                className={`w-0 h-0 ${
                    shouldShowPositive
                        ? 'border-l-[5px] border-r-[5px] border-b-[8px] border-l-transparent border-r-transparent border-b-current'
                        : 'border-l-[5px] border-r-[5px] border-t-[8px] border-l-transparent border-r-transparent border-t-current'
                }`}
            />
            <span>
                {isPositiveValue ? '+' : ''}
                {Math.abs(value).toFixed(1)}%
            </span>
        </div>
    )
}

export default PercentageIndicator
