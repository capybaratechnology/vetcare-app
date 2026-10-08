import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
const db = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false } },
);
const origins = (Deno.env.get('ALLOWED_ORIGINS') || '')
  .split(',')
  .map((s) => s.trim());
Deno.serve(async (req) => {
  const origin = req.headers.get('origin') || '';
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': origins.includes(origin) ? origin : 'null',
    'Access-Control-Allow-Headers':
      'authorization,x-client-info,apikey,content-type',
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
    Vary: 'Origin',
  };
  const respond = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers });
  if (!origins.includes(origin))
    return respond({ error: 'Origen no permitido' }, 403);
  if (req.method === 'OPTIONS')
    return new Response(null, { status: 204, headers });
  if (req.method !== 'POST')
    return respond({ error: 'Método no permitido' }, 405);
  try {
    const raw = await req.text();
    if (raw.length > 6000)
      return respond({ error: 'Solicitud demasiado grande' }, 413);
    const b = JSON.parse(raw);
    if (b.action === 'slots') {
      if (
        typeof b.day !== 'string' ||
        !/^\d{4}-\d{2}-\d{2}$/.test(b.day) ||
        !Number.isFinite(Date.parse(b.day))
      )
        return respond({ error: 'Fecha no válida' }, 400);
      const { data, error } = await db.rpc('available_slots', { p_day: b.day });
      if (error) throw error;
      return respond({ slots: data });
    }
    if (b.action !== 'book') return respond({ error: 'Acción no válida' }, 400);
    if (
      typeof b.name !== 'string' ||
      b.name.trim().length < 2 ||
      b.name.length > 120 ||
      typeof b.pet !== 'string' ||
      !b.pet.trim() ||
      b.pet.length > 100 ||
      typeof b.phone !== 'string' ||
      !/^\+[1-9]\d{7,14}$/.test(b.phone) ||
      !['Perro', 'Gato', 'Otro'].includes(b.species) ||
      ![
        'Consulta general',
        'Vacunación',
        'Control de tratamiento',
        'Desparasitación',
      ].includes(b.reason) ||
      typeof b.consent !== 'boolean' ||
      typeof b.key !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        b.key,
      ) ||
      typeof b.starts_at !== 'string' ||
      !Number.isFinite(Date.parse(b.starts_at))
    )
      return respond({ error: 'Revisa los datos de la reserva' }, 400);
    const secret = Deno.env.get('TURNSTILE_SECRET_KEY'),
      salt = Deno.env.get('BOOKING_RATE_SALT');
    if (!secret || !salt)
      return respond(
        { error: 'Las reservas todavía no están habilitadas' },
        503,
      );
    if (typeof b.token !== 'string' || !b.token || b.token.length > 2048)
      return respond({ error: 'Completa la verificación de seguridad' }, 400);
    // Supabase gateway provides the forwarded network address. Do not accept a body-supplied IP.
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
    const verification = await fetch(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      {
        method: 'POST',
        body: new URLSearchParams({ secret, response: b.token, remoteip: ip }),
        signal: AbortSignal.timeout(10000),
      },
    );
    if (!verification.ok)
      return respond(
        { error: 'Verificación no disponible. Vuelve a intentarlo.' },
        503,
      );
    const challenge = await verification.json();
    if (!challenge.success || challenge.hostname !== new URL(origin).hostname)
      return respond(
        { error: 'La verificación expiró. Inténtalo otra vez.' },
        400,
      );
    const digest = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(salt + ':' + ip),
    );
    const ipHash = Array.from(new Uint8Array(digest))
      .map((n) => n.toString(16).padStart(2, '0'))
      .join('');
    const { data, error } = await db.rpc('reserve_public', {
      p_key: b.key,
      p_name: b.name,
      p_phone: b.phone,
      p_pet: b.pet,
      p_species: b.species,
      p_reason: b.reason,
      p_starts_at: b.starts_at,
      p_consent: b.consent,
      p_ip_hash: ipHash,
    });
    if (error) {
      if (error.code === '23505' || error.message.includes('horario'))
        return respond(
          { error: 'El horario ya no está disponible. Elige otro.' },
          409,
        );
      if (error.message.includes('límite'))
        return respond(
          {
            error: 'Has alcanzado el límite de reservas. Inténtalo más tarde.',
          },
          429,
        );
      throw error;
    }
    return respond({ id: data, status: 'confirmed' });
  } catch {
    return respond(
      { error: 'No pudimos procesar la reserva. Inténtalo de nuevo.' },
      500,
    );
  }
});
