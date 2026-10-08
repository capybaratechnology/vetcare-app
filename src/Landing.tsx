import { useState, useEffect, useRef } from 'react';
import {
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  IconButton,
  Checkbox,
  FormControlLabel,
  Alert,
  Chip,
  CircularProgress,
} from '@mui/material';
import ArrowForward from '@mui/icons-material/ArrowForward';
import Close from '@mui/icons-material/Close';
import CheckCircleOutline from '@mui/icons-material/CheckCircleOutline';
import HealthAndSafetyOutlined from '@mui/icons-material/HealthAndSafetyOutlined';
import MedicalServicesOutlined from '@mui/icons-material/MedicalServicesOutlined';
import FavoriteBorder from '@mui/icons-material/FavoriteBorder';
import ChatBubbleOutline from '@mui/icons-material/ChatBubbleOutline';
import ArrowBack from '@mui/icons-material/ArrowBack';
import { supabase } from './data';
import { Brand, ClinicLogo, type Clinic } from './clinic';
import { ColorModeToggle } from './colorMode';
import {
  SERVICES,
  TIMEZONE,
  localDate,
  dateLabel,
  clock,
  validPhone,
  slotsForDay,
  hoursSummary,
  type Data,
  type Client,
  type Pet,
  type Appointment,
} from './domain';
declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, options: Record<string, unknown>) => string;
      remove: (id: string) => void;
      reset: (id: string) => void;
    };
  }
}
function Captcha({ onToken }: { onToken: (token: string) => void }) {
  const el = useRef<HTMLDivElement>(null);
  const callback = useRef(onToken);
  callback.current = onToken;
  useEffect(() => {
    let id: string | undefined;
    let alive = true;
    const render = () => {
      if (alive && el.current && window.turnstile && !id)
        id = window.turnstile.render(el.current, {
          sitekey: import.meta.env.VITE_TURNSTILE_SITE_KEY,
          callback: (token: string) => callback.current(token),
          'expired-callback': () => callback.current(''),
          'error-callback': () => callback.current(''),
        });
    };
    let script = document.querySelector<HTMLScriptElement>('#turnstile-sdk');
    if (!script) {
      script = document.createElement('script');
      script.id = 'turnstile-sdk';
      script.src =
        'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      document.head.appendChild(script);
    }
    script.addEventListener('load', render);
    render();
    return () => {
      alive = false;
      script?.removeEventListener('load', render);
      if (id) window.turnstile?.remove(id);
    };
  }, []);
  return <div ref={el} />;
}
type Props = {
  demo: boolean;
  clinic: Clinic;
  data: Data;
  navigate: (p: string) => void;
  onDemoBooking: (c: Client, p: Pet, a: Appointment) => void;
};
const prompts = [
  'Primero, ¿cuál es tu nombre?',
  '¿A qué número podemos contactarte?',
  'Cuéntame sobre tu mascota.',
  '¿Qué atención necesita?',
  'Elige el día y la hora de su visita.',
  'Revisa los datos antes de reservar.',
];
export default function Landing({
  demo,
  clinic,
  data,
  navigate,
  onDemoBooking,
}: Props) {
  const [open, setOpen] = useState(false),
    [step, setStep] = useState(0),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [result, setResult] = useState('');
  const [name, setName] = useState(''),
    [phone, setPhone] = useState(''),
    [petName, setPetName] = useState(''),
    [species, setSpecies] = useState('Perro'),
    [reason, setReason] = useState(SERVICES[0]),
    [day, setDay] = useState(localDate()),
    [slot, setSlot] = useState(''),
    [slots, setSlots] = useState<string[]>([]),
    [consent, setConsent] = useState(false),
    [token, setToken] = useState(''),
    [requestKey, setRequestKey] = useState(() => crypto.randomUUID()),
    [captchaVersion, setCaptchaVersion] = useState(0);
  useEffect(() => {
    if (!open || step !== 4 || !day) return;
    let alive = true;
    setBusy(true);
    setError('');
    setSlots([]);
    setSlot('');
    (async () => {
      try {
        if (demo) {
          if (alive)
            setSlots(
              slotsForDay(
                day,
                data.appointments
                  .filter((a) => a.status !== 'cancelled')
                  .map((a) => new Date(a.starts_at).toISOString()),
                clinic.hours,
              ),
            );
        } else {
          const { data: response, error } = await supabase!.functions.invoke(
            'public-booking',
            { body: { action: 'slots', day } },
          );
          if (error || response?.error)
            throw Error(
              response?.error ||
                'No pudimos consultar los horarios. Inténtalo de nuevo.',
            );
          if (alive)
            setSlots(
              response.slots.map((s: { starts_at: string }) => s.starts_at),
            );
        }
      } catch (e) {
        if (alive) setError((e as Error).message);
      } finally {
        if (alive) setBusy(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [day, step, open, demo, data.appointments]);
  function begin() {
    setOpen(true);
  }
  function next() {
    setError('');
    if (step === 0 && name.trim().length < 2) {
      setError('Escribe tu nombre completo.');
      return;
    }
    if (step === 1 && !validPhone(phone)) {
      setError('Incluye el código de país. Ejemplo: +51987654321');
      return;
    }
    if (step === 2 && !petName.trim()) {
      setError('Escribe el nombre de tu mascota.');
      return;
    }
    if (step === 4 && !slot) {
      setError('Selecciona un horario disponible.');
      return;
    }
    setStep((x) => x + 1);
  }
  async function book() {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      if (demo) {
        if (
          data.appointments.some(
            (a) =>
              a.status !== 'cancelled' &&
              new Date(a.starts_at).getTime() === new Date(slot).getTime(),
          )
        )
          throw Error('El horario se ocupó. Vuelve y elige otro.');
        const client: Client = {
          id: crypto.randomUUID(),
          name: name.trim(),
          phone,
          email: '',
          consent,
        };
        const pet: Pet = {
          id: crypto.randomUUID(),
          client_id: client.id,
          name: petName.trim(),
          species,
          breed: '',
          birth_date: null,
          sex: 'No registrado',
          weight: null,
          allergies: '',
        };
        const appointment: Appointment = {
          id: crypto.randomUUID(),
          pet_id: pet.id,
          starts_at: slot,
          reason,
          status: 'confirmed',
          source: 'web',
          reminder_state: 'pending',
        };
        onDemoBooking(client, pet, appointment);
        setResult(appointment.id);
      } else {
        const { data: response, error } = await supabase!.functions.invoke(
          'public-booking',
          {
            body: {
              action: 'book',
              key: requestKey,
              name: name.trim(),
              phone,
              pet: petName.trim(),
              species,
              reason,
              starts_at: slot,
              consent,
              token,
            },
          },
        );
        if (error || response?.error)
          throw Error(
            response?.error ||
              'No pudimos confirmar la reserva. Inténtalo otra vez.',
          );
        setResult(response.id);
      }
    } catch (e) {
      setError((e as Error).message);
      setToken('');
      setCaptchaVersion((v) => v + 1);
    } finally {
      setBusy(false);
    }
  }
  function reset() {
    setStep(0);
    setResult('');
    setName('');
    setPhone('');
    setPetName('');
    setSlot('');
    setConsent(false);
    setToken('');
    setRequestKey(crypto.randomUUID());
    setOpen(false);
    setError('');
  }
  return (
    <div className="landing">
      <nav className="landing-nav">
        <a className="brand" href="#landing">
          <Brand clinic={clinic} />
        </a>
        <div className="landing-links">
          <a
            href="#servicios"
            onClick={(e) => {
              e.preventDefault();
              document
                .getElementById('servicios')
                ?.scrollIntoView({ behavior: 'smooth' });
            }}
          >
            Nuestros cuidados
          </a>
          <ColorModeToggle />
          <Button onClick={() => navigate('login')}>Acceso del equipo</Button>
          <Button variant="contained" onClick={begin}>
            Reservar cita
          </Button>
        </div>
      </nav>
      {demo && (
        <div className="landing-demo">
          Demostración · Las reservas son de prueba y no se envían mensajes.
        </div>
      )}
      <section className="hero">
        <div className="hero-copy">
          <span className="hero-tag">
            <span className="dot" />
            CERCA DE TI. CERCA DE ELLOS.
          </span>
          <h1>
            Son familia.
            <br />
            Su cuidado,
            <br />
            <em>también lo es.</em>
          </h1>
          <p>
            Medicina veterinaria con atención cercana, desde su primera vacuna
            hasta cada nueva etapa de su vida.
          </p>
          <Button
            size="large"
            variant="contained"
            endIcon={<ArrowForward />}
            onClick={begin}
          >
            Agenda su próxima visita
          </Button>
          <div className="hero-caption">
            <CheckCircleOutline />
            Reserva en línea · Sin llamadas ni esperas
          </div>
        </div>
        <div className="hero-photo">
          <img
            src="/veterinaria.jpg"
            alt="Profesional veterinario abrazando con cariño a un perro en una consulta"
            width="1200"
            height="1350"
          />
          <div className="photo-note">
            <span className="pet-avatar">
              <FavoriteBorder />
            </span>
            <div>
              <b>Atención con cariño</b>
              <small>En cada etapa de su vida</small>
            </div>
          </div>
        </div>
      </section>
      <section className="services-section" id="servicios">
        <div className="section-heading">
          <div>
            <p className="eyebrow">BIENESTAR EN CADA ETAPA</p>
            <h2>Todo comienza con un buen cuidado.</h2>
          </div>
          <span className="muted">Para perros, gatos y sus familias.</span>
        </div>
        <div className="services-grid">
          {[
            {
              Icon: MedicalServicesOutlined,
              title: 'Consultas veterinarias',
              text: 'Evaluación clínica, orientación y seguimiento de su salud.',
            },
            {
              Icon: HealthAndSafetyOutlined,
              title: 'Vacunas y prevención',
              text: 'Un registro de sus vacunas y próximos controles.',
            },
            {
              Icon: FavoriteBorder,
              title: 'Tratamientos y controles',
              text: 'Continuidad en cada tratamiento, con su historia siempre a mano.',
            },
          ].map(({ Icon, title, text }) => (
            <article key={title}>
              <Icon />
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="booking-banner">
        <div>
          <h2>Su próxima visita empieza aquí.</h2>
          <p>Nuestro asistente te ayuda a encontrar un horario, paso a paso.</p>
        </div>
        <Button
          variant="contained"
          color="secondary"
          startIcon={<ChatBubbleOutline />}
          onClick={begin}
        >
          Conversar y reservar
        </Button>
      </section>
      <footer className="landing-footer">
        <div className="brand">
          <Brand clinic={clinic} />
        </div>
        {clinic.address && <span>{clinic.address}</span>}
        <span>
          {hoursSummary(clinic.hours)} · {TIMEZONE}
        </span>
        <small>Foto: Mikhail Nilov / Pexels</small>
      </footer>
      <button
        className="chat-fab"
        onClick={begin}
        aria-label="Abrir asistente de citas"
      >
        <ChatBubbleOutline /> Agenda una visita
      </button>
      <Dialog
        open={open}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle className="chat-title">
          <span className="pet-avatar">
            <ClinicLogo clinic={clinic} />
          </span>
          <div>
            Asistente {clinic.name}<small>Reservas paso a paso</small>
          </div>
          <IconButton
            aria-label="Cerrar asistente"
            onClick={() => setOpen(false)}
            disabled={busy}
          >
            <Close />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          {result ? (
            <div className="booking-success">
              <CheckCircleOutline color="primary" sx={{ fontSize: 60 }} />
              <h2>
                {demo
                  ? 'Reserva de prueba registrada'
                  : 'Tu cita está confirmada'}
              </h2>
              <p>
                {petName} · {reason}
              </p>
              <b>
                {dateLabel(slot)} · {clock(slot)}
              </b>
              <small>Código: {result.slice(0, 8).toUpperCase()}</small>
              <Alert severity={demo ? 'warning' : 'success'}>
                {demo
                  ? 'Puedes verla en el panel. Se borrará al recargar; no se enviará WhatsApp.'
                  : consent
                    ? 'Intentaremos enviar un recordatorio por WhatsApp una hora antes de la cita.'
                    : 'Tu reserva está confirmada. No se enviará recordatorio por WhatsApp.'}
              </Alert>
            </div>
          ) : (
            <>
              <div className="chat-progress">
                Paso {step + 1} de 6{' '}
                <span>
                  {
                    [
                      'Tus datos',
                      'Contacto',
                      'Tu mascota',
                      'Atención',
                      'Horario',
                      'Confirmación',
                    ][step]
                  }
                </span>
              </div>
              <div className="chat-bubble">
                ¡
                {step === 0
                  ? 'Hola! Soy el asistente de citas de ' + clinic.name + '. '
                  : ''}
                {prompts[step]}
              </div>
              <div className="form-grid">
                {step === 0 && (
                  <TextField
                    autoFocus
                    label="Tu nombre completo"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    slotProps={{ htmlInput: { maxLength: 120 } }}
                  />
                )}
                {step === 1 && (
                  <>
                    <TextField
                      autoFocus
                      type="tel"
                      label="Número de teléfono"
                      placeholder="+51987654321"
                      value={phone}
                      onChange={(e) =>
                        setPhone(e.target.value.replace(/\s/g, ''))
                      }
                      slotProps={{ htmlInput: { maxLength: 16 } }}
                    />
                    <p className="muted">Incluye + y el código de país.</p>
                  </>
                )}
                {step === 2 && (
                  <>
                    <TextField
                      label="Nombre de tu mascota"
                      value={petName}
                      onChange={(e) => setPetName(e.target.value)}
                      slotProps={{ htmlInput: { maxLength: 100 } }}
                    />
                    <TextField
                      select
                      label="Especie"
                      value={species}
                      onChange={(e) => setSpecies(e.target.value)}
                    >
                      {['Perro', 'Gato', 'Otro'].map((s) => (
                        <MenuItem key={s} value={s}>
                          {s}
                        </MenuItem>
                      ))}
                    </TextField>
                  </>
                )}
                {step === 3 && (
                  <div className="service-options">
                    {SERVICES.map((s) => (
                      <Button
                        key={s}
                        variant={reason === s ? 'contained' : 'outlined'}
                        onClick={() => setReason(s)}
                      >
                        {s}
                      </Button>
                    ))}
                  </div>
                )}
                {step === 4 && (
                  <>
                    <TextField
                      label="Fecha de la visita"
                      type="date"
                      value={day}
                      onChange={(e) => setDay(e.target.value)}
                      slotProps={{
                        inputLabel: { shrink: true },
                        htmlInput: {
                          min: localDate(),
                          max: localDate(new Date(Date.now() + 59 * 86400000)),
                        },
                      }}
                    />
                    <small>
                      Horarios de {TIMEZONE}. Reservas con al menos 2 horas de
                      anticipación.
                    </small>
                    {busy ? (
                      <CircularProgress size={24} />
                    ) : (
                      <div className="slots">
                        {slots.map((s) => (
                          <Button
                            key={s}
                            variant={slot === s ? 'contained' : 'outlined'}
                            onClick={() => setSlot(s)}
                          >
                            {clock(s)}
                          </Button>
                        ))}
                      </div>
                    )}
                    {!busy && !slots.length && (
                      <Alert severity="info">
                        No hay horarios disponibles ese día. Selecciona otro.
                        Atendemos: {hoursSummary(clinic.hours)}.
                      </Alert>
                    )}
                  </>
                )}
                {step === 5 && (
                  <>
                    <div className="booking-summary">
                      <p>
                        <span>Responsable</span>
                        <b>{name}</b>
                      </p>
                      <p>
                        <span>Teléfono</span>
                        <b>{phone}</b>
                      </p>
                      <p>
                        <span>Paciente</span>
                        <b>
                          {petName} · {species}
                        </b>
                      </p>
                      <p>
                        <span>Atención</span>
                        <b>{reason}</b>
                      </p>
                      <p>
                        <span>Fecha y hora</span>
                        <b>
                          {dateLabel(slot)} · {clock(slot)}
                        </b>
                      </p>
                    </div>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={consent}
                          onChange={(e) => setConsent(e.target.checked)}
                        />
                      }
                      label="Autorizo recibir un recordatorio de esta cita por WhatsApp una hora antes."
                    />
                    <small>
                      Usaremos estos datos para gestionar tu cita y crear tu
                      ficha de cliente y mascota. Para cambiar o cancelar la
                      cita, contacta al equipo de la clínica.
                    </small>
                    {!demo &&
                      (import.meta.env.VITE_TURNSTILE_SITE_KEY ? (
                        <Captcha key={captchaVersion} onToken={setToken} />
                      ) : (
                        <Alert severity="warning">
                          Las reservas en línea aún requieren activar la
                          verificación de seguridad. Contacta al equipo.
                        </Alert>
                      ))}
                  </>
                )}
                {error && <Alert severity="error">{error}</Alert>}
              </div>
            </>
          )}
        </DialogContent>
        <DialogActions>
          {result ? (
            <>
              <Button
                onClick={() => {
                  setOpen(false);
                  navigate('Citas');
                }}
              >
                {demo ? 'Ver en el panel' : 'Acceso del equipo'}
              </Button>
              <Button variant="contained" onClick={reset}>
                Listo
              </Button>
            </>
          ) : (
            <>
              {step > 0 && (
                <Button
                  startIcon={<ArrowBack />}
                  onClick={() => {
                    setError('');
                    setStep((s) => s - 1);
                  }}
                  disabled={busy}
                >
                  Atrás
                </Button>
              )}
              {step < 5 ? (
                <Button
                  variant="contained"
                  endIcon={<ArrowForward />}
                  onClick={next}
                  disabled={busy}
                >
                  Continuar
                </Button>
              ) : (
                <Button
                  variant="contained"
                  onClick={book}
                  disabled={busy || (!demo && !token)}
                >
                  {busy
                    ? 'Confirmando…'
                    : demo
                      ? 'Confirmar reserva de prueba'
                      : 'Confirmar mi cita'}
                </Button>
              )}
            </>
          )}
        </DialogActions>
      </Dialog>
    </div>
  );
}
