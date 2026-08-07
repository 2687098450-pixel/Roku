/**
 * 装备系统
 * - 等级 → 主属性数值（层数对应等级）
 * - 品质 → 词条数量（白0 / 绿1 / 蓝2 / 紫3 / 橙4 / 红5）
 */

import { scaleGoldGain } from "../../core/economy.js?v=160";

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
  hitRate: "命中",
  dodgeRate: "闪避",
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
const STAT_KEYS = ["hp", "atk", "def", "spd", "critRate", "critDmg", "hitRate", "dodgeRate"];
const PCT_STAT_KEYS = new Set(["critRate", "critDmg", "hitRate", "dodgeRate"]);
const DPS_STAT_KEYS = ["atk", "spd", "critRate", "critDmg", "hitRate"];
const TANK_STAT_KEYS = ["hp", "def", "spd", "dodgeRate"];
const SUPPORT_STAT_KEYS = ["spd", "hp", "hitRate", "dodgeRate"];

/** 属性词条成长（随装备等级；暴击/命中/闪避为小数比例） */
const STAT_AFFIX_GROWTH = {
  hp: { base: 4, perLevel: 2.2 },
  atk: { base: 1, perLevel: 0.42 },
  def: { base: 1, perLevel: 0.38 },
  spd: { base: 0.5, perLevel: 0.1 },
  critRate: { base: 0.012, perLevel: 0.0035 },
  critDmg: { base: 0.04, perLevel: 0.01 },
  hitRate: { base: 0.04, perLevel: 0.008 },
  dodgeRate: { base: 0.02, perLevel: 0.005 },
};

/** 技能词条池（高品质 / Boss）；不含「技能回响」（红装饰品特殊） */
const SKILL_AFFIX_POOL = [
  { id: "pwr_pct", skillMods: { powerMult: 0.1 }, text: "技能伤害 +10%" },
  { id: "pwr_pct2", skillMods: { powerMult: 0.15 }, text: "技能伤害 +15%" },
  { id: "pwr_flat", skillMods: { powerFlat: 4 }, text: "技能伤害 +4" },
  { id: "pwr_flat2", skillMods: { powerFlat: 8 }, text: "技能伤害 +8" },
  { id: "heal", skillMods: { healMult: 0.15 }, text: "治疗效果 +15%" },
  { id: "heal2", skillMods: { healMult: 0.25 }, text: "治疗效果 +25%" },
  { id: "stun_hit", skillMods: { stunChance: 0.18 }, text: "伤害附带眩晕 18%" },
  { id: "slow_hit", skillMods: { slowChance: 0.22, slowPower: 0.25 }, text: "伤害附带减速 22%" },
  { id: "silence_hit", skillMods: { silenceChance: 0.12 }, text: "伤害附带禁魔 12%" },
  {
    id: "healcut_hit",
    skillMods: { healCutChance: 0.2, healCutPower: 0.4 },
    text: "伤害附带减疗 20%",
  },
  { id: "self_haste", skillMods: { selfHaste: 0.2 }, text: "施法后增速 20%" },
  { id: "self_dodge", skillMods: { selfDodge: 0.12 }, text: "施法后闪避 +12%" },
  { id: "self_hit", skillMods: { selfHit: 0.1 }, text: "施法后命中 +10%" },
  {
    id: "gauge_hp1",
    skillMods: { gaugeHpPer10: 0.008 },
    text: "行动回血：每 10 行动回复最大生命 0.8%",
  },
  {
    id: "gauge_hp2",
    skillMods: { gaugeHpPer10: 0.015 },
    text: "行动回血：每 10 行动回复最大生命 1.5%",
  },
  {
    id: "gauge_vital",
    skillMods: { gaugeHpPer10: 0.01 },
    text: "行动调息：每 10 行动回复最大生命 1%",
  },
];

/** 红装戒指/项链特殊词条：多释放 1 次，伤害 ×60% */
export const CAST_ECHO_AFFIX = {
  type: "skill",
  id: "cast_echo",
  skillMods: { hitBonus: 1, hitDamageMult: 0.6 },
  text: "技能回响",
  label: "特殊",
  detail: "技能多释放 1 次，每次伤害变为原来的 60%。",
};

