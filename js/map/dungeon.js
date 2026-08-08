/** 按楼层配置生成地牢地图与刷怪 */

import { EXIT, FLOOR, WALL, createDungeonShell, canWalk } from "./island15.js?v=176";
import { getFloorDef, MAX_MOB_COUNT } from "./floors.js?v=176";
import { buildFloorMask } from "./shapes.js?v=176";
import { createPatrolMonster } from "../monsters/slime.js?v=176";
import { createBoss, createFoolHiddenBoss } from "../monsters/boss.js?v=176";
import { pickTrashType } from "../monsters/roster.js?v=176";

function key(x, y) {
  return `${x},${y}`;
}

function walkablePlayCells(map, def) {
  const cells = [];
  for (let y = 0; y < map.playRows; y++) {
    for (let x = 0; x < map.playCols; x++) {
      const t = map.tiles[map.oy + y][map.ox + x];
      if (t !== FLOOR) continue;
      if (x === def.spawn.x && y === def.spawn.y) continue;
      if (def.entrance && x === def.entrance.x && y === def.entrance.y) continue;
      if (x === def.exit.x && y === def.exit.y) continue;
      if (x === def.boss.x && y === def.boss.y) continue;
      cells.push({ x, y });
    }
  }
  return cells;
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function isFloorPlay(map, x, y) {
  if (x < 0 || y < 0 || x >= map.playCols || y >= map.playRows) return false;
  return map.tiles[map.oy + y][map.ox + x] === FLOOR;
}

/** 在附近找短巡逻终点（必须同在陆地上） */
function patrolEnd(map, def, from, taken) {
  const dirs = [
    [1, 0], [-1, 0], [0, 1], [0, -1],
    [2, 0], [-2, 0], [0, 2], [0, -2],
    [3, 0], [0, 3],
  ];
  for (const [dx, dy] of dirs) {
    const x = from.x + dx;
    const y = from.y + dy;
    if (!isFloorPlay(map, x, y)) continue;
    if (x === def.spawn.x && y === def.spawn.y) continue;
    if (def.entrance && x === def.entrance.x && y === def.entrance.y) continue;
    if (x === def.exit.x && y === def.exit.y) continue;
    if (x === def.boss.x && y === def.boss.y) continue;
    const k = key(x, y);
    if (taken.has(k)) continue;
    return { x, y };
  }
  return { ...from };
}

export function buildFloor(floorNum, opts = {}) {
  const loop = Math.max(0, Math.floor(opts.loop || 0));
  const def = getFloorDef(floorNum, loop);
  const mask = buildFloorMask(def);
  const map = createDungeonShell(def, mask);

  const cells = shuffle(walkablePlayCells(map, def));
  const taken = new Set();
  const monsters = [];
  const count = Math.min(def.mobCount, MAX_MOB_COUNT);

  for (let i = 0; i < count && i < cells.length; i++) {
    const from = cells[i];
    taken.add(key(from.x, from.y));
    const to = patrolEnd(map, def, from, taken);
    taken.add(key(to.x, to.y));
    const kind = pickTrashType(def.combatFloor || def.floor);
    monsters.push(
      createPatrolMonster(kind, {
        from,
        to,
        ox: map.ox,
        oy: map.oy,
        scale: def.scale,
        floor: def.floor,
        combatFloor: def.combatFloor || def.floor,
      })
    );
  }

  monsters.push(
    createBoss({
      pos: def.boss,
      ox: map.ox,
      oy: map.oy,
      scale: def.scale,
      floor: def.floor,
      combatFloor: def.combatFloor || def.floor,
    })
  );

  // 隐藏花坛 / 墙内 Boss（点击花坛后打通并生成）
  if (def.flowerBed && def.secretBoss && def.secretPath?.length) {
    map.floor = def.floor;
    map.flowerBed = {
      x: map.ox + def.flowerBed.x,
      y: map.oy + def.flowerBed.y,
    };
    map.secretBossPlay = { ...def.secretBoss };
    map.secretPathPlay = def.secretPath.map((p) => ({ ...p }));
    map.secretOpened = false;
    map.combatFloor = def.combatFloor || def.floor;
    // 密道格：海湾/墙外保持原样（多为海），不提前砌墙露馅；若误落在地板上则先封死
    const fx = map.flowerBed.x;
    const fy = map.flowerBed.y;
    if (map.tiles[fy]?.[fx] != null) map.tiles[fy][fx] = FLOOR;
    for (const p of map.secretPathPlay) {
      const ax = map.ox + p.x;
      const ay = map.oy + p.y;
      const t = map.tiles[ay]?.[ax];
      if (t === FLOOR) map.tiles[ay][ax] = WALL;
    }
  } else {
    map.floor = def.floor;
    map.combatFloor = def.combatFloor || def.floor;
  }

  return {
    map,
    monsters,
    floor: def.floor,
    combatFloor: def.combatFloor || def.floor,
    loop: def.loop || 0,
    name: def.name,
    scale: def.scale,
    exitPlay: { ...def.exit },
    bossPlay: { ...def.boss },
  };
}

/** 点击花坛：打通密道并刷出隐藏 Boss */
export function openFloorSecret(map, monsters, defScale = 1) {
  if (!map?.flowerBed || map.secretOpened) return null;
  digFloorSecretPath(map);
  const pos = map.secretBossPlay || (map.secretPathPlay || []).slice(-1)[0];
  if (!pos) return null;
  const boss = createFoolHiddenBoss({
    pos,
    ox: map.ox,
    oy: map.oy,
    scale: defScale,
    floor: map.floor || 14,
    combatFloor: map.combatFloor || map.floor || 14,
  });
  monsters.push(boss);
  return boss;
}

/** 读档：已开过密道则只打通路径、去掉花坛，不重复刷怪 */
export function digFloorSecretPath(map) {
  if (!map) return;
  map.secretOpened = true;
  const path = map.secretPathPlay || [];
  for (const p of path) {
    const ax = map.ox + p.x;
    const ay = map.oy + p.y;
    if (map.tiles[ay]?.[ax] != null) map.tiles[ay][ax] = FLOOR;
  }
  map.flowerBed = null;
}

export function isExitTile(map, x, y) {
  return (
    x >= 0 &&
    y >= 0 &&
    x < map.cols &&
    y < map.rows &&
    map.tiles[y][x] === EXIT
  );
}

export { canWalk, EXIT };
