// 별의 설화 — 챕터 4~10 몬스터·보스 그림 (sprites.js 도구 사용, loadSprites가 STAR_EXTRA_SPR를 합침)
'use strict';
// 챕터 4 서리 설원 — 몬스터·보스 그림 (왼쪽을 봄)
(() => {
  const X = window.STAR_EXTRA_SPR = window.STAR_EXTRA_SPR || {};

  // 울퉁불퉁한 타원 둘레 (a0 → a1, 눈덩이·털 깃 모양). beginPath는 부르는 쪽에서
  function bumpy(g, cx, cy, rx, ry, a0, a1, n, bump) {
    const P = a => [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry];
    g.moveTo(...P(a0));
    for (let i = 1; i <= n; i++) {
      const a = a0 + (a1 - a0) * i / n, m = a - (a1 - a0) / n / 2;
      g.quadraticCurveTo(cx + Math.cos(m) * (rx + bump), cy + Math.sin(m) * (ry + bump), ...P(a));
    }
  }

  // 눈송이 (외곽선 + 색). branch: 작은 곁가지
  function flake(g, x, y, r, col, lw, branch) {
    for (const [c, w] of [[OUT, lw + 2], [col, lw]]) {
      g.strokeStyle = c; g.lineWidth = w; g.beginPath();
      for (let k = 0; k < 6; k++) {
        const a = k * Math.PI / 3 - Math.PI / 2;
        g.moveTo(x, y); g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
        if (!branch) continue;
        const bx = x + Math.cos(a) * r * 0.58, by = y + Math.sin(a) * r * 0.58;
        for (const d of [0.75, -0.75]) { g.moveTo(bx, by); g.lineTo(bx + Math.cos(a + d) * r * 0.34, by + Math.sin(a + d) * r * 0.34); }
      }
      g.stroke();
    }
  }

  // 반짝이 (네 갈래 빛)
  function glint(g, x, y, r) {
    glowAt(g, x, y, r * 2.2, 'rgba(220,245,255,0.8)');
    g.fillStyle = '#ffffff'; g.beginPath();
    g.moveTo(x, y - r); g.quadraticCurveTo(x, y, x + r * 0.7, y); g.quadraticCurveTo(x, y, x, y + r);
    g.quadraticCurveTo(x, y, x - r * 0.7, y); g.quadraticCurveTo(x, y, x, y - r); g.fill();
  }

  // 얼음 가시 (x, y 뿌리에서 ang 방향으로 len)
  function spike(g, x, y, len, w, ang, lw = 2) {
    g.save(); g.translate(x, y); g.rotate(ang);
    shape(g, () => { g.moveTo(-w, 2); g.lineTo(-w * 0.8, -len * 0.45); g.lineTo(0, -len); g.lineTo(w * 0.8, -len * 0.45); g.lineTo(w, 2); g.closePath(); },
      lin(g, 0, 0, 0, -len, [[0, '#7ec4f4'], [0.6, '#d6f2ff'], [1, '#ffffff']]), lw);
    g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = lw * 0.6;
    g.beginPath(); g.moveTo(w * 0.25, 0); g.lineTo(w * 0.15, -len * 0.75); g.stroke();
    g.restore();
  }

  // ── 눈덩이 정령: 나뭇가지 팔을 번쩍 든 동그란 눈덩이 ──
  X.snowball = () => vs(96, 96, g => {
    glowAt(g, 48, 58, 44, 'rgba(190,225,255,0.35)');
    g.lineCap = 'round';
    for (const [w, c] of [[5.5, OUT], [2.8, '#8a5a34']]) {          // 나뭇가지 팔
      g.strokeStyle = c; g.lineWidth = w; g.beginPath();
      g.moveTo(26, 62); g.lineTo(9, 49); g.moveTo(13, 52); g.lineTo(4, 53); g.moveTo(12, 51); g.lineTo(9, 42);
      g.moveTo(70, 62); g.lineTo(88, 49); g.moveTo(84, 52); g.lineTo(93, 54); g.moveTo(85, 51); g.lineTo(88, 42);
      g.stroke();
    }
    const body = () => {
      const a0 = 0.74 * Math.PI;
      bumpy(g, 48, 58, 30, 28, a0, 2.26 * Math.PI, 9, 6);
      g.quadraticCurveTo(48, 96, 48 + Math.cos(a0) * 30, 58 + Math.sin(a0) * 28);
    };
    shape(g, body, rad(g, 44, 54, 40, [[0, '#ffffff'], [0.5, '#eef6ff'], [1, '#aecaf0']]), 0);
    g.save(); g.beginPath(); body(); g.clip();
    g.fillStyle = 'rgba(120,160,225,0.25)'; g.beginPath(); g.ellipse(60, 88, 36, 15, 0, 0, TAU); g.fill();
    g.fillStyle = 'rgba(160,195,240,0.6)';                            // 눈 알갱이
    [[66, 42, 1.8], [73, 57, 1.5], [22, 52, 1.5], [64, 74, 1.7], [28, 79, 1.3], [57, 34, 1.2], [76, 70, 1.2]].forEach(([x, y, r]) => { g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); });
    g.restore();
    shape(g, body, null, 3);
    shine(g, 33, 41, 9, 4.5, 0.9); shine(g, 24, 52, 2.5, 1.8, 0.7);
    eye(g, 37, 58, '#3a78c8', 0.9); eye(g, 53, 58, '#3a78c8', 0.9);
    blush(g, 29, 68, 0.85); blush(g, 61, 68, 0.85);
    smile(g, 45, 71, 3);
    // 머리 위 눈송이 새싹
    g.strokeStyle = OUT; g.lineWidth = 2.5; g.beginPath(); g.moveTo(50, 31); g.quadraticCurveTo(52, 25, 50, 21); g.stroke();
    glowAt(g, 50, 14, 15, 'rgba(200,240,255,0.95)');
    flake(g, 50, 14, 8.5, '#c4ecff', 2.4, false);
    oval(g, 50, 14, 2.6, 2.6, '#ffffff', 1.5);
    glint(g, 84, 28, 4); glint(g, 12, 30, 3); glint(g, 86, 76, 2.5);
  });

  // ── 서리 늑대: 등에 얼음 가시, 말려 올라간 꼬리 ──
  X.icewolf = () => vs(96, 96, g => {
    const fur = (y0, y1) => lin(g, 0, y0, 0, y1, [[0, '#ffffff'], [0.55, '#d6e6fa'], [1, '#98b6e0']]);
    const furD = lin(g, 0, 70, 0, 90, [[0, '#b4cbea'], [1, '#86a4d2']]);
    // 꼬리
    shape(g, () => { g.moveTo(76, 70); g.quadraticCurveTo(97, 64, 93, 40); g.quadraticCurveTo(91, 25, 80, 21); g.quadraticCurveTo(85, 33, 81, 44); g.quadraticCurveTo(77, 54, 68, 58); g.closePath(); },
      lin(g, 0, 70, 0, 21, [[0, '#98b6e0'], [0.6, '#e4efff'], [1, '#ffffff']]), 2.5);
    g.strokeStyle = 'rgba(110,140,200,0.5)'; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(88, 52); g.quadraticCurveTo(90, 42, 86, 33); g.stroke();
    // 다리 (먼 쪽은 어둡게)
    shape(g, () => g.roundRect(34, 70, 10, 18, 5), furD, 2.5); shape(g, () => g.roundRect(62, 70, 10, 18, 5), furD, 2.5);
    shape(g, () => g.roundRect(44, 72, 11, 16, 5), fur(70, 90), 2.5); shape(g, () => g.roundRect(72, 72, 11, 16, 5), fur(70, 90), 2.5);
    oval(g, 49.5, 87.5, 7, 3.4, '#ffffff', 2); oval(g, 77.5, 87.5, 7, 3.4, '#ffffff', 2);
    // 등의 얼음 가시
    spike(g, 50, 54, 15, 4, -0.4); spike(g, 61, 51, 20, 4.6, 0.05); spike(g, 72, 54, 14, 4, 0.45);
    // 몸통
    oval(g, 60, 64, 24, 15, fur(49, 80), 3);
    oval(g, 56, 73, 13, 5, 'rgba(255,255,255,0.85)', 0);
    shine(g, 64, 56, 8, 2.6, 0.55, -0.1);
    // 복슬복슬 목털
    shape(g, () => { bumpy(g, 42, 64, 14, 11, 0, TAU, 10, 3.5); g.closePath(); }, lin(g, 0, 52, 0, 78, [[0, '#ffffff'], [1, '#e2ecfa']]), 2.5);
    // 귀와 머리
    shape(g, () => { g.moveTo(17, 42); g.lineTo(14, 17); g.lineTo(31, 33); g.closePath(); }, fur(17, 42), 2.5);
    shape(g, () => { g.moveTo(19.5, 37); g.lineTo(17.5, 24); g.lineTo(27, 33); g.closePath(); }, '#ffc8d8', 0);
    shape(g, () => { g.moveTo(33, 33); g.lineTo(46, 14); g.lineTo(48, 39); g.closePath(); }, fur(14, 39), 2.5);
    shape(g, () => { g.moveTo(36.5, 32.5); g.lineTo(44.5, 21); g.lineTo(45.5, 35); g.closePath(); }, '#ffc8d8', 0);
    oval(g, 31, 49, 20, 18, fur(31, 67), 3);
    shape(g, () => { g.moveTo(31, 33); g.lineTo(34, 37.5); g.lineTo(31, 42); g.lineTo(28, 37.5); g.closePath(); }, '#8fd8ff', 1.5);   // 이마 서리 무늬
    // 주둥이와 얼굴
    oval(g, 15, 57.5, 9.5, 6.8, lin(g, 0, 50, 0, 65, [[0, '#ffffff'], [1, '#dce8f8']]), 2.5);
    oval(g, 6.5, 54.5, 3.4, 2.7, '#3b2a3a', 1.5); shine(g, 5.6, 53.6, 1.3, 0.8, 0.8, 0);
    eye(g, 25, 46, '#3a88d8', 0.78); eye(g, 38.5, 46, '#3a88d8', 0.78);
    g.strokeStyle = OUT; g.lineWidth = 2;
    g.beginPath(); g.moveTo(20, 38.5); g.lineTo(28, 40.5); g.moveTo(43, 38.5); g.lineTo(35.5, 40.5); g.stroke();
    blush(g, 29, 56.5, 0.62); blush(g, 43, 54, 0.62);
    smile(g, 14, 61.6, 2.4);
    shape(g, () => { g.moveTo(15.8, 61.6); g.lineTo(17, 64.6); g.lineTo(18.2, 61.4); g.closePath(); }, '#ffffff', 1.2);
    // 차가운 입김
    glowAt(g, 4, 67, 8, 'rgba(225,245,255,0.95)');
    oval(g, 5, 67, 2.6, 2.2, 'rgba(240,250,255,0.9)', 0); oval(g, 2, 72, 1.6, 1.4, 'rgba(240,250,255,0.8)', 0);
  });

  // ── 눈부엉이: 날개를 펼친 하얀 부엉이, 깃털을 날림 ──
  X.snowowl = () => vs(96, 96, g => {
    glowAt(g, 48, 54, 44, 'rgba(200,230,255,0.35)');
    const wing = lin(g, 0, 20, 0, 66, [[0, '#ffffff'], [1, '#b4c6e6']]);
    // 날개 (깃 끝이 물결)
    shape(g, () => { g.moveTo(62, 46); g.quadraticCurveTo(76, 20, 93, 17); g.quadraticCurveTo(94, 28, 89, 33); g.quadraticCurveTo(93, 40, 85, 44); g.quadraticCurveTo(88, 51, 79, 54); g.quadraticCurveTo(78, 62, 66, 64); g.closePath(); }, wing, 2.5);
    shape(g, () => { g.moveTo(32, 46); g.quadraticCurveTo(19, 20, 3, 17); g.quadraticCurveTo(2, 28, 7, 33); g.quadraticCurveTo(3, 40, 11, 44); g.quadraticCurveTo(8, 51, 17, 54); g.quadraticCurveTo(18, 62, 30, 64); g.closePath(); }, wing, 2.5);
    g.strokeStyle = 'rgba(110,135,190,0.5)'; g.lineWidth = 1.5; g.beginPath();
    g.moveTo(66, 50); g.lineTo(87, 36); g.moveTo(67, 56); g.lineTo(81, 48); g.moveTo(30, 50); g.lineTo(9, 36); g.moveTo(29, 56); g.lineTo(15, 48);
    g.stroke();
    [[90, 22], [86, 38], [6, 22], [10, 38]].forEach(([x, y]) => oval(g, x, y, 1.6, 1.6, 'rgba(90,110,170,0.55)', 0));
    // 귀깃
    shape(g, () => { g.moveTo(31, 37); g.lineTo(27, 22); g.lineTo(39, 31); g.closePath(); }, '#eef4ff', 2);
    shape(g, () => { g.moveTo(55, 30); g.lineTo(63, 19); g.lineTo(64, 35); g.closePath(); }, '#eef4ff', 2);
    // 발 (몸 뒤로 살짝)
    oval(g, 40, 85, 5, 3.6, '#f0b040', 2); oval(g, 54, 85, 5, 3.6, '#f0b040', 2);
    // 몸통
    shape(g, () => { g.moveTo(47, 26); g.bezierCurveTo(70, 26, 74, 60, 68, 75); g.quadraticCurveTo(47, 90, 26, 75); g.bezierCurveTo(20, 60, 24, 26, 47, 26); },
      lin(g, 0, 26, 0, 86, [[0, '#ffffff'], [0.6, '#eef3fc'], [1, '#c8d4ee']]), 3);
    g.strokeStyle = 'rgba(100,120,175,0.55)'; g.lineWidth = 1.6; g.beginPath();   // 가슴 무늬
    [[38, 70], [48, 73], [58, 69], [33, 63], [43, 66], [53, 66], [62, 61]].forEach(([x, y]) => { g.moveTo(x - 2.6, y - 2); g.lineTo(x, y); g.lineTo(x + 2.6, y - 2); });
    g.stroke();
    shine(g, 33, 36, 6, 2.6, 0.75, -0.6);
    // 얼굴 테
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(38, 49, 11, 0, TAU); g.arc(53, 49, 11, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(150,170,215,0.7)'; g.lineWidth = 1.5; g.beginPath(); g.arc(38, 49, 11, 0.6, 4.4); g.stroke();
    g.beginPath(); g.arc(53, 49, 11, -1.3, 2.6); g.stroke();
    eye(g, 38, 49, '#e8a020', 0.95); eye(g, 53, 49, '#e8a020', 0.95);
    shape(g, () => { g.moveTo(43, 55); g.lineTo(48.5, 55); g.lineTo(45, 61); g.closePath(); }, '#f2b444', 1.5);
    blush(g, 29, 59, 0.7); blush(g, 61, 59, 0.7);
    smile(g, 45.5, 66, 2.2);
    // 날아가는 깃털 (원거리 공격)
    glowAt(g, 11, 74, 11, 'rgba(200,240,255,0.85)');
    g.save(); g.translate(11, 74); g.rotate(-0.9);
    shape(g, () => { g.moveTo(0, -9); g.quadraticCurveTo(5, -2, 0, 9); g.quadraticCurveTo(-5, -2, 0, -9); }, '#f4f9ff', 1.5);
    g.strokeStyle = 'rgba(120,150,210,0.8)'; g.lineWidth = 1; g.beginPath(); g.moveTo(0, -7); g.lineTo(0, 11); g.stroke();
    g.restore();
  });

  // ── 보스: 서리 여왕 (192×192) — 얼음 날개, 결정 왕관, 눈꽃 홀, 가슴에 별조각 ──
  X.frost_queen = () => vs(192, 192, g => {
    glowAt(g, 104, 96, 96, 'rgba(170,215,255,0.42)');
    // 등 뒤 얼음 날개
    g.globalAlpha = 0.92;
    [[-0.15, 66, 9], [0.42, 82, 10], [0.98, 70, 9], [1.5, 50, 8]].forEach(([a, len, w]) => spike(g, 124, 90, len, w, a, 3));
    g.globalAlpha = 1;
    // 뒷머리 (길게 흘러내림)
    const hair = lin(g, 0, 22, 0, 150, [[0, '#f8f4ff'], [0.5, '#c6cbf0'], [1, '#8f98d4']]);
    shape(g, () => {
      g.moveTo(62, 52); g.quadraticCurveTo(56, 20, 90, 22); g.quadraticCurveTo(126, 22, 124, 56);
      g.quadraticCurveTo(130, 100, 152, 132); g.quadraticCurveTo(138, 140, 122, 132); g.quadraticCurveTo(110, 104, 108, 84);
      g.lineTo(72, 84); g.quadraticCurveTo(66, 98, 58, 106); g.quadraticCurveTo(52, 80, 62, 52);
    }, hair, 3);
    g.strokeStyle = 'rgba(120,130,200,0.45)'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(122, 70); g.quadraticCurveTo(126, 104, 142, 128); g.moveTo(114, 84); g.quadraticCurveTo(118, 108, 128, 126); g.stroke();
    // 드레스 (고드름 밑단)
    const hem = [[158, 176], [150, 185], [140, 177], [129, 186], [118, 177], [106, 186], [94, 177], [82, 186], [70, 177], [58, 185], [46, 177], [38, 183], [33, 176]];
    shape(g, () => { g.moveTo(80, 100); g.lineTo(113, 100); g.quadraticCurveTo(128, 142, 158, 176); hem.forEach(([x, y]) => g.lineTo(x, y)); g.quadraticCurveTo(62, 140, 80, 100); },
      lin(g, 0, 100, 0, 186, [[0, '#d4e9ff'], [0.5, '#93bdf0'], [1, '#5f86cc']]), 3.5);
    g.strokeStyle = 'rgba(60,90,170,0.32)'; g.lineWidth = 3; g.beginPath();
    g.moveTo(88, 108); g.quadraticCurveTo(80, 140, 70, 176); g.moveTo(98, 108); g.lineTo(98, 176); g.moveTo(106, 108); g.quadraticCurveTo(116, 140, 128, 176);
    g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 2.5; g.beginPath();
    g.moveTo(40, 174); hem.slice().reverse().forEach(([x, y]) => g.lineTo(x, y - 6)); g.stroke();
    [[66, 158, 6], [120, 148, 5], [140, 168, 4.5], [92, 138, 4.5], [84, 166, 4]].forEach(([x, y, r]) => {
      g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 1.5; g.beginPath();
      for (let k = 0; k < 3; k++) { const a = k * Math.PI / 3; g.moveTo(x - Math.cos(a) * r, y - Math.sin(a) * r); g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); }
      g.stroke();
    });
    // 몸통과 허리띠
    shape(g, () => { g.moveTo(77, 80); g.quadraticCurveTo(96, 74, 115, 80); g.lineTo(116, 104); g.quadraticCurveTo(96, 110, 77, 104); g.closePath(); },
      lin(g, 0, 76, 0, 106, [[0, '#a8c8f6'], [1, '#5a80d0']]), 3);
    shape(g, () => g.roundRect(77, 100, 39, 8, 4), '#3f5cb8', 2.5);
    // 서리 깃 (어깨 털)
    shape(g, () => { bumpy(g, 96, 82, 30, 8, 0, TAU, 12, 4); g.closePath(); }, lin(g, 0, 72, 0, 92, [[0, '#ffffff'], [1, '#cfe2fa']]), 2.5);
    // 가슴의 별조각
    glowAt(g, 97, 92, 34, 'rgba(180,235,255,0.6)');
    oval(g, 97, 94, 10, 12, lin(g, 0, 82, 0, 106, [[0, '#4a62b0'], [1, '#22306a']]), 2.5);
    glowAt(g, 97, 92, 11, 'rgba(160,235,255,0.9)');
    shape(g, () => { g.moveTo(93, 102); g.lineTo(94.5, 88); g.lineTo(99, 80); g.lineTo(102.5, 92); g.lineTo(100.5, 102); g.closePath(); }, lin(g, 92, 80, 103, 102, [[0, '#ffffff'], [0.5, '#c8f2ff'], [1, '#6ccaf4']]), 2);
    g.strokeStyle = 'rgba(255,255,255,0.95)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(99, 81); g.lineTo(97.5, 101); g.stroke();
    shine(g, 95.8, 91, 1.2, 3.5, 0.95, 0.2);
    // 눈꽃 홀 (앞쪽 손)
    shape(g, () => g.roundRect(48, 50, 6, 132, 3), lin(g, 48, 0, 54, 0, [[0, '#ffffff'], [1, '#9cc8ee']]), 2.5);
    glowAt(g, 51, 40, 30, 'rgba(190,240,255,0.9)');
    flake(g, 51, 40, 16, '#d8f4ff', 3, true);
    oval(g, 51, 40, 5, 5, rad(g, 51, 40, 6, [[0, '#ffffff'], [1, '#5ab8f0']]), 2);
    shape(g, () => { g.moveTo(78, 84); g.quadraticCurveTo(62, 94, 54, 110); g.lineTo(66, 117); g.quadraticCurveTo(74, 102, 88, 94); g.closePath(); }, '#bcd9fa', 2.5);
    oval(g, 54, 112, 6.5, 6, '#fff4f6', 2.5);
    // 얼굴
    oval(g, 90, 56, 29, 27, rad(g, 92, 58, 32, [[0, '#fffafc'], [1, '#ecdff0']]), 3);
    // 앞머리와 옆머리
    shape(g, () => {
      g.moveTo(61, 58); g.quadraticCurveTo(58, 26, 90, 25); g.quadraticCurveTo(121, 26, 119, 56);
      g.lineTo(113, 42); g.lineTo(105, 51); g.lineTo(99, 38); g.lineTo(89, 49); g.lineTo(81, 36); g.lineTo(73, 48); g.lineTo(67, 40); g.closePath();
    }, hair, 3);
    shape(g, () => { g.moveTo(62, 50); g.quadraticCurveTo(55, 72, 60, 94); g.lineTo(66, 78); g.quadraticCurveTo(67, 62, 67, 52); g.closePath(); }, hair, 2.5);
    shine(g, 82, 31, 10, 3, 0.55, -0.15);
    // 얼음 왕관
    shape(g, () => {
      g.moveTo(68, 34); g.lineTo(65, 14); g.lineTo(76, 26); g.lineTo(82, 6); g.lineTo(89, 24); g.lineTo(95, 1);
      g.lineTo(101, 24); g.lineTo(108, 7); g.lineTo(113, 27); g.lineTo(121, 15); g.lineTo(119, 36); g.quadraticCurveTo(94, 27, 68, 34);
    }, lin(g, 0, 2, 0, 36, [[0, '#ffffff'], [0.5, '#dff4ff'], [1, '#93ccf4']]), 2.5);
    g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 1.5; g.beginPath();
    g.moveTo(82, 10); g.lineTo(83, 24); g.moveTo(95, 5); g.lineTo(96, 24); g.moveTo(108, 11); g.lineTo(107, 25); g.stroke();
    oval(g, 95, 27, 4, 5, rad(g, 95, 27, 5, [[0, '#e8fbff'], [1, '#3a9ae8']]), 2);
    // 눈·눈썹·속눈썹
    eye(g, 76, 61, '#4a90e0', 1.5); eye(g, 100, 61, '#4a90e0', 1.5);
    g.strokeStyle = OUT; g.lineWidth = 2.5; g.beginPath();
    g.moveTo(69, 54); g.lineTo(65, 50); g.moveTo(107, 54); g.lineTo(111, 50);
    g.moveTo(69, 46); g.quadraticCurveTo(76, 42, 82, 45); g.moveTo(94, 45); g.quadraticCurveTo(100, 42, 107, 46);
    g.stroke();
    blush(g, 70, 73, 1.1); blush(g, 107, 73, 1.1);
    smile(g, 87, 78, 4);
    shape(g, () => { g.moveTo(111, 63); g.lineTo(113, 66); g.lineTo(111, 69); g.lineTo(109, 66); g.closePath(); }, '#8fd8ff', 1.2);   // 얼음 점
    // 곁에 떠 있는 얼음 결정
    [[22, 92, 1], [174, 140, 0.9]].forEach(([x, y, s]) => {
      glowAt(g, x, y, 16 * s, 'rgba(190,240,255,0.8)');
      shape(g, () => { g.moveTo(x, y - 10 * s); g.lineTo(x + 5.5 * s, y); g.lineTo(x, y + 10 * s); g.lineTo(x - 5.5 * s, y); g.closePath(); }, lin(g, 0, y - 10 * s, 0, y + 10 * s, [[0, '#ffffff'], [1, '#86c8f4']]), 2);
      shine(g, x - 1.5 * s, y - 3 * s, 1.2 * s, 3 * s, 0.9, 0.3);
    });
    glint(g, 26, 22, 5); glint(g, 178, 174, 4.5); glint(g, 16, 150, 4); glint(g, 170, 26, 3.5);
  });
})();

