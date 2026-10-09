import { Button, IconButton, MenuItem, TextField } from '@mui/material';
import Add from '@mui/icons-material/Add';
import Close from '@mui/icons-material/Close';
// Pets edited inside the client form: registered ones (with id) can be corrected,
// new ones added or removed. New blocks without a name are ignored on save.
export type PetDraft = {
  key: string;
  id?: string;
  name: string;
  species: string;
  breed: string;
  sex: string;
  birth_date: string;
  weight: string;
  allergies: string;
};
export const blankPet = (): PetDraft => ({
  key: crypto.randomUUID(),
  name: '',
  species: 'Perro',
  breed: '',
  sex: 'No registrado',
  birth_date: '',
  weight: '',
  allergies: '',
});
export const petToDraft = (p: {
  id: string;
  name: string;
  species: string;
  breed: string;
  sex: string;
  birth_date: string | null;
  weight: number | null;
  allergies: string;
}): PetDraft => ({
  key: p.id,
  id: p.id,
  name: p.name,
  species: p.species,
  breed: p.breed,
  sex: p.sex,
  birth_date: p.birth_date || '',
  weight: p.weight == null ? '' : String(p.weight),
  allergies: p.allergies,
});
export default function ClientPets({
  pets,
  today,
  onChange,
}: {
  pets: PetDraft[];
  today: string;
  onChange: (pets: PetDraft[]) => void;
}) {
  const set = (key: string, patch: Partial<PetDraft>) =>
    onChange(pets.map((p) => (p.key === key ? { ...p, ...patch } : p)));
  return (
    <div className="client-pets">
      <h3>Mascotas</h3>
      <div className="client-pets-list">
      {pets.map((p) => (
        <fieldset className="client-pet" key={p.key}>
          <legend>{p.id ? 'Mascota registrada' : 'Mascota nueva'}</legend>
          {/* Registered pets may have visits, records or payments: they are not removed here. */}
          {!p.id && (
            <IconButton
              className="client-pet-remove"
              size="small"
              aria-label={'Quitar mascota ' + (p.name || 'nueva')}
              onClick={() => onChange(pets.filter((x) => x.key !== p.key))}
            >
              <Close fontSize="small" />
            </IconButton>
          )}
          <div className="form-pair">
            <TextField
              label="Nombre"
              value={p.name}
              onChange={(e) => set(p.key, { name: e.target.value })}
              slotProps={{ htmlInput: { maxLength: 100 } }}
            />
            <TextField
              select
              label="Especie"
              value={p.species}
              onChange={(e) => set(p.key, { species: e.target.value })}
            >
              {['Perro', 'Gato', 'Otro'].map((x) => (
                <MenuItem key={x} value={x}>
                  {x}
                </MenuItem>
              ))}
            </TextField>
          </div>
          <div className="form-pair">
            <TextField
              label="Raza"
              value={p.breed}
              onChange={(e) => set(p.key, { breed: e.target.value })}
            />
            <TextField
              select
              label="Sexo"
              value={p.sex}
              onChange={(e) => set(p.key, { sex: e.target.value })}
            >
              {['Macho', 'Hembra', 'No registrado'].map((x) => (
                <MenuItem key={x} value={x}>
                  {x}
                </MenuItem>
              ))}
            </TextField>
          </div>
          <div className="form-pair">
            <TextField
              type="date"
              label="Fecha de nacimiento"
              value={p.birth_date}
              onChange={(e) => set(p.key, { birth_date: e.target.value })}
              slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: today } }}
            />
            <TextField
              type="number"
              label="Peso (kg)"
              value={p.weight}
              onChange={(e) => set(p.key, { weight: e.target.value })}
              slotProps={{ htmlInput: { min: 0.01, max: 1999, step: 0.01 } }}
            />
          </div>
          <TextField
            label="Alergias y antecedentes relevantes"
            value={p.allergies}
            onChange={(e) => set(p.key, { allergies: e.target.value })}
            multiline
            minRows={2}
          />
        </fieldset>
      ))}
      </div>
      <Button startIcon={<Add />} onClick={() => onChange([...pets, blankPet()])}>
        {pets.length ? 'Agregar otra mascota' : 'Agregar mascota'}
      </Button>
    </div>
  );
}
