/** 地牢 / 岛屿地图：可走地板 + 围墙 + 外圈海洋 + 出口；探索时按相机视野裁剪绘制 */

import {
  preloadMonsterImages,
  drawMonsterSprite,
} from "../monsters/visuals.js?v=106";

export { preloadMonsterImages };

export const PLAY_COLS = 10;
export const PLAY_ROWS = 8;
export const OCEAN = 0;
export const WALL = 1;
export const FLOOR = 2;
export const EXIT = 3;
/** 入口台阶（来自上一层）；人物站在外侧 spawn */
export const ENTRANCE = 4;
/** 内陆水池：不可通行，装饰用 */
export const WATER = 5;
/** 礁石 / 碎岩：不可通行 */
export const ROCK = 6;
export const OX = 2;
export const OY = 2;
export const COLS = PLAY_COLS + OX * 2;
export const ROWS = PLAY_ROWS + OY * 2;

/** 屏幕宽度固定显示多少格（正方形地砖） */
export const VIEW_COLS = 6;

/**
 * 按楼层配置生成地图壳
 * def: { playCols, playRows, spawn, exit, walls[], water[], rocks[], shape, name, floor }
 * 非矩形外形：外形外为海洋，海岸线自动铺沙墙
 * 通往出口只保留「Boss 格」这一条通路，不封死整圈陆地边缘
 */
export function createDungeonShell(def, mask = null) {
  const playCols = def.playCols || PLAY_COLS;
  const playRows = def.playRows || PLAY_ROWS;
  const ox = OX;
  const oy = OY;
  const cols = playCols + ox * 2;
  const rows = playRows + oy * 2;
  const tiles = Array.from({ length: rows }, () => Array(cols).fill(OCEAN));

  const land = mask || (() => {
    const s = new Set();
    for (let y = 0; y < playRows; y++) {
      for (let x = 0; x < playCols; x++) s.add(`${x},${y}`);
    }
    return s;
  })();

  const has = (px, py) => land.has(`${px},${py}`);
  const dirs4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  for (let py = 0; py < playRows; py++) {
    for (let px = 0; px < playCols; px++) {
      if (!has(px, py)) continue;
      tiles[oy + py][ox + px] = FLOOR;
    }
  }

  for (const w of def.walls || []) {
    if (!has(w.x, w.y)) continue;
    tiles[oy + w.y][ox + w.x] = WALL;
  }

  // 海岸沙墙：与陆地相邻的海洋格
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (tiles[y][x] !== OCEAN) continue;
      for (const [dx, dy] of dirs4) {
        const t = tiles[y + dy]?.[x + dx];
        if (t === FLOOR || t === WALL) {
          tiles[y][x] = WALL;
          break;
        }
      }
    }
  }

  function applyAlcove(playPos, dir) {
    if (!playPos || !dir) return;
    const { x: px, y: py } = playPos;
    const niche = [];
    if (dir === "e" || dir === "w") {
      niche.push({ x: px, y: py - 1 }, { x: px, y: py + 1 });
    } else if (dir === "n" || dir === "s") {
      niche.push({ x: px - 1, y: py }, { x: px + 1, y: py });
    }
    for (const c of niche) {
      if (c.x < 0 || c.y < 0 || c.x >= playCols || c.y >= playRows) continue;
      tiles[oy + c.y][ox + c.x] = WALL;
    }
  }

  // 入口 / 出口壁龛：两侧夹墙，台阶嵌入墙体
  applyAlcove(def.entrance, def.entranceAlcove || null);
  applyAlcove(def.exit, def.exitAlcove || null);

  const protectedPlay = new Set();
  for (const p of [def.spawn, def.entrance, def.exit, def.boss]) {
    if (p) protectedPlay.add(`${p.x},${p.y}`);
  }

  // 少量装饰障碍（可选）；不拿来封出口
  for (const c of def.water || []) {
    if (!has(c.x, c.y)) continue;
    if (protectedPlay.has(`${c.x},${c.y}`)) continue;
    const t = tiles[oy + c.y][ox + c.x];
    if (t === FLOOR) tiles[oy + c.y][ox + c.x] = WATER;
  }
  for (const c of def.rocks || []) {
    if (!has(c.x, c.y)) continue;
    if (protectedPlay.has(`${c.x},${c.y}`)) continue;
    const t = tiles[oy + c.y][ox + c.x];
    if (t === FLOOR) tiles[oy + c.y][ox + c.x] = ROCK;
  }

  // 唯一出口：清掉其它 EXIT，再盖回配置出口
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (tiles[y][x] === EXIT) tiles[y][x] = FLOOR;
    }
  }

  const ex = ox + def.exit.x;
  const ey = oy + def.exit.y;
  tiles[ey][ex] = EXIT;

  let enx = null;
  let eny = null;
  if (def.entrance) {
    enx = ox + def.entrance.x;
    eny = oy + def.entrance.y;
    if (!(enx === ex && eny === ey)) tiles[eny][enx] = ENTRANCE;
  }

  const sx = ox + def.spawn.x;
  const sy = oy + def.spawn.y;
  const spawnTile = tiles[sy][sx];
  if (spawnTile !== EXIT && spawnTile !== ENTRANCE) tiles[sy][sx] = FLOOR;

  const bx = ox + def.boss.x;
  const by = oy + def.boss.y;
  if (tiles[by]?.[bx] != null && tiles[by][bx] !== EXIT && tiles[by][bx] !== ENTRANCE) {
    tiles[by][bx] = FLOOR;
  }

  // 出口四邻只留 Boss 格可走：通往出口只有这一条路
  sealExitBossGate(tiles, cols, rows, { x: ex, y: ey }, { x: bx, y: by });

  // 先保证能走到 Boss；再重封出口，避免挖路把旁路又挖开
  ensurePath(tiles, cols, rows, { x: sx, y: sy }, { x: bx, y: by });
  sealExitBossGate(tiles, cols, rows, { x: ex, y: ey }, { x: bx, y: by });
  // Boss → 出口相邻即可；若被误封则强制 Boss 为地板
  tiles[by][bx] = FLOOR;
  tiles[ey][ex] = EXIT;

  return {
    id: `floor_${def.floor || 1}`,
    name: def.name || "地牢",
    floor: def.floor || 1,
    shape: def.shape || "rect",
    tiles,
    cols,
    rows,
    playCols,
    playRows,
    ox,
    oy,
    spawn: { x: sx, y: sy },
    exit: { x: ex, y: ey },
    entrance: enx != null ? { x: enx, y: eny } : null,
    boss: { x: bx, y: by },
  };
}

