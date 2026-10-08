import { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import { dateLabel, localDate, type Data } from './domain';
import { EXPENSE_CATEGORIES, PAYMENT_METHODS, round2, soles } from './money';
type Period = 'today' | 'week' | 'month' | 'last' | 'custom';
const shift = (day: string, n: number) => {
  const d = new Date(day + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
// Date range (clinic-local days, inclusive) for each period.
function range(p: Period, today: string, from: string, to: string): [string, string] {
  if (p === 'today') return [today, today];
  if (p === 'week') {
    const dow = (new Date(today + 'T12:00:00Z').getUTCDay() + 6) % 7;
    return [shift(today, -dow), today];
  }
  if (p === 'month') return [today.slice(0, 8) + '01', today];
  if (p === 'last') {
    const first = today.slice(0, 8) + '01';
    const end = shift(first, -1);
    return [end.slice(0, 8) + '01', end];
  }
  return [from || today, to || today];
}
function Breakdown({
  title,
  rows,
  total,
}: {
  title: string;
  rows: { label: string; value: number; note?: string }[];
  total: number;
}) {
  return (
    <section className="panel table-panel">
      <div className="section-heading">
        <h2>{title}</h2>
      </div>
      <TableContainer>
        <Table size="small">
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.label}>
                <TableCell>
                  {r.label}
                  {r.note && <small>{r.note}</small>}
                </TableCell>
                <TableCell align="right">{soles(r.value)}</TableCell>
                <TableCell align="right" className="muted">
                  {total ? Math.round((r.value / total) * 100) + '%' : '—'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      {!rows.length && <div className="empty">Sin movimientos en el período.</div>}
    </section>
  );
}
export default function Reports({ data }: { data: Data }) {
  const today = localDate();
  const [period, setPeriod] = useState<Period>('month'),
    [from, setFrom] = useState(today.slice(0, 8) + '01'),
    [to, setTo] = useState(today);
  const [start, end] = range(period, today, from, to);
  const inRange = (day: string) => day >= start && day <= end;
  const payments = data.payments.filter(
    (p) => p.status === 'paid' && inRange(localDate(new Date(p.created_at))),
  );
  const expenses = data.expenses.filter((e) => e.status === 'active' && inRange(e.spent_on));
  const income = round2(payments.reduce((t, p) => t + Number(p.total), 0));
  const spent = round2(expenses.reduce((t, e) => t + Number(e.amount), 0));
  const discounts = round2(payments.reduce((t, p) => t + Number(p.discount), 0));
  const byMethod = PAYMENT_METHODS.map((m) => ({
    label: m,
    value: round2(payments.filter((p) => p.method === m).reduce((t, p) => t + Number(p.total), 0)),
  })).filter((r) => r.value);
  const ids = new Set(payments.map((p) => p.id));
  const services = new Map<string, { value: number; qty: number }>();
  for (const i of data.payment_items.filter((i) => ids.has(i.payment_id))) {
    const s = services.get(i.description) || { value: 0, qty: 0 };
    services.set(i.description, { value: round2(s.value + Number(i.amount)), qty: s.qty + i.quantity });
  }
  const byService = [...services]
    .map(([label, s]) => ({ label, value: s.value, note: s.qty + (s.qty === 1 ? ' vez' : ' veces') }))
    .sort((a, b) => b.value - a.value);
  const byCategory = EXPENSE_CATEGORIES.map((c) => ({
    label: c,
    value: round2(expenses.filter((e) => e.category === c).reduce((t, e) => t + Number(e.amount), 0)),
  }))
    .filter((r) => r.value)
    .sort((a, b) => b.value - a.value);
  const days: string[] = [];
  for (let d = start; d <= end && days.length < 62; d = shift(d, 1)) days.push(d);
  const daily = days
    .map((d) => ({
      d,
      inc: round2(
        payments
          .filter((p) => localDate(new Date(p.created_at)) === d)
          .reduce((t, p) => t + Number(p.total), 0),
      ),
      out: round2(expenses.filter((e) => e.spent_on === d).reduce((t, e) => t + Number(e.amount), 0)),
    }))
    .filter((r) => r.inc || r.out)
    .reverse();
  return (
    <>
      <div className="toolbar report-toolbar">
        <ToggleButtonGroup
          size="small"
          exclusive
          value={period}
          onChange={(_e, v) => v && setPeriod(v)}
        >
          <ToggleButton value="today">Hoy</ToggleButton>
          <ToggleButton value="week">Esta semana</ToggleButton>
          <ToggleButton value="month">Este mes</ToggleButton>
          <ToggleButton value="last">Mes anterior</ToggleButton>
          <ToggleButton value="custom">Rango</ToggleButton>
        </ToggleButtonGroup>
        {period === 'custom' && (
          <>
            <TextField
              type="date"
              label="Desde"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField
              type="date"
              label="Hasta"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
            />
          </>
        )}
        <span className="muted">
          {start === end ? dateLabel(start) : dateLabel(start) + ' – ' + dateLabel(end)}
        </span>
      </div>
      <div className="stats report-stats">
        <div className="stat">
          <span className="stat-label">Ingresos</span>
          <strong>{soles(income)}</strong>
          <small>
            {payments.length} {payments.length === 1 ? 'cobro' : 'cobros'}
            {discounts ? ' · descuentos ' + soles(discounts) : ''}
          </small>
        </div>
        <div className="stat">
          <span className="stat-label">Gastos</span>
          <strong>{soles(spent)}</strong>
          <small>
            {expenses.length} {expenses.length === 1 ? 'gasto' : 'gastos'}
          </small>
        </div>
        <div className="stat">
          <span className="stat-label">Resultado</span>
          <strong className={income - spent < 0 ? 'overdue' : ''}>{soles(income - spent)}</strong>
          <small>Ingresos − gastos</small>
        </div>
        <div className="stat">
          <span className="stat-label">Ticket promedio</span>
          <strong>{soles(payments.length ? income / payments.length : 0)}</strong>
          <small>Por cobro</small>
        </div>
      </div>
      <div className="report-grid">
        <Breakdown title="Ingresos por medio de pago" rows={byMethod} total={income} />
        <Breakdown title="Gastos por categoría" rows={byCategory} total={spent} />
        <Breakdown
          title="Ingresos por servicio"
          rows={byService}
          total={byService.reduce((t, r) => t + r.value, 0)}
        />
        <section className="panel table-panel">
          <div className="section-heading">
            <h2>Por día</h2>
          </div>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Día</TableCell>
                  <TableCell align="right">Ingresos</TableCell>
                  <TableCell align="right">Gastos</TableCell>
                  <TableCell align="right">Resultado</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {daily.map((r) => (
                  <TableRow key={r.d}>
                    <TableCell>{dateLabel(r.d)}</TableCell>
                    <TableCell align="right">{soles(r.inc)}</TableCell>
                    <TableCell align="right">{soles(r.out)}</TableCell>
                    <TableCell align="right" className={r.inc - r.out < 0 ? 'overdue' : ''}>
                      {soles(r.inc - r.out)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          {!daily.length && <div className="empty">Sin movimientos en el período.</div>}
        </section>
      </div>
    </>
  );
}
