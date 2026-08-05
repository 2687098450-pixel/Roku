/**
 * 五十层关卡配置
 * - 1～10：保留原布局与数值
 * - 11～50：循环外形模板；怪物上限 30
 * - 逢 5 / 逢 10：怪少、实力高；另有少量中间稀薄层
 */

export const MAX_FLOOR = 50;
export const MAX_MOB_COUNT = 30;

const MID_SPARSE = new Set([12, 17, 23, 28, 34, 39, 44]);

const BASE_MOB = [3, 5, 4, 7, 9, 6, 11, 14, 12, 16];
const BASE_SCALE = [1, 1.2, 1.4, 1.65, 1.9, 2.15, 2.45, 2.8, 3.2, 3.7];

const FLOOR_NAMES = [
  "阳光海岛",
  "弯角沙洲",
  "潮汐冠廊",
  "双湾港",
  "十字雾林",
  "环礁秘径",
  "双殿甬道",
  "退台遗迹",
  "锯齿海湾",
  "终焉爪屿",
  "雾礁回廊",
  "暗潮洞窟",
  "青铜祭坛",
  "裂骨荒原",
  "赤砂峡谷",
  "幽灯矿脉",
  "枯骨殿堂",
  "毒囊沼泽",
  "霜风隘口",
  "黑曜尖塔",
  "沉钟峡谷",
  "血羽巢穴",
  "锈蚀军堡",
  "咒纹回廊",
  "堕落圣殿",
  "熔心熔炉",
  "幽蓝冰窖",
  "食人魔巢",
  "影隙巷道",
  "深渊门廊",
  "碎星荒原",
  "龙息裂谷",
  "虚空浅滩",
  "永夜墓园",
  "影魔渊口",
  "硫磺河岸",
  "咒火祭台",
  "寒晶迷宫",
  "裂隙之脊",
  "霜噬高塔",
  "赤月荒原",
  "骨龙残骸",
  "冥河渡口",
  "虚妄镜厅",
  "深渊王座",
  "劫灰平原",
  "终末甬道",
  "幼龙栖地",
  "崩塌神殿",
  "世界尽头",
];

/** 1～10 层布局模板（外形 / 坐标）；数值由 mobCountForFloor / scaleForFloor 覆盖 */
const LAYOUTS = [
  {
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
      { x: 4, y: 2 },
      { x: 5, y: 5 },
    ],
  },
  {
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
      { x: 2, y: 4 },
      { x: 2, y: 5 },
      { x: 6, y: 8 },
      { x: 7, y: 8 },
    ],
  },
  {
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
      { x: 3, y: 2 },
      { x: 9, y: 2 },
      { x: 5, y: 5 },
      { x: 7, y: 5 },
    ],
  },
  {
    shape: "U",
    playCols: 13,
    playRows: 11,
    entrance: { x: 0, y: 1 },
    entranceAlcove: "w",
    spawn: { x: 1, y: 1 },
    exit: { x: 11, y: 0 },
    exitAlcove: "n",
    boss: { x: 11, y: 1 },
    walls: [
      { x: 1, y: 5 },
      { x: 2, y: 5 },
      { x: 10, y: 5 },
      { x: 11, y: 5 },
      { x: 6, y: 9 },
    ],
  },
  {
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
      { x: 5, y: 5 },
      { x: 7, y: 5 },
      { x: 5, y: 7 },
      { x: 7, y: 7 },
      { x: 3, y: 6 },
      { x: 9, y: 6 },
    ],
  },
  {
    shape: "ring",
    playCols: 14,
    playRows: 12,
    entrance: { x: 0, y: 1 },
    entranceAlcove: "w",
    spawn: { x: 1, y: 1 },
    exit: { x: 13, y: 6 },
    exitAlcove: "e",
    boss: { x: 12, y: 6 },
    walls: [
      { x: 2, y: 4 },
      { x: 2, y: 7 },
      { x: 7, y: 1 },
      { x: 7, y: 10 },
    ],
  },
  {
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
      { x: 2, y: 3 },
      { x: 2, y: 7 },
      { x: 12, y: 3 },
      { x: 12, y: 7 },
      { x: 7, y: 4 },
      { x: 7, y: 6 },
    ],
  },
  {
    shape: "steps",
    playCols: 15,
    playRows: 12,
    entrance: { x: 0, y: 1 },
    entranceAlcove: "w",
    spawn: { x: 1, y: 1 },
    exit: { x: 13, y: 11 },
    exitAlcove: "s",
    boss: { x: 13, y: 10 },
    walls: [
      { x: 5, y: 3 },
      { x: 6, y: 3 },
      { x: 8, y: 6 },
      { x: 9, y: 6 },
      { x: 10, y: 8 },
    ],
  },
  {
    shape: "bay",
    playCols: 16,
    playRows: 13,
    entrance: { x: 2, y: 6 },
    entranceAlcove: "w",
    spawn: { x: 3, y: 6 },
    exit: { x: 14, y: 8 },
    exitAlcove: "e",
    boss: { x: 13, y: 8 },
    walls: [
      { x: 6, y: 5 },
      { x: 7, y: 5 },
      { x: 7, y: 6 },
      { x: 9, y: 8 },
      { x: 10, y: 7 },
    ],
  },
  {
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
      { x: 5, y: 5 },
      { x: 5, y: 7 },
      { x: 8, y: 3 },
      { x: 9, y: 8 },
      { x: 12, y: 5 },
      { x: 12, y: 7 },
    ],
  },
];

