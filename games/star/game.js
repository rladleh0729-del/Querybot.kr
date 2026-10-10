// 별의 설화 — 로비(캠프·방치 상자·강화·상점) + 전투(웨이브 3개 스테이지 도전)
'use strict';

// 주소에 ?test를 붙이면 테스트용 저장을 따로 쓴다 (진짜 진행을 건드리지 않음)
const TEST = new URLSearchParams(location.search).has('test');
const SAVE_BASE = 'starTale.save.v1';
let SAVE_KEY = SAVE_BASE + (TEST ? '.test' : '');   // 로그인하면 계정별 키로 바뀐다 (useAccountKey)
const LAST_STAGE = 20;      // 챕터 1의 마지막 스테이지 (챕터 보스는 다음 단계에서)
const SCALE = 3;            // 320×180 도트 화면을 960×540으로 키워 그림
const GROUND = 140;
const WAVES = [3, 3, 4];    // 웨이브별 몬스터 수. 마지막 웨이브의 마지막은 대장
const WAVE_HEAL = 0.5;      // 웨이브를 깨면 최대 체력의 50% 회복
const POTION_HEAL = 0.4;
const POTION_CD = 15;       // 물약 사용 텀(초)
const POTION_MAX = 20;
const IDLE_CAP_HOURS = 8;

// 밸런스 숫자 (시뮬레이션으로 맞춤)
// 물약 없이 챕터 1 끝까지 약 75분, 중간에 10번 남짓 막힘
const BAL = { monHp: 30, hpGrow: 1.55, monAtk: 5, atkGrow: 1.45, monGold: 3, goldGrow: 1.22, bossHp: 4, bossAtk: 1.6, bossGold: 5, idle: 0.3, clearBonus: 5 };

// ── 강화 항목 ─────────────────────────────────
const UPGRADES = [
  { id: 'atk',   name: '공격력',    base: 10, grow: 1.075, max: Infinity },
  { id: 'hp',    name: '체력',      base: 10, grow: 1.075, max: Infinity },
  { id: 'regen', name: '체력 회복', base: 25, grow: 1.09,  max: Infinity },
  { id: 'crit',  name: '치명타',    base: 30, grow: 1.1,   max: 30 },
  { id: 'aspd',  name: '공격 속도', base: 40, grow: 1.12,  max: 40 },
];

function heroStats(lv) {
  // 초반엔 고정치(+2, +12)가, 후반엔 배율(1.06배)이 성장을 이끈다
  const maxHp = Math.floor((100 + lv.hp * 12) * Math.pow(1.06, lv.hp));
  return {
    atk: Math.floor((10 + lv.atk * 2) * Math.pow(1.06, lv.atk)),
    maxHp,
    regen: maxHp * 0.01 * (1 + lv.regen * 0.2),   // 초당 회복량
    crit: 5 + lv.crit * 2,                        // % (5%에서 시작, 최대 65%)
    critDmg: 2,
    aspd: 1 + lv.aspd * 0.05,                     // 초당 공격 횟수 (최대 3회)
  };
}

function upgradeCost(u, level) { return Math.floor(u.base * Math.pow(u.grow, level)); }

function upgradeText(id, s) {
  switch (id) {
    case 'atk': return fmt(s.atk);
    case 'hp': return fmt(s.maxHp);
    case 'regen': return (s.regen < 100 ? s.regen.toFixed(1) : fmt(s.regen)) + '/초';
    case 'crit': return s.crit.toFixed(1) + '%';
    case 'aspd': return s.aspd.toFixed(2) + '회/초';
  }
}

// 전투력: 공격 × 체력을 한 숫자로 (대략적인 강함)
function power(s) { return Math.floor(Math.sqrt(s.atk * (1 + s.crit / 100 * (s.critDmg - 1)) * s.aspd * s.maxHp) * 10); }

// ── 스킬 ─────────────────────────────────────
// unlock: 이 스테이지를 깨야 배울 수 있음. 레벨이 오르면 power가 grow만큼 커진다
const SKILLS = [
  { id: 'strike', name: '강타',       cd: 8,  unlock: 0,  cost: 30,  power: 3,    grow: 0.25,
    desc: p => `앞의 적에게 공격력 ${Math.round(p * 100)}% 피해` },
  { id: 'whirl',  name: '회오리 베기', cd: 12, unlock: 5,  cost: 300, power: 1.5,  grow: 0.12,
    desc: p => `앞의 적 3마리에게 각각 공격력 ${Math.round(p * 100)}% 피해` },
  { id: 'aid',    name: '응급 처치',   cd: 25, unlock: 10, cost: 1500, power: 0.25, grow: 0.015,
    desc: p => `최대 체력의 ${Math.round(p * 100)}% 회복 (AUTO는 체력 60% 아래에서 사용)` },
  { id: 'cry',    name: '전투 함성',   cd: 30, unlock: 15, cost: 6000, power: 0.5,  grow: 0.04,
    desc: p => `10초 동안 공격 속도 +${Math.round(p * 100)}%` },
];
const SKILL_SLOTS = 3;
const skillById = id => SKILLS.find(s => s.id === id);
function skillPower(sk, lv) { return sk.power + sk.grow * (lv - 1); }
function skillCost(sk, lv) { return Math.floor(sk.cost * Math.pow(1.6, lv)); }   // lv=0이면 배우는 값

// ── 장비 ─────────────────────────────────────
const GRADES = [
  // min~max: 1스테이지 기준 수치(%). mult: 판매 가격 배율
  { name: '일반', color: '#c8cde0', weight: 600, min: 1,  max: 8,   mult: 1 },
  { name: '고급', color: '#6fe39a', weight: 250, min: 6,  max: 14,  mult: 2 },
  { name: '희귀', color: '#6fb2ff', weight: 100, min: 12, max: 24,  mult: 3.5 },
  { name: '영웅', color: '#c48cff', weight: 40,  min: 22, max: 40,  mult: 6, pierce: 5 },
  { name: '전설', color: '#ffb84a', weight: 9,   min: 38, max: 65,  mult: 10, pierce: 10 },
  { name: '신화', color: '#ff5a6e', weight: 1,   min: 60, max: 100, mult: 17, pierce: 20 },
];
const GEAR_SLOTS = [
  { id: 'weapon', name: '무기',   names: ['낡은 검', '강철 검', '기사의 검', '영웅의 검', '전설의 검', '별의 검'],       stat: '공격력' },
  { id: 'armor',  name: '갑옷',   names: ['천 옷', '가죽 갑옷', '사슬 갑옷', '영웅의 갑옷', '전설의 갑옷', '별의 갑옷'],  stat: '체력' },
  { id: 'acc',    name: '장신구', names: ['구리 반지', '은 반지', '마법 반지', '영웅의 반지', '전설의 반지', '별의 반지'], stat: '치명타 피해' },
];
const BAG_MAX = 30;
const DROP_CHANCE = 0.03;   // 일반 몬스터, 대장은 반드시
const gearSlot = id => GEAR_SLOTS.find(s => s.id === id);

// 등급 범위 안에서 무작위, 스테이지마다 2%씩 커진다
function rollValue(grade, stage, mult) {
  const G = GRADES[grade];
  const v = (G.min + Math.random() * (G.max - G.min)) * (1 + 0.02 * (stage - 1)) * (mult || 1);
  return Math.max(1, Math.round(v));
}

