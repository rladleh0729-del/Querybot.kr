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
function smile(g, x, y, w = 4) { g.strokeStyle = OUT; g.lineWidth = 2; g.beginPath(); g.arc(x, y - 2, w, 0.25 * Math.PI, 0.75 * Math.PI); g.stroke(); }

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
    front: sword,
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

// 모든 그림 준비. sprites/이름.png 파일이 있으면 그것을 우선 사용한다.
const SPR = {};
function loadSprites() {
  const built = {
    hero_m: drawBoy(),
    hero_f: drawGirl(),
    miru: drawMiru(),
    serin: drawSerin(),
    slime: drawSlime(),
    mushroom: drawMushroom(),
    bee: drawBee(),
    wisp: drawWisp(),
    toadstool: drawToadstool(),
    sprout: drawSprout(),
    slime_king: drawSlimeKing(),
    treant: drawTreant(),
    tent: drawTent(),
    chest: drawChest(false),
    chest_full: drawChest(true),
    potion: drawPotion(),
    icon_weapon: drawSwordIcon(),
    icon_armor: drawArmorIcon(),
    icon_acc: drawRingIcon(),
  };
  Object.assign(SPR, built);
  return Promise.all(Object.keys(built).map(name => new Promise(done => {
    const img = new Image();
    img.onload = () => { SPR[name] = img; done(); };
    img.onerror = () => done();
    img.src = 'sprites/' + name + '.png';
  })));
}
