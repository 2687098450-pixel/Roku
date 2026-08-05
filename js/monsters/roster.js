/**
 * 怪物工厂 + 遭遇编队
 * - 小怪遭遇：混合类型，最多 9 只（3×3）
 * - Boss：后排中央 + 其余格位小怪
 */

import { getMonsterStats, trashTypesForFloor } from "./stats.js?v=77";
import { TYPE_SKILL_IDS } from "./skills.js?v=77";

let _seq = 1;
function nextId(prefix) {
  return `${prefix}_${_seq++}`;
}

export function scaleStat(base, scale) {
  const s = scale ?? 1;
  return Math.max(1, Math.round(base * s));
}

/**
 * @param {string} kind
 * @param {{ x?: number, y?: number, scale?: number, role?: string, isBoss?: boolean }} opts
 */
export function createMonster(kind, opts = {}) {
  const base = getMonsterStats(kind);
  const scale = opts.scale ?? 1;
  const isBoss = Boolean(opts.isBoss || kind === "boss");
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
    exp: Math.max(1, Math.round((base.exp || 10) * (0.9 + scale * 0.35))),
    gold: Math.max(1, Math.round((base.gold || 6) * (0.9 + scale * 0.4))),
    gauge: 0,
    skillIds: [...(TYPE_SKILL_IDS[kind] || ["gnaw"])],
    isBoss,
    role: opts.role || (isBoss ? "boss" : "trash"),
    /** 地图实体引用（仅主怪保留，战斗生成的小怪为 null） */
    worldRef: opts.worldRef ?? null,
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
    gauge: Math.floor(Math.random() * 41),
    skillIds: unit.skillIds || TYPE_SKILL_IDS[unit.kind] || ["gnaw"],
    shape: unit.shape || "square",
    ...extras,
  };
}

/**
 * 从地图触碰怪生成战斗编队
 * @returns {{ enemies: object[], primary: object }}
 */
export function buildEncounter(touched, floor, scale) {
  const s = scale ?? 1;
  const isBoss = Boolean(touched.isBoss || touched.kind === "boss" || touched.type === "boss");
  const touchedKind = touched.kind || touched.type || "slime";

  if (isBoss) {
    const boss = battleReady(
      cloneForBattle(touched, {
        row: "back",
        col: 1,
        worldRef: touched,
        isBoss: true,
        role: "boss",
        kind: "boss",
        hp: touched.hp,
        maxHp: touched.maxHp,
      })
    );
    const adds = bossAddCount(floor);
    const slots = assignBossAddSlots(adds);
    const extras = slots.map((slot) => {
      const kind = pickTrashType(floor);
      const m = createMonster(kind, { scale: s * 0.85, role: "trash" });
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
    const m = createMonster(kinds[i], { scale: s, role: "trash" });
    return battleReady(cloneForBattle(m, { ...slot, worldRef: null, isBoss: false }));
  });
  return { enemies, primary: enemies[0] };
}

/** 地图刷怪：按层权重选类型 */
export function spawnTrashOnMap(x, y, floor, scale) {
  const kind = pickTrashType(floor);
  return createMonster(kind, { x, y, scale, role: "trash", worldRef: null });
}
