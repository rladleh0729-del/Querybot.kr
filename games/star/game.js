// 별의 설화 — 로비(캠프·방치 상자·강화·상점) + 전투(웨이브 3개 스테이지 도전)
'use strict';

// 주소에 ?test를 붙이면 테스트용 저장을 따로 쓴다 (진짜 진행을 건드리지 않음)
const TEST = new URLSearchParams(location.search).has('test');
const SAVE_BASE = 'starTale.save.v1';
let SAVE_KEY = SAVE_BASE + (TEST ? '.test' : '');   // 로그인하면 계정별 키로 바뀐다 (useAccountKey)
const STAGES_PER = 20;      // 챕터마다 스테이지 20개 (스테이지 번호는 전체 번호: 2-1 = 21)
const SCALE = 3;            // 320×180 도트 화면을 960×540으로 키워 그림
const GROUND = 140;
const WAVES = [3, 3, 4];    // 웨이브별 몬스터 수. 마지막 웨이브의 마지막은 대장
const WAVE_HEAL = 0.5;      // 웨이브를 깨면 최대 체력의 50% 회복
const POTION_HEAL = 0.4;
const POTION_CD = 15;       // 물약 사용 텀(초)
const POTION_MAX = 20;
const IDLE_CAP_HOURS = 8;
const BOSS_TIME = 60;       // 챕터 보스 제한 시간(초)
const MECH_WARN = 1.2;      // 보스 특수 공격 전 경고 시간
const ROOT_TIME = 2;        // 뿌리 감옥에 묶여 있는 시간
const REPLAY_BONUS = 0.3;   // 이미 깬 스테이지의 클리어 보상 비율
const SHARD_BONUS = 0.1;    // 별조각 1개당 공격력·체력 +10%

// 밸런스 숫자 (시뮬레이션으로 맞춤)
// 물약·스킬·장비 없이 시뮬레이션: 챕터 1 약 70분, 챕터 2 약 110분 (챕터 2부터 성장률 완만)
const BAL = { monHp: 30, hpGrow: 1.55, monAtk: 5, atkGrow: 1.45, monGold: 3, goldGrow: 1.22, bossHp: 4, bossAtk: 1.6, bossGold: 5, idle: 0.22, clearBonus: 5, hpGrow2: 1.25, atkGrow2: 1.22, kingHp: 20, kingAtk: 0.6, kingGold: 30 };   // 보스: 물약·스킬 없이 1-20 클리어 후 약 10분 성장하면 40초 안팎에 처치

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
// 전투력 = √(초당 피해 × 버티는 힘) ÷ 10
// 초당 피해: 공격력·공격 속도·연속 베기, 치명타는 지금 스테이지 몬스터의 치명타 저항과 내 관통까지 반영. 동료 공격 포함.
// 버티는 힘: 체력 + 20초치 회복·흡혈·치유 동료, 받는 피해 감소와 회피 반영.
function power(s) {
  const m = s.mods || {};
  const res = save && save.stage ? Math.max(0, critRes(Math.min(save.stage, MAX_STAGE)) - (s.pierce || 0)) : 0;
  const crit = Math.min(100, Math.max(0, s.crit - res)) / 100;
  let dps = s.atk * (1 + crit * (s.critDmg - 1)) * s.aspd * (1 + (m.double || 0) / 100);
  let sustain = s.regen + dps * (m.drain || 0) / 100;
  if (save && save.party) for (const id of save.party) {
    const A = allyById(id), lv = save.allies[id] || 1;
    if (!A) continue;
    const p = allyPow(id);
    if (A.type === 'magic') dps += s.atk * (0.5 + lv * 0.1) * p * 2 / A.every;
    if (A.type === 'shot') dps += s.atk * (1 + lv * 0.2) * p / A.every;
    if (A.type === 'warrior') dps += s.atk * (1.2 + lv * 0.2) * p / A.every;
    if (A.type === 'heal') sustain += s.maxHp * (6 + lv) * p / 100 / A.every;
  }
  const ehp = (s.maxHp + sustain * 20) / (1 - (m.guard || 0) / 100) / (1 - (m.dodge || 0) / 100);
  return Math.floor(Math.sqrt(dps * ehp) / 10);
}

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
  { name: '일반', color: '#8a8f9e', weight: 600, min: 1,  max: 8,   mult: 1 },
  { name: '고급', color: '#2f9a4a', weight: 250, min: 6,  max: 14,  mult: 2 },
  { name: '희귀', color: '#2f74d8', weight: 100, min: 12, max: 24,  mult: 3.5 },
  { name: '영웅', color: '#8a3fd0', weight: 40,  min: 22, max: 40,  mult: 6, pierce: 5 },
  { name: '전설', color: '#e0820a', weight: 9,   min: 38, max: 65,  mult: 10, pierce: 10 },
  { name: '신화', color: '#e0304a', weight: 1,   min: 60, max: 100, mult: 17, pierce: 20 },
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
  const sh = 1 + (save.shards || 0) * SHARD_BONUS;
  s.atk = Math.floor(s.atk * sh);
  s.maxHp = Math.floor(s.maxHp * sh);
  s.regen *= sh;
  const w = equipped('weapon'), a = equipped('armor'), c = equipped('acc');
  if (w) s.atk = Math.floor(s.atk * (1 + w.value / 100));
  if (a) { s.maxHp = Math.floor(s.maxHp * (1 + a.value / 100)); s.regen *= 1 + a.value / 100; }
  if (c) s.critDmg += c.value / 100;
  s.pierce = c ? c.pierce : 0;
  const ok = save && save.party;
  const tc = t => ok ? typeCount(t) : 0;
  const cx = ok ? codexBonus() : 0;
  s.atk = Math.floor(s.atk * (1 + cx / 100)); s.maxHp = Math.floor(s.maxHp * (1 + cx / 100));
  if (tc('magic')) s.atk = Math.floor(s.atk * (tc('magic') >= 2 ? 1.2 : 1.1));
  if (tc('support')) s.maxHp = Math.floor(s.maxHp * (tc('support') >= 2 ? 1.2 : 1.1));
  if (tc('heal')) s.regen += s.maxHp * (tc('heal') >= 2 ? 0.04 : 0.02);
  if (tc('shot')) s.crit += tc('shot') >= 2 ? 10 : 5;
  for (const id of ok ? save.party : []) {
    const A = allyById(id);
    if (A && A.type === 'support') { const lv = save.allies[id] || 1, p = allyPow(id); s.atk = Math.floor(s.atk * (1 + (4 + lv) * p / 100)); s.aspd *= 1 + (2 + lv * 0.5) * p / 100; }
  }
  const m = traitMods();
  if (tc('warrior')) m.guard = Math.min(60, m.guard + (tc('warrior') >= 2 ? 10 : 5));
  s.atk = Math.floor(s.atk * (1 + m.atk / 100));
  s.maxHp = Math.floor(s.maxHp * (1 + m.hp / 100));
  s.crit += m.crit;
  s.critDmg += m.critDmg / 100;
  s.aspd *= 1 + m.aspd / 100;
  s.pierce += m.pierce;
  s.regen = s.regen * (1 + m.regen / 100) * (1 + m.healMul / 100) + s.maxHp * m.regenFlat / 100;
  s.mods = m;
  return s;
}

// ── 레벨·특성·전직 ────────────────────────────
// 레벨: 스테이지 첫 클리어 +1, 챕터 보스 첫 처치 +3. 레벨이 오를 때마다 특성 포인트 1.
// 특성 보드는 챕터 1 보스를 깨면 열린다. 한 갈래에 15포인트면 1차 전직,
// 챕터 3 보스를 깨고 같은 갈래 30포인트면 2차 전직.
const TRAIT_TREES = [
  { id: 'sword', name: '검술 · 무기', color: '#d0443c', nodes: [
    { id: 's_atk',    name: '날카로운 칼날', max: 10, desc: r => `공격력 +${r * 3}%` },
    { id: 's_hp',     name: '단단한 몸',     max: 10, desc: r => `체력 +${r * 4}%` },
    { id: 's_wave',   name: '검기 날리기',   max: 5,  desc: r => `공격할 때마다 검기가 날아가 뒤의 적에게 공격력 ${r * 20}% 피해` },
    { id: 's_double', name: '연속 베기',     max: 3,  req: 10, desc: r => `${r * 8}% 확률로 한 번 더 공격` },
    { id: 's_exec',   name: '처형',          max: 1,  req: 15, desc: () => '체력 15% 아래로 떨어진 일반 몬스터를 즉시 처치' },
  ] },
  { id: 'mana', name: '마법 · 그림자', color: '#7a5ad0', nodes: [
    { id: 'm_color',  name: '삼색 마법',     max: 10, desc: r => `3번째 공격마다 불(화상)·얼음(적 공격 느려짐)·번개(3명 연쇄) 마법 · 공격력 ${r * 20}%` },
    { id: 'm_skill',  name: '마력 증폭',     max: 10, desc: r => `스킬 피해 +${r * 6}%` },
    { id: 'm_cd',     name: '빠른 영창',     max: 5,  desc: r => `스킬 쿨타임 -${r * 4}%` },
    { id: 'm_shadow', name: '그림자 군대',   max: 5,  req: 10, desc: r => `쓰러뜨린 적이 그림자 병사로 일어남 · 최대 ${r}명, 10초, 1초마다 공격력 30%` },
    { id: 'm_ally',   name: '동료 공명',     max: 5,  req: 10, desc: r => `마법형 동료 피해 +${r * 15}%` },
  ] },
  { id: 'agi', name: '민첩 · 사냥', color: '#2f9a4a', nodes: [
    { id: 'a_aspd',   name: '날렵한 손',     max: 10, desc: r => `공격 속도 +${r * 3}%` },
    { id: 'a_pierce', name: '약점 포착',     max: 5,  desc: r => `치명타 관통 +${r * 2}%` },
    { id: 'a_dodge',  name: '몸놀림',        max: 5,  desc: r => `${r * 2}% 확률로 공격 회피` },
    { id: 'a_mark',   name: '사냥감 표식',   max: 5,  req: 10, desc: r => `맨 앞의 적에게 표식 · 받는 피해 +${r * 8}%` },
    { id: 'a_ally',   name: '사냥 동료',     max: 5,  req: 10, desc: r => `사격형 동료 피해 +${r * 15}%` },
  ] },
  { id: 'holy', name: '신성 · 치유 (선)', color: '#d89a10', nodes: [
    { id: 'h_regen',  name: '축복',          max: 10, desc: r => `초당 회복 +${r * 15}%` },
    { id: 'h_smite',  name: '심판의 빛',     max: 10, desc: r => `악 몬스터에게 피해 +${r * 20}% · 공격 속도 +${r * 5}%` },
    { id: 'h_purify', name: '정화',          max: 3,  desc: r => r >= 3 ? '저주·독 면역' : `저주·독 지속 시간 -${r * 33}%` },
    { id: 'h_heal',   name: '치유 공명',     max: 5,  req: 10, desc: r => `치유형 동료 회복 +${r * 15}%` },
    { id: 'h_revive', name: '부활의 기도',   max: 1,  req: 15, desc: () => '전투마다 한 번, 쓰러지면 체력 30%로 부활' },
  ] },
  { id: 'dark', name: '악 · 어둠 (악)', color: '#9a2a5a', nodes: [
    { id: 'e_dark',   name: '어둠의 힘',     max: 10, desc: r => `모든 적에게 피해 +${r * 8}% · 단, 선·타락 천사 몬스터를 때리면 반발로 준 피해의 ${r}%를 받음` },
    { id: 'e_drain',  name: '피의 계약',     max: 5,  desc: r => `준 피해의 ${r}% 회복 (흡혈)` },
    { id: 'e_fear',   name: '공포',          max: 5,  desc: r => `공격할 때 ${r * 4}% 확률로 적이 1.5초 동안 얼어붙음` },
    { id: 'e_weak',   name: '역저주',        max: 3,  req: 10, desc: r => `적 공격력 -${r * 6}%` },
    { id: 'e_soul',   name: '영혼 수확',     max: 5,  req: 10, desc: r => `적을 쓰러뜨릴 때마다 공격력 +${r}% (전투 동안 최대 30번)` },
  ] },
];
const JOBS = {
  sword: { name: '검사',   bonus: '공격력 +10% · 체력 +10%',
    adv: [{ id: 'sm', name: '소드마스터', bonus: '공격력 +15% · 연속 베기 +15% · 검기 피해 2배' }, { id: 'knight', name: '나이트', bonus: '체력 +25% · 받는 피해 -15% · 동료 체력 +50%' }] },
  mana:  { name: '마법사', bonus: '스킬 피해 +25% · 삼색 마법 피해 +30%',
    adv: [{ id: 'elem', name: '엘리멘탈리스트', bonus: '2번째 공격마다 삼색 마법 · 마법 피해 +50%' }, { id: 'necro', name: '네크로맨서', bonus: '그림자 병사 최대 +3 · 병사가 사라지지 않음' }] },
  agi:   { name: '궁수',   bonus: '공격 속도 +15%',
    adv: [{ id: 'sniper', name: '저격수', bonus: '치명타 피해 +50% · 치명타 관통 +10%' }, { id: 'ranger', name: '레인저', bonus: '공격 속도 +20% · 처치 골드 +15%' }] },
  holy:  { name: '성직자', bonus: '초당 회복 +최대 체력 2% · 받는 피해 -5%',
    adv: [{ id: 'priest', name: '사제', bonus: '전투마다 부활 · 회복 효과 +50% · 저주 면역' }, { id: 'paladin', name: '성기사', bonus: '공격력 +15% · 악 몬스터 피해 +100%' }] },
  dark:  { name: '주술사', bonus: '어둠의 힘 +15% · 흡혈 2%',
    adv: [{ id: 'hypno', name: '최면술사', bonus: '8초마다 맨 앞의 적을 4초 동안 최면 · 최면 걸린 적은 자기 편을 공격' }, { id: 'fallen', name: '타락 기사', bonus: '공격력 +20% · 반발 면역' }] },
};
const JOB_POINTS = 15, ADV_POINTS = 30, ADV_CH = 3;

function heroLevel() {
  const cleared = Math.min(save.stage, MAX_STAGE + 1) - 1;
  return 1 + cleared + 3 * Object.values(save.bosses || {}).filter(Boolean).length;
}
const traitRank = id => (save.traits && save.traits[id]) || 0;
const treeSpent = t => t.nodes.reduce((a, n) => a + traitRank(n.id), 0);
const pointsSpent = () => TRAIT_TREES.reduce((a, t) => a + treeSpent(t), 0);
const pointsLeft = () => heroLevel() - 1 - pointsSpent();
const traitsOpen = () => bossBeaten(1);
function jobTitle() {
  if (save.adv) { for (const j of Object.values(JOBS)) { const a = j.adv.find(x => x.id === save.adv); if (a) return a.name; } }
  return save.job ? JOBS[save.job].name : '견습 모험가';
}

// 특성과 직업 효과를 한데 모은다 (% 단위)
// SEALED: 보스의 '룰 브레이커'가 특성·전직 효과를 봉인한 상태
let SEALED = false;
function traitMods() {
  const r = id => SEALED ? 0 : traitRank(id);
  const m = { atk: r('s_atk') * 3, hp: r('s_hp') * 4, crit: 0, double: r('s_double') * 8, drain: r('e_drain'),
    wave: r('s_wave') * 20, exec: r('s_exec'),
    skill: r('m_skill') * 6, cd: r('m_cd') * 4, critDmg: 0, shield: 0, magicAlly: r('m_ally') * 15,
    color: r('m_color') * 20, colorEvery: 3, shadow: r('m_shadow'), shadowPerm: 0,
    aspd: r('a_aspd') * 3, pierce: r('a_pierce') * 2, dodge: r('a_dodge') * 2, gold: 0, shotAlly: r('a_ally') * 15, mark: r('a_mark') * 8,
    regen: r('h_regen') * 15, guard: 0, potion: 0, healAlly: r('h_heal') * 15, revive: r('h_revive'),
    smite: r('h_smite') * 20, smiteSpd: r('h_smite') * 5, purify: r('h_purify'),
    dark: r('e_dark') * 8, reflect: r('e_dark'), noReflect: 0, fear: r('e_fear') * 4, weak: r('e_weak') * 6, soul: r('e_soul'),
    hypno: 0, allyHp: 0, regenFlat: 0, healMul: 0 };
  if (SEALED) return m;
  if (save.job === 'sword') { m.atk += 10; m.hp += 10; }
  if (save.job === 'mana') { m.skill += 25; m.color = Math.floor(m.color * 1.3); }
  if (save.job === 'agi') m.aspd += 15;
  if (save.job === 'holy') { m.regenFlat += 2; m.guard += 5; }
  if (save.job === 'dark') { m.dark += 15; m.drain += 2; }
  switch (save.adv) {
    case 'sm': m.atk += 15; m.double += 15; m.wave *= 2; break;
    case 'knight': m.hp += 25; m.guard += 15; m.allyHp += 50; break;
    case 'elem': m.colorEvery = 2; m.color = Math.floor(m.color * 1.5); break;
    case 'necro': m.shadow += 3; m.shadowPerm = 1; break;
    case 'sniper': m.critDmg += 50; m.pierce += 10; break;
    case 'ranger': m.aspd += 20; m.gold += 15; break;
    case 'priest': m.revive = 1; m.healMul += 50; m.purify = 3; break;
    case 'paladin': m.atk += 15; m.smite += 100; break;
    case 'hypno': m.hypno = 1; break;
    case 'fallen': m.atk += 20; m.noReflect = 1; break;
  }
  m.guard = Math.min(m.guard, 60);
  return m;
}

// ── 미션 ─────────────────────────────────────
// 기록(save.stats)은 누적, 일일(save.daily)은 날짜가 바뀌면 처음부터. 보상은 별가루(뽑기 재화).
const DAILY = [
  { id: 'd_kill',  key: 'kills',    target: 100, text: '몬스터 100마리 처치', reward: 20 },
  { id: 'd_clear', key: 'clears',   target: 5,   text: '스테이지 5번 클리어',  reward: 20 },
  { id: 'd_chest', key: 'chests',   target: 2,   text: '방치 상자 2번 받기',   reward: 15 },
  { id: 'd_up',    key: 'upgrades', target: 20,  text: '강화 20번',            reward: 15 },
  { id: 'd_dun',   key: 'dungeon',  target: 2,   text: '일일 던전 2번 도전',   reward: 20 },
  { id: 'd_all',   all: true,       target: 5,   text: '일일 미션 모두 완료',  reward: 50 },
];
const MAIN_TYPES = [
  { key: 'kills',    text: n => `몬스터 ${n}마리 처치`,   target: i => 20 + i * 15 },
  { key: 'upgrades', text: n => `강화 ${n}번`,            target: i => 10 + i * 4 },
  { key: 'clears',   text: n => `스테이지 ${n}번 클리어`, target: i => 3 + Math.floor(i / 3) },
  { key: 'gacha',    text: n => `장비 뽑기 ${n}번`,       target: i => 1 + Math.floor(i / 4) },
  { key: 'dungeon',  text: n => `일일 던전 ${n}번 도전`,  target: i => 1 + Math.floor(i / 8) },
];
const todayKey = () => { const t = new Date(); return `${t.getFullYear()}-${t.getMonth() + 1}-${t.getDate()}`; };
function ensureDaily() {
  if (!save.daily || save.daily.date !== todayKey()) save.daily = { date: todayKey(), claimed: {}, dgold: 0, dgear: 0 };
}
function track(key, n = 1) {
  if (!save) return;
  ensureDaily();
  save.stats[key] = (save.stats[key] || 0) + n;
  save.daily[key] = (save.daily[key] || 0) + n;
  updateMissionBanner();
}
function dailyProgress(q) {
  if (q.all) return DAILY.filter(x => !x.all && save.daily.claimed[x.id]).length;
  return Math.min(q.target, save.daily[q.key] || 0);
}
function mainMission() {
  const i = save.mainIdx, T = MAIN_TYPES[i % MAIN_TYPES.length], target = T.target(i);
  return { key: T.key, text: T.text(target), target, prog: Math.min(target, (save.stats[T.key] || 0) - save.mainBase),
    dust: 10 + Math.floor(i * 1.5), gold: monGold(topStage()) * 15 };
}
function claimMain() {
  const M = mainMission();
  if (M.prog < M.target) return false;
  save.dust += M.dust;
  save.gold += M.gold;
  save.mainIdx++;
  save.mainBase = save.stats[MAIN_TYPES[save.mainIdx % MAIN_TYPES.length].key] || 0;
  Sound.claim();
  notify(`+${M.dust} 별가루 · +${fmt(M.gold)} G`, '#ffe27a');
  writeSave(); updateHud();
  return true;
}
function claimDaily(id) {
  ensureDaily();
  const q = DAILY.find(x => x.id === id);
  if (!q || save.daily.claimed[id] || dailyProgress(q) < q.target) return;
  save.daily.claimed[id] = true;
  save.dust += q.reward;
  Sound.claim();
  writeSave(); updateHud();
}
const dailyReady = () => { ensureDaily(); return DAILY.some(q => !save.daily.claimed[q.id] && dailyProgress(q) >= q.target); };

function updateMissionBanner() {
  if (!save || !$('missionBtn')) return;
  const M = mainMission(), done = M.prog >= M.target;
  $('mText').textContent = done ? `✔ ${M.text} · 보상 받기!` : `${M.text} (${M.prog}/${M.target})`;
  $('mFill').style.width = (M.prog / M.target * 100) + '%';
  $('missionBtn').classList.toggle('ready', done);
  $('msDot').hidden = !dailyReady();
}

