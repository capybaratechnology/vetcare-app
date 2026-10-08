import { useState } from 'react';
import {
  Alert,
  Button,
  TextField,
  IconButton,
  InputAdornment,
} from '@mui/material';
import ArrowBack from '@mui/icons-material/ArrowBack';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import LockOutlined from '@mui/icons-material/LockOutlined';
import { DEMO_PASSWORD, ROLES } from './access';
import { Brand, type Clinic } from './clinic';
import { ColorModeToggle } from './colorMode';
export default function Login({
  demo,
  clinic,
  onLogin,
  onBack,
}: {
  demo: boolean;
  clinic: Clinic;
  onLogin: (email: string, password: string) => Promise<void>;
  onBack: () => void;
}) {
  const [email, setEmail] = useState(''),
    [password, setPassword] = useState(''),
    [show, setShow] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  return (
    <div className="login-screen">
      <div className="login-story">
        <div className="brand">
          <Brand clinic={clinic} />
        </div>
        <div>
          <p className="eyebrow">EL CUIDADO EMPIEZA CON TU EQUIPO</p>
          <h1>
            Un espacio para
            <br />
            cuidar mejor.
          </h1>
          <p>
            Tu agenda, tus pacientes y sus historias.
            <br />
            Cada persona, con el acceso que necesita.
          </p>
        </div>
        <small>{clinic.name} · Cuidado que acompaña</small>
      </div>
      <div className="login-form-side">
        <div className="login-top">
          <Button
            className="login-back"
            startIcon={<ArrowBack />}
            onClick={onBack}
          >
            Volver a la landing
          </Button>
          <ColorModeToggle />
        </div>
        <div className="login-form-card">
          <span className="pet-avatar">
            <LockOutlined />
          </span>
          <h1>Inicia sesión</h1>
          <p className="muted">
            Ingresa con la cuenta asignada por tu administrador.
          </p>
          <form
            className="form-grid"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError('');
              try {
                await onLogin(email.trim(), password);
                setPassword('');
              } catch (e) {
                setError(
                  e instanceof Error ? e.message : 'No pudimos iniciar sesión.',
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            <TextField
              label="Correo electrónico"
              type="email"
              required
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <TextField
              label="Contraseña"
              type={show ? 'text' : 'password'}
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              slotProps={{
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        edge="end"
                        aria-label={
                          show ? 'Ocultar contraseña' : 'Mostrar contraseña'
                        }
                        onClick={() => setShow(!show)}
                      >
                        {show ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
            />
            {error && <Alert severity="error">{error}</Alert>}
            <Button variant="contained" type="submit" disabled={busy}>
              {busy ? 'Verificando acceso…' : 'Ingresar al sistema'}
            </Button>
          </form>
          {demo && (
            <div className="demo-login">
              <b>Accesos de demostración</b>
              <p>
                Datos ficticios. Los cambios y la sesión se borran al recargar.
              </p>
              {ROLES.map((r) => (
                <button
                  key={r.value}
                  onClick={() => {
                    setEmail(r.value + '@vetcare.demo');
                    setPassword(DEMO_PASSWORD);
                    setError('');
                  }}
                >
                  <span>{r.label}</span>
                  <small>{r.value}@vetcare.demo</small>
                </button>
              ))}
              <small>
                Contraseña de prueba: <strong>{DEMO_PASSWORD}</strong>
              </small>
            </div>
          )}
          <p className="login-help">
            ¿Necesitas acceso? Solicita una cuenta al administrador de tu
            clínica.
          </p>
        </div>
      </div>
    </div>
  );
}