// opt.maxGrade: 이 등급까지만, opt.mult: 수치 배율, opt.slot: 칸 지정
function rollItem(stage, opt = {}) {
  const slot = opt.slot ? gearSlot(opt.slot) : GEAR_SLOTS[Math.floor(Math.random() * GEAR_SLOTS.length)];
  const pool = GRADES.slice(0, (opt.maxGrade ?? GRADES.length - 1) + 1);
  let r = Math.random() * pool.reduce((a, b) => a + b.weight, 0), grade = 0;
  while (r >= pool[grade].weight) { r -= pool[grade].weight; grade++; }
  const G = GRADES[grade];
  return {
    id: opt.noId ? 0 : save.nextItem++,
    slot: slot.id, grade, stage,
    value: rollValue(grade, stage, opt.mult),  // %
    pierce: slot.id === 'acc' ? (G.pierce || 0) : 0,
  };
}

// ── 상점 장비 ──
// 스테이지에 따라 같이 세지지만, 희귀까지만 나오고 수치도 80%라서 전투 장비보다 항상 약하다
const SHOP_GRADE_MAX = 2;
const SHOP_MULT = 0.8;
const SHOP_RESTOCK = 10 * 60 * 1000;

function restockShop() {
  save.shop = { at: Date.now(), items: GEAR_SLOTS.map(sl => rollItem(save.stage, { slot: sl.id, maxGrade: SHOP_GRADE_MAX, mult: SHOP_MULT, noId: true })) };
}

function checkShop() {
  if (!save.shop || Date.now() - save.shop.at >= SHOP_RESTOCK) { restockShop(); return true; }
  return false;
}

function shopPrice(it) { return sellPrice(it) * 4; }
function rerollPrice() { return monGold(save.stage) * 20; }

function buyShopItem(i) {
  const it = save.shop.items[i];
  if (!it || it.sold || save.gold < shopPrice(it)) return;
  if (save.items.length >= BAG_MAX) return alert('가방 공간 부족 · 장비 판매 필요');
  save.gold -= shopPrice(it);
  save.items.push({ ...it, id: save.nextItem++ });
  it.sold = true;
  updateHud();
}

function rerollShop() {
  if (save.gold < rerollPrice()) return;
  save.gold -= rerollPrice();
  restockShop();
  updateHud();
}

function itemName(it) { return gearSlot(it.slot).names[it.grade]; }
function itemText(it) { return `${gearSlot(it.slot).stat} +${it.value}%` + (it.pierce ? ` · 치명타 관통 ${it.pierce}%` : ''); }
function equipped(slotId) { return save.items.find(it => it.id === save.gear[slotId]); }
function itemScore(it) { return it ? it.value + it.pierce * 3 : 0; }
function sellPrice(it) { return Math.ceil(monGold(it.stage) * 2 * GRADES[it.grade].mult); }

// 강화 수치 + 장비 효과
function fullStats(lv) {
  const s = heroStats(lv);
  const w = equipped('weapon'), a = equipped('armor'), c = equipped('acc');
  if (w) s.atk = Math.floor(s.atk * (1 + w.value / 100));
  if (a) { s.maxHp = Math.floor(s.maxHp * (1 + a.value / 100)); s.regen *= 1 + a.value / 100; }
  if (c) s.critDmg += c.value / 100;
  s.pierce = c ? c.pierce : 0;
  return s;
}

// ── 몬스터 ───────────────────────────────────
const MONSTERS = [
  { from: 1,  sprite: 'slime',    name: '풀잎 슬라임' },
  { from: 8,  sprite: 'mushroom', name: '꽃버섯' },
  { from: 15, sprite: 'bee',      name: '들벌' },
];

function monGold(stage) { return Math.ceil(BAL.monGold * Math.pow(BAL.goldGrow, stage - 1)); }

// 치명타 저항: 스테이지마다 1.5%씩. 내 치명타 확률에서 그만큼 빠진다
function critRes(stage) { return Math.min(60, (stage - 1) * 1.5); }

function makeMonster(stage, boss) {
  const type = MONSTERS.filter(m => stage >= m.from).pop();
  const n = stage - 1;
  const hp = Math.floor(BAL.monHp * Math.pow(BAL.hpGrow, n) * (boss ? BAL.bossHp : 1));
  return {
    ...type,
    name: boss ? '대장 ' + type.name : type.name,
    boss, hp, maxHp: hp,
    atk: Math.floor(BAL.monAtk * Math.pow(BAL.atkGrow, n) * (boss ? BAL.bossAtk : 1)),
    aspd: 0.8,
    gold: monGold(stage) * (boss ? BAL.bossGold : 1),
    critRes: critRes(stage),
    x: 330, cd: 0.6, hurt: 0, dead: 0,
  };
}

// ── 숫자 표시 (1.2만, 3.4억) ─────────────────
function fmt(n) {
  n = Math.floor(n);
  if (n < 10000) return n.toLocaleString('ko-KR');
  const units = [['경', 1e16], ['조', 1e12], ['억', 1e8], ['만', 1e4]];
  for (const [u, v] of units) if (n >= v) return (n / v).toFixed(n / v < 100 ? 1 : 0) + u;
}

// ── 저장 ────────────────────────────────────
let save = null;

function newSave(name, gender) {
  return { name, gender, gold: 0, stage: 1, lv: { atk: 0, hp: 0, regen: 0, crit: 0, aspd: 0 },
    chest: 0, chestAt: Date.now(), potions: 3, skills: { strike: 1 }, slots: ['strike', null, null], autoSkill: true, items: [], gear: {}, nextItem: 1, gearV2: true, savedAt: Date.now() };
}

// 탭이 여러 개면 서로 저장을 덮어쓰므로, 가장 나중에 연 탭만 저장한다
let sleeping = false;
const tabChannel = 'BroadcastChannel' in window ? new BroadcastChannel('starTale.tabs' + (TEST ? '.test' : '')) : null;
const tabId = Math.random().toString(36).slice(2);

function claimTab() {
  if (tabChannel) tabChannel.postMessage({ type: 'opened', tabId });
}

if (tabChannel) tabChannel.onmessage = e => {
  if (e.data.type !== 'opened' || e.data.tabId === tabId || !save || sleeping) return;
  writeSave();          // 넘겨주기 전에 마지막으로 저장
  sleeping = true;
  save = null;
  $('sleep').hidden = false;
};

function writeSave() {
  if (!save || sleeping) return;
  save.savedAt = Date.now();
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* 저장 불가 환경 */ }
}

function readSave() {
  try { return migrateSave(JSON.parse(localStorage.getItem(SAVE_KEY))); }
  catch (e) { return null; }
}

// 로그인한 계정 전용 세이브 키로 바꾼다.
// 로그인 기능 전에 쓰던 세이브(계정 없는 키)가 있으면, 이 브라우저에서 처음 로그인한 계정으로 옮긴다.
function useAccountKey(uid) {
  SAVE_KEY = SAVE_BASE + '.' + uid;
  try {
    const old = localStorage.getItem(SAVE_BASE);
    if (old && !localStorage.getItem(SAVE_KEY)) localStorage.setItem(SAVE_KEY, old);
    if (old) localStorage.removeItem(SAVE_BASE);
  } catch (e) { /* 무시 */ }
}

// 옛날 형식의 세이브를 지금 형식으로 맞춘다
function migrateSave(s) {
  try {
    if (!s || !s.name || !s.lv) return null;
    // 옛날 저장(1단계) 이어받기
    if (s.chest === undefined) { s.chest = 0; s.chestAt = Date.now(); s.potions = 3; }
    delete s.kills; delete s.best;
    for (const u of UPGRADES) s.lv[u.id] = Math.min(s.lv[u.id] || 0, u.max);
    if (!s.items) { s.items = []; s.gear = {}; s.nextItem = 1; }
    if (!s.gearV2) {
      s.items.forEach(it => it.value = rollValue(it.grade, it.stage));
      if (s.shop) s.shop.items.forEach(it => it.value = rollValue(it.grade, it.stage, 0.8));
      s.gearV2 = true;
    }
    if (!s.skills) { s.skills = { strike: 1 }; s.slots = ['strike', null, null]; s.autoSkill = true; }
    return s;
  } catch (e) { return null; }
}

