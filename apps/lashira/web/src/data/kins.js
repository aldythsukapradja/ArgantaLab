// Kins act as Harvest Sprites: assignable helpers. `aptitude` = the chore they
// speed up (flavor for now; both tasks work for any Kin). In the full build this
// roster loads from person_creatures (lib/nexus.ts); offline we seed 3 starters.
export const STARTER_KINS = [
  { id: 'kin_sprig', name: 'Sprig', element: 'meadow', color: 0x8fd67a, aptitude: 'water', task: null, happiness: 80 },
  { id: 'kin_pip', name: 'Pip', element: 'circuit', color: 0x7fb0e6, aptitude: 'harvest', task: null, happiness: 62 },
  { id: 'kin_bramble', name: 'Bramble', element: 'grove', color: 0xd8a24a, aptitude: 'water', task: null, happiness: 45 },
];

// task values: null (idle) | 'water' (auto-water on sleep) | 'harvest' (auto-collect ripe on sleep)
export const KIN_TASKS = [
  { id: null, label: 'Idle' },
  { id: 'water', label: 'Water' },
  { id: 'harvest', label: 'Harvest' },
];
