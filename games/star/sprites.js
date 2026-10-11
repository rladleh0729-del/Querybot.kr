// 별의 설화 — 캐릭터·몬스터·소품 그림 (부드러운 그림체, 코드로 그림)
// 배경(scenery.js)과 같은 스타일: 갈색 외곽선 + 그라데이션 + 하이라이트.
// 크기: 캐릭터·몬스터 96×96 (게임 안 32칸), 보스 192×192, 텐트 144×120.
// sprites/ 폴더에 같은 이름의 PNG(예: hero_m.png)를 넣으면 그 그림이 대신 쓰인다.
'use strict';

const TAU = Math.PI * 2;
const OUT = '#3b2626';            // 외곽선 색

// ── 그리기 도구 ─────────────────────────────────
function vs(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.lineJoin = 'round'; g.lineCap = 'round';
  draw(g);
  return c;
}

// 모양 하나: f()로 경로를 만들고 채운 뒤 외곽선
function shape(g, f, fill, lw = 2.5) {
  g.beginPath();
  f();
  if (fill) { g.fillStyle = fill; g.fill(); }
  if (lw) { g.lineWidth = lw; g.strokeStyle = OUT; g.stroke(); }
}
function oval(g, x, y, rx, ry, fill, lw = 2.5, rot = 0) { shape(g, () => g.ellipse(x, y, rx, ry, rot, 0, TAU), fill, lw); }
function lin(g, x0, y0, x1, y1, stops) { const gr = g.createLinearGradient(x0, y0, x1, y1); stops.forEach(([o, c]) => gr.addColorStop(o, c)); return gr; }
function rad(g, x, y, r, stops) { const gr = g.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.05, x, y, r); stops.forEach(([o, c]) => gr.addColorStop(o, c)); return gr; }
function shine(g, x, y, rx, ry, a = 0.75, rot = -0.5) { g.fillStyle = `rgba(255,255,255,${a})`; g.beginPath(); g.ellipse(x, y, rx, ry, rot, 0, TAU); g.fill(); }
function glowAt(g, x, y, r, rgba) { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, rgba); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); }

// 반짝이는 큰 눈
function eye(g, x, y, iris, s = 1) {
  g.fillStyle = '#2a1f3a';
  g.beginPath(); g.ellipse(x, y, 4.4 * s, 6 * s, 0, 0, TAU); g.fill();
  g.fillStyle = lin(g, 0, y - 5 * s, 0, y + 6 * s, [[0, '#2a1f3a'], [0.5, iris], [1, '#f4f8ff']]);
  g.beginPath(); g.ellipse(x, y + 0.8 * s, 3.3 * s, 4.6 * s, 0, 0, TAU); g.fill();
  g.fillStyle = '#ffffff';
  g.beginPath(); g.arc(x - 1.4 * s, y - 2.4 * s, 1.8 * s, 0, TAU); g.fill();
  g.beginPath(); g.arc(x + 1.5 * s, y + 2.2 * s, 0.9 * s, 0, TAU); g.fill();
}
function blush(g, x, y, s = 1) { g.fillStyle = 'rgba(255,120,140,0.35)'; g.beginPath(); g.ellipse(x, y, 4.5 * s, 2.6 * s, 0, 0, TAU); g.fill(); }
// 입 모양. MOOD 0 = 웃음, 1 = 일자, 2 = 거꾸로 (오래 플레이하면 바뀌는 이스터에그)
let MOOD = 0;
function smile(g, x, y, w = 4) {
  g.strokeStyle = OUT; g.lineWidth = 2; g.beginPath();
  if (MOOD === 0) g.arc(x, y - 2, w, 0.25 * Math.PI, 0.75 * Math.PI);
  else if (MOOD === 1) { g.moveTo(x - w * 0.7, y + 0.6); g.lineTo(x + w * 0.7, y + 0.6); }
  else g.arc(x, y + 4.5, w, 1.25 * Math.PI, 1.75 * Math.PI);
  g.stroke();
}

function star(g, x, y, r, fill) {
  shape(g, () => {
    for (let i = 0; i < 10; i++) {
      const rr = i % 2 ? r * 0.45 : r, a = -Math.PI / 2 + i * Math.PI / 5;
      i ? g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr) : g.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    g.closePath();
  }, fill, 1.5);
}

// ── 2등신 캐릭터 (오른쪽을 봄) ──────────────────────
// o: 색과 꾸밈 (backHair, hair, hat, outfit, front 함수로 부분을 그림)
function chibi(o) {
  return vs(96, 96, g => {
    if (o.backHair) o.backHair(g);
    // 다리와 신발
    shape(g, () => g.roundRect(37, 70, 9, 14, 4), o.legs);
    shape(g, () => g.roundRect(50, 70, 9, 14, 4), o.legs);
    oval(g, 41, 86, 7, 4, o.boots); oval(g, 56, 86, 7, 4, o.boots);
    // 뒷팔
    oval(g, 32, 63, 5, 8.5, o.sleeveD, 2.5, 0.35);
    // 몸통
    shape(g, () => {
      g.moveTo(35, 52); g.quadraticCurveTo(30, 70, 32, 79); g.lineTo(64, 79); g.quadraticCurveTo(66, 70, 61, 52); g.quadraticCurveTo(48, 47, 35, 52);
    }, lin(g, 0, 50, 0, 80, [[0, o.body], [1, o.bodyD]]));
    if (o.outfit) o.outfit(g);
    // 얼굴
    if (o.ear) oval(g, 26, 36, 3.5, 8, o.skin, 2.5, -0.9);
    oval(g, 48, 32, 25, 23, rad(g, 50, 34, 28, [[0, '#fff3e6'], [1, o.skin || '#ffd6b8']]));
    if (o.hair) o.hair(g);
    eye(g, 46, 37, o.iris); eye(g, 60, 37, o.iris);
    blush(g, 41, 46); blush(g, 66, 46);
    smile(g, 55, 49, 3.2);
    if (o.hat) o.hat(g);
    if (o.front) o.front(g);
  });
}

// 검 (오른손)
function sword(g) {
  g.save();
  g.translate(69, 66); g.rotate(-0.22);
  shape(g, () => g.roundRect(-2.5, 0, 5, 11, 2), '#7a4a2a', 2);
  shape(g, () => g.roundRect(-9, -3.5, 18, 5, 2.5), lin(g, -9, 0, 9, 0, [[0, '#f6d36a'], [1, '#c8902a']]), 2);
  shape(g, () => { g.moveTo(-3.5, -4); g.lineTo(-3.5, -36); g.lineTo(0, -43); g.lineTo(3.5, -36); g.lineTo(3.5, -4); g.closePath(); },
    lin(g, -4, 0, 4, 0, [[0, '#ffffff'], [0.5, '#dfe7f4'], [1, '#9aa8c0']]), 2);
  g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(-1.2, -8); g.lineTo(-1.2, -34); g.stroke();
  g.restore();
  oval(g, 67, 66, 4.6, 4.6, '#ffd6b8', 2);     // 손
}

// 지팡이 (오른손). top: 꼭대기 장식
function staff(g, color, top) {
  shape(g, () => g.roundRect(68, 18, 4.5, 72, 2), color, 2);
  top(g);
  oval(g, 69, 64, 4.6, 4.6, '#ffd6b8', 2);
}

function bangs(c1, c2, side = true) {
  return g => {
    const hc = lin(g, 0, 8, 0, 36, [[0, c1], [1, c2]]);
    shape(g, () => {
      g.moveTo(23, 32); g.quadraticCurveTo(20, 6, 48, 7); g.quadraticCurveTo(76, 7, 73, 32);
      g.lineTo(68, 24); g.lineTo(64, 31); g.lineTo(58, 22); g.lineTo(52, 30); g.lineTo(46, 21); g.lineTo(40, 30); g.lineTo(34, 22); g.lineTo(28, 33); g.closePath();
    }, hc, 2.5);
    if (side) shape(g, () => { g.moveTo(24, 26); g.quadraticCurveTo(19, 40, 25, 50); g.lineTo(30, 34); g.closePath(); }, hc, 2.5);
    shine(g, 42, 13, 9, 3, 0.4, -0.15);
  };
}

// ── 주인공: 소년 (깃털 꽂은 모험가 모자) ──
function drawBoy() {
  return chibi({
    iris: '#3a7ad0', legs: '#4a3b5a', boots: '#6b3e22',
    body: '#4f8fe0', bodyD: '#2c5ea3', sleeveD: '#2c5ea3',
    outfit: g => {
      // 빨간 스카프
      shape(g, () => { g.moveTo(36, 55); g.quadraticCurveTo(28, 62, 26, 70); g.lineTo(32, 69); g.quadraticCurveTo(36, 62, 40, 57); g.closePath(); }, '#c03a36', 2);
      shape(g, () => { g.moveTo(34, 51); g.quadraticCurveTo(48, 58, 62, 51); g.lineTo(62, 56); g.quadraticCurveTo(48, 63, 34, 56); g.closePath(); }, '#e0504a', 2);
      // 허리띠
      shape(g, () => g.roundRect(33, 70, 30, 5, 2), '#6b4a2b', 2);
      shape(g, () => g.roundRect(45, 69, 7, 7, 2), '#f0c95a', 1.5);
    },
    hair: g => {
      // 모자 밑으로 삐져나온 갈색 머리
      const hc = lin(g, 0, 16, 0, 40, [[0, '#a8683a'], [1, '#6b3e22']]);
      shape(g, () => {
        g.moveTo(24, 26); g.lineTo(27, 38); g.lineTo(31, 29); g.lineTo(36, 35); g.lineTo(40, 26); g.lineTo(46, 32); g.lineTo(52, 24);
        g.lineTo(58, 30); g.lineTo(64, 23); g.lineTo(70, 30); g.lineTo(72, 20); g.quadraticCurveTo(48, 12, 24, 20); g.closePath();
      }, hc, 2.5);
      shape(g, () => { g.moveTo(24, 24); g.quadraticCurveTo(19, 36, 25, 46); g.lineTo(29, 34); g.closePath(); }, hc, 2.5);
    },
    hat: g => {
      // 챙
      oval(g, 48, 20, 31, 6.5, lin(g, 0, 14, 0, 27, [[0, '#9a6438'], [1, '#6b4022']]), 2.5, -0.05);
      // 모자 머리 부분
      shape(g, () => { g.moveTo(26, 19); g.quadraticCurveTo(26, 1, 50, 1); g.quadraticCurveTo(70, 1, 70, 18); g.quadraticCurveTo(48, 24, 26, 19); },
        lin(g, 0, 0, 0, 22, [[0, '#b07a48'], [1, '#7a4a2a']]), 2.5);
      // 띠와 별 배지
      shape(g, () => { g.moveTo(27, 14); g.quadraticCurveTo(48, 19, 69, 13); g.lineTo(70, 18); g.quadraticCurveTo(48, 24, 26, 19); g.closePath(); }, '#d0443c', 2);
      star(g, 60, 15, 5, '#ffe27a');
      shine(g, 40, 6, 8, 3, 0.35, -0.2);
      // 깃털
      shape(g, () => { g.moveTo(30, 15); g.quadraticCurveTo(14, 9, 11, 3); g.quadraticCurveTo(24, 4, 33, 12); g.closePath(); }, lin(g, 12, 0, 32, 16, [[0, '#ffffff'], [1, '#6fd0a0']]), 2);
    },
    front: sword,
  });
}

// ── 주인공: 소녀 (긴 머리와 리본) ──
function longHair(c1, c2) {
  return g => shape(g, () => {
    g.moveTo(26, 22); g.quadraticCurveTo(16, 46, 22, 70); g.quadraticCurveTo(30, 76, 36, 70); g.lineTo(36, 40);
    g.lineTo(62, 40); g.lineTo(64, 66); g.quadraticCurveTo(72, 70, 76, 62); g.quadraticCurveTo(80, 40, 70, 20); g.closePath();
  }, lin(g, 0, 20, 0, 76, [[0, c1], [1, c2]]), 2.5);
}

function drawGirl() {
  return chibi({
    iris: '#c0507a', legs: '#ffdcc2', boots: '#8a3a52',
    body: '#ff8ab4', bodyD: '#d0558a', sleeveD: '#d0558a',
    backHair: longHair('#a8603e', '#6b3a26'),
    outfit: g => {
      // 치마
      shape(g, () => { g.moveTo(32, 66); g.quadraticCurveTo(26, 80, 24, 82); g.quadraticCurveTo(48, 88, 72, 82); g.quadraticCurveTo(70, 78, 64, 66); g.closePath(); },
        lin(g, 0, 66, 0, 84, [[0, '#ff9ac0'], [1, '#d0558a']]), 2.5);
      g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.moveTo(27, 79); g.quadraticCurveTo(48, 85, 69, 79); g.stroke();
      // 흰 옷깃과 리본
      shape(g, () => { g.moveTo(37, 51); g.quadraticCurveTo(48, 60, 59, 51); g.quadraticCurveTo(48, 55, 37, 51); }, '#ffffff', 2);
      shape(g, () => { g.moveTo(44, 56); g.lineTo(48, 59); g.lineTo(52, 56); g.lineTo(52, 62); g.lineTo(48, 59); g.lineTo(44, 62); g.closePath(); }, '#e0405a', 1.5);
    },
    hair: bangs('#b8704a', '#7a4430'),
    hat: g => {
      // 빨간 리본
      shape(g, () => { g.moveTo(30, 12); g.quadraticCurveTo(16, 2, 18, 16); g.quadraticCurveTo(22, 22, 30, 14); }, '#e0405a', 2);
      shape(g, () => { g.moveTo(32, 12); g.quadraticCurveTo(40, -2, 44, 10); g.quadraticCurveTo(42, 18, 32, 14); }, '#e0405a', 2);
      oval(g, 31, 13, 3.5, 3.5, '#b02a3a', 2);
    },
    // 공중 캐스팅용 별 지팡이
    front: g => staff(g, '#c87aa0', g => { glowAt(g, 70, 13, 18, 'rgba(255,160,215,0.75)'); star(g, 70, 13, 10, '#ffc8e6'); oval(g, 70, 13, 3, 3, '#ffffff', 0); }),
  });
}

