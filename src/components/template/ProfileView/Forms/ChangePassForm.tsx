import TextField from '@mui/material/TextField'
import '../ProfileView.css'
import { Button } from '@/components/ui'

const ChangePassForm = () => {
    return (
        <div>
            <h4>Cambiar Contraseña</h4>
            <div className="form-field">
                <TextField
                    fullWidth
                    value=""
                    id="outlined-multiline-static"
                    label="Contraseña Actual"
                />
            </div>
            <div className="form-field">
                <TextField
                    fullWidth
                    id="outlined-multiline-static"
                    label="Nueva Contraseña"
                />
            </div>
            <div className="form-field">
                <TextField
                    fullWidth
                    id="outlined-multiline-static"
                    label="Repetir Nueva Contraseña"
                />
            </div>

            <div className="save-button">
                <Button
                    shape="round"
                    variant="solid"
                    style={{ backgroundColor: '#152e4d' }}
                >
                    Guardar Nueva Contraseña
                </Button>
            </div>
        </div>
    )
}

export default ChangePassForm
