/** 游戏界面：探索 HUD / 背包 / 阵容 / 角色详情 */

import { $, clamp, styleTag } from "../core/utils.js?v=65";
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
  itemPrice,
  toBagEquip,
  BONUS_LABEL,
  affixCountForRarity,
  canUpgradeEquip,
  upgradeEquipCost,
  upgradeEquip,
  isMilestoneLevel,
  ensureRotation,
  activeSkills,
  updateRotationSlot,
  basicAttackId,
  isEmptyAutoSlot,
  FORMATION_SLOTS,
  getDeployedHeroes,
  normalizeFormation,
  combatPower,
  diamondStyleAttr,
  isSlenderFemale,
  upgradeSkill,
  getSkillLevel,
  MAX_SKILL_LEVEL,
  DEFAULT_CRIT_RATE,
  DEFAULT_CRIT_DMG,
  reviveCost,
  reviveHero,
  isHeroDead,
  refreshSkillTexts,
  buildSkillText,
} from "../characters/omni/index.js?v=65";
import { sumEquipBonus, UNIQUE_SKILL_IDS } from "../characters/omni/equipment.js?v=65";
import { setSavedFormation } from "../characters/stats.js?v=65";
import { resetGameLocalData } from "../core/save.js?v=65";
import { createAllUniqueItems } from "../loot/drops.js?v=65";

