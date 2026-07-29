import { useEffect, useRef, useCallback, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';

interface Props {
  onGameOver: (score: number) => void;
  onPause: () => void;
  setScore: (s: number) => void;
  paused?: boolean;
  enhancedControls?: boolean;
}

const PLAYER_SIZE = 20;
const STAR_SIZE = 8;
const ASTEROID_MIN = 18;
const ASTEROID_MAX = 42;
const BASE_SPEED = 150;

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
}

interface ScreenShake {
  x: number;
  y: number;
  intensity: number;
}

type SoundName = 'thrust' | 'collect' | 'gameOver';

export default function Game({ onGameOver, onPause, setScore, paused, enhancedControls = false }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const state = useRef({
    player: { x: 0, y: 0, size: PLAYER_SIZE },
    stars: [] as { x: number; y: number; collected: boolean; glow: number }[],
    asteroids: [] as { x: number; y: number; size: number; vx: number; vy: number; rotation: number; rotSpeed: number }[],
    particles: [] as Particle[],
    shake: { x: 0, y: 0, intensity: 0 } as ScreenShake,
    score: 0,
    gameOver: false,
    paused: false,
    width: 0,
    height: 0,
    dpr: 1,
  });
  const animFrameRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const keysRef = useRef<Set<string>>(new Set());
  const touchRef = useRef<{ x: number; y: number; active: boolean }>({ x: 0, y: 0, active: false });
  const joystickRef = useRef<HTMLDivElement>(null);
  const joystickPointerRef = useRef<number | null>(null);
  const joystickInputRef = useRef({ x: 0, y: 0 });
  const audioContextRef = useRef<AudioContext | null>(null);
  const [joystickVisual, setJoystickVisual] = useState({ x: 0, y: 0, active: false });
  const spawnTimerRef = useRef(0);
  const starTimerRef = useRef(0);
  const diffRef = useRef(1);
  const gameOverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const playSound = useCallback((sound: SoundName) => {
    if (!enhancedControls) return;

    const AudioContextClass = window.AudioContext;
    if (!AudioContextClass) return;

    const audio = audioContextRef.current ?? new AudioContextClass();
    audioContextRef.current = audio;
    if (audio.state === 'suspended') {
      void audio.resume();
    }

    const now = audio.currentTime;
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    const settings: Record<SoundName, {
      type: OscillatorType;
      start: number;
      end: number;
      duration: number;
      volume: number;
    }> = {
      thrust: { type: 'sawtooth', start: 120, end: 76, duration: 0.14, volume: 0.025 },
      collect: { type: 'sine', start: 660, end: 1040, duration: 0.16, volume: 0.09 },
      gameOver: { type: 'sawtooth', start: 150, end: 42, duration: 0.5, volume: 0.12 },
    };
    const config = settings[sound];

    oscillator.type = config.type;
    oscillator.frequency.setValueAtTime(config.start, now);
    oscillator.frequency.exponentialRampToValueAtTime(config.end, now + config.duration);
    gain.gain.setValueAtTime(config.volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + config.duration);
    oscillator.connect(gain);
    gain.connect(audio.destination);
    oscillator.start(now);
    oscillator.stop(now + config.duration);
  }, [enhancedControls]);

  const spawnStar = useCallback(() => {
    const s = state.current;
    s.stars.push({
      x: Math.random() * (s.width - 20) + 10,
      y: -10,
      collected: false,
      glow: Math.random() * Math.PI * 2,
    });
  }, []);

  const spawnAsteroid = useCallback(() => {
    const s = state.current;
    const size = ASTEROID_MIN + Math.random() * (ASTEROID_MAX - ASTEROID_MIN);
    const speed = BASE_SPEED + diffRef.current * 30 + Math.random() * 40;
    const fromSide = Math.random() < 0.3;

    let x: number, y: number, vx: number, vy: number;
    if (fromSide) {
      x = Math.random() < 0.5 ? -size : s.width + size;
      y = Math.random() * s.height * 0.7;
      vx = x < s.width / 2 ? speed : -speed;
      vy = (Math.random() - 0.5) * speed * 0.3;
    } else {
      x = Math.random() * s.width;
      y = -size;
      vx = (Math.random() - 0.5) * speed * 0.4;
      vy = speed * (0.8 + Math.random() * 0.4);
    }

    s.asteroids.push({
      x, y, size,
      vx, vy,
      rotation: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 3,
    });
  }, []);

  const spawnParticles = useCallback((x: number, y: number, count: number, color: string, spd = 200) => {
    const s = state.current;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * spd + 50;
      s.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        maxLife: 0.3 + Math.random() * 0.5,
        size: 2 + Math.random() * 4,
        color,
      });
    }
  }, []);

  const spawnScoreParticles = useCallback((x: number, y: number) => {
    spawnParticles(x, y, 20, '#facc15', 300);
    spawnParticles(x, y, 10, '#ffffff', 200);
  }, [spawnParticles]);

  const spawnExplosion = useCallback((x: number, y: number) => {
    spawnParticles(x, y, 35, '#f97316', 350);
    spawnParticles(x, y, 25, '#ef4444', 250);
    spawnParticles(x, y, 15, '#facc15', 200);
  }, [spawnParticles]);

  const triggerShake = useCallback((intensity: number) => {
    state.current.shake.intensity = intensity;
  }, []);

  const updateParticles = useCallback((dt: number) => {
    const s = state.current;
    for (let i = s.particles.length - 1; i >= 0; i--) {
      const p = s.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt / p.maxLife;
      p.vx *= 0.97;
      p.vy *= 0.97;
      if (p.life <= 0) {
        s.particles.splice(i, 1);
      }
    }
  }, []);

  const updateShake = useCallback((dt: number) => {
    const s = state.current;
    if (s.shake.intensity > 0) {
      s.shake.x = (Math.random() - 0.5) * s.shake.intensity * 2;
      s.shake.y = (Math.random() - 0.5) * s.shake.intensity * 2;
      s.shake.intensity *= Math.pow(0.08, dt);
      if (s.shake.intensity < 0.5) {
        s.shake.x = 0;
        s.shake.y = 0;
        s.shake.intensity = 0;
      }
    }
  }, []);

  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const s = state.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.save();
    ctx.translate(s.shake.x, s.shake.y);

    // Clear with shake offset accounted for
    ctx.clearRect(
      -s.shake.x - s.width * 0.1,
      -s.shake.y - s.height * 0.1,
      s.width + s.width * 0.2,
      s.height + s.height * 0.2
    );

    // Draw collectible stars
    for (const star of s.stars) {
      if (star.collected) continue;
      ctx.save();
      ctx.translate(star.x, star.y);

      // Outer glow
      const glowAlpha = 0.25 + Math.sin(Date.now() / 250 + star.glow) * 0.2;
      const grad = ctx.createRadialGradient(0, 0, 1, 0, 0, STAR_SIZE * 3.5);
      grad.addColorStop(0, `rgba(250, 204, 21, ${glowAlpha})`);
      grad.addColorStop(1, 'rgba(250, 204, 21, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(-STAR_SIZE * 3.5, -STAR_SIZE * 3.5, STAR_SIZE * 7, STAR_SIZE * 7);

      // Diamond shape
      ctx.beginPath();
      ctx.moveTo(0, -STAR_SIZE);
      ctx.lineTo(STAR_SIZE * 0.6, 0);
      ctx.lineTo(0, STAR_SIZE);
      ctx.lineTo(-STAR_SIZE * 0.6, 0);
      ctx.closePath();

      ctx.fillStyle = '#facc15';
      ctx.fill();
      ctx.strokeStyle = '#fef08a';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.restore();
    }

    // Draw asteroids
    for (const a of s.asteroids) {
      ctx.save();
      ctx.translate(a.x, a.y);
      ctx.rotate(a.rotation);

      const seed = Math.abs(Math.floor(a.x * 7 + a.y * 13)) % 100;
      const sides = 7 + (seed % 4);
      const radii: number[] = [];
      for (let i = 0; i < sides; i++) {
        const rVar = 0.65 + ((seed * (i + 1) * 7) % 100) / 280;
        radii.push(a.size * rVar);
      }

      ctx.beginPath();
      for (let i = 0; i < sides; i++) {
        const angle = (i / sides) * Math.PI * 2;
        const r = radii[i];
        if (i === 0) ctx.moveTo(Math.cos(angle) * r, Math.sin(angle) * r);
        else ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
      }
      ctx.closePath();

      ctx.fillStyle = '#52525b';
      ctx.fill();
      ctx.strokeStyle = '#a1a1aa';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Detail lines
      ctx.strokeStyle = 'rgba(161, 161, 170, 0.2)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 3; i++) {
        const angle = ((i / 3) * Math.PI * 2) % (Math.PI * 2);
        const r = a.size * (0.35 + ((seed * (i + 5) * 3) % 100) / 300);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
        ctx.stroke();
      }

      ctx.restore();
    }

    // Draw player ship
    ctx.save();
    ctx.translate(s.player.x, s.player.y);

    // Engine glow (animated)
    const pulse = 0.8 + Math.sin(Date.now() / 100) * 0.2;
    ctx.beginPath();
    ctx.moveTo(-7, s.player.size * 0.6);
    ctx.lineTo(0, s.player.size * (1.2 + (1 - pulse) * 0.3));
    ctx.lineTo(7, s.player.size * 0.6);
    ctx.closePath();
    const eg = ctx.createLinearGradient(0, s.player.size * 0.6, 0, s.player.size * 1.5);
    eg.addColorStop(0, `rgba(250, 204, 21, ${0.8 * pulse})`);
    eg.addColorStop(0.5, `rgba(251, 146, 60, ${0.5 * pulse})`);
    eg.addColorStop(1, 'rgba(239, 68, 68, 0)');
    ctx.fillStyle = eg;
    ctx.fill();

    // Ship hull
    ctx.beginPath();
    ctx.moveTo(0, -s.player.size);
    ctx.lineTo(-s.player.size * 0.85, s.player.size * 0.6);
    ctx.lineTo(-s.player.size * 0.25, s.player.size * 0.4);
    ctx.lineTo(s.player.size * 0.25, s.player.size * 0.4);
    ctx.lineTo(s.player.size * 0.85, s.player.size * 0.6);
    ctx.closePath();

    const sg = ctx.createLinearGradient(0, -s.player.size, 0, s.player.size * 0.6);
    sg.addColorStop(0, '#818cf8');
    sg.addColorStop(0.5, '#6366f1');
    sg.addColorStop(1, '#4f46e5');
    ctx.fillStyle = sg;
    ctx.fill();
    ctx.strokeStyle = '#a5b4fc';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Cockpit glow
    ctx.beginPath();
    ctx.arc(0, -s.player.size * 0.1, 5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(165, 180, 252, 0.3)';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, -s.player.size * 0.1, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.fill();

    ctx.restore();

    // Draw particles
    for (const p of s.particles) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.translate(p.x, p.y);
      ctx.beginPath();
      ctx.arc(0, 0, p.size * Math.max(0, p.life), 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.fill();
      ctx.restore();
    }

    // HUD
    ctx.save();
    ctx.resetTransform();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.font = 'bold 28px ui-monospace, "SF Mono", monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillText(s.score.toLocaleString(), s.width - 20, 16);

    ctx.fillStyle = 'rgba(113, 113, 122, 0.4)';
    ctx.font = '11px ui-monospace, monospace';
    ctx.textAlign = 'left';
    ctx.fillText('ESC pause', 16, 16);

    ctx.fillStyle = 'rgba(113, 113, 122, 0.15)';
    ctx.font = '11px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(Math.floor(s.score / 10 + 1) + '×', s.width / 2, 16);

    ctx.restore();
    ctx.restore();
  }, []);

  const gameLoop = useCallback((time: number) => {
    const s = state.current;
    if (s.gameOver) {
      animFrameRef.current = requestAnimationFrame(gameLoop);
      renderCanvas();
      return;
    }
    if (s.paused) {
      animFrameRef.current = requestAnimationFrame(gameLoop);
      return;
    }

    const dt = Math.min((time - lastTimeRef.current) / 1000, 0.05);
    lastTimeRef.current = time;

    diffRef.current = 1 + s.score / 80;

    // Keyboard movement
    const playerSpeed = 380 + diffRef.current * 15;
    if (keysRef.current.has('ArrowLeft') || keysRef.current.has('KeyA')) s.player.x -= playerSpeed * dt;
    if (keysRef.current.has('ArrowRight') || keysRef.current.has('KeyD')) s.player.x += playerSpeed * dt;
    if (keysRef.current.has('ArrowUp') || keysRef.current.has('KeyW')) s.player.y -= playerSpeed * dt;
    if (keysRef.current.has('ArrowDown') || keysRef.current.has('KeyS')) s.player.y += playerSpeed * dt;

    if (enhancedControls) {
      // Owner-preview joystick movement
      s.player.x += joystickInputRef.current.x * playerSpeed * dt;
      s.player.y += joystickInputRef.current.y * playerSpeed * dt;
    } else if (touchRef.current.active) {
      // Current public touch-and-drag movement
      const tx = touchRef.current.x;
      const ty = touchRef.current.y;
      const dx = tx - s.player.x;
      const dy = ty - s.player.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 5) {
        const moveSpeed = Math.min(playerSpeed * 1.2, dist * 6) * dt;
        s.player.x += (dx / dist) * moveSpeed;
        s.player.y += (dy / dist) * moveSpeed;
      }
    }

    // Clamp player
    const margin = s.player.size;
    s.player.x = Math.max(margin, Math.min(s.width - margin, s.player.x));
    s.player.y = Math.max(margin, Math.min(s.height - margin, s.player.y));

    // Spawn asteroids
    spawnTimerRef.current += dt;
    const interval = Math.max(0.35, 1.8 - diffRef.current * 0.06);
    if (spawnTimerRef.current >= interval) {
      spawnTimerRef.current = 0;
      const count = 1 + Math.floor(diffRef.current / 2.5);
      for (let i = 0; i < Math.min(count, 4); i++) {
        spawnAsteroid();
      }
    }

    // Spawn stars
    starTimerRef.current += dt;
    const starInterval = Math.max(0.8, 1.8 - diffRef.current * 0.04);
    if (starTimerRef.current >= starInterval) {
      starTimerRef.current = 0;
      spawnStar();
      if (Math.random() < 0.35) spawnStar();
    }

    // Update asteroids
    for (let i = s.asteroids.length - 1; i >= 0; i--) {
      const a = s.asteroids[i];
      a.x += a.vx * dt;
      a.y += a.vy * dt;
      a.rotation += a.rotSpeed * dt;

      const outMargin = 120;
      if (a.x < -outMargin || a.x > s.width + outMargin || a.y < -outMargin || a.y > s.height + outMargin) {
        s.asteroids.splice(i, 1);
      }
    }

    // Update stars
    const starSpeed = 80 + diffRef.current * 6;
    for (let i = s.stars.length - 1; i >= 0; i--) {
      const st = s.stars[i];
      st.y += starSpeed * dt;
      if (st.y > s.height + 20) {
        s.stars.splice(i, 1);
      }
    }

    // Star collision
    for (let i = s.stars.length - 1; i >= 0; i--) {
      const st = s.stars[i];
      if (st.collected) continue;
      const dx = s.player.x - st.x;
      const dy = s.player.y - st.y;
      if (dx * dx + dy * dy < (s.player.size + STAR_SIZE) * (s.player.size + STAR_SIZE)) {
        st.collected = true;
        const pts = 10 + Math.floor(diffRef.current * 5);
        s.score += pts;
        setScore(s.score);
        spawnScoreParticles(st.x, st.y);
        triggerShake(3 + diffRef.current * 0.3);
        if (enhancedControls) playSound('collect');
        s.stars.splice(i, 1);
      }
    }

    // Asteroid collision
    let hit = false;
    for (let i = 0; i < s.asteroids.length && !hit; i++) {
      const a = s.asteroids[i];
      const dx = s.player.x - a.x;
      const dy = s.player.y - a.y;
      const minDist = s.player.size + a.size * 0.45;
      if (dx * dx + dy * dy < minDist * minDist) {
        hit = true;
        s.gameOver = true;
        spawnExplosion(s.player.x, s.player.y);
        triggerShake(15);
        if (enhancedControls) playSound('gameOver');

        if (gameOverTimerRef.current) clearTimeout(gameOverTimerRef.current);
        gameOverTimerRef.current = setTimeout(() => {
          onGameOver(s.score);
        }, 700);
      }
    }

    updateParticles(dt);
    updateShake(dt);
    renderCanvas();

    animFrameRef.current = requestAnimationFrame(gameLoop);
  }, [enhancedControls, onGameOver, setScore, spawnAsteroid, spawnStar, spawnScoreParticles, spawnExplosion, triggerShake, playSound, updateParticles, updateShake, renderCanvas]);

  // Resize
  const handleResize = useCallback(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    state.current.dpr = dpr;

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';

    state.current.width = rect.width;
    state.current.height = rect.height;

    const ctx = canvas.getContext('2d');
    if (ctx) ctx.scale(dpr, dpr);
  }, []);

  // Keyboard
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    keysRef.current.add(e.code);
    if ((e.code === 'Escape' || e.code === 'KeyP') && !state.current.gameOver) {
      e.preventDefault();
      onPause();
    }
  }, [onPause]);

  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    keysRef.current.delete(e.code);
  }, []);

  const getCanvasPos = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  }, []);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (enhancedControls) return;
    e.preventDefault();
    const touch = e.touches[0];
    if (!touch) return;
    const pos = getCanvasPos(touch.clientX, touch.clientY);
    touchRef.current = { ...pos, active: true };
  }, [enhancedControls, getCanvasPos]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (enhancedControls) return;
    e.preventDefault();
    const touch = e.touches[0];
    if (!touch) return;
    const pos = getCanvasPos(touch.clientX, touch.clientY);
    touchRef.current.x = pos.x;
    touchRef.current.y = pos.y;
  }, [enhancedControls, getCanvasPos]);

  const handleTouchEnd = useCallback((e: TouchEvent) => {
    if (enhancedControls) return;
    e.preventDefault();
    touchRef.current.active = false;
  }, [enhancedControls]);

  const updateJoystick = useCallback((clientX: number, clientY: number) => {
    const joystick = joystickRef.current;
    if (!joystick) return;
    const rect = joystick.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const maxDistance = rect.width * 0.3;
    const rawX = clientX - centerX;
    const rawY = clientY - centerY;
    const distance = Math.hypot(rawX, rawY);
    const scale = distance > maxDistance ? maxDistance / distance : 1;
    const x = rawX * scale;
    const y = rawY * scale;
    joystickInputRef.current = {
      x: Math.max(-1, Math.min(1, x / maxDistance)),
      y: Math.max(-1, Math.min(1, y / maxDistance)),
    };
    setJoystickVisual({ x, y, active: true });
  }, []);

  const resetJoystick = useCallback(() => {
    joystickPointerRef.current = null;
    joystickInputRef.current = { x: 0, y: 0 };
    setJoystickVisual({ x: 0, y: 0, active: false });
  }, []);

  const handleJoystickPointerDown = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    joystickPointerRef.current = e.pointerId;
    e.currentTarget.setPointerCapture(e.pointerId);
    updateJoystick(e.clientX, e.clientY);
    playSound('thrust');
  }, [playSound, updateJoystick]);

  const handleJoystickPointerMove = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (joystickPointerRef.current !== e.pointerId) return;
    e.preventDefault();
    updateJoystick(e.clientX, e.clientY);
  }, [updateJoystick]);

  const handleJoystickPointerEnd = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (joystickPointerRef.current !== e.pointerId) return;
    e.preventDefault();
    resetJoystick();
  }, [resetJoystick]);

  // Init
  useEffect(() => {
    const s = state.current;
    // Reset everything
    s.score = 0;
    s.gameOver = false;
    s.paused = false;
    s.asteroids = [];
    s.stars = [];
    s.particles = [];
    s.shake = { x: 0, y: 0, intensity: 0 };
    diffRef.current = 1;
    spawnTimerRef.current = 0;
    starTimerRef.current = 0;
    resetJoystick();

    handleResize();

    // Center player
    s.player.x = s.width / 2;
    s.player.y = enhancedControls ? s.height * 0.7 : s.height / 2;

    window.addEventListener('resize', handleResize);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    document.addEventListener('touchstart', handleTouchStart, { passive: false });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd, { passive: false });

    lastTimeRef.current = performance.now();
    animFrameRef.current = requestAnimationFrame(gameLoop);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
      cancelAnimationFrame(animFrameRef.current);
      if (gameOverTimerRef.current) clearTimeout(gameOverTimerRef.current);
      joystickInputRef.current = { x: 0, y: 0 };
      if (audioContextRef.current) {
        void audioContextRef.current.close();
        audioContextRef.current = null;
      }
    };
  }, [enhancedControls, gameLoop, handleResize, handleKeyDown, handleKeyUp, handleTouchStart, handleTouchMove, handleTouchEnd, resetJoystick]);

  // Sync pause
  useEffect(() => {
    state.current.paused = !!paused;
  }, [paused]);

  return (
    <div ref={containerRef} className="absolute inset-0 game-canvas">
      <canvas ref={canvasRef} className={`w-full h-full block ${enhancedControls ? 'pointer-events-none' : ''}`} />

      {enhancedControls && (
      <div className="absolute inset-0 z-10 pointer-events-none" aria-label="Game controls">
        <div
          ref={joystickRef}
          role="application"
          aria-label="Directional joystick"
          onPointerDown={handleJoystickPointerDown}
          onPointerMove={handleJoystickPointerMove}
          onPointerUp={handleJoystickPointerEnd}
          onPointerCancel={handleJoystickPointerEnd}
          onLostPointerCapture={handleJoystickPointerEnd}
          className="pointer-events-auto absolute left-5 md:left-8 w-32 h-32 md:w-36 md:h-36 rounded-full
                     border border-indigo-300/35 bg-zinc-950/60 backdrop-blur-md shadow-2xl shadow-indigo-950/70
                     touch-none select-none"
          style={{ bottom: 'calc(env(safe-area-inset-bottom) + 22px)' }}
        >
          <div className="absolute inset-3 rounded-full border border-white/5 bg-gradient-to-br from-white/5 to-transparent" />
          <div className="absolute left-1/2 top-3 -translate-x-1/2 w-1.5 h-3 rounded-full bg-indigo-200/35" />
          <div className="absolute left-1/2 bottom-3 -translate-x-1/2 w-1.5 h-3 rounded-full bg-indigo-200/35" />
          <div className="absolute top-1/2 left-3 -translate-y-1/2 h-1.5 w-3 rounded-full bg-indigo-200/35" />
          <div className="absolute top-1/2 right-3 -translate-y-1/2 h-1.5 w-3 rounded-full bg-indigo-200/35" />
          <div
            className={`absolute left-1/2 top-1/2 w-16 h-16 md:w-[4.5rem] md:h-[4.5rem] rounded-full
                        border border-indigo-100/50 bg-gradient-to-br from-indigo-400/90 to-indigo-700/90
                        shadow-lg shadow-indigo-500/25 transition-shadow ${
                          joystickVisual.active ? 'shadow-indigo-400/50' : ''
                        }`}
            style={{
              transform: `translate(calc(-50% + ${joystickVisual.x}px), calc(-50% + ${joystickVisual.y}px))`,
            }}
          >
            <div className="absolute inset-3 rounded-full border border-white/20 bg-black/10" />
          </div>
        </div>

      </div>
      )}
    </div>
  );
}