// ── 방치 상자 ───────────────────────────────
// 깬 스테이지가 높을수록 초당 골드가 많이 쌓인다. 실제 시간 기준이라 꺼 둔 동안에도 쌓인다.
function idleRate() {
  const cleared = save.stage - 1;
  return cleared < 1 ? 0.5 : BAL.idle * monGold(cleared);
}

function accrue() {
  const now = Date.now();
  const rate = idleRate();
  const cap = rate * IDLE_CAP_HOURS * 3600;
  save.chest = Math.min(cap, save.chest + rate * Math.max(0, now - save.chestAt) / 1000);
  save.chestAt = now;
}

function collectChest() {
  accrue();
  const got = Math.floor(save.chest);
  if (got < 1) return;
  save.gold += got;
  save.chest -= got;
  floatsLobby.push({ text: '+' + fmt(got) + ' G', t: 0 });
  writeSave();
  updateHud();
}

// ── 상태 ────────────────────────────────────
const $ = id => document.getElementById(id);
const cv = $('cv'), ctx = cv.getContext('2d');
let screen = 'lobby';
let stats = null;
let time = 0;
let floats = [];        // 전투의 떠오르는 숫자
let floatsLobby = [];   // 로비 상자 위에 떠오르는 숫자

const hero = { hp: 0, cd: 0, lunge: 0, hurt: 0, x: 70 };
let battle = null;      // { stage, wave, queue, earned, state, delay, potionCd }

function refreshStats() { stats = fullStats(save.lv); }

// ── 전투 ────────────────────────────────────
function startBattle() {
  refreshStats();
  hero.hp = stats.maxHp;
  hero.cd = 0;
  floats = [];
  battle = { stage: save.stage, wave: 0, queue: [], earned: 0, state: 'fight', delay: 0, potionCd: 0, skillCd: {}, cryT: 0, loot: [] };
  spawnWave();
  $('result').hidden = true;
  showScreen('battle');
}

function spawnWave() {
  const n = WAVES[battle.wave];
  battle.queue = [];
  for (let i = 0; i < n; i++) {
    const boss = battle.wave === WAVES.length - 1 && i === n - 1;
    const m = makeMonster(battle.stage, boss);
    m.x = 220 + i * 30;
    battle.queue.push(m);
  }
  updateBattleHud();
}

function addFloat(text, x, y, color, big) { floats.push({ text, x, y, color, big, t: 0 }); }

function toast(text) {
  const el = $('toast');
  el.textContent = text;
  el.style.opacity = 1;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => el.style.opacity = 0, 1400);
}

function updateBattle(dt) {
  floats.forEach(f => f.t += dt);
  floats = floats.filter(f => f.t < 1);
  hero.lunge = Math.max(0, hero.lunge - dt * 4);
  hero.hurt = Math.max(0, hero.hurt - dt * 4);
  if (!battle || battle.state !== 'fight') return;

  battle.potionCd = Math.max(0, battle.potionCd - dt);
  hero.hp = Math.min(stats.maxHp, hero.hp + stats.regen * dt);
  updateSkills(dt);

  // 웨이브 사이 쉬는 시간
  if (battle.delay > 0) {
    battle.delay -= dt;
    if (battle.delay <= 0) spawnWave();
    return;
  }

  const q = battle.queue;
  // 쓰러진 몬스터 치우기
  for (const m of q) if (m.dead > 0) m.dead -= dt;
  while (q.length && q[0].dead < 0) q.shift();
  if (!q.length) return waveCleared();

  // 앞 몬스터는 주인공 앞까지, 뒤 몬스터는 줄을 선다
  const meet = hero.x + 40;
  q.forEach((m, i) => {
    m.hurt = Math.max(0, m.hurt - dt * 4);
    const slot = meet + i * 30;
    if (m.x > slot) m.x = Math.max(slot, m.x - 100 * dt);
  });
  const mon = q[0];
  if (mon.dead > 0 || mon.x > meet) return;

  // 주인공 공격
  hero.cd -= dt;
  if (hero.cd <= 0) {
    hero.cd += 1 / (stats.aspd * (battle.cryT > 0 ? 1 + battle.cryPower : 1));
    hero.lunge = 1;
    if (hit(mon, 1)) return;
  }

  // 몬스터 공격
  mon.cd -= dt;
  if (mon.cd <= 0) {
    mon.cd += 1 / mon.aspd;
    hero.hp -= mon.atk;
    hero.hurt = 1;
    addFloat('-' + fmt(mon.atk), hero.x + 16, GROUND - 38, '#ff6b7a');
    if (hero.hp <= 0) {
      hero.hp = 0;
      endBattle('lost');
    }
  }
}

// 적 하나를 때린다. 쓰러뜨리면 true
function hit(mon, mult, color) {
  if (mon.dead > 0) return false;
  const crit = Math.random() * 100 < stats.crit - Math.max(0, mon.critRes - stats.pierce);
  const dmg = Math.floor(stats.atk * mult * (crit ? stats.critDmg : 1) * (0.9 + Math.random() * 0.2));
  mon.hp -= dmg;
  mon.hurt = 1;
  addFloat(fmt(dmg) + (crit ? '!' : ''), mon.x + 16, GROUND - 36 - (mult > 1 ? 8 : 0), crit ? '#ffd25e' : color || '#ffffff', crit || mult > 1);
  if (mon.hp > 0) return false;
  mon.hp = 0;
  mon.dead = 0.5;
  save.gold += mon.gold;          // 얻은 골드는 바로 저장 (져도 남는다)
  battle.earned += mon.gold;
  addFloat('+' + fmt(mon.gold) + 'G', mon.x + 16, GROUND - 52, '#ffd25e');
  if (mon.boss || Math.random() < DROP_CHANCE) dropItem(mon);
  updateBattleHud();
  return true;
}

function dropItem(mon) {
  if (save.items.length >= BAG_MAX) { toast('가방 공간 부족 · 장비 획득 실패'); return; }
  const it = rollItem(battle.stage);
  save.items.push(it);
  battle.loot.push(it);
  addFloat(GRADES[it.grade].name + ' ' + itemName(it) + '!', mon.x + 16, GROUND - 66, GRADES[it.grade].color, true);
}

// ── 전투 중 스킬 ──
function castSkill(slot, auto) {
  const id = save.slots[slot];
  if (!id || !battle || battle.state !== 'fight' || battle.delay > 0) return false;
  const sk = skillById(id), lv = save.skills[id];
  if (!lv || (battle.skillCd[id] || 0) > 0) return false;
  const q = battle.queue.filter(m => m.dead <= 0);
  const inRange = q.length && q[0].x <= hero.x + 40;
  const p = skillPower(sk, lv);
  if (id === 'strike') {
    if (!inRange) return false;
    hero.lunge = 1.5;
    hit(q[0], p, '#9fd0ff');
  } else if (id === 'whirl') {
    if (!inRange) return false;
    hero.lunge = 1.5;
    q.slice(0, 3).forEach(m => hit(m, p, '#9fd0ff'));
  } else if (id === 'aid') {
    if (auto && hero.hp > stats.maxHp * 0.6) return false;
    if (hero.hp >= stats.maxHp) return false;
    const heal = Math.floor(stats.maxHp * p);
    hero.hp = Math.min(stats.maxHp, hero.hp + heal);
    addFloat('+' + fmt(heal), hero.x + 16, GROUND - 46, '#6fe39a', true);
  } else if (id === 'cry') {
    if (!q.length) return false;
    battle.cryT = 10;
    battle.cryPower = p;
  }
  battle.skillCd[id] = sk.cd;
  addFloat(sk.name + '!', hero.x + 16, GROUND - 62, '#9fd0ff', true);
  return true;
}

