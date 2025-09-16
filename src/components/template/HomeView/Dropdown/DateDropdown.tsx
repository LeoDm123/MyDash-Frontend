import React, { useState } from 'react'
import { HiOutlineCalendar } from 'react-icons/hi'
import ChartDropdown from '../Dropdown/ChartDropdown'
import DropdownItem from '../Dropdown/DropdownItem'

const DateDropdown: React.FC<{
    onSelectedValueChange: (value: string) => void
}> = ({ onSelectedValueChange }) => {
    const [selectedValue, setSelectedValue] = useState<string>('day')

    const handleSelectedValueChange = (value: any) => {
        setSelectedValue(value)
        onSelectedValueChange(value)
    }

    const valueLabels: { [key: string]: string } = {
        day: 'Hoy',
        yesterday: 'Ayer',
        week: 'Últimos 7 días',
        month: 'Último mes',
    }

    const renderTitle = () => (
        <div style={{ display: 'flex', alignItems: 'center' }}>
            <HiOutlineCalendar size={'30px'} />
            <h5>{valueLabels[selectedValue]}</h5>
        </div>
    )

    return (
        <div>
            <ChartDropdown
                title={renderTitle()}
                selectedvalue={selectedValue}
                onSelectedValueChange={handleSelectedValueChange}
            >
                <DropdownItem eventKey="day">Hoy</DropdownItem>
                <DropdownItem eventKey="yesterday">Ayer</DropdownItem>
                <DropdownItem eventKey="week">Últimos 7 días</DropdownItem>
                <DropdownItem eventKey="month">Último mes</DropdownItem>
            </ChartDropdown>
        </div>
    )
}

export default DateDropdown