/**
 * 出口正交相邻格全部封墙，只保留 Boss 所在格为地板。
 * 这样进出口在几何上只有一条路，且必经 Boss。
 */
function sealExitBossGate(tiles, cols, rows, exitAbs, bossAbs) {
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (const [dx, dy] of dirs) {
    const nx = exitAbs.x + dx;
    const ny = exitAbs.y + dy;
    if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
    if (nx === bossAbs.x && ny === bossAbs.y) {
      if (tiles[ny][nx] !== EXIT && tiles[ny][nx] !== ENTRANCE) {
        tiles[ny][nx] = FLOOR;
      }
      continue;
    }
    const t = tiles[ny][nx];
    if (t === OCEAN || t === EXIT || t === ENTRANCE) continue;
    tiles[ny][nx] = WALL;
  }
}

function tilePassableForPath(t) {
  return t === FLOOR || t === ENTRANCE || t === EXIT;
}

/** BFS：不通则把路上的墙/水/礁挖成地板（不改入口出口格） */
function ensurePath(tiles, cols, rows, from, to) {
  const key = (x, y) => `${x},${y}`;
  const inb = (x, y) => x >= 0 && y >= 0 && x < cols && y < rows;
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  function reachable() {
    const q = [from];
    const seen = new Set([key(from.x, from.y)]);
    while (q.length) {
      const cur = q.shift();
      if (cur.x === to.x && cur.y === to.y) return true;
      for (const [dx, dy] of dirs) {
        const nx = cur.x + dx;
        const ny = cur.y + dy;
        if (!inb(nx, ny)) continue;
        const k = key(nx, ny);
        if (seen.has(k)) continue;
        if (!tilePassableForPath(tiles[ny][nx])) continue;
        seen.add(k);
        q.push({ x: nx, y: ny });
      }
    }
    return false;
  }

  if (reachable()) return;

  // 允许穿过墙/水/礁做寻路，再挖通
  const q = [{ x: from.x, y: from.y }];
  const seen = new Set([key(from.x, from.y)]);
  const prev = new Map();
  let found = false;
  while (q.length) {
    const cur = q.shift();
    if (cur.x === to.x && cur.y === to.y) {
      found = true;
      break;
    }
    for (const [dx, dy] of dirs) {
      const nx = cur.x + dx;
      const ny = cur.y + dy;
      if (!inb(nx, ny)) continue;
      const t = tiles[ny][nx];
      if (t === OCEAN) continue;
      const k = key(nx, ny);
      if (seen.has(k)) continue;
      seen.add(k);
      prev.set(k, cur);
      q.push({ x: nx, y: ny });
    }
  }
  if (!found) return;
  let cur = { ...to };
  while (!(cur.x === from.x && cur.y === from.y)) {
    const t = tiles[cur.y][cur.x];
    if (t !== EXIT && t !== ENTRANCE && t !== FLOOR) {
      tiles[cur.y][cur.x] = FLOOR;
    }
    const p = prev.get(key(cur.x, cur.y));
    if (!p) break;
    cur = p;
  }
}

