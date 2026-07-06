// Kins act as Harvest Sprites: assignable helpers. `aptitude` = the chore they
// speed up (flavor for now; both tasks work for any Kin). In the full build this
// roster loads from person_creatures (lib/nexus.ts); offline we seed 3 starters.
export const STARTER_KINS = [
  { id: 'kin_sprig', kinKey: 'kin:sproutling', render: 'sproutling', assetKey: 'kin.sproutling', name: 'Sprig', element: 'meadow', color: '#a78bfa', aptitude: 'water', task: null, happiness: 80 },
  { id: 'kin_pip', kinKey: 'kin:pixelslime', render: 'pixelslime', assetKey: 'kin.pixelslime', name: 'Pip', element: 'circuit', color: '#22c55e', aptitude: 'harvest', task: null, happiness: 62 },
  { id: 'kin_bramble', kinKey: 'kin:storyfox', render: 'storyfox', assetKey: 'kin.storyfox', name: 'Bramble', element: 'grove', color: '#6366f1', aptitude: 'water', task: null, happiness: 45 },
];

// task values: null (idle) | 'water' (auto-water on sleep) | 'harvest' (auto-collect ripe on sleep)
export const KIN_TASKS = [
  { id: null, label: 'Idle' },
  { id: 'water', label: 'Water' },
  { id: 'harvest', label: 'Harvest' },
];
