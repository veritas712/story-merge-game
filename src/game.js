import { GAME_CONFIG, getLevelConfig } from './config.js';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const easeOutBack = (t) => { const c1 = 1.70158; const c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };

export class MergeGame {
  constructor(canvas, hooks = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.hooks = hooks;
    this.images = new Map();
    this.bodies = [];
    this.merges = [];
    this.particles = [];
    this.floaters = [];
    this.pointerX = GAME_CONFIG.width / 2;
    this.currentLevel = 1;
    this.nextLevel = 1;
    this.score = 0;
    this.best = Number(localStorage.getItem('story-merge-best') || 0);
    this.maxReached = 1;
    this.paused = false;
    this.gameOver = false;
    this.soundOn = true;
    this.dangerMs = 0;
    this.lastTime = 0;
    this.running = false;
    this.pendingDrop = false;
    this.dropTimer = null;
    this.seed = Math.random() * 1000;
    this.loadImages();
    this.reset();
  }

  loadImages() {
    GAME_CONFIG.levels.forEach((config) => {
      const image = new Image();
      image.onload = () => this.images.set(config.level, image);
      image.onerror = () => this.hooks.onAssetError?.(config);
      image.src = config.image;
    });
  }

  reset() {
    this.bodies = [];
    this.merges = [];
    this.particles = [];
    this.floaters = [];
    this.score = 0;
    this.maxReached = 1;
    this.currentLevel = this.randomDropLevel();
    this.nextLevel = this.randomDropLevel();
    this.pointerX = GAME_CONFIG.width / 2;
    this.paused = false;
    this.gameOver = false;
    this.dangerMs = 0;
    this.pendingDrop = false;
    if (this.dropTimer) window.clearTimeout(this.dropTimer);
    this.dropTimer = null;
    this.hooks.onState?.(this.getState());
  }

  getState() { return { score: this.score, best: this.best, currentLevel: this.currentLevel, nextLevel: this.nextLevel, maxReached: this.maxReached, paused: this.paused, gameOver: this.gameOver }; }

  randomDropLevel() {
    const roll = Math.random();
    if (roll < .58) return 1;
    if (roll < .83) return 2;
    if (roll < .96) return 3;
    return 4;
  }

  setPointer(x) { this.pointerX = clamp(x, 18, GAME_CONFIG.width - 18); }

  drop() {
    if (this.paused || this.gameOver || this.pendingDrop) return false;
    const config = getLevelConfig(this.currentLevel);
    const x = clamp(this.pointerX, config.radius + 3, GAME_CONFIG.width - config.radius - 3);
    const body = this.createBody(this.currentLevel, x, 44 + config.radius, true);
    body.vy = 0.2;
    this.bodies.push(body);
    this.currentLevel = this.nextLevel;
    this.nextLevel = this.randomDropLevel();
    this.pendingDrop = true;
    this.dropTimer = window.setTimeout(() => { this.pendingDrop = false; this.dropTimer = null; }, 180);
    this.hooks.onState?.(this.getState());
    this.beep(420, .035);
    return true;
  }

  createBody(level, x, y, isNew = false) {
    const config = getLevelConfig(level);
    const radius = config.radius;
    return { id: `${Date.now()}-${Math.random()}`, level, x, y, vx: 0, vy: 0, r: radius, invMass: 1 / (radius * radius), rotation: 0, squash: 0, stretch: 0, locked: false, isNew, pop: isNew ? 0 : 1, born: performance.now(), dangerMs: 0, mergeEligibleAt: performance.now() + GAME_CONFIG.mergeCooldownMs };
  }

  togglePause() { if (this.gameOver) return; this.paused = !this.paused; this.hooks.onState?.(this.getState()); }
  setSound(value) { this.soundOn = value; }

  update(deltaMs) {
    if (this.paused || this.gameOver) return;
    // Use bounded fixed-size substeps. A long frame must never move a body through
    // another body before the solver gets a chance to separate them.
    const frameMs = clamp(deltaMs, 0, 50);
    const steps = Math.min(6, Math.max(1, Math.ceil(frameMs / 8.3333)));
    const stepMs = frameMs / steps;
    for (let step = 0; step < steps; step += 1) this.stepPhysics(stepMs);
    this.updateEffects(frameMs);
    this.checkDanger(frameMs);
  }

