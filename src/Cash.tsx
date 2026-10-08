import { useState } from 'react';
import {
  Alert,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import Add from '@mui/icons-material/Add';
import PointOfSaleOutlined from '@mui/icons-material/PointOfSaleOutlined';
import { clock, dateLabel, localDate, type Data, type Payment } from './domain';
import {
  PAYMENT_METHODS,
  expectedCash,
  openSession,
  paidFor,
  round2,
  soles,
  type MoneyCall,
} from './money';
const when = (iso: string) => dateLabel(iso) + ' ' + clock(iso);
export default function Cash({
  data,
  isAdmin,
  call,
  onCharge,
  onReceipt,
}: {
  data: Data;
  isAdmin: boolean;
  call: (c: MoneyCall) => Promise<unknown>;
  onCharge: (appointmentId: string | null) => void;
  onReceipt: (p: Payment) => void;
}) {
  const session = openSession(data);
  const [opening, setOpening] = useState(''),
    [closing, setClosing] = useState(false),
    [counted, setCounted] = useState(''),
    [notes, setNotes] = useState(''),
    [voiding, setVoiding] = useState<Payment | null>(null),
    [reason, setReason] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  async function run(c: MoneyCall, after?: () => void) {
    setBusy(true);
    setError('');
    try {
      await call(c);
      after?.();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const person = (p: Payment) => {
    const pet = data.pets.find((x) => x.id === p.pet_id);
    const client = data.clients.find((x) => x.id === p.client_id);
    return [client?.name, pet?.name].filter(Boolean).join(' · ') || 'Venta directa';
  };
  const detail = (p: Payment) =>
    data.payment_items
      .filter((i) => i.payment_id === p.id)
      .map((i) => (i.quantity > 1 ? i.quantity + ' × ' : '') + i.description)
      .join(', ');
  // Attended appointments of the last 30 days that were not charged yet.
  const [since] = useState(() => localDate(new Date(Date.now() - 30 * 864e5)));
  const pending = data.appointments
    .filter(
      (a) =>
        a.status === 'completed' &&
        localDate(new Date(a.starts_at)) >= since &&
        !paidFor(data, a.id),
    )
    .sort((a, b) => b.starts_at.localeCompare(a.starts_at));
  const sessionPayments = session
    ? data.payments
        .filter((p) => p.session_id === session.id)
        .sort((a, b) => b.number - a.number)
    : [];
  const paid = sessionPayments.filter((p) => p.status === 'paid');
  const byMethod = PAYMENT_METHODS.map((m) => ({
    m,
    total: round2(paid.filter((p) => p.method === m).reduce((t, p) => t + Number(p.total), 0)),
  }));
  const cashExpenses = session
    ? data.expenses
        .filter((e) => e.session_id === session.id && e.status === 'active')
        .reduce((t, e) => t + Number(e.amount), 0)
    : 0;
  const history = data.cash_sessions
    .filter((s) => s.closed_at)
    .sort((a, b) => b.opened_at.localeCompare(a.opened_at))
    .slice(0, 15);
  return (
    <>
      {error && !closing && !voiding && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      {!session ? (
        <section className="panel cash-closed">
          <PointOfSaleOutlined />
          <div>
            <h2>La caja está cerrada</h2>
            <p className="muted">
              Ábrela con el efectivo inicial para empezar a cobrar.
            </p>
          </div>
          <TextField
            label="Efectivo inicial S/"
            type="number"
            value={opening}
            onChange={(e) => setOpening(e.target.value)}
            slotProps={{ htmlInput: { min: 0, step: 0.5 } }}
          />
          <Button
            variant="contained"
            disabled={busy || opening === ''}
            onClick={() =>
              run({ fn: 'open_cash_session', args: { p_amount: Number(opening) } }, () =>
                setOpening(''),
              )
            }
          >
            Abrir caja
          </Button>
        </section>
      ) : (
        <>
          <div className="stats cash-stats">
            <div className="stat">
              <span className="stat-label">Caja abierta</span>
              <strong>{soles(session.opening_amount)}</strong>
              <small>Desde {when(session.opened_at)}</small>
            </div>
            <div className="stat">
              <span className="stat-label">Cobrado</span>
              <strong>{soles(paid.reduce((t, p) => t + Number(p.total), 0))}</strong>
              <small>
                {paid.length} {paid.length === 1 ? 'cobro' : 'cobros'}
              </small>
            </div>
            <div className="stat">
              <span className="stat-label">Gastos en efectivo</span>
              <strong>{soles(cashExpenses)}</strong>
              <small>Pagados desde la caja</small>
            </div>
            <div className="stat">
              <span className="stat-label">Efectivo esperado</span>
              <strong>{soles(expectedCash(data, session.id))}</strong>
              <small>Inicial + efectivo − gastos</small>
            </div>
          </div>
          <div className="cash-actions">
            <div className="cash-methods">
              {byMethod.map(({ m, total }) => (
                <Chip key={m} label={m + ': ' + soles(total)} variant="outlined" />
              ))}
            </div>
            <div>
              <Button variant="contained" startIcon={<Add />} onClick={() => onCharge(null)}>
                Nuevo cobro
              </Button>
              <Button
                onClick={() => {
                  setCounted('');
                  setNotes('');
                  setError('');
                  setClosing(true);
                }}
              >
                Cerrar caja
              </Button>
            </div>
          </div>
        </>
      )}
      <section className="panel">
        <div className="section-heading">
          <h2>Pendientes de cobro</h2>
          <small className="muted">Citas atendidas en los últimos 30 días</small>
        </div>
        {pending.map((a) => {
          const pet = data.pets.find((p) => p.id === a.pet_id);
          return (
            <div className="cash-row" key={a.id}>
              <span>
                {dateLabel(localDate(new Date(a.starts_at)))} {clock(a.starts_at)}
              </span>
              <span>
                <b>{pet?.name}</b>{' '}
                <small>{data.clients.find((c) => c.id === pet?.client_id)?.name}</small>
              </span>
              <span>{a.reason}</span>
              <Button size="small" disabled={!session} onClick={() => onCharge(a.id)}>
                Cobrar
              </Button>
            </div>
          );
        })}
        {!pending.length && <p className="muted">No hay citas pendientes de cobro.</p>}
        {!!pending.length && !session && (
          <p className="muted">Abre la caja para cobrar.</p>
        )}
      </section>
      {session && (
        <section className="panel table-panel">
          <div className="section-heading">
            <h2>Cobros de esta caja</h2>
          </div>
          <TableContainer>
            <Table className="users-table cash-table">
              <TableHead>
                <TableRow>
                  {['Recibo', 'Cliente', 'Detalle', 'Pago', 'Total', ''].map((h) => (
                    <TableCell key={h}>{h}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {sessionPayments.map((p) => (
                  <TableRow key={p.id} className={p.status === 'void' ? 'is-void' : ''}>
                    <TableCell>
                      <b>N.º {String(p.number).padStart(6, '0')}</b>
                      <small>{clock(p.created_at)}</small>
                    </TableCell>
                    <TableCell>{person(p)}</TableCell>
                    <TableCell>{detail(p)}</TableCell>
                    <TableCell>{p.method}</TableCell>
                    <TableCell>
                      <b>{soles(p.total)}</b>
                      {p.status === 'void' && <small>Anulado</small>}
                    </TableCell>
                    <TableCell>
                      <Button size="small" onClick={() => onReceipt(p)}>
                        Recibo
                      </Button>
                      {p.status === 'paid' && (
                        <Button
                          size="small"
                          color="error"
                          onClick={() => {
                            setReason('');
                            setError('');
                            setVoiding(p);
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
          {!sessionPayments.length && <div className="empty">Aún no hay cobros.</div>}
        </section>
      )}
      {isAdmin && !!history.length && (
        <section className="panel table-panel">
          <div className="section-heading">
            <h2>Cierres anteriores</h2>
          </div>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  {['Apertura', 'Cierre', 'Inicial', 'Esperado', 'Contado', 'Diferencia'].map(
                    (h) => (
                      <TableCell key={h}>{h}</TableCell>
                    ),
                  )}
                </TableRow>
              </TableHead>
              <TableBody>
                {history.map((s) => {
                  const diff = round2(Number(s.counted_cash) - Number(s.expected_cash));
                  return (
                    <TableRow key={s.id}>
                      <TableCell>{when(s.opened_at)}</TableCell>
                      <TableCell>{when(s.closed_at!)}</TableCell>
                      <TableCell>{soles(s.opening_amount)}</TableCell>
                      <TableCell>{soles(s.expected_cash)}</TableCell>
                      <TableCell>{soles(s.counted_cash)}</TableCell>
                      <TableCell className={diff < 0 ? 'overdue' : ''}>
                        {diff === 0 ? 'Cuadra' : (diff > 0 ? '+' : '') + soles(diff)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </section>
      )}
      <Dialog open={closing} fullWidth maxWidth="xs">
        <DialogTitle>Cerrar caja</DialogTitle>
        <DialogContent>
          {session && (
            <p>
              Efectivo esperado: <b>{soles(expectedCash(data, session.id))}</b>
            </p>
          )}
          <TextField
            label="Efectivo contado S/"
            type="number"
            value={counted}
            onChange={(e) => setCounted(e.target.value)}
            slotProps={{ htmlInput: { min: 0, step: 0.1 } }}
            sx={{ mt: 1 }}
          />
          {session && counted !== '' && (
            <Alert
              severity={
                round2(Number(counted) - expectedCash(data, session.id)) === 0
                  ? 'success'
                  : 'warning'
              }
              sx={{ mt: 2 }}
            >
              Diferencia:{' '}
              {soles(round2(Number(counted) - expectedCash(data, session.id)))}
            </Alert>
          )}
          <TextField
            label="Observaciones (opcional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            multiline
            minRows={2}
            sx={{ mt: 2 }}
            slotProps={{ htmlInput: { maxLength: 500 } }}
          />
          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setClosing(false)} disabled={busy}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            disabled={busy || counted === ''}
            onClick={() =>
              run(
                { fn: 'close_cash_session', args: { p_counted: Number(counted), p_notes: notes } },
                () => setClosing(false),
              )
            }
          >
            Cerrar caja
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog open={!!voiding} fullWidth maxWidth="xs">
        <DialogTitle>Anular recibo N.º {voiding && String(voiding.number).padStart(6, '0')}</DialogTitle>
        <DialogContent>
          <p className="muted">
            El recibo se conserva marcado como anulado y deja de sumar en la caja y los
            reportes.
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
              run({ fn: 'void_payment', args: { p_payment: voiding!.id, p_reason: reason } }, () =>
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
