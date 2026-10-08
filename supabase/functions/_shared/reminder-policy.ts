// "hoy a las 17:30", "mañana a las 09:00" or "el 08/10 a las 10:30", in the clinic's time zone.
export function appointmentWhen(startsAt: Date, now: Date, timeZone: string) {
  const day = (d: Date) =>
    new Intl.DateTimeFormat('en-CA', { timeZone }).format(d);
  const time = new Intl.DateTimeFormat('es-PE', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(startsAt);
  const target = day(startsAt);
  if (target === day(now)) return 'hoy a las ' + time;
  if (target === day(new Date(now.getTime() + 86400000)))
    return 'mañana a las ' + time;
  const [, month, date] = target.split('-');
  return 'el ' + date + '/' + month + ' a las ' + time;
}

export function reminderMessage(
  clinic: { name: string; address: string },
  clientName: string,
  petName: string,
  when: string,
) {
  return (
    'Hola ' +
    clientName +
    ', te recordamos que ' +
    petName +
    ' tiene una cita ' +
    when +
    ' en ' +
    clinic.name +
    '.' +
    (clinic.address ? ' Dirección: ' + clinic.address + '.' : '') +
    ' Si necesitas cambiarla, contacta a la clínica.'
  );
}

export function classifyProviderResponse(
  status: number,
  body: {
    error?: boolean;
    message?: string;
    data?: { success?: boolean; message?: string; message_id?: string };
  },
  attempts: number,
) {
  const id = body.data?.message_id;
  if (
    status >= 200 &&
    status < 300 &&
    body.error === false &&
    body.data?.success === true &&
    id
  )
    return {
      reminder_state: 'accepted',
      reminder_message_id: String(id),
      reminder_error: null,
    };
  // A transport/server error can have happened after the provider accepted the message.
  // Do not retry ambiguous outcomes; this avoids duplicate reminders.
  if (status >= 500 || (status >= 200 && status < 300))
    return {
      reminder_state: 'uncertain',
      reminder_error:
        'Respuesta ambigua. Revisar el panel de WhatsApp antes de reenviar.',
    };
  if (status === 429 && attempts < 3)
    return {
      reminder_state: 'pending',
      reminder_next_at: new Date(Date.now() + 120000).toISOString(),
      reminder_error: 'Límite temporal del proveedor de WhatsApp',
    };
  return {
    reminder_state: 'failed',
    reminder_error:
      'El proveedor rechazó el envío: ' +
      String(body.data?.message || body.message || status).slice(0, 200),
  };
}
