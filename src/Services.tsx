import { useState } from 'react';
import {
  Alert,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
} from '@mui/material';
import Add from '@mui/icons-material/Add';
import Close from '@mui/icons-material/Close';
import EditOutlined from '@mui/icons-material/EditOutlined';
import type { Service } from './domain';
import { SERVICE_CATEGORIES, soles } from './money';
type Draft = Omit<Service, 'id' | 'price'> & { id?: string; price: string };
const blank = (sort: number): Draft => ({
  name: '',
  category: SERVICE_CATEGORIES[0],
  description: '',
  price: '',
  variable_price: false,
  show_on_landing: true,
  bookable: true,
  active: true,
  sort,
});
// Clinic catalog with prices. The landing shows active services without prices.
export default function Services({
  services,
  save,
}: {
  services: Service[];
  save: (row: Record<string, unknown>, id?: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState<Draft | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const sorted = [...services].sort(
    (a, b) =>
      SERVICE_CATEGORIES.indexOf(a.category) - SERVICE_CATEGORIES.indexOf(b.category) ||
      a.sort - b.sort,
  );
  async function submit() {
    if (!draft) return;
    setError('');
    if (draft.name.trim().length < 2) return setError('Escribe el nombre del servicio.');
    if (!(Number(draft.price) >= 0) || draft.price === '')
      return setError('Indica el precio (puede ser 0 si es variable).');
    if (services.some((s) => s.id !== draft.id && s.name.trim().toLowerCase() === draft.name.trim().toLowerCase()))
      return setError('Ya existe un servicio con ese nombre.');
    setBusy(true);
    try {
      // Only the editable columns: the database grants updates on exactly these
      // (sending id or created_at back is rejected as "permission denied").
      await save(
        {
          name: draft.name.trim(),
          category: draft.category,
          description: draft.description,
          price: Number(draft.price),
          variable_price: draft.variable_price,
          show_on_landing: draft.show_on_landing,
          bookable: draft.bookable,
          active: draft.active,
          sort: draft.sort,
        },
        draft.id,
      );
      setDraft(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="toolbar">
        <p className="muted services-note">
          La página pública muestra los servicios activos <b>sin precio</b>. Los marcados
          como reservables aparecen como opción al reservar en línea.
        </p>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => {
            setError('');
            setDraft(blank((services.reduce((m, s) => Math.max(m, s.sort), 0) || 0) + 10));
          }}
        >
          Nuevo servicio
        </Button>
      </div>
      <section className="panel table-panel">
        <TableContainer>
          <Table className="users-table services-table">
            <TableHead>
              <TableRow>
                {['Servicio', 'Categoría', 'Precio', 'Visible', ''].map((h) => (
                  <TableCell key={h}>{h}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {sorted.map((s) => (
                <TableRow key={s.id} className={s.active ? '' : 'is-void'}>
                  <TableCell>
                    <b>{s.name}</b>
                    <small>{s.description}</small>
                  </TableCell>
                  <TableCell>{s.category}</TableCell>
                  <TableCell>
                    {s.variable_price ? 'Desde ' : ''}
                    <b>{soles(s.price)}</b>
                    {!Number(s.price) && !s.variable_price && <small>Sin precio</small>}
                  </TableCell>
                  <TableCell>
                    <span className="service-flags">
                      {!s.active && <Chip size="small" label="Inactivo" />}
                      {s.active && s.show_on_landing && (
                        <Chip size="small" variant="outlined" label="Página pública" />
                      )}
                      {s.active && s.bookable && (
                        <Chip size="small" variant="outlined" label="Reserva en línea" />
                      )}
                    </span>
                  </TableCell>
                  <TableCell>
                    <IconButton
                      aria-label={'Editar ' + s.name}
                      onClick={() => {
                        setError('');
                        setDraft({ ...s, price: String(s.price ?? 0) });
                      }}
                    >
                      <EditOutlined />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        {!services.length && <div className="empty">Aún no hay servicios.</div>}
      </section>
      <Dialog open={!!draft} fullWidth maxWidth="sm">
        <DialogTitle>
          {draft?.id ? 'Editar servicio' : 'Nuevo servicio'}
          <IconButton
            sx={{ position: 'absolute', right: 12, top: 12 }}
            aria-label="Cerrar formulario"
            disabled={busy}
            onClick={() => setDraft(null)}
          >
            <Close />
          </IconButton>
        </DialogTitle>
        {draft && (
          <DialogContent>
            <div className="form-grid">
              <TextField
                label="Nombre"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                slotProps={{ htmlInput: { maxLength: 80 } }}
              />
              <div className="form-pair">
                <TextField
                  select
                  label="Categoría"
                  value={draft.category}
                  onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                >
                  {SERVICE_CATEGORIES.map((c) => (
                    <MenuItem key={c} value={c}>
                      {c}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  label={draft.variable_price ? 'Precio desde S/' : 'Precio S/'}
                  type="number"
                  value={draft.price}
                  onChange={(e) => setDraft({ ...draft, price: e.target.value })}
                  slotProps={{ htmlInput: { min: 0, step: 0.5 } }}
                />
              </div>
              <TextField
                label="Descripción para la página pública"
                value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                multiline
                minRows={2}
                slotProps={{ htmlInput: { maxLength: 300 } }}
              />
              {(
                [
                  ['variable_price', 'Precio variable: se define al cobrar (p. ej. cirugías)'],
                  ['show_on_landing', 'Mostrar en la página pública (sin precio)'],
                  ['bookable', 'Se puede reservar en línea'],
                  ['active', 'Activo'],
                ] as const
              ).map(([key, label]) => (
                <FormControlLabel
                  key={key}
                  control={
                    <Checkbox
                      checked={draft[key]}
                      onChange={(e) => setDraft({ ...draft, [key]: e.target.checked })}
                    />
                  }
                  label={label}
                />
              ))}
              {draft.id && draft.name !== services.find((s) => s.id === draft.id)?.name && (
                <Alert severity="warning">
                  Las citas ya registradas conservan el nombre anterior.
                </Alert>
              )}
              {error && <Alert severity="error">{error}</Alert>}
            </div>
          </DialogContent>
        )}
        <DialogActions>
          <Button onClick={() => setDraft(null)} disabled={busy}>
            Cancelar
          </Button>
          <Button variant="contained" onClick={submit} disabled={busy}>
            Guardar
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