const BAG_SLOTS = 48;
const PHONE_RESET_CODE = "*886#";
const PHONE_UNIQUE_CODE = "*120#";
const PHONE_SELL_RATE = 0.3;

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
  /** 批量出售选中的品质 */
  let sellRarity = null;
  /** 手机拨号缓冲 */
  let phoneDigits = "";

  const MISC_KIND_LABEL = {
    consumable: "消耗品",
    material: "材料",
    tool: "道具",
    equip: "装备",
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
    if (detailHeroId) openDetail(detailHeroId);
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
          <div class="strip-face ${h.shape}" style="${diamondStyleAttr(h, 0.72, party)}"></div>
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
    if (floor) floor.textContent = s.placeFloor || "1层";
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
    radiant: "光",
    quake: "震",
    boost: "衡",
    aftercare: "愈",
    pink_shot: "箭",
    pink_burst: "爆",
    pink_barrage: "雨",
    pink_fervor: "燃",
    pink_focus: "专",
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
  }

  function closeEquipPreview() {
    closeEquipPick();
    $("equipPreviewModal")?.classList.add("hidden");
    equipEdit = null;
  }

  function closeBagSell() {
    $("bagSellModal")?.classList.add("hidden");
    sellRarity = null;
  }

  function closeWarp() {
    $("warpModal")?.classList.add("hidden");
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
    }
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

    const toast = $("lootToast") || $("toast");
    if (toast) {
      toast.textContent = `已按 30% 售出 ${sold} 件装备（+${goldGain} 金），获得唯一装 ${uniques.length} 件`;
      toast.classList.remove("hidden");
      clearTimeout(toast._phoneCheatTimer);
      toast._phoneCheatTimer = setTimeout(() => toast.classList.add("hidden"), 2800);
    }
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
    closePhone();
    closeResetConfirm();
    $("detailModal")?.classList.add("hidden");
    $("bagModal")?.classList.add("hidden");
    $("formationModal")?.classList.add("hidden");
    if (getState().mode !== "battle") setMode("explore");
  }

  function openWarpPicker() {
    const state = getState();
    const visited = [...(state.visitedFloors || [state.floor || 1])].sort(
      (a, b) => a - b
    );
    const list = $("warpFloorList");
    if (!list) return;
    if (!visited.length) {
      list.innerHTML = `<div class="warp-empty">还没有可传送的楼层</div>`;
    } else {
      list.innerHTML = visited
        .map((f) => {
          const cur = f === state.floor ? " current" : "";
          return `<button type="button" class="warp-floor-btn${cur}" data-floor="${f}">
            <b>${f} 层</b>
            <span>${f === state.floor ? "当前 · 刷新怪物" : "传送并刷新"}</span>
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

  function setPreviewActions({ replace = false, sellOne = false, upgrade = false } = {}) {
    const btnReplace = $("btnReplace");
    const btnSellOne = $("btnSellOne");
    const btnUpgrade = $("btnUpgradeEquip");
    const actions = btnReplace?.parentElement;
    if (btnReplace) btnReplace.hidden = !replace;
    if (btnSellOne) btnSellOne.hidden = !sellOne;
    if (btnUpgrade) {
      btnUpgrade.hidden = !upgrade;
      if (upgrade) syncUpgradeButton();
    }
    if (actions) actions.hidden = !replace && !sellOne && !upgrade;
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
    const next = itemLevel(item) + 1;
    const milestone = isMilestoneLevel(next);
    const gold = getState().gold || 0;
    btn.hidden = false;
    btn.disabled = gold < cost;
    btn.textContent = milestone
      ? `突破升级 Lv.${next}（${cost}金）`
      : `升级 Lv.${next}（${cost}金）`;
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
        ? `突破！装备升至 Lv.${r.level}（-${r.cost}金）`
        : `装备升至 Lv.${r.level}（-${r.cost}金）`;
      toast.classList.remove("hidden");
      clearTimeout(toast._upTimer);
      toast._upTimer = setTimeout(() => toast.classList.add("hidden"), 2200);
    }
    bumpSave();
  }

  function formatBonusRows(bonus, compact = false, emptyText = "无加成") {
    const rows = ["hp", "atk", "def", "spd", "critRate", "critDmg"]
      .map((k) => {
        const v = bonus?.[k] || 0;
        if (!v) return "";
        if (k === "critRate" || k === "critDmg") {
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
    const primary = item.primary || {};
    const has = Object.values(primary).some((v) => v);
    const head = `<div class="equip-section-label">主属性 · 等级 ${itemLevel(item)}</div>`;
    return `${head}${formatBonusRows(has ? primary : getItemBonus(item), compact, "无")}`;
  }

  function formatAffixesHtml(item, compact = false) {
    const list = item.affixes || [];
    const max = affixCountForRarity(item.rarity);
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
        const tag = a.type === "unique" ? "唯一" : `词条${i + 1}`;
        const uid = a.uniqueId || a.id;
        const text =
          a.type === "unique" && uid && UNIQUE_SKILL_IDS[uid]?.text
            ? UNIQUE_SKILL_IDS[uid].text
            : a.text || a.label || "—";
        return `<li><span>${tag}</span><b>${text}</b></li>`;
      })
      .join("");
    return `${head}<ul class="${cls}">${rows}</ul>`;
  }

  function renderEquipItemBody(item, { unequip = false, price = false } = {}) {
    const info = rarityInfo(item.rarity);
    const lv = itemLevel(item);
    const affixN = (item.affixes || []).length;
    const affixMax = affixCountForRarity(item.rarity);
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
    }
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
      setPreviewActions({
        replace: false,
        sellOne: true,
        upgrade: canUpgradeEquip(item),
      });
      body.innerHTML = renderEquipItemBody(item, { price: true });
    } else {
      if (title) title.textContent = MISC_KIND_LABEL[item.kind] || "物品";
      const isWarp = item.useId === "warp_refresh";
      const isPhone = item.useId === "phone_dial";
      setPreviewActions({ replace: false, sellOne: false });
      const kindLabel = MISC_KIND_LABEL[item.kind] || "道具";
      const useBtn = isWarp
        ? `<button type="button" class="equip-btn replace" id="btnUseWarp">选择楼层传送</button>`
        : isPhone
          ? `<button type="button" class="equip-btn replace" id="btnUsePhone">打开拨号</button>`
          : "";
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
            <div class="equip-preview-rarity">${
              isWarp || isPhone ? "可重复使用" : `数量 ×${item.qty ?? 1}`
            }</div>
          </div>
        </div>
        <p class="equip-preview-desc">${
          item.desc ||
          (item.kind === "consumable"
            ? "消耗品：战斗或探索中使用（功能稍后接入）。"
            : item.kind === "material"
              ? "材料：用于合成/强化等（功能稍后接入）。"
              : "暂无说明。")
        }</p>
        ${useBtn}`;
      body.querySelector("#btnUseWarp")?.addEventListener("click", openWarpPicker);
      body.querySelector("#btnUsePhone")?.addEventListener("click", openPhoneDial);
    }
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
    const title = $("equipPickTitle");
    const sub = $("equipPickSub");
    const list = $("equipPickList");
    if (title) title.textContent = `选择${SLOT_LABEL[slotKey] || "装备"}`;
    let limitHint = "";
    if (slotKey === "weapon") {
      if (hero.statsId === "pink") limitHint = "（小粉仅可装备枪械）";
      else if (hero.statsId === "green") limitHint = "（小绿仅可装备法杖）";
      else if (hero.statsId === "omni" || hero.statsId === "yellow") {
        limitHint = "（可装备全部武器）";
      }
    }
    if (sub) {
      sub.textContent = `从背包选择可装备到「${SLOT_LABEL[slotKey]}」的道具${limitHint}`;
    }

    const candidates = candidatesForSlot(slotKey);
    if (!list) return;
    if (!candidates.length) {
      list.innerHTML = `<div class="equip-pick-empty">背包里没有可更换到此部位的装备</div>`;
    } else {
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
                <div class="equip-preview-rarity">等级 ${itemLevel(it)} · ${info.label}装 · 词条 ${(it.affixes || []).length}/${affixCountForRarity(it.rarity)}</div>
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
    }
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

  function showSkillHoldPreview(hero, skillId) {
    const skill = hero?.skills?.find((s) => s.id === skillId);
    const el = $("skillHoldPreview");
    if (!skill || !el) return;
    const lv = getSkillLevel(hero, skill.id);
    const typeLine =
      skill.kind === "passive"
        ? "被动"
        : `${skillKindLabel(skill)}${skill.style ? ` · ${styleTag(skill.style)}` : ""}`;
    el.innerHTML = `
      <div class="shp-name">${skill.name}</div>
      <div class="shp-meta">${typeLine} · 等级 ${lv}/${MAX_SKILL_LEVEL}</div>
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
          return `<button type="button" class="skill-pick-item ${on ? "on" : ""}" data-skill="${s.id}">
          <div class="skill-pick-head">
            <div class="skill-pick-ico">${s.style === "heal" ? "愈" : s.style === "ranged" ? "远" : "近"}</div>
            <div class="skill-pick-meta">
              <div class="skill-pick-name">${s.name}
                <span class="stag">${styleTag(s.style)}</span>
                ${on ? '<span class="stag current">当前</span>' : ""}
              </div>
              <div class="skill-pick-nums">${s.nums || ""}</div>
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
    shape.setAttribute("style", diamondStyleAttr(hero, 2.2, peers));
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
    const capNote = hero.isCaptain ? " · 队长+10%" : "";
    $("statList").innerHTML = [
      ["生命", `${Math.ceil(hero.hp)} / ${hero.maxHp}`, `基础${hero.base.hp} + 被动${hero.passiveBoost.hp} + 装备${eq.hp}${capNote}`],
      ["攻击", String(hero.atk), `基础${hero.base.atk} + 被动${hero.passiveBoost.atk} + 装备${eq.atk}${capNote}`],
      ["防御", String(hero.def), `基础${hero.base.def} + 被动${hero.passiveBoost.def} + 装备${eq.def}${capNote}`],
      ["速度", String(hero.spd), `基础${hero.base.spd} + 装备${eq.spd}${capNote}`],
      ["暴击率", `${critRate}%`, `默认 10% + 装备 ${Math.round((eq.critRate || 0) * 1000) / 10}%`],
      ["暴击伤害", `${critDmg}%`, `默认 150% + 装备 ${Math.round((eq.critDmg || 0) * 1000) / 10}%`],
    ]
      .map(([label, val, tip]) => `<li title="${tip}"><span>${label}</span><b>${val}</b></li>`)
      .join("");

    const spEl = $("detailSkillPoints");
    if (spEl) spEl.textContent = String(hero.skillPoints ?? 0);

    const points = hero.skillPoints ?? 0;
    refreshSkillTexts(hero);
    $("skillList").innerHTML = hero.skills
      .map((s) => {
        const lv = getSkillLevel(hero, s.id);
        const canUp = points > 0 && lv < MAX_SKILL_LEVEL;
        const typeLine =
          s.kind === "passive"
            ? "被动"
            : `${skillKindLabel(s)}${s.style ? ` · ${styleTag(s.style)}` : ""}`;
        return `<li class="skill-item" data-skill="${s.id}">
          <div class="skill-row">
            <button type="button" class="skill-open" data-skill="${s.id}">
              <div class="skill-ico ${skillIcoClass(s)}">${skillFace(s)}</div>
              <div class="skill-meta">
                <span class="sname">${s.name}</span>
                <span class="stype">${typeLine}</span>
                <span class="slv">等级 ${lv}</span>
              </div>
            </button>
          </div>
          <button type="button" class="skill-up-btn${canUp ? "" : " off"}" data-skill="${s.id}" ${canUp ? "" : "disabled"} aria-label="升级">${
            lv >= MAX_SKILL_LEVEL ? "满" : "+"
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
    const skill = hero?.skills?.find((s) => s.id === skillId);
    const title = $("skillDetailTitle");
    const body = $("skillDetailBody");
    const modal = $("skillDetailModal");
    if (!hero || !skill || !body || !modal) return;

    const lv = getSkillLevel(hero, skill.id);
    const points = hero.skillPoints ?? 0;
    const canUp = points > 0 && lv < MAX_SKILL_LEVEL;
    const typeLine =
      skill.kind === "passive"
        ? "被动技能"
        : `${skillKindLabel(skill)}${skill.style ? ` · ${styleTag(skill.style)}` : ""}`;

    if (title) title.textContent = skill.name;
    refreshSkillTexts(hero);
    const cur = skill.desc || skill.nums || "";
    const next = buildSkillText(hero, skill.id, lv + 1);
    const nextLine = next?.desc || next?.nums || "";
    body.innerHTML = `
      <div class="skill-detail-top">
        <div class="skill-detail-ico ${skillIcoClass(skill)}">${skillFace(skill)}</div>
        <div class="skill-detail-meta">
          <div class="skill-detail-name">${skill.name}</div>
          <div class="skill-detail-type">${typeLine}</div>
          <div class="skill-detail-lv">等级 ${lv} / ${MAX_SKILL_LEVEL}</div>
        </div>
      </div>
      ${cur ? `<div class="skill-detail-nums">${cur}</div>` : ""}
      ${
        nextLine
          ? `<div class="skill-detail-next"><span class="skill-detail-next-lab">下一级</span>${nextLine}</div>`
          : ""
      }
      <div class="skill-detail-actions">
        <button type="button" class="skill-detail-up${canUp ? "" : " off"}" id="btnSkillDetailUp" ${canUp ? "" : "disabled"}>
          ${lv >= MAX_SKILL_LEVEL ? "已满级" : canUp ? `升级（技能点 ${points}）` : "技能点不足"}
        </button>
      </div>`;

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
    $("bagModal").classList.remove("hidden");
    renderBag();
  }

  function countBagEquipsByRarity(rarity) {
    const inv = getState().inventory || [];
    let count = 0;
    let gold = 0;
    for (const it of inv) {
      if (!isEquipItem(it)) continue;
      if (normalizeRarity(it.rarity) !== rarity) continue;
      count += 1;
      gold += itemPrice(it);
    }
    return { count, gold };
  }

  function sellBagEquipsOfRarity(rarity) {
    const state = getState();
    const inv = state.inventory || [];
    let count = 0;
    let gold = 0;
    const next = [];
    for (const it of inv) {
      if (isEquipItem(it) && normalizeRarity(it.rarity) === rarity) {
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
    if (!sellRarity) {
      summary.textContent = "请选择一种品质";
      btn.disabled = true;
      btn.textContent = "确认出售";
      return;
    }
    const info = rarityInfo(sellRarity);
    const { count, gold } = countBagEquipsByRarity(sellRarity);
    if (!count) {
      summary.innerHTML = `背包中没有<span class="rarity-text-${info.id}">${info.label}</span>装`;
      btn.disabled = true;
      btn.textContent = "确认出售";
      return;
    }
    summary.innerHTML = `将出售 <b>${count}</b> 件<span class="rarity-text-${info.id}">${info.label}</span>装，获得 <b>${gold}</b> 金币`;
    btn.disabled = false;
    btn.textContent = `出售全部${info.label}装`;
  }

  function openBagSell() {
    sellRarity = null;
    const box = $("bagSellRarities");
    if (box) {
      box.innerHTML = RARITY_ORDER.map((id) => {
        const info = rarityInfo(id);
        const { count } = countBagEquipsByRarity(id);
        return `<button type="button" class="bag-sell-rarity rarity-${id}" data-rarity="${id}">
          <span>${info.label}装</span>
          <small>${count} 件</small>
        </button>`;
      }).join("");
      box.querySelectorAll(".bag-sell-rarity").forEach((btn) => {
        btn.addEventListener("click", () => {
          sellRarity = btn.dataset.rarity;
          box.querySelectorAll(".bag-sell-rarity").forEach((b) => {
            b.classList.toggle("on", b.dataset.rarity === sellRarity);
          });
          updateBagSellSummary();
        });
      });
    }
    updateBagSellSummary();
    $("bagSellModal")?.classList.remove("hidden");
  }

  function confirmBagSell() {
    if (!sellRarity) return;
    const info = rarityInfo(sellRarity);
    const { count, gold } = sellBagEquipsOfRarity(sellRarity);
    closeBagSell();
    closeEquipPreview();
    renderBag();
    refreshTopBar();
    if (count > 0) {
      bumpSave();
      const toast = $("lootToast");
      if (toast) {
        toast.textContent = `已出售 ${count} 件${info.label}装，+${gold} 金币`;
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
    const misc = [];
    for (const it of items) {
      if (isEquipItem(it)) equips.push(it);
      else misc.push(it);
    }
    equips.sort(compareEquipByRarityLevel);
    // 道具优先于装备；道具内：消耗品 → 道具 → 其余
    const kindOrder = { consumable: 0, tool: 1, material: 2 };
    misc.sort((a, b) => {
      const ka = kindOrder[a.kind] ?? 9;
      const kb = kindOrder[b.kind] ?? 9;
      if (ka !== kb) return ka - kb;
      return String(a.name || "").localeCompare(String(b.name || ""), "zh");
    });
    state.inventory = [...misc, ...equips];
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

  function renderBag() {
    const grid = $("bagGrid");
    if (!grid) return;
    const items = getState().inventory || [];
    const cells = [];
    for (let i = 0; i < BAG_SLOTS; i++) {
      const it = items[i];
      if (!it) {
        cells.push(`<div class="bag-slot empty"></div>`);
        continue;
      }
      const equip = isEquipItem(it);
      const qty =
        equip && it.level != null
          ? `<em>lv${it.level}</em>`
          : it.qty > 1
            ? `<em>×${it.qty}</em>`
            : !equip
              ? `<em>×${it.qty ?? 1}</em>`
              : "";
      const icon = itemIconUrl(it);
      const rarity = equip || it.rarity ? rarityInfo(it.rarity).id : "";
      const rarityCls = rarity ? ` rarity-${rarity}` : "";
      const miscCls = !equip && !icon ? " misc" : "";
      const shortName =
        !equip && !icon
          ? `<span class="bag-name">${(it.name || "").slice(0, 4)}</span>`
          : "";
      const icoHtml = icon
        ? `<img class="bag-ico-img" src="${icon}" alt="${it.name}" decoding="async" loading="lazy" />`
        : `<i class="bag-ico" aria-hidden="true"></i>`;
      const rareMark =
        equip && rarity && rarity !== "white"
          ? `<i class="bag-rarity rarity-text-${rarity}">${rarityLabel(rarity)}</i>`
          : "";
      const kindHint = !equip ? MISC_KIND_LABEL[it.kind] || "道具" : `${rarityLabel(rarity)}装`;
      cells.push(`<button type="button" class="bag-slot clickable${icon ? " has-icon" : ""}${rarityCls}${miscCls}" data-inv="${i}" title="${it.name} · ${kindHint}" style="--tint:${it.tint || rarityInfo(it.rarity).color};--rarity:${rarityInfo(it.rarity).color}">
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
        ghost.innerHTML = slot.querySelector(".form-face")?.outerHTML || "";
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
        <div class="form-face ${hero.shape}" style="${diamondStyleAttr(hero, 0.95, state.party)}"></div>
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
            <div class="form-face ${h.shape}" style="${diamondStyleAttr(h, 0.95, state.party)}"></div>
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
        e.stopPropagation();
        setCaptain(btn.dataset.captain);
      });
    });
    pool.querySelectorAll("[data-pool]").forEach((card) => {
      card.addEventListener("click", (e) => {
        if (e.target.closest("[data-revive],[data-captain]")) return;
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
    $("btnBagSell")?.addEventListener("click", openBagSell);
    $("btnBagSort")?.addEventListener("click", sortBagInventory);
    $("btnConfirmSell")?.addEventListener("click", confirmBagSell);
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
