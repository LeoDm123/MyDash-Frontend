import React from 'react'
import PaymentsChart from './PaymentsChart'

interface ChartsStackProps {
    selectedValue: string
}

const ChartsStack: React.FC<ChartsStackProps> = ({ selectedValue }) => {
    return (
        <div>
            <PaymentsChart onSelectedValue={selectedValue} />
        </div>
    )
}

export default ChartsStack