// ── 동료: 미르 (치유형 약초사, 소녀) ──
function drawMiru() {
  return chibi({
    iris: '#2a9a7a', legs: '#ffdcc2', boots: '#6b4a2b',
    body: '#5fb06a', bodyD: '#3d7a47', sleeveD: '#3d7a47',
    backHair: g => {
      // 초록 후드 (머리 뒤)
      shape(g, () => { g.moveTo(22, 30); g.quadraticCurveTo(18, 56, 30, 58); g.lineTo(66, 58); g.quadraticCurveTo(80, 50, 74, 26); g.quadraticCurveTo(48, 0, 22, 30); },
        lin(g, 0, 10, 0, 60, [[0, '#6fbf72'], [1, '#3d7a47']]), 2.5);
    },
    outfit: g => {
      // 앞치마와 약초 주머니
      shape(g, () => g.roundRect(39, 57, 18, 20, 5), '#f6ecd2', 2);
      oval(g, 48, 70, 4, 3.5, '#e0405a', 1.5);
    },
    hair: g => {
      bangs('#5ad0c0', '#2a9a8a')(g);
      const hc = lin(g, 0, 20, 0, 50, [[0, '#5ad0c0'], [1, '#2a9a8a']]);
      shape(g, () => { g.moveTo(70, 24); g.quadraticCurveTo(78, 40, 72, 50); g.lineTo(66, 36); g.closePath(); }, hc, 2.5);
      // 꽃핀
      for (let i = 0; i < 5; i++) { const a = i * TAU / 5; oval(g, 31 + Math.cos(a) * 4, 15 + Math.sin(a) * 4, 3, 3, '#ff9ac0', 1.5); }
      oval(g, 31, 15, 2.2, 2.2, '#ffd25e', 1);
    },
    front: g => staff(g, '#9a6a3a', g => {
      oval(g, 64, 16, 7, 4, '#7ad070', 2, -0.6); oval(g, 78, 15, 7, 4, '#7ad070', 2, 0.6); oval(g, 71, 9, 4, 7, '#9ae890', 2);
    }),
  });
}

// ── 동료: 세린 (마법형 반요정, 소년) ──
function drawSerin() {
  return chibi({
    iris: '#7a5ad0', legs: '#3a2a5a', boots: '#2a1a40', skin: '#ffdcc8', ear: true,
    body: '#7a5ad0', bodyD: '#40288a', sleeveD: '#40288a',
    outfit: g => {
      // 무릎까지 오는 로브와 금색 테두리
      shape(g, () => { g.moveTo(32, 64); g.lineTo(28, 84); g.quadraticCurveTo(48, 89, 68, 84); g.lineTo(64, 64); g.closePath(); },
        lin(g, 0, 64, 0, 86, [[0, '#6a4ac0'], [1, '#40288a']]), 2.5);
      g.strokeStyle = '#f0c95a'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(29, 82); g.quadraticCurveTo(48, 87, 67, 82); g.stroke();
      g.lineWidth = 2; g.beginPath(); g.moveTo(48, 54); g.lineTo(48, 84); g.stroke();
    },
    hair: bangs('#eae4ff', '#a8a0d8'),
    hat: g => {
      // 뾰족한 마법사 모자
      oval(g, 46, 16, 30, 6, lin(g, 0, 10, 0, 22, [[0, '#6a4ac0'], [1, '#40288a']]), 2.5, -0.08);
      shape(g, () => { g.moveTo(28, 15); g.quadraticCurveTo(40, -2, 70, -3); g.quadraticCurveTo(58, 4, 64, 14); g.quadraticCurveTo(46, 19, 28, 15); },
        lin(g, 30, -8, 60, 16, [[0, '#8a6ae0'], [1, '#4a30a0']]), 2.5);
      shape(g, () => { g.moveTo(30, 12); g.quadraticCurveTo(46, 16, 63, 11); g.lineTo(64, 15); g.quadraticCurveTo(46, 20, 29, 16); g.closePath(); }, '#f0c95a', 2);
      star(g, 54, 8, 4, '#ffe27a');
    },
    front: g => staff(g, '#8a6aa0', g => {
      glowAt(g, 70, 14, 16, 'rgba(140,220,255,0.7)');
      oval(g, 70, 14, 7, 7, rad(g, 70, 14, 8, [[0, '#ffffff'], [0.5, '#9adcff'], [1, '#3a8ad0']]), 2);
    }),
  });
}

// ── 몬스터 공용 ──────────────────────────────────
// 말랑한 몸 (슬라임): s = 크기 배율
function slimeBody(g, s, c1, c2, c3) {
  g.save(); g.scale(s, s);
  shape(g, () => { g.moveTo(14, 86); g.bezierCurveTo(9, 52, 28, 32, 49, 32); g.bezierCurveTo(72, 32, 89, 52, 84, 86); g.quadraticCurveTo(49, 92, 14, 86); },
    lin(g, 0, 32, 0, 90, [[0, c1], [0.6, c2], [1, c3]]), 3 / s);
  shine(g, 33, 46, 10, 5, 0.75); shine(g, 25, 57, 3, 2, 0.6);
  g.restore();
}

// ── 챕터 1 몬스터 (왼쪽을 봄) ──
function drawSlime() {
  return vs(96, 96, g => {
    slimeBody(g, 1, '#a8f088', '#5cc65a', '#3a9448');
    eye(g, 34, 62, '#1d4a2a', 0.9); eye(g, 50, 62, '#1d4a2a', 0.9);
    blush(g, 27, 71, 0.8); blush(g, 57, 71, 0.8);
    smile(g, 42, 75, 3);
    // 머리 위 풀잎
    g.strokeStyle = OUT; g.lineWidth = 2.5; g.beginPath(); g.moveTo(52, 33); g.quadraticCurveTo(54, 26, 52, 20); g.stroke();
    oval(g, 46, 20, 7, 3.5, '#6fd070', 2, -0.5); oval(g, 59, 19, 7, 3.5, '#6fd070', 2, 0.5);
  });
}

function capMushroom(g, c1, c2, spot) {
  shape(g, () => { g.moveTo(7, 54); g.bezierCurveTo(6, 22, 30, 8, 48, 8); g.bezierCurveTo(68, 8, 92, 22, 89, 54); g.quadraticCurveTo(80, 60, 70, 55); g.quadraticCurveTo(48, 62, 26, 55); g.quadraticCurveTo(16, 60, 7, 54); },
    lin(g, 0, 8, 0, 60, [[0, c1], [1, c2]]), 3);
  [[26, 30, 6, 5], [52, 20, 8, 6], [72, 34, 6, 5], [42, 42, 5, 4]].forEach(([x, y, rx, ry]) => oval(g, x, y, rx, ry, spot, 1.5));
  shine(g, 34, 20, 10, 4, 0.4, -0.3);
}

function drawMushroom() {
  return vs(96, 96, g => {
    oval(g, 36, 88, 8, 4, '#8a5a3a'); oval(g, 60, 88, 8, 4, '#8a5a3a');
    shape(g, () => g.roundRect(28, 48, 40, 40, 14), lin(g, 0, 48, 0, 88, [[0, '#fff6e6'], [1, '#e8d2b0']]));
    eye(g, 40, 66, '#5a2a1a', 0.8); eye(g, 54, 66, '#5a2a1a', 0.8);
    blush(g, 34, 74, 0.7); blush(g, 60, 74, 0.7);
    smile(g, 47, 79, 2.6);
    capMushroom(g, '#ff7a6a', '#d8443c', '#fff6ee');
    // 머리 위 작은 꽃
    for (let i = 0; i < 5; i++) { const a = i * TAU / 5; oval(g, 50 + Math.cos(a) * 4, 6 + Math.sin(a) * 4, 3, 3, '#ffe27a', 1.5); }
    oval(g, 50, 6, 2.4, 2.4, '#ff9a3a', 1);
  });
}

function drawBee() {
  return vs(96, 96, g => {
    g.globalAlpha = 0.75;
    oval(g, 54, 28, 11, 17, 'rgba(220,240,255,0.9)', 2, -0.4); oval(g, 70, 32, 9, 14, 'rgba(200,230,255,0.9)', 2, 0.3);
    g.globalAlpha = 1;
    shape(g, () => { g.moveTo(82, 56); g.lineTo(94, 60); g.lineTo(82, 64); g.closePath(); }, '#3a2a2a', 2);
    oval(g, 58, 60, 26, 20, lin(g, 0, 40, 0, 80, [[0, '#ffe680'], [1, '#e8a820']]), 3);
    g.save(); g.beginPath(); g.ellipse(58, 60, 25, 19, 0, 0, TAU); g.clip();
    g.fillStyle = '#3a2a2a'; g.fillRect(50, 38, 7, 44); g.fillRect(66, 38, 7, 44);
    g.restore();
    oval(g, 58, 60, 26, 20, null, 3);
    shine(g, 50, 48, 8, 3, 0.5, -0.2);
    oval(g, 30, 56, 18, 17, lin(g, 0, 40, 0, 74, [[0, '#ffe680'], [1, '#e8a820']]), 3);
    eye(g, 24, 55, '#3a2a1a', 0.85); eye(g, 37, 55, '#3a2a1a', 0.85);
    blush(g, 20, 64, 0.7); smile(g, 31, 67, 2.4);
    g.strokeStyle = OUT; g.lineWidth = 2;
    g.beginPath(); g.moveTo(26, 41); g.quadraticCurveTo(20, 30, 16, 28); g.moveTo(34, 40); g.quadraticCurveTo(36, 28, 40, 26); g.stroke();
    oval(g, 16, 28, 3, 3, '#3a2a2a', 0); oval(g, 40, 26, 3, 3, '#3a2a2a', 0);
    oval(g, 50, 82, 3, 5, '#3a2a2a', 0); oval(g, 64, 82, 3, 5, '#3a2a2a', 0);
  });
}

// ── 챕터 2 몬스터 ──
function drawWisp() {
  return vs(96, 96, g => {
    glowAt(g, 44, 56, 42, 'rgba(180,255,210,0.55)');
    g.globalAlpha = 0.75;
    oval(g, 64, 38, 10, 16, 'rgba(210,255,250,0.9)', 2, 0.5); oval(g, 72, 54, 8, 13, 'rgba(190,245,245,0.9)', 2, 1.0);
    g.globalAlpha = 1;
    oval(g, 44, 58, 22, 22, rad(g, 44, 58, 24, [[0, '#ffffff'], [0.45, '#c8ffd8'], [1, '#6ad890']]), 3);
    eye(g, 37, 58, '#1a7a6a', 0.85); eye(g, 51, 58, '#1a7a6a', 0.85);
    blush(g, 31, 67, 0.7); blush(g, 56, 67, 0.7); smile(g, 44, 71, 2.6);
    // 잎사귀 모자
    shape(g, () => { g.moveTo(28, 40); g.quadraticCurveTo(44, 22, 62, 36); g.quadraticCurveTo(46, 44, 28, 40); }, lin(g, 0, 24, 0, 44, [[0, '#8ae070'], [1, '#3f9a48']]), 2.5);
    g.strokeStyle = OUT; g.lineWidth = 2; g.beginPath(); g.moveTo(45, 30); g.lineTo(46, 22); g.stroke();
    [[20, 80, 2.5], [68, 76, 2], [14, 46, 1.8]].forEach(([x, y, r]) => glowAt(g, x, y, r * 4, 'rgba(230,255,240,0.9)'));
  });
}

function drawToadstool() {
  return vs(96, 96, g => {
    oval(g, 36, 88, 8, 4, '#5a3a50'); oval(g, 60, 88, 8, 4, '#5a3a50');
    shape(g, () => g.roundRect(28, 48, 40, 40, 14), lin(g, 0, 48, 0, 88, [[0, '#f4ecf6'], [1, '#d8c8dc']]));
    eye(g, 40, 67, '#5a1a4a', 0.8); eye(g, 54, 67, '#5a1a4a', 0.8);
    g.strokeStyle = OUT; g.lineWidth = 2.5;
    g.beginPath(); g.moveTo(34, 58); g.lineTo(44, 61); g.moveTo(60, 58); g.lineTo(50, 61); g.stroke();   // 화난 눈썹
    g.beginPath(); g.moveTo(43, 80); g.quadraticCurveTo(47, 76, 51, 80); g.stroke();
    capMushroom(g, '#b070e0', '#6a2aa0', '#e0ff80');
    oval(g, 20, 60, 2.5, 4, '#c890f0', 1.5); oval(g, 78, 61, 2.5, 5, '#c890f0', 1.5);           // 독 방울
  });
}