  stepPhysics(stepMs) {
    const dt = stepMs / 16.6667;
    for (const merge of this.merges) {
      merge.t += stepMs;
      const p = clamp(merge.t / merge.duration, 0, 1);
      for (const body of [merge.a, merge.b]) {
        body.x += (merge.x - body.x) * Math.min(.32 * dt, 1);
        body.y += (merge.y - body.y) * Math.min(.32 * dt, 1);
        body.squash = Math.max(body.squash, .1 * (1 - p));
      }
      if (p >= 1) merge.ready = true;
    }
    this.merges.filter((merge) => merge.ready).forEach((merge) => this.finalizeMerge(merge));
    this.merges = this.merges.filter((merge) => !merge.ready);

    for (const body of this.bodies) {
      if (body.locked) continue;
      body.vy += GAME_CONFIG.gravity * dt;
      body.vx *= Math.pow(GAME_CONFIG.airDrag, dt);
      body.vy *= Math.pow(GAME_CONFIG.airDrag, dt);
      body.x += body.vx * dt;
      body.y += body.vy * dt;
      body.rotation += body.vx * .0018 * dt;
      if (body.x - body.r < 0) { body.x = body.r; if (body.vx < 0) { body.vx = -body.vx * GAME_CONFIG.wallBounce; this.impact(body, Math.abs(body.vx) + .25); } }
      if (body.x + body.r > GAME_CONFIG.width) { body.x = GAME_CONFIG.width - body.r; if (body.vx > 0) { body.vx = -body.vx * GAME_CONFIG.wallBounce; this.impact(body, Math.abs(body.vx) + .25); } }
      if (body.y + body.r > GAME_CONFIG.height) { body.y = GAME_CONFIG.height - body.r; if (body.vy > 0) { if (body.vy > 1.1) this.impact(body, body.vy); body.vy = -body.vy * GAME_CONFIG.floorBounce; body.vx *= .985; } }
      const popT = clamp((performance.now() - body.born) / 360, 0, 1);
      // The image is clipped to the same base circle as the collider. The pop
      // overshoot is deliberately capped so animation never makes a photo much
      // larger than the physical radius that separates it from its neighbours.
      body.pop = body.isNew ? clamp(popT >= 1 ? 1 : .78 + .22 * easeOutBack(popT), .78, 1.08) : 1;
      body.squash *= .82;
      body.stretch *= .86;
    }
    // Multiple solver passes remove deep overlap in dense stacks. The final pass
    // is intentionally conservative so bodies do not oscillate around contact.
    for (let iteration = 0; iteration < 6; iteration += 1) {
      if (!this.resolveCollisions()) break;
    }
  }

  resolveCollisions() {
    let foundOverlap = false;
    for (let i = 0; i < this.bodies.length; i += 1) {
      const a = this.bodies[i];
      if (a.locked) continue;
      for (let j = i + 1; j < this.bodies.length; j += 1) {
        const b = this.bodies[j];
        if (b.locked || a.level !== b.level && (a.level === 11 || b.level === 11)) continue;
        let dx = b.x - a.x; let dy = b.y - a.y; let dist = Math.hypot(dx, dy);
        const minDist = a.r + b.r;
        if (dist === 0) { dx = 0.01 + (i % 3) * 0.01; dy = 0.02 + (j % 2) * 0.01; dist = Math.hypot(dx, dy); }
        if (dist >= minDist) continue;
        foundOverlap = true;
        const nx = dx / dist; const ny = dy / dist; const overlap = minDist - dist;
        const invA = a.invMass; const invB = b.invMass; const invTotal = invA + invB;
        // Positional correction uses inverse mass, so large photos stay planted
        // while smaller photos take the larger share of the separation.
        const correction = Math.max(overlap - 0.05, 0) * 0.92 / invTotal;
        a.x -= nx * correction * invA; a.y -= ny * correction * invA;
        b.x += nx * correction * invB; b.y += ny * correction * invB;
        this.keepInside(a); this.keepInside(b);

        const rvx = b.vx - a.vx; const rvy = b.vy - a.vy; const along = rvx * nx + rvy * ny;
        // Only apply an impulse when the bodies are approaching. Once separated,
        // positional correction must not create an extra bounce.
        if (along < 0) {
          const restitution = 0.12;
          const impulse = -(1 + restitution) * along / invTotal;
          a.vx -= impulse * nx * invA; a.vy -= impulse * ny * invA;
          b.vx += impulse * nx * invB; b.vy += impulse * ny * invB;
          const tx = -ny; const ty = nx; const tangentSpeed = rvx * tx + rvy * ty;
          const friction = clamp(-tangentSpeed / invTotal, -Math.abs(impulse) * 0.06, Math.abs(impulse) * 0.06);
          a.vx -= friction * tx * invA; a.vy -= friction * ty * invA;
          b.vx += friction * tx * invB; b.vy += friction * ty * invB;
          this.impact(a, Math.abs(along)); this.impact(b, Math.abs(along));
        }
        const now = performance.now();
        if (a.level === b.level && a.level < 11 && now >= a.mergeEligibleAt && now >= b.mergeEligibleAt && Math.abs(along) < 26) this.startMerge(a, b);
      }
    }
    return foundOverlap;
  }

