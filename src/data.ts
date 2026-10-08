import { createClient } from '@supabase/supabase-js';
import { emptyData, type Data, type Table } from './domain';
const url = import.meta.env.VITE_SUPABASE_URL,
  key = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const supabase = url && key ? createClient(url, key) : null;
export async function fetchData(): Promise<Data> {
  if (!supabase) return emptyData;
  const tables = Object.keys(emptyData) as Table[];
  const result = await Promise.all(
    tables.map(async (table) => {
      let all: unknown[] = [];
      for (let offset = 0; ; offset += 1000) {
        const { data, error } = await supabase!
          .from(table)
          .select('*')
          .order('id')
          .range(offset, offset + 999);
        if (error) throw error;
        all = all.concat(data);
        if (data.length < 1000) break;
      }
      return [table, all];
    }),
  );
  return Object.fromEntries(result) as Data;
}
export async function saveRow(
  table: Table,
  row: Record<string, unknown>,
  id?: string,
) {
  if (!supabase) throw Error('Supabase no está conectado');
  const query = id
    ? supabase.from(table).update(row).eq('id', id)
    : supabase.from(table).insert(row);
  const { data, error } = await query.select().single();
  if (error) throw error;
  return data;
}