function drawSprout() {
  return vs(96, 96, g => {
    oval(g, 30, 88, 9, 4, '#5a3820'); oval(g, 66, 88, 9, 4, '#5a3820');
    shape(g, () => g.roundRect(24, 40, 48, 48, 12), lin(g, 24, 0, 72, 0, [[0, '#6b4428'], [0.5, '#a8703e'], [1, '#6b4428']]));
    g.strokeStyle = 'rgba(60,36,20,0.5)'; g.lineWidth = 2;
    [[34, 52, 34, 80], [62, 50, 62, 78], [48, 74, 48, 86]].forEach(([a, b, c, d]) => { g.beginPath(); g.moveTo(a, b); g.lineTo(c, d); g.stroke(); });
    oval(g, 48, 41, 24, 7, lin(g, 0, 34, 0, 48, [[0, '#f0c890'], [1, '#c89a5a']]), 2.5);
    g.strokeStyle = 'rgba(140,90,40,0.6)'; g.lineWidth = 1.5;
    g.beginPath(); g.ellipse(48, 41, 14, 4, 0, 0, TAU); g.stroke();
    g.beginPath(); g.ellipse(48, 41, 6, 2, 0, 0, TAU); g.stroke();
    glowAt(g, 38, 60, 9, 'rgba(255,230,120,0.8)'); glowAt(g, 56, 60, 9, 'rgba(255,230,120,0.8)');
    oval(g, 38, 60, 4, 5, '#ffe27a', 2); oval(g, 56, 60, 4, 5, '#ffe27a', 2);
    g.strokeStyle = OUT; g.lineWidth = 2.5; g.beginPath(); g.moveTo(40, 73); g.lineTo(54, 73); g.stroke();
    g.beginPath(); g.moveTo(48, 36); g.quadraticCurveTo(50, 24, 48, 14); g.stroke();
    oval(g, 40, 18, 8, 4, '#7ad070', 2, -0.5); oval(g, 57, 16, 8, 4, '#7ad070', 2, 0.5);
    oval(g, 30, 50, 5, 4, '#6fbf5a', 1.5); oval(g, 64, 80, 5, 3, '#6fbf5a', 1.5);
  });
}

// ── 보스 (192×192) ──
function drawSlimeKing() {
  return vs(192, 192, g => {
    slimeBody(g, 2, '#a8f088', '#4cb84e', '#2e7a3c');
    // 몸속 별조각
    glowAt(g, 128, 130, 26, 'rgba(210,245,255,0.8)');
    shape(g, () => { g.moveTo(122, 142); g.lineTo(124, 120); g.lineTo(130, 112); g.lineTo(136, 126); g.lineTo(133, 142); g.closePath(); }, '#e0f8ff', 2);
    eye(g, 68, 122, '#1d4a2a', 1.8); eye(g, 102, 122, '#1d4a2a', 1.8);
    g.strokeStyle = OUT; g.lineWidth = 5;
    g.beginPath(); g.moveTo(54, 100); g.lineTo(78, 108); g.moveTo(116, 100); g.lineTo(92, 108); g.stroke();
    shape(g, () => { g.moveTo(68, 150); g.quadraticCurveTo(85, 160, 102, 150); g.quadraticCurveTo(85, 156, 68, 150); }, '#2a5a32', 3);
    shape(g, () => { g.moveTo(74, 152); g.lineTo(78, 160); g.lineTo(82, 153); g.closePath(); }, '#ffffff', 2);
    shape(g, () => { g.moveTo(90, 153); g.lineTo(94, 160); g.lineTo(98, 152); g.closePath(); }, '#ffffff', 2);
    // 왕관
    shape(g, () => { g.moveTo(56, 70); g.lineTo(52, 34); g.lineTo(70, 50); g.lineTo(86, 24); g.lineTo(102, 50); g.lineTo(120, 34); g.lineTo(116, 70); g.quadraticCurveTo(86, 78, 56, 70); },
      lin(g, 0, 24, 0, 74, [[0, '#fff0a0'], [0.5, '#f0c040'], [1, '#c08a20']]), 3);
    oval(g, 70, 62, 5, 5, '#e0405a', 2); oval(g, 86, 63, 6, 6, '#7ad0ff', 2); oval(g, 102, 62, 5, 5, '#e0405a', 2);
    [[52, 34], [86, 24], [120, 34]].forEach(([x, y]) => oval(g, x, y, 4, 4, '#fff6c0', 2));
    shine(g, 66, 46, 6, 3, 0.6, -0.4);
  });
}

function drawTreant() {
  return vs(192, 192, g => {
    // 뿌리 다리
    [[46, 176, 22], [146, 176, 22], [96, 182, 16]].forEach(([x, y, r]) => oval(g, x, y, r, 9, '#5a3820', 3));
    // 나뭇가지 팔
    shape(g, () => { g.moveTo(60, 96); g.quadraticCurveTo(26, 90, 14, 64); g.lineTo(24, 60); g.quadraticCurveTo(36, 80, 62, 84); g.closePath(); }, '#6b4428', 3);
    shape(g, () => { g.moveTo(132, 100); g.quadraticCurveTo(166, 96, 178, 70); g.lineTo(168, 66); g.quadraticCurveTo(156, 86, 130, 88); g.closePath(); }, '#6b4428', 3);
    oval(g, 16, 58, 14, 10, '#5aaa52', 3); oval(g, 176, 64, 14, 10, '#5aaa52', 3);
    // 줄기 몸
    shape(g, () => { g.moveTo(52, 176); g.quadraticCurveTo(46, 120, 58, 70); g.lineTo(134, 70); g.quadraticCurveTo(148, 120, 140, 176); g.quadraticCurveTo(96, 186, 52, 176); },
      lin(g, 50, 0, 142, 0, [[0, '#5a3820'], [0.45, '#9a6a40'], [1, '#4a2e18']]), 3.5);
    g.strokeStyle = 'rgba(50,30,15,0.45)'; g.lineWidth = 3;
    [[70, 90, 66, 168], [92, 140, 90, 176], [122, 86, 126, 166]].forEach(([a, b, c, d]) => { g.beginPath(); g.moveTo(a, b); g.quadraticCurveTo(a + 6, (b + d) / 2, c, d); g.stroke(); });
    // 얼굴
    oval(g, 76, 104, 13, 10, '#2a1a10', 3); oval(g, 116, 104, 13, 10, '#2a1a10', 3);
    glowAt(g, 76, 104, 16, 'rgba(255,230,120,0.7)'); glowAt(g, 116, 104, 16, 'rgba(255,230,120,0.7)');
    oval(g, 76, 104, 6, 5, '#ffe27a', 0); oval(g, 116, 104, 6, 5, '#ffe27a', 0);
    g.strokeStyle = OUT; g.lineWidth = 6;
    g.beginPath(); g.moveTo(60, 88); g.lineTo(90, 96); g.moveTo(132, 88); g.lineTo(102, 96); g.stroke();
    shape(g, () => { g.moveTo(74, 136); g.quadraticCurveTo(96, 128, 118, 136); g.quadraticCurveTo(96, 150, 74, 136); }, '#2a1a10', 3);
    // 이끼와 가슴의 별조각
    oval(g, 64, 76, 12, 6, '#6fbf5a', 2); oval(g, 128, 160, 10, 5, '#6fbf5a', 2);
    glowAt(g, 132, 124, 22, 'rgba(200,240,255,0.8)');
    shape(g, () => { g.moveTo(126, 134); g.lineTo(128, 116); g.lineTo(134, 110); g.lineTo(139, 122); g.lineTo(136, 134); g.closePath(); }, '#e0f8ff', 2);
    // 잎 왕관
    [[60, 52, 30], [96, 36, 36], [134, 52, 30], [78, 26, 20], [116, 26, 20]].forEach(([x, y, r]) => oval(g, x, y, r, r * 0.8, lin(g, 0, y - r, 0, y + r, [[0, '#8ad070'], [1, '#3f8a44']]), 3));
    shine(g, 84, 22, 12, 5, 0.35, -0.2);
    oval(g, 46, 46, 5, 5, '#ff9ac0', 2); oval(g, 146, 40, 5, 5, '#ff9ac0', 2);
  });
}

// ── 동료: 카이 (사격형 보물 사냥꾼, 소년) ──
function drawKai() {
  return chibi({
    iris: '#c8701a', legs: '#6b5a3a', boots: '#5a3820',
    body: '#d8a868', bodyD: '#9a6a38', sleeveD: '#8a5a30',
    outfit: g => {
      // 가죽 조끼와 멜빵 가방끈
      shape(g, () => { g.moveTo(36, 54); g.lineTo(40, 78); g.lineTo(46, 78); g.lineTo(44, 55); g.closePath(); }, '#7a4a2a', 2);
      shape(g, () => { g.moveTo(60, 54); g.lineTo(56, 78); g.lineTo(50, 78); g.lineTo(52, 55); g.closePath(); }, '#7a4a2a', 2);
      g.strokeStyle = '#5a3418'; g.lineWidth = 3; g.beginPath(); g.moveTo(38, 54); g.lineTo(62, 76); g.stroke();
      shape(g, () => g.roundRect(33, 70, 30, 5, 2), '#5a3418', 2);
    },
    hair: g => {
      const hc = lin(g, 0, 8, 0, 36, [[0, '#3a2a22'], [1, '#1e1410']]);
      shape(g, () => {
        g.moveTo(23, 32); g.quadraticCurveTo(20, 6, 48, 7); g.quadraticCurveTo(76, 7, 73, 30);
        g.lineTo(69, 23); g.lineTo(63, 29); g.lineTo(58, 21); g.lineTo(51, 28); g.lineTo(45, 20); g.lineTo(39, 28); g.lineTo(33, 21); g.lineTo(28, 31); g.closePath();
      }, hc, 2.5);
    },
    hat: g => {
      // 주황 두건과 고글
      shape(g, () => { g.moveTo(24, 20); g.quadraticCurveTo(48, 4, 72, 18); g.lineTo(72, 24); g.quadraticCurveTo(48, 12, 24, 26); g.closePath(); }, lin(g, 0, 6, 0, 26, [[0, '#ff9a4a'], [1, '#d0602a']]), 2.5);
      shape(g, () => { g.moveTo(25, 22); g.quadraticCurveTo(14, 26, 12, 36); g.lineTo(18, 34); g.quadraticCurveTo(22, 28, 28, 25); g.closePath(); }, '#d0602a', 2);
      oval(g, 44, 16, 6, 5, rad(g, 44, 16, 6, [[0, '#e0f8ff'], [1, '#5ab0d0']]), 2.5);
      oval(g, 57, 15, 6, 5, rad(g, 57, 15, 6, [[0, '#e0f8ff'], [1, '#5ab0d0']]), 2.5);
    },
    front: g => {
      // 석궁
      shape(g, () => g.roundRect(60, 58, 24, 6, 2), '#8a5a34', 2);
      g.strokeStyle = OUT; g.lineWidth = 3; g.beginPath(); g.moveTo(80, 48); g.quadraticCurveTo(88, 61, 80, 74); g.stroke();
      g.strokeStyle = '#e8e0d0'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(80, 48); g.lineTo(70, 61); g.lineTo(80, 74); g.stroke();
      shape(g, () => { g.moveTo(82, 59); g.lineTo(92, 61); g.lineTo(82, 63); g.closePath(); }, '#c8d0dc', 1.5);
      oval(g, 64, 64, 4.6, 4.6, '#ffd6b8', 2);
    },
  });
}

// ── 챕터 3 몬스터 (왼쪽을 봄) ──
function drawCactus() {
  return vs(96, 96, g => {
    oval(g, 38, 88, 8, 4, '#8a6a3a'); oval(g, 58, 88, 8, 4, '#8a6a3a');
    // 팔
    shape(g, () => g.roundRect(14, 44, 14, 26, 7), lin(g, 0, 40, 0, 70, [[0, '#7ad070'], [1, '#3f9a48']]));
    shape(g, () => g.roundRect(68, 36, 14, 24, 7), lin(g, 0, 36, 0, 60, [[0, '#7ad070'], [1, '#3f9a48']]));
    shape(g, () => g.roundRect(24, 60, 10, 9, 4), '#5aaa52'); shape(g, () => g.roundRect(62, 52, 10, 9, 4), '#5aaa52');
    // 몸통
    shape(g, () => g.roundRect(30, 22, 36, 66, 18), lin(g, 30, 0, 66, 0, [[0, '#5aaa52'], [0.45, '#8ae070'], [1, '#3f8a44']]));
    g.strokeStyle = 'rgba(40,90,40,0.5)'; g.lineWidth = 2;
    [40, 48, 56].forEach(x => { g.beginPath(); g.moveTo(x, 28); g.lineTo(x, 84); g.stroke(); });
    // 가시
    g.strokeStyle = '#fff6d0'; g.lineWidth = 1.5;
    [[30, 40], [30, 66], [66, 34], [66, 60], [20, 48], [76, 42]].forEach(([x, y]) => { g.beginPath(); g.moveTo(x, y); g.lineTo(x + (x < 48 ? -5 : 5), y - 3); g.stroke(); });
    // 얼굴과 머리띠
    shape(g, () => g.roundRect(30, 38, 36, 6, 3), '#d0443c', 2);
    eye(g, 40, 54, '#2a4a1a', 0.85); eye(g, 54, 54, '#2a4a1a', 0.85);
    g.strokeStyle = OUT; g.lineWidth = 2.5; g.beginPath(); g.moveTo(35, 46); g.lineTo(44, 48); g.moveTo(59, 46); g.lineTo(50, 48); g.stroke();
    g.beginPath(); g.moveTo(43, 66); g.lineTo(51, 66); g.stroke();
    // 머리 위 꽃
    for (let i = 0; i < 5; i++) { const a = i * TAU / 5; oval(g, 48 + Math.cos(a) * 4, 20 + Math.sin(a) * 4, 3, 3, '#ff7ab0', 1.5); }
    oval(g, 48, 20, 2.2, 2.2, '#ffe27a', 1);
  });
}

