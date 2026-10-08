import { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Table,
  TableContainer,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  IconButton,
  InputAdornment,
  CircularProgress,
  Snackbar,
  FormControlLabel,
  Switch,
} from '@mui/material';
import Add from '@mui/icons-material/Add';
import Search from '@mui/icons-material/Search';
import EditOutlined from '@mui/icons-material/EditOutlined';
import Close from '@mui/icons-material/Close';
import AdminPanelSettingsOutlined from '@mui/icons-material/AdminPanelSettingsOutlined';
import ToggleOnOutlined from '@mui/icons-material/ToggleOnOutlined';
import { supabase } from './data';
import { ROLES, type StaffUser, type DemoUser, type Role } from './access';
type Draft = {
  user_id?: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  password: string;
};
export default function Users({
  demo,
  currentId,
  demoUsers,
  onDemoChange,
}: {
  demo: boolean;
  currentId: string;
  demoUsers: DemoUser[];
  onDemoChange: (users: DemoUser[]) => void;
}) {
  const [users, setUsers] = useState<StaffUser[]>(demo ? demoUsers : []),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(''),
    [search, setSearch] = useState(''),
    [filter, setFilter] = useState('all'),
    [draft, setDraft] = useState<Draft | null>(null),
    [busy, setBusy] = useState(false),
    [formError, setFormError] = useState(''),
    [notice, setNotice] = useState(''),
    [toggle, setToggle] = useState<StaffUser | null>(null);
  async function call(body: Record<string, unknown>) {
    const { data, error } = await supabase!.functions.invoke('manage-users', {
      body,
    });
    if (error) {
      let message =
        'No se pudo gestionar el usuario. Comprueba tu sesión y vuelve a intentarlo.';
      if (error.context instanceof Response) {
        const json = await error.context.json().catch(() => null);
        if (json?.error) message = json.error;
      }
      throw Error(message);
    }
    if (data?.error) throw Error(data.error);
    return data;
  }
  async function load() {
    if (demo) return;
    setLoading(true);
    setError('');
    try {
      const result = await call({ action: 'list' });
      setUsers(result.users);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    if (demo) setUsers(demoUsers);
    else void load();
  }, [demo, demoUsers]);
  function edit(u?: StaffUser) {
    setFormError('');
    setDraft(
      u
        ? { ...u, password: '' }
        : {
            name: '',
            email: '',
            role: 'reception',
            active: true,
            password: '',
          },
    );
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!draft) return;
    setBusy(true);
    setFormError('');
    try {
      if (draft.name.trim().length < 2)
        throw Error('Escribe el nombre completo.');
      if (draft.user_id === currentId && !draft.active)
        throw Error('No puedes desactivar tu propia cuenta.');
      if (demo) {
        if (
          demoUsers.some(
            (u) =>
              u.email.toLowerCase() === draft.email.trim().toLowerCase() &&
              u.user_id !== draft.user_id,
          )
        )
          throw Error('Ya existe un usuario con ese correo.');
        if (!draft.user_id && draft.password.length < 6)
          throw Error('La contraseña debe tener al menos 6 caracteres.');
        const next = draft.user_id
          ? demoUsers.map((u) =>
              u.user_id === draft.user_id
                ? {
                    ...u,
                    name: draft.name.trim(),
                    role: draft.role,
                    active: draft.active,
                  }
                : u,
            )
          : [
              ...demoUsers,
              {
                ...draft,
                name: draft.name.trim(),
                email: draft.email.trim().toLowerCase(),
                user_id: crypto.randomUUID(),
              },
            ];
        onDemoChange(next);
      } else {
        await call({
          action: draft.user_id ? 'update' : 'create',
          user_id: draft.user_id,
          name: draft.name.trim(),
          email: draft.email.trim(),
          role: draft.role,
          active: draft.active,
          ...(!draft.user_id ? { password: draft.password } : {}),
        });
        await load();
      }
      setDraft(null);
      setNotice(
        demo ? 'Usuario actualizado en la demostración.' : 'Usuario guardado.',
      );
    } catch (e) {
      setFormError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function changeStatus() {
    if (!toggle) return;
    setBusy(true);
    try {
      if (demo)
        onDemoChange(
          demoUsers.map((u) =>
            u.user_id === toggle.user_id ? { ...u, active: !u.active } : u,
          ),
        );
      else {
        await call({
          action: 'update',
          user_id: toggle.user_id,
          name: toggle.name,
          role: toggle.role,
          active: !toggle.active,
        });
        await load();
      }
      setNotice(toggle.active ? 'Cuenta desactivada.' : 'Cuenta activada.');
      setToggle(null);
    } catch (e) {
      setError((e as Error).message);
      setToggle(null);
    } finally {
      setBusy(false);
    }
  }
  const filtered = users.filter(
    (u) =>
      (filter === 'all' || u.role === filter) &&
      (u.name + ' ' + u.email).toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <>
      <div className="users-intro">
        <div>
          <h2>Usuarios del equipo</h2>
          <p className="muted">
            Asigna responsabilidades y controla quién puede acceder.
          </p>
        </div>
        <Button variant="contained" startIcon={<Add />} onClick={() => edit()}>
          Nuevo usuario
        </Button>
      </div>
      <div className="profile-grid">
        {ROLES.map((r) => (
          <article className="profile-card" key={r.value}>
            <AdminPanelSettingsOutlined />
            <h3>{r.label}</h3>
            <p>{r.description}</p>
            <small>
              {users.filter((u) => u.role === r.value && u.active).length}{' '}
              usuarios activos
            </small>
          </article>
        ))}
      </div>
      {error && (
        <Alert
          severity="error"
          sx={{ mb: 2 }}
          action={<Button onClick={load}>Reintentar</Button>}
        >
          {error}
        </Alert>
      )}
      <div className="toolbar">
        <TextField
          placeholder="Buscar por nombre o correo…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <Search />
                </InputAdornment>
              ),
            },
            htmlInput: { 'aria-label': 'Buscar usuarios' },
          }}
        />
        <TextField
          select
          label="Perfil"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <MenuItem value="all">Todos los perfiles</MenuItem>
          {ROLES.map((r) => (
            <MenuItem value={r.value} key={r.value}>
              {r.label}
            </MenuItem>
          ))}
        </TextField>
      </div>
      <section className="panel table-panel">
        {loading ? (
          <div className="empty">
            <CircularProgress size={25} />
            <p>Cargando equipo…</p>
          </div>
        ) : (
          <TableContainer>
            <Table className="users-table">
              <TableHead>
                <TableRow>
                  {['Usuario', 'Perfil', 'Estado', 'Acciones'].map((h) => (
                    <TableCell key={h}>{h}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {filtered.map((u) => (
                  <TableRow key={u.user_id}>
                    <TableCell>
                      <b>{u.name}</b>
                      {u.user_id === currentId && (
                        <Chip size="small" label="Tú" sx={{ ml: 1 }} />
                      )}
                      <small>{u.email}</small>
                    </TableCell>
                    <TableCell>
                      {ROLES.find((r) => r.value === u.role)?.label}
                    </TableCell>
                    <TableCell>
                      <Chip
                        variant="outlined"
                        size="small"
                        color={u.active ? 'primary' : 'default'}
                        label={u.active ? 'Activo' : 'Inactivo'}
                      />
                    </TableCell>
                    <TableCell>
                      <IconButton
                        aria-label={'Editar usuario ' + u.name}
                        onClick={() => edit(u)}
                      >
                        <EditOutlined />
                      </IconButton>
                      <IconButton
                        aria-label={
                          (u.active ? 'Desactivar ' : 'Activar ') + u.name
                        }
                        disabled={u.user_id === currentId}
                        onClick={() => setToggle(u)}
                      >
                        <ToggleOnOutlined
                          color={u.active ? 'primary' : 'disabled'}
                        />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
        {!loading && !filtered.length && (
          <div className="empty">
            No hay usuarios que coincidan con la búsqueda.
          </div>
        )}
      </section>
      <Alert severity="info">
        Las cuentas inactivas pierden el acceso a los datos. No puedes
        desactivar tu propia cuenta ni cambiar tu propio perfil.
      </Alert>
      <Dialog
        open={!!draft}
        fullWidth
        maxWidth="sm"
      >
        <form onSubmit={save}>
          <DialogTitle>
            {draft?.user_id ? 'Editar usuario' : 'Nuevo usuario'}
            <IconButton
              sx={{ position: 'absolute', right: 12, top: 12 }}
              aria-label="Cerrar formulario"
              disabled={busy}
              onClick={() => setDraft(null)}
            >
              <Close />
            </IconButton>
          </DialogTitle>
          <DialogContent>
            {draft && (
              <div className="form-grid">
                {formError && <Alert severity="error">{formError}</Alert>}
                <TextField
                  label="Nombre completo"
                  required
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  slotProps={{ htmlInput: { minLength: 2, maxLength: 120 } }}
                />
                <TextField
                  label="Correo electrónico"
                  required
                  type="email"
                  disabled={!!draft.user_id}
                  value={draft.email}
                  onChange={(e) =>
                    setDraft({ ...draft, email: e.target.value })
                  }
                  slotProps={{ htmlInput: { maxLength: 254 } }}
                />
                {!draft.user_id && (
                  <TextField
                    label="Contraseña inicial"
                    required
                    type="password"
                    autoComplete="new-password"
                    value={draft.password}
                    onChange={(e) =>
                      setDraft({ ...draft, password: e.target.value })
                    }
                    helperText="Mínimo 6 caracteres. Entrégala personalmente al usuario; no se enviará por correo."
                    slotProps={{ htmlInput: { minLength: 6, maxLength: 128 } }}
                  />
                )}
                <TextField
                  select
                  label="Perfil"
                  disabled={draft.user_id === currentId}
                  value={draft.role}
                  onChange={(e) =>
                    setDraft({ ...draft, role: e.target.value as Role })
                  }
                >
                  {ROLES.map((r) => (
                    <MenuItem key={r.value} value={r.value}>
                      {r.label}
                    </MenuItem>
                  ))}
                </TextField>
                <p className="muted">
                  {ROLES.find((r) => r.value === draft.role)?.description}
                </p>
                <FormControlLabel
                  control={
                    <Switch
                      checked={draft.active}
                      disabled={draft.user_id === currentId}
                      onChange={(e) =>
                        setDraft({ ...draft, active: e.target.checked })
                      }
                    />
                  }
                  label="Cuenta activa"
                />
                {!draft.user_id && (
                  <Alert severity="info">
                    Verifica el correo con el integrante antes de crear su
                    cuenta.
                  </Alert>
                )}
              </div>
            )}
          </DialogContent>
          <DialogActions>
            <Button disabled={busy} onClick={() => setDraft(null)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={busy} variant="contained">
              {busy ? 'Guardando…' : 'Guardar usuario'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
      <Dialog open={!!toggle}>
        <DialogTitle>
          {toggle?.active ? 'Desactivar cuenta' : 'Activar cuenta'}
        </DialogTitle>
        <DialogContent>
          {toggle?.active
            ? 'Se bloqueará el acceso de '
            : 'Se restablecerá el acceso de '}
          <b>{toggle?.name}</b>
          {toggle?.active ? '. Sus registros clínicos se conservarán.' : '.'}
        </DialogContent>
        <DialogActions>
          <Button disabled={busy} onClick={() => setToggle(null)}>
            Cancelar
          </Button>
          <Button disabled={busy} variant="contained" onClick={changeStatus}>
            Confirmar
          </Button>
        </DialogActions>
      </Dialog>
      <Snackbar
        open={!!notice}
        message={notice}
        autoHideDuration={5000}
        onClose={() => setNotice('')}
      />
    </>
  );
}
