import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GameState, Player, Platform, Obstacle, Particle, Collectible, Entity, Star, Cloud } from '../types';
import { 
  GRAVITY, JUMP_FORCE, DOUBLE_JUMP_FORCE, TRIPLE_JUMP_FORCE, MOVE_SPEED, MAX_FALL_SPEED, 
  THEME, THEME_DAY, CANVAS_WIDTH, CANVAS_HEIGHT, 
  PLATFORM_MIN_WIDTH, PLATFORM_MAX_WIDTH, GAP_MIN_WIDTH, GAP_MAX_WIDTH 
} from '../constants';
import { playJumpSound, playDoubleJumpSound, playTripleJumpSound, playLandSound, playDeathSound, playCollectSound } from '../utils/sound';

interface GameCanvasProps {
  gameState: GameState;
  onGameOver: (score: number, coins: number, cause: string) => void;
  setScore: (score: number) => void;
  setCollectiblesCount: (count: number) => void;
}

interface ShootingStar {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
}

interface WindLine {
  x: number;
  y: number;
  length: number;
  speed: number;
  alpha: number;
}

// Helper for drawing rounded rectangles (polyfilled for older browsers)
const drawRoundedRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
  if (w < 2 * r) r = w / 2;
  if (h < 2 * r) r = h / 2;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
};

