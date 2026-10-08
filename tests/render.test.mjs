import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import React from 'react';
import { renderToString } from 'react-dom/server';
test('landing is public and every internal URL requires login', async () => {
  const vite = await createServer({
    server: { middlewareMode: true },
    appType: 'custom',
  });
  try {
    const { default: App } = await vite.ssrLoadModule('/src/App.tsx');
    for (const page of [
      'Resumen',
      'Usuarios',
      'Citas',
      'Clientes',
      'Mascotas',
      'Historial médico',
      'Vacunas y tratamientos',
      'login',
    ]) {
      globalThis.location = { hash: '#' + encodeURIComponent(page) };
      const html = renderToString(React.createElement(App));
      assert.ok(html.includes('Inicia sesión'), page);
      assert.ok(
        !html.includes('app-shell'),
        page + ' cannot render protected content',
      );
      assert.ok(!html.includes('Nueva cita'), page);
    }
    for (const hash of ['', '#landing']) {
      globalThis.location = { hash };
      const html = renderToString(React.createElement(App));
      assert.ok(html.includes('Son familia.'));
      assert.ok(html.includes('Acceso del equipo'));
    }
    const { default: Users } = await vite.ssrLoadModule('/src/Users.tsx');
    const { demoAccounts } = await vite.ssrLoadModule('/src/access.ts');
    const html = renderToString(
      React.createElement(Users, {
        demo: true,
        currentId: 'demo-admin',
        demoUsers: demoAccounts(),
        onDemoChange: () => {},
      }),
    );
    assert.ok(html.includes('Nuevo usuario'));
    assert.ok(html.includes('Administrador'));
    assert.ok(html.includes('Recepción'));
    assert.ok(
      !html.includes('VetCareDemo2026!'),
      'user list does not render passwords',
    );
  } finally {
    await vite.close();
    delete globalThis.location;
  }
});