// ── 장비 뽑기 ─────────────────────────────────
const GACHA_COST = 30, GACHA10_COST = 270;
const GACHA_W = [0, 550, 300, 110, 35, 5];          // 일반은 안 나옴 · 신화 0.5%
function gachaGrade(minGrade = 1) {
  const w = GACHA_W.map((x, i) => i >= minGrade ? x : 0);
  let r = Math.random() * w.reduce((a, b) => a + b, 0), gr = 0;
  while (r >= w[gr]) { r -= w[gr]; gr++; }
  return gr;
}
function makeItem(stage, grade) {
  const slot = GEAR_SLOTS[Math.floor(Math.random() * GEAR_SLOTS.length)];
  return { id: save.nextItem++, slot: slot.id, grade, stage, value: rollValue(grade, stage), pierce: slot.id === 'acc' ? (GRADES[grade].pierce || 0) : 0 };
}
// 장비를 가방에 넣는다. 가방이 꽉 차면 자동 판매
function addItem(it) {
  if (save.items.length < BAG_MAX) { save.items.push(it); return true; }
  save.gold += sellPrice(it);
  it.sold = true;
  return false;
}
function doGacha(n) {
  const cost = n === 10 ? GACHA10_COST : GACHA_COST * n;
  if (save.dust < cost) return alert('별가루 부족');
  save.dust -= cost;
  const got = [];
  for (let i = 0; i < n; i++) got.push(makeItem(topStage(), gachaGrade()));
  if (n === 10 && !got.some(it => it.grade >= 2)) got[9] = makeItem(topStage(), gachaGrade(2));   // 10회는 희귀 이상 1개 보장
  got.forEach(addItem);
  track('gacha', n);
  writeSave(); updateHud();
  closeModal();
  showGacha(got);
}
let gachaTab = 'ally';
function showGacha(items) {
  $('gacha').hidden = false;
  $('gTitle').textContent = '장비 뽑기';
  $('gCards').innerHTML = items.map((it, i) => `<div class="gcard g${it.grade}" style="--d:${i * 0.18}s">
    <div class="gbeam"></div><img src="${ICON_URL[it.slot]}"><b style="color:${GRADES[it.grade].color}">${GRADES[it.grade].name}</b>
    <span>${itemName(it)}</span><small>${itemText(it)}${it.sold ? ' · 가방 꽉 참, 자동 판매' : ''}</small></div>`).join('');
  items.forEach((it, i) => setTimeout(() => Sound.reveal(it.grade), i * 180));
  const best = Math.max(...items.map(it => it.grade));
  $('gacha').classList.toggle('flash', best >= 4);
}

// ── 일일 던전 ─────────────────────────────────
const DUNGEONS = [
  { id: 'gold', name: '황금 슬라임 동굴', sprite: 'gold_slime', body: 'soft', desc: '30초 동안 준 피해만큼 골드 획득' },
  { id: 'gear', name: '보물 골렘 유적',   sprite: 'golem',      body: 'armored', desc: '30초 동안 준 피해만큼 별가루와 장비 획득' },
];
const DUNGEON_TRIES = 3, DUNGEON_TIME = 30;
const dunLeft = id => { ensureDaily(); return DUNGEON_TRIES - (save.daily['d' + id] || 0); };

function startDungeon(id) {
  const D = DUNGEONS.find(x => x.id === id);
  if (dunLeft(id) <= 0) return alert('오늘 도전 횟수 소진 · 내일 다시');
  ensureDaily();
  save.daily['d' + id] = (save.daily['d' + id] || 0) + 1;
  track('dungeon');
  SEALED = false;
  refreshStats();
  hero.hp = stats.maxHp; hero.cd = 0; floats = [];
  const top = topStage();
  const k = makeMonster(top, false);
  Object.assign(k, { name: D.name.split(' ').slice(0, -1).join(' '), sprite: D.sprite, body: D.body, align: 'neutral', king: true, size: 64, x: 200,
    hp: 1e30, maxHp: 1e30, atk: Math.floor(k.atk * 0.25), gold: 0 });
  battle = { stage: top, dungeon: id, king: true, mech: null, wave: 0, queue: [k], earned: 0, state: 'fight', delay: 0, potionCd: 0, skillCd: {}, cryT: 0, loot: [],
    timeLeft: DUNGEON_TIME, mechCd: Infinity, mechWarn: 0, bound: 0, allyCd: {}, fx: [], shield: 0, revived: false, poison: 0, dealt: 0 };
  initAllyHp();
  $('result').hidden = true;
  showScreen('battle');
  giveShield();
  say('hero', id === 'gold' ? '반짝반짝… 금화다!' : '보석이 가득한 골렘이야!', 2.5);
}

function endDungeon(result) {
  const r = battle, top = r.stage;
  const hpRef = BAL.monHp * growth(top, BAL.hpGrow, BAL.hpGrow2);
  const score = r.dealt / hpRef;                       // 일반 몬스터 몇 마리 분량의 피해를 줬나
  let text;
  if (r.dungeon === 'gold') {
    const gold = Math.floor(monGold(top) * (5 + score * 3));
    save.gold += gold;
    text = `준 피해 ${fmt(r.dealt)} · 획득 골드 <b>${fmt(gold)} G</b>`;
  } else {
    const dust = Math.min(80, 10 + Math.floor(score * 1.5));
    const items = [];
    for (let i = 0; i < Math.min(3, Math.floor(score / 6)); i++) { const it = makeItem(top, gachaGrade()); addItem(it); items.push(it); }
    save.dust += dust;
    text = `준 피해 ${fmt(r.dealt)} · 별가루 <b>+${dust}</b>`
      + (items.length ? '<br>획득 장비: ' + items.map(it => `<b style="color:${GRADES[it.grade].color}">${GRADES[it.grade].name} ${itemName(it)}</b>`).join(', ') : '<br>피해 부족 · 장비 없음');
  }
  Sound.win();
  writeSave(); cloudUpload();
  const id = r.dungeon, left = dunLeft(id);
  const btns = [['캠프로', () => showScreen('lobby'), left <= 0]];
  if (left > 0) btns.unshift([`다시 도전 (남은 ${left})`, () => startDungeon(id), true]);
  showResult({ retreat: '던전 종료', lost: '쓰러짐 · 던전 종료' }[result] || '시간 종료!', '#ffd25e', text, btns);
}

// ── 성장 연출 ─────────────────────────────────
function fanfare(title, sub, sound) {
  const el = $('fanfare');
  $('ffTitle').textContent = title;
  $('ffSub').textContent = sub;
  el.hidden = false;
  el.classList.remove('go'); void el.offsetWidth; el.classList.add('go');
  (sound || Sound.fanfare)();
  clearTimeout(fanfare.t);
  fanfare.t = setTimeout(() => el.hidden = true, 1900);
}

// ── 동료 ─────────────────────────────────────
// r: 등급 (1 일반 · 2 희귀 · 3 전설). 스토리 동료는 보스를 깨면 합류하고 뽑기에서도 나온다(조각)
const ALLY_TYPES = {
  heal:    { role: '치유형', every: 5,   desc: (lv, p) => `5초마다 주인공 체력 ${Math.round((6 + lv) * p)}% 회복` },
  magic:   { role: '마법형', every: 4,   desc: (lv, p) => `4초마다 앞의 적 3마리에게 공격력 ${Math.round((50 + lv * 10) * p)}% 마법 피해` },
  shot:    { role: '사격형', every: 2.5, desc: (lv, p) => `2.5초마다 앞의 적에게 공격력 ${Math.round((100 + lv * 20) * p)}% 피해` },
  warrior: { role: '전사형', every: 3,   desc: (lv, p) => `3초마다 가까운 적에게 공격력 ${Math.round((120 + lv * 20) * p)}% 피해` },
  support: { role: '지원형', every: 0,   desc: (lv, p) => `주인공 공격력 +${Math.round((4 + lv) * p)}% · 공격 속도 +${Math.round((2 + lv * 0.5) * p)}%` },
};
const ALLIES = [
  { id: 'miru',  name: '미르', type: 'heal',    r: 2, from: '챕터 1 보스' },
  { id: 'serin', name: '세린', type: 'magic',   r: 2, from: '챕터 2 보스' },
  { id: 'kai',   name: '카이', type: 'shot',    r: 2, from: '챕터 3 보스' },
  { id: 'pio',   name: '피오', type: 'magic',   r: 3 },
  { id: 'lea',   name: '레아', type: 'warrior', r: 3 },
  { id: 'noeul', name: '노을', type: 'shot',    r: 3 },
  { id: 'luka',  name: '루카', type: 'warrior', r: 2 },
  { id: 'bron',  name: '브론', type: 'warrior', r: 2 },
  { id: 'arin',  name: '아린', type: 'magic',   r: 2 },
  { id: 'eunho', name: '은호', type: 'shot',    r: 2 },
  { id: 'sea',   name: '세아', type: 'heal',    r: 2 },
  { id: 'baram', name: '바람', type: 'support', r: 2 },
  { id: 'tobi',  name: '토비', type: 'warrior', r: 1 },
  { id: 'jun',   name: '준',   type: 'warrior', r: 1 },
  { id: 'danbi', name: '단비', type: 'magic',   r: 1 },
  { id: 'rio',   name: '리오', type: 'shot',    r: 1 },
  { id: 'sora',  name: '소라', type: 'shot',    r: 1 },
  { id: 'hana',  name: '하나', type: 'heal',    r: 1 },
  { id: 'momo',  name: '모모', type: 'support', r: 1 },
  { id: 'yuri',  name: '유리', type: 'support', r: 1 },
];
ALLIES.forEach(A => { const T = ALLY_TYPES[A.type]; A.role = T.role; A.every = T.every; A.desc = T.desc; A.sprite = A.id; });
const RARITY = [null, { name: '일반', stars: '★', color: '#8a7a6a', mul: 1 }, { name: '희귀', stars: '★★', color: '#3a7ad0', mul: 1.3 }, { name: '전설', stars: '★★★', color: '#e0902a', mul: 1.7 }];
const PREFIX = {
  heal:    ['', '꽃잎', '축복의', '성녀', '천사'],
  magic:   ['', '견습', '원소의', '대마법사', '별의 현자'],
  shot:    ['', '날쌘', '매의 눈', '명사수', '유성'],
  warrior: ['', '용감한', '강철', '영웅', '전설의'],
  support: ['', '노래하는', '바람의', '수호', '여신의'],
};
const AWAKEN_COST = [0, 1, 2, 3, 5];          // ★n → ★n+1 에 필요한 조각
const STAR_MAX = 5;
const allyById = id => ALLIES.find(a => a.id === id);
const allyStar = id => (save.astar && save.astar[id]) || 1;
const allyName = id => { const A = allyById(id), p = PREFIX[A.type][allyStar(id) - 1]; return (p ? p + ' ' : '') + A.name; };
const allyPow = id => RARITY[allyById(id).r].mul * (1 + 0.25 * (allyStar(id) - 1));
function allyCost(lv) { return Math.floor(400 * Math.pow(1.45, lv)); }
// 배치 칸: 3칸, 챕터 2·3 보스를 깨면 1칸씩
const partyMax = () => 3 + (save.bosses && save.bosses[2] ? 1 : 0) + (save.bosses && save.bosses[3] ? 1 : 0);
const PARTY_MAX = 5;
function allyImg(id) { return allySprite(id, allyStar(id), allyById(id).type, mood); }
const ALLY_ICON = {};
function allyIcon(id, st) {
  st = st || allyStar(id);
  const k = id + st;
  return ALLY_ICON[k] || (ALLY_ICON[k] = allySprite(id, st, allyById(id).type, 0).toDataURL());
}
// 시너지: 같은 유형 1명 / 2명 이상
const SYNERGY = [
  { type: 'heal',    text: n => `치유형 ${n} · 초당 체력 회복 +최대 체력 ${n >= 2 ? 4 : 2}%` },
  { type: 'magic',   text: n => `마법형 ${n} · 공격력 +${n >= 2 ? 20 : 10}%` },
  { type: 'shot',    text: n => `사격형 ${n} · 치명타 확률 +${n >= 2 ? 10 : 5}%` },
  { type: 'warrior', text: n => `전사형 ${n} · 받는 피해 -${n >= 2 ? 10 : 5}%` },
  { type: 'support', text: n => `지원형 ${n} · 체력 +${n >= 2 ? 20 : 10}%` },
];
const typeCount = type => (save.party || []).filter(id => allyById(id) && allyById(id).type === type).length;
const partyHas = type => typeCount(type) > 0;
// 도감: 모은 동료 1명당 공격력·체력 +1%, 각성 별 1개당 +0.5%
function codexBonus() {
  const own = Object.keys(save.allies || {}).filter(allyById);
  return own.length + own.reduce((a, id) => a + (allyStar(id) - 1) * 0.5, 0);
}

// ── 동료 뽑기 ──
const AGACHA_COST = 50, AGACHA10_COST = 450, APITY = 80;
const AGACHA_W = [0, 72, 25, 3];
function allyRoll(minR = 1) {
  let r;
  if ((save.apity || 0) + 1 >= APITY) r = 3;
  else { const w = AGACHA_W.map((x, i) => i >= minR ? x : 0); let x = Math.random() * w.reduce((a, b) => a + b, 0); r = 0; while (x >= w[r]) { x -= w[r]; r++; } }
  save.apity = r === 3 ? 0 : (save.apity || 0) + 1;
  const pool = ALLIES.filter(A => A.r === r);
  return pool[Math.floor(Math.random() * pool.length)].id;
}
// 남은 각성에 조각이 더 필요한가
function needCopies(id) {
  let need = 0;
  for (let s = allyStar(id); s < STAR_MAX; s++) need += AWAKEN_COST[s];
  return need > (save.acopy[id] || 0);
}
function gainAlly(id) {
  if (!save.allies[id]) {
    save.allies[id] = 1; save.astar[id] = 1;
    if (save.party.length < partyMax()) save.party.push(id);
    return 'new';
  }
  if (!needCopies(id)) { save.dust += 10; return 'dust'; }
  save.acopy[id] = (save.acopy[id] || 0) + 1;
  return 'copy';
}
function doAllyGacha(n) {
  const cost = n === 10 ? AGACHA10_COST : AGACHA_COST;
  if (save.dust < cost) return alert('별가루 부족');
  save.dust -= cost;
  const got = [];
  for (let i = 0; i < n; i++) got.push(allyRoll());
  if (n === 10 && !got.some(id => allyById(id).r >= 2)) got[9] = allyRoll(2);
  const res = got.map(id => ({ id, kind: gainAlly(id) }));
  track('gacha', n);
  refreshStats(); writeSave(); updateHud();
  closeModal();
  $('gacha').hidden = false;
  $('gTitle').textContent = '동료 뽑기';
  $('gCards').innerHTML = res.map((x, i) => {
    const A = allyById(x.id), R = RARITY[A.r];
    return `<div class="gcard g${A.r * 2 - 1}" style="--d:${i * 0.18}s"><div class="gbeam"></div><img class="aimg" src="${allyIcon(x.id)}">
      <b style="color:${R.color}">${R.stars}</b><span>${allyName(x.id)}</span><small>${A.role} · ${x.kind === 'new' ? '<em class="newb">NEW!</em>' : x.kind === 'copy' ? '조각 +1' : '최대 각성 · 별가루 +10'}</small></div>`;
  }).join('');
  res.forEach((x, i) => setTimeout(() => Sound.reveal(allyById(x.id).r * 2 - 1), i * 180));
  $('gacha').classList.toggle('flash', res.some(x => allyById(x.id).r === 3));
}
function awaken(id) {
  const st = allyStar(id), need = AWAKEN_COST[st];
  if (st >= STAR_MAX || (save.acopy[id] || 0) < need) return;
  save.acopy[id] -= need;
  save.astar[id] = st + 1;
  refreshStats(); writeSave(); updateHud();
  closeModal();
  fanfare('각성!', `${allyName(id)} · ${'★'.repeat(st + 1)}`, Sound.levelUp);
  setTimeout(() => openAllies(id), 1900);
}

// ── 대사 ─────────────────────────────────────
const LINES = {
  battle: {
    1: ['풀잎 사이로 별빛이 새어 나와.', '이 근처에 별조각이 떨어진 게 분명해.', '슬라임들이 별조각을 삼킨 걸까?',
      '하늘의 별… 언제부터 금이 가 있었지?', '저 큰 나무, 별빛을 머금고 있어.', '꽃버섯이 반짝이는 건 별조각 때문인가?', '들벌들이 별빛에 홀린 것 같아.'],
    2: ['숲이 속삭이는 것 같아…', '저 고목 속에서 별빛이 새어 나와.', '숲 요정들, 별조각에 홀린 걸까?',
      '버섯이 파랗게 빛나… 별빛 때문인가?', '나무 정령들이 깨어난 건 별조각 탓이야.', '길을 잃지 않게 조심하자.'],
    3: ['모래바람이 눈을 따갑게 해.', '저 석상… 이마에 별빛을 품고 있어.', '선인장이 움직인다고?',
      '발밑 모래가 뜨거워…', '유적 어딘가에 별조각이 있을 거야.', '해가 지기 전에 서두르자.'],
  },
  bossWave: ['저 녀석이 대장이구나.', '덩치가 크네… 조심하자.'],
  low: ['조금만 더 버티자…!', '아직 쓰러질 순 없어!'],
  lobby: ['오늘은 어디까지 가 볼까.', '모닥불이 따뜻하다.', '땅에 박힌 별조각이 또 빛나.', '저 별, 꼭 다시 이어 붙일 거야.', '장비를 좀 더 챙겨 갈까?'],
  miru: ['다치면 바로 말해요!', '이 풀, 상처에 잘 듣는 약초예요.', '별조각이 따뜻해요… 신기하죠?'],
  serin: ['흥, 이 정도 마법은 기본이야.', '별이 왜 부서졌는지… 꼭 알아낼 거야.', '칭찬은 사양 안 해.'],
  kai: ['보물 냄새가 나는데?', '조준… 발사!', '이건 내 몫이다?', '사막은 내 앞마당이지.'],
};
const pick = arr => arr[Math.floor(Math.random() * arr.length)];

// 대화: who = hero | boss | miru | serin | kai | narr, {name}은 주인공 이름으로 바뀜
const TALK = {
  1: {
    intro: [
      { who: 'boss', text: '꾸르르… 반짝반짝한 별조각은 전부 이 몸 거다!' },
      { who: 'hero', text: '그건 하늘에서 떨어진 별이야. 돌려줘!' },
      { who: 'boss', text: '가져갈 수 있으면 가져가 봐라, 꼬마!' },
    ],
    again: [{ who: 'boss', text: '또 왔냐! 이번엔 안 진다, 꾸르르!' }],
    outro: [
      { who: 'boss', text: '꾸엑… 배 속의 별조각이… 빠져나간다…' },
      { who: 'narr', text: '들꽃 평원의 별조각을 되찾았다. 손끝에서 따뜻한 빛이 번진다.' },
      { who: 'miru', text: '괜찮아요? 다친 데는 없어요? 저는 마을 약초사 미르예요.' },
      { who: 'miru', text: '{name} 님, 별조각을 찾는 여행이라면… 저도 같이 갈게요!' },
      { who: 'narr', text: '미르가 동료가 되었다.' },
    ],
  },
  2: {
    intro: [
      { who: 'boss', text: '…누가 숲의 잠을 깨우느냐.' },
      { who: 'hero', text: '별조각을 찾으러 왔어. 이 숲 어딘가에 떨어졌을 거야.' },
      { who: 'boss', text: '별빛은 이제 이 숲의 것이다. 가져가려거든 뿌리를 넘어서라.' },
    ],
    again: [{ who: 'boss', text: '다시 왔구나, 작은 별지기여.' }],
    outro: [
      { who: 'boss', text: '…그래, 별빛은 하늘로 돌아가야겠지. 데려가거라.' },
      { who: 'narr', text: '속삭이는 숲의 별조각을 되찾았다. 숲이 조용히 숨을 고른다.' },
      { who: 'serin', text: '흥, 고목 할아버지를 이기다니 제법이네.' },
      { who: 'serin', text: '나는 세린. 이 숲의 마법사야. …별이 왜 부서졌는지, 나도 궁금하거든.' },
      { who: 'narr', text: '세린이 동료가 되었다.' },
    ],
  },
  3: {
    intro: [
      { who: 'boss', text: '스스스… 별빛은 모래 아래에서 영원히 잠들 거란다.' },
      { who: 'hero', text: '그 별조각, 돌려받으러 왔어!' },
      { who: 'boss', text: '내 독침을 견딜 수 있다면 말이지.' },
    ],
    again: [{ who: 'boss', text: '또 모래에 묻히러 왔느냐.' }],
    outro: [
      { who: 'boss', text: '크윽… 별빛이… 너무 뜨거워…' },
      { who: 'narr', text: '붉은 사막의 별조각을 되찾았다. 모래바람이 잠잠해진다.' },
      { who: 'kai', text: '와, 진짜 해치웠네! 나 카이. 이 유적은 원래 내 구역이었는데.' },
      { who: 'kai', text: '별조각 찾는 여행이라… 보물 냄새가 나는걸. 나도 끼워 줘!' },
      { who: 'narr', text: '카이가 동료가 되었다.' },
    ],
  },
};

// ── 챕터 ─────────────────────────────────────
// mech: 보스 특수 공격 (slam = 7초마다 강한 박치기, root = 8초마다 2초 동안 묶음, poison = 8초마다 독침, 4초 동안 독 피해)
const CHAPTERS = [
  { name: '들꽃 평원', theme: 'meadow',
    monsters: [{ from: 1, sprite: 'slime', name: '풀잎 슬라임', align: 'neutral', body: 'soft' }, { from: 8, sprite: 'mushroom', name: '꽃버섯', align: 'neutral', body: 'plant' }, { from: 15, sprite: 'bee', name: '들벌', align: 'neutral', body: 'flying' }],
    boss: { name: '거대 슬라임 왕', sprite: 'slime_king', mech: 'slam', every: 7, mechName: '몸통 박치기', ally: 'miru', align: 'neutral', body: 'soft' } },
  { name: '속삭이는 숲', theme: 'forest',
    monsters: [{ from: 1, sprite: 'wisp', name: '숲 요정', align: 'good', body: 'spirit' }, { from: 8, sprite: 'toadstool', name: '독버섯', align: 'neutral', body: 'plant' }, { from: 15, sprite: 'sprout', name: '나무 정령', align: 'good', body: 'plant' }],
    boss: { name: '고목 수호자', sprite: 'treant', mech: 'root', every: 8, mechName: '뿌리 감옥', ally: 'serin', align: 'good', body: 'plant' } },
  { name: '붉은 사막', theme: 'desert',
    monsters: [{ from: 1, sprite: 'cactus', name: '선인장 무사', align: 'neutral', body: 'plant' }, { from: 8, sprite: 'scorpion', name: '모래 전갈', align: 'neutral', body: 'armored' }, { from: 15, sprite: 'mummy', name: '붕대 유령', align: 'evil', body: 'spirit' }],
    boss: { name: '사막 전갈 여왕', sprite: 'scorpion_queen', mech: 'poison', every: 8, mechName: '독침', ally: 'kai', align: 'neutral', breaker: true, body: 'armored' } },
];
const MAX_STAGE = CHAPTERS.length * STAGES_PER;
const chOf = stage => Math.ceil(stage / STAGES_PER);                 // 1부터
const localOf = stage => stage - (chOf(stage) - 1) * STAGES_PER;      // 챕터 안의 번호 1~20
const stageLabel = stage => `${chOf(stage)}-${localOf(stage)}`;
const chapter = c => CHAPTERS[c - 1];
const bossBeaten = c => !!(save.bosses && save.bosses[c]);
const bossOpen = c => save.stage > c * STAGES_PER;                   // 그 챕터의 20스테이지를 깼다

