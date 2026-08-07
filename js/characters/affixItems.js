/** 词条背包道具 & 红装词条替换 / 凝炼 */

import {
  normalizeRarity,
  rebuildEquipStats,
  UNIQUE_SKILL_IDS,
  uniqueAffixName,
  uniqueAffixDetail,
} from "./omni/equipment.js?v=160";

export const AFFIX_CONDENSE_USE_ID = "affix_condense";

export function isAffixItem(item) {
  return !!(item && (item.kind === "affix" || item.affix));
}

export function cloneAffix(affix) {
  if (!affix) return null;
  try {
    return JSON.parse(JSON.stringify(affix));
  } catch {
    return { ...affix };
  }
}

export function affixDisplayName(affix) {
  if (!affix) return "词条";
  if (affix.type === "unique" || affix.uniqueId) {
    return uniqueAffixName(affix.uniqueId || affix.id) || affix.text || "唯一词条";
  }
  return affix.text || affix.label || "词条";
}

export function affixDisplayDetail(affix) {
  if (!affix) return "";
  if (affix.detail) return affix.detail;
  if (affix.type === "unique" || affix.uniqueId) {
    return uniqueAffixDetail(affix.uniqueId || affix.id) || "唯一词条。";
  }
  return `词条：${affixDisplayName(affix)}。可在红装上替换已有词条；被替换下来的词条会消失。`;
}

/** 从装备词条生成背包道具 */
export function makeAffixBagItem(affix) {
  const a = cloneAffix(affix);
  const name = affixDisplayName(a);
  const unique = a?.type === "unique" || !!a?.uniqueId;
  return {
    id: `affix_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    name,
    kind: "affix",
    qty: 1,
    tint: unique ? "#e23d4a" : "#c9a227",
    desc: affixDisplayDetail(a),
    affix: a,
  };
}

export function makeAffixCondenser(qty = 1) {
  return {
    id: "affix_condenser",
    name: "词条凝炼器",
    kind: "tool",
    useId: AFFIX_CONDENSE_USE_ID,
    qty: Math.max(1, Math.floor(qty) || 1),
    tint: "#8b6bc9",
    desc: "打开背包中的红装，点击「词条凝炼」：选一条词条后装备消失，词条进入背包，可供红装词条替换使用。",
  };
}

export function isPermanentTool(item) {
  if (!item) return false;
  if (item.useId === "phone_dial" || item.id === "phone") return true;
  if (item.useId === "warp_refresh") return true;
  return false;
}

/** 道具整理优先级：越小越靠前 */
export function toolSortPriority(item) {
  if (!item) return 99;
  if (isPermanentTool(item)) return 0;
  if (item.useId === AFFIX_CONDENSE_USE_ID) return 1;
  if (isAffixItem(item)) return 2;
  if (item.kind === "consumable") return 4;
  if (item.kind === "material") return 5;
  return 3;
}

/** 根据词条列表同步装备 uniqueId / skillStrengthen */
export function syncItemUniqueFromAffixes(item) {
  if (!item) return item;
  const list = item.affixes || [];
  const u = list.find(
    (a) => a && (a.type === "unique" || (a.uniqueId && UNIQUE_SKILL_IDS[a.uniqueId]))
  );
  if (u) {
    const uid = u.uniqueId || u.id;
    item.uniqueId = uid;
    item.skillStrengthen = true;
    const meta = UNIQUE_SKILL_IDS[uid];
    if (meta?.owner != null) item.skillOwner = meta.owner;
    u.type = "unique";
    u.uniqueId = uid;
    if (meta?.name || meta?.text) u.text = meta.name || meta.text;
  } else {
    delete item.uniqueId;
    item.skillStrengthen = false;
    delete item.skillOwner;
  }
  return item;
}

export function canReplaceEquipAffix(host, slotIndex, bagAffix) {
  if (!host || normalizeRarity(host.rarity) !== "red") {
    return { ok: false, reason: "仅红装可替换词条" };
  }
  if (!bagAffix) return { ok: false, reason: "请选择词条" };
  const list = host.affixes || [];
  const i = Math.floor(Number(slotIndex));
  if (i < 0 || i >= list.length) return { ok: false, reason: "请选择要替换的词条" };

  // 每件红装只能选定一条「可替换位」；首次任意选，之后只能改这一位
  if (host.affixReplaceIndex != null && host.affixReplaceIndex !== "") {
    const locked = Math.floor(Number(host.affixReplaceIndex));
    if (Number.isFinite(locked) && locked !== i) {
      return {
        ok: false,
        reason: "该装备只能继续替换已选定的那条词条",
        forceIndex: locked,
      };
    }
  }

  const incomingUnique =
    bagAffix.type === "unique" || !!(bagAffix.uniqueId && UNIQUE_SKILL_IDS[bagAffix.uniqueId]);
  if (incomingUnique) {
    const existingIdx = list.findIndex(
      (a, idx) =>
        idx !== i &&
        a &&
        (a.type === "unique" || (a.uniqueId && UNIQUE_SKILL_IDS[a.uniqueId]))
    );
    if (existingIdx >= 0) {
      return {
        ok: false,
        reason: "已有唯一词条，请替换原有唯一词条位",
        forceIndex: existingIdx,
      };
    }
  }
  return { ok: true };
}

/** 可被选中替换的词条下标（未锁定则全部；锁定后仅一位） */
export function getAffixReplaceableIndices(host) {
  const list = host?.affixes || [];
  if (!list.length) return [];
  if (host.affixReplaceIndex != null && host.affixReplaceIndex !== "") {
    const locked = Math.floor(Number(host.affixReplaceIndex));
    if (Number.isFinite(locked) && locked >= 0 && locked < list.length) {
      return [locked];
    }
  }
  return list.map((_, i) => i);
}

/** 用背包词条替换装备指定词条（被替换词条消失） */
export function replaceEquipAffix(host, slotIndex, bagAffix) {
  const check = canReplaceEquipAffix(host, slotIndex, bagAffix);
  if (!check.ok) return check;
  const i = Math.floor(Number(slotIndex));
  host.affixes = host.affixes || [];
  host.affixes[i] = cloneAffix(bagAffix);
  host.affixReplaceIndex = i;
  syncItemUniqueFromAffixes(host);
  rebuildEquipStats(host);
  return { ok: true, affix: host.affixes[i] };
}

/** 凝炼：红装 → 单条词条道具（调用方负责移除装备） */
export function condenseEquipAffix(host, slotIndex) {
  if (!host || normalizeRarity(host.rarity) !== "red") {
    return { ok: false, reason: "只能凝炼红装" };
  }
  const list = host.affixes || [];
  const i = Math.floor(Number(slotIndex));
  if (i < 0 || i >= list.length || !list[i]) {
    return { ok: false, reason: "请选择词条" };
  }
  return { ok: true, item: makeAffixBagItem(list[i]) };
}

/** 合并同 useId 的可堆叠道具 */
export function mergeStackableTools(inventory) {
  if (!Array.isArray(inventory)) return inventory;
  const out = [];
  const stackIdx = new Map();
  for (const it of inventory) {
    if (!it) continue;
    if (it.useId === AFFIX_CONDENSE_USE_ID) {
      const prev = stackIdx.get(AFFIX_CONDENSE_USE_ID);
      if (prev != null) {
        out[prev].qty = (out[prev].qty || 1) + (it.qty || 1);
        continue;
      }
      stackIdx.set(AFFIX_CONDENSE_USE_ID, out.length);
      out.push({ ...makeAffixCondenser(it.qty || 1), ...it, qty: it.qty || 1 });
      continue;
    }
    out.push(it);
  }
  return out;
}