  keepInside(body) {
    body.x = clamp(body.x, body.r, GAME_CONFIG.width - body.r);
    body.y = clamp(body.y, body.r, GAME_CONFIG.height - body.r);
  }

  startMerge(a, b) {
    if (this.merges.some((merge) => merge.a === a || merge.a === b || merge.b === a || merge.b === b)) return;
    a.locked = true; b.locked = true;
    const x = (a.x + b.x) / 2; const y = (a.y + b.y) / 2;
    this.merges.push({ a, b, x, y, t: 0, duration: 190 + a.level * 9, ready: false, finalized: false });
    this.burst(x, y, getLevelConfig(a.level).tint, 8);
    this.beep(180 + a.level * 26, .08);
  }

  finalizeMerge(merge) {
    if (merge.finalized) return;
    merge.finalized = true;
    const indexA = this.bodies.indexOf(merge.a); if (indexA >= 0) this.bodies.splice(indexA, 1);
    const indexB = this.bodies.indexOf(merge.b); if (indexB >= 0) this.bodies.splice(indexB, 1);
    const level = merge.a.level + 1; const config = getLevelConfig(level);
    const spawn = this.findSafeSpawn(level, merge.x, merge.y);
    const body = this.createBody(level, spawn.x, spawn.y, true);
    body.pop = .58; body.vy = -1.8; body.vx = (Math.random() - .5) * .8;
    this.bodies.push(body);
    this.maxReached = Math.max(this.maxReached, level);
    this.score += config.score;
    if (this.score > this.best) { this.best = this.score; localStorage.setItem('story-merge-best', String(this.best)); }
    this.floaters.push({ x: merge.x, y: merge.y - config.radius, text: `+${config.score}`, t: 0, color: config.tint });
    this.burst(merge.x, merge.y, config.tint, level >= 9 ? 24 : 14);
    this.hooks.onState?.(this.getState());
  }

  findSafeSpawn(level, x, y) {
    const radius = getLevelConfig(level).radius;
    const candidates = [{ x, y }, ...Array.from({ length: 16 }, (_, index) => {
      const angle = index * Math.PI / 8;
      const distance = radius * (0.25 + Math.floor(index / 4) * 0.45);
      return { x: x + Math.cos(angle) * distance, y: y + Math.sin(angle) * distance };
    })];
    let best = candidates[0]; let bestOverlap = Infinity;
    for (const candidate of candidates) {
      const cx = clamp(candidate.x, radius, GAME_CONFIG.width - radius);
      const cy = clamp(candidate.y, radius, GAME_CONFIG.height - radius);
      let overlap = 0;
      for (const other of this.bodies) {
        const distance = Math.hypot(other.x - cx, other.y - cy);
        overlap += Math.max(0, radius + other.r - distance);
      }
      if (overlap < bestOverlap) { bestOverlap = overlap; best = { x: cx, y: cy }; }
      if (overlap <= 0.5) return { x: cx, y: cy };
    }
    return best;
  }

