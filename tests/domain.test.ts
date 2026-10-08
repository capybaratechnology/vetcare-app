import test from 'node:test';
import assert from 'node:assert/strict';
import {
  localDate,
  zonedISO,
  validPhone,
  slotsForDay,
  slotTimes,
  hoursSummary,
  DEFAULT_HOURS,
  demoData,
  duplicateGroups,
  mergeClientsLocal,
  type Hours,
} from '../src/domain.ts';
test('clinic timezone is used instead of the device timezone', () => {
  assert.equal(
    zonedISO('2026-09-07', '09:00', 'America/Lima'),
    '2026-09-07T14:00:00.000Z',
  );
  assert.equal(
    localDate(new Date('2026-09-07T02:00:00Z'), 'America/Lima'),
    '2026-09-06',
  );
});
test('phone numbers require international E.164 format', () => {
  assert.equal(validPhone('+51987654321'), true);
  for (const x of ['987654321', '+0123456789', '+51 987654321', '+5198'])
    assert.equal(validPhone(x), false);
});
test('closed days provide no slots; Sunday is closed by default', () =>
  assert.deepEqual(slotsForDay('2099-09-06', [], DEFAULT_HOURS), []));
test('slots follow the configured opening hours', () => {
  const hours: Hours = [
    ...Array.from({ length: 5 }, () => ({ open: '08:30', close: '17:00' })),
    { open: '09:00', close: '13:00' },
    { open: '10:00', close: '11:00' },
  ];
  // 2099-09-07 is a Monday, 2099-09-12 a Saturday, 2099-09-06 a Sunday.
  const monday = slotTimes('2099-09-07', hours);
  assert.equal(monday[0], '08:30');
  assert.equal(monday.at(-1), '16:30');
  assert.equal(slotTimes('2099-09-12', hours).at(-1), '12:30');
  assert.deepEqual(slotTimes('2099-09-06', hours), ['10:00', '10:30']);
  assert.equal(
    hoursSummary(hours),
    'Lunes a viernes 08:30–17:00 · Sábado 09:00–13:00 · Domingo 10:00–11:00',
  );
  assert.equal(hoursSummary(DEFAULT_HOURS), 'Lunes a sábado 09:00–18:00');
  assert.equal(
    hoursSummary([...DEFAULT_HOURS.slice(0, 5), null, { open: '09:00', close: '18:00' }]),
    'Lunes a viernes 09:00–18:00 · Domingo 09:00–18:00',
  );
});
test('clients sharing a phone are grouped and merged with their repeated pets', () => {
  const data = demoData();
  const groups = duplicateGroups(data.clients);
  assert.deepEqual(
    groups.get('+51900000001')?.map((c) => c.id),
    ['c1', 'c4'],
  );
  assert.equal(groups.size, 1);
  const merged = mergeClientsLocal(data, 'c1', 'c4', true);
  assert.equal(merged.clients.length, data.clients.length - 1);
  assert.equal(duplicateGroups(merged.clients).size, 0);
  const lunas = merged.pets.filter((p) => p.name.toLowerCase() === 'luna');
  assert.equal(lunas.length, 1, 'luna and Luna become one pet');
  assert.equal(lunas[0].client_id, 'c1');
  // The newer file carries the latest WhatsApp authorization.
  assert.equal(merged.clients.find((c) => c.id === 'c1')?.consent, true);
  const separate = mergeClientsLocal(data, 'c1', 'c4', false);
  assert.equal(
    separate.pets.filter((p) => p.client_id === 'c1').length,
    2,
    'without pet merge both pets move to the kept file',
  );
});