// 챕터 5 산호 바다 — 몬스터·보스 그림
(() => {
  const X = window.STAR_EXTRA_SPR = window.STAR_EXTRA_SPR || {};

  // 지지직 번개 (외곽선 + 노란 빛)
  function zap(g, pts) {
    const path = () => { g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); };
    pts.forEach(([x, y]) => glowAt(g, x, y, 7, 'rgba(255,240,120,0.45)'));
    path(); g.strokeStyle = OUT; g.lineWidth = 4; g.stroke();
    path(); g.strokeStyle = '#fff27a'; g.lineWidth = 2; g.stroke();
  }

  // 물방울
  function bubble(g, x, y, r) {
    g.fillStyle = 'rgba(200,240,255,0.3)'; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(235,252,255,0.95)'; g.lineWidth = 1.6; g.stroke();
    shine(g, x - r * 0.35, y - r * 0.35, r * 0.32, r * 0.2, 0.9, -0.6);
  }

  // 꿈틀대는 촉수: 점들을 지나는 부드러운 곡선, 끝으로 갈수록 가늘어짐. side = 빨판 쪽
  function tentacle(g, pts, w0, w1, stops, side) {
    const P = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
      for (let k = 0; k < 8; k++) {
        const t = k / 8, t2 = t * t, t3 = t2 * t;
        P.push([0, 1].map(j => 0.5 * (2 * p1[j] + (p2[j] - p0[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (3 * p1[j] - p0[j] - 3 * p2[j] + p3[j]) * t3)));
      }
    }
    P.push(pts[pts.length - 1]);
    const n = P.length, N = P.map((p, i) => {
      const a = P[Math.max(0, i - 1)], b = P[Math.min(n - 1, i + 1)], d = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      return [-(b[1] - a[1]) / d, (b[0] - a[0]) / d, w0 + (w1 - w0) * Math.pow(i / (n - 1), 0.85)];
    });
    const side1 = P.map((p, i) => [p[0] + N[i][0] * N[i][2], p[1] + N[i][1] * N[i][2]]);
    const side2 = P.map((p, i) => [p[0] - N[i][0] * N[i][2], p[1] - N[i][1] * N[i][2]]).reverse();
    const outline = () => [...side1, ...side2].forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y));
    shape(g, () => { outline(); g.closePath(); }, lin(g, P[0][0], P[0][1], P[n - 1][0], P[n - 1][1], stops), 0);
    shape(g, outline, null, 3);   // 밑동 쪽은 열어 둬서 몸에서 자연스럽게 이어짐
    // 등쪽 빛
    g.strokeStyle = 'rgba(255,225,250,0.5)'; g.lineWidth = Math.max(1.5, w0 * 0.2);
    g.beginPath();
    for (let i = 1; i < n * 0.75; i++) { const x = P[i][0] - N[i][0] * N[i][2] * 0.5 * side, y = P[i][1] - N[i][1] * N[i][2] * 0.5 * side; i > 1 ? g.lineTo(x, y) : g.moveTo(x, y); }
    g.stroke();
    // 빨판
    for (let i = 3; i < n - 4; i += 3) {
      const [nx, ny, w] = N[i];
      oval(g, P[i][0] + nx * w * 0.5 * side, P[i][1] + ny * w * 0.5 * side, w * 0.3, w * 0.3, '#ffd8ee', 1.2);
    }
  }

  // ── 소라게 기사: 소라 껍데기 + 작은 투구 + 기사 창 ──
  X.crab = () => vs(96, 96, g => {
    // 소라 껍데기: 고리 다섯 개를 한 덩어리로 (굵은 외곽선 → 채우기 → 이음선)
    const WH = [[88, 8.5, 4.5, 3.6, 0.6], [85, 15, 8, 6.5, 0.55], [80, 26, 13, 10, 0.5], [73, 42, 19, 15, 0.42], [63, 64, 27, 24, 0.3]];
    WH.forEach(([x, y, rx, ry, r]) => oval(g, x, y, rx, ry, null, 5.5, r));
    WH.forEach(([x, y, rx, ry, r]) => { g.fillStyle = rad(g, x, y, Math.max(rx, ry) * 1.05, [[0, '#fff4ea'], [0.5, '#ffb4a4'], [1, '#e0687e']]); g.beginPath(); g.ellipse(x, y, rx, ry, r, 0, TAU); g.fill(); });
    WH.slice(1).forEach(([x, y, rx, ry, r]) => {
      g.strokeStyle = 'rgba(200,80,110,0.4)'; g.lineWidth = 2.5;
      g.beginPath(); g.ellipse(x, y, rx * 0.72, ry * 0.72, r, -2.4, -0.5); g.stroke();
      g.strokeStyle = OUT; g.lineWidth = 2;
      g.beginPath(); g.ellipse(x, y, rx, ry, r, -2.35, -0.55); g.stroke();
    });
    [[80, 37], [88, 50], [86, 66], [76, 82], [86, 22]].forEach(([x, y]) => oval(g, x, y, 2.4, 2, '#fff0e6', 1.2));
    shine(g, 72, 50, 7, 3.2, 0.55, -0.5); shine(g, 79, 31, 4, 2, 0.5, -0.5);
    // 껍데기 입구
    oval(g, 46, 66, 15, 20, '#ffe8dc', 2.5);
    oval(g, 46, 67, 11, 16, '#8a3a4a', 2);
    // 작은 다리
    [[35, 85, 0.5], [46, 86, 0.15], [57, 85, -0.3]].forEach(([x, y, r]) => oval(g, x, y, 3.5, 6, lin(g, 0, y - 6, 0, y + 6, [[0, '#ff9a6a'], [1, '#d0503a']]), 2, r));
    // 몸통과 얼굴
    oval(g, 40, 64, 18, 16, lin(g, 0, 48, 0, 80, [[0, '#ffb07a'], [1, '#e0583e']]), 2.5);
    eye(g, 33, 65, '#5a1a1a', 0.82); eye(g, 47, 65, '#5a1a1a', 0.82);
    blush(g, 27, 73, 0.65); blush(g, 53, 73, 0.65);
    smile(g, 40, 76, 2.8);
    // 작은 투구 + 깃털
    shape(g, () => { g.moveTo(39, 44); g.quadraticCurveTo(44, 27, 64, 27); g.quadraticCurveTo(53, 33, 49, 45); g.closePath(); }, lin(g, 0, 27, 0, 45, [[0, '#ff7a8a'], [1, '#d03a50']]), 2);
    shape(g, () => { g.moveTo(23, 56); g.bezierCurveTo(21, 37, 59, 35, 57, 56); g.closePath(); }, lin(g, 0, 40, 0, 56, [[0, '#ffffff'], [0.5, '#c8d2e4'], [1, '#7c88a0']]), 2.5);
    shape(g, () => g.roundRect(21, 52, 38, 6, 3), lin(g, 0, 52, 0, 58, [[0, '#fff0a0'], [1, '#c8902a']]), 2);
    shine(g, 33, 45, 5, 2.5, 0.8, -0.4);
    // 기사 창 (비스듬히 세워 듦)
    g.save(); g.translate(26, 78); g.rotate(0.95);
    shape(g, () => g.roundRect(-2, -2.2, 18, 4.4, 2), '#8a5a3a', 1.8);
    const cone = () => { g.moveTo(-4, -6.5); g.lineTo(-38, 0); g.lineTo(-4, 6.5); g.closePath(); };
    shape(g, cone, lin(g, 0, -6, 0, 6, [[0, '#ffffff'], [1, '#9aa6bc']]), 0);
    g.save(); g.beginPath(); cone(); g.clip();
    g.strokeStyle = 'rgba(220,60,90,0.85)'; g.lineWidth = 3.2;
    [-11, -20, -29].forEach(x => { g.beginPath(); g.moveTo(x + 3, -8); g.lineTo(x - 3, 8); g.stroke(); });
    g.restore();
    shape(g, cone, null, 2);
    oval(g, -4, 0, 2.6, 9, lin(g, 0, -9, 0, 9, [[0, '#fff3b0'], [1, '#c8902a']]), 2);
    g.restore();
    // 창을 쥔 집게
    oval(g, 27.5, 80, 6.5, 4, '#ff9a6a', 2, -0.9); oval(g, 32, 83.5, 6.5, 4, '#e8703e', 2, -0.6);
  });

  // ── 번개 해파리: 투명한 갓 + 번개 뿔 + 찌릿한 촉수 (원거리) ──
  X.jelly = () => vs(96, 96, g => {
    glowAt(g, 46, 48, 46, 'rgba(150,215,255,0.4)');
    // 가는 촉수 (오른쪽으로 흘러감)
    [[26, 0], [36, 1.3], [56, 2.6], [66, 3.9]].forEach(([x0, ph]) => {
      const path = () => { g.beginPath(); for (let k = 0; k <= 12; k++) { const t = k / 12, x = x0 + t * 12 + Math.sin(t * 7 + ph) * 3.5, y = 54 + t * 33; k ? g.lineTo(x, y) : g.moveTo(x, y); } };
      path(); g.strokeStyle = OUT; g.lineWidth = 4.5; g.stroke();
      path(); g.strokeStyle = '#d8c0ff'; g.lineWidth = 2.2; g.stroke();
    });
    // 주름진 입 팔
    shape(g, () => { g.moveTo(38, 54); g.quadraticCurveTo(34, 64, 41, 70); g.quadraticCurveTo(36, 78, 46, 86); g.quadraticCurveTo(52, 78, 49, 72); g.quadraticCurveTo(55, 64, 52, 54); g.closePath(); },
      lin(g, 0, 54, 0, 86, [[0, '#ffd0f0'], [1, '#b890ff']]), 2);
    // 머리 위 번개 뿔
    glowAt(g, 50, 10, 13, 'rgba(255,240,120,0.85)');
    shape(g, () => { g.moveTo(52, 2); g.lineTo(44, 11); g.lineTo(49, 11.5); g.lineTo(45, 20); g.lineTo(57, 8); g.lineTo(51.5, 8); g.lineTo(55, 2); g.closePath(); }, '#ffe85a', 2);
    // 갓 (아래 가장자리 물결)
    shape(g, () => {
      g.moveTo(16, 54); g.bezierCurveTo(12, 24, 30, 11, 46, 11); g.bezierCurveTo(62, 11, 80, 24, 76, 54);
      for (let k = 0; k < 6; k++) { const x0 = 76 - k * 10; g.quadraticCurveTo(x0 - 5, 61, x0 - 10, 54); }
      g.closePath();
    }, lin(g, 0, 11, 0, 60, [[0, '#f4fcff'], [0.45, '#b4e2ff'], [1, '#a890ff']]), 2.5);
    // 얼굴
    eye(g, 37, 33, '#4a3ab0', 0.85); eye(g, 53, 33, '#4a3ab0', 0.85);
    blush(g, 31, 42, 0.7); blush(g, 59, 42, 0.7);
    smile(g, 45, 44, 2.8);
    shine(g, 27, 21, 7, 3.5, 0.8, -0.6); shine(g, 21, 31, 2.4, 1.6, 0.6);
    // 찌릿찌릿
    zap(g, [[13, 58], [7, 64], [12, 66], [4, 75]]);
    zap(g, [[83, 60], [89, 66], [83, 69], [91, 78]]);
  });

  // ── 상어 전사: 지느러미 + 머리띠 + 삼지창 ──
  X.sharkman = () => vs(96, 96, g => {
    const skin = (y0, y1) => lin(g, 0, y0, 0, y1, [[0, '#a4ccf4'], [0.55, '#5f8fd0'], [1, '#3e66a8']]);
    // 꼬리지느러미와 등지느러미
    shape(g, () => { g.moveTo(70, 72); g.quadraticCurveTo(82, 62, 90, 46); g.quadraticCurveTo(87, 64, 93, 80); g.quadraticCurveTo(82, 76, 70, 78); g.closePath(); }, skin(46, 80), 2.5);
    shape(g, () => { g.moveTo(48, 28); g.quadraticCurveTo(58, 12, 72, 4); g.quadraticCurveTo(66, 18, 70, 32); g.closePath(); }, skin(4, 32), 2.5);
    // 다리
    shape(g, () => g.roundRect(35, 74, 11, 12, 4), '#5a84c0', 2.5); shape(g, () => g.roundRect(54, 74, 11, 12, 4), '#5a84c0', 2.5);
    oval(g, 39, 87, 7.5, 3.5, '#3a5a90', 2); oval(g, 60, 87, 7.5, 3.5, '#3a5a90', 2);
    // 몸통 (뾰족한 주둥이가 왼쪽)
    const body = () => { g.moveTo(14, 52); g.bezierCurveTo(16, 30, 38, 22, 54, 24); g.bezierCurveTo(72, 26, 80, 44, 78, 60); g.bezierCurveTo(77, 76, 66, 82, 48, 82); g.bezierCurveTo(30, 82, 22, 75, 21, 64); g.quadraticCurveTo(15, 60, 14, 52); g.closePath(); };
    shape(g, body, skin(22, 82), 0);
    g.save(); g.beginPath(); body(); g.clip();
    g.fillStyle = lin(g, 0, 56, 0, 82, [[0, '#ffffff'], [1, '#d8e4f4']]);
    g.beginPath(); g.ellipse(36, 75, 24, 17, -0.15, 0, TAU); g.fill();
    g.fillStyle = lin(g, 0, 26, 0, 42, [[0, '#ff6a6a'], [1, '#c83a3c']]);
    g.beginPath(); g.moveTo(10, 36); g.lineTo(84, 25); g.lineTo(84, 32); g.lineTo(10, 43); g.closePath(); g.fill();
    g.restore();
    shape(g, body, null, 3);
    // 머리띠 매듭 끈
    shape(g, () => { g.moveTo(76, 28); g.quadraticCurveTo(88, 22, 95, 28); g.quadraticCurveTo(86, 29, 78, 34); g.closePath(); }, '#e8484a', 2);
    shape(g, () => { g.moveTo(76, 31); g.quadraticCurveTo(87, 33, 91, 42); g.quadraticCurveTo(83, 38, 76, 35); g.closePath(); }, '#c83a3c', 2);
    // 아가미
    g.strokeStyle = 'rgba(30,50,100,0.5)'; g.lineWidth = 2;
    [58, 63, 68].forEach(x => { g.beginPath(); g.moveTo(x, 48); g.quadraticCurveTo(x - 3, 54, x, 60); g.stroke(); });
    // 얼굴
    eye(g, 29, 48, '#1a3a6a', 0.8); eye(g, 43, 47, '#1a3a6a', 0.8);
    g.strokeStyle = OUT; g.lineWidth = 2.5; g.beginPath(); g.moveTo(23, 40.5); g.lineTo(32, 42.5); g.moveTo(49, 39); g.lineTo(40, 41.5); g.stroke();
    blush(g, 23, 57, 0.65); blush(g, 48, 56, 0.65);
    smile(g, 35, 61, 4);
    [[32, 61.5], [37.5, 62]].forEach(([x, y]) => shape(g, () => { g.moveTo(x - 1.6, y); g.lineTo(x, y + 3.2); g.lineTo(x + 1.6, y); g.closePath(); }, '#ffffff', 1.2));
    shine(g, 42, 31, 9, 3.5, 0.55, -0.25);
    // 삼지창
    shape(g, () => g.roundRect(5.5, 18, 3.5, 72, 1.5), lin(g, 5, 0, 9, 0, [[0, '#d8a050'], [1, '#8a5a2a']]), 1.8);
    const gold = lin(g, 0, 0, 0, 20, [[0, '#fff3b0'], [1, '#c8902a']]);
    shape(g, () => { g.moveTo(1, 9); g.lineTo(2.2, 3.5); g.lineTo(3.6, 9); g.quadraticCurveTo(3.8, 16, 7.25, 16); g.quadraticCurveTo(10.7, 16, 10.9, 9); g.lineTo(12.3, 3.5); g.lineTo(13.5, 9); g.quadraticCurveTo(13.5, 20, 7.25, 20); g.quadraticCurveTo(1, 20, 1, 9); g.closePath(); }, gold, 1.8);
    shape(g, () => { g.moveTo(5.4, 19); g.lineTo(5.4, 9); g.lineTo(7.25, 2); g.lineTo(9.1, 9); g.lineTo(9.1, 19); g.closePath(); }, gold, 1.8);
    // 지느러미 손
    oval(g, 15, 66, 9, 5.5, skin(60, 72), 2.5, -0.45);
  });

  // ── 보스: 심해의 크라켄 (가라앉은 해적 모자 + 머리에 박힌 별조각) ──
  X.kraken = () => vs(192, 192, g => {
    glowAt(g, 100, 110, 96, 'rgba(150,110,255,0.28)');
    const back = [[0, '#7a2a90'], [0.4, '#b04ab0'], [1, '#5a1a78']], front = [[0, '#b448ac'], [0.35, '#f080d0'], [1, '#9a3aa8']];
    // 뒤쪽 촉수
    tentacle(g, [[150, 132], [172, 112], [178, 86], [171, 64], [158, 62], [156, 75], [165, 79]], 15, 2.5, back, 1);
    // 머리 (뒤로 기울어진 둥근 몸통)
    const head = () => { g.moveTo(50, 152); g.bezierCurveTo(30, 122, 32, 66, 72, 46); g.bezierCurveTo(100, 28, 150, 22, 168, 54); g.bezierCurveTo(184, 82, 164, 118, 152, 152); g.quadraticCurveTo(100, 168, 50, 152); g.closePath(); };
    shape(g, head, rad(g, 108, 84, 92, [[0, '#ffc4ee'], [0.45, '#d868c8'], [1, '#6e2486']]), 4);
    [[118, 50, 8], [146, 62, 6], [96, 44, 5], [134, 82, 4], [58, 82, 4], [164, 80, 4]].forEach(([x, y, r]) => oval(g, x, y, r, r * 0.85, 'rgba(255,205,242,0.6)', 0));
    shine(g, 82, 62, 16, 7, 0.4, -0.6); shine(g, 64, 80, 4, 3, 0.5, -0.6);
    // 몸에 박힌 별조각
    g.strokeStyle = 'rgba(200,245,255,0.7)'; g.lineWidth = 2;
    [[143, 110, 132, 117], [156, 96, 167, 88], [152, 118, 157, 129]].forEach(([a, b, c, d]) => { g.beginPath(); g.moveTo(a, b); g.lineTo(c, d); g.stroke(); });
    glowAt(g, 150, 104, 30, 'rgba(210,245,255,0.85)');
    shape(g, () => { g.moveTo(143, 118); g.lineTo(145, 98); g.lineTo(151, 89); g.lineTo(157, 103); g.lineTo(154, 118); g.closePath(); }, '#e0f8ff', 2);
    shape(g, () => { g.moveTo(147, 115); g.lineTo(148, 99); g.lineTo(151, 94); g.lineTo(151, 115); g.closePath(); }, 'rgba(255,255,255,0.85)', 0);
    // 얼굴
    eye(g, 74, 106, '#e0a020', 1.9); eye(g, 110, 108, '#e0a020', 1.9);
    g.strokeStyle = OUT; g.lineWidth = 5;
    g.beginPath(); g.moveTo(58, 86); g.lineTo(84, 94); g.moveTo(128, 88); g.lineTo(102, 95); g.stroke();
    blush(g, 60, 126, 1.5); blush(g, 124, 128, 1.5);
    smile(g, 92, 134, 9);
    // 바닥을 짚은 촉수 (끝이 돌돌 말림)
    tentacle(g, [[144, 146], [163, 163], [176, 168], [180, 156], [174, 149]], 15, 2.5, front, -1);
    tentacle(g, [[118, 156], [124, 171], [140, 177], [156, 174], [159, 165], [152, 162]], 15, 2.5, front, 1);
    tentacle(g, [[92, 156], [84, 172], [68, 177], [52, 175], [46, 167], [53, 163]], 15, 2.5, front, -1);
    tentacle(g, [[66, 146], [46, 163], [28, 174], [16, 171], [12, 160], [17, 153], [23, 158]], 17, 2.5, front, 1);
    // 보물 금화를 치켜든 촉수
    tentacle(g, [[52, 132], [28, 124], [14, 104], [16, 82], [27, 70]], 13, 3, front, -1);
    glowAt(g, 31, 58, 18, 'rgba(255,230,120,0.6)');
    oval(g, 31, 58, 10, 10, lin(g, 0, 48, 0, 68, [[0, '#fff3b0'], [1, '#d09a20']]), 2.5);
    g.strokeStyle = 'rgba(150,95,20,0.6)'; g.lineWidth = 1.5; g.beginPath(); g.arc(31, 58, 6.5, 0, TAU); g.stroke();
    star(g, 31, 58, 4.5, '#fff8d0');
    shine(g, 27, 54, 3, 1.6, 0.8, -0.6);
    // 가라앉은 해적 모자
    g.save(); g.translate(120, 37); g.rotate(0.22); g.scale(1.2, 1.2);
    shape(g, () => { g.moveTo(-22, 0); g.bezierCurveTo(-22, -30, 22, -30, 22, 0); g.closePath(); }, lin(g, 0, -24, 0, 0, [[0, '#5a4a7a'], [1, '#2a1e40']]), 3);
    shape(g, () => { g.moveTo(-44, -12); g.quadraticCurveTo(-36, 8, 0, 8); g.quadraticCurveTo(36, 8, 44, -12); g.quadraticCurveTo(30, -2, 0, -4); g.quadraticCurveTo(-30, -2, -44, -12); g.closePath(); },
      lin(g, 0, -12, 0, 8, [[0, '#4a3a68'], [1, '#1e1630']]), 3);
    g.strokeStyle = '#f0c95a'; g.lineWidth = 2.5;
    g.beginPath(); g.moveTo(-40, -10); g.quadraticCurveTo(-30, -1, 0, -3); g.quadraticCurveTo(30, -1, 40, -10); g.stroke();
    oval(g, 0, -13, 5.5, 5, '#f6f0e0', 1.5);
    oval(g, -2, -13.5, 1.3, 1.5, '#2a1e40', 0); oval(g, 2, -13.5, 1.3, 1.5, '#2a1e40', 0);
    shine(g, -10, -16, 5, 2, 0.35, -0.4);
    g.restore();
    // 거품
    bubble(g, 56, 30, 6); bubble(g, 66, 14, 4); bubble(g, 46, 12, 3); bubble(g, 182, 36, 4);
  });
})();

