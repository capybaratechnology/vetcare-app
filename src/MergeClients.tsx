import { useState } from 'react';
import {
  Alert,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Radio,
} from '@mui/material';
import { dateLabel, type Data } from './domain';
// Lets staff pick which file to keep among clients that share a phone.
export default function MergeClients({
  group,
  data,
  onClose,
  onMerge,
}: {
  group: Data['clients'];
  data: Data;
  onClose: () => void;
  onMerge: (keepId: string, mergePets: boolean) => Promise<void>;
}) {
  const [keep, setKeep] = useState(group[0].id),
    [mergePets, setMergePets] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  async function confirm() {
    setBusy(true);
    setError('');
    try {
      await onMerge(keep, mergePets);
    } catch (e) {
      setError((e as Error).message || 'No se pudieron unir las fichas.');
      setBusy(false);
    }
  }
  return (
    <Dialog open fullWidth maxWidth="sm">
      <DialogTitle>Unir fichas del {group[0].phone}</DialogTitle>
      <DialogContent>
        <p className="muted">
          Estas fichas tienen el mismo celular. Elige la que se conserva: las
          demás se eliminan y sus mascotas, citas, consultas y controles pasan
          a la ficha elegida.
        </p>
        <div className="merge-list">
          {group.map((c) => {
            const pets = data.pets.filter((p) => p.client_id === c.id);
            const visits = data.appointments.filter((a) =>
              pets.some((p) => p.id === a.pet_id),
            ).length;
            return (
              <label
                key={c.id}
                htmlFor={'merge-' + c.id}
                className={'merge-option ' + (keep === c.id ? 'selected' : '')}
              >
                <Radio
                  id={'merge-' + c.id}
                  checked={keep === c.id}
                  onChange={() => setKeep(c.id)}
                  disabled={busy}
                />
                <span>
                  <b>{c.name}</b>
                  <small>
                    {c.created_at
                      ? 'Creada el ' + dateLabel(c.created_at)
                      : 'Fecha de creación no disponible'}
                    {' · '}
                    {c.email || 'Sin correo'}
                    {' · '}
                    WhatsApp {c.consent ? 'autorizado' : 'sin autorización'}
                  </small>
                  <small>
                    {pets.map((p) => p.name).join(', ') || 'Sin mascotas'} ·{' '}
                    {visits} {visits === 1 ? 'cita' : 'citas'}
                  </small>
                </span>
              </label>
            );
          })}
        </div>
        <FormControlLabel
          control={
            <Checkbox
              checked={mergePets}
              onChange={(e) => setMergePets(e.target.checked)}
              disabled={busy}
            />
          }
          label="Unir también las mascotas con el mismo nombre y especie"
        />
        <Alert severity="info" sx={{ mt: 1 }}>
          Se conservan el nombre y el celular de la ficha elegida; el correo se
          completa si falta. La autorización de WhatsApp toma la de la ficha
          más reciente.
        </Alert>
        <Alert severity="warning" sx={{ mt: 1 }}>
          Esta acción no se puede deshacer.
        </Alert>
        {error && (
          <Alert severity="error" sx={{ mt: 1 }}>
            {error}
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>
          Cancelar
        </Button>
        <Button variant="contained" onClick={confirm} disabled={busy}>
          {busy ? 'Uniendo…' : 'Unir fichas'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