export const GameCanvas: React.FC<GameCanvasProps> = ({ gameState, onGameOver, setScore, setCollectiblesCount }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(0);
  const scoreRef = useRef<number>(0);
  const bonusScoreRef = useRef<number>(0);
  const collectiblesCountRef = useRef<number>(0);
  
  // Track gameState in ref for the game loop to avoid stale closures
  const gameStateRef = useRef<GameState>(gameState);

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  // Game Entities Refs
  const playerRef = useRef<Player>({
    x: 100, y: 300, width: 40, height: 60, vx: 0, vy: 0, 
    isGrounded: false, isDashing: false, jumpCount: 0
  });
  
  const platformsRef = useRef<Platform[]>([]);
  const obstaclesRef = useRef<Obstacle[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const collectiblesRef = useRef<Collectible[]>([]);
  const starsRef = useRef<Star[]>([]);
  const cloudsRef = useRef<Cloud[]>([]);
  const shootingStarsRef = useRef<ShootingStar[]>([]);
  const windLinesRef = useRef<WindLine[]>([]);
  
  const cameraXRef = useRef<number>(0);
  
  // Day/Night Cycle Refs
  const phaseRef = useRef<number>(0);
  
  // Timers
  const footstepTimerRef = useRef<number>(0);
  const windTimerRef = useRef<number>(0);
  const squashTimerRef = useRef<number>(0);

  // Input tracking
  const keysPressed = useRef<{ [key: string]: boolean }>({});

  const initGame = useCallback(() => {
    playerRef.current = {
      x: 100,
      y: CANVAS_HEIGHT - 200,
      width: 30, // Slimmer ninja hitbox
      height: 50,
      vx: MOVE_SPEED,
      vy: 0,
      isGrounded: true,
      isDashing: false,
      jumpCount: 0
    };
    
    // Initial ground
    platformsRef.current = [
      { x: -200, y: CANVAS_HEIGHT - 100, width: 1000, height: 100, type: 'ground' }
    ];
    obstaclesRef.current = [];
    particlesRef.current = [];
    collectiblesRef.current = [];
    windLinesRef.current = [];
    cameraXRef.current = 0;
    scoreRef.current = 0;
    bonusScoreRef.current = 0;
    collectiblesCountRef.current = 0;
    squashTimerRef.current = 0;
    setScore(0);
    setCollectiblesCount(0);

    // Reset Cycle
    phaseRef.current = 0;
    
    // Init Stars
    starsRef.current = [];
    for (let i = 0; i < 100; i++) {
      starsRef.current.push({
        x: Math.random() * CANVAS_WIDTH,
        y: Math.random() * (CANVAS_HEIGHT * 0.7), // Stars mostly in top 70%
        size: Math.random() * 2 + 0.5,
        alpha: Math.random(),
        twinkleSpeed: Math.random() * 0.05 + 0.01
      });
    }

    // Init Clouds
    cloudsRef.current = [];
    for (let i = 0; i < 15; i++) {
        cloudsRef.current.push({
            x: Math.random() * CANVAS_WIDTH,
            y: Math.random() * (CANVAS_HEIGHT * 0.4),
            width: 60 + Math.random() * 100,
            height: 30 + Math.random() * 40,
            speed: 0.2 + Math.random() * 0.5,
            opacity: 0.4 + Math.random() * 0.4
        });
    }
    
    // Init Shooting Stars
    shootingStarsRef.current = [];

  }, [setScore, setCollectiblesCount]);

  // Color Interpolation Helper
  const lerpColor = (c1: string, c2: string, t: number) => {
    let r1, g1, b1, r2, g2, b2;
    
    if (c1.startsWith('#')) {
        const c1h = parseInt(c1.slice(1), 16);
        r1 = (c1h >> 16) & 255; g1 = (c1h >> 8) & 255; b1 = c1h & 255;
    } else { return c1; } // Fallback if not hex
    
    if (c2.startsWith('#')) {
        const c2h = parseInt(c2.slice(1), 16);
        r2 = (c2h >> 16) & 255; g2 = (c2h >> 8) & 255; b2 = c2h & 255;
    } else { return c2; }

    const r = Math.round(r1 + (r2 - r1) * t);
    const g = Math.round(g1 + (g2 - g1) * t);
    const b = Math.round(b1 + (b2 - b1) * t);
    
    return `rgb(${r},${g},${b})`;
  };

  // Generate world ahead
  const generateWorld = () => {
    const platforms = platformsRef.current;
    if (platforms.length === 0) return; // Safety check

    const lastPlatform = platforms[platforms.length - 1];
    const playerX = playerRef.current.x;

    // Use a generation horizon (generate further ahead for smoother scrolling)
    if (lastPlatform.x + lastPlatform.width < playerX + CANVAS_WIDTH * 2.0) {
      
      const isGap = Math.random() > 0.6; // 40% chance of gap
      // Decide if next is moving (only if there is a gap)
      const isMoving = isGap && Math.random() > 0.6; 

      let nextX = lastPlatform.type === 'moving' && lastPlatform.origX 
        ? lastPlatform.origX + lastPlatform.width 
        : lastPlatform.x + lastPlatform.width;
      
      // Determine Gap
      let gapWidth = 0;
      if (isGap) {
        // Reduced gap for moving platforms to make them jumpable
        const maxGap = isMoving ? 160 : GAP_MAX_WIDTH; 
        gapWidth = GAP_MIN_WIDTH + Math.random() * (maxGap - GAP_MIN_WIDTH);
        nextX += gapWidth;
      }

      // Next Platform Properties
      const width = PLATFORM_MIN_WIDTH + Math.random() * (PLATFORM_MAX_WIDTH - PLATFORM_MIN_WIDTH);
      
      // --- Elevation Logic ---
      let deltaY = (Math.random() - 0.5) * 180;
      
      // If gap is large, restrict upward height change to avoid impossible jumps
      // Note: Negative Y is UP. deltaY -90 is 90px higher.
      // We want to limit how "negative" (high) it goes if the gap is wide.
      if (gapWidth > 180) {
          // Limit upward height to 50px maximum if gap is wide
          deltaY = Math.max(deltaY, -50); 
      }
      
      // Avoid tiny steps
      if (Math.abs(deltaY) < 60) {
        deltaY = 0;
      }
      
      let nextY = lastPlatform.y + deltaY;
      nextY = Math.max(CANVAS_HEIGHT - 350, Math.min(CANVAS_HEIGHT - 50, nextY));

      if (isMoving) {
        // Create a moving platform
        // Reduced move range (60-120) for fairer gameplay
        const moveRange = 60 + Math.random() * 60; 
        
        platforms.push({
          x: nextX, // Initial x
          y: nextY,
          width: Math.min(width, 300), 
          height: 40,
          type: 'moving',
          origX: nextX + moveRange, // Center point
          origY: nextY,
          moveRange: moveRange,
          moveSpeed: 0.02 + Math.random() * 0.03,
          timeOffset: Math.random() * Math.PI * 2
        });
      } else {
        // Static Platform
        platforms.push({
          x: nextX,
          y: nextY,
          width: width,
          height: 400, // extend down
          type: 'ground'
        });

        // Obstacles & Collectibles on Static Platforms
        if (!isGap) {
          // --- Coin Generation Strategy ---
          const coinRoll = Math.random();
          
          if (coinRoll > 0.7) {
             // 1. Standard Ground Coin
             collectiblesRef.current.push({
                x: nextX + width / 2,
                y: nextY - 60,
                width: 30,
                height: 30,
                type: 'coin',
                value: 500,
                floatOffset: Math.random() * Math.PI * 2
             });
          } else if (coinRoll < 0.3) {
             // 2. High Aerial Chain
             const coinCount = 3 + Math.floor(Math.random() * 3);
             const startX = nextX + width / 2 - (coinCount * 40) / 2;
             const aerialY = nextY - (140 + Math.random() * 40); 
             
             for (let i = 0; i < coinCount; i++) {
               collectiblesRef.current.push({
                 x: startX + i * 45,
                 y: aerialY - Math.sin((i / (coinCount - 1)) * Math.PI) * 30, 
                 width: 30,
                 height: 30,
                 type: 'coin',
                 value: 500,
                 floatOffset: i * 0.5
               });
             }
          }

          // Spikes/Cactus
          const hasGroundCoin = coinRoll > 0.7;
          if (!hasGroundCoin && width > 200) {
            if (Math.random() < 0.6) {
              obstaclesRef.current.push({
                x: nextX + width / 2 - 20,
                y: nextY - 40,
                width: 40,
                height: 40,
                type: 'spike'
              });
            }
            if (width > 500 && Math.random() < 0.5) {
              obstaclesRef.current.push({
                x: nextX + width * 0.75 - 20,
                y: nextY - 40,
                width: 40,
                height: 40,
                type: 'spike'
              });
            }
          }
        }
      }
    }

    // Cleanup old entities
    const cleanupThreshold = playerX - CANVAS_WIDTH;
    if (platforms.length > 0) {
      const p = platforms[0];
      const rightEdge = p.type === 'moving' && p.origX && p.moveRange 
        ? p.origX + p.moveRange + p.width 
        : p.x + p.width;
        
      if (rightEdge < cleanupThreshold) {
        platforms.shift();
      }
    }
    
    // Clean obstacles and collectibles
    if (obstaclesRef.current.length > 0 && obstaclesRef.current[0].x + obstaclesRef.current[0].width < cleanupThreshold) {
      obstaclesRef.current.shift();
    }
    if (collectiblesRef.current.length > 0 && collectiblesRef.current[0].x + collectiblesRef.current[0].width < cleanupThreshold) {
      collectiblesRef.current.shift();
    }
  };

  const updateParticles = () => {
    particlesRef.current.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.life--;
    });
    particlesRef.current = particlesRef.current.filter(p => p.life > 0);
  };

  const updateClouds = () => {
    cloudsRef.current.forEach(c => {
        c.x -= c.speed;
        if (c.x + c.width < 0) {
            c.x = CANVAS_WIDTH + Math.random() * 200;
            c.y = Math.random() * (CANVAS_HEIGHT * 0.4);
        }
    });
  }

  const updateShootingStars = () => {
    if (Math.random() < 0.02) { 
        shootingStarsRef.current.push({
            x: Math.random() * CANVAS_WIDTH + cameraXRef.current + 200, 
            y: Math.random() * (CANVAS_HEIGHT * 0.4),
            vx: -20 - Math.random() * 15,
            vy: 3 + Math.random() * 5,
            life: 30 + Math.random() * 20,
            maxLife: 50
        });
    }

    shootingStarsRef.current.forEach(s => {
        s.x += s.vx;
        s.y += s.vy;
        s.life--;
    });
    shootingStarsRef.current = shootingStarsRef.current.filter(s => s.life > 0);
  }

  const spawnExplosion = (x: number, y: number, color: string) => {
    for (let i = 0; i < 30; i++) {
      particlesRef.current.push({
        x: x,
        y: y,
        vx: (Math.random() - 0.5) * 10,
        vy: (Math.random() - 0.5) * 10,
        life: 40 + Math.random() * 20,
        maxLife: 60,
        color: color,
        size: Math.random() * 4 + 2
      });
    }
  };

  const spawnParticle = (x: number, y: number, color: string, speedMult: number = 1) => {
    particlesRef.current.push({
      x, y,
      vx: (Math.random() - 0.5) * 2 * speedMult,
      vy: ((Math.random() - 0.5) * 2 - 1) * speedMult,
      life: 20 + Math.random() * 10,
      maxLife: 30,
      color,
      size: Math.random() * 3 + 1
    });
  };

  const updateWind = () => {
    windTimerRef.current++;
    if (windTimerRef.current > 40 && Math.random() > 0.7) {
        const y = Math.random() * CANVAS_HEIGHT * 0.8;
        windLinesRef.current.push({
            x: cameraXRef.current + CANVAS_WIDTH + 100,
            y: y,
            length: 100 + Math.random() * 200,
            speed: 15 + Math.random() * 10,
            alpha: 0.1 + Math.random() * 0.2
        });
        windTimerRef.current = 0;
    }

    windLinesRef.current.forEach(w => {
        w.x -= w.speed;
    });
    windLinesRef.current = windLinesRef.current.filter(w => w.x + w.length > cameraXRef.current);
  };

  const checkAABB = (ent1: Entity, ent2: Entity) => {
    return (
      ent1.x < ent2.x + ent2.width &&
      ent1.x + ent1.width > ent2.x &&
      ent1.y < ent2.y + ent2.height &&
      ent1.y + ent1.height > ent2.y
    );
  };

  const updatePhysics = (frameCount: number) => {
    const player = playerRef.current;
    if (squashTimerRef.current > 0) squashTimerRef.current--;

    for (const plat of platformsRef.current) {
      if (plat.type === 'moving' && plat.origX !== undefined && plat.moveRange !== undefined && plat.moveSpeed !== undefined && plat.timeOffset !== undefined) {
        const prevX = plat.x;
        plat.x = plat.origX + Math.sin(frameCount * plat.moveSpeed + plat.timeOffset) * plat.moveRange;
        (plat as any).currentVx = plat.x - prevX; 
      } else {
        (plat as any).currentVx = 0;
      }
    }

    if (keysPressed.current['ArrowLeft']) {
      player.vx = -MOVE_SPEED;
    } else {
      player.vx = MOVE_SPEED;
    }

    player.vy += GRAVITY;
    if (player.vy > MAX_FALL_SPEED) player.vy = MAX_FALL_SPEED;

    player.x += player.vx;
    
    for (const plat of platformsRef.current) {
      if (checkAABB(player, plat)) {
         if (player.vx > 0) {
            player.x = plat.x - player.width;
         } else if (player.vx < 0) {
            player.x = plat.x + plat.width;
         }
         player.vx = 0;
      }
    }

    player.y += player.vy;
    
    let onGround = false;
    const wasGrounded = player.isGrounded;

    for (const plat of platformsRef.current) {
      if (checkAABB(player, plat)) {
        if (player.vy > 0) {
          player.y = plat.y - player.height;
          player.vy = 0;
          onGround = true;
          player.jumpCount = 0;
          if (plat.type === 'moving') {
             player.x += (plat as any).currentVx || 0;
          }
        } else if (player.vy < 0) {
          player.y = plat.y + plat.height;
          player.vy = 0;
        }
      }
    }
    player.isGrounded = onGround;

    if (onGround && Math.abs(player.vx) > 0.5) {
        footstepTimerRef.current++;
        if (footstepTimerRef.current > 18) {
             spawnParticle(player.x + player.width/2, player.y + player.height, '#334155', 0.5);
             footstepTimerRef.current = 0;
        }
    } else {
        footstepTimerRef.current = 18;
    }

    if (!wasGrounded && onGround) {
        playLandSound();
        squashTimerRef.current = 8;
        spawnParticle(player.x + player.width/2, player.y + player.height, THEME.groundFront);
        spawnParticle(player.x + player.width/2, player.y + player.height, THEME.groundFront);
    }

    if (player.y > CANVAS_HEIGHT) {
      playDeathSound();
      onGameOver(Math.floor(scoreRef.current), collectiblesCountRef.current, 'falling into the abyss');
      return;
    }

    for (const obs of obstaclesRef.current) {
      if (obs.type === 'spike') {
        const spikeHitbox = { x: obs.x + 8, y: obs.y + 10, width: obs.width - 16, height: obs.height - 10 };
        if (checkAABB(player, spikeHitbox)) {
          spawnExplosion(player.x + player.width/2, player.y + player.height/2, '#166534'); 
          playDeathSound();
          onGameOver(Math.floor(scoreRef.current), collectiblesCountRef.current, 'pricked by a cactus');
          return;
        }
      }
    }

    for (let i = collectiblesRef.current.length - 1; i >= 0; i--) {
       const c = collectiblesRef.current[i];
       if (checkAABB(player, c)) {
          playCollectSound();
          spawnExplosion(c.x + c.width/2, c.y + c.height/2, '#facc15'); 
          bonusScoreRef.current += c.value;
          collectiblesCountRef.current += 1;
          setCollectiblesCount(collectiblesCountRef.current);
          collectiblesRef.current.splice(i, 1);
       }
    }

    const distanceScore = Math.max(0, Math.floor(player.x / 10));
    const totalScore = distanceScore + bonusScoreRef.current;
    
    if (totalScore !== scoreRef.current) {
      scoreRef.current = totalScore;
      setScore(totalScore);
    }
    
    const targetCamX = player.x - CANVAS_WIDTH * 0.25;
    cameraXRef.current += (targetCamX - cameraXRef.current) * 0.1;
  };

  const jump = () => {
    const player = playerRef.current;
    if (player.isGrounded) {
      playJumpSound();
      player.vy = JUMP_FORCE;
      player.jumpCount = 1;
      for(let i=0; i<8; i++) {
        particlesRef.current.push({
            x: player.x + player.width/2 + (Math.random()-0.5)*20,
            y: player.y + player.height,
            vx: (Math.random()-0.5)*3,
            vy: -1 - Math.random()*2,
            life: 15 + Math.random()*10,
            maxLife: 25,
            color: '#e2e8f0', 
            size: Math.random()*2 + 1
        });
      }
    } else if (player.jumpCount < 2) {
      playDoubleJumpSound();
      player.vy = DOUBLE_JUMP_FORCE;
      player.jumpCount = 2;
      spawnParticle(player.x + player.width/2, player.y + player.height, '#60a5fa');
    } else if (player.jumpCount < 3) {
      playTripleJumpSound();
      player.vy = TRIPLE_JUMP_FORCE;
      player.jumpCount = 3;
      spawnParticle(player.x + player.width/2, player.y + player.height, '#f472b6');
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameStateRef.current !== GameState.PLAYING) return;
      keysPressed.current[e.code] = true;
      if (e.code === 'ArrowUp') {
          jump();
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current[e.code] = false;
    };
    const handleTouchStart = () => {
       if (gameStateRef.current === GameState.PLAYING) jump();
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('touchstart', handleTouchStart);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('touchstart', handleTouchStart);
    };
  }, []);

  const draw = (ctx: CanvasRenderingContext2D, frameCount: number) => {
    const currentState = gameStateRef.current;
    
    const targetPhase = Math.floor(scoreRef.current / 10000);
    phaseRef.current += (targetPhase - phaseRef.current) * 0.005;
    const phaseMod = phaseRef.current % 2;
    const linearDayFactor = phaseMod < 1 ? phaseMod : 2 - phaseMod;
    const dayFactor = (1 - Math.cos(linearDayFactor * Math.PI)) / 2;
    
    const skyStart = lerpColor(THEME.skyStart, THEME_DAY.skyStart, dayFactor);
    const skyEnd = lerpColor(THEME.skyEnd, THEME_DAY.skyEnd, dayFactor);
    const groundFront = lerpColor(THEME.groundFront, THEME_DAY.groundFront, dayFactor);
    const groundMid = lerpColor(THEME.groundMid, THEME_DAY.groundMid, dayFactor);
    const ninjaColor = lerpColor(THEME.ninja, THEME_DAY.ninja, dayFactor);
    const scarfColor = lerpColor(THEME.scarf, THEME_DAY.scarf, dayFactor);

    ctx.fillStyle = skyStart;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    const gradient = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
    gradient.addColorStop(0, skyStart);
    gradient.addColorStop(1, skyEnd);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    const celestialAngle = -phaseRef.current * Math.PI;
    const orbitCX = (CANVAS_WIDTH / 2) + 200;
    const orbitCY = CANVAS_HEIGHT + 350;
    const orbitR = CANVAS_HEIGHT + 250;
    
    const moonAngle = celestialAngle - Math.PI/2;
    const sunAngle = celestialAngle + Math.PI/2;
    
    const moonX = orbitCX + orbitR * Math.cos(moonAngle);
    const moonY = orbitCY + orbitR * Math.sin(moonAngle);
    
    const sunX = orbitCX + orbitR * Math.cos(sunAngle);
    const sunY = orbitCY + orbitR * Math.sin(sunAngle);

    if (sunY < CANVAS_HEIGHT + 100) {
        const sunGlow = ctx.createRadialGradient(sunX, sunY, 40, sunX, sunY, 200);
        sunGlow.addColorStop(0, THEME_DAY.sunGlow);
        sunGlow.addColorStop(1, 'rgba(253, 224, 71, 0)');
        ctx.fillStyle = sunGlow;
        ctx.beginPath();
        ctx.arc(sunX, sunY, 200, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = THEME_DAY.sun;
        ctx.beginPath();
        ctx.arc(sunX, sunY, 60, 0, Math.PI * 2);
        ctx.fill();
    }

    const starParallax = cameraXRef.current * 0.01;
    ctx.save();
    ctx.fillStyle = '#ffffff';
    starsRef.current.forEach(star => {
      const x = (star.x - starParallax) % CANVAS_WIDTH;
      const drawX = x < 0 ? x + CANVAS_WIDTH : x;
      const visibility = Math.max(0, (1 - dayFactor) - 0.2); 
      if (visibility > 0) {
        ctx.globalAlpha = star.alpha * visibility * (0.5 + 0.5 * Math.sin(frameCount * star.twinkleSpeed));
        ctx.beginPath();
        ctx.arc(drawX, star.y, star.size, 0, Math.PI * 2);
        ctx.fill();
      }
    });
    ctx.globalAlpha = 1;
    ctx.restore();

    if (dayFactor > 0.1) {
        ctx.save();
        ctx.fillStyle = '#ffffff';
        cloudsRef.current.forEach(cloud => {
            const cloudParallax = cameraXRef.current * 0.05;
            const x = (cloud.x - cloudParallax) % (CANVAS_WIDTH + 400); 
            const drawX = x < -200 ? x + CANVAS_WIDTH + 400 : x; 
            ctx.globalAlpha = cloud.opacity * dayFactor;
            
            const r1 = cloud.height / 2;
            const r2 = cloud.height * 0.35;
            
            ctx.beginPath();
            // Main central circle
            ctx.arc(drawX, cloud.y, r1, 0, Math.PI * 2);
            // Left circle
            ctx.arc(drawX - r1 * 0.8, cloud.y + r1 - r2, r2, 0, Math.PI * 2);
            // Right circle
            ctx.arc(drawX + r1 * 0.8, cloud.y + r1 - r2, r2, 0, Math.PI * 2);
            ctx.fill();
            
            // Fill the bottom gap to make it perfectly flat
            ctx.fillRect(drawX - r1 * 0.8, cloud.y + r1 - r2, r1 * 1.6, r2);
        });
        ctx.restore();
    }

    const shootingStarParallax = cameraXRef.current * 0.02; 
    ctx.save();
    ctx.translate(-shootingStarParallax, 0); 
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    shootingStarsRef.current.forEach(s => {
        if (dayFactor < 0.5) {
            const screenX = s.x;
            ctx.globalAlpha = (s.life / s.maxLife) * (1 - dayFactor);
            ctx.shadowBlur = 15;
            ctx.shadowColor = 'white';
            ctx.beginPath();
            ctx.moveTo(screenX, s.y);
            ctx.lineTo(screenX - s.vx * 1.5, s.y - s.vy * 1.5); 
            ctx.stroke();
            ctx.shadowBlur = 0;
        }
    });
    ctx.globalAlpha = 1;
    ctx.restore();

    if (moonY < CANVAS_HEIGHT + 100) {
        const moonRadius = 60;
        if (dayFactor < 0.8) {
            const moonGlow = ctx.createRadialGradient(moonX, moonY, moonRadius, moonX, moonY, moonRadius * 4);
            moonGlow.addColorStop(0, `rgba(255, 255, 255, ${0.25 * (1-dayFactor)})`);
            moonGlow.addColorStop(1, 'rgba(255, 255, 255, 0)');
            ctx.fillStyle = moonGlow;
            ctx.beginPath();
            ctx.arc(moonX, moonY, moonRadius * 4, 0, Math.PI * 2);
            ctx.fill();
        }
        const moonGrad = ctx.createLinearGradient(moonX - moonRadius, moonY - moonRadius, moonX + moonRadius, moonY + moonRadius);
        moonGrad.addColorStop(0, '#ffffff'); 
        moonGrad.addColorStop(1, '#cbd5e1'); 
        ctx.fillStyle = moonGrad;
        ctx.beginPath();
        ctx.arc(moonX, moonY, moonRadius, 0, Math.PI * 2);
        ctx.fill();
    }

    const mtnParallax = cameraXRef.current * 0.2;
    
    // City Skyline Background (replacing mountains)
    ctx.save();
    ctx.translate(-mtnParallax, 0);
    ctx.globalAlpha = 0.3 * (1 - dayFactor * 0.5); // More subtle
    ctx.fillStyle = groundMid;
    
    for (let i = -10; i < 50; i++) {
        const offset = i * 80;
        if (offset - mtnParallax < CANVAS_WIDTH && offset + 150 - mtnParallax > -200) {
            const pseudoRandom = Math.abs(Math.sin(i * 12345));
            const height = 80 + pseudoRandom * 150; // Much shorter
            const width = 50 + (pseudoRandom * 60);
            
            ctx.fillRect(offset, CANVAS_HEIGHT - height, width, height);
            
            // Add some variety to tops
            const topType = Math.floor(pseudoRandom * 7);
            if (topType === 0) {
                // Antenna
                ctx.fillRect(offset + width/2 - 2, CANVAS_HEIGHT - height - 40, 4, 40);
            } else if (topType === 1) {
                // Slanted roof
                ctx.beginPath();
                ctx.moveTo(offset, CANVAS_HEIGHT - height);
                ctx.lineTo(offset + width, CANVAS_HEIGHT - height - 30);
                ctx.lineTo(offset + width, CANVAS_HEIGHT - height);
                ctx.fill();
            } else if (topType === 2) {
                // Pointed roof
                ctx.beginPath();
                ctx.moveTo(offset, CANVAS_HEIGHT - height);
                ctx.lineTo(offset + width/2, CANVAS_HEIGHT - height - 40);
                ctx.lineTo(offset + width, CANVAS_HEIGHT - height);
                ctx.fill();
            } else if (topType === 3) {
                // Stepped roof
                ctx.fillRect(offset + 10, CANVAS_HEIGHT - height - 15, width - 20, 15);
                ctx.fillRect(offset + 20, CANVAS_HEIGHT - height - 30, width - 40, 15);
            } else if (topType === 4) {
                // Dome roof
                ctx.beginPath();
                ctx.arc(offset + width/2, CANVAS_HEIGHT - height, width/2, Math.PI, 0);
                ctx.fill();
                // Little spire on dome
                ctx.fillRect(offset + width/2 - 1, CANVAS_HEIGHT - height - width/2 - 10, 2, 10);
            } else if (topType === 5) {
                // Twin spires
                ctx.fillRect(offset + 5, CANVAS_HEIGHT - height - 30, 5, 30);
                ctx.fillRect(offset + width - 10, CANVAS_HEIGHT - height - 30, 5, 30);
            }

            // Windows
            ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
            const windowCols = Math.floor(width / 15);
            const windowRows = Math.floor(height / 20);
            for (let r = 1; r < windowRows; r++) {
                for (let c = 1; c < windowCols; c++) {
                    if (Math.sin(i * r * c) > 0) {
                        ctx.fillRect(offset + c * 15, CANVAS_HEIGHT - height + r * 20, 6, 10);
                    }
                }
            }
            ctx.fillStyle = groundMid;
        }
    }
    ctx.restore();

    // Trees
    const treeParallax = cameraXRef.current * 0.6;
    ctx.save();
    ctx.translate(-treeParallax, 0);
    ctx.fillStyle = lerpColor('#0f172a', '#1e293b', dayFactor); 
    const sway = Math.sin(frameCount * 0.05) * 5; 
    for (let i = 0; i < 40; i++) {
        const xPos = (i * 300) + ((i * 1234) % 150); 
        if (xPos > treeParallax - 200 && xPos < treeParallax + CANVAS_WIDTH + 200) {
           ctx.beginPath();
           ctx.moveTo(xPos, CANVAS_HEIGHT);
           ctx.lineTo(xPos + 20 + sway, CANVAS_HEIGHT - 150 - (i%5)*20);
           ctx.lineTo(xPos + 40, CANVAS_HEIGHT);
           ctx.fill();
        }
    }
    ctx.restore();
    
    // Wind lines
    ctx.save();
    ctx.translate(-cameraXRef.current, 0);
    ctx.strokeStyle = 'rgba(200, 230, 255, 0.5)';
    ctx.lineWidth = 1;
    windLinesRef.current.forEach(w => {
        ctx.globalAlpha = w.alpha;
        ctx.beginPath();
        ctx.moveTo(w.x, w.y);
        ctx.lineTo(w.x + w.length, w.y);
        ctx.stroke();
    });
    ctx.globalAlpha = 1;
    ctx.restore();

    ctx.save();
    ctx.translate(-cameraXRef.current, 0);

    for (const plat of platformsRef.current) {
      if (plat.type === 'moving') {
        ctx.shadowBlur = 15;
        ctx.shadowColor = 'rgba(56, 189, 248, 0.6)';
        ctx.fillStyle = groundMid;
        ctx.fillRect(plat.x, plat.y, plat.width, plat.height);
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(plat.x, plat.y, plat.width, 4);
        ctx.shadowBlur = 0;
      } else {
        const drawX = Math.floor(plat.x);
        const drawY = Math.floor(plat.y);
        const drawW = Math.ceil(plat.width) + 1; // +1 to remove 1px gap
        
        ctx.fillStyle = groundFront;
        ctx.fillRect(drawX, drawY, drawW, plat.height);
        
        // Draw brick pattern
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        const brickWidth = 60;
        const brickHeight = 30;
        for (let by = drawY; by < drawY + plat.height; by += brickHeight) {
          const rowIdx = Math.floor((by - drawY) / brickHeight);
          const offsetX = (rowIdx % 2 === 0) ? 0 : brickWidth / 2;
          
          // Horizontal line
          ctx.moveTo(drawX, by);
          ctx.lineTo(drawX + drawW, by);
          
          // Vertical lines
          const startBx = drawX - (drawX % brickWidth) - offsetX;
          for (let bx = startBx; bx < drawX + drawW; bx += brickWidth) {
            if (bx >= drawX && bx <= drawX + drawW) {
              ctx.moveTo(bx, by);
              ctx.lineTo(bx, by + brickHeight);
            }
          }
        }
        ctx.stroke();

        ctx.fillStyle = groundMid;
        ctx.fillRect(drawX, drawY, drawW, 5);
      }
    }

    for (const c of collectiblesRef.current) {
        const floatY = c.y + Math.sin(frameCount * 0.1 + c.floatOffset) * 5;
        ctx.shadowBlur = 20;
        ctx.shadowColor = THEME.collectibleGlow;
        ctx.fillStyle = THEME.collectible; 
        ctx.beginPath();
        ctx.arc(c.x + c.width/2, floatY + c.height/2, c.width/2, 0, Math.PI*2);
        ctx.fill();
        ctx.fillStyle = '#fef08a'; 
        ctx.beginPath();
        ctx.arc(c.x + c.width/2 - 5, floatY + c.height/2 - 5, 4, 0, Math.PI*2);
        ctx.fill();
        ctx.shadowBlur = 0;
    }

    for (const obs of obstaclesRef.current) {
      if (obs.type === 'spike') {
        const centerX = obs.x + obs.width / 2;
        ctx.fillStyle = lerpColor('#39ff14', THEME_DAY.obstacle, dayFactor);
        
        ctx.shadowBlur = 15;
        ctx.shadowColor = lerpColor('#39ff14', 'transparent', dayFactor);
        
        ctx.beginPath();
        // Replacing roundRect with helper
        drawRoundedRect(ctx, centerX - 6, obs.y + 5, 12, obs.height - 5, 5);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(centerX - 6, obs.y + 20);
        ctx.quadraticCurveTo(centerX - 20, obs.y + 20, centerX - 15, obs.y + 10);
        ctx.lineTo(centerX - 15, obs.y + 10);
        ctx.moveTo(centerX + 6, obs.y + 25);
        ctx.quadraticCurveTo(centerX + 20, obs.y + 25, centerX + 15, obs.y + 15);
        ctx.strokeStyle = ctx.fillStyle; 
        ctx.lineWidth = 8;
        ctx.lineCap = 'round';
        ctx.stroke();
        
        ctx.shadowBlur = 0;
        ctx.strokeStyle = groundFront; 
        ctx.lineWidth = 1;
      }
    }

    const p = playerRef.current;
    const isTripleJumping = p.jumpCount === 3 && !p.isGrounded;
    const rotationAngle = isTripleJumping ? frameCount * 0.3 : 0;
    const centerX = p.x + p.width / 2;
    const centerY = p.y + p.height / 2;

    let neckX = p.x + p.width / 2;
    let neckY = p.y + 15; 

    if (isTripleJumping) {
        const dy = 15 - p.height / 2; 
        const dx = 0;
        const rx = dx * Math.cos(rotationAngle) - dy * Math.sin(rotationAngle);
        const ry = dx * Math.sin(rotationAngle) + dy * Math.cos(rotationAngle);
        neckX = centerX + rx;
        neckY = centerY + ry;
    }

    ctx.strokeStyle = scarfColor;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    const windPush = -5 + Math.sin(frameCount * 0.1) * 5;
    ctx.moveTo(neckX, neckY); 
    for (let i = 0; i < 10; i++) {
        const trailX = (p.vx === 0) ? -1 : -Math.sign(p.vx);
        const segX = neckX + (i * 8 * trailX) - (p.vx * i * 0.5) + (i * windPush * 0.5); 
        const segY = neckY + Math.sin(frameCount * 0.3 + i * 0.5) * 5 + (p.vy * 0.5); 
        ctx.lineTo(segX, segY);
    }
    ctx.stroke();

    ctx.save();
    if (isTripleJumping) {
        ctx.translate(centerX, centerY);
        ctx.rotate(rotationAngle);
        ctx.translate(-centerX, -centerY);
    }

    let squashOffset = 0;
    if (squashTimerRef.current > 0) {
        squashOffset = p.height * 0.2; 
    }
    
    const drawY = p.y + squashOffset;
    const drawHeight = p.height - squashOffset;
    
    ctx.fillStyle = ninjaColor;
    ctx.beginPath();
    ctx.arc(p.x + p.width/2, drawY + 10, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(p.x + 5, drawY + 18, p.width - 10, drawHeight - 30);
    
    const handX = p.x + p.width/2 + 5; 
    const handY = drawY + 28;
    ctx.save();
    ctx.translate(handX, handY);
    const isMoving = Math.abs(p.vx) > 0.1 && currentState === GameState.PLAYING; 
    const baseAngle = -Math.PI / 2 + 0.2; 
    const runBob = isMoving ? Math.sin(frameCount * 0.3) * 0.15 : Math.sin(frameCount * 0.05) * 0.05;
    ctx.rotate(baseAngle + runBob);
    ctx.strokeStyle = '#a0522d'; 
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-3, 0);
    ctx.lineTo(3, 0);
    ctx.stroke();
    ctx.fillStyle = '#cbd5e1'; 
    ctx.beginPath();
    ctx.moveTo(3, -1.5); 
    ctx.lineTo(3, 1.5);
    ctx.lineTo(10, 0.5);
    ctx.lineTo(11.5, 2); 
    ctx.lineTo(22.5, 0); 
    ctx.lineTo(11.5, -2);
    ctx.lineTo(10, -0.5);
    ctx.lineTo(3, -1.5);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-3, -1.5);
    ctx.lineTo(-3, 1.5);
    ctx.lineTo(-15, 0.5); 
    ctx.lineTo(-16.5, 0); 
    ctx.lineTo(-15, -0.5);
    ctx.lineTo(-3, -1.5);
    ctx.fill();
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(11.5, 0);
    ctx.lineTo(21, 0);
    ctx.stroke();
    ctx.restore();

    const legPhase = frameCount * 0.5;
    ctx.strokeStyle = ninjaColor;
    ctx.lineWidth = 6;
    const legStartY = drawY + drawHeight - 12;
    const feetY = p.y + p.height;
    ctx.beginPath();
    ctx.moveTo(p.x + 15, legStartY);
    if (!p.isGrounded) {
        ctx.lineTo(p.x + 5, feetY);
    } else if (isMoving) {
        ctx.lineTo(p.x + 15 + Math.sin(legPhase) * 15, feetY);
    } else {
        ctx.lineTo(p.x + 10, feetY); 
    }
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(p.x + 15, legStartY);
    if (!p.isGrounded) {
        ctx.lineTo(p.x + 25, feetY - 5);
    } else if (isMoving) {
        ctx.lineTo(p.x + 15 + Math.sin(legPhase + Math.PI) * 15, feetY);
    } else {
        ctx.lineTo(p.x + 20, feetY); 
    }
    ctx.stroke();

    ctx.strokeStyle = scarfColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    const headbandDir = p.vx === 0 ? 1 : Math.sign(p.vx);
    ctx.moveTo(p.x + p.width/2, drawY + 8); 
    ctx.lineTo(p.x + p.width/2 - (20 * headbandDir) - p.vx + (windPush * 2), drawY + 8 - Math.sin(frameCount*0.5)*5);
    ctx.stroke();

    ctx.restore(); 

    particlesRef.current.forEach(part => {
      ctx.fillStyle = part.color;
      ctx.globalAlpha = part.life / part.maxLife;
      ctx.beginPath();
      ctx.arc(part.x, part.y, part.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    });

    ctx.restore(); 

    const gradV = ctx.createRadialGradient(CANVAS_WIDTH/2, CANVAS_HEIGHT/2, CANVAS_HEIGHT/3, CANVAS_WIDTH/2, CANVAS_HEIGHT/2, CANVAS_HEIGHT);
    gradV.addColorStop(0, 'rgba(0,0,0,0)');
    gradV.addColorStop(1, `rgba(2, 6, 23, ${0.8 * (1 - dayFactor * 0.5)})`); 
    ctx.fillStyle = gradV;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  };

  const loop = (time: number) => {
    // time is ms
    const currentState = gameStateRef.current;

    if (currentState === GameState.PLAYING) {
      generateWorld();
      updatePhysics(time / 16);
      updateParticles();
      updateClouds();
      updateShootingStars();
      updateWind();
    } else if (currentState === GameState.GAME_OVER) {
       // Continue animating particles even in death
       updateParticles();
       updateClouds();
       updateShootingStars();
       updateWind();
    } 
    // If PAUSED, we skip updates, just Draw.
    
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        draw(ctx, time / 16);
      }
    }
    requestRef.current = requestAnimationFrame(loop);
  };

  useEffect(() => {
    // Force initialization on mount (since App keys us by session ID)
    initGame();
    requestRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(requestRef.current);
  }, []); // Run once on mount

  return (
    <canvas 
      ref={canvasRef}
      width={CANVAS_WIDTH}
      height={CANVAS_HEIGHT}
      className="w-full h-full object-cover"
    />
  );
};