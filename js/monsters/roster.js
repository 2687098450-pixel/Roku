/**
 * 怪物工厂 + 遭遇编队
 * - 小怪遭遇：混合类型，最多 9 只（3×3）；站位按 aiRole（坦前/辅中/输出后）
 * - Boss：多在后排中央；坦克 Boss 偶发前排中央 + 其余格位小怪
 */

import { getMonsterStats, trashTypesForFloor, MONSTER_ATK_MULT } from "./stats.js?v=177";
import {
  TYPE_SKILL_IDS,
  trashControlSkillIdsForFloor,
  bossSkillIdsForFloor,
} from "./skills.js?v=177";
import {
  DEFAULT_HIT_RATE,
  DEFAULT_DODGE_RATE,
} from "../characters/progression.js?v=177";
import { createBoss } from "./boss.js?v=177";

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
    atk: Math.max(1, Math.round(scaleStat(base.atk, scale) * MONSTER_ATK_MULT)),
    def: scaleStat(base.def, scale),
    spd: Math.max(4, Math.round(base.spd + (scale - 1) * 2)),
    exp: Math.max(1, Math.round((base.exp || 1) * (0.9 + scale * 0.35))),
    // 金币随层增长放缓：约 30 层累计够强化 3 件到 +15
    gold: Math.max(1, Math.round((base.gold || 6) * (0.9 + scale * 0.3))),
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

function aiRoleOf(kind) {
  try {
    return getMonsterStats(kind)?.aiRole || "dps";
  } catch {
    return "dps";
  }
}

function preferredRowForRole(role) {
  if (role === "tank") return "front";
  if (role === "support") return "mid";
  return "back";
}

function shuffleCols(rnd = Math.random) {
  return [0, 1, 2].sort(() => rnd() - 0.5);
}

/**
 * 按 AI 角色分配站位：防御前排、状态/治疗中排、攻击后排。
 * 允许全同角色 / 缺某一类；溢出填空排。blocked 为不可占用格（如 Boss 位）。
 * @param {string[]} kinds
 * @param {{ blocked?: { row: string, col: number }[], rnd?: () => number }} [opts]
 * @returns {{ row: string, col: number, kind: string, idx: number }[]}
 */
export function assignSlotsByRoles(kinds, opts = {}) {
  const rnd = opts.rnd || Math.random;
  const blocked = new Set(
    (opts.blocked || []).map((p) => `${p.row}:${p.col}`)
  );
  const capacity = { front: 3, mid: 3, back: 3 };
  for (const key of blocked) {
    const row = key.split(":")[0];
    if (capacity[row] != null) capacity[row] = Math.max(0, capacity[row] - 1);
  }

  /** @type {{ kind: string, role: string, idx: number }[]} */
  const entries = kinds.map((kind, idx) => ({
    kind,
    role: aiRoleOf(kind),
    idx,
  }));

  /** @type {{ front: typeof entries, mid: typeof entries, back: typeof entries }} */
  const queues = { front: [], mid: [], back: [] };
  const overflow = [];

  for (const e of entries) {
    const pref = preferredRowForRole(e.role);
    if (queues[pref].length < capacity[pref]) queues[pref].push(e);
    else overflow.push(e);
  }

  const rowOrder = ["front", "mid", "back"];
  for (const e of overflow) {
    const room = rowOrder.find((r) => queues[r].length < capacity[r]);
    if (room) queues[room].push(e);
  }

  // 空排有容量时，从人数最多的排挪一只，避免全挤一排
  for (const empty of rowOrder) {
    if (capacity[empty] <= 0 || queues[empty].length > 0) continue;
    const donor = rowOrder
      .filter((r) => r !== empty && queues[r].length > 1)
      .sort((a, b) => queues[b].length - queues[a].length)[0];
    if (donor) queues[empty].push(queues[donor].pop());
  }

  /** @type {{ row: string, col: number, kind: string, idx: number }[]} */
  const slots = [];
  for (const row of rowOrder) {
    const freeCols = shuffleCols(rnd).filter(
      (c) => !blocked.has(`${row}:${c}`)
    );
    const q = queues[row];
    for (let i = 0; i < q.length && i < freeCols.length; i++) {
      slots.push({
        row,
        col: freeCols[i],
        kind: q[i].kind,
        idx: q[i].idx,
      });
    }
  }
  return slots;
}

/** 小怪站位：兼容旧调用（仅按数量前→中→后） */
export function assignTrashSlots(n) {
  const kinds = Array.from({ length: Math.min(n, 9) }, () => "slime");
  return assignSlotsByRoles(kinds).map(({ row, col }) => ({ row, col }));
}

/**
 * Boss 编队：boss 通常后排中央；坦克 Boss 偶发前排中央
 * 总数（含 boss）最多 9
 */
export function bossAddCount(floor, rnd = Math.random) {
  const f = Math.max(1, floor || 1);
  const maxAdds = Math.min(8, 1 + Math.floor(f / 2));
  const minAdds = Math.min(maxAdds, Math.max(1, Math.floor(f / 3)));
  return minAdds + Math.floor(rnd() * (maxAdds - minAdds + 1));
}

