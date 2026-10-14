// 별의 설화 — 배경음악(음원 파일)과 효과음(Web Audio로 직접 만든 소리)
// 배경음악: bgm/ 폴더 (Pixabay 무료 음원). 챕터마다 곡이 다르고 보스·던전은 전투곡.
'use strict';

const Sound = (() => {
  const KEY = 'starTale.audio';
  const VOL = 0.45;                 // 배경음악 최대 볼륨
  let opt = { bgm: true, sfx: true };
  try { Object.assign(opt, JSON.parse(localStorage.getItem(KEY)) || {}); } catch (e) { /* 기본값 */ }

  // ── 배경음악 (음원 파일, 바뀔 때 부드럽게 넘어감) ──
  const tracks = {};               // 이름 → <audio>
  let want = 'title', playing = null, unlocked = false;

  function track(name) {
    if (!tracks[name]) {
      const a = new Audio('bgm/' + name + '.mp3');
      a.loop = true; a.preload = 'auto'; a.volume = 0;
      tracks[name] = a;
    }
    return tracks[name];
  }

  // 0.1초마다 볼륨을 조금씩 바꿔 겹쳐 넘긴다
  setInterval(() => {
    if (!unlocked) return;
    if (want !== playing && opt.bgm) {
      const next = track(want);
      if (next.paused) next.play().catch(() => {});
      playing = want;
    }
    for (const [name, a] of Object.entries(tracks)) {
      const target = opt.bgm && name === playing ? VOL : 0;
      a.volume = Math.max(0, Math.min(1, a.volume + Math.sign(target - a.volume) * Math.min(0.05, Math.abs(target - a.volume))));
      if (a.volume === 0 && name !== playing && !a.paused) a.pause();
    }
  }, 100);

  // theme: 챕터 테마(meadow | forest | desert | snow | sea | …) 또는 title, mode: camp | battle | boss | dungeon
  // 곡 파일은 TRACKS뿐 → 챕터 4~ 테마는 alias로 기존 곡에 연결 (game.js가 챕터 데이터의 bgm으로 덮어씀)
  const TRACKS = ['meadow', 'forest', 'desert', 'battle', 'title'];
  const alias = { snow: 'forest', sea: 'meadow', volcano: 'desert', sky: 'meadow', clock: 'desert', shadow: 'forest', cosmos: 'title' };
  function setAlias(map) { for (const [k, v] of Object.entries(map || {})) if (TRACKS.includes(v)) alias[k] = v; }
  function setScene(theme, mode) {
    if (mode === 'boss' || mode === 'dungeon') { want = 'battle'; return; }
    const t = TRACKS.includes(theme) ? theme : alias[theme];
    want = TRACKS.includes(t) ? t : 'meadow';
  }

  // ── 효과음 (Web Audio) ──
  let ac = null, sfx = null;
  function init() {
    if (!unlocked) { unlocked = true; }
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ac = new AC();
    sfx = ac.createGain(); sfx.gain.value = opt.sfx ? 0.55 : 0; sfx.connect(ac.destination);
  }
  const midi = n => 440 * Math.pow(2, (n - 69) / 12);
  function tone(t, freq, dur, type, vol, attack = 0.005, release = 0.2) {
    const o = ac.createOscillator(); o.type = type; o.frequency.value = freq;
    const gn = ac.createGain();
    gn.gain.setValueAtTime(0.0001, t);
    gn.gain.linearRampToValueAtTime(vol, t + attack);
    gn.gain.exponentialRampToValueAtTime(0.0001, t + dur + release);
    o.connect(gn); gn.connect(sfx);
    o.start(t); o.stop(t + dur + release + 0.05);
  }
  const ok = () => ac && opt.sfx;
  const seq = (notes, gap, type = 'triangle', vol = 0.22, dur = 0.08) => {
    if (!ok()) return;
    const t = ac.currentTime;
    notes.forEach((n, i) => n && tone(t + i * gap, midi(n), dur, type, vol, 0.005, 0.25));
  };

  function click() { if (!ok()) return; const t = ac.currentTime; tone(t, 880, 0.03, 'sine', 0.25); tone(t + 0.025, 1320, 0.03, 'sine', 0.18); }
  const coin = () => seq([88, 93], 0.07, 'square', 0.08, 0.06);
  const win = () => seq([72, 76, 79, 84], 0.09);
  const lose = () => seq([67, 63, 60], 0.16, 'triangle', 0.2, 0.14);
  const levelUp = () => seq([72, 76, 79, 84, 88, 91], 0.07, 'triangle', 0.22, 0.1);
  const fanfare = () => { seq([67, 72, 76, 79], 0.12, 'triangle', 0.24, 0.12); setTimeout(() => seq([84, 84, 88], 0.1, 'square', 0.1, 0.2), 520); };
  const claim = () => seq([79, 84, 91], 0.06, 'sine', 0.22, 0.08);
  // 뽑기 등급에 따라 높아지는 소리
  function reveal(grade) {
    if (!ok()) return;
    const base = [60, 64, 67, 72, 76, 79][grade] || 60;
    seq(grade >= 4 ? [base, base + 4, base + 7, base + 12, base + 16] : [base, base + 7], 0.06, grade >= 3 ? 'square' : 'triangle', grade >= 3 ? 0.14 : 0.18, 0.1);
  }

  function save() { try { localStorage.setItem(KEY, JSON.stringify(opt)); } catch (e) { /* 무시 */ } }
  function toggle(kind) {
    opt[kind] = !opt[kind];
    save();
    if (kind === 'sfx' && sfx) sfx.gain.value = opt.sfx ? 0.55 : 0;
    if (kind === 'bgm' && opt.bgm) playing = null;          // 다시 켜면 지금 곡부터
    return opt[kind];
  }

  // 첫 클릭(또는 키 입력)에 소리 시작, 버튼마다 클릭음
  document.addEventListener('pointerdown', e => {
    init();
    if (e.target.closest('button')) click();
  }, true);
  document.addEventListener('keydown', init, { once: true });

  return { setScene, alias: setAlias, click, coin, win, lose, levelUp, fanfare, claim, reveal, toggle,
    get bgm() { return opt.bgm; }, get sfx() { return opt.sfx; } };
})();
