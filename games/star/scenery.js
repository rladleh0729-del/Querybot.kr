// 별의 설화 — 들꽃 평원 배경 (부드러운 그림체 + 겹겹이 패럴랙스)
// 캐릭터는 도트, 배경은 960×540 화면 크기로 직접 그린다.
// 각 겹은 가로로 이어 붙여도 끊기지 않게(가로 960마다 반복) 만든다.
'use strict';

const Scenery = (() => {
  const W = 960, H = 540, GY = 420;          // GY: 캐릭터가 서는 땅 높이 (GROUND × 3)
  const TAU = Math.PI * 2;
  let seed = 3;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const rr = (a, b) => a + rnd() * (b - a);
  // 가로 960마다 반복되는 물결 (k는 정수라서 끝과 처음이 맞물린다)
  const wave = (x, parts) => parts.reduce((s, [k, a, ph]) => s + a * Math.sin(TAU * k * x / W + ph), 0);

  function canvas(w, h, draw) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    draw(c.getContext('2d'));
    return c;
  }

  // 곡선 아래를 칠한다
  function ridge(g, yAt, fill) {
    g.beginPath();
    g.moveTo(0, H);
    for (let x = 0; x <= W; x += 3) g.lineTo(x, yAt(x));
    g.lineTo(W, H);
    g.closePath();
    g.fillStyle = fill;
    g.fill();
  }

  // 가장자리에 걸친 물체는 반대쪽에도 그려서 이음매를 없앤다
  function wrap(x, margin, fn) {
    fn(x);
    if (x < margin) fn(x + W);
    if (x > W - margin) fn(x - W);
  }

  function vgrad(g, y0, y1, stops) {
    const gr = g.createLinearGradient(0, y0, 0, y1);
    stops.forEach(([o, c]) => gr.addColorStop(o, c));
    return gr;
  }

  function glow(g, x, y, r, color) {
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, color);
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }

  function blob(g, x, y, r, color) {
    g.beginPath();
    g.arc(x, y, r, 0, TAU);
    g.fillStyle = color;
    g.fill();
  }

  // ── 하늘 (움직이지 않음) ──
  function drawSky() {
    return canvas(W, H, g => {
      g.fillStyle = vgrad(g, 0, GY, [[0, '#2a6fd6'], [0.35, '#5aa9f0'], [0.62, '#a8dcf5'], [0.82, '#f2f0d8'], [1, '#ffe2b8']]);
      g.fillRect(0, 0, W, H);
      // 해와 빛무리
      glow(g, 800, 92, 300, 'rgba(255,244,210,0.55)');
      glow(g, 800, 92, 90, 'rgba(255,250,230,0.9)');
      blob(g, 800, 92, 34, '#fffbea');
      // 금이 간 거대한 별 (이 세계의 상징)
      drawCrackedStar(g, 300, 92);
    });
  }

  function drawCrackedStar(g, cx, cy) {
    glow(g, cx, cy, 110, 'rgba(255,236,170,0.45)');
    const pts = [];
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? 15 : 36, a = -Math.PI / 2 + i * Math.PI / 5;
      pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
    g.save();
    g.globalAlpha = 0.85;
    g.beginPath();
    pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y));
    g.closePath();
    const fill = g.createRadialGradient(cx - 8, cy - 8, 2, cx, cy, 40);
    fill.addColorStop(0, '#ffffff');
    fill.addColorStop(0.5, '#fff1b0');
    fill.addColorStop(1, '#f4cf6a');
    g.fillStyle = fill;
    g.fill();
    // 금 (갈라진 선)
    g.strokeStyle = 'rgba(176,120,40,0.75)';
    g.lineWidth = 1.6;
    g.beginPath();
    g.moveTo(cx - 2, cy - 30); g.lineTo(cx + 4, cy - 10); g.lineTo(cx - 3, cy + 2); g.lineTo(cx + 8, cy + 14); g.lineTo(cx + 20, cy + 22);
    g.moveTo(cx + 4, cy - 10); g.lineTo(cx + 16, cy - 6);
    g.moveTo(cx - 3, cy + 2); g.lineTo(cx - 16, cy + 8);
    g.stroke();
    g.restore();
    // 떨어져 나가는 조각들
    [[cx + 40, cy + 30, 6], [cx + 58, cy + 52, 4], [cx + 74, cy + 78, 3], [cx + 30, cy + 58, 3]].forEach(([x, y, s]) => {
      glow(g, x, y, s * 4, 'rgba(255,240,180,0.6)');
      g.fillStyle = '#fff4c0';
      g.beginPath();
      g.moveTo(x, y - s); g.lineTo(x + s * 0.7, y); g.lineTo(x, y + s); g.lineTo(x - s * 0.7, y);
      g.closePath();
      g.fill();
    });
  }

  // ── 구름 (조각 그림, 매 프레임 흘러감) ──
  function drawCloud(w, h, shade) {
    return canvas(w, h, g => {
      const puffs = [];
      const n = Math.round(w / 34);
      for (let i = 0; i < n; i++) {
        const t = i / (n - 1);
        puffs.push([w * 0.12 + t * w * 0.76, h * 0.62 - Math.sin(t * Math.PI) * h * rr(0.18, 0.32), h * rr(0.2, 0.34)]);
      }
      puffs.forEach(([x, y, r]) => blob(g, x, y, r, '#ffffff'));
      g.fillStyle = '#ffffff';
      g.fillRect(w * 0.1, h * 0.6, w * 0.8, h * 0.2);
      // 아래쪽 그늘
      g.globalCompositeOperation = 'source-atop';
      g.fillStyle = vgrad(g, h * 0.35, h * 0.85, [[0, 'rgba(255,255,255,0)'], [1, shade]]);
      g.fillRect(0, 0, w, h);
    });
  }

  // ── 먼 산 (아주 천천히 움직임) ──
  function drawFar() {
    return canvas(W, H, g => {
      ridge(g, x => 238 + wave(x, [[2, 26, 0.4], [5, 12, 1.3], [9, 5, 2.1]]),
        vgrad(g, 190, 360, [[0, '#a7b9ea'], [1, '#cfe0f2']]));
      // 산꼭대기 눈
      g.save();
      g.beginPath();
      g.moveTo(0, H);
      for (let x = 0; x <= W; x += 3) g.lineTo(x, 238 + wave(x, [[2, 26, 0.4], [5, 12, 1.3], [9, 5, 2.1]]));
      g.lineTo(W, H); g.closePath(); g.clip();
      g.fillStyle = 'rgba(255,255,255,0.55)';
      for (let x = 0; x <= W; x += 3) {
        const y = 238 + wave(x, [[2, 26, 0.4], [5, 12, 1.3], [9, 5, 2.1]]);
        if (y < 222) g.fillRect(x, y, 3, (222 - y) * 0.6 + 2);
      }
      g.restore();
      ridge(g, x => 286 + wave(x, [[3, 18, 2.2], [7, 8, 0.2], [13, 3, 1]]),
        vgrad(g, 260, 380, [[0, '#93b6d8'], [1, '#bcd8e8']]));
      // 공기 원근 (아래쪽 안개)
      g.fillStyle = vgrad(g, 270, 380, [[0, 'rgba(240,246,250,0)'], [1, 'rgba(240,246,250,0.75)']]);
      g.fillRect(0, 270, W, 110);
    });
  }

  // ── 폭포 절벽과 숲 (천천히) ──
  const FALL_X = 210;
  function drawMid() {
    return canvas(W, H, g => {
      const fy = x => 330 + wave(x, [[4, 10, 0.7], [11, 4, 2]]);
      ridge(g, fy, vgrad(g, 300, 400, [[0, '#5f9d8c'], [1, '#7db79a']]));
      // 숲 머리 (둥근 나무들)
      seed = 21;
      for (let x = 0; x < W; x += 16) {
        const r = rr(12, 22), y = fy(x) + 4;
        wrap(x, 30, xx => {
          blob(g, xx, y, r, '#5b998a');
          blob(g, xx - r * 0.25, y - r * 0.3, r * 0.7, '#72b29b');
        });
      }
      // 절벽
      g.fillStyle = vgrad(g, 190, 360, [[0, '#9aa0bd'], [1, '#6f7694']]);
      g.beginPath();
      g.moveTo(110, 360); g.lineTo(122, 250); g.quadraticCurveTo(140, 198, 196, 196);
      g.lineTo(236, 198); g.quadraticCurveTo(290, 206, 300, 262); g.lineTo(316, 360);
      g.closePath(); g.fill();
      // 절벽 결
      g.strokeStyle = 'rgba(70,74,100,0.35)'; g.lineWidth = 2;
      [[140, 240, 150, 320], [262, 230, 276, 330], [180, 220, 172, 300]].forEach(([a, b, c, d]) => { g.beginPath(); g.moveTo(a, b); g.lineTo(c, d); g.stroke(); });
      // 절벽 위 풀
      g.fillStyle = '#86c07a';
      g.beginPath(); g.ellipse(208, 198, 60, 9, 0, 0, TAU); g.fill();
      blob(g, 160, 196, 14, '#78b56e'); blob(g, 262, 200, 12, '#78b56e');
      // 폭포
      g.fillStyle = vgrad(g, 196, 345, [[0, 'rgba(225,245,255,0.95)'], [1, 'rgba(190,230,255,0.85)']]);
      g.fillRect(FALL_X - 13, 198, 26, 146);
      g.fillStyle = 'rgba(255,255,255,0.6)';
      g.fillRect(FALL_X - 9, 198, 4, 146); g.fillRect(FALL_X + 3, 198, 3, 146);
      // 물안개
      glow(g, FALL_X, 345, 46, 'rgba(255,255,255,0.8)');
      // 물웅덩이
      g.fillStyle = 'rgba(170,220,250,0.85)';
      g.beginPath(); g.ellipse(FALL_X, 352, 44, 8, 0, 0, TAU); g.fill();
    });
  }

  // ── 가까운 언덕과 별빛 나무 (보통 속도) ──
  const TREE_X = 700;
  let cur = null;            // 지금 그리는 중인 테마 (빛·별조각 위치를 모은다)
  function drawNear() {
    return canvas(W, H, g => {
      const hy = x => 372 + wave(x, [[2, 14, 1.1], [5, 7, 0.3], [9, 3, 2.4]]);
      ridge(g, hy, vgrad(g, 340, 430, [[0, '#9ad670'], [1, '#6cb84f']]));
      // 언덕 윗선 빛
      g.strokeStyle = 'rgba(214,246,160,0.9)'; g.lineWidth = 3;
      g.beginPath();
      for (let x = 0; x <= W; x += 3) x ? g.lineTo(x, hy(x)) : g.moveTo(x, hy(x));
      g.stroke();
      // 작은 나무와 덤불
      seed = 77;
      [60, 150, 330, 430, 520, 900].forEach(x => {
        const y = hy(x);
        wrap(x, 40, xx => {
          if (rnd() < 0.5) {
            g.fillStyle = '#6b4a2b'; g.fillRect(xx - 3, y - 28, 6, 30);
            blob(g, xx, y - 36, 20, '#4f9a4a'); blob(g, xx - 6, y - 42, 13, '#69b25c'); blob(g, xx + 8, y - 30, 12, '#4a8f45');
          } else {
            blob(g, xx - 10, y + 2, 14, '#5aa24c'); blob(g, xx + 8, y, 16, '#62ad52'); blob(g, xx, y - 8, 12, '#7cc464');
          }
        });
      });
      drawStarTree(g, TREE_X, hy(TREE_X) + 6);
    });
  }

  function drawStarTree(g, x, baseY) {
    // 뿌리와 줄기
    const trunk = g.createLinearGradient(x - 30, 0, x + 30, 0);
    trunk.addColorStop(0, '#5a3820'); trunk.addColorStop(0.45, '#8a5a34'); trunk.addColorStop(1, '#4a2e18');
    g.fillStyle = trunk;
    g.beginPath();
    g.moveTo(x - 46, baseY);
    g.quadraticCurveTo(x - 22, baseY - 18, x - 20, baseY - 70);
    g.quadraticCurveTo(x - 16, baseY - 150, x - 30, baseY - 196);
    g.lineTo(x + 26, baseY - 200);
    g.quadraticCurveTo(x + 14, baseY - 150, x + 20, baseY - 70);
    g.quadraticCurveTo(x + 22, baseY - 18, x + 50, baseY);
    g.closePath();
    g.fill();
    // 가지
    g.strokeStyle = '#6b4428'; g.lineCap = 'round';
    [[x - 20, baseY - 150, x - 92, baseY - 206, 9], [x + 16, baseY - 160, x + 96, baseY - 214, 8], [x - 4, baseY - 190, x - 30, baseY - 250, 7]].forEach(([a, b, c, d, w]) => {
      g.lineWidth = w; g.beginPath(); g.moveTo(a, b); g.quadraticCurveTo((a + c) / 2, b - 10, c, d); g.stroke();
    });
    // 나무껍질 결
    g.strokeStyle = 'rgba(40,24,10,0.35)'; g.lineWidth = 2;
    for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(x - 10 + i * 5, baseY - 20); g.quadraticCurveTo(x - 14 + i * 6, baseY - 100, x - 8 + i * 5, baseY - 170); g.stroke(); }
    // 잎 (분홍과 금빛, 아래 그늘 → 위 빛 순서로)
    const cy = baseY - 236;
    seed = 5;
    const leaves = [];
    for (let i = 0; i < 70; i++) {
      const a = rnd() * TAU, d = Math.sqrt(rnd());
      leaves.push([x + Math.cos(a) * 160 * d, cy + Math.sin(a) * 82 * d, rr(22, 40)]);
    }
    leaves.sort((p, q) => p[1] - q[1]);
    leaves.forEach(([lx, ly, r]) => blob(g, lx, ly + 10, r, '#d9718f'));
    leaves.forEach(([lx, ly, r]) => blob(g, lx, ly, r * 0.92, rnd() < 0.3 ? '#ffc56e' : '#ff9fba'));
    leaves.forEach(([lx, ly, r]) => blob(g, lx - r * 0.25, ly - r * 0.3, r * 0.5, rnd() < 0.3 ? '#ffe3a0' : '#ffd0de'));
    // 별빛 열매 (반짝이는 위치는 매 프레임 그림)
    for (let i = 0; i < 16; i++) {
      const a = rnd() * TAU, d = Math.sqrt(rnd()) * 0.85;
      cur.lights.push({ x: x + Math.cos(a) * 150 * d, y: cy + Math.sin(a) * 74 * d, ph: rnd() * TAU, layer: 'near', rgb: '255,252,220', r: 5 });
    }
    cur.lights.forEach(l => { glow(g, l.x, l.y, 12, 'rgba(255,250,210,0.8)'); blob(g, l.x, l.y, 2.6, '#fffbe0'); });
  }

  // ── 땅 (캐릭터와 같은 속도) ──
  function drawGround() {
    return canvas(W, H, g => {
      const gy = x => GY - 4 + wave(x, [[6, 2, 0.5], [17, 1.2, 1.7]]);
      ridge(g, gy, vgrad(g, GY - 8, H, [[0, '#86d35e'], [0.12, '#6bbf4f'], [0.55, '#55a845'], [1, '#3f8a39']]));
      // 풀잎 가장자리
      seed = 41;
      for (let x = 0; x < W; x += 5) {
        const y = gy(x), h = rr(5, 12);
        g.fillStyle = rnd() < 0.5 ? '#a4e276' : '#79c95a';
        g.beginPath(); g.moveTo(x - 2, y + 2); g.lineTo(x + rr(-2, 2), y - h); g.lineTo(x + 3, y + 2); g.closePath(); g.fill();
      }
      // 땅 위 결과 풀 덩어리
      for (let i = 0; i < 140; i++) {
        const x = rr(0, W), y = rr(GY + 14, H - 4);
        g.fillStyle = rnd() < 0.5 ? 'rgba(130,210,100,0.6)' : 'rgba(50,120,50,0.45)';
        g.fillRect(x, y, 2, rr(4, 9));
      }
      // 작은 돌
      for (let i = 0; i < 10; i++) {
        const x = rr(0, W), y = rr(GY + 30, H - 10);
        g.fillStyle = '#8a9a8a'; g.beginPath(); g.ellipse(x, y, rr(5, 9), rr(3, 5), 0, 0, TAU); g.fill();
        g.fillStyle = '#b8c6b4'; g.beginPath(); g.ellipse(x - 2, y - 2, 3, 2, 0, 0, TAU); g.fill();
      }
      // 들꽃
      const cols = ['#ffffff', '#ffe066', '#ff9ac0', '#c4b0ff', '#ffb36b'];
      for (let i = 0; i < 70; i++) {
        const x = rr(0, W), y = rr(GY + 12, H - 6), c = cols[Math.floor(rnd() * cols.length)], s = rr(2.2, 4);
        g.strokeStyle = '#3f8a39'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 8); g.stroke();
        for (let k = 0; k < 5; k++) { const a = k * TAU / 5; blob(g, x + Math.cos(a) * s, y + Math.sin(a) * s, s * 0.8, c); }
        blob(g, x, y, s * 0.6, '#ffb030');
      }
      // 땅에 박힌 별조각 (반짝임은 매 프레임)
      [[150, GY + 58], [610, GY + 88], [860, GY + 40]].forEach(([x, y]) => drawShard(g, x, y));
    });
  }

  // 땅에 박힌 별조각 (반짝임은 매 프레임)
  function drawShard(g, x, y) {
    cur.shards.push([x, y]);
    glow(g, x, y - 6, 30, 'rgba(190,235,255,0.55)');
    g.fillStyle = '#d6f3ff';
    g.beginPath(); g.moveTo(x - 7, y); g.lineTo(x - 3, y - 18); g.lineTo(x + 2, y - 24); g.lineTo(x + 7, y - 8); g.lineTo(x + 6, y); g.closePath(); g.fill();
    g.fillStyle = '#ffffff';
    g.beginPath(); g.moveTo(x - 2, y - 2); g.lineTo(x - 1, y - 16); g.lineTo(x + 2, y - 20); g.lineTo(x + 1, y - 2); g.closePath(); g.fill();
    g.fillStyle = 'rgba(40,80,40,0.5)'; g.beginPath(); g.ellipse(x, y + 1, 10, 3, 0, 0, TAU); g.fill();
  }

  // ════════ 챕터 2: 속삭이는 숲 ════════
  function fSky() {
    return canvas(W, H, g => {
      g.fillStyle = vgrad(g, 0, GY, [[0, '#123430'], [0.4, '#2a5e4c'], [0.75, '#6fa888'], [1, '#c4e2c0']]);
      g.fillRect(0, 0, W, H);
      glow(g, 520, 70, 200, 'rgba(230,255,220,0.35)');
      g.save(); g.translate(520, 70); g.scale(0.7, 0.7); drawCrackedStar(g, 0, 0); g.restore();
    });
  }

  function fFar() {
    return canvas(W, H, g => {
      seed = 13;
      for (let x = 0; x < W; x += 34) {
        const w = rr(10, 18), xx = x + rr(-8, 8);
        wrap(xx, 30, X => { g.fillStyle = 'rgba(70,120,100,0.55)'; g.fillRect(X - w / 2, 40, w, 340); });
      }
      ridge(g, x => 300 + wave(x, [[3, 10, 0.3], [8, 5, 1.1]]), vgrad(g, 280, 380, [[0, '#4f8a74'], [1, '#7fb498']]));
      g.fillStyle = vgrad(g, 180, 380, [[0, 'rgba(200,235,210,0)'], [1, 'rgba(200,235,210,0.7)']]);
      g.fillRect(0, 180, W, 200);
    });
  }

  function fMid() {
    return canvas(W, H, g => {
      seed = 17;
      for (let x = 20; x < W; x += 95) {
        const w = rr(22, 34), xx = x + rr(-15, 15);
        wrap(xx, 40, X => {
          g.fillStyle = vgrad(g, 0, 360, [[0, '#24483e'], [1, '#3a6a56']]);
          g.fillRect(X - w / 2, 0, w, 360);
          g.fillStyle = 'rgba(140,200,140,0.22)';
          g.fillRect(X - w / 2 + 3, 0, 4, 360);
        });
      }
      // 위를 덮은 잎 천장 (가운데 틈으로 하늘이 보임)
      for (let x = 0; x < W; x += 24) {
        if (x > 440 && x < 600) continue;
        const r = rr(40, 70), y = rr(-14, 46);
        wrap(x, 80, X => { blob(g, X, y, r, '#1b3d32'); blob(g, X - 10, y + 16, r * 0.6, '#2a5a46'); });
      }
      ridge(g, x => 342 + wave(x, [[4, 8, 0.9], [11, 3, 0.2]]), vgrad(g, 320, 400, [[0, '#3f7254'], [1, '#56906a']]));
      g.fillStyle = vgrad(g, 280, 370, [[0, 'rgba(210,240,220,0)'], [0.6, 'rgba(210,240,220,0.35)'], [1, 'rgba(210,240,220,0)']]);
      g.fillRect(0, 280, W, 90);
    });
  }

  function fern(g, x, y, h) {
    g.strokeStyle = '#3f8a44'; g.lineWidth = 2.5; g.lineCap = 'round';
    for (let k = -3; k <= 3; k++) {
      g.beginPath(); g.moveTo(x, y);
      g.quadraticCurveTo(x + k * h * 0.3, y - h * 0.9, x + k * h * 0.55, y - h * 0.45 + Math.abs(k) * 5);
      g.stroke();
    }
  }

  function drawAncientTree(g, x, baseY) {
    const tr = g.createLinearGradient(x - 90, 0, x + 90, 0);
    tr.addColorStop(0, '#3a2616'); tr.addColorStop(0.5, '#6b4a2e'); tr.addColorStop(1, '#2e1e10');
    g.fillStyle = tr;
    g.beginPath();
    g.moveTo(x - 125, baseY); g.quadraticCurveTo(x - 72, baseY - 30, x - 72, baseY - 120); g.lineTo(x - 84, 0);
    g.lineTo(x + 84, 0); g.lineTo(x + 72, baseY - 120); g.quadraticCurveTo(x + 72, baseY - 30, x + 128, baseY);
    g.closePath(); g.fill();
    g.strokeStyle = 'rgba(20,12,6,0.35)'; g.lineWidth = 3;
    for (let i = 0; i < 7; i++) { g.beginPath(); g.moveTo(x - 55 + i * 18, 0); g.quadraticCurveTo(x - 60 + i * 19, baseY * 0.5, x - 50 + i * 17, baseY - 20); g.stroke(); }
    [[x - 60, baseY - 60, 26], [x + 42, baseY - 210, 22], [x - 34, baseY - 300, 18], [x + 56, baseY - 44, 20]].forEach(([mx, my, r]) => {
      blob(g, mx, my, r, '#4f9a4a'); blob(g, mx - 4, my - 4, r * 0.6, '#6fbf5a');
    });
    // 별조각이 잠든 빛나는 구멍
    glow(g, x, baseY - 150, 100, 'rgba(160,240,255,0.45)');
    g.fillStyle = '#1a120a'; g.beginPath(); g.ellipse(x, baseY - 150, 30, 44, 0, 0, TAU); g.fill();
    g.fillStyle = 'rgba(140,230,255,0.9)'; g.beginPath(); g.ellipse(x, baseY - 142, 22, 34, 0, 0, TAU); g.fill();
    g.fillStyle = '#e8fbff';
    g.beginPath(); g.moveTo(x - 6, baseY - 128); g.lineTo(x - 2, baseY - 160); g.lineTo(x + 4, baseY - 168); g.lineTo(x + 8, baseY - 140); g.lineTo(x + 5, baseY - 126); g.closePath(); g.fill();
    cur.lights.push({ x, y: baseY - 146, ph: 0, layer: 'near', rgb: '160,240,255', r: 28 });
    g.strokeStyle = '#4a3220'; g.lineCap = 'round';
    [[-115, 22, 14], [-62, 30, 11], [72, 28, 12], [122, 20, 14]].forEach(([dx, dy, w]) => {
      g.lineWidth = w; g.beginPath(); g.moveTo(x + dx * 0.5, baseY - 10); g.quadraticCurveTo(x + dx * 0.85, baseY - 4, x + dx, baseY + dy); g.stroke();
    });
  }

  function fNear() {
    return canvas(W, H, g => {
      const hy = x => 378 + wave(x, [[2, 10, 0.6], [6, 5, 1.9]]);
      ridge(g, hy, vgrad(g, 350, 430, [[0, '#4f8a50'], [1, '#3a7442']]));
      g.strokeStyle = 'rgba(150,210,130,0.6)'; g.lineWidth = 2;
      g.beginPath(); for (let x = 0; x <= W; x += 3) x ? g.lineTo(x, hy(x)) : g.moveTo(x, hy(x)); g.stroke();
      seed = 31;
      [140, 330].forEach(x => {
        const y = hy(x);
        g.fillStyle = vgrad(g, 0, y, [[0, '#2e2216'], [1, '#5a4028']]);
        g.fillRect(x - 15, 0, 30, y + 4);
        blob(g, x - 15, y, 10, '#4a3420'); blob(g, x + 15, y, 10, '#4a3420');
        blob(g, x - 8, y - 90, 10, '#5aa04a'); blob(g, x + 6, y - 170, 8, '#5aa04a');
      });
      drawAncientTree(g, 700, hy(700) + 6);
      for (let i = 0; i < 16; i++) {
        const x = rr(0, W), len = rr(60, 190);
        g.strokeStyle = 'rgba(80,150,80,0.85)'; g.lineWidth = 2;
        g.beginPath(); g.moveTo(x, 0); g.quadraticCurveTo(x + rr(-12, 12), len / 2, x + rr(-6, 6), len); g.stroke();
        blob(g, x, len, 4, '#6fbf5a');
      }
      [60, 250, 420, 560, 900].forEach(x => fern(g, x, hy(x) + 4, rr(30, 44)));
    });
  }

  function glowMush(g, x, y) {
    glow(g, x, y - 6, 24, 'rgba(120,230,255,0.45)');
    g.fillStyle = '#e8f0e0'; g.fillRect(x - 1.5, y - 6, 3, 7);
    g.fillStyle = '#6fe0ff'; g.beginPath(); g.ellipse(x, y - 6, 7, 5, 0, Math.PI, TAU); g.fill();
    g.fillStyle = '#d0f8ff'; g.fillRect(x - 3, y - 9, 2, 1);
  }

  function fGround() {
    return canvas(W, H, g => {
      const gy = x => GY - 4 + wave(x, [[5, 2, 0.4], [13, 1.5, 1.2]]);
      ridge(g, gy, vgrad(g, GY - 8, H, [[0, '#5a9a4a'], [0.15, '#447f3e'], [0.6, '#356a34'], [1, '#26522a']]));
      seed = 55;
      for (let x = 0; x < W; x += 6) blob(g, x, gy(x) + 2, rr(3, 6), rnd() < 0.5 ? '#6fae58' : '#5a9a4a');
      g.strokeStyle = 'rgba(70,48,30,0.9)'; g.lineCap = 'round';
      for (let i = 0; i < 5; i++) {
        const x = rr(0, W), y = rr(GY + 24, H - 30);
        g.lineWidth = rr(5, 9); g.beginPath(); g.moveTo(x - 80, y + 10); g.quadraticCurveTo(x, y - 14, x + 90, y + 6); g.stroke();
      }
      for (let i = 0; i < 90; i++) {
        const x = rr(0, W), y = rr(GY + 12, H - 4);
        g.fillStyle = rnd() < 0.5 ? 'rgba(120,170,80,0.7)' : 'rgba(170,140,70,0.6)';
        g.beginPath(); g.ellipse(x, y, rr(2, 4), rr(1, 2), rr(0, 3), 0, TAU); g.fill();
      }
      for (let i = 0; i < 9; i++) {
        const x = rr(0, W), y = rr(GY + 24, H - 16);
        glowMush(g, x, y);
        cur.lights.push({ x, y: y - 7, ph: rr(0, TAU), layer: 'ground', rgb: '150,240,255', r: 8 });
      }
      [[200, GY + 64], [520, GY + 36], [820, GY + 90]].forEach(([x, y]) => drawShard(g, x, y));
    });
  }

  // ════════ 챕터 3: 붉은 사막 ════════
  function dSky() {
    return canvas(W, H, g => {
      g.fillStyle = vgrad(g, 0, GY, [[0, '#3a5aa8'], [0.45, '#d8806a'], [0.72, '#ffc078'], [1, '#ffe6b0']]);
      g.fillRect(0, 0, W, H);
      glow(g, 720, 250, 260, 'rgba(255,220,150,0.55)');
      glow(g, 720, 250, 100, 'rgba(255,240,200,0.9)');
      blob(g, 720, 250, 58, '#fff1c8');
      g.save(); g.translate(250, 80); g.scale(0.75, 0.75); drawCrackedStar(g, 0, 0); g.restore();
    });
  }

  function mesa(g, x, top, w, base, col, hi) {
    wrap(x, w, X => {
      g.fillStyle = col;
      g.beginPath();
      g.moveTo(X - w / 2 - 30, base); g.lineTo(X - w / 2, top + 8); g.quadraticCurveTo(X - w / 2 + 4, top, X - w / 2 + 14, top);
      g.lineTo(X + w / 2 - 14, top); g.quadraticCurveTo(X + w / 2 - 4, top, X + w / 2, top + 8); g.lineTo(X + w / 2 + 30, base);
      g.closePath(); g.fill();
      g.fillStyle = hi; g.fillRect(X - w / 2 + 6, top + 2, w - 12, 5);
      g.strokeStyle = 'rgba(80,30,40,0.25)'; g.lineWidth = 3;
      for (let k = 1; k < 4; k++) { g.beginPath(); g.moveTo(X - w / 2 + k * w / 4, top + 10); g.lineTo(X - w / 2 + k * w / 4 + 6, base); g.stroke(); }
    });
  }

  function dFar() {
    return canvas(W, H, g => {
      mesa(g, 120, 200, 160, 330, '#b0607a', 'rgba(255,190,170,0.5)');
      mesa(g, 470, 230, 120, 330, '#b8687e', 'rgba(255,190,170,0.5)');
      mesa(g, 820, 185, 190, 330, '#a85874', 'rgba(255,190,170,0.5)');
      ridge(g, x => 300 + wave(x, [[3, 10, 0.5], [7, 4, 1.4]]), vgrad(g, 280, 380, [[0, '#d0907a'], [1, '#e8b08a']]));
      g.fillStyle = vgrad(g, 220, 380, [[0, 'rgba(255,230,190,0)'], [1, 'rgba(255,230,190,0.6)']]);
      g.fillRect(0, 220, W, 160);
    });
  }

  function dMid() {
    return canvas(W, H, g => {
      const dy = x => 336 + wave(x, [[2, 16, 1.2], [5, 7, 0.4]]);
      ridge(g, dy, vgrad(g, 300, 400, [[0, '#eaa868'], [1, '#d08850']]));
      g.strokeStyle = 'rgba(255,220,170,0.7)'; g.lineWidth = 3;
      g.beginPath(); for (let x = 0; x <= W; x += 3) x ? g.lineTo(x, dy(x)) : g.moveTo(x, dy(x)); g.stroke();
      // 무너진 기둥들
      seed = 71;
      [180, 260, 610, 700].forEach((x, i) => {
        const h = [110, 70, 90, 50][i], y = dy(x) + 6;
        g.fillStyle = vgrad(g, y - h, y, [[0, '#e8c8a0'], [1, '#b8906a']]);
        g.fillRect(x - 13, y - h, 26, h);
        g.fillStyle = 'rgba(120,80,50,0.35)'; g.fillRect(x + 5, y - h, 8, h);
        g.fillStyle = '#f0d8b0'; g.fillRect(x - 17, y - h - 8, 34, 9);
        if (i % 2) { g.fillStyle = '#c8a07a'; g.beginPath(); g.ellipse(x + 30, y - 4, 16, 7, 0.2, 0, TAU); g.fill(); }
      });
      g.fillStyle = vgrad(g, 300, 380, [[0, 'rgba(255,230,190,0)'], [0.5, 'rgba(255,230,190,0.3)'], [1, 'rgba(255,230,190,0)']]);
      g.fillRect(0, 300, W, 80);
    });
  }

  function cactusSil(g, x, y, h, col) {
    g.fillStyle = col;
    g.beginPath(); g.roundRect(x - 7, y - h, 14, h, 7); g.fill();
    g.beginPath(); g.roundRect(x - 22, y - h * 0.7, 10, h * 0.35, 5); g.fill();
    g.fillRect(x - 17, y - h * 0.4, 12, 8);
    g.beginPath(); g.roundRect(x + 12, y - h * 0.8, 10, h * 0.4, 5); g.fill();
    g.fillRect(x + 5, y - h * 0.48, 12, 8);
  }

  function drawStatue(g, x, baseY) {
    // 모래에 반쯤 묻힌 거대한 석상 머리
    const st = g.createLinearGradient(x - 120, 0, x + 120, 0);
    st.addColorStop(0, '#a87a52'); st.addColorStop(0.5, '#e8c498'); st.addColorStop(1, '#9a6a44');
    g.fillStyle = st;
    g.beginPath(); g.ellipse(x, baseY - 40, 120, 150, 0, Math.PI, TAU); g.fill();
    g.strokeStyle = 'rgba(90,50,30,0.5)'; g.lineWidth = 4;
    g.beginPath(); g.ellipse(x - 40, baseY - 90, 22, 10, 0, 0, Math.PI); g.stroke();          // 감은 눈
    g.beginPath(); g.ellipse(x + 40, baseY - 90, 22, 10, 0, 0, Math.PI); g.stroke();
    g.beginPath(); g.moveTo(x, baseY - 80); g.lineTo(x - 6, baseY - 40); g.lineTo(x + 8, baseY - 40); g.stroke();
    g.beginPath(); g.moveTo(x + 70, baseY - 170); g.lineTo(x + 50, baseY - 130); g.lineTo(x + 66, baseY - 100); g.stroke();   // 금
    // 이마의 별조각
    glow(g, x, baseY - 150, 70, 'rgba(180,240,255,0.55)');
    g.fillStyle = '#e0f8ff';
    g.beginPath(); g.moveTo(x - 7, baseY - 136); g.lineTo(x - 3, baseY - 160); g.lineTo(x + 3, baseY - 168); g.lineTo(x + 8, baseY - 146); g.lineTo(x + 5, baseY - 134); g.closePath(); g.fill();
    cur.lights.push({ x, y: baseY - 150, ph: 0, layer: 'near', rgb: '180,240,255', r: 24 });
    // 덮인 모래
    g.fillStyle = '#eeb878';
    g.beginPath(); g.ellipse(x, baseY - 6, 150, 30, 0, Math.PI, TAU); g.fill();
  }

  function dNear() {
    return canvas(W, H, g => {
      const hy = x => 376 + wave(x, [[2, 12, 0.3], [4, 6, 2.1]]);
      // 석상은 언덕 뒤에서 솟아 있다
      drawStatue(g, 700, hy(700) + 10);
      ridge(g, hy, vgrad(g, 350, 430, [[0, '#f4c080'], [1, '#e0a060']]));
      g.strokeStyle = 'rgba(255,235,190,0.8)'; g.lineWidth = 3;
      g.beginPath(); for (let x = 0; x <= W; x += 3) x ? g.lineTo(x, hy(x)) : g.moveTo(x, hy(x)); g.stroke();
      // 돌 아치
      const ax = 200, ay = hy(200) + 8;
      g.fillStyle = vgrad(g, ay - 130, ay, [[0, '#e0b888'], [1, '#b08860']]);
      g.fillRect(ax - 60, ay - 120, 26, 120); g.fillRect(ax + 34, ay - 100, 26, 100);
      g.beginPath(); g.moveTo(ax - 64, ay - 120); g.quadraticCurveTo(ax, ay - 160, ax + 40, ay - 104); g.lineTo(ax + 34, ay - 96); g.quadraticCurveTo(ax, ay - 140, ax - 34, ay - 112); g.closePath(); g.fill();
      g.fillStyle = 'rgba(100,60,30,0.3)'; g.fillRect(ax - 42, ay - 120, 8, 120); g.fillRect(ax + 52, ay - 100, 8, 100);
      seed = 83;
      [70, 400, 520, 900].forEach(x => cactusSil(g, x, hy(x) + 4, rr(40, 64), 'rgba(90,140,80,0.9)'));
    });
  }

  function dGround() {
    return canvas(W, H, g => {
      const gy = x => GY - 4 + wave(x, [[4, 2, 0.2], [11, 1.5, 1.6]]);
      ridge(g, gy, vgrad(g, GY - 8, H, [[0, '#ffd8a0'], [0.2, '#f4c084'], [0.7, '#e4a868'], [1, '#d09050']]));
      seed = 95;
      // 모래 물결
      g.strokeStyle = 'rgba(190,120,60,0.35)'; g.lineWidth = 2;
      for (let i = 0; i < 22; i++) {
        const x = rr(0, W), y = rr(GY + 14, H - 8), w = rr(40, 90);
        g.beginPath(); g.moveTo(x - w / 2, y); g.quadraticCurveTo(x, y - 6, x + w / 2, y); g.stroke();
      }
      g.strokeStyle = 'rgba(255,240,210,0.5)';
      for (let i = 0; i < 14; i++) {
        const x = rr(0, W), y = rr(GY + 14, H - 8), w = rr(30, 70);
        g.beginPath(); g.moveTo(x - w / 2, y); g.quadraticCurveTo(x, y - 5, x + w / 2, y); g.stroke();
      }
      // 돌과 마른 풀
      for (let i = 0; i < 10; i++) {
        const x = rr(0, W), y = rr(GY + 24, H - 10);
        g.fillStyle = '#b08868'; g.beginPath(); g.ellipse(x, y, rr(6, 11), rr(4, 6), 0, 0, TAU); g.fill();
        g.fillStyle = '#d8b898'; g.beginPath(); g.ellipse(x - 2, y - 2, 3, 2, 0, 0, TAU); g.fill();
      }
      g.strokeStyle = 'rgba(170,120,50,0.8)'; g.lineWidth = 1.5;
      for (let i = 0; i < 16; i++) {
        const x = rr(0, W), y = rr(GY + 10, H - 6);
        for (let k = -2; k <= 2; k++) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + k * 3, y - rr(6, 12)); g.stroke(); }
      }
      [[160, GY + 70], [480, GY + 40], [790, GY + 86]].forEach(([x, y]) => drawShard(g, x, y));
    });
  }

  // ── 준비 ──
  const BUILD = {
    meadow: () => ({ sky: drawSky(), far: drawFar(), mid: drawMid(), near: drawNear(), ground: drawGround(),
      fall: FALL_X, clouds: true, mote: 'petal', rayX: 760, rayDir: -1, rayRgb: '255,240,200', front: ['rgba(70,150,60,0.9)', 'rgba(95,175,75,0.9)'] }),
    forest: () => ({ sky: fSky(), far: fFar(), mid: fMid(), near: fNear(), ground: fGround(),
      fall: null, clouds: false, mote: 'firefly', rayX: 160, rayDir: 1, rayRgb: '220,255,190', front: ['rgba(40,100,50,0.92)', 'rgba(60,125,60,0.92)'] }),
    desert: () => ({ sky: dSky(), far: dFar(), mid: dMid(), near: dNear(), ground: dGround(),
      fall: null, clouds: false, mote: 'sand', rayX: 760, rayDir: -1, rayRgb: '255,220,160', front: ['rgba(190,140,70,0.85)', 'rgba(215,165,90,0.85)'] }),
  };
  const themes = {};
  let T = null;                 // 지금 보이는 테마
  const clouds = [];
  const motes = [];             // 꽃잎 또는 반딧불이

  function build() {
    seed = 99;
    const shapes = [drawCloud(260, 100, 'rgba(170,185,225,0.55)'), drawCloud(180, 80, 'rgba(170,185,225,0.5)'), drawCloud(320, 120, 'rgba(160,178,220,0.55)')];
    [[40, 40, 0, 0.7, 6], [380, 20, 1, 0.55, 4], [620, 150, 2, 0.8, 9], [860, 70, 1, 0.6, 5], [230, 170, 1, 0.75, 8]].forEach(([x, y, s, a, v]) => clouds.push({ x, y, img: shapes[s], a, v }));
    setTheme('meadow');
  }

  // 테마는 처음 쓸 때 한 번만 그려 둔다. 챕터 4~ 배경(addTheme)은 최근 2개만 들고 있음 (테마마다 큰 캔버스 5장 · 다시 그려도 시드가 같아 같은 그림)
  const extraOrder = [];
  function setTheme(name) {
    if (!BUILD[name]) name = 'meadow';
    if (!themes[name]) {
      cur = { lights: [], shards: [] };
      if (EXTRA[name]) seed = 7 + [...name].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 100000, 0);
      Object.assign(cur, BUILD[name]());
      themes[name] = cur;
      if (EXTRA[name]) { extraOrder.push(name); while (extraOrder.length > 2) delete themes[extraOrder.shift()]; }
    }
    if (T === themes[name]) return;
    T = themes[name];
    motes.length = 0;
    const n = T.moteCount || ({ petal: 28, firefly: 22, sand: 40 }[T.mote]) || 0;
    for (let i = 0; i < n; i++) motes.push(newMote(true));
  }

  // ── 챕터 4~ 배경은 scenery2.js가 addTheme으로 더한다 ──
  // builder(K, cur) → { sky, far, mid, near, ground, fall, clouds, mote, rayX, rayDir, rayRgb, front, moteCount?, moteMake?, moteDraw? }
  // moteMake(anywhere) → 입자 하나, moteDraw(ctx, p, dt) → false를 돌려주면 그 입자를 새로 만든다
  const EXTRA = {};
  function addTheme(name, builder) { EXTRA[name] = true; BUILD[name] = () => builder(K, cur); }
  const K = {
    W, H, GY, TAU, rnd, rr, wave, canvas, ridge, wrap, vgrad, glow, blob, drawCrackedStar, drawCloud,
    drawShard: (g, x, y) => drawShard(g, x, y),
    setSeed: n => { seed = n; },
    light: (x, y, layer, rgb, r, ph) => cur.lights.push({ x, y, ph: ph ?? rnd() * TAU, layer, rgb, r }),
  };

  function newMote(anywhere) {
    if (T.moteMake) return Object.assign(T.moteMake(anywhere), { kind: 'custom' });
    if (T.mote === 'sand') {
      return { kind: 'sand', x: anywhere ? rr(0, W) : W + rr(0, 60), y: rr(200, H), vx: rr(-180, -90), ph: rr(0, TAU), r: rr(1.2, 2.6), a: rr(0.3, 0.7) };
    }
    if (T.mote === 'firefly') {
      return { kind: 'firefly', x: rr(0, W), y: rr(180, H - 40), vx: rr(-10, 10), vy: rr(-8, 8), ph: rr(0, TAU), r: rr(2, 3.2), life: rr(6, 14) };
    }
    return {
      kind: 'petal', x: anywhere ? rr(0, W) : rr(W * 0.3, W + 60), y: anywhere ? rr(0, H) : rr(-40, H * 0.4),
      vx: rr(-38, -16), vy: rr(18, 36), r: rr(2.5, 4.5), rot: rr(0, TAU), vr: rr(-3, 3),
      c: rnd() < 0.7 ? '#ffc4d6' : '#fff4f8', sway: rr(0, TAU),
    };
  }

  // 겹 하나를 카메라에 맞춰 이어 그린다
  function tile(ctx, img, camX, f) {
    const ox = -(((camX * f) % W) + W) % W;
    ctx.drawImage(img, ox, 0);
    ctx.drawImage(img, ox + W, 0);
    return ox;
  }

  // 같은 겹 위에 덧그리는 움직임 (반복 위치 두 군데)
  function at(ox, x, fn) { fn(x + ox); fn(x + ox + W); }

  function twinkle(ctx, ox, layer, t) {
    for (const l of T.lights) {
      if (l.layer !== layer) continue;
      at(ox, l.x, x => {
        if (x < -40 || x > W + 40) return;
        const a = l.r > 10 ? 0.12 + 0.1 * Math.sin(t * 1.4) : 0.35 + 0.35 * Math.sin(t * 2.2 + l.ph);
        ctx.fillStyle = `rgba(${l.rgb},${a})`;
        ctx.beginPath(); ctx.arc(x, l.y, l.r, 0, TAU); ctx.fill();
      });
    }
  }

  // 캐릭터 뒤쪽
  function drawBack(ctx, camX, t) {
    ctx.drawImage(T.sky, 0, 0);
    if (T.clouds) {
      clouds.forEach(c => {
        const span = W + c.img.width;
        const x = ((c.x - t * c.v - camX * 0.04) % span + span) % span - c.img.width;
        ctx.globalAlpha = c.a;
        ctx.drawImage(c.img, x, c.y);
      });
      ctx.globalAlpha = 1;
    }
    tile(ctx, T.far, camX, 0.08);
    const om = tile(ctx, T.mid, camX, 0.22);
    if (T.fall) at(om, T.fall, x => {                    // 폭포 물줄기
      if (x < -40 || x > W + 40) return;
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      for (let i = 0; i < 6; i++) ctx.fillRect(x - 10 + (i * 7) % 20, 200 + ((t * 120 + i * 26) % 140), 2, 14);
    });
    const on = tile(ctx, T.near, camX, 0.45);
    twinkle(ctx, on, 'near', t);
    const og = tile(ctx, T.ground, camX, 1);
    twinkle(ctx, og, 'ground', t);
    for (const [sx, sy] of T.shards) at(og, sx, x => {   // 별조각 반짝임
      if (x < -20 || x > W + 20) return;
      ctx.fillStyle = `rgba(255,255,255,${Math.max(0, Math.sin(t * 1.6 + sx))})`;
      ctx.fillRect(x - 1, sy - 30, 2, 9); ctx.fillRect(x - 4, sy - 26, 9, 2);
    });
  }

  // 캐릭터 앞쪽: 빛줄기, 꽃잎·반딧불이, 앞 풀
  function drawFront(ctx, camX, t, dt) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 3; i++) {
      const a = 0.05 + 0.03 * Math.sin(t * 0.7 + i * 1.7);
      const x0 = T.rayX + i * 70 * -T.rayDir;
      const gr = ctx.createLinearGradient(x0, 0, x0 + T.rayDir * 300, H);
      gr.addColorStop(0, `rgba(${T.rayRgb},${a})`);
      gr.addColorStop(1, `rgba(${T.rayRgb},0)`);
      ctx.fillStyle = gr;
      ctx.beginPath();
      ctx.moveTo(x0, 0); ctx.lineTo(x0 + 40, 0);
      ctx.lineTo(x0 + T.rayDir * (400 - i * 30) + 40, H); ctx.lineTo(x0 + T.rayDir * (400 - i * 30) - 40, H);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    motes.forEach((p, i) => {
      if (p.kind === 'custom') {
        ctx.save();
        if (T.moteDraw(ctx, p, dt) === false) motes[i] = newMote(false);
        ctx.restore();
        return;
      }
      if (p.kind === 'sand') {
        p.x += p.vx * dt; p.ph += dt * 3;
        const y = p.y + Math.sin(p.ph) * 6;
        if (p.x < -10) motes[i] = newMote(false);
        ctx.fillStyle = `rgba(255,230,180,${p.a})`;
        ctx.beginPath(); ctx.ellipse(p.x, y, p.r * 2.2, p.r, 0, 0, TAU); ctx.fill();
        return;
      }
      if (p.kind === 'firefly') {
        p.ph += dt * 1.5; p.life -= dt;
        p.x += (p.vx + Math.sin(p.ph) * 12) * dt; p.y += (p.vy + Math.cos(p.ph * 0.8) * 8) * dt;
        if (p.life <= 0 || p.x < -20 || p.x > W + 20 || p.y < 120 || p.y > H) motes[i] = newMote(true);
        const a = 0.4 + 0.6 * Math.max(0, Math.sin(p.ph * 2));
        ctx.fillStyle = `rgba(220,255,140,${a * 0.35})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 4, 0, TAU); ctx.fill();
        ctx.fillStyle = `rgba(245,255,190,${a})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill();
        return;
      }
      p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt; p.sway += dt * 2;
      const x = p.x + Math.sin(p.sway) * 10;
      if (p.y > H + 10 || x < -20) motes[i] = newMote(false);
      ctx.save();
      ctx.translate(x, p.y); ctx.rotate(p.rot);
      ctx.fillStyle = p.c;
      ctx.beginPath(); ctx.ellipse(0, 0, p.r, p.r * 0.55, 0, 0, TAU); ctx.fill();
      ctx.restore();
    });
    // 화면 앞 풀 (살랑살랑)
    const off = -(((camX * 1.25) % W) + W) % W;
    seed = 61;
    for (let i = 0; i < 26; i++) {
      const bx = (rr(0, W) + off + W) % W, h = rr(26, 54), lean = Math.sin(t * 1.8 + i) * 6;
      if (bx > 300 && bx < 860 && i % 3) continue;
      ctx.fillStyle = T.front[i % 2];
      ctx.beginPath();
      ctx.moveTo(bx - 4, H); ctx.quadraticCurveTo(bx + lean * 0.4, H - h * 0.6, bx + lean, H - h); ctx.quadraticCurveTo(bx + 2 + lean * 0.4, H - h * 0.5, bx + 5, H);
      ctx.closePath(); ctx.fill();
    }
  }

  return { build, setTheme, drawBack, drawFront, GY, addTheme, has: name => !!BUILD[name] };
})();
