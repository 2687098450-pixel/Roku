/**
 * 装备系统
 * - 等级 → 主属性数值（层数对应等级）
 * - 品质 → 词条数量（白0 / 绿1 / 蓝2 / 紫3 / 橙4 / 红5）
 */

export const SLOT_KEYS = [
  "helmet",
  "necklace",
  "armor",
  "shoes",
  "ringL",
  "ringR",
  "weapon",
  "shield",
];

export const SLOT_LABEL = {
  helmet: "头盔",
  necklace: "项链",
  armor: "衣服",
  shoes: "鞋子",
  ringL: "戒指",
  ringR: "戒指",
  weapon: "武器",
  shield: "盾牌",
};

export const BONUS_LABEL = {
  hp: "生命",
  atk: "攻击",
  def: "防御",
  spd: "速度",
  critRate: "暴击率",
  critDmg: "暴击伤害",
};

/** 品质：白 < 绿 < 蓝 < 紫 < 橙 < 红 */
export const RARITY_ORDER = ["white", "green", "blue", "purple", "orange", "red"];

/** 品质决定词条数量（min–max，含端点） */
export const AFFIX_COUNT = {
  white: { min: 0, max: 0 },
  green: { min: 0, max: 1 },
  blue: { min: 1, max: 2 },
  purple: { min: 2, max: 2 },
  orange: { min: 2, max: 3 },
  red: { min: 3, max: 3 },
};

export const RARITY = {
  white: { id: "white", label: "白", rank: 0, affixes: 0, color: "#9aa3ad" },
  green: { id: "green", label: "绿", rank: 1, affixes: 1, color: "#3dbf5c" },
  blue: { id: "blue", label: "蓝", rank: 2, affixes: 2, color: "#3b8dff" },
  purple: { id: "purple", label: "紫", rank: 3, affixes: 2, color: "#a855f7" },
  orange: { id: "orange", label: "橙", rank: 4, affixes: 3, color: "#f0892a" },
  red: { id: "red", label: "红", rank: 5, affixes: 3, color: "#e23d4a" },
};

/** 主属性键（整数成长） */
const PRIMARY_STAT_KEYS = ["hp", "atk", "def", "spd"];
/** 全部可加成属性（含百分比暴击） */
const STAT_KEYS = ["hp", "atk", "def", "spd", "critRate", "critDmg"];
const PCT_STAT_KEYS = new Set(["critRate", "critDmg"]);
const DPS_STAT_KEYS = ["atk", "spd", "critRate", "critDmg"];
const TANK_STAT_KEYS = ["hp", "def", "spd"];

/** 属性词条成长（随装备等级；暴击为小数比例） */
const STAT_AFFIX_GROWTH = {
  hp: { base: 4, perLevel: 2.2 },
  atk: { base: 1, perLevel: 0.42 },
  def: { base: 1, perLevel: 0.38 },
  spd: { base: 1, perLevel: 0.18 },
  critRate: { base: 0.012, perLevel: 0.0035 },
  critDmg: { base: 0.04, perLevel: 0.01 },
};

/** 技能词条池（高品质 / Boss） */
const SKILL_AFFIX_POOL = [
  { id: "pwr_pct", skillMods: { powerMult: 0.1 }, text: "技能伤害 +10%" },
  { id: "pwr_pct2", skillMods: { powerMult: 0.15 }, text: "技能伤害 +15%" },
  { id: "pwr_flat", skillMods: { powerFlat: 4 }, text: "技能伤害 +4" },
  { id: "pwr_flat2", skillMods: { powerFlat: 8 }, text: "技能伤害 +8" },
  { id: "hit", skillMods: { hitBonus: 1 }, text: "技能段数 +1" },
  { id: "heal", skillMods: { healMult: 0.15 }, text: "治疗效果 +15%" },
  { id: "heal2", skillMods: { healMult: 0.25 }, text: "治疗效果 +25%" },
];

/** 用模块 URL 解析，避免 GitHub Pages 子路径 / 无尾斜杠时相对路径失效 */
export const ITEM_ICON_BASE = new URL("../../../assets/items/", import.meta.url).href;
/** 列表/槽位用 slot/ 小图；大图约 1MB，手机易加载失败或极慢 */
export const ITEM_ICON_VER = "15";

export function slotTitle(slotKey) {
  return `装备-${SLOT_LABEL[slotKey] || "部位"}`;
}

export function canEquipInSlot(item, slotKey) {
  if (!item?.slot || !slotKey) return false;
  if (item.slot === slotKey) return true;
  const rings = slotKey === "ringL" || slotKey === "ringR";
  const itemRing = item.slot === "ringL" || item.slot === "ringR";
  return rings && itemRing;
}