/** 兼容旧接口：第 1 层默认岛 */
export function createIsland15() {
  const def = {
    floor: 1,
    name: "阳光海岛",
    shape: "rect",
    playCols: PLAY_COLS,
    playRows: PLAY_ROWS,
    entrance: { x: 0, y: 3 },
    entranceAlcove: "w",
    spawn: { x: 1, y: 3 },
    exit: { x: 9, y: 4 },
    exitAlcove: "e",
    boss: { x: 8, y: 4 },
    walls: [],
  };
  const mask = new Set();
  for (let y = 0; y < def.playRows; y++) {
    for (let x = 0; x < def.playCols; x++) mask.add(`${x},${y}`);
  }
  return createDungeonShell(def, mask);
}

/** 普通可走：地板与入口。出口需由上层按 Boss 是否存活另行判断 */
export function canWalk(map, x, y) {
  if (x < 0 || y < 0 || x >= map.cols || y >= map.rows) return false;
  const t = map.tiles[y][x];
  return t === FLOOR || t === ENTRANCE;
}

export function isExitCell(map, x, y) {
  if (x < 0 || y < 0 || x >= map.cols || y >= map.rows) return false;
  if (map.tiles[y][x] !== EXIT) return false;
  // 只认配置的唯一出口坐标
  return !!map.exit && map.exit.x === x && map.exit.y === y;
}

export function isEntranceCell(map, x, y) {
  if (x < 0 || y < 0 || x >= map.cols || y >= map.rows) return false;
  return map.tiles[y][x] === ENTRANCE;
}

/** 以角色为中心算相机，贴地图边界时角色可偏离正中 */
export function computeCamera(map, playerPos, tile, viewW, viewH) {
  const T = tile;
  const pcx = playerPos.x * T + T / 2;
  const pcy = playerPos.y * T + T / 2;
  const worldW = map.cols * T;
  const worldH = map.rows * T;
  let camX = pcx - viewW / 2;
  let camY = pcy - viewH / 2;
  camX = Math.max(0, Math.min(camX, Math.max(0, worldW - viewW)));
  camY = Math.max(0, Math.min(camY, Math.max(0, worldH - viewH)));
  return { camX, camY, viewW, viewH };
}

export function screenToTile(cam, tile, localX, localY) {
  const wx = cam.camX + localX;
  const wy = cam.camY + localY;
  return {
    x: Math.floor(wx / tile),
    y: Math.floor(wy / tile),
  };
}

