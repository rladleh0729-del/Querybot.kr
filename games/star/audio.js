// 별의 설화 — 배경음악과 효과음 (Web Audio로 직접 만든 소리, 음원 파일 없음)
// 챕터마다 곡이 다르고, 전투에서는 드럼이 더해지고 조금 빨라진다.
'use strict';

const Sound = (() => {
  const KEY = 'starTale.audio';
  let opt = { bgm: true, sfx: true };
  try { Object.assign(opt, JSON.parse(localStorage.getItem(KEY)) || {}); } catch (e) { /* 기본값 */ }

  let ac = null, master, music, sfx, noiseBuf;
  let want = { theme: 'meadow', mode: 'camp' };   // 지금 틀어야 할 곡
  let cur = null;                                  // 지금 나오는 곡
  let nextTime = 0, step = 0;

  const midi = n => 440 * Math.pow(2, (n - 69) / 12);
  const _ = null;

  // 곡: 4마디 반복, 마디마다 8분음표 8칸. chords는 마디별 화음, melody는 32칸.
  const SONGS = {
    meadow: { bpm: 100, lead: 'triangle', chords: [[60, 64, 67], [55, 59, 62], [57, 60, 64], [53, 57, 60]],
      melody: [72, _, 76, _, 79, 77, 76, _,  74, _, 71, _, 74, 76, 74, _,  72, _, 76, _, 81, 79, 76, _,  77, 76, 74, 72, 74, _, _, _] },
    forest: { bpm: 84, lead: 'sine', chords: [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]],
      melody: [69, _, 72, _, 76, _, 74, 72,  72, _, 69, _, 65, _, 67, 69,  67, _, 72, _, 76, _, 79, 76,  74, _, 71, _, 67, _, _, _] },
    desert: { bpm: 92, lead: 'triangle', chords: [[62, 65, 69], [60, 64, 67], [58, 62, 65], [57, 61, 64]],
      melody: [74, _, 73, 74, 77, _, 76, 74,  72, _, 74, 72, 70, _, 69, _,  70, _, 74, _, 77, 76, 74, 72,  73, _, 76, _, 73, _, 69, _] },
  };

  function init() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ac = new AC();
    master = ac.createGain(); master.gain.value = 0.8; master.connect(ac.destination);
    music = ac.createGain(); music.gain.value = opt.bgm ? 0.32 : 0; music.connect(master);
    sfx = ac.createGain(); sfx.gain.value = opt.sfx ? 0.55 : 0; sfx.connect(master);
    // 은은한 울림 (딜레이)
    const delay = ac.createDelay(); delay.delayTime.value = 0.3;
    const fb = ac.createGain(); fb.gain.value = 0.25;
    const wet = ac.createGain(); wet.gain.value = 0.22;
    music.connect(delay); delay.connect(fb); fb.connect(delay); delay.connect(wet); wet.connect(master);
    // 하이햇용 잡음
    noiseBuf = ac.createBuffer(1, ac.sampleRate * 0.2, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    nextTime = ac.currentTime + 0.1;
    setInterval(schedule, 50);
  }

  // 음 하나
  function tone(t, freq, dur, type, vol, dest, attack = 0.01, release = 0.25, cutoff) {
    const o = ac.createOscillator(); o.type = type; o.frequency.value = freq;
    const gn = ac.createGain();
    gn.gain.setValueAtTime(0.0001, t);
    gn.gain.linearRampToValueAtTime(vol, t + attack);
    gn.gain.exponentialRampToValueAtTime(0.0001, t + dur + release);
    let node = o;
    if (cutoff) { const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = cutoff; o.connect(f); node = f; }
    node.connect(gn); gn.connect(dest);
    o.start(t); o.stop(t + dur + release + 0.05);
  }

  function kick(t, vol) {
    const o = ac.createOscillator(), gn = ac.createGain();
    o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.15);
    gn.gain.setValueAtTime(vol, t); gn.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    o.connect(gn); gn.connect(music); o.start(t); o.stop(t + 0.25);
  }
  function hat(t, vol) {
    const s = ac.createBufferSource(); s.buffer = noiseBuf;
    const f = ac.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000;
    const gn = ac.createGain(); gn.gain.setValueAtTime(vol, t); gn.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    s.connect(f); f.connect(gn); gn.connect(music); s.start(t); s.stop(t + 0.06);
  }

  // 미리 0.3초 앞까지 음을 예약한다. 곡 바꾸기는 마디 처음에서.
  function schedule() {
    if (!ac) return;
    while (nextTime < ac.currentTime + 0.3) {
      if (step % 8 === 0 && (!cur || cur.theme !== want.theme || cur.mode !== want.mode)) cur = { ...want };
      const S = SONGS[cur.theme] || SONGS.meadow;
      const fight = cur.mode !== 'camp', boss = cur.mode === 'boss';
      const eighth = 60 / (S.bpm * (fight ? 1.12 : 1) * (boss ? 1.06 : 1)) / 2;
      const bar = Math.floor(step / 8) % 4, s8 = step % 8, t = nextTime;
      const chord = S.chords[bar];
      if (s8 === 0) chord.forEach(n => tone(t, midi(n), eighth * 7, 'triangle', 0.045, music, 0.3, 0.6, 1200));   // 화음 패드
      if (s8 === 0 || s8 === 4) tone(t, midi(chord[0] - 12), eighth * 3, 'sine', boss ? 0.22 : 0.16, music, 0.01, 0.2);   // 베이스
      if (s8 % 2 === 1) tone(t, midi(chord[(s8 >> 1) % 3] + 12), eighth * 0.6, 'sine', 0.03, music, 0.005, 0.12);      // 반짝이는 분산화음
      const m = S.melody[step % 32];
      if (m) tone(t, midi(m), eighth * 1.4, S.lead, 0.09, music, 0.01, cur.theme === 'forest' ? 0.5 : 0.25);
      if (fight) {
        if (s8 === 0 || s8 === 4) kick(t, boss ? 0.5 : 0.35);
        if (s8 % 2 === 1) hat(t, 0.08);
        if (boss && (s8 === 2 || s8 === 6)) kick(t, 0.25);
      }
      nextTime += eighth;
      step++;
    }
  }

  // ── 효과음 ──
  function click() {
    if (!ac || !opt.sfx) return;
    const t = ac.currentTime;
    tone(t, 880, 0.03, 'sine', 0.25, sfx, 0.002, 0.06);
    tone(t + 0.025, 1320, 0.03, 'sine', 0.18, sfx, 0.002, 0.06);
  }
  function coin() {
    if (!ac || !opt.sfx) return;
    const t = ac.currentTime;
    tone(t, midi(88), 0.05, 'square', 0.08, sfx, 0.002, 0.08);
    tone(t + 0.07, midi(93), 0.12, 'square', 0.08, sfx, 0.002, 0.2);
  }
  function win() {
    if (!ac || !opt.sfx) return;
    const t = ac.currentTime;
    [72, 76, 79, 84].forEach((n, i) => tone(t + i * 0.09, midi(n), 0.08, 'triangle', 0.22, sfx, 0.005, 0.25));
  }
  function lose() {
    if (!ac || !opt.sfx) return;
    const t = ac.currentTime;
    [67, 63, 60].forEach((n, i) => tone(t + i * 0.16, midi(n), 0.14, 'triangle', 0.2, sfx, 0.005, 0.3));
  }

  function setScene(theme, mode) { want = { theme, mode }; }

  function save() { try { localStorage.setItem(KEY, JSON.stringify(opt)); } catch (e) { /* 무시 */ } }
  function toggle(kind) {
    opt[kind] = !opt[kind];
    save();
    if (ac) {
      if (kind === 'bgm') music.gain.setTargetAtTime(opt.bgm ? 0.32 : 0, ac.currentTime, 0.1);
      else sfx.gain.value = opt.sfx ? 0.55 : 0;
    }
    return opt[kind];
  }

  // 첫 클릭(또는 키 입력)에 소리 시작, 버튼마다 클릭음
  document.addEventListener('pointerdown', e => {
    init();
    if (e.target.closest('button')) click();
  }, true);
  document.addEventListener('keydown', init, { once: true });

  return { setScene, click, coin, win, lose, toggle, get bgm() { return opt.bgm; }, get sfx() { return opt.sfx; } };
})();
