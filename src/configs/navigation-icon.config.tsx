import {
    HiOutlineSwatch,
    HiOutlineComputerDesktop,
    HiOutlineQueueList,
    HiOutlineSquaresPlus,
    HiOutlineHome,
    HiOutlineAdjustmentsVertical,
    HiOutlineFunnel,
    HiOutlinePresentationChartBar,
    HiOutlineMagnifyingGlass,
} from 'react-icons/hi2'

export type NavigationIcons = Record<string, JSX.Element>

const navigationIcon: NavigationIcons = {
    home: <HiOutlineHome />,
    singleMenu: <HiOutlineSquaresPlus />,
    cashflowDashboard: <HiOutlinePresentationChartBar />,
    collapseMenu: <HiOutlineQueueList />,
    groupSingleMenu: <HiOutlineComputerDesktop />,
    groupCollapseMenu: <HiOutlineSwatch />,
    settings: <HiOutlineAdjustmentsVertical />,
    filter: <HiOutlineFunnel />,
    search: <HiOutlineMagnifyingGlass />,
}

export default navigationIcon