function drawScorpion() {
  return vs(96, 96, g => {
    // 꼬리 (등 위로 휘어짐)
    g.lineCap = 'round';
    g.strokeStyle = OUT; g.lineWidth = 13; g.beginPath(); g.moveTo(66, 70); g.quadraticCurveTo(88, 52, 76, 28); g.quadraticCurveTo(68, 18, 58, 24); g.stroke();
    g.strokeStyle = '#d8843a'; g.lineWidth = 8; g.beginPath(); g.moveTo(66, 70); g.quadraticCurveTo(88, 52, 76, 28); g.quadraticCurveTo(68, 18, 58, 24); g.stroke();
    shape(g, () => { g.moveTo(58, 20); g.lineTo(48, 26); g.lineTo(58, 30); g.closePath(); }, '#7a3a8a', 2);
    // 다리
    g.strokeStyle = OUT; g.lineWidth = 3;
    [[36, 78, 28, 88], [46, 80, 42, 90], [58, 80, 62, 90], [68, 78, 76, 88]].forEach(([a, b, c, d]) => { g.beginPath(); g.moveTo(a, b); g.lineTo(c, d); g.stroke(); });
    // 몸통
    oval(g, 52, 70, 24, 14, lin(g, 0, 56, 0, 84, [[0, '#f0a858'], [1, '#b0602a']]), 3);
    shine(g, 46, 63, 8, 3, 0.4, -0.1);
    // 집게
    oval(g, 16, 64, 9, 7, '#e09a4a', 2.5, -0.3); oval(g, 22, 78, 8, 6, '#e09a4a', 2.5, 0.3);
    g.strokeStyle = OUT; g.lineWidth = 2; g.beginPath(); g.moveTo(10, 62); g.lineTo(18, 65); g.stroke();
    // 얼굴
    eye(g, 34, 66, '#5a2a1a', 0.7); eye(g, 44, 66, '#5a2a1a', 0.7);
    smile(g, 39, 75, 2.4);
  });
}

function drawMummy() {
  return vs(96, 96, g => {
    glowAt(g, 48, 56, 40, 'rgba(255,240,200,0.35)');
    // 흐릿한 꼬리 (유령)
    shape(g, () => { g.moveTo(26, 56); g.quadraticCurveTo(24, 82, 40, 90); g.quadraticCurveTo(46, 82, 52, 90); g.quadraticCurveTo(58, 82, 64, 90); g.quadraticCurveTo(74, 80, 70, 56); g.closePath(); },
      lin(g, 0, 50, 0, 90, [[0, '#f2e8d4'], [1, 'rgba(242,232,212,0.4)']]), 2.5);
    oval(g, 48, 46, 24, 24, lin(g, 0, 22, 0, 70, [[0, '#fbf4e4'], [1, '#e0d2b4']]), 3);
    // 붕대 줄
    g.strokeStyle = 'rgba(160,130,90,0.6)'; g.lineWidth = 2;
    [[26, 36, 70, 30], [24, 50, 72, 46], [28, 62, 70, 66], [36, 76, 64, 80]].forEach(([a, b, c, d]) => { g.beginPath(); g.moveTo(a, b); g.lineTo(c, d); g.stroke(); });
    // 눈 틈
    shape(g, () => g.roundRect(28, 40, 34, 12, 6), '#3a2a2a', 2);
    oval(g, 38, 46, 3.5, 3.5, '#ffe27a', 0); oval(g, 52, 46, 3.5, 3.5, '#ffe27a', 0);
    glowAt(g, 38, 46, 6, 'rgba(255,230,120,0.8)'); glowAt(g, 52, 46, 6, 'rgba(255,230,120,0.8)');
    // 흘러내린 붕대 끝
    shape(g, () => { g.moveTo(68, 34); g.quadraticCurveTo(84, 36, 86, 50); g.lineTo(80, 48); g.quadraticCurveTo(76, 40, 66, 40); g.closePath(); }, '#efe4cc', 2);
  });
}

// ── 챕터 3 보스: 사막 전갈 여왕 (192×192) ──
function drawScorpionQueen() {
  return vs(192, 192, g => {
    // 꼬리
    g.lineCap = 'round';
    g.strokeStyle = OUT; g.lineWidth = 26; g.beginPath(); g.moveTo(130, 140); g.quadraticCurveTo(184, 104, 158, 48); g.quadraticCurveTo(140, 22, 116, 34); g.stroke();
    g.strokeStyle = '#c8602a'; g.lineWidth = 18; g.beginPath(); g.moveTo(130, 140); g.quadraticCurveTo(184, 104, 158, 48); g.quadraticCurveTo(140, 22, 116, 34); g.stroke();
    g.strokeStyle = 'rgba(255,200,140,0.6)'; g.lineWidth = 5; g.beginPath(); g.moveTo(150, 120); g.quadraticCurveTo(172, 96, 160, 60); g.stroke();
    shape(g, () => { g.moveTo(118, 26); g.lineTo(92, 40); g.lineTo(118, 48); g.closePath(); }, lin(g, 92, 30, 118, 48, [[0, '#d070ff'], [1, '#6a2a9a']]), 3);
    glowAt(g, 100, 40, 18, 'rgba(200,120,255,0.6)');
    // 다리
    g.strokeStyle = OUT; g.lineWidth = 6;
    [[70, 156, 52, 180], [92, 160, 84, 184], [116, 160, 124, 184], [138, 156, 156, 180]].forEach(([a, b, c, d]) => { g.beginPath(); g.moveTo(a, b); g.lineTo(c, d); g.stroke(); });
    // 몸통
    oval(g, 104, 140, 50, 28, lin(g, 0, 112, 0, 168, [[0, '#ff9a4a'], [1, '#a04a1a']]), 4);
    g.strokeStyle = 'rgba(90,40,10,0.5)'; g.lineWidth = 3;
    [96, 116, 136].forEach(x => { g.beginPath(); g.moveTo(x, 116); g.quadraticCurveTo(x + 4, 140, x, 164); g.stroke(); });
    shine(g, 88, 126, 16, 6, 0.4, -0.1);
    // 몸의 별조각
    glowAt(g, 124, 132, 20, 'rgba(210,245,255,0.8)');
    shape(g, () => { g.moveTo(120, 142); g.lineTo(122, 124); g.lineTo(128, 118); g.lineTo(132, 130); g.lineTo(130, 142); g.closePath(); }, '#e0f8ff', 2);
    // 큰 집게
    oval(g, 30, 120, 22, 15, lin(g, 0, 104, 0, 136, [[0, '#ffa860'], [1, '#c0602a']]), 3.5, -0.3);
    oval(g, 40, 156, 20, 13, lin(g, 0, 142, 0, 170, [[0, '#ffa860'], [1, '#c0602a']]), 3.5, 0.3);
    g.strokeStyle = OUT; g.lineWidth = 4; g.beginPath(); g.moveTo(10, 114); g.lineTo(32, 122); g.moveTo(22, 156); g.lineTo(42, 158); g.stroke();
    // 얼굴과 왕관
    eye(g, 66, 128, '#6a1a2a', 1.6); eye(g, 88, 128, '#6a1a2a', 1.6);
    g.strokeStyle = OUT; g.lineWidth = 5; g.beginPath(); g.moveTo(54, 110); g.lineTo(72, 116); g.moveTo(100, 110); g.lineTo(84, 116); g.stroke();
    shape(g, () => { g.moveTo(68, 150); g.quadraticCurveTo(78, 144, 88, 150); }, null, 0);
    g.strokeStyle = OUT; g.lineWidth = 3.5; g.beginPath(); g.moveTo(68, 151); g.quadraticCurveTo(78, 145, 88, 151); g.stroke();
    shape(g, () => { g.moveTo(58, 106); g.lineTo(56, 84); g.lineTo(68, 96); g.lineTo(77, 78); g.lineTo(86, 96); g.lineTo(98, 84); g.lineTo(96, 106); g.quadraticCurveTo(77, 112, 58, 106); },
      lin(g, 0, 78, 0, 110, [[0, '#fff0a0'], [1, '#c08a20']]), 3);
    oval(g, 77, 100, 5, 5, '#d070ff', 2);
  });
}

// ── 일일 던전 보스 (192×192) ──
function drawGoldSlime() {
  return vs(192, 192, g => {
    glowAt(g, 96, 120, 96, 'rgba(255,230,120,0.45)');
    slimeBody(g, 2, '#fff6b0', '#f0c040', '#b07a18');
    eye(g, 68, 122, '#7a4a10', 1.8); eye(g, 102, 122, '#7a4a10', 1.8);
    blush(g, 54, 140, 1.6); blush(g, 116, 140, 1.6);
    smile(g, 85, 150, 8);
    // 머리 위 금화 탑
    [[86, 52], [96, 42], [80, 40], [92, 30]].forEach(([x, y]) => { oval(g, x, y, 16, 6, lin(g, 0, y - 6, 0, y + 6, [[0, '#fff3a0'], [1, '#d09a20']]), 2.5); });
    star(g, 92, 28, 6, '#fff8d0');
    [[30, 90], [160, 110], [140, 60]].forEach(([x, y]) => glowAt(g, x, y, 10, 'rgba(255,250,200,0.9)'));
  });
}

function drawGolem() {
  return vs(192, 192, g => {
    // 다리와 팔
    shape(g, () => g.roundRect(56, 140, 32, 42, 8), lin(g, 0, 140, 0, 182, [[0, '#a8a0b8'], [1, '#6a6478']]), 3);
    shape(g, () => g.roundRect(104, 140, 32, 42, 8), lin(g, 0, 140, 0, 182, [[0, '#a8a0b8'], [1, '#6a6478']]), 3);
    shape(g, () => g.roundRect(12, 76, 34, 70, 14), lin(g, 12, 0, 46, 0, [[0, '#7a748a'], [1, '#b0a8c0']]), 3);
    shape(g, () => g.roundRect(146, 76, 34, 70, 14), lin(g, 146, 0, 180, 0, [[0, '#b0a8c0'], [1, '#7a748a']]), 3);
    // 몸통
    shape(g, () => g.roundRect(40, 60, 112, 90, 20), lin(g, 0, 60, 0, 150, [[0, '#c8c0d8'], [1, '#7a748a']]), 3.5);
    g.strokeStyle = 'rgba(60,50,80,0.4)'; g.lineWidth = 3;
    [[60, 70, 70, 110], [130, 80, 120, 130], [90, 120, 104, 146]].forEach(([a, b, c, d]) => { g.beginPath(); g.moveTo(a, b); g.lineTo(c, d); g.stroke(); });
    // 머리
    shape(g, () => g.roundRect(64, 18, 64, 50, 14), lin(g, 0, 18, 0, 68, [[0, '#d0c8e0'], [1, '#8a849a']]), 3.5);
    glowAt(g, 82, 42, 12, 'rgba(120,230,255,0.9)'); glowAt(g, 110, 42, 12, 'rgba(120,230,255,0.9)');
    oval(g, 82, 42, 6, 5, '#bff4ff', 2); oval(g, 110, 42, 6, 5, '#bff4ff', 2);
    // 보석들
    [[96, 100, '#ff5a8a'], [66, 90, '#5ab0ff'], [126, 96, '#6fe08a'], [30, 110, '#ffd25e'], [162, 112, '#c890ff']].forEach(([x, y, c]) => {
      glowAt(g, x, y, 14, 'rgba(255,255,255,0.6)');
      shape(g, () => { g.moveTo(x, y - 10); g.lineTo(x + 8, y); g.lineTo(x, y + 10); g.lineTo(x - 8, y); g.closePath(); }, c, 2);
      shine(g, x - 2, y - 3, 2, 3, 0.8, 0);
    });
    oval(g, 60, 64, 10, 5, '#6fbf5a', 2);
  });
}