function updateSkills(dt) {
  for (const id in battle.skillCd) battle.skillCd[id] = Math.max(0, battle.skillCd[id] - dt);
  battle.cryT = Math.max(0, battle.cryT - dt);
  if (save.autoSkill) for (let i = 0; i < SKILL_SLOTS; i++) castSkill(i, true);
}

function waveCleared() {
  if (battle.wave < WAVES.length - 1) {
    const heal = Math.floor(stats.maxHp * WAVE_HEAL);
    hero.hp = Math.min(stats.maxHp, hero.hp + heal);
    addFloat('+' + fmt(heal), hero.x + 16, GROUND - 46, '#6fe39a', true);
    toast(`웨이브 ${battle.wave + 1} 클리어! 체력 회복`);
    battle.wave++;
    battle.delay = 1.2;
    updateBattleHud();
  } else {
    endBattle('won');
  }
}

// result: 'won'(승리) | 'lost'(쓰러짐) | 'retreat'(후퇴)
function endBattle(result) {
  const won = result === 'won';
  battle.state = result;
  const r = battle;
  let text;
  if (won) {
    const bonus = monGold(r.stage) * BAL.clearBonus;
    save.gold += bonus;
    r.earned += bonus;
    if (save.stage === r.stage) { accrue(); save.stage++; }   // 방치 수입은 지금까지 쌓인 것까지 옛 속도로 계산 후 올림
    text = `획득 골드 ${fmt(r.earned)} G (클리어 보상 ${fmt(bonus)} 포함)<br>방치 수입 증가: 초당 ${idleRate().toFixed(1)} G`;
  } else if (result === 'retreat') {
    text = `획득 골드 ${fmt(r.earned)} G · 저장 완료<br>스테이지 미클리어`;
  } else {
    text = `획득 골드 ${fmt(r.earned)} G · 저장 완료<br>캠프에서 강화 후 재도전`;
  }
  if (r.loot.length) text += '<br>획득 장비: ' + r.loot.map(it => `<b style="color:${GRADES[it.grade].color}">${itemName(it)}</b>`).join(', ');
  writeSave();
  cloudUpload();
  $('rTitle').textContent = { won: `스테이지 1-${r.stage} 클리어!`, lost: '패배…', retreat: '후퇴' }[result];
  $('rTitle').style.color = { won: '#ffd25e', lost: '#ff9aa6', retreat: '#c8d6ff' }[result];
  $('rText').innerHTML = text;
  const btns = [];
  if (won && save.stage <= LAST_STAGE) btns.push(['다음 스테이지 ▶', startBattle, true]);
  if (!won) btns.push(['다시 도전', startBattle, true]);
  btns.push(['캠프로', () => showScreen('lobby'), false]);
  $('rBtns').innerHTML = '';
  for (const [label, fn, main] of btns) {
    const b = document.createElement('button');
    b.className = 'stone' + (main ? ' main' : '');
    b.textContent = label;
    b.onclick = fn;
    $('rBtns').appendChild(b);
  }
  $('result').hidden = false;
  updateHud();
}

function usePotion() {
  if (!battle || battle.state !== 'fight') return;
  if (save.potions <= 0) return toast('물약 없음 · 캠프 상점에서 구매');
  if (battle.potionCd > 0) return;
  if (hero.hp >= stats.maxHp) return toast('체력 가득 참');
  const heal = Math.floor(stats.maxHp * POTION_HEAL);
  hero.hp = Math.min(stats.maxHp, hero.hp + heal);
  save.potions--;
  battle.potionCd = POTION_CD;
  addFloat('+' + fmt(heal), hero.x + 16, GROUND - 46, '#6fe39a', true);
  updateBattleHud();
}

// ── 그리기 ──────────────────────────────────
function drawImg(img, x, y, size, flash) {
  const w = (size || 32) * SCALE, h = img.height / img.width * w;
  ctx.drawImage(img, Math.round(x) * SCALE, Math.round(y) * SCALE, w, h);
  if (flash) {
    ctx.save();
    ctx.globalAlpha = flash * 0.6;
    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(img, Math.round(x) * SCALE, Math.round(y) * SCALE, w, h);
    ctx.restore();
  }
}

function shadow(cx, rx) {
  ctx.fillStyle = '#0003';
  ctx.beginPath();
  ctx.ellipse(cx * SCALE, (GROUND + 1) * SCALE, (rx || 11) * SCALE, 2.5 * SCALE, 0, 0, Math.PI * 2);
  ctx.fill();
}

function label(text, cx, y, color) {
  ctx.font = 'bold 20px "Malgun Gothic", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#000a';
  ctx.fillText(text, cx * SCALE + 2, y * SCALE + 2);
  ctx.fillStyle = color;
  ctx.fillText(text, cx * SCALE, y * SCALE);
}

function hpBar(x, y, w, ratio, color) {
  ctx.fillStyle = '#000a';
  ctx.fillRect(x * SCALE, y * SCALE, w * SCALE, 2 * SCALE);
  ctx.fillStyle = color;
  ctx.fillRect(x * SCALE, y * SCALE, w * SCALE * Math.max(0, ratio), 2 * SCALE);
}

function drawFloats(list, defaultX, defaultY) {
  ctx.textAlign = 'center';
  for (const f of list) {
    ctx.globalAlpha = 1 - f.t;
    ctx.font = `900 ${f.big ? 34 : 26}px "Malgun Gothic", sans-serif`;
    const x = (f.x ?? defaultX) * SCALE, y = ((f.y ?? defaultY) - f.t * 18) * SCALE;
    ctx.lineWidth = 5; ctx.strokeStyle = '#000';
    ctx.strokeText(f.text, x, y);
    ctx.fillStyle = f.color || '#ffd25e';
    ctx.fillText(f.text, x, y);
  }
  ctx.globalAlpha = 1;
}

function drawCampfire(x) {
  const p = (px, py, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(px * SCALE, py * SCALE, w * SCALE, h * SCALE); };
  // 빛
  const glow = ctx.createRadialGradient((x + 6) * SCALE, (GROUND - 6) * SCALE, 0, (x + 6) * SCALE, (GROUND - 6) * SCALE, 40 * SCALE);
  glow.addColorStop(0, '#ffb04a44'); glow.addColorStop(1, '#ffb04a00');
  ctx.fillStyle = glow;
  ctx.fillRect((x - 40) * SCALE, (GROUND - 46) * SCALE, 92 * SCALE, 60 * SCALE);
  // 장작
  p(x, GROUND - 2, 13, 2, '#5a3a20'); p(x + 2, GROUND - 3, 9, 1, '#6b4a2b');
  // 불꽃 (깜빡임)
  const f = Math.floor(time * 8) % 3;
  const hgt = [9, 11, 10][f];
  p(x + 3, GROUND - 2 - hgt + 3, 7, hgt - 3, '#e8502a');
  p(x + 4, GROUND - 2 - hgt + 1 + f % 2, 5, hgt - 3, '#ff9a2a');
  p(x + 5, GROUND - hgt + 3, 3, hgt - 5, '#ffe27a');
  p(x + 6 + (f - 1), GROUND - hgt - 2, 1, 2, '#ff9a2a');
}

