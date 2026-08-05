/** 按楼层配置生成地牢地图与刷怪 */

import { EXIT, FLOOR, createDungeonShell, canWalk } from "./island15.js?v=76";
import { getFloorDef, MAX_MOB_COUNT } from "./floors.js?v=76";
import { buildFloorMask } from "./shapes.js?v=76";
import { createPatrolMonster } from "../monsters/slime.js?v=76";
import { createBoss } from "../monsters/boss.js?v=76";
import { pickTrashType } from "../monsters/roster.js?v=76";

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

export function buildFloor(floorNum) {
  const def = getFloorDef(floorNum);
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
    const kind = pickTrashType(def.floor);
    monsters.push(
      createPatrolMonster(kind, {
        from,
        to,
        ox: map.ox,
        oy: map.oy,
        scale: def.scale,
        floor: def.floor,
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
    })
  );

  return {
    map,
    monsters,
    floor: def.floor,
    name: def.name,
    scale: def.scale,
    exitPlay: { ...def.exit },
    bossPlay: { ...def.boss },
  };
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
