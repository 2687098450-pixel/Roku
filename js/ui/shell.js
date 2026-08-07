/** 游戏界面：探索 HUD / 背包 / 阵容 / 角色详情 */

import { $, clamp, styleTag } from "../core/utils.js?v=160";
import {
  refreshHeroStats,
  SLOT_KEYS,
  SLOT_LABEL,
  formatItemBonus,
  getItemBonus,
  itemIconUrl,
  rarityInfo,
  rarityLabel,
  RARITY_ORDER,
  normalizeRarity,
  canEquipInSlot,
  canHeroEquipItem,
  compareEquipByRarityLevel,
  itemLevel,
  itemEnhanceCount,
  itemBaseLevel,
  itemPrice,
  toBagEquip,
  BONUS_LABEL,
  affixCountForRarity,
  canUpgradeEquip,
  upgradeEquipCost,
  upgradeEquip,
  canDevourRedEquip,
  devourRedEquip,
  isMilestoneLevel,
  ensureRotation,
  activeSkills,
  updateRotationSlot,
  basicAttackId,
  isEmptyAutoSlot,
  FORMATION_SLOTS,
  MAX_DEPLOYED,
  getDeployedHeroes,
  normalizeFormation,
  combatPower,
  diamondStyleAttr,
  isSlenderFemale,
  upgradeSkill,
  getSkillLevel,
  getBaseSkillLevel,
  equipSkillLevelBonus,
  MAX_SKILL_LEVEL,
  DEFAULT_CRIT_RATE,
  DEFAULT_CRIT_DMG,
  DEFAULT_DODGE_RATE,
  reviveCost,
  reviveHero,
  isHeroDead,
  refreshSkillTexts,
  buildSkillText,
  skillMpCost,
  skillAiOptions,
  getSkillAiMode,
  setSkillAiMode,
} from "../characters/omni/index.js?v=160";
import { sumEquipBonus, UNIQUE_SKILL_IDS, uniqueAffixName, uniqueAffixDetail, CAST_ECHO_AFFIX, SKILL_LEVEL_AFFIX } from "../characters/omni/equipment.js?v=160";
import { setSavedFormation } from "../characters/stats.js?v=160";
import { resetGameLocalData } from "../core/save.js?v=160";
import { createAllUniqueItems } from "../loot/drops.js?v=160";
import { APP_VERSION } from "../core/version.js?v=160";
import { MONSTER_SKILLS, TYPE_SKILL_IDS, monsterSkillBrief } from "../monsters/skills.js?v=160";
import { buildFloorMonsterCatalog } from "../monsters/roster.js?v=160";
import { getFloorDef, MAX_FLOOR } from "../map/floors.js?v=160";
import { scaleMonsterGoldGain, scaleExpGain } from "../core/economy.js?v=160";
import { unitIconHtml, unitDiamondScale } from "./unitIcon.js?v=160";
import {
  isSealItem,
  heroHasFoolSeal,
  sealDef,
  sealIconUrl,
} from "../characters/seals.js?v=160";
import {
  isAffixItem,
  toolSortPriority,
  affixDisplayName,
  affixDisplayDetail,
  canReplaceEquipAffix,
  replaceEquipAffix,
  condenseEquipAffix,
  getAffixReplaceableIndices,
  AFFIX_CONDENSE_USE_ID,
} from "../characters/affixItems.js?v=160";

const BAG_SLOTS = 48;
const PHONE_RESET_CODE = "*886#";
const PHONE_UNIQUE_CODE = "*120#";
const PHONE_WARP_ANY_CODE = "*999#";
const PHONE_SELL_RATE = 0.3;
const WARP_HINT_NORMAL =
  "选择已到过的楼层。传送后刷新该层全部怪物；高层记录保留，可再传回去。";
const WARP_HINT_ANY =
  "调试：可传送到任意楼层。再次拨 *999# 可恢复为仅已到过楼层。";