function renderLobby() {
  drawImg(SPR.tent, 50, GROUND - 38, 48);
  drawCampfire(104);
  const bob = Math.round(Math.sin(time * 3) * 0.8);
  shadow(138);
  drawImg(SPR['hero_' + save.gender], 122, GROUND - 31 + bob);
  floatsLobby.forEach(f => f.t += 1 / 60);
  floatsLobby = floatsLobby.filter(f => f.t < 1);
  drawFloats(floatsLobby, 166, 100);
}

function renderBattle() {
  const bob = Math.round(Math.sin(time * 4) * 0.8);
  const hx = hero.x + hero.lunge * 6;
  shadow(hx + 16);
  ctx.save();
  if (battle.state === 'lost') ctx.globalAlpha = 0.35;
  drawImg(SPR['hero_' + save.gender], hx, GROUND - 31 + bob, 32, hero.hurt);
  ctx.restore();

  // 뒤에서부터 그려서 앞 몬스터가 위에 오게
  for (let i = battle.queue.length - 1; i >= 0; i--) {
    const m = battle.queue[i];
    const size = m.boss ? 44 : 32;
    const wob = Math.round(Math.sin(time * 6 + i) * 1);
    ctx.save();
    if (m.dead > 0) ctx.globalAlpha = m.dead * 2;
    shadow(m.x + size / 2, m.boss ? 15 : 11);
    drawImg(SPR[m.sprite], m.x, GROUND - size + 1 + wob, size, m.hurt);
    ctx.restore();
    if (i === 0 && m.dead <= 0) {
      hpBar(m.x + 2, GROUND - size - 5, size - 4, m.hp / m.maxHp, '#ff6b7a');
      label(m.name, m.x + size / 2, GROUND - size - 9, m.boss ? '#ffb0b8' : '#fff');
    }
  }
  drawFloats(floats);
}

function render() {
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(SPR.bg_meadow, 0, 0, cv.width, cv.height);
  if (screen === 'battle' && battle) renderBattle(); else renderLobby();
}

// ── 화면 글자 ───────────────────────────────
function updateHud() {
  const s = stats;
  const done = save.stage > LAST_STAGE;
  $('lStage').textContent = done ? '챕터 1 · 완료!' : `챕터 1 · ${save.stage} / ${LAST_STAGE}`;
  $('lGold').textContent = Math.floor(save.gold).toLocaleString('ko-KR');
  $('lBattleSub').textContent = done ? '챕터 보스 준비 중' : '들꽃 평원 1-' + save.stage;
  $('toBattle').classList.toggle('lock', done);
  $('lName').textContent = save.name;
  refreshSettings();
  $('chestRate').textContent = `초당 ${idleRate().toFixed(1)} G`;
  updateChest();
  if (!$('modal').hidden) refreshModal();
}

function updateChest() {
  const amt = Math.floor(save.chest);
  $('chestAmt').textContent = amt >= 1 ? fmt(amt) + ' G' : '쌓이는 중…';
  const full = amt >= 1;
  if (updateChest.full !== full) {
    updateChest.full = full;
    const c = $('chestCv').getContext('2d');
    c.imageSmoothingEnabled = false;
    c.clearRect(0, 0, 24, 20);
    c.drawImage(full ? SPR.chest_full : SPR.chest, 0, 0);
  }
}

function updateBattleHud() {
  if (!battle) return;
  $('bStage').textContent = `들꽃 평원 1-${battle.stage}`;
  $('bWave').textContent = `웨이브 ${battle.wave + 1} / ${WAVES.length}` + (battle.wave === WAVES.length - 1 ? ' · 대장 등장!' : '') + ` · 몬스터 치명타 저항 ${critRes(battle.stage).toFixed(1)}%`;
  $('skillBar').innerHTML = save.slots.map((id, i) => {
    const sk = id && skillById(id);
    return `<button class="stone skbtn${sk ? '' : ' lock'}" data-slot="${i}"><kbd>${i + 1}</kbd><span>${sk ? sk.name : '빈 칸'}</span>${sk ? `<small>Lv ${save.skills[id]}</small>` : ''}<i class="cd"></i><span class="cdn"></span></button>`;
  }).join('') + `<button class="stone skauto${save.autoSkill ? ' on' : ''}" id="autoBtn">AUTO<small>${save.autoSkill ? '켜짐' : '꺼짐'}</small></button>`;
  $('skillBar').querySelectorAll('.skbtn').forEach(b => b.onclick = () => castSkill(+b.dataset.slot, false));
  $('autoBtn').onclick = () => { save.autoSkill = !save.autoSkill; updateBattleHud(); };
  $('bGold').textContent = Math.floor(save.gold).toLocaleString('ko-KR');
  $('waves').innerHTML = WAVES.map((_, i) => `<i class="${i < battle.wave ? 'done' : i === battle.wave ? 'now' : ''}"></i>`).join('');
  $('potionCnt').textContent = save.potions + '개';
  $('bName').textContent = save.name;
}

// 매 프레임: 체력바, 물약 쿨타임
function updateBattleBars() {
  const r = hero.hp / stats.maxHp;
  $('hpfill').style.width = (r * 100) + '%';
  $('hpbar').classList.toggle('low', r < 0.3);
  $('bHp').textContent = `${fmt(hero.hp)} / ${fmt(stats.maxHp)}`;
  const cd = battle ? battle.potionCd : 0;
  $('potionCd').style.setProperty('--p', (cd / POTION_CD * 100) + '%');
  $('potionCdn').textContent = cd > 0 ? Math.ceil(cd) : '';
  $('skillBar').querySelectorAll('.skbtn').forEach(b => {
    const id = save.slots[b.dataset.slot];
    if (!id || !battle) return;
    const left = battle.skillCd[id] || 0;
    b.querySelector('.cd').style.setProperty('--p', (left / skillById(id).cd * 100) + '%');
    b.querySelector('.cdn').textContent = left > 0 ? Math.ceil(left) : '';
    b.classList.toggle('cooling', left > 0);
  });
}

function showScreen(name) {
  screen = name;
  $('lobbyUI').hidden = name !== 'lobby';
  $('battleUI').hidden = name !== 'battle';
  closeModal();
  if (name === 'lobby') { battle = null; refreshStats(); }
  updateHud();
  updateBattleHud();
}

// ── 팝업: 강화, 상점 ─────────────────────────
let modalKind = null;

