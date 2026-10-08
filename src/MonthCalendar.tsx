import { Button, IconButton } from '@mui/material';
import ChevronLeft from '@mui/icons-material/ChevronLeft';
import ChevronRight from '@mui/icons-material/ChevronRight';
import { dayHours, type Hours } from './domain';
export type DayCount = { pending: number; done: number };
const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
// "2026-10" plus n months.
export function shiftMonth(month: string, n: number) {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}
// Days shown for a month, Monday first, padded with the neighbouring months.
export function monthGrid(month: string) {
  const first = new Date(month + '-01T12:00:00Z');
  const start = new Date(first);
  start.setUTCDate(1 - ((first.getUTCDay() + 6) % 7));
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    return d.toISOString().slice(0, 10);
  });
}
export default function MonthCalendar({
  month,
  selected,
  today,
  counts,
  hours,
  onMonth,
  onSelect,
}: {
  month: string;
  selected: string;
  today: string;
  counts: Record<string, DayCount>;
  hours: Hours;
  onMonth: (month: string) => void;
  onSelect: (day: string) => void;
}) {
  // "Octubre 2026" (Intl gives "octubre de 2026").
  const name = new Intl.DateTimeFormat('es-PE', {
    month: 'long',
    timeZone: 'UTC',
  }).format(new Date(month + '-01T12:00:00Z'));
  const title = name[0].toUpperCase() + name.slice(1) + ' ' + month.slice(0, 4);
  const days = monthGrid(month);
  // Drop a trailing week made only of next-month days.
  const visible = days.slice(35).some((d) => d.startsWith(month))
    ? days
    : days.slice(0, 35);
  return (
    <section className="panel month-calendar">
      <div className="month-header">
        <h2>{title}</h2>
        <div>
          <Button
            size="small"
            onClick={() => {
              onMonth(today.slice(0, 7));
              onSelect(today);
            }}
          >
            Hoy
          </Button>
          <IconButton
            aria-label="Mes anterior"
            onClick={() => onMonth(shiftMonth(month, -1))}
          >
            <ChevronLeft />
          </IconButton>
          <IconButton
            aria-label="Mes siguiente"
            onClick={() => onMonth(shiftMonth(month, 1))}
          >
            <ChevronRight />
          </IconButton>
        </div>
      </div>
      <div className="month-grid" role="grid">
        {WEEKDAYS.map((w) => (
          <span className="month-weekday" key={w}>
            {w}
          </span>
        ))}
        {visible.map((d) => {
          const c = counts[d];
          const label =
            Number(d.slice(8)) +
            (c?.pending ? ', ' + c.pending + ' pendientes' : '') +
            (c?.done ? ', ' + c.done + ' atendidas' : '');
          return (
            <button
              key={d}
              type="button"
              aria-label={label}
              aria-pressed={d === selected}
              className={[
                'month-day',
                d.startsWith(month) ? '' : 'other-month',
                d === today ? 'today' : '',
                d === selected ? 'selected' : '',
                dayHours(d, hours) ? '' : 'closed',
              ].join(' ')}
              onClick={() => {
                if (!d.startsWith(month)) onMonth(d.slice(0, 7));
                onSelect(d);
              }}
            >
              <span className="month-day-number">{Number(d.slice(8))}</span>
              <span className="month-day-counts">
                {!!c?.pending && (
                  <span className="count pending">{c.pending}</span>
                )}
                {!!c?.done && <span className="count done">{c.done}</span>}
              </span>
            </button>
          );
        })}
      </div>
      <div className="month-legend">
        <span>
          <i className="count pending" /> Pendiente
        </span>
        <span>
          <i className="count done" /> Atendida
        </span>
        <span>
          <i className="legend-today" /> Hoy
        </span>
      </div>
    </section>
  );
}
