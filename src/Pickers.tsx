import { Autocomplete, TextField } from '@mui/material';
import type { Client, Pet } from './domain';
// Search-as-you-type selectors for long lists (hundreds of clients or pets).
// Matching ignores case and accents: "maria" finds "María".
const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase();
type Option = { id: string; label: string; detail: string; search: string };
function Picker({
  options,
  value,
  onChange,
  label,
  required,
  emptyText,
}: {
  options: Option[];
  value: string;
  onChange: (id: string) => void;
  label: string;
  required?: boolean;
  emptyText: string;
}) {
  const selected = options.find((o) => o.id === value) || null;
  return (
    <Autocomplete
      options={options}
      value={selected}
      onChange={(_e, o) => onChange(o?.id || '')}
      getOptionLabel={(o) => o.label}
      isOptionEqualToValue={(a, b) => a.id === b.id}
      filterOptions={(list, { inputValue }) => {
        const words = fold(inputValue).split(/\s+/).filter(Boolean);
        // Every typed word must appear (pet, owner or phone), in any order.
        return list.filter((o) => words.every((w) => o.search.includes(w))).slice(0, 50);
      }}
      noOptionsText={emptyText}
      renderOption={(props, o) => {
        const { key, ...rest } = props as typeof props & { key: string };
        return (
          <li key={key} {...rest}>
            <span className="picker-option">
              <b>{o.label}</b>
              <small>{o.detail}</small>
            </span>
          </li>
        );
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          required={required && !selected}
          placeholder="Escribe para buscar…"
          slotProps={{ inputLabel: { ...params.InputLabelProps, shrink: true } }}
        />
      )}
    />
  );
}
export function PetPicker({
  pets,
  clients,
  value,
  onChange,
  label = 'Mascota',
  required,
}: {
  pets: Pet[];
  clients: Client[];
  value: string;
  onChange: (id: string) => void;
  label?: string;
  required?: boolean;
}) {
  const owners = new Map(clients.map((c) => [c.id, c]));
  const options = pets
    .map((p) => {
      const c = owners.get(p.client_id);
      return {
        id: p.id,
        label: p.name + ' · ' + (c?.name || 'Sin responsable'),
        detail: [p.species, p.breed, c?.phone].filter(Boolean).join(' · '),
        search: fold([p.name, c?.name, c?.phone, p.species, p.breed].join(' ')),
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label, 'es'));
  return (
    <Picker
      options={options}
      value={value}
      onChange={onChange}
      label={label}
      required={required}
      emptyText="No hay mascotas que coincidan. Regístrala primero en Mascotas."
    />
  );
}
export function ClientPicker({
  clients,
  pets,
  value,
  onChange,
  label = 'Cliente responsable',
  required,
}: {
  clients: Client[];
  pets: Pet[];
  value: string;
  onChange: (id: string) => void;
  label?: string;
  required?: boolean;
}) {
  const options = clients
    .map((c) => {
      const theirPets = pets.filter((p) => p.client_id === c.id).map((p) => p.name);
      return {
        id: c.id,
        label: c.name,
        detail: [c.phone, theirPets.join(', ')].filter(Boolean).join(' · '),
        search: fold([c.name, c.phone, c.email, ...theirPets].join(' ')),
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label, 'es'));
  return (
    <Picker
      options={options}
      value={value}
      onChange={onChange}
      label={label}
      required={required}
      emptyText="No hay clientes que coincidan. Regístralo primero en Clientes."
    />
  );
}