/** 橙/红装特殊词条：全技能等级 +1 */
export const SKILL_LEVEL_AFFIX = {
  type: "skill",
  id: "skill_level",
  skillMods: { skillLevel: 1 },
  text: "技能等级 +1",
  label: "特殊",
  detail: "穿戴时全部技能等级 +1（与技能点升级叠加；加点上限仍为 10，装备加成可超过 10）。",
};

const CAST_ECHO_SLOTS = new Set(["necklace", "ringL", "ringR"]);
const CAST_ECHO_CHANCE = 0.05;
const SKILL_LEVEL_CHANCE = 0.05;
const RING_EXTRA_AFFIXES = 2;

export function isRingSlot(slot) {
  return slot === "ringL" || slot === "ringR";
}

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
 * 全能/小黄/小青：任意；小粉/小橙：仅枪械；小绿/小蓝：仅法杖
 */
export function canHeroEquipItem(hero, item, slotKey = item?.slot) {
  if (!hero || !item || !canEquipInSlot(item, slotKey)) return false;
  const isWeapon =
    slotKey === "weapon" || item.slot === "weapon";
  if (!isWeapon) return true;
  const id = hero.statsId;
  if (id === "omni" || id === "yellow" || id === "cyan") return true;
  const cls = weaponClass(item);
  if (id === "pink" || id === "orange") return cls === "gun";
  if (id === "green" || id === "blue") return cls === "staff";
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
      "强化小粉普通攻击「爆裂矢」：释放 3 段，击杀额外再释放 1 段。段伤倍率已直接写入技能说明；若再有「技能回响」，段数+1 且段伤再×60%。仅小粉装备时生效。",
  },
  omni_balance_spirit: {
    owner: "omni",
    skillId: "boost",
    name: "强化均衡",
    detail:
      "强化全能「均衡」：全体友军共享属性；自身灵体（不造成/不受伤害）；震地眩晕减半。仅全能装备时生效。",
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
      "强化小黄「反伤」：由仅反击伤害来源，改为对全体其他单位生效；友军按较低比例结算，且该比例再降低 10%（更快转入治疗）。仅小黄装备时生效。",
  },
  green_mend_pulse: {
    name: "强化治疗脉动",
    detail:
      "任意治疗效果都会给目标附加 200 行动条脉动——按治疗者行动条推进：每累计走 10，目标流失约等于本次治疗量 20% 的血；再累计走到 20，按刚流失量的 2.5 倍回血。与「雾林春芽戒」为孪生掉落。穿戴者治疗技能说明会同步标注。",
  },
  green_spring_bloom: {
    name: "开场春芽",
    detail:
      "开场自动释放一次 10% 效果的「春芽绽放」全体治疗（任意职业可触发）。治疗量按队伍中小绿的春芽技能等级结算，施法者用自身攻击。穿戴时大幅缩短治疗技能动画。与「雾林脉动戒」为孪生掉落。",
  },
  blue_freeze_lock: {
    owner: "blue",
    skillId: "blue_freeze",
    name: "强化寒锁",
    detail:
      "强化小蓝「寒锁」：眩晕行动条更长，并附加减速。仅小蓝装备时生效。",
  },
  orange_blaze_ember: {
    owner: "orange",
    skillId: "orange_blaze",
    name: "强化烬焚",
    detail:
      "强化小橙「烬焚」：脉动灼烧更痛、更久（按施法者行动条，每 10 跳一次）。仅小橙装备时生效。",
  },
  cyan_tailwind_gale: {
    owner: "cyan",
    skillId: "cyan_tailwind",
    name: "强化疾风",
    detail:
      "强化小青「疾风」：全队增速更强、更久，并附加命中提升。仅小青装备时生效。",
  },
  cyan_cut_gale: {
    owner: "cyan",
    skillId: "cyan_cut",
    name: "强化风刃",
    detail:
      "强化小青「风刃」：附魔友方下次整段技能——多段每段追加小青攻击×10%（最多段数初始3，每两级+1）；单次伤害（含群伤一次结算）追加攻击×80%起，每级+10%。开局自动释放风刃。仅小青装备时生效。",
  },
  status_weave_ring: {
    name: "织律之戒",
    detail:
      "增益与减益类技能取消瞬伤；效果强度+20%；大幅缩短该类技能动画（与春芽戒同级）。任意职业可触发。",
  },
};

