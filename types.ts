export enum GameState {
  MENU = 'MENU',
  PLAYING = 'PLAYING',
  PAUSED = 'PAUSED',
  GAME_OVER = 'GAME_OVER',
}

export interface Entity {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Player extends Entity {
  vx: number;
  vy: number;
  isGrounded: boolean;
  isDashing: boolean;
  jumpCount: number;
}

export interface Platform extends Entity {
  type: 'ground' | 'platform' | 'moving';
  origX?: number;
  origY?: number;
  moveRange?: number;
  moveSpeed?: number;
  timeOffset?: number;
}

export interface Obstacle extends Entity {
  type: 'spike' | 'pit';
}

export interface Collectible extends Entity {
  type: 'coin';
  value: number;
  floatOffset: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

export interface Star {
  x: number;
  y: number;
  size: number;
  alpha: number;
  twinkleSpeed: number;
}

export interface Cloud {
  x: number;
  y: number;
  width: number;
  height: number;
  speed: number;
  opacity: number;
}

export interface GameWisdom {
  message: string;
  author: string;
}