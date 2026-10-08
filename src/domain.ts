export const TIMEZONE = import.meta.env?.VITE_CLINIC_TIMEZONE || 'America/Lima';
export const SERVICES = [
  'Consulta general',
  'Vacunación',
  'Control de tratamiento',
  'Desparasitación',
];
export function localDate(date = new Date(), tz = TIMEZONE) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}
export function clock(iso: string) {
  return new Intl.DateTimeFormat('es-PE', {
    timeZone: TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso));
}
export function dateLabel(iso: string) {
  return new Intl.DateTimeFormat('es-PE', {
    timeZone: TIMEZONE,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso.includes('T') ? iso : iso + 'T12:00:00Z'));
}
export function zonedISO(day: string, time: string, tz = TIMEZONE) {
  const date = new Date(day + 'T' + time + ':00Z');
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const p = Object.fromEntries(parts.map((x) => [x.type, x.value]));
  const shifted = new Date(
    p.year +
      '-' +
      p.month +
      '-' +
      p.day +
      'T' +
      p.hour +
      ':' +
      p.minute +
      ':' +
      p.second +
      'Z',
  );
  return new Date(
    date.getTime() + date.getTime() - shifted.getTime(),
  ).toISOString();
}
export function validPhone(phone: string) {
  return /^\+[1-9]\d{7,14}$/.test(phone);
}
// Opening hours, Monday first; null = closed. Appointments are 30-minute blocks.
export type DayHours = { open: string; close: string } | null;
export type Hours = DayHours[];
export const DAY_NAMES = [
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
  'Domingo',
];
export const DEFAULT_HOURS: Hours = [
  ...Array.from({ length: 6 }, () => ({ open: '09:00', close: '18:00' })),
  null,
];
// Every half hour of the day, "00:00" to "23:30".
export const HALF_HOURS = Array.from(
  { length: 48 },
  (_, i) =>
    String(Math.floor(i / 2)).padStart(2, '0') + ':' + (i % 2 ? '30' : '00'),
);
export function dayHours(day: string, hours: Hours) {
  return hours[(new Date(day + 'T12:00:00Z').getUTCDay() + 6) % 7] ?? null;
}
// Start times of the 30-minute blocks of a day; the last one ends at closing.
export function slotTimes(day: string, hours: Hours) {
  const h = dayHours(day, hours);
  return h ? HALF_HOURS.filter((t) => t >= h.open && t < h.close) : [];
}
export function slotsForDay(day: string, occupied: string[], hours: Hours) {
  return slotTimes(day, hours)
    .map((t) => zonedISO(day, t))
    .filter(
      (x) =>
        new Date(x).getTime() > Date.now() + 7200000 && !occupied.includes(x),
    );
}
// "Lunes a viernes 09:00–18:00 · Sábado 09:00–13:00": consecutive days with equal hours are grouped.
export function hoursSummary(hours: Hours) {
  const parts: string[] = [];
  for (let i = 0; i < 7; ) {
    const h = hours[i];
    let j = i;
    while (
      j + 1 < 7 &&
      JSON.stringify(hours[j + 1]) === JSON.stringify(h)
    )
      j++;
    if (h) {
      const days =
        i === j
          ? DAY_NAMES[i]
          : DAY_NAMES[i] + (j === i + 1 ? ' y ' : ' a ') + DAY_NAMES[j].toLowerCase();
      parts.push(days + ' ' + h.open + '–' + h.close);
    }
    i = j + 1;
  }
  return parts.join(' · ') || 'Sin horario de atención';
}
export type Client = {
  id: string;
  name: string;
  phone: string;
  email: string;
  consent: boolean;
  created_at?: string;
};
export type Pet = {
  id: string;
  client_id: string;
  name: string;
  species: string;
  breed: string;
  birth_date: string | null;
  sex: string;
  weight: number | null;
  allergies: string;
};
export type Appointment = {
  id: string;
  pet_id: string;
  starts_at: string;
  reason: string;
  status: string;
  source: string;
  reminder_state: string;
};
export type MedicalRecord = {
  id: string;
  pet_id: string;
  visit_date: string;
  diagnosis: string;
  notes: string;
  weight: number | null;
  appointment_id?: string | null;
  created_at?: string;
};
export type Control = {
  id: string;
  pet_id: string;
  kind: string;
  name: string;
  applied_on: string;
  next_due: string | null;
  notes: string;
  status: string;
};
export type Service = {
  id: string;
  name: string;
  category: string;
  description: string;
  price?: number; // never sent to the public landing
  variable_price: boolean;
  show_on_landing: boolean;
  bookable: boolean;
  active: boolean;
  sort: number;
};
export type CashSession = {
  id: string;
  opened_at: string;
  opened_by: string;
  opening_amount: number;
  closed_at: string | null;
  closed_by: string | null;
  expected_cash: number | null;
  counted_cash: number | null;
  notes: string;
};
export type Payment = {
  id: string;
  number: number;
  session_id: string;
  appointment_id: string | null;
  client_id: string | null;
  pet_id: string | null;
  subtotal: number;
  discount: number;
  total: number;
  method: string;
  notes: string;
  status: string;
  void_reason: string | null;
  created_by: string;
  created_at: string;
};
export type PaymentItem = {
  id: string;
  payment_id: string;
  service_id: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
};
export type Expense = {
  id: string;
  spent_on: string;
  category: string;
  description: string;
  amount: number;
  method: string;
  session_id: string | null;
  status: string;
  void_reason: string | null;
  created_by: string;
  created_at: string;
};
export type Data = {
  clients: Client[];
  pets: Pet[];
  appointments: Appointment[];
  medical_records: MedicalRecord[];
  controls: Control[];
  services: Service[];
  cash_sessions: CashSession[];
  payments: Payment[];
  payment_items: PaymentItem[];
  expenses: Expense[];
};
export type Table = keyof Data;
export const emptyData: Data = {
  clients: [],
  pets: [],
  appointments: [],
  medical_records: [],
  controls: [],
  services: [],
  cash_sessions: [],
  payments: [],
  payment_items: [],
  expenses: [],
};
// Same catalog the services migration seeds, with sample prices for the demo.
export function demoServices(): Service[] {
  return (
    [
      ['Consulta general', 'Consultas', 'Evaluación clínica, orientación y seguimiento de su salud.', 50, false, true],
      ['Control de tratamiento', 'Consultas', 'Seguimiento de un tratamiento en curso.', 35, false, true],
      ['Vacunación', 'Prevención', 'Aplicación de vacunas y registro de su carné.', 60, false, true],
      ['Desparasitación', 'Prevención', 'Desparasitación interna y externa.', 30, false, true],
      ['Baño normal', 'Baño y estética', 'Baño con champú para su tipo de pelaje.', 35, false, true],
      ['Baño medicado', 'Baño y estética', 'Baño con champú medicado indicado por el veterinario.', 45, false, true],
      ['Corte de pelaje', 'Baño y estética', 'Corte y arreglo del pelaje.', 40, false, true],
      ['Corte de uñas', 'Baño y estética', 'Corte y limado de uñas.', 15, false, true],
      ['Cirugía', 'Cirugía', 'Intervenciones quirúrgicas según el diagnóstico del médico veterinario.', 300, true, false],
    ] as const
  ).map(([name, category, description, price, variable_price, bookable], i) => ({
    id: 's' + (i + 1),
    name,
    category,
    description,
    price,
    variable_price,
    show_on_landing: true,
    bookable,
    active: true,
    sort: (i + 1) * 10,
  }));
}
export function demoData(): Data {
  const today = localDate();
  return {
    clients: [
      {
        id: 'c1',
        name: 'Valeria Mendoza',
        phone: '+51900000001',
        email: 'valeria@example.com',
        consent: true,
      },
      {
        id: 'c2',
        name: 'Diego Flores',
        phone: '+51900000002',
        email: 'diego@example.com',
        consent: true,
      },
      {
        id: 'c3',
        name: 'Camila Rojas',
        phone: '+51900000003',
        email: 'camila@example.com',
        consent: false,
      },
      // Same phone as c1, as a repeat web booking would leave it.
      {
        id: 'c4',
        name: 'Valeria M.',
        phone: '+51900000001',
        email: '',
        consent: true,
        created_at: '2026-09-01T15:00:00Z',
      },
    ],
    pets: [
      {
        id: 'p4',
        client_id: 'c4',
        name: 'luna',
        species: 'Perro',
        breed: '',
        birth_date: null,
        sex: 'No registrado',
        weight: null,
        allergies: '',
      },
      {
        id: 'p1',
        client_id: 'c1',
        name: 'Luna',
        species: 'Perro',
        breed: 'Golden retriever',
        birth_date: '2022-04-12',
        sex: 'Hembra',
        weight: 26.4,
        allergies: 'Sin alergias registradas',
      },
      {
        id: 'p2',
        client_id: 'c2',
        name: 'Milo',
        species: 'Gato',
        breed: 'Siamés',
        birth_date: '2023-08-10',
        sex: 'Macho',
        weight: 4.2,
        allergies: 'Sin alergias registradas',
      },
      {
        id: 'p3',
        client_id: 'c3',
        name: 'Rocky',
        species: 'Perro',
        breed: 'Bulldog francés',
        birth_date: '2021-11-02',
        sex: 'Macho',
        weight: 11.8,
        allergies: 'Alergia alimentaria en evaluación',
      },
    ],
    appointments: [
      {
        id: 'a1',
        pet_id: 'p1',
        starts_at: zonedISO(today, '09:00'),
        reason: 'Consulta general',
        status: 'confirmed',
        source: 'staff',
        reminder_state: 'pending',
      },
      {
        id: 'a2',
        pet_id: 'p2',
        starts_at: zonedISO(today, '10:00'),
        reason: 'Vacunación',
        status: 'confirmed',
        source: 'web',
        reminder_state: 'pending',
      },
      {
        id: 'a3',
        pet_id: 'p3',
        starts_at: zonedISO(today, '11:30'),
        reason: 'Control de tratamiento',
        status: 'completed',
        source: 'staff',
        reminder_state: 'pending',
      },
    ],
    medical_records: [
      {
        id: 'm1',
        pet_id: 'p1',
        visit_date: '2026-08-20',
        diagnosis: 'Consulta preventiva',
        notes:
          'Paciente activo. Se registra evaluación general y se programa control.',
        weight: 26.4,
      },
      {
        id: 'm2',
        pet_id: 'p3',
        visit_date: '2026-08-26',
        diagnosis: 'Control dermatológico',
        notes:
          'Seguimiento de prurito. Evolución registrada para la próxima consulta.',
        weight: 11.8,
      },
    ],
    controls: [
      {
        id: 'v1',
        pet_id: 'p1',
        kind: 'Vacuna',
        name: 'Vacuna antirrábica',
        applied_on: '2025-09-10',
        next_due: today,
        notes: 'Revisar carné en la próxima visita.',
        status: 'active',
      },
      {
        id: 'v2',
        pet_id: 'p2',
        kind: 'Vacuna',
        name: 'Triple felina',
        applied_on: '2026-08-15',
        next_due: today,
        notes: 'Control programado.',
        status: 'active',
      },
      {
        id: 'v3',
        pet_id: 'p3',
        kind: 'Tratamiento',
        name: 'Seguimiento dermatológico',
        applied_on: '2026-08-26',
        next_due: today,
        notes: 'Reevaluación clínica, sin prescripción automática.',
        status: 'active',
      },
    ],
    services: demoServices(),
    cash_sessions: [],
    payments: [],
    payment_items: [],
    expenses: [],
  };
}

