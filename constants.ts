export const GRAVITY = 0.6;
export const JUMP_FORCE = -12;
export const DOUBLE_JUMP_FORCE = -10;
export const TRIPLE_JUMP_FORCE = -8;
export const MOVE_SPEED = 8;
export const MAX_FALL_SPEED = 15;

// Visuals
export const THEME = {
  skyStart: '#0f172a', // Slate 900 (Brighter than 950)
  skyEnd: '#312e81',   // Indigo 900 (Brighter than 950)
  moon: '#f8fafc',     // Slate 50
  moonGlow: 'rgba(248, 250, 252, 0.25)', // Increased visibility
  groundFront: '#1e293b', // Slate 800 (Brighter than 900)
  groundMid: '#334155',   // Slate 700 (Brighter than 800)
  groundBack: '#475569',  // Slate 600 (Brighter than 700)
  ninja: '#000000',
  scarf: '#ef4444',       // Red 500
  obstacle: '#94a3b8',    // Slate 400 (Spikes) -> Not used for Cactus, calculated in canvas
  collectible: '#facc15', // Yellow 400
  collectibleGlow: 'rgba(250, 204, 21, 0.5)',
};

export const THEME_DAY = {
  skyStart: '#0ea5e9', // Sky 500
  skyEnd: '#bae6fd',   // Sky 200
  sun: '#fde047',      // Yellow 300
  sunGlow: 'rgba(253, 224, 71, 0.4)',
  groundFront: '#475569', // Slate 600
  groundMid: '#64748b',   // Slate 500
  groundBack: '#94a3b8',  // Slate 400
  ninja: '#0f172a',       // Slate 900
  scarf: '#dc2626',       // Red 600
  obstacle: '#166534',    // Green 800
  collectible: '#facc15',
  collectibleGlow: 'rgba(250, 204, 21, 0.6)',
};

export const CANVAS_WIDTH = 1280;
export const CANVAS_HEIGHT = 720;

// Generation
export const PLATFORM_MIN_WIDTH = 150; // Slightly smaller min width for agility
export const PLATFORM_MAX_WIDTH = 600;
export const GAP_MIN_WIDTH = 80;
export const GAP_MAX_WIDTH = 220; // Reduced max gap for fairness