// ── 캠프 소품 ──
function drawTent() {
  return vs(144, 120, g => {
    shape(g, () => { g.moveTo(6, 114); g.lineTo(72, 12); g.lineTo(138, 114); g.closePath(); },
      lin(g, 6, 0, 138, 0, [[0, '#c8955a'], [0.5, '#f0d4a0'], [1, '#c08a50']]), 3);
    g.save(); g.beginPath(); g.moveTo(6, 114); g.lineTo(72, 12); g.lineTo(138, 114); g.closePath(); g.clip();
    g.strokeStyle = 'rgba(160,100,50,0.3)'; g.lineWidth = 6;
    for (let x = -60; x < 200; x += 22) { g.beginPath(); g.moveTo(72, 12); g.lineTo(x, 130); g.stroke(); }
    g.restore();
    shape(g, () => { g.moveTo(72, 48); g.lineTo(50, 114); g.lineTo(94, 114); g.closePath(); }, lin(g, 0, 48, 0, 114, [[0, '#4a2e1a'], [1, '#2a1a10']]), 2.5);
    shape(g, () => { g.moveTo(72, 48); g.quadraticCurveTo(66, 84, 50, 114); g.lineTo(60, 114); g.quadraticCurveTo(70, 80, 72, 48); }, '#e8c890', 2);
    g.strokeStyle = OUT; g.lineWidth = 3; g.beginPath(); g.moveTo(72, 14); g.lineTo(72, 2); g.stroke();
    shape(g, () => { g.moveTo(72, 2); g.lineTo(92, 7); g.lineTo(72, 12); g.closePath(); }, '#e0504a', 2);
    g.strokeStyle = '#8a6a48'; g.lineWidth = 2; g.beginPath(); g.moveTo(10, 112); g.lineTo(0, 118); g.moveTo(134, 112); g.lineTo(144, 118); g.stroke();
  });
}

function drawChest(open) {
  return vs(72, 60, g => {
    const wood = lin(g, 0, 20, 0, 58, [[0, '#c87a3a'], [1, '#8a4a20']]);
    if (open) {
      glowAt(g, 36, 22, 30, 'rgba(255,230,120,0.8)');
      shape(g, () => g.roundRect(8, 4, 56, 16, 6), lin(g, 0, 4, 0, 20, [[0, '#d88a4a'], [1, '#a05a28']]), 2.5);
      oval(g, 36, 24, 24, 6, '#ffd25e', 2);
      [[26, 21], [40, 19], [48, 23]].forEach(([x, y]) => oval(g, x, y, 4, 3, '#fff3b0', 1.5));
    }
    shape(g, () => g.roundRect(6, 24, 60, 32, 6), wood, 2.5);
    if (!open) shape(g, () => { g.moveTo(6, 28); g.quadraticCurveTo(36, 4, 66, 28); g.closePath(); }, lin(g, 0, 10, 0, 28, [[0, '#d88a4a'], [1, '#a05a28']]), 2.5);
    shape(g, () => g.rect(6, 34, 60, 5), '#f0c95a', 2);
    shape(g, () => g.roundRect(30, 30, 12, 14, 3), lin(g, 0, 30, 0, 44, [[0, '#fff0a0'], [1, '#c8902a']]), 2);
    oval(g, 36, 38, 2, 2.5, '#5a3418', 0);
    shine(g, 20, 30, 8, 2.5, 0.35, 0);
  });
}

function drawPotion() {
  return vs(48, 48, g => {
    shape(g, () => g.roundRect(19, 4, 10, 8, 2), '#a8703e', 2);
    shape(g, () => { g.moveTo(18, 12); g.lineTo(30, 12); g.lineTo(30, 18); g.quadraticCurveTo(42, 22, 42, 32); g.quadraticCurveTo(42, 44, 24, 44); g.quadraticCurveTo(6, 44, 6, 32); g.quadraticCurveTo(6, 22, 18, 18); g.closePath(); },
      'rgba(230,240,255,0.9)', 2.5);
    g.save(); g.beginPath(); g.ellipse(24, 32, 16, 11, 0, 0, TAU); g.clip();
    g.fillStyle = lin(g, 0, 24, 0, 44, [[0, '#ff7a8a'], [1, '#c8304a']]); g.fillRect(6, 26, 36, 20);
    g.restore();
    shine(g, 15, 26, 3, 6, 0.8, 0.3);
  });
}

// ── 장비 아이콘 (48×48) ──
function drawSwordIcon() {
  return vs(48, 48, g => {
    g.translate(24, 24); g.rotate(Math.PI / 4);
    shape(g, () => { g.moveTo(-3.5, 6); g.lineTo(-3.5, -16); g.lineTo(0, -22); g.lineTo(3.5, -16); g.lineTo(3.5, 6); g.closePath(); }, lin(g, -4, 0, 4, 0, [[0, '#ffffff'], [1, '#9aa8c0']]), 2);
    shape(g, () => g.roundRect(-9, 5, 18, 4, 2), '#f0c95a', 2);
    shape(g, () => g.roundRect(-2.5, 9, 5, 10, 2), '#7a4a2a', 2);
  });
}
function drawArmorIcon() {
  return vs(48, 48, g => {
    shape(g, () => { g.moveTo(10, 12); g.lineTo(18, 8); g.quadraticCurveTo(24, 14, 30, 8); g.lineTo(38, 12); g.lineTo(36, 22); g.lineTo(33, 22); g.lineTo(33, 40); g.lineTo(15, 40); g.lineTo(15, 22); g.lineTo(12, 22); g.closePath(); },
      lin(g, 0, 8, 0, 40, [[0, '#dfe7f4'], [1, '#8a98b4']]), 2.5);
    shape(g, () => g.roundRect(21, 18, 6, 14, 2), '#f0c95a', 1.5);
  });
}
function drawRingIcon() {
  return vs(48, 48, g => {
    g.strokeStyle = OUT; g.lineWidth = 9; g.beginPath(); g.ellipse(24, 30, 12, 10, 0, 0, TAU); g.stroke();
    g.strokeStyle = '#f0c95a'; g.lineWidth = 5; g.beginPath(); g.ellipse(24, 30, 12, 10, 0, 0, TAU); g.stroke();
    shape(g, () => { g.moveTo(24, 6); g.lineTo(32, 14); g.lineTo(24, 22); g.lineTo(16, 14); g.closePath(); }, lin(g, 16, 6, 32, 22, [[0, '#e0f8ff'], [1, '#5ab0f0']]), 2);
  });
}

// ── 동료 생성기 ─────────────────────────────────
// 머리·모자·옷·무기를 조합해 2등신 동료를 그린다. 각성(★1~5)마다 모습이 바뀐다.
// ★2 옷 색 변경 · ★3 머리색 변경과 망토 · ★4 금장식과 빛 · ★5 날개와 천사 고리
const ALLY_LOOKS = {
  miru:  { hairStyle: 'bob',   hair: ['#5ad0c0', '#2a9a8a'], hair3: ['#ffd0e8', '#e090b8'], iris: '#2a9a7a', body: ['#5fb06a', '#3d7a47'], body2: ['#7ac8e0', '#3a88a8'], legs: '#ffdcc2', boots: '#6b4a2b', hat: 'hood',     hatColor: '#5fb06a', outfit: 'apron', weapon: 'staff_leaf' },
  serin: { hairStyle: 'bangs', hair: ['#eae4ff', '#a8a0d8'], hair3: ['#ffe9a0', '#d0a040'], iris: '#7a5ad0', skin: '#ffdcc8', ear: true, body: ['#7a5ad0', '#40288a'], body2: ['#3a5ad0', '#1a2a8a'], legs: '#3a2a5a', boots: '#2a1a40', hat: 'wizard', hatColor: '#6a4ac0', outfit: 'robe', weapon: 'staff_orb' },
  kai:   { hairStyle: 'spiky', hair: ['#3a2a22', '#1e1410'], hair3: ['#d0602a', '#8a3010'], iris: '#c8701a', body: ['#d8a868', '#9a6a38'], body2: ['#6a8a5a', '#3a5a30'], legs: '#6b5a3a', boots: '#5a3820', hat: 'bandana',  hatColor: '#ff9a4a', outfit: 'vest',  weapon: 'crossbow' },
  pio:   { hairStyle: 'twin',  hair: ['#fff3a0', '#e0b030'], hair3: ['#b0e8ff', '#5aa8e0'], iris: '#e0a020', body: ['#ffe9a0', '#e0b040'], body2: ['#c8e0ff', '#7aa0e0'], legs: '#ffdcc2', boots: '#e0a030', hat: 'star',     hatColor: '#ffe27a', outfit: 'dress', weapon: 'staff_star' },
  lea:   { hairStyle: 'long',  hair: ['#ff8a6a', '#c04a2a'], hair3: ['#ffffff', '#c8c8e0'], iris: '#c04a2a', body: ['#e0e4f0', '#9aa4c0'], body2: ['#ffd27a', '#c8902a'], legs: '#6a6a80', boots: '#5a5a70', hat: 'circlet',  hatColor: '#f0c95a', outfit: 'armor', weapon: 'spear' },
  noeul: { hairStyle: 'spiky', hair: ['#ff9a5a', '#c8502a'], hair3: ['#c890ff', '#7a40c0'], iris: '#e06a2a', body: ['#4a5a8a', '#2a3460'], body2: ['#8a3a5a', '#5a1a3a'], legs: '#3a3a50', boots: '#2a2a3a', hat: 'none',     outfit: 'tunic', weapon: 'bow' },
  luka:  { hairStyle: 'spiky', hair: ['#ffd25e', '#c8902a'], hair3: ['#ff6a4a', '#a83020'], iris: '#3a8ad0', body: ['#c8443c', '#8a2a24'], body2: ['#3a6ad0', '#1a3a8a'], legs: '#4a3b2a', boots: '#5a3a20', hat: 'headband', hatColor: '#ffffff', outfit: 'tunic', weapon: 'greatsword' },
  bron:  { hairStyle: 'short', hair: ['#8a7a6a', '#4a3e34'], hair3: ['#e8e8f0', '#a8a8b8'], iris: '#4a6a3a', body: ['#8a96b0', '#5a6478'], body2: ['#c8a040', '#8a6a20'], legs: '#4a4a5a', boots: '#3a3a48', hat: 'helm',     hatColor: '#a8b0c8', outfit: 'armor', weapon: 'shield' },
  arin:  { hairStyle: 'long',  hair: ['#ff5a4a', '#a02a2a'], hair3: ['#ffb03a', '#d0601a'], iris: '#d03a2a', body: ['#ff7a5a', '#c0402a'], body2: ['#5a3a5a', '#2a1a2a'], legs: '#ffdcc2', boots: '#8a2a2a', hat: 'witch',    hatColor: '#3a2a3a', outfit: 'robe',  weapon: 'staff_fire' },
  eunho: { hairStyle: 'bangs', hair: ['#e8eef8', '#a0aac0'], hair3: ['#5ab0ff', '#2a6ad0'], iris: '#3a7ad0', body: ['#3a5a8a', '#1a3060'], body2: ['#e0e8f0', '#a0aac0'], legs: '#2a3a50', boots: '#1a2638', hat: 'none',     outfit: 'vest',  weapon: 'bow' },
  sea:   { hairStyle: 'long',  hair: ['#ffe0a0', '#d0a050'], hair3: ['#ffc0d8', '#e080a8'], iris: '#4a8ad0', body: ['#ffffff', '#c8d0e8'], body2: ['#ffd0e0', '#e090b0'], legs: '#ffdcc2', boots: '#c8b088', hat: 'veil',     hatColor: '#ffffff', outfit: 'dress', weapon: 'book' },
  baram: { hairStyle: 'bangs', hair: ['#7ad0a0', '#2a8a5a'], hair3: ['#a0c8ff', '#4a7ad0'], iris: '#2a8a5a', body: ['#e0c890', '#a88a50'], body2: ['#7ac8b0', '#3a8a70'], legs: '#5a4a3a', boots: '#4a3a2a', hat: 'beret',    hatColor: '#3a8a5a', outfit: 'tunic', weapon: 'lute' },
  tobi:  { hairStyle: 'spiky', hair: ['#c87a3a', '#7a4420'], hair3: ['#8ad0ff', '#3a7ab0'], iris: '#7a4420', body: ['#8aa050', '#5a7030'], body2: ['#c8a070', '#8a6a40'], legs: '#5a4a3a', boots: '#4a3020', hat: 'none',     outfit: 'vest',  weapon: 'axe' },
  jun:   { hairStyle: 'short', hair: ['#3a3a4a', '#101018'], hair3: ['#d0d8e8', '#8890a8'], iris: '#2a2a3a', body: ['#3a8ad0', '#2a5aa0'], body2: ['#d04a4a', '#8a2a2a'], legs: '#3a3a4a', boots: '#2a2a38', hat: 'headband', hatColor: '#d04a4a', outfit: 'tunic', weapon: 'spear' },
  danbi: { hairStyle: 'bob',   hair: ['#7ab0ff', '#3a6ad0'], hair3: ['#c8f0ff', '#7ac0e0'], iris: '#3a6ad0', body: ['#a0d0ff', '#5a90d0'], body2: ['#c8a0ff', '#8a60d0'], legs: '#ffdcc2', boots: '#3a5a90', hat: 'raincap',  hatColor: '#ffe27a', outfit: 'dress', weapon: 'staff_orb' },
  rio:   { hairStyle: 'spiky', hair: ['#e0b060', '#a87830'], hair3: ['#80e0a0', '#3a9a5a'], iris: '#6a8a2a', body: ['#e07a3a', '#a84a1a'], body2: ['#3a8a8a', '#1a5a5a'], legs: '#4a4a3a', boots: '#5a3a20', hat: 'cap',      hatColor: '#3a6ad0', outfit: 'tunic', weapon: 'sling' },
  sora:  { hairStyle: 'twin',  hair: ['#a0c8ff', '#5a88d0'], hair3: ['#ffffff', '#c0d0f0'], iris: '#3a6ad0', body: ['#e8f4ff', '#a8c0e0'], body2: ['#7ad0c0', '#3a9a8a'], legs: '#ffdcc2', boots: '#5a88d0', hat: 'none',     outfit: 'dress', weapon: 'bow' },
  hana:  { hairStyle: 'bob',   hair: ['#ffb0c8', '#d06a90'], hair3: ['#fff0a0', '#e0c050'], iris: '#d06a90', body: ['#ffffff', '#d0d8e8'], body2: ['#c8f0d0', '#7ac08a'], legs: '#ffdcc2', boots: '#d06a90', hat: 'nurse',    hatColor: '#ffffff', outfit: 'apron', weapon: 'bandage' },
  momo:  { hairStyle: 'twin',  hair: ['#ffc0a0', '#e08060'], hair3: ['#d0a0ff', '#9a60e0'], iris: '#e06a3a', body: ['#ffd25e', '#e0a020'], body2: ['#ff9ac0', '#d05a8a'], legs: '#ffdcc2', boots: '#e06a3a', hat: 'ribbon',   hatColor: '#ff6a8a', outfit: 'dress', weapon: 'tambourine' },
  yuri:  { hairStyle: 'long',  hair: ['#4a4a6a', '#1a1a2a'], hair3: ['#ffd0e0', '#d090b0'], iris: '#5a4ad0', body: ['#e8e0ff', '#a8a0d0'], body2: ['#3a4a8a', '#1a2a5a'], legs: '#ffdcc2', boots: '#3a3a5a', hat: 'ribbon',   hatColor: '#5a4ad0', outfit: 'dress', weapon: 'flag' },
};