// Clients sharing a phone, oldest first. Web bookings never link to an existing file,
// so staff merge these by hand.
export function duplicateGroups(clients: Client[]) {
  const groups = new Map<string, Client[]>();
  for (const c of clients) groups.set(c.phone, [...(groups.get(c.phone) || []), c]);
  return new Map(
    [...groups].filter(([, g]) => g.length > 1).map(([phone, g]) => [
      phone,
      [...g].sort((a, b) => (a.created_at || '').localeCompare(b.created_at || '')),
    ]),
  );
}
// Demo-mode mirror of the merge_clients database function.
export function mergeClientsLocal(
  data: Data,
  keepId: string,
  mergeId: string,
  mergePets: boolean,
): Data {
  const keep = data.clients.find((c) => c.id === keepId);
  const merge = data.clients.find((c) => c.id === mergeId);
  if (!keep || !merge || keepId === mergeId) return data;
  const same = (a: string, b: string) =>
    a.trim().toLocaleLowerCase() === b.trim().toLocaleLowerCase();
  let pets = data.pets;
  const moved: Record<string, string> = {};
  for (const p of data.pets.filter((x) => x.client_id === mergeId)) {
    const target = mergePets
      ? pets.find(
          (x) => x.client_id === keepId && x.species === p.species && same(x.name, p.name),
        )
      : undefined;
    if (!target) {
      pets = pets.map((x) => (x.id === p.id ? { ...x, client_id: keepId } : x));
      continue;
    }
    moved[p.id] = target.id;
    pets = pets
      .filter((x) => x.id !== p.id)
      .map((x) =>
        x.id === target.id
          ? {
              ...x,
              breed: x.breed || p.breed,
              birth_date: x.birth_date ?? p.birth_date,
              sex: x.sex === 'No registrado' ? p.sex : x.sex,
              weight: x.weight ?? p.weight,
              allergies:
                !x.allergies || !p.allergies || x.allergies === p.allergies
                  ? x.allergies || p.allergies
                  : x.allergies + '\n' + p.allergies,
            }
          : x,
      );
  }
  const repoint = <T extends { pet_id: string }>(rows: T[]) =>
    rows.map((r) => (moved[r.pet_id] ? { ...r, pet_id: moved[r.pet_id] } : r));
  const newer = (merge.created_at || '') > (keep.created_at || '');
  return {
    ...data,
    clients: data.clients
      .filter((c) => c.id !== mergeId)
      .map((c) =>
        c.id === keepId
          ? {
              ...c,
              email: c.email || merge.email,
              consent: newer ? merge.consent : c.consent,
            }
          : c,
      ),
    pets,
    appointments: repoint(data.appointments),
    medical_records: repoint(data.medical_records),
    controls: repoint(data.controls),
  };
}