// 지금 도전할 수 있는 가장 높은 스테이지 (다음 챕터는 앞 챕터 보스를 깨야 열림)
function topStage() {
  let top = Math.min(save.stage, MAX_STAGE);
  const c = chOf(top);
  if (c > 1 && !bossBeaten(c - 1)) top = (c - 1) * STAGES_PER;
  return top;
}
// 캠프가 있는 챕터 = 지금 진행 중인 챕터
const campChapter = () => chOf(topStage());

function monsterType(stage) { return chapter(chOf(stage)).monsters.filter(m => localOf(stage) >= m.from).pop(); }

// 몬스터 성장: 챕터 1은 빠르게(hpGrow), 챕터 2부터는 완만하게(hpGrow2)
function growth(stage, g1, g2) {
  const n = stage - 1, cap = STAGES_PER - 1;
  return Math.pow(g1, Math.min(n, cap)) * Math.pow(g2, Math.max(0, n - cap));
}

function monGold(stage) { return Math.ceil(BAL.monGold * Math.pow(BAL.goldGrow, stage - 1)); }

// 치명타 저항: 스테이지마다 1.5%씩. 내 치명타 확률에서 그만큼 빠진다
function critRes(stage) { return Math.min(60, (stage - 1) * 1.5); }

// ── 상성 ──
// 공격 속성: 베기(소년 주인공·검/도끼 전사) · 관통(사격형·창 전사) · 마법(소녀 주인공·마법형·그림자) · 화염(불 마법) · 신성(심판의 빛 특성)
// 화염은 마법의 한 종류라 '마법 약점'에도 통한다. 약점 ×1.5, 저항 ×0.7 (주인공 공격은 절반만 적용: ×1.25 / ×0.85)
const ELEM_NAME = { slash: '베기', pierce: '관통', magic: '마법', fire: '화염', holy: '신성' };
const BODY = {
  soft:    { name: '말랑', weak: ['slash'],         resist: ['pierce'] },
  plant:   { name: '식물', weak: ['fire'],          resist: ['pierce'] },
  flying:  { name: '비행', weak: ['pierce'],        resist: ['slash'] },
  armored: { name: '갑각', weak: ['magic'],         resist: ['slash', 'pierce'] },
  spirit:  { name: '영체', weak: ['holy', 'fire'],  resist: ['slash', 'pierce'] },
};
function elemMul(body, el) {
  const B = BODY[body];
  if (!B) return 1;
  if (B.weak.includes(el) || (el === 'fire' && B.weak.includes('magic'))) return 1.5;
  if (B.resist.includes(el)) return 0.7;
  return 1;
}
// 여러 속성이 섞인 공격은 가장 잘 통하는 속성으로
const affinity = (mon, els) => Math.max(...els.map(el => elemMul(mon.body, el)));
const heroEls = () => [save.gender === 'f' ? 'magic' : 'slash'].concat(stats.mods.smite > 0 ? ['holy'] : []);
function allyEl(id) {
  const A = allyById(id), w = ALLY_LOOKS[id].weapon;
  if (A.type === 'shot' || w === 'spear') return 'pierce';
  if (A.type === 'magic') return w === 'staff_fire' ? 'fire' : 'magic';
  return 'slash';
}

// 계열: 선·악·중립·타락 천사. 신성 특성은 악에게 강하고, 악 특성은 선·타락 천사에게 반발을 받는다
const ALIGN = { good: ['선', '#ffe27a'], evil: ['악', '#ff7aa8'], neutral: null, fallen: ['타락 천사', '#c8a0ff'] };
// 특수 몬스터: 치유사(동료 몬스터 회복), 저주술사=타락 천사(공격 속도·공격력 저주), 암살자=그림자 임프(뒤로 잠입해 동료를 노림),
// 강령술사=해골 강령술사(쓰러진 몬스터를 언데드로 되살림, 불탄 시체는 못 살림)
const ROLES = {
  healer:   { name: '치유사',   color: '#6fe39a', icon: '✚' },
  curser:   { name: '저주술사', color: '#c070ff', icon: '☾' },
  assassin: { name: '암살자',   color: '#ff5a6e', icon: '✖' },
  necro:    { name: '강령술사', color: '#7dff9a', icon: '☠' },
};
// 치유사는 그 챕터 몬스터에 붙고, 나머지는 고유한 몬스터로 나온다
const ELITE_LOOK = {
  curser:   { name: '저주의 타락 천사', sprite: 'fallen_angel', align: 'fallen', body: 'flying' },
  assassin: { name: '그림자 임프',      sprite: 'imp',          align: 'evil',   body: 'soft' },
  necro:    { name: '해골 강령술사',    sprite: 'necromancer',  align: 'evil',   body: 'spirit' },
};
function eliteRoles(stage) {
  const c = chOf(stage), l = localOf(stage), r = [];
  if (c > 1 || l >= 4) r.push('healer');
  if (c > 1 || l >= 8) r.push('assassin');
  if (c > 1 || l >= 12) r.push('curser');
  if (c > 1 || l >= 16) r.push('necro');
  return r;
}

function makeMonster(stage, boss) {
  const type = monsterType(stage);
  const hp = Math.floor(BAL.monHp * growth(stage, BAL.hpGrow, BAL.hpGrow2) * (boss ? BAL.bossHp : 1));
  return {
    ...type,
    name: boss ? '대장 ' + type.name : type.name,
    boss, hp, maxHp: hp,
    atk: Math.floor(BAL.monAtk * growth(stage, BAL.atkGrow, BAL.atkGrow2) * (boss ? BAL.bossAtk : 1)),
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
    chest: 0, chestAt: Date.now(), potions: 3, skills: { strike: 1 }, slots: ['strike', null, null], autoSkill: true, items: [], gear: {}, nextItem: 1, gearV2: true, shards: 0, bosses: {}, allies: {}, party: [], seenCh: 1, traits: {}, job: null, adv: null, traitsV: 2, astar: {}, acopy: {}, apity: 0, dust: 100, stats: {}, daily: null, mainIdx: 0, mainBase: 0, savedAt: Date.now() };
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
    if (s.shards === undefined) s.shards = 0;
    if (!s.bosses) { s.bosses = s.bossDone ? { 1: true } : {}; delete s.bossDone; }
    if (!s.allies) { s.allies = {}; s.party = []; }
    if (!s.astar) { s.astar = {}; s.acopy = {}; s.apity = 0; }
    s.party = s.party.filter(id => allyById(id));
    for (const [c, ok] of Object.entries(s.bosses)) {            // 보스를 깼으면 그 챕터 동료가 있어야 한다
      const id = CHAPTERS[c - 1] && CHAPTERS[c - 1].boss.ally;
      if (ok && id && !s.allies[id]) { s.allies[id] = 1; if (s.party.length < 3) s.party.push(id); }
    }
    if (!s.seenCh) s.seenCh = 1;
    if (!s.traits) { s.traits = {}; s.job = null; s.adv = null; }
    if (s.traitsV !== 2) {
      if (Object.keys(s.traits).length || s.job) s.traitReset = true;
      s.traits = {}; s.job = null; s.adv = null; s.traitsV = 2;
    }
    if (s.dust === undefined) { s.dust = 150; s.stats = {}; s.daily = null; s.mainIdx = 0; s.mainBase = 0; }   // 새 기능 기념 별가루
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
  Sound.coin();
  track('chests');
  coinBurst(Math.min(30, 10 + Math.floor(Math.log10(got + 1) * 3)));
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

const hero = { hp: 0, cd: 0, lunge: 0, hurt: 0, x: 70, atk: null };
let battle = null;      // { stage, wave, queue, earned, state, delay, potionCd }

function refreshStats() { stats = fullStats(save.lv); hero.x = 70 + Math.max(0, (save.party || []).length - 3) * 18; }

// ── 전투 ────────────────────────────────────
// stage: 도전할 스테이지 (깬 곳 또는 다음 곳)
function startBattle(stage) {
  stage = Math.max(1, Math.min(stage || save.stage, topStage()));
  SEALED = false;
  refreshStats();
  hero.hp = stats.maxHp;
  hero.cd = 0;
  floats = [];
  battle = { stage, wave: 0, queue: [], earned: 0, state: 'fight', delay: 0, potionCd: 0, skillCd: {}, cryT: 0, loot: [], allyCd: {}, fx: [], shield: 0, revived: false, poison: 0 };
  initAllyHp();
  spawnWave();
  if (chOf(stage) > (save.seenCh || 1)) {                          // 새 챕터에 처음 들어옴
    save.seenCh = chOf(stage);
    toast(`챕터 ${chOf(stage)} · ${chapter(chOf(stage)).name}`);
  }
  $('result').hidden = true;
  showScreen('battle');
  if (Math.random() < 0.6) say('hero', pick(LINES.battle[chOf(stage)]));
}

// 챕터 보스 (c = 챕터 번호)
let talkCh = 1;                    // 대화창의 'boss'가 어느 챕터 보스인지
function startBoss(c) {
  c = c || campChapter();
  if (!bossOpen(c)) return;
  const B = chapter(c).boss, last = c * STAGES_PER;
  SEALED = false;
  refreshStats();
  hero.hp = stats.maxHp;
  hero.cd = 0;
  floats = [];
  const k = makeMonster(last, true);
  Object.assign(k, {
    name: B.name, sprite: B.sprite, king: true, size: 64, x: 200, align: B.align, body: B.body,
    hp: Math.floor(BAL.monHp * growth(last, BAL.hpGrow, BAL.hpGrow2) * BAL.kingHp),
    atk: Math.floor(BAL.monAtk * growth(last, BAL.atkGrow, BAL.atkGrow2) * BAL.kingAtk),
    gold: monGold(last) * BAL.kingGold,
    critRes: critRes(last) + 5,
  });
  k.maxHp = k.hp;
  battle = { stage: last, ch: c, king: true, mech: B.mech, every: B.every, wave: 0, queue: [k], earned: 0, state: 'talk', delay: 0, potionCd: 0, skillCd: {}, cryT: 0, loot: [],
    timeLeft: BOSS_TIME, mechCd: B.every, mechWarn: 0, bound: 0, allyCd: {}, fx: [], shield: 0, revived: false, poison: 0 };
  initAllyHp();
  $('result').hidden = true;
  showScreen('battle');
  talkCh = c;
  giveShield();
  playDialog(bossBeaten(c) ? TALK[c].again : TALK[c].intro, () => { if (battle && battle.state === 'talk') battle.state = 'fight'; });
}

function spawnWave() {
  const n = WAVES[battle.wave];
  battle.queue = [];
  battle.corpses = [];
  for (let i = 0; i < n; i++) {
    const boss = battle.wave === WAVES.length - 1 && i === n - 1;
    const m = makeMonster(battle.stage, boss);
    m.x = 220 + i * 30;
    battle.queue.push(m);
  }
  // 특수 몬스터 (웨이브마다 최대 1마리)
  const roles = eliteRoles(battle.stage), plain = battle.queue.filter(m => !m.boss);
  if (roles.length && plain.length && Math.random() < 0.45) {
    const m = plain[Math.floor(Math.random() * plain.length)], role = roles[Math.floor(Math.random() * roles.length)];
    m.role = role; m.rcd = role === 'assassin' ? 2.2 : 3;
    m.hp = m.maxHp = Math.floor(m.hp * 1.5);
    if (role === 'healer') m.name = '치유사 ' + m.name;
    else Object.assign(m, ELITE_LOOK[role]);
  }
  if (battle.wave === WAVES.length - 1 && Math.random() < 0.5) say('hero', pick(LINES.bossWave));
  giveShield();
  updateBattleHud();
}

function giveShield() {
  const pct = stats.mods.shield;
  if (!pct) return;
  battle.shield = Math.floor(stats.maxHp * pct / 100);
  addFloat('보호막', hero.x + 16, GROUND - 56, '#9fd0ff');
}

function addFloat(text, x, y, color, big) { floats.push({ text, x, y, color, big, t: 0 }); }

// 주인공이 피해를 받는다. 쓰러지면 true (부활하면 false)
function takeHit(raw, color, big, noDodge) {
  const m = stats.mods;
  if (!noDodge && Math.random() * 100 < m.dodge) { addFloat('회피', hero.x + 16, GROUND - 40, '#9fd0ff'); return false; }
  let dmg = Math.floor(raw * (1 - m.guard / 100));
  if (battle.shield > 0) {
    const ab = Math.min(battle.shield, dmg);
    battle.shield -= ab; dmg -= ab;
    if (ab) addFloat('(' + fmt(ab) + ')', hero.x + 6, GROUND - 46, '#9fd0ff');
  }
  hero.hp -= dmg;
  hero.hurt = 1;
  if (dmg) addFloat('-' + fmt(dmg), hero.x + 16, GROUND - 38 - (big ? 8 : 0), color || '#ff6b7a', big);
  if (!battle.lowSaid && hero.hp > 0 && hero.hp < stats.maxHp * 0.3) { battle.lowSaid = true; say('hero', pick(LINES.low)); }
  if (hero.hp > 0) return false;
  if (m.revive && !battle.revived) {
    battle.revived = true;
    hero.hp = Math.floor(stats.maxHp * 0.3);
    addFloat('부활!', hero.x + 16, GROUND - 62, '#ffe27a', true);
    say('hero', '아직… 끝나지 않았어!', 2);
    return false;
  }
  hero.hp = 0;
  return true;
}

function notify(text, color) {
  if (!$('modal').hidden) {
    let el = $('pageToast');
    if (!el) { el = document.createElement('div'); el.id = 'pageToast'; document.querySelector('.mbox').appendChild(el); }
    el.textContent = text; el.style.color = color || '#fff8e6'; el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
    return;
  }
  floatsLobby.push({ text, t: 0, x: 160, y: 60, color: color || '#ffffff', big: true });
}

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
  if (battle) {
    battle.fx = battle.fx.filter(f => (f.t += dt) < (f.dur || 0.3));
    for (const id in battle.anim || {}) if ((battle.anim[id].t += dt) > battle.anim[id].dur) delete battle.anim[id];
    for (const a of Object.values(battle.ahp || {})) a.hurt = Math.max(0, a.hurt - dt * 4);
  }
  hero.lunge = Math.max(0, hero.lunge - dt * 4);
  if (hero.atk && (hero.atk.t += dt) > hero.atk.dur) hero.atk = null;
  hero.hurt = Math.max(0, hero.hurt - dt * 4);
  if (!battle || battle.state !== 'fight') return;

  battle.potionCd = Math.max(0, battle.potionCd - dt);
  hero.hp = Math.min(stats.maxHp, hero.hp + stats.regen * dt);
  for (const a of Object.values(battle.ahp || {})) if (a.hp > 0) a.hp = Math.min(a.max, a.hp + a.max * stats.regen / stats.maxHp * dt);
  battle.curse = Math.max(0, (battle.curse || 0) - dt);
  if (battle.cleanse && (battle.cleanse.t -= dt) <= 0) {
    const id = battle.cleanse.id;
    battle.cleanse = null;
    if (!allyDown(id) && battle.curse > 0) {
      battle.curse = 0;
      addFloat(allyName(id) + ' 정화!', hero.x + 16, GROUND - 62, '#9ef0b0', true);
      battle.fx.push({ kind: 'heal', i: save.party.indexOf(id), x: hero.x + 16, t: 0, dur: 0.6 });
    }
  }
  if (battle.seal > 0 && (battle.seal -= dt) <= 0) {
    SEALED = false; refreshStats();
    addFloat('봉인 해제', hero.x + 16, GROUND - 62, '#ffe27a', true);
  }
  updateSkills(dt);

  // 웨이브 사이 쉬는 시간
  if (battle.delay > 0) {
    battle.delay -= dt;
    camX += 170 * dt;                       // 다음 웨이브를 향해 걸어간다 (배경이 겹마다 다른 속도로 흐름)
    if (battle.delay <= 0) spawnWave();
    return;
  }

  // 보스: 제한 시간과 특수 공격
  if (battle.king) {
    battle.timeLeft -= dt;
    battle.bound = Math.max(0, battle.bound - dt);
    if (battle.timeLeft <= 0) { battle.timeLeft = 0; return endBattle('timeout'); }
    const k = battle.queue[0];
    if (k && k.dead <= 0 && k.x <= hero.x + 40) {
      battle.mechCd -= dt;
      if (battle.mechCd <= MECH_WARN && !battle.mechWarn) {
        battle.mechWarn = 1;
        addFloat('!', k.x + 32, GROUND - 74, '#ff5a6e', true);
        say('hero', { root: '발밑이…!', poison: '꼬리를 치켜든다…!' }[battle.mech] || '온다…!', 1.4);
      }
      if (battle.mechCd <= 0) {
        const mult = { root: 1.5, poison: 1.2 }[battle.mech] || 3;
        shake = battle.mech === 'slam' ? 0.45 : 0.25;
        if (battle.mech === 'root') { battle.bound = ROOT_TIME; addFloat('묶임!', hero.x + 16, GROUND - 60, '#c8a060', true); }
        if (battle.mech === 'poison') { battle.poison = 4 * (1 - stats.mods.purify / 3); battle.poisonDps = k.atk * 0.5; addFloat('독!', hero.x + 16, GROUND - 60, '#b070e0', true); }
        battle.mechCd = battle.every;
        battle.mechWarn = 0;
        if (battle.mech === 'slam') for (const id in battle.ahp) hurtAlly(id, battle.ahp[id].max * 0.25);
        const tw = battle.mech === 'slam' ? tauntOn(k) : null;
        if (tw) { hurtAlly(tw, k.atk * mult * (1 - tauntGuard(tw))); addFloat(allyName(tw) + ' 막아냄!', hero.x - 10, GROUND - 64, '#ffb08a', true); }
        else if (takeHit(Math.floor(k.atk * mult), '#ff3a4a', true, true)) return endBattle('lost');
      }
    }
    // 룰 브레이커: 챕터 3 보스가 체력 절반 아래로 폭주하면 14초마다 6초 동안 특성·전직 봉인
    if (k && k.dead <= 0 && chapter(battle.ch || 1).boss.breaker && !battle.dungeon && k.hp < k.maxHp * 0.5) {
      if (!battle.phase2) { battle.phase2 = true; battle.rbCd = 1.5; shake = 0.4; addFloat('폭주!', k.x + 32, GROUND - 80, '#ff5a6e', true); say('boss', '감히… 내 사막의 법칙을 따르거라!', 2.5); }
      if ((battle.rbCd -= dt) <= 0) {
        battle.rbCd = 14;
        const singer = (save.party || []).find(id => allyById(id).type === 'support' && !allyDown(id));
        battle.seal = singer ? 3 : 6;
        if (singer) addFloat(allyName(singer) + '의 노래 · 봉인 약화', hero.x - 10, GROUND - 82, '#9fe0ff', true);
        SEALED = true; refreshStats(); hero.hp = Math.min(hero.hp, stats.maxHp);
        shake = 0.35;
        addFloat('룰 브레이커! 특성 봉인', hero.x + 16, GROUND - 70, '#ff5a6e', true);
      }
    }
    // 독 피해 (초마다)
    if (battle.poison > 0) {
      battle.poison -= dt;
      battle.poisonTick = (battle.poisonTick || 0) + dt;
      if (battle.poisonTick >= 1) {
        battle.poisonTick -= 1;
        if (takeHit(battle.poisonDps, '#b070e0', false, true)) return endBattle('lost');
      }
    }
  }

  const q = battle.queue;
  // 쓰러진 몬스터 치우기
  for (const m of q) if (m.dead > 0) m.dead -= dt;
  while (q.length && q[0].dead < 0) q.shift();
  const sn = battle.sneak;
  if (sn && sn.dead > 0 && (sn.dead -= dt) <= 0) battle.sneak = null;
  if (!q.length && !battle.sneak) return waveCleared();
  updateMonsterRoles(dt);
  // 상태 이상 (기절·최면·둔화·화상)
  for (const m of q.concat(battle.sneak ? [battle.sneak] : [])) {
    m.stun = Math.max(0, (m.stun || 0) - dt);
    m.charm = Math.max(0, (m.charm || 0) - dt);
    m.slow = Math.max(0, (m.slow || 0) - dt);
    m.kb = Math.max(0, (m.kb || 0) - dt * 40);
    if (m.taunt) m.taunt.t -= dt;
    if (m.burn > 0 && m.dead <= 0) {
      m.burn -= dt;
      if ((m.burnT = (m.burnT || 0) + dt) >= 0.5) { m.burnT -= 0.5; hit(m, m.burnMult, '#ff8a3a', 'dot', ['fire']); }
    }
  }
  // 암살자: 뒤에서 동료(또는 주인공)를 공격
  if (battle.sneak && battle.sneak.dead <= 0) {
    const s = battle.sneak;
    s.hurt = Math.max(0, s.hurt - dt * 4);
    if (s.target !== 'hero' && allyDown(s.target)) { s.target = sneakTarget(); s.x = s.target === 'hero' ? hero.x - 30 : allyX(save.party.indexOf(s.target)) - 22; }
    if (!isWarrior(s.target)) {
      const w = readyTaunter();
      if (w) {
        doTaunt(w, s);
        s.target = w; s.x = allyX(save.party.indexOf(w)) - 22;
        addFloat('뒤를 지킨다!', s.x + 16, GROUND - 60, '#ffb08a', true);
      }
    }
    if (!(s.stun > 0)) {
      s.cd -= dt * (s.slow > 0 ? 0.6 : 1);
      if (s.cd <= 0) {
        s.cd += 1 / s.aspd;
        s.lunge = 1;
        const dmg = s.atk * 1.5 * (1 - stats.mods.weak / 100);
        if (s.target === 'hero') { if (takeHit(dmg)) return endBattle('lost'); }
        else if (isWarrior(s.target)) hurtAlly(s.target, dmg * 0.5 * (1 - tauntGuard(s.target)));     // 전사형은 암살자에 강함
        else hurtAlly(s.target, dmg * (allyById(s.target).type === 'heal' ? 2 : 1));                  // 치유형은 암살자의 먹잇감
      }
    }
    s.lunge = Math.max(0, (s.lunge || 0) - dt * 4);
  }

  // 앞 몬스터는 주인공 앞까지, 뒤 몬스터는 줄을 선다
  const meet = hero.x + 40;
  q.forEach((m, i) => {
    m.hurt = Math.max(0, m.hurt - dt * 4);
    const slot = meet + i * 30;
    if (m.x > slot) m.x = Math.max(slot, m.x - 100 * dt);
  });
  const mon = q[0];
  const sneakOn = battle.sneak && battle.sneak.dead <= 0;
  const front = mon && mon.dead <= 0 && mon.x <= meet;
  if (!front && !sneakOn) return;

  updateAllies(dt, q);
  updateShadows(dt, q);
  if (stats.mods.hypno && front) {                      // 최면술사
    battle.hypCd = (battle.hypCd ?? 3) - dt;
    if (battle.hypCd <= 0) {
      battle.hypCd = 8;
      const others = q.filter(m => m !== mon && m.dead <= 0);
      if (!mon.king && others.length) { mon.charm = 4; addFloat('최면!', mon.x + 16, GROUND - 56, '#ff9ae0', true); }
      else { mon.stun = 1.5; addFloat('최면… 멍', mon.x + (mon.size || 32) / 2, GROUND - (mon.size || 32) - 14, '#ff9ae0', true); }
      battle.fx.push({ kind: 'hypno', x: mon.x + (mon.size || 32) / 2, t: 0, dur: 0.6 });
    }
  }

  // 주인공 공격 (뿌리에 묶여 있으면 못 함). 암살자가 있으면 먼저 처리
  const tgt = sneakOn ? battle.sneak : mon;
  hero.cd -= dt;
  if (hero.cd <= 0 && !battle.bound) {
    const m = stats.mods;
    const spd = (battle.cryT > 0 ? 1 + battle.cryPower : 1) * (battle.curse > 0 ? 0.5 : 1) * (tgt.align === 'evil' ? 1 + m.smiteSpd / 100 : 1);
    hero.cd += 1 / (stats.aspd * spd);
    hero.lunge = 1;
    hero.back = sneakOn;
    hero.atk = { t: 0, dur: Math.min(0.3, 0.9 / (stats.aspd * spd)), kind: 'basic' };
    if (save.gender === 'f') battle.fx.push({ kind: 'star', from: hero.x + (sneakOn ? 10 : 22), x: tgt.x + (tgt.size || 32) / 2, t: 0, dur: 0.26 });
    else battle.fx.push({ kind: 'hslash', x: tgt.x + (tgt.size || 32) / 2, t: 0.04, dur: 0.24, dash: true, dir: sneakOn ? -1 : 1 });
    const killed = hit(tgt, 1, null, 'basic', heroEls());
    battle.hits = (battle.hits || 0) + 1;
    if (m.wave) { const t2 = q.find(x => x !== tgt && x.dead <= 0); if (t2) { battle.fx.push({ kind: 'wave', from: hero.x + 24, x: t2.x + (t2.size || 32) / 2, t: 0, dur: 0.3 }); hit(t2, m.wave / 100, '#bfe8ff', 'ally', ['slash']); } }
    if (m.color && battle.hits % m.colorEvery === 0) castColor(q);
    if (killed) return;
    if (Math.random() * 100 < m.double && hit(tgt, 1, '#ffc0a0', 'basic', heroEls())) return;
  }

  // 몬스터 공격 (기절이면 못 함, 최면이면 자기 편을 공격, 둔화면 느리게)
  if (!front || mon.stun > 0) return;
  mon.cd -= dt * (mon.slow > 0 ? 0.6 : 1);
  if (mon.cd <= 0) {
    mon.cd += 1 / mon.aspd;
    if (mon.charm > 0) {
      const o = q.find(x => x !== mon && x.dead <= 0);
      if (o) {
        const d = Math.floor(o.maxHp * 0.2);
        o.hp -= d; o.hurt = 1; o.kb = 6;
        addFloat(fmt(d), o.x + 16, GROUND - 40, '#ff9ae0');
        if (o.hp <= 0) { o.hp = 1; hit(o, 0.001, '#ff9ae0', 'dot'); }
      }
      return;
    }
    const tw = tauntOn(mon);
    if (tw) { hurtAlly(tw, mon.atk * (1 - stats.mods.weak / 100) * (1 - tauntGuard(tw))); battle.anim[tw] = battle.anim[tw] || { t: 0, dur: 0.25 }; return; }
    if (takeHit(mon.atk * (1 - stats.mods.weak / 100))) endBattle('lost');
  }
}