  impact(body, strength) { if (strength < .45) return; body.squash = clamp(body.squash + Math.min(strength * .035, .22), 0, .28); body.stretch = clamp(body.stretch + Math.min(strength * .018, .13), 0, .16); }

  checkDanger(deltaMs) {
    const now = performance.now();
    let triggered = false;
    for (const body of this.bodies) {
      const merging = body.locked || this.merges.some((merge) => merge.a === body || merge.b === body);
      const recentlyBorn = now - body.born < GAME_CONFIG.dangerGraceMs;
      // The line is a visual guide only. Use the physical circle's top edge
      // (center minus radius), so the test stays in the same Canvas units as
      // collision resolution and rendering.
      const touchingLine = body.y - body.r <= GAME_CONFIG.dangerY;
      const speed = Math.hypot(body.vx, body.vy);
      const settled = speed <= GAME_CONFIG.dangerSpeedThreshold;
      if (!merging && !recentlyBorn && touchingLine && settled) {
        body.dangerMs += deltaMs;
        if (body.dangerMs >= GAME_CONFIG.dangerHoldMs) triggered = true;
      } else {
        body.dangerMs = Math.max(0, body.dangerMs - deltaMs * 1.8);
      }
    }
    this.dangerMs = this.bodies.reduce((max, body) => Math.max(max, body.dangerMs), 0);
    if (triggered) { this.gameOver = true; this.hooks.onState?.(this.getState()); this.beep(110, .18); }
  }

  updateEffects(deltaMs) {
    for (const particle of this.particles) { particle.x += particle.vx; particle.y += particle.vy; particle.vy += .03; particle.life -= deltaMs; particle.r *= .985; }
    this.particles = this.particles.filter((particle) => particle.life > 0);
    for (const floater of this.floaters) { floater.t += deltaMs; floater.y -= .35; }
    this.floaters = this.floaters.filter((floater) => floater.t < 820);
  }

