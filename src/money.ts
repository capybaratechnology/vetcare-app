import { localDate, type Data, type Expense, type Payment } from './domain';
// Cash register, payments and expenses. Real mode calls the database functions of
// 202610080001_services_cash.sql; demo mode applies the same rules in memory.
export const PAYMENT_METHODS = ['Efectivo', 'Yape/Plin', 'Tarjeta', 'Transferencia'];
export const SERVICE_CATEGORIES = [
  'Consultas',
  'Prevención',
  'Baño y estética',
  'Cirugía',
  'Otros',
];
export const EXPENSE_CATEGORIES = [
  'Insumos',
  'Medicamentos',
  'Alquiler',
  'Servicios básicos',
  'Sueldos',
  'Mantenimiento',
  'Marketing',
  'Otros',
];
const pen = new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' });
export const soles = (n: number | null | undefined) => pen.format(Number(n || 0));
export const round2 = (n: number) => Math.round(n * 100) / 100;
export type ChargeItem = {
  service_id: string | null;
  description: string;
  quantity: number;
  unit_price: number;
};
export type MoneyCall =
  | { fn: 'open_cash_session'; args: { p_amount: number } }
  | { fn: 'close_cash_session'; args: { p_counted: number; p_notes: string } }
  | {
      fn: 'create_payment';
      args: {
        p_appointment: string | null;
        p_client: string | null;
        p_pet: string | null;
        p_items: ChargeItem[];
        p_discount: number;
        p_method: string;
        p_notes: string;
      };
    }
  | { fn: 'void_payment'; args: { p_payment: string; p_reason: string } }
  | {
      fn: 'create_expense';
      args: {
        p_spent_on: string;
        p_category: string;
        p_description: string;
        p_amount: number;
        p_method: string;
      };
    }
  | { fn: 'void_expense'; args: { p_expense: string; p_reason: string } };
export const openSession = (data: Data) =>
  data.cash_sessions.find((s) => !s.closed_at) || null;
export const paidFor = (data: Data, appointmentId: string) =>
  data.payments.find((p) => p.appointment_id === appointmentId && p.status === 'paid');
