import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
const url = Deno.env.get('SUPABASE_URL')!,
  serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const db = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const allowed = (Deno.env.get('ALLOWED_ORIGINS') || '')
  .split(',')
  .map((s) => s.trim());
Deno.serve(async (req) => {
  const origin = req.headers.get('origin') || '';
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': allowed.includes(origin) ? origin : 'null',
    'Access-Control-Allow-Headers':
      'authorization,x-client-info,apikey,content-type',
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
    Vary: 'Origin',
  };
  const respond = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers });
  if (!allowed.includes(origin))
    return respond({ error: 'Origen no permitido' }, 403);
  if (req.method === 'OPTIONS')
    return new Response(null, { status: 204, headers });
  if (req.method !== 'POST')
    return respond({ error: 'Método no permitido' }, 405);
  const token = req.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
  if (!token) return respond({ error: 'Inicia sesión para continuar' }, 401);
  // Validate the token with Supabase Auth, never trust client role or decoded JWT alone.
  const {
    data: { user },
    error: authError,
  } = await db.auth.getUser(token);
  if (authError || !user)
    return respond(
      { error: 'Tu sesión no es válida. Vuelve a ingresar.' },
      401,
    );
  const { data: actor, error: profileError } = await db
    .from('staff')
    .select('role,active')
    .eq('user_id', user.id)
    .maybeSingle();
  if (profileError || !actor?.active || actor.role !== 'admin')
    return respond(
      { error: 'Solo un administrador activo puede gestionar usuarios' },
      403,
    );
  try {
    const text = await req.text();
    if (text.length > 5000)
      return respond({ error: 'Solicitud demasiado grande' }, 413);
    const b = JSON.parse(text);
    if (b.action === 'list') {
      // Use caller-scoped RLS for listing, even after the administrator check.
      const scoped = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
        global: { headers: { Authorization: 'Bearer ' + token } },
        auth: { persistSession: false, autoRefreshToken: false },
      });
      let users: unknown[] = [];
      for (let offset = 0; ; offset += 1000) {
        const { data, error } = await scoped
          .from('staff')
          .select('user_id,name,email,role,active,created_at')
          .order('created_at')
          .order('user_id')
          .range(offset, offset + 999);
        if (error) throw error;
        users = users.concat(data);
        if (data.length < 1000) break;
      }
      return respond({ users });
    }
    if (
      !['create', 'update'].includes(b.action) ||
      typeof b.name !== 'string' ||
      b.name.trim().length < 2 ||
      b.name.length > 120 ||
      !['admin', 'vet', 'reception'].includes(b.role) ||
      typeof b.active !== 'boolean'
    )
      return respond(
        { error: 'Revisa el nombre, perfil y estado del usuario' },
        400,
      );
    if (b.action === 'update') {
      if (typeof b.user_id !== 'string' || !/^[0-9a-f-]{36}$/i.test(b.user_id))
        return respond({ error: 'Usuario no válido' }, 400);
      const { data: existing, error: lookupError } = await db
        .from('staff')
        .select('user_id')
        .eq('user_id', b.user_id)
        .maybeSingle();
      if (lookupError || !existing)
        return respond({ error: 'El usuario no existe en esta clínica' }, 404);
      const { data, error } = await db.rpc('manage_staff', {
        p_actor: user.id,
        p_target: b.user_id,
        p_name: b.name,
        p_role: b.role,
        p_active: b.active,
      });
      if (error)
        return respond(
          {
            error:
              error.code === '42501'
                ? 'Tu perfil ya no tiene permisos de administración.'
                : error.code === '22023'
                  ? error.message
                  : 'No se pudo actualizar el usuario.',
          },
          error.code === '42501' ? 403 : 400,
        );
      return respond({ user: data });
    }
    if (
      typeof b.email !== 'string' ||
      b.email.length > 254 ||
      !/^\S+@\S+\.\S+$/.test(b.email) ||
      typeof b.password !== 'string' ||
      b.password.length < 6 ||
      b.password.length > 128
    )
      return respond(
        {
          error: 'Usa un correo válido y una contraseña de 6 a 128 caracteres',
        },
        400,
      );
    // Explicit administrator provisioning. No invite or email is sent.
    const { data: created, error: createError } =
      await db.auth.admin.createUser({
        email: b.email.trim().toLowerCase(),
        password: b.password,
        email_confirm: true,
      });
    if (createError || !created.user)
      return respond(
        {
          error:
            'No se pudo crear la cuenta. El correo puede estar en uso o la contraseña no cumplir la política de Supabase.',
        },
        400,
      );
    const { data, error } = await db.rpc('manage_staff', {
      p_actor: user.id,
      p_target: created.user.id,
      p_name: b.name,
      p_role: b.role,
      p_active: b.active,
    });
    if (error) {
      // Compensate only the account created by this request. Never alter an existing account.
      const { error: cleanupError } = await db.auth.admin.deleteUser(
        created.user.id,
      );
      return respond(
        {
          error: cleanupError
            ? 'La cuenta de acceso se creó sin perfil. No tiene acceso a la clínica; revisa Authentication en Supabase antes de reintentar.'
            : 'No se pudo asignar el perfil. La cuenta nueva se revirtió; vuelve a intentarlo.',
        },
        500,
      );
    }
    return respond({ user: data }, 201);
  } catch {
    return respond(
      { error: 'No se pudo procesar la solicitud. Vuelve a intentarlo.' },
      500,
    );
  }
});