/** 武器大类：sword / gun / staff / other */
export function weaponClass(item) {
  if (!item || item.slot !== "weapon") return null;
  const kind = String(item.kind || "");
  const name = String(item.name || "");
  const icon = String(item.icon || "").toLowerCase();
  const blob = `${kind} ${name} ${icon}`;
  if (/法杖|杖/.test(blob) || icon.includes("staff")) return "staff";
  if (/枪/.test(blob) || icon.includes("pistol") || icon.includes("gun")) return "gun";
  if (/剑/.test(blob) || icon.includes("sword")) return "sword";
  return "other";
}

/**
 * 角色能否穿戴该装备（含武器职业限制）
 * 全能：任意武器；小粉：仅枪械；小绿：仅法杖
 */
export function canHeroEquipItem(hero, item, slotKey = item?.slot) {
  if (!hero || !item || !canEquipInSlot(item, slotKey)) return false;
  const isWeapon =
    slotKey === "weapon" || item.slot === "weapon";
  if (!isWeapon) return true;
  const id = hero.statsId;
  if (id === "omni" || id === "yellow") return true;
  const cls = weaponClass(item);
  if (id === "pink") return cls === "gun";
  if (id === "green") return cls === "staff";
  return true;
}

/** 唯一技能强化装：仅对应角色生效；不受「额外技能装」数量限制
 * name = 装备词条短名；detail = 点击预览全文；text 兼容旧存档（= name）
 */
export const UNIQUE_SKILL_IDS = {
  pink_burst_echo: {
    owner: "pink",
    skillId: "pink_burst",
    name: "强化爆裂矢",
    detail:
      "强化小粉「爆裂矢」：每段连射 3 发（每发 50% 伤害），击杀则本段 +1 发。仅小粉装备时生效。",
  },
  omni_balance_spirit: {
    owner: "omni",
    skillId: "boost",
    name: "强化均衡",
    detail:
      "强化全能「均衡」：十字友军共享属性；自身灵体（不造成/不受伤害）；震地眩晕减半。仅全能装备时生效。",
  },
  green_life_flow: {
    owner: "green",
    skillId: "green_life",
    name: "强化生机流转",
    detail: "强化小绿「生机流转」：治疗时提升友军伤害。仅小绿装备时生效。",
  },
  yellow_reflect_shield: {
    owner: "yellow",
    skillId: "yellow_reflect",
    name: "强化反伤",
    detail:
      "强化小黄「反伤」：友军溅射/治疗比例再降低 10%（更快转入治疗）。仅小黄装备时生效。",
  },
  green_mend_pulse: {
    skillId: "green_mend",
    name: "强化治愈之触",
    detail:
      "任意治疗效果都会给目标附加 2 秒脉动——行动条每累计走 10，流失约等于本次治疗量 20% 的血；再累计走到 20，按刚流失量的 2.5 倍回血。",
  },
};

export function uniqueAffixName(uniqueId) {
  const meta = UNIQUE_SKILL_IDS[uniqueId];
  return meta?.name || meta?.text || "唯一词条";
}

export function uniqueAffixDetail(uniqueId) {
  const meta = UNIQUE_SKILL_IDS[uniqueId];
  return meta?.detail || meta?.name || meta?.text || "暂无说明。";
}

export function isSkillStrengthenGear(item) {
  return !!(item && (item.uniqueId || item.skillStrengthen));
}

/** 统计身上普通技能装数量（唯一强化装不计入额外限制） */
export function countExtraSkillGear(equip = {}) {
  let n = 0;
  for (const key of SLOT_KEYS) {
    const it = equip[key];
    if (!it) continue;
    if (isSkillStrengthenGear(it)) continue;
    if (it.skillMods || it.bossOnly) n += 1;
  }
  return n;
}

export function heroHasUnique(hero, uniqueId) {
  if (!hero?.equip || !uniqueId) return false;
  const meta = UNIQUE_SKILL_IDS[uniqueId];
  if (meta?.owner && hero.statsId !== meta.owner) return false;
  for (const key of SLOT_KEYS) {
    const it = hero.equip[key];
    if (it?.uniqueId === uniqueId) return true;
  }
  return false;
}

export function makeUniqueAffix(uniqueId, text) {
  const meta = UNIQUE_SKILL_IDS[uniqueId];
  const name = meta?.name || meta?.text || text || "唯一词条";
  return {
    type: "unique",
    id: uniqueId,
    uniqueId,
    text: name,
    label: "唯一",
  };
}