// 챕터 6 불꽃 화산 — 몬스터·보스 그림
(() => {
  const X = window.STAR_EXTRA_SPR = window.STAR_EXTRA_SPR || {};

  // 물방울 모양 (x, y 밑동, w 반폭, h 높이, lean 끝이 기우는 정도)
  const drop = (g, x, y, w, h, lean, fill, lw = 2) => shape(g, () => {
    g.moveTo(x - w, y);
    g.bezierCurveTo(x - w * 1.2, y - h * 0.45, x + lean - w * 0.4, y - h * 0.7, x + lean, y - h);
    g.bezierCurveTo(x + lean * 0.3 + w * 0.6, y - h * 0.6, x + w * 1.25, y - h * 0.4, x + w, y);
    g.quadraticCurveTo(x, y + w * 0.6, x - w, y);
    g.closePath();
  }, fill, lw);
  // 불꽃: 끝이 휘는 큰 혀 + 옆의 작은 혀 (끝은 붉고 밑동은 노랗게) + 하얀 속불
  const fire = (g, x, y, w, h, lean, lw = 2) => {
    shape(g, () => {
      g.moveTo(x - w, y);
      g.bezierCurveTo(x - w * 1.45, y - h * 0.2, x - w * 1.15, y - h * 0.42, x - w * 0.75, y - h * 0.58);
      g.quadraticCurveTo(x - w * 0.62, y - h * 0.42, x - w * 0.2, y - h * 0.36);
      g.bezierCurveTo(x - w * 0.45, y - h * 0.62, x + lean - w * 0.15, y - h * 0.86, x + lean, y - h);
      g.bezierCurveTo(x + lean * 0.4 + w * 0.95, y - h * 0.62, x + w * 1.4, y - h * 0.32, x + w, y);
      g.quadraticCurveTo(x, y + w * 0.7, x - w, y);
      g.closePath();
    }, lin(g, 0, y - h, 0, y, [[0, '#ff4a1a'], [0.5, '#ff9a2a'], [1, '#ffe066']]), lw);
    drop(g, x + w * 0.1, y - h * 0.02, w * 0.55, h * 0.48, lean * 0.3, lin(g, 0, y - h * 0.5, 0, y, [[0, '#ffd84a'], [1, '#fffbe0']]), 0);
  };
  // 빛나는 용암 금 (넓은 빛 → 주황 → 밝은 심)
  const crackLn = (g, pts, w = 1.6) => {
    [[w * 3.2, 'rgba(255,110,30,0.35)'], [w * 1.7, '#ff8a2a'], [w * 0.7, '#ffe48a']].forEach(([lw, c]) => {
      g.strokeStyle = c; g.lineWidth = lw; g.beginPath();
      pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y));
      g.stroke();
    });
  };
  // 흑요석 결정 (x, y 밑동)
  const crystal = (g, x, y, w, h, rot) => {
    g.save(); g.translate(x, y); g.rotate(rot);
    shape(g, () => { g.moveTo(-w, 0); g.lineTo(-w * 0.85, -h * 0.68); g.lineTo(0, -h); g.lineTo(w * 0.85, -h * 0.68); g.lineTo(w, 0); g.closePath(); },
      lin(g, -w, 0, w, 0, [[0, '#8a78b8'], [0.45, '#3e3260'], [1, '#1c1428']]), 2);
    g.strokeStyle = 'rgba(230,215,255,0.6)'; g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(-w * 0.45, -2); g.lineTo(-w * 0.4, -h * 0.66); g.lineTo(0, -h + 2.5); g.stroke();
    g.restore();
  };
  // 보스 몸에 박힌 별조각 (하늘색 결정)
  const shard = (g, x, y, s) => {
    glowAt(g, x, y - 3 * s, 30 * s, 'rgba(140,215,255,0.9)');
    glowAt(g, x, y - 3 * s, 14 * s, 'rgba(230,250,255,0.9)');
    shape(g, () => { g.moveTo(x - 6 * s, y + 8 * s); g.lineTo(x - 4 * s, y - 9 * s); g.lineTo(x + 2 * s, y - 16 * s); g.lineTo(x + 6 * s, y - 3 * s); g.lineTo(x + 4 * s, y + 8 * s); g.closePath(); },
      lin(g, x - 6 * s, 0, x + 6 * s, 0, [[0, '#c8f0ff'], [1, '#7ac8f0']]), 2);
    shape(g, () => { g.moveTo(x - 2 * s, y + 6 * s); g.lineTo(x - 1.5 * s, y - 7 * s); g.lineTo(x + 1.5 * s, y - 11 * s); g.lineTo(x + 1.5 * s, y + 6 * s); g.closePath(); }, 'rgba(255,255,255,0.9)', 0);
  };

  // ── 용암 슬라임: 굳은 바위 껍질을 쓴 말랑한 용암 ──
  X.magmaslime = () => vs(96, 96, g => {
    glowAt(g, 48, 64, 46, 'rgba(255,120,40,0.35)');
    oval(g, 50, 87, 38, 5.5, lin(g, 0, 82, 0, 93, [[0, '#ffc050'], [1, '#e0501a']]), 2.5);   // 녹아 흐른 웅덩이
    fire(g, 54, 42, 8, 32, 6, 2.5);                                                           // 정수리 불꽃
    const body = () => { g.moveTo(14, 86); g.bezierCurveTo(9, 54, 28, 34, 49, 34); g.bezierCurveTo(72, 34, 89, 54, 84, 86); g.quadraticCurveTo(49, 92, 14, 86); };
    shape(g, body, lin(g, 0, 34, 0, 90, [[0, '#ffd060'], [0.45, '#ff8a2a'], [1, '#c8341a']]), 3);
    // 굳은 겉껍질 (몸 윗부분)
    g.save(); g.beginPath(); body(); g.clip();
    g.fillStyle = lin(g, 0, 50, 0, 70, [[0, 'rgba(255,240,150,0.95)'], [1, 'rgba(255,200,80,0)']]); g.fillRect(0, 50, 96, 20);   // 껍질 밑 뜨거운 빛
    shape(g, () => { g.moveTo(4, 52); g.quadraticCurveTo(14, 64, 24, 53); g.quadraticCurveTo(32, 62, 41, 52); g.quadraticCurveTo(50, 63, 59, 51); g.quadraticCurveTo(68, 61, 77, 50); g.quadraticCurveTo(86, 60, 94, 50); g.lineTo(94, 20); g.lineTo(4, 20); g.closePath(); },
      lin(g, 0, 30, 0, 60, [[0, '#6e5c66'], [1, '#30232a']]), 2.5);
    crackLn(g, [[31, 34], [27, 42], [31, 49], [29, 57]], 1.3);
    crackLn(g, [[27, 42], [17, 46]], 1.1);
    crackLn(g, [[58, 33], [62, 41], [57, 48], [60, 56]], 1.3);
    crackLn(g, [[62, 41], [73, 45]], 1.1);
    [[20, 44, 1.6], [44, 47, 1.3], [70, 40, 1.5], [50, 38, 1], [78, 47, 1.1], [36, 54, 1]].forEach(([x, y, r]) => oval(g, x, y, r, r * 0.8, 'rgba(20,10,14,0.45)', 0));
    [[23, 42, 1], [47, 45, 0.9], [73, 38, 1]].forEach(([x, y, r]) => oval(g, x, y, r, r * 0.8, 'rgba(255,230,220,0.3)', 0));
    shine(g, 41, 40, 7, 2.2, 0.25, -0.2);
    g.restore();
    shape(g, body, null, 3);
    // 부글부글 거품
    oval(g, 71, 73, 3.2, 3.2, '#ffe9a0', 1.5); oval(g, 77, 63, 2, 2, '#ffe9a0', 1.2); oval(g, 21, 79, 2.2, 2.2, '#ffe9a0', 1.2);
    shine(g, 19, 66, 2.2, 4.5, 0.55, 0.3);
    eye(g, 34, 67, '#a8281a', 0.88); eye(g, 51, 67, '#a8281a', 0.88);
    blush(g, 27, 76, 0.75); blush(g, 58, 76, 0.75);
    smile(g, 43, 80, 3);
    oval(g, 85, 84, 2.6, 3.6, '#ff8a2a', 1.8);                                                 // 흘러내린 방울
  });

  // ── 불꽃 박쥐: 불꽃 날개, 화염구를 쏨 ──
  X.firebat = () => vs(96, 96, g => {
    glowAt(g, 50, 52, 46, 'rgba(255,120,40,0.32)');
    for (const s of [1, -1]) {                       // 박쥐 날개 (끝은 불꽃 빛)
      g.save(); g.translate(52, 52); g.scale(s, 1);
      shape(g, () => { g.moveTo(8, -6); g.quadraticCurveTo(18, -31, 40, -29); g.quadraticCurveTo(33, -19, 39, -8); g.quadraticCurveTo(29, -7, 28, 4); g.quadraticCurveTo(20, -1, 10, 8); g.closePath(); },
        lin(g, 8, 0, 40, 0, [[0, '#6a1622'], [0.55, '#c8341e'], [1, '#ff9a3a']]), 2.5);
      g.strokeStyle = 'rgba(59,38,38,0.65)'; g.lineWidth = 1.6;
      g.beginPath(); g.moveTo(11, -5); g.lineTo(39, -8); g.moveTo(11, -2); g.lineTo(28, 4); g.stroke();
      fire(g, 39, -27, 3.2, 11, 3, 1.5);
      g.restore();
    }
    // 귀와 머리 불꽃
    const ear = lin(g, 0, 22, 0, 46, [[0, '#ff8a4a'], [1, '#b02a1e']]);
    shape(g, () => { g.moveTo(34, 46); g.quadraticCurveTo(28, 30, 33, 21); g.quadraticCurveTo(44, 29, 47, 40); g.closePath(); }, ear, 2.5);
    shape(g, () => { g.moveTo(70, 46); g.quadraticCurveTo(76, 30, 71, 21); g.quadraticCurveTo(60, 29, 57, 40); g.closePath(); }, ear, 2.5);
    oval(g, 37, 35, 2.6, 5, '#ffc080', 0, -0.35); oval(g, 67, 35, 2.6, 5, '#ffc080', 0, 0.35);
    fire(g, 52, 40, 5, 16, -3, 2);
    // 몸
    oval(g, 52, 57, 21, 20, rad(g, 52, 57, 24, [[0, '#ffb07a'], [0.5, '#f0603a'], [1, '#a8241e']]), 3);
    oval(g, 57, 67, 10, 7, 'rgba(255,220,140,0.55)', 0);
    shine(g, 44, 44, 6, 2.5, 0.45, -0.4);
    oval(g, 46, 78, 3, 3.8, '#5a1a1e', 1.5); oval(g, 58, 78, 3, 3.8, '#5a1a1e', 1.5);   // 작은 발
    // 얼굴 (화난 눈썹)
    eye(g, 43, 55, '#e8a020', 0.85); eye(g, 57, 55, '#e8a020', 0.85);
    g.strokeStyle = OUT; g.lineWidth = 2.5;
    g.beginPath(); g.moveTo(37, 45); g.lineTo(46, 48.5); g.moveTo(63, 45); g.lineTo(54, 48.5); g.stroke();
    blush(g, 37, 63, 0.7); blush(g, 63, 63, 0.7);
    smile(g, 50, 67, 3);
    shape(g, () => { g.moveTo(46, 66); g.lineTo(47.5, 70); g.lineTo(49, 66); g.closePath(); }, '#ffffff', 1.2);
    // 앞으로 쏘는 화염구
    glowAt(g, 13, 72, 18, 'rgba(255,170,60,0.85)');
    shape(g, () => { g.moveTo(13, 65); g.quadraticCurveTo(25, 64, 31, 72); g.quadraticCurveTo(25, 80, 13, 79); g.closePath(); }, lin(g, 13, 0, 31, 0, [[0, '#ff9a2a'], [1, 'rgba(255,90,30,0.2)']]), 0);
    oval(g, 13, 72, 6.5, 6.5, rad(g, 13, 72, 8, [[0, '#ffffff'], [0.45, '#ffe27a'], [1, '#ff6a1a']]), 2);
  });

  // ── 흑요석 골렘: 반짝이는 검은 유리 몸, 틈새로 용암 빛 ──
  X.obsidian = () => vs(96, 96, g => {
    glowAt(g, 46, 62, 44, 'rgba(255,110,40,0.25)');
    const rock = (y0, y1) => lin(g, 0, y0, 0, y1, [[0, '#6e5e96'], [0.5, '#3a3050'], [1, '#1c1626']]);
    // 다리
    shape(g, () => g.roundRect(30, 71, 15, 14, 5), rock(71, 85));
    shape(g, () => g.roundRect(52, 71, 15, 14, 5), rock(71, 85));
    oval(g, 37, 86, 10, 4.5, '#2a2036'); oval(g, 60, 86, 10, 4.5, '#2a2036');
    // 뒤쪽 팔
    shape(g, () => g.roundRect(69, 45, 14, 26, 7), rock(45, 71));
    oval(g, 77, 73, 9, 8, rock(65, 81));
    crackLn(g, [[73, 72], [77, 75], [81, 72]], 1);
    // 등의 흑요석 결정
    crystal(g, 70, 42, 5, 13, 0.75);
    crystal(g, 30, 36, 6.5, 17, -0.4); crystal(g, 63, 33, 6.5, 16, 0.4); crystal(g, 47, 30, 8, 22, -0.05);
    // 몸통 (각진 유리 덩어리)
    shape(g, () => { g.moveTo(20, 52); g.lineTo(27, 34); g.lineTo(47, 27); g.lineTo(68, 33); g.lineTo(78, 51); g.lineTo(76, 73); g.quadraticCurveTo(48, 81, 22, 74); g.closePath(); },
      lin(g, 20, 27, 76, 80, [[0, '#8a7ab8'], [0.35, '#463a66'], [1, '#1a1422']]), 3);
    g.strokeStyle = 'rgba(225,210,255,0.55)'; g.lineWidth = 1.8;                     // 유리 모서리 빛
    g.beginPath(); g.moveTo(23, 50); g.lineTo(29, 36); g.lineTo(46, 30); g.stroke();
    g.strokeStyle = 'rgba(200,180,255,0.32)'; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(27, 34); g.lineTo(33, 47); g.lineTo(20, 52); g.moveTo(68, 33); g.lineTo(64, 46); g.lineTo(78, 51); g.moveTo(33, 47); g.lineTo(47, 27); g.lineTo(64, 46); g.stroke();
    shine(g, 33, 38, 7, 2.6, 0.5, -0.65); shine(g, 70, 56, 1.6, 4, 0.35, 0.1);
    crackLn(g, [[64, 58], [69, 64], [66, 70], [70, 75]], 1.3);
    crackLn(g, [[26, 66], [30, 71], [28, 76]], 1.1);
    // 얼굴
    oval(g, 44, 58, 17, 11.5, 'rgba(130,110,170,0.4)', 0);
    glowAt(g, 37, 57, 10, 'rgba(255,150,60,0.55)'); glowAt(g, 51, 57, 10, 'rgba(255,150,60,0.55)');
    eye(g, 37, 57, '#ff8a2a', 0.8); eye(g, 51, 57, '#ff8a2a', 0.8);
    blush(g, 31, 65, 0.7); blush(g, 57, 65, 0.7);
    smile(g, 44, 68, 2.6);
    // 앞 팔과 큰 주먹
    shape(g, () => g.roundRect(10, 49, 14, 22, 7), rock(49, 71));
    oval(g, 16, 74, 11, 9.5, rock(64, 84), 3);
    crackLn(g, [[9, 72], [14, 76], [20, 73], [24, 77]], 1.1);
    shine(g, 12, 69, 3.5, 1.8, 0.45, -0.4);
  });

  // ── 챕터 6 보스: 화염룡 이그니스 (192×192) ──
  X.fire_dragon = () => vs(192, 192, g => {
    glowAt(g, 104, 118, 100, 'rgba(255,110,40,0.3)');
    const scale = (y0, y1) => lin(g, 0, y0, 0, y1, [[0, '#ff8a5a'], [0.5, '#e0442a'], [1, '#9a1e20']]);
    // 날개: 어깨(x, y)에서 손목을 거쳐 손가락 세 개, 사이는 물결 모양 막
    const wing = (x, y, s, rot, far) => {
      g.save(); g.translate(x, y); g.rotate(rot); g.scale(s, s);
      shape(g, () => { g.moveTo(-6, 6); g.quadraticCurveTo(-2, -38, 24, -58); g.lineTo(54, -90); g.quadraticCurveTo(46, -64, 66, -50); g.quadraticCurveTo(44, -36, 54, -12); g.quadraticCurveTo(30, -12, 16, 12); g.closePath(); },
        lin(g, 0, 10, 50, -90, far ? [[0, '#5a1220'], [1, '#b8402a']] : [[0, '#8a1e24'], [0.5, '#e0502a'], [1, '#ffb050']]), 3 / s);
      g.strokeStyle = OUT; g.lineWidth = 2.4 / s;
      g.beginPath(); g.moveTo(24, -58); g.lineTo(66, -50); g.moveTo(24, -58); g.lineTo(54, -12); g.stroke();
      g.strokeStyle = far ? '#7a1a22' : '#b02a24'; g.lineWidth = 4.5 / s;              // 날개 뼈 (앞쪽 굵은 팔)
      g.beginPath(); g.moveTo(-1, 2); g.quadraticCurveTo(2, -36, 24, -56); g.lineTo(52, -86); g.stroke();
      shape(g, () => { g.moveTo(21, -56); g.lineTo(22, -68); g.lineTo(28, -58); g.closePath(); }, '#fff0d0', 2 / s);
      g.restore();
    };
    wing(128, 106, 0.8, 0.3, true);                // 먼 날개
    wing(106, 98, 0.95, -0.12, false);             // 가까운 날개
    // 꼬리와 꼬리 끝 불꽃
    shape(g, () => { g.moveTo(136, 180); g.quadraticCurveTo(187, 182, 184, 140); g.quadraticCurveTo(183, 122, 174, 112); g.quadraticCurveTo(176, 128, 172, 140); g.quadraticCurveTo(166, 160, 134, 160); g.closePath(); },
      lin(g, 134, 0, 186, 0, [[0, '#c8341e'], [1, '#ff7a4a']]), 3.5);
    fire(g, 175, 116, 8, 32, 3, 3);
    // 등 가시 불꽃
    [[141, 110, 12], [155, 122, 10], [163, 137, 8]].forEach(([x, y, h]) => fire(g, x, y, 5, h + 6, 5, 2));
    // 몸통과 배
    oval(g, 118, 142, 46, 40, rad(g, 118, 142, 50, [[0, '#ff8a5a'], [0.55, '#e0442a'], [1, '#9a1e20']]), 4);
    oval(g, 102, 152, 28, 30, lin(g, 0, 122, 0, 182, [[0, '#fff3c0'], [1, '#ffae5a']]), 3, -0.15);
    g.save(); g.beginPath(); g.ellipse(102, 152, 27, 29, -0.15, 0, TAU); g.clip();
    g.strokeStyle = 'rgba(200,110,50,0.45)'; g.lineWidth = 2;
    [134, 148, 162, 176].forEach(y => { g.beginPath(); g.moveTo(72, y + 4); g.quadraticCurveTo(102, y + 10, 132, y - 4); g.stroke(); });
    g.restore();
    shard(g, 108, 150, 1.25);                      // 가슴에 박힌 별조각
    // 뒷다리와 앞발
    oval(g, 150, 158, 22, 20, scale(138, 178), 3.5);
    shine(g, 146, 146, 8, 3, 0.3, -0.3);
    oval(g, 142, 180, 21, 7.5, '#9a2420', 3);
    [[124, 180], [131, 183]].forEach(([x, y]) => oval(g, x, y, 4.2, 3, '#fff0d0', 2));
    oval(g, 78, 170, 15, 12, scale(158, 182), 3.5);
    [[64, 177], [70, 180]].forEach(([x, y]) => oval(g, x, y, 4, 3, '#fff0d0', 2));
    // 뿔 (뒤로 휘어짐)
    const horn = lin(g, 0, 14, 0, 60, [[0, '#fff6d8'], [1, '#d8a050']]);
    shape(g, () => { g.moveTo(88, 58); g.quadraticCurveTo(108, 38, 130, 30); g.quadraticCurveTo(116, 48, 102, 64); g.closePath(); }, horn, 3);
    shape(g, () => { g.moveTo(58, 54); g.quadraticCurveTo(66, 26, 96, 12); g.quadraticCurveTo(84, 32, 78, 52); g.closePath(); }, horn, 3);
    g.strokeStyle = 'rgba(160,100,40,0.5)'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(66, 40); g.lineTo(76, 44); g.moveTo(74, 28); g.lineTo(82, 32); g.moveTo(104, 46); g.lineTo(110, 52); g.stroke();
    // 머리 불꽃 갈기와 귀 지느러미
    fire(g, 80, 56, 10, 32, 6, 3);
    shape(g, () => { g.moveTo(100, 76); g.lineTo(126, 64); g.quadraticCurveTo(120, 78, 128, 88); g.lineTo(104, 96); g.closePath(); }, lin(g, 100, 0, 128, 0, [[0, '#c8341e'], [1, '#ffa040']]), 3);
    // 머리
    oval(g, 66, 88, 44, 38, rad(g, 66, 88, 48, [[0, '#ff9a6a'], [0.55, '#e84a2c'], [1, '#a02020']]), 4);
    shine(g, 46, 62, 12, 5, 0.4, -0.3);
    // 주둥이와 콧김
    oval(g, 31, 106, 26, 15, rad(g, 31, 106, 26, [[0, '#ffb088'], [1, '#e0502e']]), 3.5, -0.12);
    shine(g, 22, 96, 7, 2.4, 0.5, -0.25);
    oval(g, 11, 101, 2.8, 1.5, OUT, 0, -0.6); oval(g, 20, 97, 2.8, 1.5, OUT, 0, -0.6);
    [[9, 86, 5], [5, 76, 4], [11, 68, 3]].forEach(([x, y, r]) => oval(g, x, y, r, r * 0.85, 'rgba(110,80,80,0.45)', 0));
    // 얼굴 (금빛 눈, 화난 눈썹, 송곳니)
    eye(g, 50, 80, '#e8901a', 1.7); eye(g, 80, 78, '#e8901a', 1.7);
    g.strokeStyle = OUT; g.lineWidth = 5;
    g.beginPath(); g.moveTo(37, 63); g.lineTo(58, 69); g.moveTo(94, 61); g.lineTo(73, 67); g.stroke();
    blush(g, 92, 98, 1.3);
    smile(g, 32, 112, 7);
    shape(g, () => { g.moveTo(26, 114); g.lineTo(28, 120); g.lineTo(30, 114); g.closePath(); }, '#ffffff', 1.5);
    shape(g, () => { g.moveTo(35, 114); g.lineTo(37, 120); g.lineTo(39, 114); g.closePath(); }, '#ffffff', 1.5);
  });
})();

