import { MergeGame } from './game.js';
import { GAME_CONFIG, getLevelConfig } from './config.js';

const canvas = document.querySelector('#gameCanvas');
const scoreEl = document.querySelector('#score');
const bestEl = document.querySelector('#best');
const currentPreview = document.querySelector('#currentPreview');
const nextPreview = document.querySelector('#nextPreview');
const currentName = document.querySelector('#currentName');
const nextName = document.querySelector('#nextName');
const progressText = document.querySelector('#progressText');
const levelTrack = document.querySelector('#levelTrack');
const pausedOverlay = document.querySelector('#pausedOverlay');
const gameOverOverlay = document.querySelector('#gameOverOverlay');
const finalScore = document.querySelector('#finalScore');
const pauseBtn = document.querySelector('#pauseBtn');
const soundBtn = document.querySelector('#soundBtn');

canvas.width = GAME_CONFIG.width; canvas.height = GAME_CONFIG.height;
const game = new MergeGame(canvas, { onState: renderState, onAssetError: (config) => console.warn(`素材加载失败：${config.image}`) });

function renderState(state) {
  scoreEl.textContent = state.score.toLocaleString('zh-CN');
  bestEl.textContent = state.best.toLocaleString('zh-CN');
  const current = getLevelConfig(state.currentLevel); const next = getLevelConfig(state.nextLevel);
  currentPreview.style.backgroundImage = `url("${current.image}")`; nextPreview.style.backgroundImage = `url("${next.image}")`;
  currentName.textContent = `LV.${current.level} · ${current.name}`; nextName.textContent = `LV.${next.level} · ${next.name}`;
  progressText.textContent = `${state.maxReached} / ${GAME_CONFIG.levels.length}`;
  pausedOverlay.classList.toggle('hidden', !state.paused || state.gameOver); gameOverOverlay.classList.toggle('hidden', !state.gameOver);
  finalScore.textContent = `本局得分 ${state.score.toLocaleString('zh-CN')} · 最高分 ${state.best.toLocaleString('zh-CN')}`;
  pauseBtn.textContent = state.paused ? '继续' : '暂停';
  levelTrack.querySelectorAll('.level-chip').forEach((chip, index) => chip.classList.toggle('reached', index + 1 <= state.maxReached));
}

function buildLevelTrack() {
  levelTrack.innerHTML = GAME_CONFIG.levels.map((config) => `<div class="level-chip locked" data-level="${config.level}"><img src="${config.image}" alt="${config.name}" loading="lazy"><span>${config.level}</span></div>`).join('');
}

function pointerToCanvas(event) {
  const rect = canvas.getBoundingClientRect(); const point = event.touches?.[0] || event;
  return ((point.clientX - rect.left) / rect.width) * GAME_CONFIG.width;
}

canvas.addEventListener('pointermove', (event) => { game.setPointer(pointerToCanvas(event)); });
canvas.addEventListener('pointerdown', (event) => { event.preventDefault(); game.setPointer(pointerToCanvas(event)); game.drop(); });
canvas.addEventListener('touchmove', (event) => { event.preventDefault(); game.setPointer(pointerToCanvas(event)); }, { passive: false });
canvas.addEventListener('touchstart', (event) => { event.preventDefault(); game.setPointer(pointerToCanvas(event)); game.drop(); }, { passive: false });
window.addEventListener('keydown', (event) => { if (event.code === 'Space') { event.preventDefault(); game.drop(); } if (event.code === 'KeyP') game.togglePause(); });
pauseBtn.addEventListener('click', () => game.togglePause());
soundBtn.addEventListener('click', () => { game.setSound(!game.soundOn); soundBtn.textContent = `音效：${game.soundOn ? '开' : '关'}`; soundBtn.setAttribute('aria-pressed', String(game.soundOn)); });
const restart = () => { game.reset(); renderState(game.getState()); };
document.querySelector('#restartBtn').addEventListener('click', restart); document.querySelector('#overlayRestart').addEventListener('click', restart);

buildLevelTrack(); renderState(game.getState()); game.start();
