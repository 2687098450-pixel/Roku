/**
 * 怪物工厂 + 遭遇编队
 * - 小怪遭遇：混合类型，最多 9 只（3×3）
 * - Boss：后排中央 + 其余格位小怪
 */

import { getMonsterStats, trashTypesForFloor } from "./stats.js?v=102";
import {
  TYPE_SKILL_IDS,
  trashControlSkillIdsForFloor,
  bossSkillIdsForFloor,
} from "./skills.js?v=102";
import {
  DEFAULT_HIT_RATE,
  DEFAULT_DODGE_RATE,
} from "../characters/progression.js?v=102";
import { createBoss } from "./boss.js?v=102";

let _seq = 1;
function nextId(prefix) {
  return `${prefix}_${_seq++}`;
}

export function scaleStat(base, scale) {
  const s = scale ?? 1;
  return Math.max(1, Math.round(base * s));
}

function skillIdsForTrash(kind, floor) {
  const base = [...(TYPE_SKILL_IDS[kind] || ["gnaw"])];
  const ctrl = trashControlSkillIdsForFloor(floor);
  // 按层数概率挂上已解锁的控制技（层越高越多）
  const f = Math.max(1, floor || 1);
  for (const id of ctrl) {
    const chance = Math.min(0.85, 0.35 + f * 0.02);
    if (Math.random() < chance && !base.includes(id)) base.push(id);
  }
  return base;
}

/**
 * @param {string} kind
 * @param {{ x?: number, y?: number, scale?: number, role?: string, isBoss?: boolean, floor?: number }} opts
 */
export function createMonster(kind, opts = {}) {
  const base = getMonsterStats(kind);
  const scale = opts.scale ?? 1;
  const isBoss = Boolean(
    opts.isBoss || kind === "boss" || String(kind || "").startsWith("boss_")
  );
  const floor = opts.floor || 1;
  const combatFloor = opts.combatFloor || floor;
  return {
    id: nextId(kind),
    kind,
    name: base.name,
    color: base.color,
    shape: base.shape,
    x: opts.x ?? 0,
    y: opts.y ?? 0,
    hp: scaleStat(base.hp, scale),
    maxHp: scaleStat(base.hp, scale),
    atk: scaleStat(base.atk, scale),
    def: scaleStat(base.def, scale),
    spd: Math.max(4, Math.round(base.spd + (scale - 1) * 2)),
    exp: Math.max(1, Math.round((base.exp || 1) * (0.9 + scale * 0.35))),
    gold: Math.max(1, Math.round((base.gold || 6) * (0.9 + scale * 0.4))),
    gauge: 0,
    skillIds: isBoss
      ? [...(TYPE_SKILL_IDS.boss || [])]
      : skillIdsForTrash(kind, combatFloor),
    hitRate: DEFAULT_HIT_RATE,
    dodgeRate: DEFAULT_DODGE_RATE,
    isBoss,
    role: opts.role || (isBoss ? "boss" : "trash"),
    /** 地图实体引用（仅主怪保留，战斗生成的小怪为 null） */
    worldRef: opts.worldRef ?? null,
    floor,
    combatFloor,
  };
}

export function cloneForBattle(monster, overrides = {}) {
  return {
    ...monster,
    id: nextId(monster.kind),
    hp: monster.hp,
    maxHp: monster.maxHp,
    gauge: 0,
    worldRef: overrides.worldRef !== undefined ? overrides.worldRef : monster.worldRef,
    row: overrides.row ?? "front",
    col: overrides.col ?? 0,
    ...overrides,
  };
}

/** 加权随机类型 */
export function pickTrashType(floor, rnd = Math.random) {
  const types = trashTypesForFloor(floor);
  if (!types.length) return "slime";
  // 新解锁的略提高权重
  const weights = types.map((t) => {
    const age = Math.max(0, floor - (t.unlockFloor || 1));
    return 1 + age * 0.15 + (t.unlockFloor === floor ? 0.8 : 0);
  });
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rnd() * total;
  for (let i = 0; i < types.length; i++) {
    r -= weights[i];
    if (r <= 0) return types[i].id;
  }
  return types[types.length - 1].id;
}

/** 小怪遭遇数量：随层升高，最多 9（铺满 3×3） */
export function trashPackCount(floor, rnd = Math.random) {
  const f = Math.max(1, floor || 1);
  const min = Math.min(9, 2 + Math.floor((f - 1) / 2));
  const max = Math.min(9, 3 + Math.floor(f / 2));
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  return lo + Math.floor(rnd() * (hi - lo + 1));
}

/** 小怪站位：3×3，前排 → 中排 → 后排 */
export function assignTrashSlots(n) {
  const order = [
    ["front", 0],
    ["front", 1],
    ["front", 2],
    ["mid", 0],
    ["mid", 1],
    ["mid", 2],
    ["back", 0],
    ["back", 1],
    ["back", 2],
  ];
  const slots = [];
  for (let i = 0; i < Math.min(n, 9); i++) {
    slots.push({ row: order[i][0], col: order[i][1] });
  }
  return slots;
}

