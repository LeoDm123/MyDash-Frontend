import '../ProfileView.css'
import { Avatar, Button } from '@/components/ui'

const UserAvatar = () => {
    return (
        <div className="avatar-name-container">
            <Avatar shape="circle" size="xxl" />
            <Button
                shape="round"
                variant="solid"
                style={{ backgroundColor: '#152e4d', marginTop: '20px' }}
            >
                Cambiar Imagen
            </Button>
            <div className="description-container">
                <p>JPG, GIF o PNG.</p>
                <p>1MB max.</p>
            </div>
        </div>
    )
}

export default UserAvatar
