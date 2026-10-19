const characterImage = (file) => new URL(`../public/assets/characters/${file}`, import.meta.url).href;

export const GAME_CONFIG = {
  width: 420,
  height: 680,
  gravity: 0.34,
  airDrag: 0.998,
  wallBounce: 0.22,
  floorBounce: 0.32,
  dangerY: 112,
  dangerHoldMs: 1500,
  dangerGraceMs: 420,
  dangerSpeedThreshold: 3.2,
  mergeCooldownMs: 120,
  particleLimit: 90,
  levels: [
    { level: 1, name: '初见', image: characterImage('level-01.jpg'), radius: 22, score: 2, tint: '#9ed7ff', pop: 0.18 },
    { level: 2, name: '熟悉', image: characterImage('level-02.jpg'), radius: 27, score: 5, tint: '#b5d7ff', pop: 0.18 },
    { level: 3, name: '并肩', image: characterImage('level-03.jpg'), radius: 32, score: 10, tint: '#c7c0ff', pop: 0.19 },
    { level: 4, name: '默契', image: characterImage('level-04.jpg'), radius: 38, score: 18, tint: '#e0b9ff', pop: 0.2 },
    { level: 5, name: '心动', image: characterImage('level-05.jpg'), radius: 45, score: 30, tint: '#ffb4d1', pop: 0.21 },
    { level: 6, name: '热烈', image: characterImage('level-06.jpg'), radius: 52, score: 48, tint: '#ffb0a0', pop: 0.22 },
    { level: 7, name: '坚定', image: characterImage('level-07.jpg'), radius: 60, score: 75, tint: '#ffc477', pop: 0.23 },
    { level: 8, name: '灿烂', image: characterImage('level-08.jpg'), radius: 68, score: 115, tint: '#ffe58e', pop: 0.24 },
    { level: 9, name: '默契满格', image: characterImage('level-09.jpg'), radius: 76, score: 170, tint: '#c8f3b2', pop: 0.25 },
    { level: 10, name: '闪耀', image: characterImage('level-10.jpg'), radius: 85, score: 250, tint: '#95f0d2', pop: 0.26 },
    { level: 11, name: '我们的故事', image: characterImage('level-11.jpg'), radius: 95, score: 380, tint: '#8dd6ff', pop: 0.3 }
  ],
  previewLevels: [1, 2, 3, 4],
  maxDropLevel: 4
};

export const getLevelConfig = (level) => GAME_CONFIG.levels[level - 1];
