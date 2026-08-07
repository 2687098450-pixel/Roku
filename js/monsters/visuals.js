import { APP_VERSION } from "../core/version.js?v=140";

/**
 * 怪物外观资源（内部配置，不暴露到游戏 UI）
 *
 * USE_MONSTER_IMAGES = false → 一律彩色方块（默认；按种类用不同颜色/圆角区分）
 * USE_MONSTER_IMAGES = true  → 有图的种类从 assets/monsters/ 加载图片，无图仍回退方块
 */

/** 内部开关：改这里即可切换方块 / 图片 */
export const USE_MONSTER_IMAGES = true;

/** 图片文件名（相对 assets/monsters/）；未列出的种类始终用方块 */
export const MONSTER_IMAGE_FILES = {
  slime: "slime.png",
  bat: "bat.png",
  goblin: "goblin.png",
  mushroom: "mushroom.png",
  golem: "golem.png",
  wisp: "wisp.png",
  skeleton: "skeleton.png",
  spider: "spider.png",
  wolf: "wolf.png",
  harpy: "harpy.png",
  knight: "knight.png",
  mage: "mage.png",
  ogre: "ogre.png",
  shadow: "shadow.png",
  frost: "frost.png",
  demon: "demon.png",
  dragon: "dragon.png",
  boss: "boss.png",
  boss_sun: "boss_sun.png",
  boss_sand: "boss_sand.png",
  boss_tide: "boss_tide.png",
  boss_harbor: "boss_harbor.png",
  boss_mist: "boss_mist.png",
  boss_reef: "boss_reef.png",
  boss_dual: "boss_dual.png",
  boss_ruin: "boss_ruin.png",
  boss_saw: "boss_saw.png",
  boss_claw: "boss_claw.png",
};

/** 方块圆角（px）：无图时用圆角差异辅助辨认种类 */
export const MONSTER_SQUARE_RADIUS = {
  slime: 12,
  bat: 6,
  goblin: 5,
  mushroom: 14,
  golem: 3,
  wisp: 16,
  skeleton: 4,
  spider: 8,
  wolf: 7,
  harpy: 10,
  knight: 2,
  mage: 11,
  ogre: 3,
  shadow: 9,
  frost: 13,
  demon: 5,
  dragon: 4,
  boss: 8,
  boss_sun: 8,
  boss_sand: 6,
  boss_tide: 10,
  boss_harbor: 5,
  boss_mist: 12,
  boss_reef: 11,
  boss_dual: 3,
  boss_ruin: 4,
  boss_saw: 7,
  boss_claw: 6,
};

const IMAGE_BASE = new URL("../../assets/monsters/", import.meta.url).href;
const _imgCache = new Map();
let _preloadPromise = null;

export function monsterKindOf(unit) {
  if (!unit) return "slime";
  const k = unit.kind || unit.type || "";
  if (k && MONSTER_IMAGE_FILES[k]) return k;
  if (unit.isBoss || k === "boss" || String(k).startsWith("boss_")) return "boss";
  return k || "slime";
}

export function monsterImageUrl(kind) {
  const file = MONSTER_IMAGE_FILES[kind];
  if (!file) return null;
  const url = new URL(file, IMAGE_BASE);
  url.searchParams.set("v", APP_VERSION);
  return url.href;
}

/** 当前是否应对该种类画图（开关开且有登记文件） */
export function useMonsterImage(kind) {
  return Boolean(USE_MONSTER_IMAGES && MONSTER_IMAGE_FILES[kind]);
}

export function monsterSquareRadius(kind) {
  return MONSTER_SQUARE_RADIUS[kind] ?? 8;
}

/**
 * 战斗 / DOM 用：方块或图片
 * @returns {{ className: string, style: string, inner: string }}
 */
export function monsterShapeDomProps(unit) {
  const kind = monsterKindOf(unit);
  const color = unit?.color || "#888";
  const radius = monsterSquareRadius(kind);
  if (useMonsterImage(kind)) {
    const url = monsterImageUrl(kind);
    return {
      className: "monster-art-wrap",
      style: "",
      inner: `<img class="monster-art" src="${url}" alt="" draggable="false" decoding="async" />`,
    };
  }
  return {
    className: "square",
    style: `--c:${color};--mr:${radius}px`,
    inner: "",
  };
}

export function getMonsterImage(kind) {
  return _imgCache.get(kind) || null;
}

function loadOne(kind, src) {
  return new Promise((resolve) => {
    const existing = _imgCache.get(kind);
    if (existing?.complete && existing.naturalWidth) {
      resolve(existing);
      return;
    }
    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      _imgCache.set(kind, img);
      resolve(img);
    };
    img.onerror = () => resolve(null);
    img.src = src;
    _imgCache.set(kind, img);
  });
}

/** 预加载已登记图片（开关关闭时直接 resolve） */
export function preloadMonsterImages() {
  if (!USE_MONSTER_IMAGES) return Promise.resolve();
  if (_preloadPromise) return _preloadPromise;
  const jobs = Object.keys(MONSTER_IMAGE_FILES).map((kind) => {
    const url = monsterImageUrl(kind);
    return url ? loadOne(kind, url) : Promise.resolve(null);
  });
  _preloadPromise = Promise.all(jobs).then(() => undefined);
  return _preloadPromise;
}

/**
 * 地图 canvas：有图且已加载则画图，否则画彩色方块
 */
export function drawMonsterSprite(ctx, cx, cy, size, unit) {
  const kind = monsterKindOf(unit);
  if (useMonsterImage(kind)) {
    const img = getMonsterImage(kind);
    if (img?.complete && img.naturalWidth > 0) {
      drawMonsterImage(ctx, cx, cy, size, img, unit?.isBoss);
      return;
    }
  }
  drawMonsterSquare(ctx, cx, cy, size, unit?.color || "#888", monsterSquareRadius(kind));
}

function drawMonsterImage(ctx, cx, cy, size, img, isBoss) {
  // 与旧 Boss 贴图倍率对齐；Boss 再略放大由外层 size 承担
  const s = size * 1.7;
  ctx.save();
  ctx.translate(cx, cy);
  const x = -s / 2;
  const y = -s / 2;
  // 直接贴图，不加外框白边
  ctx.drawImage(img, x, y, s, s);
  ctx.restore();
}

export function drawMonsterSquare(ctx, cx, cy, size, color, radiusPx = 8) {
  const s = size * 1.5;
  const r = Math.min(radiusPx, s / 2);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 10;
  ctx.beginPath();
  roundRectPath(ctx, -s / 2, -s / 2, s, s, r);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "rgba(255,255,255,0.75)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.28)";
  ctx.fillRect(-s / 2 + 3, -s / 2 + 3, s * 0.35, 4);
  ctx.restore();
}

function roundRectPath(ctx, x, y, w, h, r) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}