export function createUI(ctx) {
  const { getState, setMode, canOpenParty, onWarpFloor, onProgressChange } = ctx;
  const bumpSave = () => onProgressChange?.();
  let detailTab = "skills";
  let leftDetailTab = "info";
  let rightDetailTab = "skills";
  let detailHeroId = null;
  let autoEditIdx = -1;
  let formDrag = null;
  /** 当前装备预览：角色部位 / 背包索引 */
  let equipEdit = null;
  /** 批量出售选中的品质（可多选） */
  let sellRarities = new Set();
  /** 手机拨号缓冲 */
  let phoneDigits = "";
  /** 背包：equips | tools | seals */
  let bagTab = "equips";
  /** 词条替换流程 */
  let affixReplacePick = null;
  /** 词条凝炼流程 */
  let affixCondensePick = null;
  /** 无可用装备时自动关闭更换弹窗 */
  let equipPickEmptyTimer = 0;

  const MISC_KIND_LABEL = {
    consumable: "消耗品",
    material: "材料",
    tool: "道具",
    equip: "装备",
    seal: "印章",
    affix: "词条",
  };

  function isEquipItem(it) {
    if (!it) return false;
    if (it.slot) return true;
    return it.kind === "equip";
  }

  function isDeployed(heroId) {
    return (getState().formation || []).includes(heroId);
  }

  function deployedCount() {
    return (getState().formation || []).filter(Boolean).length;
  }

  /** 阵容写入 localStorage，刷新后仍保持 */
  function persistFormation() {
    const state = getState();
    normalizeFormation(state, FORMATION_SLOTS);
    const slots = state.formation.map((id) => {
      if (!id) return null;
      return state.party.find((h) => h.id === id)?.statsId || null;
    });
    setSavedFormation(slots);
    bumpSave();
  }

  /** 左侧头像条：只显示已上阵 */
  function stripHeroes() {
    const party = getState().party || [];
    const deployed = getDeployedHeroes(getState());
    return deployed.length ? deployed : party.slice(0, 1);
  }

  function showReviveToast(msg) {
    const toast = $("lootToast");
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.remove("hidden");
    clearTimeout(toast._reviveTimer);
    toast._reviveTimer = setTimeout(() => toast.classList.add("hidden"), 2200);
  }

  /** 单独复活一名英雄 */
  function tryReviveHero(heroId, { reopenDetail = false, refreshForm = false } = {}) {
    const state = getState();
    const hero = state.party.find((h) => h.id === heroId);
    if (!hero) return false;
    const r = reviveHero(hero, state);
    if (!r.ok) {
      showReviveToast(
        r.reason === "金币不足" ? `金币不足（需要 ${r.cost}）` : r.reason || "无法复活"
      );
      return false;
    }
    refreshHeroStats(hero);
    showReviveToast(`${hero.name} 已复活（-${r.cost} 金币）`);
    refreshExploreHud();
    bumpSave();
    if (reopenDetail) openDetail(hero.id);
    if (refreshForm) renderFormation();
    return true;
  }

  function syncCaptainFlags(state = getState()) {
    if (!state?.party?.length) return;
    let id = state.captainId;
    if (!id || !state.party.some((h) => h.id === id)) {
      id =
        (state.formation || []).find((fid) => !!fid) ||
        state.party[0]?.id ||
        null;
      state.captainId = id;
    }
    for (const h of state.party) {
      h.isCaptain = h.id === id;
      refreshHeroStats(h);
    }
  }

  function setCaptain(heroId) {
    const state = getState();
    const hero = state.party.find((h) => h.id === heroId);
    if (!hero) return;
    state.captainId = heroId;
    syncCaptainFlags(state);
    renderFormation();
    refreshExploreHud();
    // 仅当角色详情当前正打开时刷新；阵容里点 ★ 不应跳详情
    const detailOpen = !$("detailModal")?.classList.contains("hidden");
    if (detailOpen && detailHeroId) openDetail(detailHeroId);
    bumpSave();
  }

  function renderPartyStrip() {
    const box = $("partyStrip");
    if (!box) return;
    const party = getState().party || [];
    box.innerHTML = stripHeroes()
      .map((h) => {
        refreshHeroStats(h);
        const dead = isHeroDead(h);
        const pct = dead ? 0 : clamp((h.hp / h.maxHp) * 100, 0, 100);
        return `<button type="button" class="strip-hero${dead ? " dead" : ""}" data-id="${h.id}" title="${h.name}${dead ? " · 阵亡" : ""}">
          ${unitIconHtml(h, "sm", { peers: party })}
          <div class="strip-hp"><i style="width:${pct}%"></i></div>
        </button>`;
      })
      .join("");
    box.querySelectorAll(".strip-hero").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (canOpenParty && !canOpenParty()) return;
        openDetail(btn.dataset.id);
      });
    });
  }

  function refreshTopBar() {
    const s = getState();
    const gold = $("resGold");
    const gem = $("resGem");
    const mob = $("mobCount");
    const place = $("placeName");
    const floor = $("placeFloor");
    if (gold) gold.textContent = String(s.gold ?? 0);
    if (gem) gem.textContent = String(s.gem ?? 0);
    if (place) place.textContent = s.placeName || "阳光海岛";
    if (floor) floor.textContent = `${s.placeFloor || "1层"} v${APP_VERSION}`;
    if (mob) {
      const alive = s.monsters ? s.monsters.length : 0;
      const total = s.monsterTotal ?? alive;
      mob.textContent = `${alive}/${total}`;
    }
  }

  function refreshExploreHud() {
    syncCaptainFlags();
    renderPartyStrip();
    refreshTopBar();
  }

  function closeSkillPick() {
    $("skillPickModal")?.classList.add("hidden");
    autoEditIdx = -1;
  }

  function closeSkillDetail() {
    $("skillDetailModal")?.classList.add("hidden");
  }

  const SKILL_FACE = {
    attack: "斩",
    radiant: "印",
    quake: "震",
    omni_bless: "衡",
    boost: "衡",
    aftercare: "愈",
    pink_burst: "爆",
    pink_barrage: "雨",
    pink_fervor: "燃",
    pink_focus: "专",
    pink_marks: "印",
    green_bolt: "叶",
    green_mend: "愈",
    green_bloom: "芽",
    green_life: "生",
    green_aftercare: "疗",
    yellow_hit: "盾",
    yellow_slam: "猛",
    yellow_fortify: "壁",
    yellow_reflect: "反",
    yellow_armor: "甲",
    blue_bolt: "霜",
    blue_nova: "环",
    blue_freeze: "锁",
    blue_veil: "幕",
    blue_chill: "骨",
    orange_shot: "烬",
    orange_wave: "浪",
    orange_blaze: "焚",
    orange_stoke: "薪",
    orange_ember: "烬",
    cyan_cut: "刃",
    cyan_tailwind: "风",
    cyan_gust: "迅",
    cyan_swift: "捷",
    cyan_breeze: "息",
  };

  function skillFace(skill) {
    return SKILL_FACE[skill?.id] || (skill?.kind === "passive" ? "被" : "技");
  }

  function skillKindLabel(skill) {
    if (!skill) return "";
    if (skill.kind === "passive") return "被动";
    if (skill.style === "buff") return "增益";
    if (skill.style === "heal") return "治疗";
    return "主动";
  }

  function skillIcoClass(skill) {
    if (skill?.kind === "passive") return "passive";
    return skill?.style || "melee";
  }

  function closeEquipPick() {
    $("equipPickModal")?.classList.add("hidden");
    setEquipPickConfirm(false);
    affixReplacePick = null;
    affixCondensePick = null;
    devourPick = null;
    clearTimeout(equipPickEmptyTimer);
    equipPickEmptyTimer = 0;
  }

  function closeEquipPreview() {
    closeEquipPick();
    hideEquipAffixDetail();
    $("equipPreviewModal")?.classList.add("hidden");
    equipEdit = null;
  }

  function hideEquipAffixDetail() {
    const el = $("equipAffixDetail");
    if (!el) return;
    el.classList.add("hidden");
    el.innerHTML = "";
  }

  function showEquipAffixDetail({ title, type, detail, ico = "唯" }) {
    const el = $("equipAffixDetail");
    if (!el) return;
    el.innerHTML = `
      <div class="equip-affix-detail-head">
        <span class="equip-affix-detail-ico">${escapeHtml(ico)}</span>
        <div class="equip-affix-detail-meta">
          <strong>${escapeHtml(title)}</strong>
          <span>${escapeHtml(type)}</span>
        </div>
        <button type="button" class="equip-affix-detail-close" id="btnCloseEquipAffix" aria-label="关闭词条详情">×</button>
      </div>
      <p class="equip-affix-detail-text">${escapeHtml(detail)}</p>`;
    el.classList.remove("hidden");
    el.querySelector("#btnCloseEquipAffix")?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      hideEquipAffixDetail();
    });
    el.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  function closeBagSell() {
    $("bagSellModal")?.classList.add("hidden");
    sellRarities = new Set();
  }

  function closeWarp() {
    $("warpModal")?.classList.add("hidden");
  }

  function closeFloorMobs() {
    $("floorMobsModal")?.classList.add("hidden");
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function monsterSkillText(monster) {
    let ids = monster?.skillIds;
    if (!ids?.length) {
      ids = (monster?.skills || []).map((s) => s.id).filter(Boolean);
    }
    if (!ids?.length) {
      ids = TYPE_SKILL_IDS[monster?.kind] || ["gnaw"];
    }
    const parts = [];
    for (const id of ids) {
      const sk = MONSTER_SKILLS[id];
      if (!sk) continue;
      parts.push(monsterSkillBrief(sk));
    }
    return parts.join("、") || "—";
  }

  function monsterIconHtml(monster) {
    return unitIconHtml(monster, "sm", { enemy: true });
  }

  function openFloorMobs() {
    if (getState().mode === "battle") return;
    const state = getState();
    const floor = Math.max(1, Math.floor(state.floor || 1));
    const def = getFloorDef(floor);
    const list = buildFloorMonsterCatalog(floor, def?.scale ?? 1);
    const alive = state.monsters ? state.monsters.length : 0;
    const total = state.monsterTotal ?? alive;
    const title = $("floorMobsTitle");
    const body = $("floorMobsBody");
    const modal = $("floorMobsModal");
    if (!body || !modal) return;
    if (title) title.textContent = `本层可遇 ${list.length}种（残留 ${alive}/${total}）`;
    if (!list.length) {
      body.innerHTML = `<div class="fm-empty">本层暂无怪物资料</div>`;
    } else {
      body.innerHTML = list
        .map((m) => {
          const hp = Math.max(0, Math.ceil(m.hp ?? m.maxHp ?? 0));
          const maxHp = Math.max(hp, Math.ceil(m.maxHp ?? hp));
          const atk = Math.max(0, Math.floor(m.atk ?? 0));
          const defStat = Math.max(0, Math.floor(m.def ?? 0));
          const gold = scaleMonsterGoldGain(m.gold || Math.max(1, Math.round((m.exp || 10) * 0.45)));
          const exp = scaleExpGain(m.exp || 0);
          const skills = monsterSkillText(m);
          const bossTag = m.isBoss ? `<span class="fm-tag">Boss</span>` : "";
          return `<article class="fm-row${m.isBoss ? " is-boss" : ""}">
            ${monsterIconHtml(m)}
            <div class="fm-main">
              <div class="fm-name">${escapeHtml(m.name || "怪物")}${bossTag}</div>
              <div class="fm-stats">
                <div>生命 <b>${maxHp}</b></div>
                <div>攻击 <b>${atk}</b> · 防御 <b>${defStat}</b></div>
                <div>技能 ${escapeHtml(skills)}</div>
                <div>价值 金币 <b>${gold}</b> · 经验 <b>${exp}</b></div>
              </div>
            </div>
          </article>`;
        })
        .join("");
    }
    modal.classList.remove("hidden");
  }

  function closePhone() {
    $("phoneModal")?.classList.add("hidden");
    phoneDigits = "";
    syncPhoneDisplay();
  }

  function closeResetConfirm() {
    $("resetConfirmModal")?.classList.add("hidden");
  }

  function syncPhoneDisplay() {
    const el = $("phoneDisplay");
    if (el) el.textContent = phoneDigits || "输入号码";
  }

  function openPhoneDial() {
    closeEquipPreview();
    phoneDigits = "";
    syncPhoneDisplay();
    $("phoneModal")?.classList.remove("hidden");
  }

  function openResetConfirm() {
    $("resetConfirmModal")?.classList.remove("hidden");
  }

  function pressPhoneKey(key) {
    if (!key) return;
    if (phoneDigits.length >= 16) return;
    phoneDigits += key;
    syncPhoneDisplay();
    if (key !== "#") return;
    if (phoneDigits === PHONE_RESET_CODE) {
      openResetConfirm();
      return;
    }
    if (phoneDigits === PHONE_UNIQUE_CODE) {
      runPhoneUniqueBundle();
      return;
    }
    if (phoneDigits === PHONE_WARP_ANY_CODE) {
      toggleWarpAnyFloor();
    }
  }

  function showPhoneToast(msg, ms = 2800) {
    const toast = $("lootToast") || $("toast");
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.remove("hidden");
    clearTimeout(toast._phoneCheatTimer);
    toast._phoneCheatTimer = setTimeout(() => toast.classList.add("hidden"), ms);
  }

  /** *999#：传送球可选任意层；再拨一次恢复仅已访问层 */
  function toggleWarpAnyFloor() {
    const state = getState();
    state.warpAnyFloor = !state.warpAnyFloor;
    phoneDigits = "";
    syncPhoneDisplay();
    closePhone();
    showPhoneToast(
      state.warpAnyFloor
        ? "已开启：传送球可选任意楼层（再拨 *999# 关闭）"
        : "已关闭：传送球恢复为仅已到过楼层"
    );
  }

  function clearPhoneDigits() {
    phoneDigits = "";
    syncPhoneDisplay();
  }

  /** *120#：全身+背包装备按 30% 售出，再发放全部唯一装各一件 */
  function runPhoneUniqueBundle() {
    const state = getState();
    if (!state.inventory) state.inventory = [];

    let sold = 0;
    let goldFull = 0;

    const keepInv = [];
    for (const it of state.inventory) {
      if (isEquipItem(it)) {
        sold += 1;
        goldFull += itemPrice(it);
      } else {
        keepInv.push(it);
      }
    }
    state.inventory = keepInv;

    for (const hero of state.party || []) {
      if (!hero?.equip) continue;
      for (const key of SLOT_KEYS) {
        const worn = hero.equip[key];
        if (!worn || !isEquipItem(worn)) continue;
        sold += 1;
        goldFull += itemPrice(worn);
        hero.equip[key] = null;
      }
      refreshHeroStats(hero);
      refreshSkillTexts(hero);
    }

    const goldGain = Math.max(0, Math.floor(goldFull * PHONE_SELL_RATE));
    state.gold = Math.max(0, Math.floor(state.gold || 0) + goldGain);

    const uniques = createAllUniqueItems();
    state.inventory.push(...uniques);

    phoneDigits = "";
    syncPhoneDisplay();
    closePhone();
    closeEquipPreview();
    refreshExploreHud();
    if (!$("bagModal")?.classList.contains("hidden")) renderBag();
    if (detailHeroId) openDetail(detailHeroId);
    bumpSave();

    showPhoneToast(
      `已按 30% 售出 ${sold} 件装备（+${goldGain} 金），获得唯一装 ${uniques.length} 件`
    );
  }

  function confirmResetGame() {
    resetGameLocalData();
    window.__MOKU_SKIP_SAVE__ = true;
    location.reload();
  }

  function closeModals() {
    closeSkillPick();
    closeSkillDetail();
    hideSkillHoldPreview();
    closeEquipPreview();
    closeBagSell();
    closeWarp();
    closeFloorMobs();
    closePhone();
    closeResetConfirm();
    $("detailModal")?.classList.add("hidden");
    $("bagModal")?.classList.add("hidden");
    $("formationModal")?.classList.add("hidden");
    if (getState().mode !== "battle") setMode("explore");
  }

  function openWarpPicker() {
    const state = getState();
    const anyFloor = !!state.warpAnyFloor;
    const floors = anyFloor
      ? Array.from({ length: MAX_FLOOR }, (_, i) => i + 1)
      : [...(state.visitedFloors || [state.floor || 1])].sort((a, b) => a - b);
    const hint = $("warpHint");
    if (hint) hint.textContent = anyFloor ? WARP_HINT_ANY : WARP_HINT_NORMAL;
    const list = $("warpFloorList");
    if (!list) return;
    if (!floors.length) {
      list.innerHTML = `<div class="warp-empty">还没有可传送的楼层</div>`;
    } else {
      list.innerHTML = floors
        .map((f) => {
          const cur = f === state.floor ? " current" : "";
          const visited = (state.visitedFloors || []).includes(f);
          const sub = f === state.floor
            ? "当前 · 刷新怪物"
            : anyFloor && !visited
              ? "未到过 · 传送并刷新"
              : "传送并刷新";
          return `<button type="button" class="warp-floor-btn${cur}" data-floor="${f}">
            <b>${f} 层</b>
            <span>${sub}</span>
          </button>`;
        })
        .join("");
      list.querySelectorAll(".warp-floor-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
          const floor = Number(btn.dataset.floor);
          closeWarp();
          closeEquipPreview();
          $("bagModal")?.classList.add("hidden");
          if (getState().mode !== "battle") setMode("explore");
          onWarpFloor?.(floor);
        });
      });
    }
    $("warpModal")?.classList.remove("hidden");
  }

  function currentEquipHero() {
    if (!equipEdit || equipEdit.source === "bag") return null;
    return getState().party.find((h) => h.id === equipEdit.heroId) || null;
  }

  function setPreviewActions({
    replace = false,
    sellOne = false,
    upgrade = false,
    devour = false,
    affixReplace = false,
    affixCondense = false,
  } = {}) {
    const btnReplace = $("btnReplace");
    const btnSellOne = $("btnSellOne");
    const btnUpgrade = $("btnUpgradeEquip");
    const btnDevour = $("btnDevourEquip");
    const btnAffixReplace = $("btnAffixReplace");
    const btnAffixCondense = $("btnAffixCondense");
    const actions = btnReplace?.parentElement;
    if (btnReplace) btnReplace.hidden = !replace;
    if (btnSellOne) btnSellOne.hidden = !sellOne;
    if (btnUpgrade) {
      btnUpgrade.hidden = !upgrade;
      if (upgrade) syncUpgradeButton();
    }
    if (btnDevour) {
      btnDevour.hidden = !devour;
      if (devour) {
        btnDevour.disabled = false;
        btnDevour.textContent = "吞噬";
      }
    }
    if (btnAffixReplace) {
      btnAffixReplace.hidden = !affixReplace;
      if (affixReplace) {
        btnAffixReplace.disabled = false;
        btnAffixReplace.textContent = "词条替换";
      }
    }
    if (btnAffixCondense) {
      btnAffixCondense.hidden = !affixCondense;
      if (affixCondense) {
        btnAffixCondense.disabled = false;
        btnAffixCondense.textContent = "词条凝炼";
      }
    }
    if (actions) {
      actions.hidden =
        !replace &&
        !sellOne &&
        !upgrade &&
        !devour &&
        !affixReplace &&
        !affixCondense;
    }
  }

  function findAffixCondenserIndex() {
    const inv = getState().inventory || [];
    return inv.findIndex(
      (it) => it && it.useId === AFFIX_CONDENSE_USE_ID && (it.qty || 1) > 0
    );
  }

  function hasAffixCondenser() {
    return findAffixCondenserIndex() >= 0;
  }

  function setEquipPickConfirm(visible, label = "确定") {
    const btn = $("btnEquipPickConfirm");
    if (!btn) return;
    btn.hidden = !visible;
    btn.textContent = label;
    btn.onclick = null;
  }

  function currentPreviewItem() {
    if (!equipEdit) return null;
    if (equipEdit.source === "bag") {
      return getState().inventory?.[equipEdit.invIndex] || null;
    }
    const hero = currentEquipHero();
    return hero?.equip?.[equipEdit.slotKey] || null;
  }

  function syncUpgradeButton() {
    const btn = $("btnUpgradeEquip");
    const item = currentPreviewItem();
    if (!btn || !item || !canUpgradeEquip(item)) {
      if (btn) {
        btn.hidden = true;
        btn.disabled = true;
      }
      return;
    }
    const cost = upgradeEquipCost(item);
    const nextEnhance = itemEnhanceCount(item) + 1;
    const next = itemLevel(item) + 1;
    const milestone = isMilestoneLevel(next);
    const gold = getState().gold || 0;
    btn.hidden = false;
    btn.disabled = gold < cost;
    btn.textContent = milestone
      ? `突破强化 +${nextEnhance}（${cost}金）`
      : `强化 +${nextEnhance}（${cost}金）`;
    btn.classList.toggle("milestone", milestone);
  }

  function doUpgradeEquip() {
    const item = currentPreviewItem();
    if (!item) return;
    const state = getState();
    const r = upgradeEquip(item, state);
    const toast = $("lootToast");
    if (!r.ok) {
      if (toast) {
        toast.textContent =
          r.reason === "金币不足" ? `金币不足（需要 ${r.cost}）` : r.reason || "无法升级";
        toast.classList.remove("hidden");
        clearTimeout(toast._upTimer);
        toast._upTimer = setTimeout(() => toast.classList.add("hidden"), 2200);
      }
      syncUpgradeButton();
      return;
    }

    if (equipEdit?.source === "hero") {
      const hero = currentEquipHero();
      if (hero) {
        refreshHeroStats(hero);
        openDetail(hero.id, { keepEquip: true });
        openEquipPreview(hero, equipEdit.slotKey);
      }
    } else if (equipEdit?.source === "bag") {
      openBagItemPreview(equipEdit.invIndex);
    }
    refreshTopBar();
    if (toast) {
      toast.textContent = r.milestone
        ? `突破！强化 +${r.enhanceCount} · Lv.${r.level}（-${r.cost}金）`
        : `强化 +${r.enhanceCount} · Lv.${r.level}（-${r.cost}金）`;
      toast.classList.remove("hidden");
      clearTimeout(toast._upTimer);
      toast._upTimer = setTimeout(() => toast.classList.add("hidden"), 2200);
    }
    bumpSave();
  }

  /** 收集可作吞噬材料的红装（背包+已穿，排除宿主；按基础等级，不含强化） */
  function listDevourMaterials(host) {
    const state = getState();
    const out = [];
    const hostLv = itemBaseLevel(host);
    (state.inventory || []).forEach((it, invIndex) => {
      if (!it || normalizeRarity(it.rarity) !== "red") return;
      if (it === host) return;
      if (itemBaseLevel(it) <= hostLv) return;
      out.push({ item: it, where: "bag", invIndex });
    });
    for (const hero of state.party || []) {
      if (!hero?.equip) continue;
      for (const slot of SLOT_KEYS) {
        const it = hero.equip[slot];
        if (!it || normalizeRarity(it.rarity) !== "red") continue;
        if (it === host) continue;
        if (itemBaseLevel(it) <= hostLv) continue;
        out.push({ item: it, where: "equip", heroId: hero.id, slotKey: slot });
      }
    }
    return out;
  }

  let devourPick = null;

  function openDevourPick() {
    const host = currentPreviewItem();
    if (!host || normalizeRarity(host.rarity) !== "red") return;
    const mats = listDevourMaterials(host);
    if (mats.length < 2) {
      const toast = $("lootToast");
      if (toast) {
        toast.textContent = "需要两件基础等级更高的红装作为材料（不含强化）";
        toast.classList.remove("hidden");
        clearTimeout(toast._devourTimer);
        toast._devourTimer = setTimeout(() => toast.classList.add("hidden"), 2400);
      }
      return;
    }
    devourPick = { host, selected: [], mats };
    setEquipPickConfirm(false);
    const title = $("equipPickTitle");
    const sub = $("equipPickSub");
    const list = $("equipPickList");
    if (title) title.textContent = "选择吞噬材料";
    const render = () => {
      if (sub) {
        sub.textContent = `已选 ${devourPick.selected.length}/2 · 宿主 Lv${itemLevel(host)}（基础 ${itemBaseLevel(host)}）· 材料取基础等级较低者，且不低于宿主当前等级，强化清空`;
      }
      list.innerHTML = mats
        .map((m, i) => {
          const on = devourPick.selected.includes(i);
          const info = rarityInfo(m.item.rarity);
          const where =
            m.where === "bag" ? "背包" : `${SLOT_LABEL[m.slotKey] || "装备"}`;
          return `<button type="button" class="equip-pick-item${on ? " on" : ""}" data-mat="${i}">
            <div class="equip-pick-top">
              <b>${m.item.name}</b>
              <span class="stag rarity-tag rarity-${info.id}">${info.label}</span>
            </div>
            <div class="equip-preview-rarity">Lv${itemLevel(m.item)}（基础 ${itemBaseLevel(m.item)}）· ${where}</div>
            <span class="equip-pick-cta">${on ? "已选" : "选择"}</span>
          </button>`;
        })
        .join("");
      list.querySelectorAll("[data-mat]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const i = Number(btn.dataset.mat);
          const idx = devourPick.selected.indexOf(i);
          if (idx >= 0) devourPick.selected.splice(idx, 1);
          else if (devourPick.selected.length < 2) devourPick.selected.push(i);
          if (devourPick.selected.length === 2) {
            confirmDevour();
            return;
          }
          render();
        });
      });
    };
    render();
    $("equipPickModal")?.classList.remove("hidden");
  }

  function removeDevourMaterial(ref) {
    const state = getState();
    if (ref.where === "bag") {
      const inv = state.inventory || [];
      const i = inv.indexOf(ref.item);
      if (i >= 0) inv.splice(i, 1);
      return;
    }
    const hero = state.party.find((h) => h.id === ref.heroId);
    if (hero?.equip?.[ref.slotKey] === ref.item) {
      hero.equip[ref.slotKey] = null;
      refreshHeroStats(hero);
      refreshSkillTexts(hero);
    }
  }

  function confirmDevour() {
    if (!devourPick || devourPick.selected.length !== 2) return;
    const { host, mats, selected } = devourPick;
    const a = mats[selected[0]];
    const b = mats[selected[1]];
    if (!a || !b) return;
    const check = canDevourRedEquip(host, a.item, b.item);
    const toast = $("lootToast");
    if (!check.ok) {
      if (toast) {
        toast.textContent = check.reason || "无法吞噬";
        toast.classList.remove("hidden");
        clearTimeout(toast._devourTimer);
        toast._devourTimer = setTimeout(() => toast.classList.add("hidden"), 2400);
      }
      return;
    }
    const r = devourRedEquip(host, a.item, b.item);
    if (!r.ok) return;
    removeDevourMaterial(a);
    removeDevourMaterial(b);
    devourPick = null;
    $("equipPickModal")?.classList.add("hidden");
    if (toast) {
      toast.textContent = `吞噬成功！等级 ${r.level}，强化已清空`;
      toast.classList.remove("hidden");
      clearTimeout(toast._devourTimer);
      toast._devourTimer = setTimeout(() => toast.classList.add("hidden"), 2600);
    }
    if (equipEdit?.source === "hero") {
      const hero = currentEquipHero();
      if (hero) {
        refreshHeroStats(hero);
        refreshSkillTexts(hero);
        openEquipPreview(hero, equipEdit.slotKey);
      }
    } else if (equipEdit?.source === "bag") {
      const inv = getState().inventory || [];
      const idx = inv.indexOf(host);
      if (idx >= 0) {
        equipEdit.invIndex = idx;
        openBagItemPreview(idx);
      }
    }
    refreshExploreHud();
    bumpSave();
  }

  function toastMsg(text, ms = 2400) {
    const toast = $("lootToast");
    if (!toast) return;
    toast.textContent = text;
    toast.classList.remove("hidden");
    clearTimeout(toast._flowTimer);
    toast._flowTimer = setTimeout(() => toast.classList.add("hidden"), ms);
  }

  function listBagAffixItems() {
    const inv = getState().inventory || [];
    return inv
      .map((it, invIndex) => ({ it, invIndex }))
      .filter(({ it }) => isAffixItem(it));
  }

  function reopenCurrentEquipPreview() {
    if (equipEdit?.source === "hero") {
      const hero = currentEquipHero();
      if (hero) openEquipPreview(hero, equipEdit.slotKey);
    } else if (equipEdit?.source === "bag") {
      openBagItemPreview(equipEdit.invIndex);
    }
  }

  /** 红装：词条替换 — 先选背包词条，再选装备词条位，确定 */
  function openAffixReplaceFlow() {
    const host = currentPreviewItem();
    if (!host || normalizeRarity(host.rarity) !== "red") return;
    const bagAffixes = listBagAffixItems();
    if (!bagAffixes.length) {
      toastMsg("背包没有可替换的词条（可用词条凝炼器从红装凝炼）");
      return;
    }
    affixReplacePick = {
      host,
      bagAffixIndex: -1,
      bagAffix: null,
      targetIndex: -1,
    };
    affixCondensePick = null;
    const title = $("equipPickTitle");
    const sub = $("equipPickSub");
    const list = $("equipPickList");
    if (title) title.textContent = "选择替换词条";
    if (sub) {
      sub.textContent =
        host.affixReplaceIndex != null && host.affixReplaceIndex !== ""
          ? "该装备已选定可替换词条位，只能继续替换这一条"
          : "每件红装只能选定一条可替换词条；首次任选，之后仅可改该位（被替换的消失）";
    }
    setEquipPickConfirm(false);
    list.innerHTML = bagAffixes
      .map(
        ({ it, invIndex }) =>
          `<button type="button" class="equip-pick-item" data-affix-inv="${invIndex}">
            <div class="equip-pick-top">
              <b>${it.name}</b>
              <span class="stag kind">词条</span>
            </div>
            <div class="equip-preview-rarity">${(it.desc || "").slice(0, 42)}</div>
            <span class="equip-pick-cta">选择</span>
          </button>`
      )
      .join("");
    list.querySelectorAll("[data-affix-inv]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const invIndex = Number(btn.dataset.affixInv);
        const it = getState().inventory?.[invIndex];
        if (!isAffixItem(it)) return;
        affixReplacePick.bagAffixIndex = invIndex;
        affixReplacePick.bagAffix = it.affix;
        openAffixReplaceTargetPick();
      });
    });
    $("equipPickModal")?.classList.remove("hidden");
  }

  function openAffixReplaceTargetPick() {
    const flow = affixReplacePick;
    if (!flow?.host || !flow.bagAffix) return;
    const host = flow.host;
    const list = $("equipPickList");
    const title = $("equipPickTitle");
    const sub = $("equipPickSub");
    if (title) title.textContent = "选择被替换词条";
    const allowed = new Set(getAffixReplaceableIndices(host));
    if (sub) {
      sub.textContent =
        allowed.size === 1
          ? `将装上「${affixDisplayName(flow.bagAffix)}」· 只能替换已锁定的那条词条`
          : `将装上「${affixDisplayName(flow.bagAffix)}」· 选定后其他词条将不可再替换`;
    }
    const affixes = host.affixes || [];
    if (allowed.size === 1) {
      flow.targetIndex = [...allowed][0];
    }
    const render = () => {
      list.innerHTML = affixes
        .map((a, i) => {
          const can = allowed.has(i);
          const on = flow.targetIndex === i;
          const tag =
            a?.type === "unique" || a?.uniqueId
              ? "唯一"
              : a?.id === "cast_echo" || a?.id === "skill_level"
                ? "特殊"
                : `词条${i + 1}`;
          return `<button type="button" class="equip-pick-item${on ? " on" : ""}${
            can ? "" : " off"
          }" data-target="${i}" ${can ? "" : "disabled"}>
            <div class="equip-pick-top">
              <b>${affixDisplayName(a)}</b>
              <span class="stag kind">${tag}</span>
            </div>
            <div class="equip-preview-rarity">${
              can
                ? (a?.detail || a?.text || "").slice(0, 40)
                : "不可替换（未选定位）"
            }</div>
            <span class="equip-pick-cta">${
              !can ? "锁定" : on ? "已选" : "选择"
            }</span>
          </button>`;
        })
        .join("");
      list.querySelectorAll("[data-target]:not([disabled])").forEach((btn) => {
        btn.addEventListener("click", () => {
          flow.targetIndex = Number(btn.dataset.target);
          render();
          syncAffixReplaceConfirm();
        });
      });
      syncAffixReplaceConfirm();
    };
    render();
  }

  function syncAffixReplaceConfirm() {
    const flow = affixReplacePick;
    const ok = !!(flow && flow.targetIndex >= 0 && flow.bagAffix);
    setEquipPickConfirm(ok, "确定替换");
    const btn = $("btnEquipPickConfirm");
    if (btn && ok) {
      btn.onclick = () => confirmAffixReplace();
    }
  }

  function confirmAffixReplace() {
    const flow = affixReplacePick;
    if (!flow?.host || !flow.bagAffix || flow.targetIndex < 0) return;
    const check = canReplaceEquipAffix(
      flow.host,
      flow.targetIndex,
      flow.bagAffix
    );
    if (!check.ok) {
      toastMsg(check.reason || "无法替换");
      if (check.forceIndex != null) {
        flow.targetIndex = check.forceIndex;
        openAffixReplaceTargetPick();
      }
      return;
    }
    const inv = getState().inventory || [];
    const bagItem = inv[flow.bagAffixIndex];
    if (!isAffixItem(bagItem)) {
      toastMsg("词条已不存在");
      return;
    }
    const r = replaceEquipAffix(flow.host, flow.targetIndex, flow.bagAffix);
    if (!r.ok) {
      toastMsg(r.reason || "替换失败");
      return;
    }
    inv.splice(flow.bagAffixIndex, 1);
    affixReplacePick = null;
    setEquipPickConfirm(false);
    $("equipPickModal")?.classList.add("hidden");
    toastMsg(`已替换为「${affixDisplayName(r.affix)}」`);
    if (equipEdit?.source === "hero") {
      const hero = currentEquipHero();
      if (hero) {
        refreshHeroStats(hero);
        refreshSkillTexts(hero);
        openDetail(hero.id, { keepEquip: true });
        openEquipPreview(hero, equipEdit.slotKey);
      }
    } else {
      reopenCurrentEquipPreview();
    }
    renderBag();
    refreshExploreHud();
    bumpSave();
  }

  /** 从背包红装发起凝炼：选词条 → 确定（消耗一件凝炼器） */
  function openAffixCondenseFromEquip() {
    if (equipEdit?.source !== "bag") {
      toastMsg("请先把红装放回背包再凝炼");
      return;
    }
    const equipInvIndex = equipEdit.invIndex;
    const inv = getState().inventory || [];
    const host = inv[equipInvIndex];
    if (!host || !isEquipItem(host) || normalizeRarity(host.rarity) !== "red") {
      toastMsg("只能凝炼背包中的红装");
      return;
    }
    if (!(host.affixes || []).length) {
      toastMsg("该装备没有可凝炼的词条");
      return;
    }
    const toolInvIndex = findAffixCondenserIndex();
    if (toolInvIndex < 0) {
      toastMsg("需要词条凝炼器（10 层 Boss 掉落）");
      return;
    }
    affixCondensePick = {
      toolInvIndex,
      equipInvIndex,
      host,
      targetIndex: -1,
    };
    affixReplacePick = null;
    openAffixCondenseTargetPick();
    $("equipPickModal")?.classList.remove("hidden");
  }

  function openAffixCondenseTargetPick() {
    const flow = affixCondensePick;
    if (!flow?.host) return;
    const list = $("equipPickList");
    const title = $("equipPickTitle");
    const sub = $("equipPickSub");
    if (title) title.textContent = "选择凝炼词条";
    if (sub) {
      sub.textContent = `「${flow.host.name}」将消失并消耗 1 个凝炼器 · 点选词条后确定`;
    }
    setEquipPickConfirm(false);
    const affixes = flow.host.affixes || [];
    const render = () => {
      list.innerHTML = affixes
        .map((a, i) => {
          const on = flow.targetIndex === i;
          const tag =
            a?.type === "unique" || a?.uniqueId
              ? "唯一"
              : a?.id === "cast_echo" || a?.id === "skill_level"
                ? "特殊"
                : `词条${i + 1}`;
          return `<button type="button" class="equip-pick-row${on ? " on" : ""}" data-target="${i}">
            <span class="equip-pick-name">${affixDisplayName(a)}</span>
            <span class="equip-pick-meta">${tag}${on ? " · 已选" : ""}</span>
          </button>`;
        })
        .join("");
      list.querySelectorAll("[data-target]").forEach((btn) => {
        btn.addEventListener("click", () => {
          flow.targetIndex = Number(btn.dataset.target);
          render();
        });
      });
      const ok = flow.targetIndex >= 0;
      setEquipPickConfirm(ok, "确定凝炼");
      const btn = $("btnEquipPickConfirm");
      if (btn && ok) btn.onclick = () => confirmAffixCondense();
    };
    render();
  }

  function confirmAffixCondense() {
    const flow = affixCondensePick;
    if (!flow || flow.targetIndex < 0) return;
    const state = getState();
    const inv = state.inventory || [];
    const tool = inv[flow.toolInvIndex];
    const host = inv[flow.equipInvIndex];
    if (!tool || tool.useId !== AFFIX_CONDENSE_USE_ID || !host) {
      toastMsg("物品状态已变化");
      return;
    }
    const r = condenseEquipAffix(host, flow.targetIndex);
    if (!r.ok) {
      toastMsg(r.reason || "凝炼失败");
      return;
    }
    const eqI = inv.indexOf(host);
    if (eqI >= 0) inv.splice(eqI, 1);
    const toolNow =
      inv.find((it) => it === tool) ||
      inv.find((it) => it && it.useId === AFFIX_CONDENSE_USE_ID);
    if (toolNow) {
      if ((toolNow.qty || 1) > 1) toolNow.qty = (toolNow.qty || 1) - 1;
      else {
        const ti = inv.indexOf(toolNow);
        if (ti >= 0) inv.splice(ti, 1);
      }
    }
    inv.push(r.item);
    affixCondensePick = null;
    setEquipPickConfirm(false);
    $("equipPickModal")?.classList.add("hidden");
    closeEquipPreview();
    toastMsg(`凝炼得到「${r.item.name}」`);
    bagTab = "tools";
    syncBagTabs();
    renderBag();
    refreshExploreHud();
    bumpSave();
  }

  function formatBonusRows(bonus, compact = false, emptyText = "无加成") {
    const rows = ["hp", "atk", "def", "spd", "critRate", "critDmg", "hitRate", "dodgeRate"]
      .map((k) => {
        const v = bonus?.[k] || 0;
        if (!v) return "";
        if (k === "critRate" || k === "critDmg" || k === "hitRate" || k === "dodgeRate") {
          const pct = Math.round(v * 1000) / 10;
          return `<li><span>${BONUS_LABEL[k]}</span><b>+${pct}%</b></li>`;
        }
        return `<li><span>${BONUS_LABEL[k]}</span><b>${v > 0 ? "+" : ""}${v}</b></li>`;
      })
      .filter(Boolean);
    const cls = compact ? "equip-preview-stats compact" : "equip-preview-stats";
    if (!rows.length) {
      return `<ul class="${cls}"><li><span>属性</span><b>${emptyText}</b></li></ul>`;
    }
    return `<ul class="${cls}">${rows.join("")}</ul>`;
  }

  function formatEquipStatsHtml(item, compact = false) {
    return formatBonusRows(getItemBonus(item), compact);
  }

  function formatPrimaryHtml(item, compact = false) {
    if (item?.slot === "ringL" || item?.slot === "ringR") return "";
    const primary = item.primary || {};
    const has = Object.values(primary).some((v) => Number(v) > 0);
    const head = `<div class="equip-section-label">主属性 · 等级 ${itemLevel(item)}</div>`;
    if (!has) {
      return `${head}${formatBonusRows({}, compact, "无")}`;
    }
    return `${head}${formatBonusRows(primary, compact, "无")}`;
  }

  function formatAffixesHtml(item, compact = false) {
    const list = item.affixes || [];
    const max = affixCountForRarity(item.rarity, item.slot);
    const info = rarityInfo(item.rarity);
    const head = `<div class="equip-section-label">词条 · ${info.label}装 ${list.length}/${max}</div>`;
    const cls = compact
      ? "equip-preview-stats compact affixes"
      : "equip-preview-stats affixes";
    if (!list.length) {
      return `${head}<ul class="${cls}"><li><span>词条</span><b>无</b></li></ul>`;
    }
    const rows = list
      .map((a, i) => {
        const tag = a.type === "unique" ? "唯一" : a.id === "cast_echo" ? "特殊" : `词条${i + 1}`;
        const uid = a.uniqueId || a.id;
        if (a.type === "unique" && uid) {
          const name = uniqueAffixName(uid);
          if (compact) {
            return `<li class="affix-unique"><span>${tag}</span><b>${name}</b></li>`;
          }
          return `<li class="affix-unique affix-unique-tap" data-unique-affix="${uid}" role="button" tabindex="0">
            <span>${tag}</span><b>${name}</b><i class="affix-tap-hint">详情</i>
          </li>`;
        }
        if (a.id === "cast_echo") {
          const name = a.text || CAST_ECHO_AFFIX.text;
          if (compact) {
            return `<li class="affix-unique"><span>${tag}</span><b>${name}</b></li>`;
          }
          return `<li class="affix-unique affix-unique-tap" data-special-affix="cast_echo" role="button" tabindex="0">
            <span>${tag}</span><b>${name}</b><i class="affix-tap-hint">详情</i>
          </li>`;
        }
        if (a.id === "skill_level") {
          const name = a.text || SKILL_LEVEL_AFFIX.text;
          if (compact) {
            return `<li class="affix-unique"><span>${tag}</span><b>${name}</b></li>`;
          }
          return `<li class="affix-unique affix-unique-tap" data-special-affix="skill_level" role="button" tabindex="0">
            <span>${tag}</span><b>${name}</b><i class="affix-tap-hint">详情</i>
          </li>`;
        }
        const text = a.text || a.label || "—";
        return `<li><span>${tag}</span><b>${text}</b></li>`;
      })
      .join("");
    return `${head}<ul class="${cls}">${rows}</ul>`;
  }

  function openUniqueAffixPreview(uniqueId) {
    const name = uniqueAffixName(uniqueId);
    const detail = uniqueAffixDetail(uniqueId);
    if (!UNIQUE_SKILL_IDS[uniqueId] && !detail) return;
    hideSkillHoldPreview();
    showEquipAffixDetail({
      title: name,
      type: "唯一词条",
      detail: detail || "暂无说明。",
      ico: "唯",
    });
  }

  function openSpecialAffixPreview(id) {
    if (id === "cast_echo") {
      hideSkillHoldPreview();
      showEquipAffixDetail({
        title: CAST_ECHO_AFFIX.text,
        type: "特殊词条 · 仅红装戒指/项链",
        detail: CAST_ECHO_AFFIX.detail,
        ico: "特",
      });
      return;
    }
    if (id === "skill_level") {
      hideSkillHoldPreview();
      showEquipAffixDetail({
        title: SKILL_LEVEL_AFFIX.text,
        type: "特殊词条 · 仅橙/红装",
        detail: SKILL_LEVEL_AFFIX.detail,
        ico: "特",
      });
    }
  }

  function bindUniqueAffixTaps(root) {
    if (!root) return;
    root.querySelectorAll("[data-unique-affix]").forEach((el) => {
      el.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        openUniqueAffixPreview(el.dataset.uniqueAffix);
      });
      el.addEventListener("keydown", (e) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        e.preventDefault();
        e.stopPropagation();
        openUniqueAffixPreview(el.dataset.uniqueAffix);
      });
    });
    root.querySelectorAll("[data-special-affix]").forEach((el) => {
      el.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        openSpecialAffixPreview(el.dataset.specialAffix);
      });
      el.addEventListener("keydown", (e) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        e.preventDefault();
        e.stopPropagation();
        openSpecialAffixPreview(el.dataset.specialAffix);
      });
    });
  }

  function renderEquipItemBody(item, { unequip = false, price = false } = {}) {
    const info = rarityInfo(item.rarity);
    const lv = itemLevel(item);
    const affixN = (item.affixes || []).length;
    const affixMax = affixCountForRarity(item.rarity, item.slot);
    const icon = itemIconUrl(item);
    const iconHtml = icon
      ? `<img src="${icon}" alt="${item.name}" decoding="async" loading="eager" />`
      : `<span class="ico-fallback">${info.label}</span>`;
    const kindTag =
      item.kind && item.kind !== "equip"
        ? `<span class="stag kind">${item.kind}</span>`
        : "";
    const rarityTag = `<span class="stag rarity-tag rarity-${info.id}">${info.label}装</span>`;
    const unequipBtn = unequip
      ? `<button type="button" class="equip-btn unequip" id="btnUnequip">卸下</button>`
      : "";
    const metaLine = price
      ? `<div class="equip-preview-rarity">等级 ${lv} · 词条 ${affixN}/${affixMax} · 售价 <b style="color:#d4890a">${itemPrice(item)}</b></div>`
      : `<div class="equip-preview-rarity">等级 ${lv} · ${info.label}装 · 词条 ${affixN}/${affixMax}${
          item.uniqueId ? " · 含唯一" : ""
        }</div>`;
    return `
      <div class="equip-preview-top">
        <div class="equip-preview-ico">${iconHtml}</div>
        <div class="equip-preview-meta">
          <div class="equip-preview-name-row">
            <span class="equip-preview-name">${item.name}</span>
            ${kindTag}
            ${rarityTag}
          </div>
          ${metaLine}
        </div>
        ${unequipBtn}
      </div>
      <div class="equip-preview-bonus">合计 ${formatItemBonus(getItemBonus(item))}</div>
      <p class="equip-preview-desc">${item.desc || "暂无说明。"}</p>
      ${formatPrimaryHtml(item)}
      ${formatAffixesHtml(item)}`;
  }

  function openEquipPreview(hero, slotKey) {
    if (!hero || !slotKey) return;
    equipEdit = { source: "hero", heroId: hero.id, slotKey };
    const item = hero.equip?.[slotKey] || null;
    const title = $("equipPreviewTitle");
    const body = $("equipPreviewBody");
    if (title) title.textContent = SLOT_LABEL[slotKey] || "装备";
    if (!body) return;
    setPreviewActions({
      replace: true,
      sellOne: false,
      upgrade: !!(item && canUpgradeEquip(item)),
      devour: !!(item && normalizeRarity(item.rarity) === "red"),
      affixReplace: !!(item && normalizeRarity(item.rarity) === "red"),
    });

    if (!item) {
      body.innerHTML = `
        <div class="equip-preview-hero">
          <div class="equip-preview-ico empty"><span>空</span></div>
          <div class="equip-preview-meta">
            <div class="equip-preview-name-row">
              <span class="equip-preview-name">未装备</span>
            </div>
            <div class="equip-preview-rarity">点击下方「更换」选择装备</div>
          </div>
        </div>
        <p class="equip-preview-desc">该部位尚未装备。</p>`;
    } else {
      body.innerHTML = renderEquipItemBody(item, { unequip: true });
      body.querySelector("#btnUnequip")?.addEventListener("click", unequipCurrent);
      bindUniqueAffixTaps(body);
    }
    hideEquipAffixDetail();
    $("equipPreviewModal").classList.remove("hidden");
  }

  function openBagItemPreview(invIndex) {
    const inv = getState().inventory || [];
    const item = inv[invIndex];
    if (!item) return;
    equipEdit = { source: "bag", invIndex };
    const title = $("equipPreviewTitle");
    const body = $("equipPreviewBody");
    if (!body) return;

    if (isEquipItem(item)) {
      if (title) title.textContent = SLOT_LABEL[item.slot] || "装备";
      const isRed = normalizeRarity(item.rarity) === "red";
      setPreviewActions({
        replace: false,
        sellOne: true,
        upgrade: canUpgradeEquip(item),
        devour: isRed,
        affixReplace: isRed,
        affixCondense: isRed && hasAffixCondenser() && (item.affixes || []).length > 0,
      });
      body.innerHTML = renderEquipItemBody(item, { price: true });
      bindUniqueAffixTaps(body);
    } else if (isSealItem(item)) {
      if (title) title.textContent = "印章";
      setPreviewActions({ replace: false, sellOne: false });
      const def = sealDef(item);
      const icon = sealIconUrl(item);
      body.innerHTML = `
        <div class="equip-preview-top">
          <div class="equip-preview-ico has-icon" style="--tint:${item.tint || "#c9a227"}">
            <img class="bag-ico-img preview-seal" src="${icon}" alt="" decoding="async" />
          </div>
          <div class="equip-preview-meta">
            <div class="equip-preview-name-row">
              <span class="equip-preview-name">${item.name}</span>
              <span class="stag kind">印章</span>
            </div>
            <div class="equip-preview-rarity">装备后生效</div>
          </div>
        </div>
        <p class="equip-preview-desc">${item.desc || def?.desc || "印章。"}</p>
        <button type="button" class="equip-btn replace" id="btnEquipSeal">装备给英雄</button>`;
      body.querySelector("#btnEquipSeal")?.addEventListener("click", () => {
        openSealEquipHeroPick(invIndex);
      });
    } else if (isAffixItem(item)) {
      if (title) title.textContent = "词条";
      setPreviewActions({ replace: false, sellOne: false });
      const a = item.affix;
      body.innerHTML = `
        <div class="equip-preview-top">
          <div class="equip-preview-ico empty misc" style="--tint:${item.tint || "#c9a227"}">
            <i class="bag-ico preview-ball" aria-hidden="true"></i>
          </div>
          <div class="equip-preview-meta">
            <div class="equip-preview-name-row">
              <span class="equip-preview-name">${item.name}</span>
              <span class="stag kind">词条</span>
            </div>
            <div class="equip-preview-rarity">用于红装「词条替换」</div>
          </div>
        </div>
        <p class="equip-preview-desc">${item.desc || affixDisplayDetail(a)}</p>`;
    } else {
      if (title) title.textContent = MISC_KIND_LABEL[item.kind] || "物品";
      const isWarp = item.useId === "warp_refresh";
      const isPhone = item.useId === "phone_dial";
      const isCondense = item.useId === AFFIX_CONDENSE_USE_ID;
      setPreviewActions({ replace: false, sellOne: false });
      const kindLabel = MISC_KIND_LABEL[item.kind] || "道具";
      const useBtn = isWarp
        ? `<button type="button" class="equip-btn replace" id="btnUseWarp">选择楼层传送</button>`
        : isPhone
          ? `<button type="button" class="equip-btn replace" id="btnUsePhone">打开拨号</button>`
          : "";
      const rarityLine = isWarp || isPhone
        ? "可重复使用"
        : isCondense
          ? `数量 ×${item.qty ?? 1} · 在红装详情中使用`
          : `数量 ×${item.qty ?? 1}`;
      body.innerHTML = `
        <div class="equip-preview-top">
          <div class="equip-preview-ico empty misc" style="--tint:${item.tint || "#ddd"}">
            <i class="bag-ico preview-ball" aria-hidden="true"></i>
          </div>
          <div class="equip-preview-meta">
            <div class="equip-preview-name-row">
              <span class="equip-preview-name">${item.name}</span>
              <span class="stag kind">${kindLabel}</span>
            </div>
            <div class="equip-preview-rarity">${rarityLine}</div>
          </div>
        </div>
        <p class="equip-preview-desc">${
          item.desc ||
          (isCondense
            ? "打开背包中的红装，点击「词条凝炼」即可消耗本道具凝炼一条词条。装备会消失。"
            : item.kind === "consumable"
              ? "消耗品：战斗或探索中使用（功能稍后接入）。"
              : item.kind === "material"
                ? "材料：用于合成/强化等（功能稍后接入）。"
                : "暂无说明。")
        }</p>
        ${useBtn}`;
      body.querySelector("#btnUseWarp")?.addEventListener("click", openWarpPicker);
      body.querySelector("#btnUsePhone")?.addEventListener("click", openPhoneDial);
    }
    hideEquipAffixDetail();
    $("equipPreviewModal").classList.remove("hidden");
  }

  function sellBagItemAt(invIndex) {
    const state = getState();
    const inv = state.inventory || [];
    const item = inv[invIndex];
    if (!item || !isEquipItem(item)) return;
    const gold = itemPrice(item);
    inv.splice(invIndex, 1);
    state.gold = (state.gold || 0) + gold;
    closeEquipPreview();
    renderBag();
    refreshTopBar();
    bumpSave();
  }

  function unequipCurrent() {
    const hero = currentEquipHero();
    if (!hero || !equipEdit) return;
    const { slotKey } = equipEdit;
    const item = hero.equip?.[slotKey];
    if (!item) return;
    const state = getState();
    if (!state.inventory) state.inventory = [];
    state.inventory.push(toBagEquip(item));
    hero.equip[slotKey] = null;
    refreshHeroStats(hero);
    refreshSkillTexts(hero);
    openDetail(hero.id, { keepEquip: true });
    openEquipPreview(hero, slotKey);
    bumpSave();
  }

  function unequipSeal(hero) {
    if (!hero?.seal) return;
    const state = getState();
    if (!state.inventory) state.inventory = [];
    state.inventory.push(hero.seal);
    hero.seal = null;
    hero.spdScale = 1;
    refreshHeroStats(hero);
    openDetail(hero.id);
    refreshExploreHud();
    bumpSave();
  }

  function equipSealToHero(hero, invIndex) {
    const state = getState();
    const inv = state.inventory || [];
    const item = inv[invIndex];
    if (!hero || !isSealItem(item)) return;
    inv.splice(invIndex, 1);
    if (hero.seal) inv.push(hero.seal);
    hero.seal = item;
    if (!heroHasFoolSeal(hero)) hero.spdScale = 1;
    else if (hero.spdScale !== 0 && hero.spdScale !== 0.5 && hero.spdScale !== 1) {
      hero.spdScale = 1;
    }
    refreshHeroStats(hero);
    closeEquipPreview();
    $("equipPickModal")?.classList.add("hidden");
    openDetail(hero.id);
    renderBag();
    refreshExploreHud();
    bumpSave();
  }

  /** 详情印章空槽：从背包选印章 */
  function openSealPickForHero(hero) {
    const inv = getState().inventory || [];
    const list = inv
      .map((it, index) => ({ it, index }))
      .filter(({ it }) => isSealItem(it));
    setEquipPickConfirm(false);
    const title = $("equipPickTitle");
    const sub = $("equipPickSub");
    const box = $("equipPickList");
    if (title) title.textContent = "装备印章";
    if (sub) {
      sub.textContent = list.length
        ? `为 ${hero.name} 选择印章`
        : "背包里还没有印章";
    }
    if (box) {
      box.innerHTML = list
        .map(
          ({ it, index }) =>
            `<button type="button" class="equip-pick-row equip-pick-row-ico" data-inv="${index}">
              <img class="equip-pick-seal" src="${sealIconUrl(it)}" alt="" />
              <span class="equip-pick-name" style="color:${it.tint || "#c9a227"}">${it.name}</span>
              <span class="equip-pick-meta">${sealDef(it)?.desc || it.desc || "印章"}</span>
            </button>`
        )
        .join("");
      box.querySelectorAll(".equip-pick-row").forEach((btn) => {
        btn.addEventListener("click", () => {
          equipSealToHero(hero, Number(btn.dataset.inv));
        });
      });
    }
    $("equipPickModal")?.classList.remove("hidden");
  }

  /** 背包印章：选择装备到哪位英雄 */
  function openSealEquipHeroPick(invIndex) {
    const state = getState();
    const item = state.inventory?.[invIndex];
    if (!isSealItem(item)) return;
    setEquipPickConfirm(false);
    const title = $("equipPickTitle");
    const sub = $("equipPickSub");
    const box = $("equipPickList");
    if (title) title.textContent = "装备印章";
    if (sub) sub.textContent = `将「${item.name}」装备给：`;
    if (box) {
      box.innerHTML = (state.party || [])
        .map((h) => {
          const worn = h.seal ? `（已有 ${h.seal.name}）` : "";
          return `<button type="button" class="equip-pick-row" data-hero="${h.id}">
            <span class="equip-pick-name">${h.name}</span>
            <span class="equip-pick-meta">${h.className}${worn}</span>
          </button>`;
        })
        .join("");
      box.querySelectorAll(".equip-pick-row").forEach((btn) => {
        btn.addEventListener("click", () => {
          const hero = state.party.find((h) => h.id === btn.dataset.hero);
          // 索引可能因中间操作变化；按 id 再找一次
          const idx = (getState().inventory || []).findIndex(
            (it) => it && it.id === item.id
          );
          if (hero && idx >= 0) equipSealToHero(hero, idx);
        });
      });
    }
    $("equipPickModal")?.classList.remove("hidden");
  }

  function candidatesForSlot(slotKey) {
    const hero = currentEquipHero();
    const inv = getState().inventory || [];
    return inv
      .map((it, index) => ({ it, index }))
      .filter(({ it }) => {
        if (!it) return false;
        if (it.kind && it.kind !== "equip" && !it.slot) return false;
        if (!hero) return canEquipInSlot(it, slotKey);
        return canHeroEquipItem(hero, it, slotKey);
      })
      .sort((a, b) => compareEquipByRarityLevel(a.it, b.it));
  }

  function openEquipPick() {
    const hero = currentEquipHero();
    if (!hero || !equipEdit) return;
    const { slotKey } = equipEdit;
    setEquipPickConfirm(false);
    const title = $("equipPickTitle");
    const sub = $("equipPickSub");
    const list = $("equipPickList");
    if (title) title.textContent = `选择${SLOT_LABEL[slotKey] || "装备"}`;
    let limitHint = "";
    if (slotKey === "weapon") {
      if (hero.statsId === "pink" || hero.statsId === "orange") {
        limitHint = "（仅可装备枪械）";
      } else if (hero.statsId === "green" || hero.statsId === "blue") {
        limitHint = "（仅可装备法杖）";
      } else if (
        hero.statsId === "omni" ||
        hero.statsId === "yellow" ||
        hero.statsId === "cyan"
      ) {
        limitHint = "（可装备全部武器）";
      }
    }
    if (sub) {
      sub.textContent = `从背包选择可装备到「${SLOT_LABEL[slotKey]}」的道具${limitHint}`;
    }

    const candidates = candidatesForSlot(slotKey);
    if (!list) return;
    clearTimeout(equipPickEmptyTimer);
    equipPickEmptyTimer = 0;
    if (!candidates.length) {
      list.innerHTML = `<div class="equip-pick-empty">背包里没有可更换到此部位的装备</div>`;
      $("equipPickModal").classList.remove("hidden");
      equipPickEmptyTimer = setTimeout(() => {
        closeEquipPick();
      }, 1000);
      return;
    }
    list.innerHTML = candidates
      .map(({ it, index }) => {
        const info = rarityInfo(it.rarity);
        const icon = itemIconUrl(it);
        const iconHtml = icon
          ? `<img src="${icon}" alt="${it.name}" decoding="async" loading="lazy" />`
          : `<span class="ico-fallback">${info.label}</span>`;
        return `<button type="button" class="equip-pick-item" data-inv="${index}">
            <div class="equip-pick-top">
              <div class="equip-preview-ico">${iconHtml}</div>
              <div class="equip-preview-meta">
                <div class="equip-preview-name-row">
                  <span class="equip-preview-name">${it.name}</span>
                  <span class="stag rarity-tag rarity-${info.id}">${info.label}装</span>
                </div>
                <div class="equip-preview-rarity">等级 ${itemLevel(it)} · ${info.label}装 · 词条 ${(it.affixes || []).length}/${affixCountForRarity(it.rarity, it.slot)}</div>
              </div>
            </div>
            ${formatPrimaryHtml(it, true)}
            ${formatAffixesHtml(it, true)}
            <span class="equip-pick-cta">选择</span>
          </button>`;
      })
      .join("");

    list.querySelectorAll(".equip-pick-item").forEach((btn) => {
      btn.addEventListener("click", () => {
        equipFromInventory(Number(btn.dataset.inv));
      });
    });
    $("equipPickModal").classList.remove("hidden");
  }

  function equipFromInventory(invIndex) {
    const hero = currentEquipHero();
    if (!hero || !equipEdit) return;
    const { slotKey } = equipEdit;
    const state = getState();
    const inv = state.inventory || [];
    const picked = inv[invIndex];
    if (!picked || !canHeroEquipItem(hero, picked, slotKey)) return;

    const worn = hero.equip?.[slotKey] || null;
    // 从背包取出（按索引，避免同 id 误删）
    inv.splice(invIndex, 1);
    if (worn) inv.push(toBagEquip(worn));

    // 装备到角色：去掉背包专用字段干扰
    const next = { ...picked };
    delete next.qty;
    delete next.tint;
    if (next.kind === "equip") next.kind = picked.kind === "equip" ? "" : picked.kind;
    // ring 装到当前孔
    next.slot = slotKey === "ringL" || slotKey === "ringR" ? slotKey : next.slot;
    hero.equip[slotKey] = next;

    refreshHeroStats(hero);
    refreshSkillTexts(hero);
    closeEquipPreview(); // 更换完成：预览与选择一并关掉
    openDetail(hero.id);
    bumpSave();
  }

  function setLeftDetailTab(tab) {
    leftDetailTab = tab === "intro" ? "intro" : "info";
    document.querySelectorAll('.hero-tabs[data-side="left"] .hero-tab').forEach((btn) => {
      btn.classList.toggle("on", btn.dataset.tab === leftDetailTab);
    });
    document.querySelectorAll('.tab-pane[data-side="left"]').forEach((pane) => {
      pane.classList.toggle("on", pane.dataset.pane === leftDetailTab);
    });
  }

  function setRightDetailTab(tab) {
    rightDetailTab = tab === "auto" ? "auto" : "skills";
    detailTab = rightDetailTab;
    document.querySelectorAll('.hero-tabs[data-side="right"] .hero-tab').forEach((btn) => {
      btn.classList.toggle("on", btn.dataset.tab === rightDetailTab);
    });
    document.querySelectorAll('.tab-pane[data-side="right"]').forEach((pane) => {
      pane.classList.toggle("on", pane.dataset.pane === rightDetailTab);
    });
  }

  function setDetailTab(tab) {
    if (tab === "info" || tab === "intro") setLeftDetailTab(tab);
    else setRightDetailTab(tab);
  }

  function hideSkillHoldPreview() {
    const el = $("skillHoldPreview");
    if (!el) return;
    el.classList.add("hidden");
    el.setAttribute("aria-hidden", "true");
    el.innerHTML = "";
    delete el.dataset.skill;
  }

  function skillMpLine(hero, skill) {
    if (!skill || skill.kind === "passive") return "不耗蓝";
    const cost = skillMpCost(hero, skill.id);
    return cost > 0 ? `耗蓝 ${cost}` : "不耗蓝";
  }

  function showSkillHoldPreview(hero, skillId) {
    const skill = hero?.skills?.find((s) => s.id === skillId);
    const el = $("skillHoldPreview");
    if (!skill || !el) return;
    const lv = getSkillLevel(hero, skill.id);
    const baseLv = getBaseSkillLevel(hero, skill.id);
    const bonus = Math.max(0, lv - baseLv);
    const typeLine =
      skill.kind === "passive"
        ? "被动"
        : `${skillKindLabel(skill)}${skill.style ? ` · ${styleTag(skill.style)}` : ""}`;
    const lvLine = bonus
      ? `等级 ${lv}（加点 ${baseLv}/${MAX_SKILL_LEVEL}）`
      : `加点 ${baseLv}/${MAX_SKILL_LEVEL}`;
    el.innerHTML = `
      <div class="shp-name">${skill.name}</div>
      <div class="shp-meta">${typeLine} · ${lvLine} · ${skillMpLine(hero, skill)}</div>
      <p class="shp-desc">${skill.desc || skill.nums || ""}</p>`;
    el.dataset.skill = skillId;
    el.classList.remove("hidden");
    el.setAttribute("aria-hidden", "false");
  }

  function bindSkillListInteractions(hero) {
    hideSkillHoldPreview();
    $("skillList")?.querySelectorAll(".skill-open").forEach((btn) => {
      btn.addEventListener("click", () => {
        openSkillDetail(hero.id, btn.dataset.skill);
      });
    });
  }

  function renderAutoSlots(hero) {
    ensureRotation(hero);
    const box = $("autoSlots");
    if (!box) return;

    const summary = hero.autoRotation
      .map((sid, i) => {
        const empty = isEmptyAutoSlot(sid);
        const sk = empty ? null : hero.skills.find((s) => s.id === sid);
        const label = empty ? "空" : sk ? sk.name : "?";
        const tip = empty
          ? `第 ${i + 1} 招：空＝普通攻击`
          : `点击更换第 ${i + 1} 招`;
        return `<button type="button" class="auto-chip summary ${empty ? "is-empty" : ""}" data-edit="${i}" title="${tip}">
          <span class="auto-chip-idx">${i + 1}.</span><span class="auto-chip-name">${label}</span>
        </button>`;
      })
      .join("");

    box.innerHTML = `<div class="auto-summary">${summary}</div>`;
    box.querySelectorAll("[data-edit]").forEach((btn) => {
      btn.addEventListener("click", () => openSkillPick(hero, Number(btn.dataset.edit)));
    });
  }

  function openSkillPick(hero, slotIdx) {
    if (!hero || !Number.isFinite(slotIdx)) return;
    ensureRotation(hero);
    autoEditIdx = slotIdx;
    const currentId = hero.autoRotation[slotIdx];
    const emptyOn = isEmptyAutoSlot(currentId);
    const title = $("skillPickTitle");
    const sub = $("skillPickSub");
    const list = $("skillPickList");
    if (title) title.textContent = `第 ${slotIdx + 1} 招`;
    if (sub) sub.textContent = `为 ${hero.name} 选择；清空＝普通攻击`;

    const basicId = basicAttackId(hero);
    const basic = hero.skills.find((s) => s.id === basicId);
    const actives = activeSkills(hero);
    const clearRow = `<button type="button" class="skill-pick-item clear ${emptyOn ? "on" : ""}" data-skill="" data-clear="1">
      <div class="skill-pick-head">
        <div class="skill-pick-ico clear">空</div>
        <div class="skill-pick-meta">
          <div class="skill-pick-name">清空
            <span class="stag">普攻</span>
            ${emptyOn ? '<span class="stag current">当前</span>' : ""}
          </div>
          <div class="skill-pick-nums">${basic ? basic.name : "普通攻击"}</div>
        </div>
      </div>
      <p class="skill-pick-desc">本格不指定技能，自动战斗时打普通攻击。</p>
    </button>`;

    list.innerHTML =
      clearRow +
      actives
        .map((s) => {
          const on = !emptyOn && s.id === currentId;
          const mp = skillMpCost(hero, s.id);
          const mpNote = mp > 0 ? ` · 耗蓝${mp}` : "";
          return `<button type="button" class="skill-pick-item ${on ? "on" : ""}" data-skill="${s.id}">
          <div class="skill-pick-head">
            <div class="skill-pick-ico">${s.style === "heal" ? "愈" : s.style === "ranged" ? "远" : "近"}</div>
            <div class="skill-pick-meta">
              <div class="skill-pick-name">${s.name}
                <span class="stag">${styleTag(s.style)}</span>
                ${on ? '<span class="stag current">当前</span>' : ""}
              </div>
              <div class="skill-pick-nums">${s.nums || ""}${mpNote}</div>
            </div>
          </div>
        </button>`;
        })
        .join("");

    list.querySelectorAll(".skill-pick-item").forEach((card) => {
      card.addEventListener("click", () => {
        const sid = card.dataset.clear === "1" ? "" : card.dataset.skill;
        updateRotationSlot(hero, autoEditIdx, sid);
        renderAutoSlots(hero);
        bumpSave();
        closeSkillPick();
      });
    });

    $("skillPickModal").classList.remove("hidden");
  }

  /**
   * 详情箭头预览顺序：先已上阵（阵容序），再未上阵（队伍序）
   * 未上阵不出现在左侧条，但可用箭头预览到
   */
  function previewHeroes() {
    const party = getState().party || [];
    const deployed = getDeployedHeroes(getState());
    const seen = new Set(deployed.map((h) => h.id));
    const rest = party.filter((h) => !seen.has(h.id));
    const list = [...deployed, ...rest];
    return list.length ? list : party.slice(0, 1);
  }

  function previewIndex(heroId) {
    return previewHeroes().findIndex((h) => h.id === heroId);
  }

  function syncDetailNav() {
    const list = previewHeroes();
    const idx = previewIndex(detailHeroId);
    const prev = $("detailPrev");
    const next = $("detailNext");
    if (prev) prev.disabled = list.length < 2 || idx < 0;
    if (next) next.disabled = list.length < 2 || idx < 0;
  }

  function shiftDetail(delta) {
    const list = previewHeroes();
    if (list.length < 2) return;
    let idx = previewIndex(detailHeroId);
    if (idx < 0) idx = 0;
    const next = list[(idx + delta + list.length) % list.length];
    if (next) openDetail(next.id);
  }

  function openDetail(heroId, opts = {}) {
    const hero = getState().party.find((h) => h.id === heroId);
    if (!hero) return;
    closeSkillPick();
    if (!opts.keepEquip) closeEquipPreview();
    $("bagModal")?.classList.add("hidden");
    $("formationModal")?.classList.add("hidden");
    detailHeroId = heroId;
    setMode("detail");
    refreshHeroStats(hero);
    $("detailModal").classList.remove("hidden");
    setLeftDetailTab(leftDetailTab || "info");
    setRightDetailTab(rightDetailTab || "skills");
    syncDetailNav();

    const nameV = $("detailNameV");
    if (nameV) nameV.textContent = hero.name;
    $("detailLevel").textContent = `等级${hero.level ?? 1}`;
    $("detailDesc").textContent = `${hero.className}。${hero.desc}`;
    $("detailPower").textContent = `战力 ${combatPower(hero)}`;

    const sealBtn = $("detailSealSlot");
    if (sealBtn) {
      const seal = hero.seal;
      const ico = sealBtn.querySelector(".seal-slot-ico");
      sealBtn.classList.toggle("filled", !!seal);
      sealBtn.title = seal ? `${seal.name}（点击卸下）` : "印章槽（空）· 点击从背包装备";
      if (ico) {
        ico.src = sealIconUrl(seal || null);
        ico.alt = seal ? seal.name : "空印章槽";
      }
      sealBtn.onclick = () => {
        if (seal) unequipSeal(hero);
        else openSealPickForHero(hero);
      };
    }

    const deploy = $("detailDeploy");
    if (deploy) {
      if (isHeroDead(hero)) {
        deploy.textContent = "阵亡";
        deploy.classList.add("off", "dead-tag");
      } else {
        const on = isDeployed(hero.id);
        const cap = !!hero.isCaptain || hero.id === getState().captainId;
        deploy.textContent = cap ? (on ? "队长·已上阵" : "队长") : on ? "已上阵" : "未上阵";
        deploy.classList.toggle("off", !on && !cap);
        deploy.classList.remove("dead-tag");
      }
      deploy.hidden = false;
    }

    const reviveBtn = $("btnRevive");
    if (reviveBtn) {
      const dead = isHeroDead(hero);
      const cost = reviveCost(hero.level || 1);
      reviveBtn.hidden = !dead;
      reviveBtn.classList.toggle("hidden", !dead);
      reviveBtn.textContent = `复活该英雄（${cost} 金币）`;
      reviveBtn.disabled = !dead || (getState().gold || 0) < cost;
      reviveBtn.onclick = () => tryReviveHero(hero.id, { reopenDetail: true });
    }

    const exp = hero.exp ?? 0;
    const maxExp = hero.maxExp || 100;
    const mp = hero.mp ?? 0;
    const maxMp = hero.maxMp || 1;
    const hpPct = clamp((hero.hp / hero.maxHp) * 100, 0, 100);
    const expPct = clamp((exp / maxExp) * 100, 0, 100);
    const mpPct = clamp((mp / maxMp) * 100, 0, 100);

    $("detailExpFill").style.width = `${expPct}%`;
    $("detailExpText").textContent = `${exp}/${maxExp}`;
    $("detailHpFill").style.width = `${hpPct}%`;
    $("detailHpText").textContent = `${Math.ceil(hero.hp)}/${hero.maxHp}`;
    $("detailMpFill").style.width = `${mpPct}%`;
    $("detailMpText").textContent = `${mp}/${maxMp}`;

    const shape = $("detailShape");
    const spinWrap = $("detailSpin");
    const peers = getState().party;
    shape.className = `preview-shape ${hero.shape}`;
    shape.setAttribute("style", diamondStyleAttr(hero, unitDiamondScale("lg"), peers));
    // 转圈仅小粉；按像素高宽比（队伍占比体型）判断纤细
    spinWrap?.classList.toggle(
      "slender-spin",
      hero.statsId === "pink" && isSlenderFemale(hero, peers)
    );

    for (const key of SLOT_KEYS) {
      const el = document.querySelector(`#equipBoard .slot[data-slot="${key}"]`);
      if (!el) continue;
      const item = hero.equip[key];
      const ico = el.querySelector(".slot-ico");
      const label = el.querySelector(".slot-label");
      const lvEl = el.querySelector(".slot-lv");
      if (label) {
        label.textContent = SLOT_LABEL[key];
        label.hidden = !!item;
      }
      el.classList.toggle("filled", !!item);
      el.classList.toggle("has-icon", !!(item && item.icon));
      for (const c of [...el.classList]) {
        if (c.startsWith("rarity-")) el.classList.remove(c);
      }
      if (item) el.classList.add(`rarity-${rarityInfo(item.rarity).id}`);
      if (ico) {
        const url = item ? itemIconUrl(item) : "";
        if (url) {
          ico.decoding = "async";
          ico.onload = () => {
            el.classList.add("has-icon");
            ico.hidden = false;
            if (label) label.hidden = true;
          };
          ico.onerror = () => {
            // 小图失败时再试原图一次，避免直接空白
            const full = itemIconUrl(item, { full: true });
            if (full && ico.dataset.tried !== "full") {
              ico.dataset.tried = "full";
              ico.src = full;
              return;
            }
            el.classList.remove("has-icon");
            ico.removeAttribute("src");
            ico.hidden = true;
            delete ico.dataset.tried;
            if (label) {
              label.hidden = false;
              label.textContent = item?.name || SLOT_LABEL[key];
            }
          };
          delete ico.dataset.tried;
          ico.src = url;
          ico.alt = item.name;
          ico.hidden = false;
        } else {
          ico.onload = null;
          ico.onerror = null;
          ico.removeAttribute("src");
          ico.alt = "";
          ico.hidden = true;
        }
      }
      if (lvEl) {
        if (item) {
          lvEl.textContent = `lv${itemLevel(item)}`;
          lvEl.hidden = false;
        } else {
          lvEl.textContent = "";
          lvEl.hidden = true;
        }
      }
      el.classList.add("clickable");
      el.onclick = () => openEquipPreview(hero, key);
    }

    const eq = sumEquipBonus(hero.equip);
    const critRate = Math.round((hero.critRate ?? DEFAULT_CRIT_RATE) * 100);
    const critDmg = Math.round((hero.critDmg ?? DEFAULT_CRIT_DMG) * 100);
    const hitRate = Math.round((hero.hitRate ?? 1) * 1000) / 10;
    const dodgeFull =
      hero.dodgeFull ??
      Math.min(0.55, DEFAULT_DODGE_RATE + (eq.dodgeRate || 0));
    const dodgeRate = Math.round((hero.dodgeRate ?? 0.05) * 1000) / 10;
    const dodgeFullPct = Math.round(dodgeFull * 1000) / 10;
    const capNote = hero.isCaptain ? " · 队长+10%" : "";
    const atkFull = hero.atkFull ?? hero.atk;
    const sAtk = Number(hero.atkScale);
    const atkScale = sAtk === 0.5 || sAtk === 0.75 || sAtk === 1 ? sAtk : 1;
    const sDodge = Number(hero.dodgeScale);
    const dodgeScale = sDodge === 0 || sDodge === 1 ? sDodge : 1;
    const spdFull = hero.spdFull ?? hero.spd;
    const sSpd = Number(hero.spdScale);
    const spdScale =
      heroHasFoolSeal(hero) && (sSpd === 0 || sSpd === 0.5 || sSpd === 1)
        ? sSpd
        : 1;
    const atkRow = `<li class="stat-atk-scale" title="基础${hero.base.atk} + 被动${hero.passiveBoost.atk} + 装备${eq.atk}${capNote} · 满攻${atkFull}">
            <span>攻击</span>
            <b>${hero.atk}</b>
            <div class="atk-scale-opts" role="group" aria-label="攻击倍率">
              ${[0.5, 0.75, 1]
                .map(
                  (s) =>
                    `<button type="button" class="atk-scale-btn${
                      s === atkScale ? " on" : ""
                    }" data-atk-scale="${s}">${Math.round(s * 100)}%</button>`
                )
                .join("")}
            </div>
          </li>`;
    const dodgeRow = `<li class="stat-atk-scale" title="默认 5% + 装备 ${
      Math.round((eq.dodgeRate || 0) * 1000) / 10
    }% = ${dodgeFullPct}% · 100%档=沿用该概率（非必闪）">
            <span>闪避</span>
            <b>${dodgeRate}%</b>
            <div class="atk-scale-opts" role="group" aria-label="闪避倍率">
              ${[0, 1]
                .map(
                  (s) =>
                    `<button type="button" class="atk-scale-btn${
                      s === dodgeScale ? " on" : ""
                    }" data-dodge-scale="${s}">${Math.round(s * 100)}%</button>`
                )
                .join("")}
            </div>
          </li>`;
    const spdRow = heroHasFoolSeal(hero)
      ? `<li class="stat-atk-scale" title="基础${hero.base.spd} + 装备${eq.spd}${capNote} · 满速${spdFull} · 愚人印章可调档">
            <span>速度</span>
            <b>${hero.spd}</b>
            <div class="atk-scale-opts" role="group" aria-label="速度倍率">
              ${[0, 0.5, 1]
                .map(
                  (s) =>
                    `<button type="button" class="atk-scale-btn${
                      s === spdScale ? " on" : ""
                    }" data-spd-scale="${s}">${Math.round(s * 100)}%</button>`
                )
                .join("")}
            </div>
          </li>`
      : `<li title="基础${hero.base.spd} + 装备${eq.spd}${capNote}"><span>速度</span><b>${hero.spd}</b></li>`;
    $("statList").innerHTML = [
      `<li title="基础${hero.base.hp} + 被动${hero.passiveBoost.hp} + 装备${eq.hp}${capNote}"><span>生命</span><b>${Math.ceil(hero.hp)} / ${hero.maxHp}</b></li>`,
      atkRow,
      `<li title="基础${hero.base.def} + 被动${hero.passiveBoost.def} + 装备${eq.def}${capNote}"><span>防御</span><b>${hero.def}</b></li>`,
      spdRow,
      `<li title="默认 10% + 装备 ${Math.round((eq.critRate || 0) * 1000) / 10}%"><span>暴击率</span><b>${critRate}%</b></li>`,
      `<li title="默认 150% + 装备 ${Math.round((eq.critDmg || 0) * 1000) / 10}%"><span>暴击伤害</span><b>${critDmg}%</b></li>`,
      `<li title="默认 100% + 装备 ${Math.round((eq.hitRate || 0) * 1000) / 10}%"><span>命中</span><b>${hitRate}%</b></li>`,
      dodgeRow,
    ].join("");

    $("statList")?.querySelectorAll("[data-atk-scale]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const s = Number(btn.dataset.atkScale);
        if (s !== 0.5 && s !== 0.75 && s !== 1) return;
        hero.atkScale = s;
        refreshHeroStats(hero);
        openDetail(hero.id);
        refreshExploreHud();
        bumpSave();
      });
    });
    $("statList")?.querySelectorAll("[data-dodge-scale]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const s = Number(btn.dataset.dodgeScale);
        if (s !== 0 && s !== 1) return;
        hero.dodgeScale = s;
        refreshHeroStats(hero);
        openDetail(hero.id);
        refreshExploreHud();
        bumpSave();
      });
    });
    $("statList")?.querySelectorAll("[data-spd-scale]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (!heroHasFoolSeal(hero)) return;
        const s = Number(btn.dataset.spdScale);
        if (s !== 0 && s !== 0.5 && s !== 1) return;
        hero.spdScale = s;
        refreshHeroStats(hero);
        openDetail(hero.id);
        refreshExploreHud();
        bumpSave();
      });
    });

    const spEl = $("detailSkillPoints");
    if (spEl) spEl.textContent = String(hero.skillPoints ?? 0);

    const points = hero.skillPoints ?? 0;
    refreshSkillTexts(hero);
    $("skillList").innerHTML = hero.skills
      .map((s) => {
        const lv = getSkillLevel(hero, s.id);
        const baseLv = getBaseSkillLevel(hero, s.id);
        const canUp = points > 0 && baseLv < MAX_SKILL_LEVEL;
        const typeLine =
          s.kind === "passive"
            ? "被动"
            : s.style === "buff"
              ? "增益"
              : "主动";
        const lvLabel = `lv${lv}`;
        return `<li class="skill-item" data-skill="${s.id}">
          <div class="skill-row">
            <button type="button" class="skill-open" data-skill="${s.id}">
              <div class="skill-ico ${skillIcoClass(s)}">${skillFace(s)}</div>
              <div class="skill-meta">
                <span class="sname">${s.name}</span>
                <span class="stype">${typeLine}</span>
                <span class="slv">${lvLabel}</span>
              </div>
            </button>
          </div>
          <button type="button" class="skill-up-btn${canUp ? "" : " off"}" data-skill="${s.id}" ${canUp ? "" : "disabled"} aria-label="升级">${
            baseLv >= MAX_SKILL_LEVEL ? "满" : "+"
          }</button>
        </li>`;
      })
      .join("");

    $("skillList")?.querySelectorAll(".skill-up-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        hideSkillHoldPreview();
        if (upgradeSkill(hero, btn.dataset.skill)) {
          refreshHeroStats(hero);
          openDetail(hero.id);
          refreshExploreHud();
          bumpSave();
        }
      });
    });
    bindSkillListInteractions(hero);

    renderAutoSlots(hero);
  }

  function openSkillDetail(heroId, skillId) {
    hideSkillHoldPreview();
    const hero = getState().party.find((h) => h.id === heroId);
    const skills = hero?.skills || [];
    const skill = skills.find((s) => s.id === skillId);
    const title = $("skillDetailTitle");
    const body = $("skillDetailBody");
    const modal = $("skillDetailModal");
    const prevBtn = $("btnSkillDetailPrev");
    const nextBtn = $("btnSkillDetailNext");
    if (!hero || !skill || !body || !modal) return;

    const idx = skills.findIndex((s) => s.id === skillId);
    const canNav = skills.length > 1;
    if (prevBtn) {
      prevBtn.disabled = !canNav;
      prevBtn.classList.toggle("off", !canNav);
      prevBtn.onclick = canNav
        ? () => {
            const n = skills.length;
            const next = skills[(idx - 1 + n) % n];
            openSkillDetail(hero.id, next.id);
          }
        : null;
    }
    if (nextBtn) {
      nextBtn.disabled = !canNav;
      nextBtn.classList.toggle("off", !canNav);
      nextBtn.onclick = canNav
        ? () => {
            const n = skills.length;
            const next = skills[(idx + 1) % n];
            openSkillDetail(hero.id, next.id);
          }
        : null;
    }

    const lv = getSkillLevel(hero, skill.id);
    const baseLv = getBaseSkillLevel(hero, skill.id);
    const points = hero.skillPoints ?? 0;
    const canUp = points > 0 && baseLv < MAX_SKILL_LEVEL;
    const typeLine =
      skill.kind === "passive"
        ? "被动技能"
        : `${skillKindLabel(skill)}${skill.style ? ` · ${styleTag(skill.style)}` : ""}`;
    const mpLine = skillMpLine(hero, skill);

    if (title) title.textContent = skill.name;
    refreshSkillTexts(hero);
    const curText = buildSkillText(hero, skill.id, lv);
    const nextText =
      baseLv < MAX_SKILL_LEVEL
        ? buildSkillText(hero, skill.id, lv + 1)
        : null;
    const cur = curText?.desc || curText?.nums || skill.desc || skill.nums || "";
    const nextLine = nextText?.desc || nextText?.nums || "";
    const lvLine =
      lv > baseLv
        ? `实际 ${lv} · 加点 ${baseLv} / ${MAX_SKILL_LEVEL}`
        : `加点 ${baseLv} / ${MAX_SKILL_LEVEL}`;
    const aiOpts = skillAiOptions(skill.id);
    const aiMode = aiOpts ? getSkillAiMode(hero, skill.id) : null;
    const aiBlock = aiOpts
      ? `<div class="skill-detail-ai">
          <div class="skill-detail-ai-lab">自动目标</div>
          <div class="skill-detail-ai-opts">
            ${aiOpts
              .map(
                (o) =>
                  `<button type="button" class="skill-ai-btn${
                    o.id === aiMode ? " on" : ""
                  }" data-ai="${o.id}">${o.label}</button>`
              )
              .join("")}
          </div>
        </div>`
      : "";

    body.innerHTML = `
      <div class="skill-detail-top">
        <div class="skill-detail-ico ${skillIcoClass(skill)}">${skillFace(skill)}</div>
        <div class="skill-detail-meta">
          <div class="skill-detail-name">${skill.name}</div>
          <div class="skill-detail-type">${typeLine}</div>
          <div class="skill-detail-lv">${lvLine}</div>
          <div class="skill-detail-mp">${mpLine}</div>
        </div>
      </div>
      ${cur ? `<div class="skill-detail-nums">${cur}</div>` : ""}
      ${
        nextLine
          ? `<div class="skill-detail-next"><span class="skill-detail-next-lab">下一级</span>${nextLine}</div>`
          : ""
      }
      ${aiBlock}
      <div class="skill-detail-actions">
        <button type="button" class="skill-detail-up${canUp ? "" : " off"}" id="btnSkillDetailUp" ${canUp ? "" : "disabled"}>
          ${baseLv >= MAX_SKILL_LEVEL ? "加点已满" : canUp ? `升级（技能点 ${points}）` : "技能点不足"}
        </button>
      </div>`;

    body.querySelectorAll("[data-ai]").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (setSkillAiMode(hero, skill.id, btn.dataset.ai)) {
          bumpSave();
          openSkillDetail(hero.id, skill.id);
        }
      });
    });

    const up = body.querySelector("#btnSkillDetailUp");
    if (up) {
      up.onclick = () => {
        if (upgradeSkill(hero, skill.id)) {
          refreshHeroStats(hero);
          openDetail(hero.id);
          openSkillDetail(hero.id, skill.id);
          refreshExploreHud();
          bumpSave();
        }
      };
    }

    modal.classList.remove("hidden");
  }

  function openBag() {
    if (canOpenParty && !canOpenParty()) return;
    closeModals();
    setMode("menu");
    bagTab = "equips";
    syncBagTabs();
    $("bagModal").classList.remove("hidden");
    renderBag();
  }

  function syncBagTabs() {
    document.querySelectorAll(".bag-tab").forEach((btn) => {
      btn.classList.toggle("on", btn.dataset.bagTab === bagTab);
    });
  }

  function setBagTab(tab) {
    if (tab === "seals" || tab === "tools" || tab === "equips") bagTab = tab;
    else bagTab = "equips";
    syncBagTabs();
    renderBag();
  }

  function countBagEquipsByRarities(rarities) {
    const set = rarities instanceof Set ? rarities : new Set(rarities || []);
    const inv = getState().inventory || [];
    let count = 0;
    let gold = 0;
    const byRarity = {};
    for (const id of set) byRarity[id] = 0;
    for (const it of inv) {
      if (!isEquipItem(it)) continue;
      const r = normalizeRarity(it.rarity);
      if (!set.has(r)) continue;
      count += 1;
      gold += itemPrice(it);
      byRarity[r] = (byRarity[r] || 0) + 1;
    }
    return { count, gold, byRarity };
  }

  function countBagEquipsByRarity(rarity) {
    return countBagEquipsByRarities(new Set([rarity]));
  }

  function sellBagEquipsOfRarities(rarities) {
    const set = rarities instanceof Set ? rarities : new Set(rarities || []);
    const state = getState();
    const inv = state.inventory || [];
    let count = 0;
    let gold = 0;
    const next = [];
    for (const it of inv) {
      if (isEquipItem(it) && set.has(normalizeRarity(it.rarity))) {
        count += 1;
        gold += itemPrice(it);
      } else {
        next.push(it);
      }
    }
    state.inventory = next;
    state.gold = (state.gold || 0) + gold;
    return { count, gold };
  }

  function updateBagSellSummary() {
    const summary = $("bagSellSummary");
    const btn = $("btnConfirmSell");
    if (!summary || !btn) return;
    if (!sellRarities.size) {
      summary.textContent = "请选择一种或多种品质";
      btn.disabled = true;
      btn.textContent = "确认出售";
      return;
    }
    const { count, gold } = countBagEquipsByRarities(sellRarities);
    const labels = RARITY_ORDER.filter((id) => sellRarities.has(id))
      .map((id) => {
        const info = rarityInfo(id);
        return `<span class="rarity-text-${info.id}">${info.label}</span>`;
      })
      .join("、");
    if (!count) {
      summary.innerHTML = `背包中没有${labels}装`;
      btn.disabled = true;
      btn.textContent = "确认出售";
      return;
    }
    summary.innerHTML = `将出售 <b>${count}</b> 件${labels}装，获得 <b>${gold}</b> 金币`;
    btn.disabled = false;
    btn.textContent =
      sellRarities.size === 1
        ? `出售全部${rarityInfo([...sellRarities][0]).label}装`
        : `出售所选 ${sellRarities.size} 种品质`;
  }

  function openBagSell() {
    sellRarities = new Set();
    const box = $("bagSellRarities");
    if (box) {
      box.innerHTML = RARITY_ORDER.map((id) => {
        const info = rarityInfo(id);
        const { count } = countBagEquipsByRarity(id);
        return `<button type="button" class="bag-sell-rarity rarity-${id}" data-rarity="${id}" aria-pressed="false">
          <span>${info.label}装</span>
          <small>${count} 件</small>
        </button>`;
      }).join("");
      box.querySelectorAll(".bag-sell-rarity").forEach((btn) => {
        btn.addEventListener("click", () => {
          const id = btn.dataset.rarity;
          if (sellRarities.has(id)) sellRarities.delete(id);
          else sellRarities.add(id);
          const on = sellRarities.has(id);
          btn.classList.toggle("on", on);
          btn.setAttribute("aria-pressed", on ? "true" : "false");
          updateBagSellSummary();
        });
      });
    }
    updateBagSellSummary();
    $("bagSellModal")?.classList.remove("hidden");
  }

  function confirmBagSell() {
    if (!sellRarities.size) return;
    const labels = RARITY_ORDER.filter((id) => sellRarities.has(id))
      .map((id) => rarityInfo(id).label)
      .join("、");
    const { count, gold } = sellBagEquipsOfRarities(sellRarities);
    closeBagSell();
    closeEquipPreview();
    renderBag();
    refreshTopBar();
    if (count > 0) {
      bumpSave();
      const toast = $("lootToast");
      if (toast) {
        toast.textContent = `已出售 ${count} 件${labels}装，+${gold} 金币`;
        toast.classList.remove("hidden");
        clearTimeout(toast._bagSellTimer);
        toast._bagSellTimer = setTimeout(() => toast.classList.add("hidden"), 2200);
      }
    }
  }

  function sortBagInventory() {
    const state = getState();
    const items = (state.inventory || []).filter(Boolean);
    const equips = [];
    const seals = [];
    const tools = [];
    for (const it of items) {
      if (isSealItem(it)) seals.push(it);
      else if (isEquipItem(it)) equips.push(it);
      else tools.push(it);
    }
    equips.sort(compareEquipByRarityLevel);
    seals.sort((a, b) =>
      String(a.name || "").localeCompare(String(b.name || ""), "zh")
    );
    tools.sort((a, b) => {
      const pa = toolSortPriority(a);
      const pb = toolSortPriority(b);
      if (pa !== pb) return pa - pb;
      return String(a.name || "").localeCompare(String(b.name || ""), "zh");
    });
    state.inventory = [...tools, ...seals, ...equips];
    renderBag();
    bumpSave();
    const btn = $("btnBagSort");
    if (btn) {
      btn.classList.remove("flash");
      void btn.offsetWidth;
      btn.classList.add("flash");
    }
    const toast = $("toast");
    if (toast) {
      toast.textContent = items.length ? "背包已整理" : "背包是空的";
      toast.classList.remove("hidden");
      clearTimeout(toast._bagSortTimer);
      toast._bagSortTimer = setTimeout(() => toast.classList.add("hidden"), 1600);
    }
  }

  function bagItemMatchesTab(it) {
    if (!it) return false;
    if (bagTab === "seals") return isSealItem(it);
    if (bagTab === "equips") return isEquipItem(it) && !isSealItem(it);
    // tools：非装备、非印章
    return !isEquipItem(it) && !isSealItem(it);
  }

  function renderBag() {
    const grid = $("bagGrid");
    if (!grid) return;
    const all = getState().inventory || [];
    const indexed = all
      .map((it, index) => ({ it, index }))
      .filter(({ it }) => bagItemMatchesTab(it));
    const cells = [];
    for (let i = 0; i < BAG_SLOTS; i++) {
      const entry = indexed[i];
      const it = entry?.it;
      if (!it) {
        cells.push(`<div class="bag-slot empty"></div>`);
        continue;
      }
      const invIndex = entry.index;
      const equip = isEquipItem(it);
      const seal = isSealItem(it);
      const affix = isAffixItem(it);
      const qty =
        equip && it.level != null
          ? `<em>lv${it.level}</em>`
          : it.qty > 1
            ? `<em>×${it.qty}</em>`
            : !equip && !seal && !affix
              ? `<em>×${it.qty ?? 1}</em>`
              : "";
      const icon = seal ? sealIconUrl(it) : itemIconUrl(it);
      const rarity = equip || it.rarity ? rarityInfo(it.rarity).id : "";
      const rarityCls = rarity ? ` rarity-${rarity}` : "";
      const miscCls = !equip && !seal && !icon ? " misc" : "";
      const sealCls = seal ? " seal-item" : "";
      const affixCls = affix ? " seal-item" : "";
      const shortName =
        !equip && !seal && !icon
          ? `<span class="bag-name">${(it.name || "").slice(0, 4)}</span>`
          : "";
      const icoHtml = icon
        ? `<img class="bag-ico-img" src="${icon}" alt="${it.name}" decoding="async" loading="lazy" />`
        : `<i class="bag-ico" aria-hidden="true"></i>`;
      const rareMark =
        equip && rarity && rarity !== "white"
          ? `<i class="bag-rarity rarity-text-${rarity}">${rarityLabel(rarity)}</i>`
          : "";
      const kindHint = seal
        ? "印章"
        : affix
          ? "词条"
          : !equip
            ? MISC_KIND_LABEL[it.kind] || "道具"
            : `${rarityLabel(rarity)}装`;
      cells.push(`<button type="button" class="bag-slot clickable${icon ? " has-icon" : ""}${rarityCls}${miscCls}${sealCls}${affixCls}" data-inv="${invIndex}" title="${it.name} · ${kindHint}" style="--tint:${it.tint || rarityInfo(it.rarity).color};--rarity:${rarityInfo(it.rarity).color}">
        ${icoHtml}
        ${shortName}
        ${rareMark}
        ${qty}
      </button>`);
    }
    grid.innerHTML = cells.join("");
    grid.querySelectorAll(".bag-slot.clickable").forEach((btn) => {
      btn.addEventListener("click", () => openBagItemPreview(Number(btn.dataset.inv)));
    });
  }

  function openFormation() {
    if (canOpenParty && !canOpenParty()) return;
    closeModals();
    setMode("menu");
    $("formationModal").classList.remove("hidden");
    renderFormation();
  }

  function formationPowerLuck() {
    const deployed = getDeployedHeroes(getState()).filter((h) => !isHeroDead(h));
    let power = 0;
    let luck = 0;
    for (const h of deployed) {
      refreshHeroStats(h);
      power += combatPower(h);
      luck += Math.floor(h.spd * 0.8 + h.atk * 0.2);
    }
    return { power, luck, count: deployed.length };
  }

  function clearFormDrag() {
    if (!formDrag) return;
    formDrag.source?.classList.remove("dragging");
    formDrag.ghost?.remove();
    document.querySelectorAll(".form-slot.drop-over").forEach((el) => {
      el.classList.remove("drop-over");
    });
    formDrag = null;
  }

  function slotAtPoint(x, y) {
    const el = document.elementFromPoint(x, y);
    return el?.closest?.(".form-slot") || null;
  }

  function moveFormationSlot(from, to) {
    const state = getState();
    normalizeFormation(state, FORMATION_SLOTS);
    if (from === to || from < 0 || to < 0) return;
    if (from >= FORMATION_SLOTS || to >= FORMATION_SLOTS) return;
    const a = state.formation[from];
    const b = state.formation[to];
    state.formation[from] = b;
    state.formation[to] = a;
    persistFormation();
    renderFormation();
    refreshExploreHud();
  }

  function bindFormationDrag(board) {
    board.querySelectorAll(".form-slot.filled").forEach((slot) => {
      slot.addEventListener("pointerdown", (e) => {
        if (e.button != null && e.button !== 0) return;
        if (e.target.closest(".form-x")) return;
        const from = Number(slot.dataset.slot);
        const heroId = slot.dataset.id;
        if (!Number.isFinite(from) || !heroId) return;

        e.preventDefault();
        slot.setPointerCapture?.(e.pointerId);

        const ghost = document.createElement("div");
        ghost.className = "form-drag-ghost";
        ghost.innerHTML = slot.querySelector(".unit-ico")?.outerHTML || "";
        document.body.appendChild(ghost);
        const half = 22;
        ghost.style.left = `${e.clientX - half}px`;
        ghost.style.top = `${e.clientY - half}px`;

        slot.classList.add("dragging");
        formDrag = { from, heroId, source: slot, ghost, pointerId: e.pointerId };
      });

      slot.addEventListener("pointermove", (e) => {
        if (!formDrag || formDrag.pointerId !== e.pointerId) return;
        formDrag.ghost.style.left = `${e.clientX - 22}px`;
        formDrag.ghost.style.top = `${e.clientY - 22}px`;
        document.querySelectorAll(".form-slot.drop-over").forEach((el) => {
          el.classList.remove("drop-over");
        });
        const over = slotAtPoint(e.clientX, e.clientY);
        if (over && Number(over.dataset.slot) !== formDrag.from) {
          over.classList.add("drop-over");
        }
      });

      slot.addEventListener("pointerup", (e) => {
        if (!formDrag || formDrag.pointerId !== e.pointerId) return;
        const over = slotAtPoint(e.clientX, e.clientY);
        const to = over ? Number(over.dataset.slot) : NaN;
        const from = formDrag.from;
        clearFormDrag();
        if (Number.isFinite(to)) moveFormationSlot(from, to);
      });

      slot.addEventListener("pointercancel", (e) => {
        if (!formDrag || formDrag.pointerId !== e.pointerId) return;
        clearFormDrag();
      });
    });
  }

  function renderFormation() {
    const state = getState();
    normalizeFormation(state, FORMATION_SLOTS);
    syncCaptainFlags(state);
    clearFormDrag();
    const { power, luck } = formationPowerLuck();
    const powerEl = $("formPower");
    const luckEl = $("formLuck");
    if (powerEl) powerEl.textContent = String(power);
    if (luckEl) luckEl.textContent = String(luck);

    const board = $("formBoard");
    const pool = $("formPool");
    if (!board || !pool) return;

    const slots = [];
    for (let i = 0; i < FORMATION_SLOTS; i++) {
      const id = state.formation[i];
      const hero = id ? state.party.find((h) => h.id === id) : null;
      if (!hero) {
        slots.push(`<div class="form-slot empty" data-slot="${i}"><span>空位</span></div>`);
        continue;
      }
      const dead = isHeroDead(hero);
      const cost = reviveCost(hero.level || 1);
      const cap = hero.id === state.captainId;
      slots.push(`<div class="form-slot filled${dead ? " dead" : ""}${cap ? " captain" : ""}" data-slot="${i}" data-id="${hero.id}">
        <button type="button" class="form-x" data-undep="${hero.id}" title="下阵">×</button>
        ${cap ? '<span class="form-slot-captain" title="队长">★</span>' : ""}
        <div class="form-face-wrap">${unitIconHtml(hero, "sm", { peers: state.party })}</div>
        <b>${hero.name}${dead ? "·亡" : ""}${cap ? "·长" : ""}</b>
        ${
          dead
            ? `<button type="button" class="form-revive-btn" data-revive="${hero.id}">复活 ${cost}金</button>`
            : ""
        }
      </div>`);
    }
    board.innerHTML = slots.join("");

    pool.innerHTML = state.party
      .map((h) => {
        refreshHeroStats(h);
        const on = isDeployed(h.id);
        const dead = isHeroDead(h);
        const cost = reviveCost(h.level || 1);
        const cap = h.id === state.captainId;
        const tag = dead ? "阵亡" : on ? "已上阵" : "点击上阵";
        return `<div class="form-pool-card ${on ? "on" : ""}${dead ? " dead" : ""}${cap ? " captain" : ""}" data-pool="${h.id}">
          <button type="button" class="form-captain-btn${cap ? " on" : ""}" data-captain="${h.id}" title="${cap ? "当前队长" : "设为队长"}">★</button>
          <div class="form-pool-face">
            ${unitIconHtml(h, "sm", { peers: state.party })}
          </div>
          <span class="form-pool-name">${h.name}</span>
          <span class="form-pool-tag ${on ? "deployed" : ""}${dead ? " dead" : ""}">${tag}</span>
          ${
            dead
              ? `<button type="button" class="form-revive-btn" data-revive="${h.id}">复活该英雄 ${cost}金</button>`
              : ""
          }
        </div>`;
      })
      .join("");

    board.querySelectorAll("[data-undep]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        undeploy(btn.dataset.undep);
      });
    });
    board.querySelectorAll("[data-revive]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        tryReviveHero(btn.dataset.revive, { refreshForm: true });
      });
    });
    pool.querySelectorAll("[data-revive]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        tryReviveHero(btn.dataset.revive, { refreshForm: true });
      });
    });
    pool.querySelectorAll("[data-captain]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        setCaptain(btn.dataset.captain);
      });
    });
    pool.querySelectorAll("[data-pool]").forEach((card) => {
      card.addEventListener("click", (e) => {
        if (e.target.closest("[data-revive],[data-captain],.form-captain-btn")) return;
        const id = card.dataset.pool;
        const hero = state.party.find((h) => h.id === id);
        if (hero && isHeroDead(hero)) {
          openDetail(id);
          return;
        }
        if (isDeployed(id)) undeploy(id);
        else deploy(id);
      });
    });

    bindFormationDrag(board);
  }

  function deploy(heroId) {
    const state = getState();
    const hero = state.party.find((h) => h.id === heroId);
    if (!hero || isHeroDead(hero)) return;
    normalizeFormation(state, FORMATION_SLOTS);
    if (state.formation.includes(heroId)) return;
    if (deployedCount() >= MAX_DEPLOYED) return;
    const idx = state.formation.findIndex((id) => !id);
    if (idx < 0) return;
    state.formation[idx] = heroId;
    persistFormation();
    renderFormation();
    refreshExploreHud();
  }

  function undeploy(heroId) {
    const state = getState();
    normalizeFormation(state, FORMATION_SLOTS);
    if (deployedCount() <= 1) return; // 至少留一人
    const idx = state.formation.indexOf(heroId);
    if (idx < 0) return;
    state.formation[idx] = null;
    persistFormation();
    renderFormation();
    refreshExploreHud();
  }

  function bind() {
    $("closeDetail")?.addEventListener("click", closeModals);
    $("closeBag")?.addEventListener("click", closeModals);
    $("closeFormation")?.addEventListener("click", closeModals);
    $("closeSkillPick")?.addEventListener("click", closeSkillPick);
    $("closeSkillDetail")?.addEventListener("click", closeSkillDetail);
    $("closeEquipPreview")?.addEventListener("click", closeEquipPreview);
    $("closeEquipPick")?.addEventListener("click", closeEquipPick);
    $("closeBagSell")?.addEventListener("click", closeBagSell);
    $("closeWarp")?.addEventListener("click", closeWarp);
    $("closeFloorMobs")?.addEventListener("click", closeFloorMobs);
    $("btnFloorMobs")?.addEventListener("click", openFloorMobs);
    $("floorMobsModal")?.addEventListener("click", (e) => {
      if (e.target === e.currentTarget) closeFloorMobs();
    });
    $("closePhone")?.addEventListener("click", closePhone);
    $("closeResetConfirm")?.addEventListener("click", () => {
      closeResetConfirm();
      closePhone();
    });
    $("btnPhoneClear")?.addEventListener("click", clearPhoneDigits);
    $("btnResetCancel")?.addEventListener("click", () => {
      closeResetConfirm();
      closePhone();
    });
    $("btnResetConfirm")?.addEventListener("click", confirmResetGame);
    $("phonePad")?.querySelectorAll(".phone-key").forEach((btn) => {
      btn.addEventListener("click", () => pressPhoneKey(btn.dataset.key));
    });
    $("btnReplace")?.addEventListener("click", openEquipPick);
    $("btnSellOne")?.addEventListener("click", () => {
      if (equipEdit?.source === "bag") sellBagItemAt(equipEdit.invIndex);
    });
    $("btnUpgradeEquip")?.addEventListener("click", doUpgradeEquip);
    $("btnDevourEquip")?.addEventListener("click", openDevourPick);
    $("btnAffixReplace")?.addEventListener("click", openAffixReplaceFlow);
    $("btnAffixCondense")?.addEventListener("click", openAffixCondenseFromEquip);
    $("btnBagSell")?.addEventListener("click", openBagSell);
    $("btnBagSort")?.addEventListener("click", sortBagInventory);
    $("btnConfirmSell")?.addEventListener("click", confirmBagSell);
    document.querySelectorAll(".bag-tab").forEach((btn) => {
      btn.addEventListener("click", () => setBagTab(btn.dataset.bagTab));
    });
    $("btnBag")?.addEventListener("click", openBag);
    $("btnFormation")?.addEventListener("click", openFormation);
    $("detailPrev")?.addEventListener("click", () => shiftDetail(-1));
    $("detailNext")?.addEventListener("click", () => shiftDetail(1));
    document.querySelectorAll(".hero-tab").forEach((btn) => {
      btn.addEventListener("click", () => {
        const side = btn.closest(".hero-tabs")?.dataset.side;
        if (side === "left") setLeftDetailTab(btn.dataset.tab);
        else setRightDetailTab(btn.dataset.tab);
      });
    });
  }

  return { bind, closeModals, refreshExploreHud, openBag, openFormation };
}
