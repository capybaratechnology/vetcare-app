import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
test('PostgreSQL schema, staff permissions, booking transaction and reminder claims', async (t) => {
  const db = new PGlite();
  await db.exec(`
 create role anon; create role authenticated; create role service_role bypassrls;
 create schema auth; create table auth.users(id uuid primary key,email text);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to authenticated,anon,service_role;
 grant execute on function auth.uid() to authenticated,anon,service_role;
 `);
  // PGlite already provides gen_random_uuid; pgcrypto packaging is Supabase-specific.
  const migration = (
    await readFile(
      new URL(
        '../supabase/migrations/202609050001_vetcare.sql',
        import.meta.url,
      ),
      'utf8',
    )
  ).replace('create extension if not exists pgcrypto;', '');
  await db.exec(migration);
  await db.exec(
    await readFile(
      new URL(
        '../supabase/migrations/202609050002_staff_administration.sql',
        import.meta.url,
      ),
      'utf8',
    ),
  );
  await db.exec(
    await readFile(
      new URL(
        '../supabase/migrations/202610060001_clinic_profile.sql',
        import.meta.url,
      ),
      'utf8',
    ),
  );
  await db.exec(
    await readFile(
      new URL(
        '../supabase/migrations/202610070001_record_appointment.sql',
        import.meta.url,
      ),
      'utf8',
    ),
  );
  await db.exec(
    await readFile(
      new URL(
        '../supabase/migrations/202610070002_opening_hours.sql',
        import.meta.url,
      ),
      'utf8',
    ),
  );
  // 202610070003_realtime.sql only alters the Supabase publication; not available here.
  await db.exec(
    await readFile(
      new URL(
        '../supabase/migrations/202610070004_merge_clients.sql',
        import.meta.url,
      ),
      'utf8',
    ),
  );
  await db.exec(
    await readFile(
      new URL(
        '../supabase/migrations/202610080001_services_cash.sql',
        import.meta.url,
      ),
      'utf8',
    ),
  );
  // 202610080002_realtime_cash.sql only alters the Supabase publication.
  const admin = '10000000-0000-4000-8000-000000000001',
    reception = '10000000-0000-4000-8000-000000000002',
    stranger = '10000000-0000-4000-8000-000000000003';
  await db.exec(
    `insert into auth.users(id) values ('${admin}'),('${reception}'),('${stranger}');insert into staff(user_id,name,role) values ('${admin}','Vet','vet'),('${reception}','Recepción','reception');`,
  );
  const client = (
    await db.query<{ id: string }>(
      `insert into clients(name,phone,consent) values('Cliente de prueba','+51999999999',true) returning id`,
    )
  ).rows[0].id;
  const pet = (
    await db.query<{ id: string }>(
      `insert into pets(client_id,name,species) values($1,'Prueba','Perro') returning id`,
      [client],
    )
  ).rows[0].id;
  async function asUser(id: string) {
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
    await db.exec('set role authenticated');
  }
  await t.test(
    'authenticated outsiders cannot read or create clinic data',
    async () => {
      await asUser(stranger);
      assert.equal((await db.query('select * from clients')).rows.length, 0);
      await assert.rejects(
        db.query(
          `insert into clients(name,phone) values('Intruso','+51999999998')`,
        ),
      );
      await db.exec('reset role');
    },
  );
  await t.test(
    'clinician can append history but cannot rewrite or impersonate an author',
    async () => {
      await asUser(admin);
      await db.query(
        `insert into medical_records(pet_id,diagnosis) values($1,'Control clínico')`,
        [pet],
      );
      assert.equal(
        (await db.query('select * from medical_records')).rows.length,
        1,
      );
      await assert.rejects(
        db.query("update medical_records set diagnosis='Borrado'"),
      );
      await assert.rejects(
        db.query(
          `insert into medical_records(pet_id,diagnosis,author_id) values($1,'Suplantado',$2)`,
          [pet, reception],
        ),
      );
      await db.exec('reset role');
    },
  );
  await t.test(
    'reception can see clients but not clinical entries',
    async () => {
      await asUser(reception);
      assert.equal((await db.query('select * from clients')).rows.length, 1);
      assert.equal(
        (await db.query('select * from medical_records')).rows.length,
        0,
      );
      await assert.rejects(
        db.query(
          `insert into medical_records(pet_id,diagnosis) values($1,'Sin permiso')`,
          [pet],
        ),
      );
      await db.exec('reset role');
    },
  );
  let slot: string,
    key = crypto.randomUUID(),
    reservation: string;
  const next = new Date(Date.now() + 3 * 86400000);
  while (next.getUTCDay() === 0) next.setUTCDate(next.getUTCDate() + 1);
  const day = next.toISOString().slice(0, 10);
  await t.test(
    'public has no direct record or booking RPC access',
    async () => {
      await db.exec('set role anon');
      await assert.rejects(db.query('select * from clients'));
      await assert.rejects(
        db.query('select * from available_slots($1)', [day]),
      );
      await db.exec('reset role');
    },
  );
  await t.test(
    'atomic booking creates linked records and is idempotent',
    async () => {
      const slots = await db.query<{ starts_at: Date }>(
        'select * from available_slots($1)',
        [day],
      );
      assert.equal(slots.rows.length, 18);
      slot = new Date(slots.rows[0].starts_at).toISOString();
      const args = [
        key,
        'Reserva prueba',
        '+51911111111',
        'Nube',
        'Gato',
        'Vacunación',
        slot,
        true,
        'ip-test',
      ];
      reservation = (
        await db.query<{ id: string }>(
          'select reserve_public($1,$2,$3,$4,$5,$6,$7,$8,$9) as id',
          args,
        )
      ).rows[0].id;
      assert.equal(
        (
          await db.query<{ id: string }>(
            'select reserve_public($1,$2,$3,$4,$5,$6,$7,$8,$9) as id',
            args,
          )
        ).rows[0].id,
        reservation,
      );
      assert.equal((await db.query('select * from clients')).rows.length, 2);
      assert.equal(
        (await db.query('select * from available_slots($1)', [day])).rows
          .length,
        17,
      );
    },
  );
  await t.test(
    'conflicting reservation rolls back and leaves no orphan client or pet',
    async () => {
      await assert.rejects(
        db.query('select reserve_public($1,$2,$3,$4,$5,$6,$7,$8,$9)', [
          crypto.randomUUID(),
          'Conflicto',
          '+51911111112',
          'Nube',
          'Gato',
          'Vacunación',
          slot,
          true,
          'ip-other',
        ]),
      );
      assert.equal((await db.query('select * from clients')).rows.length, 2);
      assert.equal((await db.query('select * from pets')).rows.length, 2);
    },
  );
  await t.test(
    'staff cannot forge reminder results or use closed hours',
    async () => {
      await asUser(reception);
      await assert.rejects(
        db.query("update appointments set reminder_state='accepted'"),
      );
      await assert.rejects(
        db.query(
          `insert into appointments(pet_id,starts_at,reason) values($1,$2,'Consulta general')`,
          [pet, day + 'T04:00:00Z'],
        ),
      );
      await db.exec('reset role');
    },
  );
  await t.test('cancellation releases a slot', async () => {
    await db.query("update appointments set status='cancelled' where id=$1", [
      reservation,
    ]);
    assert.equal(
      (await db.query('select * from available_slots($1)', [day])).rows.length,
      18,
    );
  });
  await t.test(
    'only consented upcoming appointments are claimed; repeated runs do not duplicate',
    async () => {
      // Isolate reminder timing from opening-hours rules.
      await db.exec(
        'alter table appointments disable trigger check_appointment',
      );
      await db.query(
        `insert into appointments(pet_id,starts_at,reason) values($1,now()+interval '45 minutes','Consulta general'),($1,now()+interval '2 hours','Consulta general'),($1,now()-interval '10 minutes','Consulta general')`,
        [pet],
      );
      const noConsent = (
        await db.query<{ id: string }>(
          `insert into clients(name,phone,consent) values('Sin permiso','+51911111113',false) returning id`,
        )
      ).rows[0].id;
      const otherPet = (
        await db.query<{ id: string }>(
          `insert into pets(client_id,name,species) values($1,'Otro','Perro') returning id`,
          [noConsent],
        )
      ).rows[0].id;
      await db.query(
        `insert into appointments(pet_id,starts_at,reason) values($1,now()+interval '50 minutes','Consulta general')`,
        [otherPet],
      );
      await db.exec(
        'alter table appointments enable trigger check_appointment',
      );
      const first = await db.query('select * from claim_reminders()');
      assert.equal(first.rows.length, 1);
      assert.equal(
        (await db.query('select * from claim_reminders()')).rows.length,
        0,
      );
      await db.exec(
        "update appointments set reminder_claimed_at=now()-interval '11 minutes' where reminder_state='sending'",
      );
      assert.equal(
        (await db.query('select * from claim_reminders()')).rows.length,
        0,
      );
      assert.equal(
        (
          await db.query(
            "select * from appointments where reminder_state='uncertain'",
          )
        ).rows.length,
        1,
      );
    },
  );

  const manager = '10000000-0000-4000-8000-000000000004',
    employee = '10000000-0000-4000-8000-000000000005';
  await db.exec(
    `insert into auth.users(id,email) values ('${manager}','manager@example.com'),('${employee}','employee@example.com');insert into staff(user_id,name,role,email) values ('${manager}','Administrador','admin','manager@example.com');`,
  );
  await t.test(
    'only administrator can list the team and nobody can assign roles directly',
    async () => {
      await asUser(reception);
      assert.equal((await db.query('select * from staff')).rows.length, 1);
      await assert.rejects(db.query("update staff set role='admin'"));
      await assert.rejects(
        db.query('select manage_staff($1,$2,$3,$4,$5)', [
          manager,
          reception,
          'Escalado',
          'admin',
          true,
        ]),
      );
      await asUser(manager);
      assert.equal((await db.query('select * from staff')).rows.length, 3);
      await assert.rejects(db.query('update staff set active=false'));
      await db.exec('reset role');
    },
  );
  await t.test(
    'management rechecks actor authority and saves the selected profile',
    async () => {
      await assert.rejects(
        db.query('select manage_staff($1,$2,$3,$4,$5)', [
          reception,
          employee,
          'Usuario',
          'admin',
          true,
        ]),
      );
      await db.query('select manage_staff($1,$2,$3,$4,$5)', [
        manager,
        employee,
        'Usuario',
        'vet',
        true,
      ]);
      const row = (
        await db.query<{ role: string; email: string }>(
          'select * from staff where user_id=$1',
          [employee],
        )
      ).rows[0];
      assert.equal(row.role, 'vet');
      assert.equal(row.email, 'employee@example.com');
      await asUser(employee);
      assert.equal(
        (await db.query('select * from medical_records')).rows.length,
        1,
      );
      await db.exec('reset role');
    },
  );
  await t.test(
    'deactivation immediately removes data access from an existing identity',
    async () => {
      await db.query('select manage_staff($1,$2,$3,$4,$5)', [
        manager,
        employee,
        'Usuario',
        'vet',
        false,
      ]);
      await asUser(employee);
      assert.equal((await db.query('select * from clients')).rows.length, 0);
      assert.equal(
        (await db.query('select * from medical_records')).rows.length,
        0,
      );
      await assert.rejects(
        db.query(
          "insert into clients(name,phone) values('Sin acceso','+51912345678')",
        ),
      );
      await db.exec('reset role');
      await db.query('select manage_staff($1,$2,$3,$4,$5)', [
        manager,
        employee,
        'Usuario',
        'reception',
        true,
      ]);
      await asUser(employee);
      assert.ok((await db.query('select * from clients')).rows.length > 0);
      assert.equal(
        (await db.query('select * from medical_records')).rows.length,
        0,
      );
      await db.exec('reset role');
    },
  );
  await t.test(
    'administrator cannot deactivate or demote their own account',
    async () => {
      await assert.rejects(
        db.query('select manage_staff($1,$2,$3,$4,$5)', [
          manager,
          manager,
          'Administrador',
          'admin',
          false,
        ]),
      );
      await assert.rejects(
        db.query('select manage_staff($1,$2,$3,$4,$5)', [
          manager,
          manager,
          'Administrador',
          'vet',
          true,
        ]),
      );
      assert.equal(
        (
          await db.query<{ count: number }>(
            "select count(*)::int as count from staff where role='admin' and active",
          )
        ).rows[0].count,
        1,
      );
    },
  );
  await t.test(
    'demoted administrator cannot remove the remaining administrator',
    async () => {
      await db.query('select manage_staff($1,$2,$3,$4,$5)', [
        manager,
        employee,
        'Segundo admin',
        'admin',
        true,
      ]);
      await db.query('select manage_staff($1,$2,$3,$4,$5)', [
        manager,
        employee,
        'Segundo admin',
        'vet',
        true,
      ]);
      await assert.rejects(
        db.query('select manage_staff($1,$2,$3,$4,$5)', [
          employee,
          manager,
          'Administrador',
          'vet',
          false,
        ]),
      );
      await assert.rejects(
        db.query('select manage_staff($1,$2,$3,$4,$5)', [
          manager,
          employee,
          'Usuario',
          'root',
          true,
        ]),
      );
    },
  );

  await t.test(
    'clinic profile is public to read and only admins can change it',
    async () => {
      await db.exec('reset role');
      await db.exec('set role anon');
      const pub = await db.query<{ name: string }>(
        'select name,address,logo_url from clinic_settings',
      );
      assert.equal(pub.rows[0].name, 'VetCare');
      await assert.rejects(db.query('select timezone from clinic_settings'));
      await assert.rejects(
        db.query("update clinic_settings set name='Anónimo'"),
      );
      await asUser(reception);
      await db.query("update clinic_settings set name='Recepción'");
      await db.exec('reset role');
      assert.equal(
        (await db.query<{ name: string }>('select name from clinic_settings'))
          .rows[0].name,
        'VetCare',
        'non-admin update affects no rows',
      );
      await db.exec(
        `insert into auth.users(id) values ('10000000-0000-4000-8000-000000000009');insert into staff(user_id,name,role) values ('10000000-0000-4000-8000-000000000009','Admin','admin');`,
      );
      await asUser('10000000-0000-4000-8000-000000000009');
      await db.query(
        "update clinic_settings set name='Huellitas',address='Av. Larco 123',logo_url='https://example.com/logo.png'",
      );
      await assert.rejects(
        db.query("update clinic_settings set timezone='UTC'"),
      );
      await assert.rejects(
        db.query("update clinic_settings set logo_url='javascript:alert(1)'"),
      );
      await db.exec('reset role');
      const saved = await db.query<{ name: string; timezone: string }>(
        'select name,timezone from clinic_settings',
      );
      assert.equal(saved.rows[0].name, 'Huellitas');
      assert.equal(saved.rows[0].timezone, 'America/Lima');
    },
  );

  await t.test(
    'a consultation can document one completed appointment of the same pet',
    async () => {
      await db.exec('reset role');
      const vet = '10000000-0000-4000-8000-000000000010';
      await db.exec(
        `insert into auth.users(id) values ('${vet}');insert into staff(user_id,name,role) values ('${vet}','Veterinaria','vet');`,
      );
      await db.exec(
        'alter table appointments disable trigger check_appointment',
      );
      const [done, pending] = (
        await db.query<{ id: string }>(
          `insert into appointments(pet_id,starts_at,reason,status) values($1,now()-interval '1 hour','Vacunación','completed'),($1,now()+interval '1 day','Vacunación','confirmed') returning id`,
          [pet],
        )
      ).rows.map((r) => r.id);
      await db.exec('alter table appointments enable trigger check_appointment');
      const otherPet = (
        await db.query<{ id: string }>(
          `insert into pets(client_id,name,species) values($1,'Ajeno','Gato') returning id`,
          [client],
        )
      ).rows[0].id;
      await asUser(vet);
      const insert = (petId: string, appointment: string) =>
        db.query(
          `insert into medical_records(pet_id,diagnosis,appointment_id) values($1,'Vacuna aplicada',$2)`,
          [petId, appointment],
        );
      await assert.rejects(insert(otherPet, done), /no corresponde/);
      await assert.rejects(insert(pet, pending), /cita atendida/);
      await insert(pet, done);
      await assert.rejects(insert(pet, done), 'only one consultation per appointment');
      await db.exec('reset role');
      assert.equal(
        (
          await db.query(
            'select * from medical_records where appointment_id=$1',
            [done],
          )
        ).rows.length,
        1,
      );
    },
  );

  await t.test(
    'opening hours are validated and drive slots and appointment checks',
    async () => {
      await db.exec('reset role');
      const week = (sunday: string) =>
        JSON.stringify([
          { open: '09:00', close: '18:00' },
          { open: '09:00', close: '18:00' },
          { open: '09:00', close: '18:00' },
          { open: '09:00', close: '18:00' },
          { open: '09:00', close: '18:00' },
          { open: '09:00', close: '13:00' },
          sunday === 'closed' ? null : JSON.parse(sunday),
        ]);
      for (const bad of [
        '[]',
        JSON.stringify(Array(7).fill({ open: '18:00', close: '09:00' })),
        JSON.stringify(Array(7).fill({ open: '09:15', close: '18:00' })),
        JSON.stringify(Array(7).fill('abierto')),
      ])
        await assert.rejects(
          db.query('update clinic_settings set hours=$1::jsonb', [bad]),
          bad,
        );
      await db.query('update clinic_settings set hours=$1::jsonb', [
        week('{"open":"10:00","close":"12:00"}'),
      ]);
      // A Sunday two weeks ahead, and a Saturday in the same week.
      const { rows } = await db.query<{ sun: string; sat: string }>(
        `select (d + (7 - extract(isodow from d)::int))::text as sun, (d + (6 - extract(isodow from d)::int))::text as sat from (select (now() at time zone 'America/Lima')::date + 7 as d) x`,
      );
      const slots = async (day: string) =>
        (
          await db.query<{ t: string }>(
            `select to_char(starts_at at time zone 'America/Lima','HH24:MI') t from available_slots($1::date)`,
            [day],
          )
        ).rows.map((r) => r.t);
      assert.deepEqual(await slots(rows[0].sun), ['10:00', '10:30', '11:00', '11:30']);
      assert.equal((await slots(rows[0].sat)).at(-1), '12:30');
      const insertAt = (day: string, time: string) =>
        db.query(
          `insert into appointments(pet_id,starts_at,reason) values($1,($2::date+$3::time) at time zone 'America/Lima','Consulta general')`,
          [pet, day, time],
        );
      await assert.rejects(insertAt(rows[0].sat, '13:00'), /fuera del horario/);
      await insertAt(rows[0].sun, '11:30');
      await db.query('update clinic_settings set hours=$1::jsonb', [week('closed')]);
      assert.deepEqual(await slots(rows[0].sun), []);
      await assert.rejects(insertAt(rows[0].sun, '10:00'), /fuera del horario/);
    },
  );

  await t.test(
    'staff merge duplicate clients and their repeated pets in one step',
    async () => {
      await db.exec('reset role');
      const id = async (sql: string, params: unknown[] = []) =>
        (await db.query<{ id: string }>(sql, params)).rows[0].id;
      const keep = await id(
        `insert into clients(name,phone,email,consent,created_at) values('Ana Torres','+51955555501','',false,now()-interval '30 days') returning id`,
      );
      const dup = await id(
        `insert into clients(name,phone,email,consent) values('Ana T.','+51955555501','ana@example.com',true) returning id`,
      );
      const luna = await id(
        `insert into pets(client_id,name,species,breed) values($1,'Luna','Perro','') returning id`,
        [keep],
      );
      const lunaWeb = await id(
        `insert into pets(client_id,name,species,breed,allergies) values($1,' luna ','Perro','Mestiza','Pollo') returning id`,
        [dup],
      );
      const michi = await id(
        `insert into pets(client_id,name,species) values($1,'Michi','Gato') returning id`,
        [dup],
      );
      await db.exec('alter table appointments disable trigger check_appointment');
      const visit = await id(
        `insert into appointments(pet_id,starts_at,reason,status) values($1,now()-interval '3 days','Vacunación','completed') returning id`,
        [lunaWeb],
      );
      await db.exec('alter table appointments enable trigger check_appointment');
      await db.query(
        `insert into medical_records(pet_id,diagnosis,appointment_id) values($1,'Vacuna aplicada',$2)`,
        [lunaWeb, visit],
      );
      await asUser(stranger);
      await assert.rejects(
        db.query('select merge_clients($1,$2,true)', [keep, dup]),
        /permiso/,
      );
      await asUser(reception);
      await assert.rejects(db.query('select merge_clients($1,$1,true)', [keep]));
      await db.query('select merge_clients($1,$2,true)', [keep, dup]);
      await db.exec('reset role');
      assert.equal(
        (await db.query('select 1 from clients where id=$1', [dup])).rows.length,
        0,
      );
      const client = (
        await db.query<{ email: string; consent: boolean; name: string }>(
          'select name,email,consent from clients where id=$1',
          [keep],
        )
      ).rows[0];
      assert.deepEqual(client, {
        name: 'Ana Torres',
        email: 'ana@example.com',
        consent: true,
      });
      const pets = (
        await db.query<{ id: string; name: string; breed: string; allergies: string }>(
          'select id,name,breed,allergies from pets where client_id=$1 order by name',
          [keep],
        )
      ).rows;
      assert.deepEqual(
        pets.map((x) => x.id),
        [luna, michi],
        'Luna merged, Michi moved',
      );
      assert.equal(pets[0].breed, 'Mestiza');
      assert.equal(pets[0].allergies, 'Pollo');
      for (const table of ['appointments', 'medical_records'])
        assert.equal(
          (await db.query(`select 1 from ${table} where pet_id=$1`, [luna]))
            .rows.length,
          1,
          table + ' follow the merged pet',
        );
    },
  );

  await t.test(
    'services are public without prices and drive appointment reasons',
    async () => {
      await db.exec('reset role');
      await db.exec('set role anon');
      const pub = await db.query<{ name: string }>(
        'select name from services order by sort',
      );
      assert.ok(pub.rows.some((r) => r.name === 'Baño medicado'));
      await assert.rejects(db.query('select price from services'));
      await db.exec('reset role');
      await db.exec('alter table appointments disable trigger check_appointment');
      await assert.rejects(
        db.query(
          `insert into appointments(pet_id,starts_at,reason) values($1,now()+interval '3 days','Masaje')`,
          [pet],
        ),
        /servicio/,
      );
      // Surgery is not bookable online, but staff can schedule it.
      await assert.rejects(
        db.query(
          `insert into appointments(pet_id,starts_at,reason,source) values($1,now()+interval '3 days','Cirugía','web')`,
          [pet],
        ),
        /servicio/,
      );
      await db.query(
        `insert into appointments(pet_id,starts_at,reason) values($1,now()+interval '3 days','Cirugía')`,
        [pet],
      );
      await db.exec('alter table appointments enable trigger check_appointment');
    },
  );

  await t.test(
    'cash register: open, charge, expenses, close with count and void rules',
    async () => {
      await db.exec('reset role');
      const cashier = '10000000-0000-4000-8000-000000000020',
        boss = '10000000-0000-4000-8000-000000000021',
        doctor = '10000000-0000-4000-8000-000000000022';
      await db.exec(
        `insert into auth.users(id) values ('${cashier}'),('${boss}'),('${doctor}');insert into staff(user_id,name,role) values ('${cashier}','Caja','reception'),('${boss}','Jefa','admin'),('${doctor}','Doc','vet');`,
      );
      const bath = (
        await db.query<{ id: string }>(
          "update services set price=35 where name='Baño medicado' returning id",
        )
      ).rows[0].id;
      await db.exec('alter table appointments disable trigger check_appointment');
      const visit = (
        await db.query<{ id: string }>(
          `insert into appointments(pet_id,starts_at,reason,status) values($1,now()-interval '2 hours','Baño medicado','completed') returning id`,
          [pet],
        )
      ).rows[0].id;
      await db.exec('alter table appointments enable trigger check_appointment');
      const items = JSON.stringify([
        { service_id: bath, description: 'Baño medicado', quantity: 1, unit_price: 35 },
        { service_id: null, description: 'Champú extra', quantity: 2, unit_price: 7.5 },
      ]);
      const pay = (appointment: string | null, method = 'Efectivo', discount = 0) =>
        db.query<{ id: string; total: string; number: string; client_id: string }>(
          'select * from create_payment($1,null,null,$2::jsonb,$3,$4,$5)',
          [appointment, items, discount, method, ''],
        );

      await asUser(doctor);
      await assert.rejects(db.query('select open_cash_session(100)'), /permiso/);
      assert.equal((await db.query('select * from payments')).rows.length, 0);

      await asUser(cashier);
      await assert.rejects(pay(visit), /Abre la caja/);
      await db.query('select open_cash_session(100)');
      await assert.rejects(db.query('select open_cash_session(50)'), /ya está abierta/);
      await assert.rejects(pay(visit, 'Efectivo', 60), /descuento/);
      const first = (await pay(visit, 'Efectivo', 5)).rows[0];
      assert.equal(Number(first.total), 45, '35 + 2 x 7.50 - 5');
      assert.equal(first.client_id, client, 'client taken from the appointment');
      await assert.rejects(pay(visit), /ya fue cobrada/);
      await pay(null, 'Yape/Plin');
      await assert.rejects(
        db.query("insert into payments(session_id,subtotal,total,method,created_by) select id,1,1,'Efectivo',auth.uid() from cash_sessions"),
        'no direct writes',
      );
      await db.query(
        "select create_expense(current_date,'Insumos','Guantes',12.5,'Efectivo')",
      );
      await db.query(
        "select create_expense(current_date,'Alquiler','Local',800,'Transferencia')",
      );
      // Expected cash: 100 opening + 45 cash payment - 12.50 cash expense.
      const closed = (
        await db.query<{ expected_cash: string; counted_cash: string }>(
          "select * from close_cash_session(130,'')",
        )
      ).rows[0];
      assert.equal(Number(closed.expected_cash), 132.5);
      assert.equal(Number(closed.counted_cash), 130);
      await assert.rejects(
        db.query("select void_payment($1,'Error de cobro')", [first.id]),
        /administrador/,
      );
      await asUser(boss);
      await db.query("select void_payment($1,'Error de cobro')", [first.id]);
      await db.exec('reset role');
      const after = (
        await db.query<{ status: string }>('select status from payments where id=$1', [first.id])
      ).rows[0];
      assert.equal(after.status, 'void');
    },
  );

  await db.close();
});