/**
 * Boss 编队：boss 后排中央；其余格位可加小怪
 * 总数（含 boss）最多 9
 */
export function bossAddCount(floor, rnd = Math.random) {
  const f = Math.max(1, floor || 1);
  const maxAdds = Math.min(8, 1 + Math.floor(f / 2));
  const minAdds = Math.min(maxAdds, Math.max(1, Math.floor(f / 3)));
  return minAdds + Math.floor(rnd() * (maxAdds - minAdds + 1));
}

/** Boss 小怪站位：前排满 → 中排 → 后排左右（中央留给 Boss） */
export function assignBossAddSlots(n) {
  const order = [
    ["front", 0],
    ["front", 1],
    ["front", 2],
    ["mid", 0],
    ["mid", 1],
    ["mid", 2],
    ["back", 0],
    ["back", 2],
  ];
  return order.slice(0, Math.min(n, 8)).map(([row, col]) => ({ row, col }));
}

function battleReady(unit, extras = {}) {
  return {
    ...unit,
    stun: 0,
    stunBar: 0,
    statuses: {},
    dot: null,
    hitRate: unit.hitRate ?? DEFAULT_HIT_RATE,
    dodgeRate: unit.dodgeRate ?? DEFAULT_DODGE_RATE,
    gauge: Math.floor(Math.random() * 41),
    skillIds: unit.skillIds || TYPE_SKILL_IDS[unit.kind] || ["gnaw"],
    shape: unit.shape || "square",
    actCount: 0,
    controlCd: 0,
    ...extras,
  };
}

/**
 * 从地图触碰怪生成战斗编队
 * @returns {{ enemies: object[], primary: object }}
 */
export function buildEncounter(touched, floor, scale) {
  const s = scale ?? 1;
  const isBoss = Boolean(
    touched.isBoss ||
      touched.kind === "boss" ||
      touched.type === "boss" ||
      String(touched.kind || "").startsWith("boss_") ||
      String(touched.type || "").startsWith("boss_")
  );
  const touchedKind = touched.kind || touched.type || "slime";

  if (isBoss) {
    const boss = battleReady(
      cloneForBattle(touched, {
        row: "back",
        col: 1,
        worldRef: touched,
        isBoss: true,
        role: "boss",
        kind: touched.kind || touched.type || "boss",
        hp: touched.hp,
        maxHp: touched.maxHp,
      })
    );
    const adds = bossAddCount(floor);
    const slots = assignBossAddSlots(adds);
    const extras = slots.map((slot) => {
      const kind = pickTrashType(floor);
      const m = createMonster(kind, { scale: s * 0.85, role: "trash", floor });
      return battleReady(cloneForBattle(m, { ...slot, worldRef: null, isBoss: false }));
    });
    return { enemies: [boss, ...extras], primary: boss };
  }

  const count = trashPackCount(floor);
  const slots = assignTrashSlots(count);
  const kinds = [touchedKind];
  for (let i = 1; i < count; i++) kinds.push(pickTrashType(floor));

  const enemies = slots.map((slot, i) => {
    if (i === 0) {
      return battleReady(
        cloneForBattle(touched, {
          ...slot,
          worldRef: touched,
          kind: touchedKind,
          name: touched.name,
          color: touched.color,
          hp: touched.hp,
          maxHp: touched.maxHp,
          isBoss: false,
        })
      );
    }
    const m = createMonster(kinds[i], { scale: s, role: "trash", floor });
    return battleReady(cloneForBattle(m, { ...slot, worldRef: null, isBoss: false }));
  });
  return { enemies, primary: enemies[0] };
}

/** 地图刷怪：按层权重选类型 */
export function spawnTrashOnMap(x, y, floor, scale) {
  const kind = pickTrashType(floor);
  return createMonster(kind, { x, y, scale, role: "trash", worldRef: null, floor });
}

/** 图鉴用：该种类在本层可能带的技能（含已解锁控制技，非随机） */
export function floorMonsterSkillIds(kind, floor) {
  const f = Math.max(1, floor || 1);
  if (kind === "boss") return bossSkillIdsForFloor(f);
  const ids = [...(TYPE_SKILL_IDS[kind] || ["gnaw"])];
  for (const id of trashControlSkillIdsForFloor(f)) {
    if (!ids.includes(id)) ids.push(id);
  }
  return ids;
}

/**
 * 本层战斗可能出现的怪物种类（每种一次）：解锁小怪 + Boss
 * 数值按本层 scale 取满血样例
 */
export function buildFloorMonsterCatalog(floor, scale = 1) {
  const f = Math.max(1, floor || 1);
  const s = Math.max(0.1, scale || 1);
  const trash = trashTypesForFloor(f).map((sheet) => {
    const m = createMonster(sheet.id, { scale: s, floor: f, role: "trash" });
    m.skillIds = floorMonsterSkillIds(sheet.id, f);
    m.hp = m.maxHp;
    return m;
  });
  const boss = createBoss({ floor: f, scale: s });
  boss.skillIds = floorMonsterSkillIds("boss", f);
  boss.hp = boss.maxHp;
  return [...trash, boss];
}