// Opening + cash payments - cash expenses of a session (mirrors session_expected_cash).
export function expectedCash(data: Data, sessionId: string) {
  const s = data.cash_sessions.find((x) => x.id === sessionId);
  if (!s) return 0;
  const cashIn = data.payments
    .filter((p) => p.session_id === sessionId && p.status === 'paid' && p.method === 'Efectivo')
    .reduce((t, p) => t + Number(p.total), 0);
  const cashOut = data.expenses
    .filter((e) => e.session_id === sessionId && e.status === 'active' && e.method === 'Efectivo')
    .reduce((t, e) => t + Number(e.amount), 0);
  return round2(Number(s.opening_amount) + cashIn - cashOut);
}
// Demo-mode mirror of the database functions: same checks and messages.
export function applyLocal(
  data: Data,
  call: MoneyCall,
  userId: string,
  isAdmin: boolean,
): { data: Data; result: unknown } {
  const now = new Date().toISOString();
  const fail = (m: string) => {
    throw Error(m);
  };
  const open = openSession(data);
  switch (call.fn) {
    case 'open_cash_session': {
      if (!(call.args.p_amount >= 0)) fail('Indica el monto inicial de la caja');
      if (open) fail('La caja ya está abierta');
      const s = {
        id: crypto.randomUUID(),
        opened_at: now,
        opened_by: userId,
        opening_amount: round2(call.args.p_amount),
        closed_at: null,
        closed_by: null,
        expected_cash: null,
        counted_cash: null,
        notes: '',
      };
      return { data: { ...data, cash_sessions: [...data.cash_sessions, s] }, result: s };
    }
    case 'close_cash_session': {
      if (!(call.args.p_counted >= 0)) fail('Indica el efectivo contado');
      if (!open) return fail('No hay una caja abierta') as never;
      const s = {
        ...open,
        closed_at: now,
        closed_by: userId,
        counted_cash: round2(call.args.p_counted),
        expected_cash: expectedCash(data, open.id),
        notes: call.args.p_notes.slice(0, 500),
      };
      return {
        data: { ...data, cash_sessions: data.cash_sessions.map((x) => (x.id === s.id ? s : x)) },
        result: s,
      };
    }
    case 'create_payment': {
      const a = call.args;
      if (!open) return fail('Abre la caja antes de cobrar') as never;
      if (!PAYMENT_METHODS.includes(a.p_method)) fail('Elige un medio de pago válido');
      if (!a.p_items.length || a.p_items.length > 30) fail('Agrega al menos un servicio');
      let pet = a.p_pet,
        client = a.p_client;
      if (a.p_appointment) {
        const appt = data.appointments.find((x) => x.id === a.p_appointment);
        if (!appt) fail('La cita no existe');
        if (appt!.status !== 'completed') fail('Solo se cobran citas atendidas');
        if (paidFor(data, appt!.id)) fail('Esta cita ya fue cobrada');
        pet = appt!.pet_id;
        client = data.pets.find((p) => p.id === pet)?.client_id || null;
      } else if (pet) client = data.pets.find((p) => p.id === pet)?.client_id || null;
      for (const i of a.p_items)
        if (
          !(i.quantity >= 1 && i.quantity <= 999) ||
          !(i.unit_price >= 0) ||
          !i.description.trim()
        )
          fail('Revisa los servicios del cobro');
      const subtotal = round2(
        a.p_items.reduce((t, i) => t + i.quantity * round2(i.unit_price), 0),
      );
      if (a.p_discount < 0 || a.p_discount > subtotal)
        fail('El descuento no puede superar el subtotal');
      const payment: Payment = {
        id: crypto.randomUUID(),
        number: data.payments.reduce((m, p) => Math.max(m, p.number), 0) + 1,
        session_id: open.id,
        appointment_id: a.p_appointment,
        client_id: client,
        pet_id: pet,
        subtotal,
        discount: round2(a.p_discount),
        total: round2(subtotal - a.p_discount),
        method: a.p_method,
        notes: a.p_notes.slice(0, 500),
        status: 'paid',
        void_reason: null,
        created_by: userId,
        created_at: now,
      };
      const items = a.p_items.map((i) => ({
        id: crypto.randomUUID(),
        payment_id: payment.id,
        service_id: i.service_id,
        description: i.description.trim(),
        quantity: i.quantity,
        unit_price: round2(i.unit_price),
        amount: round2(i.quantity * round2(i.unit_price)),
      }));
      return {
        data: {
          ...data,
          payments: [...data.payments, payment],
          payment_items: [...data.payment_items, ...items],
        },
        result: payment,
      };
    }
    case 'void_payment': {
      const p = data.payments.find((x) => x.id === call.args.p_payment);
      if (call.args.p_reason.trim().length < 3) fail('Indica el motivo de la anulación');
      if (!p || p.status !== 'paid') return fail('El cobro no existe o ya fue anulado') as never;
      const closed = data.cash_sessions.find((s) => s.id === p.session_id)?.closed_at;
      if (!isAdmin && closed)
        fail('Solo un administrador puede anular cobros de una caja cerrada');
      const next = { ...p, status: 'void', void_reason: call.args.p_reason.trim() };
      return {
        data: { ...data, payments: data.payments.map((x) => (x.id === p.id ? next : x)) },
        result: next,
      };
    }
    case 'create_expense': {
      const a = call.args;
      if (!a.p_spent_on || a.p_spent_on > localDate()) fail('La fecha del gasto no puede ser futura');
      if (!(a.p_amount > 0)) fail('El monto debe ser mayor que cero');
      if (a.p_description.trim().length < 2) fail('Describe el gasto');
      const e: Expense = {
        id: crypto.randomUUID(),
        spent_on: a.p_spent_on,
        category: a.p_category,
        description: a.p_description.trim(),
        amount: round2(a.p_amount),
        method: a.p_method,
        session_id: a.p_method === 'Efectivo' && open ? open.id : null,
        status: 'active',
        void_reason: null,
        created_by: userId,
        created_at: now,
      };
      return { data: { ...data, expenses: [...data.expenses, e] }, result: e };
    }
    case 'void_expense': {
      const e = data.expenses.find((x) => x.id === call.args.p_expense);
      if (call.args.p_reason.trim().length < 3) fail('Indica el motivo de la anulación');
      if (!e || e.status !== 'active') return fail('El gasto no existe o ya fue anulado') as never;
      if (!isAdmin && !(open && e.session_id === open.id))
        fail('Solo un administrador puede anular este gasto');
      const next = { ...e, status: 'void', void_reason: call.args.p_reason.trim() };
      return {
        data: { ...data, expenses: data.expenses.map((x) => (x.id === e.id ? next : x)) },
        result: next,
      };
    }
  }
}
