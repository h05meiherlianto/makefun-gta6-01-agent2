// Solmar Bay — every tuning number, colour and key binding in one place.
// The world is a fixed 3600 x 2700 logical city; the renderer scales a camera
// view of it to the window, so no rule below depends on the screen size.

export const WORLD = { width: 3600, height: 2700 };
export const ROAD_W = 96;
export const STEP = 1 / 60;

export const PLAYER = {
  radius: 14,
  walkSpeed: 230,
  sprintSpeed: 330,
  hp: 100,
  armor: 50,
  startCash: 250,
  startAmmo: 48,
  pistolDamage: 34,
  fireInterval: 0.22,
  bulletSpeed: 900,
};

export const CAR = {
  accel: 520,
  reverseAccel: 320,
  maxSpeed: 640,
  taxiMaxSpeed: 560,
  policeMaxSpeed: 700,
  brake: 900,
  steer: 2.6,
  grip: 6.0,
  handbrakeGrip: 1.6,
  length: 46,
  width: 24,
};

export const WANTED = {
  max: 5,
  decayDelay: 18,
  decayInterval: 7,
  evadeDistance: 700,
  bustDistance: 34,
  bustTime: 2.0,
};

export const CLOCK = { startHour: 18, startMinute: 40, minutesPerSecond: 0.6 };

export const PALETTE = {
  backdrop: '#0b0e1a',
  grass: '#1d4a2e',
  grassDark: '#173d26',
  sand: '#c9a86a',
  water: '#0e4d6e',
  waterDeep: '#0a3a56',
  road: '#23242e',
  roadLine: '#c8b45a',
  sidewalk: '#3a3b46',
  curb: '#4a4b58',
  park: '#1e5c33',
  buildingRoof: '#2c2f3d',
  buildingEdge: '#454a63',
  neonPink: '#ff2e88',
  neonCyan: '#22d3ee',
  neonYellow: '#ffd166',
  neonGreen: '#39ff88',
  neonPurple: '#a855f7',
  text: '#f2f4f8',
  muted: '#9aa3b5',
  panel: '#141827',
  panelEdge: '#2b3350',
  danger: '#ff4d4d',
  cash: '#7dff6a',
  copBlue: '#3b82f6',
  copRed: '#ef4444',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
export const SAVE_KEY = 'solmar-bay.save.v1';
export const BEST_KEY = 'solmar-bay.best.v1';

/** Neon sign colours cycled across buildings. */
export const NEON = ['#ff2e88', '#22d3ee', '#ffd166', '#39ff88', '#a855f7', '#ff7a18'];

/** Car paint jobs, by vehicle kind. */
export const CAR_COLORS = {
  sedan: ['#c0392b', '#2e86c1', '#e67e22', '#7d3c98', '#16a085', '#b7950b'],
  taxi: ['#f7c948'],
  police: ['#1f2937'],
  sports: ['#ff2e88', '#22d3ee', '#ffd166'],
  van: ['#6b7280', '#92400e'],
  truck: ['#374151', '#7f1d1d'],
};

export const PED_COLORS = ['#e74c3c', '#3498db', '#f1c40f', '#9b59b6', '#1abc9c', '#ecf0f1', '#e67e22', '#fd79a8'];