  burst(x, y, color, count = 12) {
    for (let i = 0; i < count && this.particles.length < GAME_CONFIG.particleLimit; i += 1) {
      const angle = Math.random() * Math.PI * 2; const speed = 1.1 + Math.random() * 2.8;
      this.particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, r: 2 + Math.random() * 3, life: 380 + Math.random() * 380, color });
    }
  }

  render() {
    const ctx = this.ctx; const w = GAME_CONFIG.width; const h = GAME_CONFIG.height;
    ctx.clearRect(0, 0, w, h);
    const gradient = ctx.createLinearGradient(0, 0, 0, h); gradient.addColorStop(0, '#f7f7ff'); gradient.addColorStop(1, '#dfe5ff'); ctx.fillStyle = gradient; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(96,126,222,.06)'; for (let x = 20; x < w; x += 40) { for (let y = 20; y < h; y += 40) { ctx.beginPath(); ctx.arc(x, y, 1.4, 0, Math.PI * 2); ctx.fill(); } }
    ctx.save(); ctx.strokeStyle = 'rgba(241,92,130,.62)'; ctx.setLineDash([8, 7]); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, GAME_CONFIG.dangerY); ctx.lineTo(w, GAME_CONFIG.dangerY); ctx.stroke(); ctx.restore();
    [...this.bodies].sort((a, b) => a.r - b.r).forEach((body) => this.drawBody(body));
    this.particles.forEach((particle) => { ctx.save(); ctx.globalAlpha = clamp(particle.life / 650, 0, 1); ctx.fillStyle = particle.color; ctx.beginPath(); ctx.arc(particle.x, particle.y, particle.r, 0, Math.PI * 2); ctx.fill(); ctx.restore(); });
    this.floaters.forEach((floater) => { ctx.save(); ctx.globalAlpha = clamp(1 - floater.t / 820, 0, 1); ctx.fillStyle = floater.color; ctx.font = '800 18px Inter, sans-serif'; ctx.textAlign = 'center'; ctx.shadowColor = 'rgba(20,25,70,.25)'; ctx.shadowBlur = 5; ctx.fillText(floater.text, floater.x, floater.y); ctx.restore(); });
    this.drawDropPreview();
  }

  drawBody(body) {
    const ctx = this.ctx; const config = getLevelConfig(body.level); const image = this.images.get(body.level); const squash = body.squash;
    // Keep the normal drawn radius and the collider in the same Canvas units.
    // Squash/stretch changes the shape only a little, with a hard visual cap.
    const sx = clamp(body.pop * (1 + squash * .34 + body.stretch * .12), .78, 1.08);
    const sy = clamp(body.pop * (1 - squash * .27 + body.stretch * .04), .76, 1.06);
    ctx.save(); ctx.translate(body.x, body.y); ctx.rotate(body.rotation); ctx.scale(sx, sy);
    ctx.shadowColor = 'rgba(35,48,114,.24)'; ctx.shadowBlur = 12; ctx.shadowOffsetY = 5; ctx.fillStyle = config.tint; ctx.beginPath(); ctx.arc(0, 0, body.r, 0, Math.PI * 2); ctx.fill(); ctx.shadowColor = 'transparent';
    ctx.beginPath(); ctx.arc(0, 0, body.r - 1, 0, Math.PI * 2); ctx.clip();
    if (image?.complete && image.naturalWidth) { const iw = image.naturalWidth; const ih = image.naturalHeight; const scale = Math.max((body.r * 2) / iw, (body.r * 2) / ih); const dw = iw * scale; const dh = ih * scale; ctx.drawImage(image, -dw / 2, -dh / 2, dw, dh); } else { ctx.fillStyle = config.tint; ctx.fillRect(-body.r, -body.r, body.r * 2, body.r * 2); }
    ctx.restore();
    ctx.save(); ctx.translate(body.x, body.y); ctx.strokeStyle = 'rgba(255,255,255,.72)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, body.r - 1, 0, Math.PI * 2); ctx.stroke(); ctx.fillStyle = 'rgba(16,24,60,.62)'; ctx.font = `800 ${Math.max(9, body.r * .26)}px Inter, sans-serif`; ctx.textAlign = 'center'; ctx.fillText(`LV.${body.level}`, 0, body.r * .72); ctx.restore();
  }

  drawDropPreview() {
    if (this.gameOver) return; const config = getLevelConfig(this.currentLevel); const image = this.images.get(this.currentLevel); const x = clamp(this.pointerX, config.radius + 3, GAME_CONFIG.width - config.radius - 3); const y = 42 + config.radius;
    this.ctx.save(); this.ctx.globalAlpha = .72; this.ctx.setLineDash([5, 5]); this.ctx.strokeStyle = config.tint; this.ctx.beginPath(); this.ctx.moveTo(x, y + config.radius + 5); this.ctx.lineTo(x, GAME_CONFIG.height); this.ctx.stroke(); this.ctx.restore();
    this.ctx.save(); this.ctx.globalAlpha = .78; this.ctx.translate(x, y); this.ctx.fillStyle = config.tint; this.ctx.beginPath(); this.ctx.arc(0, 0, config.radius, 0, Math.PI * 2); this.ctx.fill(); this.ctx.beginPath(); this.ctx.arc(0, 0, config.radius - 1, 0, Math.PI * 2); this.ctx.clip(); if (image?.complete && image.naturalWidth) { const scale = Math.max(config.radius * 2 / image.naturalWidth, config.radius * 2 / image.naturalHeight); this.ctx.drawImage(image, -image.naturalWidth * scale / 2, -image.naturalHeight * scale / 2, image.naturalWidth * scale, image.naturalHeight * scale); } this.ctx.restore();
  }

  beep(frequency, duration) { if (!this.soundOn) return; try { const AudioContext = window.AudioContext || window.webkitAudioContext; if (!AudioContext) return; const audio = new AudioContext(); const osc = audio.createOscillator(); const gain = audio.createGain(); osc.frequency.value = frequency; gain.gain.value = .025; osc.connect(gain); gain.connect(audio.destination); osc.start(); gain.gain.exponentialRampToValueAtTime(.0001, audio.currentTime + duration); osc.stop(audio.currentTime + duration); } catch { /* audio is optional */ } }

  start() { if (this.running) return; this.running = true; const frame = (time) => { const delta = this.lastTime ? time - this.lastTime : 16; this.lastTime = time; this.update(delta); this.render(); if (this.running) requestAnimationFrame(frame); }; requestAnimationFrame(frame); }
  stop() { this.running = false; }
}