export function uniqueAffixName(uniqueId) {
  const meta = UNIQUE_SKILL_IDS[uniqueId];
  return meta?.name || meta?.text || "唯一词条";
}

export function uniqueAffixDetail(uniqueId) {
  const meta = UNIQUE_SKILL_IDS[uniqueId];
  const base = meta?.detail || meta?.name || meta?.text || "暂无说明。";
  return `${base}（同一角色多个相同唯一词条仅生效一个。）`;
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

/** 仅橙装 / 红装可用金币强化 */
export const UPGRADEABLE_RARITIES = ["orange", "red"];
export const MAX_EQUIP_LEVEL = 100;
/** 第一次强化 100 金，之后每次 +100 */
export const ENHANCE_COST_STEP = 100;

export function itemEnhanceCount(item) {
  const n = Number(item?.enhanceCount);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

/** 掉落/吞噬用的基础等级（不含强化次数） */
export function itemBaseLevel(item) {
  return Math.max(1, itemLevel(item) - itemEnhanceCount(item));
}

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

/** 强化消耗：按已强化次数，与装备绝对等级无关。第 n 次强化 = n×100 金 */
export function upgradeEquipCost(item) {
  if (!item) return 0;
  const nextEnhance = itemEnhanceCount(item) + 1;
  return Math.max(ENHANCE_COST_STEP, nextEnhance * ENHANCE_COST_STEP);
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
    if (a.id === "cast_echo") {
      a.text = CAST_ECHO_AFFIX.text;
      a.label = CAST_ECHO_AFFIX.label;
      a.detail = CAST_ECHO_AFFIX.detail;
    } else if (a.id === "skill_level") {
      a.text = SKILL_LEVEL_AFFIX.text;
      a.label = SKILL_LEVEL_AFFIX.label;
      a.detail = SKILL_LEVEL_AFFIX.detail;
    } else {
      a.text = formatSkillModsText(a.skillMods);
    }
  }
}

/** 按当前等级重算主属性与合计加成 */
export function rebuildEquipStats(item) {
  if (!item) return item;
  const level = itemLevel(item);
  const kind = item.kind && item.kind !== "equip" ? item.kind : "";
  let primary = {};
  if (!isRingSlot(item.slot)) {
    primary =
      item.baseBonus && Object.keys(item.baseBonus).length
        ? primaryFromTemplate(item.baseBonus, level)
        : slotPrimaryBonus(item.slot, level, kind);
    primary = applyMilestoneToPrimary(primary, level);
  } else {
    item.baseBonus = {};
  }
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
  const max = affixCountForRarity(item.rarity || "red", item.slot);
  if (!Array.isArray(item.affixes)) item.affixes = [];
  if (item.affixes.length >= max) return;
  const ring = isRingSlot(item.slot);
  const used = new Set(
    ring
      ? []
      : item.affixes.filter((a) => a.type === "stat" && a.key).map((a) => a.key)
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
    const key = pickStatForAffix(
      used,
      { preferDps, preferTank: !preferDps && preferTank },
      rng
    );
    if (!ring) used.add(key);
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
  item.enhanceCount = itemEnhanceCount(item) + 1;
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
      if (m.gaugeHpPer10) {
        m.gaugeHpPer10 = +(m.gaugeHpPer10 + 0.002).toFixed(4);
      }
      // 技能回响不随强化叠段数
      if (a.id !== "cast_echo" && m.hitBonus && !m.hitDamageMult && next % 20 === 0) {
        m.hitBonus += 1;
      }
      // 旧版回蓝词条：强化时清掉，不再成长
      if (m.gaugeMpOnAct != null || m.gaugeMpPer10 != null) {
        delete m.gaugeMpOnAct;
        delete m.gaugeMpPer10;
      }
      refreshAffixText(a);
    }
  }

  rebuildEquipStats(item);
  return {
    ok: true,
    cost,
    level: next,
    enhanceCount: item.enhanceCount,
    milestone,
  };
}