function updateMonsterRoles(dt) {
  const q = battle.queue;
  for (const m of q) {
    if (!m.role || m.dead > 0 || m.x > 300 || m.stun > 0 || m.charm > 0) continue;
    if ((m.rcd -= dt) > 0) continue;
    if (m.role === 'healer') {
      m.rcd = 5;
      let any = false;
      q.forEach(o => {
        if (o.dead > 0 || o.hp >= o.maxHp) return;
        const h = Math.floor(o.maxHp * 0.12);
        o.hp = Math.min(o.maxHp, o.hp + h); any = true;
        addFloat('+' + fmt(h), o.x + (o.size || 32) / 2, GROUND - 44, '#6fe39a');
      });
      if (any) battle.fx.push({ kind: 'mheal', x: m.x + 16, t: 0, dur: 0.7 });
      else m.rcd = 1;
    } else if (m.role === 'curser') {
      m.rcd = 8;
      battle.fx.push({ kind: 'curse', from: m.x + 16, x: hero.x + 16, t: 0, dur: 0.6 });
      const pur = stats.mods.purify;
      if (pur >= 3) { addFloat('정화! 저주 무효', hero.x + 16, GROUND - 62, '#ffe27a', true); continue; }
      battle.curse = 4 * (1 - pur / 3);
      addFloat('저주! 공격 속도 -50%', hero.x + 16, GROUND - 62, '#c070ff', true);
      const healer = (save.party || []).find(id => allyById(id).type === 'heal' && !allyDown(id));
      if (healer) battle.cleanse = { id: healer, t: 0.8 };      // 치유형 동료가 저주를 풀어 준다
    } else if (m.role === 'necro') {
      const body = (battle.corpses || []).shift();
      if (!body || (m.raised || 0) >= 2) { m.rcd = 1.5; continue; }
      m.rcd = 7;
      m.raised = (m.raised || 0) + 1;
      const hp = Math.floor(body.maxHp * 0.5);
      q.push({ ...body, name: '되살아난 ' + body.name, hp, maxHp: hp, dead: 0, hurt: 0, x: 300, cd: 1, undead: true, noDrop: true,
        align: 'evil', body: 'spirit', gold: 0, role: null, taunt: null, stun: 0, charm: 0, slow: 0, burn: 0, kb: 0, weakSaid: false, sniped: false });
      battle.fx.push({ kind: 'raise', x: m.x + 16, t: 0, dur: 0.8 });
      battle.fx.push({ kind: 'raise', x: 300 + 16, t: 0, dur: 0.8 });
      addFloat('일어나라…!', m.x + 16, GROUND - 58, '#7dff9a', true);
      break;
    } else if (m.role === 'assassin' && !battle.sneak) {
      q.splice(q.indexOf(m), 1);
      battle.sneak = m;
      m.cd = 0.9;
      m.target = sneakTarget();
      battle.fx.push({ kind: 'smoke', x: m.x + 16, t: 0, dur: 0.6 });
      m.x = m.target === 'hero' ? hero.x - 30 : allyX(save.party.indexOf(m.target)) - 22;
      battle.fx.push({ kind: 'smoke', x: m.x + 16, t: 0, dur: 0.6 });
      addFloat('암살자 잠입!', m.x + 16, GROUND - 52, '#ff5a6e', true);
      say('hero', m.target === 'hero' ? '뒤다!' : '뒤를 노린다! ' + allyName(m.target) + ' 조심해!', 2);
      break;
    }
  }
}

function spawnShadow() {
  const m = stats.mods;
  battle.shadows = battle.shadows || [];
  if (battle.shadows.length >= m.shadow) return;
  battle.shadows.push({ t: m.shadowPerm ? Infinity : 10, cd: 0.6, rise: 0, k: battle.shadows.length, act: 0 });
  addFloat('그림자 병사!', hero.x + 30, GROUND - 50, '#b48cff');
}
function updateShadows(dt, q) {
  if (!battle.shadows || !battle.shadows.length) return;
  battle.shadows = battle.shadows.filter(s => (s.t -= dt) > 0);
  battle.shadows.forEach((s, k) => {
    s.k = k;
    s.rise = Math.min(1, s.rise + dt * 2);
    s.act = Math.max(0, s.act - dt * 4);
    if ((s.cd -= dt) > 0) return;
    const t = q.find(m => m.dead <= 0 && m.x <= hero.x + 90);
    if (!t) return;
    s.cd = 1; s.act = 1;
    battle.fx.push({ kind: 'shadowhit', x: t.x + (t.size || 32) / 2, t: 0, dur: 0.25 });
    hit(t, 0.3, '#b48cff', 'ally', ['magic']);
  });
}

const ELEM = [{ id: 'fire', color: '#ff7a3a', name: '화염' }, { id: 'ice', color: '#7ad0ff', name: '얼음' }, { id: 'bolt', color: '#ffe94a', name: '번개' }];
function castColor(q) {
  const m = stats.mods, alive = q.filter(x => x.dead <= 0);
  if (!alive.length) return;
  battle.elem = ((battle.elem ?? -1) + 1) % 3;
  const e = ELEM[battle.elem], mult = m.color / 100;
  const px = t => t.x + (t.size || 32) / 2;
  if (e.id === 'bolt') {
    alive.slice(0, 3).forEach(t => { battle.fx.push({ kind: 'elem', e: e.id, color: e.color, x: px(t), t: 0, dur: 0.35 }); hit(t, mult * 0.7, e.color, 'magic', ['magic']); });
  } else {
    const t = alive[0];
    battle.fx.push({ kind: 'elem', e: e.id, color: e.color, from: hero.x + 24, x: px(t), t: 0, dur: 0.35 });
    if (e.id === 'fire') { t.burn = 3; t.burnMult = mult * 0.15; } else t.slow = 3;
    hit(t, mult, e.color, 'magic', [e.id === 'fire' ? 'fire' : 'magic']);
  }
}

