// 별의 설화 — 로비(캠프·방치 상자·강화·상점) + 전투(웨이브 3개 스테이지 도전)
'use strict';

const LANG_KEY = 'starTale.language.v1';
function getLanguage() { try { return localStorage.getItem(LANG_KEY) === 'en' ? 'en' : 'ko'; } catch (_) { return 'ko'; } }
function setLanguage(lang) { lang = lang === 'en' ? 'en' : 'ko'; try { localStorage.setItem(LANG_KEY, lang); } catch (_) {} document.documentElement.lang = lang; if (window.StarI18n) window.StarI18n.setLanguage(lang); if (modalKind === 'settings') openSettings(); }
const LANG = { ko:{settings:'설정',language:'언어 / Language',korean:'한국어',english:'English',leader:'리더',leaderHelp:'주인공 없이 동료들이 싸움 · 강화는 캐릭터마다 따로 · 장비·특성·전직·스킬·물약은 리더에게 적용 · 모두 쓰러지면 패배',changeLeader:'리더 바꾸기',sound:'소리',bgm:'음악',sfx:'효과음',on:'켜짐',off:'꺼짐'}, en:{settings:'Settings',language:'Language / 언어',korean:'한국어',english:'English',leader:'Leader',leaderHelp:'Allies fight without a separate protagonist. Upgrades are character-specific; gear, traits, class, skills and potions apply to the leader. Defeat occurs when everyone falls.',changeLeader:'Change leader',sound:'Sound',bgm:'Music',sfx:'Sound effects',on:'On',off:'Off'} };
function tr(key) { return (LANG[getLanguage()] || LANG.ko)[key] || key; }

// 주소에 ?test를 붙이면 테스트용 저장을 따로 쓴다 (진짜 진행을 건드리지 않음)
const TEST = new URLSearchParams(location.search).has('test');
const SAVE_BASE = 'starTale.save.v1';
let SAVE_KEY = SAVE_BASE + (TEST ? '.test' : '');   // 로그인하면 계정별 키로 바뀐다 (useAccountKey)
const STAGES_PER = 20;      // 챕터마다 스테이지 20개 (스테이지 번호는 전체 번호: 2-1 = 21)
const SCALE = 3;            // 320×180 도트 화면을 960×540으로 키워 그림
const GROUND = 140;
let WAVES = [3, 3, 4];    // 웨이브별 몬스터 수. 마지막 웨이브의 마지막은 대장
let WAVE_HEAL = 0.5;      // 웨이브를 깨면 최대 체력의 50% 회복
let POTION_HEAL = 0.4;
let POTION_CD = 15;       // 물약 사용 텀(초)
let POTION_MAX = 20;
let IDLE_CAP_HOURS = 8;
let BOSS_TIME = 60;       // 챕터 보스 제한 시간(초)
const MECH_WARN = 1.2;      // 보스 특수 공격 전 경고 시간
const ROOT_TIME = 2;        // 뿌리 감옥에 묶여 있는 시간
let REPLAY_BONUS = 0.3;   // 이미 깬 스테이지의 클리어 보상 비율
let SHARD_BONUS = 0.1;    // 별조각 1개당 공격력·체력 +10%
const REFLECT_CAP = 0.02;   // 어둠의 힘 반발: 한 번에 리더 최대 체력의 2%까지

// 밸런스 숫자 (시뮬레이션으로 맞춤)
// 성장 방식 mode: 1 = 더하기 (2026-10-17~) 강화 1레벨마다 공격력 +upAtk·체력 +upHp 로 같은 양씩, 비용은 지수로 커짐 → 후반일수록 가성비 낮음.
//   몬스터는 monHpA × (1 + hpAddA × (스테이지-1))^hpPowA × 챕터 배율 chA (다항식) · 챕터 보스 배율 kingA
//   값: dev/star-sim/experiments/fitadd.js (옛 방식과 같은 처치 시간) → dev/star-tune/seqtune.py (챕터마다 옛 방식 시간에 맞춤) → 보스 손질. 시드 5개 1부 2:07~2:51
// mode: 0 = 곱하기 (옛 방식, 되돌리기용) 강화 1레벨마다 ×1.06, 몬스터는 스테이지마다 ×hpGrow (아래 monHp~atkGrow3·ch·king)
// 물약·스킬·장비 없이 시뮬레이션: 챕터 1 약 70분, 챕터 2 약 110분 (챕터 2부터 성장률 완만)
const BAL = { mode: 1, upAtk: 3, upHp: 25, monHpA: 2.76, hpAddA: 0.359, hpPowA: 3.56, monAtkA: 4.3, atkAddA: 0.0692, atkPowA: 3.98,
  chA: { 1: [1.499, 1.922], 2: [1.625, 3.049], 3: [0.673, 0.66], 4: [1.11, 0.481], 5: [1.506, 0.427], 6: [1.413, 0.535], 7: [0.688, 1.413], 8: [0.427, 1.035], 9: [1.525, 0.996], 10: [0.301, 0.841] },
  kingA: { 1: [1.492, 2.525], 2: [0.502, 0.4], 3: [1, 0.716], 4: [0.664, 0.553], 5: [0.378, 0.657], 6: [0.535, 2.17], 7: [0.247, 0.978], 8: [0.235, 0.795], 9: [0.309, 0.874], 10: [0.393, 0.337] },
  allHp: 1, allAtk: 1, allGold: 1, idleOn: 1, monAspd: 0.8, critStep: 1.5, critMax: 60, awayDust: 16, monHp: 30, hpGrow: 1.55, monAtk: 5, atkGrow: 1.45, monGold: 3, goldGrow: 1.22, bossHp: 4, bossAtk: 1.6, bossGold: 5, idle: 0.22, clearBonus: 5, hpGrow2: 1.25, atkGrow2: 1.22, kingHp: 20, kingAtk: 0.6, kingGold: 30, hpGrow3: 1.23, atkGrow3: 1.21,
  ch: { 4: [1.55, 1], 5: [1.75, 1], 6: [2.2, 1], 7: [1.65, 1], 8: [1.15, 1], 9: [2.1, 1], 10: [0.3, 1] },
  king: { 4: [1, 1], 5: [0.5, 1], 6: [1, 1], 7: [0.32, 1], 8: [0.18, 1], 9: [0.26, 1], 10: [0.27, 0.4] } };   // 보스: 물약·스킬 없이 1-20 클리어 후 약 10분 성장하면 40초 안팎에 처치
// 챕터 4~10 (시뮬레이션으로 맞춤, 2026-10-14): hpGrow3·atkGrow3 = 스테이지 61부터의 3단계 성장 · ch[챕터] = 그 챕터 몬스터 [체력, 공격력] 배율
// (몬스터 몸 종류·계열·원거리에 따른 난이도 차이 고르기) · king[챕터] = 챕터 보스 [체력, 공격력] 배율 (특수 공격마다 난이도가 달라서)
// 결과(토비 시작, 탐욕/고르게 강화 봇 평균): 챕터 3 약 10분 → 챕터 4 약 13분 → 챕터 10 약 40~60분, 1부 완결 약 3.5~4.5시간

// ── 강화 항목 (캐릭터마다 따로, 비용은 그 캐릭터의 레벨 기준) ──
// save.clv = { [동료 id]: { atk, hp, aspd, crit, agi } }
const CHAR_UPS = [
  { id: 'atk',  name: '공격력',    base: 6,  grow: 1.075, max: Infinity },   // 더하기 방식으로 바꾸며 비용 40% 낮춤 (옛 10)
  { id: 'hp',   name: '체력',      base: 6,  grow: 1.075, max: Infinity },
  { id: 'aspd', name: '공격 속도', base: 40, grow: 1.12,  max: 40 },
  { id: 'crit', name: '치명타',    base: 30, grow: 1.1,   max: 30 },
  { id: 'agi',  name: '민첩',      base: 30, grow: 1.1,   max: 30 },   // 회피 확률
];
const ZERO_LV = Object.freeze({ atk: 0, hp: 0, aspd: 0, crit: 0, agi: 0 });
const charLv = id => (save && save.clv && save.clv[id]) || ZERO_LV;
function ensureLv(id) { save.clv = save.clv || {}; return save.clv[id] || (save.clv[id] = { ...ZERO_LV }); }

function upgradeCost(u, level) { return Math.floor(u.base * Math.pow(u.grow, level)); }
// 따라잡기: 보유 캐릭터(리더 포함) 중 그 항목 최고 레벨(모험단 기록)보다 낮으면 비용 75% 할인. 기록을 새로 세우는 강화는 제값
let CATCHUP_MUL = 0.25;
const upTop = u => Math.max(0, ...Object.keys((save && save.allies) || {}).filter(id => save.allies[id] && allyById(id)).concat([leaderId()]).map(id => charLv(id)[u.id] || 0));
function charUpCost(id, u, lv) { const c = upgradeCost(u, lv); return lv < upTop(u) ? Math.max(1, Math.floor(c * CATCHUP_MUL)) : c; }

function upgradeText(id, s) {
  switch (id) {
    case 'atk': return fmt(s.atk);
    case 'hp': return fmt(s.maxHp);
    case 'aspd': return s.aspd.toFixed(2) + '회/초';
    case 'crit': return s.crit.toFixed(1) + '%';
    case 'agi': return '회피 ' + s.dodge.toFixed(1) + '%';
  }
}

// ── 캐릭터 능력치 ──
// 등급·각성 배율: 1 + (allyPow - 1) × 0.4
const charMul = id => 1 + (allyPow(id) - 1) * 0.4;
// 파티 공통 배율: 별조각·도감·세트·시너지·지원형 오라 (리더·동료 모두에게)
function partyGlob() {
  const g = { atk: 1, hp: 1, crit: 0, aspd: 1, guard: 0, gold: 0, healMul: 0 };
  if (!save) return g;
  const sh = 1 + (save.shards || 0) * SHARD_BONUS, cx = 1 + codexBonus() / 100, sb = setBonus();
  g.atk *= sh * cx * (1 + sb.atk / 100); g.hp *= sh * cx * (1 + sb.hp / 100);
  g.crit += sb.crit; g.aspd *= 1 + sb.aspd / 100; g.guard += sb.guard; g.gold += sb.gold;
  const tc = typeCount, tm = team();
  if (tc('magic')) g.atk *= tc('magic') >= 2 ? 1.2 : 1.1;
  if (tc('support')) g.hp *= tc('support') >= 2 ? 1.2 : 1.1;
  if (tc('shot')) g.crit += tc('shot') >= 2 ? 10 : 5;
  if (tc('warrior')) g.guard += tc('warrior') >= 2 ? 10 : 5;
  if (tc('heal')) g.healMul += tc('heal') >= 2 ? 40 : 20;
  if (tm.includes('baram')) g.aspd *= 1 + auraPct('baram') / 100;      // 바람의 노래
  if (tm.includes('momo')) g.atk *= 1 + auraPct('momo') / 100;         // 응원 탬버린
  return g;
}
// 한 캐릭터의 능력치. L: 강화 레벨(미리보기용), g: 파티 공통 배율. aspd = 동료로서 초당 행동 횟수
// 더하기 방식: 레벨마다 같은 양 (+upAtk, +upHp) · 곱하기 방식: 초반엔 고정치(+2, +12), 후반엔 배율(1.06배)
const ADD = () => BAL.mode === 1;
const lvAtk = L => ADD() ? 10 + BAL.upAtk * L : (10 + 2 * L) * Math.pow(1.06, L);
const lvHp = L => ADD() ? 100 + BAL.upHp * L : (100 + 12 * L) * Math.pow(1.06, L);
function charStats(id, L, g) {
  const pf = allyById(id).pf, cm = charMul(id);
  L = L || charLv(id); g = g || partyGlob();
  return { id,
    atk: Math.floor(lvAtk(L.atk) * pf.atk * cm * g.atk),
    maxHp: Math.floor(lvHp(L.hp) * pf.hp * cm * g.hp),
    aspd: pf.spd * (1 + pf.step * L.aspd) * g.aspd,
    crit: pf.crit + 2 * L.crit + g.crit, critDmg: 2, pierce: 0,
    dodge: Math.min(40, pf.agi + 0.8 * L.agi) };
}
// 동료(리더 아닌 캐릭터)로 싸울 때: 협공 공격력 ×3 · 치명타 관통 = 리더 관통(장비·특성)의 50%
// 리더는 대신 기본 공격 + 장비·특성·전직·스킬
let ALLY_ATK = 3, ALLY_PIERCE = 0.5;
function allyStats(id, L, g) {
  const c = charStats(id, L, g);
  c.atk = Math.floor(c.atk * ALLY_ATK);
  c.pierce = stats ? (stats.pierce || 0) * ALLY_PIERCE : 0;
  return c;
}
// 전투에서 쓰는 능력치: 리더 = stats, 동료 = allyStats (refreshStats마다 새로)
let cstats = {};
const srcOf = id => id === save.leader ? stats : (cstats[id] || (cstats[id] = allyStats(id)));
// 강화 화면·동료 화면에 보여 줄 능력치 (리더는 장비·특성 포함, 동료는 협공·동료 체력 보너스 포함)
function memberStats(id, L) {
  if (id === leaderId()) return fullStats(L);
  const c = allyStats(id, L);
  c.maxHp = Math.floor(c.maxHp * (1 + stats.mods.allyHp / 100));
  return c;
}

// 전투력: 팀 전체 공격 × 체력을 한 숫자로 (대략적인 강함)
// 전투력 = √(초당 피해 합 × 버티는 힘 합) ÷ 10
// 초당 피해: 리더 = 기본 공격(연속 베기) + 유형 행동, 동료 = 유형 행동. 치명타는 지금 스테이지 몬스터의 치명타 저항과 관통까지 반영.
// 버티는 힘: 캐릭터마다 체력 ÷ (1-받는 피해 감소) ÷ (1-회피) 합 + 20초치 치유·흡혈.
const ACT_MUL = { warrior: 1, shot: 1, magic: 1.6, support: 0.6, heal: 0 };
function critExp(s, res) { const c = Math.min(100, Math.max(0, s.crit - Math.max(0, res - (s.pierce || 0)))) / 100; return 1 + c * (s.critDmg - 1); }
function power() {
  if (!save || !stats) return 0;
  const m = stats.mods, res = save.stage ? critRes(Math.min(save.stage, MAX_STAGE)) : 0, lid = leaderId();
  let dps = 0, ehp = 0, sus = 0;
  for (const id of [...new Set([lid].concat(save.party || []))]) {
    const A = allyById(id);
    if (!A) continue;
    const lead = id === lid, s = lead ? stats : allyStats(id), ce = critExp(s, res), act = lead ? s.act : s.aspd;
    const tm = A.type === 'magic' ? 1 + m.magicAlly / 100 : A.type === 'shot' ? 1 + m.shotAlly / 100 : 1;
    dps += s.atk * ce * act * ACT_MUL[A.type] * tm;
    if (lead) { const b = s.atk * ce * s.aspd * (1 + m.double / 100); dps += b; sus += b * m.drain / 100; }
    const hp = lead ? s.maxHp : s.maxHp * (1 + m.allyHp / 100), guard = lead ? m.guard : Math.min(60, stats.pg.guard);
    ehp += hp / (1 - guard / 100) / (1 - s.dodge / 100) / (lead && id === 'bron' ? 1 - BRON_LEAD_GUARD : 1);
    if (A.type === 'heal') sus += s.atk * 1.1 * (1 + m.healAlly / 100) * (1 + m.healMul / 100) * act;
    if (lead) dps += s.atk * ce * skillDps() * (1 + m.skill / 100);
  }
  return Math.floor(Math.sqrt(dps * (ehp + sus * 20)) / 10);
}
// 장착 스킬의 대략적인 초당 피해 (리더 공격력 배율). 대상 수는 어림값, 절반만 반영 (전투력이 스킬로 너무 튀지 않게)
const SK_TARGETS = { front: 1, sneak: 1, low: 1, rand: 1, n: 2, back: 2, all: 2.5 };
function skillDps() {
  if (!save || !Array.isArray(save.slots)) return 0;
  let d = 0;
  save.slots.forEach((id, i) => {
    const sk = id && skillById(id), o = skOf(id);
    if (!sk || !o || !skSlotOpen(i)) return;
    let per = 0;
    for (const e of sk.eff) {
      if (e.t === 'dmg') per += skVal(e, o.lv, o.star) * (e.hits || 1) * (e.to === 'n' ? Math.min(e.n || 1, 2) : SK_TARGETS[e.to] || 1);
      else if (e.t === 'summon') per += skVal(e, o.lv, o.star) * e.n * Math.min(e.dur, sk.cd);
    }
    d += per / (sk.cd * (1 - Math.min(50, stats.mods.cd) / 100));
  });
  return d * 0.5;
}

// ── 추가 콘텐츠 (content.js) ─────────────────
// 시작할 때 한 번 깊은 복사로 읽고 전역에서 지운다. chapters(챕터 4~10)는 CHAPTERS 에 합쳐 씀 (chapterOf)
const CONTENT = (() => {
  const src = window.STAR_CONTENT || { chapters: [], skills: [] };
  const c = JSON.parse(JSON.stringify({ chapters: src.chapters || [], skills: src.skills || [] }));
  try { delete window.STAR_CONTENT; } catch (e) { window.STAR_CONTENT = undefined; }
  const freeze = o => { if (o && typeof o === 'object') { Object.values(o).forEach(freeze); Object.freeze(o); } return o; };
  freeze(c.skills);                                                     // 스킬 데이터는 읽기 전용
  return c;
})();

// ── 스킬 (수집형 55종, 데이터는 content.js) ──
// grade: 0 일반 ~ 5 신화 (GRADES), boss: 챕터 보스 전용, unlock·cost: 일반만 (스테이지 클리어 후 골드로 배움)
// 값 = (base + grow × (Lv-1)) × (1 + 0.2 × (★-1)) · 최대 Lv = 5 × (★+1) · 각성 조각 [1,2,3,4] · ★5 뒤 중복 = 별가루 +5
// save.sk = { [id]: { lv, star, copy } }, save.slots = 4칸 (4번째는 챕터 3 보스 처치 후)
const SKILLS = CONTENT.skills;
const SK_MAP = Object.fromEntries(SKILLS.map(s => [s.id, s]));
const skillById = id => SK_MAP[id];
const SKILL_SLOTS = 4;
let SK_COST = [30, 300, 1500, 6000, 25000, 100000];       // 등급별 강화 기준 골드 (일반은 스킬마다 cost)
const SK_AWAKEN = [0, 1, 2, 3, 4];                         // ★n → ★n+1 에 필요한 조각
const SK_DUST = 5;                                         // ★5 뒤 중복 → 별가루
let FREEZE_MAX = 6;                                      // 빙결·정지 최대 초 (보스·대장은 절반)
const SUMMON_MAX = 8;                                      // 동시에 있을 수 있는 소환수
const AUTO_TEXT = { fight: '전투 중', hurt: '체력 낮음', crowd: '적 2마리 이상', boss: '보스전', down: '동료 쓰러짐', buff: '버프 꺼짐' };
const FX_ICON = { slash: '⚔', whirl: '🌀', star: '✦', meteor: '☄', bolt: '⚡', chain: 'ϟ', fire: '🔥', ice: '❄', wind: '༄', holy: '✚', shadow: '☾', heal: '♥', shield: '⛨', buff: '▲', arrow: '➶', quake: '⛰', time: '⏱', void: '◉' };
const skOf = id => save && save.sk && save.sk[id];
const skMaxLv = st => 5 * (st + 1);
const skSlotOpen = i => i < SKILL_SLOTS - 1 || bossBeaten(3);
const skVal = (e, lv, st) => ((e.base || 0) + (e.grow || 0) * (lv - 1)) * (1 + 0.2 * (st - 1));
function skCost(sk, lv) { return Math.floor((sk.grade === 0 ? sk.cost : SK_COST[sk.grade]) * Math.pow(1.6, lv)); }   // lv=0이면 배우는 값(일반)
const skLearnable = sk => sk.grade === 0 && !skOf(sk.id) && save.stage - 1 >= (sk.unlock || 0);
const skSource = sk => sk.boss ? `챕터 ${sk.boss} 보스` : sk.grade === 0 ? (sk.unlock ? `${stageLabel(sk.unlock)} 스테이지 클리어 후 골드` : '골드로 배움') : '스킬 뽑기';
const skCanUp = id => { const o = skOf(id), sk = skillById(id); return !!(o && sk && o.lv < skMaxLv(o.star) && save.gold >= skCost(sk, o.lv)); };
const skCanAwaken = id => { const o = skOf(id); return !!(o && o.star < STAR_MAX && o.copy >= SK_AWAKEN[o.star]); };
// desc 의 {i} → eff[i] 값 (dmg·buff·shield·heal·mark·gold·revive ×100 %, freeze 초, summon 지속 초, cdr 초)
function effText(e, lv, st) {
  const v = skVal(e, lv, st), n = x => String(+x.toFixed(1));
  if (e.t === 'freeze') return n(Math.min(FREEZE_MAX, v));
  if (e.t === 'summon') return n(e.dur);
  if (e.t === 'cdr') return n(e.base);
  if (e.t === 'revive') return n(Math.min(1, v) * 100);
  return n(v * 100);
}
// next: 다음 레벨 미리보기 (현재→다음)
function skDesc(sk, lv, st, next) {
  return sk.desc.replace(/\{(\d+)\}/g, (_, i) => {
    const e = sk.eff[+i];
    if (!e) return '?';
    const a = effText(e, lv, st), b = next ? effText(e, next, st) : a;
    return next && b !== a ? `${a}→<em>${b}</em>` : a;
  });
}

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
let DROP_CHANCE = 0.03;   // 일반 몬스터, 대장은 반드시
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

