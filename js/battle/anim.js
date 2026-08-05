import { $, wait } from "../core/utils.js?v=71";

function centerOf(el) {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

function fieldRect() {
  const fieldEl = $("battleField");
  return fieldEl ? fieldEl.getBoundingClientRect() : null;
}

function fxLayer() {
  return $("fxLayer");
}

function toField(pt, field) {
  return { x: pt.x - field.left, y: pt.y - field.top };
}

function spawnFx(className, x, y) {
  const layer = fxLayer();
  if (!layer) return null;
  const el = document.createElement("div");
  el.className = className;
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  layer.appendChild(el);
  return el;
}

function angleDeg(from, to) {
  return (Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI;
}

/** 根据英雄 / 技能解析特效配置 */
export function resolveFxProfile(style, meta = {}) {
  const skillId = meta.skillId || "";
  const statsId = meta.statsId || "";
  const color = meta.color || "";

  if (statsId === "pink" || skillId.startsWith("pink_")) {
    if (skillId === "pink_fervor" || style === "buff") {
      return { kind: "buff-ring", theme: "pink", bursts: 1 };
    }
    if (skillId === "pink_barrage") {
      return { kind: "volley", theme: "pink", bursts: 3, shape: "arrow" };
    }
    if (skillId === "pink_burst") {
      return { kind: "bolt", theme: "pink", shape: "star", impact: "burst" };
    }
    return { kind: "bolt", theme: "pink", shape: "arrow" };
  }

  if (statsId === "green" || skillId.startsWith("green_")) {
    if (style === "heal" || skillId === "green_mend" || skillId === "green_bloom") {
      return {
        kind: skillId === "green_bloom" ? "heal-bloom" : "heal",
        theme: "green",
        bursts: skillId === "green_bloom" ? 3 : 1,
      };
    }
    return { kind: "bolt", theme: "green", shape: "leaf" };
  }

  if (statsId === "yellow" || skillId.startsWith("yellow_")) {
    if (skillId === "yellow_fortify" || style === "buff") {
      return { kind: "buff-ring", theme: "yellow", bursts: 1 };
    }
    if (skillId === "yellow_slam") {
      return { kind: "melee-slash", theme: "yellow", impact: "flash" };
    }
    return { kind: "melee-slash", theme: "yellow", impact: "punch" };
  }

  if (statsId === "omni" || ["attack", "radiant", "quake"].includes(skillId)) {
    if (skillId === "quake" || (style === "melee" && skillId === "quake")) {
      return { kind: "quake", theme: "omni" };
    }
    if (style === "ranged" || skillId === "radiant") {
      return { kind: "bolt", theme: "omni", shape: "slash", impact: "flash" };
    }
    return { kind: "melee-slash", theme: "omni", impact: "punch" };
  }

  if (style === "heal" || style === "buff") {
    return { kind: "heal", theme: "green" };
  }
  if (style === "ranged") {
    return { kind: "bolt", theme: "enemy", shape: "orb", color };
  }
  return { kind: "melee-slash", theme: "enemy", impact: "punch" };
}

export async function animMelee(attackerId, targetId, profile = {}) {
  const wrap = document.querySelector(`[data-wrap="${attackerId}"]`);
  const targetEl = document.querySelector(`.battle-unit[data-id="${targetId}"]`);
  if (!wrap || !targetEl) {
    await wait(120);
    return;
  }
  const a = centerOf(wrap);
  const t = centerOf(targetEl);
  const dx = (t.x - a.x) * 0.72;
  const dy = (t.y - a.y) * 0.72;
  const theme = profile.theme || "enemy";
  const impactKind = profile.impact || "punch";

  wrap.style.transition = "transform 0.14s cubic-bezier(.2,.8,.2,1)";
  wrap.style.transform = `translate(${dx}px, ${dy}px) scale(1.06)`;
  await wait(130);

  const field = fieldRect();
  if (field) {
    const mid = toField({ x: a.x + dx * 0.85, y: a.y + dy * 0.85 }, field);
    const hit = toField(t, field);
    const rot = angleDeg(a, t);
    const slash = spawnFx(`fx-slash theme-${theme}`, mid.x, mid.y);
    if (slash) {
      slash.style.setProperty("--rot", `${rot}deg`);
      wait(300).then(() => slash.remove());
    }
    const punch = spawnFx(`fx-impact impact-${impactKind} theme-${theme}`, hit.x, hit.y);
    if (punch) wait(360).then(() => punch.remove());
    const ring = spawnFx(`fx-hit-ring theme-${theme}`, hit.x, hit.y);
    if (ring) wait(320).then(() => ring.remove());
    targetEl.classList.remove("melee-punched");
    void targetEl.offsetWidth;
    targetEl.classList.add("melee-punched");
    wait(280).then(() => targetEl.classList.remove("melee-punched"));
  }

  await wait(40);
  wrap.style.transition = "transform 0.16s ease-in";
  wrap.style.transform = "translate(0, 0) scale(1)";
  await wait(160);
  wrap.style.transition = "";
  wrap.style.transform = "";
}

/**
 * 小黄反伤：从自身射出半透明尖刺打到各目标（不阻塞战斗）
 * @param {string} fromId
 * @param {string[]} toIds
 */
export function playReflectSpikes(fromId, toIds) {
  const field = fieldRect();
  const fromEl =
    document.querySelector(`[data-wrap="${fromId}"]`) ||
    document.querySelector(`.battle-unit[data-id="${fromId}"]`);
  if (!field || !fromEl || !toIds?.length) return;

  const a = toField(centerOf(fromEl), field);
  const aura = spawnFx("fx-reflect-aura theme-yellow", a.x, a.y);
  if (aura) wait(380).then(() => aura.remove());

  toIds.forEach((tid, i) => {
    const targetEl = document.querySelector(`.battle-unit[data-id="${tid}"]`);
    if (!targetEl) return;
    const t = toField(centerOf(targetEl), field);
    wait(i * 28).then(async () => {
      const spike = spawnFx("fx-spike theme-yellow", a.x, a.y);
      if (!spike) return;
      const rot = angleDeg(a, t);
      spike.style.setProperty("--rot", `${rot}deg`);
      spike.style.transform = `rotate(${rot}deg)`;
      await wait(16);
      spike.style.transition =
        "left 0.18s ease-out, top 0.18s ease-out, transform 0.18s ease-out, opacity 0.18s ease-out";
      spike.style.left = `${t.x}px`;
      spike.style.top = `${t.y}px`;
      spike.style.transform = `rotate(${rot}deg) scale(1.05)`;
      spike.style.opacity = "0.35";
      await wait(200);
      spike.remove();
      const prick = spawnFx("fx-spike-hit theme-yellow", t.x, t.y);
      if (prick) wait(260).then(() => prick.remove());
    });
  });
}

async function flyProjectile(fromId, toId, className, duration = 280) {
  const wrap = document.querySelector(`[data-wrap="${fromId}"]`);
  const targetEl = document.querySelector(`.battle-unit[data-id="${toId}"]`);
  const field = fieldRect();
  if (!wrap || !targetEl || !field) {
    await wait(duration);
    return null;
  }
  const a = toField(centerOf(wrap), field);
  const t = toField(centerOf(targetEl), field);
  const el = spawnFx(className, a.x, a.y);
  if (!el) {
    await wait(duration);
    return null;
  }
  const rot = angleDeg(a, t);
  el.style.setProperty("--rot", `${rot}deg`);
  el.style.transform = `rotate(${rot}deg)`;
  await wait(20);
  const sec = (duration / 1000).toFixed(2);
  el.style.transition = `left ${sec}s ease-in, top ${sec}s ease-in, transform ${sec}s ease-in`;
  el.style.left = `${t.x}px`;
  el.style.top = `${t.y}px`;
  el.style.transform = `rotate(${rot}deg) scale(1.15)`;
  await wait(duration + 20);
  return { el, t };
}

async function animBolt(attackerId, targetId, profile) {
  const theme = profile.theme || "enemy";
  const shape = profile.shape || "orb";
  const duration =
    profile.duration ?? (profile.shape === "star" ? 240 : 280);
  const hit = await flyProjectile(
    attackerId,
    targetId,
    `fx-bolt shape-${shape} theme-${theme}`,
    duration
  );
  if (!hit) return;
  hit.el.remove();
  if (profile.impact) {
    const boom = spawnFx(`fx-impact impact-${profile.impact} theme-${theme}`, hit.t.x, hit.t.y);
    if (boom) wait(380).then(() => boom.remove());
  }
}

async function animVolley(attackerId, targetId, profile) {
  const n = profile.bursts || 3;
  const theme = profile.theme || "pink";
  const shape = profile.shape || "arrow";
  const jobs = [];
  for (let i = 0; i < n; i++) {
    jobs.push(
      (async () => {
        await wait(i * 70);
        const hit = await flyProjectile(
          attackerId,
          targetId,
          `fx-bolt shape-${shape} theme-${theme} volley-${i}`,
          240
        );
        if (hit) {
          const spark = spawnFx(`fx-impact impact-spark theme-${theme}`, hit.t.x, hit.t.y);
          hit.el.remove();
          if (spark) wait(280).then(() => spark.remove());
        }
      })()
    );
  }
  await Promise.all(jobs);
}

async function animHeal(attackerId, targetId, profile) {
  const theme = profile.theme || "green";
  const hit = await flyProjectile(
    attackerId,
    targetId,
    `fx-bolt shape-heal theme-${theme}`,
    300
  );
  if (!hit) return;
  hit.el.remove();
  const ring = spawnFx(`fx-impact impact-heal theme-${theme}`, hit.t.x, hit.t.y);
  if (ring) wait(420).then(() => ring.remove());
}

async function animHealBloom(attackerId, targetId, profile) {
  await animHeal(attackerId, targetId, profile);
  const field = fieldRect();
  const targetEl = document.querySelector(`.battle-unit[data-id="${targetId}"]`);
  if (!field || !targetEl) return;
  const t = toField(centerOf(targetEl), field);
  for (let i = 0; i < 3; i++) {
    const petal = spawnFx(`fx-petal theme-green`, t.x, t.y);
    if (!petal) continue;
    petal.style.setProperty("--dx", `${(i - 1) * 28}px`);
    petal.style.setProperty("--dy", `${-18 - i * 10}px`);
    wait(500).then(() => petal.remove());
  }
}

async function animBuffRing(attackerId, profile) {
  const wrap = document.querySelector(`[data-wrap="${attackerId}"]`);
  const field = fieldRect();
  if (!wrap || !field) {
    await wait(200);
    return;
  }
  const a = toField(centerOf(wrap), field);
  const theme = profile.theme || "pink";
  const ring = spawnFx(`fx-buff-ring theme-${theme}`, a.x, a.y);
  wrap.classList.add("fx-buffed");
  await wait(420);
  wrap.classList.remove("fx-buffed");
  if (ring) ring.remove();
}

async function animQuake(attackerId, targetId, profile) {
  await animMelee(attackerId, targetId, { kind: "melee-slash", theme: profile.theme || "omni" });
  const field = fieldRect();
  const targetEl = document.querySelector(`.battle-unit[data-id="${targetId}"]`);
  if (!field || !targetEl) return;
  const t = toField(centerOf(targetEl), field);
  const shock = spawnFx(`fx-shockwave theme-omni`, t.x, t.y);
  if (shock) wait(450).then(() => shock.remove());
}

/**
 * @param {string} style melee|ranged|heal|buff
 * @param {string} attackerId
 * @param {string} primaryTargetId
 * @param {{ skillId?: string, statsId?: string, color?: string }} [meta]
 */
export async function playSkillAnim(style, attackerId, primaryTargetId, meta = {}) {
  if (!primaryTargetId) {
    await wait(100);
    return;
  }
  const profile = resolveFxProfile(style, meta);
  if (meta.shotDuration != null) profile.duration = meta.shotDuration;

  if (profile.kind === "buff-ring") {
    await animBuffRing(attackerId, profile);
    return;
  }
  if (profile.kind === "quake") {
    await animQuake(attackerId, primaryTargetId, profile);
    return;
  }
  if (profile.kind === "volley") {
    await animVolley(attackerId, primaryTargetId, profile);
    return;
  }
  if (profile.kind === "heal-bloom") {
    await animHealBloom(attackerId, primaryTargetId, profile);
    return;
  }
  if (profile.kind === "heal") {
    await animHeal(attackerId, primaryTargetId, profile);
    return;
  }
  if (profile.kind === "bolt") {
    await animBolt(attackerId, primaryTargetId, profile);
    return;
  }
  if (profile.kind === "melee-slash") {
    await animMelee(attackerId, primaryTargetId, profile);
    return;
  }
  await animMelee(attackerId, primaryTargetId, profile);
}