/** 品质高→低，同品质等级高→低（用于背包整理 / 更换列表） */
export function compareEquipByRarityLevel(a, b) {
  const ra = rarityInfo(a?.rarity).rank;
  const rb = rarityInfo(b?.rarity).rank;
  if (rb !== ra) return rb - ra;
  return itemLevel(b) - itemLevel(a);
}

export function itemLevel(item) {
  const n = Number(item?.level);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 1;
}

/** 仅橙装 / 红装可用金币升级 */
export const UPGRADEABLE_RARITIES = ["orange", "red"];
export const MAX_EQUIP_LEVEL = 100;

export function canUpgradeEquip(item) {
  if (!item?.slot) return false;
  const r = normalizeRarity(item.rarity);
  if (!UPGRADEABLE_RARITIES.includes(r)) return false;
  return itemLevel(item) < MAX_EQUIP_LEVEL;
}

/** 等级是否为 10 的倍数（突破级） */
export function isMilestoneLevel(level) {
  const lv = Math.floor(level || 0);
  return lv > 0 && lv % 10 === 0;
}

export function milestoneCount(level) {
  return Math.floor(Math.max(0, itemLevel({ level })) / 10);
}

/** 升级消耗：越高越贵；下一档若是突破级更贵 */
export function upgradeEquipCost(item) {
  if (!item) return 0;
  const lv = itemLevel(item);
  const rank = rarityInfo(item.rarity).rank;
  const next = lv + 1;
  const base = 28 + lv * 16 + rank * 22;
  const mult = isMilestoneLevel(next) ? 2.4 : 1;
  return Math.max(1, Math.floor(base * mult));
}

/** 突破叠乘：每满 10 级主属性额外 +12% */
export function applyMilestoneToPrimary(primary = {}, level = 1) {
  const n = milestoneCount(level);
  if (!n) return { ...primary };
  const out = {};
  for (const key of PRIMARY_STAT_KEYS) {
    const v = Number(primary[key]) || 0;
    if (!v) continue;
    out[key] = Math.max(1, Math.round(v * (1 + n * 0.12)));
  }
  return out;
}

function formatStatAffixText(stat, value) {
  const label = BONUS_LABEL[stat] || stat;
  if (PCT_STAT_KEYS.has(stat)) {
    const pct = Math.round((Number(value) || 0) * 1000) / 10;
    return `${label} +${pct}%`;
  }
  return `${label} +${value}`;
}

function refreshAffixText(a) {
  if (!a) return;
  if (a.type === "stat" && a.key) {
    a.bonus = { [a.key]: a.value };
    a.text = formatStatAffixText(a.key, a.value);
  } else if (a.type === "skill" && a.skillMods) {
    a.text = formatSkillModsText(a.skillMods);
  }
}

/** 按当前等级重算主属性与合计加成 */
export function rebuildEquipStats(item) {
  if (!item) return item;
  const level = itemLevel(item);
  const kind = item.kind && item.kind !== "equip" ? item.kind : "";
  let primary =
    item.baseBonus && Object.keys(item.baseBonus).length
      ? primaryFromTemplate(item.baseBonus, level)
      : slotPrimaryBonus(item.slot, level, kind);
  primary = applyMilestoneToPrimary(primary, level);
  item.level = level;
  item.primary = primary;
  fillUniqueAffixSlots(item);
  item.bonus = bonusFromParts(primary, item.affixes || []);
  item.skillMods = skillModsFromAffixes(item.affixes || []);
  return item;
}

/** 旧唯一装若只有 1 条，补满红装词条位（种子固定，读档不乱跳） */
function fillUniqueAffixSlots(item) {
  if (!item?.uniqueId) return;
  const meta = UNIQUE_SKILL_IDS[item.uniqueId];
  if (meta && Array.isArray(item.affixes)) {
    const name = meta.name || meta.text;
    for (const a of item.affixes) {
      if (a?.type === "unique" || a?.uniqueId === item.uniqueId) {
        if (name) a.text = name;
        a.uniqueId = item.uniqueId;
      }
    }
  }
  const max = affixCountForRarity(item.rarity || "red");
  if (!Array.isArray(item.affixes)) item.affixes = [];
  if (item.affixes.length >= max) return;
  const used = new Set(
    item.affixes.filter((a) => a.type === "stat" && a.key).map((a) => a.key)
  );
  const preferDps =
    item.slot === "weapon" ||
    item.slot === "ringL" ||
    item.slot === "ringR" ||
    item.skillOwner === "pink";
  const preferTank =
    item.slot === "shield" ||
    item.slot === "armor" ||
    item.skillOwner === "yellow";
  const rng = seededRng(`${item.uniqueId}|${item.slot}|affix`);
  while (item.affixes.length < max) {
    const key = pickStatForAffix(used, { preferDps, preferTank: !preferDps && preferTank }, rng);
    used.add(key);
    item.affixes.push(makeStatAffix(key, rollStatValue(key, itemLevel(item), rng)));
  }
}

