import Pets from '@mui/icons-material/Pets';
import { supabase } from './data';
import { DEFAULT_HOURS, type Hours } from './domain';
export type Clinic = {
  name: string;
  address: string;
  logo_url: string | null;
  hours: Hours;
};
export const DEFAULT_CLINIC: Clinic = {
  name: 'VetCare',
  address: '',
  logo_url: null,
  hours: DEFAULT_HOURS,
};
export async function fetchClinic(): Promise<Clinic> {
  if (!supabase) return DEFAULT_CLINIC;
  const read = (columns: string) =>
    supabase!
      .from('clinic_settings')
      .select(columns)
      .eq('id', true)
      .maybeSingle();
  let { data, error } = await read('name,address,logo_url,hours');
  // Before the opening-hours migration the column is missing; keep the default schedule.
  if (error) ({ data, error } = await read('name,address,logo_url'));
  if (error || !data) return DEFAULT_CLINIC;
  return { ...DEFAULT_CLINIC, ...(data as Partial<Clinic>) };
}
export function ClinicLogo({ clinic }: { clinic: Clinic }) {
  return clinic.logo_url ? (
    <img className="clinic-logo" src={clinic.logo_url} alt="" />
  ) : (
    <Pets />
  );
}
// Default brand keeps the original "vetcare+" wordmark; a custom name is shown as typed.
export function Brand({ clinic }: { clinic: Clinic }) {
  return (
    <>
      <ClinicLogo clinic={clinic} />
      {clinic.name === DEFAULT_CLINIC.name ? (
        <>
          vetcare<span>+</span>
        </>
      ) : (
        clinic.name
      )}
    </>
  );
}