// 흰색과 섞어 밝게 (★5 천사 옷)
function lighten(hex, k) {
  const n = parseInt(hex.slice(1), 16), r = n >> 16, gg = (n >> 8) & 255, b = n & 255;
  const f = v => Math.round(v + (255 - v) * k).toString(16).padStart(2, '0');
  return '#' + f(r) + f(gg) + f(b);
}

// ── 머리 모양 ──
function hairFront(style, c1, c2) {
  return g => {
    const hc = lin(g, 0, 8, 0, 40, [[0, c1], [1, c2]]);
    if (style === 'spiky') {
      shape(g, () => {
        g.moveTo(22, 34); g.lineTo(18, 18); g.lineTo(28, 20); g.lineTo(26, 6); g.lineTo(38, 12); g.lineTo(44, 0); g.lineTo(52, 10); g.lineTo(62, 2);
        g.lineTo(64, 14); g.lineTo(76, 10); g.lineTo(72, 22); g.lineTo(78, 30);
        g.lineTo(68, 26); g.lineTo(62, 32); g.lineTo(56, 24); g.lineTo(50, 31); g.lineTo(44, 23); g.lineTo(37, 31); g.lineTo(31, 24); g.lineTo(27, 34); g.closePath();
      }, hc, 2.5);
    } else if (style === 'short') {
      shape(g, () => {
        g.moveTo(23, 30); g.quadraticCurveTo(22, 6, 48, 6); g.quadraticCurveTo(74, 6, 73, 30);
        g.lineTo(66, 22); g.lineTo(56, 26); g.lineTo(46, 20); g.lineTo(36, 26); g.lineTo(28, 22); g.closePath();
      }, hc, 2.5);
    } else {
      bangs(c1, c2, style !== 'bob')(g);
      if (style === 'bob') {
        shape(g, () => { g.moveTo(24, 24); g.quadraticCurveTo(16, 42, 26, 52); g.lineTo(30, 34); g.closePath(); }, hc, 2.5);
        shape(g, () => { g.moveTo(71, 24); g.quadraticCurveTo(80, 42, 70, 52); g.lineTo(66, 34); g.closePath(); }, hc, 2.5);
      }
    }
    shine(g, 40, 12, 8, 3, 0.35, -0.15);
  };
}
function hairBack(style, c1, c2) {
  if (style === 'long') return longHair(c1, c2);
  if (style === 'twin') return g => {
    const hc = lin(g, 0, 20, 0, 70, [[0, c1], [1, c2]]);
    shape(g, () => { g.moveTo(24, 22); g.quadraticCurveTo(6, 40, 14, 66); g.quadraticCurveTo(22, 60, 28, 40); g.closePath(); }, hc, 2.5);
    shape(g, () => { g.moveTo(72, 22); g.quadraticCurveTo(90, 40, 82, 66); g.quadraticCurveTo(74, 60, 68, 40); g.closePath(); }, hc, 2.5);
  };
  return null;
}

// ── 모자·머리 장식 ──
const HATS = {
  none: null,
  hood: c => g => {},                                      // 뒤쪽은 hoodBack에서
  wizard: c => g => {
    oval(g, 46, 16, 30, 6, lin(g, 0, 10, 0, 22, [[0, c], [1, '#2a1a5a']]), 2.5, -0.08);
    shape(g, () => { g.moveTo(28, 15); g.quadraticCurveTo(40, -2, 70, -3); g.quadraticCurveTo(58, 4, 64, 14); g.quadraticCurveTo(46, 19, 28, 15); }, lin(g, 30, -2, 60, 16, [[0, lighten(c, 0.2)], [1, c]]), 2.5);
    shape(g, () => { g.moveTo(30, 12); g.quadraticCurveTo(46, 16, 63, 11); g.lineTo(64, 15); g.quadraticCurveTo(46, 20, 29, 16); g.closePath(); }, '#f0c95a', 2);
    star(g, 54, 8, 4, '#ffe27a');
  },
  witch: c => g => {
    oval(g, 48, 15, 34, 6.5, c, 2.5, -0.06);
    shape(g, () => { g.moveTo(30, 14); g.lineTo(52, -2); g.lineTo(66, 13); g.quadraticCurveTo(48, 18, 30, 14); }, lin(g, 0, -2, 0, 16, [[0, lighten(c, 0.25)], [1, c]]), 2.5);
    shape(g, () => { g.moveTo(32, 11); g.quadraticCurveTo(48, 15, 64, 10); g.lineTo(65, 14); g.quadraticCurveTo(48, 19, 31, 15); g.closePath(); }, '#ff5a4a', 2);
  },
  bandana: c => g => {
    shape(g, () => { g.moveTo(24, 20); g.quadraticCurveTo(48, 4, 72, 18); g.lineTo(72, 24); g.quadraticCurveTo(48, 12, 24, 26); g.closePath(); }, lin(g, 0, 6, 0, 26, [[0, lighten(c, 0.2)], [1, c]]), 2.5);
    shape(g, () => { g.moveTo(25, 22); g.quadraticCurveTo(14, 26, 12, 36); g.lineTo(18, 34); g.quadraticCurveTo(22, 28, 28, 25); g.closePath(); }, c, 2);
    oval(g, 44, 16, 6, 5, rad(g, 44, 16, 6, [[0, '#e0f8ff'], [1, '#5ab0d0']]), 2.5);
    oval(g, 57, 15, 6, 5, rad(g, 57, 15, 6, [[0, '#e0f8ff'], [1, '#5ab0d0']]), 2.5);
  },
  star: c => g => { star(g, 30, 14, 8, c); star(g, 66, 12, 5, c); },
  circlet: c => g => {
    g.strokeStyle = OUT; g.lineWidth = 5; g.beginPath(); g.moveTo(26, 22); g.quadraticCurveTo(48, 14, 72, 21); g.stroke();
    g.strokeStyle = c; g.lineWidth = 3; g.beginPath(); g.moveTo(26, 22); g.quadraticCurveTo(48, 14, 72, 21); g.stroke();
    oval(g, 49, 17, 3.5, 3.5, '#5ab0ff', 2);
  },
  headband: c => g => {
    shape(g, () => { g.moveTo(24, 22); g.quadraticCurveTo(48, 15, 73, 21); g.lineTo(73, 26); g.quadraticCurveTo(48, 20, 24, 27); g.closePath(); }, c, 2);
    shape(g, () => { g.moveTo(25, 24); g.lineTo(14, 22); g.lineTo(16, 30); g.closePath(); }, c, 2);
  },
  helm: c => g => {
    shape(g, () => { g.moveTo(22, 26); g.quadraticCurveTo(22, 2, 48, 2); g.quadraticCurveTo(74, 2, 74, 26); g.lineTo(66, 26); g.lineTo(66, 20); g.lineTo(30, 20); g.lineTo(30, 26); g.closePath(); },
      lin(g, 0, 2, 0, 26, [[0, '#ffffff'], [0.4, c], [1, '#6a7490']]), 2.5);
    shape(g, () => g.roundRect(44, 0, 8, 22, 3), '#d0443c', 2);
  },
  beret: c => g => { oval(g, 50, 12, 26, 9, lin(g, 0, 3, 0, 21, [[0, lighten(c, 0.2)], [1, c]]), 2.5, -0.1); oval(g, 52, 4, 3, 3, c, 2); },
  raincap: c => g => {
    oval(g, 48, 18, 32, 7, lin(g, 0, 11, 0, 25, [[0, lighten(c, 0.2)], [1, '#d0a020']]), 2.5, -0.05);
    shape(g, () => { g.moveTo(28, 17); g.quadraticCurveTo(30, 2, 48, 2); g.quadraticCurveTo(66, 2, 68, 16); g.quadraticCurveTo(48, 21, 28, 17); }, c, 2.5);
  },
  cap: c => g => {
    shape(g, () => { g.moveTo(25, 20); g.quadraticCurveTo(26, 3, 48, 3); g.quadraticCurveTo(70, 3, 71, 20); g.quadraticCurveTo(48, 15, 25, 20); }, lin(g, 0, 3, 0, 20, [[0, lighten(c, 0.2)], [1, c]]), 2.5);
    shape(g, () => { g.moveTo(66, 17); g.quadraticCurveTo(82, 16, 86, 22); g.quadraticCurveTo(76, 23, 64, 21); g.closePath(); }, c, 2.5);
  },
  veil: c => g => {
    shape(g, () => { g.moveTo(26, 18); g.quadraticCurveTo(48, 10, 70, 18); g.lineTo(70, 23); g.quadraticCurveTo(48, 16, 26, 23); g.closePath(); }, '#f0c95a', 2);
    oval(g, 48, 15, 4, 4, '#ff9ac0', 2);
  },
  nurse: c => g => {
    shape(g, () => { g.moveTo(34, 12); g.lineTo(62, 12); g.lineTo(58, 2); g.lineTo(38, 2); g.closePath(); }, c, 2.5);
    g.fillStyle = '#e0405a'; g.fillRect(46, 4, 4, 7); g.fillRect(44.5, 5.5, 7, 4);
  },
  ribbon: c => g => {
    shape(g, () => { g.moveTo(30, 12); g.quadraticCurveTo(16, 2, 18, 16); g.quadraticCurveTo(22, 22, 30, 14); }, c, 2);
    shape(g, () => { g.moveTo(32, 12); g.quadraticCurveTo(40, -2, 44, 10); g.quadraticCurveTo(42, 18, 32, 14); }, c, 2);
    oval(g, 31, 13, 3.5, 3.5, lighten(c, -0.0), 2);
  },
};
function hoodBack(c) {
  return g => shape(g, () => { g.moveTo(22, 30); g.quadraticCurveTo(18, 56, 30, 58); g.lineTo(66, 58); g.quadraticCurveTo(80, 50, 74, 26); g.quadraticCurveTo(48, 0, 22, 30); },
    lin(g, 0, 10, 0, 60, [[0, lighten(c, 0.15)], [1, c]]), 2.5);
}
function veilBack() {
  return g => shape(g, () => { g.moveTo(24, 18); g.quadraticCurveTo(10, 50, 20, 76); g.lineTo(40, 70); g.lineTo(40, 30); g.closePath(); }, 'rgba(255,255,255,0.85)', 2);
}