function seededRng(seed) {
  let h = 2166136261;
  const s = String(seed || "");
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    return ((h >>> 0) % 10000) / 10000;
  };
}

/**
 * 金币升级橙/红装一级
 * @returns {{ ok: boolean, cost: number, level?: number, milestone?: boolean, reason?: string }}
 */
export function upgradeEquip(item, state) {
  if (!item || !state) return { ok: false, cost: 0, reason: "无效" };
  if (!canUpgradeEquip(item)) {
    const r = normalizeRarity(item.rarity);
    if (!UPGRADEABLE_RARITIES.includes(r)) {
      return { ok: false, cost: 0, reason: "仅橙装与红装可升级" };
    }
    return { ok: false, cost: 0, reason: "已达最高等级" };
  }
  const cost = upgradeEquipCost(item);
  if ((state.gold || 0) < cost) {
    return { ok: false, cost, reason: "金币不足" };
  }

  state.gold -= cost;
  const next = itemLevel(item) + 1;
  item.level = next;
  const milestone = isMilestoneLevel(next);

  for (const a of item.affixes || []) {
    if (a.type === "stat" && a.key) {
      const g = STAT_AFFIX_GROWTH[a.key] || { perLevel: 0.4 };
      if (PCT_STAT_KEYS.has(a.key)) {
        const add = milestone
          ? Math.max(0.01, +(g.perLevel * 2.2).toFixed(4))
          : Math.max(0.003, +(g.perLevel * 0.9).toFixed(4));
        a.value = +((Number(a.value) || 0) + add).toFixed(4);
      } else {
        const add = milestone
          ? Math.max(3, Math.round(g.perLevel * 5 + 2))
          : Math.max(1, Math.round(g.perLevel + 0.35));
        a.value = Math.max(1, (a.value || 1) + add);
      }
      refreshAffixText(a);
    } else if (a.type === "skill" && a.skillMods && milestone) {
      const m = a.skillMods;
      if (m.powerMult) m.powerMult = +(m.powerMult + 0.04).toFixed(3);
      if (m.powerFlat) m.powerFlat += 3;
      if (m.healMult) m.healMult = +(m.healMult + 0.04).toFixed(3);
      if (m.hitBonus && next % 20 === 0) m.hitBonus += 1;
      refreshAffixText(a);
    }
  }

  rebuildEquipStats(item);
  return { ok: true, cost, level: next, milestone };
}

/** 第 N 层掉落 → 等级 N；Boss 战利品高 1 级 */
export function floorItemLevel(floor, { boss = false } = {}) {
  const f = Math.max(1, Math.floor(floor || 1));
  return boss ? f + 1 : f;
}

export function normalizeRarity(rarity) {
  if (rarity && RARITY[rarity]) return rarity;
  return "white";
}

export function rarityInfo(rarity) {
  return RARITY[normalizeRarity(rarity)];
}

export function rarityLabel(rarity) {
  return rarityInfo(rarity).label;
}

export function affixRangeForRarity(rarity) {
  const id = normalizeRarity(rarity);
  const raw = AFFIX_COUNT[id];
  if (raw == null) {
    const n = rarityInfo(id).affixes ?? 0;
    return { min: n, max: n };
  }
  if (typeof raw === "number") return { min: raw, max: raw };
  const min = Math.max(0, Math.floor(raw.min ?? 0));
  const max = Math.max(min, Math.floor(raw.max ?? min));
  return { min, max };
}

/** 展示用：该品质词条上限 */
export function affixCountForRarity(rarity) {
  return affixRangeForRarity(rarity).max;
}

/** 生成装备时：在品质区间内随机词条数 */
export function rollAffixCountForRarity(rarity, rng = Math.random) {
  const { min, max } = affixRangeForRarity(rarity);
  if (max <= min) return min;
  const roll = typeof rng === "function" ? rng() : Math.random();
  return min + Math.floor(roll * (max - min + 1));
}

/** @deprecated 品质不再倍率缩放主属性；保留兼容旧调用 */
export function scaleBonus(baseBonus = {}, _rarity = "white") {
  const out = {};
  for (const key of STAT_KEYS) {
    const v = Number(baseBonus[key]) || 0;
    if (!v) continue;
    out[key] = Math.max(1, Math.round(v));
  }
  return out;
}