/** 红装吞噬：消耗两件更高红装，等级取二者中较低者，强化次数清零并重算词条数值 */
export function canDevourRedEquip(host, matA, matB) {
  if (!host || !matA || !matB) return { ok: false, reason: "材料不足" };
  if (normalizeRarity(host.rarity) !== "red") {
    return { ok: false, reason: "仅红装可吞噬" };
  }
  if (normalizeRarity(matA.rarity) !== "red" || normalizeRarity(matB.rarity) !== "red") {
    return { ok: false, reason: "材料须为红装" };
  }
  if (matA === host || matB === host || matA === matB) {
    return { ok: false, reason: "材料无效" };
  }
  const hv = itemBaseLevel(host);
  if (itemBaseLevel(matA) <= hv || itemBaseLevel(matB) <= hv) {
    return { ok: false, reason: "只能吞噬基础等级更高的红装（不含强化）" };
  }
  return { ok: true };
}

export function devourRedEquip(host, matA, matB, rng = Math.random) {
  const check = canDevourRedEquip(host, matA, matB);
  if (!check.ok) return check;
  // 取两件材料基础等级的较低者，且不低于宿主当前等级（强化可之后重做）
  const newLv = Math.max(
    itemLevel(host),
    Math.min(itemBaseLevel(matA), itemBaseLevel(matB))
  );
  host.level = Math.min(MAX_EQUIP_LEVEL, newLv);
  host.enhanceCount = 0;
  for (const a of host.affixes || []) {
    if (!a) continue;
    if (a.type === "unique" || a.id === "cast_echo" || a.id === "skill_level") {
      continue;
    }
    if (a.type === "stat" && a.key) {
      a.value = rollStatValue(a.key, host.level, rng);
      refreshAffixText(a);
      continue;
    }
    if (a.type === "skill" && a.skillMods) {
      const base = SKILL_AFFIX_POOL.find((p) => p.id === a.id);
      if (base?.skillMods) {
        a.skillMods = { ...base.skillMods };
        a.text = base.text || formatSkillModsText(a.skillMods);
      }
      refreshAffixText(a);
    }
  }
  rebuildEquipStats(host);
  return { ok: true, level: host.level };
}

/** 第 N 层掉落 → 等级 N；Boss 战利品高 1 级；封顶 MAX_EQUIP_LEVEL */
export function floorItemLevel(floor, { boss = false } = {}) {
  const f = Math.max(1, Math.floor(floor || 1));
  const lv = boss ? f + 1 : f;
  return Math.min(MAX_EQUIP_LEVEL, lv);
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

export function affixRangeForRarity(rarity, slot = null) {
  const id = normalizeRarity(rarity);
  const raw = AFFIX_COUNT[id];
  let min;
  let max;
  if (raw == null) {
    const n = rarityInfo(id).affixes ?? 0;
    min = n;
    max = n;
  } else if (typeof raw === "number") {
    min = raw;
    max = raw;
  } else {
    min = Math.max(0, Math.floor(raw.min ?? 0));
    max = Math.max(min, Math.floor(raw.max ?? min));
  }
  if (isRingSlot(slot)) {
    min += RING_EXTRA_AFFIXES;
    max += RING_EXTRA_AFFIXES;
  }
  return { min, max };
}

/** 展示用：该品质词条上限（戒指额外 +2） */
export function affixCountForRarity(rarity, slot = null) {
  return affixRangeForRarity(rarity, slot).max;
}

/** 生成装备时：在品质区间内随机词条数 */
export function rollAffixCountForRarity(rarity, rng = Math.random, slot = null) {
  const { min, max } = affixRangeForRarity(rarity, slot);
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
          spd: Math.max(1, Math.round(0.4 + L * 0.12)),
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
      return { spd: Math.max(1, Math.round(0.5 + L * 0.18)) };
    case "necklace":
      return { hp: Math.round(8 + L * 3.8) };
    case "ringL":
    case "ringR":
      return {};
    default:
      return { hp: Math.round(4 + L * 1.5) };
  }
}

