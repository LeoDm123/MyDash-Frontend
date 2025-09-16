import TextField from '@mui/material/TextField'
import '../ProfileView.css'
import { Button } from '@/components/ui'

const UserInfoForm = () => {
    const LOCAL_STORAGE_USER_KEY: string = 'user'
    const storedUser: any = JSON.parse(
        localStorage.getItem(LOCAL_STORAGE_USER_KEY) || '',
    )

    return (
        <div>
            <h4>Datos personales</h4>
            <div className="form-field">
                <TextField
                    fullWidth
                    value={storedUser.name || ''}
                    id="outlined-multiline-static"
                    label="Nombre y Apellido"
                />
            </div>
            <div className="form-field">
                <TextField
                    fullWidth
                    value={storedUser.email || ''}
                    id="outlined-multiline-static"
                    label="Correo Electrónico"
                />
            </div>
            <div className="form-field">
                <TextField
                    fullWidth
                    id="outlined-multiline-static"
                    label="Usuario"
                />
            </div>
            <div className="form-line">
                <TextField
                    style={{ marginRight: '10px' }}
                    fullWidth
                    id="outlined-multiline-static"
                    label="Trabajo/Puesto"
                />
                <TextField
                    fullWidth
                    id="outlined-multiline-static"
                    label="Compañía"
                />
            </div>
            <div className="save-button">
                <Button
                    shape="round"
                    variant="solid"
                    style={{ backgroundColor: '#152e4d' }}
                >
                    Guardar Datos
                </Button>
            </div>
        </div>
    )
}

export default UserInfoForm
