import { useState, useEffect, useCallback } from 'react';
import {
  Button,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Checkbox,
  FormControlLabel,
  Alert,
  Snackbar,
  Drawer,
  IconButton,
  CircularProgress,
  Table as MuiTable,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TableContainer,
  InputAdornment,
} from '@mui/material';
import Pets from '@mui/icons-material/Pets';
import Add from '@mui/icons-material/Add';
import CalendarMonth from '@mui/icons-material/CalendarMonth';
import PeopleOutline from '@mui/icons-material/PeopleOutline';
import SpaceDashboardOutlined from '@mui/icons-material/SpaceDashboardOutlined';
import MedicalServicesOutlined from '@mui/icons-material/MedicalServicesOutlined';
import HealthAndSafetyOutlined from '@mui/icons-material/HealthAndSafetyOutlined';
import ArrowOutward from '@mui/icons-material/ArrowOutward';
import Search from '@mui/icons-material/Search';
import Close from '@mui/icons-material/Close';
import EditOutlined from '@mui/icons-material/EditOutlined';
import ArrowForward from '@mui/icons-material/ArrowForward';
import Logout from '@mui/icons-material/Logout';
import ArrowBack from '@mui/icons-material/ArrowBack';
import ChevronLeft from '@mui/icons-material/ChevronLeft';
import ChevronRight from '@mui/icons-material/ChevronRight';
import MenuIcon from '@mui/icons-material/Menu';
import CheckCircleOutline from '@mui/icons-material/CheckCircleOutline';
import Schedule from '@mui/icons-material/Schedule';
import InfoOutlined from '@mui/icons-material/InfoOutlined';
import { supabase, fetchData, saveRow } from './data';
import {
  demoData,
  emptyData,
  localDate,
  dateLabel,
  clock,
  zonedISO,
  validPhone,
  TIMEZONE,
  slotTimes,
  dayHours,
  hoursSummary,
  duplicateGroups,
  mergeClientsLocal,
  type Data,
  type Table,
  type Pet,
  type Payment,
  type Service,
  demoServices,
} from './domain';
import Landing from './Landing';
import Login from './Login';
import Users from './Users';
import Settings from './Settings';
import MergeClients from './MergeClients';
import MonthCalendar, { type DayCount } from './MonthCalendar';
import { ClientPicker, PetPicker } from './Pickers';
import ClientPets, { blankPet, petToDraft, type PetDraft } from './ClientPets';
import { ColorModeToggle, setForcedLight } from './colorMode';
import Services from './Services';
import Cash from './Cash';
import Expenses from './Expenses';
import Reports from './Reports';
import { ChargeDialog, ReceiptDialog } from './Charge';
import HistoryPrint, { printHistory } from './HistoryPrint';
import PrintOutlined from '@mui/icons-material/PrintOutlined';
import { applyLocal, paidFor, type MoneyCall } from './money';
import PointOfSaleOutlined from '@mui/icons-material/PointOfSaleOutlined';
import ReceiptLongOutlined from '@mui/icons-material/ReceiptLongOutlined';
import AssessmentOutlined from '@mui/icons-material/AssessmentOutlined';
import SellOutlined from '@mui/icons-material/SellOutlined';
import { Brand, DEFAULT_CLINIC, fetchClinic, type Clinic } from './clinic';
import StorefrontOutlined from '@mui/icons-material/StorefrontOutlined';
import {
  demoAccounts,
  authenticateDemo,
  canAccess,
  type DemoUser,
} from './access';
import AdminPanelSettingsOutlined from '@mui/icons-material/AdminPanelSettingsOutlined';
const nav = [
  { Icon: SpaceDashboardOutlined, label: 'Resumen' },
  { Icon: AdminPanelSettingsOutlined, label: 'Usuarios' },
  { Icon: CalendarMonth, label: 'Citas' },
  { Icon: PeopleOutline, label: 'Clientes' },
  { Icon: Pets, label: 'Mascotas' },
  { Icon: MedicalServicesOutlined, label: 'Historial médico' },
  { Icon: HealthAndSafetyOutlined, label: 'Vacunas y tratamientos' },
  { Icon: PointOfSaleOutlined, label: 'Caja' },
  { Icon: ReceiptLongOutlined, label: 'Gastos' },
  { Icon: AssessmentOutlined, label: 'Reportes' },
  { Icon: SellOutlined, label: 'Servicios' },
  { Icon: StorefrontOutlined, label: 'Configuración' },
];
// Citas calendar wording: yellow = pending, green = attended.
const calendarLabels: Record<string, string> = {
  confirmed: 'Pendiente',
  completed: 'Atendida',
};
const statusLabels: Record<string, string> = {
  confirmed: 'Confirmada',
  completed: 'Completada',
  cancelled: 'Cancelada',
  no_show: 'No asistió',
  active: 'En seguimiento',
  pending: 'Pendiente',
  sending: 'En proceso',
  accepted: 'Aceptado por WhatsApp',
  failed: 'Error de envío',
  uncertain: 'Revisar envío',
  skipped: 'Omitido',
};
const errText = (e: unknown) => {
  const x = e as { message?: string; code?: string };
  return x.code === '23505'
    ? 'Ese horario ya está ocupado. Elige otro.'
    : x.code === '42501'
      ? 'Tu cuenta no tiene permiso para esta operación.'
      : x.message || 'No se pudo completar la operación. Vuelve a intentarlo.';
};
type FormSpec = { table: Table; id?: string; values: Record<string, unknown> };
export default function App() {
  const [page, setPage] = useState(
    decodeURIComponent(location.hash.slice(1)) || 'landing',
  );
  const [data, setData] = useState<Data>(() =>
    supabase ? emptyData : demoData(),
  );
  const [session, setSession] = useState<boolean | null>(
    supabase ? null : false,
  );
  const [role, setRole] = useState('');
  const [userId, setUserId] = useState('');
  const [demoUsers, setDemoUsers] = useState<DemoUser[]>(demoAccounts);
  const [clinic, setClinic] = useState<Clinic>(DEFAULT_CLINIC);
  const [clinicLoaded, setClinicLoaded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mergePhone, setMergePhone] = useState('');
  // Charge dialog: undefined = closed, null = walk-in sale, string = appointment being charged.
  const [charging, setCharging] = useState<string | null | undefined>(undefined);
  const [receipt, setReceipt] = useState<Payment | null>(null);
  const [publicServices, setPublicServices] = useState<Service[]>(() =>
    supabase ? [] : demoServices(),
  );
  const [userName, setUserName] = useState('Equipo de demostración');
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  // Citas: month shown in the calendar and the day picked in it (none until clicked).
  const [month, setMonth] = useState(localDate().slice(0, 7));
  const [day, setDay] = useState(localDate());
  // Citas shows the month calendar first; picking a day opens that day's page.
  const [dayView, setDayView] = useState(false);
  const [form, setForm] = useState<FormSpec | null>(null);
  const [detail, setDetail] = useState<Pet | null>(null);
  const [snack, setSnack] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const [confirm, setConfirm] = useState<{ id: string; status: string } | null>(
    null,
  );
  const demo = !supabase,
    clinical = role === 'admin' || role === 'vet',
    cashier = role === 'admin' || role === 'reception';
  const navigate = useCallback((p: string) => {
    location.hash = p;
    setPage(p);
    setSearch('');
  }, []);
  const reload = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    try {
      setData(await fetchData());
      setLoadError('');
    } catch (e) {
      setLoadError(errText(e));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    let alive = true;
    void fetchClinic().then((c) => {
      if (!alive) return;
      setClinic(c);
      setClinicLoaded(true);
    });
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => {
    if (!supabase) return;
    let alive = true;
    // Anonymous read: the services table only exposes non-price columns to visitors.
    void supabase
      .from('services')
      .select('id,name,category,description,variable_price,show_on_landing,bookable,active,sort')
      .order('sort')
      .then(({ data: rows }) => alive && rows && setPublicServices(rows as Service[]));
    return () => {
      alive = false;
    };
  }, []);
  // The public landing always shows in light mode; the staff's saved choice applies elsewhere.
  useEffect(() => {
    setForcedLight(page === 'landing');
  }, [page]);
  useEffect(() => {
    document.title = clinic.name + ' · Gestión veterinaria';
  }, [clinic.name]);
  useEffect(() => {
    const h = () => {
      setPage(decodeURIComponent(location.hash.slice(1)) || 'landing');
      setSearch('');
    };
    window.addEventListener('hashchange', h);
    return () => window.removeEventListener('hashchange', h);
  }, []);
  useEffect(() => {
    if (!supabase) return;
    let alive = true;
    const set = (s: boolean) => {
      if (alive) {
        setSession(s);
        if (!s) {
          setData(emptyData);
          setRole('');
          setDetail(null);
          setForm(null);
        }
      }
    };
    supabase.auth.getSession().then(({ data, error }) => {
      if (error) setLoadError(errText(error));
      set(!!data.session);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_e, s) => set(!!s));
    return () => {
      alive = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session || !supabase) return;
    let alive = true;
    let checking = false;
    async function verify() {
      if (checking) return;
      checking = true;
      try {
        const {
          data: { user },
          error: authError,
        } = await supabase!.auth.getUser();
        if (authError || !user) throw Error('No se pudo verificar tu sesión.');
        const { data: staff, error } = await supabase!
          .from('staff')
          .select('name,role,active')
          .eq('user_id', user.id)
          .maybeSingle();
        if (!alive) return;
        if (error || !staff || !staff.active)
          throw Error(
            'Tu cuenta no tiene acceso activo a esta clínica. Contacta al administrador.',
          );
        setUserId(user.id);
        setRole(staff.role);
        setUserName(staff.name);
        setLoadError('');
        await reload();
      } catch (e) {
        if (alive) {
          setRole('');
          setData(emptyData);
          setDetail(null);
          setForm(null);
          setLoadError(errText(e));
        }
      } finally {
        checking = false;
      }
    }
    void verify();
    // Supabase Realtime instead of polling: reload only when a readable row changes.
    let timer: number | undefined;
    const refresh = () => {
      clearTimeout(timer);
      // Batch bursts of events (e.g. a booking creates client, pet and appointment).
      timer = window.setTimeout(() => {
        if (alive) void reload();
      }, 400);
    };
    let subscribed = false;
    const channel = supabase.channel('vetcare-changes');
    for (const table of [
      'appointments',
      'clients',
      'pets',
      'medical_records',
      'controls',
    ])
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, refresh);
    channel
      // Profile or access changes (e.g. deactivation) are rechecked at once.
      .on('postgres_changes', { event: '*', schema: 'public', table: 'staff' }, () => {
        void verify();
      })
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'clinic_settings' },
        () => {
          void fetchClinic().then((c) => alive && setClinic(c));
        },
      )
      .subscribe((status) => {
        // After a reconnection (sleep, network loss) reload what may have been missed.
        if (status === 'SUBSCRIBED') {
          if (subscribed) refresh();
          subscribed = true;
        }
      });
    return () => {
      alive = false;
      clearTimeout(timer);
      void supabase!.removeChannel(channel);
    };
  }, [session, reload]);
  useEffect(() => {
    if (session === false && page !== 'landing' && page !== 'login')
      navigate('login');
    if (session && role && page === 'login') navigate('Resumen');
  }, [session, role, page, navigate]);
  useEffect(() => {
    if (!demo || !session) return;
    const current = demoUsers.find((u) => u.user_id === userId && u.active);
    if (!current) {
      setSession(false);
      setRole('');
      setForm(null);
      setDetail(null);
    } else {
      setRole(current.role);
      setUserName(current.name);
    }
  }, [demo, session, userId, demoUsers]);
  useEffect(() => {
    setDetail(null);
    setForm(null);
  }, [role]);
  async function logout() {
    if (supabase) {
      const { error } = await supabase.auth.signOut();
      if (error) {
        setSnack(errText(error));
        return;
      }
    }
    setSession(false);
    setRole('');
    setUserId('');
    setDetail(null);
    setForm(null);
    navigate('login');
  }
  useEffect(() => {
    const context = (
      document as unknown as {
        modelContext?: {
          registerTool: (t: unknown, o: unknown) => Promise<void>;
        };
      }
    ).modelContext;
    if (!context) return;
    const life = new AbortController();
    Promise.resolve(
      context.registerTool(
        {
          name: 'open_vetcare_section',
          description:
            'Abre una sección de VetCare. No crea ni modifica registros.',
          inputSchema: {
            type: 'object',
            properties: {
              section: {
                type: 'string',
                enum: [
                  'Resumen',
                  'Citas',
                  'Clientes',
                  'Mascotas',
                  'Historial médico',
                  'Vacunas y tratamientos',
                  'landing',
                ],
              },
            },
            required: ['section'],
            additionalProperties: false,
          },
          annotations: { readOnlyHint: false },
          execute: (input: unknown) => {
            const section = (input as { section?: unknown })?.section;
            if (
              typeof section !== 'string' ||
              ![...nav.map((x) => x.label), 'landing'].includes(section)
            )
              throw Error('Sección no válida');
            navigate(section);
            return { section };
          },
        },
        { signal: life.signal },
      ),
    ).catch(() => {});
    return () => life.abort();
  }, [navigate]);
  const pet = (id: string) => data.pets.find((p) => p.id === id);
  const owner = (id: string) => data.clients.find((c) => c.id === id);
  const duplicates = duplicateGroups(data.clients);
  const editingClient = page === 'Clientes' && form?.table === 'clients';
  async function mergeClients(keepId: string, mergePets: boolean) {
    const others = (duplicates.get(mergePhone) || []).filter(
      (c) => c.id !== keepId,
    );
    if (demo)
      setData((d) =>
        others.reduce(
          (acc, c) => mergeClientsLocal(acc, keepId, c.id, mergePets),
          d,
        ),
      );
    else {
      for (const c of others) {
        const { error } = await supabase!.rpc('merge_clients', {
          p_keep: keepId,
          p_merge: c.id,
          p_merge_pets: mergePets,
        });
        if (error) {
          await reload();
          throw Error(errText(error));
        }
      }
      await reload();
    }
    setMergePhone('');
    setSnack(
      'Fichas unidas: ' + (others.length + 1) + ' → 1.' +
        (demo ? ' Se restablece al recargar.' : ''),
    );
  }
  // Cash register, payments and expenses go through database functions (demo: same rules in memory).
  async function moneyCall(c: MoneyCall) {
    if (demo) {
      const { data: next, result } = applyLocal(data, c, userId, role === 'admin');
      setData(next);
      return result;
    }
    const { data: result, error } = await supabase!.rpc(c.fn, c.args);
    if (error) throw Error(errText(error));
    await reload();
    return result;
  }
  const activeServices = data.services
    .filter((s) => s.active)
    .sort((a, b) => a.sort - b.sort);
  const recordFor = (appointmentId: string) =>
    data.medical_records.find((r) => r.appointment_id === appointmentId);
  const appointmentLabel = (id: string) => {
    const a = data.appointments.find((x) => x.id === id);
    return a
      ? a.reason +
          ' · ' +
          dateLabel(localDate(new Date(a.starts_at))) +
          ' ' +
          clock(a.starts_at)
      : 'cita registrada';
  };
  // Opens the consultation form already tied to the appointment it documents.
  const recordAppointment = (id: string) => {
    const a = data.appointments.find((x) => x.id === id);
    if (!a) return;
    const day = localDate(new Date(a.starts_at));
    open('medical_records', {
      pet_id: a.pet_id,
      visit_date: day > today ? today : day,
      appointment_id: a.id,
    });
  };
  const matches = (...s: unknown[]) =>
    s.join(' ').toLocaleLowerCase().includes(search.toLocaleLowerCase());
  const today = localDate();
  const matchesAppointment = (a: Data['appointments'][number]) =>
    matches(
      pet(a.pet_id)?.name,
      owner(pet(a.pet_id)?.client_id || '')?.name,
      a.reason,
    );
  const appointments = data.appointments
    .filter(
      (a) =>
        localDate(new Date(a.starts_at)) ===
          (page === 'Resumen' ? today : day) && matchesAppointment(a),
    )
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  // Pending (confirmed) and attended appointments per local day, for the calendar.
  const dayCounts: Record<string, DayCount> = {};
  for (const a of data.appointments) {
    if (!['confirmed', 'completed'].includes(a.status) || !matchesAppointment(a))
      continue;
    const d = localDate(new Date(a.starts_at));
    dayCounts[d] ??= { pending: 0, done: 0 };
    if (a.status === 'confirmed') dayCounts[d].pending++;
    else dayCounts[d].done++;
  }
  // One row per patient with consultations, most recent visit first.
  const historyPatients = data.pets
    .map((p) => ({
      p,
      records: data.medical_records
        .filter((r) => r.pet_id === p.id)
        .sort((a, b) => b.visit_date.localeCompare(a.visit_date)),
    }))
    .filter(
      ({ p, records }) =>
        records.length &&
        matches(
          p.name,
          owner(p.client_id)?.name,
          ...records.map((r) => r.diagnosis + ' ' + r.notes),
        ),
    )
    .sort((a, b) =>
      b.records[0].visit_date.localeCompare(a.records[0].visit_date),
    );
  const due = data.controls
    .filter((c) => c.status === 'active' && c.next_due)
    .sort((a, b) => (a.next_due || '').localeCompare(b.next_due || ''));
  function open(
    table: Table,
    values: Record<string, unknown> = {},
    id?: string,
  ) {
    setFormError('');
    const defaults: Record<Table, Record<string, unknown>> = {
      clients: { name: '', phone: '+51', email: '', consent: false },
      pets: {
        client_id: '',
        name: '',
        species: 'Perro',
        breed: '',
        birth_date: '',
        sex: 'No registrado',
        weight: '',
        allergies: '',
      },
      appointments: {
        pet_id: '',
        day: today,
        time: slotTimes(today, clinic.hours)[0] || '',
        reason: activeServices[0]?.name || '',
        status: 'confirmed',
        source: 'staff',
      },
      medical_records: {
        pet_id: '',
        visit_date: today,
        diagnosis: '',
        notes: '',
        weight: '',
      },
      controls: {
        pet_id: '',
        kind: 'Vacuna',
        name: '',
        applied_on: today,
        next_due: '',
        notes: '',
        status: 'active',
      },
      services: {},
      cash_sessions: {},
      payments: {},
      payment_items: {},
      expenses: {},
    };
    if (table === 'clients') window.scrollTo({ top: 0 });
    setForm({
      table,
      id,
      values: {
        ...defaults[table],
        // The client form also manages their pets: registered ones when editing, a blank one when new.
        ...(table === 'clients'
          ? {
              pets: id
                ? data.pets.filter((p) => p.client_id === id).map(petToDraft)
                : [blankPet()],
            }
          : {}),
        ...values,
      },
    });
  }
  async function persist(
    table: Table,
    row: Record<string, unknown>,
    id?: string,
  ) {
    if (demo) {
      const result = { ...row, id: id || crypto.randomUUID() };
      setData((prev) => ({
        ...prev,
        [table]: id
          ? prev[table].map((r) => (r.id === id ? { ...r, ...row } : r))
          : [...prev[table], result],
      }));
      return result;
    }
    const result = await saveRow(table, row, id);
    await reload();
    return result;
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    setFormError('');
    try {
      const row = { ...form.values };
      delete row.id;
      delete row.created_at;
      delete row.author_id;
      if (form.table === 'pets' && !row.client_id)
        throw Error('Elige el cliente responsable.');
      if (
        !form.id &&
        ['appointments', 'medical_records', 'controls'].includes(form.table) &&
        !row.pet_id
      )
        throw Error('Elige la mascota.');
      if (form.table === 'clients' && !validPhone(String(row.phone)))
        throw Error('Usa el formato internacional: +51987654321.');
      if (form.table === 'pets') {
        row.birth_date = row.birth_date || null;
        row.weight = row.weight ? Number(row.weight) : null;
        if (row.birth_date && String(row.birth_date) > today)
          throw Error('La fecha de nacimiento no puede ser futura.');
      }
      if (form.table === 'medical_records') {
        row.weight = row.weight ? Number(row.weight) : null;
        if (!row.appointment_id) delete row.appointment_id;
        if (String(row.visit_date) > today)
          throw Error('La fecha clínica no puede ser futura.');
      }
      if (
        form.table === 'controls' &&
        row.next_due &&
        String(row.next_due) < String(row.applied_on)
      )
        throw Error(
          'El próximo control debe ser posterior a la fecha de registro.',
        );
      if (form.table === 'controls') row.next_due = row.next_due || null;
      if (form.table === 'appointments') {
        const starts_at = zonedISO(String(row.day), String(row.time));
        if (new Date(starts_at) <= new Date())
          throw Error('Selecciona un horario futuro.');
        if (!slotTimes(String(row.day), clinic.hours).includes(String(row.time)))
          throw Error(
            'Ese horario está fuera del horario de atención: ' +
              hoursSummary(clinic.hours) +
              '.',
          );
        if (
          data.appointments.some(
            (a) =>
              a.id !== form.id &&
              a.status !== 'cancelled' &&
              new Date(a.starts_at).getTime() === new Date(starts_at).getTime(),
          )
        )
          throw Error('Ese horario ya está ocupado.');
        const payload = form.id
          ? { starts_at, reason: row.reason }
          : {
              pet_id: row.pet_id,
              starts_at,
              reason: row.reason,
              status: 'confirmed',
              source: 'staff',
            };
        await persist(form.table, payload, form.id);
      } else if (form.table === 'clients') {
        // Client plus the pets edited in the same form: new blocks without a name are skipped.
        const drafts = (row.pets as PetDraft[] | undefined) || [];
        delete row.pets;
        if (drafts.some((p) => p.id && !p.name.trim()))
          throw Error('Una mascota registrada no puede quedar sin nombre.');
        const pets = drafts.filter((p) => p.name.trim());
        for (const p of pets) {
          if (p.birth_date && p.birth_date > today)
            throw Error(p.name + ': la fecha de nacimiento no puede ser futura.');
          if (p.weight && !(Number(p.weight) > 0 && Number(p.weight) < 2000))
            throw Error(p.name + ': revisa el peso.');
        }
        const saved = (await persist('clients', row, form.id)) as { id: string };
        const clientId = form.id || saved.id;
        const toRow = (p: PetDraft) => ({
          client_id: clientId,
          name: p.name.trim(),
          species: p.species,
          breed: p.breed.trim(),
          sex: p.sex,
          birth_date: p.birth_date || null,
          weight: p.weight ? Number(p.weight) : null,
          allergies: p.allergies,
        });
        const petRows = pets.filter((p) => !p.id).map(toRow);
        // Registered pets: only the ones whose data changed are updated.
        const changed = pets.filter((p) => {
          if (!p.id) return false;
          const before = data.pets.find((x) => x.id === p.id);
          return !before || JSON.stringify(petToDraft(before)) !== JSON.stringify({ ...p, key: p.id });
        });
        if (petRows.length || changed.length) {
          if (demo)
            setData((d) => ({
              ...d,
              pets: [
                ...d.pets.map((x) => {
                  const c = changed.find((p) => p.id === x.id);
                  return c ? { ...x, ...toRow(c) } : x;
                }),
                ...petRows.map((r) => ({ ...r, id: crypto.randomUUID() })),
              ],
            }));
          else {
            let error = petRows.length
              ? (await supabase!.from('pets').insert(petRows)).error
              : null;
            for (const p of changed) {
              if (error) break;
              const { client_id: _owner, ...fields } = toRow(p);
              error = (await supabase!.from('pets').update(fields).eq('id', p.id!)).error;
            }
            await reload();
            if (error) {
              // The client exists already: close so a retry does not duplicate it.
              setForm(null);
              setSnack(
                'Cliente guardado, pero no todas sus mascotas (' +
                  errText(error) +
                  '). Regístralas en Mascotas.',
              );
              return;
            }
          }
        }
        setForm(null);
        setSnack(
          (form.id ? 'Cliente actualizado' : 'Cliente registrado') +
            (petRows.length
              ? ' · ' +
                petRows.length +
                (petRows.length === 1 ? ' mascota nueva' : ' mascotas nuevas')
              : '') +
            (changed.length
              ? ' · ' +
                changed.length +
                (changed.length === 1 ? ' mascota actualizada' : ' mascotas actualizadas')
              : '') +
            '.' +
            (demo ? ' Se restablece al recargar.' : ''),
        );
        return;
      } else await persist(form.table, row, form.id);
      setForm(null);
      setSnack(
        demo
          ? 'Cambio aplicado a la demostración. Se restablece al recargar.'
          : 'Registro guardado correctamente.',
      );
    } catch (e) {
      setFormError(errText(e));
    } finally {
      setSaving(false);
    }
  }
  async function changeStatus() {
    if (!confirm) return;
    setSaving(true);
    try {
      await persist('appointments', { status: confirm.status }, confirm.id);
      setConfirm(null);
      if (confirm.status === 'completed' && clinical)
        recordAppointment(confirm.id);
      else setSnack('Estado actualizado.');
    } catch (e) {
      setSnack(errText(e));
    } finally {
      setSaving(false);
    }
  }
  const field = (
    name: string,
    label: string,
    type = 'text',
    required = true,
    options?: { value: string; label: string }[],
  ) => (
    <TextField
      key={name}
      multiline={name === 'notes' || name === 'allergies'}
      minRows={name === 'notes' || name === 'allergies' ? 3 : undefined}
      label={label}
      type={options ? undefined : type}
      select={!!options}
      required={required}
      value={form?.values[name] ?? ''}
      onChange={(e) =>
        setForm((f) =>
          f ? { ...f, values: { ...f.values, [name]: e.target.value } } : f,
        )
      }
      slotProps={{
        inputLabel: { shrink: true },
        htmlInput: {
          maxLength: name === 'notes' ? 10000 : 1000,
          ...(type === 'number' ? { min: 0.01, max: 1999, step: 0.01 } : {}),
          ...(type === 'date' && ['birth_date', 'visit_date'].includes(name)
            ? { max: today }
            : {}),
        },
      }}
    >
      {options?.map((o) => (
        <MenuItem key={o.value} value={o.value}>
          {o.label}
        </MenuItem>
      ))}
    </TextField>
  );
  const options = (values: string[]) =>
    values.map((value) => ({ value, label: value }));
  // Searchable by pet, owner or phone: dropdowns do not scale to hundreds of clients.
  const setValue = (name: string, value: unknown) =>
    setForm((f) => (f ? { ...f, values: { ...f.values, [name]: value } } : f));
  const petField = () => (
    <PetPicker
      pets={data.pets}
      clients={data.clients}
      value={(form?.values.pet_id as string) || ''}
      onChange={(id) => setValue('pet_id', id)}
      required
    />
  );
  function appointmentRow(a: Data['appointments'][number]) {
    const p = pet(a.pet_id);
    return (
            <div className="appointment-row" key={a.id}>
              <b>{clock(a.starts_at)}</b>
              <span
                className={'pet-avatar ' + (p?.species === 'Gato' ? 'cat' : '')}
              >
                <Pets />
              </span>
              <button
                className="text-link"
                onClick={() => setDetail(p || null)}
              >
                <b>{p?.name || 'Mascota'}</b>
                <small>{owner(p?.client_id || '')?.name}</small>
              </button>
              <span>
                {a.reason}
                <small>
                  {a.source === 'web' ? 'Reserva web' : 'Recepción'}
                </small>
              </span>
              <div className="appointment-actions">
                <Chip
                  size="small"
                  className={'status-' + a.status}
                  label={
                    page === 'Citas'
                      ? calendarLabels[a.status] || statusLabels[a.status]
                      : statusLabels[a.status]
                  }
                />
                {a.status === 'completed' && cashier && !paidFor(data, a.id) && (
                  <Button size="small" onClick={() => setCharging(a.id)}>
                    Cobrar
                  </Button>
                )}
                {a.status === 'completed' && clinical && !recordFor(a.id) && (
                  <Button
                    size="small"
                    color="warning"
                    startIcon={<InfoOutlined fontSize="small" />}
                    onClick={() => recordAppointment(a.id)}
                  >
                    Falta registrar consulta
                  </Button>
                )}
                {a.status === 'confirmed' && (
                  <>
                    <Button
                      size="small"
                      onClick={() =>
                        setConfirm({ id: a.id, status: 'completed' })
                      }
                    >
                      Atender
                    </Button>
                    <IconButton
                      size="small"
                      aria-label={'Reprogramar cita de ' + p?.name}
                      onClick={() =>
                        open(
                          'appointments',
                          {
                            pet_id: a.pet_id,
                            day: localDate(new Date(a.starts_at)),
                            time: clock(a.starts_at),
                            reason: a.reason,
                          },
                          a.id,
                        )
                      }
                    >
                      <EditOutlined fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      aria-label={'Cancelar cita de ' + p?.name}
                      onClick={() =>
                        setConfirm({ id: a.id, status: 'cancelled' })
                      }
                    >
                      <Close fontSize="small" />
                    </IconButton>
                  </>
                )}
                {page === 'Citas' && (
                  <small className="reminder-label">
                    {demo
                      ? 'WhatsApp: simulación'
                      : owner(p?.client_id || '')?.consent
                        ? 'WhatsApp: ' + statusLabels[a.reminder_state]
                        : 'WhatsApp: sin autorización'}
                  </small>
                )}
              </div>
            </div>
    );
  }
  function appointmentList() {
    return appointments.length ? (
      <>{appointments.map(appointmentRow)}</>
    ) : (
      <div className="empty">
        <CalendarMonth />
        <h3>Sin citas para esta fecha</h3>
        <p>Elige otro día o registra una nueva cita.</p>
        <Button onClick={() => open('appointments')}>Registrar cita</Button>
      </div>
    );
  }
  // Client form as a page (not a dialog): a client may have many pets.
  function clientFields() {
    if (!form) return null;
    return (
      <>
        {field('name', 'Nombre completo')}
        {field('phone', 'WhatsApp / Teléfono internacional', 'tel')}
        {field('email', 'Correo electrónico', 'email', false)}
        <FormControlLabel
          control={
            <Checkbox
              checked={Boolean(form.values.consent)}
              onChange={(e) =>
                setForm({
                  ...form,
                  values: {
                    ...form.values,
                    consent: e.target.checked,
                  },
                })
              }
            />
          }
          label="El cliente autorizó recordatorios de citas por WhatsApp."
        />
        {Array.isArray(form.values.pets) && (
          <ClientPets
            pets={(form.values.pets as PetDraft[]) || []}
            today={today}
            onChange={(pets) => setValue('pets', pets)}
          />
        )}
      </>
    );
  }
  // Hours of the selected day: opening-hours slots plus any appointment outside them.
  function dayAgenda() {
    const active = appointments.filter((a) => a.status !== 'cancelled');
    const cancelled = appointments.filter((a) => a.status === 'cancelled');
    const isOpen = !!dayHours(day, clinic.hours);
    const times = [
      ...new Set([
        ...(search ? [] : slotTimes(day, clinic.hours)),
        ...active.map((a) => clock(a.starts_at)),
      ]),
    ].sort();
    const goDay = (n: number) => {
      const d = new Date(day + 'T12:00:00Z');
      d.setUTCDate(d.getUTCDate() + n);
      const next = d.toISOString().slice(0, 10);
      setDay(next);
      setMonth(next.slice(0, 7));
    };
    return (
      <>
        <div className="day-nav">
          <Button startIcon={<ArrowBack />} onClick={() => setDayView(false)}>
            Volver al calendario
          </Button>
          <div>
            <IconButton aria-label="Día anterior" onClick={() => goDay(-1)}>
              <ChevronLeft />
            </IconButton>
            {day !== today && (
              <Button size="small" onClick={() => setDay(today)}>
                Hoy
              </Button>
            )}
            <IconButton aria-label="Día siguiente" onClick={() => goDay(1)}>
              <ChevronRight />
            </IconButton>
          </div>
        </div>
        <div className="section-heading">
          <div>
            <h2 className="day-title">
              {new Intl.DateTimeFormat('es-PE', {
                weekday: 'long',
                timeZone: 'UTC',
              }).format(new Date(day + 'T12:00:00Z'))}{' '}
              {dateLabel(day)}
            </h2>
            <small className="muted">
              {isOpen
                ? 'Bloques de 30 minutos · ' + TIMEZONE
                : 'La clínica no atiende este día'}
            </small>
          </div>
          {day >= today && isOpen && (
            <Button
              size="small"
              startIcon={<Add />}
              onClick={() =>
                open('appointments', {
                  day,
                  time: slotTimes(day, clinic.hours)[0] || '',
                })
              }
            >
              Nueva cita
            </Button>
          )}
        </div>
        {times.map((t) => {
          const at = active.filter((a) => clock(a.starts_at) === t);
          if (at.length)
            return at.map((a) => (
              <div className={'slot slot-' + a.status} key={a.id}>
                {appointmentRow(a)}
              </div>
            ));
          const future = new Date(zonedISO(day, t)).getTime() > Date.now();
          return (
            <div className="slot slot-free" key={t}>
              <b>{t}</b>
              <span className="muted">{future ? 'Disponible' : 'Sin cita'}</span>
              {future && (
                <Button
                  size="small"
                  onClick={() => open('appointments', { day, time: t })}
                >
                  Agendar
                </Button>
              )}
            </div>
          );
        })}
        {!times.length && (
          <div className="empty">
            <p>
              {search
                ? 'No hay citas que coincidan con la búsqueda este día.'
                : 'Sin horario de atención ni citas este día.'}
            </p>
          </div>
        )}
        {!!cancelled.length && (
          <details className="cancelled-list">
            <summary>Canceladas ({cancelled.length})</summary>
            {cancelled.map((a) => (
              <div className="slot slot-cancelled" key={a.id}>
                {appointmentRow(a)}
              </div>
            ))}
          </details>
        )}
      </>
    );
  }
  if (page === 'landing')
    return (
      <Landing
        demo={demo}
        clinic={clinic}
        services={demo ? data.services : publicServices}
        data={data}
        navigate={navigate}
        onDemoBooking={(client, p, newAppointment) => {
          setData((d) => ({
            ...d,
            clients: [...d.clients, client],
            pets: [...d.pets, p],
            appointments: [...d.appointments, newAppointment],
          }));
        }}
      />
    );
  if (session === null)
    return (
      <div className="login-wrap">
        <CircularProgress />
        <p>Verificando acceso…</p>
      </div>
    );

  if (!session)
    return (
      <Login
        demo={demo}
        clinic={clinic}
        onBack={() => navigate('landing')}
        onLogin={async (email, password) => {
          if (demo) {
            const user = authenticateDemo(demoUsers, email, password);
            setUserId(user.user_id);
            setRole(user.role);
            setUserName(user.name);
            setSession(true);
            navigate('Resumen');
            return;
          }
          const { error } = await supabase!.auth.signInWithPassword({
            email,
            password,
          });
          if (error)
            throw Error(
              'No pudimos iniciar sesión. Revisa tus credenciales y tu conexión.',
            );
          navigate('Resumen');
        }}
      />
    );
  if (!role)
    return (
      <div className="login-wrap">
        <div className="login-card">
          <h1>Verificando acceso</h1>
          {loadError ? (
            <Alert severity="warning" sx={{ mt: 2 }}>
              {loadError}
            </Alert>
          ) : (
            <CircularProgress sx={{ mt: 2 }} />
          )}
          <Button sx={{ mt: 2 }} onClick={logout}>
            Volver al login
          </Button>
        </div>
      </div>
    );
  const sidebarContent = (
    <>
      <div className="brand">
        <Brand clinic={clinic} />
      </div>
      <p className="sidebar-caption">ESPACIO DE TRABAJO</p>
      {nav
        .filter((x) => canAccess(role, x.label))
        .map(({ Icon, label }) => (
          <button
            className={'nav-item ' + (page === label ? 'active' : '')}
            key={label}
            onClick={() => {
              setMenuOpen(false);
              navigate(label);
            }}
          >
            <Icon />
            {label}
          </button>
        ))}
      <div className="sidebar-help">
        <HealthAndSafetyOutlined />
        <p>Cada ficha cuenta una historia.</p>
        <small>Todo su cuidado, conectado.</small>
      </div>
      <div className="sidebar-bottom">
        <span className="clinic-icon">
          <Pets />
        </span>
        <div>
          <b>{clinic.name}</b>
          <small>{userName}</small>
          <small>
            {role === 'admin'
              ? 'Administrador'
              : role === 'vet'
                ? 'Veterinario'
                : 'Recepción'}
          </small>
        </div>
      </div>
    </>
  );
  return (
    <div className="app-shell">
      <aside className="sidebar">{sidebarContent}</aside>
      <Drawer
        className="mobile-menu"
        anchor="left"
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        slotProps={{ paper: { className: 'sidebar mobile-sidebar' } }}
      >
        {sidebarContent}
        <Button
          className="mobile-public-link"
          endIcon={<ArrowOutward />}
          onClick={() => {
            setMenuOpen(false);
            navigate('landing');
          }}
        >
          Ver página pública
        </Button>
      </Drawer>
      <main>
        <header className="topbar">
          <IconButton
            className="menu-button"
            aria-label="Abrir menú"
            onClick={() => setMenuOpen(true)}
          >
            <MenuIcon />
          </IconButton>
          <span className="topbar-title">
            <span className="topbar-clinic">{clinic.name} /</span>{' '}
            <span className="muted">{page}</span>
          </span>
          <div>
            <Button
              className="public-link"
              endIcon={<ArrowOutward />}
              onClick={() => navigate('landing')}
            >
              Ver página pública
            </Button>
            <ColorModeToggle />
            <IconButton aria-label="Cerrar sesión" onClick={logout}>
              <Logout />
            </IconButton>
          </div>
        </header>
        <div className="page">
          <div className="page-heading">
            <div>
              <p className="eyebrow">
                {page === 'Resumen'
                  ? 'TU CLÍNICA, EN UN SOLO LUGAR'
                  : 'CUIDADO CON HISTORIA'}
              </p>
              <h1>{page === 'Resumen' ? 'Un buen día para cuidar.' : page}</h1>
              <p className="muted">
                {page === 'Resumen'
                  ? 'Tu agenda y tus pacientes, siempre a mano.'
                  : (
                      {
                        Usuarios:
                          'Administra el acceso de cada integrante del equipo.',
                        Configuración:
                          'Nombre, logo, dirección y horario de tu veterinaria.',
                        Citas: 'Organiza cada visita y su seguimiento.',
                        Clientes: 'Las familias detrás de cada paciente.',
                        Mascotas: 'Conoce a quienes están bajo tu cuidado.',
                        'Historial médico':
                          'Una historia clínica para cada paciente.',
                        'Vacunas y tratamientos':
                          'Registra aplicaciones, tratamientos y próximos controles.',
                        Caja: 'Apertura, cobros y cierre de caja del día.',
                        Gastos: 'Registra los egresos de la clínica.',
                        Reportes: 'Ingresos, gastos y resultado por período.',
                        Servicios:
                          'Servicios que ofrece la clínica y sus precios.',
                      } as Record<string, string>
                    )[page]}
              </p>
            </div>
            {![
              'Usuarios',
              'Configuración',
              'Caja',
              'Gastos',
              'Reportes',
              'Servicios',
            ].includes(page) &&
              !editingClient &&
              canAccess(role, page) && (
              <Button
                disabled={!!supabase && !role}
                variant="contained"
                startIcon={<Add />}
                onClick={() =>
                  open(
                    (
                      {
                        Clientes: 'clients',
                        Mascotas: 'pets',
                        'Historial médico': 'medical_records',
                        'Vacunas y tratamientos': 'controls',
                      } as Record<string, Table>
                    )[page] || 'appointments',
                  )
                }
              >
                {(
                  {
                    Clientes: 'Nuevo cliente',
                    Mascotas: 'Nueva mascota',
                    'Historial médico': 'Nueva consulta',
                    'Vacunas y tratamientos': 'Nuevo control',
                  } as Record<string, string>
                )[page] || 'Nueva cita'}
              </Button>
            )}
          </div>
          {demo && (
            <div className="demo-note">
              <b>Modo demostración.</b> Datos ficticios; los cambios se
              restablecen al recargar. No se envían mensajes ni reservas reales.
            </div>
          )}
          {loadError && (
            <Alert
              severity="error"
              action={<Button onClick={reload}>Reintentar</Button>}
              sx={{ mb: 2 }}
            >
              {loadError}
            </Alert>
          )}
          {loading && (
            <div className="loading">
              <CircularProgress size={20} /> Actualizando registros…
            </div>
          )}
          {!canAccess(role, page) ? (
            <Alert severity="warning">
              Tu perfil no tiene acceso a esta sección.
            </Alert>
          ) : page === 'Caja' ? (
            <Cash
              data={data}
              isAdmin={role === 'admin'}
              call={moneyCall}
              onCharge={setCharging}
              onReceipt={setReceipt}
            />
          ) : page === 'Gastos' ? (
            <Expenses data={data} isAdmin={role === 'admin'} call={moneyCall} />
          ) : page === 'Reportes' ? (
            <Reports data={data} />
          ) : page === 'Servicios' ? (
            <Services
              services={data.services}
              save={async (row, id) => {
                await persist('services', row, id);
              }}
            />
          ) : page === 'Configuración' ? (
            // Remount once the stored profile arrives so the form starts from it.
            <Settings
              key={String(clinicLoaded)}
              demo={demo}
              clinic={clinic}
              onChange={setClinic}
            />
          ) : page === 'Usuarios' ? (
            <Users
              demo={demo}
              currentId={userId}
              demoUsers={demoUsers}
              onDemoChange={setDemoUsers}
            />
          ) : page === 'Resumen' ? (
            <>
              <div className="stats">
                {[
                  {
                    label: 'Citas de hoy',
                    value: data.appointments.filter(
                      (a) =>
                        localDate(new Date(a.starts_at)) === today &&
                        a.status !== 'cancelled',
                    ).length,
                    note: 'Visitas programadas',
                    Icon: CalendarMonth,
                  },
                  {
                    label: 'Mascotas',
                    value: data.pets.length,
                    note: 'Cada paciente, una historia',
                    Icon: Pets,
                  },
                  {
                    label: 'Clientes',
                    value: data.clients.length,
                    note: 'Familias que confían',
                    Icon: PeopleOutline,
                  },
                  ...(clinical
                    ? [
                        {
                          label: 'Controles pendientes',
                          value: due.length,
                          note: 'Vacunas y tratamientos',
                          Icon: HealthAndSafetyOutlined,
                        },
                      ]
                    : []),
                ].map(({ label, value, note, Icon }) => (
                  <div className="stat" key={label}>
                    <div className="stat-label">
                      <span>{label}</span>
                      <Icon />
                    </div>
                    <strong>{value}</strong>
                    <small>{note}</small>
                  </div>
                ))}
              </div>
              <div className="dashboard-columns">
                <section className="panel">
                  <div className="section-heading">
                    <div>
                      <h2>Agenda de hoy</h2>
                      <p className="muted">{dateLabel(today)}</p>
                    </div>
                    <Button
                      size="small"
                      endIcon={<ArrowForward />}
                      onClick={() => {
                        setMonth(today.slice(0, 7));
                        setDay(today);
                        setDayView(true);
                        navigate('Citas');
                      }}
                    >
                      Ver agenda
                    </Button>
                  </div>
                  {appointmentList()}
                </section>
                <div>
                  <section className="care-card">
                    <span className="eyebrow">EL SIGUIENTE PASO</span>
                    <h2>El cuidado continúa después de la visita.</h2>
                    <p>
                      Revisa los controles de tus pacientes y acompaña su
                      evolución.
                    </p>
                    <Button
                      onClick={() =>
                        navigate(clinical ? 'Vacunas y tratamientos' : 'Citas')
                      }
                      endIcon={<ArrowForward />}
                    >
                      Ver {clinical ? 'controles' : 'citas'}
                    </Button>
                  </section>
                  {clinical && (
                    <section className="panel">
                      <div className="section-heading">
                        <h2>Próximos controles</h2>
                        <Schedule color="action" />
                      </div>
                      {due.slice(0, 3).map((c) => (
                        <button
                          className="control-mini"
                          key={c.id}
                          onClick={() => setDetail(pet(c.pet_id) || null)}
                        >
                          <span className="dot" />
                          <div>
                            <b>{pet(c.pet_id)?.name}</b>
                            <small>{c.name}</small>
                          </div>
                          <span
                            className={c.next_due! < today ? 'overdue' : ''}
                          >
                            {dateLabel(c.next_due!)}
                          </span>
                        </button>
                      ))}
                      {!due.length && (
                        <p className="muted">No hay controles pendientes.</p>
                      )}
                    </section>
                  )}
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="toolbar" hidden={editingClient}>
                <TextField
                  placeholder={
                    page === 'Clientes'
                      ? 'Buscar por nombre, correo o teléfono…'
                      : 'Buscar por mascota, cliente o detalle…'
                  }
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  slotProps={{
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">
                          <Search fontSize="small" />
                        </InputAdornment>
                      ),
                    },
                    htmlInput: { 'aria-label': 'Buscar registros' },
                  }}
                />
              </div>
              {page === 'Citas' &&
                (dayView ? (
                  <section className="panel day-panel">{dayAgenda()}</section>
                ) : (
                  <MonthCalendar
                    month={month}
                    selected={day}
                    today={today}
                    counts={dayCounts}
                    hours={clinic.hours}
                    onMonth={setMonth}
                    onSelect={(d) => {
                      setDay(d);
                      setDayView(true);
                      window.scrollTo({ top: 0 });
                    }}
                  />
                ))}
              {editingClient && (
                <section className="panel client-form-page">
                  <form onSubmit={submit}>
                    <div className="day-nav">
                      <Button
                        startIcon={<ArrowBack />}
                        onClick={() => setForm(null)}
                        disabled={saving}
                      >
                        Volver a clientes
                      </Button>
                    </div>
                    <h2>{form.id ? 'Editar cliente' : 'Nuevo cliente'}</h2>
                    <div className="form-grid client-form-grid">
                      {formError && <Alert severity="error">{formError}</Alert>}
                      {clientFields()}
                    </div>
                    <div className="form-actions-bar">
                      {formError && (
                        <span className="form-actions-error">{formError}</span>
                      )}
                      <Button onClick={() => setForm(null)} disabled={saving}>
                        Cancelar
                      </Button>
                      <Button type="submit" variant="contained" disabled={saving}>
                        {saving ? 'Guardando…' : 'Guardar'}
                      </Button>
                    </div>
                  </form>
                </section>
              )}
              {page === 'Clientes' && !editingClient && duplicates.size > 0 && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                  {duplicates.size === 1
                    ? 'Hay 1 celular registrado en más de una ficha.'
                    : 'Hay ' +
                      duplicates.size +
                      ' celulares registrados en más de una ficha.'}{' '}
                  Las reservas web siempre crean una ficha nueva; revisa y
                  une las que sean del mismo cliente con «Unir».
                </Alert>
              )}
              {page === 'Clientes' && !editingClient && (
                <section className="panel table-panel">
                  <TableContainer>
                    <MuiTable className="users-table clients-table">
                      <TableHead>
                        <TableRow>
                          {[
                            'Cliente',
                            'Contacto',
                            'Mascotas',
                            'WhatsApp',
                            '',
                          ].map((x, i) => (
                            <TableCell key={i}>{x}</TableCell>
                          ))}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {data.clients
                          .filter((c) => matches(c.name, c.phone, c.email))
                          .map((c) => (
                            <TableRow key={c.id}>
                              <TableCell>
                                <b>{c.name}</b>
                                {duplicates.has(c.phone) && (
                                  <Chip
                                    size="small"
                                    color="warning"
                                    variant="outlined"
                                    label="Posible duplicado"
                                    className="dup-chip"
                                    sx={{ mt: 0.5 }}
                                  />
                                )}
                              </TableCell>
                              <TableCell>
                                {c.phone}
                                <small>
                                  {c.email || 'Sin correo registrado'}
                                </small>
                              </TableCell>
                              <TableCell>
                                {data.pets
                                  .filter((p) => p.client_id === c.id)
                                  .map((p) => p.name)
                                  .join(', ') || 'Sin mascotas'}
                              </TableCell>
                              <TableCell>
                                <Chip
                                  size="small"
                                  label={
                                    c.consent
                                      ? 'Autorizado'
                                      : 'Sin autorización'
                                  }
                                  color={c.consent ? 'primary' : 'default'}
                                  variant="outlined"
                                />
                              </TableCell>
                              <TableCell>
                                {duplicates.has(c.phone) && (
                                  <Button
                                    size="small"
                                    color="warning"
                                    onClick={() => setMergePhone(c.phone)}
                                  >
                                    Unir
                                  </Button>
                                )}
                                <IconButton
                                  aria-label={'Editar ' + c.name}
                                  onClick={() =>
                                    open('clients', { ...c }, c.id)
                                  }
                                >
                                  <EditOutlined />
                                </IconButton>
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </MuiTable>
                  </TableContainer>
                  {!data.clients.filter((c) =>
                    matches(c.name, c.phone, c.email),
                  ).length && (
                    <div className="empty">No se encontraron clientes.</div>
                  )}
                </section>
              )}
              {page === 'Mascotas' && (
                <div className="pet-grid">
                  {data.pets
                    .filter((p) =>
                      matches(
                        p.name,
                        p.species,
                        p.breed,
                        owner(p.client_id)?.name,
                      ),
                    )
                    .map((p) => (
                      <section className="pet-card" key={p.id}>
                        <div className="pet-card-top">
                          <span
                            className={
                              'pet-avatar big ' +
                              (p.species === 'Gato' ? 'cat' : '')
                            }
                          >
                            <Pets />
                          </span>
                          <IconButton
                            aria-label={'Editar ' + p.name}
                            onClick={() => open('pets', { ...p }, p.id)}
                          >
                            <EditOutlined fontSize="small" />
                          </IconButton>
                        </div>
                        <h2>{p.name}</h2>
                        <p className="muted">
                          {p.species} · {p.breed || 'Raza no registrada'}
                        </p>
                        <div className="pet-facts">
                          <span>{p.sex}</span>
                          <span>
                            {p.weight ? p.weight + ' kg' : 'Sin peso'}
                          </span>
                        </div>
                        <p className="owner-line">
                          <PeopleOutline fontSize="small" />
                          {owner(p.client_id)?.name}
                        </p>
                        <Button
                          fullWidth
                          variant="outlined"
                          endIcon={<ArrowForward />}
                          onClick={() => setDetail(p)}
                        >
                          Ver ficha
                        </Button>
                      </section>
                    ))}
                  {!data.pets.filter((p) =>
                    matches(
                      p.name,
                      p.species,
                      p.breed,
                      owner(p.client_id)?.name,
                    ),
                  ).length && (
                    <div className="empty">No se encontraron mascotas.</div>
                  )}
                </div>
              )}
              {page === 'Historial médico' && clinical && (
                <section className="panel">
                  {historyPatients.map(({ p, records }) => (
                    <button
                      type="button"
                      className="record record-patient"
                      key={p.id}
                      onClick={() => setDetail(p)}
                    >
                      <span className="record-icon">
                        <Pets />
                      </span>
                      <span>
                        <span className="record-heading">
                          <b>
                            {p.name}{' '}
                            <span className="muted">
                              · {p.species} · {owner(p.client_id)?.name}
                            </span>
                          </b>
                          <small>
                            Última consulta: {dateLabel(records[0].visit_date)}
                          </small>
                        </span>
                        <span className="muted record-summary">
                          {records.length}{' '}
                          {records.length === 1 ? 'consulta' : 'consultas'} ·
                          Último diagnóstico: {records[0].diagnosis}
                        </span>
                        <span className="record-link">
                          Ver historial <ArrowForward fontSize="small" />
                        </span>
                      </span>
                    </button>
                  ))}
                  {!historyPatients.length && (
                    <div className="empty">
                      {data.medical_records.length
                        ? 'No hay pacientes que coincidan con la búsqueda.'
                        : 'Aún no hay consultas registradas.'}
                    </div>
                  )}
                </section>
              )}
              {page === 'Vacunas y tratamientos' && clinical && (
                <section className="panel table-panel">
                  <TableContainer>
                    <MuiTable>
                      <TableHead>
                        <TableRow>
                          {[
                            'Paciente / Control',
                            'Tipo',
                            'Registrado',
                            'Próximo control',
                            'Estado',
                            '',
                          ].map((x, i) => (
                            <TableCell key={i}>{x}</TableCell>
                          ))}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {data.controls
                          .filter((c) =>
                            matches(pet(c.pet_id)?.name, c.name, c.kind),
                          )
                          .sort((a, b) =>
                            (a.next_due || '9999').localeCompare(
                              b.next_due || '9999',
                            ),
                          )
                          .map((c) => (
                            <TableRow key={c.id}>
                              <TableCell>
                                <b>{pet(c.pet_id)?.name}</b>
                                <small>{c.name}</small>
                              </TableCell>
                              <TableCell>{c.kind}</TableCell>
                              <TableCell>{dateLabel(c.applied_on)}</TableCell>
                              <TableCell>
                                <span
                                  className={
                                    c.status === 'active' &&
                                    c.next_due &&
                                    c.next_due < today
                                      ? 'overdue'
                                      : ''
                                  }
                                >
                                  {c.next_due
                                    ? dateLabel(c.next_due)
                                    : 'Sin fecha'}
                                </span>
                              </TableCell>
                              <TableCell>
                                <Chip
                                  size="small"
                                  label={statusLabels[c.status]}
                                  variant="outlined"
                                />
                              </TableCell>
                              <TableCell>
                                <IconButton
                                  aria-label={'Editar ' + c.name}
                                  onClick={() =>
                                    open('controls', { ...c }, c.id)
                                  }
                                >
                                  <EditOutlined />
                                </IconButton>
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </MuiTable>
                  </TableContainer>
                  {!data.controls.filter((c) =>
                    matches(pet(c.pet_id)?.name, c.name, c.kind),
                  ).length && (
                    <div className="empty">Sin controles registrados.</div>
                  )}
                </section>
              )}
              {!clinical &&
                ['Historial médico', 'Vacunas y tratamientos'].includes(
                  page,
                ) && (
                  <Alert severity="info">
                    Esta sección está disponible para veterinarios y
                    administradores.
                  </Alert>
                )}
            </>
          )}
          <footer className="app-footer">
            <span>{clinic.name} · Cuidado que acompaña</span>
            <span>
              {demo ? 'Entorno de demostración' : 'Conectado a Supabase'} ·{' '}
              {TIMEZONE}
            </span>
          </footer>
        </div>
      </main>
      <Dialog
        open={!!form && form.table !== 'clients'}
        fullWidth
        maxWidth="sm"
      >
        <form onSubmit={submit}>
          <DialogTitle>
            {form?.id
              ? 'Editar registro'
              : (
                  {
                    clients: 'Nuevo cliente',
                    pets: 'Nueva mascota',
                    appointments: 'Nueva cita',
                    medical_records: 'Registrar consulta',
                    controls: 'Nuevo control',
                  } as Record<string, string>
                )[form?.table || '']}
            <IconButton
              aria-label="Cerrar formulario"
              onClick={() => setForm(null)}
              disabled={saving}
              sx={{ position: 'absolute', right: 12, top: 12 }}
            >
              <Close />
            </IconButton>
          </DialogTitle>
          <DialogContent>
            <div className="form-grid">
              {formError && <Alert severity="error">{formError}</Alert>}
              {form?.table === 'pets' && (
                <>
                  <ClientPicker
                    clients={data.clients}
                    pets={data.pets}
                    value={(form.values.client_id as string) || ''}
                    onChange={(id) => setValue('client_id', id)}
                    required
                  />
                  {!data.clients.length && (
                    <Alert severity="info">Registra primero un cliente.</Alert>
                  )}
                  {field('name', 'Nombre de la mascota')}
                  {field(
                    'species',
                    'Especie',
                    'text',
                    true,
                    options(['Perro', 'Gato', 'Otro']),
                  )}
                  {field('breed', 'Raza', 'text', false)}
                  {field('birth_date', 'Fecha de nacimiento', 'date', false)}
                  {field(
                    'sex',
                    'Sexo',
                    'text',
                    true,
                    options(['Macho', 'Hembra', 'No registrado']),
                  )}
                  {field('weight', 'Peso (kg)', 'number', false)}
                  {field(
                    'allergies',
                    'Alergias y antecedentes relevantes',
                    'text',
                    false,
                  )}
                </>
              )}
              {form?.table === 'appointments' && (
                <>
                  {!form.id && petField()}
                  {!data.pets.length && (
                    <Alert severity="info">
                      Registra primero al cliente y su mascota.
                    </Alert>
                  )}
                  <div className="form-pair">
                    {field('day', 'Fecha', 'date')}
                    {field(
                      'time',
                      'Hora de la clínica',
                      'text',
                      true,
                      options(slotTimes(String(form.values.day), clinic.hours)),
                    )}
                  </div>
                  {field(
                    'reason',
                    'Motivo',
                    'text',
                    true,
                    options([
                      ...new Set([
                        ...activeServices.map((x) => x.name),
                        ...(form.values.reason ? [form.values.reason as string] : []),
                      ]),
                    ]),
                  )}
                  <Alert severity="info">
                    {hoursSummary(clinic.hours)} · {TIMEZONE}. Se reserva un
                    bloque de 30 minutos.
                  </Alert>
                </>
              )}
              {form?.table === 'medical_records' && (
                <>
                  {form.values.appointment_id ? (
                    <Alert severity="success" icon={<CalendarMonth />}>
                      Consulta de la cita de{' '}
                      <b>{pet(form.values.pet_id as string)?.name}</b>:{' '}
                      {appointmentLabel(form.values.appointment_id as string)}
                    </Alert>
                  ) : (
                    petField()
                  )}
                  {field('visit_date', 'Fecha de consulta', 'date')}
                  {field('weight', 'Peso (kg)', 'number', false)}
                  {field('diagnosis', 'Diagnóstico / Evaluación')}
                  {field(
                    'notes',
                    'Observaciones, indicaciones y evolución',
                    'text',
                    false,
                  )}
                  <Alert severity="info">
                    Las consultas se conservan como historial. Para corregir una
                    observación, agrega una nueva entrada.
                  </Alert>
                </>
              )}
              {form?.table === 'controls' && (
                <>
                  {petField()}
                  {field(
                    'kind',
                    'Tipo de control',
                    'text',
                    true,
                    options(['Vacuna', 'Tratamiento']),
                  )}
                  {field('name', 'Vacuna o tratamiento')}
                  {field('applied_on', 'Fecha de aplicación / inicio', 'date')}
                  {field('next_due', 'Próximo control', 'date', false)}
                  {field(
                    'notes',
                    'Dosis, lote, frecuencia y observaciones',
                    'text',
                    false,
                  )}
                  {field('status', 'Estado', 'text', true, [
                    { value: 'active', label: 'En seguimiento' },
                    { value: 'completed', label: 'Completado' },
                  ])}
                </>
              )}
            </div>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setForm(null)} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" variant="contained" disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
      {charging !== undefined && (
        <ChargeDialog
          data={data}
          appointmentId={charging}
          call={moneyCall}
          onClose={() => setCharging(undefined)}
          onDone={(p) => {
            setCharging(undefined);
            setReceipt(p);
          }}
        />
      )}
      {receipt && (
        <ReceiptDialog
          // Re-read so a void done meanwhile shows up.
          payment={data.payments.find((p) => p.id === receipt.id) || receipt}
          data={data}
          clinic={clinic}
          onClose={() => setReceipt(null)}
        />
      )}
      {duplicates.get(mergePhone) && (
        <MergeClients
          group={duplicates.get(mergePhone)!}
          data={data}
          onClose={() => setMergePhone('')}
          onMerge={mergeClients}
        />
      )}
      <Dialog open={!!confirm}>
        <DialogTitle>
          {confirm?.status === 'cancelled'
            ? '¿Cancelar esta cita?'
            : '¿Marcar esta cita como atendida?'}
        </DialogTitle>
        <DialogContent>
          {confirm?.status === 'cancelled'
            ? 'El horario quedará libre y se detendrán los recordatorios pendientes.'
            : clinical
              ? 'La cita quedará completada y se abrirá el formulario para registrar la consulta en el historial médico.'
              : 'La cita quedará completada. El veterinario registrará la consulta en el historial médico.'}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirm(null)} disabled={saving}>
            Volver
          </Button>
          <Button onClick={changeStatus} variant="contained" disabled={saving}>
            Confirmar
          </Button>
        </DialogActions>
      </Dialog>
      <Drawer
        anchor="right"
        open={!!detail}
        onClose={() => setDetail(null)}
        slotProps={{ paper: { sx: { width: { xs: '100%', sm: 510 }, p: 3 } } }}
      >
        {detail && (
          <>
            <div className="section-heading">
              <div className="brand">
                <Pets />
                Ficha del paciente
              </div>
              <IconButton
                aria-label="Cerrar ficha"
                onClick={() => setDetail(null)}
              >
                <Close />
              </IconButton>
            </div>
            <span className="pet-avatar big">
              <Pets />
            </span>
            <h1 style={{ marginTop: 15 }}>{detail.name}</h1>
            <p className="muted">
              {detail.species} · {detail.breed || 'Raza no registrada'}
            </p>
            <div className="detail-info">
              <p>
                <b>Responsable</b>
                <span>{owner(detail.client_id)?.name}</span>
              </p>
              <p>
                <b>Teléfono</b>
                <span>{owner(detail.client_id)?.phone}</span>
              </p>
              <p>
                <b>Nacimiento</b>
                <span>
                  {detail.birth_date
                    ? dateLabel(detail.birth_date)
                    : 'No registrado'}
                </span>
              </p>
              <p>
                <b>Peso / Sexo</b>
                <span>
                  {detail.weight ? detail.weight + ' kg' : 'Sin peso'} ·{' '}
                  {detail.sex}
                </span>
              </p>
            </div>
            {clinical && (
              <>
                <Alert severity="info" icon={<InfoOutlined />}>
                  {detail.allergies || 'Sin antecedentes registrados.'}
                </Alert>
                <div className="section-heading" style={{ marginTop: 28 }}>
                  <h2>
                    Historia clínica{' '}
                    <span className="muted">
                      (
                      {
                        data.medical_records.filter(
                          (r) => r.pet_id === detail.id,
                        ).length
                      }
                      )
                    </span>
                  </h2>
                  <div>
                    <Button startIcon={<PrintOutlined />} onClick={printHistory}>
                      PDF
                    </Button>
                    <Button
                      startIcon={<Add />}
                      onClick={() =>
                        open('medical_records', { pet_id: detail.id })
                      }
                    >
                      Consulta
                    </Button>
                  </div>
                </div>
                <HistoryPrint
                  pet={detail}
                  data={data}
                  clinic={clinic}
                  author={userName}
                />
                {data.medical_records
                  .filter((r) => r.pet_id === detail.id)
                  .sort((a, b) => b.visit_date.localeCompare(a.visit_date))
                  .map((r) => (
                    <article className="timeline-entry" key={r.id}>
                      <small>
                        {dateLabel(r.visit_date)}
                        {r.weight ? ' · ' + r.weight + ' kg' : ''}
                      </small>
                      <h3>{r.diagnosis}</h3>
                      {r.appointment_id && (
                        <small className="record-origin">
                          Desde cita: {appointmentLabel(r.appointment_id)}
                        </small>
                      )}
                      <p>{r.notes || 'Sin observaciones adicionales.'}</p>
                    </article>
                  ))}
                {!data.medical_records.some((r) => r.pet_id === detail.id) && (
                  <p className="muted">Aún no hay consultas registradas.</p>
                )}
                <h2 style={{ margin: '25px 0 12px' }}>
                  Vacunas y tratamientos
                </h2>
                {data.controls
                  .filter((c) => c.pet_id === detail.id)
                  .map((c) => (
                    <article className="timeline-entry" key={c.id}>
                      <small>
                        {c.kind} · {statusLabels[c.status]}
                      </small>
                      <b>{c.name}</b>
                      <p>{c.notes}</p>
                      <small>
                        Próximo control:{' '}
                        {c.next_due ? dateLabel(c.next_due) : 'Sin fecha'}
                      </small>
                    </article>
                  ))}
              </>
            )}
            <Button
              sx={{ mt: 3 }}
              variant="contained"
              onClick={() => open('appointments', { pet_id: detail.id })}
            >
              Agendar una visita
            </Button>
          </>
        )}
      </Drawer>
      <Snackbar
        open={!!snack}
        autoHideDuration={6500}
        onClose={() => setSnack('')}
        message={snack}
        action={
          <IconButton
            color="inherit"
            onClick={() => setSnack('')}
            aria-label="Cerrar aviso"
          >
            <Close />
          </IconButton>
        }
      />
    </div>
  );
}
