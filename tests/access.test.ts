import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canAccess,
  authenticateDemo,
  demoAccounts,
  DEMO_PASSWORD,
} from '../src/access.ts';
test('each profile only reaches its permitted modules', () => {
  assert.ok(canAccess('admin', 'Usuarios'));
  assert.ok(canAccess('admin', 'Configuración'));
  assert.ok(canAccess('vet', 'Historial médico'));
  assert.ok(canAccess('reception', 'Citas'));
  for (const role of ['vet', 'reception', '']) {
    assert.equal(canAccess(role, 'Usuarios'), false);
    assert.equal(canAccess(role, 'Configuración'), false);
  }
  assert.equal(canAccess('reception', 'Historial médico'), false);
  // Money: admin and reception handle the register and expenses; reports and prices are admin only.
  for (const page of ['Caja', 'Gastos']) {
    assert.ok(canAccess('admin', page));
    assert.ok(canAccess('reception', page));
    assert.equal(canAccess('vet', page), false);
  }
  for (const page of ['Reportes', 'Servicios']) {
    assert.ok(canAccess('admin', page));
    assert.equal(canAccess('reception', page), false);
    assert.equal(canAccess('vet', page), false);
  }
  assert.equal(canAccess('reception', 'Vacunas y tratamientos'), false);
  assert.equal(canAccess('', 'Resumen'), false);
  assert.equal(canAccess('admin', 'Unknown'), false);
});
test('demo login validates credentials and active status', () => {
  const accounts = demoAccounts();
  assert.equal(
    authenticateDemo(accounts, 'ADMIN@VETCARE.DEMO', DEMO_PASSWORD).role,
    'admin',
  );
  assert.throws(() =>
    authenticateDemo(accounts, 'admin@vetcare.demo', 'wrong'),
  );
  accounts[0].active = false;
  assert.throws(() =>
    authenticateDemo(accounts, 'admin@vetcare.demo', DEMO_PASSWORD),
  );
  assert.throws(() =>
    authenticateDemo(accounts, 'unknown@example.com', DEMO_PASSWORD),
  );
});
test('newly created demo accounts can log in and reflect their selected profile', () => {
  const users = [
    ...demoAccounts(),
    {
      user_id: 'new',
      name: 'Nuevo',
      email: 'new@example.com',
      password: 'StrongPassword2026!',
      active: true,
      role: 'reception' as const,
    },
  ];
  const user = authenticateDemo(
    users,
    'new@example.com',
    'StrongPassword2026!',
  );
  assert.equal(user.role, 'reception');
  assert.equal(canAccess(user.role, 'Usuarios'), false);
});
