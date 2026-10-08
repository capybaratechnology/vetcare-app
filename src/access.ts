export const ROLES = [
  {
    value: 'admin',
    label: 'Administrador',
    description:
      'Gestiona usuarios, perfiles y todos los módulos de la clínica.',
  },
  {
    value: 'vet',
    label: 'Veterinario',
    description:
      'Atiende pacientes, registra consultas y gestiona vacunas y tratamientos.',
  },
  {
    value: 'reception',
    label: 'Recepción',
    description:
      'Gestiona clientes, mascotas y citas; sin acceso a consultas clínicas ni usuarios.',
  },
] as const;
export type Role = (typeof ROLES)[number]['value'];
export type StaffUser = {
  user_id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  created_at?: string;
};
export type DemoUser = StaffUser & { password: string };
export const DEMO_PASSWORD = 'VetCareDemo2026!';
export function demoAccounts(): DemoUser[] {
  return ROLES.map((r, i) => ({
    user_id: 'demo-' + r.value,
    name: ['Administración VetCare', 'Dra. Sofía Vega', 'Recepción VetCare'][i],
    email: r.value + '@vetcare.demo',
    role: r.value,
    active: true,
    password: DEMO_PASSWORD,
  }));
}
export function canAccess(role: string, page: string) {
  if (['landing', 'login'].includes(page)) return true;
  if (!['admin', 'vet', 'reception'].includes(role)) return false;
  if (page === 'Usuarios' || page === 'Configuración') return role === 'admin';
  if (['Historial médico', 'Vacunas y tratamientos'].includes(page))
    return role === 'admin' || role === 'vet';
  return ['Resumen', 'Clientes', 'Mascotas', 'Citas'].includes(page);
}
export function authenticateDemo(
  users: DemoUser[],
  email: string,
  password: string,
) {
  const user = users.find(
    (u) =>
      u.email.toLowerCase() === email.trim().toLowerCase() &&
      u.password === password &&
      u.active,
  );
  if (!user)
    throw Error('Correo, contraseña o estado de la cuenta no válidos.');
  return user;
}