// 챕터 7 하늘 섬 — 몬스터·보스 그림
(() => {
  const X = window.STAR_EXTRA_SPR = window.STAR_EXTRA_SPR || {};

  // 동그라미 여러 개를 하나로 합친 뭉게 모양 (안쪽 선은 덮이고 바깥 외곽선만 남는다)
  function fluff(g, list, fill, lw = 2.5) {
    g.beginPath();
    list.forEach(([x, y, r]) => { g.moveTo(x + r, y); g.arc(x, y, r, 0, TAU); });
    if (lw) { g.lineWidth = lw * 2; g.strokeStyle = OUT; g.stroke(); }
    g.fillStyle = fill; g.fill();
  }
  // 깃털 한 장: (x, y)에서 a 방향으로 길이 L, 반폭 wd (c3 = 깃 끝 색, 없어도 됨)
  function feather(g, x, y, a, L, wd, c1, c2, lw = 2.5, c3) {
    g.save(); g.translate(x, y); g.rotate(a);
    shape(g, () => {
      g.moveTo(0, -wd); g.quadraticCurveTo(L * 0.55, -wd * 1.5, L, -wd * 0.2);
      g.quadraticCurveTo(L * 0.97, wd * 0.7, L * 0.86, wd * 0.85); g.quadraticCurveTo(L * 0.45, wd * 1.3, 0, wd); g.closePath();
    }, lin(g, 0, 0, L, 0, c3 ? [[0, c1], [0.8, c2], [1, c3]] : [[0, c1], [1, c2]]), lw);
    g.strokeStyle = 'rgba(235,245,255,0.45)'; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(L * 0.15, 0); g.quadraticCurveTo(L * 0.5, -wd * 0.3, L * 0.86, -wd * 0.15); g.stroke();
    g.restore();
  }
  // 말린 금빛 뿔 (d = 1 오른쪽, -1 왼쪽)
  function curl(g, x, y, d) {
    for (const [w, c] of [[6.5, OUT], [3.6, '#ffe08a']]) {
      g.strokeStyle = c; g.lineWidth = w; g.beginPath();
      if (d > 0) g.arc(x, y, 3.6, Math.PI * 0.9, Math.PI * 2.5);
      else g.arc(x, y, 3.6, Math.PI * 0.1, -Math.PI * 1.5, true);
      g.stroke();
    }
  }
  // 작은 번개
  function bolt(g, x, y, s) {
    glowAt(g, x, y + 9 * s, 16 * s, 'rgba(255,240,140,0.7)');
    shape(g, () => {
      g.moveTo(x + 1 * s, y); g.lineTo(x - 5 * s, y + 10 * s); g.lineTo(x - 1 * s, y + 10 * s); g.lineTo(x - 4 * s, y + 19 * s);
      g.lineTo(x + 5 * s, y + 7 * s); g.lineTo(x + 1 * s, y + 7 * s); g.lineTo(x + 5 * s, y); g.closePath();
    }, '#ffe85a', 1.8);
  }

  // ── 구름 양 (말랑 · 선한 몬스터, 근접) ──
  X.cloudsheep = () => vs(96, 96, g => {
    // 짧은 다리와 발굽
    [[41, '#a8b2d4'], [51, '#8e98c0'], [67, '#a8b2d4'], [77, '#8e98c0']].forEach(([x, c]) => {
      shape(g, () => g.roundRect(x - 3.5, 70, 7, 15, 3), lin(g, 0, 70, 0, 86, [[0, c], [1, '#5f6890']]), 2);
      oval(g, x, 86.5, 4.6, 2.6, '#4a4466', 2);
    });
    // 등의 작은 날개
    [[-1.35, 23], [-1.0, 21], [-0.65, 17]].forEach(([a, L]) => feather(g, 66, 40, a, L, 4.2, '#ffffff', '#c4d8f8', 2));
    // 뭉게뭉게 털 몸통 (꼬리도 구름)
    const wool = [[56, 36, 12], [43, 42, 12], [69, 40, 12], [81, 50, 11], [86, 61, 8], [77, 66, 10], [65, 69, 10], [52, 69, 10], [41, 63, 10], [56, 53, 17], [70, 55, 13]];
    fluff(g, wool, lin(g, 0, 24, 0, 80, [[0, '#ffffff'], [0.55, '#f0f4ff'], [1, '#c0cbec']]));
    g.strokeStyle = 'rgba(140,155,210,0.5)'; g.lineWidth = 1.6;
    [[52, 69, 10], [65, 69, 10], [77, 66, 10], [69, 40, 12], [81, 50, 11], [86, 61, 8]].forEach(([x, y, r]) => { g.beginPath(); g.arc(x, y, r - 3.5, 0.2 * Math.PI, 0.8 * Math.PI); g.stroke(); });
    shine(g, 50, 31, 7, 3.4, 0.95); shine(g, 66, 34, 4, 2, 0.8); shine(g, 80, 45, 3, 1.6, 0.7);
    // 늘어진 귀
    oval(g, 15, 57, 8, 4, '#f8dcd2', 2, -0.55); oval(g, 46, 57, 8, 4, '#f8dcd2', 2, 0.55);
    oval(g, 14, 58, 4, 1.8, '#ffb4b8', 0, -0.55); oval(g, 47, 58, 4, 1.8, '#ffb4b8', 0, 0.55);
    // 얼굴
    oval(g, 30.5, 57, 13, 12.5, lin(g, 0, 44, 0, 70, [[0, '#fffaf4'], [1, '#f4dad2']]));
    // 머리 위 털 뭉치와 말린 뿔
    fluff(g, [[24.5, 46, 5.5], [30.5, 43, 6.5], [36.5, 46, 5.5]], lin(g, 0, 36, 0, 51, [[0, '#ffffff'], [1, '#e0e6fa']]), 2);
    shine(g, 28, 40.5, 3, 1.4, 0.9);
    curl(g, 18.5, 47, -1); curl(g, 42.5, 47, 1);
    eye(g, 25, 57.5, '#3a86d8', 0.72); eye(g, 36, 57.5, '#3a86d8', 0.72);
    blush(g, 20, 64, 0.6); blush(g, 41, 64, 0.6);
    smile(g, 30.5, 66.5, 2.4);
    // 하늘색 목줄과 금방울
    for (const [w, c] of [[4.5, OUT], [2.4, '#6ab8ff']]) { g.strokeStyle = c; g.lineWidth = w; g.beginPath(); g.arc(30.5, 57, 14, 0.28 * Math.PI, 0.72 * Math.PI); g.stroke(); }
    oval(g, 30.5, 73.5, 3.6, 3.4, rad(g, 30.5, 73.5, 4, [[0, '#fff6c0'], [1, '#e0a020']]), 2);
    g.fillStyle = OUT; g.fillRect(29.8, 74.2, 1.4, 2.2);
  });

  // ── 바람 정령 (영체 · 선함, 원거리: 바람 칼날) ──
  X.windsprite = () => vs(96, 96, g => {
    glowAt(g, 48, 52, 44, 'rgba(170,240,255,0.45)');
    // 흘러가는 바람 줄기
    g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 2;
    [[64, 12, 92, 18], [76, 36, 94, 38], [60, 92, 88, 88]].forEach(([a, b, c, d]) => { g.beginPath(); g.moveTo(a, b); g.quadraticCurveTo((a + c) / 2, b - 5, c, d); g.stroke(); });
    // 소용돌이 꼬리
    shape(g, () => {
      g.moveTo(34, 62); g.quadraticCurveTo(44, 88, 70, 86); g.quadraticCurveTo(89, 84, 88, 69); g.quadraticCurveTo(87, 59, 78, 59);
      g.quadraticCurveTo(83, 71, 69, 74); g.quadraticCurveTo(58, 75, 57, 60); g.closePath();
    }, lin(g, 34, 60, 88, 86, [[0, '#dcfcff'], [1, '#78d4ea']]), 2.5);
    g.strokeStyle = 'rgba(255,255,255,0.75)'; g.lineWidth = 1.8;
    g.beginPath(); g.moveTo(48, 78); g.quadraticCurveTo(66, 84, 80, 76); g.stroke();
    // 뒤로 날리는 바람 머리칼
    const hair = lin(g, 30, 14, 92, 40, [[0, '#ffffff'], [1, '#86e0f0']]);
    [[30, 38, 58, 14, 82, 12], [36, 36, 66, 26, 92, 28], [40, 42, 66, 40, 86, 46]].forEach(([x0, y0, cx, cy, x1, y1]) =>
      shape(g, () => { g.moveTo(x0, y0); g.quadraticCurveTo(cx, cy - 6, x1, y1); g.quadraticCurveTo(cx, cy + 6, x0 + 14, y0 + 8); g.closePath(); }, hair, 2.2));
    // 둥근 몸
    oval(g, 46, 52, 21, 20, rad(g, 46, 52, 24, [[0, '#ffffff'], [0.5, '#cdf8ff'], [1, '#5ecde2']]), 3);
    shine(g, 37, 40, 7, 3.4, 0.85);
    eye(g, 39, 53, '#14879e', 0.85); eye(g, 53, 53, '#14879e', 0.85);
    blush(g, 33, 61.5, 0.7); blush(g, 59, 61.5, 0.7);
    smile(g, 46, 65.5, 2.6);
    // 앞으로 던질 초승달 바람 칼날
    glowAt(g, 13, 52, 20, 'rgba(200,250,255,0.95)');
    shape(g, () => { g.moveTo(18, 33); g.quadraticCurveTo(-3, 52, 18, 71); g.quadraticCurveTo(7, 52, 18, 33); g.closePath(); },
      lin(g, 4, 33, 18, 71, [[0, '#ffffff'], [1, '#9ae8f6']]), 2);
    g.strokeStyle = 'rgba(255,255,255,0.95)'; g.lineWidth = 1.6;
    g.beginPath(); g.moveTo(21, 42); g.lineTo(28, 42); g.moveTo(21, 63); g.lineTo(26, 63); g.stroke();
    oval(g, 27, 62, 5, 4.2, '#c4f6fc', 2);
    // 바람에 실려 온 나뭇잎과 반짝이
    oval(g, 22, 18, 5.5, 2.6, '#8ae070', 1.5, -0.6);
    g.strokeStyle = 'rgba(40,110,50,0.6)'; g.lineWidth = 1; g.beginPath(); g.moveTo(18, 21); g.lineTo(26, 15); g.stroke();
    [[74, 6, 2.2], [8, 84, 2], [90, 58, 1.8]].forEach(([x, y, r]) => glowAt(g, x, y, r * 4, 'rgba(235,255,255,0.95)'));
  });

  // ── 그리핀 기사 (비행 · 중립, 근접) ──
  X.griffin = () => vs(96, 96, g => {
    // 먼 쪽 날개
    [[-1.2, 34], [-0.95, 32], [-0.7, 28], [-0.45, 23]].forEach(([a, L]) => feather(g, 64, 56, a, L, 5, '#d8ac74', '#93603a', 2.2));
    // 사자 꼬리
    g.strokeStyle = OUT; g.lineWidth = 6; g.beginPath(); g.moveTo(76, 74); g.quadraticCurveTo(90, 76, 89, 61); g.stroke();
    g.strokeStyle = '#dcaa64'; g.lineWidth = 3; g.stroke();
    oval(g, 89, 57, 4.5, 5.5, '#9a6a3a', 2);
    // 뒷다리 (사자 발)
    [[64, '#c89454'], [76, '#b07e44']].forEach(([x, c]) => { shape(g, () => g.roundRect(x - 4, 70, 8, 15, 4), c, 2.2); oval(g, x - 0.5, 86.5, 5, 3, '#ecca90', 2); });
    // 몸통
    oval(g, 58, 68, 22, 14, lin(g, 0, 54, 0, 82, [[0, '#ffe2a4'], [1, '#c8904c']]), 2.5);
    // 기사의 안장 천 (별 문장)
    shape(g, () => { g.moveTo(48, 57); g.quadraticCurveTo(61, 51, 74, 57); g.lineTo(72, 76); g.quadraticCurveTo(61, 81, 50, 76); g.closePath(); },
      lin(g, 0, 52, 0, 80, [[0, '#7ab0f4'], [1, '#3a62c0']]), 2.2);
    g.strokeStyle = '#ffd25e'; g.lineWidth = 2; g.beginPath(); g.moveTo(51.5, 73.5); g.quadraticCurveTo(61, 78.5, 70.5, 73.5); g.stroke();
    star(g, 62, 65, 5, '#ffe27a');
    // 앞 날개
    [[-1.62, 38], [-1.34, 36], [-1.06, 32], [-0.78, 26]].forEach(([a, L]) => feather(g, 54, 58, a, L, 5.5, '#fffaf0', '#e2b274', 2.2));
    oval(g, 56, 57, 9, 7, lin(g, 0, 50, 0, 64, [[0, '#fff8e8'], [1, '#e8c088']]), 2.2, -0.4);
    shine(g, 53, 54, 3, 1.6, 0.8);
    // 앞다리 (독수리 발)
    [[40, '#f2b848'], [50, '#dca038']].forEach(([x, c]) => {
      shape(g, () => g.roundRect(x - 3, 72, 6, 13, 3), c, 2);
      [-3.5, 0, 3.5].forEach(d => oval(g, x + d - 1, 86.5, 2.3, 2.3, '#f8d070', 1.5));
    });
    // 하얀 가슴 깃털
    fluff(g, [[26, 57, 6], [32, 62, 6.5], [39, 63, 6.5], [45, 58, 6]], lin(g, 0, 50, 0, 70, [[0, '#ffffff'], [1, '#e6d8c2']]), 2.2);
    // 뒷머리 깃털과 머리
    shape(g, () => { g.moveTo(40, 34); g.lineTo(55, 29); g.lineTo(47, 39); g.lineTo(56, 41); g.lineTo(44, 48); g.closePath(); }, '#f0e6d6', 2);
    oval(g, 31, 45, 15, 14, rad(g, 31, 45, 17, [[0, '#ffffff'], [1, '#e2dacc']]));
    // 은빛 투구와 붉은 깃 장식
    shape(g, () => { g.moveTo(30, 28); g.quadraticCurveTo(34, 11, 55, 11); g.quadraticCurveTo(47, 16, 51, 22); g.quadraticCurveTo(41, 20, 37, 29); g.closePath(); },
      lin(g, 30, 11, 55, 28, [[0, '#ff8a8a'], [1, '#d03c50']]), 2);
    shape(g, () => { g.moveTo(16, 43); g.quadraticCurveTo(16, 27, 31, 27); g.quadraticCurveTo(46, 27, 46, 43); g.quadraticCurveTo(31, 37, 16, 43); g.closePath(); },
      lin(g, 16, 27, 46, 43, [[0, '#ffffff'], [0.5, '#c8d4e8'], [1, '#8a98b8']]), 2.5);
    g.strokeStyle = 'rgba(80,90,120,0.6)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(31, 28); g.lineTo(31, 38); g.stroke();
    oval(g, 21, 38, 1.3, 1.3, '#ffe27a', 1); oval(g, 41, 38, 1.3, 1.3, '#ffe27a', 1);
    shine(g, 24, 32, 4, 2, 0.85);
    // 얼굴
    eye(g, 25, 48, '#c0701a', 0.75); eye(g, 37, 48, '#c0701a', 0.75);
    blush(g, 20.5, 54.5, 0.55); blush(g, 41.5, 54.5, 0.55);
    shape(g, () => { g.moveTo(26, 51.5); g.quadraticCurveTo(32, 48.5, 37, 52); g.quadraticCurveTo(35, 58.5, 27.5, 60.5); g.quadraticCurveTo(22.5, 60.5, 23.5, 56.5); g.quadraticCurveTo(24, 53.5, 26, 51.5); g.closePath(); },
      lin(g, 0, 49, 0, 61, [[0, '#ffe58a'], [1, '#e0962a']]), 2);
    smile(g, 30.5, 58, 2);
  });

  // ── 챕터 7 보스: 폭풍의 대붕 (192×192) ──
  X.storm_roc = () => vs(192, 192, g => {
    glowAt(g, 96, 92, 96, 'rgba(150,190,255,0.35)');
    // 꼬리 깃 (구름 뒤로)
    [0.15, 0.4, 0.65, 0.9].forEach((a, i) => feather(g, 128, 146, a, 50 - i * 4, 8, '#5a6ca8', '#283060', 3));
    // 활짝 편 두 날개: 긴 칼깃 (오른 날개가 뒤) + 앞의 짧은 덮깃
    for (let i = 0; i < 7; i++) feather(g, 130, 98, -1.42 + i * 0.2, 92 - i * 5.5, 9, '#6478b4', '#222a56', 3, '#aebfee');
    for (let i = 0; i < 7; i++) feather(g, 72, 100, -1.72 - i * 0.2, 92 - i * 5.5, 9, '#8ca2d8', '#2c3874', 3, '#c4d2f6');
    for (let i = 0; i < 5; i++) feather(g, 124, 104, -1.3 + i * 0.24, 54 - i * 4, 10, '#a2b6ea', '#5a6eaa', 3);
    for (let i = 0; i < 5; i++) feather(g, 78, 106, -1.84 - i * 0.24, 54 - i * 4, 10, '#b8caf2', '#687cb8', 3);
    // 몸통과 밝은 가슴 깃털
    oval(g, 102, 122, 40, 44, lin(g, 0, 78, 0, 166, [[0, '#7c92cc'], [1, '#3a4680']]), 3.5, -0.12);
    oval(g, 97, 130, 28, 32, lin(g, 0, 98, 0, 162, [[0, '#f6f9ff'], [1, '#b4c4e8']]), 2.5, -0.12);
    g.strokeStyle = 'rgba(100,120,175,0.45)'; g.lineWidth = 2;
    for (let r = 0; r < 3; r++) for (let k = 0; k < 4 - (r % 2); k++) { g.beginPath(); g.arc(80 + k * 11 + (r % 2) * 5.5, 120 + r * 12, 4.5, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke(); }
    // 가슴에 박힌 별조각
    glowAt(g, 115, 126, 32, 'rgba(210,245,255,0.9)');
    shape(g, () => { g.moveTo(108, 142); g.lineTo(110, 120); g.lineTo(117, 109); g.lineTo(123, 124); g.lineTo(121, 142); g.closePath(); }, '#e0f8ff', 2.5);
    shape(g, () => { g.moveTo(113, 138); g.lineTo(114, 121); g.lineTo(117, 116); g.lineTo(118, 138); g.closePath(); }, '#ffffff', 0);
    g.strokeStyle = 'rgba(150,215,255,0.85)'; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(108, 130); g.lineTo(99, 126); g.moveTo(122, 134); g.lineTo(131, 139); g.moveTo(116, 109); g.lineTo(113, 101); g.stroke();
    // 발밑 폭풍 구름과 금빛 발톱
    fluff(g, [[44, 174, 12], [66, 168, 17], [92, 164, 21], [120, 166, 20], [146, 170, 17], [166, 176, 11], [104, 176, 13], [76, 178, 10]],
      lin(g, 0, 143, 0, 190, [[0, '#d8e0f4'], [0.5, '#8e98be'], [1, '#596086']]), 3);
    shine(g, 84, 152, 12, 4, 0.55, -0.1); shine(g, 128, 154, 9, 3, 0.45, -0.1);
    [[84, 150], [118, 152]].forEach(([x, y]) => {
      shape(g, () => g.roundRect(x - 5, y - 12, 10, 15, 4), lin(g, 0, y - 12, 0, y + 3, [[0, '#ffd870'], [1, '#e09a28']]), 2.5);
      [-6, 0, 6].forEach(d => shape(g, () => { g.moveTo(x + d - 3, y + 1); g.quadraticCurveTo(x + d - 4, y + 9, x + d - 7, y + 12); g.quadraticCurveTo(x + d + 2, y + 10, x + d + 3, y + 1); g.closePath(); }, '#fff0b0', 2));
    });
    // 목둘레 깃털과 금빛 볏
    fluff(g, [[48, 92, 11], [60, 101, 12], [75, 105, 12], [90, 102, 12], [101, 94, 10]], lin(g, 0, 80, 0, 118, [[0, '#ffffff'], [1, '#c4d2f0']]), 3);
    [[-0.9, 54], [-0.55, 58], [-0.25, 48]].forEach(([a, L]) => feather(g, 84, 50, a, L, 6, '#ffffff', '#ffc83a', 2.5));
    // 머리 (하얀 깃)
    oval(g, 72, 68, 30, 28, rad(g, 72, 68, 32, [[0, '#ffffff'], [0.6, '#e4ecfa'], [1, '#a4b6dc']]), 3.5);
    shine(g, 58, 50, 9, 4, 0.8, -0.4);
    // 번뜩이는 눈과 성난 눈썹
    glowAt(g, 60, 66, 15, 'rgba(255,220,120,0.6)'); glowAt(g, 85, 64, 15, 'rgba(255,220,120,0.6)');
    eye(g, 60, 66, '#e8a020', 1.45); eye(g, 85, 64, '#e8a020', 1.45);
    g.strokeStyle = OUT; g.lineWidth = 5;
    g.beginPath(); g.moveTo(47, 50); g.lineTo(67, 56); g.moveTo(98, 47); g.lineTo(78, 54); g.stroke();
    // 갈고리 부리
    shape(g, () => { g.moveTo(63, 95); g.quadraticCurveTo(76, 94, 83, 85); g.quadraticCurveTo(82, 98, 66, 102); g.closePath(); }, '#c8862a', 2.5);
    shape(g, () => { g.moveTo(58, 75); g.quadraticCurveTo(72, 68, 86, 75); g.quadraticCurveTo(82, 92, 62, 98); g.quadraticCurveTo(55, 101, 52, 107); g.quadraticCurveTo(46, 97, 51, 89); g.quadraticCurveTo(53, 80, 58, 75); g.closePath(); },
      lin(g, 50, 70, 86, 104, [[0, '#fff3b0'], [0.5, '#f4c040'], [1, '#c4841c']]), 3);
    oval(g, 66, 80, 2.4, 1.6, 'rgba(120,70,20,0.7)', 0, -0.3);
    shine(g, 74, 76, 6, 2, 0.75, -0.1);
    smile(g, 73, 93, 4.5);
    // 번개와 돌풍 소용돌이
    bolt(g, 12, 104, 1.1); bolt(g, 180, 102, 1); bolt(g, 30, 146, 0.75);
    g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 3;
    [[24, 128, 9], [170, 134, 9]].forEach(([x, y, r]) => { g.beginPath(); g.arc(x, y, r, Math.PI, Math.PI * 2.4); g.stroke(); g.beginPath(); g.arc(x + r * 0.3, y, r * 0.5, 0, Math.PI * 1.3); g.stroke(); });
  });
})();

// 챕터 8 태엽 시계탑 — 몬스터·보스 그림
// 태엽 병정 · 톱니 드론 · 증기 기사 (96×96, 왼쪽을 봄) / 시간의 태엽지기 (192×192)
(() => {
  const X = window.STAR_EXTRA_SPR = window.STAR_EXTRA_SPR || {};

  // 톱니바퀴 경로: ro 바깥 반지름, n 이빨 수, rot 회전, depth 이빨 깊이 비율
  function cogPath(g, cx, cy, ro, n, rot = 0, depth = 0.22) {
    const ri = ro * (1 - depth), step = TAU / n, tw = step * 0.2;
    for (let i = 0; i < n; i++) {
      const a = rot + i * step;
      g.arc(cx, cy, ri, a - step / 2, a - tw * 1.4);
      g.lineTo(cx + Math.cos(a - tw) * ro, cy + Math.sin(a - tw) * ro);
      g.lineTo(cx + Math.cos(a + tw) * ro, cy + Math.sin(a + tw) * ro);
      g.arc(cx, cy, ri, a + tw * 1.4, a + step / 2);
    }
    g.closePath();
  }
  function cog(g, cx, cy, ro, n, fill, lw = 2.5, rot = 0, depth) { shape(g, () => cogPath(g, cx, cy, ro, n, rot, depth), fill, lw); }
  const brass = (g, y0, y1) => lin(g, 0, y0, 0, y1, [[0, '#fff0a8'], [0.5, '#e8b448'], [1, '#a8701e']]);

  // 리벳 (그림자 + 빛 점)
  function rivet(g, x, y, r = 1.6) {
    g.fillStyle = 'rgba(59,38,38,0.55)'; g.beginPath(); g.arc(x + 0.4, y + 0.5, r, 0, TAU); g.fill();
    g.fillStyle = '#fff2c0'; g.beginPath(); g.arc(x - 0.3, y - 0.3, r * 0.7, 0, TAU); g.fill();
  }

  // 등에 꽂힌 태엽 열쇠 (오른쪽으로 뻗음). s: 크기
  function windKey(g, x, y, s = 1) {
    const gr = lin(g, 0, y - 16 * s, 0, y + 16 * s, [[0, '#fff0a8'], [0.5, '#f0c050'], [1, '#b07a20']]), lw = s > 1.4 ? 3 : 2;
    shape(g, () => g.roundRect(x, y - 2.5 * s, 16 * s, 5 * s, 2 * s), gr, lw);
    for (const d of [-1, 1]) {
      oval(g, x + 20 * s, y + d * 7.5 * s, 5.5 * s, 7.5 * s, gr, lw, -d * 0.3);
      oval(g, x + 20.5 * s, y + d * 8.5 * s, 1.8 * s, 3 * s, 'rgba(110,60,20,0.5)', 0, -d * 0.3);
    }
    oval(g, x + 17 * s, y, 4 * s, 4 * s, '#d8a030', lw);
    shine(g, x + 18 * s, y - 10 * s, 1.6 * s, 3 * s, 0.6, 0.3);
  }

  // ── 태엽 병정 (갑옷, 근접): 빨간 제복의 도자기 얼굴 장난감 병정 ──
  X.tinsoldier = () => vs(96, 96, g => {
    windKey(g, 60, 57, 1);                                                    // 등의 태엽 열쇠
    oval(g, 63, 63, 5, 9, '#a82a2a', 2.5, -0.35);                             // 뒷팔
    const pants = lin(g, 0, 70, 0, 86, [[0, '#ffffff'], [1, '#c8d0e4']]);
    shape(g, () => g.roundRect(37, 70, 9, 15, 3), pants);
    shape(g, () => g.roundRect(50, 70, 9, 15, 3), pants);
    oval(g, 40, 87, 7.5, 4, '#2a2a3e'); oval(g, 55, 87, 7.5, 4, '#2a2a3e');
    shine(g, 37, 85.6, 2.5, 1, 0.5, 0); shine(g, 52, 85.6, 2.5, 1, 0.5, 0);
    // 빨간 제복과 흰 X자 멜빵
    const coat = () => g.roundRect(31, 49, 34, 27, 10);
    shape(g, coat, lin(g, 0, 49, 0, 76, [[0, '#ff7a64'], [1, '#c0302e']]));
    g.save(); g.beginPath(); coat(); g.clip();
    const belts = () => { g.beginPath(); g.moveTo(33, 49); g.lineTo(63, 76); g.moveTo(63, 49); g.lineTo(33, 76); g.stroke(); };
    g.strokeStyle = OUT; g.lineWidth = 6.5; belts();
    g.strokeStyle = '#ffffff'; g.lineWidth = 3.8; belts();
    g.restore();
    shape(g, coat, null, 2.5);
    oval(g, 48, 62, 4, 4, brass(g, 58, 66), 1.8);
    shape(g, () => g.roundRect(31, 70, 34, 5, 2), '#2a2a3e', 2);
    shape(g, () => g.roundRect(44.5, 69.5, 7, 6, 1.5), '#ffd25e', 1.5);
    // 앞팔과 장난감 칼
    oval(g, 32, 60, 5, 8.5, lin(g, 0, 52, 0, 68, [[0, '#ff7a64'], [1, '#c0302e']]), 2.5, 0.55);
    oval(g, 35, 52, 7, 4, brass(g, 48, 56), 2, -0.2);                        // 금 견장
    g.strokeStyle = '#d8a030'; g.lineWidth = 1.5; g.beginPath();
    for (let k = 0; k < 4; k++) { g.moveTo(30 + k * 3, 55.5); g.lineTo(29.5 + k * 3, 59); }
    g.stroke();
    g.save(); g.translate(25, 66); g.rotate(-0.3);
    shape(g, () => g.roundRect(-2, 0, 4, 7, 1.5), '#7a4a2a', 1.5);
    shape(g, () => { g.moveTo(-2.5, -3); g.lineTo(-2.5, -24); g.lineTo(0, -29); g.lineTo(2.5, -24); g.lineTo(2.5, -3); g.closePath(); },
      lin(g, -3, 0, 3, 0, [[0, '#ffffff'], [0.5, '#dfe7f4'], [1, '#9aa8c0']]), 1.8);
    shape(g, () => g.roundRect(-6, -3.5, 12, 3.5, 1.5), '#ffd25e', 1.5);
    g.restore();
    oval(g, 25, 66, 4.3, 4.3, '#ffffff', 2);                                  // 흰 장갑
    // 도자기 얼굴
    oval(g, 47, 37, 18, 16, rad(g, 47, 37, 20, [[0, '#fffaf2'], [1, '#ffd8c4']]));
    eye(g, 40, 39, '#2a3a8a', 0.85); eye(g, 53, 39, '#2a3a8a', 0.85);
    blush(g, 35, 46, 0.8); blush(g, 58, 46, 0.8);
    smile(g, 46, 49, 2.6);
    // 높은 군모 (샤코)와 방울 장식
    const hatC = lin(g, 0, 6, 0, 30, [[0, '#4a5288'], [1, '#1e2244']]);
    shape(g, () => { g.moveTo(31, 30); g.lineTo(33, 9); g.quadraticCurveTo(47, 5, 61, 9); g.lineTo(63, 30); g.quadraticCurveTo(47, 33, 31, 30); }, hatC);
    shape(g, () => { g.moveTo(31.4, 25); g.quadraticCurveTo(47, 28, 62.6, 25); g.lineTo(63, 30); g.quadraticCurveTo(47, 33, 31, 30); g.closePath(); }, '#f0c050', 2);
    shape(g, () => { g.moveTo(34, 29); g.quadraticCurveTo(22, 29, 19, 34); g.quadraticCurveTo(28, 35, 37, 32); g.closePath(); }, '#16182e', 2);
    star(g, 43, 17, 5, '#ffe27a');
    shine(g, 55, 15, 2, 6, 0.25, 0.1);
    oval(g, 45, 6, 5, 4.5, rad(g, 45, 6, 6, [[0, '#ffffff'], [1, '#ff6a6a']]), 2);
  });

  // ── 톱니 드론 (비행, 원거리 광선): 유리 얼굴판을 단 톱니바퀴 ──
  X.gearbot = () => vs(96, 96, g => {
    glowAt(g, 50, 88, 14, 'rgba(130,230,255,0.75)');                         // 추진 불꽃
    shape(g, () => { g.moveTo(45, 82); g.quadraticCurveTo(50, 95, 55, 82); g.closePath(); }, 'rgba(200,248,255,0.95)', 1.5);
    shape(g, () => { g.moveTo(42, 74); g.lineTo(58, 74); g.lineTo(55, 83); g.lineTo(45, 83); g.closePath(); }, lin(g, 0, 74, 0, 83, [[0, '#a8b0c0'], [1, '#5a6278']]), 2);
    shape(g, () => { g.moveTo(72, 40); g.quadraticCurveTo(86, 28, 92, 33); g.quadraticCurveTo(88, 45, 76, 56); g.closePath(); },
      lin(g, 72, 30, 92, 56, [[0, '#ffe08a'], [1, '#c08a30']]), 2.2);          // 등지느러미
    g.strokeStyle = OUT; g.lineWidth = 2; g.beginPath(); g.moveTo(66, 30); g.lineTo(73, 18); g.stroke();   // 안테나
    oval(g, 73, 17, 3, 3, '#ff6a8a', 1.5);
    // 레이저 포 (앞 = 왼쪽)
    shape(g, () => g.roundRect(9, 57, 20, 9, 3), lin(g, 0, 57, 0, 66, [[0, '#e8eef6'], [1, '#7a8498']]));
    shape(g, () => g.roundRect(15, 55.5, 4, 12, 1.5), '#f0c050', 1.5);
    glowAt(g, 9, 61.5, 15, 'rgba(255,90,150,0.8)');
    oval(g, 9, 61.5, 3.2, 4.6, rad(g, 9, 61.5, 5, [[0, '#ffffff'], [0.5, '#ff8ab0'], [1, '#d0285a']]), 1.8);
    // 톱니 몸과 리벳
    cog(g, 50, 53, 30, 10, lin(g, 0, 23, 0, 83, [[0, '#ffe896'], [0.5, '#e8b048'], [1, '#a8702a']]), 2.8, TAU / 20);
    for (let k = 0; k < 8; k++) { const a = k * TAU / 8 + 0.4; rivet(g, 50 + Math.cos(a) * 20.5, 53 + Math.sin(a) * 20.5, 1.4); }
    // 유리 얼굴판
    oval(g, 49, 54, 17, 16, rad(g, 49, 54, 19, [[0, '#f6fffc'], [0.7, '#cdeee6'], [1, '#9ad0c8']]), 2.2);
    eye(g, 43, 53, '#1e6a7a', 0.8); eye(g, 55, 53, '#1e6a7a', 0.8);
    blush(g, 38, 61, 0.6); blush(g, 60, 61, 0.6);
    smile(g, 49, 64, 2.4);
    shine(g, 42, 43, 5.5, 2.2, 0.7, -0.45);
    // 프로펠러
    g.strokeStyle = OUT; g.lineWidth = 2.5; g.beginPath(); g.moveTo(50, 25); g.lineTo(50, 15); g.stroke();
    g.globalAlpha = 0.8;
    oval(g, 38, 13, 12, 3.2, 'rgba(225,245,255,0.9)', 2, 0.1); oval(g, 62, 13, 12, 3.2, 'rgba(225,245,255,0.9)', 2, -0.1);
    g.globalAlpha = 1;
    oval(g, 50, 14, 3.5, 3, '#ffd25e', 2);
  });

  // ── 증기 기사 (화염체, 근접): 배 속 화로가 타오르는 보일러 기사 ──
  X.steamknight = () => vs(96, 96, g => {
    // 등의 증기관과 김
    const pipe = () => { g.beginPath(); g.moveTo(62, 58); g.quadraticCurveTo(80, 58, 79, 34); g.stroke(); };
    g.strokeStyle = OUT; g.lineWidth = 8.5; pipe();
    g.strokeStyle = '#d88a48'; g.lineWidth = 4.5; pipe();
    shape(g, () => g.roundRect(74, 29, 10, 6, 2), '#f0c050', 2);
    [[80, 22, 6, 5, 0.85], [85, 13, 5, 4.2, 0.65], [89, 6, 3.8, 3.2, 0.45]].forEach(([x, y, rx, ry, a]) => oval(g, x, y, rx, ry, `rgba(255,255,255,${a})`, 0));
    // 쇠다리
    const iron = lin(g, 0, 72, 0, 86, [[0, '#c8d2e2'], [1, '#6a7488']]);
    shape(g, () => g.roundRect(37, 72, 10, 13, 3), iron); shape(g, () => g.roundRect(54, 72, 10, 13, 3), iron);
    oval(g, 41, 87, 9, 4.2, '#4a4e64'); oval(g, 59, 87, 9, 4.2, '#4a4e64');
    // 보일러 몸통
    oval(g, 49, 62, 23, 20, lin(g, 0, 42, 0, 82, [[0, '#ffb67a'], [0.5, '#d8783a'], [1, '#8a4220']]), 3);
    g.save(); g.beginPath(); g.ellipse(49, 62, 21.5, 18.5, 0, 0, TAU); g.clip();
    g.fillStyle = 'rgba(120,50,20,0.35)'; g.fillRect(24, 47, 52, 3.5); g.fillRect(24, 77, 52, 3);
    g.restore();
    [35, 42, 58, 65].forEach(x => rivet(g, x, 48.8, 1.3));
    shine(g, 37, 53, 7, 3, 0.45, -0.3);
    // 화로 문 (안에 불꽃)
    glowAt(g, 50, 67, 22, 'rgba(255,160,60,0.7)');
    oval(g, 50, 67, 11.5, 10.5, lin(g, 0, 56, 0, 78, [[0, '#ffe08a'], [1, '#b8802a']]), 2.5);
    oval(g, 50, 67, 8.5, 7.5, rad(g, 50, 69, 9, [[0, '#fffbd0'], [0.45, '#ffb43a'], [1, '#e0401a']]), 2);
    shape(g, () => { g.moveTo(45, 73); g.quadraticCurveTo(44, 66, 48, 63); g.quadraticCurveTo(48, 67, 50, 67); g.quadraticCurveTo(50, 62, 53, 60); g.quadraticCurveTo(57, 66, 55, 73); g.closePath(); }, '#fff3a0', 0);
    g.save(); g.beginPath(); g.ellipse(50, 67, 8.5, 7.5, 0, 0, TAU); g.clip();
    g.strokeStyle = 'rgba(59,38,38,0.85)'; g.lineWidth = 1.8; g.beginPath();
    [46.5, 53.5].forEach(x => { g.moveTo(x, 58); g.lineTo(x, 76); }); g.stroke();
    g.restore();
    // 앞팔과 원뿔 창
    shape(g, () => { g.moveTo(27, 58); g.lineTo(2, 63.5); g.lineTo(27, 69); g.closePath(); }, lin(g, 0, 58, 0, 69, [[0, '#ffffff'], [0.5, '#c8d2e2'], [1, '#7a8498']]), 2.2);
    g.strokeStyle = 'rgba(240,192,80,0.95)'; g.lineWidth = 2; g.beginPath(); g.moveTo(15, 61); g.lineTo(15, 66); g.stroke();
    oval(g, 27, 63.5, 3.5, 9, lin(g, 0, 54, 0, 73, [[0, '#ffe08a'], [1, '#b8802a']]), 2);
    oval(g, 34, 62, 5.5, 7.5, lin(g, 0, 55, 0, 70, [[0, '#ffb67a'], [1, '#a85a2a']]), 2.5, 0.35);
    oval(g, 30.5, 64, 4.6, 4.6, iron, 2);
    // 투구 머리와 얼굴판
    shape(g, () => { g.moveTo(31, 46); g.quadraticCurveTo(28, 18, 48, 17); g.quadraticCurveTo(68, 18, 65, 46); g.quadraticCurveTo(48, 51, 31, 46); },
      lin(g, 0, 17, 0, 50, [[0, '#eef2fa'], [0.5, '#aab6ca'], [1, '#6a7490']]), 2.8);
    shape(g, () => g.roundRect(34, 27, 27, 20.5, 8), lin(g, 0, 27, 0, 47, [[0, '#fff6e8'], [1, '#ffd8b8']]), 2);
    shape(g, () => { g.moveTo(32, 28); g.quadraticCurveTo(48, 21, 64, 28); g.lineTo(64, 31); g.quadraticCurveTo(48, 24.5, 32, 31); g.closePath(); }, '#f0c050', 1.8);
    eye(g, 41.5, 36, '#b04a1a', 0.72); eye(g, 53, 36, '#b04a1a', 0.72);
    blush(g, 37.5, 41.5, 0.55); blush(g, 57, 41.5, 0.55);
    smile(g, 47.5, 43, 2);
    rivet(g, 33.5, 38, 1.3);
    oval(g, 66, 37, 4.5, 4.5, '#fff6e0', 1.8);                                // 압력계
    g.strokeStyle = '#d0402a'; g.lineWidth = 1.3; g.beginPath(); g.moveTo(66, 37); g.lineTo(68.5, 34.5); g.stroke();
    shine(g, 40, 21, 6, 2.2, 0.5, -0.2);
    // 투구 굴뚝과 불꽃 장식
    shape(g, () => g.roundRect(43, 9, 9, 10, 2), lin(g, 43, 0, 52, 0, [[0, '#6a7288'], [1, '#2e3448']]), 2);
    shape(g, () => g.roundRect(41, 7.5, 13, 4, 2), '#f0c050', 1.8);
    glowAt(g, 47.5, 4, 11, 'rgba(255,170,60,0.75)');
    shape(g, () => { g.moveTo(43.5, 7.5); g.quadraticCurveTo(43, 3, 46, 0.5); g.quadraticCurveTo(46.5, 4, 48, 4); g.quadraticCurveTo(48.5, 0.5, 51, 0); g.quadraticCurveTo(53.5, 4, 51.5, 7.5); g.closePath(); }, '#ff9a3a', 1.5);
    shape(g, () => { g.moveTo(45.5, 7.5); g.quadraticCurveTo(46, 5, 48, 4.5); g.quadraticCurveTo(50.5, 5, 49.5, 7.5); g.closePath(); }, '#fff3a0', 0);
  });

  // ── 챕터 8 보스: 시간의 태엽지기 (192×192) ──
  // 등 뒤 거대한 시계 후광, 실크해트·외알 안경·콧수염의 시계지기 할아버지 인형, 진자 끝에 별조각
  X.clock_keeper = () => vs(192, 192, g => {
    // 등 뒤 거대한 시계 후광 (시곗바늘은 손에 든 창)
    glowAt(g, 100, 70, 96, 'rgba(255,214,140,0.45)');
    cog(g, 100, 70, 66, 18, brass(g, 4, 136), 3, 0, 0.14);
    oval(g, 100, 70, 52, 52, rad(g, 100, 70, 56, [[0, '#5ab8b4'], [1, '#1e5262']]), 3);
    g.strokeStyle = 'rgba(255,233,160,0.45)'; g.lineWidth = 1.5; g.beginPath(); g.arc(100, 70, 47, 0, TAU); g.stroke();
    for (let i = 0; i < 12; i++) {
      const a = i * TAU / 12, cx = 100 + Math.cos(a) * 43, cy = 70 + Math.sin(a) * 43;
      if (i % 3 === 0) oval(g, cx, cy, 3.6, 3.6, '#ffe9a0', 1.8);
      else { g.strokeStyle = 'rgba(255,233,160,0.8)'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(100 + Math.cos(a) * 39, 70 + Math.sin(a) * 39); g.lineTo(100 + Math.cos(a) * 46, 70 + Math.sin(a) * 46); g.stroke(); }
    }
    // 떠다니는 작은 톱니
    cog(g, 172, 26, 10, 8, brass(g, 16, 36), 2, 0.3); oval(g, 172, 26, 3, 3, '#a8701e', 1.5);
    cog(g, 16, 150, 8, 8, brass(g, 142, 158), 2, 0.1); oval(g, 16, 150, 2.5, 2.5, '#a8701e', 1.5);
    // 등의 큰 태엽 열쇠와 뒷팔
    windKey(g, 138, 116, 2);
    oval(g, 144, 126, 10, 20, lin(g, 0, 106, 0, 146, [[0, '#2e7a84'], [1, '#174450']]), 3, -0.2);
    // 발
    oval(g, 78, 181, 17, 7, lin(g, 0, 174, 0, 188, [[0, '#6a7a88'], [1, '#2a3440']]), 3);
    oval(g, 124, 181, 17, 7, lin(g, 0, 174, 0, 188, [[0, '#6a7a88'], [1, '#2a3440']]), 3);
    // 긴 외투 몸통
    shape(g, () => { g.moveTo(56, 178); g.lineTo(62, 102); g.quadraticCurveTo(66, 86, 84, 84); g.lineTo(116, 84); g.quadraticCurveTo(134, 86, 138, 102); g.lineTo(146, 178); g.quadraticCurveTo(100, 188, 56, 178); },
      lin(g, 56, 0, 146, 0, [[0, '#1e5a66'], [0.45, '#3aa0a0'], [1, '#174450']]), 3.5);
    g.strokeStyle = '#f0c050'; g.lineWidth = 4; g.beginPath(); g.moveTo(58, 171); g.quadraticCurveTo(100, 181, 144, 171); g.stroke();
    // 괘종시계 몸판과 진자 창
    shape(g, () => g.roundRect(78, 92, 44, 82, 14), lin(g, 78, 0, 122, 0, [[0, '#6a3e22'], [0.5, '#b0703e'], [1, '#5a341c']]), 3);
    g.strokeStyle = 'rgba(255,220,140,0.7)'; g.lineWidth = 1.5; g.beginPath(); g.roundRect(82, 96, 36, 74, 11); g.stroke();
    oval(g, 100, 103, 3.5, 3.5, brass(g, 99, 107), 1.8); oval(g, 100, 112, 3.5, 3.5, brass(g, 108, 116), 1.8);
    shape(g, () => g.roundRect(86, 120, 28, 46, 12), lin(g, 0, 120, 0, 166, [[0, '#10303a'], [1, '#22505c']]), 2.5);
    g.strokeStyle = 'rgba(200,240,255,0.35)'; g.lineWidth = 1.5; g.beginPath(); g.arc(100, 122, 36, 0.4 * Math.PI, 0.6 * Math.PI); g.stroke();
    g.strokeStyle = OUT; g.lineWidth = 4; g.beginPath(); g.moveTo(100, 122); g.lineTo(100, 143); g.stroke();
    g.strokeStyle = '#f0c050'; g.lineWidth = 2; g.beginPath(); g.moveTo(100, 122); g.lineTo(100, 143); g.stroke();
    // 진자 끝에 매달린 별조각
    glowAt(g, 100, 151, 28, 'rgba(200,245,255,0.9)');
    shape(g, () => { g.moveTo(94, 161); g.lineTo(96, 146); g.lineTo(101, 139); g.lineTo(107, 150); g.lineTo(105, 161); g.closePath(); }, '#e0f8ff', 2);
    shape(g, () => { g.moveTo(98, 158); g.lineTo(99, 148); g.lineTo(101.5, 144); g.lineTo(102, 158); g.closePath(); }, '#ffffff', 0);
    shine(g, 91, 130, 2, 7, 0.35, 0.15);
    // 뒷손과 회중시계
    g.strokeStyle = '#f0c050'; g.lineWidth = 2; g.beginPath(); g.moveTo(150, 146); g.lineTo(155, 151); g.stroke();
    oval(g, 156, 161, 11, 11, brass(g, 150, 172), 2.5);
    oval(g, 156, 161, 8, 8, '#fff8e8', 1.8);
    g.strokeStyle = OUT; g.lineWidth = 1.6; g.beginPath(); g.moveTo(156, 161); g.lineTo(156, 155.5); g.moveTo(156, 161); g.lineTo(160, 163); g.stroke();
    oval(g, 150, 143, 7, 6.5, brass(g, 136, 150), 2.5);
    // 시곗바늘 창 (앞손)
    g.strokeStyle = OUT; g.lineWidth = 8; g.beginPath(); g.moveTo(36, 184); g.lineTo(36, 44); g.stroke();
    g.strokeStyle = '#e8b448'; g.lineWidth = 4.5; g.beginPath(); g.moveTo(36, 184); g.lineTo(36, 44); g.stroke();
    oval(g, 36, 184, 5, 5, brass(g, 179, 189), 2.5);
    glowAt(g, 36, 36, 14, 'rgba(200,245,255,0.7)');
    g.strokeStyle = OUT; g.lineWidth = 8; g.beginPath(); g.arc(36, 36, 9, 0, TAU); g.stroke();
    g.strokeStyle = '#f0c050'; g.lineWidth = 4.5; g.beginPath(); g.arc(36, 36, 9, 0, TAU); g.stroke();
    shape(g, () => { g.moveTo(36, 3); g.lineTo(45, 22); g.lineTo(36, 27); g.lineTo(27, 22); g.closePath(); }, brass(g, 3, 27), 2.5);
    shine(g, 33, 14, 1.6, 5, 0.6, 0.4);
    // 앞팔과 어깨 갑옷
    oval(g, 52, 116, 10, 20, lin(g, 0, 96, 0, 136, [[0, '#3aa0a0'], [1, '#1e5a66']]), 3, 0.65);
    oval(g, 39, 131, 9, 8, brass(g, 123, 139), 3);
    g.strokeStyle = OUT; g.lineWidth = 2; g.beginPath(); g.moveTo(33, 129); g.lineTo(44, 129); g.moveTo(33, 133.5); g.lineTo(44, 133.5); g.stroke();
    for (const [x, r] of [[136, 0.35], [64, -0.35]]) {
      oval(g, x, 98, 17, 12, brass(g, 86, 110), 3, r);
      shine(g, x - 5, 93, 6, 2.5, 0.55, r - 0.2);
      rivet(g, x + (x < 100 ? 8 : -8), 101 + (x < 100 ? -3 : 3), 1.8);
    }
    // 나비넥타이와 귀 톱니
    shape(g, () => { g.moveTo(97, 91); g.lineTo(85, 85); g.lineTo(85, 97); g.closePath(); }, '#e0405a', 2);
    shape(g, () => { g.moveTo(97, 91); g.lineTo(109, 85); g.lineTo(109, 97); g.closePath(); }, '#e0405a', 2);
    oval(g, 97, 91, 3.5, 3.5, '#b02a3a', 2);
    cog(g, 128, 60, 11, 8, brass(g, 49, 71), 2.5, 0.2); oval(g, 128, 60, 3.5, 3.5, '#a8701e', 2);
    // 도자기 얼굴
    oval(g, 98, 58, 30, 27, rad(g, 98, 58, 32, [[0, '#fffaf2'], [1, '#f2dcc6']]), 3.5);
    for (const [x0, y0, x1, y1] of [[71, 44, 88, 48.5], [116, 44, 100, 48.5]]) {            // 숱 많은 흰 눈썹
      g.strokeStyle = OUT; g.lineWidth = 8; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
      g.strokeStyle = '#f6f6fa'; g.lineWidth = 5; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
    }
    eye(g, 82, 61, '#2a7a8a', 1.5); eye(g, 106, 61, '#2a7a8a', 1.5);
    g.fillStyle = 'rgba(210,245,255,0.22)'; g.beginPath(); g.arc(106, 61, 12, 0, TAU); g.fill();   // 외알 안경
    g.strokeStyle = OUT; g.lineWidth = 5.5; g.beginPath(); g.arc(106, 61, 12, 0, TAU); g.stroke();
    g.strokeStyle = '#f0c050'; g.lineWidth = 3; g.beginPath(); g.arc(106, 61, 12, 0, TAU); g.stroke();
    g.strokeStyle = '#f0c050'; g.lineWidth = 1.8; g.beginPath(); g.moveTo(117, 66); g.quadraticCurveTo(126, 80, 110, 89); g.stroke();
    blush(g, 69, 71, 1.1); blush(g, 121, 73, 1.0);
    shape(g, () => {                                                                         // 끝이 말려 올라간 은빛 콧수염
      g.moveTo(94, 68); g.quadraticCurveTo(87, 64, 82, 69); g.quadraticCurveTo(79, 72, 76, 67); g.quadraticCurveTo(76, 76, 84, 76); g.quadraticCurveTo(90, 76, 94, 72);
      g.quadraticCurveTo(98, 76, 104, 76); g.quadraticCurveTo(112, 76, 112, 67); g.quadraticCurveTo(109, 72, 106, 69); g.quadraticCurveTo(101, 64, 94, 68); g.closePath();
    }, lin(g, 0, 64, 0, 77, [[0, '#ffffff'], [1, '#c4c8d6']]), 2.5);
    oval(g, 94, 66, 3.5, 2.8, '#f8c8b0', 1.8);                                                // 코
    smile(g, 94, 81.5, 3.5);
    // 실크해트 (톱니 휘장)
    const hatC = lin(g, 0, 4, 0, 40, [[0, '#2f5a6a'], [1, '#132a34']]);
    oval(g, 96, 35, 36, 7.5, hatC, 3, -0.05);
    shape(g, () => { g.moveTo(74, 34); g.lineTo(76, 8); g.quadraticCurveTo(96, 3, 118, 8); g.lineTo(120, 34); g.quadraticCurveTo(97, 39, 74, 34); }, hatC, 3);
    shape(g, () => { g.moveTo(74.6, 26); g.quadraticCurveTo(97, 31, 119.4, 26); g.lineTo(120, 34); g.quadraticCurveTo(97, 39, 74, 34); g.closePath(); }, brass(g, 26, 38), 2.5);
    cog(g, 88, 30, 7.5, 8, brass(g, 22, 38), 2, 0.2); oval(g, 88, 30, 2.6, 2.6, '#9ae0ff', 1.5);
    shine(g, 84, 16, 3, 7, 0.25, 0.1);
    // 시간의 반짝임
    [[164, 58], [24, 92], [150, 10]].forEach(([x, y]) => { glowAt(g, x, y, 9, 'rgba(200,245,255,0.85)'); star(g, x, y, 3.5, '#e8fbff'); });
  });
})();

// 챕터 9 그림자 성 — 몬스터·보스 그림
(() => {
  const X = window.STAR_EXTRA_SPR = window.STAR_EXTRA_SPR || {};

  // 박쥐 날개 한 쪽 (translate·scale로 좌우를 뒤집어 씀)
  function batWing(g, c1, c2, bone) {
    shape(g, () => {
      g.moveTo(8, -2); g.quadraticCurveTo(24, -30, 44, -24);
      g.quadraticCurveTo(40, -16, 43, -8); g.quadraticCurveTo(35, -11, 33, -3);
      g.quadraticCurveTo(26, -7, 23, 3); g.quadraticCurveTo(15, -1, 8, 6); g.closePath();
    }, lin(g, 0, -26, 0, 6, [[0, c1], [1, c2]]), 2.5);
    g.strokeStyle = bone; g.lineWidth = 1.5; g.beginPath();
    g.moveTo(10, 0); g.quadraticCurveTo(26, -18, 43, -23); g.moveTo(14, 0); g.lineTo(33, -4); g.moveTo(12, 2); g.lineTo(23, 2); g.stroke();
  }
  // 몸에 박힌 별조각 (기존 보스와 같은 하늘색 결정)
  function shard(g, x, y, s) {
    glowAt(g, x, y - 12 * s, 26 * s, 'rgba(200,240,255,0.85)');
    shape(g, () => { g.moveTo(x - 6 * s, y); g.lineTo(x - 4 * s, y - 20 * s); g.lineTo(x + 3 * s, y - 28 * s); g.lineTo(x + 8 * s, y - 14 * s); g.lineTo(x + 5 * s, y); g.closePath(); }, '#e0f8ff', 2);
    shape(g, () => { g.moveTo(x - 2 * s, y - 3 * s); g.lineTo(x - 1 * s, y - 18 * s); g.lineTo(x + 2 * s, y - 22 * s); g.lineTo(x + 1.5 * s, y - 3 * s); g.closePath(); }, '#ffffff', 0);
  }
  // 반짝이 (십자 빛)
  function twinkle(g, x, y, r, rgba) {
    glowAt(g, x, y, r * 2, rgba);
    g.fillStyle = '#ffffff';
    g.beginPath(); g.moveTo(x, y - r); g.lineTo(x + r * 0.22, y); g.lineTo(x, y + r); g.lineTo(x - r * 0.22, y); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(x - r, y); g.lineTo(x, y + r * 0.22); g.lineTo(x + r, y); g.lineTo(x, y - r * 0.22); g.closePath(); g.fill();
  }

  // ── 유령 기사: 투구 쓴 유령, 앞에는 칼, 등에는 달 방패 ──
  X.ghostknight = () => vs(96, 96, g => {
    glowAt(g, 50, 58, 44, 'rgba(150,130,255,0.32)');
    // 등 뒤 방패
    shape(g, () => { g.moveTo(64, 48); g.lineTo(88, 48); g.quadraticCurveTo(90, 70, 76, 84); g.quadraticCurveTo(62, 70, 64, 48); g.closePath(); },
      lin(g, 64, 0, 90, 0, [[0, '#7a6ab0'], [1, '#3a2c66']]), 2.5);
    g.strokeStyle = '#d8d0f4'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(67, 52); g.lineTo(85, 52); g.quadraticCurveTo(86, 68, 76, 79); g.stroke();
    shape(g, () => { g.arc(77, 64, 6, 0.6, TAU - 0.6); g.quadraticCurveTo(76, 64, 81, 67); g.closePath(); }, '#ffe9a0', 1.5);
    // 유령 몸 (아래는 흐릿한 물결 꼬리)
    shape(g, () => {
      g.moveTo(26, 46); g.quadraticCurveTo(20, 70, 28, 84); g.quadraticCurveTo(33, 80, 37, 87); g.quadraticCurveTo(42, 81, 47, 89);
      g.quadraticCurveTo(52, 81, 57, 87); g.quadraticCurveTo(62, 80, 67, 84); g.quadraticCurveTo(76, 68, 70, 46); g.quadraticCurveTo(48, 28, 26, 46); g.closePath();
    }, lin(g, 0, 30, 0, 90, [[0, '#f6f4ff'], [0.55, '#cdc6f6'], [1, 'rgba(170,158,240,0.45)']]), 2.5);
    shine(g, 32, 70, 3, 6, 0.45, 0.2);
    // 얼굴
    eye(g, 39, 56, '#7a4ae0', 0.82); eye(g, 54, 56, '#7a4ae0', 0.82);
    blush(g, 33, 64, 0.7); blush(g, 60, 64, 0.7);
    smile(g, 46, 67, 2.6);
    // 투구 (둥근 지붕 + 챙 + 들어 올린 면갑)
    shape(g, () => { g.moveTo(24, 46); g.bezierCurveTo(22, 10, 74, 10, 72, 46); g.closePath(); },
      lin(g, 0, 12, 0, 46, [[0, '#f4f6ff'], [0.45, '#b4b6d4'], [1, '#6e6e92']]), 2.5);
    shape(g, () => { g.moveTo(29, 31); g.quadraticCurveTo(48, 19, 67, 31); g.lineTo(68, 37); g.quadraticCurveTo(48, 26, 28, 37); g.closePath(); }, lin(g, 0, 22, 0, 37, [[0, '#9a9ac0'], [1, '#5a5a80']]), 2);
    g.strokeStyle = '#2a2440'; g.lineWidth = 1.8; g.beginPath(); g.moveTo(37, 31.5); g.lineTo(45, 29); g.moveTo(51, 29); g.lineTo(59, 31.5); g.stroke();
    shape(g, () => g.roundRect(22, 41, 52, 7, 3.5), lin(g, 0, 41, 0, 48, [[0, '#c8c8e4'], [1, '#7a7aa0']]), 2.5);
    [30, 48, 66].forEach(x => oval(g, x, 44.5, 1.6, 1.6, '#f4f2ff', 1));
    shine(g, 36, 22, 6, 2.6, 0.7, -0.5);
    // 보라 깃털 장식 (뒤로 휘날림)
    shape(g, () => { g.moveTo(46, 16); g.quadraticCurveTo(52, 1, 70, 3); g.quadraticCurveTo(85, 7, 90, 21); g.quadraticCurveTo(80, 12, 68, 13); g.quadraticCurveTo(58, 13, 52, 20); g.closePath(); },
      lin(g, 46, 0, 90, 0, [[0, '#e0a8ff'], [1, '#7a3ac0']]), 2.2);
    g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(52, 13); g.quadraticCurveTo(66, 4, 84, 13); g.stroke();
    // 칼 (왼쪽 앞, 위로 치켜듦)
    g.save(); g.translate(21, 68); g.rotate(-0.32);
    glowAt(g, 0, -24, 16, 'rgba(190,150,255,0.45)');
    shape(g, () => { g.moveTo(-4, -4); g.lineTo(-4, -36); g.lineTo(0, -45); g.lineTo(4, -36); g.lineTo(4, -4); g.closePath(); }, lin(g, -4, 0, 4, 0, [[0, '#ffffff'], [1, '#9aa0c8']]), 2);
    g.strokeStyle = 'rgba(120,110,170,0.6)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(0, -6); g.lineTo(0, -38); g.stroke();
    shape(g, () => g.roundRect(-10, -6, 20, 5, 2.5), '#8a5ad0', 2);
    shape(g, () => g.roundRect(-2.5, -1, 5, 10, 2), '#3a2a4a', 1.5);
    oval(g, 0, 10, 3, 3, '#ffe27a', 1.5);
    g.restore();
    oval(g, 22, 69, 5.5, 5, '#e8e4ff', 2);                // 유령 손
    // 꼬리 끝 도깨비불
    [[20, 84, 2.2], [76, 88, 1.8], [12, 52, 1.6]].forEach(([x, y, r]) => glowAt(g, x, y, r * 4, 'rgba(210,190,255,0.9)'));
  });

  // ── 박쥐 마녀: 마녀 모자 쓴 동글 박쥐, 저주 화살을 쏨 ──
  X.batwitch = () => vs(96, 96, g => {
    glowAt(g, 48, 56, 42, 'rgba(210,100,255,0.25)');
    for (const s of [-1, 1]) {                            // 날개
      g.save(); g.translate(48, 58); g.scale(s, 1);
      batWing(g, '#8a5ac0', '#3a1e5a', 'rgba(230,200,255,0.55)');
      g.restore();
    }
    // 작은 발
    g.strokeStyle = OUT; g.lineWidth = 2;
    g.beginPath(); g.moveTo(43, 76); g.lineTo(42, 84); g.moveTo(54, 76); g.lineTo(55, 84); g.stroke();
    oval(g, 41, 85, 3.5, 2.4, '#4a2a5a', 1.5); oval(g, 56, 85, 3.5, 2.4, '#4a2a5a', 1.5);
    // 박쥐 귀
    shape(g, () => { g.moveTo(31, 52); g.quadraticCurveTo(18, 42, 16, 30); g.quadraticCurveTo(30, 34, 40, 46); g.closePath(); }, '#7a4ab0', 2.2);
    shape(g, () => { g.moveTo(65, 52); g.quadraticCurveTo(78, 42, 80, 30); g.quadraticCurveTo(66, 34, 56, 46); g.closePath(); }, '#7a4ab0', 2.2);
    shape(g, () => { g.moveTo(31, 48); g.quadraticCurveTo(23, 41, 21, 34); g.quadraticCurveTo(30, 37, 37, 45); g.closePath(); }, '#ff9ad0', 0);
    shape(g, () => { g.moveTo(65, 48); g.quadraticCurveTo(73, 41, 75, 34); g.quadraticCurveTo(66, 37, 59, 45); g.closePath(); }, '#ff9ad0', 0);
    // 동글 몸
    oval(g, 48, 61, 20, 19, rad(g, 48, 61, 22, [[0, '#e4ccff'], [0.6, '#a676dc'], [1, '#5e3496']]), 3);
    g.fillStyle = 'rgba(245,232,255,0.45)'; g.beginPath(); g.ellipse(48, 74, 11, 5.5, 0, 0, TAU); g.fill();   // 보송한 배
    shine(g, 38, 50, 6, 3, 0.55, -0.4);
    // 얼굴
    eye(g, 40, 59, '#ff3a8a', 0.85); eye(g, 55, 59, '#ff3a8a', 0.85);
    blush(g, 34, 67, 0.7); blush(g, 61, 67, 0.7);
    smile(g, 47, 70, 3);
    shape(g, () => { g.moveTo(47.6, 70.2); g.lineTo(48.9, 73.8); g.lineTo(50.2, 69.6); g.closePath(); }, '#ffffff', 1.2);   // 송곳니
    // 마녀 모자 (끝이 뒤로 꺾임)
    oval(g, 49, 42, 24, 5.5, lin(g, 0, 36, 0, 48, [[0, '#5a3a8a'], [1, '#2a1a48']]), 2.5, -0.06);
    shape(g, () => { g.moveTo(35, 42); g.quadraticCurveTo(40, 26, 50, 16); g.quadraticCurveTo(58, 8, 74, 9); g.quadraticCurveTo(62, 15, 62, 41); g.quadraticCurveTo(48, 45, 35, 42); g.closePath(); },
      lin(g, 0, 8, 0, 42, [[0, '#6a46a0'], [1, '#2e1c50']]), 2.5);
    shape(g, () => { g.moveTo(36.5, 36); g.quadraticCurveTo(49, 33, 61.5, 35); g.lineTo(62, 40.5); g.quadraticCurveTo(48, 43.5, 35.5, 41); g.closePath(); }, '#ff7ac0', 2);
    shape(g, () => { g.arc(45, 38.5, 3.4, 0.7, TAU - 0.7); g.quadraticCurveTo(45, 38.5, 48, 40.5); g.closePath(); }, '#ffe27a', 1.2);   // 달 장식
    shine(g, 44, 24, 2.5, 6, 0.35, 0.5);
    star(g, 75, 9, 4.5, '#ffe27a');
    // 저주 활과 화살 (왼쪽을 겨눔)
    g.strokeStyle = OUT; g.lineWidth = 4.5; g.beginPath(); g.moveTo(22, 46); g.quadraticCurveTo(7, 63, 22, 80); g.stroke();
    g.strokeStyle = '#a060e0'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(22, 46); g.quadraticCurveTo(7, 63, 22, 80); g.stroke();
    g.strokeStyle = '#f0e0ff'; g.lineWidth = 1; g.beginPath(); g.moveTo(22, 46); g.lineTo(30, 63); g.lineTo(22, 80); g.stroke();
    glowAt(g, 7, 63, 12, 'rgba(240,110,255,0.85)');
    g.strokeStyle = OUT; g.lineWidth = 3; g.beginPath(); g.moveTo(30, 63); g.lineTo(10, 63); g.stroke();
    g.strokeStyle = '#d8b0ff'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(30, 63); g.lineTo(10, 63); g.stroke();
    shape(g, () => { g.moveTo(3, 63); g.lineTo(12, 58.5); g.lineTo(10, 63); g.lineTo(12, 67.5); g.closePath(); }, '#f6a8ff', 1.5);
    shape(g, () => { g.moveTo(29, 63); g.lineTo(34, 59); g.lineTo(32, 63); g.lineTo(34, 67); g.closePath(); }, '#ff7ac0', 1.2);
    oval(g, 20, 63, 4.4, 4, '#b080e0', 2);                // 날개 손
  });

  // ── 가고일: 돌 날개와 뿔, 호박색으로 빛나는 눈 ──
  X.gargoyle = () => vs(96, 96, g => {
    const stone = (y0, y1) => lin(g, 0, y0, 0, y1, [[0, '#cfcbe0'], [0.5, '#9a96b2'], [1, '#625e7c']]);
    for (const s of [-1, 1]) {                            // 돌 날개
      g.save(); g.translate(50, 54); g.scale(s * (s > 0 ? 1.05 : 0.85), s > 0 ? 1.05 : 0.85);
      batWing(g, '#8e8aa8', '#4a4664', 'rgba(220,215,240,0.5)');
      g.restore();
    }
    // 꼬리
    g.strokeStyle = OUT; g.lineWidth = 7; g.beginPath(); g.moveTo(64, 80); g.quadraticCurveTo(88, 86, 86, 66); g.stroke();
    g.strokeStyle = '#8a86a2'; g.lineWidth = 4; g.beginPath(); g.moveTo(64, 80); g.quadraticCurveTo(88, 86, 86, 66); g.stroke();
    shape(g, () => { g.moveTo(86, 56); g.lineTo(92, 67); g.lineTo(80, 67); g.closePath(); }, '#8a86a2', 2);
    // 발
    oval(g, 36, 86, 9, 4.5, '#6e6a86', 2.5); oval(g, 60, 86, 9, 4.5, '#6e6a86', 2.5);
    g.strokeStyle = OUT; g.lineWidth = 1.5; g.beginPath();
    [30, 34, 38, 54, 58, 62].forEach(x => { g.moveTo(x - 1, 87); g.lineTo(x - 2, 90); });
    g.stroke();
    // 몸통
    oval(g, 48, 70, 22, 17, stone(52, 88), 3);
    oval(g, 47, 73, 12, 9, lin(g, 0, 64, 0, 82, [[0, '#e2dfee'], [1, '#aaa6c0']]), 2);
    glowAt(g, 47, 73, 9, 'rgba(200,120,255,0.6)');                 // 가슴의 보라 룬
    g.strokeStyle = '#c070ff'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(47, 68); g.lineTo(51, 73); g.lineTo(47, 78); g.lineTo(43, 73); g.closePath(); g.moveTo(47, 70.5); g.lineTo(47, 75.5); g.stroke();
    // 앞 팔과 발톱
    oval(g, 26, 74, 7, 8, stone(66, 82), 2.5, 0.3);
    g.strokeStyle = OUT; g.lineWidth = 2; g.beginPath(); g.moveTo(21, 78); g.lineTo(17, 82); g.moveTo(24, 80); g.lineTo(21, 85); g.moveTo(27, 81); g.lineTo(26, 86); g.stroke();
    // 귀
    shape(g, () => { g.moveTo(26, 38); g.lineTo(10, 30); g.lineTo(26, 48); g.closePath(); }, '#9a96b2', 2.2);
    shape(g, () => { g.moveTo(62, 36); g.lineTo(78, 28); g.lineTo(64, 47); g.closePath(); }, '#9a96b2', 2.2);
    // 머리
    oval(g, 44, 44, 21, 18, rad(g, 44, 44, 24, [[0, '#e0dcee'], [0.55, '#a29eba'], [1, '#68647e']]), 3);
    // 뿔
    const horn = lin(g, 0, 8, 0, 32, [[0, '#4a4462'], [1, '#2a2640']]);
    shape(g, () => { g.moveTo(29, 31); g.quadraticCurveTo(20, 18, 28, 6); g.quadraticCurveTo(31, 20, 38, 27); g.closePath(); }, horn, 2.2);
    shape(g, () => { g.moveTo(52, 27); g.quadraticCurveTo(60, 12, 74, 10); g.quadraticCurveTo(64, 18, 61, 31); g.closePath(); }, horn, 2.2);
    // 금과 이끼
    g.strokeStyle = 'rgba(60,50,80,0.6)'; g.lineWidth = 1.5; g.beginPath();
    g.moveTo(58, 32); g.lineTo(55, 38); g.lineTo(58, 42); g.moveTo(62, 66); g.lineTo(58, 72); g.lineTo(62, 76); g.stroke();
    oval(g, 36, 28, 6, 3, '#7a9a6a', 1.5); oval(g, 66, 60, 5, 2.5, '#7a9a6a', 1.5);
    shine(g, 34, 34, 6, 3, 0.45, -0.4);
    // 얼굴 (호박색 눈, 성난 돌 눈썹)
    glowAt(g, 37, 45, 9, 'rgba(255,190,80,0.7)'); glowAt(g, 51, 45, 9, 'rgba(255,190,80,0.7)');
    eye(g, 37, 45, '#ff9a1a', 0.8); eye(g, 51, 45, '#ff9a1a', 0.8);
    g.strokeStyle = OUT; g.lineWidth = 3; g.beginPath(); g.moveTo(30, 36); g.lineTo(41, 39); g.moveTo(58, 36); g.lineTo(47, 39); g.stroke();
    shape(g, () => { g.moveTo(41, 51.5); g.lineTo(46, 51.5); g.lineTo(43.5, 54.5); g.closePath(); }, '#4a4462', 1.2);   // 코
    blush(g, 30, 54, 0.6); blush(g, 57, 54, 0.6);
    smile(g, 43.5, 59, 3.6);
    shape(g, () => { g.moveTo(40.6, 59.2); g.lineTo(41.8, 62.8); g.lineTo(43, 60.2); g.closePath(); }, '#ffffff', 1.2);   // 송곳니
    shape(g, () => { g.moveTo(44, 60.2); g.lineTo(45.2, 62.8); g.lineTo(46.4, 59.2); g.closePath(); }, '#ffffff', 1.2);
  });

  // ── 보스: 그림자 군주 (192×192) — 망토 입은 그림자 왕, 왕홀과 그림자 불꽃, 가슴에 별조각 ──
  X.shadow_lord = () => vs(192, 192, g => {
    glowAt(g, 96, 112, 100, 'rgba(120,70,210,0.38)');
    // 떠다니는 거울 조각 (뒤)
    [[22, 50, 9, -0.3], [172, 38, 7, 0.4], [178, 142, 8, 0.2]].forEach(([x, y, r, rot]) => {
      glowAt(g, x, y, r * 2.6, 'rgba(190,140,255,0.5)');
      g.save(); g.translate(x, y); g.rotate(rot);
      shape(g, () => { g.moveTo(0, -r * 1.4); g.lineTo(r * 0.8, -r * 0.2); g.lineTo(r * 0.3, r * 1.3); g.lineTo(-r * 0.8, r * 0.5); g.closePath(); }, lin(g, -r, -r, r, r, [[0, '#d8ccff'], [0.5, '#6a5a9a'], [1, '#2a2048']]), 2);
      shine(g, -r * 0.15, -r * 0.4, r * 0.18, r * 0.6, 0.85, 0.5);
      g.restore();
    });
    // 망토 (바깥 어둠 + 안감)
    shape(g, () => {
      g.moveTo(66, 64); g.quadraticCurveTo(22, 92, 12, 178); g.lineTo(28, 168); g.lineTo(36, 184); g.lineTo(52, 172); g.lineTo(60, 186);
      g.lineTo(132, 186); g.lineTo(140, 172); g.lineTo(156, 184); g.lineTo(164, 168); g.lineTo(180, 178); g.quadraticCurveTo(170, 92, 126, 64); g.closePath();
    }, lin(g, 0, 60, 0, 186, [[0, '#3e2c6a'], [1, '#160c2a']]), 3.5);
    shape(g, () => { g.moveTo(70, 70); g.quadraticCurveTo(36, 100, 30, 168); g.lineTo(162, 168); g.quadraticCurveTo(156, 100, 122, 70); g.closePath(); },
      lin(g, 0, 70, 0, 170, [[0, '#7a3aa0'], [1, '#3a1450']]), 0);
    // 로브 몸 (아래는 그림자 연기처럼 흩어짐)
    shape(g, () => {
      g.moveTo(68, 74); g.quadraticCurveTo(52, 124, 44, 176); g.quadraticCurveTo(54, 170, 62, 183); g.quadraticCurveTo(72, 170, 82, 185);
      g.quadraticCurveTo(94, 172, 104, 185); g.quadraticCurveTo(116, 172, 126, 183); g.quadraticCurveTo(136, 170, 148, 176); g.quadraticCurveTo(140, 124, 124, 74); g.closePath();
    }, lin(g, 0, 74, 0, 186, [[0, '#56408a'], [0.6, '#2c1c50'], [1, '#1c1036']]), 3);
    g.strokeStyle = 'rgba(200,170,255,0.55)'; g.lineWidth = 2.5;
    g.beginPath(); g.moveTo(90, 80); g.quadraticCurveTo(86, 130, 80, 176); g.stroke();
    // 허리띠와 초승달 버클
    shape(g, () => { g.moveTo(60, 124); g.quadraticCurveTo(96, 134, 134, 124); g.lineTo(136, 134); g.quadraticCurveTo(96, 144, 58, 134); g.closePath(); }, lin(g, 0, 124, 0, 142, [[0, '#8a6ac8'], [1, '#3e2a6a']]), 2.5);
    shape(g, () => { g.arc(96, 134, 8, 0.75, TAU - 0.75); g.quadraticCurveTo(96, 134, 103, 139); g.closePath(); }, lin(g, 0, 126, 0, 142, [[0, '#fff3c0'], [1, '#e0b040']]), 2);
    // 가슴의 별조각
    shard(g, 116, 116, 1.05);
    // 높은 깃 (머리 뒤)
    const collar = lin(g, 0, 26, 0, 76, [[0, '#a07ae0'], [1, '#3a2466']]);
    shape(g, () => { g.moveTo(74, 78); g.quadraticCurveTo(48, 60, 50, 28); g.quadraticCurveTo(64, 50, 84, 60); g.closePath(); }, collar, 3);
    shape(g, () => { g.moveTo(118, 78); g.quadraticCurveTo(144, 60, 142, 28); g.quadraticCurveTo(128, 50, 108, 60); g.closePath(); }, collar, 3);
    // 두건과 얼굴
    oval(g, 94, 62, 33, 31, lin(g, 0, 30, 0, 94, [[0, '#5a428e'], [1, '#22163e']]), 3.5);
    oval(g, 91, 68, 25, 22, rad(g, 91, 68, 28, [[0, '#fbf6ff'], [0.7, '#e0d6f4'], [1, '#bcaede']]), 3);
    shape(g, () => {                                       // 그림자 앞머리
      g.moveTo(64, 64); g.quadraticCurveTo(66, 42, 92, 42); g.quadraticCurveTo(118, 42, 118, 62);
      g.lineTo(110, 54); g.lineTo(104, 62); g.lineTo(96, 52); g.lineTo(88, 60); g.lineTo(80, 51); g.lineTo(73, 62); g.lineTo(70, 56); g.closePath();
    }, lin(g, 0, 42, 0, 64, [[0, '#3a2a62'], [1, '#1e1238']]), 2.5);
    eye(g, 81, 71, '#b03aff', 1.45); eye(g, 102, 71, '#b03aff', 1.45);
    g.strokeStyle = OUT; g.lineWidth = 3.5; g.beginPath(); g.moveTo(71, 59); g.lineTo(87, 63); g.moveTo(112, 59); g.lineTo(96, 63); g.stroke();
    blush(g, 72, 81, 1.1); blush(g, 110, 81, 1.1);
    smile(g, 91, 84, 5);
    shape(g, () => { g.moveTo(94, 82.3); g.lineTo(96, 87); g.lineTo(98, 81.6); g.closePath(); }, '#ffffff', 1.5);
    // 가시 왕관
    shape(g, () => {
      g.moveTo(70, 40); g.lineTo(63, 13); g.lineTo(78, 28); g.lineTo(84, 4); g.lineTo(94, 26); g.lineTo(104, 4); g.lineTo(110, 28);
      g.lineTo(125, 13); g.lineTo(118, 40); g.quadraticCurveTo(94, 47, 70, 40); g.closePath();
    }, lin(g, 0, 4, 0, 44, [[0, '#f0e8ff'], [0.5, '#9a8ac8'], [1, '#4a3a7a']]), 3);
    oval(g, 94, 36, 5, 5, rad(g, 94, 36, 6, [[0, '#ffd0e8'], [1, '#e0307a']]), 2);
    [[63, 13], [84, 4], [104, 4], [125, 13]].forEach(([x, y]) => oval(g, x, y, 3, 3, '#c890ff', 1.5));
    shine(g, 80, 22, 3, 6, 0.5, 0.4);
    // 왼손: 초승달 왕홀
    g.save(); g.translate(34, 116); g.rotate(-0.1);
    shape(g, () => g.roundRect(-3.5, -62, 7, 126, 3.5), lin(g, -4, 0, 4, 0, [[0, '#6a5a9a'], [1, '#2a1e48']]), 2.5);
    glowAt(g, 0, -78, 24, 'rgba(200,140,255,0.7)');
    shape(g, () => { g.moveTo(-15, -88); g.quadraticCurveTo(-15, -62, 0, -60); g.quadraticCurveTo(15, -62, 15, -88); g.quadraticCurveTo(9, -68, 0, -68); g.quadraticCurveTo(-9, -68, -15, -88); g.closePath(); },
      lin(g, 0, -90, 0, -60, [[0, '#f4ecff'], [1, '#9a86d0']]), 2.5);
    oval(g, 0, -80, 8, 8, rad(g, 0, -80, 9, [[0, '#ffffff'], [0.45, '#e0a8ff'], [1, '#7a2ac0']]), 2);
    g.restore();
    oval(g, 33, 118, 11, 10, lin(g, 0, 108, 0, 128, [[0, '#5a428e'], [1, '#2a1a48']]), 3);
    oval(g, 42, 114, 5, 4, '#4a3478', 2);
    // 오른손: 그림자 불꽃
    glowAt(g, 164, 90, 30, 'rgba(200,110,255,0.7)');
    shape(g, () => { g.moveTo(152, 104); g.quadraticCurveTo(148, 84, 160, 70); g.quadraticCurveTo(162, 82, 168, 76); g.quadraticCurveTo(178, 88, 174, 104); g.closePath(); },
      lin(g, 0, 70, 0, 104, [[0, '#fbe6ff'], [0.5, '#d080ff'], [1, '#7a2ac0']]), 2.5);
    oval(g, 163, 112, 14, 9, lin(g, 0, 103, 0, 121, [[0, '#5a428e'], [1, '#2a1a48']]), 3);
    [[152, 106], [158, 103], [165, 102], [172, 104]].forEach(([x, y]) => oval(g, x, y, 3.2, 4, '#4a3478', 2));
    twinkle(g, 60, 150, 5, 'rgba(220,190,255,0.7)'); twinkle(g, 150, 60, 4, 'rgba(220,190,255,0.7)');
  });
})();

// 챕터 10 별의 제단 — 몬스터·보스 그림
// 몬스터 96×96, 보스 192×192, 모두 왼쪽을 봄. sprites.js의 도구(vs, shape, oval, lin, rad, shine, glowAt, eye, blush, smile, star, OUT, TAU)를 쓴다.
(() => {
  const X = window.STAR_EXTRA_SPR = window.STAR_EXTRA_SPR || {};

  // 끝이 둥근 별 모양 (R 바깥 반지름, r 안쪽 반지름, rot 기울기)
  function softStar(g, x, y, R, r, rot, fill, lw = 2.5) {
    const v = [];
    for (let i = 0; i < 10; i++) { const a = rot - Math.PI / 2 + i * Math.PI / 5, d = i % 2 ? r : R; v.push([x + Math.cos(a) * d, y + Math.sin(a) * d]); }
    shape(g, () => {
      for (let i = 0; i < 10; i++) {
        const p = v[i], a = v[(i + 9) % 10], b = v[(i + 1) % 10], t = i % 2 ? 0.18 : 0.32;
        const ax = p[0] + (a[0] - p[0]) * t, ay = p[1] + (a[1] - p[1]) * t;
        i ? g.lineTo(ax, ay) : g.moveTo(ax, ay);
        g.quadraticCurveTo(p[0], p[1], p[0] + (b[0] - p[0]) * t, p[1] + (b[1] - p[1]) * t);
      }
      g.closePath();
    }, fill, lw);
  }
  // 네 갈래 반짝임 (외곽선 없음)
  function twinkle(g, x, y, s, c = '#ffffff') {
    g.fillStyle = c; g.beginPath();
    g.moveTo(x, y - s); g.quadraticCurveTo(x, y, x + s, y); g.quadraticCurveTo(x, y, x, y + s);
    g.quadraticCurveTo(x, y, x - s, y); g.quadraticCurveTo(x, y, x, y - s);
    g.fill();
  }
  // 불꽃 한 줄기: 큰 혀 + 옆의 작은 혀 (lean: 끝이 기우는 정도, c1 끝 색 → c2 밑동 색)
  function flame(g, x, y, h, w, lean, c1, c2, lw = 2) {
    shape(g, () => {
      g.moveTo(x - w, y);
      g.quadraticCurveTo(x - w * 1.1, y - h * 0.35, x - w * 0.55 + lean * 0.45, y - h * 0.62);
      g.quadraticCurveTo(x - w * 0.25 + lean * 0.3, y - h * 0.42, x - w * 0.05 + lean * 0.4, y - h * 0.48);
      g.quadraticCurveTo(x + lean * 0.5, y - h * 0.8, x + lean, y - h);
      g.quadraticCurveTo(x + w * 1.25 + lean * 0.2, y - h * 0.5, x + w, y);
      g.quadraticCurveTo(x, y + w * 0.6, x - w, y);
      g.closePath();
    }, lin(g, x + lean, y - h, x, y, [[0, c1], [1, c2]]), lw);
  }
  // 하늘색 별조각 (보스 몸에 박힘)
  function shard(g, x, y, s) {
    glowAt(g, x, y, 26 * s, 'rgba(200,240,255,0.85)');
    shape(g, () => { g.moveTo(x - 6 * s, y + 12 * s); g.lineTo(x - 4 * s, y - 6 * s); g.lineTo(x + 2 * s, y - 13 * s); g.lineTo(x + 7 * s, y - 1 * s); g.lineTo(x + 5 * s, y + 12 * s); g.closePath(); },
      lin(g, x - 6 * s, y - 13 * s, x + 7 * s, y + 12 * s, [[0, '#ffffff'], [0.5, '#e0f8ff'], [1, '#98d6f2']]), 2);
    g.fillStyle = 'rgba(255,255,255,0.9)';
    g.beginPath(); g.moveTo(x - 2.5 * s, y + 9 * s); g.lineTo(x - 1.5 * s, y - 5 * s); g.lineTo(x + 1.5 * s, y - 9 * s); g.lineTo(x + 0.5 * s, y + 9 * s); g.closePath(); g.fill();
  }
  // 금빛 별 부스러기 (작은 마름모)
  function crumb(g, x, y, s) {
    glowAt(g, x, y, s * 3.2, 'rgba(255,230,140,0.85)');
    shape(g, () => { g.moveTo(x, y - s); g.lineTo(x + s * 0.7, y); g.lineTo(x, y + s); g.lineTo(x - s * 0.7, y); g.closePath(); }, '#fff0b0', 1.2);
  }
  // 흰자가 있는 작은 눈 (보스 몸 곳곳)
  function bodyEye(g, x, y, s) {
    glowAt(g, x, y, 13 * s, 'rgba(255,215,110,0.55)');
    oval(g, x, y, 6.6 * s, 8 * s, lin(g, 0, y - 8 * s, 0, y + 8 * s, [[0, '#ffffff'], [1, '#e2d6ff']]), 2);
    eye(g, x - 0.5 * s, y + 0.3 * s, '#ffb020', s);
  }
  // 갈고리 발톱 (오른쪽을 향한 모양을 rot만큼 돌림)
  function claw(g, x, y, rot) {
    g.save(); g.translate(x, y); g.rotate(rot);
    shape(g, () => { g.moveTo(-5, -3.5); g.quadraticCurveTo(5, -5, 10, 1); g.quadraticCurveTo(2, 1.5, -5, 3.5); g.closePath(); }, '#e8deff', 2);
    g.restore();
  }

  // ── 별먼지 정령: 통통한 별 모양 정령, 앞에 별빛 구슬 (원거리) ──
  X.stardust = () => vs(96, 96, g => {
    glowAt(g, 44, 56, 46, 'rgba(255,230,170,0.5)');
    glowAt(g, 70, 60, 30, 'rgba(190,160,255,0.35)');
    // 뒤로 흩날리는 별가루 꼬리 (가는 빛줄기가 부드럽게 사라짐)
    g.lineCap = 'round';
    [[46, 6, 92, 36, 0.85], [58, 4.5, 94, 56, 0.7], [70, 3.5, 90, 76, 0.6]].forEach(([y0, w, tx, ty, a]) => {
      g.strokeStyle = lin(g, 56, 0, tx, 0, [[0, `rgba(240,220,255,${a})`], [0.55, `rgba(190,205,255,${a * 0.6})`], [1, 'rgba(170,210,255,0)']]);
      g.lineWidth = w; g.beginPath(); g.moveTo(56, y0); g.quadraticCurveTo(74, y0 + 2, tx, ty); g.stroke();
    });
    [[80, 44, 3.2], [90, 38, 2], [82, 59, 2.6], [88, 72, 1.8], [72, 66, 1.6]].forEach(([x, y, s]) => twinkle(g, x, y, s * 1.6, '#fffbe8'));
    // 몸
    softStar(g, 44, 56, 31, 20, -0.14, rad(g, 44, 56, 33, [[0, '#ffffff'], [0.4, '#fff4c0'], [0.8, '#ffd27a'], [1, '#f0a0c8']]), 3);
    shine(g, 33, 42, 7, 3.4, 0.8, -0.6); shine(g, 24, 52, 2.4, 1.5, 0.65);
    // 얼굴
    eye(g, 36, 56, '#b0602a', 0.85); eye(g, 50, 56, '#b0602a', 0.85);
    blush(g, 29, 65, 0.7); blush(g, 56, 65, 0.7);
    smile(g, 43, 67, 2.6);
    // 머리 위 반짝임과 별빛 구슬
    glowAt(g, 38, 16, 12, 'rgba(255,250,210,0.9)'); twinkle(g, 38, 16, 6);
    glowAt(g, 10, 38, 16, 'rgba(255,245,190,0.95)');
    twinkle(g, 10, 38, 9, 'rgba(255,255,255,0.9)');
    oval(g, 10, 38, 3.4, 3.4, '#ffffff', 0);
    [[18, 86, 2.2], [76, 20, 2.6], [12, 70, 1.6]].forEach(([x, y, s]) => twinkle(g, x, y, s * 1.8, '#fff6d0'));
  });

  // ── 운석 골렘: 불꽃 꼬리를 단 울퉁불퉁 운석 바위, 앞으로 내민 주먹 ──
  X.meteorgolem = () => vs(96, 96, g => {
    glowAt(g, 62, 38, 36, 'rgba(255,150,60,0.4)');
    // 뒤로 휘날리는 불꽃 꼬리 (겉불 + 속불)
    flame(g, 76, 54, 32, 9, 16, '#ff5a3a', '#ffa040', 2.5);
    flame(g, 62, 44, 40, 12, 22, '#ff6a3a', '#ffb040', 2.5);
    flame(g, 47, 38, 28, 8, 13, '#ff6a3a', '#ffb040', 2.5);
    flame(g, 64, 44, 25, 6, 15, '#ffd060', '#fffbe0', 0);
    flame(g, 49, 38, 16, 4, 8, '#ffd060', '#fffbe0', 0);
    flame(g, 77, 54, 18, 4.5, 9, '#ffd060', '#fffbe0', 0);
    // 다리와 뒤쪽 주먹
    const stone = (y0, y1) => lin(g, 0, y0, 0, y1, [[0, '#6e5e74'], [1, '#33283a']]);
    shape(g, () => g.roundRect(30, 72, 15, 16, 6), stone(72, 88), 2.5);
    shape(g, () => g.roundRect(53, 72, 15, 16, 6), stone(72, 88), 2.5);
    oval(g, 77, 62, 10, 11, stone(50, 74), 2.5);
    // 울퉁불퉁한 바위 몸
    const rock = () => {
      const R = [27, 25, 28, 26, 27, 24, 28, 25, 26];
      const P = R.map((r, i) => { const a = i * TAU / R.length - 0.3; return [48 + Math.cos(a) * r, 52 + Math.sin(a) * r * 0.92]; });
      const mid = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
      const m0 = mid(P[P.length - 1], P[0]);
      g.moveTo(m0[0], m0[1]);
      P.forEach((p, i) => { const m = mid(p, P[(i + 1) % P.length]); g.quadraticCurveTo(p[0], p[1], m[0], m[1]); });
      g.closePath();
    };
    shape(g, rock, rad(g, 48, 52, 32, [[0, '#a898ac'], [0.5, '#66566c'], [1, '#382c40']]), 3);
    g.save(); g.beginPath(); rock(); g.clip();
    glowAt(g, 60, 80, 26, 'rgba(255,120,40,0.55)');
    // 운석 구덩이
    [[64, 38, 5, 4], [71, 57, 4, 3.4], [27, 42, 3.4, 3]].forEach(([x, y, rx, ry]) => {
      oval(g, x, y, rx, ry, '#4a3c50', 1.5);
      g.fillStyle = 'rgba(255,255,255,0.22)'; g.beginPath(); g.ellipse(x + 0.6, y + ry * 0.35, rx * 0.7, ry * 0.45, 0, 0, Math.PI); g.fill();
    });
    // 용암이 비치는 금
    [[[21, 60], [28, 66], [26, 72], [34, 77]], [[56, 78], [60, 71], [68, 73], [73, 65]], [[62, 27], [66, 33], [74, 32], [77, 39]]].forEach(c => {
      for (const [w, col] of [[4.5, 'rgba(255,110,40,0.6)'], [2.4, '#ff9a3a'], [1, '#fff0a0']]) {
        g.strokeStyle = col; g.lineWidth = w; g.beginPath();
        c.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.stroke();
      }
    });
    g.restore();
    shape(g, rock, null, 3);
    shine(g, 35, 34, 8, 3.4, 0.35, -0.5);
    // 머리 위 작은 불꽃
    flame(g, 42, 30, 13, 5, 4, '#ff7a3a', '#ffd060', 2);
    flame(g, 42.5, 29.5, 7, 2.4, 2.5, '#ffe27a', '#fffbe0', 0);
    // 얼굴
    glowAt(g, 36, 51, 10, 'rgba(255,170,80,0.5)'); glowAt(g, 51, 51, 10, 'rgba(255,170,80,0.5)');
    eye(g, 36, 51, '#ff7a1a', 0.85); eye(g, 51, 51, '#ff7a1a', 0.85);
    g.strokeStyle = OUT; g.lineWidth = 2.5;
    g.beginPath(); g.moveTo(30, 41); g.lineTo(39, 43.5); g.moveTo(57, 41); g.lineTo(48, 43.5); g.stroke();
    blush(g, 29, 60, 0.75); blush(g, 57, 60, 0.75);
    smile(g, 43, 63, 3);
    // 앞으로 내민 주먹
    const fist = rad(g, 16, 64, 13, [[0, '#a898ac'], [0.6, '#66566c'], [1, '#3a2e42']]);
    oval(g, 17, 64, 12, 11, fist, 2.5);
    [[7, 57], [5.5, 64], [7, 71]].forEach(([x, y]) => oval(g, x, y, 4, 3.6, fist, 2));   // 쥔 손가락 마디
    oval(g, 16, 54, 5, 3.5, fist, 2, -0.3);                                               // 엄지
    g.strokeStyle = '#ff9a3a'; g.lineWidth = 1.8; g.beginPath(); g.moveTo(25, 58); g.lineTo(21, 63); g.lineTo(23, 69); g.moveTo(21, 63); g.lineTo(26, 65); g.stroke();
    // 튀는 불티
    [[88, 10, 2], [10, 36, 1.6], [90, 74, 1.8], [24, 22, 1.4]].forEach(([x, y, r]) => { glowAt(g, x, y, r * 4, 'rgba(255,170,80,0.85)'); oval(g, x, y, r, r, '#ffe27a', 0); });
  });

  // ── 공허의 눈: 큰 외눈 공 몸, 찢어진 날개, 깨진 고리, 아래 촉수 (원거리) ──
  X.voideye = () => vs(96, 96, g => {
    glowAt(g, 48, 50, 46, 'rgba(150,80,255,0.38)');
    // 찢어진 날개
    for (const s of [-1, 1]) {
      g.save(); g.translate(48, 44); g.scale(s, 1);
      shape(g, () => { g.moveTo(14, -4); g.quadraticCurveTo(30, -26, 45, -19); g.lineTo(38, -12); g.lineTo(45, -5); g.lineTo(35, -1); g.lineTo(40, 7); g.lineTo(28, 5); g.quadraticCurveTo(20, 7, 14, 8); g.closePath(); },
        lin(g, 0, -24, 0, 8, [[0, '#5e3c92'], [1, '#22143e']]), 2.5);
      g.strokeStyle = 'rgba(205,160,255,0.6)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(18, 0); g.quadraticCurveTo(30, -13, 40, -15); g.stroke();
      g.restore();
    }
    // 아래로 늘어진 촉수
    g.lineCap = 'round';
    [[38, 64, 28, 78, 34, 89], [48, 66, 52, 80, 46, 90], [58, 64, 68, 76, 62, 88]].forEach(([a, b, c, d, e, f]) => {
      g.strokeStyle = OUT; g.lineWidth = 7; g.beginPath(); g.moveTo(a, b); g.quadraticCurveTo(c, d, e, f); g.stroke();
      g.strokeStyle = '#4e2c86'; g.lineWidth = 4; g.beginPath(); g.moveTo(a, b); g.quadraticCurveTo(c, d, e, f); g.stroke();
      glowAt(g, e, f, 6, 'rgba(225,150,255,0.9)');
    });
    // 우주 같은 공 몸
    oval(g, 48, 47, 24, 23, rad(g, 48, 47, 26, [[0, '#8e70dc'], [0.55, '#48298e'], [1, '#1e1046']]), 3);
    [[29, 40, 1.3], [61, 31, 1], [66, 57, 1.3], [33, 61, 1], [57, 65, 1.2], [41, 28, 0.9]].forEach(([x, y, r]) => { g.fillStyle = 'rgba(255,255,255,0.85)'; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); });
    twinkle(g, 64, 40, 3, 'rgba(255,255,255,0.8)');
    // 큰 외눈 (눈꺼풀이 살짝 덮음)
    oval(g, 44, 45, 14, 13, lin(g, 0, 32, 0, 58, [[0, '#ffffff'], [1, '#e0d0ff']]), 2.5);
    eye(g, 41, 46.5, '#e040ff', 1.75);
    shape(g, () => { g.moveTo(30.5, 42); g.quadraticCurveTo(44, 26, 57.5, 42); g.quadraticCurveTo(44, 35, 30.5, 42); g.closePath(); }, lin(g, 0, 30, 0, 42, [[0, '#6a48b0'], [1, '#3a2070']]), 2);
    blush(g, 29, 59, 0.7); blush(g, 61, 57, 0.7);
    smile(g, 45, 64, 3);
    // 깨진 고리 (타락)
    g.save(); g.translate(50, 15); g.rotate(0.2);
    g.strokeStyle = OUT; g.lineWidth = 5; g.beginPath(); g.ellipse(0, 0, 13, 3.6, 0, 0.6, TAU - 0.35); g.stroke();
    g.strokeStyle = '#b880ff'; g.lineWidth = 2.5; g.beginPath(); g.ellipse(0, 0, 13, 3.6, 0, 0.6, TAU - 0.35); g.stroke();
    g.restore();
    oval(g, 66, 10, 1.8, 1.8, '#b880ff', 1.2);
    // 앞에 모이는 공허 광선 구슬
    glowAt(g, 12, 70, 14, 'rgba(210,100,255,0.8)');
    oval(g, 12, 70, 4.6, 4.6, rad(g, 12, 70, 5, [[0, '#ffffff'], [0.5, '#e094ff'], [1, '#6a2aa0']]), 1.5);
  });

  // ── 최종 보스: 별을 삼킨 자 (192×192) ──
  // 별빛을 삼키는 공허의 존재. 일식 고리, 수정 뿔, 별이 비치는 몸, 여러 개의 눈, 손에 쥔 금 간 별 부스러기, 가슴의 별조각.
  X.star_eater = () => vs(192, 192, g => {
    const HX = 82, HY = 70;                     // 머리 중심
    glowAt(g, 100, 106, 86, 'rgba(130,80,255,0.42)');
    glowAt(g, HX, HY, 70, 'rgba(255,215,140,0.45)');
    // 일식 고리: 빛살 + 금 간 고리
    for (let i = 0; i < 14; i++) {
      const a = i * TAU / 14 + 0.12, r0 = 50, r1 = i % 2 ? 60 : 66;
      g.fillStyle = 'rgba(255,225,150,0.7)'; g.beginPath();
      g.moveTo(HX + Math.cos(a - 0.08) * r0, HY + Math.sin(a - 0.08) * r0);
      g.lineTo(HX + Math.cos(a) * r1, HY + Math.sin(a) * r1);
      g.lineTo(HX + Math.cos(a + 0.08) * r0, HY + Math.sin(a + 0.08) * r0);
      g.closePath(); g.fill();
    }
    g.lineCap = 'round';
    [[0.15, 1.45], [1.75, 2.9], [3.2, 4.3], [4.6, 5.95]].forEach(([a0, a1]) => {
      g.strokeStyle = OUT; g.lineWidth = 8; g.beginPath(); g.arc(HX, HY, 50, a0, a1); g.stroke();
      g.strokeStyle = '#ffe08a'; g.lineWidth = 4.5; g.beginPath(); g.arc(HX, HY, 50, a0, a1); g.stroke();
    });
    // 뒤쪽 팔 (오른쪽)
    shape(g, () => { g.moveTo(128, 90); g.quadraticCurveTo(154, 74, 170, 86); g.lineTo(168, 104); g.quadraticCurveTo(150, 98, 132, 116); g.closePath(); },
      lin(g, 128, 0, 172, 0, [[0, '#24185a'], [1, '#4a3496']]), 3);
    [[178, 84, -0.6], [182, 96, 0], [177, 107, 0.6]].forEach(([x, y, r]) => claw(g, x, y, r));
    oval(g, 170, 95, 10, 10, rad(g, 170, 95, 11, [[0, '#6e58c0'], [1, '#2a1c66']]), 3);
    // 수정 뿔 왕관 (몸 뒤에서 솟음)
    const horn = (x, y, len, ang, w) => {
      g.save(); g.translate(x, y); g.rotate(ang);
      shape(g, () => { g.moveTo(-w, 0); g.lineTo(-w * 0.45, -len * 0.72); g.lineTo(0, -len); g.lineTo(w * 0.5, -len * 0.68); g.lineTo(w, 0); g.closePath(); },
        lin(g, -w, 0, w, 0, [[0, '#8a9af0'], [0.5, '#3e3ea0'], [1, '#1e1a5a']]), 2.5);
      g.strokeStyle = 'rgba(205,240,255,0.9)'; g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(-w * 0.6, -3); g.lineTo(-w * 0.32, -len * 0.7); g.lineTo(-0.5, -len + 3); g.stroke();
      g.restore();
    };
    [[57, 45, 20, -0.8, 7], [70, 37, 26, -0.4, 8], [88, 36, 30, 0, 9], [107, 39, 26, 0.38, 8], [123, 49, 19, 0.75, 7]].forEach(([x, y, l, a, w]) => horn(x, y, l, a, w));
    // 몸 (두건을 쓴 유령 같은 공허)
    const body = () => {
      g.moveTo(84, 30);
      g.quadraticCurveTo(136, 30, 140, 84);
      g.quadraticCurveTo(150, 136, 178, 166);
      g.quadraticCurveTo(164, 170, 156, 162);
      g.quadraticCurveTo(152, 178, 140, 184);
      g.quadraticCurveTo(132, 172, 122, 170);
      g.quadraticCurveTo(116, 184, 104, 186);
      g.quadraticCurveTo(96, 174, 86, 174);
      g.quadraticCurveTo(76, 186, 62, 184);
      g.quadraticCurveTo(58, 172, 48, 170);
      g.quadraticCurveTo(38, 180, 24, 176);
      g.quadraticCurveTo(36, 160, 36, 132);
      g.quadraticCurveTo(32, 96, 40, 66);
      g.quadraticCurveTo(50, 30, 84, 30);
      g.closePath();
    };
    shape(g, body, lin(g, 0, 30, 0, 186, [[0, '#523ca6'], [0.5, '#2a1c66'], [1, '#140c34']]), 4);
    g.save(); g.beginPath(); body(); g.clip();
    glowAt(g, 134, 142, 48, 'rgba(255,110,190,0.38)');
    glowAt(g, 64, 152, 42, 'rgba(80,220,230,0.32)');
    glowAt(g, 124, 66, 38, 'rgba(170,130,255,0.42)');
    let sd = 7;
    const rn = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 64; i++) {
      const x = 26 + rn() * 152, y = 34 + rn() * 150, a = 0.35 + rn() * 0.6;
      g.fillStyle = `rgba(255,250,235,${a.toFixed(2)})`; g.beginPath(); g.arc(x, y, 0.6 + rn() * 1.1, 0, TAU); g.fill();
    }
    [[156, 152, 4], [52, 120, 3.5], [116, 176, 3], [136, 46, 3], [80, 160, 2.6]].forEach(([x, y, z]) => twinkle(g, x, y, z * 1.6, 'rgba(255,255,255,0.9)'));
    g.restore();
    shape(g, body, null, 4);
    shine(g, 70, 38, 12, 4, 0.25, -0.3);
    // 두건 속에서 내다보는 하얀 얼굴
    oval(g, 80, 79, 39, 34, 'rgba(8,4,26,0.55)', 0);
    oval(g, 80, 80, 33, 28, rad(g, 80, 80, 34, [[0, '#ffffff'], [0.6, '#efe8ff'], [1, '#c4b2f0']]), 3);
    shine(g, 66, 62, 9, 3.5, 0.6, -0.4);
    // 이마의 셋째 눈
    oval(g, 80, 60, 5.2, 6, lin(g, 0, 54, 0, 66, [[0, '#ffffff'], [1, '#e2d6ff']]), 1.8);
    eye(g, 79.6, 60.3, '#ff9a20', 0.72);
    eye(g, 67, 81, '#ffb020', 1.65); eye(g, 92, 81, '#ffb020', 1.65);
    g.strokeStyle = OUT; g.lineWidth = 4.5;
    g.beginPath(); g.moveTo(54, 66); g.lineTo(72, 71); g.moveTo(106, 66); g.lineTo(88, 71); g.stroke();
    blush(g, 56, 94, 1.3); blush(g, 103, 94, 1.3);
    g.save(); g.translate(80, 98); g.scale(1.7, 1.7); smile(g, 0, 0, 4.5); g.restore();
    crumb(g, 92, 100, 3.6);                       // 입가에 묻은 별 부스러기
    // 몸 곳곳의 눈
    [[130, 108, 0.82], [152, 146, 0.68], [56, 142, 0.74], [100, 162, 0.6], [127, 68, 0.62]].forEach(([x, y, s]) => bodyEye(g, x, y, s));
    // 가슴에 박힌 별조각과 그 둘레의 빛나는 금
    g.strokeStyle = 'rgba(170,230,255,0.85)'; g.lineWidth = 2;
    [[[100, 118], [92, 112], [88, 116]], [[116, 122], [124, 116], [128, 120]], [[104, 146], [100, 154], [104, 158]], [[114, 144], [120, 150]]].forEach(c => {
      g.beginPath(); c.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.stroke();
    });
    shard(g, 108, 132, 1.35);
    // 앞으로 내민 팔: 금 간 별을 쥐고 있음
    shape(g, () => { g.moveTo(54, 104); g.quadraticCurveTo(38, 100, 26, 108); g.lineTo(32, 122); g.quadraticCurveTo(44, 116, 58, 124); g.closePath(); },
      lin(g, 20, 0, 58, 0, [[0, '#4e389e'], [1, '#2a1c66']]), 3);
    oval(g, 26, 112, 12, 10, rad(g, 26, 112, 13, [[0, '#6e58c0'], [1, '#2a1c66']]), 3);
    glowAt(g, 25, 88, 32, 'rgba(255,225,130,0.75)');
    star(g, 25, 88, 17, rad(g, 25, 88, 18, [[0, '#ffffff'], [0.5, '#fff0a0'], [1, '#f0c040']]));
    g.strokeStyle = OUT; g.lineWidth = 1.8;
    g.beginPath(); g.moveTo(23, 72); g.lineTo(27, 82); g.lineTo(22, 89); g.lineTo(29, 97); g.stroke();
    shine(g, 20, 84, 3, 1.6, 0.8, -0.5);
    // 별을 움켜쥔 발톱 (별 양옆을 감쌈)
    [[13, 101, -Math.PI / 2 + 0.25], [24, 104, -Math.PI / 2], [36, 101, -Math.PI / 2 - 0.3]].forEach(([x, y, r]) => claw(g, x, y, r));
    // 떠도는 별 부스러기
    [[162, 40, 5], [178, 62, 3.4], [146, 20, 3], [18, 160, 4], [40, 50, 3.2], [182, 132, 3.4], [10, 70, 2.6]].forEach(([x, y, s]) => crumb(g, x, y, s));
    [[170, 20, 4], [28, 140, 3], [186, 112, 3]].forEach(([x, y, s]) => twinkle(g, x, y, s * 1.6));
  });
})();

