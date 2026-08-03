/**
 * 十层关卡配置
 * - entrance / entranceAlcove：入口壁龛（人物站在入口外侧 spawn）
 * - exit / exitAlcove：出口壁龛（全层唯一）
 * - walls：外形内部的额外围墙
 * - water / rocks：内陆水池 / 礁石（不可通行）
 */

export const MAX_FLOOR = 10;

const MOB_COUNTS = [3, 5, 4, 7, 9, 6, 11, 14, 12, 16];

function cellsRect(x0, y0, w, h) {
  const out = [];
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) out.push({ x, y });
  }
  return out;
}

export const FLOOR_DEFS = [
  {
    floor: 1,
    name: "阳光海岛",
    shape: "rect",
    playCols: 10,
    playRows: 8,
    entrance: { x: 0, y: 3 },
    entranceAlcove: "w",
    spawn: { x: 1, y: 3 },
    exit: { x: 9, y: 4 },
    exitAlcove: "e",
    boss: { x: 8, y: 4 },
    walls: [
      { x: 4, y: 2 }, { x: 5, y: 5 },
    ],
    water: [...cellsRect(3, 5, 2, 2)],
    rocks: [{ x: 6, y: 2 }],
    mobCount: MOB_COUNTS[0],
    scale: 1,
  },
  {
    floor: 2,
    name: "弯角沙洲",
    shape: "L",
    playCols: 12,
    playRows: 10,
    entrance: { x: 0, y: 1 },
    entranceAlcove: "w",
    spawn: { x: 1, y: 1 },
    exit: { x: 11, y: 9 },
    exitAlcove: "e",
    boss: { x: 10, y: 9 },
    walls: [
      { x: 2, y: 4 }, { x: 2, y: 5 },
      { x: 6, y: 8 }, { x: 7, y: 8 },
    ],
    water: [...cellsRect(4, 7, 2, 2), { x: 1, y: 7 }],
    rocks: [{ x: 8, y: 8 }, { x: 3, y: 2 }],
    mobCount: MOB_COUNTS[1],
    scale: 1.2,
  },
  {
    floor: 3,
    name: "潮汐冠廊",
    shape: "T",
    playCols: 13,
    playRows: 11,
    entrance: { x: 6, y: 0 },
    entranceAlcove: "n",
    spawn: { x: 6, y: 1 },
    exit: { x: 6, y: 10 },
    exitAlcove: "s",
    boss: { x: 6, y: 9 },
    walls: [
      { x: 3, y: 2 }, { x: 9, y: 2 },
      { x: 5, y: 5 }, { x: 7, y: 5 },
    ],
    water: [...cellsRect(1, 1, 2, 2), ...cellsRect(10, 1, 2, 2)],
    rocks: [{ x: 4, y: 6 }, { x: 8, y: 6 }],
    mobCount: MOB_COUNTS[2],
    scale: 1.4,
  },
  {
    floor: 4,
    name: "双湾港",
    shape: "U",
    playCols: 13,
    playRows: 11,
    entrance: { x: 0, y: 1 },
    entranceAlcove: "w",
    spawn: { x: 1, y: 1 },
    // 右臂北端唯一出口（左臂北端封边后不再像出口）
    exit: { x: 11, y: 0 },
    exitAlcove: "n",
    boss: { x: 11, y: 2 },
    walls: [
      { x: 1, y: 5 }, { x: 2, y: 5 },
      { x: 10, y: 5 }, { x: 11, y: 5 },
      { x: 6, y: 9 },
    ],
    water: [...cellsRect(5, 8, 3, 2)],
    rocks: [{ x: 1, y: 3 }, { x: 11, y: 3 }, { x: 6, y: 9 }],
    mobCount: MOB_COUNTS[3],
    scale: 1.65,
  },
  {
    floor: 5,
    name: "十字雾林",
    shape: "cross",
    playCols: 13,
    playRows: 13,
    entrance: { x: 6, y: 0 },
    entranceAlcove: "n",
    spawn: { x: 6, y: 1 },
    exit: { x: 6, y: 12 },
    exitAlcove: "s",
    boss: { x: 6, y: 11 },
    walls: [
      { x: 5, y: 5 }, { x: 7, y: 5 },
      { x: 5, y: 7 }, { x: 7, y: 7 },
      { x: 3, y: 6 }, { x: 9, y: 6 },
    ],
    water: [...cellsRect(1, 5, 2, 2), ...cellsRect(10, 5, 2, 2)],
    rocks: [{ x: 6, y: 4 }, { x: 6, y: 8 }, { x: 4, y: 6 }, { x: 8, y: 6 }],
    mobCount: MOB_COUNTS[4],
    scale: 1.9,
  },
  {
    floor: 6,
    name: "环礁秘径",
    shape: "ring",
    playCols: 14,
    playRows: 12,
    entrance: { x: 0, y: 1 },
    entranceAlcove: "w",
    spawn: { x: 1, y: 1 },
    exit: { x: 13, y: 6 },
    exitAlcove: "e",
    boss: { x: 11, y: 6 },
    walls: [
      { x: 2, y: 4 }, { x: 2, y: 7 },
      { x: 7, y: 1 }, { x: 7, y: 10 },
    ],
    water: [...cellsRect(1, 4, 2, 2), { x: 10, y: 2 }, { x: 10, y: 9 }],
    rocks: [{ x: 3, y: 2 }, { x: 4, y: 9 }, { x: 12, y: 4 }],
    mobCount: MOB_COUNTS[5],
    scale: 2.15,
  },
  {
    floor: 7,
    name: "双殿甬道",
    shape: "twin",
    playCols: 15,
    playRows: 11,
    entrance: { x: 0, y: 5 },
    entranceAlcove: "w",
    spawn: { x: 1, y: 5 },
    exit: { x: 14, y: 5 },
    exitAlcove: "e",
    boss: { x: 13, y: 5 },
    walls: [
      { x: 2, y: 3 }, { x: 2, y: 7 },
      { x: 12, y: 3 }, { x: 12, y: 7 },
      { x: 7, y: 4 }, { x: 7, y: 6 },
    ],
    water: [...cellsRect(3, 4, 2, 2), ...cellsRect(10, 4, 2, 2)],
    rocks: [{ x: 5, y: 3 }, { x: 9, y: 7 }, { x: 7, y: 5 }],
    mobCount: MOB_COUNTS[6],
    scale: 2.45,
  },
  {
    floor: 8,
    name: "退台遗迹",
    shape: "steps",
    playCols: 15,
    playRows: 12,
    entrance: { x: 0, y: 1 },
    entranceAlcove: "w",
    spawn: { x: 1, y: 1 },
    exit: { x: 13, y: 11 },
    exitAlcove: "s",
    boss: { x: 12, y: 10 },
    walls: [
      { x: 5, y: 3 }, { x: 6, y: 3 },
      { x: 8, y: 6 }, { x: 9, y: 6 },
      { x: 10, y: 8 },
    ],
    water: [...cellsRect(7, 8, 2, 2), { x: 3, y: 4 }],
    rocks: [{ x: 4, y: 2 }, { x: 11, y: 7 }, { x: 9, y: 9 }],
    mobCount: MOB_COUNTS[7],
    scale: 2.8,
  },
  {
    floor: 9,
    name: "锯齿海湾",
    shape: "bay",
    playCols: 16,
    playRows: 13,
    entrance: { x: 2, y: 6 },
    entranceAlcove: "w",
    spawn: { x: 3, y: 6 },
    exit: { x: 14, y: 8 },
    exitAlcove: "e",
    boss: { x: 12, y: 8 },
    walls: [
      { x: 6, y: 5 }, { x: 7, y: 5 }, { x: 7, y: 6 },
      { x: 9, y: 8 }, { x: 10, y: 7 },
    ],
    water: [...cellsRect(8, 3, 3, 2), ...cellsRect(4, 9, 2, 2)],
    rocks: [{ x: 5, y: 4 }, { x: 11, y: 5 }, { x: 10, y: 10 }],
    mobCount: MOB_COUNTS[8],
    scale: 3.2,
  },
  {
    floor: 10,
    name: "终焉爪屿",
    shape: "claw",
    playCols: 16,
    playRows: 14,
    entrance: { x: 0, y: 6 },
    entranceAlcove: "w",
    spawn: { x: 1, y: 6 },
    exit: { x: 15, y: 6 },
    exitAlcove: "e",
    boss: { x: 14, y: 6 },
    walls: [
      { x: 5, y: 5 }, { x: 5, y: 7 },
      { x: 8, y: 3 }, { x: 9, y: 8 },
      { x: 12, y: 5 }, { x: 12, y: 7 },
    ],
    water: [...cellsRect(7, 5, 2, 2), { x: 3, y: 7 }, { x: 11, y: 3 }],
    rocks: [{ x: 6, y: 4 }, { x: 10, y: 7 }, { x: 13, y: 4 }, { x: 4, y: 8 }],
    mobCount: MOB_COUNTS[9],
    scale: 3.7,
  },
];

export function getFloorDef(floor) {
  const n = Math.max(1, Math.min(MAX_FLOOR, Number(floor) || 1));
  return FLOOR_DEFS[n - 1];
}
