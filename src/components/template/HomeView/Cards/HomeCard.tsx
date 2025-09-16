import React, { useState } from 'react'
import { forwardRef } from 'react'
import classNames from 'classnames'
import { useConfig } from '../../../ui/ConfigProvider'
import type { CommonProps } from '../../../ui/@types/common'
import type { ReactNode, ComponentPropsWithRef, MouseEvent } from 'react'
import '../HomeView.css'

export interface CardProps
    extends CommonProps,
        Omit<ComponentPropsWithRef<'div'>, 'onClick'> {
    clickable?: boolean
    bodyClass?: string
    bordered?: boolean
    header?: string | ReactNode
    headerClass?: string
    headerBorder?: boolean
    headerExtra?: string | ReactNode
    footer?: string | ReactNode
    footerClass?: string
    footerBorder?: boolean
    onClick?: (e: MouseEvent<HTMLDivElement>) => void
    colorLevel?: string
}

const HomeCard = forwardRef<HTMLDivElement, CardProps>((props, ref) => {
    const { cardBordered } = useConfig()

    const {
        children,
        className,
        clickable = false,
        bodyClass,
        bordered = cardBordered || false,
        header,
        headerClass,
        headerBorder = true,
        headerExtra,
        footer,
        footerClass,
        footerBorder = true,
        onClick,
        colorLevel,
        ...rest
    } = props

    const cardClass = classNames(
        'card',
        className,
        bordered ? `card-border` : `card-shadow`,
        clickable && 'cursor-pointer user-select-none',
    )

    const cardBodyClasss = classNames('card-body', bodyClass)
    const cardHeaderClass = classNames(
        'card-header',
        headerExtra && 'card-header-extra',
        headerClass,
    )
    const cardFooterClass = classNames(
        'card-footer',
        footerBorder && `card-footer-border`,
        footerClass,
    )

    const renderHeader = () => {
        if (typeof header === 'string') {
            return (
                <h4
                    style={{
                        color: ' #fff',
                    }}
                >
                    {header}
                </h4>
            )
        }
        return <>{header}</>
    }

    const handleClick = (e: MouseEvent<HTMLDivElement>) => {
        onClick?.(e)
    }

    return (
        <div
            ref={ref}
            className={`hv-card-${colorLevel}`}
            role="presentation"
            onClick={handleClick}
            {...rest}
        >
            {header && (
                <div className={cardHeaderClass}>
                    {renderHeader()}
                    {headerExtra && <span>{headerExtra}</span>}
                </div>
            )}
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                }}
            >
                <div className={cardBodyClasss} style={{ fontSize: 'large' }}>
                    {children}
                </div>
            </div>
            {footer && <div className={cardFooterClass}>{footer}</div>}
        </div>
    )
})

HomeCard.displayName = 'HomeCard'

export default HomeCard
