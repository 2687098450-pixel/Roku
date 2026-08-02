/**
 * 地牢外形生成：返回玩法坐标下的可走格集合 Set("x,y")
 * bbox 仍为 playCols × playRows，外形外的格会变成海洋，形成非矩形岛屿
 */

function key(x, y) {
  return `${x},${y}`;
}

function addRect(set, x0, y0, w, h, cols, rows) {
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) {
      if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
      set.add(key(x, y));
    }
  }
}

/** 矩形（默认） */
export function shapeRect(cols, rows) {
  const set = new Set();
  addRect(set, 0, 0, cols, rows, cols, rows);
  return set;
}

/** L 形 */
export function shapeL(cols, rows) {
  const set = new Set();
  const armW = Math.max(3, Math.floor(cols * 0.45));
  const armH = Math.max(3, Math.floor(rows * 0.45));
  addRect(set, 0, 0, armW, rows, cols, rows);
  addRect(set, 0, rows - armH, cols, armH, cols, rows);
  return set;
}

/** T 形 */
export function shapeT(cols, rows) {
  const set = new Set();
  const barH = Math.max(3, Math.floor(rows * 0.35));
  const stemW = Math.max(3, Math.floor(cols * 0.34));
  const stemX = Math.floor((cols - stemW) / 2);
  addRect(set, 0, 0, cols, barH, cols, rows);
  addRect(set, stemX, barH - 1, stemW, rows - barH + 1, cols, rows);
  return set;
}

/** U 形 */
export function shapeU(cols, rows) {
  const set = new Set();
  const thick = Math.max(3, Math.floor(Math.min(cols, rows) * 0.28));
  addRect(set, 0, 0, thick, rows, cols, rows);
  addRect(set, cols - thick, 0, thick, rows, cols, rows);
  addRect(set, 0, rows - thick, cols, thick, cols, rows);
  return set;
}

/** 十字 */
export function shapeCross(cols, rows) {
  const set = new Set();
  const vw = Math.max(3, Math.floor(cols * 0.32));
  const hh = Math.max(3, Math.floor(rows * 0.32));
  const vx = Math.floor((cols - vw) / 2);
  const hy = Math.floor((rows - hh) / 2);
  addRect(set, vx, 0, vw, rows, cols, rows);
  addRect(set, 0, hy, cols, hh, cols, rows);
  return set;
}

/** 环形（中间挖空，一侧留通道） */
export function shapeRing(cols, rows) {
  const set = shapeRect(cols, rows);
  const m = Math.max(2, Math.floor(Math.min(cols, rows) * 0.22));
  for (let y = m; y < rows - m; y++) {
    for (let x = m; x < cols - m; x++) {
      // 右侧留通道
      if (x >= cols - m - 1) continue;
      set.delete(key(x, y));
    }
  }
  return set;
}

/** 双厅 + 走廊 */
export function shapeTwinHall(cols, rows) {
  const set = new Set();
  const roomW = Math.max(4, Math.floor(cols * 0.38));
  const roomH = Math.max(4, Math.floor(rows * 0.7));
  const y0 = Math.floor((rows - roomH) / 2);
  addRect(set, 0, y0, roomW, roomH, cols, rows);
  addRect(set, cols - roomW, y0, roomW, roomH, cols, rows);
  const cy = Math.floor(rows / 2);
  addRect(set, roomW - 1, cy - 1, cols - roomW * 2 + 2, 3, cols, rows);
  return set;
}

/** 阶梯 / 对角退台 */
export function shapeSteps(cols, rows) {
  const set = new Set();
  for (let y = 0; y < rows; y++) {
    const start = Math.floor((y / rows) * (cols * 0.45));
    const end = cols - Math.floor(((rows - 1 - y) / rows) * (cols * 0.25));
    for (let x = start; x < end; x++) set.add(key(x, y));
  }
  return set;
}

/** 锯齿海湾：椭圆主体 + 边缘缺口 */
export function shapeBay(cols, rows) {
  const set = new Set();
  const cx = (cols - 1) / 2;
  const cy = (rows - 1) / 2;
  const rx = cols * 0.48;
  const ry = rows * 0.48;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const nx = (x - cx) / rx;
      const ny = (y - cy) / ry;
      let inside = nx * nx + ny * ny <= 1;
      // 挖几个海湾
      if (x > cols * 0.55 && y < rows * 0.35) inside = false;
      if (x < cols * 0.3 && y > rows * 0.65) inside = false;
      if (inside) set.add(key(x, y));
    }
  }
  return set;
}

/** 蜿蜒蛇形带 */
export function shapeSnake(cols, rows) {
  const set = new Set();
  const thick = Math.max(3, Math.floor(rows * 0.36));
  for (let x = 0; x < cols; x++) {
    const wave = Math.sin((x / Math.max(1, cols - 1)) * Math.PI * 2) * (rows * 0.22);
    const mid = rows / 2 + wave;
    const y0 = Math.max(0, Math.floor(mid - thick / 2));
    const y1 = Math.min(rows, Math.ceil(mid + thick / 2));
    for (let y = y0; y < y1; y++) set.add(key(x, y));
  }
  return set;
}

/** 三岔 / 爪形 */
export function shapeClaw(cols, rows) {
  const set = new Set();
  const hub = Math.max(3, Math.floor(Math.min(cols, rows) * 0.3));
  const hx = Math.floor(cols * 0.35);
  const hy = Math.floor(rows * 0.35);
  addRect(set, hx, hy, hub, hub, cols, rows);
  // 三臂
  addRect(set, 0, hy + 1, hx + 1, Math.max(3, hub - 2), cols, rows);
  addRect(set, hx + 1, 0, Math.max(3, hub - 2), hy + 1, cols, rows);
  addRect(set, hx + hub - 2, hy + 1, cols - (hx + hub - 2), Math.max(3, hub - 2), cols, rows);
  return set;
}

const SHAPES = {
  rect: shapeRect,
  L: shapeL,
  T: shapeT,
  U: shapeU,
  cross: shapeCross,
  ring: shapeRing,
  twin: shapeTwinHall,
  steps: shapeSteps,
  bay: shapeBay,
  snake: shapeSnake,
  claw: shapeClaw,
};

export function buildFloorMask(def) {
  const cols = def.playCols;
  const rows = def.playRows;
  const fn = SHAPES[def.shape] || shapeRect;
  const set = fn(cols, rows);
  // 确保出生点 / 入口 / 出口 / Boss 一定在岛上
  for (const p of [def.spawn, def.entrance, def.exit, def.boss]) {
    if (p) set.add(key(p.x, p.y));
  }
  return set;
}

export function maskHas(mask, x, y) {
  return mask.has(key(x, y));
}