// 적 하나를 때린다. 쓰러뜨리면 true
// kind: 'basic'(일반 공격) | 'skill' | 'ally'
function hit(mon, mult, color, kind, els) {
  if (mon.dead > 0) return false;
  const m = stats.mods;
  let aff = 1;
  if (els && els.length) {
    aff = affinity(mon, els);
    if (kind === 'basic' || kind === 'skill') aff = 1 + (aff - 1) * 0.5;
    mult *= aff;
  }
  if (kind === 'skill') mult *= 1 + m.skill / 100;
  if (mon.align === 'evil') mult *= 1 + m.smite / 100;
  const repel = m.dark && (mon.align === 'good' || mon.align === 'fallen');
  if (m.dark && !repel) mult *= 1 + m.dark / 100;
  if (m.mark && mon === battle.queue[0]) mult *= 1 + m.mark / 100;
  if (m.soul && battle.souls) mult *= 1 + battle.souls * m.soul / 100;
  if (battle.curse > 0) mult *= 0.8;
  const crit = Math.random() * 100 < stats.crit - Math.max(0, mon.critRes - stats.pierce);
  const dmg = Math.floor(stats.atk * mult * (crit ? stats.critDmg : 1) * (0.9 + Math.random() * 0.2));
  if (aff < 0.99 && !crit) color = '#b8b8c0';
  if (m.drain && kind !== 'ally') hero.hp = Math.min(stats.maxHp, hero.hp + dmg * m.drain / 100);
  mon.hp -= dmg;
  if (battle.dungeon) battle.dealt += dmg;
  mon.hurt = 1;
  if (kind !== 'dot') {
    mon.kb = Math.min(mon.king ? 2 : 10, (mon.kb || 0) + (crit ? 5 : 3));
    battle.fx.push({ kind: 'spark', x: mon.x + (mon.size || 32) / 2, y: GROUND - (mon.size || 32) / 2, color: crit ? '#ffd25e' : color || '#ffffff', big: crit, t: 0, dur: 0.25 });
  }
  if (repel && !m.noReflect && kind === 'basic') {
    const back = Math.floor(dmg * m.reflect / 100);
    if (back > 0) { hero.hp = Math.max(1, hero.hp - back); addFloat('반발 -' + fmt(back), hero.x + 16, GROUND - 44, '#ff7aa8'); }
  }
  if (kind === 'basic' && m.fear && !mon.king && mon.hp > 0 && Math.random() * 100 < m.fear) { mon.stun = 1.5; addFloat('공포!', mon.x + 16, GROUND - 56, '#c070ff'); }
  if (m.exec && !mon.king && !battle.dungeon && mon.hp > 0 && mon.hp < mon.maxHp * 0.15) { mon.hp = 0; addFloat('처형!', mon.x + 16, GROUND - 60, '#ff5a6e', true); }
  const mid = (mon.size || 32) / 2;
  if (aff > 1 && !mon.weakSaid) { mon.weakSaid = true; addFloat('약점!', mon.x + mid, GROUND - 58 - (mon.size ? 24 : 0), '#7dffa0', true); }
  addFloat(fmt(dmg) + (crit ? '!' : '') + (aff > 1.01 ? '▲' : aff < 0.99 ? '▼' : ''), mon.x + mid, GROUND - 36 - (mult > 1 ? 8 : 0) - (mon.size ? 24 : 0), crit ? '#ffd25e' : color || '#ffffff', crit || mult > 1);
  if (mon.hp > 0) return false;
  mon.hp = 0;
  mon.dead = 0.5;
  if (m.soul) battle.souls = Math.min(30, (battle.souls || 0) + 1);
  const burned = mon.burn > 0 || (els && els.includes('fire'));
  if (!mon.king && !mon.boss && !mon.undead && !mon.role && !battle.dungeon && !burned) (battle.corpses = battle.corpses || []).push(mon);
  if (m.shadow) spawnShadow();
  const gold = Math.floor(mon.gold * (1 + m.gold / 100));
  save.gold += gold;              // 얻은 골드는 바로 저장 (져도 남는다)
  battle.earned += gold;
  if (gold > 0) addFloat('+' + fmt(gold) + 'G', mon.x + 16, GROUND - 52, '#ffd25e');
  track('kills');
  if (!mon.noDrop && (mon.boss || Math.random() < DROP_CHANCE)) dropItem(mon);
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

// ── 전투 중 동료 ──
function updateAllies(dt, q) {
  const sn = battle.sneak && battle.sneak.dead <= 0 ? battle.sneak : null;
  const cx = t => t.x + (t.size || 32) / 2;
  (save.party || []).forEach((id, i) => {
    const A = allyById(id), lv = save.allies[id] || 1;
    if (!A || !A.every || allyDown(id)) return;
    const p = allyPow(id), big = allyStar(id) >= 3;
    if (A.type === 'warrior') {
      battle.tauntCd[id] = (battle.tauntCd[id] ?? 2) - dt;
      const front = q.find(m => m.dead <= 0 && m.x <= hero.x + 45);
      if (battle.tauntCd[id] <= 0 && front && !tauntOn(front) && !(sn && !isWarrior(sn.target))) {
        front.taunt = { id, t: TAUNT_TIME };
        doTaunt(id, front);
      }
    }
    battle.allyCd[id] = (battle.allyCd[id] ?? A.every * 0.5) - dt * (battle.curse > 0 ? 0.5 : 1);
    if (battle.allyCd[id] > 0) return;
    if (A.type === 'heal') {
      // 체력 비율이 가장 낮은 아군(주인공 또는 동료)을 치유
      let who = 'hero', low = hero.hp / stats.maxHp;
      for (const [aid, a] of Object.entries(battle.ahp || {})) if (a.hp > 0 && a.hp / a.max < low) { low = a.hp / a.max; who = aid; }
      if (low >= 0.95) return;
      const k = (6 + lv) * p / 100 * (1 + stats.mods.healAlly / 100) * (1 + stats.mods.healMul / 100);
      const tx = who === 'hero' ? hero.x + 16 : allyX(save.party.indexOf(who)) + 16;
      if (who === 'hero') { const h = Math.floor(stats.maxHp * k); hero.hp = Math.min(stats.maxHp, hero.hp + h); addFloat('+' + fmt(h), tx, GROUND - 50, '#6fe39a'); }
      else { const a = battle.ahp[who], h = Math.floor(a.max * k * 1.5); a.hp = Math.min(a.max, a.hp + h); addFloat('+' + fmt(h), tx, GROUND - 46, '#6fe39a'); }
      battle.fx.push({ kind: 'heal', i, x: tx, big, t: 0, dur: 0.6 });
    } else if (A.type === 'magic') {
      const targets = q.filter(m => m.dead <= 0 && m.x <= hero.x + 120).slice(0, 3);
      if (sn) targets.unshift(sn);
      if (!targets.length) return;
      targets.slice(0, 3).forEach(m => { hit(m, (50 + lv * 10) * p / 100 * (1 + stats.mods.magicAlly / 100), '#d6b0ff', 'ally', [allyEl(id)]); battle.fx.push({ kind: 'bolt', i, x: cx(m), color: allyColor(id), big, t: 0, dur: 0.4 }); });
    } else if (A.type === 'shot') {
      const healerMon = q.find(m => m.dead <= 0 && m.role === 'healer' && m.x <= hero.x + 160);
      const t = sn || healerMon || q.find(m => m.dead <= 0 && m.x <= hero.x + 160);
      if (!t) return;
      if (t === healerMon && !t.sniped) { t.sniped = true; addFloat('치유사 저격!', t.x + 16, GROUND - 62, '#ffd27a', true); }
      hit(t, (100 + lv * 20) * p / 100 * (1 + stats.mods.shotAlly / 100) * (t.role === 'healer' ? 1.5 : 1), '#ffd27a', 'ally', [allyEl(id)]);
      for (let k = 0; k < (big ? 3 : 1); k++) battle.fx.push({ kind: 'arrow', i, x: cx(t), off: (k - 1) * 4 * (big ? 1 : 0), t: -k * 0.05, dur: 0.3, color: allyColor(id) });
    } else if (A.type === 'warrior') {
      const t = sn || q.find(m => m.dead <= 0 && m.x <= hero.x + 70);
      if (!t) return;
      hit(t, (120 + lv * 20) * p / 100 * (t.role === 'assassin' ? 1.5 : 1), '#ff9a7a', 'ally', [allyEl(id)]);
      battle.fx.push({ kind: 'slash', i, x: cx(t), big, color: allyColor(id), t: 0, dur: 0.3 });
    }
    battle.anim[id] = { t: 0, dur: 0.4 };
    battle.allyCd[id] = A.every;
  });
}

function allyX(i) { return hero.x - 24 - i * 18; }

// 동료 체력: 주인공 체력의 45~85% (각성할수록 단단)
function allyMaxHp(id) { return Math.floor(stats.maxHp * (0.35 + 0.1 * allyStar(id)) * (1 + stats.mods.allyHp / 100)); }
function initAllyHp() {
  battle.ahp = {}; battle.anim = {}; battle.tauntCd = {};
  for (const id of save.party || []) { const mx = allyMaxHp(id); battle.ahp[id] = { hp: mx, max: mx, hurt: 0 }; }
}
const allyDown = id => !battle.ahp || !battle.ahp[id] || battle.ahp[id].hp <= 0;
function hurtAlly(id, raw) {
  const a = battle.ahp && battle.ahp[id];
  if (!a || a.hp <= 0) return;
  const dmg = Math.floor(raw * (1 - stats.mods.guard / 100));
  a.hp -= dmg; a.hurt = 1;
  const x = allyX(save.party.indexOf(id)) + 16;
  addFloat('-' + fmt(dmg), x, GROUND - 40, '#ff6b7a');
  if (a.hp <= 0) { a.hp = 0; addFloat(allyName(id) + ' 쓰러짐', x, GROUND - 52, '#ff9aa0', true); }
}
// 전사형 도발: 10초마다 맨 앞 적의 공격을 4초 동안 자기에게 돌린다(받는 피해 감소).
// 암살자가 뒤로 숨어들면 도발이 준비된 전사가 곧바로 막아선다.
const TAUNT_CD = 10, TAUNT_TIME = 4;
const tauntGuard = id => (ALLY_LOOKS[id].weapon === 'shield' ? 0.6 : 0.4) + (allyStar(id) >= 3 ? 0.1 : 0);
const isWarrior = id => id !== 'hero' && allyById(id) && allyById(id).type === 'warrior';
const readyTaunter = () => (save.party || []).find(id => isWarrior(id) && !allyDown(id) && (battle.tauntCd[id] || 0) <= 0);
const tauntOn = m => m && m.taunt && m.taunt.t > 0 && !allyDown(m.taunt.id) ? m.taunt.id : null;
function doTaunt(id, mon) {
  battle.tauntCd[id] = TAUNT_CD;
  battle.anim[id] = { t: 0, dur: 0.4 };
  const x = allyX(save.party.indexOf(id)) + 16;
  addFloat('도발!', x, GROUND - 52, '#ff7a5a', true);
  battle.fx.push({ kind: 'taunt', from: x, x: mon.x + (mon.size || 32) / 2, t: 0, dur: 0.45 });
}
// 암살자가 노릴 대상: 치유형 → 지원형 → 맨 뒤 동료 → 주인공
function sneakTarget() {
  const alive = (save.party || []).filter(id => !allyDown(id));
  return alive.find(id => allyById(id).type === 'heal') || alive.find(id => allyById(id).type === 'support') || alive[alive.length - 1] || 'hero';
}
// 동료 공격 모션 종류 (무기별)
const MOTION = { spear: 'thrust', greatsword: 'chop', axe: 'chop', sword: 'dash', shield: 'dash', bow: 'shoot', crossbow: 'shoot', sling: 'shoot',
  staff_leaf: 'cast', staff_orb: 'cast', staff_fire: 'cast', staff_star: 'cast', book: 'cast', lute: 'play', tambourine: 'play', flag: 'play', bandage: 'play' };
const allyColor = id => 'rgb(' + ALLY_GLOW[allyById(id).type] + ')';


// ── 전투 중 스킬 ──
function castSkill(slot, auto) {
  const id = save.slots[slot];
  if (!id || !battle || battle.state !== 'fight' || battle.delay > 0) return false;
  const sk = skillById(id), lv = save.skills[id];
  if (!lv || (battle.skillCd[id] || 0) > 0) return false;
  const q = battle.queue.filter(m => m.dead <= 0);
  const inRange = q.length && q[0].x <= hero.x + 40;
  const p = skillPower(sk, lv);
  const girl = save.gender === 'f', mx = m => m.x + (m.size || 32) / 2;
  if (id === 'strike') {
    if (!inRange) return false;
    hero.lunge = 1.5;
    hero.back = false;
    hero.atk = { t: 0, dur: 0.42, kind: 'strike' };
    battle.fx.push(girl ? { kind: 'star', from: hero.x + 22, x: mx(q[0]), big: true, t: 0, dur: 0.34 } : { kind: 'hslash', x: mx(q[0]), big: true, dash: true, t: 0.08, dur: 0.32 });
    hit(q[0], p, '#9fd0ff', 'skill', heroEls());
  } else if (id === 'whirl') {
    if (!inRange) return false;
    hero.lunge = 1.5;
    hero.back = false;
    hero.atk = { t: 0, dur: 0.5, kind: 'whirl' };
    if (girl) q.slice(0, 3).forEach((m, k) => battle.fx.push({ kind: 'star', from: hero.x + 22, x: mx(m), t: -k * 0.07, dur: 0.3 }));
    else battle.fx.push({ kind: 'whirl', t: 0, dur: 0.5 });
    q.slice(0, 3).forEach(m => hit(m, p, '#9fd0ff', 'skill', heroEls()));
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
  battle.skillCd[id] = sk.cd * (1 - Math.min(50, stats.mods.cd) / 100);
  addFloat(sk.name + '!', hero.x + 16, GROUND - 62, '#9fd0ff', true);
  return true;
}

function updateSkills(dt) {
  for (const id in battle.skillCd) battle.skillCd[id] = Math.max(0, battle.skillCd[id] - dt);
  battle.cryT = Math.max(0, battle.cryT - dt);
  if (save.autoSkill) for (let i = 0; i < SKILL_SLOTS; i++) castSkill(i, true);
}

function waveCleared() {
  if (battle.king) return endBattle('won');
  if (battle.wave < WAVES.length - 1) {
    const heal = Math.floor(stats.maxHp * WAVE_HEAL);
    hero.hp = Math.min(stats.maxHp, hero.hp + heal);
    addFloat('+' + fmt(heal), hero.x + 16, GROUND - 46, '#6fe39a', true);
    for (const a of Object.values(battle.ahp || {})) a.hp = a.hp <= 0 ? Math.floor(a.max * 0.3) : Math.min(a.max, a.hp + a.max * WAVE_HEAL);
    battle.shadows = (battle.shadows || []).filter(s => s.t === Infinity);
    toast(`웨이브 ${battle.wave + 1} 클리어! 체력 회복`);
    battle.wave++;
    battle.delay = 1.6;
    updateBattleHud();
  } else {
    endBattle('won');
  }
}

// result: 'won'(승리) | 'lost'(쓰러짐) | 'retreat'(후퇴) | 'timeout'(보스 시간 초과)
function endBattle(result) {
  if (SEALED) { SEALED = false; refreshStats(); }
  const won = result === 'won';
  if (won) Sound.win(); else if (result !== 'retreat') Sound.lose();
  battle.state = result;
  const r = battle;
  if (r.dungeon) return endDungeon(result);
  if (r.king) return endBoss(result);
  let text;
  if (won) {
    const first = save.stage === r.stage;
    const bonus = Math.floor(monGold(r.stage) * BAL.clearBonus * (first ? 1 : REPLAY_BONUS));
    save.gold += bonus;
    r.earned += bonus;
    if (first) { accrue(); save.stage++; setTimeout(() => fanfare('LEVEL UP!', `Lv ${heroLevel()}${traitsOpen() ? ' · 특성 포인트 +1' : ''}`, Sound.levelUp), 300); }   // 방치 수입은 지금까지 쌓인 것까지 옛 속도로 계산 후 올림
    track('clears');
    text = `획득 골드 ${fmt(r.earned)} G (클리어 보상 ${fmt(bonus)} G${first ? '' : ' · 재도전 30%'})`
      + (first ? `<br>방치 수입 증가: 초당 ${idleRate().toFixed(1)} G<br>레벨 업 · Lv ${heroLevel()}${traitsOpen() ? ' · 특성 포인트 +1' : ''}` : '');
  } else if (result === 'retreat') {
    text = `획득 골드 ${fmt(r.earned)} G · 저장 완료<br>스테이지 미클리어`;
  } else {
    text = `획득 골드 ${fmt(r.earned)} G · 저장 완료<br>캠프에서 강화 후 재도전`;
  }
  if (r.loot.length) text += '<br>획득 장비: ' + r.loot.map(it => `<b style="color:${GRADES[it.grade].color}">${itemName(it)}</b>`).join(', ');
  writeSave();
  cloudUpload();
  const top = topStage(), c = chOf(r.stage);
  const btns = [];
  if (won && r.stage < top && localOf(r.stage) < STAGES_PER) btns.push(['다음 스테이지 ▶', () => startBattle(r.stage + 1), true]);
  if (won && localOf(r.stage) === STAGES_PER && !bossBeaten(c)) btns.push(['👑 챕터 보스 도전', () => startBoss(c), true]);
  if (won && localOf(r.stage) === STAGES_PER && bossBeaten(c) && r.stage < top) btns.push([`챕터 ${c + 1} 시작 ▶`, () => startBattle(r.stage + 1), true]);
  if (!won) btns.push(['다시 도전', () => startBattle(r.stage), true]);
  btns.push(['스테이지 선택', () => { showScreen('lobby'); openStages(); }, false]);
  btns.push(['캠프로', () => showScreen('lobby'), false]);
  showResult({ won: `스테이지 ${stageLabel(r.stage)} 클리어!`, lost: '패배…', retreat: '후퇴' }[result],
    { won: '#ffd25e', lost: '#ff9aa6', retreat: '#c8d6ff' }[result], text, btns);
}

function endBoss(result) {
  const r = battle, c = r.ch, B = chapter(c).boss;
  if (result !== 'won') {
    writeSave();
    cloudUpload();
    showResult({ lost: '패배…', timeout: '시간 초과', retreat: '후퇴' }[result], result === 'retreat' ? '#c8d6ff' : '#ff9aa6',
      `획득 골드 ${fmt(r.earned)} G · 저장 완료<br>강화 후 재도전 · ${B.mechName} 직전에 물약 사용`,
      [['다시 도전', () => startBoss(c), true], ['캠프로', () => showScreen('lobby'), false]]);
    return;
  }
  const first = !bossBeaten(c);
  const bonus = Math.floor(monGold(c * STAGES_PER) * BAL.kingGold * (first ? 1 : REPLAY_BONUS));
  save.gold += bonus;
  r.earned += bonus;
  const ally = allyById(B.ally);
  if (first) {
    setTimeout(() => fanfare('LEVEL UP!', `Lv ${heroLevel()} · 레벨 +3`, Sound.levelUp), 200);
    save.dust += 50;
    save.bosses[c] = true;
    save.shards = (save.shards || 0) + 1;
    gainAlly(ally.id);
  }
  writeSave();
  cloudUpload();
  let text = `획득 골드 ${fmt(r.earned)} G`
    + (first ? `<br>✦ 별조각 +1 · 공격력·체력 영구 +10% · 별가루 +50<br>레벨 +3 · 특성 포인트 +3<br>${ally.name} 합류 · 동료 탭에서 확인${c >= 2 ? ' · 동료 배치 칸 +1' : ''}`
      + (c < CHAPTERS.length ? `<br>챕터 ${c + 1} · ${chapter(c + 1).name} 해금` : '<br>다음 챕터는 업데이트 예정') : ' (재도전 보상 30%)');
  if (r.loot.length) text += '<br>획득 장비: ' + r.loot.map(it => `<b style="color:${GRADES[it.grade].color}">${itemName(it)}</b>`).join(', ');
  const btns = [['캠프로', () => showScreen('lobby'), !(first && c < CHAPTERS.length)]];
  if (first && c < CHAPTERS.length) btns.unshift([`챕터 ${c + 1} 시작 ▶`, () => startBattle(c * STAGES_PER + 1), true]);
  const finish = () => showResult(first ? `챕터 ${c} 클리어!` : `${B.name} 처치!`, '#ffd25e', text, btns);
  if (first) playDialog(TALK[c].outro, finish); else finish();
  updateHud();
}

function showResult(title, color, text, btns) {
  $('rTitle').textContent = title;
  $('rTitle').style.color = color;
  $('rText').innerHTML = text;
  $('rBtns').innerHTML = '';
  for (const [label, fn, main] of btns) {
    const b = document.createElement('button');
    b.className = 'stone' + (main ? ' main' : '');
    b.textContent = label;
    b.onclick = () => fn();
    $('rBtns').appendChild(b);
  }
  $('result').hidden = false;
  updateHud();
}

// ── 대화창 ───────────────────────────────────
const SPEAKERS = {
  hero: () => ({ name: save.name, img: SPR['hero_' + save.gender] }),
  boss: () => ({ name: chapter(talkCh).boss.name, img: SPR[chapter(talkCh).boss.sprite] }),
  miru: () => ({ name: '미르', img: SPR.miru }),
  serin: () => ({ name: '세린', img: SPR.serin }),
  kai: () => ({ name: '카이', img: SPR.kai }),
  narr: () => ({ name: '', img: null }),
};
let dlg = null;   // { lines, i, chars, onDone }

function lineText(L) { return L.text.replace('{name}', save.name); }

function playDialog(lines, onDone) {
  dlg = { lines, i: 0, chars: 0, onDone };
  $('dialog').hidden = false;
  showLine();
}

function showLine() {
  const L = dlg.lines[dlg.i];
  const sp = SPEAKERS[L.who]();
  $('dBox').classList.toggle('narr', L.who === 'narr');
  $('dName').textContent = sp.name;
  const c = $('dPortrait').getContext('2d');
  c.clearRect(0, 0, 128, 128);
  if (sp.img) c.drawImage(sp.img, 0, 0, 128, 128);
  dlg.chars = 0;
  $('dText').textContent = '';
}

function dialogTick(dt) {
  if (!dlg) return;
  const text = lineText(dlg.lines[dlg.i]);
  if (dlg.chars >= text.length) return;
  dlg.chars = Math.min(text.length, dlg.chars + dt * 36);
  $('dText').textContent = text.slice(0, Math.floor(dlg.chars));
}

function dialogNext() {
  if (!dlg) return;
  const text = lineText(dlg.lines[dlg.i]);
  if (dlg.chars < text.length) { dlg.chars = text.length; $('dText').textContent = text; return; }
  dlg.i++;
  if (dlg.i >= dlg.lines.length) endDialog(); else showLine();
}

function endDialog(silent) {
  if (!dlg) return;
  const f = dlg.onDone;
  dlg = null;
  $('dialog').hidden = true;
  if (!silent && f) f();
}

// ── 말풍선 ───────────────────────────────────
let bubbles = [];          // { who, text, t, dur }
let lobbyTalk = 8;         // 로비 혼잣말까지 남은 시간
let shake = 0;

function say(who, text, dur) {
  bubbles = bubbles.filter(b => b.who !== who);
  bubbles.push({ who, text, t: 0, dur: dur || 3.2 });
}

function drawBubble(b, cx, topY) {
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, b.t * 6, (b.dur - b.t) * 3));
  ctx.font = 'bold 19px "Malgun Gothic", sans-serif';
  const w = ctx.measureText(b.text).width + 28, h = 38;
  const tipX = cx * SCALE;
  const x = Math.max(8, Math.min(cv.width - w - 8, tipX - w / 2));
  const y = topY * SCALE - h - 14;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 12);
  ctx.moveTo(tipX - 8, y + h); ctx.lineTo(tipX, y + h + 12); ctx.lineTo(tipX + 8, y + h);
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#2a2f55';
  ctx.stroke();
  ctx.fillStyle = '#22263f';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(b.text, x + w / 2, y + h / 2 + 1);
  ctx.restore();
}

function drawBubbles(pos) {
  for (const b of bubbles) { const p = pos[b.who]; if (p) drawBubble(b, p[0], p[1]); }
}

function updateBubbles(dt) {
  bubbles.forEach(b => b.t += dt);
  bubbles = bubbles.filter(b => b.t < b.dur);
  if (screen !== 'lobby' || dlg) return;
  lobbyTalk -= dt;
  if (lobbyTalk <= 0) {
    lobbyTalk = 18 + Math.random() * 14;
    const party = (save.party || []).filter(id => LINES[id]);
    if (party.length && Math.random() < 0.5) { const id = pick(party); say(id, pick(LINES[id])); }
    else say('hero', pick(LINES.lobby));
  }
}

// ── 스테이지 선택 ────────────────────────────
let stagesCh = null;                // 스테이지 선택 창에서 보고 있는 챕터
function openStages(c) {
  modalKind = 'stages';
  const top = topStage();
  c = c || stagesCh || campChapter();
  stagesCh = c;
  $('mTitle').textContent = '스테이지 선택';
  let html = '<div class="mgold" id="mGold"></div><div class="chtabs">';
  CHAPTERS.forEach((C, i) => {
    const open = (i + 1) === 1 || bossBeaten(i);
    html += `<button data-ch="${i + 1}" class="${i + 1 === c ? 'on' : ''}" ${open ? '' : 'disabled'}>${i + 1}. ${C.name}${open ? '' : ' 🔒'}</button>`;
  });
  html += '</div><div class="stagegrid">';
  for (let n = 1; n <= STAGES_PER; n++) {
    const st = (c - 1) * STAGES_PER + n;
    const cleared = st < save.stage, open = st <= top;
    const type = monsterType(st);
    html += `<button class="stg${cleared ? ' clear' : ''}${st === save.stage && open ? ' next' : ''}" data-stg="${st}" ${open ? '' : 'disabled'}>
      <img src="${ICON_URL[type.sprite]}"><b>${c}-${n}</b><small>${cleared ? '✓ 클리어' : open ? '도전' : '잠김'}</small></button>`;
  }
  const B = chapter(c).boss, bo = bossOpen(c), done = bossBeaten(c);
  html += `</div><button class="stg boss${done ? ' clear' : ''}${bo && !done ? ' next' : ''}" id="bossStg" ${bo ? '' : 'disabled'}>
    <img src="${ICON_URL[B.sprite]}"><b>👑 챕터 보스 · ${B.name}</b>
    <small>${done ? '✓ 처치 · 재도전 가능' : bo ? '도전 가능 · 제한 시간 60초' : `${c}-20 클리어 시 해금`}</small></button>
    <p class="note">클리어한 스테이지 재도전 가능 · 클리어 보상은 첫 클리어 100%, 이후 30%</p>`;
  $('mBody').innerHTML = html;
  $('mBody').querySelectorAll('[data-ch]').forEach(b => b.onclick = () => openStages(+b.dataset.ch));
  $('mBody').querySelectorAll('[data-stg]').forEach(b => b.onclick = () => { closeModal(); startBattle(+b.dataset.stg); });
  $('bossStg').onclick = () => { closeModal(); startBoss(c); };
  $('modal').hidden = false;
  refreshModal();
}

// ── 미션·뽑기·던전 창 ────────────────────────
function openPanel(kind, title) {
  modalKind = kind;
  $('mTitle').textContent = title;
  $('mBody').innerHTML = '<div class="mgold" id="mGold"></div><div id="pBody"></div>';
  $('modal').hidden = false;
  refreshModal();
}

function refreshMissions() {
  ensureDaily();
  const M = mainMission(), done = M.prog >= M.target;
  let html = `<div class="up mrow main${done ? ' done' : ''}"><div class="nm">진행 미션 ${save.mainIdx + 1}<small>${M.text}</small></div>
    <div class="val"><i class="mbar"><b style="width:${M.prog / M.target * 100}%"></b></i> ${M.prog} / ${M.target} · 보상 별가루 ${M.dust} · ${fmt(M.gold)} G</div>
    <button id="mainClaim" ${done ? '' : 'disabled'}>받기</button></div><b class="mhead">일일 미션 <small>자정에 초기화</small></b>`;
  for (const q of DAILY) {
    const p = dailyProgress(q), got = save.daily.claimed[q.id], ok = p >= q.target && !got;
    html += `<div class="up mrow${got ? ' got' : ''}"><div class="nm">${q.text}<small>${p} / ${q.target}</small></div>
      <div class="val"><i class="mbar"><b style="width:${p / q.target * 100}%"></b></i> 별가루 ${q.reward}</div>
      <button data-dq="${q.id}" ${ok ? '' : 'disabled'}>${got ? '완료' : '받기'}</button></div>`;
  }
  $('pBody').innerHTML = html;
  $('mainClaim').onclick = claimMain;
  $('pBody').querySelectorAll('[data-dq]').forEach(b => b.onclick = () => claimDaily(b.dataset.dq));
}

// ── 특성 탭 ──────────────────────────────────
function openTraits() {
  modalKind = 'traits';
  $('mTitle').textContent = '특성 · 전직';
  document.querySelector('.mbox').classList.add('wide');
  $('mBody').innerHTML = '<div class="mgold" id="mGold"></div><div id="traitBody"></div>';
  $('modal').hidden = false;
  refreshModal();
}

function resetCost() { return monGold(topStage()) * 40; }

function refreshTraits() {
  if (!traitsOpen()) {
    $('traitBody').innerHTML = '<p class="note">챕터 1 보스 처치 시 특성 보드 해금 · 레벨이 오를 때마다 특성 포인트 1</p>';
    return;
  }
  const left = pointsLeft();
  let html = `<div class="thead"><b>Lv ${heroLevel()} · ${jobTitle()}</b><span>남은 포인트 <em>${left}</em> / ${heroLevel() - 1}</span>
    <button id="tReset" ${pointsSpent() || save.job ? '' : 'disabled'}>초기화 ${fmt(resetCost())} G</button></div><div class="tgrid">`;
  for (const t of TRAIT_TREES) {
    const spent = treeSpent(t);
    html += `<div class="tcol" style="border-top-color:${t.color}"><div class="tname" style="color:${t.color}">${t.name}<small>${spent}포인트</small></div>`;
    for (const n of t.nodes) {
      const r = traitRank(n.id), locked = n.req && spent < n.req, maxed = r >= n.max;
      html += `<div class="tnode${locked ? ' locked' : ''}${r ? ' has' : ''}">
        <div><b>${n.name}</b><small>${r} / ${n.max}</small></div>
        <p>${locked ? `갈래 ${n.req}포인트 필요` : maxed ? n.desc(r) : r ? `${n.desc(r)} → <em>${n.desc(r + 1)}</em>` : n.desc(1)}</p>
        <button data-tr="${n.id}" ${locked || maxed || left <= 0 ? 'disabled' : ''}>${maxed ? 'MAX' : '+'}</button></div>`;
    }
    html += '</div>';
  }
  html += '</div><div class="jobs">';
  if (!save.job) {
    html += `<b>1차 전직</b><p class="note">한 갈래에 ${JOB_POINTS}포인트 이상 투자하면 그 계열로 전직</p><div class="jobrow">`;
    for (const t of TRAIT_TREES) {
      const ok = treeSpent(t) >= JOB_POINTS, J = JOBS[t.id];
      html += `<button class="jobbtn" data-job="${t.id}" ${ok ? '' : 'disabled'}><b>${J.name}</b><small>${J.bonus}</small><small>${ok ? '전직 가능' : `${t.name} ${treeSpent(t)} / ${JOB_POINTS}`}</small></button>`;
    }
    html += '</div>';
  } else if (!save.adv) {
    const t = TRAIT_TREES.find(x => x.id === save.job), J = JOBS[save.job];
    const ok = bossBeaten(ADV_CH) && treeSpent(t) >= ADV_POINTS;
    html += `<b>2차 전직 · ${J.name}</b><p class="note">챕터 ${ADV_CH} 보스 처치 + ${t.name} ${ADV_POINTS}포인트 (현재 ${treeSpent(t)}) · 둘 중 하나 선택</p><div class="jobrow">`;
    for (const a of J.adv) html += `<button class="jobbtn" data-adv="${a.id}" ${ok ? '' : 'disabled'}><b>${a.name}</b><small>${a.bonus}</small></button>`;
    html += '</div>';
  } else {
    html += `<b>전직 완료 · ${jobTitle()}</b><p class="note">초기화하면 전직도 처음부터</p>`;
  }
  html += '</div>';
  $('traitBody').innerHTML = html;
  $('traitBody').querySelectorAll('[data-tr]').forEach(b => b.onclick = () => {
    if (pointsLeft() <= 0) return;
    save.traits[b.dataset.tr] = traitRank(b.dataset.tr) + 1;
    refreshStats(); updateHud();
  });
  $('traitBody').querySelectorAll('[data-job]').forEach(b => b.onclick = () => {
    save.job = b.dataset.job;
    refreshStats(); updateHud(); writeSave();
    closeModal();
    fanfare('전직!', `${JOBS[save.job].name} · ${JOBS[save.job].bonus}`);
    floatsLobby.push({ text: JOBS[save.job].name + ' 전직!', t: 0, x: 160, y: 60, color: '#ffe27a', big: true });
  });
  $('traitBody').querySelectorAll('[data-adv]').forEach(b => b.onclick = () => {
    save.adv = b.dataset.adv;
    refreshStats(); updateHud(); writeSave();
    closeModal();
    fanfare('2차 전직!', jobTitle());
    floatsLobby.push({ text: jobTitle() + ' 전직!', t: 0, x: 160, y: 60, color: '#ffe27a', big: true });
  });
  if ($('tReset')) $('tReset').onclick = () => {
    const cost = resetCost();
    if (save.gold < cost) return alert('골드 부족');
    if (!confirm(`특성과 전직 초기화\n비용 ${fmt(cost)} G`)) return;
    save.gold -= cost;
    save.traits = {}; save.job = null; save.adv = null;
    refreshStats(); updateHud(); writeSave();
  };
}