function openModal(kind) {
  modalKind = kind;
  $('mTitle').textContent = { up: '강화', shop: '상점', skill: '스킬', gear: '장비' }[kind];
  if (kind === 'gear') {
    $('mBody').innerHTML = '<div class="mgold" id="mGold"></div><div class="gearslots" id="gearSlots"></div><div class="baghead"><span id="bagCnt"></span><button id="sellLow">일반·고급 모두 팔기</button></div><div id="bag"></div><p class="note">전투에서만 획득 · 대장 처치 시 1개 확정, 일반 몬스터는 낮은 확률 · 높은 스테이지일수록 좋은 장비</p>';
    $('sellLow').onclick = sellLow;
    $('modal').hidden = false;
    refreshModal();
    return;
  }
  if (kind === 'skill') {
    $('mBody').innerHTML = '<div class="mgold" id="mGold"></div><div id="skList"></div><p class="note">스킬 칸 3개 · AUTO 켜짐: 자동 사용 · AUTO 꺼짐: 버튼 또는 1·2·3 키로 사용</p>';
    $('modal').hidden = false;
    refreshModal();
    return;
  }
  $('mBody').innerHTML = '<div class="mgold" id="mGold"></div>' + (kind === 'up' ? UPGRADES.map(u => `
    <div class="up" id="up_${u.id}">
      <div class="nm">${u.name}<small></small></div>
      <div class="val"></div>
      <button></button>
    </div>`).join('') : `
    <div class="up" id="shopPotion">
      <div class="nm">회복 물약<small></small></div>
      <div class="val">전투 중 최대 체력의 ${POTION_HEAL * 100}% 회복 · 사용 후 ${POTION_CD}초 대기</div>
      <button></button>
    </div>
    <p class="note">최대 ${POTION_MAX}개 보유 · 스테이지가 오를수록 가격 상승</p>
    <div class="baghead"><span>장비 <small id="shopTimer"></small></span><button id="reroll"></button></div>
    <div id="shopGear"></div>
    <p class="note">희귀 등급까지 판매 · 전투 장비보다 약간 낮은 성능 · 스테이지가 오를수록 성능 상승</p>`);
  if (kind === 'shop') { checkShop(); $('reroll').onclick = rerollShop; }
  if (kind === 'up') UPGRADES.forEach(u => holdButton($('up_' + u.id).querySelector('button'), () => buy(u)));
  else holdButton($('shopPotion').querySelector('button'), buyPotion);
  $('modal').hidden = false;
  refreshModal();
}

function closeModal() { $('modal').hidden = true; modalKind = null; }

function potionPrice() { return monGold(save.stage) * 6; }

function refreshModal() {
  $('mGold').textContent = '보유 골드 ' + Math.floor(save.gold).toLocaleString('ko-KR') + ' G';
  if (modalKind === 'up') {
    UPGRADES.forEach(u => {
      const row = $('up_' + u.id);
      const lv = save.lv[u.id];
      const btn = row.querySelector('button');
      row.querySelector('.nm small').textContent = 'Lv ' + lv;
      if (lv >= u.max) {
        row.querySelector('.val').textContent = upgradeText(u.id, stats) + ' (최대)';
        btn.textContent = 'MAX'; btn.disabled = true; btn.className = 'max';
      } else {
        const cost = upgradeCost(u, lv);
        const next = fullStats({ ...save.lv, [u.id]: lv + 1 });
        row.querySelector('.val').innerHTML = `${upgradeText(u.id, stats)} → <em>${upgradeText(u.id, next)}</em>`;
        btn.textContent = fmt(cost) + ' G';
        btn.disabled = save.gold < cost;
      }
    });
  } else if (modalKind === 'gear') {
    const icon = id => `<img class="gicon" src="${ICON_URL[id]}">`;
    $('gearSlots').innerHTML = GEAR_SLOTS.map(sl => {
      const it = equipped(sl.id);
      return `<div class="gslot" style="border-color:${it ? GRADES[it.grade].color : 'var(--line)'}">${icon(sl.id)}<div><b style="color:${it ? GRADES[it.grade].color : 'var(--muted)'}">${it ? itemName(it) : sl.name + ' 없음'}</b><small>${it ? itemText(it) : '전투에서 획득'}</small></div></div>`;
    }).join('');
    $('bagCnt').textContent = `가방 ${save.items.length} / ${BAG_MAX}`;
    const list = save.items.filter(it => !Object.values(save.gear).includes(it.id))
      .sort((a, b) => b.grade - a.grade || itemScore(b) - itemScore(a));
    $('bag').innerHTML = list.length ? list.map(it => {
      const better = itemScore(it) > itemScore(equipped(it.slot));
      return `<div class="up gitem" style="border-left:4px solid ${GRADES[it.grade].color}">
        <div class="nm">${icon(it.slot)}<span style="color:${GRADES[it.grade].color}">${GRADES[it.grade].name} ${itemName(it)}</span>${better ? '<em class="better">▲</em>' : ''}<small>1-${it.stage}</small></div>
        <div class="val">${itemText(it)}</div>
        <div class="skbtns"><button class="equip" data-eq="${it.id}">장착</button><button data-sell="${it.id}">판매 ${fmt(sellPrice(it))} G</button></div>
      </div>`;
    }).join('') : '<p class="note">가방 비어 있음</p>';
    $('bag').querySelectorAll('[data-eq]').forEach(b => b.onclick = () => equipItem(+b.dataset.eq));
    $('bag').querySelectorAll('[data-sell]').forEach(b => b.onclick = () => sellItem(+b.dataset.sell));
  } else if (modalKind === 'skill') {
    const cleared = save.stage - 1;
    $('skList').innerHTML = SKILLS.map(sk => {
      const lv = save.skills[sk.id] || 0;
      const open = cleared >= sk.unlock;
      const slot = save.slots.indexOf(sk.id);
      const cost = skillCost(sk, lv);
      let val;
      if (!open) val = `${sk.unlock}스테이지 클리어 시 해금`;
      else if (!lv) val = sk.desc(skillPower(sk, 1)) + ` · 쿨타임 ${sk.cd}초`;
      else val = `${sk.desc(skillPower(sk, lv))} → <em>${Math.round(skillPower(sk, lv + 1) * 100)}%</em> · 쿨타임 ${sk.cd}초`;
      return `<div class="up sk${open ? '' : ' locked'}">
        <div class="nm">${sk.name}<small>${lv ? 'Lv ' + lv : ''}${slot >= 0 ? ' · ' + (slot + 1) + '번 칸' : ''}</small></div>
        <div class="val">${val}</div>
        <div class="skbtns">
          ${lv ? `<button class="equip${slot >= 0 ? ' on' : ''}" data-eq="${sk.id}">${slot >= 0 ? '해제' : '장착'}</button>` : ''}
          <button data-learn="${sk.id}" ${!open || save.gold < cost ? 'disabled' : ''}>${open ? (lv ? '강화 ' : '배우기 ') + fmt(cost) + ' G' : '잠김'}</button>
        </div>
      </div>`;
    }).join('');
    $('skList').querySelectorAll('[data-learn]').forEach(b => b.onclick = () => learnSkill(b.dataset.learn));
    $('skList').querySelectorAll('[data-eq]').forEach(b => b.onclick = () => equipSkill(b.dataset.eq));
  } else if (modalKind === 'shop') {
    const row = $('shopPotion');
    const btn = row.querySelector('button');
    row.querySelector('.nm small').textContent = `보유 ${save.potions} / ${POTION_MAX}`;
    btn.textContent = fmt(potionPrice()) + ' G';
    btn.disabled = save.gold < potionPrice() || save.potions >= POTION_MAX;
    $('reroll').textContent = `새로 고치기 ${fmt(rerollPrice())} G`;
    $('reroll').disabled = save.gold < rerollPrice();
    $('shopGear').innerHTML = save.shop.items.map((it, i) => {
      const better = !it.sold && itemScore(it) > itemScore(equipped(it.slot));
      return `<div class="up gitem${it.sold ? ' locked' : ''}" style="border-left:4px solid ${GRADES[it.grade].color}">
        <div class="nm"><img class="gicon" src="${ICON_URL[it.slot]}"><span style="color:${GRADES[it.grade].color}">${GRADES[it.grade].name} ${itemName(it)}</span>${better ? '<em class="better">▲</em>' : ''}</div>
        <div class="val">${itemText(it)}</div>
        <button data-buy="${i}" ${it.sold || save.gold < shopPrice(it) ? 'disabled' : ''}>${it.sold ? '팔림' : fmt(shopPrice(it)) + ' G'}</button>
      </div>`;
    }).join('');
    $('shopGear').querySelectorAll('[data-buy]').forEach(b => b.onclick = () => buyShopItem(+b.dataset.buy));
    updateShopTimer();
  }
}