/** L1 模板随等级成长 → 主属性 */
export function primaryFromTemplate(baseBonus = {}, level = 1) {
  const L = Math.max(1, level);
  const out = {};
  for (const key of STAT_KEYS) {
    const v = Number(baseBonus[key]) || 0;
    if (!v) continue;
    // 等级 1 = 模板值；每升 1 级约 +35% 模板
    out[key] = Math.max(1, Math.round(v * (1 + (L - 1) * 0.35)));
  }
  return out;
}

/** 无模板时按部位生成主属性 */
export function slotPrimaryBonus(slot, level, kind = "") {
  const L = Math.max(1, level);
  switch (slot) {
    case "weapon":
      if (kind === "手枪") {
        return {
          atk: Math.round(2 + L * 1.15),
          spd: Math.max(1, Math.round(0.5 + L * 0.22)),
        };
      }
      if (kind === "法杖") {
        return {
          atk: Math.round(1 + L * 0.75),
          hp: Math.round(8 + L * 3.2),
        };
      }
      return { atk: Math.round(2 + L * 1.1) };
    case "shield":
      return {
        def: Math.round(1 + L * 0.65),
        hp: Math.round(4 + L * 1.8),
      };
    case "helmet":
      return { def: Math.round(1 + L * 0.45), hp: Math.round(3 + L * 1.4) };
    case "armor":
      return { def: Math.round(1 + L * 0.75), hp: Math.round(8 + L * 3.5) };
    case "shoes":
      return { spd: Math.max(1, Math.round(0.6 + L * 0.28)) };
    case "necklace":
      return { hp: Math.round(8 + L * 3.8) };
    case "ringL":
    case "ringR":
      return { atk: Math.round(1 + L * 0.5) };
    default:
      return { hp: Math.round(4 + L * 1.5) };
  }
}

function emptyBonus() {
  return { hp: 0, atk: 0, def: 0, spd: 0, critRate: 0, critDmg: 0 };
}

function mergeBonus(...parts) {
  const out = emptyBonus();
  for (const p of parts) {
    if (!p) continue;
    for (const k of STAT_KEYS) out[k] += Number(p[k]) || 0;
  }
  return out;
}

function rollStatValue(stat, level, rng = Math.random) {
  const g = STAT_AFFIX_GROWTH[stat];
  if (!g) return 1;
  const jitter = 0.85 + rng() * 0.3;
  const raw = (g.base + level * g.perLevel) * jitter;
  if (PCT_STAT_KEYS.has(stat)) {
    return Math.max(0.005, +raw.toFixed(4));
  }
  return Math.max(1, Math.round(raw));
}

function skillAffixFromMods(skillMods, text) {
  return {
    type: "skill",
    id: `skill_${Object.keys(skillMods || {}).join("_")}`,
    skillMods: { ...skillMods },
    text: text || formatSkillModsText(skillMods),
    label: "词条",
  };
}

function formatSkillModsText(m = {}) {
  const parts = [];
  if (m.powerMult) parts.push(`技能伤害 +${Math.round(m.powerMult * 100)}%`);
  if (m.powerFlat) parts.push(`技能伤害 +${m.powerFlat}`);
  if (m.hitBonus) parts.push(`技能段数 +${m.hitBonus}`);
  if (m.healMult) parts.push(`治疗效果 +${Math.round(m.healMult * 100)}%`);
  return parts.join("，") || "技能强化";
}

function makeStatAffix(stat, value) {
  return {
    type: "stat",
    key: stat,
    value,
    label: "词条",
    text: formatStatAffixText(stat, value),
    bonus: { [stat]: value },
  };
}

function pickStatForAffix(usedStats, opts, rng) {
  let pool = STAT_KEYS.filter((k) => !usedStats.has(k));
  if (!pool.length) pool = STAT_KEYS.slice();
  if (opts.preferDps) {
    const dps = pool.filter((k) => DPS_STAT_KEYS.includes(k));
    if (dps.length && rng() < 0.78) pool = dps;
  } else if (opts.preferTank) {
    const tank = pool.filter((k) => TANK_STAT_KEYS.includes(k));
    if (tank.length && rng() < 0.7) pool = tank;
  }
  return pool[Math.floor(rng() * pool.length)];
}

/**
 * 按品质数量随机词条
 * @param {number} count
 * @param {number} level
 * @param {{ allowSkill?: boolean, forcedSkillMods?: object, preferDps?: boolean, preferTank?: boolean, rng?: () => number }} [opts]
 */