// ── 동료 탭 ──────────────────────────────────
// 상성표 (동료 화면 아래)
function affinityChart() {
  const rows = Object.values(BODY).map(B => `<tr><th>${B.name}</th><td class="w">${B.weak.map(e => ELEM_NAME[e]).join('·')}</td><td class="r">${B.resist.map(e => ELEM_NAME[e]).join('·')}</td></tr>`).join('');
  return `<div class="aff"><b>상성</b>
    <p class="note">공격 속성 · 베기: 소년 주인공, 검·도끼 전사형 / 관통: 사격형, 창 전사형 / 마법: 소녀 주인공, 마법형, 그림자 병사 / 화염: 불 지팡이, 삼색 마법의 불 (마법 약점에도 통함) / 신성: 심판의 빛 특성</p>
    <table><tr><th>몸 종류</th><th>약점 ×1.5</th><th>저항 ×0.7</th></tr>${rows}</table>
    <p class="note">주인공 공격은 상성 효과 절반 (×1.25 / ×0.85)</p>
    <ul>
      <li><b>암살자 → 치유형</b> 치유형 동료에게 피해 2배</li>
      <li><b>전사형 → 암살자</b> 도발로 뒤를 지킴 · 암살자에게 피해 1.5배, 받는 피해 절반</li>
      <li><b>사격형 → 몬스터 치유사</b> 치유사를 먼저 저격 · 피해 1.5배</li>
      <li><b>치유형 → 저주술사</b> 걸린 저주를 곧바로 정화</li>
      <li><b>지원형 → 룰 브레이커</b> 노래로 특성 봉인 시간 절반</li>
      <li><b>화염 → 강령술사</b> 불에 탄 시체는 되살릴 수 없음</li>
      <li><b>신성·화염 → 언데드</b> 되살아난 몬스터·해골 강령술사·붕대 유령은 영체 + 악</li>
      <li><b>계열</b> 심판의 빛은 악(악마·언데드)에게 강함 · 어둠의 힘은 선·타락 천사를 때리면 반발</li>
    </ul></div>`;
}

let allySel = null;
function openAllies(sel) {
  modalKind = 'allies';
  if (typeof sel === 'string') allySel = sel;
  $('mTitle').textContent = '동료';
  document.querySelector('.mbox').classList.add('wide');
  $('mBody').innerHTML = '<div class="mgold" id="mGold"></div><div id="allyList"></div>';
  $('modal').hidden = false;
  refreshModal();
}

function refreshAllies() {
  const party = save.party || [];
  const own = ALLIES.filter(A => save.allies[A.id]);
  if (!allySel || !save.allies[allySel]) allySel = party[0] || (own[0] && own[0].id) || null;
  let html = '';
  if (allySel) {
    const A = allyById(allySel), id = A.id, lv = save.allies[id], st = allyStar(id), R = RARITY[A.r];
    const inParty = party.includes(id), cost = allyCost(lv), have = save.acopy[id] || 0, need = AWAKEN_COST[st];
    html += `<div class="adet"><img src="${allyIcon(id)}" class="abig">
      <div class="ainfo"><b style="color:${R.color}">${R.stars} ${R.name} · ${A.role}</b><h3>${allyName(id)}</h3>
      <div class="astars">${[1, 2, 3, 4, 5].map(n => `<i class="${n <= st ? 'on' : ''}">★</i>`).join('')} <small>각성 ${st} / ${STAR_MAX} · Lv ${lv}</small></div>
      <p>${A.desc(lv, allyPow(id))}${A.type === 'warrior' ? ` · 도발: 10초마다 적의 공격을 4초 동안 대신 받음 (피해 -${Math.round(tauntGuard(id) * 100)}%)` : ''}</p>
      <p class="note">공격 속성 · ${A.type === 'heal' ? '없음 (치유)' : A.type === 'support' ? '없음 (지원)' : ELEM_NAME[allyEl(id)]}</p>
      ${st < STAR_MAX ? `<div class="anext"><img src="${allyIcon(id, st + 1)}"><div><small>다음 각성</small><br><b>${PREFIX[A.type][st]} ${A.name}</b><br><small>조각 ${have} / ${need}</small></div></div>` : '<p class="note">최대 각성 · 중복은 별가루 +10</p>'}
      <div class="skbtns"><button class="equip${inParty ? ' on' : ''}" id="aParty" ${!inParty && party.length >= partyMax() ? 'disabled' : ''}>${inParty ? '해제' : '배치'}</button>
      <button id="aUp" ${save.gold < cost ? 'disabled' : ''}>강화 ${fmt(cost)} G</button>
      <button id="aAwk" class="awk" ${st >= STAR_MAX || have < need ? 'disabled' : ''}>각성</button></div></div></div>`;
  }
  html += `<p class="note" style="margin:8px 0">배치 ${party.length} / ${partyMax()}${partyMax() < PARTY_MAX ? ' · 챕터 보스 처치로 칸 추가' : ''} · 도감 ${own.length} / ${ALLIES.length} (공격력·체력 +${codexBonus()}%) · 새 동료는 뽑기에서 획득</p><div class="agrid">`;
  for (const A of ALLIES) {
    const has = save.allies[A.id], R = RARITY[A.r], st = allyStar(A.id);
    const canAwk = has && st < STAR_MAX && (save.acopy[A.id] || 0) >= AWAKEN_COST[st];
    html += `<button class="acard${has ? '' : ' locked'}${party.includes(A.id) ? ' inparty' : ''}${A.id === allySel ? ' sel' : ''}" style="--rc:${R.color}" ${has ? `data-asel="${A.id}"` : 'disabled'}>
      <img src="${allyIcon(A.id, has ? st : 1)}"><b>${has ? allyName(A.id) : A.name}</b><small>${has ? '★'.repeat(st) : R.stars}</small>${canAwk ? '<em class="rdot"></em>' : ''}</button>`;
  }
  html += '</div>' + affinityChart() + '<div class="syn"><b>시너지</b>' + SYNERGY.map(s => { const n = typeCount(s.type); return `<div class="${n ? 'on' : ''}">${n ? '✓' : '·'} ${s.text(n || 1)}</div>`; }).join('') + '</div>';
  $('allyList').innerHTML = html;
  $('allyList').querySelectorAll('[data-asel]').forEach(b => b.onclick = () => { allySel = b.dataset.asel; refreshAllies(); });
  if (!allySel) return;
  const id = allySel;
  $('aUp').onclick = () => {
    const cost = allyCost(save.allies[id]);
    if (save.gold < cost) return;
    save.gold -= cost; save.allies[id]++;
    refreshStats(); updateHud();
  };
  $('aParty').onclick = () => {
    const at = save.party.indexOf(id);
    if (at >= 0) save.party.splice(at, 1);
    else if (save.party.length < partyMax()) save.party.push(id);
    refreshStats(); updateHud();
  };
  $('aAwk').onclick = () => awaken(id);
}