// 리더 능력치 = 리더 캐릭터 능력치(charStats) + 리더 전용 효과(장비·특성·전직)
// L: 리더 강화 레벨 (강화 미리보기용, 없으면 지금 레벨)
// aspd = 기본 공격 속도 (유형과 상관없이 1회/초 기준), act = 유형 행동 속도
function fullStats(L) {
  const id = leaderId(), pf = allyById(id).pf;
  L = L || charLv(id);
  const g = partyGlob(), c = charStats(id, L, g);
  const s = { id, atk: c.atk, maxHp: c.maxHp, crit: c.crit, critDmg: 2, pierce: 0, aspd: (1 + pf.step * L.aspd) * g.aspd, act: c.aspd, dodge: c.dodge, pg: g };
  const w = equipped('weapon'), a = equipped('armor'), ac = equipped('acc');
  if (w) s.atk = Math.floor(s.atk * (1 + w.value / 100));
  if (a) s.maxHp = Math.floor(s.maxHp * (1 + a.value / 100));
  if (ac) { s.critDmg += ac.value / 100; s.pierce = ac.pierce; }
  const m = traitMods();
  m.guard = Math.min(60, m.guard + g.guard); m.gold += g.gold; m.healMul += g.healMul;
  s.atk = Math.floor(s.atk * (1 + m.atk / 100));
  s.maxHp = Math.floor(s.maxHp * (1 + m.hp / 100));
  s.crit += m.crit;
  s.critDmg += m.critDmg / 100;
  s.aspd *= 1 + m.aspd / 100;
  s.pierce += m.pierce;
  s.dodge = Math.min(50, s.dodge + m.dodge);       // 리더 회피 = 민첩 + 특성 (최대 50%)
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
    { id: 'h_regen',  name: '축복',          max: 10, desc: r => `웨이브 시작마다 최대 체력 ${r * 3}% 보호막` },
    { id: 'h_smite',  name: '심판의 빛',     max: 10, desc: r => `악 몬스터에게 피해 +${r * 20}% · 공격 속도 +${r * 5}%` },
    { id: 'h_purify', name: '정화',          max: 3,  desc: r => r >= 3 ? '저주·독 면역' : `저주·독 지속 시간 -${r * 33}%` },
    { id: 'h_heal',   name: '치유 공명',     max: 5,  req: 10, desc: r => `치유형 동료 회복 +${r * 15}%` },
    { id: 'h_revive', name: '부활의 기도',   max: 1,  req: 15, desc: () => '전투마다 한 번, 쓰러지면 체력 30%로 부활' },
  ] },
  { id: 'dark', name: '악 · 어둠 (악)', color: '#9a2a5a', nodes: [
    { id: 'e_dark',   name: '어둠의 힘',     max: 10, desc: r => `모든 적에게 피해 +${r * 8}% · 단, 선·타락 천사 몬스터를 때리면 반발로 준 피해의 ${r}%를 받음 (한 번에 최대 체력의 2%까지)` },
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
  holy:  { name: '성직자', bonus: '웨이브마다 보호막 +10% · 받는 피해 -5%',
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
    skill: r('m_skill') * 6, cd: r('m_cd') * 4, critDmg: 0, shield: r('h_regen') * 3, magicAlly: r('m_ally') * 15,
    color: r('m_color') * 20, colorEvery: 3, shadow: r('m_shadow'), shadowPerm: 0,
    aspd: r('a_aspd') * 3, pierce: r('a_pierce') * 2, dodge: r('a_dodge') * 2, gold: 0, shotAlly: r('a_ally') * 15, mark: r('a_mark') * 8,
    guard: 0, potion: 0, healAlly: r('h_heal') * 15, revive: r('h_revive'),
    smite: r('h_smite') * 20, smiteSpd: r('h_smite') * 5, purify: r('h_purify'),
    dark: r('e_dark') * 8, reflect: r('e_dark'), noReflect: 0, fear: r('e_fear') * 4, weak: r('e_weak') * 6, soul: r('e_soul'),
    hypno: 0, allyHp: 0, healMul: 0 };
  if (SEALED) return m;
  if (save.job === 'sword') { m.atk += 10; m.hp += 10; }
  if (save.job === 'mana') { m.skill += 25; m.color = Math.floor(m.color * 1.3); }
  if (save.job === 'agi') m.aspd += 15;
  if (save.job === 'holy') { m.shield += 10; m.guard += 5; }
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
  { key: 'gacha',    text: n => `뽑기 ${n}번`,            target: i => 1 + Math.floor(i / 4) },
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
let GACHA_COST = 30, GACHA10_COST = 270;
let GACHA_W = [0, 550, 300, 110, 35, 5];          // 일반은 안 나옴 · 신화 0.5%
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
// ── 다시 뽑기 ──
// 결과 화면에서 바로 다시 뽑으면 연속 횟수마다 5%씩 할인 (최대 30%). 결과 화면을 나가면 할인이 사라진다
let gStreak = { kind: null, n: 0 };
let AGAIN_STEP = 5, AGAIN_MAX = 30;
const againDisc = k => Math.min(AGAIN_MAX, k * AGAIN_STEP);
const againPrice = (base, k) => Math.ceil(base * (1 - againDisc(k) / 100));
// again: 결과 화면의 '다시 뽑기'로 눌렀는지. 아니면 연속 기록을 새로 시작
function payGacha(kind, base, again) {
  const k = again && gStreak.kind === kind ? gStreak.n + 1 : 0;
  const cost = againPrice(base, k);
  if (save.dust < cost) { alert('별가루 부족'); return false; }
  save.dust -= cost;
  gStreak = { kind, n: k };
  return true;
}
function showAgain(kind) {
  const [b1, b10, run] = { ally: [AGACHA_COST, AGACHA10_COST, doAllyGacha], skill: [SGACHA_COST, SGACHA10_COST, doSkillGacha] }[kind] || [GACHA_COST, GACHA10_COST, doGacha];
  const k = gStreak.n + 1, d = againDisc(k);
  const btn = (cnt, base) => { const c = againPrice(base, k); return `<button class="again" data-again="${cnt}" ${save.dust < c ? 'disabled' : ''}>다시 ${cnt}회 뽑기<small><s>${base}</s> → 별가루 ${c}</small></button>`; };
  const el = $('gAgain');
  el.innerHTML = `<div class="gstreak">${gStreak.n ? `<b>${gStreak.n}연속!</b> · ` : ''}지금 다시 뽑으면 <em>-${d}%</em>${d < AGAIN_MAX ? ` · 다음엔 -${againDisc(k + 1)}%` : ' · 최대 할인'} · 나가면 할인 사라짐 · 보유 별가루 ${fmt(save.dust)}</div>
    <div class="againrow">${btn(1, b1)}${btn(10, b10)}</div>`;
  el.querySelectorAll('[data-again]').forEach(b => b.onclick = () => run(+b.dataset.again, true));
  el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
}
function closeGacha() {
  $('gacha').hidden = true;
  gStreak = { kind: null, n: 0 };
}

function doGacha(n, again) {
  if (!payGacha('gear', n === 10 ? GACHA10_COST : GACHA_COST * n, again)) return;
  const got = [];
  for (let i = 0; i < n; i++) got.push(makeItem(topStage(), gachaGrade()));
  if (n === 10 && !got.some(it => it.grade >= 2)) got[9] = makeItem(topStage(), gachaGrade(2));   // 10회는 희귀 이상 1개 보장
  got.forEach(addItem);
  track('gacha', n);
  writeSave(); updateHud();
  closeModal();
  showGacha(got);
  showAgain('gear');
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
let DUNGEON_TRIES = 3, DUNGEON_TIME = 30;
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
  Object.assign(k, { name: D.name.split(' ').slice(0, -1).join(' '), sprite: D.sprite, body: D.body, align: 'neutral', king: true, size: 64, x: 200, ranged: false,
    hp: 1e300, maxHp: 1e300, atk: Math.floor(k.atk * 0.25), gold: 0 });   // 쓰러지지 않는 과녁
  battle = { stage: top, dungeon: id, king: true, mech: null, wave: 0, queue: [k], earned: 0, state: 'fight', delay: 0, potionCd: 0, skillCd: {}, buffs: [], loot: [],
    timeLeft: DUNGEON_TIME, mechCd: Infinity, mechWarn: 0, bound: 0, allyCd: {}, fx: [], shield: 0, revived: false, poison: 0, dealt: 0 };
  initAllyHp();
  $('result').hidden = true;
  showScreen('battle');
  giveShield();
  say('hero', id === 'gold' ? '반짝반짝… 금화다!' : '보석이 가득한 골렘이야!', 2.5);
}

function endDungeon(result) {
  const r = battle, top = r.stage;
  const hpRef = monHp0() * hpGrowth(top);
  const sc = r.dealt / hpRef, score = Number.isFinite(sc) && sc > 0 ? sc : 0;   // 일반 몬스터 몇 마리 분량의 피해를 줬나
  let text;
  if (r.dungeon === 'gold') {
    const g = Math.floor(monGold(top) * (5 + score * 3)), gold = Number.isFinite(g) ? g : 0;
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

// ── 결투장 (PvP): 다른 모험단의 방어 팀과 자동 전투 ──
// 방어 팀 = 리더 + 배치 동료. 캐릭터마다 [id, 각성, 초당 피해, 버티는 힘, 초당 치유] (전투력 공식과 같은 계산) → arena/{uid}
// 전투: 상대 파티를 몬스터 줄로 바꿈. 맨 앞은 근접, 뒤는 원거리로 같은 초당 피해, 치유형·흡혈은 가장 다친 아군 치유
// 물약 금지 · 60초 제한 (시간이 다 되면 남은 체력 비율이 높은 쪽 승리) · 하루 5번 · 점수는 엘로 방식
// 전투 길이 맞추기: 그대로 두면 서로 0.1초 만에 끝나서, 상대 체력·치유 ×K, 상대 초당 피해 ÷K
//   (내가 상대를 쓰러뜨리는 시간·상대가 나를 쓰러뜨리는 시간이 똑같이 K배 → 누가 이기는지는 그대로)
//   K = 두 시간의 기하 평균이 PVP_LEN 초가 되게
// 결투 열기: 15초가 지나면 양쪽이 주는 피해가 초마다 +15%p (치유가 강한 팀끼리 끝나지 않는 싸움 방지, 60초면 ×7.75)
let PVP_TRIES = 5, PVP_TIME = 60, PVP_RES = 20, PVP_LEN = 15, PVP_RAMP_AT = 15, PVP_RAMP = 0.15;
// 상대 초당 피해·체력 배율: 상대는 스킬·고유 능력 없이 싸우므로 보정 (2026-10-17 시험, 같은 강화 수준 리더 단비·토비·카이·미르 + 스킬 AUTO:
//   이길 수 있는 상대 전투력 한계 = 1.6·1.5·1.5·1.3배 (보정 없음) → 1.35 보정 후 약 1.2·1.1·1.1·1.0배 · 스킬 끄면 0.8배)
let PVP_DPS = 1.35, PVP_HP = 1.35, PVP_HEAL = 1;
const PVP_ORDER = { warrior: 1, shot: 2, magic: 3, support: 4, heal: 5 };
const PVP_TIERS = [[0, '브론즈', '#a0683a'], [1100, '실버', '#7a8a9a'], [1250, '골드', '#c8900a'], [1450, '플래티넘', '#2a9a8a'], [1700, '다이아', '#3a7ad0'], [2000, '별빛', '#9a50d0']];
const BOT_NAMES = ['그림자 모험단', '거울 기사단', '별먼지 원정대', '달빛 용병단', '안개 사냥꾼', '새벽 순례단'];
const pvpLeft = () => { ensureDaily(); return PVP_TRIES - (save.daily.pvp || 0); };
const arenaOf = () => save.arena || (save.arena = { pts: 1000, w: 0, l: 0, best: 1000 });
function pvpTier(p) { let t = PVP_TIERS[0]; for (const x of PVP_TIERS) if (p >= x[0]) t = x; return t; }
const tierHtml = p => { const t = pvpTier(p); return `<b style="color:${t[2]}">${t[1]}</b> ${Math.round(p)}점`; };

function pvpTeam() {
  const m = stats.mods, lid = leaderId(), out = [];
  for (const id of [...new Set([lid].concat(save.party || []))]) {
    const A = allyById(id);
    if (!A) continue;
    const lead = id === lid, s = lead ? stats : allyStats(id), ce = critExp(s, PVP_RES), act = lead ? s.act : s.aspd;
    const tm = A.type === 'magic' ? 1 + m.magicAlly / 100 : A.type === 'shot' ? 1 + m.shotAlly / 100 : 1;
    let dps = s.atk * ce * act * ACT_MUL[A.type] * tm, heal = 0;
    if (lead) { const b = s.atk * ce * s.aspd * (1 + m.double / 100); dps += b + s.atk * ce * skillDps() * (1 + m.skill / 100); heal += b * m.drain / 100; }
    const hp = lead ? s.maxHp : s.maxHp * (1 + m.allyHp / 100), guard = lead ? m.guard : Math.min(60, stats.pg.guard);
    const ehp = hp / (1 - guard / 100) / (1 - s.dodge / 100) / (lead && id === 'bron' ? 1 - BRON_LEAD_GUARD : 1);
    if (A.type === 'heal') heal += s.atk * 1.1 * (1 + m.healAlly / 100) * (1 + m.healMul / 100) * act;
    out.push([id, allyStar(id), Math.round(dps), Math.round(ehp), Math.round(heal)]);
  }
  return out;
}
// 연습 상대: 진짜 상대가 부족할 때 내 팀 능력치 × k 로 만든 다른 동료 파티
function pvpBot(i, k) {
  const mine = pvpTeam(), used = new Set(), pts = arenaOf().pts;
  const team = mine.map(t => {
    const pool = ALLIES.filter(A => !used.has(A.id)), A = pick(pool);
    used.add(A.id);
    return [A.id, 1 + Math.floor(Math.random() * 3), Math.round(t[2] * k), Math.round(t[3] * k), Math.round(t[4] * k)];
  });
  return { uid: 'bot' + i, bot: true, name: BOT_NAMES[(i + new Date().getDate()) % BOT_NAMES.length], leader: team[0][0], star: team[0][1],
    power: Math.floor(power() * k), pts: Math.max(0, Math.round(pts + (k - 1) * 300)), team, job: '' };
}

// 남이 올린 팀 기록 읽기: 모르는 동료·이상한 숫자는 걸러냄 (숫자는 0 ~ 1e150)
function cleanTeam(str) {
  let T;
  try { T = JSON.parse(str); } catch (_) { return []; }
  if (!Array.isArray(T)) return [];
  const num = v => { v = +v; return Number.isFinite(v) ? Math.min(1e150, Math.max(0, v)) : 0; };
  return T.filter(t => Array.isArray(t) && typeof t[0] === 'string' && allyById(t[0])).slice(0, PARTY_MAX + 1)
    .map(t => [t[0], Math.min(5, Math.max(1, Math.floor(num(t[1])) || 1)), num(t[2]), num(t[3]), num(t[4])]);
}
let pvpOpps = null, pvpMsg = '', pvpAt = 0, pvpTab = 'fight', pvpTop = null, pvpLoading = false;
const PVP_REFRESH = 10000;
async function loadOpps() {
  if (pvpLoading) return;
  pvpLoading = true; pvpAt = Date.now(); pvpMsg = ''; pvpOpps = null;
  let real = [];
  if (cloudOn() && window.Cloud.arenaNear) {
    try {
      await arenaUpload(true);
      const me = window.Cloud.user.uid, p = power();
      real = (await window.Cloud.arenaNear(p)).filter(r => r.uid !== me && typeof r.team === 'string')
        .map(r => ({ ...r, name: String(r.name || '모험단').slice(0, 10), power: Math.max(0, +r.power || 0), pts: Math.max(0, +r.pts || 0), team: cleanTeam(r.team) }))
        .filter(r => r.team.length)
        .sort((a, b) => Math.abs(Math.log((a.power + 1) / (p + 1))) - Math.abs(Math.log((b.power + 1) / (p + 1))))
        .slice(0, 8);
      real.sort(() => Math.random() - 0.5);
      real = real.slice(0, 3);
    } catch (e) { console.warn(e); pvpMsg = '결투장 서버 준비 중 · 지금은 연습 상대만'; real = []; }
  } else pvpMsg = TEST ? '테스트 모드 · 연습 상대만' : '로그인 필요 · 지금은 연습 상대만';
  pvpLoading = false;
  if (!pvpMsg && real.length < 3) pvpMsg = '근처 전투력의 모험단이 부족해 연습 상대로 채움';
  const ks = [0.8, 1, 1.2];
  pvpOpps = real.concat(ks.slice(real.length).map((k, i) => pvpBot(i, k)));
  if (modalKind === 'arena') refreshModal();
}

// 방어 팀 올리기: 1분에 한 번까지, 바뀐 게 있을 때만 (force: 결투 직후·상대 찾기 전)
let arenaSent = 0, arenaLast = '';
async function arenaUpload(force) {
  if (!cloudOn() || !window.Cloud.arenaSave || window.Cloud.user.isAnonymous) return;   // 게스트는 상대 목록에 안 올라감
  if (!force && Date.now() - arenaSent < 60000) return;
  const a = arenaOf();
  const data = { name: String(save.name || '모험단').slice(0, 10), leader: leaderId(), star: allyStar(leaderId()), power: power(),
    stage: save.stage - 1, job: jobTitle(), team: JSON.stringify(pvpTeam()), pts: Math.round(a.pts), w: a.w, l: a.l };
  const key = JSON.stringify(data);
  if (key === arenaLast) return;
  arenaSent = Date.now();
  try { await window.Cloud.arenaSave({ ...data, at: Date.now() }); arenaLast = key; }
  catch (e) { console.warn(e); if (e && e.code === 'permission-denied') arenaSent = Date.now() + 30 * 60000; }   // 서버 규칙이 아직 없으면 30분 쉼
}

function teamIcons(team) { return team.map(t => `<img src="${allyIcon(t[0], Math.min(5, Math.max(1, t[1] | 0)))}" title="${esc(allyById(t[0]).name)}">`).join(''); }
function refreshArena() {
  const a = arenaOf(), left = pvpLeft();
  const tabs = `<div class="gtabs">${[['fight', '⚔ 대전'], ['top', '🏆 결투 순위']].map(([k, n]) => `<button data-pt="${k}" class="${pvpTab === k ? 'on' : ''}">${n}</button>`).join('')}</div>`;
  const head = `<div class="lead pvphead">${tierHtml(a.pts)} · ${a.w}승 ${a.l}패 · 남은 도전 <b>${left}</b> / ${PVP_TRIES}<br><small>내 방어 팀 = 지금 리더 + 배치 동료 · 전투력 ${fmt(power())}</small><div class="pvpteam">${teamIcons(pvpTeam())}</div></div>`;
  let body;
  if (pvpTab === 'top') {
    if (!pvpTop) {
      body = '<p class="note">불러오는 중…</p>';
      pvpTop = 'loading';
      (cloudOn() && window.Cloud.arenaTop ? window.Cloud.arenaTop(30) : Promise.reject(new Error('off')))
        .then(list => { pvpTop = list; }).catch(e => { console.warn(e); pvpTop = 'fail'; })
        .then(() => { if (modalKind === 'arena') refreshModal(); });
    } else if (pvpTop === 'loading') body = '<p class="note">불러오는 중…</p>';
    else if (pvpTop === 'fail') body = '<p class="note">결투 순위 서버 준비 중</p>';
    else {
      const me = window.Cloud.user && window.Cloud.user.uid;
      body = `<table class="rank"><tr><th>순위</th><th>이름</th><th>팀</th><th>점수</th><th>전적</th></tr>${pvpTop.map((r, i) => {
        const team = cleanTeam(r.team);
        return `<tr class="${r.uid === me ? 'me' : ''}${i < 3 ? ' top' : ''}"><td>${['🥇', '🥈', '🥉'][i] || i + 1}</td><td>${esc(String(r.name || '').slice(0, 10))}</td><td class="pvpteam">${teamIcons(team)}</td><td>${tierHtml(Math.max(0, +r.pts || 0))}</td><td>${r.w | 0}승 ${r.l | 0}패</td></tr>`;
      }).join('')}</table>`;
    }
  } else if (!pvpOpps) {
    body = '<p class="note">상대 찾는 중…</p>';
    if (!pvpLoading) setTimeout(loadOpps, 0);                // 그리기를 마친 뒤 (바로 끝나면 결과를 다시 그림)
  } else {
    body = pvpOpps.map((o, i) => `<div class="up pvpopp"><div class="nm">${o.bot ? '<em class="bot">연습</em>' : ''}${esc(o.name)}<small>${tierHtml(o.pts)} · 전투력 ${fmt(o.power)}${o.job ? ' · ' + esc(o.job) : ''}</small></div>
      <div class="val pvpteam">${teamIcons(o.team)}</div><button data-pvp="${i}" ${left <= 0 ? 'disabled' : ''}>도전</button></div>`).join('')
      + `<div class="baghead"><span class="note">${esc(pvpMsg)}</span><button id="pvpRe">상대 바꾸기</button></div>`;
  }
  $('pBody').innerHTML = tabs + head + body
    + '<p class="note">승리 시 별가루 +8 · 골드 · 점수 상승 / 패배 시 별가루 +2 · 점수 하락 · 연습 상대는 보상·점수 절반<br>전투 중 물약 사용 불가 · 60초가 지나면 남은 체력 비율이 높은 쪽 승리 · 자정에 도전 횟수 초기화</p>';
  $('pBody').querySelectorAll('[data-pt]').forEach(b => b.onclick = () => { pvpTab = b.dataset.pt; if (pvpTab === 'top') pvpTop = null; refreshModal(); });
  $('pBody').querySelectorAll('[data-pvp]').forEach(b => b.onclick = () => { const o = pvpOpps[+b.dataset.pvp]; closeModal(); startPvp(o); });
  const re = $('pvpRe');
  if (re) re.onclick = () => { if (Date.now() - pvpAt < PVP_REFRESH) return notify(`${Math.ceil((PVP_REFRESH - Date.now() + pvpAt) / 1000)}초 뒤 다시`); pvpOpps = null; refreshModal(); };
}

function pvpK(mine, theirs) {
  const sum = (T, j) => Math.max(1, T.reduce((s, t) => s + (t[j] || 0), 0));
  const base = Math.sqrt(sum(theirs, 3) / sum(mine, 2) * (sum(mine, 3) / sum(theirs, 2)));
  return Math.min(1e15, Math.max(1e-9, PVP_LEN / base));
}
function pvpMon(t, i, K) {
  const A = allyById(t[0]), hp = Math.max(1, Math.floor(t[3] * K * PVP_HP));
  return { name: (i === 0 ? '👑 ' : '') + A.name, pvp: { id: A.id, star: Math.min(5, Math.max(1, t[1] | 0)), type: A.type }, lead: i === 0, size: 32, align: 'neutral', body: null,
    hp, maxHp: hp, atk: t[2] * PVP_DPS / K, atk0: t[2] * PVP_DPS / K, aspd: 1, heal: t[4] * K * PVP_HEAL, hcd: 1.5, critRes: PVP_RES, ranged: i > 0 && t[2] > 0,
    shot: A.type === 'magic' ? '#c890ff' : A.type === 'heal' ? '#9ef0b0' : '#ffb05a', gold: 0, noDrop: true, x: 220 + i * 30, cd: 0.8, hurt: 0, dead: 0 };
}
function startPvp(o) {
  if (pvpLeft() <= 0) return alert('오늘 결투 횟수 소진 · 내일 다시');
  save.daily.pvp = (save.daily.pvp || 0) + 1;
  SEALED = false;
  refreshStats();
  hero.hp = stats.maxHp; hero.cd = 0; floats = [];
  const team = [o.team[0]].concat(o.team.slice(1).sort((a, b) => PVP_ORDER[allyById(a[0]).type] - PVP_ORDER[allyById(b[0]).type]));
  const K = pvpK(pvpTeam(), team), queue = team.map((t, i) => pvpMon(t, i, K));
  battle = { stage: topStage(), pvp: o, king: true, mech: null, wave: 0, queue, pvpK: K, pvpT: 0, pvpRamp: 1, pvpN: queue.length, pvpMax: queue.reduce((s, m) => s + m.maxHp, 0), earned: 0, state: 'fight', delay: 0, potionCd: 0, skillCd: {}, buffs: [], loot: [],
    timeLeft: PVP_TIME, mechCd: Infinity, mechWarn: 0, bound: 0, allyCd: {}, fx: [], shield: 0, revived: false, poison: 0 };
  initAllyHp();
  $('result').hidden = true;
  showScreen('battle');
  giveShield();
  say('hero', pick(['정정당당하게 겨뤄 보자!', '이번엔 사람 상대야. 방심하지 마!', `${o.name}… 상대해 주지!`]), 2.5);
}
// 상대 치유: 치유량을 가진 캐릭터가 1.5초마다 가장 다친 아군을 치유 · 결투 열기
function updatePvp(dt) {
  battle.pvpT += dt;
  const r = 1 + Math.max(0, battle.pvpT - PVP_RAMP_AT) * PVP_RAMP;
  if (r > 1 && battle.pvpRamp === 1) { addFloat('결투 열기! 피해 증가', hero.x + 60, GROUND - 90, '#ff8a3a', true); shake = 0.25; }
  battle.pvpRamp = r;
  for (const m of battle.queue) if (m.atk0 !== undefined) m.atk = m.atk0 * r;
  const q = battle.queue.filter(m => m.dead <= 0);
  for (const m of q) {
    if (!(m.heal > 0) || m.stun > 0 || (m.hcd -= dt) > 0) continue;
    m.hcd = 1.5;
    const t = q.filter(o => o.hp < o.maxHp).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
    if (!t) continue;
    const h = Math.floor(Math.min(t.maxHp - t.hp, m.heal * 1.5));
    t.hp += h;
    if (h >= 1) { addFloat('+' + fmt(h), t.x + 16, GROUND - 44, '#6fe39a'); battle.fx.push({ kind: 'mheal', x: t.x + 16, t: 0, dur: 0.5 }); }
  }
}
function endPvp(result) {
  const r = battle, o = r.pvp, a = arenaOf();
  let won = result === 'won';
  if (result === 'timeout') {
    const P = partyHp(), en = r.queue.reduce((s, m) => s + (m.dead > 0 ? 0 : Math.max(0, m.hp)), 0);   // 쓰러진 상대는 줄에서 빠져 있음
    won = P.hp / P.max > en / Math.max(1, r.pvpMax);
  }
  if (won) Sound.win(); else if (result !== 'retreat') Sound.lose();
  const half = o.bot ? 0.5 : 1, op = Number.isFinite(o.pts) ? o.pts : 1000;
  const exp = 1 / (1 + Math.pow(10, (op - a.pts) / 400));
  let d = Math.round(32 * ((won ? 1 : 0) - exp) * half);
  if (won) d = Math.max(Math.round(5 * half), d);
  a.pts = Math.max(0, a.pts + d);
  a.best = Math.max(a.best || 0, a.pts);
  if (won) a.w++; else a.l++;
  const dust = Math.round((won ? 8 : 2) * half), gold = won ? Math.floor(monGold(topStage()) * 25 * half) : 0;
  save.dust += dust; save.gold += gold;
  writeSave(); cloudUpload(); arenaUpload(true);
  pvpOpps = null;
  const left = pvpLeft();
  const text = `${result === 'timeout' ? '시간 종료 · 남은 체력 비교<br>' : ''}점수 <b>${d >= 0 ? '+' : ''}${d}</b> → ${tierHtml(a.pts)} · ${a.w}승 ${a.l}패<br>별가루 +${dust}${gold ? ` · 골드 +${fmt(gold)} G` : ''}${o.bot ? ' (연습 상대 · 절반)' : ''}`;
  const btns = [['캠프로', () => showScreen('lobby'), left <= 0]];
  if (left > 0) btns.unshift([`다음 상대 (남은 ${left})`, () => { showScreen('lobby'); openModal('arena'); }, true]);
  showResult(won ? `${o.name} 상대로 승리!` : result === 'retreat' ? '항복' : '패배…', won ? '#ffd25e' : '#ff9aa6', text, btns);
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
// 유형 행동: 동료는 1/행동 속도 초마다, 리더는 기본 공격과 별도로 같은 주기에 (자기 공격력 기준)
const ALLY_TYPES = {
  heal:    { role: '치유형', act: '체력 비율이 가장 낮은 아군 치유 (공격력 110%) · 다친 아군이 없으면 앞의 적에게 공격력 50% 피해' },
  magic:   { role: '마법형', act: '앞의 적 최대 3마리(잠입 암살자 포함)에게 공격력 70% 마법 피해' },
  shot:    { role: '사격형', act: '잠입 암살자 → 몬스터 치유사 → 원거리 몬스터 → 앞의 적 순서로 공격력 100% 피해 (치유사 ×1.5)' },
  warrior: { role: '전사형', act: '앞의 적(잠입 암살자 우선)에게 공격력 100% 피해 (암살자 ×1.5)' },
  support: { role: '지원형', act: '앞의 적에게 공격력 60% 피해 · 파티 전체 오라' },
};
// pf: 캐릭터마다 다른 성장 (atk·hp 기본 배율, spd 동료로서 초당 행동 횟수, step 공격 속도 레벨당 상승, crit 기본 치명타%, agi 기본 회피%)
const ALLIES = [
  { id: 'miru',  name: '미르', type: 'heal',    r: 2, from: '챕터 1 보스', pf: { atk: 0.85, hp: 1.05, spd: 0.38, step: 0.05, crit: 3, agi: 3 } },
  { id: 'serin', name: '세린', type: 'magic',   r: 2, from: '챕터 2 보스', pf: { atk: 1.35, hp: 0.75, spd: 0.45, step: 0.05, crit: 8, agi: 2 } },
  { id: 'kai',   name: '카이', type: 'shot',    r: 2, from: '챕터 3 보스', pf: { atk: 1.05, hp: 0.9, spd: 0.9, step: 0.06, crit: 12, agi: 4 } },
  { id: 'pio',   name: '피오', type: 'magic',   r: 3, pf: { atk: 1.45, hp: 0.75, spd: 0.4, step: 0.05, crit: 10, agi: 3 } },
  { id: 'lea',   name: '레아', type: 'warrior', r: 3, pf: { atk: 1.15, hp: 1.4, spd: 0.7, step: 0.05, crit: 8, agi: 3 } },
  { id: 'noeul', name: '노을', type: 'shot',    r: 3, pf: { atk: 1.1, hp: 0.85, spd: 1.0, step: 0.065, crit: 15, agi: 6 } },
  { id: 'bron',  name: '브론', type: 'warrior', r: 2, pf: { atk: 0.8, hp: 1.8, spd: 0.55, step: 0.04, crit: 3, agi: 0 } },
  { id: 'arin',  name: '아린', type: 'magic',   r: 2, pf: { atk: 1.4, hp: 0.75, spd: 0.42, step: 0.05, crit: 5, agi: 2 } },
  { id: 'baram', name: '바람', type: 'support', r: 2, pf: { atk: 0.75, hp: 1.1, spd: 0.7, step: 0.06, crit: 6, agi: 8 } },
  { id: 'tobi',  name: '토비', type: 'warrior', r: 1, pf: { atk: 1.0, hp: 1.4, spd: 0.75, step: 0.05, crit: 5, agi: 2 } },
  { id: 'danbi', name: '단비', type: 'magic',   r: 1, pf: { atk: 1.2, hp: 0.8, spd: 0.45, step: 0.05, crit: 5, agi: 2 } },
  { id: 'rio',   name: '리오', type: 'shot',    r: 1, pf: { atk: 0.95, hp: 0.85, spd: 1.0, step: 0.06, crit: 10, agi: 6 } },
  { id: 'hana',  name: '하나', type: 'heal',    r: 1, pf: { atk: 0.75, hp: 1.0, spd: 0.4, step: 0.05, crit: 3, agi: 4 } },
  { id: 'momo',  name: '모모', type: 'support', r: 1, pf: { atk: 0.7, hp: 1.15, spd: 0.75, step: 0.055, crit: 5, agi: 7 } },
];
ALLIES.forEach(A => { const T = ALLY_TYPES[A.type]; A.role = T.role; A.act = T.act; A.sprite = A.id; });
// 대개편 때 정리된 동료 (능력이 똑같은 중복): [이름, 유형, 등급]. 세이브 이전 보상과 랭킹의 옛 리더 표시에만 쓴다
const GONE = { luka: ['루카', 'warrior', 2], jun: ['준', 'warrior', 1], eunho: ['은호', 'shot', 2], sora: ['소라', 'shot', 1], sea: ['세아', 'heal', 2], yuri: ['유리', 'support', 1] };
// 고유 능력 (모든 캐릭터 서로 다름 · 동료든 리더든 발동). 효과는 전투 코드(allyAct·abilityOnHit·tankHit·onFall·updateRanged)에서
const ABIL = {
  tobi:  { name: '도끼 회전',   desc: () => '3번째 행동마다 앞의 적 2마리 동시 타격 (공격력 120%)' },
  bron:  { name: '철벽 방패',   desc: () => '동료: 도발 중 받는 피해 -70% · 막은 피해의 30% 반사 · 리더: 받는 피해 -25% · 받은 피해의 30% 반사' },
  lea:   { name: '관통 창',     desc: () => '공격이 뒤의 적까지 꿰뚫음 (2번째 적 70%) · 도발 시간 6초' },
  rio:   { name: '돌팔매',      desc: () => '25% 확률로 0.8초 기절 (보스·대장은 절반) · 같은 적은 2초에 한 번' },
  kai:   { name: '보물 사냥꾼', desc: () => '원거리·치유사 몬스터 피해 +50% · 카이가 처치한 적 골드 +30%' },
  noeul: { name: '노을 화살비', desc: () => '5번째 사격마다 모든 적에게 공격력 80% 화살비' },
  danbi: { name: '물방울 감옥', desc: () => '맞은 적 2초 둔화 (적 공격 느려짐)' },
  serin: { name: '마력 공명',   desc: () => '치명타가 나면 같은 대상에 한 번 더 (공격력 60%)' },
  arin:  { name: '불꽃 낙인',   desc: () => '맞은 적 화상 3초 (0.5초마다 공격력 15%) · 화상 시체는 되살아나지 않음' },
  pio:   { name: '별똥별',      desc: () => '대상 수 제한 없이 모든 적(뒤 몬스터·잠입 암살자 포함)에게 공격력 60% 마법 피해' },
  hana:  { name: '응급 붕대',   desc: () => '체력 30% 이하 아군 치유량 2배' },
  miru:  { name: '약초 꾸러미', desc: () => '치유 대상의 독 해제 · 쓰러진 동료를 전투마다 1번 체력 30%로 일으킴' },
  baram: { name: '바람의 노래', desc: id => `오라: 파티 공격 속도 +${auraPct(id)}% · 원거리 몬스터 공격 20% 빗나감` },
  momo:  { name: '응원 탬버린', desc: id => `오라: 파티 공격력 +${auraPct(id)}% · 동료가 쓰러지면 남은 파티 5초 공격력 +40%` },
};
// 지원형 오라 % = (기본 + 2 × ★) × 등급 배율
const AURA_BASE = { baram: 4, momo: 5 };
const auraPct = id => Math.round((AURA_BASE[id] + 2 * allyStar(id)) * RARITY[allyById(id).r].mul * 10) / 10;
const RARITY = [null, { name: '일반', stars: '★', color: '#8a7a6a', mul: 1 }, { name: '희귀', stars: '★★', color: '#3a7ad0', mul: 1.3 }, { name: '전설', stars: '★★★', color: '#e0902a', mul: 1.7 }];
const PREFIX = {
  heal:    ['', '꽃잎', '축복의', '성녀', '천사'],
  magic:   ['', '견습', '원소의', '대마법사', '별의 현자'],
  shot:    ['', '날쌘', '매의 눈', '명사수', '유성'],
  warrior: ['', '용감한', '강철', '영웅', '전설의'],
  support: ['', '노래하는', '바람의', '수호', '여신의'],
};
let AWAKEN_COST = [0, 1, 2, 3, 5];          // ★n → ★n+1 에 필요한 조각
const STAR_MAX = 5;
const allyById = id => ALLIES.find(a => a.id === id);
const allyStar = id => (save.astar && save.astar[id]) || 1;
const allyName = id => { const A = allyById(id), p = PREFIX[A.type][allyStar(id) - 1]; return (p ? p + ' ' : '') + A.name; };
const allyPow = id => RARITY[allyById(id).r].mul * (1 + 0.25 * (allyStar(id) - 1));

// ── 리더: 주인공 없이 동료 1명이 맨 앞에서 싸운다 ──
// 강화는 캐릭터마다 따로. 장비·특성·전직·스킬·물약은 리더에게만. 리더가 쓰러져도 동료가 남아 있으면 계속, 모두 쓰러지면 패배
const STARTERS = ['tobi', 'rio', 'danbi'];
const leaderId = () => (save && save.leader && allyById(save.leader)) ? save.leader : 'tobi';
const team = () => [save.leader].concat(save.party || []).filter(id => id && allyById(id));
function leaderStyle() {
  const k = MOTION[ALLY_LOOKS[leaderId()].weapon] || 'dash';
  return k === 'cast' || k === 'play' ? 'cast' : k === 'shoot' ? 'shoot' : 'melee';
}
function setLeader(id) {
  const old = save.leader;
  if (!save.allies[id] || id === old) return;
  save.party = (save.party || []).filter(x => x !== id);
  save.leader = id;
  if (old && save.allies[old] && save.party.length < partyMax()) save.party.unshift(old);
}
const partyWiped = () => hero.hp <= 0 && (save.party || []).every(id => allyDown(id));
// 배치 칸: 3칸, 챕터 2·3 보스를 깨면 1칸씩
const partyMax = () => 3 + (save.bosses && save.bosses[2] ? 1 : 0) + (save.bosses && save.bosses[3] ? 1 : 0);
const PARTY_MAX = 5;
function allyImg(id) { return allySprite(id, allyStar(id), allyById(id).type, mood); }
const ALLY_ICON = {};
function allyIcon(id, st) {
  st = st || (allyById(id) ? allyStar(id) : 1);
  const k = id + st;
  return ALLY_ICON[k] || (ALLY_ICON[k] = allySprite(id, st, allyById(id) ? allyById(id).type : GONE[id][1], 0).toDataURL());   // GONE: 랭킹의 옛 리더
}
// 시너지: 같은 유형 1명 / 2명 이상 (리더·동료 모두에게)
const SYNERGY = [
  { type: 'heal',    text: n => `치유형 ${n} · 치유량 +${n >= 2 ? 40 : 20}%` },
  { type: 'magic',   text: n => `마법형 ${n} · 공격력 +${n >= 2 ? 20 : 10}%` },
  { type: 'shot',    text: n => `사격형 ${n} · 치명타 확률 +${n >= 2 ? 10 : 5}%` },
  { type: 'warrior', text: n => `전사형 ${n} · 받는 피해 -${n >= 2 ? 10 : 5}%` },
  { type: 'support', text: n => `지원형 ${n} · 체력 +${n >= 2 ? 20 : 10}%` },
];
const typeCount = type => team().filter(id => allyById(id).type === type).length;
const partyHas = type => typeCount(type) > 0;
// 도감: 모은 동료 1명당 공격력·체력 +1%, 각성 별 1개당 +0.5%
function codexBonus() {
  const own = Object.keys(save.allies || {}).filter(allyById);
  return own.length + own.reduce((a, id) => a + (allyStar(id) - 1) * 0.5, 0);
}

// ── 동료 뽑기 ──
let AGACHA_COST = 50, AGACHA10_COST = 450, APITY = 80;
let AGACHA_W = [0, 72, 25, 3];
function allyRoll(minR = 1) {
  let r;
  if ((save.apity || 0) + 1 >= APITY) r = 3;
  else { const w = AGACHA_W.map((x, i) => i >= minR ? x : 0); let x = Math.random() * w.reduce((a, b) => a + b, 0); r = 0; while (x >= w[r]) { x -= w[r]; r++; } }
  save.apity = r === 3 ? 0 : (save.apity || 0) + 1;
  if (r === 3 && Math.random() < 0.5) return pickupId();          // 이번 주 픽업
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
function doAllyGacha(n, again) {
  if (!payGacha('ally', n === 10 ? AGACHA10_COST : AGACHA_COST, again)) return;
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
  showAgain('ally');
}
function awaken(id) {
  const st = allyStar(id), need = AWAKEN_COST[st];
  if (st >= STAR_MAX || (save.acopy[id] || 0) < need) return;
  save.acopy[id] -= need;
  save.astar[id] = st + 1;
  refreshStats(); writeSave(); updateHud();
  if (id === save.leader) drawBattleIcon();
  closeModal();
  fanfare(st + 1 === 5 ? '최종 각성!' : '각성!', `${allyName(id)} · ${'★'.repeat(st + 1)}`, Sound.levelUp);
  setTimeout(() => openAllies(id), 1900);
}

// ── 스킬 뽑기 · 배우기 · 강화 · 각성 ──
// 확률(‰): 고급 600 · 희귀 280 · 영웅 90 · 전설 25 · 신화 5. 일반·보스 전용은 안 나옴. 전설 이상 천장 70회(save.spity)
let SGACHA_COST = 40, SGACHA10_COST = 360, SPITY = 70;
let SGACHA_W = [0, 600, 280, 90, 25, 5];
function skillRoll(minG = 1) {
  let g = 0;
  const w = SGACHA_W.map((x, i) => i >= ((save.spity || 0) + 1 >= SPITY ? 4 : minG) ? x : 0);
  let r = Math.random() * w.reduce((a, b) => a + b, 0);
  while (r >= w[g]) { r -= w[g]; g++; }
  save.spity = g >= 4 ? 0 : (save.spity || 0) + 1;
  const pool = SKILLS.filter(s => s.grade === g && !s.boss);
  return pool[Math.floor(Math.random() * pool.length)].id;
}
// 빈(열린) 칸에 자동 장착
function skAutoEquip(id) {
  if (save.slots.includes(id)) return;
  const i = save.slots.findIndex((x, k) => !x && skSlotOpen(k));
  if (i >= 0) save.slots[i] = id;
}
// 스킬 얻기: 'new' | 'copy'(조각 +1) | 'dust'(★5 · 남은 각성 조각 충분 → 별가루 +5)
function gainSkill(id) {
  save.sk = save.sk || {};
  const o = save.sk[id];
  if (!o) { save.sk[id] = { lv: 1, star: 1, copy: 0 }; skAutoEquip(id); return 'new'; }
  let need = 0;
  for (let s = o.star; s < STAR_MAX; s++) need += SK_AWAKEN[s];
  if (need <= o.copy) { save.dust += SK_DUST; return 'dust'; }
  o.copy++;
  return 'copy';
}
const skIcon = sk => `<i class="skico" style="--gc:${GRADES[sk.grade].color}">${FX_ICON[sk.fx] || '✦'}</i>`;
function doSkillGacha(n, again) {
  if (!payGacha('skill', n === 10 ? SGACHA10_COST : SGACHA_COST, again)) return;
  const got = [];
  for (let i = 0; i < n; i++) got.push(skillRoll());
  if (n === 10 && !got.some(id => skillById(id).grade >= 2)) { save.spity = Math.max(0, save.spity - 1); got[9] = skillRoll(2); }   // 10회는 희귀 이상 1개 보장 (바꾼 1장은 천장에 한 번만)
  const res = got.map(id => ({ id, kind: gainSkill(id) }));
  track('gacha', n);
  refreshStats(); writeSave(); updateHud();
  closeModal();
  $('gacha').hidden = false;
  $('gTitle').textContent = '스킬 뽑기';
  $('gCards').innerHTML = res.map((x, i) => {
    const sk = skillById(x.id), G = GRADES[sk.grade];
    return `<div class="gcard g${sk.grade}" style="--d:${i * 0.18}s"><div class="gbeam"></div>${skIcon(sk)}
      <b style="color:${G.color}">${G.name}</b><span>${sk.name}</span><small>${x.kind === 'new' ? '<em class="newb">NEW!</em>' : x.kind === 'copy' ? '조각 +1' : `별가루 +${SK_DUST}`}</small></div>`;
  }).join('');
  res.forEach((x, i) => setTimeout(() => Sound.reveal(skillById(x.id).grade), i * 180));
  $('gacha').classList.toggle('flash', res.some(x => skillById(x.id).grade >= 4));
  showAgain('skill');
}
// 배우기(일반, Lv 0 → 1) 또는 골드 강화. 했으면 true
function learnSkill(id) {
  const sk = skillById(id), o = skOf(id);
  if (!sk) return false;
  if (!o) {
    if (!skLearnable(sk) || save.gold < skCost(sk, 0)) return false;
    save.gold -= skCost(sk, 0);
    save.sk[id] = { lv: 1, star: 1, copy: 0 };
    skAutoEquip(id);
  } else {
    if (o.lv >= skMaxLv(o.star) || save.gold < skCost(sk, o.lv)) return false;
    save.gold -= skCost(sk, o.lv);
    o.lv++;
  }
  track('upgrades');
  refreshStats(); updateHud();
  return true;
}
function awakenSkill(id) {
  const o = skOf(id), sk = skillById(id);
  if (!sk || !skCanAwaken(id)) return false;
  o.copy -= SK_AWAKEN[o.star];
  o.star++;
  refreshStats(); writeSave(); updateHud();
  fanfare(o.star === STAR_MAX ? '스킬 최종 각성!' : '스킬 각성!', `${sk.name} · ${'★'.repeat(o.star)} · 최대 Lv ${skMaxLv(o.star)}`, Sound.levelUp);
  return true;
}
// 장착/해제 (slot: 넣을 칸, 없으면 빈 칸)
function equipSkill(id, slot) {
  if (!skOf(id)) return false;
  const at = save.slots.indexOf(id);
  if (at >= 0 && slot === undefined) save.slots[at] = null;
  else {
    const i = slot !== undefined ? slot : save.slots.findIndex((x, k) => !x && skSlotOpen(k));
    if (i < 0 || !skSlotOpen(i)) { alert('스킬 칸 부족 · 다른 스킬 해제 필요'); return false; }
    if (at >= 0) save.slots[at] = null;
    save.slots[i] = id;
  }
  refreshStats(); updateHud();
  return true;
}
// 챕터 보스 첫 처치: 그 챕터 보스 전용 스킬 (이미 있으면 null)
function grantBossSkill(c) {
  const sk = SKILLS.find(s => s.boss === +c);
  if (!sk || skOf(sk.id)) return null;
  gainSkill(sk.id);
  return sk;
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

// 대화: who = hero(리더) | boss | miru | serin | kai | narr, {name}은 리더 이름으로 바뀜
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
// mech: 보스 특수 공격 (MECHS · slam = 7초마다 강한 박치기, root = 8초마다 2초 동안 묶음, poison = 8초마다 독침, 4초 동안 독 피해, 챕터 4~10은 content.js)
// 몬스터 ranged: true = 원거리 (줄 뒤에서도 파티원을 쏜다), shot: 투사체 색 · bgm: 캠프·전투 곡 (audio.js 곡 이름)
// 챕터 4~10: content.js 데이터 (n 순서), 대사(talk)·혼잣말(lines)도 데이터에서
const SHOT_COL = { snowowl: '#e8f4ff', jelly: '#9fe8ff', firebat: '#ff7a3a', windsprite: '#c8ffe8', gearbot: '#ff6a5a', batwitch: '#c070ff', stardust: '#fff0a0', voideye: '#b080ff' };
function chapterOf(C) {
  return { n: C.n, name: C.name, theme: C.theme, bgm: C.bgm || C.theme,
    monsters: C.monsters.map(m => ({ ...m, ...(m.ranged ? { shot: m.shot || SHOT_COL[m.sprite] || '#ffb05a' } : {}) })),
    boss: { ...C.boss }, talk: C.talk, lines: C.lines };
}
const CHAPTERS = [
  { n: 1, name: '들꽃 평원', theme: 'meadow', bgm: 'meadow',
    monsters: [{ from: 1, sprite: 'slime', name: '풀잎 슬라임', align: 'neutral', body: 'soft' }, { from: 8, sprite: 'mushroom', name: '꽃버섯', align: 'neutral', body: 'plant' }, { from: 15, sprite: 'bee', name: '들벌', align: 'neutral', body: 'flying', ranged: true, shot: '#ffd84a' }],
    boss: { name: '거대 슬라임 왕', sprite: 'slime_king', mech: 'slam', every: 7, mechName: '몸통 박치기', ally: 'miru', align: 'neutral', body: 'soft' } },
  { n: 2, name: '속삭이는 숲', theme: 'forest', bgm: 'forest',
    monsters: [{ from: 1, sprite: 'wisp', name: '숲 요정', align: 'good', body: 'spirit', ranged: true, shot: '#bfe8ff' }, { from: 8, sprite: 'toadstool', name: '독버섯', align: 'neutral', body: 'plant' }, { from: 15, sprite: 'sprout', name: '나무 정령', align: 'good', body: 'plant' }],
    boss: { name: '고목 수호자', sprite: 'treant', mech: 'root', every: 8, mechName: '뿌리 감옥', ally: 'serin', align: 'good', body: 'plant' } },
  { n: 3, name: '붉은 사막', theme: 'desert', bgm: 'desert',
    monsters: [{ from: 1, sprite: 'cactus', name: '선인장 무사', align: 'neutral', body: 'plant', ranged: true, shot: '#9ad86a' }, { from: 8, sprite: 'scorpion', name: '모래 전갈', align: 'neutral', body: 'armored' }, { from: 15, sprite: 'mummy', name: '붕대 유령', align: 'evil', body: 'spirit' }],
    boss: { name: '사막 전갈 여왕', sprite: 'scorpion_queen', mech: 'poison', every: 8, mechName: '독침', ally: 'kai', align: 'neutral', breaker: true, body: 'armored' } },
].concat(CONTENT.chapters.filter(C => C && C.n > 3 && C.boss && Array.isArray(C.monsters) && C.monsters.length).sort((a, b) => a.n - b.n).map(chapterOf));
CHAPTERS.forEach((C, i) => {                                           // 챕터 4~ 대사·전투 혼잣말
  if (C.talk) TALK[i + 1] = C.talk;
  if (Array.isArray(C.lines) && C.lines.length) LINES.battle[i + 1] = C.lines;
});
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

// 몬스터 성장: 챕터 1은 빠르게(g1), 챕터 2~3은 완만하게(g2), 스테이지 61부터 3단계(g3)
const GROW2_END = 3 * STAGES_PER;                                      // 이 스테이지까지 2단계
function growth(stage, g1, g2, g3) {
  const n = stage - 1, a = STAGES_PER - 1, b = GROW2_END - 1;
  return Math.pow(g1, Math.min(n, a)) * Math.pow(g2, Math.max(0, Math.min(n, b) - a)) * Math.pow(g3 ?? g2, Math.max(0, n - b));
}
// 챕터 4~10 몬스터 배율 BAL.ch[챕터] = [체력, 공격력] (몬스터 종류마다 다른 난이도 고르기)
const chMul = (stage, i) => ((ADD() ? BAL.chA : BAL.ch)[chOf(stage)] || [1, 1])[i];
const poly = (stage, add, pow) => Math.pow(1 + add * (stage - 1), pow);
const hpGrowth = stage => (ADD() ? poly(stage, BAL.hpAddA, BAL.hpPowA) : growth(stage, BAL.hpGrow, BAL.hpGrow2, BAL.hpGrow3)) * chMul(stage, 0);
const atkGrowth = stage => (ADD() ? poly(stage, BAL.atkAddA, BAL.atkPowA) : growth(stage, BAL.atkGrow, BAL.atkGrow2, BAL.atkGrow3)) * chMul(stage, 1);
const monHp0 = () => ADD() ? BAL.monHpA : BAL.monHp;     // 1-1 몬스터 체력·공격력 (성장 방식별)
const monAtk0 = () => ADD() ? BAL.monAtkA : BAL.monAtk;
const kingMul = c => ((ADD() ? BAL.kingA : BAL.king)[c] || [1, 1]);

function monGold(stage) { return Math.ceil(BAL.monGold * BAL.allGold * Math.pow(BAL.goldGrow, stage - 1)); }

// 치명타 저항: 스테이지마다 1.5%씩. 내 치명타 확률에서 그만큼 빠진다
function critRes(stage) { return Math.min(BAL.critMax, (stage - 1) * BAL.critStep); }

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
  beast:   { name: '야수', weak: ['pierce', 'fire'], resist: ['magic'] },
  frost:   { name: '얼음', weak: ['fire'],          resist: ['pierce', 'slash'] },
  flame:   { name: '화염체', weak: ['magic'],       resist: ['fire', 'slash'] },
};
// 화염은 마법 약점에도 통하지만, 화염 저항(화염체)이 먼저
function elemMul(body, el) {
  const B = BODY[body];
  if (!B) return 1;
  if (B.weak.includes(el)) return 1.5;
  if (B.resist.includes(el)) return 0.7;
  if (el === 'fire' && B.weak.includes('magic')) return 1.5;
  return 1;
}
// 여러 속성이 섞인 공격은 가장 잘 통하는 속성으로
const affinity = (mon, els) => Math.max(...els.map(el => elemMul(mon.body, el)));
const heroEls = () => { const A = allyById(leaderId()); return [A.type === 'heal' || A.type === 'support' ? 'magic' : allyEl(leaderId())].concat(stats.mods.smite > 0 ? ['holy'] : []); };
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
  const hp = Math.floor(monHp0() * BAL.allHp * hpGrowth(stage) * (boss ? BAL.bossHp : 1));
  return {
    ...type,
    name: boss ? '대장 ' + type.name : type.name,
    boss, hp, maxHp: hp,
    atk: Math.floor(monAtk0() * BAL.allAtk * atkGrowth(stage) * (boss ? BAL.bossAtk : 1)),
    aspd: BAL.monAspd,
    gold: monGold(stage) * (boss ? BAL.bossGold : 1),
    critRes: critRes(stage),
    x: 330, cd: 0.6, hurt: 0, dead: 0,
  };
}

// ── 숫자 표시 (1.2만, 3.4억) ─────────────────
// 골드 칸: 1000조 아래는 전부, 그 이상은 짧게
const goldText = () => save.gold < 1e15 ? Math.floor(save.gold).toLocaleString('ko-KR') : fmt(save.gold);
function fmt(n) {
  n = Math.floor(n);
  if (n < 10000) return n.toLocaleString('ko-KR');
  if (n >= 1e24) return n.toExponential(1).replace('e+', 'e');
  const units = [['해', 1e20], ['경', 1e16], ['조', 1e12], ['억', 1e8], ['만', 1e4]];
  for (const [u, v] of units) if (n >= v) return (n / v).toFixed(n / v < 100 ? 1 : 0) + u;
}

// ── 저장 ────────────────────────────────────
let save = null;

function newSave(starter) {
  return { name: '모험단', gender: 'm', leader: starter, gold: 0, stage: 1, clv: { [starter]: { ...ZERO_LV } }, saveV: 3,
    chest: 0, chestAt: Date.now(), potions: 3, sk: { strike: { lv: 1, star: 1, copy: 0 } }, slots: ['strike', null, null, null], skV: 1, chV: 1, spity: 0, autoSkill: true, items: [], gear: {}, nextItem: 1, gearV2: true, shards: 0, bosses: {}, allies: { [starter]: 1 }, party: [], seenCh: 1, traits: {}, job: null, adv: null, traitsV: 2, astar: { [starter]: 1 }, acopy: {}, apity: 0, dust: 100, stats: {}, daily: null, mainIdx: 0, mainBase: 0, savedAt: Date.now() };
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

// ── 세이브 서명 (브라우저 저장소를 직접 고친 세이브 찾기 → 랭킹 제외) ──
// sig = cyrb53(JSON(세이브에서 sig 뺀 것) + SAVE_SALT). JSON.parse 는 키 순서를 그대로 지켜서 읽은 뒤 다시 계산해도 같은 값.
// 서명 없는 옛 세이브(sigV 없음)는 통과 후 다음 저장 때 서명. 불일치 → save.tamper = true (코드로 지우지 않음, 새 게임만 초기화)
const SAVE_SALT = 'star-tale|별의 설화|2026-10-14|✦ 몰래 고친 세이브는 랭킹 제외';
function cyrb53(str, seed = 0) {
  let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) { const ch = str.charCodeAt(i); h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677); }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}
function saveSig(s) { const { sig, ...rest } = s; return cyrb53(JSON.stringify(rest) + SAVE_SALT).toString(36); }
function signSave(s) { s.sigV = 1; s.sig = saveSig(s); return s; }
// 읽은 세이브 검사 (localStorage·클라우드 모두): 서명이 틀리거나, 서명했던 세이브(sigV)에서 서명이 빠졌으면 변조
function checkSave(s) {
  if (!s || typeof s !== 'object') return s;
  if (s.sig === undefined ? s.sigV !== undefined : s.sig !== saveSig(s)) s.tamper = true;
  return s;
}

function writeSave() {
  if (!save || sleeping) return;
  save.savedAt = Date.now();
  signSave(save);
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* 저장 불가 환경 */ }
}

function readSave() {
  try { return migrateSave(checkSave(JSON.parse(localStorage.getItem(SAVE_KEY)))); }
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
    if (!s || typeof s !== 'object' || !s.name || (!s.lv && !s.clv)) return null;
    // 옛날 저장(1단계) 이어받기
    if (s.chest === undefined) { s.chest = 0; s.chestAt = Date.now(); s.potions = 3; }
    delete s.kills; delete s.best;
    if (s.lv && typeof s.lv === 'object') for (const k of ['atk', 'hp', 'regen', 'crit', 'aspd']) s.lv[k] = Math.min(Math.max(0, Math.floor(+s.lv[k] || 0)), { crit: 30, aspd: 40 }[k] ?? Infinity);   // 옛 전역 강화 (v3 이전)
    if (!s.items) { s.items = []; s.gear = {}; s.nextItem = 1; }
    if (s.shards === undefined) s.shards = 0;
    if (!s.bosses) { s.bosses = s.bossDone ? { 1: true } : {}; delete s.bossDone; }
    if (!s.allies || typeof s.allies !== 'object') { s.allies = {}; s.party = []; }
    if (!s.astar) { s.astar = {}; s.acopy = {}; s.apity = 0; }
    if (!s.acopy) s.acopy = {};
    if (!Array.isArray(s.party)) s.party = [];
    s.party = s.party.filter(id => allyById(id) || GONE[id]);
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
    if (s.saveV !== 3) migrateV3(s);
    if (s.skV !== 1) migrateSkills(s);
    if (s.chV !== 1) { if (s.bosses && s.bosses[3]) s.chNotice = 1; s.chV = 1; }   // 챕터 4~10 개방 안내 (챕터 3을 이미 끝낸 세이브에 한 번)
    // 스킬 정리 (이상한 값이 섞여도 버티게)
    if (!s.sk || typeof s.sk !== 'object') s.sk = {};
    for (const id of Object.keys(s.sk)) {
      const o = s.sk[id];
      if (!skillById(id) || !o || typeof o !== 'object') { delete s.sk[id]; continue; }
      o.star = Math.min(STAR_MAX, Math.max(1, Math.floor(+o.star || 1)));
      o.lv = Math.min(SK_LV_CAP, Math.max(1, Math.floor(+o.lv || 1)));
      o.copy = Math.max(0, Math.floor(+o.copy || 0));
    }
    s.slots = (Array.isArray(s.slots) ? s.slots : []).slice(0, SKILL_SLOTS).map((id, i, a) => id && s.sk[id] && a.indexOf(id) === i ? id : null);
    while (s.slots.length < SKILL_SLOTS) s.slots.push(null);
    s.spity = Math.max(0, Math.floor(+s.spity || 0));
    if (s.autoSkill === undefined) s.autoSkill = true;
    // v3 세이브 정리 (이상한 값이 섞여도 버티게)
    if (!s.clv || typeof s.clv !== 'object') s.clv = {};
    for (const id of Object.keys(s.clv)) {
      if (!allyById(id) || !s.clv[id] || typeof s.clv[id] !== 'object') { delete s.clv[id]; continue; }
      for (const u of CHAR_UPS) s.clv[id][u.id] = Math.min(u.max, Math.max(0, Math.floor(+s.clv[id][u.id] || 0)));
    }
    for (const id of Object.keys(s.allies)) if (!allyById(id)) delete s.allies[id]; else s.allies[id] = 1;
    if (s.leader && !allyById(s.leader)) s.leader = Object.keys(s.allies)[0] || 'tobi';
    if (s.leader && !s.allies[s.leader]) { s.allies[s.leader] = 1; s.astar[s.leader] = s.astar[s.leader] || 1; }
    s.party = s.party.filter((id, i, a) => allyById(id) && s.allies[id] && id !== s.leader && a.indexOf(id) === i);
    return s;
  } catch (e) { console.warn(e); return null; }
}

// ── 세이브 이전 v3 (대개편): 캐릭터별 강화·체력 회복 삭제·중복 동료 정리. saveV로 한 번만 ──
// 1. 리더 강화(clv) ← 옛 전역 강화(save.lv), '체력 회복' 강화 골드 환급
// 2. 다른 보유 동료: 옛 동료 레벨에 쓴 골드만큼의 공격력·체력 레벨로 변환 (최소 리더 레벨의 60%, 최대 리더 레벨). 골드 환급 없음
//    (옛 동료 비용 400·1.45^Lv 는 너무 커서 골드로 바꾸면 폭발 → 레벨로만 변환, 리더의 옛 동료 레벨은 환급 없음)
// 3. 삭제 동료 보상(별가루·골드), 리더였으면 남은 동료 중 가장 강한 동료가 리더 (리더 강화 물려받음)
//    환급 골드 합(체력 회복 + 삭제 동료)은 최대 monGold(스테이지) × 2000
// 4. 스킬 이전은 스킬 개편에서 따로
// 5. reworkNotice: 로비에서 한 번 안내
function migrateV3(s) {
  const n = v => Math.max(0, Math.floor(+v || 0));
  const allyGold = L => { let g = 0; for (let k = 1; k < L; k++) g += Math.floor(400 * Math.pow(1.45, k)); return g; };   // 옛 동료 강화(allyCost)에 쓴 골드
  const old = s.lv && typeof s.lv === 'object' ? s.lv : {};
  const lead = { atk: n(old.atk), hp: n(old.hp), aspd: Math.min(40, n(old.aspd)), crit: Math.min(30, n(old.crit)), agi: 0 };
  let gold = 0, dust = 0;
  for (let k = 0; k < Math.min(n(old.regen), 2000); k++) gold += Math.floor(25 * Math.pow(1.09, k));   // 체력 회복 환급
  const oldLv = {};
  for (const id of Object.keys(s.allies)) oldLv[id] = Math.min(Math.max(1, n(s.allies[id]) || 1), 20 + Math.min(5, Math.max(1, n(s.astar[id]) || 1)) * 10);
  const pw = id => RARITY[allyById(id).r].mul * (1 + 0.25 * (Math.min(5, n(s.astar[id]) || 1) - 1));   // 등급·각성
  const partyWas = s.party.filter((id, i, a) => id && id !== s.leader && (allyById(id) || GONE[id]) && s.allies[id] && a.indexOf(id) === i).length;   // 옛 배치 인원
  // 삭제 동료 보상
  for (const id of Object.keys(GONE)) {
    if (!s.allies[id]) continue;
    const st = Math.min(5, Math.max(1, n(s.astar[id]) || 1));
    dust += { 1: 30, 2: 80, 3: 300 }[GONE[id][2]] + 40 * (st - 1) + n(s.acopy[id]) * 10;
    if (id !== s.leader) gold += allyGold(oldLv[id]);                              // 삭제된 리더의 옛 동료 레벨은 환급 없음
    delete s.allies[id]; delete s.astar[id]; delete s.acopy[id];
  }
  for (const id of Object.keys(s.allies)) if (!allyById(id)) delete s.allies[id];
  // 리더 정리: 삭제된 리더면 등급·각성이 가장 높은 동료(없으면 토비)
  if (s.leader && !allyById(s.leader)) {
    const own = Object.keys(s.allies).sort((a, b) => pw(b) - pw(a));
    s.leader = own[0] || 'tobi';
  }
  if (s.leader && !s.allies[s.leader]) { s.allies[s.leader] = 1; s.astar[s.leader] = s.astar[s.leader] || 1; oldLv[s.leader] = 1; }
  const pmax = 3 + (s.bosses && s.bosses[2] ? 1 : 0) + (s.bosses && s.bosses[3] ? 1 : 0);
  s.party = s.party.filter((id, i, a) => allyById(id) && s.allies[id] && id !== s.leader && a.indexOf(id) === i).slice(0, pmax);
  // 삭제 동료(또는 새 리더)가 빠진 자리는 남은 동료 중 등급·각성 높은 순으로 채움 (옛 배치 인원까지)
  const spare = Object.keys(s.allies).filter(id => id !== s.leader && !s.party.includes(id)).sort((a, b) => pw(b) - pw(a) || (oldLv[b] || 1) - (oldLv[a] || 1));
  while (s.party.length < Math.min(pmax, partyWas) && spare.length) s.party.push(spare.shift());
  // 강화 이전
  s.clv = s.clv && typeof s.clv === 'object' ? s.clv : {};
  if (s.leader) s.clv[s.leader] = lead;                                                // 리더의 옛 동료 레벨은 환급 없음 (리더 강화가 대신)
  else s.leadLv = lead;                                                                // 리더를 아직 안 고른 옛 세이브: 고른 동료가 물려받음
  const up = CHAR_UPS[0];                                                              // 공격력·체력 비용 공식이 같음
  for (const id of Object.keys(s.allies)) {
    if (id === s.leader) continue;
    let G = allyGold(oldLv[id] || 1);
    const L = { ...ZERO_LV };
    for (let guard = 0; guard < 5000; guard++) {
      const k = L.atk <= L.hp ? 'atk' : 'hp', c = upgradeCost(up, L[k]);
      if (G < c) break;
      G -= c; L[k]++;
    }
    L.atk = Math.min(lead.atk, Math.max(L.atk, Math.floor(0.6 * lead.atk)));          // 리더 레벨의 60% ~ 100%
    L.hp = Math.min(lead.hp, Math.max(L.hp, Math.floor(0.6 * lead.hp)));
    s.clv[id] = L;
  }
  for (const id of Object.keys(s.allies)) s.allies[id] = 1;                           // 이제 보유 여부만
  gold = Math.min(gold, monGold(Math.min(MAX_STAGE, Math.max(1, n(s.stage) || 1))) * 2000);   // 환급 상한
  s.gold = (+s.gold || 0) + gold;
  s.dust = (+s.dust || 0) + dust;
  s.reworkNotice = { gold, dust };
  delete s.lv;
  s.saveV = 3;
}

// ── 스킬 대개편 이전 (skV 1): 옛 save.skills {id: lv} → save.sk (★1), 칸 4개, 이미 깬 보스의 전용 스킬 지급 ──
// 옛 레벨은 그대로 유지 (★1 최대 Lv 10을 넘어도 값은 그 레벨로, 강화만 각성 뒤에). 절대 상한 Lv 30을 넘는 부분은 골드 환급
const SK_LV_CAP = skMaxLv(STAR_MAX);
function migrateSkills(s) {
  const old = s.skills && typeof s.skills === 'object' ? s.skills : { strike: 1 };
  s.sk = s.sk && typeof s.sk === 'object' ? s.sk : {};
  let gold = 0;
  for (const [id, v] of Object.entries(old)) {
    const sk = skillById(id), lv = Math.floor(+v || 0);
    if (!sk || lv < 1 || s.sk[id]) continue;
    for (let k = SK_LV_CAP; k < Math.min(lv, 500); k++) gold += skCost(sk, k);
    s.sk[id] = { lv: Math.min(lv, SK_LV_CAP), star: 1, copy: 0 };
  }
  s.slots = (Array.isArray(s.slots) ? s.slots : []).slice(0, SKILL_SLOTS).map((id, i, a) => id && s.sk[id] && a.indexOf(id) === i ? id : null);
  while (s.slots.length < SKILL_SLOTS) s.slots.push(null);
  const boss = [];
  for (let c = 1; c <= 10; c++) {
    const sk = SKILLS.find(x => x.boss === c);
    if (!sk || !(s.bosses && s.bosses[c]) || s.sk[sk.id]) continue;
    s.sk[sk.id] = { lv: 1, star: 1, copy: 0 };
    boss.push(sk.id);
    const i = s.slots.findIndex((x, k) => !x && (k < SKILL_SLOTS - 1 || s.bosses[3]));
    if (i >= 0) s.slots[i] = sk.id;
  }
  if (gold) s.gold = (+s.gold || 0) + gold;
  s.spity = s.spity || 0;
  if (s.autoSkill === undefined) s.autoSkill = true;
  s.skillNotice = { boss, gold };
  delete s.skills;
  s.skV = 1;
}

// ── 매일 출석: 날마다 소량, 7일째 크게. 하루 빠지면 1일차부터 ──
const ATTEND = [
  { text: '별가루 5 · 골드',      give: u => { save.dust += 5; save.gold += u; } , gold: 1 },
  { text: '물약 2 · 골드',        give: u => { save.potions += 2; save.gold += u; }, gold: 1 },
  { text: '별가루 10',            give: () => { save.dust += 10; } },
  { text: '골드 ×3',              give: u => { save.gold += u * 3; }, gold: 3 },
  { text: '별가루 15',            give: () => { save.dust += 15; } },
  { text: '희귀 이상 장비 상자',  give: () => { addItem(makeItem(topStage(), gachaGrade(2))); } },
  { text: '전설 동료 1명 + 별가루 20', give: () => { const pool = ALLIES.filter(A => A.r === 3); gainAlly(pool[Math.floor(Math.random() * pool.length)].id); save.dust += 20; }, big: true },
];
const attendGold = () => Math.max(500, Math.floor(idleRate() * 600));          // 방치 10분치
const dayKey = d => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
const attendReady = () => !save.attend || save.attend.last !== todayKey();
function attendDay() {                                                           // 오늘이 몇 일차인지 (1~7)
  const a = save.attend, y = new Date(); y.setDate(y.getDate() - 1);
  const streak = a && a.last === dayKey(y) ? a.streak + 1 : 1;
  return { streak, day: (streak - 1) % 7 + 1 };
}
function openAttend() {
  modalKind = 'attend';
  $('mTitle').textContent = '매일 출석';
  const ready = attendReady(), { streak, day } = ready ? attendDay() : { streak: save.attend.streak, day: (save.attend.streak - 1) % 7 + 1 }, u = attendGold();
  $('mBody').innerHTML = `<div class="mgold" id="mGold"></div>
    <p class="lead">매일 접속하면 보상 · 7일째 전설 동료 · 하루라도 빠지면 1일차부터 · 연속 ${streak}일</p>
    <div class="attend">${ATTEND.map((A, i) => {
      const d = i + 1, done = d < day || (d === day && !ready), today = d === day && ready;
      return `<div class="aday${today ? ' today' : ''}${done ? ' done' : ''}${A.big ? ' big' : ''}"><b>${d}일차</b><span>${A.text}${A.gold ? ` ${fmt(u * A.gold)}` : ''}</span>${done ? '<em>✔</em>' : ''}</div>`;
    }).join('')}</div>
    <div class="gbtns"><button id="attOk" ${ready ? '' : 'disabled'}>${ready ? day + '일차 보상 받기' : '오늘 받음 · 내일 또'}</button></div>`;
  $('modal').hidden = false;
  refreshModal();
  if (ready) $('attOk').onclick = () => {
    const now = attendDay();
    ATTEND[now.day - 1].give(attendGold());
    save.attend = { last: todayKey(), streak: now.streak };
    Sound.claim && Sound.claim();
    refreshStats(); updateHud(); writeSave(); cloudUpload();
    closeModal();
    fanfare(`${now.day}일차 출석!`, ATTEND[now.day - 1].text, Sound.levelUp);
  };
}

// ── 접속 보상: 꺼 둔 동안 모인 골드(상자) + 별가루(30분에 1, 최대 16) ──
let AWAY_MIN = 300, AWAY_X2 = 20;
function checkAway() {
  const sec = Math.min(IDLE_CAP_HOURS * 3600, (Date.now() - (save.savedAt || Date.now())) / 1000);
  if (sec >= AWAY_MIN) {
    const p = save.awayPend || { dust: 0, sec: 0 };
    save.awayPend = { dust: Math.min(BAL.awayDust, p.dust + Math.floor(sec / 1800)), sec: Math.max(p.sec, sec) };
  }
  return save.awayPend && (save.awayPend.dust > 0 || save.chest >= 1);
}
function showAway(next) {
  accrue();
  const p = save.awayPend, gold = Math.floor(save.chest), h = Math.floor(p.sec / 3600), m = Math.floor(p.sec % 3600 / 60);
  $('away').hidden = false;
  { const c = $('awayChest').getContext('2d'); c.clearRect(0, 0, 144, 120); c.drawImage(SPR.chest_full, 0, 0, 144, 120); }
  $('awayBody').innerHTML = `<p>${h ? h + '시간 ' : ''}${m}분 동안 모은 것</p><div class="awrow"><span class="coin"></span>${fmt(gold)} G</div>${p.dust ? `<div class="awrow">✦ 별가루 ${p.dust}</div>` : ''}`;
  $('awayX2').innerHTML = `2배로 받기<small>골드 ×2 · 별가루 ${AWAY_X2}</small>`;
  $('awayX2').disabled = save.dust < AWAY_X2 || gold < 1;
  const take = x2 => {
    if (x2) { if (save.dust < AWAY_X2) return; save.dust -= AWAY_X2; save.gold += gold; }
    save.dust += p.dust;
    save.awayPend = null;
    $('away').hidden = true;
    collectChest();
    if (x2) notify('2배 획득!', '#ffe27a');
    writeSave(); updateHud();
    if (next) next();
  };
  $('awayOk').onclick = () => take(false);
  $('awayX2').onclick = () => take(true);
}
// 접속 순서: 대개편 안내(한 번) → 스킬 대개편 안내 → 새 챕터 안내 → 접속 보상 → 출석
function showWelcome() {
  if (!save.leader) return;
  const att = () => { if (attendReady()) openAttend(); };
  const away = () => { if (checkAway()) showAway(att); else att(); };
  const chn = () => { if (save.chNotice && CHAPTERS.length > 3) openChNotice(away); else { delete save.chNotice; away(); } };
  const skn = () => { if (save.skillNotice) openSkillNotice(chn); else chn(); };
  if (save.reworkNotice) openRework(skn); else skn();
}
// 대개편 안내 (세이브 이전 v3 후 한 번). 확인·바깥 클릭·Esc 어느 쪽으로 닫아도 다시 안 뜸 (closeModal)
// 안내창이 여러 개면 차례로 (대개편 → 스킬 대개편 → 접속 보상 → 출석)
let noticeNext = null, noticeKey = null;
function openRework(next) {
  const N = save.reworkNotice || { gold: 0, dust: 0 };
  modalKind = 'notice';
  noticeKey = 'reworkNotice';
  noticeNext = next || null;
  $('mTitle').textContent = '대개편 안내';
  $('mClose').hidden = true;
  $('mBody').innerHTML = `<div class="mgold" id="mGold"></div>
    <p class="lead">별의 설화 대개편 · 지금까지의 진행 그대로 유지</p>
    <ul class="rwk">
      <li><b>캐릭터별 강화</b> 리더·동료 모두 각자 강화 (공격력·체력·공격 속도·치명타·민첩) · 능력치·성장 캐릭터마다 다름 · 리더 강화는 그대로 유지 · 옛 동료 레벨은 공격력·체력 강화로 변환</li>
      <li><b>따라잡기·협공</b> 최고 레벨보다 낮은 강화 비용 ${Math.round((1 - CATCHUP_MUL) * 100)}% 할인 · 동료로 싸울 때 공격력 ×${ALLY_ATK}</li>
      <li><b>체력 회복 삭제</b> 체력 회복 강화 삭제 · 환급 골드 <em>+${fmt(N.gold)} G</em></li>
      <li><b>중복 동료 정리</b> 능력이 같은 동료 6명 정리 · 보상 별가루 <em>+${fmt(N.dust)}</em></li>
      <li><b>동료 고유 능력</b> 동료 ${ALLIES.length}명 모두 서로 다른 능력 · 동료 탭에서 확인</li>
      <li><b>원거리 몬스터</b> 줄 뒤에서 공격하는 몬스터(➶) 등장</li>
      <li><b>암살자 기습 강화</b> 뒤로 잠입한 적 암살자 공격력·공격 속도 상승</li>
      <li><b>파티 체력바</b> 리더·동료 모두 체력바 · 왼쪽 아래는 파티 체력 합</li>
    </ul>
    <p class="note">팁 · 환급 골드로 동료 강화 추천 (따라잡기 할인)</p>
    <div class="gbtns"><button id="rwOk">확인</button></div>`;
  $('modal').hidden = false;
  refreshModal();
  $('rwOk').onclick = closeModal;
}
// 스킬 대개편 안내 (스킬 이전 후 한 번)
function openSkillNotice(next) {
  const N = save.skillNotice || { boss: [], gold: 0 };
  const boss = (N.boss || []).map(skillById).filter(Boolean);
  modalKind = 'notice';
  noticeKey = 'skillNotice';
  noticeNext = next || null;
  $('mTitle').textContent = '스킬 대개편 안내';
  $('mClose').hidden = true;
  $('mBody').innerHTML = `<div class="mgold" id="mGold"></div>
    <p class="lead">스킬 대개편 · 스킬 ${SKILLS.length}종 · 등급 6단계 · 스킬 뽑기 추가 · 보스 전용 스킬</p>
    <ul class="rwk">
      <li><b>스킬 ${SKILLS.length}종</b> 등급 6단계 (${GRADES.map(G => G.name).join('·')}) · 배운 스킬·레벨 그대로 유지</li>
      <li><b>스킬 뽑기</b> 뽑기 → 스킬 탭 · 중복은 조각 → 각성 (★ 하나마다 효과 +20% · 최대 레벨 +5)</li>
      <li><b>보스 전용 스킬</b> 챕터 보스 첫 처치 보상${boss.length ? ` · 지급: ${boss.map(sk => `<em style="color:${GRADES[sk.grade].color}">${sk.name}</em>`).join(', ')}` : ''}</li>
      <li><b>스킬 칸 4개</b> 4번째 칸은 챕터 3 보스 처치 시 해금 · 키 1~4</li>
      ${N.gold ? `<li><b>최대 레벨 초과분 환급</b> <em>+${fmt(N.gold)} G</em></li>` : ''}
    </ul>
    <div class="gbtns"><button id="rwOk">확인</button></div>`;
  $('modal').hidden = false;
  refreshModal();
  $('rwOk').onclick = closeModal;
}

// 새 챕터 안내 (챕터 4~10 업데이트, 챕터 3 보스를 이미 깬 세이브에 한 번)
function openChNotice(next) {
  const news = CHAPTERS.slice(3);
  modalKind = 'notice';
  noticeKey = 'chNotice';
  noticeNext = next || null;
  $('mTitle').textContent = '새 챕터 안내';
  $('mClose').hidden = true;
  $('mBody').innerHTML = `<div class="mgold" id="mGold"></div>
    <p class="lead">챕터 4~${CHAPTERS.length} 개방 · ${news[0].name} ~ ${news[news.length - 1].name} · 새 보스 ${news.length}종 · 보스 전용 스킬</p>
    <ul class="rwk">
      ${news.map(C => `<li><b>챕터 ${C.n} · ${C.name}</b> 보스 ${C.boss.name} · 특수 공격 ${C.boss.mechName}</li>`).join('')}
      <li><b>보스 첫 처치 보상</b> 별조각 +1 · 별가루 +50 · 레벨 +3 · 보스 전용 스킬</li>
    </ul>
    <p class="note">지금 진행 그대로 챕터 4부터 이어서</p>
    <div class="gbtns"><button id="rwOk">확인</button></div>`;
  $('modal').hidden = false;
  refreshModal();
  $('rwOk').onclick = closeModal;
}

// ── 다음 목표 ──
function nextGoal() {
  const cleared = save.stage - 1;
  for (let c = 1; c <= CHAPTERS.length; c++) if (bossOpen(c) && !bossBeaten(c)) {
    const B = chapter(c).boss, rw = ['별조각'].concat(B.ally ? ['동료'] : [], SKILLS.some(s => s.boss === c) ? ['보스 스킬'] : [], c === 1 ? ['특성 해금'] : c <= 3 ? ['동료 칸 +1'] : [], c === 3 ? ['스킬 칸 +1'] : []);
    return { text: `챕터 ${c} 보스 처치 → ${rw.join(' · ')}`, prog: 1, go: () => openStages(c) };
  }
  if (traitsOpen() && pointsLeft() > 0) return { text: `특성 포인트 ${pointsLeft()}개 남음 → 특성 탭에서 배치`, prog: 1, go: () => openModal('traits') };
  if (traitsOpen() && !save.job) {
    const best = Math.max(...TRAIT_TREES.map(treeSpent));
    return { text: best >= JOB_POINTS ? '1차 전직 가능!' : `한 갈래 ${JOB_POINTS}포인트 → 1차 전직 (${best}/${JOB_POINTS})`, prog: Math.min(1, best / JOB_POINTS), go: () => openModal('traits') };
  }
  const learn = SKILLS.filter(s => s.grade === 0 && s.unlock > 0);                 // 일반 스킬 해금 (골드로 배움)
  const ms = learn.map(s => ({ at: s.unlock, label: `스킬 '${s.name}' 해금` }))
    .concat(CHAPTERS.map((C, i) => ({ at: (i + 1) * STAGES_PER, label: `챕터 ${i + 1} 보스 도전` })))
    .filter(x => x.at > cleared).sort((a, b) => a.at - b.at);
  if (ms.length) {
    const t = ms[0], prev = Math.max(0, ...learn.map(s => s.unlock).concat(CHAPTERS.map((C, i) => (i + 1) * STAGES_PER)).filter(x => x <= cleared));
    return { text: `${stageLabel(t.at)} 클리어까지 ${t.at - cleared}스테이지 → ${t.label}`, prog: (cleared - prev) / Math.max(1, t.at - prev), go: () => openStages() };
  }
  return { text: '다음 이야기는 업데이트 예정 · 랭킹 올리기!', prog: 1, go: () => openRank() };
}
function updateGoal() {
  if (!$('goalBar')) return;
  const G = nextGoal();
  $('gText').textContent = G.text;
  $('gFill').style.width = Math.round(G.prog * 100) + '%';
  $('goalBar').onclick = G.go;
}

// ── 전투력 랭킹 (Firestore ranking/{uid}) ──
let rankSent = 0;
function rankUpload() {
  if (!cloudOn() || !window.Cloud.rankSave) return;
  arenaUpload();
  const p = power();
  if (p === rankSent) return;
  rankSent = p;
  window.Cloud.rankSave({ name: String(save.name || '모험단').slice(0, 10), leader: leaderId(), star: allyStar(leaderId()), power: p, stage: save.stage - 1, job: jobTitle(), at: Date.now() })
    .catch(e => { console.warn(e); rankSent = 0; });
}
async function openRank() {
  modalKind = 'rank';
  $('mTitle').textContent = '전투력 랭킹';
  $('mBody').innerHTML = '<div class="mgold" id="mGold"></div><div id="rankBody"><p class="note">불러오는 중…</p></div>';
  $('modal').hidden = false;
  refreshModal();
  if (TEST || !window.Cloud || !window.Cloud.user) return ($('rankBody').innerHTML = '<p class="note">테스트 모드 · 랭킹 꺼짐</p>');
  rankSent = 0; rankUpload();
  try {
    const my = power();
    const [top, mine] = await Promise.all([window.Cloud.rankTop(50), window.Cloud.rankOf(my)]);
    if (modalKind !== 'rank') return;
    const me = window.Cloud.user.uid;
    $('rankBody').innerHTML = `<div class="lead">내 순위 <b>${mine}위</b> · 전투력 ${fmt(my)} · 이름 ${esc(save.name)} <button id="rkName" class="plain">이름 바꾸기</button></div>
      <table class="rank"><tr><th>순위</th><th>이름</th><th>리더</th><th>전직</th><th>스테이지</th><th>전투력</th></tr>
      ${top.map((r, i) => `<tr class="${r.uid === me ? 'me' : ''}${i < 3 ? ' top' : ''}"><td>${['🥇', '🥈', '🥉'][i] || i + 1}</td><td>${esc(r.name)}</td>
        <td>${allyById(r.leader) || GONE[r.leader] ? `<img src="${allyIcon(r.leader, Math.min(5, Math.max(1, r.star | 0)))}"> ${allyById(r.leader) ? allyById(r.leader).name : GONE[r.leader][0]}` : '-'}</td><td>${esc(r.job || '')}</td>
        <td>${r.stage > 0 ? stageLabel(Math.min(r.stage, MAX_STAGE)) : '-'}</td><td>${fmt(r.power)}</td></tr>`).join('')}</table>`;
    $('rkName').onclick = () => {
      const n = (prompt('모험단 이름 (최대 8자)', save.name) || '').trim().slice(0, 8);
      if (!n) return;
      save.name = n; writeSave(); rankSent = 0; rankUpload(); setTimeout(openRank, 600);
    };
  } catch (e) {
    console.warn(e);
    if (modalKind === 'rank') $('rankBody').innerHTML = '<p class="note">랭킹 서버 준비 중 · 잠시 후 다시</p>';
  }
}

// ── 기간 한정 픽업: 매주 월요일에 바뀜. 전설이 나오면 50%로 픽업 동료 ──
const PICKUPS = ['pio', 'lea', 'noeul'];
const WEEK = 7 * 86400000, WEEK_SHIFT = 4 * 86400000;     // 1970-01-01(목) 기준 → 월요일 0시(UTC+9) 시작
const weekIdx = () => Math.floor((Date.now() + 9 * 3600000 - WEEK_SHIFT) / WEEK);
const pickupId = () => PICKUPS[weekIdx() % PICKUPS.length];
function pickupLeft() {
  const ms = (weekIdx() + 1) * WEEK + WEEK_SHIFT - 9 * 3600000 - Date.now();
  return `${Math.floor(ms / 86400000)}일 ${Math.floor(ms % 86400000 / 3600000)}시간`;
}

// ── 도감 세트: 모으면 영구 효과 + 한 번 별가루 ──
const SETS = [
  { id: 'heal',   name: '치유의 손길', ids: ['miru', 'hana'],                         text: '체력 +5%',          b: { hp: 5 },  dust: 30 },
  { id: 'magic',  name: '마법 학회',   ids: ['serin', 'pio', 'arin', 'danbi'],        text: '공격력 +5%',        b: { atk: 5 }, dust: 40 },
  { id: 'shot',   name: '명사수 모임', ids: ['kai', 'noeul', 'rio'],                  text: '치명타 확률 +3%',   b: { crit: 3 }, dust: 50 },
  { id: 'wall',   name: '철벽 전사단', ids: ['lea', 'bron', 'tobi'],                  text: '받는 피해 -3%',     b: { guard: 3 }, dust: 50 },
  { id: 'fest',   name: '별빛 악단',   ids: ['baram', 'momo'],                        text: '공격 속도 +5%',     b: { aspd: 5 }, dust: 30 },
  { id: 'story',  name: '첫 여행의 셋', ids: ['miru', 'serin', 'kai'],                text: '처치 골드 +10%',    b: { gold: 10 }, dust: 30 },
  { id: 'legend', name: '전설의 별',   ids: ['pio', 'lea', 'noeul'],                 text: '공격력·체력 +10%',  b: { atk: 10, hp: 10 }, dust: 100 },
];
const setDone = S => S.ids.every(id => save.allies && save.allies[id]);
const setReward = () => SETS.some(S => setDone(S) && !(save.sets || {})[S.id]);
function setBonus() {
  const t = { atk: 0, hp: 0, crit: 0, guard: 0, aspd: 0, gold: 0 };
  for (const S of SETS) if (setDone(S)) for (const k in S.b) t[k] += S.b[k];
  return t;
}
function setsHtml() {
  return `<div class="aff"><b>도감 세트</b> <small class="note">모두 모으면 영구 효과 + 별가루</small>${SETS.map(S => {
    const n = S.ids.filter(id => save.allies[id]).length, done = n === S.ids.length, got = (save.sets || {})[S.id];
    return `<div class="setrow${done ? ' done' : ''}"><b>${S.name}</b> <small>${n}/${S.ids.length} · ${S.text}</small>
      <span class="seticons">${S.ids.map(id => `<img src="${allyIcon(id, save.allies[id] ? allyStar(id) : 1)}" class="${save.allies[id] ? '' : 'off'}">`).join('')}</span>
      ${done ? (got ? '<em>✔ 받음</em>' : `<button data-set="${S.id}">별가루 ${S.dust} 받기</button>`) : ''}</div>`;
  }).join('')}</div>`;
}

// ── 방치 상자 ───────────────────────────────
// 깬 스테이지가 높을수록 초당 골드가 많이 쌓인다. 실제 시간 기준이라 꺼 둔 동안에도 쌓인다.
function idleRate() {
  const cleared = save.stage - 1;
  if (!BAL.idleOn) return 0;                     // 개발자 도구에서 방치 상자를 끔
  return cleared < 1 ? 0.5 : BAL.idle * monGold(cleared);
}

function accrue() {
  const now = Date.now();
  const rate = idleRate();
  const cap = rate * IDLE_CAP_HOURS * 3600;
  if (rate > 0) save.chest = Math.min(cap, save.chest + rate * Math.max(0, now - save.chestAt) / 1000);   // 상자를 꺼도 이미 쌓인 골드는 남김
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

function refreshStats() { stats = fullStats(); cstats = {}; hero.x = 70 + Math.max(0, (save.party || []).length - 3) * 18; }

// ── 전투 ────────────────────────────────────
// stage: 도전할 스테이지 (깬 곳 또는 다음 곳)
function startBattle(stage) {
  stage = Math.max(1, Math.min(stage || save.stage, topStage()));
  SEALED = false;
  refreshStats();
  hero.hp = stats.maxHp;
  hero.cd = 0;
  floats = [];
  battle = { stage, wave: 0, queue: [], earned: 0, state: 'fight', delay: 0, potionCd: 0, skillCd: {}, buffs: [], loot: [], allyCd: {}, fx: [], shield: 0, revived: false, poison: 0 };
  initAllyHp();
  spawnWave();
  if (chOf(stage) > (save.seenCh || 1)) {                          // 새 챕터에 처음 들어옴
    save.seenCh = chOf(stage);
    toast(`챕터 ${chOf(stage)} · ${chapter(chOf(stage)).name}`);
  }
  $('result').hidden = true;
  showScreen('battle');
  if (Math.random() < 0.6) say('hero', pick(LINES.battle[chOf(stage)] || LINES.battle[1]));
}

// 챕터 보스 (c = 챕터 번호)
let talkCh = 1;                    // 대화창의 'boss'가 어느 챕터 보스인지
function startBoss(c) {
  c = c || campChapter();
  if (!bossOpen(c)) return;
  const B = chapter(c).boss, last = c * STAGES_PER, M = MECHS[B.mech] || {}, KM = kingMul(c);   // KM: 챕터 보스 배율 [체력, 공격력]
  SEALED = false;
  refreshStats();
  hero.hp = stats.maxHp;
  hero.cd = 0;
  floats = [];
  const k = makeMonster(last, true);
  Object.assign(k, {
    name: B.name, sprite: B.sprite, king: true, size: 64, x: 200, align: B.align, body: B.body, ranged: !!B.ranged,
    hp: Math.floor(monHp0() * BAL.allHp * hpGrowth(last) * BAL.kingHp * KM[0] * (M.hpMul || 1)),               // 별의 붕괴: 체력 ×1.5
    atk: Math.floor(monAtk0() * BAL.allAtk * atkGrowth(last) * BAL.kingAtk * KM[1]),
    gold: monGold(last) * BAL.kingGold,
    critRes: critRes(last) + 5,
  });
  k.maxHp = k.hp;
  battle = { stage: last, ch: c, king: true, mech: B.mech, every: B.every, wave: 0, queue: [k], earned: 0, state: 'talk', delay: 0, potionCd: 0, skillCd: {}, buffs: [], loot: [],
    timeLeft: bossTime(B), mechCd: B.every, mechWarn: 0, bound: 0, allyCd: {}, fx: [], shield: 0, revived: false, poison: 0, frozen: {}, mt: 0, cos: 0 };
  initAllyHp();
  $('result').hidden = true;
  showScreen('battle');
  talkCh = c;
  giveShield();
  const T = TALK[c] || {};
  playDialog(talkLines(bossBeaten(c) ? T.again : T.intro), () => { if (battle && battle.state === 'talk') battle.state = 'fight'; });
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
    else Object.assign(m, ELITE_LOOK[role], { ranged: false });
  }
  // 깜짝 난입: 황금 슬라임(골드·별가루) 또는 보물 골렘(장비). 8초 안에 못 잡으면 도망
  if (Math.random() < 0.12) {
    const gol = Math.random() < 0.2, m = makeMonster(battle.stage, false);
    Object.assign(m, { name: gol ? '보물 골렘' : '황금 슬라임', sprite: gol ? 'golem' : 'gold_slime', body: gol ? 'armored' : 'soft', align: 'neutral',
      size: gol ? 44 : 36, intruder: gol ? 'golem' : 'slime', escape: 8, gold: 0, x: 195, ranged: false });
    m.hp = m.maxHp = Math.floor(m.hp * (gol ? 4 : 2.5));
    battle.queue.unshift(m);
    toast(`${m.name} 난입! 8초 안에 잡기`);
    say('hero', gol ? '보물 골렘이다!' : '황금 슬라임이다! 놓치지 마!', 2);
  }
  if (battle.wave === WAVES.length - 1 && Math.random() < 0.5) say('hero', pick(LINES.bossWave));
  giveShield();
  updateBattleHud();
}

function giveShield() {
  const pct = stats.mods.shield;
  if (!pct) return;
  battle.shield = Math.max(battle.shield || 0, Math.floor(stats.maxHp * pct / 100));   // 스킬 보호막이 더 크면 유지
  addFloat('보호막', hero.x + 16, GROUND - 56, '#9fd0ff');
}

function addFloat(text, x, y, color, big) { floats.push({ text, x, y, color, big, t: 0 }); }

// 리더가 피해를 받는다. 리더가 이미 쓰러졌으면 맨 앞 동료가 대신 맞는다. 파티 전멸이면 true
// mon: 때린 적 (브론 리더 반사용, 독처럼 없으면 반사 없음)
function takeHit(raw, color, big, noDodge, mon) {
  if (hero.hp <= 0) {
    const front = (save.party || []).find(id => !allyDown(id));
    if (front) hurtAlly(front, raw);
    return partyWiped();
  }
  const m = stats.mods;
  if (!noDodge && Math.random() * 100 < Math.min(75, stats.dodge + buffSum('dodge', true) * 100)) { addFloat('회피', hero.x + 16, GROUND - 40, '#9fd0ff'); return false; }
  let dmg = Math.floor(raw * (1 - Math.min(80, m.guard + buffSum('guard', true) * 100) / 100));   // 스킬 버프: 회피 +%p · 받는 피해 -%
  if (save.leader === 'bron') {                                                     // 브론 리더: 철벽 방패 (받는 피해 -25%, 받은 피해 30% 반사)
    dmg = Math.floor(dmg * (1 - BRON_LEAD_GUARD));
    if (mon && mon.dead <= 0 && dmg * 0.3 >= 1) hit(mon, 1, '#ffd0a0', 'fixed', null, { id: 'bron', atk: dmg * 0.3, crit: 0, critDmg: 1, pierce: 0 });
  }
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
  addFloat(allyName(leaderId()) + ' 쓰러짐', hero.x + 16, GROUND - 56, '#ff9aa0', true);
  onFall(save.leader);
  if (!partyWiped()) say((save.party || []).find(id => !allyDown(id)), '아직 끝나지 않았어!', 2);
  return partyWiped();
}
// 파티원 한 명에게 피해 (리더면 takeHit, 동료면 hurtAlly). 파티 전멸이면 true
function hitMember(id, raw, color, big, noDodge, mon) {
  if (id === save.leader) return takeHit(raw, color, big, noDodge, mon);
  hurtAlly(id, raw, noDodge);
  return partyWiped();
}
// 누군가 쓰러짐: 모모(응원 탬버린)가 살아 있으면 남은 파티 5초 공격력 +40%
function onFall(id) {
  if (!battle || id === 'momo' || !team().includes('momo') || allyDown('momo')) return;
  battle.rally = 5;
  addFloat('응원! 공격력 +40%', allyX(save.party.indexOf('momo')) + 16, GROUND - 66, '#ffb0e0', true);
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

  if (partyWiped()) return endBattle('lost');                // 모두 쓰러지면 패배
  battle.potionCd = Math.max(0, battle.potionCd - dt);
  battle.curse = Math.max(0, (battle.curse || 0) - dt);
  battle.rally = Math.max(0, (battle.rally || 0) - dt);
  updateHolds(dt);
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

  // 보스: 제한 시간과 특수 공격 (MECHS)
  if (battle.king) {
    battle.timeLeft -= dt;
    battle.bound = Math.max(0, battle.bound - dt);
    if (battle.timeLeft <= 0) { battle.timeLeft = 0; return endBattle('timeout'); }
    if (battle.pvp) updatePvp(dt);
    const k = battle.queue.find(m => m.king);
    if (k && k.dead <= 0) { if (battle.mech && MECHS[battle.mech] && updateMech(dt, k)) return endBattle('lost'); }
    else mirrorVanish();                                                // 보스가 쓰러지면 그림자 분신도 사라짐
    // 룰 브레이커: 챕터 3·10 보스가 체력 절반 아래로 폭주하면 14초마다 6초 동안 특성·전직 봉인
    if (k && k.dead <= 0 && chapter(battle.ch || 1).boss.breaker && !battle.dungeon && k.hp < k.maxHp * 0.5) {
      if (!battle.phase2) { battle.phase2 = true; battle.rbCd = 1.5; shake = 0.4; addFloat('폭주!', k.x + 32, GROUND - 80, '#ff5a6e', true); say('boss', RAGE_LINE[battle.ch] || RAGE_LINE[3], 2.5); }
      if ((battle.rbCd -= dt) <= 0) {
        battle.rbCd = 14;
        const singer = team().find(id => allyById(id).type === 'support' && !allyDown(id));
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
    // 화염 숨결 화상: 파티 전원, 초마다
    if (battle.pburn > 0) {
      battle.pburn -= dt;
      if ((battle.pburnT = (battle.pburnT || 0) + dt) >= 1) {
        battle.pburnT -= 1;
        if (partyHit(battle.pburnDps, '#ff8a3a', null, true)) return endBattle('lost');
      }
    }
  }

  const q = battle.queue;
  // 쓰러진 몬스터 치우기
  // 다 사라진 몬스터는 줄 어디에 있든 뺌 (예전엔 맨 앞만 빼서, 범위 공격에 먼저 쓰러진 뒤쪽 몬스터가 체력 0으로 되살아나 공격·재처치됨)
  for (const m of q) if (m.dead > 0 && (m.dead -= dt) <= 0) m.dead = -1;
  for (let i = q.length - 1; i >= 0; i--) if (q[i].dead < 0) q.splice(i, 1);
  const sn = battle.sneak;
  if (sn && sn.dead > 0 && (sn.dead -= dt) <= 0) battle.sneak = null;
  if (!q.length && !battle.sneak) return waveCleared();
  updateMonsterRoles(dt);
  // 상태 이상 (기절·최면·둔화·화상)
  for (const m of q.concat(battle.sneak ? [battle.sneak] : [])) {
    m.stun = Math.max(0, (m.stun || 0) - dt);
    m.charm = Math.max(0, (m.charm || 0) - dt);
    if (!(m.ice > 0)) m.slow = Math.max(0, (m.slow || 0) - dt);       // 빙결 중에는 둔화 시간이 줄지 않음 (녹은 뒤 둔화)
    if (m.ice > 0) m.ice -= dt;
    if (m.vuln && (m.vuln.t -= dt) <= 0) m.vuln = null;                // 스킬: 받는 피해 증가 (표식·약점)
    if (m.rioCd > 0) m.rioCd -= dt;
    m.kb = Math.max(0, (m.kb || 0) - dt * 40);
    if (m.taunt) m.taunt.t -= dt;
    if (m.burn > 0 && m.dead <= 0) {
      m.burn -= dt;
      if ((m.burnT = (m.burnT || 0) + dt) >= 0.5) { m.burnT -= 0.5; hit(m, m.burnMult, '#ff8a3a', 'dot', ['fire'], m.burnSrc); }
    }
  }
  // 암살자: 뒤에서 동료(또는 주인공)를 공격
  if (battle.sneak && battle.sneak.dead <= 0) {
    const s = battle.sneak;
    s.hurt = Math.max(0, s.hurt - dt * 4);
    if (s.target === 'hero' ? hero.hp <= 0 && (save.party || []).some(id => !allyDown(id)) : allyDown(s.target)) { s.target = sneakTarget(); s.x = s.target === 'hero' ? hero.x - 30 : allyX(save.party.indexOf(s.target)) - 22; }
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
        s.cd += 1 / s.aspd;                                         // 기습 강화로 공격력 ×1.6 · 공격 속도 ×1.4 (잠입할 때)
        s.lunge = 1;
        const dmg = s.atk * (1 - stats.mods.weak / 100);
        if (s.target === 'hero') { if (takeHit(dmg, null, false, false, s)) return endBattle('lost'); }
        else if (isWarrior(s.target)) tankHit(s.target, dmg * 0.5, s);     // 전사형은 암살자에 강함
        else hurtAlly(s.target, dmg);
        if (partyWiped()) return endBattle('lost');
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
  if (updateRanged(dt, q)) return endBattle('lost');
  if (stats.mods.hypno && front) {                      // 최면술사
    battle.hypCd = (battle.hypCd ?? 3) - dt;
    if (battle.hypCd <= 0) {
      battle.hypCd = 8;
      const others = q.filter(m => m !== mon && m.dead <= 0 && !m.king);   // 챕터 보스는 최면 공격 대상 아님 (그림자 분신)
      if (!mon.king && others.length) { mon.charm = 4; addFloat('최면!', mon.x + 16, GROUND - 56, '#ff9ae0', true); }
      else { mon.stun = 1.5; addFloat('최면… 멍', mon.x + (mon.size || 32) / 2, GROUND - (mon.size || 32) - 14, '#ff9ae0', true); }
      battle.fx.push({ kind: 'hypno', x: mon.x + (mon.size || 32) / 2, t: 0, dur: 0.6 });
    }
  }

  // 주인공 공격 (뿌리에 묶여 있거나 빙결·기절·시간 정지면 못 함). 암살자가 있으면 먼저 처리
  const tgt = sneakOn ? battle.sneak : mon;
  const lh = held(save.leader);                          // 빙결·기절·시간 정지
  if (hero.hp > 0 && !lh) hero.cd -= dt; else hero.cd = Math.max(hero.cd, 0);
  if (hero.cd <= 0 && !battle.bound && hero.hp > 0 && !lh) {
    const m = stats.mods;
    const spd = (1 + buffSum('aspd', true)) * (battle.curse > 0 ? 0.5 : 1) * (tgt.align === 'evil' ? 1 + m.smiteSpd / 100 : 1);
    hero.cd += 1 / (stats.aspd * spd);
    hero.lunge = 1;
    hero.back = sneakOn;
    hero.atk = { t: 0, dur: Math.min(0.3, 0.9 / (stats.aspd * spd)), kind: 'basic' };
    const style = leaderStyle(), tx0 = tgt.x + (tgt.size || 32) / 2;
    if (style === 'cast') battle.fx.push({ kind: 'star', from: hero.x + (sneakOn ? 10 : 22), x: tx0, t: 0, dur: 0.26 });
    else if (style === 'shoot') battle.fx.push({ kind: 'arrow', i: -1, x: tx0, t: 0, dur: 0.3, color: allyColor(leaderId()) });
    else battle.fx.push({ kind: 'hslash', x: tgt.x + (tgt.size || 32) / 2, t: 0.04, dur: 0.24, dash: true, dir: sneakOn ? -1 : 1 });
    const killed = hit(tgt, 1, null, 'basic', heroEls(), stats);
    battle.hits = (battle.hits || 0) + 1;
    if (m.wave) { const t2 = q.find(x => x !== tgt && x.dead <= 0); if (t2) { battle.fx.push({ kind: 'wave', from: hero.x + 24, x: t2.x + (t2.size || 32) / 2, t: 0, dur: 0.3 }); hit(t2, m.wave / 100, '#bfe8ff', 'extra', ['slash'], stats); } }
    if (m.color && battle.hits % m.colorEvery === 0) castColor(q);
    if (killed) return;
    if (Math.random() * 100 < m.double + buffSum('double', true) * 100 && hit(tgt, 1, '#ffc0a0', 'basic', heroEls(), stats)) return;
  }

  // 몬스터 공격 (기절이면 못 함, 최면이면 자기 편을 공격, 둔화면 느리게)
  if (front && mon.intruder) {                             // 난입 몬스터는 공격하지 않고 시간이 다 되면 도망
    if ((mon.escape -= dt) <= 0) { mon.dead = 0.5; mon.fled = true; addFloat('도망쳤다…', mon.x + 16, GROUND - 56, '#c8c8d0', true); }
    return;
  }
  if (!front || mon.stun > 0) return;
  mon.cd -= dt * (mon.slow > 0 ? 0.6 : 1);
  if (mon.cd <= 0) {
    mon.cd += 1 / mon.aspd;
    if (mon.charm > 0) {
      const o = q.find(x => x !== mon && x.dead <= 0 && !x.king);
      if (o) {
        const d = Math.floor(o.maxHp * 0.2);
        o.hp -= d; o.hurt = 1; o.kb = 6;
        addFloat(fmt(d), o.x + 16, GROUND - 40, '#ff9ae0');
        if (o.hp <= 0) { o.hp = 1; hit(o, 0.001, '#ff9ae0', 'dot', null, stats); }
      }
      return;
    }
    const tw = tauntOn(mon);
    if (tw) { tankHit(tw, mon.atk * (1 - stats.mods.weak / 100), mon); battle.anim[tw] = battle.anim[tw] || { t: 0, dur: 0.25 }; if (partyWiped()) endBattle('lost'); return; }
    if (takeHit(mon.atk * (1 - stats.mods.weak / 100), null, false, false, mon)) endBattle('lost');
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
      const healer = team().find(id => allyById(id).type === 'heal' && !allyDown(id));
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
      m.atk = Math.floor(m.atk * 1.6); m.aspd *= 1.4;              // 기습 강화: 뒤에 있는 동안 공격력 ×1.6 · 공격 속도 ×1.4
      battle.fx.push({ kind: 'smoke', x: m.x + 16, t: 0, dur: 0.6 });
      m.x = m.target === 'hero' ? hero.x - 30 : allyX(save.party.indexOf(m.target)) - 22;
      battle.fx.push({ kind: 'smoke', x: m.x + 16, t: 0, dur: 0.6 });
      addFloat('암살자 잠입!', m.x + 16, GROUND - 52, '#ff5a6e', true);
      addFloat('기습 강화!', m.x + 16, GROUND - 66, '#ffb03a', true);
      say('hero', m.target === 'hero' ? '뒤다!' : '뒤를 노린다! ' + allyName(m.target) + ' 조심해!', 2);
      break;
    }
  }
}

// ── 챕터 보스 특수 공격 (MECHS) ──
// 이름 → { warn 경고 초(기본 MECH_WARN), line 경고 대사, fire(k) 발동(파티 전멸이면 true), every(k) 다음 주기(기본 보스 every),
//          tick(k, dt) 매 프레임, onWarn(k) 경고 시작, warnTick(k) 경고 중(true면 취소), time 제한 시간, hpMul 체력 배율 }
// 챕터 1~3 slam·root·poison · 4~9 freeze·tide·breath·gust·rewind·mirror · 10 cosmos(아래 순서로 돌아가며)
const COSMOS_SEQ = ['slam', 'root', 'poison', 'freeze', 'tide', 'breath', 'gust'];
const REWIND_BACK = 6, REWIND_BREAK = 0.06;          // 되감기: 6초 전 체력 · 경고 중 최대 체력 6% 피해면 시계 파괴
const MIRROR_MAX = 2, ECLIPSE_EVERY = 20, ECLIPSE_TIME = 5;
const RAGE_LINE = { 3: '감히… 내 사막의 법칙을 따르거라!', 10: '법칙 따위… 공허가 전부 삼켜 주마!' };
const bossTime = B => (MECHS[B.mech] || {}).time || BOSS_TIME;
const memberX = id => allyX(id === save.leader ? -1 : save.party.indexOf(id)) + 16;
const mechNow = () => battle.mech === 'cosmos' ? COSMOS_SEQ[(battle.cos || 0) % COSMOS_SEQ.length] : battle.mech;
const mechTitle = id => { const C = CHAPTERS.find(C => C.boss.mech === id); return C ? C.boss.mechName : ''; };
const mechLabel = () => battle.mech === 'cosmos' ? `${mechTitle('cosmos')}(${mechTitle(mechNow())})` : mechTitle(battle.mech);
// 묶인 상태: frozen(파티원별 빙결) · daze(리더 기절) · stop(시간 정지, 파티 전원) · eclipse(일식)
const held = id => !!battle && (battle.stop > 0 || !!(battle.frozen && battle.frozen[id] > 0) || (id === save.leader && battle.daze > 0));
function updateHolds(dt) {
  if (battle.frozen) for (const id in battle.frozen) if ((battle.frozen[id] -= dt) <= 0) delete battle.frozen[id];
  if (battle.daze > 0) battle.daze -= dt;
  if (battle.stop > 0) battle.stop -= dt;
  if (battle.eclipse > 0) battle.eclipse -= dt;
}
// 파티 전원에게 피해 (회피 불가). 파티 전멸이면 true
function partyHit(raw, color, k, small) {
  for (const id of team()) if (!allyDown(id) && hitMember(id, raw, color, !small, true, k)) return true;
  return partyWiped();
}
// 보스 일격 (회피 불가): tank면 도발 중인 전사형이 막아냄
function bossStrike(k, mult, tank) {
  const tw = tank ? tauntOn(k) : null;
  if (tw) { tankHit(tw, k.atk * mult, k); addFloat(allyName(tw) + ' 막아냄!', hero.x - 10, GROUND - 64, '#ffb08a', true); return false; }
  return takeHit(Math.floor(k.atk * mult), '#ff3a4a', true, true, k);
}
function mirrorVanish() { for (const m of battle.queue) if (m.mirror && m.dead <= 0) { m.hp = 0; m.dead = 0.5; } }
const MECHS = {
  slam: { line: '온다…!', fire(k) {                                    // 몸통 박치기: 리더 ×3 (도발 전사가 막음) + 동료 최대 체력 25%
    shake = 0.45;
    for (const id in battle.ahp) hurtAlly(id, battle.ahp[id].max * 0.25, true);
    return bossStrike(k, 3, true);
  } },
  root: { line: '발밑이…!', fire(k) {                                  // 뿌리 감옥: 2초 묶임
    shake = 0.25;
    battle.bound = ROOT_TIME; addFloat('묶임!', hero.x + 16, GROUND - 60, '#c8a060', true);
    return bossStrike(k, 1.5);
  } },
  poison: { line: '꼬리를 치켜든다…!', fire(k) {                       // 독침: 4초 독
    shake = 0.25;
    battle.poison = 4 * (1 - stats.mods.purify / 3); battle.poisonDps = k.atk * 0.5; addFloat('독!', hero.x + 16, GROUND - 60, '#b070e0', true);
    return bossStrike(k, 1.2);
  } },
  freeze: { line: '냉기가 몰려온다…!', fire(k) {                       // 빙결: 파티원 2명 3초 (화염 속성 동료가 있으면 절반) + 공격력 80%
    shake = 0.3;
    const alive = team().filter(id => !allyDown(id)), ts = [];
    while (ts.length < 2 && alive.length) ts.push(alive.splice(Math.floor(Math.random() * alive.length), 1)[0]);
    const melt = team().some(id => !allyDown(id) && allyEl(id) === 'fire');
    if (melt) addFloat('불꽃이 얼음을 녹임', hero.x - 10, GROUND - 84, '#ffb07a', true);
    battle.frozen = battle.frozen || {};
    for (const id of ts) {
      battle.frozen[id] = Math.max(battle.frozen[id] || 0, melt ? 1.5 : 3);
      battle.fx.push({ kind: 'ice', x: memberX(id), t: 0, dur: 0.55 });
      addFloat('빙결!', memberX(id), GROUND - 60, '#9fe0ff', true);
      if (hitMember(id, k.atk * 0.8, '#7ad0ff', true, true, k)) return true;
    }
    return false;
  } },
  tide: { line: '바닷물이 차오른다…!', fire(k) {                       // 해일: 파티 전원 90% (도발 중이면 -30%) + 모든 행동 대기 +1.5초
    shake = 0.35;
    battle.fx.push({ kind: 'tide', t: 0, dur: 1 });
    const tw = tauntOn(k);
    if (tw) addFloat(allyName(tw) + ' 버팀! 피해 -30%', hero.x - 10, GROUND - 84, '#ffb08a', true);
    if (hero.hp > 0) hero.cd += 1.5;
    for (const id of team()) if (!allyDown(id)) battle.allyCd[id] = (battle.allyCd[id] ?? 0) + 1.5;
    addFloat('해일! 행동 지연', hero.x + 16, GROUND - 72, '#7ac8ff', true);
    return partyHit(k.atk * 0.9 * (tw ? 0.7 : 1), '#5aa8ff', k);
  } },
  breath: { warn: 1.6, line: '숨을 크게 들이쉰다…!',                 // 화염 숨결: 파티 전원 130% + 화상 3초 (방패 전사가 도발 중이면 40%만) · 체력 절반 아래 주기 -3초
    every: k => Math.max(3, battle.every - (k.hp < k.maxHp * 0.5 ? 3 : 0)),
    tick(k) { if (!battle.rage && k.hp < k.maxHp * 0.5) { battle.rage = true; shake = 0.3; addFloat('격노! 숨결 가속', k.x + 32, GROUND - 80, '#ff7a3a', true); } },
    fire(k) {
      shake = 0.45;
      battle.fx.push({ kind: 'breath', from: k.x + 4, t: 0, dur: 0.8 });
      const tw = tauntOn(k), wall = !!tw && ALLY_LOOKS[tw].weapon === 'shield';
      if (wall) addFloat(allyName(tw) + ' 방패로 막아냄!', hero.x - 10, GROUND - 84, '#ffb08a', true);
      battle.pburn = 3; battle.pburnDps = k.atk * 0.15; battle.pburnT = 0;
      return partyHit(k.atk * 1.3 * (wall ? 0.4 : 1), '#ff7a3a', k);
    } },
  gust: { line: '거센 바람이 분다…!', fire(k) {                        // 돌풍: 리더 1.5초 기절 + 동료 행동 대기 +2초 + 버프·보호막 날아감
    shake = 0.3;
    battle.fx.push({ kind: 'gust', t: 0, dur: 0.9 });
    if (hero.hp > 0) { battle.daze = Math.max(battle.daze || 0, 1.5); addFloat('기절!', hero.x + 16, GROUND - 60, '#ffe27a', true); }
    for (const id of save.party || []) if (!allyDown(id)) battle.allyCd[id] = (battle.allyCd[id] ?? 0) + 2;
    const had = (battle.buffs || []).length > 0 || battle.shield > 0 || Object.values(battle.ahp || {}).some(a => a.sh > 0);
    battle.buffs = []; battle.shield = 0;
    for (const a of Object.values(battle.ahp || {})) a.sh = 0;
    if (had) addFloat('버프·보호막 날아감!', hero.x + 16, GROUND - 74, '#c8f0ff', true);
    return false;
  } },
  rewind: { warn: 3, line: '시곗바늘이 거꾸로 돈다…!',               // 시간 되감기: 6초 전 체력으로 (경고 3초 동안 최대 체력 6% 피해면 시계 파괴 + 2초 기절)
    tick(k, dt) {
      if ((battle.rwT = (battle.rwT || 0) + dt) >= 0.25) {              // 체력 기록 (0.25초마다 10초치)
        battle.rwT = 0;
        (battle.hpHist = battle.hpHist || []).push([battle.mt, k.hp]);
        if (battle.hpHist.length > 40) battle.hpHist.shift();
      }
      if (!battle.tstop && k.hp < k.maxHp * 0.5) {                      // 체력 절반 아래가 되는 순간 한 번: 시간 정지 (파티 2초)
        battle.tstop = true; battle.stop = 2; shake = 0.3;
        addFloat('시간 정지!', hero.x + 16, GROUND - 84, '#c8b8ff', true);
        battle.fx.push({ kind: 'time', x: hero.x + 16, t: 0, dur: 1.2 });
      }
    },
    onWarn(k) { battle.rwHp0 = k.hp; },
    warnTick(k) {
      if (battle.rwHp0 - k.hp < k.maxHp * REWIND_BREAK) return false;
      battle.mechWarn = 0; battle.mechCd = battle.every;
      k.stun = Math.max(k.stun || 0, 2); shake = 0.35;
      addFloat('시계 파괴!', k.x + 32, GROUND - 84, '#ffe27a', true);
      battle.fx.push({ kind: 'spark', x: k.x + 32, y: GROUND - 40, color: '#ffe27a', big: true, t: 0, dur: 0.5 });
      return true;
    },
    fire(k) {
      const h = battle.hpHist || [], t0 = battle.mt - REWIND_BACK;
      let back = h.length ? h[0][1] : k.hp;
      for (const [tt, hp] of h) if (tt <= t0) back = hp;
      battle.fx.push({ kind: 'time', x: k.x + 32, t: 0, dur: 0.9 });
      if (back > k.hp) { const up = Math.min(k.maxHp, back) - k.hp; k.hp += up; addFloat('시간 되감기! +' + fmt(up), k.x + 32, GROUND - 84, '#c8b8ff', true); }
      else addFloat('되감기 실패', k.x + 32, GROUND - 84, '#c8c8d0', true);
      return false;
    } },
  mirror: { line: '그림자가 일렁인다…!',                                // 그림자 분신: 파티원 1명의 분신(체력 150%·공격력 60%)을 보스 앞에, 최대 2 · 체력 절반 아래 20초마다 5초 일식
    tick(k, dt) {
      if (k.hp >= k.maxHp * 0.5) return;
      if ((battle.eclCd = (battle.eclCd ?? 0) - dt) <= 0) {
        battle.eclCd = ECLIPSE_EVERY; battle.eclipse = ECLIPSE_TIME; shake = 0.25;
        addFloat('일식! 치명타 봉인', hero.x + 16, GROUND - 84, '#b8a0ff', true);
      }
    },
    fire(k) {
      const alive = team().filter(id => !allyDown(id));
      if (!alive.length || battle.queue.filter(m => m.mirror && m.dead <= 0).length >= MIRROR_MAX) return false;
      const id = pick(alive), hp = Math.floor((id === save.leader ? stats.maxHp : battle.ahp[id].max) * 1.5);
      const c = { name: '그림자 ' + allyName(id), mirror: id, sprite: null, align: 'evil', body: 'spirit', boss: false, hp, maxHp: hp,
        atk: Math.floor(srcOf(id).atk * 0.6), aspd: 0.8, gold: 0, noDrop: true, critRes: k.critRes, x: k.x - 4, cd: 1, hurt: 0, dead: 0, size: 32 };
      battle.queue.splice(battle.queue.indexOf(k), 0, c);
      battle.fx.push({ kind: 'smoke', x: k.x + 16, t: 0, dur: 0.6 });
      addFloat('그림자 분신!', k.x + 16, GROUND - 70, '#b48cff', true);
      return false;
    } },
  cosmos: { time: 90, hpMul: 1.5, every: k => battle.every - (k.hp < k.maxHp * 0.5 ? 2 : 0) },   // 별의 붕괴: COSMOS_SEQ 차례로 · 체력 절반 아래 주기 -2초(+ 룰 브레이커)
};
// 특수 공격 타이머: 붙어 싸우는 중에만 줄어듦 (보스가 스킬 빙결·정지면 멈춤). 파티 전멸이면 true
function updateMech(dt, k) {
  const M = MECHS[battle.mech];
  battle.mt = (battle.mt || 0) + dt;
  if (M.tick) M.tick(k, dt);
  const f = battle.queue.find(m => m.dead <= 0);
  if (!f || f.x > hero.x + 40 || k.ice > 0) return false;
  battle.mechCd -= dt;
  const S = MECHS[mechNow()] || M;
  if (battle.mechCd <= (S.warn || MECH_WARN) && !battle.mechWarn) {
    battle.mechWarn = 1;
    addFloat('!', k.x + 32, GROUND - 74, '#ff5a6e', true);
    say('hero', S.line || '온다…!', 1.4);
    if (S.onWarn) S.onWarn(k);
  }
  if (battle.mechWarn && S.warnTick && S.warnTick(k, dt)) return false;
  if (battle.mechCd > 0) return false;
  battle.mechCd = M.every ? M.every(k) : battle.every;
  battle.mechWarn = 0;
  if (battle.mech === 'cosmos') battle.cos = (battle.cos || 0) + 1;
  return !!(S.fire && S.fire(k));
}

function spawnShadow() {
  const m = stats.mods;
  battle.shadows = battle.shadows || [];
  if (battle.shadows.filter(s => !s.kind).length >= m.shadow) return;             // 특성 병사 수 (스킬 소환수는 따로)
  battle.shadows.push({ t: m.shadowPerm ? Infinity : 10, cd: 0.6, rise: 0, k: battle.shadows.length, act: 0 });
  addFloat('그림자 병사!', hero.x + 30, GROUND - 50, '#b48cff');
}
// 소환수: 특성 그림자 병사(kind 없음) + 스킬 소환수(kind: shadow·spirit·clone, mult: 리더 공격력 배율, el: 속성)
const SUMMON_COL = { shadow: '#b48cff', spirit: '#fff0a0', clone: '#9fe8ff' };
function updateShadows(dt, q) {
  if (!battle.shadows || !battle.shadows.length) return;
  battle.shadows = battle.shadows.filter(s => (s.t -= dt) > 0);
  battle.shadows.forEach((s, k) => {
    s.k = k;
    s.rise = Math.min(1, s.rise + dt * 2);
    s.act = Math.max(0, s.act - dt * 4);
    if ((s.cd -= dt) > 0) return;
    const t = q.find(m => m.dead <= 0 && m.x <= hero.x + 90) || (battle.sneak && battle.sneak.dead <= 0 && s.kind ? battle.sneak : null);
    if (!t) return;
    s.cd = 1; s.act = 1;
    const col = SUMMON_COL[s.kind] || '#b48cff';
    battle.fx.push(s.kind === 'spirit' ? { kind: 'star', from: hero.x + 30, x: t.x + (t.size || 32) / 2, t: 0, dur: 0.25 } : { kind: 'shadowhit', x: t.x + (t.size || 32) / 2, color: col, t: 0, dur: 0.25 });
    hit(t, s.mult || 0.3, col, 'summon', [s.el || 'magic'], stats);
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
    alive.slice(0, 3).forEach(t => { battle.fx.push({ kind: 'elem', e: e.id, color: e.color, x: px(t), t: 0, dur: 0.35 }); hit(t, mult * 0.7, e.color, 'magic', ['magic'], stats); });
  } else {
    const t = alive[0];
    battle.fx.push({ kind: 'elem', e: e.id, color: e.color, from: hero.x + 24, x: px(t), t: 0, dur: 0.35 });
    if (e.id === 'fire') { t.burn = 3; t.burnMult = mult * 0.15; t.burnSrc = stats; } else t.slow = 3;
    hit(t, mult, e.color, 'magic', [e.id === 'fire' ? 'fire' : 'magic'], stats);
  }
}

// 적 하나를 때린다. 쓰러뜨리면 true
// kind: 'basic'(리더 기본 공격) | 'skill' | 'ally'(유형 행동: 동료·리더) | 'echo'(마력 공명 추가타) | 'summon'(그림자 병사)
//       | 'extra'(검기) | 'magic'(삼색 마법) | 'dot'(화상) | 'fixed'(고정 피해: 반사 등, 배율·치명타 없음)
// src: 공격자 { id, atk, crit, critDmg, pierce } (리더 = stats, 동료 = charStats). 없으면 리더
function hit(mon, mult, color, kind, els, src) {
  if (mon.dead > 0) return false;
  src = src || stats;
  const m = stats.mods, fixed = kind === 'fixed';
  let aff = 1;
  if (els && els.length && !fixed) {
    aff = affinity(mon, els);
    if (kind === 'basic' || kind === 'skill') aff = 1 + (aff - 1) * 0.5;
    mult *= aff;
  }
  const repel = m.dark && (mon.align === 'good' || mon.align === 'fallen');
  if (!fixed) {
    if (kind === 'skill') mult *= 1 + m.skill / 100;
    if (mon.align === 'evil') mult *= 1 + m.smite / 100;
    if (m.dark && !repel) mult *= 1 + m.dark / 100;
    if (m.mark && mon === battle.queue[0]) mult *= 1 + m.mark / 100;
    if (m.soul && battle.souls) mult *= 1 + battle.souls * m.soul / 100;
    if (battle.curse > 0) mult *= 0.8;
    if (battle.rally > 0) mult *= 1.4;                                              // 모모: 응원
    if (battle.pvp) mult *= battle.pvpRamp;                                         // 결투 열기
    if (src.id === 'kai' && (mon.ranged || mon.role === 'healer')) mult *= 1.5;     // 카이: 보물 사냥꾼
    if (mon.vuln) mult *= 1 + mon.vuln.v;                                           // 스킬: 받는 피해 증가
    const ab = buffSum('atk', src === stats);                                       // 스킬 버프: 공격력 (party면 동료도)
    if (ab) mult *= 1 + ab;
  }
  const lead = src === stats, bc = lead ? buffSum('crit', true) * 100 : 0, bcd = lead ? buffSum('critDmg', true) : 0;
  const crit = !fixed && !(battle.eclipse > 0) && Math.random() * 100 < src.crit + bc - Math.max(0, (mon.critRes || 0) - (src.pierce || 0));   // 일식: 치명타 0
  const dmg = Math.floor(src.atk * mult * (crit ? src.critDmg + bcd : 1) * (fixed ? 1 : 0.9 + Math.random() * 0.2));
  if (aff < 0.99 && !crit) color = '#b8b8c0';
  const drain = lead ? m.drain + buffSum('drain', true) * 100 : 0;
  if (drain && (kind === 'basic' || kind === 'skill' || kind === 'magic') && hero.hp > 0) hero.hp = Math.min(stats.maxHp, hero.hp + dmg * drain / 100);   // 흡혈은 리더 공격만
  mon.hp -= dmg;
  if (battle.dungeon) battle.dealt += dmg;
  mon.hurt = 1;
  if (kind !== 'dot' && !fixed) {
    mon.kb = Math.min(mon.king ? 2 : 10, (mon.kb || 0) + (crit ? 5 : 3));
    battle.fx.push({ kind: 'spark', x: mon.x + (mon.size || 32) / 2, y: GROUND - (mon.size || 32) / 2, color: crit ? '#ffd25e' : color || '#ffffff', big: crit, t: 0, dur: 0.25 });
  }
  if (repel && !m.noReflect && kind === 'basic') {
    const back = Math.floor(Math.min(dmg * m.reflect / 100, stats.maxHp * REFLECT_CAP));   // 한 번에 최대 체력의 2%까지
    if (back > 0 && hero.hp > 0) { hero.hp = Math.max(1, hero.hp - back); addFloat('반발 -' + fmt(back), hero.x + 16, GROUND - 44, '#ff7aa8'); }
  }
  if (kind === 'basic' && m.fear && !mon.king && mon.hp > 0 && Math.random() * 100 < m.fear) { mon.stun = 1.5; addFloat('공포!', mon.x + 16, GROUND - 56, '#c070ff'); }
  if (m.exec && !mon.king && !battle.dungeon && mon.hp > 0 && mon.hp < mon.maxHp * 0.15) { mon.hp = 0; addFloat('처형!', mon.x + 16, GROUND - 60, '#ff5a6e', true); }
  const mid = (mon.size || 32) / 2;
  if (aff > 1 && !mon.weakSaid) { mon.weakSaid = true; addFloat('약점!', mon.x + mid, GROUND - 58 - (mon.size ? 24 : 0), '#7dffa0', true); }
  addFloat(fmt(dmg) + (crit ? '!' : '') + (aff > 1.01 ? '▲' : aff < 0.99 ? '▼' : ''), mon.x + mid, GROUND - 36 - (mult > 1 ? 8 : 0) - (mon.size ? 24 : 0), crit ? '#ffd25e' : color || '#ffffff', crit || mult > 1);
  if (mon.hp > 0) {
    if (kind === 'basic' || kind === 'ally') abilityOnHit(mon, src, crit, els);
    return false;
  }
  mon.hp = 0;
  mon.dead = 0.5;
  if (m.soul) battle.souls = Math.min(30, (battle.souls || 0) + 1);
  const burned = mon.burn > 0 || (els && els.includes('fire'));
  if (!mon.king && !mon.boss && !mon.undead && !mon.role && !mon.intruder && !battle.dungeon && !battle.pvp && !burned) (battle.corpses = battle.corpses || []).push(mon);
  if (m.shadow) spawnShadow();
  const gold = Math.floor(mon.gold * (1 + m.gold / 100 + buffSum('gold', true)) * (src.id === 'kai' ? 1.3 : 1));   // 카이가 처치하면 골드 +30% · 스킬 골드 버프
  save.gold += gold;              // 얻은 골드는 바로 저장 (져도 남는다)
  battle.earned += gold;
  if (gold > 0) addFloat('+' + fmt(gold) + 'G', mon.x + 16, GROUND - 52, '#ffd25e');
  track('kills');
  if (mon.intruder) {
    const d = mon.intruder === 'golem' ? 5 : 3;
    save.dust += d;
    if (mon.intruder === 'slime') { const gg = monGold(battle.stage) * 40; save.gold += gg; battle.earned += gg; addFloat('+' + fmt(gg) + 'G', mon.x + 16, GROUND - 64, '#ffd25e', true); }
    else { const it = makeItem(battle.stage, gachaGrade(2)); if (addItem(it)) battle.loot.push(it); addFloat(GRADES[it.grade].name + ' ' + itemName(it) + '!', mon.x + 16, GROUND - 76, GRADES[it.grade].color, true); }
    addFloat(`${mon.name} 처치! 별가루 +${d}`, mon.x + 16, GROUND - 88, '#ffe27a', true);
    shake = 0.25;
  }
  if (!mon.noDrop && !mon.intruder && (mon.boss || Math.random() < DROP_CHANCE)) dropItem(mon);
  updateBattleHud();
  return true;
}

// 맞은 뒤 살아 있는 적에게 붙는 고유 능력 (리더 기본 공격·유형 행동에만)
const RIO_STUN_CD = 2;   // 리오 기절: 같은 적에게 다시 걸리기까지 (초)
function abilityOnHit(mon, src, crit, els) {
  const x = mon.x + (mon.size || 32) / 2, y = GROUND - (mon.size || 32) - 20;
  switch (src.id) {
    case 'rio':                                                                     // 돌팔매: 25% 기절 (같은 적 2초 재기절 금지)
      if (!(mon.rioCd > 0) && Math.random() < 0.25) { mon.stun = Math.max(mon.stun || 0, mon.king || mon.boss ? 0.4 : 0.8); mon.rioCd = RIO_STUN_CD; addFloat('기절!', x, y, '#ffe27a'); }
      break;
    case 'danbi': mon.slow = Math.max(mon.slow || 0, 2); break;                     // 물방울 감옥: 2초 둔화
    case 'arin': mon.burn = 3; mon.burnMult = 0.15; mon.burnSrc = src; break;       // 불꽃 낙인: 화상 3초
    case 'serin':                                                                   // 마력 공명: 치명타면 한 번 더
      if (crit) { addFloat('공명!', x, y - 10, '#e0c0ff'); hit(mon, 0.6, '#e0c0ff', 'echo', els, src); }
      break;
  }
}

function dropItem(mon) {
  if (save.items.length >= BAG_MAX) { toast('가방 공간 부족 · 장비 획득 실패'); return; }
  const it = rollItem(battle.stage);
  save.items.push(it);
  battle.loot.push(it);
  addFloat(GRADES[it.grade].name + ' ' + itemName(it) + '!', mon.x + 16, GROUND - 66, GRADES[it.grade].color, true);
}

// ── 전투 중 동료 ──
// 리더·동료 모두 1/행동 속도 초마다 유형 행동 (자기 공격력 기준). 리더는 이것과 따로 기본 공격(updateBattle)
// 타이머: battle.allyCd[id] (첫 행동은 반 주기 뒤), 저주 중 절반 속도. 할 일이 없으면 다음 프레임에 다시
function updateAllies(dt, q) {
  const sn = battle.sneak && battle.sneak.dead <= 0 ? battle.sneak : null;
  battle.actN = battle.actN || {};
  team().forEach(id => {
    const lead = id === save.leader, i = lead ? -1 : save.party.indexOf(id);
    const A = allyById(id);
    if (!A || allyDown(id) || held(id)) return;                   // 빙결·기절·시간 정지 중에는 행동 대기도 멈춤
    if (A.type === 'warrior' && !lead) {
      battle.tauntCd[id] = (battle.tauntCd[id] ?? 2) - dt;
      const front = q.find(m => m.dead <= 0 && m.x <= hero.x + 45);
      if (battle.tauntCd[id] <= 0 && front && !tauntOn(front) && !(sn && !isWarrior(sn.target))) {
        front.taunt = { id, t: id === 'lea' ? 6 : TAUNT_TIME };         // 레아: 도발 6초
        doTaunt(id, front);
      }
    }
    const src = srcOf(id), spd = (lead ? stats.act : src.aspd) * (1 + buffSum('aspd', lead));   // 스킬 버프: 공격 속도 (party면 동료도)
    battle.allyCd[id] = (battle.allyCd[id] ?? 0.5 / spd) - dt * (battle.curse > 0 ? 0.5 : 1);
    if (battle.allyCd[id] > 0) return;
    if (!allyAct(id, A, src, i, q, sn)) return;
    battle.anim[id] = { t: 0, dur: 0.4 };
    battle.allyCd[id] = 1 / spd;
  });
}

// 유형 행동 하나 (고유 능력 포함). 행동했으면 true
function allyAct(id, A, src, i, q, sn) {
  const m = stats.mods, big = allyStar(id) >= 3, col = allyColor(id), el = [allyEl(id)];
  const cx = t => t.x + (t.size || 32) / 2;
  const near = r => q.filter(t => t.dead <= 0 && t.x <= hero.x + r);
  const count = () => (battle.actN[id] = (battle.actN[id] || 0) + 1);
  const bolt = t => battle.fx.push({ kind: 'bolt', i, x: cx(t), color: col, big, t: 0, dur: 0.4 });
  if (A.type === 'heal') {
    // 미르: 쓰러진 동료를 전투마다 1번 체력 30%로 일으킴
    if (id === 'miru' && !battle.miruUp) {
      const down = team().find(x => x !== id && allyDown(x));
      if (down) {
        battle.miruUp = true;
        const dx = allyX(down === save.leader ? -1 : save.party.indexOf(down)) + 16;
        if (down === save.leader) hero.hp = Math.floor(stats.maxHp * 0.3);
        else { const a = battle.ahp[down]; a.hp = Math.floor(a.max * 0.3); }
        addFloat('약초 꾸러미! ' + allyName(down) + ' 일어남', dx, GROUND - 62, '#9ef0b0', true);
        battle.fx.push({ kind: 'heal', i, x: dx, big: true, t: 0, dur: 0.6 });
        return true;
      }
    }
    // 체력 비율이 가장 낮은 아군(95% 미만)을 치유
    let who = null, low = 0.95;
    if (save.leader && hero.hp > 0 && hero.hp / stats.maxHp < low) { low = hero.hp / stats.maxHp; who = save.leader; }
    for (const [aid, a] of Object.entries(battle.ahp || {})) if (a.hp > 0 && a.hp / a.max < low) { low = a.hp / a.max; who = aid; }
    if (!who) {                                                     // 다친 아군이 없으면 앞의 적 50%
      const t = near(120)[0] || sn;
      if (!t) return false;
      hit(t, 0.5, '#bfffd0', 'ally', ['magic'], src); bolt(t);
      return true;
    }
    let h = src.atk * 1.1 * (1 + m.healAlly / 100) * (1 + m.healMul / 100);
    if (id === 'hana' && low <= 0.3) h *= 2;                       // 하나: 응급 붕대
    h = Math.floor(h);
    const tx = allyX(who === save.leader ? -1 : save.party.indexOf(who)) + 16;
    if (who === save.leader) {
      hero.hp = Math.min(stats.maxHp, hero.hp + h);
      if (id === 'miru' && battle.poison > 0) { battle.poison = 0; addFloat('해독!', tx, GROUND - 60, '#9ef0b0', true); }   // 미르: 독 해제
    } else { const a = battle.ahp[who]; a.hp = Math.min(a.max, a.hp + h); }
    addFloat('+' + fmt(h) + (id === 'hana' && low <= 0.3 ? ' 응급 붕대!' : ''), tx, GROUND - 48, '#6fe39a');
    battle.fx.push({ kind: 'heal', i, x: tx, big, t: 0, dur: 0.6 });
    return true;
  }
  if (A.type === 'magic') {
    const pio = id === 'pio';                                       // 피오: 별똥별 (모든 적 60%)
    let ts = pio ? q.filter(t => t.dead <= 0) : near(120);
    if (sn) ts = [sn].concat(ts);
    if (!pio) ts = ts.slice(0, 3);
    if (!ts.length) return false;
    const mul = (pio ? 0.6 : 0.7) * (1 + m.magicAlly / 100);
    ts.forEach(t => { hit(t, mul, '#d6b0ff', 'ally', el, src); bolt(t); });
    return true;
  }
  if (A.type === 'shot') {
    const R = 170, healerMon = q.find(t => t.dead <= 0 && t.role === 'healer' && t.x <= hero.x + R);
    const t = sn || healerMon || q.find(t => t.dead <= 0 && t.ranged && t.x <= hero.x + R) || q.find(t => t.dead <= 0 && t.x <= hero.x + R);
    if (!t) return false;
    const mul = 1 + m.shotAlly / 100;
    const arrows = (to, n) => { for (let k = 0; k < n; k++) battle.fx.push({ kind: 'arrow', i, x: cx(to), off: (k - 1) * 4 * (n > 1 ? 1 : 0), t: -k * 0.05, dur: 0.3, color: col }); };
    if (id === 'noeul' && count() % 5 === 0) {                     // 노을: 5번째 사격마다 화살비
      const all = q.filter(x => x.dead <= 0).concat(sn ? [sn] : []);
      addFloat('노을 화살비!', allyX(i) + 16, GROUND - 64, '#ffb070', true);
      all.forEach(x => { hit(x, 0.8 * mul, '#ffb070', 'ally', el, src); arrows(x, 2); });
      return true;
    }
    if (t === healerMon && !t.sniped) { t.sniped = true; addFloat('치유사 저격!', t.x + 16, GROUND - 62, '#ffd27a', true); }
    hit(t, mul * (t.role === 'healer' ? 1.5 : 1), '#ffd27a', 'ally', el, src);
    arrows(t, big ? 3 : 1);
    return true;
  }
  if (A.type === 'warrior') {
    const t = sn || q.find(x => x.dead <= 0 && x.x <= hero.x + 70);
    if (!t) return false;
    const vsA = x => x.role === 'assassin' ? 1.5 : 1;
    if (id === 'tobi' && count() % 3 === 0) {                      // 토비: 3번째 행동마다 앞의 적 2마리 120%
      const ts = [t].concat(q.filter(x => x !== t && x.dead <= 0 && x.x <= hero.x + 100)).slice(0, 2);
      addFloat('도끼 회전!', allyX(i) + 16, GROUND - 64, '#ffb08a', true);
      ts.forEach(x => { hit(x, 1.2 * vsA(x), '#ff9a7a', 'ally', el, src); battle.fx.push({ kind: 'slash', i, x: cx(x), big: true, color: col, t: 0, dur: 0.3 }); });
      return true;
    }
    hit(t, vsA(t), '#ff9a7a', 'ally', el, src);
    battle.fx.push({ kind: 'slash', i, x: cx(t), big, color: col, t: 0, dur: 0.3 });
    if (id === 'lea' && t !== sn) {                                // 레아: 관통 창 (뒤의 적 70%)
      const t2 = q.find(x => x !== t && x.dead <= 0 && x.x <= hero.x + 100);
      if (t2) { hit(t2, 0.7, '#ffc8a0', 'ally', el, src); battle.fx.push({ kind: 'wave', from: cx(t), x: cx(t2), t: 0, dur: 0.3 }); }
    }
    return true;
  }
  // 지원형: 앞의 적 60% (오라는 partyGlob)
  const t = near(120)[0] || sn;
  if (!t) return false;
  hit(t, 0.6, col, 'ally', ['magic'], src); bolt(t);
  return true;
}

// 원거리 몬스터: 줄 뒤(맨 앞이 아닐 때)에서도 1/(공격 속도×0.6)초마다 살아 있는 파티원 중 무작위 1명에게 공격력 60%. 파티 전멸이면 true
function updateRanged(dt, q) {
  const first = q.find(m => m.dead <= 0);
  for (const m of q) {
    if (!m.ranged || m === first || m.dead > 0 || m.stun > 0 || m.charm > 0 || m.x > hero.x + (battle.pvp ? 400 : 170)) continue;
    const rk = battle.pvp ? 1 : 0.6;                                   // 결투장: 뒤에 있어도 앞과 같은 초당 피해
    if (m.scd === undefined) m.scd = (0.5 + Math.random() * 0.5) / (m.aspd * rk);
    if ((m.scd -= dt * (m.slow > 0 ? 0.6 : 1)) > 0) continue;
    m.scd = 1 / (m.aspd * rk);
    const alive = team().filter(id => !allyDown(id));
    if (!alive.length) return true;
    const id = pick(alive), tx = allyX(id === save.leader ? -1 : save.party.indexOf(id)) + 16;
    battle.fx.push({ kind: 'mshot', from: m.x + (m.size || 32) / 2, x: tx, color: m.shot || '#ffb05a', t: 0, dur: 0.45 });
    if (team().includes('baram') && !allyDown('baram') && Math.random() < 0.2) { addFloat('빗나감', tx, GROUND - 46, '#9fe0ff'); continue; }   // 바람의 노래
    if (hitMember(id, m.atk * rk * (1 - stats.mods.weak / 100), m.shot || '#ffb05a', false, false, m)) return true;
  }
  return false;
}

function allyX(i) { return i < 0 ? hero.x : hero.x - 24 - i * 18; }   // -1 = 리더 자리

// 동료 체력 = 그 동료의 최대 체력 × (1 + 동료 체력 보너스)
function allyMaxHp(id) { return Math.floor(srcOf(id).maxHp * (1 + stats.mods.allyHp / 100)); }
function initAllyHp() {
  battle.ahp = {}; battle.anim = {}; battle.tauntCd = {}; battle.actN = {}; battle.rally = 0; battle.miruUp = false;
  for (const id of save.party || []) { const mx = allyMaxHp(id); battle.ahp[id] = { hp: mx, max: mx, hurt: 0, sh: 0 }; }
}
const allyDown = id => id === save.leader ? hero.hp <= 0 : (!battle.ahp || !battle.ahp[id] || battle.ahp[id].hp <= 0);
// 동료가 피해를 받는다 (그 동료의 회피, 파티 공통 받는 피해 감소)
function hurtAlly(id, raw, noDodge) {
  const a = battle.ahp && battle.ahp[id];
  if (!a || a.hp <= 0) return;
  const x = allyX(save.party.indexOf(id)) + 16;
  if (!noDodge && Math.random() * 100 < (srcOf(id).dodge || 0)) { addFloat('회피', x, GROUND - 40, '#9fd0ff'); return; }
  let dmg = Math.floor(raw * (1 - Math.min(60, stats.pg.guard) / 100));
  if (a.sh > 0) {                                                       // 스킬 보호막 (동료)
    const ab = Math.min(a.sh, dmg);
    a.sh -= ab; dmg -= ab;
    if (ab) addFloat('(' + fmt(ab) + ')', x - 8, GROUND - 46, '#9fd0ff');
    if (!dmg) return;
  }
  a.hp -= dmg; a.hurt = 1;
  addFloat('-' + fmt(dmg), x, GROUND - 40, '#ff6b7a');
  if (a.hp <= 0) { a.hp = 0; addFloat(allyName(id) + ' 쓰러짐', x, GROUND - 52, '#ff9aa0', true); onFall(id); }
}
// 전사형이 막아서서 맞는다 (도발·암살자 가로막기): 받는 피해 감소, 브론은 막은 피해의 30% 반사
function tankHit(id, raw, mon) {
  const g = tauntGuard(id);
  hurtAlly(id, raw * (1 - g));
  if (id === 'bron' && mon && mon.dead <= 0 && raw * g * 0.3 >= 1) hit(mon, 1, '#ffd0a0', 'fixed', null, { id, atk: raw * g * 0.3, crit: 0, critDmg: 1, pierce: 0 });
}
// 전사형 도발: 10초마다 맨 앞 적의 공격을 4초 동안 자기에게 돌린다(받는 피해 감소).
// 암살자가 뒤로 숨어들면 도발이 준비된 전사가 곧바로 막아선다.
const TAUNT_CD = 10, TAUNT_TIME = 4;
const BRON_LEAD_GUARD = 0.25;   // 브론이 리더일 때 받는 피해 감소 (리더는 도발 안 함)
const tauntGuard = id => Math.min(0.8, (id === 'bron' ? 0.7 : ALLY_LOOKS[id].weapon === 'shield' ? 0.6 : 0.4) + (allyStar(id) >= 3 ? 0.1 : 0));   // 브론: 철벽 방패
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


// ── 전투 중 스킬 (데이터 엔진: content.js 스킬의 eff 를 순서대로 실행) ──
// 버프: battle.buffs = [{ id(스킬), stat, v, t, party }] · 능력치(stats)는 고치지 않고 hit·takeHit·공격 속도 계산에서 더한다
// stat: atk·aspd (party면 동료도) · crit·dodge(%p, 0.15 = +15%p) · critDmg · guard(받는 피해 -) · drain(흡혈) · double(연속 공격) · gold(처치 골드)
function buffSum(stat, lead) {
  let v = 0;
  if (battle && battle.buffs) for (const b of battle.buffs) if (b.stat === stat && (lead || b.party)) v += b.v;
  return v;
}
function addBuff(id, stat, v, dur, party) {
  battle.buffs = (battle.buffs || []).filter(b => !(b.id === id && b.stat === stat));   // 같은 스킬의 같은 버프는 새로 고침
  battle.buffs.push({ id, stat, v, t: dur, party: !!party });
}
const skCd = sk => sk.cd * (1 - Math.min(50, stats.mods.cd) / 100);
const isBossMon = m => !!(m.king || m.boss);
const SK_FLOAT = ['#9fd0ff', '#7dffa0', '#8ac0ff', '#d6a8ff', '#ffc86a', '#ff8a9a'];   // 스킬 이름 글자 (등급별)
// 살아 있는 적: q 줄, sn 잠입 암살자, all 모두, engaged 붙어 싸우는 중
function skFoes() {
  const q = battle.queue.filter(m => m.dead <= 0), sn = battle.sneak && battle.sneak.dead <= 0 ? battle.sneak : null;
  return { q, sn, all: sn ? q.concat([sn]) : q, engaged: !!((q.length && q[0].x <= hero.x + 40) || sn) };
}
// 다친 파티원 (리더 lead 비율 미만 · 동료 ally 비율 미만)
function partyHurt(lead, ally) {
  if (hero.hp > 0 && hero.hp < stats.maxHp * lead) return true;
  return Object.values(battle.ahp || {}).some(a => a.hp > 0 && a.hp < a.max * ally);
}
const someoneDown = () => (save.party || []).some(id => allyDown(id));
// 스킬이 돌볼 사람이 있나: 파티 효과(party·부활)가 있으면 파티 전체(부활이면 쓰러진 동료도), 없으면 리더만
function skHurt(sk, lead, ally) {
  if (!sk.eff.some(e => e.party || e.t === 'revive')) return partyHurt(lead, 0);
  return partyHurt(lead, ally) || (sk.eff.some(e => e.t === 'revive') && someoneDown());
}
// AUTO 사용 조건: fight 붙은 적 · hurt 리더 60%/동료 50% 미만 · crowd 적 2마리 이상 · boss 보스·대장 · down 쓰러진 동료 · buff 같은 버프 꺼짐
function skAutoOk(sk, F) {
  switch (sk.auto) {
    case 'hurt': return skHurt(sk, 0.6, 0.5);
    case 'crowd': return F.engaged && F.all.length >= 2;
    case 'boss': return F.engaged && !!(battle.king || (F.q[0] && F.q[0].boss));
    case 'down': return someoneDown();
    case 'buff': return F.engaged && !(battle.buffs || []).some(b => b.id === sk.id);
    default: return F.engaged;
  }
}
function castSkill(slot, auto) {
  const id = save.slots[slot];
  if (!id || !skSlotOpen(slot) || !battle || battle.state !== 'fight' || battle.delay > 0 || hero.hp <= 0 || held(save.leader)) return false;
  const sk = skillById(id), o = skOf(id);
  if (!sk || !o || (battle.skillCd[id] || 0) > 0) return false;
  const F = skFoes();
  if (!F.all.length) return false;
  const ts = sk.eff.map(e => e.t);
  if (ts.some(t => t === 'dmg' || t === 'summon' || t === 'freeze' || t === 'mark') && !F.engaged) return false;   // 공격형은 붙은 적이 있어야
  if (ts.every(t => t === 'heal') && !skHurt(sk, 0.999, 0.999)) return false;                                    // 회복만 하는 스킬은 다친 파티원이 있어야
  if (auto && !skAutoOk(sk, F)) return false;
  battle.skillCd[id] = skCd(sk);
  addFloat(sk.name + '!', hero.x + 16, GROUND - 62, SK_FLOAT[sk.grade], true);
  runSkill(sk, o);
  return true;
}
// 대상 고르기: front 맨 앞 · n 앞에서 n마리 · all 모두(잠입 암살자 포함) · back 맨 앞 빼고 모두 · rand 무작위(hits번) · low 체력 비율 가장 낮은 적 · sneak 잠입 암살자 우선
function skTargets(e, F) {
  const base = F.q.length ? F.q : F.sn ? [F.sn] : [];
  switch (e.to) {
    case 'n': return base.slice(0, e.n || 1);
    case 'all': case 'rand': return F.all.slice();
    case 'back': return F.all.filter(t => t !== F.q[0]);
    case 'low': return F.all.length ? [F.all.reduce((a, b) => (b.hp / b.maxHp < a.hp / a.maxHp ? b : a))] : [];
    case 'sneak': return [F.sn || base[0]].filter(Boolean);
    default: return base.slice(0, 1);
  }
}
function setVuln(t, v, dur) { if (!t.vuln || v >= t.vuln.v) t.vuln = { v, t: dur }; }
// 한 대: 보스 배율 · 즉사(exec %, 보스·대장·던전 제외)
function skHitOne(t, e, v, els) {
  if (t.dead > 0) return;
  hit(t, v * (e.bossMul && isBossMon(t) ? e.bossMul : 1), '#9fd0ff', 'skill', els, stats);
  if (e.exec && t.dead <= 0 && !isBossMon(t) && !battle.dungeon && t.hp < t.maxHp * e.exec / 100) {
    addFloat('즉사!', t.x + (t.size || 32) / 2, GROUND - 70, '#ff5a6e', true);
    hit(t, 1, '#ff5a6e', 'fixed', null, { id: stats.id, atk: t.hp + 1, crit: 0, critDmg: 1, pierce: 0 });
  }
}
// 맞은 뒤 상태 이상: 기절·둔화·화상·넉백(음수 = 끌어당김)·받는 피해 증가. 보스·대장은 기절 절반·넉백 30%
function skStatus(t, e) {
  if (t.dead > 0) return;
  const B = isBossMon(t);
  if (e.stun) t.stun = Math.max(t.stun || 0, B ? e.stun / 2 : e.stun);
  if (e.slow) t.slow = Math.max(t.slow || 0, e.slow);
  if (e.burn) { t.burn = Math.max(t.burn || 0, e.burn); t.burnMult = 0.15; t.burnSrc = stats; }
  if (e.knock && t !== battle.sneak) {
    const k = e.knock * (B ? 0.3 : 1);
    t.x = k > 0 ? Math.max(t.x, Math.min(330, t.x + k)) : Math.min(t.x, Math.max(hero.x + 40, t.x + k));   // 밀기는 뒤로만 · 당기기는 앞으로만
    t.kb = k > 0 ? (B ? 2 : 10) : 0;
  }
  if (e.vuln) setVuln(t, e.vuln.base, e.vuln.dur);
}
function runSkill(sk, o) {
  const m = stats.mods, lv = o.lv, st = o.star, hm = 1 + m.healMul / 100;
  const ax = id => allyX(save.party.indexOf(id)) + 16;
  let fxDone = false;
  if (sk.eff.some(e => e.t === 'dmg')) {                                       // 리더 모션 (회오리면 회전)
    hero.lunge = 1.5; hero.back = false;
    hero.atk = { t: 0, dur: sk.fx === 'whirl' ? 0.5 : 0.42, kind: sk.fx === 'whirl' ? 'whirl' : 'strike' };
  }
  for (const e of sk.eff) {
    const v = skVal(e, lv, st), F = skFoes();
    switch (e.t) {
      case 'dmg': {
        const els = e.el || sk.el ? [e.el || sk.el] : heroEls(), ts = skTargets(e, F), hits = e.hits || 1;
        if (!fxDone) { skFx(sk, ts); fxDone = true; }
        if (e.to === 'rand') {
          const got = new Set();
          for (let k = 0; k < hits; k++) {
            const alive = ts.filter(t => t.dead <= 0);
            if (!alive.length) break;
            const t = pick(alive); got.add(t);
            skHitOne(t, e, v, els);
          }
          got.forEach(t => skStatus(t, e));
        } else {
          for (let k = 0; k < hits; k++) for (const t of ts) skHitOne(t, e, v, els);
          ts.forEach(t => skStatus(t, e));
        }
        break;
      }
      case 'buff':
        addBuff(sk.id, e.stat, v, e.dur, e.party);
        battle.fx.push({ kind: 'buff', x: hero.x + 16, party: !!e.party, t: 0, dur: 0.8 });
        break;
      case 'shield': {
        battle.shield = Math.min(stats.maxHp, (battle.shield || 0) + Math.floor(stats.maxHp * v));
        battle.fx.push({ kind: 'shield', x: hero.x + 16, t: 0, dur: 0.6 });
        if (e.party) for (const [id, a] of Object.entries(battle.ahp || {})) if (a.hp > 0) { a.sh = Math.min(a.max, (a.sh || 0) + Math.floor(a.max * v)); battle.fx.push({ kind: 'shield', x: ax(id), t: 0, dur: 0.6 }); }
        addFloat('보호막', hero.x + 16, GROUND - 76, '#9fd0ff');
        break;
      }
      case 'heal': {
        if (hero.hp > 0) {
          const h = Math.floor(stats.maxHp * v * hm);
          hero.hp = Math.min(stats.maxHp, hero.hp + h);
          addFloat('+' + fmt(h), hero.x + 16, GROUND - 46, '#6fe39a', true);
          battle.fx.push({ kind: 'heal', x: hero.x + 16, big: true, t: 0, dur: 0.6 });
        }
        if (e.party) for (const [id, a] of Object.entries(battle.ahp || {})) if (a.hp > 0) {
          const h = Math.floor(a.max * v * hm);
          a.hp = Math.min(a.max, a.hp + h);
          addFloat('+' + fmt(h), ax(id), GROUND - 48, '#6fe39a');
          battle.fx.push({ kind: 'heal', x: ax(id), t: 0, dur: 0.6 });
        }
        break;
      }
      case 'revive': {                                                           // 쓰러진 동료 전원(리더 포함) 부활
        const r = Math.min(1, v);
        if (hero.hp <= 0) { hero.hp = Math.floor(stats.maxHp * r); addFloat('부활!', hero.x + 16, GROUND - 62, '#ffe27a', true); }
        for (const [id, a] of Object.entries(battle.ahp || {})) if (a.hp <= 0) {
          a.hp = Math.floor(a.max * r);
          addFloat(allyName(id) + ' 부활!', ax(id), GROUND - 60, '#ffe27a', true);
          battle.fx.push({ kind: 'holy', x: ax(id), t: 0, dur: 0.6 });
        }
        break;
      }
      case 'freeze': {                                                           // 모든 적 정지 (보스·대장 절반, 최대 6초)
        const d = Math.min(FREEZE_MAX, v);
        for (const t of F.all) { const x = isBossMon(t) ? d / 2 : d; t.stun = Math.max(t.stun || 0, x); t.ice = Math.max(t.ice || 0, x); }
        if (!fxDone) { skFx(sk, F.all); fxDone = true; }
        break;
      }
      case 'summon': {                                                           // 소환수 n명 · dur초 · 1초마다 앞의 적 공격 (리더 공격력 × v)
        battle.shadows = battle.shadows || [];
        for (let k = 0; k < e.n; k++) battle.shadows.push({ kind: e.kind, t: e.dur, cd: 0.4 + k * 0.2, rise: 0, k: battle.shadows.length, act: 0, mult: v, el: sk.el || 'magic' });
        while (battle.shadows.length > SUMMON_MAX) { const i = battle.shadows.findIndex(s => s.kind); if (i < 0) break; battle.shadows.splice(i, 1); }
        addFloat({ shadow: '그림자 병사!', spirit: '빛의 정령!', clone: '분신!' }[e.kind] || '소환!', hero.x + 30, GROUND - 50, SUMMON_COL[e.kind] || '#b48cff');
        if (!fxDone) { skFx(sk, F.q.slice(0, 1)); fxDone = true; }
        break;
      }
      case 'cleanse': {                                                          // 저주·독 해제, 봉인 시간 절반
        const any = battle.curse > 0 || battle.poison > 0 || battle.seal > 0;
        battle.curse = 0; battle.poison = 0; battle.cleanse = null;
        if (battle.seal > 0) battle.seal *= 0.5;
        if (any) addFloat('정화!', hero.x + 16, GROUND - 88, '#9ef0b0', true);
        break;
      }
      case 'cdr':                                                                // 다른 장착 스킬 쿨타임 감소
        for (const x of save.slots) if (x && x !== sk.id && battle.skillCd[x] > 0) battle.skillCd[x] = Math.max(0, battle.skillCd[x] - e.base);
        addFloat(`쿨타임 -${e.base}초`, hero.x + 16, GROUND - 88, '#bfe8ff');
        break;
      case 'mark':                                                               // 모든 적 받는 피해 증가
        for (const t of F.all) setVuln(t, v, e.dur);
        if (!fxDone) { skFx(sk, F.all); fxDone = true; }
        break;
      case 'gold':
        addBuff(sk.id, 'gold', v, e.dur, false);
        addFloat(`처치 골드 +${Math.round(v * 100)}%`, hero.x + 16, GROUND - 88, '#ffd25e');
        break;
    }
  }
  if (!fxDone) skFx(sk, []);
}
// 스킬 그림 (프리셋). 대상 ts 기준, 기존 이펙트 종류 재사용 + meteor·chain·ice·wind·holy·shield·buff·quake·time·void
function skFx(sk, ts) {
  const F = battle.fx, cx = t => t.x + (t.size || 32) / 2, girl = leaderStyle() !== 'melee';
  const mid = ts.length ? ts.reduce((a, t) => a + cx(t), 0) / ts.length : hero.x + 70;
  const each = (fn, gap = 0.06) => ts.slice(0, 6).forEach((t, k) => F.push({ ...fn(t, k), t: -k * gap }));
  switch (sk.fx) {
    case 'slash': each((t, k) => (girl ? { kind: 'star', from: hero.x + 22, x: cx(t), big: !k, dur: 0.34 } : { kind: 'hslash', x: cx(t), big: !k, dash: !k, dur: 0.32 })); break;
    case 'whirl': if (girl) each(t => ({ kind: 'star', from: hero.x + 22, x: cx(t), dur: 0.3 })); else F.push({ kind: 'whirl', t: 0, dur: 0.5 }); break;
    case 'star': each(t => ({ kind: 'star', from: hero.x + 22, x: cx(t), big: true, dur: 0.34 })); break;
    case 'meteor': F.push({ kind: 'meteor', x: ts.length ? cx(ts[0]) : mid, t: 0, dur: 0.75 }); shake = Math.max(shake, 0.35); break;
    case 'bolt': each(t => ({ kind: 'elem', e: 'bolt', color: '#ffe94a', x: cx(t), dur: 0.35 }), 0.05); break;
    case 'chain': F.push({ kind: 'chain', xs: ts.slice(0, 6).map(cx), t: 0, dur: 0.45 }); break;
    case 'fire': each(t => ({ kind: 'elem', e: 'fire', color: '#ff7a3a', from: hero.x + 24, x: cx(t), dur: 0.4 }), 0.05); break;
    case 'ice': each(t => ({ kind: 'ice', x: cx(t), dur: 0.55 }), 0.04); break;
    case 'wind': F.push({ kind: 'wind', x: mid, t: 0, dur: 0.55 }); break;
    case 'holy': if (ts.length) each(t => ({ kind: 'holy', x: cx(t), dur: 0.6 }), 0.05); else F.push({ kind: 'holy', x: hero.x + 16, t: 0, dur: 0.6 }); break;
    case 'shadow': each(t => ({ kind: 'smoke', x: cx(t), dur: 0.5 }), 0.04); each(t => ({ kind: 'shadowhit', x: cx(t), dur: 0.3 }), 0.04); break;
    case 'heal': F.push({ kind: 'heal', x: hero.x + 16, big: true, t: 0, dur: 0.6 }); break;
    case 'shield': F.push({ kind: 'shield', x: hero.x + 16, t: 0, dur: 0.6 }); if (ts.length) F.push({ kind: 'hslash', x: cx(ts[0]), big: true, dash: true, t: 0.05, dur: 0.3 }); break;
    case 'buff': F.push({ kind: 'buff', x: hero.x + 16, t: 0, dur: 0.8 }); break;
    case 'arrow': each((t, k) => ({ kind: 'arrow', i: -1, x: cx(t), off: (k % 3 - 1) * 4, dur: 0.3, color: '#ffe0a0' }), 0.04); break;
    case 'quake': F.push({ kind: 'quake', x: mid, t: 0, dur: 0.6 }); shake = Math.max(shake, 0.4); break;
    case 'time': F.push({ kind: 'time', x: mid, t: 0, dur: 0.9 }); break;
    case 'void': F.push({ kind: 'void', x: mid, t: 0, dur: 0.8 }); break;
  }
}

function updateSkills(dt) {
  for (const id in battle.skillCd) battle.skillCd[id] = Math.max(0, battle.skillCd[id] - dt);
  if (battle.buffs && battle.buffs.length) battle.buffs = battle.buffs.filter(b => (b.t -= dt) > 0);
  if (save.autoSkill) for (let i = 0; i < SKILL_SLOTS; i++) castSkill(i, true);
}

function waveCleared() {
  if (battle.king) return endBattle('won');
  if (battle.wave < WAVES.length - 1) {
    const heal = Math.floor(stats.maxHp * WAVE_HEAL);
    hero.hp = hero.hp <= 0 ? Math.floor(stats.maxHp * 0.3) : Math.min(stats.maxHp, hero.hp + heal);   // 쓰러진 리더는 30%로 일어남
    addFloat('+' + fmt(heal), hero.x + 16, GROUND - 46, '#6fe39a', true);
    for (const a of Object.values(battle.ahp || {})) a.hp = a.hp <= 0 ? Math.floor(a.max * 0.3) : Math.min(a.max, a.hp + a.max * WAVE_HEAL);
    battle.shadows = (battle.shadows || []).filter(s => s.t === Infinity || s.kind);   // 스킬 소환수는 시간이 다할 때까지
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
  if (battle.pvp) { battle.state = result; return endPvp(result); }
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
  const ally = B.ally && allyById(B.ally);
  let bsk = null;
  if (first) {
    setTimeout(() => fanfare('LEVEL UP!', `Lv ${heroLevel()} · 레벨 +3`, Sound.levelUp), 200);
    save.dust += 50;
    save.bosses[c] = true;
    save.shards = (save.shards || 0) + 1;
    if (ally) gainAlly(ally.id);
    bsk = grantBossSkill(c);                                           // 보스 전용 스킬
    if (bsk) setTimeout(() => fanfare('보스 스킬 획득!', `${GRADES[bsk.grade].name} · ${bsk.name}`, Sound.levelUp), 2300);
    refreshStats();
  }
  writeSave();
  cloudUpload();
  let text = `획득 골드 ${fmt(r.earned)} G`
    + (first ? `<br>✦ 별조각 +1 · 공격력·체력 영구 +10% · 별가루 +50<br>레벨 +3 · 특성 포인트 +3${ally ? `<br>${ally.name} 합류 · 동료 탭에서 확인${c >= 2 && c <= 3 ? ' · 동료 배치 칸 +1' : ''}` : ''}`
      + (bsk ? `<br>보스 전용 스킬 <b style="color:${GRADES[bsk.grade].color}">${bsk.name}</b> 획득 · 스킬 탭에서 확인${c === 3 ? ' · 스킬 칸 +1' : ''}` : '')
      + (c < CHAPTERS.length ? `<br>챕터 ${c + 1} · ${chapter(c + 1).name} 해금` : '<br>별조각 모두 회수 · 다음 이야기는 업데이트 예정') : ' (재도전 보상 30%)');
  if (r.loot.length) text += '<br>획득 장비: ' + r.loot.map(it => `<b style="color:${GRADES[it.grade].color}">${itemName(it)}</b>`).join(', ');
  const btns = [['캠프로', () => showScreen('lobby'), !(first && c < CHAPTERS.length)]];
  if (first && c < CHAPTERS.length) btns.unshift([`챕터 ${c + 1} 시작 ▶`, () => startBattle(c * STAGES_PER + 1), true]);
  const finish = () => showResult(first ? (c === CHAPTERS.length ? '별의 설화 1부 완결!' : `챕터 ${c} 클리어!`) : `${B.name} 처치!`, '#ffd25e', text, btns);
  const outro = talkLines((TALK[c] || {}).outro).filter(L => !(B.ally === leaderId() && L.who === 'narr' && L.text.includes('동료가 되었다')));
  if (first) playDialog(outro, finish); else finish();
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
  hero: () => ({ name: allyName(leaderId()), img: allyImg(leaderId()) }),
  boss: () => ({ name: chapter(talkCh).boss.name, img: SPR[chapter(talkCh).boss.sprite] }),
  miru: () => ({ name: '미르', img: SPR.miru }),
  serin: () => ({ name: '세린', img: SPR.serin }),
  kai: () => ({ name: '카이', img: SPR.kai }),
  narr: () => ({ name: '', img: null }),
};
let dlg = null;   // { lines, i, chars, onDone }

function lineText(L) { return L.text.replaceAll('{name}', allyName(leaderId())); }
// 대사 목록에서 지금 리더인 동료가 말하는 줄은 뺌 (리더 대사는 hero 가 맡음)
const talkLines = lines => (lines || []).filter(L => L.who !== leaderId());

function playDialog(lines, onDone) {
  if (!lines || !lines.length) { if (onDone) onDone(); return; }
  dlg = { lines, i: 0, chars: 0, onDone };
  $('dialog').hidden = false;
  showLine();
}

function showLine() {
  const L = dlg.lines[dlg.i];
  const sp = (SPEAKERS[L.who] || SPEAKERS.narr)();
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
  if (who === 'hero' && screen === 'battle' && battle && hero.hp <= 0) { who = (save.party || []).find(id => !allyDown(id)); if (!who) return; }
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
    <small>${done ? '✓ 처치 · 재도전 가능' : bo ? `도전 가능 · 제한 시간 ${bossTime(B)}초` : `${c}-20 클리어 시 해금`}</small></button>
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
    <p class="note">공격 속성 · 베기: 검·도끼 전사형 / 관통: 사격형, 창 전사형 / 마법: 마법형, 그림자 병사, 치유·지원형 / 화염: 불 지팡이, 삼색 마법의 불 (마법 약점에도 통함) / 신성: 심판의 빛 특성</p>
    <table><tr><th>몸 종류</th><th>약점 ×1.5</th><th>저항 ×0.7</th></tr>${rows}</table>
    <p class="note">리더의 기본 공격·스킬은 상성 효과 절반 (×1.25 / ×0.85)</p>
    <ul>
      <li><b>적 암살자 기습 강화</b> 뒤로 잠입한 동안 공격력 ×1.6 · 공격 속도 ×1.4 · 치유형 → 지원형 → 맨 뒤 동료 순서로 노림</li>
      <li><b>전사형 → 암살자</b> 도발로 뒤를 지킴 · 암살자에게 피해 1.5배, 받는 피해 절반</li>
      <li><b>원거리 몬스터 ➶</b> 줄 뒤에서도 파티원 아무나 공격 · 사격형이 먼저 저격 · 바람의 노래로 20% 빗나감</li>
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

// 이 동료를 리더로 바꾸면 팀 전투력 (미리보기 · 세이브는 그대로)
function powerIfLeader(id) {
  const keep = { leader: save.leader, party: (save.party || []).slice() };
  setLeader(id); refreshStats();
  const p = power();
  save.leader = keep.leader; save.party = keep.party; refreshStats();
  return p;
}
function refreshAllies() {
  const party = save.party || [];
  const own = ALLIES.filter(A => save.allies[A.id]);
  if (!allySel || !save.allies[allySel]) allySel = save.leader || party[0] || (own[0] && own[0].id) || null;
  let html = '';
  if (allySel) {
    const A = allyById(allySel), id = A.id, st = allyStar(id), R = RARITY[A.r], L = charLv(id), cs = memberStats(id), Ab = ABIL[id];
    const inParty = party.includes(id), have = save.acopy[id] || 0, need = AWAKEN_COST[st], isLead = id === save.leader;
    html += `<div class="adet"><img src="${allyIcon(id)}" class="abig">
      <div class="ainfo"><b style="color:${R.color}">${R.stars} ${R.name} · ${A.role}</b><h3>${isLead ? '👑 ' : ''}${allyName(id)}</h3>
      ${isLead ? '<p class="lead">리더 · 맨 앞에서 싸움 · 기본 공격 + 유형 행동 · 장비·특성·전직·스킬·물약 적용</p>' : `<p class="lead">동료 협공 · 동료로 싸울 때 공격력 ×${ALLY_ATK} (아래 수치 포함) · 치명타 관통 = 리더의 ${Math.round(ALLY_PIERCE * 100)}%</p>`}
      <div class="astars">${[1, 2, 3, 4, 5].map(n => `<i class="${n <= st ? 'on' : ''}">★</i>`).join('')} <small>각성 ${st} / ${STAR_MAX} · 강화 ${CHAR_UPS.reduce((a, u) => a + L[u.id], 0)}회 · 등급·각성 보정 ×${charMul(id).toFixed(2)}</small></div>
      <p class="stl">공격력 <b>${fmt(cs.atk)}</b> · 체력 <b>${fmt(cs.maxHp)}</b> · ${isLead ? `기본 공격 <b>${cs.aspd.toFixed(2)}</b>회/초 · 유형 행동 <b>${cs.act.toFixed(2)}</b>회/초` : `행동 <b>${cs.aspd.toFixed(2)}</b>회/초`} · 치명타 <b>${cs.crit.toFixed(0)}%</b> · 회피 <b>${cs.dodge.toFixed(1)}%</b></p>
      <p>${A.act}${A.type === 'warrior' && !isLead ? ` · 도발: 10초마다 적의 공격을 ${id === 'lea' ? 6 : TAUNT_TIME}초 동안 대신 받음 (피해 -${Math.round(tauntGuard(id) * 100)}%)` : ''}</p>
      ${Ab ? `<div class="abil"><b>고유 능력 · ${Ab.name}</b> ${Ab.desc(id)}</div>` : ''}
      <p class="note">공격 속성 · ${A.type === 'heal' || A.type === 'support' ? '마법' : ELEM_NAME[allyEl(id)]}</p>
      ${st < STAR_MAX ? `<div class="anext"><img src="${allyIcon(id, st + 1)}"><div><small>다음 각성</small><br><b>${PREFIX[A.type][st]} ${A.name}</b><br><small>조각 ${have} / ${need}</small></div></div>` : '<p class="note">최대 각성 · 중복은 별가루 +10</p>'}
      <div class="skbtns">${isLead ? '<button class="equip on" disabled>리더</button>' : `<button class="equip${inParty ? ' on' : ''}" id="aParty" ${!inParty && party.length >= partyMax() ? 'disabled' : ''}>${inParty ? '해제' : '배치'}</button><button id="aLead" class="plain">리더로 <small>전투력 ${fmt(power())} → ${fmt(powerIfLeader(id))}</small></button>`}
      <button id="aUpg">강화${canUp(id) ? ' <em class="rdot"></em>' : ''}</button>
      <button id="aAwk" class="awk" ${st >= STAR_MAX || have < need ? 'disabled' : ''}>각성</button></div></div></div>`;
  }
  html += `<p class="note" style="margin:8px 0">리더 1명 + 배치 ${party.length} / ${partyMax()}${partyMax() < PARTY_MAX ? ' · 챕터 보스 처치로 칸 추가' : ''} · 도감 ${own.length} / ${ALLIES.length} (공격력·체력 +${codexBonus()}%) · 새 동료는 뽑기에서 획득</p><div class="agrid">`;
  for (const A of ALLIES) {
    const has = save.allies[A.id], R = RARITY[A.r], st = allyStar(A.id);
    const canAwk = has && st < STAR_MAX && (save.acopy[A.id] || 0) >= AWAKEN_COST[st];
    html += `<button class="acard${has ? '' : ' locked'}${party.includes(A.id) || A.id === save.leader ? ' inparty' : ''}${A.id === allySel ? ' sel' : ''}" style="--rc:${R.color}" ${has ? `data-asel="${A.id}"` : 'disabled'}>
      ${A.id === save.leader ? '<i class="crown">👑</i>' : ''}<img src="${allyIcon(A.id, has ? st : 1)}"><b>${has ? allyName(A.id) : A.name}</b><small>${has ? '★'.repeat(st) : R.stars}</small>${canAwk ? '<em class="rdot"></em>' : ''}</button>`;
  }
  html += '</div>' + setsHtml() + affinityChart() + '<div class="syn"><b>시너지</b>' + SYNERGY.map(s => { const n = typeCount(s.type); return `<div class="${n ? 'on' : ''}">${n ? '✓' : '·'} ${s.text(n || 1)}</div>`; }).join('') + '</div>';
  $('allyList').innerHTML = html;
  $('allyList').querySelectorAll('[data-asel]').forEach(b => b.onclick = () => { allySel = b.dataset.asel; refreshAllies(); });
  $('allyList').querySelectorAll('[data-set]').forEach(b => b.onclick = () => {
    const S = SETS.find(x => x.id === b.dataset.set);
    if (!setDone(S) || (save.sets || {})[S.id]) return;
    save.sets = save.sets || {}; save.sets[S.id] = true; save.dust += S.dust;
    writeSave(); updateHud(); notify(`${S.name} 완성! 별가루 +${S.dust}`, '#ffe27a');
  });
  if (!allySel) return;
  const id = allySel;
  $('aUpg').onclick = () => openUpgrade(id);
  if ($('aLead')) $('aLead').onclick = () => { setLeader(id); refreshStats(); updateHud(); drawBattleIcon(); writeSave(); notify(allyName(id) + ' 리더 지정!', '#ffe27a'); };
  if ($('aParty')) $('aParty').onclick = () => {
    const at = save.party.indexOf(id);
    if (at >= 0) save.party.splice(at, 1);
    else if (save.party.length < partyMax()) save.party.push(id);
    refreshStats(); updateHud();
  };
  $('aAwk').onclick = () => awaken(id);
}

function usePotion() {
  if (!battle || battle.state !== 'fight') return;
  if (battle.pvp) return toast('결투장에서는 물약 사용 불가');
  if (save.potions <= 0) return toast('물약 없음 · 캠프 상점에서 구매');
  if (battle.potionCd > 0) return;
  if (hero.hp <= 0) return toast('리더 쓰러짐 · 웨이브를 깨면 일어남');
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
  if (img.scaleUp) { const k = img.scaleUp, sz = size || 32, pad = sz * (k - 1) / 2; x -= pad; y -= pad; size = sz * k; }   // ★5 큰 그림
  const w = (size || 32) * SCALE, h = img.height / img.width * w;
  ctx.drawImage(img, x * SCALE, y * SCALE, w, h);
  if (flash) {
    ctx.save();
    ctx.globalAlpha = flash * 0.6;
    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(img, x * SCALE, y * SCALE, w, h);
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

function hpBar(x, y, w, ratio, color, h = 2) {
  ctx.fillStyle = '#000a';
  ctx.fillRect(x * SCALE, y * SCALE, w * SCALE, h * SCALE);
  ctx.fillStyle = color;
  ctx.fillRect(x * SCALE, y * SCALE, w * SCALE * Math.min(1, Math.max(0, ratio)), h * SCALE);
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
// 스킬 빨간 점: 배울 수 있는 일반 스킬 · 장착 스킬 강화 가능 · 각성 가능 (장착 안 한 스킬 강화는 표시 안 함)
const skillDot = () => SKILLS.some(sk => skLearnable(sk) && save.gold >= skCost(sk, 0)) || save.slots.some((id, i) => id && skSlotOpen(i) && skCanUp(id)) || Object.keys(save.sk || {}).some(skCanAwaken);
function updateDots() {
  setDot('[data-open=up]', [leaderId()].concat(save.party || []).some(canUp));
  setDot('[data-open=traits]', traitsOpen() && pointsLeft() > 0, pointsLeft());
  setDot('[data-open=allies]', Object.keys(save.allies || {}).some(id => allyById(id) && allyStar(id) < STAR_MAX && (save.acopy[id] || 0) >= AWAKEN_COST[allyStar(id)]));
  setDot('[data-open=skill]', skillDot());
  setDot('[data-open=gear]', save.items.some(it => !Object.values(save.gear).includes(it.id) && itemScore(it) > itemScore(equipped(it.slot))));
  setDot('[data-open=gacha]', save.dust >= GACHA_COST);
  setDot('#lAttend', attendReady());
  setDot('[data-open=arena]', pvpLeft() >= PVP_TRIES);                 // 오늘 아직 결투 안 함
  if (setReward()) setDot('[data-open=allies]', true);
  updateGoal();
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
  drawImg(allyImg(leaderId()), 122, GROUND - 31 + bob);
  ctx.save(); ctx.globalAlpha = 1; ctx.fillStyle = '#ffd25e'; ctx.font = `${9 * SCALE}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillText('👑', 138 * SCALE, (GROUND - 33 + bob) * SCALE); ctx.restore();   // 리더 표시
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
  if (m.ranged) {                                   // 원거리 몬스터 표시
    ctx.save(); ctx.font = '900 22px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 4; ctx.strokeStyle = '#3a2410'; ctx.fillStyle = '#ffe9b0';
    const rx = cx + (m.role ? 26 : 0);
    ctx.strokeText('➶', rx, top - 5); ctx.fillText('➶', rx, top - 5);
    ctx.restore();
  }
  if (m.stun > 0) { ctx.fillStyle = '#ffe27a'; for (let k = 0; k < 3; k++) { const an = time * 6 + k * 2.1; ctx.beginPath(); ctx.arc(cx + Math.cos(an) * 26, top + 26 + Math.sin(an) * 7, 5, 0, Math.PI * 2); ctx.fill(); } }
  if (tauntOn(m)) { ctx.fillStyle = '#ff5a3a'; ctx.font = '900 24px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('💢', cx + 22, top + 14); }
  if (m.charm > 0) { ctx.fillStyle = '#ff7ac8'; ctx.font = '900 22px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('♥', cx + Math.sin(time * 5) * 14, top + 16 - (time * 30 % 20)); }
  if (m.intruder) {
    ctx.fillStyle = '#ffe27a'; ctx.font = '900 20px sans-serif'; ctx.textAlign = 'center'; ctx.shadowColor = '#c8800a'; ctx.shadowBlur = 8;
    ctx.fillText(`⏱ ${Math.max(0, m.escape).toFixed(1)}`, cx, top - 2);
  }
  if (m.burn > 0) { ctx.fillStyle = `rgba(255,120,40,${0.5 + 0.3 * Math.sin(time * 20)})`; ctx.beginPath(); ctx.arc(cx, (GROUND - 6) * SCALE, 10 + Math.random() * 4, 0, Math.PI * 2); ctx.fill(); }
  if (m.ice > 0) {                                  // 스킬 빙결: 얼음 덩어리
    ctx.fillStyle = 'rgba(170,225,255,0.38)'; ctx.strokeStyle = 'rgba(220,245,255,0.9)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.roundRect(cx - size * SCALE * 0.55, (GROUND - size - 2) * SCALE, size * SCALE * 1.1, (size + 2) * SCALE, 10); ctx.fill(); ctx.stroke();
  }
  if (m.vuln) { ctx.fillStyle = '#ff6a6a'; ctx.font = '900 20px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('◎', cx - 26, top + 16); }   // 받는 피해 증가
  ctx.restore();
}

function renderBattle() {
  const walking = battle.delay > 0;
  const bob = walking ? Math.round(Math.abs(Math.sin(time * 12)) * -2) : Math.round(Math.sin(time * 4) * 0.8);
  // 리더 모션: 근접 무기는 돌진 베기(잔상), 지팡이·악기는 공중 캐스팅, 활은 반동. 쓰러지면 누워 있음
  const ha = hero.atk, hpr = ha ? Math.min(1, ha.t / ha.dur) : 0, style = leaderStyle(), girl = style === 'cast';
  const down = hero.hp <= 0 && battle.state !== 'won';
  let hdx = 0, hdy = bob, hrot = 0;
  if (down) hdy = 6;
  else if (girl) {
    if (!walking && battle.state === 'fight') hdy += -5 + Math.sin(time * 3) * 1.5;
    if (ha) hdy -= Math.sin(Math.PI * hpr) * (ha.kind === 'basic' ? 6 : 12);
  } else if (ha && style === 'shoot') {
    hdx = (hero.back ? 1 : -1) * 3 * Math.sin(Math.PI * hpr);           // 활 반동
  } else if (ha) {
    const reach = ha.kind === 'basic' ? 24 : 34;
    hdx = (hero.back ? -1 : 1) * reach * Math.sin(Math.PI * Math.min(1, hpr * 1.15));
    if (ha.kind === 'whirl') hrot = hpr * Math.PI * 2;
  }
  const hx = hero.x + hdx;
  shadow(hx + 16);
  if (girl && !down && !walking && battle.state === 'fight') {   // 발밑 마법진
    const cx0 = (hx + 16) * SCALE, cy0 = (GROUND + 1) * SCALE, on = ha ? 1 : 0.35;
    ctx.save();
    ctx.globalAlpha = on; ctx.strokeStyle = '#ff9ad0'; ctx.shadowColor = '#ff6ac0'; ctx.shadowBlur = ha ? 16 : 6;
    ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(cx0, cy0, 20 * SCALE, 5 * SCALE, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(cx0, cy0, 14 * SCALE, 3.5 * SCALE, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#ffd0ec';
    for (let k = 0; k < 6; k++) { const an = time * 1.5 + k * Math.PI / 3; ctx.fillRect(cx0 + Math.cos(an) * 17 * SCALE - 3, cy0 + Math.sin(an) * 4.2 * SCALE - 3, 6, 6); }
    ctx.restore();
  }
  const heroImg = allyImg(leaderId());
  const drawHero = (ox, alpha, ghost) => {
    ctx.save();
    if (battle.state === 'lost') ctx.globalAlpha = 0.35;
    ctx.globalAlpha *= alpha;
    if (ghost) ctx.filter = 'brightness(1.8) saturate(0.4)';
    if (hrot) { const px = (hero.x + ox + 16) * SCALE, py = (GROUND - 15) * SCALE; ctx.translate(px, py); ctx.rotate(hrot); ctx.translate(-px, -py); }
    if (down) { const px = (hero.x + 16) * SCALE, py = GROUND * SCALE; ctx.translate(px, py); ctx.rotate(-1.45); ctx.translate(-px, -py); ctx.filter = 'grayscale(1)'; ctx.globalAlpha *= 0.55; }
    drawImg(heroImg, hero.x + ox, GROUND - 31 + hdy, 32, ghost ? 0 : hero.hurt);
    ctx.restore();
  };
  const heroOnTop = style === 'melee' && !!ha && !down;                           // 돌진 중인 소년은 몬스터 앞에 보이게 나중에 그림
  const paintHero = () => { if (style === 'melee' && ha && !down && Math.abs(hdx) > 4) { drawHero(hdx * 0.3, 0.25, true); drawHero(hdx * 0.65, 0.4, true); } drawHero(hdx, 1, false); };
  if (!heroOnTop) paintHero();
  // 뿌리 감옥 경고(발밑 빛)와 묶임
  if (battle.mechWarn && mechNow() === 'root') {
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
    if (s.kind === 'spirit') {                          // 빛의 정령: 빛나는 구슬 + 날개
      const px = (sx + 16) * SCALE, py = (sy + 4 + Math.sin(time * 4 + s.k) * 3) * SCALE;
      ctx.shadowColor = '#ffe27a'; ctx.shadowBlur = 22; ctx.fillStyle = '#fff6c8';
      ctx.beginPath(); ctx.arc(px, py, 14 + s.act * 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,240,180,0.6)';
      for (const d of [-1, 1]) { ctx.beginPath(); ctx.ellipse(px + d * 20, py - 6, 14, 7, d * 0.5 + Math.sin(time * 12) * 0.2, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
      continue;
    }
    ctx.filter = s.kind === 'clone' ? 'brightness(1.3) saturate(0.5) hue-rotate(160deg)' : 'brightness(0.15) sepia(1) hue-rotate(230deg) saturate(4)';
    if (s.kind === 'clone') ctx.globalAlpha *= 0.75;
    drawImg(allyImg(leaderId()), sx, sy, s.kind === 'clone' ? 30 : 28);
    ctx.filter = 'none';
    if (s.kind !== 'clone') {
      ctx.fillStyle = '#d0a0ff';
      ctx.fillRect((sx + 17) * SCALE, (sy + 11) * SCALE, 5, 5); ctx.fillRect((sx + 21) * SCALE, (sy + 11) * SCALE, 5, 5);
    }
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
    if (!down && hp && hp.sh > 0) {                            // 스킬 보호막
      ctx.save(); ctx.strokeStyle = 'rgba(150,210,255,0.75)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse((x + dx + 16) * SCALE, (GROUND - 15 + dy) * SCALE, 18 * SCALE, 17 * SCALE, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    }
    if (hp) hpBar(x + 9, GROUND - 36 + (i % 2) * 2, 14, down ? 1 : hp.hp / hp.max, down ? '#6a6a70' : hp.hp < hp.max * 0.3 ? '#ff8a5a' : '#6fe39a');   // 동료 체력바 (걷는 중에도)
  });
  drawHolds(hx);
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
      ctx.globalAlpha = 1 - pr; ctx.strokeStyle = f.color || '#b48cff'; ctx.lineWidth = 6; ctx.shadowColor = '#6a2aa0'; ctx.shadowBlur = 16;
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
    } else if (f.kind === 'mshot') {                    // 원거리 몬스터의 투사체 (몬스터 → 파티원)
      const fx0 = f.from * S, k = Math.min(1, pr / 0.8), px = fx0 + (tx - fx0) * k, py = Y(GROUND - 24) + Y(6) * k - Math.sin(k * Math.PI) * 40;
      ctx.shadowColor = f.color; ctx.shadowBlur = 14;
      if (pr < 0.8) {
        ctx.globalAlpha = 0.5; ctx.strokeStyle = f.color; ctx.lineWidth = 5;
        ctx.beginPath(); ctx.moveTo(px + 30, py - 6); ctx.lineTo(px, py); ctx.stroke();
        ctx.globalAlpha = 1; ctx.fillStyle = f.color; ctx.beginPath(); ctx.arc(px, py, 9, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(px - 2, py - 2, 3.5, 0, Math.PI * 2); ctx.fill();
      } else {
        const q2 = (pr - 0.8) / 0.2;
        ctx.globalAlpha = 1 - q2; ctx.strokeStyle = f.color; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(tx, Y(GROUND - 18), 8 + q2 * 26, 0, Math.PI * 2); ctx.stroke();
      }
    } else if (f.kind === 'hypno') {                    // 최면 소용돌이
      ctx.globalAlpha = 1 - pr; ctx.strokeStyle = '#ff9ae0'; ctx.lineWidth = 4;
      ctx.beginPath(); for (let a = 0; a < 18; a += 0.3) ctx.lineTo(tx + Math.cos(a + pr * 8) * a * 3, Y(GROUND - 50) + Math.sin(a + pr * 8) * a * 3); ctx.stroke();
    } else if (f.kind === 'meteor') {                   // 스킬: 떨어지는 바위 → 폭발
      if (pr < 0.5) {
        const k = pr / 0.5, px = tx + 160 * (1 - k), py = -40 + (ty + 40) * k;
        ctx.globalAlpha = 0.5; ctx.strokeStyle = '#ffb05a'; ctx.lineWidth = 16; ctx.beginPath(); ctx.moveTo(px + 60, py - 90); ctx.lineTo(px, py); ctx.stroke();
        ctx.globalAlpha = 1; ctx.fillStyle = '#7a4a2a'; ctx.shadowColor = '#ff7a3a'; ctx.shadowBlur = 30;
        ctx.beginPath(); ctx.arc(px, py, 26, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ffb05a'; ctx.beginPath(); ctx.arc(px - 6, py - 6, 9, 0, Math.PI * 2); ctx.fill();
      } else {
        const q2 = (pr - 0.5) / 0.5;
        ctx.globalAlpha = 1 - q2; ctx.fillStyle = '#ff9a3a'; ctx.shadowColor = '#ffd25e'; ctx.shadowBlur = 30;
        ctx.beginPath(); ctx.arc(tx, ty, 30 + q2 * 150, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff3c0'; ctx.beginPath(); ctx.arc(tx, ty, 20 + q2 * 60, 0, Math.PI * 2); ctx.fill();
      }
    } else if (f.kind === 'chain') {                    // 스킬: 대상들을 잇는 번개 지그재그
      ctx.globalAlpha = 1 - pr; ctx.strokeStyle = '#d6b0ff'; ctx.lineWidth = 6; ctx.shadowColor = '#a070ff'; ctx.shadowBlur = 20;
      ctx.beginPath(); ctx.moveTo((hero.x + 24) * S, ay - 10);
      (f.xs || []).forEach((x, k) => { const mx = ((k ? f.xs[k - 1] : hero.x + 24) + x) / 2 * S; ctx.lineTo(mx, ty - 40 + (k % 2 ? 30 : -20) * (1 - pr)); ctx.lineTo(x * S, ty); });
      ctx.stroke();
    } else if (f.kind === 'ice') {                      // 스킬: 파란 얼음 조각
      ctx.globalAlpha = 1 - pr; ctx.fillStyle = '#bfefff'; ctx.strokeStyle = '#5ab8ff'; ctx.lineWidth = 3;
      for (let n = 0; n < 6; n++) {
        const an = n * Math.PI / 3 + 0.3, r = 12 + pr * 46;
        ctx.save(); ctx.translate(tx + Math.cos(an) * r, ty - 12 + Math.sin(an) * r); ctx.rotate(an);
        ctx.beginPath(); ctx.moveTo(-14, 0); ctx.lineTo(0, -6); ctx.lineTo(14, 0); ctx.lineTo(0, 6); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
      }
    } else if (f.kind === 'wind') {                     // 스킬: 바람 줄기 (화면을 가로지름)
      ctx.globalAlpha = 0.8 * (1 - pr); ctx.strokeStyle = '#e8fff4'; ctx.lineWidth = 5;
      for (let n = 0; n < 6; n++) {
        const yy = Y(GROUND - 60 + n * 10), x0 = (hero.x + pr * 260 - 60 + (n % 3) * 30) * S;
        ctx.beginPath(); ctx.moveTo(x0, yy); ctx.quadraticCurveTo(x0 + 90, yy - 18, x0 + 200, yy); ctx.stroke();
      }
    } else if (f.kind === 'holy') {                     // 스킬: 빛기둥
      ctx.globalAlpha = 1 - pr; ctx.fillStyle = 'rgba(255,240,170,0.75)'; ctx.shadowColor = '#ffe27a'; ctx.shadowBlur = 30;
      const w = 40 * (1 - pr * 0.5);
      ctx.fillRect(tx - w / 2, 0, w, Y(GROUND));
      ctx.beginPath(); ctx.ellipse(tx, Y(GROUND), 60, 14, 0, 0, Math.PI * 2); ctx.fill();
    } else if (f.kind === 'shield') {                   // 스킬: 보호막 거품
      ctx.globalAlpha = 1 - pr; ctx.strokeStyle = '#9fd0ff'; ctx.fillStyle = 'rgba(160,210,255,0.25)'; ctx.lineWidth = 5; ctx.shadowColor = '#7ac8ff'; ctx.shadowBlur = 18;
      ctx.beginPath(); ctx.arc(tx, Y(GROUND - 16), 40 + pr * 30, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    } else if (f.kind === 'buff') {                     // 스킬: 위로 오르는 반짝이
      ctx.globalAlpha = 1 - pr; ctx.fillStyle = f.party ? '#ffd27a' : '#fff3a0'; ctx.shadowColor = '#ffd25e'; ctx.shadowBlur = 12;
      for (let n = 0; n < 7; n++) { const px = tx + Math.sin(n * 2.7) * 40, py = Y(GROUND) - pr * 120 - (n % 3) * 26; ctx.fillRect(px - 4, py - 4, 8, 8); }
      ctx.strokeStyle = '#ffd25e'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(tx, Y(GROUND), 40 + pr * 30, 10, 0, 0, Math.PI * 2); ctx.stroke();
    } else if (f.kind === 'quake') {                    // 스킬: 땅이 갈라짐
      ctx.globalAlpha = 1 - pr; ctx.strokeStyle = '#5a3418'; ctx.lineWidth = 7;
      ctx.beginPath(); let px = (hero.x + 30) * S; ctx.moveTo(px, Y(GROUND));
      for (let n = 1; n <= 8; n++) { px += (tx - (hero.x + 30) * S + 120) / 8; ctx.lineTo(px, Y(GROUND) + (n % 2 ? 8 : -6)); }
      ctx.stroke();
      ctx.fillStyle = '#8a6a48'; for (let n = 0; n < 6; n++) ctx.fillRect(tx - 120 + n * 45, Y(GROUND) - pr * 60 - (n % 2) * 20, 10, 10);
    } else if (f.kind === 'time') {                     // 스킬: 시계 원
      const cy = Y(GROUND - 40), r = 70 + pr * 20;
      ctx.globalAlpha = 1 - pr * 0.8; ctx.strokeStyle = '#e0d0ff'; ctx.lineWidth = 5; ctx.shadowColor = '#a090ff'; ctx.shadowBlur = 18;
      ctx.beginPath(); ctx.arc(tx, cy, r, 0, Math.PI * 2); ctx.stroke();
      for (let n = 0; n < 12; n++) { const an = n * Math.PI / 6; ctx.beginPath(); ctx.moveTo(tx + Math.cos(an) * r * 0.85, cy + Math.sin(an) * r * 0.85); ctx.lineTo(tx + Math.cos(an) * r, cy + Math.sin(an) * r); ctx.stroke(); }
      ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(tx, cy); ctx.lineTo(tx + Math.cos(pr * 12 - 1.57) * r * 0.75, cy + Math.sin(pr * 12 - 1.57) * r * 0.75); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(tx, cy); ctx.lineTo(tx + Math.cos(pr * 2 - 1.57) * r * 0.5, cy + Math.sin(pr * 2 - 1.57) * r * 0.5); ctx.stroke();
    } else if (f.kind === 'void') {                     // 스킬: 어두운 소용돌이
      const cy = Y(GROUND - 30);
      ctx.globalAlpha = 1 - pr * 0.7; ctx.fillStyle = '#1a0a2a'; ctx.shadowColor = '#8a40ff'; ctx.shadowBlur = 30;
      ctx.beginPath(); ctx.arc(tx, cy, 30 + Math.sin(pr * Math.PI) * 30, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#b080ff'; ctx.lineWidth = 4;
      ctx.beginPath(); for (let a = 0; a < 16; a += 0.3) ctx.lineTo(tx + Math.cos(a - pr * 10) * (90 - a * 5), cy + Math.sin(a - pr * 10) * (90 - a * 5) * 0.6); ctx.stroke();
    } else if (f.kind === 'tide') {                     // 보스 해일: 파란 물결이 화면을 가로지름 (오른쪽 → 왼쪽)
      const x0 = cv.width * (1.1 - pr * 1.5), top = Y(GROUND - 70), yy = k => top + Math.sin(k * 1.3 + time * 8) * 14 + (k === 0 ? 40 : 0);
      ctx.globalAlpha = Math.min(1, (1 - pr) * 2) * 0.75;
      const gr = ctx.createLinearGradient(0, top, 0, Y(GROUND + 10));
      gr.addColorStop(0, 'rgba(150,220,255,0.9)'); gr.addColorStop(1, 'rgba(30,90,200,0.85)');
      ctx.fillStyle = gr;
      ctx.beginPath(); ctx.moveTo(x0, Y(GROUND + 10));
      for (let k = 0; k <= 14; k++) ctx.lineTo(x0 + k * 60, yy(k));
      ctx.lineTo(x0 + 14 * 60, Y(GROUND + 10)); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#eaf8ff'; ctx.lineWidth = 5;
      ctx.beginPath(); for (let k = 0; k <= 14; k++) k ? ctx.lineTo(x0 + k * 60, yy(k)) : ctx.moveTo(x0, yy(0)); ctx.stroke();
    } else if (f.kind === 'breath') {                   // 보스 화염 숨결: 입에서 파티까지 불꽃 부채꼴
      const fx0 = f.from * S, fy0 = Y(GROUND - 44), ex = (hero.x - 70) * S, reach = fx0 + (ex - fx0) * Math.min(1, pr / 0.35);
      ctx.globalAlpha = pr < 0.6 ? 0.85 : 0.85 * (1 - (pr - 0.6) / 0.4);
      const gr = ctx.createLinearGradient(fx0, 0, ex, 0);
      gr.addColorStop(0, '#fff3a0'); gr.addColorStop(0.35, '#ffb03a'); gr.addColorStop(1, 'rgba(255,70,30,0.6)');
      ctx.fillStyle = gr; ctx.shadowColor = '#ff7a3a'; ctx.shadowBlur = 30;
      ctx.beginPath(); ctx.moveTo(fx0, fy0); ctx.lineTo(reach, Y(GROUND - 78)); ctx.quadraticCurveTo(reach - 40, Y(GROUND - 34), reach, Y(GROUND + 6)); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ffe27a';
      for (let k = 0; k < 8; k++) { const q = (k * 0.13 + pr * 2) % 1, px = fx0 + (reach - fx0) * q; ctx.beginPath(); ctx.arc(px, fy0 + Math.sin(k * 2.1 + time * 12) * 34 * q, 8, 0, Math.PI * 2); ctx.fill(); }
    } else if (f.kind === 'gust') {                     // 보스 돌풍: 오른쪽에서 왼쪽으로 바람 줄기
      ctx.globalAlpha = 0.85 * (1 - pr); ctx.strokeStyle = '#f0fbff'; ctx.lineWidth = 5; ctx.shadowColor = '#bfe8ff'; ctx.shadowBlur = 12;
      for (let n = 0; n < 9; n++) {
        const yy = Y(GROUND - 80 + n * 9), x0 = cv.width * (1.05 - pr * 1.4) + (n % 3) * 70;
        ctx.beginPath(); ctx.moveTo(x0, yy); ctx.quadraticCurveTo(x0 - 110, yy - 22, x0 - 240, yy); ctx.stroke();
        ctx.beginPath(); ctx.arc(x0 - 240, yy - 12, 12, Math.PI * 0.5, Math.PI * 2); ctx.stroke();
      }
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
    if (m.mirror) {                                   // 그림자 분신: 그 파티원 그림을 어둡게 (왼쪽을 봄)
      const sx = m.x + (m.kb || 0);
      ctx.translate((sx + 16) * SCALE * 2, 0); ctx.scale(-1, 1);
      ctx.filter = 'brightness(0.3) saturate(0.5) hue-rotate(220deg)';
      drawImg(allyImg(m.mirror), sx, GROUND - 31 + wob, 32, m.hurt);
    } else if (m.pvp) {                               // 결투장 상대: 그 동료 그림 (왼쪽을 봄)
      const sx = m.x + (m.kb || 0);
      ctx.translate((sx + 16) * SCALE * 2, 0); ctx.scale(-1, 1);
      drawImg(allySprite(m.pvp.id, m.pvp.star, m.pvp.type, 0), sx, GROUND - 31 + wob, 32, m.hurt);
    } else drawImg(face(m.sprite), m.x + (m.kb || 0), GROUND - size + 1 + wob, size, Math.max(m.hurt, warn));
    ctx.restore();
    if (m.dead <= 0) drawMonMarks(m, size);
    if (battle.pvp && i > 0 && m.dead <= 0) hpBar(m.x + 2, GROUND - size - 5, size - 4, m.hp / m.maxHp, '#ff6b7a');   // 결투장: 뒤 상대도 체력바
    if ((i === 0 || m.king) && m.dead <= 0 && !battle.dungeon) {         // 분신이 앞에 서도 보스 체력바는 보이게
      hpBar(m.x + 2, GROUND - size - 5, size - 4, m.hp / m.maxHp, '#ff6b7a');
      label(m.name + (ALIGN[m.align] && !m.name.includes(ALIGN[m.align][0]) ? ' · ' + ALIGN[m.align][0] : '') + (BODY[m.body] ? ' · ' + BODY[m.body].name : '') + (m.ranged ? ' · 원거리' : ''), m.x + size / 2, GROUND - size - 9, m.role ? ROLES[m.role].color : m.boss ? '#ffb0b8' : '#fff');
    }
    if (i === 0 && battle.dungeon) label(m.name, m.x + size / 2, GROUND - size - 4, '#ffe9a8');
  }
  if (heroOnTop) paintHero();
  // 리더 체력바 (조금 크게, 쓰러지면 회색, 보호막은 하늘색 줄)
  {
    const hr = Math.max(0, hero.hp) / stats.maxHp, by = GROUND - 40 + (girl && !down ? -5 : 0);
    hpBar(hero.x + 5, by, 22, down ? 1 : hr, down ? '#6a6a70' : hr < 0.3 ? '#ff8a5a' : '#6fe39a', 3);
    if (battle.shield > 0 && !down) { ctx.fillStyle = '#9fd0ff'; ctx.fillRect((hero.x + 5) * SCALE, (by - 1) * SCALE, 22 * SCALE * Math.min(1, battle.shield / stats.maxHp), SCALE * 0.8); }
  }
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
  drawMechOverlay();
  drawFloats(floats);
  const pos = { hero: [hx + 16, GROUND - 36] };
  const kb = battle.king && !battle.dungeon ? battle.queue.find(m => m.king && m.dead <= 0) : null;
  if (kb) pos.boss = [kb.x + (kb.size || 32) / 2, GROUND - (kb.size || 32) - 16];
  (save.party || []).forEach((id, i) => { pos[id] = [allyX(i) + 16, GROUND - 40]; });
  drawBubbles(pos);
}

// 빙결된 파티원(얼음 덩어리) · 리더 기절(별) · 화염 숨결 화상
function drawHolds(hx) {
  ctx.save();
  for (const id of team()) {
    const x = id === save.leader ? hx : allyX(save.party.indexOf(id)), fz = battle.frozen && battle.frozen[id] > 0;
    if (fz && !allyDown(id)) {
      ctx.globalAlpha = Math.min(1, battle.frozen[id] * 3);
      ctx.fillStyle = 'rgba(170,225,255,0.42)'; ctx.strokeStyle = 'rgba(225,248,255,0.95)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.roundRect((x + 1) * SCALE, (GROUND - 34) * SCALE, 30 * SCALE, 35 * SCALE, 10); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo((x + 6) * SCALE, (GROUND - 29) * SCALE); ctx.lineTo((x + 12) * SCALE, (GROUND - 18) * SCALE); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    if (battle.pburn > 0 && !allyDown(id)) {
      ctx.fillStyle = `rgba(255,120,40,${0.35 + 0.2 * Math.sin(time * 18 + x)})`;
      ctx.beginPath(); ctx.arc((x + 16) * SCALE, (GROUND - 4) * SCALE, 9 + Math.random() * 4, 0, Math.PI * 2); ctx.fill();
    }
  }
  if (battle.daze > 0 && hero.hp > 0) {
    ctx.fillStyle = '#ffe27a';
    for (let k = 0; k < 3; k++) { const an = time * 6 + k * 2.1; ctx.beginPath(); ctx.arc((hx + 16) * SCALE + Math.cos(an) * 26, (GROUND - 40) * SCALE + Math.sin(an) * 7, 5, 0, Math.PI * 2); ctx.fill(); }
  }
  ctx.restore();
}
// 보스 특수 공격 경고와 화면 효과 (경고 중 그림 · 시간 정지 · 일식)
function drawMechOverlay() {
  const k = battle.king && !battle.dungeon ? battle.queue.find(m => m.king && m.dead <= 0) : null, S = SCALE, W = cv.width, H = cv.height;
  ctx.save();
  if (k && battle.mechWarn) {
    const id = mechNow(), fl = 0.5 + 0.5 * Math.sin(time * 16), kx = (k.x + 32) * S;
    if (id === 'freeze') {                                      // 발밑에 서리
      ctx.fillStyle = `rgba(190,235,255,${0.25 + 0.2 * fl})`;
      for (const m of team()) if (!allyDown(m)) { ctx.beginPath(); ctx.ellipse(memberX(m) * S, (GROUND + 1) * S, 16 * S, 4 * S, 0, 0, Math.PI * 2); ctx.fill(); }
    } else if (id === 'tide') {                                 // 오른쪽에서 물이 차오름
      const g = ctx.createLinearGradient(W, 0, W * 0.55, 0);
      g.addColorStop(0, `rgba(60,140,230,${0.45 + 0.2 * fl})`); g.addColorStop(1, 'rgba(60,140,230,0)');
      ctx.fillStyle = g; ctx.fillRect(W * 0.55, (GROUND - 24) * S, W * 0.45, 30 * S);
    } else if (id === 'breath') {                               // 숨결 범위 (부채꼴 테두리)
      const fx0 = (k.x + 4) * S, ex = (hero.x - 70) * S;
      ctx.strokeStyle = `rgba(255,120,40,${0.4 + 0.4 * fl})`; ctx.lineWidth = 4; ctx.setLineDash([14, 10]);
      ctx.beginPath(); ctx.moveTo(fx0, (GROUND - 44) * S); ctx.lineTo(ex, (GROUND - 78) * S); ctx.lineTo(ex, (GROUND + 6) * S); ctx.closePath(); ctx.stroke();
      ctx.setLineDash([]);
    } else if (id === 'gust') {                                 // 보스 주위로 바람이 모임
      ctx.strokeStyle = `rgba(230,250,255,${0.35 + 0.35 * fl})`; ctx.lineWidth = 3;
      for (let n = 0; n < 5; n++) { const r = 20 + (time * 60 + n * 18) % 90; ctx.beginPath(); ctx.arc(kx, (GROUND - 40) * S, r, 0, Math.PI * 1.5); ctx.stroke(); }
    } else if (id === 'rewind') {                               // 시계 원 + 시계 파괴 게이지
      const cy = (GROUND - 40) * S, r = 100, p = Math.min(1, Math.max(0, (battle.rwHp0 || 0) - k.hp) / (k.maxHp * REWIND_BREAK));
      ctx.strokeStyle = '#e0d0ff'; ctx.lineWidth = 5; ctx.shadowColor = '#a090ff'; ctx.shadowBlur = 16;
      ctx.beginPath(); ctx.arc(kx, cy, r, 0, Math.PI * 2); ctx.stroke();
      for (let n = 0; n < 12; n++) { const an = n * Math.PI / 6; ctx.beginPath(); ctx.moveTo(kx + Math.cos(an) * r * 0.86, cy + Math.sin(an) * r * 0.86); ctx.lineTo(kx + Math.cos(an) * r, cy + Math.sin(an) * r); ctx.stroke(); }
      ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(kx, cy); ctx.lineTo(kx + Math.cos(-time * 9) * r * 0.8, cy + Math.sin(-time * 9) * r * 0.8); ctx.stroke();
      ctx.strokeStyle = '#ffe27a'; ctx.lineWidth = 9; ctx.beginPath(); ctx.arc(kx, cy, r + 12, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * p); ctx.stroke();
      ctx.shadowBlur = 0; ctx.fillStyle = '#fff3c0'; ctx.font = '900 20px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(`시계 파괴 ${Math.floor(p * 100)}%`, kx, cy - r - 22);
    } else if (id === 'mirror') {                               // 발밑 그림자
      ctx.fillStyle = `rgba(80,30,120,${0.3 + 0.25 * fl})`;
      ctx.beginPath(); ctx.ellipse(kx, (GROUND + 1) * S, 40 * S, 6 * S, 0, 0, Math.PI * 2); ctx.fill();
    }
  }
  if (battle.stop > 0) {                                        // 시간 정지: 푸른 회색 화면
    ctx.fillStyle = 'rgba(120,110,190,0.28)'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#e8e0ff'; ctx.font = '900 34px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(`⏱ 시간 정지 ${Math.max(0, battle.stop).toFixed(1)}초`, W / 2, 150);
  }
  if (battle.eclipse > 0) {                                     // 일식: 어두운 화면 + 검은 해
    const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.2, W / 2, H / 2, H * 0.95);
    g.addColorStop(0, 'rgba(10,0,30,0.25)'); g.addColorStop(1, 'rgba(10,0,30,0.62)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#05000f'; ctx.shadowColor = '#b8a0ff'; ctx.shadowBlur = 30;
    ctx.beginPath(); ctx.arc(W / 2, 70, 30, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0; ctx.fillStyle = '#d8c8ff'; ctx.font = '900 26px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(`일식 · 치명타 0 · ${Math.ceil(battle.eclipse)}초`, W / 2, 130);
  }
  ctx.restore();
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
  $('lGold').textContent = goldText();
  $('lShards').textContent = save.shards || 0;
  $('lDust').textContent = fmt(save.dust || 0);
  $('dunLeft').textContent = `${dunLeft('gold') + dunLeft('gear')}/${DUNGEON_TRIES * 2}`;
  $('pvpLeft').textContent = `${pvpLeft()}/${PVP_TRIES}`;
  updateMissionBanner();
  $('lBattleSub').textContent = allDone ? '스테이지 선택' : atBoss ? '👑 챕터 보스 도전' : `${chapter(c).name} ${stageLabel(top)}`;
  $('lName').textContent = `Lv ${heroLevel()} ${allyName(leaderId())}`;
  const tb = $('traitBtn');
  tb.classList.toggle('lock', !traitsOpen());
  tb.querySelector('small').textContent = traitsOpen() ? '' : '잠김';
  updateDots();
  refreshSettings();
  $('chestRate').textContent = `초당 ${idleRate().toFixed(1)} G`;
  $('chestBtn').hidden = !BAL.idleOn && save.chest < 1;   // 방치 상자 꺼짐: 남은 골드를 다 받으면 숨김
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
  $('bStage').textContent = battle.pvp ? `⚔ 결투장 · ${battle.pvp.name}${battle.pvp.bot ? ' (연습)' : ''}` : battle.dungeon ? `🏰 일일 던전 · ${DUNGEONS.find(x => x.id === battle.dungeon).name}` : battle.king ? `👑 챕터 보스 · ${chapter(battle.ch).boss.name}` : `${chapter(chOf(battle.stage)).name} ${stageLabel(battle.stage)}`;
  if (!battle.king) $('bWave').textContent = `웨이브 ${battle.wave + 1} / ${WAVES.length}` + (battle.wave === WAVES.length - 1 ? ' · 대장 등장!' : '') + ` · 몬스터 치명타 저항 ${critRes(battle.stage).toFixed(1)}%`;
  $('skillBar').innerHTML = save.slots.map((id, i) => {
    const sk = id && skillById(id), o = sk && skOf(id), open = skSlotOpen(i);
    if (!open) return `<button class="stone skbtn lock" data-slot="${i}" disabled><kbd>${i + 1}</kbd><span>🔒</span><small>챕터 3 보스</small></button>`;
    return `<button class="stone skbtn${sk && o ? '' : ' lock'}" data-slot="${i}"${sk && o ? ` style="--gc:${GRADES[sk.grade].color}"` : ''}><kbd>${i + 1}</kbd><span>${sk && o ? sk.name : '빈 칸'}</span>${sk && o ? `<small>Lv ${o.lv} ${'★'.repeat(o.star)}</small>` : ''}<i class="cd"></i><span class="cdn"></span></button>`;
  }).join('') + `<button class="stone skauto${save.autoSkill ? ' on' : ''}" id="autoBtn">AUTO<small>${save.autoSkill ? '켜짐' : '꺼짐'}</small></button>`;
  $('skillBar').querySelectorAll('.skbtn').forEach(b => b.onclick = () => castSkill(+b.dataset.slot, false));
  $('autoBtn').onclick = () => { save.autoSkill = !save.autoSkill; updateBattleHud(); };
  $('bGold').textContent = goldText();
  $('waves').innerHTML = WAVES.map((_, i) => `<i class="${i < battle.wave ? 'done' : i === battle.wave ? 'now' : ''}"></i>`).join('');
  $('potionCnt').textContent = save.potions + '개';
  $('bName').textContent = '👑 ' + allyName(leaderId());
}

// 매 프레임: 체력바, 물약 쿨타임
// 왼쪽 아래 큰 체력바 = 파티 전체 체력 합 (리더 + 동료)
function partyHp() {
  let hp = Math.max(0, hero.hp), max = stats.maxHp;
  for (const a of Object.values((battle && battle.ahp) || {})) { hp += Math.max(0, a.hp); max += a.max; }
  return { hp, max };
}
function updateBattleBars() {
  const P = partyHp(), r = P.max > 0 ? Math.min(1, P.hp / P.max) : 0;
  $('hpfill').style.width = (r * 100) + '%';
  $('hpbar').classList.toggle('low', r < 0.3);
  $('bHp').textContent = `파티 체력 ${fmt(P.hp)} / ${fmt(P.max)}` + (hero.hp <= 0 ? ' · 리더 쓰러짐' : '');
  const cd = battle ? battle.potionCd : 0;
  $('potionCd').style.setProperty('--p', (cd / POTION_CD * 100) + '%');
  $('potionCdn').textContent = cd > 0 ? Math.ceil(cd) : '';
  if (battle && battle.king) {
    const s = Math.ceil(battle.timeLeft);
    if (battle.dungeon) $('bWave').textContent = `남은 시간 ${s}초 · 준 피해 ${fmt(battle.dealt)}`;
    else if (battle.pvp) { const al = battle.queue.filter(m => m.dead <= 0).length; $('bWave').textContent = `남은 시간 ${s}초 · 남은 상대 ${al} / ${battle.pvpN}` + (battle.pvpRamp > 1 ? ` · 🔥 결투 열기 피해 ×${battle.pvpRamp.toFixed(1)}` : ' · 물약 사용 불가'); }
    else {
      const k = battle.queue.find(m => m.king), rw = !!(battle.mechWarn && mechNow() === 'rewind' && k);
      $('bWave').textContent = `제한 시간 ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')} · `
        + (rw ? `시간 되감기 경고 · 시계 파괴 ${Math.min(100, Math.floor(Math.max(0, battle.rwHp0 - k.hp) / (k.maxHp * REWIND_BREAK) * 100))}%` : `${mechLabel()} ${Math.max(0, battle.mechCd).toFixed(1)}초 후`)
        + (battle.eclipse > 0 ? ' · 일식' : '') + (battle.stop > 0 ? ' · 시간 정지' : '');
    }
  }
  const stuck = !!battle && (hero.hp <= 0 || held(save.leader));     // 리더가 빙결·기절·시간 정지·쓰러짐 → 스킬 못 씀 표시
  $('skillBar').querySelectorAll('.skbtn').forEach(b => {
    const id = save.slots[b.dataset.slot], sk = id && skillById(id);
    b.classList.toggle('dim', stuck && !!sk);
    if (!sk || !battle || !b.querySelector('.cd')) return;
    const left = battle.skillCd[id] || 0;
    b.querySelector('.cd').style.setProperty('--p', Math.min(100, left / skCd(sk) * 100) + '%');
    b.querySelector('.cdn').textContent = left > 0 ? Math.ceil(left) : '';
    b.classList.toggle('cooling', left > 0);
  });
}

function showScreen(name) {
  screen = name;
  $('lobbyUI').hidden = name !== 'lobby';
  $('battleUI').hidden = name !== 'battle';
  closeModal();
  if (name === 'lobby') { battle = null; SEALED = false; endDialog(true); bubbles = []; refreshStats(); }
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
  if (kind === 'arena') return openPanel('arena', '결투장');
  if (kind === 'up') return openUpgrade();
  modalKind = kind;
  $('mTitle').textContent = { shop: '상점', skill: '스킬', gear: '장비' }[kind];
  if (kind === 'gear') {
    $('mBody').innerHTML = '<div class="mgold" id="mGold"></div><div class="gearslots" id="gearSlots"></div><div class="baghead"><span id="bagCnt"></span><button id="sellLow">일반·고급 모두 팔기</button></div><div id="bag"></div><p class="note">전투에서만 획득 · 대장 처치 시 1개 확정, 일반 몬스터는 낮은 확률 · 높은 스테이지일수록 좋은 장비</p>';
    $('sellLow').onclick = sellLow;
    $('modal').hidden = false;
    refreshModal();
    return;
  }
  if (kind === 'skill') {
    document.querySelector('.mbox').classList.add('wide');
    $('mBody').innerHTML = `<div class="mgold" id="mGold"></div><div class="skslots" id="skSlots"></div><div class="gtabs skf" id="skTabs"></div><div id="skDet"></div><div class="skgrid" id="skGrid"></div>
      <p class="note">스킬 칸 ${SKILL_SLOTS}개 (4번째 칸은 챕터 3 보스 처치 시 해금) · AUTO 켜짐: 조건에 맞으면 자동 사용 · AUTO 꺼짐: 버튼 또는 1~4 키 · 리더만 사용 · 스킬 뽑기는 뽑기 → 스킬 탭</p>`;
    $('modal').hidden = false;
    refreshModal();
    return;
  }
  $('mBody').innerHTML = '<div class="mgold" id="mGold"></div>' + `
    <div class="up" id="shopPotion">
      <div class="nm">회복 물약<small></small></div>
      <div class="val">전투 중 최대 체력의 ${POTION_HEAL * 100}% 회복 · 사용 후 ${POTION_CD}초 대기</div>
      <button></button>
    </div>
    <p class="note">최대 ${POTION_MAX}개 보유 · 스테이지가 오를수록 가격 상승</p>
    <div class="baghead"><span>장비 <small id="shopTimer"></small></span><button id="reroll"></button></div>
    <div id="shopGear"></div>
    <p class="note">희귀 등급까지 판매 · 전투 장비보다 약간 낮은 성능 · 스테이지가 오를수록 성능 상승</p>`;
  checkShop(); $('reroll').onclick = rerollShop;
  holdButton($('shopPotion').querySelector('button'), buyPotion);
  $('modal').hidden = false;
  refreshModal();
}

// ── 강화 화면: 캐릭터 고르기 + 5줄 강화 (캐릭터마다 따로) ──
let upSel = null;                  // 강화 화면에서 보고 있는 캐릭터
// 순서: 리더 → 배치 동료 → 그 밖의 보유 동료
const upOrder = () => [...new Set([leaderId()].concat(save.party || [], ALLIES.filter(A => save.allies[A.id]).map(A => A.id)))].filter(id => allyById(id));
const canUp = id => { const L = charLv(id); return CHAR_UPS.some(u => L[u.id] < u.max && save.gold >= charUpCost(id, u, L[u.id])); };
function openUpgrade(id) {
  modalKind = 'up';
  powerGain = 0;
  if (typeof id === 'string' && allyById(id)) upSel = id;
  if (!upSel || !upOrder().includes(upSel)) upSel = leaderId();
  $('mTitle').textContent = '강화';
  $('mBody').innerHTML = '<div class="mgold" id="mGold"></div><div class="upsel" id="upSel"></div><div class="upsum" id="upSum"></div>'
    + CHAR_UPS.map(u => `<div class="up" id="up_${u.id}"><div class="nm">${u.name}<small></small></div><div class="val"></div><button></button></div>`).join('')
    + `<p class="note">강화는 캐릭터마다 따로 (능력치·성장 캐릭터마다 다름) · <b>따라잡기</b>: 보유 캐릭터 중 최고 레벨보다 낮은 항목은 비용 ${Math.round((1 - CATCHUP_MUL) * 100)}% 할인 · <b>협공</b>: 동료로 싸울 때 공격력 ×${ALLY_ATK} · 리더 수치는 장비·특성·전직 포함 · 누르고 있으면 연속 강화</p>`;
  CHAR_UPS.forEach(u => holdButton($('up_' + u.id).querySelector('button'), () => buyUp(upSel, u)));
  $('modal').hidden = false;
  refreshModal();
}
function refreshUpgrade() {
  if (!upOrder().includes(upSel)) upSel = leaderId();
  const id = upSel, A = allyById(id), L = charLv(id), lead = id === leaderId(), cur = memberStats(id), lid = leaderId();
  $('upSel').innerHTML = upOrder().map(x => `<button class="${x === id ? 'on' : ''}" data-us="${x}" style="--rc:${RARITY[allyById(x).r].color}">${x === lid ? '<i class="crown">👑</i>' : ''}<img src="${allyIcon(x)}"><b>${allyById(x).name}</b><small>${x === lid ? '리더' : (save.party || []).includes(x) ? '배치' : '대기'}</small>${canUp(x) ? '<em class="rdot"></em>' : ''}</button>`).join('');
  $('upSel').querySelectorAll('[data-us]').forEach(b => b.onclick = () => { upSel = b.dataset.us; refreshModal(); });
  $('upSum').innerHTML = `<img src="${allyIcon(id)}"><div><b>${lead ? '👑 ' : ''}${allyName(id)}</b> <small>${A.role}${ABIL[id] ? ' · ' + ABIL[id].name : ''}</small>
    <div class="sts"><span>공격력 <b>${fmt(cur.atk)}</b>${lead ? '' : ` <small>(협공 ×${ALLY_ATK})</small>`}</span><span>체력 <b>${fmt(cur.maxHp)}</b></span><span>${lead ? `기본 공격 <b>${cur.aspd.toFixed(2)}</b>회/초 · 유형 행동 <b>${cur.act.toFixed(2)}</b>회/초` : `행동 <b>${cur.aspd.toFixed(2)}</b>회/초`}</span><span>치명타 <b>${cur.crit.toFixed(1)}%</b></span><span>회피 <b>${cur.dodge.toFixed(1)}%</b></span></div></div>`;
  CHAR_UPS.forEach(u => {
    const row = $('up_' + u.id), lv = L[u.id], btn = row.querySelector('button');
    row.querySelector('.nm small').textContent = 'Lv ' + lv + (lv < u.max && lv < upTop(u) ? ` · 따라잡기 -${Math.round((1 - CATCHUP_MUL) * 100)}%` : '');
    if (lv >= u.max) {
      row.querySelector('.val').textContent = upgradeText(u.id, cur) + ' (최대)';
      btn.textContent = 'MAX'; btn.disabled = true; btn.className = 'max';
    } else {
      const cost = charUpCost(id, u, lv), next = memberStats(id, { ...L, [u.id]: lv + 1 });
      row.querySelector('.val').innerHTML = `${upgradeText(u.id, cur)} → <em>${upgradeText(u.id, next)}</em>`;
      btn.textContent = fmt(cost) + ' G'; btn.className = '';
      btn.disabled = save.gold < cost;
    }
  });
}
// 강화 1번 (누르고 있으면 연속). 샀으면 true
function buyUp(id, u) {
  if (!id || !allyById(id) || (!save.allies[id] && id !== leaderId())) return false;
  const lv = charLv(id)[u.id];
  if (lv >= u.max) return false;
  const cost = charUpCost(id, u, lv);
  if (save.gold < cost) return false;
  const p0 = power();
  save.gold -= cost;
  ensureLv(id)[u.id] = lv + 1;
  refreshStats();
  powerGain += power() - p0;
  track('upgrades');
  updateHud();
  return true;
}

function closeModal() {
  const notice = modalKind === 'notice', nx = notice ? noticeNext : null;
  if (notice) { noticeNext = null; const k = noticeKey || 'reworkNotice'; noticeKey = null; if (save && save[k]) { delete save[k]; writeSave(); } }   // 안내창은 어떻게 닫아도 한 번만
  $('modal').hidden = true; modalKind = null; document.querySelector('.mbox').classList.remove('wide');
  $('mClose').hidden = false;
  if (save && !save.leader && !$('game').hidden) setTimeout(() => { if (!save.leader && $('modal').hidden) openLeaderPick(); }, 0);
  if (nx) nx();
}

function potionPrice() { return monGold(save.stage) * 6; }

function refreshModal() {
  $('mGold').innerHTML = '보유 골드 ' + goldText() + ' G' + (modalKind === 'up' ? ` · 팀 전투력 ${fmt(power())}${powerGain > 0 ? ` <em class="pgain">▲ ${fmt(powerGain)}</em>` : ''}` : '');
  if (modalKind === 'up') {
    refreshUpgrade();
  } else if (modalKind === 'missions') {
    refreshMissions();
  } else if (modalKind === 'gacha') {
    const tabs = `<div class="gtabs">${[['ally', '동료'], ['gear', '장비'], ['skill', '스킬']].map(([k, n]) => `<button data-gt="${k}" class="${gachaTab === k ? 'on' : ''}">${n}</button>`).join('')}</div>`;
    if (gachaTab === 'ally') {
      $('pBody').innerHTML = `${tabs}<div class="pickup"><img src="${allyIcon(pickupId(), 1)}"><div><b>이번 주 픽업 · ★★★ ${allyById(pickupId()).name}</b><small>전설이 나오면 50% 확률로 ${allyById(pickupId()).name} · 남은 시간 ${pickupLeft()}</small></div></div><div class="gtop">보유 별가루 <b>${fmt(save.dust)}</b></div>
        <div class="grates">${[1, 2, 3].map(r => `<span style="color:${RARITY[r].color}">${RARITY[r].stars} ${RARITY[r].name} ${AGACHA_W[r]}%</span>`).join('')}</div>
        <div class="gbtns"><button id="a1" ${save.dust < AGACHA_COST ? 'disabled' : ''}>1회 뽑기<small>별가루 ${AGACHA_COST}</small></button>
        <button id="a10" ${save.dust < AGACHA10_COST ? 'disabled' : ''}>10회 뽑기<small>별가루 ${AGACHA10_COST} · 희귀 이상 1명 보장</small></button></div>
        <p class="note">전설 확정까지 ${APITY - (save.apity || 0)}회 · 중복은 각성 조각 · 결과 화면에서 바로 다시 뽑으면 연속할수록 할인 (최대 ${AGAIN_MAX}%)</p>`;
      $('a1').onclick = () => doAllyGacha(1);
      $('a10').onclick = () => doAllyGacha(10);
    } else if (gachaTab === 'skill') {
      $('pBody').innerHTML = `${tabs}<div class="gtop">보유 별가루 <b>${fmt(save.dust)}</b> · 보유 스킬 ${Object.keys(save.sk || {}).length} / ${SKILLS.length}</div>
        <div class="grates">${GRADES.map((G, i) => SGACHA_W[i] ? `<span style="color:${G.color}">${G.name} ${(SGACHA_W[i] / 10).toFixed(1)}%</span>` : '').join('')}</div>
        <div class="gbtns"><button id="s1" ${save.dust < SGACHA_COST ? 'disabled' : ''}>1회 뽑기<small>별가루 ${SGACHA_COST}</small></button>
        <button id="s10" ${save.dust < SGACHA10_COST ? 'disabled' : ''}>10회 뽑기<small>별가루 ${SGACHA10_COST} · 희귀 이상 1개 보장</small></button></div>
        <p class="note">전설 이상 확정까지 ${SPITY - (save.spity || 0)}회 · 일반·보스 전용 스킬은 안 나옴 · 중복은 각성 조각 (★5 뒤 별가루 +${SK_DUST}) · 결과 화면에서 바로 다시 뽑으면 연속할수록 할인 (최대 ${AGAIN_MAX}%)</p>`;
      $('s1').onclick = () => doSkillGacha(1);
      $('s10').onclick = () => doSkillGacha(10);
    } else {
      $('pBody').innerHTML = `${tabs}<div class="gtop">보유 별가루 <b>${fmt(save.dust)}</b></div>
        <div class="grates">${GRADES.map((G, i) => GACHA_W[i] ? `<span style="color:${G.color}">${G.name} ${(GACHA_W[i] / 10).toFixed(1)}%</span>` : '').join('')}</div>
        <div class="gbtns"><button id="g1" ${save.dust < GACHA_COST ? 'disabled' : ''}>1회 뽑기<small>별가루 ${GACHA_COST}</small></button>
        <button id="g10" ${save.dust < GACHA10_COST ? 'disabled' : ''}>10회 뽑기<small>별가루 ${GACHA10_COST} · 희귀 이상 1개 보장</small></button></div>
        <p class="note">지금 스테이지 수준의 장비 · 별가루는 미션, 일일 던전, 챕터 보스에서 획득</p>`;
      $('g1').onclick = () => doGacha(1);
      $('g10').onclick = () => doGacha(10);
    }
    $('pBody').querySelectorAll('[data-gt]').forEach(b => b.onclick = () => { gachaTab = b.dataset.gt; refreshModal(); });
  } else if (modalKind === 'dungeon') {
    $('pBody').innerHTML = DUNGEONS.map(D => `<div class="up dun"><div class="nm"><img class="gicon" src="${ICON_URL[D.sprite]}">${D.name}<small>남은 횟수 ${dunLeft(D.id)} / ${DUNGEON_TRIES}</small></div>
      <div class="val">${D.desc} · 하루 ${DUNGEON_TRIES}번</div><button data-dun="${D.id}" ${dunLeft(D.id) <= 0 ? 'disabled' : ''}>입장</button></div>`).join('')
      + '<p class="note">자정에 횟수 초기화 · 지금 진행 중인 스테이지 수준으로 보상</p>';
    $('pBody').querySelectorAll('[data-dun]').forEach(b => b.onclick = () => { closeModal(); startDungeon(b.dataset.dun); });
  } else if (modalKind === 'arena') {
    refreshArena();
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
    refreshSkills();
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

// ── 스킬 화면: 장착 칸 4개 · 등급 필터 · 카드 그리드 · 상세 (장착/해제 · 강화 · 각성 · 배우기) ──
let skSel = null, skFilter = 'all';
const SK_TABS = [['all', '전체']].concat(GRADES.map((G, i) => [String(i), G.name]), [['boss', '보스']]);
const skPct = v => String(+(v * 100).toFixed(1));
function refreshSkills() {
  if (!skSel || !skillById(skSel)) skSel = save.slots.find(Boolean) || 'strike';
  $('skSlots').innerHTML = save.slots.map((id, i) => {
    const sk = id && skillById(id), o = sk && skOf(id);
    if (!skSlotOpen(i)) return `<div class="skslot lock"><b>🔒 ${i + 1}번 칸</b><small>챕터 3 보스 처치 시 해금</small></div>`;
    return sk && o ? `<button class="skslot${id === skSel ? ' sel' : ''}" data-sks="${id}" style="--gc:${GRADES[sk.grade].color}">${skIcon(sk)}<div><b>${i + 1} · ${sk.name}</b><small>Lv ${o.lv} · ${'★'.repeat(o.star)}</small></div></button>`
      : `<div class="skslot empty"><b>${i + 1}번 칸</b><small>빈 칸 · 아래에서 장착</small></div>`;
  }).join('');
  $('skTabs').innerHTML = SK_TABS.map(([k, n]) => `<button data-skf="${k}" class="${k === skFilter ? 'on' : ''}">${n}</button>`).join('');
  const list = SKILLS.filter(sk => skFilter === 'all' || (skFilter === 'boss' ? sk.boss : sk.grade === +skFilter))
    .map((sk, i) => [sk, i]).sort((a, b) => a[0].grade - b[0].grade || !!a[0].boss - !!b[0].boss || a[1] - b[1]).map(x => x[0]);
  $('skGrid').innerHTML = list.map(sk => {
    const o = skOf(sk.id), eq = save.slots.includes(sk.id);
    const dot = o ? (eq && skCanUp(sk.id)) || skCanAwaken(sk.id) : skLearnable(sk) && save.gold >= skCost(sk, 0);
    return `<button class="skcard${o ? '' : ' off'}${sk.id === skSel ? ' sel' : ''}${eq ? ' eq' : ''}" data-skc="${sk.id}" style="--gc:${GRADES[sk.grade].color}">
      ${o ? skIcon(sk) : '<i class="skico q">?</i>'}<b>${sk.name}</b><small>${o ? `Lv ${o.lv} · ${'★'.repeat(o.star)}${eq ? ' · 장착' : ''}` : skSource(sk)}</small>${dot ? '<em class="rdot"></em>' : ''}</button>`;
  }).join('') || '<p class="note">해당 등급 스킬 없음</p>';
  // 상세
  const sk = skillById(skSel), o = skOf(skSel), G = GRADES[sk.grade];
  const lv = o ? o.lv : 1, st = o ? o.star : 1, max = skMaxLv(st), up = !!o && lv < max, at = save.slots.indexOf(sk.id);
  const sum = sk.eff.find(e => e.t === 'summon');
  let btns = '';
  if (o) {
    btns = `<button class="equip${at >= 0 ? ' on' : ''}" id="skEq">${at >= 0 ? '해제' : '장착'}</button>
      <button id="skUp" ${up && save.gold >= skCost(sk, lv) ? '' : 'disabled'}>${up ? `강화 ${fmt(skCost(sk, lv))} G` : lv >= max && st < STAR_MAX ? '최대 레벨 · 각성 필요' : '최대 레벨'}</button>
      <button id="skAwk" class="awk" ${skCanAwaken(sk.id) ? '' : 'disabled'}>${st >= STAR_MAX ? '최대 각성' : `각성 (조각 ${o.copy}/${SK_AWAKEN[st]})`}</button>`;
  } else if (sk.grade === 0) {
    const ok = skLearnable(sk);
    btns = `<button id="skLearn" ${ok && save.gold >= skCost(sk, 0) ? '' : 'disabled'}>${ok ? `배우기 ${fmt(skCost(sk, 0))} G` : '잠김'}</button>`;
  }
  $('skDet').innerHTML = `<div class="skdet" style="--gc:${G.color}">${o ? skIcon(sk) : '<i class="skico q">?</i>'}<div class="skinfo">
    <b style="color:${G.color}">${G.name}${sk.boss ? ` · 챕터 ${sk.boss} 보스 전용` : ''}</b>
    <h3>${sk.name} <small>${o ? `Lv ${lv} / ${max} · ${'★'.repeat(st)}${'☆'.repeat(STAR_MAX - st)}` : `미보유 · ${skSource(sk)}`}</small></h3>
    <p>${skDesc(sk, lv, st, up ? lv + 1 : 0)}</p>
    ${sum ? `<p class="note">소환수 1초마다 공격력 ${skPct(skVal(sum, lv, st))}%${up ? ` → ${skPct(skVal(sum, lv + 1, st))}%` : ''} · ${sum.n}명 · ${sum.dur}초</p>` : ''}
    <p class="note">쿨타임 ${+skCd(sk).toFixed(1)}초${stats.mods.cd ? ` (기본 ${sk.cd}초)` : ''} · AUTO: ${AUTO_TEXT[sk.auto] || '전투 중'} · 속성 ${ELEM_NAME[sk.el] || '없음'}${o && st < STAR_MAX ? ' · 각성마다 효과 +20% · 최대 Lv +5' : ''}${o && at >= 0 ? ` · ${at + 1}번 칸` : ''}</p>
    <div class="skbtns">${btns}</div></div></div>`;
  const id = sk.id;
  $('mBody').querySelectorAll('[data-sks],[data-skc]').forEach(b => b.onclick = () => { skSel = b.dataset.sks || b.dataset.skc; refreshModal(); });
  $('skTabs').querySelectorAll('[data-skf]').forEach(b => b.onclick = () => { skFilter = b.dataset.skf; refreshModal(); });
  if ($('skEq')) $('skEq').onclick = () => equipSkill(id);
  if ($('skUp')) $('skUp').onclick = () => learnSkill(id);
  if ($('skAwk')) $('skAwk').onclick = () => awakenSkill(id);
  if ($('skLearn')) $('skLearn').onclick = () => learnSkill(id);
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
    rankUpload();
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
  try { remote = checkSave(await window.Cloud.load()); }
  catch (e) { console.warn(e); cloudMsg = '클라우드 불러오기 실패'; cloudBusy = false; refreshSettings(); return; }
  cloudBusy = false;
  if (!remote || remote.cloudRev === save.cloudRev) return cloudUpload();   // 첫 로그인이거나 이 기기가 이어서 진행한 것
  showSyncChoice(remote);
}

function saveSummary(s) {
  const L = s.clv && s.leader && s.clv[s.leader] ? s.clv[s.leader] : s.lv || {};      // v3 이전 세이브는 lv
  return `스테이지 ${stageLabel(Math.min(Math.max(1, s.stage || 1), MAX_STAGE))} · 골드 ${fmt(s.gold || 0)} · 리더 공격력 Lv ${L.atk || 0}<br>마지막 저장 ${s.savedAt ? hhmm(s.savedAt) : '-'}`;
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
  $('mTitle').textContent = tr('settings');
  const lang = getLanguage();
  $('mBody').innerHTML = `<div class="mgold" id="mGold"></div>
    <div class="up"><div class="nm">${tr('language')}</div><div class="val">${lang === 'en' ? 'Choose the language for supported settings text.' : '설정 화면에서 사용할 언어를 선택하세요.'}</div><div class="skbtns"><button id="langKo" class="equip${lang === 'ko' ? ' on' : ''}">${tr('korean')}</button><button id="langEn" class="equip${lang === 'en' ? ' on' : ''}">${tr('english')}</button></div></div>
    <div class="up"><div class="nm">${tr('leader')}<small>${esc(allyName(leaderId()))}</small></div><div class="val">${tr('leaderHelp')}</div><button id="toLeader">${tr('changeLeader')}</button></div>
    <div class="up"><div class="nm">${tr('sound')}</div><div class="val">${lang === 'en' ? 'Background music · Button sound effects' : '배경음악 · 버튼 효과음'}</div><div class="skbtns"><button id="tBgm" class="equip${Sound.bgm ? ' on' : ''}">${tr('bgm')} ${Sound.bgm ? tr('on') : tr('off')}</button><button id="tSfx" class="equip${Sound.sfx ? ' on' : ''}">${tr('sfx')} ${Sound.sfx ? tr('on') : tr('off')}</button></div></div>
    <div id="devSlot"></div><div id="setBody"></div>`;
  $('langKo').onclick = () => setLanguage('ko');
  $('langEn').onclick = () => setLanguage('en');
  $('tBgm').onclick = () => { const on = Sound.toggle('bgm'); $('tBgm').textContent = tr('bgm') + ' ' + (on ? tr('on') : tr('off')); $('tBgm').classList.toggle('on', on); };
  $('tSfx').onclick = () => { const on = Sound.toggle('sfx'); $('tSfx').textContent = tr('sfx') + ' ' + (on ? tr('on') : tr('off')); $('tSfx').classList.toggle('on', on); };
  $('toLeader').onclick = () => { closeModal(); openAllies(leaderId()); };
  $('modal').hidden = false;
  refreshSettings();
  devTools();
}

// 업데이트 후 첫 접속: 주인공 대신 리더 동료를 고른다 (가진 동료 + 시작 동료 3명)
function openLeaderPick() {
  modalKind = 'leader';
  $('mTitle').textContent = '리더 선택';
  $('mClose').hidden = true;
  const ids = [...new Set(Object.keys(save.allies || {}).filter(allyById).concat(STARTERS))];
  $('mBody').innerHTML = `<div class="mgold" id="mGold"></div>
    <p class="lead">이제 주인공 없이 동료들이 싸움 · 리더는 맨 앞에서 싸우고, 지금까지의 강화는 처음 고른 리더가 물려받음 · 장비·특성·전직·스킬·물약은 리더에게 적용 · 리더는 동료 페이지에서 언제든 변경 · 모두 쓰러지면 패배</p>
    <div class="agrid">${ids.map(id => { const A = allyById(id), own = save.allies[id]; return `<button class="acard" style="--rc:${RARITY[A.r].color}" data-lead="${id}"><img src="${allyIcon(id, own ? allyStar(id) : 1)}"><b>${own ? allyName(id) : A.name}</b><small>${A.role}${own ? '' : ' · 새 동료'}</small></button>`; }).join('')}</div>`;
  $('modal').hidden = false;
  refreshModal();
  $('mBody').querySelectorAll('[data-lead]').forEach(b => b.onclick = () => {
    const id = b.dataset.lead;
    save.astar = save.astar || {};
    if (!save.allies[id]) { save.allies[id] = 1; save.astar[id] = 1; }
    if (save.leadLv) {                                    // 옛 전역 강화는 처음 고른 리더가 물려받음
      const L = ensureLv(id);
      for (const u of CHAR_UPS) L[u.id] = Math.min(u.max, Math.max(L[u.id] || 0, save.leadLv[u.id] || 0));
      delete save.leadLv;
    }
    setLeader(id);
    // 고른 리더가 배치 동료였으면 빈 칸이 생김 → 보유 동료 중 강한 순(등급·각성 → 강화 레벨)으로 채움
    const lvSum = x => CHAR_UPS.reduce((t, u) => t + (charLv(x)[u.id] || 0), 0);
    const spare = Object.keys(save.allies).filter(x => save.allies[x] && allyById(x) && x !== save.leader && !save.party.includes(x)).sort((a, b) => allyPow(b) - allyPow(a) || lvSum(b) - lvSum(a));
    while (save.party.length < partyMax() && spare.length) save.party.push(spare.shift());
    $('mClose').hidden = false;
    closeModal();
    refreshStats(); updateHud(); drawBattleIcon(); writeSave(); cloudUpload();
    fanfare('리더 결정!', allyName(id) + ' · 맨 앞에서 싸움');
    setTimeout(showWelcome, 2000);
  });
}

function drawBattleIcon() {
  const ic = $('battleIcon').getContext('2d');
  ic.clearRect(0, 0, 96, 96);
  ic.drawImage(allySprite(leaderId(), allyStar(leaderId()), allyById(leaderId()).type, 0), 0, 0, 96, 96);
}

function refreshSettings() {
  $('lPower').textContent = jobTitle() + ' · 전투력 ' + fmt(power()) + (cloudOn() ? ' · ☁ 클라우드' : '');
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
const DEV_HASHES = ['410f5af8785efc48318b3aacfa7c970eb181d864cb673464afcea3bad172a571', '21c92c937c2c7eb9f2ce722ba4b6bf7762ae902ba1b8b382fccc5a21e33fb73c', '26cee45acb2d5002ca29a5b9d4dde970cb147b39d8fc3393646589ba550d6c83'];
async function isDev() {
  if (TEST) return true;
  const u = window.Cloud && window.Cloud.user;
  if (!u || !u.email || !(window.crypto && crypto.subtle)) return false;
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(u.email.trim().toLowerCase()));
  return DEV_HASHES.includes([...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join(''));
}
async function devTools() {
  if (!(await isDev()) || modalKind !== 'settings' || !$('devSlot') || $('devBox')) return;
  const box = document.createElement('div');
  box.className = 'up dev'; box.id = 'devBox';
  const f = (id, label, v, max) => `<label>${label}<input id="${id}" type="number" min="${id === 'dvStage' ? 1 : 0}" ${max ? `max="${max}"` : ''} value="${Math.floor(v)}"></label>`;
  box.innerHTML = `<div class="nm">개발자 도구<small>${TEST ? '테스트 모드' : '개발자 계정'}</small></div>
    <div class="devgrid">${f('dvGold', '골드', save.gold)}${f('dvDust', '별가루', save.dust)}${f('dvShards', '별조각', save.shards || 0)}${f('dvPot', '물약', save.potions)}${f('dvStage', '도달 스테이지', save.stage, MAX_STAGE + 1)}</div>
    <div class="skbtns"><button id="dvApply">적용</button><button id="dvAllies" class="plain">모든 동료 획득</button><button id="dvCopies" class="plain">동료 조각 +5</button><button id="dvSkills" class="plain">모든 스킬 획득</button><button id="dvSkCopies" class="plain">스킬 조각 +5</button><button id="dvDaily" class="plain">일일 초기화</button></div>
    <div class="skbtns"><button id="dvTune" class="plain">밸런스 도구 열기</button></div>
    <p class="note">${tuneInfo()}</p>
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
    if (st !== save.stage) devSetStage(st);
    done('적용 완료');
  };
  $('dvAllies').onclick = () => { save.astar = save.astar || {}; ALLIES.forEach(A => { if (!save.allies[A.id]) { save.allies[A.id] = 1; save.astar[A.id] = 1; } }); done(`동료 ${ALLIES.length}명 획득 완료`); };
  $('dvCopies').onclick = () => { save.acopy = save.acopy || {}; Object.keys(save.allies).forEach(id => { if (allyById(id)) save.acopy[id] = (save.acopy[id] || 0) + 5; }); done('조각 +5 지급 완료'); };
  $('dvSkills').onclick = () => { save.sk = save.sk || {}; SKILLS.forEach(sk => { if (!save.sk[sk.id]) gainSkill(sk.id); }); done(`스킬 ${SKILLS.length}종 획득 완료`); };
  $('dvSkCopies').onclick = () => { Object.values(save.sk || {}).forEach(o => { o.copy += 5; }); done('스킬 조각 +5 지급 완료'); };
  $('dvTune').onclick = () => window.open('dev.html', '_blank');
  $('dvDaily').onclick = () => { save.daily = null; ensureDaily(); done('일일 미션·던전 초기화 완료'); };
}

// 도달 스테이지 바꾸기 (개발자 도구, 1 ~ MAX_STAGE+1): 그 스테이지 앞 챕터 보스는 처치(동료·보스 스킬 지급), 아직 못 가는 챕터 보스 기록은 삭제
function devSetStage(st) {
  save.stage = st;
  for (const c of Object.keys(save.bosses)) if (st <= c * STAGES_PER) delete save.bosses[c];
  for (let c = 1; c < chOf(Math.min(st, MAX_STAGE)); c++) {
    if (!save.bosses[c]) { save.bosses[c] = true; const id = CHAPTERS[c - 1].boss.ally; if (id) gainAlly(id); grantBossSkill(c); }
  }
  save.seenCh = Math.max(save.seenCh || 1, chOf(Math.min(st, MAX_STAGE)));
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
  try { remote = migrateSave(checkSave(await window.Cloud.load())); }
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
  let pick = null;
  $('starterPick').innerHTML = STARTERS.map(id => `<button data-st="${id}"><canvas width="96" height="96" id="st_${id}"></canvas>${allyById(id).name}<small>${allyById(id).role}</small></button>`).join('');
  for (const id of STARTERS) {
    const c = $('st_' + id).getContext('2d');
    c.clearRect(0, 0, 96, 96);
    c.drawImage(allySprite(id, 1, allyById(id).type, 0), 0, 0, 96, 96);
  }
  box.querySelectorAll('[data-st]').forEach(b => b.onclick = () => {
    pick = b.dataset.st;
    box.querySelectorAll('[data-st]').forEach(x => x.classList.toggle('on', x === b));
    $('startMsg').textContent = '';
  });
  $('go').onclick = () => {
    if (!pick) return ($('startMsg').textContent = '첫 동료 선택 필요');
    save = newSave(pick);
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
  const icons = new Set(CHAPTERS.flatMap(C => C.monsters.map(m => m.sprite).concat(C.boss.sprite)).concat(['miru', 'serin', 'kai'], DUNGEONS.map(D => D.sprite)));
  for (const id of icons) if (SPR[id]) ICON_URL[id] = SPR[id].toDataURL ? SPR[id].toDataURL() : SPR[id].src;
  if (Sound.alias) Sound.alias(Object.fromEntries(CHAPTERS.map(C => [C.theme, C.bgm || C.theme])));   // 챕터 테마 → 배경음악
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
  $('gOk').onclick = closeGacha;
  $('lAttend').onclick = openAttend;
  $('lRank').onclick = openRank;
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('modal').hidden && modalKind !== 'leader') closeModal(); });
  $('modal').onclick = e => { if (e.target === $('modal')) closeModal(); };
  $('lSave').onclick = () => {
    writeSave();
    floatsLobby.push({ text: '저장 완료!', t: 0, x: 160, y: 60, color: '#ffffff', big: true });
  };
  $('lReset').onclick = openSettings;

  showScreen('lobby');
  if (!save.leader) openLeaderPick(); else showWelcome();
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

// ── 밸런스 덮어쓰기 (개발자 도구 dev.html) ──
// 모두에게: dev.html → Firestore config/balance → cloud.js 가 'star-tune' 이벤트로 넘김 (다음 접속을 위해 localStorage 에도 보관)
// 테스트(?test): dev.html 이 localStorage TUNE_TEST_KEY 에 쓰면 열려 있는 ?test 게임에 바로 적용 (storage 이벤트)
// 형식 data = { BAL: { monHp, ch: { 4: [체력, 공격력] }, ... }, CHAR_UPS: { atk: { base, grow, max } }, RARITY_MUL: [1, 1.3, 1.7], WAVES: [3, 3, 4], ... }
// 값이 없거나 이상하면 그 값만 무시하고 원래 값을 쓴다. 전투 중에 오면 전투가 끝난 뒤 적용
const TUNE_KEY = 'starTale.tune.v1', TUNE_TEST_KEY = 'starTale.tune.test';
const TUNE_VARS = {
  WAVES: [() => WAVES, v => { WAVES = v; }], WAVE_HEAL: [() => WAVE_HEAL, v => { WAVE_HEAL = v; }], POTION_HEAL: [() => POTION_HEAL, v => { POTION_HEAL = v; }],
  POTION_CD: [() => POTION_CD, v => { POTION_CD = v; }], POTION_MAX: [() => POTION_MAX, v => { POTION_MAX = v; }], IDLE_CAP_HOURS: [() => IDLE_CAP_HOURS, v => { IDLE_CAP_HOURS = v; }],
  BOSS_TIME: [() => BOSS_TIME, v => { BOSS_TIME = v; }], REPLAY_BONUS: [() => REPLAY_BONUS, v => { REPLAY_BONUS = v; }], SHARD_BONUS: [() => SHARD_BONUS, v => { SHARD_BONUS = v; }],
  CATCHUP_MUL: [() => CATCHUP_MUL, v => { CATCHUP_MUL = v; }], ALLY_ATK: [() => ALLY_ATK, v => { ALLY_ATK = v; }], SK_COST: [() => SK_COST, v => { SK_COST = v; }],
  FREEZE_MAX: [() => FREEZE_MAX, v => { FREEZE_MAX = v; }], DROP_CHANCE: [() => DROP_CHANCE, v => { DROP_CHANCE = v; }],
  GACHA_COST: [() => GACHA_COST, v => { GACHA_COST = v; }], GACHA10_COST: [() => GACHA10_COST, v => { GACHA10_COST = v; }], GACHA_W: [() => GACHA_W, v => { GACHA_W = v; }],
  AGAIN_STEP: [() => AGAIN_STEP, v => { AGAIN_STEP = v; }], AGAIN_MAX: [() => AGAIN_MAX, v => { AGAIN_MAX = v; }],
  DUNGEON_TRIES: [() => DUNGEON_TRIES, v => { DUNGEON_TRIES = v; }], DUNGEON_TIME: [() => DUNGEON_TIME, v => { DUNGEON_TIME = v; }],
  PVP_TRIES: [() => PVP_TRIES, v => { PVP_TRIES = v; }], PVP_TIME: [() => PVP_TIME, v => { PVP_TIME = v; }], PVP_RAMP_AT: [() => PVP_RAMP_AT, v => { PVP_RAMP_AT = v; }],
  PVP_RAMP: [() => PVP_RAMP, v => { PVP_RAMP = v; }], PVP_DPS: [() => PVP_DPS, v => { PVP_DPS = v; }], PVP_HP: [() => PVP_HP, v => { PVP_HP = v; }],
  AWAKEN_COST: [() => AWAKEN_COST, v => { AWAKEN_COST = v; }],
  AGACHA_COST: [() => AGACHA_COST, v => { AGACHA_COST = v; }], AGACHA10_COST: [() => AGACHA10_COST, v => { AGACHA10_COST = v; }], APITY: [() => APITY, v => { APITY = v; }], AGACHA_W: [() => AGACHA_W, v => { AGACHA_W = v; }],
  SGACHA_COST: [() => SGACHA_COST, v => { SGACHA_COST = v; }], SGACHA10_COST: [() => SGACHA10_COST, v => { SGACHA10_COST = v; }], SPITY: [() => SPITY, v => { SPITY = v; }], SGACHA_W: [() => SGACHA_W, v => { SGACHA_W = v; }],
  AWAY_X2: [() => AWAY_X2, v => { AWAY_X2 = v; }],
};
const tuneClone = o => JSON.parse(JSON.stringify(o));
// 처음 값 (덮어쓰기를 지우면 여기로 돌아감). 최대치 Infinity 는 JSON 에 못 담아서 null
const TUNE_BASE = {
  BAL: tuneClone(BAL),
  CHAR_UPS: Object.fromEntries(CHAR_UPS.map(u => [u.id, { base: u.base, grow: u.grow, max: u.max === Infinity ? null : u.max }])),
  RARITY_MUL: RARITY.slice(1).map(r => r.mul),
  vars: Object.fromEntries(Object.entries(TUNE_VARS).map(([k, [get]]) => [k, tuneClone(get())])),
};
let tuneSrc = '', tuneCount = 0, tunePending;
const tuneNum = (v, def) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && typeof def === 'number';
// 숫자 배열: 길이가 같아야 함 (WAVES 만 1~8칸, 칸마다 1~10마리)
function tuneArr(k, v, def) {
  if (!Array.isArray(v) || !Array.isArray(def) || !v.every(x => tuneNum(x, 0))) return false;
  if (k === 'WAVES') return v.length >= 1 && v.length <= 8 && v.every(x => Number.isInteger(x) && x >= 1 && x <= 10);
  return v.length === def.length;
}
function applyTune(data, src) {
  if (typeof battle !== 'undefined' && battle && battle.state === 'fight') { tunePending = [data, src]; return; }
  tunePending = null;
  const live = typeof save !== 'undefined' && save && typeof stats !== 'undefined' && stats;
  if (live) { try { accrue(); } catch (_) {} }       // 바뀌기 전 속도로 지금까지 쌓인 상자를 먼저 계산
  let n = 0;
  const B = tuneClone(TUNE_BASE.BAL);
  const d = data && typeof data === 'object' ? data : {};
  const b = d.BAL && typeof d.BAL === 'object' ? d.BAL : {};
  for (const k of Object.keys(B)) {
    if (k === 'ch' || k === 'king' || k === 'chA' || k === 'kingA') {
      for (const c of Object.keys(b[k] || {})) {
        const v = b[k][c];
        if (+c >= 1 && +c <= 10 && Array.isArray(v) && v.length === 2 && v.every(x => tuneNum(x, 0))) { B[k][c] = v.slice(); n++; }
      }
    } else if (k in b && tuneNum(b[k], B[k])) { B[k] = b[k]; n++; }
  }
  for (const k of Object.keys(B)) BAL[k] = B[k];
  for (const u of CHAR_UPS) {
    const base = TUNE_BASE.CHAR_UPS[u.id], o = (d.CHAR_UPS || {})[u.id] || {};
    u.base = tuneNum(o.base, 0) ? (n++, o.base) : base.base;
    u.grow = tuneNum(o.grow, 0) && o.grow >= 1 ? (n++, o.grow) : base.grow;
    u.max = base.max === null ? Infinity : tuneNum(o.max, 0) && o.max >= 1 ? (n++, Math.floor(o.max)) : base.max;
  }
  const rm = tuneArr('RARITY_MUL', d.RARITY_MUL, TUNE_BASE.RARITY_MUL) ? (n++, d.RARITY_MUL) : TUNE_BASE.RARITY_MUL;
  rm.forEach((m, i) => { RARITY[i + 1].mul = m; });
  for (const [k, [, set]] of Object.entries(TUNE_VARS)) {
    const def = TUNE_BASE.vars[k], v = d[k];
    const ok = Array.isArray(def) ? tuneArr(k, v, def) : tuneNum(v, def);
    set(ok ? tuneClone(v) : tuneClone(def));
    if (ok) n++;
  }
  tuneSrc = n ? src : ''; tuneCount = n;
  if (live) { try { refreshStats(); updateHud(); } catch (e) { console.warn('tune', e); } }
}
const tuneInfo = () => tuneCount ? `밸런스 덮어쓰기 적용 중 · ${tuneSrc} · 값 ${tuneCount}개` : '밸런스: 기본값';
const readTuneRec = key => { try { const r = JSON.parse(localStorage.getItem(key) || 'null'); return r && typeof r === 'object' ? r : null; } catch (_) { return null; } };
// 테스트 모드에서 테스트 덮어쓰기가 있으면 그것, 없으면 모두에게 적용된 값
function loadTune() {
  const t = TEST && readTuneRec(TUNE_TEST_KEY);
  if (t) return applyTune(t.data, '테스트');
  const r = readTuneRec(TUNE_KEY);
  applyTune(r && r.data, '모두에게');
}
loadTune();
// cloud.js 가 Firestore 에서 읽은 값 (문서 없음 = null = 기본값)
window.addEventListener('star-tune', e => {
  const rec = e.detail;
  let data = null;
  try { data = rec && rec.data ? JSON.parse(rec.data) : null; } catch (_) {}
  try { if (data) localStorage.setItem(TUNE_KEY, JSON.stringify({ data, at: rec.at || 0 })); else localStorage.removeItem(TUNE_KEY); } catch (_) {}
  loadTune();
});
window.addEventListener('storage', e => { if (e.key === TUNE_TEST_KEY || e.key === TUNE_KEY) loadTune(); });
setInterval(() => { if (tunePending) applyTune(tunePending[0], tunePending[1]); }, 1000);

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