function updateShopTimer() {
  if (modalKind !== 'shop') return;
  if (checkShop()) return refreshModal();
  const left = Math.max(0, SHOP_RESTOCK - (Date.now() - save.shop.at)) / 1000;
  $('shopTimer').textContent = `· 새 물건까지 ${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}`;
}

function buy(u) {
  const lv = save.lv[u.id];
  if (lv >= u.max) return false;
  const cost = upgradeCost(u, lv);
  if (save.gold < cost) return false;
  save.gold -= cost;
  save.lv[u.id]++;
  refreshStats();
  updateHud();
  return true;
}

function equipItem(id) {
  const it = save.items.find(x => x.id === id);
  if (!it) return;
  save.gear[it.slot] = it.id;
  refreshStats();
  updateHud();
}

function sellItem(id) {
  const i = save.items.findIndex(x => x.id === id);
  if (i < 0 || Object.values(save.gear).includes(id)) return;
  save.gold += sellPrice(save.items[i]);
  save.items.splice(i, 1);
  updateHud();
}

function sellLow() {
  save.items.filter(it => it.grade <= 1 && !Object.values(save.gear).includes(it.id)).forEach(it => sellItem(it.id));
}

function learnSkill(id) {
  const sk = skillById(id), lv = save.skills[id] || 0;
  const cost = skillCost(sk, lv);
  if (save.stage - 1 < sk.unlock || save.gold < cost) return;
  save.gold -= cost;
  save.skills[id] = lv + 1;
  if (!lv) { const empty = save.slots.indexOf(null); if (empty >= 0) save.slots[empty] = id; }   // 처음 배우면 빈 칸에 자동 장착
  updateHud();
}

function equipSkill(id) {
  const at = save.slots.indexOf(id);
  if (at >= 0) save.slots[at] = null;
  else {
    const empty = save.slots.indexOf(null);
    if (empty < 0) return alert('스킬 칸 부족 · 다른 스킬 해제 필요');
    save.slots[empty] = id;
  }
  updateHud();
}

function buyPotion() {
  const price = potionPrice();
  if (save.gold < price || save.potions >= POTION_MAX) return false;
  save.gold -= price;
  save.potions++;
  updateHud();
  return true;
}

// 누르고 있으면 계속 구매
function holdButton(btn, fn) {
  let timer = null;
  const stop = () => { clearTimeout(timer); timer = null; };
  btn.addEventListener('pointerdown', e => {
    if (btn.disabled) return;
    e.preventDefault();
    fn();
    let delay = 350;
    const loop = () => { if (!fn()) return stop(); delay = Math.max(50, delay * 0.8); timer = setTimeout(loop, delay); };
    timer = setTimeout(loop, delay);
  });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => btn.addEventListener(ev, stop));
}

// ── 클라우드 세이브 (구글 로그인, cloud.js) ────
// cloudRev: 마지막으로 클라우드와 맞춘 버전 표시. 클라우드와 같으면 이 기기가 이어서 진행한 것이라 그냥 올리고,
// 다르면 다른 기기에서 진행한 것이므로 어느 쪽을 쓸지 고르게 한다.
const CLOUD_EVERY = 30000;
let cloudBusy = false, cloudChoice = false, cloudAt = 0, cloudMsg = '';