function usePotion() {
  if (!battle || battle.state !== 'fight') return;
  if (save.potions <= 0) return toast('물약 없음 · 캠프 상점에서 구매');
  if (battle.potionCd > 0) return;
  if (hero.hp >= stats.maxHp) return toast('체력 가득 참');
  const heal = Math.floor(stats.maxHp * POTION_HEAL * (1 + stats.mods.potion / 100));
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
  const cx = (x + 6) * SCALE, by = (GROUND - 1) * SCALE;
  // 따뜻한 빛
  const glow = ctx.createRadialGradient(cx, by - 20, 0, cx, by - 20, 130);
  glow.addColorStop(0, 'rgba(255,180,80,0.35)'); glow.addColorStop(1, 'rgba(255,180,80,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(cx - 130, by - 150, 260, 200);
  // 장작 두 개 (엇갈리게)
  ctx.lineCap = 'round';
  for (const [dx, rot] of [[-1, 0.35], [1, -0.35]]) {
    ctx.save(); ctx.translate(cx, by - 4); ctx.rotate(rot);
    ctx.fillStyle = '#7a4a2a'; ctx.strokeStyle = '#3b2626'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.roundRect(-22, -5, 44, 10, 5); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
  // 불꽃 세 겹 (흔들림)
  const flame = (h, w, color, ph) => {
    const sway = Math.sin(time * 9 + ph) * 4, hh = h * (0.9 + 0.12 * Math.sin(time * 13 + ph));
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(cx - w, by - 8);
    ctx.quadraticCurveTo(cx - w * 1.1, by - 8 - hh * 0.55, cx + sway, by - 8 - hh);
    ctx.quadraticCurveTo(cx + w * 1.1, by - 8 - hh * 0.55, cx + w, by - 8);
    ctx.closePath(); ctx.fill();
  };
  flame(46, 17, '#e8502a', 0);
  flame(34, 12, '#ff9a2a', 1.3);
  flame(20, 7, '#ffe27a', 2.6);
  // 불티
  for (let i = 0; i < 3; i++) {
    const t = (time * 0.8 + i / 3) % 1;
    ctx.fillStyle = `rgba(255,200,100,${1 - t})`;
    ctx.beginPath(); ctx.arc(cx + Math.sin(t * 9 + i) * 10, by - 40 - t * 50, 2.5, 0, Math.PI * 2); ctx.fill();
  }
}

// ── 이스터에그: 오래 플레이할수록 미소가 뒤집힌다 ──
// 15분: 일자 입, 30분: 거꾸로 미소. 탭을 5분 넘게 떠났다 오면(쉬고 오면) 다시 웃는다.
let playStart = performance.now(), hiddenAt = 0, mood = 0;
document.addEventListener('visibilitychange', () => {
  if (document.hidden) hiddenAt = performance.now();
  else if (hiddenAt && performance.now() - hiddenAt > 5 * 60000) playStart = performance.now();
});
function updateMood() {
  const min = (performance.now() - playStart) / 60000;
  const m = min >= 30 ? 2 : min >= 15 ? 1 : 0;
  if (m > mood) say('hero', m === 1 ? '조금 피곤하네…' : '…우리 좀 쉬었다 할까?', 4);
  mood = m;
}
function face(name) { return (mood && SPR[name + '_m' + mood]) || SPR[name]; }

// ── 레드닷: 지금 할 수 있는 일이 있는 버튼에 빨간 점 ──
function setDot(sel, on, num) {
  const b = document.querySelector(sel);
  if (!b) return;
  let dot = b.querySelector('.rdot');
  if (!dot) { dot = document.createElement('em'); dot.className = 'rdot'; b.appendChild(dot); }
  dot.hidden = !on;
  dot.textContent = num ? (num > 99 ? '99+' : num) : '';
  dot.classList.toggle('num', !!num);
}
function updateDots() {
  setDot('[data-open=up]', UPGRADES.some(u => save.lv[u.id] < u.max && save.gold >= upgradeCost(u, save.lv[u.id])));
  setDot('[data-open=traits]', traitsOpen() && pointsLeft() > 0, pointsLeft());
  setDot('[data-open=allies]', Object.entries(save.allies || {}).some(([id, lv]) => allyById(id) && (save.gold >= allyCost(lv) || (allyStar(id) < STAR_MAX && (save.acopy[id] || 0) >= AWAKEN_COST[allyStar(id)]))));
  setDot('[data-open=skill]', SKILLS.some(sk => save.stage - 1 >= sk.unlock && save.gold >= skillCost(sk, save.skills[sk.id] || 0)));
  setDot('[data-open=gear]', save.items.some(it => !Object.values(save.gear).includes(it.id) && itemScore(it) > itemScore(equipped(it.slot))));
  setDot('[data-open=gacha]', save.dust >= GACHA_COST);
}

// ── 금화 분수: 상자에서 금화가 튀고, 받으면 골드 칸으로 날아간다 ──
let coins = [], coinTimer = 0;
const CHEST_PX = () => { const r = $('chestCv').getBoundingClientRect(), s = cv.getBoundingClientRect(); return [(r.left + r.width / 2 - s.left) / s.width * cv.width, (r.top + r.height * 0.3 - s.top) / s.height * cv.height]; };
const GOLD_PX = () => { const r = $('lGold').getBoundingClientRect(), s = cv.getBoundingClientRect(); return [(r.left - s.left) / s.width * cv.width, (r.top + r.height / 2 - s.top) / s.height * cv.height]; };
function coinBurst(n) {
  const [x, y] = CHEST_PX();
  for (let i = 0; i < n; i++) coins.push({ x, y, vx: (Math.random() - 0.5) * 420, vy: -250 - Math.random() * 300, t: 0, fly: 0.35 + Math.random() * 0.25 });
}
function drawCoins(dt) {
  if (save.chest >= 1 && (coinTimer -= dt) <= 0) {          // 쌓여 있으면 통통 튄다
    coinTimer = 0.35;
    const [x, y] = CHEST_PX();
    coins.push({ x: x + (Math.random() - 0.5) * 30, y, vx: (Math.random() - 0.5) * 80, vy: -160 - Math.random() * 80, t: 0, hop: true });
  }
  const [gx, gy] = GOLD_PX();
  coins = coins.filter(c => {
    c.t += dt;
    if (c.hop) { c.vy += 700 * dt; c.x += c.vx * dt; c.y += c.vy * dt; if (c.t > 0.55) return false; }
    else if (c.t < c.fly) { c.vy += 900 * dt; c.x += c.vx * dt; c.y += c.vy * dt; }
    else { const k = Math.min(1, (c.t - c.fly) * 2.2); c.x += (gx - c.x) * k; c.y += (gy - c.y) * k; if (Math.hypot(gx - c.x, gy - c.y) < 12) return false; }
    const s = 1 + Math.sin(c.t * 18) * 0.5;
    ctx.fillStyle = '#c8901e'; ctx.beginPath(); ctx.ellipse(c.x, c.y, 8 * Math.abs(s - 0.5) + 2, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffe27a'; ctx.beginPath(); ctx.ellipse(c.x - 1, c.y - 1, (8 * Math.abs(s - 0.5) + 2) * 0.7, 6, 0, 0, Math.PI * 2); ctx.fill();
    return c.t < 3;
  });
}

function renderLobby() {
  drawImg(SPR.tent, 50, GROUND - 38, 48);
  drawCampfire(104);
  const bob = Math.round(Math.sin(time * 3) * 0.8);
  const spots = [18, 186, 214, 242, 270];             // 배치한 동료가 캠프에 머무는 자리
  const pos = { hero: [138, GROUND - 32] };
  (save.party || []).forEach((id, i) => {
    const x = spots[i];
    shadow(x + 16);
    drawImg(allyImg(id), x, GROUND - 31 + Math.round(Math.sin(time * 3 + 1 + i) * 0.8));
    pos[id] = [x + 16, GROUND - 32];
  });
  shadow(138);
  drawImg(face('hero_' + save.gender), 122, GROUND - 31 + bob);
  drawBubbles(pos);
  drawCoins(1 / 60);
  floatsLobby.forEach(f => f.t += 1 / 60);
  floatsLobby = floatsLobby.filter(f => f.t < 1);
  drawFloats(floatsLobby, 166, 100);
}

// 특수 몬스터 표식과 상태 이상
function drawMonMarks(m, size) {
  const cx = (m.x + (m.kb || 0) + size / 2) * SCALE, top = (GROUND - size - 16) * SCALE;
  ctx.save();
  if (m.role) {
    const R = ROLES[m.role];
    ctx.fillStyle = R.color; ctx.shadowColor = R.color; ctx.shadowBlur = 12;
    ctx.beginPath(); ctx.arc(cx, top - 6, 13, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0; ctx.fillStyle = '#fff'; ctx.font = '900 17px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(R.icon, cx, top - 5);
  }
  if (m.stun > 0) { ctx.fillStyle = '#ffe27a'; for (let k = 0; k < 3; k++) { const an = time * 6 + k * 2.1; ctx.beginPath(); ctx.arc(cx + Math.cos(an) * 26, top + 26 + Math.sin(an) * 7, 5, 0, Math.PI * 2); ctx.fill(); } }
  if (tauntOn(m)) { ctx.fillStyle = '#ff5a3a'; ctx.font = '900 24px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('💢', cx + 22, top + 14); }
  if (m.charm > 0) { ctx.fillStyle = '#ff7ac8'; ctx.font = '900 22px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('♥', cx + Math.sin(time * 5) * 14, top + 16 - (time * 30 % 20)); }
  if (m.burn > 0) { ctx.fillStyle = `rgba(255,120,40,${0.5 + 0.3 * Math.sin(time * 20)})`; ctx.beginPath(); ctx.arc(cx, (GROUND - 6) * SCALE, 10 + Math.random() * 4, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
}

function renderBattle() {
  const walking = battle.delay > 0;
  const bob = walking ? Math.round(Math.abs(Math.sin(time * 12)) * -2) : Math.round(Math.sin(time * 4) * 0.8);
  // 주인공 모션: 소년은 돌진 베기(잔상), 소녀는 공중에 떠서 마법진 위에서 캐스팅
  const ha = hero.atk, hpr = ha ? Math.min(1, ha.t / ha.dur) : 0, girl = save.gender === 'f';
  let hdx = 0, hdy = bob, hrot = 0;
  if (girl) {
    if (!walking && battle.state === 'fight') hdy += -5 + Math.sin(time * 3) * 1.5;
    if (ha) hdy -= Math.sin(Math.PI * hpr) * (ha.kind === 'basic' ? 6 : 12);
  } else if (ha) {
    const reach = ha.kind === 'basic' ? 24 : 34;
    hdx = (hero.back ? -1 : 1) * reach * Math.sin(Math.PI * Math.min(1, hpr * 1.15));
    if (ha.kind === 'whirl') hrot = hpr * Math.PI * 2;
  }
  const hx = hero.x + hdx;
  shadow(hx + 16);
  if (girl && !walking && battle.state === 'fight') {       // 발밑 마법진
    const cx0 = (hx + 16) * SCALE, cy0 = (GROUND + 1) * SCALE, on = ha ? 1 : 0.35;
    ctx.save();
    ctx.globalAlpha = on; ctx.strokeStyle = '#ff9ad0'; ctx.shadowColor = '#ff6ac0'; ctx.shadowBlur = ha ? 16 : 6;
    ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(cx0, cy0, 20 * SCALE, 5 * SCALE, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(cx0, cy0, 14 * SCALE, 3.5 * SCALE, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#ffd0ec';
    for (let k = 0; k < 6; k++) { const an = time * 1.5 + k * Math.PI / 3; ctx.fillRect(cx0 + Math.cos(an) * 17 * SCALE - 3, cy0 + Math.sin(an) * 4.2 * SCALE - 3, 6, 6); }
    ctx.restore();
  }
  const heroImg = face('hero_' + save.gender);
  const drawHero = (ox, alpha, ghost) => {
    ctx.save();
    if (battle.state === 'lost') ctx.globalAlpha = 0.35;
    ctx.globalAlpha *= alpha;
    if (ghost) ctx.filter = 'brightness(1.8) saturate(0.4)';
    if (hrot) { const px = (hero.x + ox + 16) * SCALE, py = (GROUND - 15) * SCALE; ctx.translate(px, py); ctx.rotate(hrot); ctx.translate(-px, -py); }
    drawImg(heroImg, hero.x + ox, GROUND - 31 + hdy, 32, ghost ? 0 : hero.hurt);
    ctx.restore();
  };
  const heroOnTop = !girl && !!ha;                           // 돌진 중인 소년은 몬스터 앞에 보이게 나중에 그림
  const paintHero = () => { if (!girl && ha && Math.abs(hdx) > 4) { drawHero(hdx * 0.3, 0.25, true); drawHero(hdx * 0.65, 0.4, true); } drawHero(hdx, 1, false); };
  if (!heroOnTop) paintHero();
  // 뿌리 감옥 경고(발밑 빛)와 묶임
  if (battle.mech === 'root' && battle.mechWarn) {
    ctx.fillStyle = `rgba(200,160,90,${0.35 + 0.25 * Math.sin(time * 20)})`;
    ctx.beginPath(); ctx.ellipse((hx + 16) * SCALE, (GROUND + 1) * SCALE, 18 * SCALE, 4 * SCALE, 0, 0, Math.PI * 2); ctx.fill();
  }
  if (battle.bound > 0) {
    ctx.strokeStyle = '#6b4428'; ctx.lineWidth = 7; ctx.lineCap = 'round';
    for (let k = 0; k < 4; k++) {
      const bx = (hx + 6 + k * 7) * SCALE;
      ctx.beginPath(); ctx.moveTo(bx, (GROUND + 2) * SCALE);
      ctx.quadraticCurveTo(bx + (k % 2 ? 14 : -14), (GROUND - 10) * SCALE, bx + (k % 2 ? -6 : 6), (GROUND - 18 - k * 2) * SCALE);
      ctx.stroke();
    }
  }
  if (battle.poison > 0) {
    ctx.fillStyle = `rgba(170,90,220,${0.18 + 0.1 * Math.sin(time * 10)})`;
    ctx.beginPath(); ctx.ellipse((hx + 16) * SCALE, (GROUND - 15) * SCALE, 20 * SCALE, 18 * SCALE, 0, 0, Math.PI * 2); ctx.fill();
  }
  if (battle.shield > 0) {
    ctx.strokeStyle = 'rgba(150,210,255,0.8)'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.ellipse((hx + 16) * SCALE, (GROUND - 15) * SCALE, 21 * SCALE, 19 * SCALE, 0, 0, Math.PI * 2); ctx.stroke();
  }
  // 그림자 병사 (주인공 바로 앞)
  for (const s of battle.shadows || []) {
    const sx = hero.x + 14 + (s.k % 3) * 7 + s.act * 6, sy = GROUND - 28 + (s.k % 2) * 2 + (1 - s.rise) * 20;
    ctx.save();
    ctx.globalAlpha = 0.8 * s.rise * (s.t < 1 ? s.t : 1);
    ctx.filter = 'brightness(0.15) sepia(1) hue-rotate(230deg) saturate(4)';
    drawImg(SPR['hero_' + save.gender], sx, sy, 28);
    ctx.filter = 'none';
    ctx.fillStyle = '#d0a0ff';
    ctx.fillRect((sx + 17) * SCALE, (sy + 11) * SCALE, 5, 5); ctx.fillRect((sx + 21) * SCALE, (sy + 11) * SCALE, 5, 5);
    ctx.restore();
  }
  // 동료 (주인공 뒤) · 무기마다 다른 모션, ★3부터 더 크게 움직이고 잔상과 빛
  const tauntIds = new Set(battle.queue.concat(battle.sneak ? [battle.sneak] : []).map(tauntOn).filter(Boolean));
  if (battle.sneak && battle.sneak.dead <= 0 && isWarrior(battle.sneak.target)) tauntIds.add(battle.sneak.target);
  (save.party || []).forEach((id, i) => {
    const x = allyX(i), a = battle.anim && battle.anim[id], hp = battle.ahp && battle.ahp[id];
    const st = allyStar(id), big = st >= 3, kind = MOTION[ALLY_LOOKS[id].weapon] || 'dash';
    const down = hp && hp.hp <= 0;
    let dx = 0, dy = walking ? bob : Math.round(Math.sin(time * 4 + i + 1) * 0.8), rot = 0;
    if (big && (kind === 'cast' || kind === 'play') && !down) dy += -3 + Math.sin(time * 3 + i) * 1.5;      // 떠 있는 자세
    if (a && !down) {
      const pr = a.t / a.dur, s = Math.sin(Math.PI * pr);
      if (kind === 'thrust') dx = s * (big ? 16 : 9);
      else if (kind === 'chop') { dy -= s * (big ? 14 : 8); dx = s * (big ? 12 : 5); rot = Math.sin(pr * Math.PI * 2) * 0.35; }
      else if (kind === 'dash') dx = s * (big ? 22 : 8);
      else if (kind === 'shoot') { dx = -s * 3; rot = -s * 0.12; }
      else if (kind === 'cast') dy -= s * (big ? 8 : 5);
      else { dy -= Math.abs(Math.sin(pr * Math.PI * 2)) * (big ? 6 : 4); rot = Math.sin(pr * Math.PI * 2) * 0.15; }
    }
    shadow(x + 16);
    if (big && !down) {                                       // ★3 빛
      const gr = ctx.createRadialGradient((x + 16) * SCALE, (GROUND - 2) * SCALE, 0, (x + 16) * SCALE, (GROUND - 2) * SCALE, 20 * SCALE);
      gr.addColorStop(0, `rgba(${ALLY_GLOW[allyById(id).type]},${0.35 + 0.15 * Math.sin(time * 4 + i)})`); gr.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = gr; ctx.fillRect((x - 6) * SCALE, (GROUND - 22) * SCALE, 44 * SCALE, 30 * SCALE);
    }
    const img = allyImg(id);
    const draw = (ox, alpha) => {
      ctx.save();
      ctx.globalAlpha *= alpha;
      ctx.translate((x + ox + 16) * SCALE, GROUND * SCALE); ctx.rotate(down ? -1.45 : rot); ctx.translate(-(x + ox + 16) * SCALE, -GROUND * SCALE);
      if (down) ctx.filter = 'grayscale(1)';
      drawImg(img, x + ox, GROUND - 31 + (down ? 6 : dy), 32, hp ? hp.hurt : 0);
      ctx.restore();
    };
    if (down) { ctx.save(); ctx.globalAlpha = 0.55; draw(4, 1); ctx.restore(); }
    else {
      if (big && a) { draw(dx * 0.35, 0.25); draw(dx * 0.7, 0.4); }
      draw(dx, 1);
    }
    if (!down && tauntIds.has(id)) {                           // 도발 중: 붉은 방패 빛
      ctx.save(); ctx.strokeStyle = `rgba(255,120,90,${0.6 + 0.3 * Math.sin(time * 10)})`; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.ellipse((x + dx + 16) * SCALE, (GROUND - 15 + dy) * SCALE, 19 * SCALE, 18 * SCALE, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    }
    if (hp && !walking) hpBar(x + 9, GROUND - 36 + (i % 2) * 2, 14, hp.hp / hp.max, down ? '#777' : '#6fe39a');
  });
  // 이펙트
  const S = SCALE, Y = v => v * S;
  for (const f of battle.fx) {
    if (f.t < 0) continue;
    const pr = Math.min(1, f.t / (f.dur || 0.3));
    const ax = (f.i !== undefined ? allyX(f.i) + 24 : (f.from || hero.x + 24)) * S, ay = Y(GROUND - 20);
    const tx = f.x * S, ty = Y(GROUND - 16);
    ctx.save();
    ctx.lineCap = 'round';
    if (f.kind === 'arrow') {                           // 날아가는 화살 + 꼬리
      const k = Math.min(1, pr / 0.6), px = ax + (tx - ax) * k, py = ay + (ty - ay) * k - Math.sin(k * Math.PI) * 30 + (f.off || 0) * S;
      ctx.globalAlpha = pr < 0.6 ? 1 : 1 - (pr - 0.6) / 0.4;
      ctx.strokeStyle = f.color; ctx.lineWidth = 3; ctx.globalAlpha *= 0.5;
      ctx.beginPath(); ctx.moveTo(px - 50, py + 4); ctx.lineTo(px, py); ctx.stroke();
      ctx.globalAlpha *= 2; ctx.strokeStyle = '#fff6d8'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(px - 18, py + 2); ctx.lineTo(px, py); ctx.stroke();
      ctx.fillStyle = '#d0d8e8'; ctx.beginPath(); ctx.moveTo(px + 8, py); ctx.lineTo(px - 2, py - 5); ctx.lineTo(px - 2, py + 5); ctx.fill();
    } else if (f.kind === 'bolt') {                     // 모으기 → 빛줄기
      if (pr < 0.35) {
        const r = (f.big ? 26 : 16) * (pr / 0.35);
        ctx.fillStyle = f.color; ctx.globalAlpha = 0.6; ctx.beginPath(); ctx.arc(ax, ay - 20, r, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ax, ay - 20, r * 0.45, 0, Math.PI * 2); ctx.fill();
      } else {
        const q2 = (pr - 0.35) / 0.65;
        ctx.globalAlpha = 1 - q2;
        ctx.strokeStyle = f.color; ctx.lineWidth = f.big ? 16 : 10; ctx.shadowColor = f.color; ctx.shadowBlur = 20;
        ctx.beginPath(); ctx.moveTo(ax, ay - 20); ctx.lineTo(tx, ty); ctx.stroke();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = f.big ? 6 : 4;
        ctx.beginPath(); ctx.moveTo(ax, ay - 20); ctx.lineTo(tx, ty); ctx.stroke();
        ctx.fillStyle = f.color; ctx.beginPath(); ctx.arc(tx, ty, (f.big ? 34 : 22) * (0.6 + q2), 0, Math.PI * 2); ctx.fill();
      }
    } else if (f.kind === 'star') {                     // 소녀의 별 마법탄
      const fx0 = f.from * S, fy0 = Y(GROUND - 26), k = Math.min(1, pr / 0.7);
      const px = fx0 + (tx - fx0) * k, py = fy0 + (ty - fy0) * k - Math.sin(k * Math.PI) * 24;
      const r = f.big ? 22 : 14;
      ctx.shadowColor = '#ff7ad0'; ctx.shadowBlur = 20;
      if (pr < 0.7) {
        ctx.fillStyle = 'rgba(255,170,220,0.5)';
        const dr = Math.sign(tx - fx0) || 1;
        for (let n = 1; n <= 4; n++) { ctx.beginPath(); ctx.arc(px - dr * n * 14, py + n * 2, r * (0.5 - n * 0.08), 0, Math.PI * 2); ctx.fill(); }
        ctx.fillStyle = '#ffe0f2'; ctx.translate(px, py); ctx.rotate(time * 12);
        ctx.beginPath(); for (let n = 0; n < 10; n++) { const rr = n % 2 ? r * 0.45 : r, an = n * Math.PI / 5; ctx.lineTo(Math.cos(an) * rr, Math.sin(an) * rr); } ctx.closePath(); ctx.fill();
      } else {
        const q2 = (pr - 0.7) / 0.3;
        ctx.globalAlpha = 1 - q2; ctx.strokeStyle = '#ffb0e0'; ctx.lineWidth = f.big ? 8 : 5;
        ctx.beginPath(); ctx.arc(tx, ty, 10 + q2 * (f.big ? 70 : 44), 0, Math.PI * 2); ctx.stroke();
      }
    } else if (f.kind === 'whirl') {                    // 소년 회오리 베기
      const cx0 = (hero.x + 16) * S, cy0 = Y(GROUND - 15);
      ctx.globalAlpha = 1 - pr; ctx.strokeStyle = '#dff4ff'; ctx.lineWidth = 10; ctx.shadowColor = '#7ac8ff'; ctx.shadowBlur = 20;
      ctx.beginPath(); ctx.ellipse(cx0 + 40, cy0, 110, 40, 0, pr * 8, pr * 8 + 4); ctx.stroke();
    } else if (f.kind === 'taunt') {                    // 도발 충격파
      const fx0 = f.from * S;
      ctx.globalAlpha = 1 - pr; ctx.strokeStyle = '#ff7a5a'; ctx.lineWidth = 5;
      for (let n = 0; n < 3; n++) { const rr = 20 + (pr + n * 0.25) % 1 * 70; ctx.beginPath(); ctx.arc(fx0, Y(GROUND - 18), rr, -0.8, 0.8); ctx.stroke(); }
      ctx.setLineDash([12, 10]); ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(fx0, Y(GROUND - 30)); ctx.lineTo(tx, Y(GROUND - 30)); ctx.stroke();
    } else if (f.kind === 'slash' || f.kind === 'hslash') {   // 베기 궤적
      const r = f.kind === 'hslash' ? (f.big ? 66 : 48) : f.big ? 62 : 44;
      if (f.dash) {                                     // 돌진 속도선
        ctx.globalAlpha = 0.6 * (1 - pr); ctx.strokeStyle = '#dff4ff'; ctx.lineWidth = 3;
        const dr = f.dir || 1;
        for (let n = 0; n < 4; n++) { const yy = ty - 30 + n * 18; ctx.beginPath(); ctx.moveTo(tx - dr * (140 - pr * 40), yy); ctx.lineTo(tx - dr * (60 - pr * 40), yy); ctx.stroke(); }
      }
      ctx.globalAlpha = 1 - pr;
      ctx.strokeStyle = f.color || (f.dash ? '#dff4ff' : '#ffffff'); ctx.lineWidth = f.big ? 12 : 8; ctx.shadowColor = ctx.strokeStyle; ctx.shadowBlur = 14;
      if (f.dir === -1) { ctx.translate(tx, 0); ctx.scale(-1, 1); ctx.translate(-tx, 0); }
      ctx.beginPath(); ctx.arc(tx - 10, ty, r, -1.6 + pr * 1.2, -0.2 + pr * 1.8); ctx.stroke();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(tx - 10, ty, r, -1.4 + pr * 1.2, -0.3 + pr * 1.8); ctx.stroke();
    } else if (f.kind === 'heal') {                     // 초록 십자와 반짝임
      ctx.globalAlpha = 1 - pr;
      for (let k = 0; k < (f.big ? 8 : 5); k++) {
        const px = tx + Math.sin(k * 2.3) * 40, py = Y(GROUND - 10) - pr * 90 - (k % 3) * 20;
        ctx.fillStyle = k % 2 ? '#bfffd0' : '#6fe39a';
        ctx.fillRect(px - 9, py - 3, 18, 6); ctx.fillRect(px - 3, py - 9, 6, 18);
      }
      ctx.strokeStyle = '#9ef0b0'; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(tx, Y(GROUND), 50 * pr + 10, 12 * pr + 4, 0, 0, Math.PI * 2); ctx.stroke();
    } else if (f.kind === 'spark') {                    // 맞은 자리 별빛
      ctx.globalAlpha = 1 - pr; ctx.strokeStyle = f.color; ctx.lineWidth = f.big ? 6 : 4;
      const r1 = 8 + pr * (f.big ? 50 : 32), r2 = r1 * 0.4, cy = Y(f.y);
      for (let k = 0; k < 8; k++) { const an = k * Math.PI / 4 + 0.3; ctx.beginPath(); ctx.moveTo(tx + Math.cos(an) * r2, cy + Math.sin(an) * r2); ctx.lineTo(tx + Math.cos(an) * r1, cy + Math.sin(an) * r1); ctx.stroke(); }
    } else if (f.kind === 'wave') {                     // 검기
      const px = ax + (tx - ax) * pr;
      ctx.globalAlpha = 1 - pr * 0.5; ctx.strokeStyle = '#bfe8ff'; ctx.lineWidth = 8; ctx.shadowColor = '#7ac8ff'; ctx.shadowBlur = 18;
      ctx.beginPath(); ctx.arc(px - 30, ty - 10, 40, -0.9, 0.9); ctx.stroke();
    } else if (f.kind === 'elem') {                     // 삼색 마법
      ctx.shadowColor = f.color; ctx.shadowBlur = 24;
      if (f.e === 'bolt') {
        ctx.globalAlpha = 1 - pr; ctx.strokeStyle = f.color; ctx.lineWidth = 6;
        ctx.beginPath(); ctx.moveTo(tx + 20, 0);
        for (let k = 1; k <= 6; k++) ctx.lineTo(tx + (k % 2 ? -24 : 24) * (1 - k / 7), ty * k / 6);
        ctx.stroke();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(tx, ty, 26 * (1 - pr) + 8, 0, Math.PI * 2); ctx.fill();
      } else {
        const k = Math.min(1, pr / 0.6), px = ax + (tx - ax) * k;
        if (pr < 0.6) {
          ctx.fillStyle = f.color; ctx.beginPath(); ctx.arc(px, ty - 10, 16, 0, Math.PI * 2); ctx.fill();
          ctx.globalAlpha = 0.5; ctx.beginPath(); ctx.arc(px - 22, ty - 8, 10, 0, Math.PI * 2); ctx.fill();
        } else {
          const q2 = (pr - 0.6) / 0.4;
          ctx.globalAlpha = 1 - q2; ctx.fillStyle = f.color;
          if (f.e === 'fire') { ctx.beginPath(); ctx.arc(tx, ty - 10, 20 + q2 * 50, 0, Math.PI * 2); ctx.fill(); }
          else for (let n = 0; n < 6; n++) { const an = n * Math.PI / 3; ctx.save(); ctx.translate(tx + Math.cos(an) * q2 * 50, ty - 10 + Math.sin(an) * q2 * 50); ctx.rotate(an); ctx.fillRect(-10, -4, 20, 8); ctx.restore(); }
        }
      }
    } else if (f.kind === 'shadowhit') {
      ctx.globalAlpha = 1 - pr; ctx.strokeStyle = '#b48cff'; ctx.lineWidth = 6; ctx.shadowColor = '#6a2aa0'; ctx.shadowBlur = 16;
      ctx.beginPath(); ctx.moveTo(tx - 30, ty - 30 + pr * 20); ctx.lineTo(tx + 20, ty + 10); ctx.stroke();
    } else if (f.kind === 'mheal') {                    // 몬스터 치유사
      ctx.globalAlpha = 1 - pr; ctx.strokeStyle = '#6fe39a'; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.ellipse(tx, Y(GROUND), 30 + pr * 160, 8 + pr * 20, 0, 0, Math.PI * 2); ctx.stroke();
    } else if (f.kind === 'curse') {                    // 저주 구슬이 주인공에게
      const fx = f.from * S, px = fx + (tx - fx) * pr;
      ctx.fillStyle = '#9a40e0'; ctx.shadowColor = '#c070ff'; ctx.shadowBlur = 20;
      ctx.beginPath(); ctx.arc(px, Y(GROUND - 30) - Math.sin(pr * Math.PI) * 50, 14, 0, Math.PI * 2); ctx.fill();
    } else if (f.kind === 'smoke') {                    // 암살자 연막
      ctx.globalAlpha = 0.8 * (1 - pr); ctx.fillStyle = '#5a5a6a';
      for (let k = 0; k < 6; k++) { ctx.beginPath(); ctx.arc(tx + Math.cos(k) * pr * 50, Y(GROUND - 14) - pr * 30 + Math.sin(k * 2) * 20, 20 + pr * 20, 0, Math.PI * 2); ctx.fill(); }
    } else if (f.kind === 'raise') {                    // 강령술: 초록 빛기둥
      ctx.globalAlpha = 1 - pr; ctx.fillStyle = '#7dff9a'; ctx.shadowColor = '#3ad060'; ctx.shadowBlur = 24;
      ctx.fillRect(tx - 18, Y(GROUND) - pr * 260, 36, pr * 260);
      ctx.beginPath(); ctx.ellipse(tx, Y(GROUND), 50, 12, 0, 0, Math.PI * 2); ctx.fill();
    } else if (f.kind === 'hypno') {                    // 최면 소용돌이
      ctx.globalAlpha = 1 - pr; ctx.strokeStyle = '#ff9ae0'; ctx.lineWidth = 4;
      ctx.beginPath(); for (let a = 0; a < 18; a += 0.3) ctx.lineTo(tx + Math.cos(a + pr * 8) * a * 3, Y(GROUND - 50) + Math.sin(a + pr * 8) * a * 3); ctx.stroke();
    }
    ctx.restore();
  }
  // 저주·봉인 표시
  if (battle.curse > 0) {
    ctx.save(); ctx.strokeStyle = `rgba(190,100,255,${0.5 + 0.3 * Math.sin(time * 8)})`; ctx.lineWidth = 4;
    for (let k = 0; k < 3; k++) { const an = time * 3 + k * 2.1; ctx.beginPath(); ctx.arc(Y(hx + 16) + Math.cos(an) * 50, Y(GROUND - 34) + Math.sin(an) * 14, 8, 0, Math.PI * 2); ctx.stroke(); }
    ctx.restore();
  }
  if (battle.seal > 0) {
    ctx.save();
    const gr = ctx.createRadialGradient(cv.width / 2, cv.height / 2, cv.height * 0.3, cv.width / 2, cv.height / 2, cv.height * 0.9);
    gr.addColorStop(0, 'rgba(60,0,40,0)'); gr.addColorStop(1, `rgba(120,0,60,${0.45 + 0.1 * Math.sin(time * 6)})`);
    ctx.fillStyle = gr; ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.fillStyle = '#ffb0c8'; ctx.font = '900 34px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(`⛓ 특성 봉인 ${Math.ceil(battle.seal)}초`, cv.width / 2, 150);
    ctx.restore();
  }

  // 뒤에서부터 그려서 앞 몬스터가 위에 오게
  for (let i = battle.queue.length - 1; i >= 0; i--) {
    const m = battle.queue[i];
    const size = m.size || (m.boss ? 44 : 32);
    const wob = Math.round(Math.sin(time * (m.king ? 3 : 6) + i) * (m.king ? 2 : 1));
    const warn = m.king && battle.mechWarn ? 0.5 + 0.5 * Math.sin(time * 24) : 0;
    ctx.save();
    if (m.dead > 0) ctx.globalAlpha = m.dead * 2;
    shadow(m.x + size / 2, m.king ? 26 : m.boss ? 15 : 11);
    if (m.slow > 0) ctx.filter = 'hue-rotate(160deg) saturate(1.4)';
    else if (m.undead) ctx.filter = 'grayscale(0.6) sepia(0.5) hue-rotate(60deg) brightness(0.85)';
    drawImg(face(m.sprite), m.x + (m.kb || 0), GROUND - size + 1 + wob, size, Math.max(m.hurt, warn));
    ctx.restore();
    if (m.dead <= 0) drawMonMarks(m, size);
    if (i === 0 && m.dead <= 0 && !battle.dungeon) {
      hpBar(m.x + 2, GROUND - size - 5, size - 4, m.hp / m.maxHp, '#ff6b7a');
      label(m.name + (ALIGN[m.align] && !m.name.includes(ALIGN[m.align][0]) ? ' · ' + ALIGN[m.align][0] : '') + (BODY[m.body] ? ' · ' + BODY[m.body].name : ''), m.x + size / 2, GROUND - size - 9, m.role ? ROLES[m.role].color : m.boss ? '#ffb0b8' : '#fff');
    }
    if (i === 0 && battle.dungeon) label(m.name, m.x + size / 2, GROUND - size - 4, '#ffe9a8');
  }
  if (heroOnTop) paintHero();
  // 뒤로 잠입한 암살자 (오른쪽을 봄)
  const sn = battle.sneak;
  if (sn) {
    const sx = sn.x + (sn.lunge || 0) * 6;
    ctx.save();
    if (sn.dead > 0) ctx.globalAlpha = sn.dead * 2;
    shadow(sx + 16, 11);
    ctx.translate((sx + 16) * SCALE * 2, 0); ctx.scale(-1, 1);
    drawImg(face(sn.sprite), sx, GROUND - 31, 32, sn.hurt);
    ctx.restore();
    if (sn.dead <= 0) { drawMonMarks(sn, 32); hpBar(sx + 2, GROUND - 37, 28, sn.hp / sn.maxHp, '#ff6b7a'); label(sn.name, sx + 16, GROUND - 41, ROLES.assassin.color); }
  }
  drawFloats(floats);
  const pos = { hero: [hx + 16, GROUND - 36] };
  (save.party || []).forEach((id, i) => { pos[id] = [allyX(i) + 16, GROUND - 40]; });
  drawBubbles(pos);
}

let camX = 0;            // 배경 카메라 위치 (웨이브 사이에 앞으로 걸어가면 커진다)
let lastDt = 0;

function render() {
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.save();
  if (shake > 0) ctx.translate((Math.random() - 0.5) * 18 * shake, (Math.random() - 0.5) * 12 * shake);
  Scenery.setTheme(chapter(screen === 'battle' && battle ? chOf(battle.stage) : campChapter()).theme);
  Scenery.drawBack(ctx, camX, time);
  if (screen === 'battle' && battle) renderBattle(); else renderLobby();
  Scenery.drawFront(ctx, camX, time, lastDt);
  ctx.restore();
}

// ── 화면 글자 ───────────────────────────────
function updateHud() {
  if (save.traitReset) { delete save.traitReset; setTimeout(() => fanfare('특성 개편!', '포인트 전부 반환 · 특성 탭에서 새로 배치'), 900); }
  const s = stats;
  const c = campChapter(), top = topStage();
  const allDone = bossBeaten(CHAPTERS.length);
  const atBoss = bossOpen(c) && !bossBeaten(c);
  $('lStage').textContent = allDone ? `챕터 ${c} · 완료` : atBoss ? `챕터 ${c} · 보스` : `챕터 ${c} · ${localOf(top)} / ${STAGES_PER}`;
  $('lGold').textContent = Math.floor(save.gold).toLocaleString('ko-KR');
  $('lShards').textContent = save.shards || 0;
  $('lDust').textContent = fmt(save.dust || 0);
  $('dunLeft').textContent = `${dunLeft('gold') + dunLeft('gear')}/${DUNGEON_TRIES * 2}`;
  updateMissionBanner();
  $('lBattleSub').textContent = allDone ? '스테이지 선택' : atBoss ? '👑 챕터 보스 도전' : `${chapter(c).name} ${stageLabel(top)}`;
  $('lName').textContent = `Lv ${heroLevel()} ${save.name}`;
  const tb = $('traitBtn');
  tb.classList.toggle('lock', !traitsOpen());
  tb.querySelector('small').textContent = traitsOpen() ? '' : '잠김';
  updateDots();
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
    c.clearRect(0, 0, 72, 60);
    c.drawImage(full ? SPR.chest_full : SPR.chest, 0, 0, 72, 60);
  }
}

function updateBattleHud() {
  if (!battle) return;
  $('waves').hidden = !!battle.king;
  $('bStage').textContent = battle.dungeon ? `🏰 일일 던전 · ${DUNGEONS.find(x => x.id === battle.dungeon).name}` : battle.king ? `👑 챕터 보스 · ${chapter(battle.ch).boss.name}` : `${chapter(chOf(battle.stage)).name} ${stageLabel(battle.stage)}`;
  if (!battle.king) $('bWave').textContent = `웨이브 ${battle.wave + 1} / ${WAVES.length}` + (battle.wave === WAVES.length - 1 ? ' · 대장 등장!' : '') + ` · 몬스터 치명타 저항 ${critRes(battle.stage).toFixed(1)}%`;
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
  if (battle && battle.king) {
    const s = Math.ceil(battle.timeLeft);
    if (battle.dungeon) $('bWave').textContent = `남은 시간 ${s}초 · 준 피해 ${fmt(battle.dealt)}`;
    else $('bWave').textContent = `제한 시간 ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')} · ${chapter(battle.ch).boss.mechName} ${Math.max(0, battle.mechCd).toFixed(1)}초 후`;
  }
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
  if (name === 'lobby') { battle = null; endDialog(true); bubbles = []; refreshStats(); }
  updateHud();
  updateBattleHud();
}

// ── 팝업: 강화, 상점 ─────────────────────────
let modalKind = null;

function openModal(kind) {
  if (kind === 'allies') return openAllies();
  if (kind === 'traits') return openTraits();
  if (kind === 'missions') return openPanel('missions', '미션');
  if (kind === 'gacha') return openPanel('gacha', '뽑기');
  if (kind === 'dungeon') return openPanel('dungeon', '일일 던전');
  if (kind === 'up') powerGain = 0;
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

function closeModal() { $('modal').hidden = true; modalKind = null; document.querySelector('.mbox').classList.remove('wide'); }

function potionPrice() { return monGold(save.stage) * 6; }

function refreshModal() {
  $('mGold').innerHTML = '보유 골드 ' + Math.floor(save.gold).toLocaleString('ko-KR') + ' G' + (modalKind === 'up' ? ` · 전투력 ${fmt(power(stats))}${powerGain > 0 ? ` <em class="pgain">▲ ${fmt(powerGain)}</em>` : ''}` : '');
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
  } else if (modalKind === 'missions') {
    refreshMissions();
  } else if (modalKind === 'gacha' && gachaTab === 'ally') {
    $('pBody').innerHTML = `<div class="gtabs"><button data-gt="gear">장비</button><button class="on">동료</button></div><div class="gtop">보유 별가루 <b>${fmt(save.dust)}</b></div>
      <div class="grates">${[1, 2, 3].map(r => `<span style="color:${RARITY[r].color}">${RARITY[r].stars} ${RARITY[r].name} ${AGACHA_W[r]}%</span>`).join('')}</div>
      <div class="gbtns"><button id="a1" ${save.dust < AGACHA_COST ? 'disabled' : ''}>1회 뽑기<small>별가루 ${AGACHA_COST}</small></button>
      <button id="a10" ${save.dust < AGACHA10_COST ? 'disabled' : ''}>10회 뽑기<small>별가루 ${AGACHA10_COST} · 희귀 이상 1명 보장</small></button></div>
      <p class="note">전설 확정까지 ${APITY - (save.apity || 0)}회 · 중복은 각성 조각</p>`;
    $('a1').onclick = () => doAllyGacha(1);
    $('a10').onclick = () => doAllyGacha(10);
    $('pBody').querySelector('[data-gt]').onclick = () => { gachaTab = 'gear'; refreshModal(); };
  } else if (modalKind === 'gacha') {
    $('pBody').innerHTML = `<div class="gtabs"><button class="on">장비</button><button data-gt="ally">동료</button></div><div class="gtop">보유 별가루 <b>${fmt(save.dust)}</b></div>
      <div class="grates">${GRADES.map((G, i) => GACHA_W[i] ? `<span style="color:${G.color}">${G.name} ${(GACHA_W[i] / 10).toFixed(1)}%</span>` : '').join('')}</div>
      <div class="gbtns"><button id="g1" ${save.dust < GACHA_COST ? 'disabled' : ''}>1회 뽑기<small>별가루 ${GACHA_COST}</small></button>
      <button id="g10" ${save.dust < GACHA10_COST ? 'disabled' : ''}>10회 뽑기<small>별가루 ${GACHA10_COST} · 희귀 이상 1개 보장</small></button></div>
      <p class="note">지금 스테이지 수준의 장비 · 별가루는 미션, 일일 던전, 챕터 보스에서 획득</p>`;
    $('g1').onclick = () => doGacha(1);
    $('g10').onclick = () => doGacha(10);
    $('pBody').querySelector('[data-gt]').onclick = () => { gachaTab = 'ally'; refreshModal(); };
  } else if (modalKind === 'dungeon') {
    $('pBody').innerHTML = DUNGEONS.map(D => `<div class="up dun"><div class="nm"><img class="gicon" src="${ICON_URL[D.sprite]}">${D.name}<small>남은 횟수 ${dunLeft(D.id)} / ${DUNGEON_TRIES}</small></div>
      <div class="val">${D.desc} · 하루 ${DUNGEON_TRIES}번</div><button data-dun="${D.id}" ${dunLeft(D.id) <= 0 ? 'disabled' : ''}>입장</button></div>`).join('')
      + '<p class="note">자정에 횟수 초기화 · 지금 진행 중인 스테이지 수준으로 보상</p>';
    $('pBody').querySelectorAll('[data-dun]').forEach(b => b.onclick = () => { closeModal(); startDungeon(b.dataset.dun); });
  } else if (modalKind === 'traits') {
    refreshTraits();
  } else if (modalKind === 'allies') {
    refreshAllies();
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
        <div class="nm">${icon(it.slot)}<span style="color:${GRADES[it.grade].color}">${GRADES[it.grade].name} ${itemName(it)}</span>${better ? '<em class="better">▲</em>' : ''}<small>${stageLabel(it.stage)}</small></div>
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
  const p0 = power(stats);
  save.lv[u.id]++;
  refreshStats();
  powerGain += power(stats) - p0;
  track('upgrades');
  updateHud();
  return true;
}
let powerGain = 0;          // 강화창에 보여 줄 전투력 상승량 (창을 열 때 0으로)

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
  return `스테이지 ${stageLabel(Math.min(s.stage, MAX_STAGE))} · 골드 ${fmt(s.gold)} · 공격력 Lv ${s.lv.atk}<br>마지막 저장 ${s.savedAt ? hhmm(s.savedAt) : '-'}`;
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
  $('mBody').innerHTML = `<div class="mgold" id="mGold"></div>
    <div class="up charset"><div class="nm">캐릭터</div>
      <div class="val"><input id="setName" maxlength="8" value="${esc(save.name)}">
        <span class="gpick"><button data-sg="m" class="${save.gender === 'm' ? 'on' : ''}">소년</button><button data-sg="f" class="${save.gender === 'f' ? 'on' : ''}">소녀</button></span></div>
      <button id="saveChar">변경</button></div>
    <div class="up"><div class="nm">소리</div><div class="val">배경음악 · 버튼 효과음</div>
      <div class="skbtns"><button id="tBgm" class="equip${Sound.bgm ? ' on' : ''}">음악 ${Sound.bgm ? '켜짐' : '꺼짐'}</button><button id="tSfx" class="equip${Sound.sfx ? ' on' : ''}">효과음 ${Sound.sfx ? '켜짐' : '꺼짐'}</button></div></div>
    <div id="devSlot"></div><div id="setBody"></div>`;
  $('tBgm').onclick = () => { const on = Sound.toggle('bgm'); $('tBgm').textContent = '음악 ' + (on ? '켜짐' : '꺼짐'); $('tBgm').classList.toggle('on', on); };
  $('tSfx').onclick = () => { const on = Sound.toggle('sfx'); $('tSfx').textContent = '효과음 ' + (on ? '켜짐' : '꺼짐'); $('tSfx').classList.toggle('on', on); };
  let gender = save.gender;
  $('mBody').querySelectorAll('[data-sg]').forEach(b => b.onclick = () => {
    gender = b.dataset.sg;
    $('mBody').querySelectorAll('[data-sg]').forEach(x => x.classList.toggle('on', x === b));
  });
  $('saveChar').onclick = () => {
    const name = $('setName').value.trim();
    if (!name) return alert('이름 입력 필요');
    save.name = name;
    save.gender = gender;
    drawBattleIcon();
    writeSave();
    cloudUpload();
    updateHud();
    notify('변경 완료!');
  };
  $('setName').onkeydown = e => { if (e.key === 'Enter' && !e.isComposing) $('saveChar').click(); };
  $('modal').hidden = false;
  refreshSettings();
  devTools();
}

function drawBattleIcon() {
  const ic = $('battleIcon').getContext('2d');
  ic.clearRect(0, 0, 96, 96);
  ic.drawImage(SPR['hero_' + save.gender], 0, 0, 96, 96);
}

function refreshSettings() {
  $('lPower').textContent = jobTitle() + ' · 전투력 ' + fmt(power(stats)) + (cloudOn() ? ' · ☁ 클라우드' : '');
  if (modalKind !== 'settings') return;
  const u = window.Cloud && window.Cloud.user;
  let acct;
  if (TEST) acct = '<p class="note">테스트 모드 · 클라우드 저장 꺼짐</p>';
  else if (!window.Cloud) acct = '<p class="note">로그인 기능 불러오는 중…</p>';
  else if (u && u.isAnonymous) acct = `<div class="up"><div class="nm">게스트 계정<small>이 브라우저에만 저장</small></div>
      <div class="val">구글·이메일 계정 연결 시 다른 기기에서도 이어서 플레이${cloudMsg ? ' · <span style="color:var(--bad)">' + cloudMsg + '</span>' : ''}</div>
      <div class="skbtns"><button id="linkG">구글 연결</button><button id="linkE" class="plain">이메일 연결</button></div></div>`;
  else if (u) acct = `<div class="up"><div class="nm">${u.providerData.some(x => x.providerId === 'google.com') ? '구글' : '이메일'} 계정<small>${esc(u.email || '')}</small></div>
      <div class="val">클라우드 저장 켜짐 · ${cloudChoice ? '세이브 선택 대기' : cloudBusy ? '동기화 중…' : cloudAt ? '마지막 저장 ' + hhmm(cloudAt) : '대기 중'}${cloudMsg ? ' · ' + cloudMsg : ''}</div>
      <button id="cloudOut" class="plain">로그아웃</button></div>`;
  else acct = `<div class="up"><div class="nm">클라우드 저장<small>꺼짐</small></div>
      <div class="val">구글 로그인 시 다른 기기에서도 이어서 플레이${cloudMsg ? ' · <span style="color:var(--bad)">' + cloudMsg + '</span>' : ''}</div>
      <button id="cloudIn">구글로 로그인</button></div>`;
  $('setBody').innerHTML = acct + `
    <div class="up"><div class="nm">처음부터 하기</div><div class="val">이 기기의 진행 상황 삭제</div><button id="resetBtn" class="danger">초기화</button></div>
    <p class="note"><a href="privacy.html" target="_blank">개인정보처리방침</a> · 배경음악: Pixabay (kaazoom, nojisuma, geoffharvey, phatphrogstudio)</p>`;
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
  if ($('linkG')) $('linkG').onclick = async () => {
    cloudMsg = '';
    try { await window.Cloud.linkGoogle(); cloudMsg = '구글 연결 완료'; } catch (e) { cloudMsg = authError(e); }
    refreshSettings(); cloudUpload();
  };
  if ($('linkE')) $('linkE').onclick = async () => {
    const em = prompt('연결할 이메일');
    if (!em) return;
    const pw = prompt('사용할 비밀번호 (6자 이상)');
    if (!pw) return;
    cloudMsg = '';
    try { await window.Cloud.linkEmail(em.trim(), pw); cloudMsg = '이메일 연결 완료'; } catch (e) { cloudMsg = authError(e); }
    refreshSettings(); cloudUpload();
  };
}

// ── 개발자 도구 ──
// 테스트 모드(?test)이거나 개발자 계정으로 로그인했을 때만 설정 화면에 나온다. 계정은 이메일의 SHA-256 값으로만 비교
const DEV_HASH = '410f5af8785efc48318b3aacfa7c970eb181d864cb673464afcea3bad172a571';
async function isDev() {
  if (TEST) return true;
  const u = window.Cloud && window.Cloud.user;
  if (!u || !u.email || !(window.crypto && crypto.subtle)) return false;
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(u.email.trim().toLowerCase()));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('') === DEV_HASH;
}
async function devTools() {
  if (!(await isDev()) || modalKind !== 'settings' || !$('devSlot') || $('devBox')) return;
  const box = document.createElement('div');
  box.className = 'up dev'; box.id = 'devBox';
  const f = (id, label, v, max) => `<label>${label}<input id="${id}" type="number" min="${id === 'dvStage' ? 1 : 0}" ${max ? `max="${max}"` : ''} value="${Math.floor(v)}"></label>`;
  box.innerHTML = `<div class="nm">개발자 도구<small>${TEST ? '테스트 모드' : '개발자 계정'}</small></div>
    <div class="devgrid">${f('dvGold', '골드', save.gold)}${f('dvDust', '별가루', save.dust)}${f('dvShards', '별조각', save.shards || 0)}${f('dvPot', '물약', save.potions)}${f('dvStage', '도달 스테이지', save.stage, MAX_STAGE + 1)}</div>
    <div class="skbtns"><button id="dvApply">적용</button><button id="dvAllies" class="plain">모든 동료 획득</button><button id="dvCopies" class="plain">동료 조각 +5</button><button id="dvDaily" class="plain">일일 초기화</button></div>
    <p class="note" id="dvMsg">도달 스테이지를 다음 챕터로 올리면 앞 챕터 보스도 처치한 것으로 바뀜</p>`;
  $('devSlot').appendChild(box);
  // 빈 칸이나 잘못된 숫자는 적용하지 않는다
  const num = (id, min, max) => {
    const el = $(id), raw = el.value.trim();
    if (raw === '' || el.validity.badInput) return null;
    const v = Math.floor(Number(raw));
    return Number.isFinite(v) ? Math.min(max ?? Infinity, Math.max(min, v)) : null;
  };
  const sync = () => [['dvGold', save.gold], ['dvDust', save.dust], ['dvShards', save.shards || 0], ['dvPot', save.potions], ['dvStage', save.stage]]
    .forEach(([id, v]) => { if ($(id) && document.activeElement !== $(id)) $(id).value = Math.floor(v); });
  const done = msg => { refreshStats(); updateHud(); writeSave(); cloudUpload(); sync(); if ($('dvMsg')) $('dvMsg').textContent = msg; };
  $('dvApply').onclick = () => {
    const gold = num('dvGold', 0), dust = num('dvDust', 0), sh = num('dvShards', 0), pot = num('dvPot', 0), st = num('dvStage', 1, MAX_STAGE + 1);
    if ([gold, dust, sh, pot, st].some(v => v === null)) return ($('dvMsg').textContent = '빈 칸 없이 숫자 입력 필요');
    save.astar = save.astar || {}; save.acopy = save.acopy || {};
    Object.assign(save, { gold, dust, shards: sh, potions: pot });
    if (st !== save.stage) {
      save.stage = st;
      for (const c of Object.keys(save.bosses)) if (st <= c * STAGES_PER) delete save.bosses[c];   // 아직 못 가는 챕터 보스는 처치 기록 삭제
      for (let c = 1; c < chOf(Math.min(st, MAX_STAGE)); c++) {
        if (!save.bosses[c]) { save.bosses[c] = true; const id = CHAPTERS[c - 1].boss.ally; if (id) gainAlly(id); }
      }
      save.seenCh = Math.max(save.seenCh || 1, chOf(Math.min(st, MAX_STAGE)));
    }
    done('적용 완료');
  };
  $('dvAllies').onclick = () => { save.astar = save.astar || {}; ALLIES.forEach(A => { if (!save.allies[A.id]) { save.allies[A.id] = 1; save.astar[A.id] = 1; } }); done('동료 20명 획득 완료'); };
  $('dvCopies').onclick = () => { save.acopy = save.acopy || {}; Object.keys(save.allies).forEach(id => { if (allyById(id)) save.acopy[id] = (save.acopy[id] || 0) + 5; }); done('조각 +5 지급 완료'); };
  $('dvDaily').onclick = () => { save.daily = null; ensureDaily(); done('일일 미션·던전 초기화 완료'); };
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

// 로그인 오류 문구
function authError(e) {
  return ({
    'auth/invalid-email': '이메일 형식 오류',
    'auth/missing-password': '비밀번호 입력 필요',
    'auth/weak-password': '비밀번호는 6자 이상',
    'auth/email-already-in-use': '이미 가입된 이메일 · 로그인 필요',
    'auth/invalid-credential': '이메일 또는 비밀번호 불일치',
    'auth/user-not-found': '가입되지 않은 이메일',
    'auth/wrong-password': '비밀번호 불일치',
    'auth/too-many-requests': '시도가 너무 많음 · 잠시 후 다시',
    'auth/popup-blocked': '팝업 차단됨 · 팝업 허용 필요',
    'auth/credential-already-in-use': '이미 다른 진행에 연결된 계정',
    'auth/provider-already-linked': '이미 연결된 계정',
    'auth/operation-not-allowed': '이 로그인 방식이 아직 꺼져 있음',
  })[e.code] || (e.code === 'auth/popup-closed-by-user' || e.code === 'auth/cancelled-popup-request' ? '' : '로그인 실패');
}

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
    c.clearRect(0, 0, 96, 96);
    c.drawImage(SPR['hero_' + g], 0, 0, 96, 96);
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
  for (const id of ['slime', 'mushroom', 'bee', 'slime_king', 'wisp', 'toadstool', 'sprout', 'treant', 'miru', 'serin', 'kai', 'cactus', 'scorpion', 'mummy', 'scorpion_queen', 'gold_slime', 'golem']) ICON_URL[id] = SPR[id].toDataURL ? SPR[id].toDataURL() : SPR[id].src;
  for (const sl of GEAR_SLOTS) {
    const img = SPR['icon_' + sl.id];
    ICON_URL[sl.id] = img.toDataURL ? img.toDataURL() : img.src;
  }
  accrue();
  refreshStats();
  $('game').hidden = false;
  drawBattleIcon();
  document.querySelectorAll('.picon').forEach(c => c.getContext('2d').drawImage(SPR.potion, 0, 0, c.width, c.height));

  $('toBattle').onclick = () => openStages();
  $('missionBtn').onclick = () => { if (!claimMain()) openModal('missions'); };
  ensureDaily();
  $('retreat').onclick = () => {
    if (battle && battle.state === 'fight') endBattle('retreat');
    else showScreen('lobby');
  };
  $('chestBtn').onclick = collectChest;
  $('potionBtn').onclick = usePotion;
  $('dBox').onclick = dialogNext;
  $('dSkip').onclick = () => endDialog();
  document.addEventListener('keydown', e => {
    if (dlg && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); dialogNext(); return; }
    if (screen !== 'battle' || dlg) return;
    if (e.key === 'q' || e.key === 'Q' || e.key === 'ㅂ') usePotion();
    if (e.key >= '1' && e.key <= String(SKILL_SLOTS)) castSkill(+e.key - 1, false);
  });
  document.querySelectorAll('[data-open]').forEach(b => b.onclick = () => openModal(b.dataset.open));
  $('mClose').onclick = closeModal;
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('modal').hidden) closeModal(); });
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
    lastDt = dt;
    if (screen === 'battle') { updateBattle(dt); updateBattleBars(); }
    dialogTick(dt);
    updateBubbles(dt);
    updateMood();
    shake = Math.max(0, shake - dt);
    tick += dt;
    if (tick > 0.25) {
      tick = 0; accrue(); updateChest(); updateShopTimer();
      const inBattle = screen === 'battle' && battle;
      Sound.setScene(chapter(inBattle ? chOf(battle.stage) : campChapter()).theme, inBattle ? (battle.king ? 'boss' : 'battle') : 'camp');
    }
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
  Scenery.build();
  spritesReady = true;
  claimTab();
  if (TEST) {                              // 테스트: 로그인 없이 브라우저 저장만
    save = readSave();
    if (save) begin(); else showStart();
    return;
  }
  const tryLogin = async fn => {
    $('loginMsg').textContent = '';
    try { await fn(); } catch (e) { console.warn(e); $('loginMsg').textContent = authError(e); }
  };
  $('loginBtn').onclick = () => tryLogin(() => window.Cloud.signIn());
  $('emailOpen').onclick = () => { $('emailForm').hidden = !$('emailForm').hidden; };
  $('emLogin').onclick = () => tryLogin(() => window.Cloud.emailIn($('emIn').value.trim(), $('pwIn').value));
  $('emJoin').onclick = () => tryLogin(() => window.Cloud.emailUp($('emIn').value.trim(), $('pwIn').value));
  $('emReset').onclick = e => {
    e.preventDefault();
    const em = $('emIn').value.trim();
    if (!em) return ($('loginMsg').textContent = '이메일 입력 필요');
    tryLogin(async () => { await window.Cloud.resetPw(em); $('loginMsg').textContent = '비밀번호 재설정 메일 발송 완료'; });
  };
  $('guestBtn').onclick = () => {
    if (!confirm('게스트로 시작\n이 브라우저에만 계정이 묶임 · 나중에 설정에서 구글·이메일 계정으로 연결 가능')) return;
    tryLogin(() => window.Cloud.guest());
  };
  Sound.setScene('title', 'camp');
  if (window.Cloud) {                      // cloud.js가 먼저 준비됐으면 지금 상태로 시작
    if (window.Cloud.ready) window.Cloud.user ? afterLogin(window.Cloud.user) : showLogin();
    else showLogin('checking');
  } else showLogin('checking');
});
