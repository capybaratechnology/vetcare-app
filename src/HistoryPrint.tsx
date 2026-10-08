import { createPortal } from 'react-dom';
import { clock, dateLabel, localDate, type Data, type Pet } from './domain';
import type { Clinic } from './clinic';
// Printable clinical history. Rendered straight under <body> so it can span several pages;
// while printing (body.print-history) everything else is hidden. "Guardar como PDF" in the
// browser's print dialog produces the PDF.
export function printHistory() {
  document.body.classList.add('print-history');
  const done = () => {
    document.body.classList.remove('print-history');
    window.removeEventListener('afterprint', done);
  };
  window.addEventListener('afterprint', done);
  window.print();
}
export default function HistoryPrint({
  pet,
  data,
  clinic,
  author,
}: {
  pet: Pet;
  data: Data;
  clinic: Clinic;
  author: string;
}) {
  const owner = data.clients.find((c) => c.id === pet.client_id);
  const records = data.medical_records
    .filter((r) => r.pet_id === pet.id)
    .sort((a, b) => b.visit_date.localeCompare(a.visit_date));
  const controls = data.controls
    .filter((c) => c.pet_id === pet.id)
    .sort((a, b) => b.applied_on.localeCompare(a.applied_on));
  const origin = (id?: string | null) => {
    const a = id && data.appointments.find((x) => x.id === id);
    return a ? a.reason + ' · ' + dateLabel(localDate(new Date(a.starts_at))) + ' ' + clock(a.starts_at) : '';
  };
  const now = new Date().toISOString();
  return createPortal(
    <div className="history-print" aria-hidden="true">
      <header>
        {clinic.logo_url && <img src={clinic.logo_url} alt="" />}
        <div>
          <b>{clinic.name}</b>
          {clinic.address && <span>{clinic.address}</span>}
        </div>
      </header>
      <h1>Historia clínica</h1>
      <table className="history-facts">
        <tbody>
          <tr>
            <th>Paciente</th>
            <td>{pet.name}</td>
            <th>Especie / raza</th>
            <td>
              {pet.species} · {pet.breed || 'No registrada'}
            </td>
          </tr>
          <tr>
            <th>Sexo</th>
            <td>{pet.sex}</td>
            <th>Nacimiento</th>
            <td>{pet.birth_date ? dateLabel(pet.birth_date) : 'No registrado'}</td>
          </tr>
          <tr>
            <th>Peso</th>
            <td>{pet.weight ? pet.weight + ' kg' : 'Sin peso'}</td>
            <th>Responsable</th>
            <td>
              {owner?.name} {owner?.phone && '· ' + owner.phone}
            </td>
          </tr>
          <tr>
            <th>Alergias / antecedentes</th>
            <td colSpan={3}>{pet.allergies || 'Sin antecedentes registrados.'}</td>
          </tr>
        </tbody>
      </table>
      <h2>Consultas ({records.length})</h2>
      {records.map((r) => (
        <section className="history-entry" key={r.id}>
          <div>
            <b>{dateLabel(r.visit_date)}</b>
            {r.weight ? ' · ' + r.weight + ' kg' : ''}
            {r.appointment_id && <small> · Cita: {origin(r.appointment_id)}</small>}
          </div>
          <h3>{r.diagnosis}</h3>
          <p>{r.notes || 'Sin observaciones adicionales.'}</p>
        </section>
      ))}
      {!records.length && <p>Aún no hay consultas registradas.</p>}
      <h2>Vacunas y tratamientos ({controls.length})</h2>
      {controls.length ? (
        <table className="history-controls">
          <thead>
            <tr>
              <th>Tipo</th>
              <th>Nombre</th>
              <th>Aplicado</th>
              <th>Próximo control</th>
              <th>Notas</th>
            </tr>
          </thead>
          <tbody>
            {controls.map((c) => (
              <tr key={c.id}>
                <td>{c.kind}</td>
                <td>{c.name}</td>
                <td>{dateLabel(c.applied_on)}</td>
                <td>{c.next_due ? dateLabel(c.next_due) : '—'}</td>
                <td>{c.notes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p>Sin vacunas ni tratamientos registrados.</p>
      )}
      <footer>
        Generado el {dateLabel(now)} {clock(now)} por {author}. Documento con datos clínicos
        confidenciales.
      </footer>
    </div>,
    document.body,
  );
}
