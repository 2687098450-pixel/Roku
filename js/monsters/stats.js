/**
 * 怪物属性表（随层解锁）
 * 行动条满 100；速度 = 每 0.1 秒增加的点数
 */

export const GAUGE_MAX = 100;
export const DEFAULT_MONSTER_SPEED = 15;

export const MONSTER_STATS = {
  slime: {
    id: "slime",
    name: "史莱姆",
    color: "#ff6b6b",
    shape: "square",
    hp: 55,
    atk: 29,
    def: 3,
    spd: DEFAULT_MONSTER_SPEED,
    exp: 14,
    gold: 8,
    unlockFloor: 1,
  },
  bat: {
    id: "bat",
    name: "吸血蝠",
    color: "#8b6cff",
    shape: "square",
    hp: 40,
    atk: 34,
    def: 2,
    spd: DEFAULT_MONSTER_SPEED + 6,
    exp: 18,
    gold: 11,
    unlockFloor: 2,
  },
  goblin: {
    id: "goblin",
    name: "小哥布林",
    color: "#5dbf6a",
    shape: "square",
    hp: 62,
    atk: 36,
    def: 4,
    spd: DEFAULT_MONSTER_SPEED + 2,
    exp: 24,
    gold: 15,
    unlockFloor: 3,
  },
  mushroom: {
    id: "mushroom",
    name: "毒菇精",
    color: "#e8a0ff",
    shape: "square",
    hp: 72,
    atk: 32,
    def: 5,
    spd: DEFAULT_MONSTER_SPEED - 2,
    exp: 30,
    gold: 20,
    unlockFloor: 5,
  },
  golem: {
    id: "golem",
    name: "石傀儡",
    color: "#a09080",
    shape: "square",
    hp: 118,
    atk: 45,
    def: 11,
    spd: DEFAULT_MONSTER_SPEED - 5,
    exp: 42,
    gold: 28,
    unlockFloor: 7,
  },
  wisp: {
    id: "wisp",
    name: "幽光萤",
    color: "#7ec8ff",
    shape: "square",
    hp: 50,
    atk: 40,
    def: 3,
    spd: DEFAULT_MONSTER_SPEED + 4,
    exp: 38,
    gold: 24,
    unlockFloor: 8,
  },
  boss: {
    id: "boss",
    name: "关口守护者",
    color: "#b44dff",
    shape: "square",
    hp: 200,
    atk: 30,
    def: 10,
    spd: DEFAULT_MONSTER_SPEED - 2,
    exp: 120,
    gold: 80,
    unlockFloor: 1,
  },
};

export function getMonsterStats(id) {
  const data = MONSTER_STATS[id];
  if (!data) throw new Error(`未知怪物属性: ${id}`);
  return data;
}

/** 该层可刷的小怪类型（不含 boss） */
export function trashTypesForFloor(floor) {
  const f = Math.max(1, floor || 1);
  return Object.values(MONSTER_STATS).filter(
    (m) => m.id !== "boss" && (m.unlockFloor || 1) <= f
  );
}
