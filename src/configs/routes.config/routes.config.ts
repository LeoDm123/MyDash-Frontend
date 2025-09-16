import { lazy } from 'react'
import authRoute from './authRoute'
import type { Routes } from '@/@types/routes'

export const publicRoutes: Routes = [...authRoute]

export const protectedRoutes = [
    {
        key: 'home',
        path: '/home',
        component: lazy(() => import('@/views/Home')),
        authority: [],
    },
    {
        key: 'cashflowDashboard',
        path: '/cashflowDashboard-view',
        component: lazy(() => import('@/views/demo/CashflowDashboard')),
        authority: [],
    },
    {
        key: 'userProfile',
        path: '/userProfile-view',
        component: lazy(() => import('@/views/demo/UserProfileView')),
        authority: [],
    },
]