function emptyBonus() {
  return {
    hp: 0,
    atk: 0,
    def: 0,
    spd: 0,
    critRate: 0,
    critDmg: 0,
    hitRate: 0,
    dodgeRate: 0,
  };
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
  const m = skillMods || {};
  if (m.hitBonus && m.hitDamageMult) {
    const echo = makeCastEchoAffix();
    echo.skillMods = {
      hitBonus: m.hitBonus || 1,
      hitDamageMult: m.hitDamageMult,
    };
    if (text) echo.text = text;
    return echo;
  }
  return {
    type: "skill",
    id: `skill_${Object.keys(m).join("_")}`,
    skillMods: { ...m },
    text: text || formatSkillModsText(m),
    label: "词条",
  };
}

function formatSkillModsText(m = {}) {
  const parts = [];
  if (m.hitBonus && m.hitDamageMult) {
    parts.push(`技能回响：多释放 ${m.hitBonus} 次，伤害×${Math.round(m.hitDamageMult * 100)}%`);
  } else {
    if (m.skillLevel) parts.push(`技能等级 +${m.skillLevel}`);
    if (m.powerMult) parts.push(`技能伤害 +${Math.round(m.powerMult * 100)}%`);
    if (m.powerFlat) parts.push(`技能伤害 +${m.powerFlat}`);
    if (m.hitBonus) parts.push(`技能多释放 +${m.hitBonus}`);
    if (m.hitDamageMult && m.hitDamageMult !== 1) {
      parts.push(`技能伤害×${Math.round(m.hitDamageMult * 100)}%`);
    }
    if (m.healMult) parts.push(`治疗效果 +${Math.round(m.healMult * 100)}%`);
    if (m.stunChance) parts.push(`伤害附带眩晕 ${Math.round(m.stunChance * 100)}%`);
    if (m.slowChance) parts.push(`伤害附带减速 ${Math.round(m.slowChance * 100)}%`);
    if (m.silenceChance) parts.push(`伤害附带禁魔 ${Math.round(m.silenceChance * 100)}%`);
    if (m.healCutChance) parts.push(`伤害附带减疗 ${Math.round(m.healCutChance * 100)}%`);
    if (m.selfHaste) parts.push(`施法后增速 ${Math.round(m.selfHaste * 100)}%`);
    if (m.selfDodge) parts.push(`施法后闪避 +${Math.round(m.selfDodge * 100)}%`);
    if (m.selfHit) parts.push(`施法后命中 +${Math.round(m.selfHit * 100)}%`);
    if (m.gaugeHpPer10) {
      const pct = Math.round(m.gaugeHpPer10 * 1000) / 10;
      parts.push(`每 10 行动回复最大生命 ${pct}%`);
    }
  }
  return parts.join("，") || "技能强化";
}

export function makeCastEchoAffix() {
  return {
    type: CAST_ECHO_AFFIX.type,
    id: CAST_ECHO_AFFIX.id,
    skillMods: { ...CAST_ECHO_AFFIX.skillMods },
    text: CAST_ECHO_AFFIX.text,
    label: CAST_ECHO_AFFIX.label,
    detail: CAST_ECHO_AFFIX.detail,
  };
}

export function makeSkillLevelAffix() {
  return {
    type: SKILL_LEVEL_AFFIX.type,
    id: SKILL_LEVEL_AFFIX.id,
    skillMods: { ...SKILL_LEVEL_AFFIX.skillMods },
    text: SKILL_LEVEL_AFFIX.text,
    label: SKILL_LEVEL_AFFIX.label,
    detail: SKILL_LEVEL_AFFIX.detail,
  };
}

