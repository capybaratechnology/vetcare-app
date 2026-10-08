import test from 'node:test';
import assert from 'node:assert/strict';
import {
  appointmentWhen,
  classifyProviderResponse,
  reminderMessage,
} from '../supabase/functions/_shared/reminder-policy.ts';
test('provider acceptance keeps message id, without claiming delivery', () => {
  // Real response from api.wsp.braintech.pe (2026-10-05).
  assert.deepEqual(
    classifyProviderResponse(
      201,
      {
        error: false,
        data: {
          success: true,
          message: 'Mensaje agregado a la cola de envío',
          message_id: '82efcad6-3767-4773-b946-fdd81eb78269',
        },
      },
      1,
    ),
    {
      reminder_state: 'accepted',
      reminder_message_id: '82efcad6-3767-4773-b946-fdd81eb78269',
      reminder_error: null,
    },
  );
});
test('ambiguous network/server outcomes are never blindly retried', () => {
  assert.equal(classifyProviderResponse(500, {}, 1).reminder_state, 'uncertain');
  assert.equal(classifyProviderResponse(200, {}, 1).reminder_state, 'uncertain');
  assert.equal(
    classifyProviderResponse(200, { error: false, data: { success: true } }, 1)
      .reminder_state,
    'uncertain',
  );
});
test('explicit throttling retries with a hard limit', () => {
  assert.equal(classifyProviderResponse(429, {}, 1).reminder_state, 'pending');
  assert.equal(classifyProviderResponse(429, {}, 3).reminder_state, 'failed');
});
test('invalid credentials and rejected requests do not retry', () => {
  assert.equal(classifyProviderResponse(401, {}, 1).reminder_state, 'failed');
  assert.equal(
    classifyProviderResponse(400, { message: 'Invalid number' }, 1).reminder_state,
    'failed',
  );
});
test('reminder text includes clinic, client, pet, time and optional address', () => {
  assert.equal(
    reminderMessage(
      { name: 'VetCare', address: '' },
      'Ana',
      'Toby',
      'hoy a las 17:30',
    ),
    'Hola Ana, te recordamos que Toby tiene una cita hoy a las 17:30 en VetCare. Si necesitas cambiarla, contacta a la clínica.',
  );
  assert.equal(
    reminderMessage(
      { name: 'Huellitas', address: 'Av. Larco 123, Miraflores' },
      'Ana',
      'Toby',
      'hoy a las 17:30',
    ),
    'Hola Ana, te recordamos que Toby tiene una cita hoy a las 17:30 en Huellitas. Dirección: Av. Larco 123, Miraflores. Si necesitas cambiarla, contacta a la clínica.',
  );
});
test('appointment time is relative to the clinic day, not UTC', () => {
  const lima = 'America/Lima';
  // 22:30 UTC = 17:30 Lima; at 16:30 Lima it is the same day.
  assert.equal(
    appointmentWhen(
      new Date('2026-10-06T22:30:00Z'),
      new Date('2026-10-06T21:30:00Z'),
      lima,
    ),
    'hoy a las 17:30',
  );
  // Already 7 Oct in UTC but still 6 Oct in Lima.
  assert.equal(
    appointmentWhen(
      new Date('2026-10-07T01:00:00Z'),
      new Date('2026-10-07T00:30:00Z'),
      lima,
    ),
    'hoy a las 20:00',
  );
  assert.equal(
    appointmentWhen(
      new Date('2026-10-07T14:00:00Z'),
      new Date('2026-10-06T22:00:00Z'),
      lima,
    ),
    'mañana a las 09:00',
  );
  assert.equal(
    appointmentWhen(
      new Date('2026-10-08T15:30:00Z'),
      new Date('2026-10-06T22:00:00Z'),
      lima,
    ),
    'el 08/10 a las 10:30',
  );
});