export function rollAffixes(count, level, opts = {}) {
  const n = Math.max(0, Math.floor(count || 0));
  const L = Math.max(1, level || 1);
  const rng = opts.rng || Math.random;
  const affixes = [];
  const usedStats = new Set();
  const usedSkills = new Set();

  if (opts.forcedSkillMods && n > 0) {
    affixes.push(skillAffixFromMods(opts.forcedSkillMods, opts.forcedSkillText));
    usedSkills.add(affixes[0].id);
  }

  while (affixes.length < n) {
    const wantSkill =
      !!opts.allowSkill &&
      usedSkills.size < SKILL_AFFIX_POOL.length &&
      rng() < (opts.forcedSkillMods ? 0.18 : 0.32);

    if (wantSkill) {
      const pool = SKILL_AFFIX_POOL.filter((s) => !usedSkills.has(s.id));
      if (pool.length) {
        const pick = pool[Math.floor(rng() * pool.length)];
        usedSkills.add(pick.id);
        affixes.push(skillAffixFromMods(pick.skillMods, pick.text));
        continue;
      }
    }

    const key = pickStatForAffix(usedStats, opts, rng);
    usedStats.add(key);
    affixes.push(makeStatAffix(key, rollStatValue(key, L, rng)));
  }

  return affixes.slice(0, n);
}

export function skillModsFromAffixes(affixes = []) {
  const sum = { powerMult: 0, powerFlat: 0, hitBonus: 0, healMult: 0 };
  let any = false;
  for (const a of affixes) {
    const m = a?.skillMods;
    if (!m) continue;
    any = true;
    sum.powerMult += m.powerMult || 0;
    sum.powerFlat += m.powerFlat || 0;
    sum.hitBonus += m.hitBonus || 0;
    sum.healMult += m.healMult || 0;
  }
  return any ? sum : null;
}

export function bonusFromParts(primary = {}, affixes = []) {
  const parts = [primary];
  for (const a of affixes) {
    if (a?.bonus) parts.push(a.bonus);
    else if (a?.type === "stat" && a.key) parts.push({ [a.key]: a.value });
  }
  return mergeBonus(...parts);
}

/** 取装备实际加成 */
export function getItemBonus(item) {
  if (!item) return emptyBonus();
  if (item.bonus && Object.keys(item.bonus).length) {
    return mergeBonus(item.bonus);
  }
  const primary = item.primary || primaryFromTemplate(item.baseBonus || {}, itemLevel(item));
  return bonusFromParts(primary, item.affixes || []);
}

export function itemPrice(item) {
  if (!item) return 0;
  if (item.price != null) return Math.max(0, Math.floor(item.price));
  const info = rarityInfo(item.rarity);
  const level = itemLevel(item);
  const bonus = getItemBonus(item);
  const power =
    (bonus.hp || 0) +
    (bonus.atk || 0) * 4 +
    (bonus.def || 0) * 4 +
    (bonus.spd || 0) * 4 +
    (bonus.critRate || 0) * 220 +
    (bonus.critDmg || 0) * 80;
  const affixN = (item.affixes || []).length || affixCountForRarity(item.rarity);
  return Math.max(
    1,
    Math.round((12 + power * 5 + level * 6 + affixN * 14) * (1 + info.rank * 0.25))
  );
}

export function toBagEquip(item) {
  if (!item) return null;
  return {
    ...item,
    kind: "equip",
    qty: 1,
    level: itemLevel(item),
    tint: rarityInfo(item.rarity).color,
  };
}

/**
 * @param {string} name
 * @param {string} slot
 * @param {object} baseBonus L1 主属性模板；空则按部位成长
 * @param {object} extra rarity / level / affixes / skillMods ...
 */