export function mobCountForFloor(floor) {
  const f = Math.max(1, Math.floor(floor || 1));
  if (f <= 10) return BASE_MOB[f - 1];
  const t = Math.min(1, (f - 1) / Math.max(1, MAX_FLOOR - 2));
  let n = 3 + t * (MAX_MOB_COUNT - 3);
  if (f % 10 === 0) n *= 0.58;
  else if (f % 5 === 0) n *= 0.72;
  else if (MID_SPARSE.has(((f - 1) % MAX_FLOOR) + 1) || MID_SPARSE.has(f)) n *= 0.8;
  return Math.max(3, Math.min(MAX_MOB_COUNT, Math.round(n)));
}

/** 展示层 + 轮回 → 战斗强度层（一轮 ≈ 旧 35 层强度） */
export const LOOP_FLOOR_OFFSET = 34;

export function effectiveCombatFloor(displayFloor, loop = 0) {
  const d = Math.max(1, Math.floor(displayFloor || 1));
  const L = Math.max(0, Math.floor(loop || 0));
  return d + L * LOOP_FLOOR_OFFSET;
}

export function scaleForFloor(floor) {
  const f = Math.max(1, Math.floor(floor || 1));
  if (f <= 10) return BASE_SCALE[f - 1];
  const extra = f - 10;
  let s = 3.7 + extra * 0.28 + extra * (extra - 1) * 0.002;
  if (f % 10 === 0) s *= 1.18;
  else if (f % 5 === 0) s *= 1.1;
  else if (MID_SPARSE.has(((f - 1) % MAX_FLOOR) + 1)) s *= 1.05;
  return Math.round(s * 100) / 100;
}

function clonePoint(p) {
  return p ? { x: p.x, y: p.y } : null;
}

function buildFloorDef(floor, loop = 0) {
  const f = Math.max(1, Math.min(MAX_FLOOR, floor));
  const layout = LAYOUTS[(f - 1) % LAYOUTS.length];
  const decade = Math.floor((f - 1) / 10);
  const combatFloor = effectiveCombatFloor(f, loop);
  return {
    floor: f,
    combatFloor,
    loop: Math.max(0, Math.floor(loop || 0)),
    name: FLOOR_NAMES[f - 1] || `${f}层`,
    shape: layout.shape,
    playCols: layout.playCols + decade,
    playRows: layout.playRows + Math.floor(decade / 2),
    entrance: clonePoint(layout.entrance),
    entranceAlcove: layout.entranceAlcove,
    spawn: clonePoint(layout.spawn),
    exit: clonePoint(layout.exit),
    exitAlcove: layout.exitAlcove,
    boss: clonePoint(layout.boss),
    walls: (layout.walls || []).map(clonePoint),
    mobCount: mobCountForFloor(combatFloor),
    scale: scaleForFloor(combatFloor),
  };
}

/**
 * 地图随 decade 略增时，把出口/Boss 贴到东/南边缘，避免落在新增空地外
 */
function fitEdgePoints(def) {
  const layout = LAYOUTS[(def.floor - 1) % LAYOUTS.length];
  const dCol = def.playCols - layout.playCols;
  const dRow = def.playRows - layout.playRows;
  if (dCol === 0 && dRow === 0) return def;

  const shift = (p, ox, oy) => {
    if (!p) return p;
    return {
      x: Math.min(def.playCols - 1, Math.max(0, p.x + ox)),
      y: Math.min(def.playRows - 1, Math.max(0, p.y + oy)),
    };
  };

  // 出口在东侧：随列增右移；在南侧：随行增下移
  if (layout.exitAlcove === "e") {
    def.exit = shift(layout.exit, dCol, 0);
    def.boss = shift(layout.boss, dCol, 0);
  } else if (layout.exitAlcove === "s") {
    def.exit = shift(layout.exit, 0, dRow);
    def.boss = shift(layout.boss, 0, dRow);
  } else if (layout.exitAlcove === "n") {
    def.exit = shift(layout.exit, dCol > 0 ? Math.floor(dCol / 2) : 0, 0);
    def.boss = shift(layout.boss, dCol > 0 ? Math.floor(dCol / 2) : 0, 0);
  }
  return def;
}

export const FLOOR_DEFS = Array.from({ length: MAX_FLOOR }, (_, i) =>
  fitEdgePoints(buildFloorDef(i + 1))
);

export function getFloorDef(floor, loop = 0) {
  const n = Math.max(1, Math.min(MAX_FLOOR, Number(floor) || 1));
  const L = Math.max(0, Math.floor(loop || 0));
  if (!L) return FLOOR_DEFS[n - 1];
  return fitEdgePoints(buildFloorDef(n, L));
}