function cloudOn() { return !TEST && window.Cloud && window.Cloud.user && save && !sleeping; }
const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const hhmm = t => { const d = new Date(t); return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`; };

async function cloudUpload() {
  if (!cloudOn() || cloudBusy || cloudChoice) return;
  cloudBusy = true;
  try {
    save.cloudRev = Math.random().toString(36).slice(2);
    writeSave();
    await window.Cloud.save(save);
    cloudAt = Date.now();
    cloudMsg = '';
  } catch (e) {
    console.warn(e);
    cloudMsg = '클라우드 저장 실패';
  }
  cloudBusy = false;
  refreshSettings();
}

async function cloudSyncOnLogin() {
  if (!cloudOn() || cloudBusy) return;
  cloudBusy = true;
  let remote;
  try { remote = await window.Cloud.load(); }
  catch (e) { console.warn(e); cloudMsg = '클라우드 불러오기 실패'; cloudBusy = false; refreshSettings(); return; }
  cloudBusy = false;
  if (!remote || remote.cloudRev === save.cloudRev) return cloudUpload();   // 첫 로그인이거나 이 기기가 이어서 진행한 것
  showSyncChoice(remote);
}

function saveSummary(s) {
  return `스테이지 1-${Math.min(s.stage, LAST_STAGE)} · 골드 ${fmt(s.gold)} · 공격력 Lv ${s.lv.atk}<br>마지막 저장 ${s.savedAt ? hhmm(s.savedAt) : '-'}`;
}

function showSyncChoice(remote) {
  cloudChoice = true;
  modalKind = 'sync';
  $('mTitle').textContent = '세이브 선택';
  $('mBody').innerHTML = `<div class="mgold" id="mGold"></div>
    <p class="note" style="margin-bottom:10px">클라우드와 이 기기의 진행 상황이 서로 다름 · 사용할 세이브 선택</p>
    <div class="up"><div class="nm">클라우드 세이브</div><div class="val">${saveSummary(remote)}</div><button id="useCloud">사용</button></div>
    <div class="up"><div class="nm">이 기기 세이브</div><div class="val">${saveSummary(save)}</div><button id="useLocal">사용</button></div>
    <p class="note">선택하지 않은 쪽은 덮어써짐</p>`;
  $('useCloud').onclick = () => {
    sleeping = true;                                       // 다시 불러오기 전에 이 기기 세이브가 덮어쓰지 않도록
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(remote)); } catch (e) { /* 무시 */ }
    location.reload();
  };
  $('useLocal').onclick = () => { cloudChoice = false; closeModal(); cloudUpload(); };
  $('modal').hidden = false;
}

function openSettings() {
  modalKind = 'settings';
  $('mTitle').textContent = '설정';
  $('mBody').innerHTML = '<div class="mgold" id="mGold"></div><div id="setBody"></div>';
  $('modal').hidden = false;
  refreshSettings();
}

function refreshSettings() {
  $('lPower').textContent = '전투력 ' + fmt(power(stats)) + (cloudOn() ? ' · ☁ 클라우드' : '');
  if (modalKind !== 'settings') return;
  const u = window.Cloud && window.Cloud.user;
  let acct;
  if (TEST) acct = '<p class="note">테스트 모드 · 클라우드 저장 꺼짐</p>';
  else if (!window.Cloud) acct = '<p class="note">로그인 기능 불러오는 중…</p>';
  else if (u) acct = `<div class="up"><div class="nm">구글 계정<small>${esc(u.email || '')}</small></div>
      <div class="val">클라우드 저장 켜짐 · ${cloudChoice ? '세이브 선택 대기' : cloudBusy ? '동기화 중…' : cloudAt ? '마지막 저장 ' + hhmm(cloudAt) : '대기 중'}${cloudMsg ? ' · ' + cloudMsg : ''}</div>
      <button id="cloudOut" class="plain">로그아웃</button></div>`;
  else acct = `<div class="up"><div class="nm">클라우드 저장<small>꺼짐</small></div>
      <div class="val">구글 로그인 시 다른 기기에서도 이어서 플레이${cloudMsg ? ' · <span style="color:var(--bad)">' + cloudMsg + '</span>' : ''}</div>
      <button id="cloudIn">구글로 로그인</button></div>`;
  $('setBody').innerHTML = acct + `
    <div class="up"><div class="nm">처음부터 하기</div><div class="val">이 기기의 진행 상황 삭제</div><button id="resetBtn" class="danger">초기화</button></div>
    <p class="note"><a href="privacy.html" target="_blank">개인정보처리방침</a></p>`;
  if ($('cloudIn')) $('cloudIn').onclick = async () => {
    cloudMsg = '';
    try { await window.Cloud.signIn(); }
    catch (e) {
      cloudMsg = e.code === 'auth/popup-blocked' ? '팝업 차단됨 · 팝업 허용 필요'
        : e.code === 'auth/popup-closed-by-user' || e.code === 'auth/cancelled-popup-request' ? '' : '로그인 실패';
      refreshSettings();
    }
  };
  if ($('cloudOut')) $('cloudOut').onclick = async () => {
    await cloudUpload();
    writeSave();
    await window.Cloud.signOut();
  };
  $('resetBtn').onclick = resetGame;
}

function resetGame() {
  if (!confirm('처음부터 시작\n이 기기의 진행 상황 전체 삭제' + (cloudOn() ? '\n(클라우드 세이브는 유지)' : ''))) return;
  save = null;
  try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* 무시 */ }
  location.reload();
}

// ── 로그인 관문: 로그인해야 시작 (?test는 예외) ──
let booted = false;

function showLogin(state) {
  $('start').hidden = false;
  $('loginBox').hidden = false;
  $('createBox').hidden = true;
  $('loginBtn').hidden = state === 'checking';
  $('loginMsg').textContent = state === 'checking' ? '로그인 확인 중…' : state || '';
}

async function afterLogin(user) {
  showLogin('checking');
  $('loginMsg').textContent = '세이브 불러오는 중…';
  useAccountKey(user.uid);
  const local = readSave();
  let remote = null;
  try { remote = migrateSave(await window.Cloud.load()); }
  catch (e) { console.warn(e); return showLogin('세이브 불러오기 실패 · 새로고침 후 다시 시도'); }
  $('start').hidden = true;
  booted = true;
  if (!local && remote) {                 // 이 기기에 없으면 클라우드 세이브로
    save = remote;
    writeSave();
    begin();
  } else if (local) {                     // 이 기기 세이브로 시작 → 클라우드와 비교 (begin 안에서)
    save = local;
    begin();
  } else {                                // 처음 하는 계정: 캐릭터 만들기
    booted = false;
    showStart();
  }
}

window.addEventListener('cloud-user', e => {
  const user = e.detail;
  if (TEST || !spritesReady) return;       // 그림 준비 전이면 시작 코드가 상태를 확인한다
  if (!booted) {
    if (user) afterLogin(user);
    else showLogin();
    return;
  }
  if (!user) { sleeping = true; location.reload(); return; }   // 로그아웃 → 로그인 화면으로
  if (save && stats) refreshSettings();
});

// ── 시작 화면 ───────────────────────────────
function showStart() {
  const box = $('start');
  box.hidden = false;
  $('loginBox').hidden = true;
  $('createBox').hidden = false;
  let gender = null;
  for (const g of ['m', 'f']) {
    const c = $('p' + g).getContext('2d');
    c.imageSmoothingEnabled = false;
    c.drawImage(SPR['hero_' + g], 0, 0);
  }
  box.querySelectorAll('.pick button').forEach(b => b.onclick = () => {
    gender = b.dataset.g;
    box.querySelectorAll('.pick button').forEach(x => x.classList.toggle('on', x === b));
    $('startMsg').textContent = '';
  });
  $('nameIn').oninput = () => { $('startMsg').textContent = ''; };
  $('nameIn').onkeydown = e => { if (e.key === 'Enter' && !e.isComposing) $('go').click(); };
  // 한글 조합 중에도 눌리도록 버튼은 항상 켜 두고 누를 때 검사한다
  $('go').onclick = () => {
    const name = $('nameIn').value.trim();
    if (!gender) return ($('startMsg').textContent = '캐릭터 선택 필요');
    if (!name) return ($('startMsg').textContent = '이름 입력 필요');
    save = newSave(name, gender);
    box.hidden = true;
    booted = true;
    writeSave();
    begin();
  };
}

// ── 시작 ────────────────────────────────────
// 장비 아이콘을 <img>로 쓰기 위해 그림 주소로 바꿔 둔다
const ICON_URL = {};

function begin() {
  for (const sl of GEAR_SLOTS) {
    const img = SPR['icon_' + sl.id];
    ICON_URL[sl.id] = img.toDataURL ? img.toDataURL() : img.src;
  }
  accrue();
  refreshStats();
  $('game').hidden = false;
  const ic = $('battleIcon').getContext('2d');
  ic.imageSmoothingEnabled = false;
  ic.drawImage(SPR['hero_' + save.gender], 0, 0);
  document.querySelectorAll('.picon').forEach(c => { const x = c.getContext('2d'); x.imageSmoothingEnabled = false; x.drawImage(SPR.potion, 0, 0); });

  $('toBattle').onclick = () => { if (save.stage <= LAST_STAGE) startBattle(); };
  $('retreat').onclick = () => {
    if (battle && battle.state === 'fight') endBattle('retreat');
    else showScreen('lobby');
  };
  $('chestBtn').onclick = collectChest;
  $('potionBtn').onclick = usePotion;
  document.addEventListener('keydown', e => {
    if (screen !== 'battle') return;
    if (e.key === 'q' || e.key === 'Q' || e.key === 'ㅂ') usePotion();
    if (e.key >= '1' && e.key <= String(SKILL_SLOTS)) castSkill(+e.key - 1, false);
  });
  document.querySelectorAll('[data-open]').forEach(b => b.onclick = () => openModal(b.dataset.open));
  $('mClose').onclick = closeModal;
  $('modal').onclick = e => { if (e.target === $('modal')) closeModal(); };
  $('lSave').onclick = () => {
    writeSave();
    floatsLobby.push({ text: '저장 완료!', t: 0, x: 160, y: 60, color: '#ffffff', big: true });
  };
  $('lReset').onclick = openSettings;

  showScreen('lobby');
  let last = performance.now();
  let tick = 0;
  const frame = now => {
    if (sleeping) return;
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    time += dt;
    if (screen === 'battle') { updateBattle(dt); updateBattleBars(); }
    tick += dt;
    if (tick > 0.25) { tick = 0; accrue(); updateChest(); updateShopTimer(); }
    render();
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  setInterval(writeSave, 5000);
  setInterval(cloudUpload, CLOUD_EVERY);
  window.addEventListener('beforeunload', writeSave);
  if (window.Cloud && window.Cloud.user) cloudSyncOnLogin();
}

let spritesReady = false;

loadSprites().then(() => {
  spritesReady = true;
  claimTab();
  if (TEST) {                              // 테스트: 로그인 없이 브라우저 저장만
    save = readSave();
    if (save) begin(); else showStart();
    return;
  }
  $('loginBtn').onclick = async () => {
    $('loginMsg').textContent = '';
    try { await window.Cloud.signIn(); }
    catch (e) {
      $('loginMsg').textContent = e.code === 'auth/popup-blocked' ? '팝업 차단됨 · 팝업 허용 필요'
        : e.code === 'auth/popup-closed-by-user' || e.code === 'auth/cancelled-popup-request' ? '' : '로그인 실패';
    }
  };
  if (window.Cloud) {                      // cloud.js가 먼저 준비됐으면 지금 상태로 시작
    if (window.Cloud.ready) window.Cloud.user ? afterLogin(window.Cloud.user) : showLogin();
    else showLogin('checking');
  } else showLogin('checking');
});