function drawTile(ctx, type, x, y, T, time) {
  const px = x * T;
  const py = y * T;
  if (type === OCEAN) {
    const wave = Math.sin(time * 2 + x * 0.7 + y * 0.5) * 0.04 + 1;
    ctx.fillStyle = (x + y) % 2 === 0 ? "#5ec8f0" : "#7ad7f7";
    ctx.fillRect(px, py, T + 0.5, T + 0.5);
    ctx.fillStyle = `rgba(255,255,255,${0.18 * wave})`;
    ctx.beginPath();
    if (ctx.ellipse) {
      ctx.ellipse(px + T * 0.35, py + T * 0.45, T * 0.18, T * 0.06, 0, 0, Math.PI * 2);
    } else {
      ctx.arc(px + T * 0.35, py + T * 0.45, T * 0.1, 0, Math.PI * 2);
    }
    ctx.fill();
    return;
  }
  if (type === WALL) {
    ctx.fillStyle = "#c4a574";
    ctx.fillRect(px, py, T + 0.5, T + 0.5);
    ctx.fillStyle = "#a88455";
    ctx.fillRect(px + 3, py + 3, T - 6, T - 6);
    ctx.fillStyle = "rgba(255,255,255,0.22)";
    ctx.fillRect(px + 5, py + 5, T - 10, 5);
    return;
  }
  if (type === WATER) {
    const wave = Math.sin(time * 2.2 + x * 0.9 + y * 0.6) * 0.05 + 1;
    ctx.fillStyle = (x + y) % 2 === 0 ? "#3aa7c4" : "#4db8d4";
    ctx.fillRect(px, py, T + 0.5, T + 0.5);
    ctx.fillStyle = `rgba(180, 235, 255,${0.28 * wave})`;
    ctx.beginPath();
    if (ctx.ellipse) {
      ctx.ellipse(px + T * 0.4, py + T * 0.5, T * 0.22, T * 0.08, 0, 0, Math.PI * 2);
    } else {
      ctx.arc(px + T * 0.4, py + T * 0.5, T * 0.12, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.fillStyle = "rgba(40, 120, 90, 0.35)";
    ctx.beginPath();
    ctx.arc(px + T * 0.7, py + T * 0.35, T * 0.08, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  if (type === ROCK) {
    ctx.fillStyle = "#d7c4a0";
    ctx.fillRect(px, py, T + 0.5, T + 0.5);
    ctx.fillStyle = "#8a7a68";
    ctx.beginPath();
    ctx.moveTo(px + T * 0.22, py + T * 0.7);
    ctx.lineTo(px + T * 0.38, py + T * 0.28);
    ctx.lineTo(px + T * 0.72, py + T * 0.34);
    ctx.lineTo(px + T * 0.82, py + T * 0.72);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#6e5f50";
    ctx.beginPath();
    ctx.moveTo(px + T * 0.3, py + T * 0.78);
    ctx.lineTo(px + T * 0.48, py + T * 0.48);
    ctx.lineTo(px + T * 0.62, py + T * 0.78);
    ctx.closePath();
    ctx.fill();
    return;
  }
  if (type === EXIT || type === ENTRANCE) {
    ctx.fillStyle = (x + y) % 2 === 0 ? "#fff8ea" : "#f0e4cf";
    ctx.fillRect(px, py, T + 0.5, T + 0.5);
    const stair = type === EXIT ? "#6ecbff" : "#f0b45a";
    const glow = type === EXIT ? "rgba(255, 200, 80, 0.55)" : "rgba(120, 200, 120, 0.5)";
    ctx.fillStyle = stair;
    ctx.beginPath();
    if (type === EXIT) {
      // 上行出口
      ctx.moveTo(px + T * 0.5, py + T * 0.18);
      ctx.lineTo(px + T * 0.78, py + T * 0.42);
      ctx.lineTo(px + T * 0.68, py + T * 0.42);
      ctx.lineTo(px + T * 0.68, py + T * 0.78);
      ctx.lineTo(px + T * 0.32, py + T * 0.78);
      ctx.lineTo(px + T * 0.32, py + T * 0.42);
      ctx.lineTo(px + T * 0.22, py + T * 0.42);
    } else {
      // 入口：自上层下来的台阶（倒置箭头感）
      ctx.moveTo(px + T * 0.32, py + T * 0.22);
      ctx.lineTo(px + T * 0.68, py + T * 0.22);
      ctx.lineTo(px + T * 0.68, py + T * 0.55);
      ctx.lineTo(px + T * 0.78, py + T * 0.55);
      ctx.lineTo(px + T * 0.5, py + T * 0.82);
      ctx.lineTo(px + T * 0.22, py + T * 0.55);
      ctx.lineTo(px + T * 0.32, py + T * 0.55);
    }
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = glow;
    ctx.fillRect(px + T * 0.2, py + T * 0.84, T * 0.6, T * 0.08);
    return;
  }
  // 正方形地面
  ctx.fillStyle = (x + y) % 2 === 0 ? "#fff8ea" : "#f0e4cf";
  ctx.fillRect(px, py, T + 0.5, T + 0.5);
}

/**
 * 菱形：size 为半高；aspect = 宽/高（血防越高越大，攻速越高越小）
 */
export function drawDiamond(ctx, cx, cy, size, color, aspect = 0.68) {
  const halfW = size * Math.max(0.35, Math.min(1.1, aspect));
  ctx.save();
  ctx.translate(cx, cy);
  ctx.beginPath();
  ctx.moveTo(0, -size);
  ctx.lineTo(halfW, 0);
  ctx.lineTo(0, size);
  ctx.lineTo(-halfW, 0);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 10;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "rgba(255,255,255,0.75)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

export function drawSquare(ctx, cx, cy, size, color) {
  const s = size * 1.5;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 10;
  ctx.fillRect(-s / 2, -s / 2, s, s);
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "rgba(255,255,255,0.75)";
  ctx.lineWidth = 2;
  ctx.strokeRect(-s / 2, -s / 2, s, s);
  ctx.fillStyle = "rgba(255,255,255,0.28)";
  ctx.fillRect(-s / 2 + 3, -s / 2 + 3, s * 0.35, 4);
  ctx.restore();
}

function inView(cam, T, x, y, margin = 1) {
  const left = cam.camX - margin * T;
  const top = cam.camY - margin * T;
  const right = cam.camX + cam.viewW + margin * T;
  const bottom = cam.camY + cam.viewH + margin * T;
  const px = x * T;
  const py = y * T;
  return px + T >= left && px <= right && py + T >= top && py <= bottom;
}

function segmentInView(cam, T, ax, ay, bx, by) {
  // 粗略：端点或中点任一在视野附近即画
  return (
    inView(cam, T, ax, ay, 2) ||
    inView(cam, T, bx, by, 2) ||
    inView(cam, T, (ax + bx) / 2, (ay + by) / 2, 2)
  );
}

export function drawPatrolLine(ctx, m, T) {
  ctx.strokeStyle = "rgba(255, 107, 107, 0.35)";
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 6]);
  ctx.beginPath();
  ctx.moveTo(m.from.x * T + T / 2, m.from.y * T + T / 2);
  ctx.lineTo(m.to.x * T + T / 2, m.to.y * T + T / 2);
  ctx.stroke();
  ctx.setLineDash([]);
}

/** 按相机视野绘制可见格子与单位（playerPos 可为小数用于平滑移动） */
export function drawMap(ctx, map, view, entities) {
  const {
    tile: T,
    time,
    playerPos,
    playerColor,
    playerAspect = 0.68,
    playerScale = 1,
    camX,
    camY,
    viewW,
    viewH,
  } = view;
  const logic = view.logicPos || {
    x: Math.round(playerPos.x),
    y: Math.round(playerPos.y),
  };
  const cam = { camX, camY, viewW, viewH };

  ctx.clearRect(0, 0, viewW, viewH);
  ctx.save();
  ctx.translate(-camX, -camY);

  const x0 = Math.max(0, Math.floor(camX / T) - 1);
  const y0 = Math.max(0, Math.floor(camY / T) - 1);
  const x1 = Math.min(map.cols - 1, Math.ceil((camX + viewW) / T) + 1);
  const y1 = Math.min(map.rows - 1, Math.ceil((camY + viewH) / T) + 1);

  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      drawTile(ctx, map.tiles[y][x], x, y, T, time);
    }
  }

  ctx.strokeStyle = "rgba(58, 42, 26, 0.08)";
  ctx.lineWidth = 1;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const t = map.tiles[y][x];
      if (t !== FLOOR && t !== EXIT && t !== ENTRANCE) continue;
      ctx.strokeRect(x * T + 0.5, y * T + 0.5, T, T);
    }
  }

  for (const m of entities.monsters) {
    if (m.isBoss) continue;
    if (segmentInView(cam, T, m.from.x, m.from.y, m.to.x, m.to.y)) {
      drawPatrolLine(ctx, m, T);
    }
  }

  entities.monsters.forEach((m, i) => {
    if (!inView(cam, T, m.x, m.y)) return;
    const bob = Math.sin(time * 3 + i) * 2;
    const size = m.isBoss ? T * 0.52 : T * 0.38;
    drawMonsterSprite(ctx, m.x * T + T / 2, m.y * T + T / 2 + bob, size, m);
  });

  const pbob = Math.sin(time * 3 + 1) * 2;
  drawDiamond(
    ctx,
    playerPos.x * T + T / 2,
    playerPos.y * T + T / 2 + pbob,
    T * 0.32 * playerScale,
    playerColor,
    playerAspect
  );

  const exitOpen = !!entities.exitOpen;
  ctx.fillStyle = "rgba(60, 184, 106, 0.16)";
  for (const [dx, dy] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ]) {
    const x = logic.x + dx;
    const y = logic.y + dy;
    const walk =
      canWalk(map, x, y) ||
      (exitOpen && map.tiles[y]?.[x] === EXIT);
    if (walk) ctx.fillRect(x * T + 3, y * T + 3, T - 6, T - 6);
  }

  ctx.restore();
}
