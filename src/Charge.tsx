import { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  TextField,
} from '@mui/material';
import Add from '@mui/icons-material/Add';
import Close from '@mui/icons-material/Close';
import PrintOutlined from '@mui/icons-material/PrintOutlined';
import { clock, dateLabel, localDate, type Data, type Payment } from './domain';
import { PAYMENT_METHODS, round2, soles, type ChargeItem, type MoneyCall } from './money';
import type { Clinic } from './clinic';
import { PetPicker } from './Pickers';
type Line = ChargeItem & { key: string };
const newLine = (): Line => ({
  key: crypto.randomUUID(),
  service_id: null,
  description: '',
  quantity: 1,
  unit_price: 0,
});
// New charge: services (price editable), discount and payment method. Totals are recomputed by the database.
export function ChargeDialog({
  data,
  appointmentId,
  onClose,
  onDone,
  call,
}: {
  data: Data;
  appointmentId: string | null;
  onClose: () => void;
  onDone: (payment: Payment) => void;
  call: (c: MoneyCall) => Promise<unknown>;
}) {
  const appt = data.appointments.find((a) => a.id === appointmentId);
  const services = data.services.filter((s) => s.active);
  const fromService = (id: string): Partial<Line> => {
    const s = services.find((x) => x.id === id);
    return s
      ? { service_id: s.id, description: s.name, unit_price: Number(s.price || 0) }
      : {};
  };
  const [lines, setLines] = useState<Line[]>(() => {
    const s = appt && services.find((x) => x.name === appt.reason);
    return [s ? { ...newLine(), ...fromService(s.id) } : newLine()];
  });
  const [petId, setPetId] = useState(appt?.pet_id || ''),
    [discount, setDiscount] = useState(''),
    [method, setMethod] = useState(PAYMENT_METHODS[0]),
    [notes, setNotes] = useState(''),
    // Cash helper only (not stored): amount handed over and change to give back.
    [received, setReceived] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const subtotal = round2(
    lines.reduce((t, l) => t + (Number(l.quantity) || 0) * (Number(l.unit_price) || 0), 0),
  );
  const total = round2(subtotal - (Number(discount) || 0));
  const change = round2((Number(received) || 0) - total);
  const set = (key: string, patch: Partial<Line>) =>
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const owner = (pet: string) => {
    const p = data.pets.find((x) => x.id === pet);
    return p ? p.name + ' · ' + (data.clients.find((c) => c.id === p.client_id)?.name || '') : '';
  };
  async function save() {
    setError('');
    const items = lines
      .filter((l) => l.description.trim())
      .map(({ key: _key, ...l }) => ({
        ...l,
        quantity: Number(l.quantity),
        unit_price: Number(l.unit_price),
      }));
    if (!items.length) return setError('Agrega al menos un servicio.');
    if (items.some((i) => !(i.quantity >= 1) || !(i.unit_price >= 0)))
      return setError('Revisa cantidades y precios.');
    if (total < 0) return setError('El descuento no puede superar el subtotal.');
    setBusy(true);
    try {
      const payment = (await call({
        fn: 'create_payment',
        args: {
          p_appointment: appointmentId,
          p_client: null,
          p_pet: petId || null,
          p_items: items,
          p_discount: Number(discount) || 0,
          p_method: method,
          p_notes: notes,
        },
      })) as Payment;
      onDone(payment);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  return (
    <Dialog open fullWidth maxWidth="md">
      <DialogTitle>
        {appt ? 'Cobrar cita' : 'Nuevo cobro'}
        <IconButton
          sx={{ position: 'absolute', right: 12, top: 12 }}
          aria-label="Cerrar cobro"
          disabled={busy}
          onClick={onClose}
        >
          <Close />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        {appt ? (
          <Alert severity="info" sx={{ mb: 2 }}>
            {owner(appt.pet_id)} · {appt.reason} ·{' '}
            {dateLabel(localDate(new Date(appt.starts_at)))} {clock(appt.starts_at)}
          </Alert>
        ) : (
          <div className="charge-pet">
            <PetPicker
              pets={data.pets}
              clients={data.clients}
              value={petId}
              onChange={setPetId}
              label="Mascota (opcional · vacío = venta directa)"
            />
          </div>
        )}
        <div className="charge-lines">
          {lines.map((l) => {
            const svc = services.find((s) => s.id === l.service_id);
            return (
              <div className="charge-line" key={l.key}>
                <TextField
                  select
                  label="Servicio"
                  value={l.service_id || ''}
                  onChange={(e) =>
                    set(
                      l.key,
                      e.target.value
                        ? fromService(e.target.value)
                        : { service_id: null, description: '', unit_price: 0 },
                    )
                  }
                >
                  <MenuItem value="">Otro concepto…</MenuItem>
                  {services.map((s) => (
                    <MenuItem key={s.id} value={s.id}>
                      {s.name}
                    </MenuItem>
                  ))}
                </TextField>
                {!l.service_id && (
                  <TextField
                    label="Concepto"
                    value={l.description}
                    onChange={(e) => set(l.key, { description: e.target.value })}
                    slotProps={{ htmlInput: { maxLength: 120 } }}
                  />
                )}
                <TextField
                  label="Cant."
                  type="number"
                  value={l.quantity}
                  onChange={(e) => set(l.key, { quantity: Number(e.target.value) })}
                  slotProps={{ htmlInput: { min: 1, max: 999 } }}
                />
                <TextField
                  label={svc?.variable_price ? 'Precio (variable)' : 'Precio S/'}
                  type="number"
                  value={l.unit_price}
                  onChange={(e) => set(l.key, { unit_price: Number(e.target.value) })}
                  slotProps={{ htmlInput: { min: 0, step: 0.5 } }}
                  helperText={svc?.variable_price ? 'Según diagnóstico' : undefined}
                />
                <b className="charge-amount">
                  {soles((Number(l.quantity) || 0) * (Number(l.unit_price) || 0))}
                </b>
                <IconButton
                  aria-label="Quitar línea"
                  disabled={lines.length === 1}
                  onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}
                >
                  <Close fontSize="small" />
                </IconButton>
              </div>
            );
          })}
        </div>
        <Button startIcon={<Add />} onClick={() => setLines((ls) => [...ls, newLine()])}>
          Agregar servicio
        </Button>
        <div className="charge-footer">
          <TextField
            select
            label="Medio de pago"
            value={method}
            onChange={(e) => setMethod(e.target.value)}
          >
            {PAYMENT_METHODS.map((m) => (
              <MenuItem key={m} value={m}>
                {m}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Descuento S/"
            type="number"
            value={discount}
            onChange={(e) => setDiscount(e.target.value)}
            slotProps={{ htmlInput: { min: 0, step: 0.5 } }}
          />
          <TextField
            label="Nota (opcional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            slotProps={{ htmlInput: { maxLength: 500 } }}
          />
        </div>
        <div className="charge-totals">
          <span>Subtotal {soles(subtotal)}</span>
          {!!Number(discount) && <span>Descuento −{soles(Number(discount))}</span>}
          <b>Total {soles(total)}</b>
        </div>
        {method === 'Efectivo' && (
          <div className="charge-cash">
            <TextField
              label="Monto recibido S/"
              type="number"
              value={received}
              onChange={(e) => setReceived(e.target.value)}
              slotProps={{ htmlInput: { min: 0, step: 0.1 } }}
              helperText="Solo para calcular el vuelto; no se guarda."
            />
            <TextField
              label={received !== '' && change < 0 ? 'Falta' : 'Vuelto'}
              value={received === '' ? '' : soles(Math.abs(change))}
              error={received !== '' && change < 0}
              slotProps={{ input: { readOnly: true }, inputLabel: { shrink: true } }}
              className="charge-change"
            />
          </div>
        )}
        {error && <Alert severity="error">{error}</Alert>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>
          Cancelar
        </Button>
        <Button variant="contained" onClick={save} disabled={busy}>
          {busy ? 'Registrando…' : 'Cobrar ' + soles(total)}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
// Printing: a copy of the receipt is rendered straight under <body>; while printing
// (body.print-receipt) everything else is hidden, so the dialog and page do not get in the way.
function printReceipt() {
  document.body.classList.add('print-receipt');
  const done = () => {
    document.body.classList.remove('print-receipt');
    window.removeEventListener('afterprint', done);
  };
  window.addEventListener('afterprint', done);
  window.print();
}
function ReceiptBody({
  payment,
  data,
  clinic,
}: {
  payment: Payment;
  data: Data;
  clinic: Clinic;
}) {
  const items = data.payment_items.filter((i) => i.payment_id === payment.id);
  const pet = data.pets.find((p) => p.id === payment.pet_id);
  const client = data.clients.find((c) => c.id === payment.client_id);
  return (
    <>
      <h3>{clinic.name}</h3>
      {clinic.address && <p>{clinic.address}</p>}
      <p>
        Recibo interno N.º {String(payment.number).padStart(6, '0')}
        <br />
        {dateLabel(payment.created_at)} {clock(payment.created_at)}
      </p>
      {(client || pet) && (
        <p>
          {client?.name}
          {pet ? ' · ' + pet.name : ''}
        </p>
      )}
      <table>
        <tbody>
          {items.map((i) => (
            <tr key={i.id}>
              <td>
                {i.quantity} × {i.description}
              </td>
              <td>{soles(i.amount)}</td>
            </tr>
          ))}
          {!!Number(payment.discount) && (
            <tr>
              <td>Descuento</td>
              <td>−{soles(payment.discount)}</td>
            </tr>
          )}
          <tr className="receipt-total">
            <td>Total</td>
            <td>{soles(payment.total)}</td>
          </tr>
        </tbody>
      </table>
      <p>Pago: {payment.method}</p>
      {payment.status === 'void' && <p className="receipt-void">ANULADO: {payment.void_reason}</p>}
      <small>Comprobante interno, no válido como boleta o factura.</small>
    </>
  );
}
// Internal numbered receipt.
export function ReceiptDialog({
  payment,
  data,
  clinic,
  onClose,
}: {
  payment: Payment;
  data: Data;
  clinic: Clinic;
  onClose: () => void;
}) {
  return (
    <Dialog open fullWidth maxWidth="xs">
      <DialogTitle>
        Recibo N.º {String(payment.number).padStart(6, '0')}
        <IconButton
          sx={{ position: 'absolute', right: 12, top: 12 }}
          aria-label="Cerrar recibo"
          onClick={onClose}
        >
          <Close />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <div className="receipt-print">
          <ReceiptBody payment={payment} data={data} clinic={clinic} />
        </div>
        {createPortal(
          <div className="receipt-sheet receipt-print" aria-hidden="true">
            <ReceiptBody payment={payment} data={data} clinic={clinic} />
          </div>,
          document.body,
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cerrar</Button>
        <Button variant="contained" startIcon={<PrintOutlined />} onClick={printReceipt}>
          Imprimir
        </Button>
      </DialogActions>
    </Dialog>
  );
}
