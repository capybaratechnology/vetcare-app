import { useState } from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
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
import { dateLabel, localDate, type Data, type Expense } from './domain';
import {
  EXPENSE_CATEGORIES,
  PAYMENT_METHODS,
  openSession,
  round2,
  soles,
  type MoneyCall,
} from './money';
export default function Expenses({
  data,
  isAdmin,
  call,
}: {
  data: Data;
  isAdmin: boolean;
  call: (c: MoneyCall) => Promise<unknown>;
}) {
  const today = localDate();
  const session = openSession(data);
  const [month, setMonth] = useState(today.slice(0, 7)),
    [form, setForm] = useState<null | {
      spent_on: string;
      category: string;
      description: string;
      amount: string;
      method: string;
    }>(null),
    [voiding, setVoiding] = useState<Expense | null>(null),
    [reason, setReason] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const list = data.expenses
    .filter((e) => e.spent_on.startsWith(month))
    .sort((a, b) => b.spent_on.localeCompare(a.spent_on) || b.created_at.localeCompare(a.created_at));
  const active = list.filter((e) => e.status === 'active');
  const total = round2(active.reduce((t, e) => t + Number(e.amount), 0));
  const canVoid = (e: Expense) =>
    e.status === 'active' && (isAdmin || (!!session && e.session_id === session.id));
  async function run(c: MoneyCall, after: () => void) {
    setBusy(true);
    setError('');
    try {
      await call(c);
      after();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="toolbar">
        <TextField
          type="month"
          label="Mes"
          value={month}
          onChange={(e) => setMonth(e.target.value || today.slice(0, 7))}
          slotProps={{ inputLabel: { shrink: true } }}
        />
        <div className="expense-total">
          Total del mes <b>{soles(total)}</b>
        </div>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => {
            setError('');
            setForm({
              spent_on: today,
              category: EXPENSE_CATEGORIES[0],
              description: '',
              amount: '',
              method: PAYMENT_METHODS[0],
            });
          }}
        >
          Nuevo gasto
        </Button>
      </div>
      <section className="panel table-panel">
        <TableContainer>
          <Table className="users-table expenses-table">
            <TableHead>
              <TableRow>
                {['Fecha', 'Categoría', 'Descripción', 'Pago', 'Monto', ''].map((h) => (
                  <TableCell key={h}>{h}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {list.map((e) => (
                <TableRow key={e.id} className={e.status === 'void' ? 'is-void' : ''}>
                  <TableCell>{dateLabel(e.spent_on)}</TableCell>
                  <TableCell>{e.category}</TableCell>
                  <TableCell>
                    {e.description}
                    {e.status === 'void' && <small>Anulado: {e.void_reason}</small>}
                  </TableCell>
                  <TableCell>
                    {e.method}
                    {e.session_id && <small>Desde la caja</small>}
                  </TableCell>
                  <TableCell>
                    <b>{soles(e.amount)}</b>
                  </TableCell>
                  <TableCell>
                    {canVoid(e) && (
                      <Button
                        size="small"
                        color="error"
                        onClick={() => {
                          setReason('');
                          setError('');
                          setVoiding(e);
                        }}
                      >
                        Anular
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        {!list.length && <div className="empty">No hay gastos registrados este mes.</div>}
      </section>
      <Dialog open={!!form} fullWidth maxWidth="sm">
        <DialogTitle>
          Nuevo gasto
          <IconButton
            sx={{ position: 'absolute', right: 12, top: 12 }}
            aria-label="Cerrar formulario"
            disabled={busy}
            onClick={() => setForm(null)}
          >
            <Close />
          </IconButton>
        </DialogTitle>
        {form && (
          <DialogContent>
            <div className="form-grid">
              <TextField
                type="date"
                label="Fecha"
                value={form.spent_on}
                onChange={(e) => setForm({ ...form, spent_on: e.target.value })}
                slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: today } }}
              />
              <TextField
                select
                label="Categoría"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                {EXPENSE_CATEGORIES.map((c) => (
                  <MenuItem key={c} value={c}>
                    {c}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                label="Descripción"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                slotProps={{ htmlInput: { maxLength: 200 } }}
              />
              <div className="form-pair">
                <TextField
                  label="Monto S/"
                  type="number"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  slotProps={{ htmlInput: { min: 0.01, step: 0.5 } }}
                />
                <TextField
                  select
                  label="Pago"
                  value={form.method}
                  onChange={(e) => setForm({ ...form, method: e.target.value })}
                >
                  {PAYMENT_METHODS.map((m) => (
                    <MenuItem key={m} value={m}>
                      {m}
                    </MenuItem>
                  ))}
                </TextField>
              </div>
              {form.method === 'Efectivo' && (
                <Alert severity="info">
                  {session
                    ? 'Se descontará del efectivo de la caja abierta.'
                    : 'La caja está cerrada: el gasto se registra sin afectar el arqueo.'}
                </Alert>
              )}
              {error && <Alert severity="error">{error}</Alert>}
            </div>
          </DialogContent>
        )}
        <DialogActions>
          <Button onClick={() => setForm(null)} disabled={busy}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            disabled={busy || !form?.description.trim() || !(Number(form?.amount) > 0)}
            onClick={() =>
              form &&
              run(
                {
                  fn: 'create_expense',
                  args: {
                    p_spent_on: form.spent_on,
                    p_category: form.category,
                    p_description: form.description,
                    p_amount: Number(form.amount),
                    p_method: form.method,
                  },
                },
                () => {
                  setMonth(form.spent_on.slice(0, 7));
                  setForm(null);
                },
              )
            }
          >
            Guardar gasto
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog open={!!voiding} fullWidth maxWidth="xs">
        <DialogTitle>Anular gasto</DialogTitle>
        <DialogContent>
          <p className="muted">
            {voiding?.description} · {voiding && soles(voiding.amount)}
          </p>
          <TextField
            label="Motivo"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            slotProps={{ htmlInput: { maxLength: 200 } }}
          />
          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setVoiding(null)} disabled={busy}>
            Cancelar
          </Button>
          <Button
            color="error"
            variant="contained"
            disabled={busy || reason.trim().length < 3}
            onClick={() =>
              run({ fn: 'void_expense', args: { p_expense: voiding!.id, p_reason: reason } }, () =>
                setVoiding(null),
              )
            }
          >
            Anular
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