function replaceNonUniqueAffix(list, affix) {
  if (!list.length) return [affix];
  let idx = list.findIndex(
    (a) => a?.type === "skill" && a?.id !== "cast_echo" && a?.id !== "skill_level" && !a?.uniqueId
  );
  if (idx < 0) {
    idx = list
      .map((a, i) => (!a?.uniqueId && a?.type !== "unique" ? i : -1))
      .filter((i) => i >= 0)
      .pop();
  }
  if (idx == null || idx < 0) idx = list.length - 1;
  const next = list.slice();
  next[idx] = affix;
  return next;
}

/** 红装戒指/项链：5% 概率替换一条词条为技能回响（每件最多 1） */
export function maybeApplyCastEchoAffix(affixes, { rarity, slot, rng = Math.random } = {}) {
  const list = Array.isArray(affixes) ? affixes.slice() : [];
  if (normalizeRarity(rarity) !== "red") return list;
  if (!CAST_ECHO_SLOTS.has(slot)) return list;
  if (list.some((a) => a?.id === "cast_echo" || a?.skillMods?.hitDamageMult)) return list;
  if (rng() >= CAST_ECHO_CHANCE) return list;
  return replaceNonUniqueAffix(list, makeCastEchoAffix());
}

/** 橙/红装：5% 概率替换一条词条为技能等级 +1（每件最多 1） */
export function maybeApplySkillLevelAffix(affixes, { rarity, rng = Math.random } = {}) {
  const list = Array.isArray(affixes) ? affixes.slice() : [];
  const r = normalizeRarity(rarity);
  if (r !== "orange" && r !== "red") return list;
  if (list.some((a) => a?.id === "skill_level" || a?.skillMods?.skillLevel)) return list;
  if (rng() >= SKILL_LEVEL_CHANCE) return list;
  return replaceNonUniqueAffix(list, makeSkillLevelAffix());
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
  } else if (opts.preferSupport) {
    const support = pool.filter((k) => SUPPORT_STAT_KEYS.includes(k));
    if (support.length && rng() < 0.72) pool = support;
  }
  return pool[Math.floor(rng() * pool.length)];
}

/**
 * 按品质数量随机词条
 * 戒指：允许同名属性/状态词条重复（攻防速、附带眩晕等可叠多条）
 * @param {number} count
 * @param {number} level
 * @param {{ allowSkill?: boolean, forcedSkillMods?: object, preferDps?: boolean, preferTank?: boolean, rng?: () => number, rarity?: string, slot?: string, allowDuplicateAffixes?: boolean }} [opts]
 */
export function rollAffixes(count, level, opts = {}) {
  const n = Math.max(0, Math.floor(count || 0));
  const L = Math.max(1, level || 1);
  const rng = opts.rng || Math.random;
  const allowDup =
    opts.allowDuplicateAffixes != null
      ? !!opts.allowDuplicateAffixes
      : isRingSlot(opts.slot);
  const affixes = [];
  const usedStats = new Set();
  const usedSkills = new Set();

  if (opts.forcedSkillMods && n > 0) {
    affixes.push(skillAffixFromMods(opts.forcedSkillMods, opts.forcedSkillText));
    usedSkills.add(affixes[0].id);
  }

  while (affixes.length < n) {
    const skillChance = opts.forcedSkillMods ? 0.18 : allowDup ? 0.36 : 0.32;
    const wantSkill =
      !!opts.allowSkill &&
      (allowDup || usedSkills.size < SKILL_AFFIX_POOL.length) &&
      rng() < skillChance;

    if (wantSkill) {
      const pool = allowDup
        ? SKILL_AFFIX_POOL.slice()
        : SKILL_AFFIX_POOL.filter((s) => !usedSkills.has(s.id));
      if (pool.length) {
        const pick = pool[Math.floor(rng() * pool.length)];
        if (!allowDup) usedSkills.add(pick.id);
        affixes.push(skillAffixFromMods(pick.skillMods, pick.text));
        continue;
      }
    }

    const key = pickStatForAffix(allowDup ? new Set() : usedStats, opts, rng);
    if (!allowDup) usedStats.add(key);
    affixes.push(makeStatAffix(key, rollStatValue(key, L, rng)));
  }

  return maybeApplySkillLevelAffix(
    maybeApplyCastEchoAffix(affixes.slice(0, n), {
      rarity: opts.rarity,
      slot: opts.slot,
      rng,
    }),
    { rarity: opts.rarity, rng }
  );
}