export function makeItem(name, slot, baseBonus = {}, extra = {}) {
  const rarity = normalizeRarity(extra.rarity || "white");
  const level = extra.level != null ? itemLevel({ level: extra.level }) : 1;
  const kind = extra.kind || "";

  let primary =
    extra.primary ||
    (baseBonus && Object.keys(baseBonus).length
      ? primaryFromTemplate(baseBonus, level)
      : slotPrimaryBonus(slot, level, kind));
  primary = applyMilestoneToPrimary(primary, level);

  const maxAffix = affixCountForRarity(rarity);
  let affixes = Array.isArray(extra.affixes)
    ? extra.affixes.slice(0, maxAffix)
    : null;
  if (!affixes) {
    const need = rollAffixCountForRarity(rarity, extra.rng);
    const preferDps =
      slot === "weapon" || slot === "ringL" || slot === "ringR";
    const preferTank =
      slot === "shield" || slot === "armor" || slot === "helmet";
    affixes = rollAffixes(need, level, {
      allowSkill: !!extra.bossOnly || rarityInfo(rarity).rank >= 3,
      forcedSkillMods: extra.skillMods || null,
      forcedSkillText: extra.skillAffixText || null,
      preferDps: !!preferDps,
      preferTank: !preferDps && !!preferTank,
      rng: extra.rng,
    });
  }

  // 若强制技能词条但品质词条数为 0，仍保留在 skillMods（极少见）
  const skillMods =
    skillModsFromAffixes(affixes) ||
    (extra.skillMods ? { ...extra.skillMods } : null);

  const bonus = bonusFromParts(primary, affixes);

  const item = {
    id: extra.id || `${slot}_${name}`,
    name,
    slot,
    rarity,
    level,
    baseBonus: { ...(baseBonus || {}) },
    primary: { ...primary },
    affixes,
    bonus,
    desc: extra.desc || "",
    kind,
    icon: extra.icon || "",
    skillMods,
    bossOnly: !!extra.bossOnly,
  };
  if (extra.uniqueId) {
    item.uniqueId = extra.uniqueId;
    item.skillStrengthen = true;
    item.skillOwner = extra.skillOwner || UNIQUE_SKILL_IDS[extra.uniqueId]?.owner || "";
  } else if (extra.skillStrengthen) {
    item.skillStrengthen = true;
    if (extra.skillOwner) item.skillOwner = extra.skillOwner;
  }
  if (extra.price != null) item.price = extra.price;
  return item;
}

export function sumSkillMods(equip = {}) {
  const sum = { powerMult: 0, powerFlat: 0, hitBonus: 0, healMult: 0 };
  for (const key of SLOT_KEYS) {
    const m = equip[key]?.skillMods;
    if (!m) continue;
    sum.powerMult += m.powerMult || 0;
    sum.powerFlat += m.powerFlat || 0;
    sum.hitBonus += m.hitBonus || 0;
    sum.healMult += m.healMult || 0;
  }
  return sum;
}

