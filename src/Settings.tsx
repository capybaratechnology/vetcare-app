import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Button,
  Checkbox,
  FormControlLabel,
  MenuItem,
  Snackbar,
  TextField,
} from '@mui/material';
import { supabase } from './data';
import { ClinicLogo, type Clinic } from './clinic';
import { DAY_NAMES, HALF_HOURS, hoursSummary, type Hours } from './domain';
const LOGO_TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};
const BUCKET = 'clinic-assets';
export default function Settings({
  demo,
  clinic,
  onChange,
}: {
  demo: boolean;
  clinic: Clinic;
  onChange: (clinic: Clinic) => void;
}) {
  const [name, setName] = useState(clinic.name),
    [address, setAddress] = useState(clinic.address),
    [hours, setHours] = useState<Hours>(clinic.hours),
    [logo, setLogo] = useState<File | null>(null),
    [preview, setPreview] = useState(clinic.logo_url),
    [removeLogo, setRemoveLogo] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  const blob = useRef('');
  // Release the last local preview on unmount, unless demo mode kept it as the logo.
  useEffect(
    () => () => {
      if (blob.current && !demo) URL.revokeObjectURL(blob.current);
    },
    [demo],
  );
  function pick(file?: File) {
    setError('');
    if (!file) return;
    if (!LOGO_TYPES[file.type])
      return setError('El logo debe ser una imagen PNG, JPG o WebP.');
    if (file.size > 1024 * 1024)
      return setError('El logo no puede superar 1 MB.');
    if (blob.current && !demo) URL.revokeObjectURL(blob.current);
    blob.current = URL.createObjectURL(file);
    setPreview(blob.current);
    setLogo(file);
    setRemoveLogo(false);
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const next = { name: name.trim(), address: address.trim() };
    if (next.name.length < 2 || next.name.length > 80)
      return setError('El nombre debe tener entre 2 y 80 caracteres.');
    if (next.address.length > 200)
      return setError('La dirección no puede superar 200 caracteres.');
    const wrong = hours.findIndex((h) => h && h.open >= h.close);
    if (wrong >= 0)
      return setError(
        DAY_NAMES[wrong] + ': la hora de cierre debe ser posterior a la de apertura.',
      );
    // Only send hours when they changed, so the form still works before the hours migration.
    const hoursChanged = JSON.stringify(hours) !== JSON.stringify(clinic.hours);
    setBusy(true);
    try {
      let logo_url = removeLogo ? null : clinic.logo_url;
      if (demo) {
        // Demo mode keeps the logo in memory only; it disappears on reload.
        if (logo) logo_url = preview;
      } else {
        if (logo) {
          // A new file name per upload avoids stale cached logos.
          const path = 'logo-' + Date.now() + '.' + LOGO_TYPES[logo.type];
          const { error: uploadError } = await supabase!.storage
            .from(BUCKET)
            .upload(path, logo, { contentType: logo.type });
          if (uploadError)
            throw Error('No se pudo subir el logo: ' + uploadError.message);
          logo_url = supabase!.storage.from(BUCKET).getPublicUrl(path)
            .data.publicUrl;
        }
        const { error: saveError } = await supabase!
          .from('clinic_settings')
          .update({ ...next, logo_url, ...(hoursChanged ? { hours } : {}) })
          .eq('id', true);
        if (saveError)
          throw Error(
            saveError.code === '42501'
              ? 'Solo un administrador puede cambiar los datos de la clínica.'
              : 'No se pudieron guardar los cambios: ' + saveError.message,
          );
        const previous = clinic.logo_url?.split('/' + BUCKET + '/')[1];
        if (previous && clinic.logo_url !== logo_url)
          await supabase!.storage.from(BUCKET).remove([previous]);
      }
      onChange({ ...next, logo_url, hours });
      setLogo(null);
      setRemoveLogo(false);
      setPreview(logo_url);
      setNotice('Datos de la clínica actualizados.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel settings-panel">
      <form onSubmit={save}>
        <div className="settings-logo">
          <span className="clinic-icon settings-logo-preview">
            <ClinicLogo
              clinic={{ ...clinic, logo_url: removeLogo ? null : preview }}
            />
          </span>
          <div>
            <b>Logo</b>
            <p className="muted">PNG, JPG o WebP, hasta 1 MB. Mejor si es cuadrado.</p>
            <Button component="label" disabled={busy}>
              Elegir imagen
              <input
                hidden
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => {
                  pick(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
            </Button>
            {(preview || logo) && !removeLogo && (
              <Button
                color="inherit"
                disabled={busy}
                onClick={() => {
                  setLogo(null);
                  setRemoveLogo(true);
                }}
              >
                Quitar logo
              </Button>
            )}
          </div>
        </div>
        <div className="form-grid">
          <TextField
            label="Nombre de la veterinaria"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            slotProps={{ htmlInput: { minLength: 2, maxLength: 80 } }}
          />
          <TextField
            label="Dirección"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Av. Ejemplo 123, Miraflores, Lima"
            slotProps={{ htmlInput: { maxLength: 200 } }}
          />
        </div>
        <p className="muted">
          El nombre y la dirección aparecen en la página pública y en el
          recordatorio de WhatsApp.
        </p>
        <h2 className="settings-subtitle">Horario de atención</h2>
        <p className="muted">
          Define los días y horas en que se pueden agendar citas de 30
          minutos, desde el panel y desde la página pública. La última cita
          empieza 30 minutos antes del cierre. Las citas ya agendadas no se
          modifican.
        </p>
        <div className="hours-grid">
          {DAY_NAMES.map((dayName, i) => {
            const h = hours[i];
            const set = (value: Hours[number]) =>
              setHours((all) => all.map((x, j) => (j === i ? value : x)));
            return (
              <div className="hours-row" key={dayName}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={!!h}
                      onChange={(e) =>
                        set(
                          e.target.checked
                            ? { open: '09:00', close: '18:00' }
                            : null,
                        )
                      }
                    />
                  }
                  label={dayName}
                />
                {h ? (
                  <>
                    <TextField
                      select
                      label="Abre"
                      value={h.open}
                      onChange={(e) => set({ ...h, open: e.target.value })}
                    >
                      {HALF_HOURS.map((t) => (
                        <MenuItem key={t} value={t}>
                          {t}
                        </MenuItem>
                      ))}
                    </TextField>
                    <TextField
                      select
                      label="Cierra"
                      value={h.close}
                      onChange={(e) => set({ ...h, close: e.target.value })}
                    >
                      {HALF_HOURS.map((t) => (
                        <MenuItem key={t} value={t}>
                          {t}
                        </MenuItem>
                      ))}
                    </TextField>
                  </>
                ) : (
                  <span className="muted hours-closed">Cerrado</span>
                )}
              </div>
            );
          })}
        </div>
        <p className="muted">Resumen: {hoursSummary(hours)}</p>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        <Button type="submit" variant="contained" disabled={busy}>
          {busy ? 'Guardando…' : 'Guardar cambios'}
        </Button>
      </form>
      <Snackbar
        open={!!notice}
        autoHideDuration={4000}
        onClose={() => setNotice('')}
        message={notice}
      />
    </section>
  );
}