/** Boss 站位：默认后排中央；坦克 Boss ~28% 前排中央 */
export function pickBossSlot(bossKind, rnd = Math.random) {
  const role = aiRoleOf(bossKind);
  if (role === "tank" && rnd() < 0.28) return { row: "front", col: 1 };
  return { row: "back", col: 1 };
}

/** Boss 小怪站位（兼容旧调用） */
export function assignBossAddSlots(n, bossSlot = { row: "back", col: 1 }) {
  const kinds = Array.from({ length: Math.min(n, 8) }, () => "slime");
  return assignSlotsByRoles(kinds, { blocked: [bossSlot] }).map(
    ({ row, col }) => ({ row, col })
  );
}

function battleReady(unit, extras = {}) {
  return {
    ...unit,
    stun: 0,
    stunBar: 0,
    statuses: {},
    dots: {},
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
 * 站位偏好：防御前排、状态/治疗中排、攻击后排；Boss 多在后排中央（坦克 Boss 偶发前排）
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
    const bossKind = touched.kind || touched.type || "boss";
    const bossSlot = pickBossSlot(bossKind);
    const boss = battleReady(
      cloneForBattle(touched, {
        row: bossSlot.row,
        col: bossSlot.col,
        worldRef: touched,
        isBoss: true,
        role: "boss",
        kind: bossKind,
        hp: touched.hp,
        maxHp: touched.maxHp,
      })
    );
    const adds = bossAddCount(floor);
    let addKinds = [];
    for (let i = 0; i < adds; i++) addKinds.push(pickTrashType(floor));
    // 坦克 Boss 站前排时，尽量给后排配输出小怪
    if (bossSlot.row === "front") {
      const pool = trashTypesForFloor(floor);
      const dpsPool = pool.filter((t) => t.aiRole === "dps").map((t) => t.id);
      if (dpsPool.length) {
        addKinds = addKinds.map((k, i) =>
          i < Math.ceil(adds * 0.6)
            ? dpsPool[Math.floor(Math.random() * dpsPool.length)]
            : k
        );
      }
    }
    const slots = assignSlotsByRoles(addKinds, { blocked: [bossSlot] });
    const extras = slots.map((slot) => {
      const m = createMonster(slot.kind, { scale: s * 0.85, role: "trash", floor });
      return battleReady(
        cloneForBattle(m, {
          row: slot.row,
          col: slot.col,
          worldRef: null,
          isBoss: false,
        })
      );
    });
    return { enemies: [boss, ...extras], primary: boss };
  }

  const count = trashPackCount(floor);
  let kinds = [touchedKind];
  for (let i = 1; i < count; i++) kinds.push(pickTrashType(floor));

  // 约 15% 同构编队（全防/全攻/全支援），其余混合
  if (Math.random() < 0.15) {
    const theme = ["tank", "support", "dps"][Math.floor(Math.random() * 3)];
    const themed = trashTypesForFloor(floor)
      .filter((t) => t.aiRole === theme)
      .map((t) => t.id);
    if (themed.length) {
      kinds = kinds.map(() => themed[Math.floor(Math.random() * themed.length)]);
      kinds[0] = touchedKind; // 主怪种类仍保留触碰的那只
    }
  }

  const slots = assignSlotsByRoles(kinds);
  const enemies = slots.map((slot) => {
    if (slot.idx === 0) {
      return battleReady(
        cloneForBattle(touched, {
          row: slot.row,
          col: slot.col,
          worldRef: touched,
          kind: touchedKind,
          name: touched.name,
          color: touched.color,
          hp: touched.hp,
          maxHp: touched.maxHp,
          atk: touched.atk,
          def: touched.def,
          spd: touched.spd,
          isBoss: false,
          isElite: !!touched.isElite,
        })
      );
    }
    const m = createMonster(slot.kind, { scale: s, role: "trash", floor });
    return battleReady(
      cloneForBattle(m, {
        row: slot.row,
        col: slot.col,
        worldRef: null,
        isBoss: false,
      })
    );
  });
  return { enemies, primary: enemies.find((e) => e.worldRef === touched) || enemies[0] };
}

/** 地图刷怪：按层权重选类型 */
export function spawnTrashOnMap(x, y, floor, scale) {
  const kind = pickTrashType(floor);
  return createMonster(kind, { x, y, scale, role: "trash", worldRef: null, floor });
}

/** 图鉴用：该种类在本层可能带的技能（含已解锁控制技，非随机） */
export function floorMonsterSkillIds(kind, floor) {
  const f = Math.max(1, floor || 1);
  if (kind === "boss" || String(kind || "").startsWith("boss_")) {
    return bossSkillIdsForFloor(f, kind);
  }
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
  boss.skillIds = floorMonsterSkillIds(boss.kind, f);
  boss.hp = boss.maxHp;
  return [...trash, boss];
}
