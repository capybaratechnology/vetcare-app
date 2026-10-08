import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import {
  appointmentWhen,
  classifyProviderResponse,
  reminderMessage,
} from '../_shared/reminder-policy.ts';
const db = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false } },
);
Deno.serve(async (req) => {
  const secret = Deno.env.get('CRON_SECRET');
  if (!secret || req.headers.get('x-cron-secret') !== secret)
    return new Response('Unauthorized', { status: 401 });
  if (req.method !== 'POST')
    return new Response('Method not allowed', { status: 405 });
  const appKey = Deno.env.get('WHATSAPP_APP_KEY'),
    authKey = Deno.env.get('WHATSAPP_AUTH_KEY'),
    apiUrl =
      Deno.env.get('WHATSAPP_API_URL') ||
      'https://api.wsp.braintech.pe/api/create-message';
  if (!appKey || !authKey || !apiUrl.startsWith('https://'))
    return new Response('Missing WhatsApp configuration', { status: 503 });
  const { data: settings, error: settingsError } = await db
    .from('clinic_settings')
    .select('timezone,name,address')
    .eq('id', true)
    .single();
  if (settingsError)
    return new Response('Settings unavailable', { status: 500 });
  const { data: jobs, error } = await db.rpc('claim_reminders');
  if (error) return new Response('Claim failed', { status: 500 });
  const outcomes: Record<string, number> = {};
  await Promise.all(
    (jobs || []).map(
      async (job: {
        id: string;
        claim: string;
        phone: string;
        client_name: string;
        pet_name: string;
        starts_at: string;
      }) => {
        let update: Record<string, unknown>;
        try {
          const { data: a, error: readError } = await db
            .from('appointments')
            .select('status,starts_at,reminder_attempts,pets(clients(consent))')
            .eq('id', job.id)
            .eq('reminder_claim', job.claim)
            .single();
          if (readError || !a) throw Error('Read failed');
          const related = a.pets as unknown as {
            clients: { consent: boolean };
          };
          if (
            a.status !== 'confirmed' ||
            !related.clients.consent ||
            new Date(a.starts_at) <= new Date()
          ) {
            update = { reminder_state: 'skipped' };
          } else {
            const when = appointmentWhen(
              new Date(job.starts_at),
              new Date(),
              settings.timezone,
            );
            const form = new FormData();
            form.set('appkey', appKey);
            form.set('authkey', authKey);
            form.set('to', job.phone.replace(/\D/g, ''));
            form.set(
              'message',
              reminderMessage(settings, job.client_name, job.pet_name, when),
            );
            const response = await fetch(apiUrl, {
              method: 'POST',
              body: form,
              signal: AbortSignal.timeout(15000),
            });
            const body = await response.json().catch(() => ({}));
            update = classifyProviderResponse(
              response.status,
              body,
              a.reminder_attempts,
            );
          }
        } catch {
          update = {
            reminder_state: 'uncertain',
            reminder_error:
              'Resultado desconocido. Revisar el panel de WhatsApp antes de reenviar.',
          };
        }
        const { error: saveError } = await db
          .from('appointments')
          .update(update)
          .eq('id', job.id)
          .eq('reminder_claim', job.claim)
          .eq('reminder_state', 'sending');
        const label = saveError
          ? 'persistence_error'
          : String(update.reminder_state);
        outcomes[label] = (outcomes[label] || 0) + 1;
        // A stale sending lease becomes uncertain on the next worker runs, never silently resent.
      },
    ),
  );
  return Response.json({ processed: jobs?.length || 0, outcomes });
});
