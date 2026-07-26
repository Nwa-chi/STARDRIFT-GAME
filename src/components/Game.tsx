import { useEffect, useRef, useCallback } from 'react';

interface Props {
  onGameOver: (score: number) => void;
  onPause: () => void;
  setScore: (s: number) => void;
  paused?: boolean;
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

export default function Game({ onGameOver, onPause, setScore, paused }: Props) {
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
  const spawnTimerRef = useRef(0);
  const starTimerRef = useRef(0);
  const diffRef = useRef(1);
  const gameOverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

    // Touch movement
    if (touchRef.current.active) {
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
  }, [onGameOver, setScore, spawnAsteroid, spawnStar, spawnScoreParticles, spawnExplosion, triggerShake, updateParticles, updateShake, renderCanvas]);

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

  // Touch - convert page coords to canvas-local coords
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
    e.preventDefault();
    const t = e.touches[0];
    if (t) {
      const pos = getCanvasPos(t.clientX, t.clientY);
      touchRef.current.x = pos.x;
      touchRef.current.y = pos.y;
      touchRef.current.active = true;
    }
  }, [getCanvasPos]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    e.preventDefault();
    const t = e.touches[0];
    if (t) {
      const pos = getCanvasPos(t.clientX, t.clientY);
      touchRef.current.x = pos.x;
      touchRef.current.y = pos.y;
    }
  }, [getCanvasPos]);

  const handleTouchEnd = useCallback((e: TouchEvent) => {
    e.preventDefault();
    touchRef.current.active = false;
  }, []);

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

    handleResize();

    // Center player
    s.player.x = s.width / 2;
    s.player.y = s.height / 2;

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
    };
  }, [gameLoop, handleResize, handleKeyDown, handleKeyUp, handleTouchStart, handleTouchMove, handleTouchEnd]);

  // Sync pause
  useEffect(() => {
    state.current.paused = !!paused;
  }, [paused]);

  return (
    <div ref={containerRef} className="absolute inset-0 game-canvas">
      <canvas ref={canvasRef} className="w-full h-full block" />
    </div>
  );
}
