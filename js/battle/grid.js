/**
 * 流畅模式棋盘：敌我统一 3×6 格
 *
 * y: 敌后0 敌中1 敌前2 | 我前3 我中4 我后5（开战初始）
 * 流畅可穿场走位；距离用切比雪夫（王步）
 * boardX/boardY 为坐标源；row/col 仅作初始与 UI 回写
 */

export const BOARD_COLS = 3;

const ENEMY_Y = { back: 0, mid: 1, front: 2 };
const ALLY_Y = { front: 3, mid: 4, back: 5 };
const Y_TO_ROW = {
  0: "back",
  1: "mid",
  2: "front",
  3: "front",
  4: "mid",
  5: "back",
};

/** 战场 6 行对应的 DOM 巷道（上敌下我） */
export const BOARD_LANE_IDS = [
  "enemyBack",
  "enemyMid",
  "enemyFront",
  "allyFront",
  "allyMid",
  "allyBack",
];

export function isHeroUnit(unit) {
  return !!(unit && (unit.isHero || unit.side === "ally"));
}

/** 由阵型 row/col 写入 board 坐标（开战时） */
export function syncBoardPosFromRowCol(unit) {
  if (!unit) return { x: 1, y: 3 };
  const x = Math.max(0, Math.min(2, Number(unit.col) || 0));
  const row = unit.row || "front";
  const y = isHeroUnit(unit) ? ALLY_Y[row] ?? 3 : ENEMY_Y[row] ?? 2;
  unit.boardX = x;
  unit.boardY = y;
  unit.col = x;
  return { x, y };
}

export function boardXY(unit) {
  if (!unit) return { x: 1, y: 3 };
  if (unit.boardX != null && unit.boardY != null) {
    return {
      x: Math.max(0, Math.min(2, Math.floor(Number(unit.boardX)))),
      y: Math.max(0, Math.min(5, Math.floor(Number(unit.boardY)))),
    };
  }
  return syncBoardPosFromRowCol(unit);
}

export function applyBoardXY(unit, x, y) {
  if (!unit) return;
  const bx = Math.max(0, Math.min(2, x));
  const by = Math.max(0, Math.min(5, y));
  unit.boardX = bx;
  unit.boardY = by;
  unit.col = bx;
  const row = Y_TO_ROW[by];
  if (row) unit.row = row;
}

export function sideYBounds(unit, opts = {}) {
  if (opts.fullBoard) return { min: 0, max: 5 };
  return isHeroUnit(unit) ? { min: 3, max: 5 } : { min: 0, max: 2 };
}

/** 切比雪夫距离 */
export function boardDist(a, b) {
  const pa = boardXY(a);
  const pb = boardXY(b);
  return Math.max(Math.abs(pa.x - pb.x), Math.abs(pa.y - pb.y));
}

export function chebyshev(x0, y0, x1, y1) {
  return Math.max(Math.abs(x0 - x1), Math.abs(y0 - y1));
}

/** 技能攻击距离：可写 def.range；否则近战1 / 远程2 */
export function skillAttackRange(def) {
  if (!def) return 1;
  if (def.range != null) return Math.max(0, Math.floor(Number(def.range) || 0));
  if (def.style === "heal") return 3;
  if (def.style === "buff") return 2;
  if (def.style === "melee") return 1;
  return 2;
}

/**
 * 流畅模式溅射半径：可写 def.aoeRadius
 * 旧前排/十字等旗标映射为半径
 */
export function skillAoeRadius(def) {
  if (!def) return 0;
  if (def.aoeRadius != null) return Math.max(0, Math.floor(Number(def.aoeRadius) || 0));
  if (def.hitAll) return 2;
  if (def.hitAllFront || def.hitFront) return 1;
  if (def.hitCross || def.hitRow || def.hitCol) return 1;
  if (def.stunGauge != null || def.stunTurns != null) return 1;
  return 0;
}

/** 范围内单位（含中心） */
export function unitsInRadius(units, center, radius) {
  if (!center || !(radius >= 0)) return [];
  const r = Math.max(0, Math.floor(radius));
  return (units || []).filter((u) => u && u.hp > 0 && boardDist(center, u) <= r);
}

/**
 * 命中人数 → 单体伤害系数（人数越多越薄）
 * 1→1.00  2→0.75  3→0.62  4→0.55 …
 */
export function splashDamageScale(hitCount) {
  const n = Math.max(1, Math.floor(hitCount || 1));
  if (n <= 1) return 1;
  return Math.max(0.4, 1 / Math.sqrt(n));
}

export function occupiedKeySet(units) {
  const set = new Set();
  for (const u of units || []) {
    if (!u || u.hp <= 0) continue;
    const { x, y } = boardXY(u);
    set.add(`${x},${y}`);
  }
  return set;
}

/** 向目标走近一格（不叠人）；flow 可传 fullBoard 穿场 */
export function stepUnitToward(mover, target, allUnits, opts = {}) {
  if (!mover || !target || mover.hp <= 0) return false;
  const from = boardXY(mover);
  const goal = boardXY(target);
  const curDist = chebyshev(from.x, from.y, goal.x, goal.y);
  if (curDist <= 0) return false;

  const bounds = sideYBounds(mover, opts);
  const occ = occupiedKeySet(allUnits);
  occ.delete(`${from.x},${from.y}`);

  let best = null;
  let bestDist = curDist;
  let bestTie = Infinity;

  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = from.x + dx;
      const ny = from.y + dy;
      if (nx < 0 || nx > 2 || ny < bounds.min || ny > bounds.max) continue;
      if (occ.has(`${nx},${ny}`)) continue;
      const d = chebyshev(nx, ny, goal.x, goal.y);
      if (d > bestDist) continue;
      const tie = Math.abs(ny - goal.y) * 10 + Math.abs(nx - goal.x);
      if (d < bestDist || (d === bestDist && tie < bestTie)) {
        bestDist = d;
        bestTie = tie;
        best = { x: nx, y: ny };
      }
    }
  }

  if (!best || bestDist >= curDist) return false;
  applyBoardXY(mover, best.x, best.y);
  return true;
}

/** 最近单位（同距离取血量更低） */
export function pickNearestUnit(from, list) {
  if (!from || !list?.length) return null;
  return list
    .slice()
    .sort((a, b) => {
      const da = boardDist(from, a);
      const db = boardDist(from, b);
      return da - db || a.hp / a.maxHp - b.hp / b.maxHp || a.hp - b.hp;
    })[0];
}

export function unitsInAttackRange(from, list, range) {
  const r = Math.max(0, Math.floor(range || 0));
  return (list || []).filter((u) => u && u.hp > 0 && boardDist(from, u) <= r);
}

export function flowAoeLabel(radius) {
  const r = Math.max(0, Math.floor(radius || 0));
  if (r <= 0) return "单体";
  return `半径${r}`;
}