export function skillModsFromAffixes(affixes = []) {
  const sum = blankSkillModsSum();
  let any = false;
  let hasHitScale = false;
  for (const a of affixes) {
    const m = a?.skillMods;
    if (!m) continue;
    any = true;
    mergeSkillModsInto(sum, m);
    if (m.hitDamageMult != null && m.hitDamageMult !== 1) hasHitScale = true;
  }
  if (!hasHitScale) delete sum.hitDamageMult;
  return any ? sum : null;
}

function blankSkillModsSum() {
  return {
    powerMult: 0,
    powerFlat: 0,
    hitBonus: 0,
    healMult: 0,
    hitDamageMult: 1,
    skillLevel: 0,
    stunChance: 0,
    stunGauge: 0,
    slowChance: 0,
    slowPower: 0,
    silenceChance: 0,
    healCutChance: 0,
    healCutPower: 0,
    selfHaste: 0,
    selfDodge: 0,
    selfHit: 0,
    gaugeHpPer10: 0,
  };
}

function mergeSkillModsInto(sum, m) {
  sum.powerMult += m.powerMult || 0;
  sum.powerFlat += m.powerFlat || 0;
  sum.hitBonus += m.hitBonus || 0;
  sum.healMult += m.healMult || 0;
  sum.skillLevel += m.skillLevel || 0;
  if (m.hitDamageMult != null && m.hitDamageMult !== 1) {
    sum.hitDamageMult *= m.hitDamageMult;
  }
  sum.stunChance += m.stunChance || 0;
  sum.stunGauge = Math.max(sum.stunGauge || 0, m.stunGauge || 0);
  sum.slowChance += m.slowChance || 0;
  sum.slowPower = Math.max(sum.slowPower || 0, m.slowPower || 0);
  sum.silenceChance += m.silenceChance || 0;
  sum.healCutChance += m.healCutChance || 0;
  sum.healCutPower = Math.max(sum.healCutPower || 0, m.healCutPower || 0);
  sum.selfHaste = Math.max(sum.selfHaste || 0, m.selfHaste || 0);
  sum.selfDodge = Math.max(sum.selfDodge || 0, m.selfDodge || 0);
  sum.selfHit = Math.max(sum.selfHit || 0, m.selfHit || 0);
  sum.gaugeHpPer10 += m.gaugeHpPer10 || 0;
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
  if (item.price != null) return Math.max(0, scaleGoldGain(item.price));
  const info = rarityInfo(item.rarity);
  const level = itemLevel(item);
  const bonus = getItemBonus(item);
  const power =
    (bonus.hp || 0) +
    (bonus.atk || 0) * 4 +
    (bonus.def || 0) * 4 +
    (bonus.spd || 0) * 4 +
    (bonus.critRate || 0) * 220 +
    (bonus.critDmg || 0) * 80 +
    (bonus.hitRate || 0) * 180 +
    (bonus.dodgeRate || 0) * 220;
  const affixN = (item.affixes || []).length || affixCountForRarity(item.rarity, item.slot);
  const raw = Math.max(
    1,
    Math.round((12 + power * 5 + level * 6 + affixN * 14) * (1 + info.rank * 0.25))
  );
  return Math.max(1, scaleGoldGain(raw));
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
  const ring = isRingSlot(slot);
  const templateBonus = ring ? {} : baseBonus || {};

  let primary = {};
  if (!ring) {
    primary =
      extra.primary ||
      (templateBonus && Object.keys(templateBonus).length
        ? primaryFromTemplate(templateBonus, level)
        : slotPrimaryBonus(slot, level, kind));
    primary = applyMilestoneToPrimary(primary, level);
  }

  const maxAffix = affixCountForRarity(rarity, slot);
  let affixes = Array.isArray(extra.affixes)
    ? extra.affixes.slice(0, maxAffix)
    : null;
  if (!affixes) {
    const need = rollAffixCountForRarity(rarity, extra.rng, slot);
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
      rarity,
      slot,
    });
  } else if (extra.affixes) {
    affixes = maybeApplySkillLevelAffix(
      maybeApplyCastEchoAffix(affixes, {
        rarity,
        slot,
        rng: extra.rng || Math.random,
      }),
      { rarity, rng: extra.rng || Math.random }
    ).slice(0, maxAffix);
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
    enhanceCount: Math.max(0, Math.floor(Number(extra.enhanceCount) || 0)),
    baseBonus: { ...templateBonus },
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
  const sum = blankSkillModsSum();
  let hasHitScale = false;
  for (const key of SLOT_KEYS) {
    const m = equip[key]?.skillMods;
    if (!m) continue;
    mergeSkillModsInto(sum, m);
    if (m.hitDamageMult != null && m.hitDamageMult !== 1) hasHitScale = true;
  }
  if (!hasHitScale) delete sum.hitDamageMult;
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
    ringL: makeItem("木戒", "ringL", {}, {
      id: "ring",
      rarity: "green",
      level: 1,
      icon: "ring.png",
      desc: "木制戒指。绿戒额外词条。",
      affixes: fixedAffixes([
        { key: "hp", value: 5 },
        { key: "atk", value: 1 },
      ]),
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
  if (statsId === "blue") {
    return {
      ...gear,
      weapon: makeItem("法杖", "weapon", { atk: 3, hp: 8 }, {
        id: "staff_blue",
        kind: "法杖",
        rarity: "green",
        level: 1,
        icon: "staff.png",
        desc: "霜语法杖。绿装带 1 条词条。",
        affixes: fixedAffixes([{ key: "def", value: 1 }]),
      }),
      shield: makeItem("翠枝盾", "shield", { def: 2, hp: 4 }, {
        id: "vine_shield_blue",
        rarity: "white",
        level: 1,
        icon: "vine_shield.png",
        desc: "轻便藤盾。",
      }),
    };
  }
  if (statsId === "orange") {
    return {
      ...gear,
      weapon: makeItem("手枪", "weapon", { atk: 5, spd: 1 }, {
        id: "pistol_orange",
        kind: "手枪",
        rarity: "green",
        level: 1,
        icon: "pistol.png",
        desc: "烬火佩枪。绿装带 1 条词条。",
        affixes: fixedAffixes([{ key: "atk", value: 1 }]),
      }),
      shield: makeItem("皮套", "shield", { def: 1 }, {
        id: "holster_orange",
        rarity: "white",
        level: 1,
        icon: "holster.png",
        desc: "轻护腕。",
      }),
    };
  }
  if (statsId === "cyan") {
    return {
      ...gear,
      weapon: makeItem("短剑", "weapon", { atk: 3, spd: 1 }, {
        id: "sword_cyan",
        kind: "剑",
        rarity: "green",
        level: 1,
        icon: "sword.png",
        desc: "疾风短刃。绿装带 1 条词条。",
        affixes: fixedAffixes([{ key: "spd", value: 1 }]),
      }),
      shoes: makeItem("草鞋", "shoes", { spd: 2 }, {
        id: "sandals_cyan",
        rarity: "green",
        level: 1,
        icon: "sandals.png",
        desc: "疾行草鞋。绿装带 1 条词条。",
        affixes: fixedAffixes([{ key: "spd", value: 1 }]),
      }),
      shield: makeItem("皮套", "shield", { def: 1 }, {
        id: "holster_cyan",
        rarity: "white",
        level: 1,
        icon: "holster.png",
        desc: "轻便护具。",
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
