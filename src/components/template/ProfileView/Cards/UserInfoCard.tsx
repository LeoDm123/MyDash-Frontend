import { Avatar, Input, InputGroup } from '@/components/ui'
import '../ProfileView.css'
import UserInfoForm from '../Forms/UserInfoForm'
import ChangePassForm from '../Forms/ChangePassForm'
import UserAvatar from '../Avatar/UserAvatar'

const UserInfoCard = () => {
    const LOCAL_STORAGE_USER_KEY: string = 'user'
    const storedUser: any = JSON.parse(
        localStorage.getItem(LOCAL_STORAGE_USER_KEY) || '',
    )

    return (
        <div className="column-container" style={{ alignItems: 'flex-start' }}>
            <div className="avatar-name-container">
                <UserAvatar />
            </div>
            <div className="userInfo-container">
                <UserInfoForm />
            </div>
            <div className="userPass-container">
                <ChangePassForm />
            </div>
        </div>
    )
}

export default UserInfoCard