// ── 옷 ──
const OUTFITS = {
  tunic: (L, gold) => g => { shape(g, () => g.roundRect(33, 70, 30, 5, 2), gold ? '#f0c95a' : '#6b4a2b', 2); shape(g, () => g.roundRect(45, 69, 7, 7, 2), gold ? '#fff3a0' : '#f0c95a', 1.5); },
  apron: (L, gold) => g => { shape(g, () => g.roundRect(39, 57, 18, 20, 5), gold ? '#fff3c8' : '#f6ecd2', 2); oval(g, 48, 70, 4, 3.5, '#e0405a', 1.5); },
  vest: (L, gold) => g => {
    shape(g, () => { g.moveTo(36, 54); g.lineTo(40, 78); g.lineTo(46, 78); g.lineTo(44, 55); g.closePath(); }, gold ? '#c8902a' : '#7a4a2a', 2);
    shape(g, () => { g.moveTo(60, 54); g.lineTo(56, 78); g.lineTo(50, 78); g.lineTo(52, 55); g.closePath(); }, gold ? '#c8902a' : '#7a4a2a', 2);
  },
  robe: (L, gold) => g => {
    shape(g, () => { g.moveTo(32, 64); g.lineTo(28, 84); g.quadraticCurveTo(48, 89, 68, 84); g.lineTo(64, 64); g.closePath(); }, lin(g, 0, 64, 0, 86, [[0, L.body[0]], [1, L.body[1]]]), 2.5);
    g.strokeStyle = '#f0c95a'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(29, 82); g.quadraticCurveTo(48, 87, 67, 82); g.stroke();
    g.lineWidth = 2; g.beginPath(); g.moveTo(48, 54); g.lineTo(48, 84); g.stroke();
  },
  dress: (L, gold) => g => {
    shape(g, () => { g.moveTo(32, 66); g.quadraticCurveTo(26, 80, 24, 82); g.quadraticCurveTo(48, 88, 72, 82); g.quadraticCurveTo(70, 78, 64, 66); g.closePath(); },
      lin(g, 0, 66, 0, 84, [[0, lighten(L.body[0], 0.15)], [1, L.body[1]]]), 2.5);
    g.strokeStyle = gold ? '#f0c95a' : '#fff'; g.lineWidth = 2; g.beginPath(); g.moveTo(27, 79); g.quadraticCurveTo(48, 85, 69, 79); g.stroke();
    shape(g, () => { g.moveTo(37, 51); g.quadraticCurveTo(48, 60, 59, 51); g.quadraticCurveTo(48, 55, 37, 51); }, '#ffffff', 2);
  },
  armor: (L, gold) => g => {
    shape(g, () => g.roundRect(37, 55, 22, 16, 6), lin(g, 0, 55, 0, 71, [[0, '#ffffff'], [0.5, gold ? '#f0d070' : '#c8d0e0'], [1, gold ? '#b08020' : '#7a849a']]), 2);
    oval(g, 33, 55, 7, 5, gold ? '#f0c95a' : '#a8b0c8', 2); oval(g, 62, 55, 7, 5, gold ? '#f0c95a' : '#a8b0c8', 2);
    shape(g, () => g.roundRect(33, 70, 30, 5, 2), '#6b4a2b', 2);
  },
};

// ── 무기 (오른손) ──
const WEAPONS = {
  sword: g => sword(g),
  greatsword: g => {
    g.save(); g.translate(70, 68); g.rotate(-0.3);
    shape(g, () => g.roundRect(-3, 0, 6, 12, 2), '#5a3418', 2);
    shape(g, () => g.roundRect(-12, -4, 24, 6, 3), '#d0443c', 2);
    shape(g, () => { g.moveTo(-6, -4); g.lineTo(-6, -46); g.lineTo(0, -56); g.lineTo(6, -46); g.lineTo(6, -4); g.closePath(); }, lin(g, -6, 0, 6, 0, [[0, '#ffffff'], [1, '#8a98b4']]), 2.5);
    g.restore(); oval(g, 67, 66, 4.6, 4.6, '#ffd6b8', 2);
  },
  axe: g => {
    shape(g, () => g.roundRect(67, 30, 4.5, 50, 2), '#7a4a2a', 2);
    shape(g, () => { g.moveTo(71, 34); g.quadraticCurveTo(92, 30, 90, 50); g.quadraticCurveTo(82, 44, 71, 48); g.closePath(); }, lin(g, 70, 0, 92, 0, [[0, '#8a98b4'], [1, '#ffffff']]), 2.5);
    oval(g, 69, 64, 4.6, 4.6, '#ffd6b8', 2);
  },
  spear: g => {
    shape(g, () => g.roundRect(68, 10, 4, 80, 2), '#8a5a34', 2);
    shape(g, () => { g.moveTo(70, -2); g.lineTo(76, 14); g.lineTo(64, 14); g.closePath(); }, lin(g, 64, 0, 76, 0, [[0, '#ffffff'], [1, '#9aa8c0']]), 2);
    shape(g, () => { g.moveTo(66, 16); g.lineTo(74, 16); g.lineTo(70, 22); g.closePath(); }, '#d0443c', 1.5);
    oval(g, 69, 64, 4.6, 4.6, '#ffd6b8', 2);
  },
  shield: g => {
    sword(g);
    oval(g, 30, 64, 13, 15, lin(g, 0, 50, 0, 80, [[0, '#e0e8f4'], [1, '#7a849a']]), 3);
    star(g, 30, 64, 6, '#f0c95a');
  },
  bow: g => {
    g.strokeStyle = OUT; g.lineWidth = 4.5; g.beginPath(); g.moveTo(70, 34); g.quadraticCurveTo(88, 62, 70, 90); g.stroke();
    g.strokeStyle = '#a8703e'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(70, 34); g.quadraticCurveTo(88, 62, 70, 90); g.stroke();
    g.strokeStyle = '#f0f0f0'; g.lineWidth = 1; g.beginPath(); g.moveTo(70, 34); g.lineTo(70, 90); g.stroke();
    oval(g, 74, 62, 4.6, 4.6, '#ffd6b8', 2);
  },
  crossbow: g => {
    shape(g, () => g.roundRect(60, 58, 24, 6, 2), '#8a5a34', 2);
    g.strokeStyle = OUT; g.lineWidth = 3; g.beginPath(); g.moveTo(80, 48); g.quadraticCurveTo(88, 61, 80, 74); g.stroke();
    g.strokeStyle = '#e8e0d0'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(80, 48); g.lineTo(70, 61); g.lineTo(80, 74); g.stroke();
    shape(g, () => { g.moveTo(82, 59); g.lineTo(92, 61); g.lineTo(82, 63); g.closePath(); }, '#c8d0dc', 1.5);
    oval(g, 64, 64, 4.6, 4.6, '#ffd6b8', 2);
  },
  sling: g => {
    g.strokeStyle = '#8a5a34'; g.lineWidth = 4; g.beginPath(); g.moveTo(70, 70); g.lineTo(70, 54); g.lineTo(64, 44); g.moveTo(70, 54); g.lineTo(78, 44); g.stroke();
    g.strokeStyle = '#d04a4a'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(64, 44); g.quadraticCurveTo(71, 52, 78, 44); g.stroke();
    oval(g, 70, 66, 4.6, 4.6, '#ffd6b8', 2);
  },
  staff_leaf: g => staff(g, '#9a6a3a', g => { oval(g, 64, 16, 7, 4, '#7ad070', 2, -0.6); oval(g, 78, 15, 7, 4, '#7ad070', 2, 0.6); oval(g, 71, 9, 4, 7, '#9ae890', 2); }),
  staff_orb: g => staff(g, '#8a6aa0', g => { glowAt(g, 70, 14, 16, 'rgba(140,220,255,0.7)'); oval(g, 70, 14, 7, 7, rad(g, 70, 14, 8, [[0, '#ffffff'], [0.5, '#9adcff'], [1, '#3a8ad0']]), 2); }),
  staff_fire: g => staff(g, '#5a3418', g => {
    glowAt(g, 70, 12, 18, 'rgba(255,150,60,0.7)');
    shape(g, () => { g.moveTo(62, 18); g.quadraticCurveTo(60, 6, 70, -2); g.quadraticCurveTo(72, 8, 78, 6); g.quadraticCurveTo(82, 16, 74, 20); g.closePath(); }, lin(g, 0, -2, 0, 20, [[0, '#ffe27a'], [1, '#ff5a2a']]), 2);
  }),
  staff_star: g => staff(g, '#e0b040', g => { glowAt(g, 70, 12, 18, 'rgba(255,240,160,0.8)'); star(g, 70, 12, 10, '#fff3a0'); }),
  book: g => {
    shape(g, () => g.roundRect(60, 56, 20, 16, 2), lin(g, 0, 56, 0, 72, [[0, '#8a3a5a'], [1, '#5a1a3a']]), 2.5);
    shape(g, () => g.rect(62, 58, 16, 3), '#f0c95a', 1);
    oval(g, 63, 66, 4.6, 4.6, '#ffd6b8', 2);
  },
  lute: g => {
    oval(g, 66, 70, 11, 9, lin(g, 0, 60, 0, 80, [[0, '#d8a060'], [1, '#9a6030']]), 2.5, 0.4);
    shape(g, () => { g.moveTo(70, 64); g.lineTo(84, 42); g.lineTo(87, 45); g.lineTo(73, 67); g.closePath(); }, '#7a4a2a', 2);
    oval(g, 66, 70, 3, 3, '#3a2010', 0);
    oval(g, 62, 64, 4.6, 4.6, '#ffd6b8', 2);
  },
  flag: g => {
    shape(g, () => g.roundRect(68, 10, 4, 80, 2), '#8a5a34', 2);
    shape(g, () => { g.moveTo(72, 12); g.quadraticCurveTo(84, 8, 94, 14); g.lineTo(92, 32); g.quadraticCurveTo(82, 26, 72, 30); g.closePath(); }, lin(g, 72, 0, 94, 0, [[0, '#5a4ad0'], [1, '#9a8aff']]), 2);
    star(g, 83, 21, 4, '#ffe27a');
    oval(g, 69, 64, 4.6, 4.6, '#ffd6b8', 2);
  },
  tambourine: g => {
    oval(g, 70, 62, 11, 11, '#ffe9c8', 3); oval(g, 70, 62, 7, 7, '#ffd25e', 0);
    [[60, 56], [80, 56], [62, 70], [78, 70]].forEach(([x, y]) => oval(g, x, y, 2.5, 2.5, '#c8c8d8', 1.5));
    oval(g, 66, 66, 4.6, 4.6, '#ffd6b8', 2);
  },
  bandage: g => {
    oval(g, 68, 64, 8, 8, '#ffffff', 2.5); oval(g, 68, 64, 3, 3, '#e0d8c8', 1.5);
    g.strokeStyle = '#ffffff'; g.lineWidth = 3; g.beginPath(); g.moveTo(74, 68); g.quadraticCurveTo(82, 76, 78, 84); g.stroke();
    oval(g, 63, 68, 4.6, 4.6, '#ffd6b8', 2);
  },
};

// 각성 단계별 꾸밈 (몸 뒤)
function wings(g) {
  for (const s of [-1, 1]) {
    g.save(); g.translate(48, 56); g.scale(s, 1);
    shape(g, () => { g.moveTo(8, 0); g.quadraticCurveTo(30, -26, 44, -18); g.quadraticCurveTo(40, -6, 34, -4); g.quadraticCurveTo(40, 4, 30, 8); g.quadraticCurveTo(22, 12, 8, 6); g.closePath(); },
      lin(g, 0, -20, 0, 10, [[0, '#ffffff'], [1, '#d8e4ff']]), 2.5);
    g.strokeStyle = 'rgba(150,170,220,0.6)'; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(14, 0); g.quadraticCurveTo(28, -10, 38, -14); g.moveTo(14, 4); g.quadraticCurveTo(26, 0, 32, 2); g.stroke();
    g.restore();
  }
}
function cape(g, c) {
  shape(g, () => { g.moveTo(34, 52); g.quadraticCurveTo(18, 70, 20, 84); g.quadraticCurveTo(34, 88, 46, 84); g.lineTo(46, 56); g.closePath(); }, lin(g, 0, 52, 0, 88, [[0, c], [1, lighten(c, -0.0)]]), 2.5);
}

const ALLY_GLOW = { heal: '150,255,180', magic: '190,150,255', shot: '255,210,120', warrior: '255,140,120', support: '140,220,255' };

// 동료 그림 하나: id, 별(1~5), 유형(빛 색)
function drawAlly(id, starN, type) {
  const L = ALLY_LOOKS[id];
  const s = starN || 1;
  const body = s >= 5 ? [lighten(L.body2[0], 0.55), lighten(L.body2[1], 0.35)] : s >= 2 ? L.body2 : L.body;
  const hair = s >= 3 ? L.hair3 : L.hair;
  const look = { ...L, body };
  const hatFn = L.hat && HATS[L.hat] ? HATS[L.hat](s >= 4 ? '#f0c95a' : L.hatColor || '#888') : null;
  const backs = [];
  if (s >= 4) backs.push(g => { glowAt(g, 48, 50, 46, `rgba(${ALLY_GLOW[type] || '255,240,180'},0.55)`); });
  if (s >= 5) backs.push(wings);
  if (s >= 3) backs.push(g => cape(g, body[1]));
  if (L.hat === 'hood') backs.push(hoodBack(s >= 4 ? '#f0e0a0' : body[0]));
  if (L.hat === 'veil') backs.push(veilBack());
  const hb = hairBack(L.hairStyle, hair[0], hair[1]);
  if (hb) backs.push(hb);
  return chibi({
    iris: L.iris, legs: L.legs, boots: s >= 4 ? '#c8902a' : L.boots, skin: L.skin, ear: L.ear,
    body: body[0], bodyD: body[1], sleeveD: body[1],
    backHair: g => backs.forEach(f => f(g)),
    outfit: OUTFITS[L.outfit] ? OUTFITS[L.outfit](look, s >= 4) : null,
    hair: hairFront(L.hairStyle, hair[0], hair[1]),
    hat: g => {
      if (hatFn) hatFn(g);
      if (s >= 5) {            // 천사 고리
        g.strokeStyle = 'rgba(255,230,120,0.5)'; g.lineWidth = 7; g.beginPath(); g.ellipse(48, -1 + 4, 15, 4, 0, 0, TAU); g.stroke();
        g.strokeStyle = '#ffe27a'; g.lineWidth = 3; g.beginPath(); g.ellipse(48, 3, 15, 4, 0, 0, TAU); g.stroke();
      }
    },
    front: WEAPONS[L.weapon] || sword,
  });
}