export function itemIconUrl(item, opts = {}) {
  // 优先用 index.html 注入的解析（抗手机模块缓存）
  if (typeof window !== "undefined" && typeof window.__itemIconUrl === "function") {
    return window.__itemIconUrl(item, opts);
  }
  if (!item?.icon) return "";
  const raw = String(item.icon);
  if (/^https?:\/\//i.test(raw)) {
    const join = raw.includes("?") ? "&" : "?";
    return `${raw}${join}v=${ITEM_ICON_VER}`;
  }
  // 兼容 "hat.png" / "assets/items/hat.png" / "/assets/items/hat.png"
  let file = raw
    .replace(/^\/+/, "")
    .replace(/^assets\/items\//, "")
    .replace(/^slot\//, "");
  // 默认用 96px 小图（slot/）；opts.full 才拉原图
  const useFull = opts.full === true || opts.compact === false;
  const rel = useFull ? file : `slot/${file}`;
  let url;
  try {
    url = new URL(rel, ITEM_ICON_BASE).href;
  } catch {
    const base = (typeof document !== "undefined" && document.baseURI) || "/";
    url = new URL(`assets/items/${rel}`, base).href;
  }
  const join = url.includes("?") ? "&" : "?";
  return `${url}${join}v=${ITEM_ICON_VER}`;
}

export function formatItemBonus(bonus = {}) {
  const parts = [];
  for (const key of STAT_KEYS) {
    const v = bonus[key] || 0;
    if (!v) continue;
    if (PCT_STAT_KEYS.has(key)) {
      const pct = Math.round(v * 1000) / 10;
      parts.push(`${BONUS_LABEL[key]} +${pct}%`);
    } else {
      parts.push(`${BONUS_LABEL[key]} ${v > 0 ? "+" : ""}${v}`);
    }
  }
  return parts.length ? parts.join("　") : "无属性加成";
}

export function formatPrimaryLine(item) {
  const primary = item?.primary || primaryFromTemplate(item?.baseBonus || {}, itemLevel(item));
  return formatItemBonus(primary);
}

function fixedAffixes(entries) {
  return entries.map((e) => {
    if (e.skillMods) return skillAffixFromMods(e.skillMods, e.text);
    return makeStatAffix(e.key, e.value);
  });
}

function baseGear() {
  return {
    helmet: makeItem("皮帽", "helmet", { def: 1 }, {
      id: "hat",
      rarity: "white",
      level: 1,
      icon: "hat.png",
      desc: "轻便皮帽。主属性随等级成长。",
    }),
    necklace: makeItem("铜坠", "necklace", { hp: 8 }, {
      id: "pendant",
      rarity: "white",
      level: 1,
      icon: "pendant.png",
      desc: "普通铜坠。主属性随等级成长。",
    }),
    armor: makeItem("布衣", "armor", { def: 2, hp: 10 }, {
      id: "cloth",
      rarity: "white",
      level: 1,
      icon: "cloth.png",
      desc: "朴素布衣。主属性随等级成长。",
    }),
    shoes: makeItem("草鞋", "shoes", { spd: 1 }, {
      id: "sandals",
      rarity: "white",
      level: 1,
      icon: "sandals.png",
      desc: "轻便草鞋。主属性随等级成长。",
    }),
    ringL: makeItem("木戒", "ringL", { atk: 1 }, {
      id: "ring",
      rarity: "green",
      level: 1,
      icon: "ring.png",
      desc: "木制戒指。绿装带 1 条词条。",
      affixes: fixedAffixes([{ key: "hp", value: 5 }]),
    }),
    ringR: null,
  };
}

export function createDefaultEquip(statsId = "omni") {
  const gear = baseGear();
  if (statsId === "pink") {
    return {
      ...gear,
      weapon: makeItem("手枪", "weapon", { atk: 5, spd: 1 }, {
        id: "pistol",
        kind: "手枪",
        rarity: "blue",
        level: 1,
        icon: "pistol.png",
        desc: "轻巧手枪。蓝装带 2 条词条。",
        affixes: fixedAffixes([
          { key: "atk", value: 1 },
          { key: "spd", value: 1 },
        ]),
      }),
      shield: makeItem("皮套", "shield", { def: 1 }, {
        id: "holster",
        rarity: "white",
        level: 1,
        icon: "holster.png",
        desc: "枪套改制的护具。",
      }),
    };
  }
  if (statsId === "green") {
    return {
      ...gear,
      weapon: makeItem("法杖", "weapon", { atk: 2, hp: 12 }, {
        id: "staff",
        kind: "法杖",
        rarity: "green",
        level: 1,
        icon: "staff.png",
        desc: "治愈用法杖。绿装带 1 条词条。",
        affixes: fixedAffixes([{ key: "hp", value: 6 }]),
      }),
      shield: makeItem("翠枝盾", "shield", { def: 1, hp: 6 }, {
        id: "vine_shield",
        rarity: "green",
        level: 1,
        icon: "vine_shield.png",
        desc: "藤枝编成的小盾。绿装带 1 条词条。",
        affixes: fixedAffixes([{ key: "def", value: 1 }]),
      }),
    };
  }
  if (statsId === "yellow") {
    return {
      ...gear,
      weapon: makeItem("短剑", "weapon", { atk: 3 }, {
        id: "sword_yellow",
        kind: "剑",
        rarity: "white",
        level: 1,
        icon: "sword.png",
        desc: "坦克配刀。白装无额外词条。",
      }),
      shield: makeItem("木盾", "shield", { def: 4, hp: 8 }, {
        id: "wood_shield_yellow",
        rarity: "green",
        level: 1,
        icon: "wood_shield.png",
        desc: "厚实木盾。绿装带 1 条词条。",
        affixes: fixedAffixes([{ key: "def", value: 2 }]),
      }),
      armor: makeItem("布衣", "armor", { def: 3, hp: 14 }, {
        id: "cloth_yellow",
        rarity: "green",
        level: 1,
        icon: "cloth.png",
        desc: "厚实布甲。绿装带 1 条词条。",
        affixes: fixedAffixes([{ key: "hp", value: 8 }]),
      }),
    };
  }
  return {
    ...gear,
    weapon: makeItem("短剑", "weapon", { atk: 4 }, {
      id: "sword",
      kind: "剑",
      rarity: "white",
      level: 1,
      icon: "sword.png",
      desc: "趁手短剑。白装无额外词条。",
    }),
    shield: makeItem("木盾", "shield", { def: 2 }, {
      id: "wood_shield",
      rarity: "white",
      level: 1,
      icon: "wood_shield.png",
      desc: "木制圆盾。白装无额外词条。",
    }),
  };
}

export function sumEquipBonus(equip) {
  const sum = emptyBonus();
  for (const key of SLOT_KEYS) {
    const item = equip[key];
    if (!item) continue;
    const bonus = getItemBonus(item);
    for (const k of STAT_KEYS) sum[k] += bonus[k] || 0;
  }
  return sum;
}