// 표정까지 포함해 캐시 (이스터에그용 MOOD 반영)
const ALLY_CACHE = {};
function allySprite(id, starN, type, mood) {
  const key = id + ':' + starN + ':' + (mood || 0);
  if (!ALLY_CACHE[key]) {
    const keep = MOOD;
    MOOD = mood || 0;
    ALLY_CACHE[key] = drawAlly(id, starN, type);
    MOOD = keep;
  }
  return ALLY_CACHE[key];
}


// ── 특수 몬스터: 그림자 임프 (악마 · 암살자) ──
function drawImp() {
  return vs(96, 96, g => {
    glowAt(g, 48, 56, 40, 'rgba(255,80,120,0.25)');
    for (const s of [-1, 1]) {                       // 박쥐 날개
      g.save(); g.translate(48, 50); g.scale(s, 1);
      shape(g, () => { g.moveTo(10, -2); g.quadraticCurveTo(26, -24, 40, -16); g.lineTo(34, -8); g.lineTo(38, 2); g.lineTo(30, 0); g.lineTo(30, 10); g.quadraticCurveTo(20, 4, 10, 6); g.closePath(); },
        lin(g, 0, -20, 0, 10, [[0, '#6a2a5a'], [1, '#3a1430']]), 2.5);
      g.restore();
    }
    g.lineCap = 'round';                              // 꼬리
    g.strokeStyle = OUT; g.lineWidth = 6; g.beginPath(); g.moveTo(62, 76); g.quadraticCurveTo(84, 82, 82, 64); g.stroke();
    g.strokeStyle = '#c03a5a'; g.lineWidth = 3.5; g.beginPath(); g.moveTo(62, 76); g.quadraticCurveTo(84, 82, 82, 64); g.stroke();
    shape(g, () => { g.moveTo(82, 55); g.lineTo(89, 66); g.lineTo(75, 66); g.closePath(); }, '#c03a5a', 2);
    oval(g, 40, 86, 7, 4, '#5a1a3a'); oval(g, 56, 86, 7, 4, '#5a1a3a');
    oval(g, 48, 58, 24, 26, rad(g, 48, 58, 28, [[0, '#ff8aa8'], [0.6, '#d8426a'], [1, '#8a1a40']]), 3);
    const horn = lin(g, 0, 16, 0, 40, [[0, '#fff3d0'], [1, '#c8a070']]);
    shape(g, () => { g.moveTo(30, 42); g.quadraticCurveTo(18, 28, 24, 16); g.quadraticCurveTo(32, 30, 40, 36); g.closePath(); }, horn, 2.5);
    shape(g, () => { g.moveTo(66, 42); g.quadraticCurveTo(78, 28, 72, 16); g.quadraticCurveTo(64, 30, 56, 36); g.closePath(); }, horn, 2.5);
    oval(g, 39, 54, 5, 6, '#ffe27a', 2); oval(g, 55, 54, 5, 6, '#ffe27a', 2);
    oval(g, 38, 55, 2, 3.5, '#2a1020', 0); oval(g, 54, 55, 2, 3.5, '#2a1020', 0);
    g.strokeStyle = OUT; g.lineWidth = 2.5; g.beginPath(); g.moveTo(32, 45); g.lineTo(44, 49); g.moveTo(62, 45); g.lineTo(50, 49); g.stroke();
    smile(g, 47, 67, 4);
    shape(g, () => { g.moveTo(43, 65); g.lineTo(45, 70); g.lineTo(47, 65); g.closePath(); }, '#ffffff', 1.5);
    g.save(); g.translate(20, 66); g.rotate(-0.6);  // 단검
    shape(g, () => g.roundRect(-2, 0, 4, 8, 1.5), '#3a2a2a', 1.5);
    shape(g, () => { g.moveTo(-3.5, 0); g.lineTo(0, -22); g.lineTo(3.5, 0); g.closePath(); }, lin(g, -3, 0, 3, 0, [[0, '#ffffff'], [1, '#8a98b4']]), 1.5);
    g.restore();
    oval(g, 22, 68, 4.5, 4.5, '#d8426a', 2);
  });
}

// ── 특수 몬스터: 저주의 타락 천사 (저주술사) ──
function drawFallenAngel() {
  return vs(96, 96, g => {
    glowAt(g, 48, 50, 44, 'rgba(160,100,220,0.35)');
    for (const s of [-1, 1]) {                       // 찢어진 검은 날개
      g.save(); g.translate(48, 50); g.scale(s, 1);
      shape(g, () => { g.moveTo(8, 0); g.quadraticCurveTo(28, -30, 45, -22); g.lineTo(38, -14); g.lineTo(45, -8); g.lineTo(36, -2); g.lineTo(41, 6); g.lineTo(30, 6); g.lineTo(31, 14); g.quadraticCurveTo(18, 10, 8, 8); g.closePath(); },
        lin(g, 0, -24, 0, 14, [[0, '#4a3a6a'], [1, '#1a1428']]), 2.5);
      g.strokeStyle = 'rgba(180,150,230,0.5)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(14, 2); g.quadraticCurveTo(28, -12, 38, -16); g.stroke();
      g.restore();
    }
    longHair('#e8e4f4', '#9a90b8')(g);
    shape(g, () => { g.moveTo(34, 52); g.quadraticCurveTo(26, 74, 28, 88); g.quadraticCurveTo(48, 92, 68, 88); g.quadraticCurveTo(70, 74, 62, 52); g.quadraticCurveTo(48, 47, 34, 52); },
      lin(g, 0, 50, 0, 90, [[0, '#d8d0e8'], [1, '#5a4a7a']]), 2.5);
    g.strokeStyle = '#8a3aa0'; g.lineWidth = 2; g.beginPath(); g.moveTo(48, 54); g.lineTo(48, 88); g.stroke();
    oval(g, 48, 32, 22, 21, rad(g, 50, 34, 26, [[0, '#f4ecf8'], [1, '#c8bcd8']]));
    bangs('#f0ecff', '#a8a0c8', true)(g);
    eye(g, 40, 36, '#a02a5a'); eye(g, 54, 36, '#a02a5a');
    g.strokeStyle = OUT; g.lineWidth = 2; g.beginPath(); g.moveTo(34, 27); g.lineTo(44, 30); g.moveTo(60, 27); g.lineTo(50, 30); g.stroke();
    g.beginPath(); g.arc(47, 49, 3, 1.15 * Math.PI, 1.85 * Math.PI); g.stroke();
    g.save(); g.translate(46, 5); g.rotate(-0.25);   // 금 간 검은 고리
    g.strokeStyle = OUT; g.lineWidth = 6; g.beginPath(); g.ellipse(0, 0, 15, 4, 0, 0.4, TAU - 0.4); g.stroke();
    g.strokeStyle = '#5a3a7a'; g.lineWidth = 3; g.beginPath(); g.ellipse(0, 0, 15, 4, 0, 0.4, TAU - 0.4); g.stroke();
    g.restore();
    glowAt(g, 22, 64, 16, 'rgba(190,100,255,0.7)'); // 저주 구슬
    oval(g, 22, 64, 7, 7, rad(g, 22, 64, 8, [[0, '#ffffff'], [0.4, '#d090ff'], [1, '#6a2aa0']]), 2);
    oval(g, 29, 66, 4.6, 4.6, '#e8dcf0', 2);
  });
}

// ── 특수 몬스터: 해골 강령술사 (언데드를 되살림) ──
function drawNecromancer() {
  return vs(96, 96, g => {
    glowAt(g, 48, 56, 42, 'rgba(120,255,140,0.22)');
    shape(g, () => g.roundRect(19, 22, 4.5, 68, 2), '#4a3a2a', 2);   // 지팡이
    glowAt(g, 21, 12, 16, 'rgba(120,255,140,0.75)');
    shape(g, () => { g.moveTo(15, 17); g.quadraticCurveTo(13, 5, 21, -2); g.quadraticCurveTo(23, 7, 29, 5); g.quadraticCurveTo(31, 15, 25, 19); g.closePath(); }, lin(g, 0, 0, 0, 20, [[0, '#e0ffd0'], [1, '#3ad060']]), 2);
    oval(g, 21, 22, 7, 6, '#efe8d8', 2); oval(g, 18.5, 22, 1.8, 2, '#2a2a2a', 0); oval(g, 23.5, 22, 1.8, 2, '#2a2a2a', 0);
    shape(g, () => { g.moveTo(32, 46); g.quadraticCurveTo(24, 76, 26, 88); g.quadraticCurveTo(48, 92, 70, 88); g.quadraticCurveTo(72, 76, 64, 46); g.quadraticCurveTo(48, 40, 32, 46); },
      lin(g, 0, 44, 0, 90, [[0, '#4a2a6a'], [1, '#1e1030']]), 2.5);
    g.strokeStyle = '#8ad070'; g.lineWidth = 2; g.beginPath(); g.moveTo(34, 83); g.lineTo(62, 83); g.stroke();
    oval(g, 23, 58, 4.5, 4, '#efe8d8', 2);                             // 뼈 손
    shape(g, () => { g.moveTo(24, 46); g.quadraticCurveTo(20, 10, 50, 8); g.quadraticCurveTo(76, 10, 72, 46); g.quadraticCurveTo(48, 54, 24, 46); },
      lin(g, 0, 8, 0, 50, [[0, '#6a3a8a'], [1, '#2a1440']]), 2.5);
    oval(g, 47, 34, 17, 15, '#140a1c', 2);
    oval(g, 46, 33, 12, 11, lin(g, 0, 22, 0, 44, [[0, '#fbf6e8'], [1, '#d0c8b4']]), 2);
    oval(g, 41, 32, 3.5, 4, '#1a1a1a', 0); oval(g, 51, 32, 3.5, 4, '#1a1a1a', 0);
    glowAt(g, 41, 32, 6, 'rgba(120,255,140,0.9)'); glowAt(g, 51, 32, 6, 'rgba(120,255,140,0.9)');
    oval(g, 41, 32, 1.4, 1.6, '#c8ffc8', 0); oval(g, 51, 32, 1.4, 1.6, '#c8ffc8', 0);
    g.strokeStyle = OUT; g.lineWidth = 1.5; g.beginPath();
    for (let k = 0; k < 4; k++) { g.moveTo(41 + k * 3, 39); g.lineTo(41 + k * 3, 43); }
    g.stroke();
  });
}

// 모든 그림 준비. sprites/이름.png 파일이 있으면 그것을 우선 사용한다.
const SPR = {};
function loadSprites() {
  const built = {
    hero_m: drawBoy(),
    hero_f: drawGirl(),
    miru: drawAlly('miru', 1),
    serin: drawAlly('serin', 1),
    slime: drawSlime(),
    mushroom: drawMushroom(),
    bee: drawBee(),
    wisp: drawWisp(),
    toadstool: drawToadstool(),
    sprout: drawSprout(),
    slime_king: drawSlimeKing(),
    treant: drawTreant(),
    kai: drawAlly('kai', 1),
    cactus: drawCactus(),
    scorpion: drawScorpion(),
    mummy: drawMummy(),
    scorpion_queen: drawScorpionQueen(),
    gold_slime: drawGoldSlime(),
    golem: drawGolem(),
    imp: drawImp(),
    fallen_angel: drawFallenAngel(),
    necromancer: drawNecromancer(),
    tent: drawTent(),
    chest: drawChest(false),
    chest_full: drawChest(true),
    potion: drawPotion(),
    icon_weapon: drawSwordIcon(),
    icon_armor: drawArmorIcon(),
    icon_acc: drawRingIcon(),
  };
  Object.assign(SPR, built);
  // 이스터에그용 표정 그림: 이름_m1 (일자 입), 이름_m2 (거꾸로 미소)
  const moody = { hero_m: drawBoy, hero_f: drawGirl, miru: () => drawAlly('miru', 1), serin: () => drawAlly('serin', 1), kai: () => drawAlly('kai', 1), scorpion: drawScorpion, slime: drawSlime, mushroom: drawMushroom, bee: drawBee, wisp: drawWisp };
  for (const m of [1, 2]) {
    MOOD = m;
    for (const [k, f] of Object.entries(moody)) SPR[k + '_m' + m] = f();
  }
  MOOD = 0;
  return Promise.all(Object.keys(built).map(name => new Promise(done => {
    const img = new Image();
    img.onload = () => { SPR[name] = img; done(); };
    img.onerror = () => done();
    img.src = 'sprites/' + name + '.png';
  })));
}
