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
  const treeLights = [];
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
      treeLights.push([x + Math.cos(a) * 150 * d, cy + Math.sin(a) * 74 * d, rnd() * TAU]);
    }
    treeLights.forEach(([lx, ly]) => { glow(g, lx, ly, 12, 'rgba(255,250,210,0.8)'); blob(g, lx, ly, 2.6, '#fffbe0'); });
  }

  // ── 땅 (캐릭터와 같은 속도) ──
  const shards = [];
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
      [[150, GY + 58], [610, GY + 88], [860, GY + 40]].forEach(([x, y]) => {
        shards.push([x, y]);
        glow(g, x, y - 6, 30, 'rgba(190,235,255,0.55)');
        g.fillStyle = '#d6f3ff';
        g.beginPath(); g.moveTo(x - 7, y); g.lineTo(x - 3, y - 18); g.lineTo(x + 2, y - 24); g.lineTo(x + 7, y - 8); g.lineTo(x + 6, y); g.closePath(); g.fill();
        g.fillStyle = '#ffffff';
        g.beginPath(); g.moveTo(x - 2, y - 2); g.lineTo(x - 1, y - 16); g.lineTo(x + 2, y - 20); g.lineTo(x + 1, y - 2); g.closePath(); g.fill();
        g.fillStyle = 'rgba(60,110,50,0.5)'; g.beginPath(); g.ellipse(x, y + 1, 10, 3, 0, 0, TAU); g.fill();
      });
    });
  }

  // ── 준비 ──
  let L = null;
  const clouds = [];
  const petals = [];

  function build() {
    L = { sky: drawSky(), far: drawFar(), mid: drawMid(), near: drawNear(), ground: drawGround() };
    seed = 99;
    const shapes = [drawCloud(260, 100, 'rgba(170,185,225,0.55)'), drawCloud(180, 80, 'rgba(170,185,225,0.5)'), drawCloud(320, 120, 'rgba(160,178,220,0.55)')];
    [[40, 40, 0, 0.7, 6], [380, 20, 1, 0.55, 4], [620, 150, 2, 0.8, 9], [860, 70, 1, 0.6, 5], [230, 170, 1, 0.75, 8]].forEach(([x, y, s, a, v]) => clouds.push({ x, y, img: shapes[s], a, v }));
    for (let i = 0; i < 28; i++) petals.push(newPetal(true));
  }

  function newPetal(anywhere) {
    return {
      x: anywhere ? rr(0, W) : rr(W * 0.3, W + 60), y: anywhere ? rr(0, H) : rr(-40, H * 0.4),
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

  // 캐릭터 뒤쪽
  function drawBack(ctx, camX, t) {
    ctx.drawImage(L.sky, 0, 0);
    clouds.forEach(c => {
      const span = W + c.img.width;
      const x = ((c.x - t * c.v - camX * 0.04) % span + span) % span - c.img.width;
      ctx.globalAlpha = c.a;
      ctx.drawImage(c.img, x, c.y);
    });
    ctx.globalAlpha = 1;
    tile(ctx, L.far, camX, 0.08);
    const om = tile(ctx, L.mid, camX, 0.22);
    // 폭포 물줄기 흐름
    at(om, FALL_X, x => {
      if (x < -40 || x > W + 40) return;
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      for (let i = 0; i < 6; i++) {
        const y = 200 + ((t * 120 + i * 26) % 140);
        ctx.fillRect(x - 10 + (i * 7) % 20, y, 2, 14);
      }
    });
    const on = tile(ctx, L.near, camX, 0.45);
    // 별빛 열매 반짝임
    at(on, 0, ox => {
      treeLights.forEach(([lx, ly, ph]) => {
        const x = lx + ox;
        if (x < -20 || x > W + 20) return;
        const a = 0.35 + 0.35 * Math.sin(t * 2.2 + ph);
        ctx.fillStyle = `rgba(255,252,220,${a})`;
        ctx.beginPath(); ctx.arc(x, ly, 5, 0, TAU); ctx.fill();
      });
    });
    const og = tile(ctx, L.ground, camX, 1);
    // 별조각 반짝임
    at(og, 0, ox => {
      shards.forEach(([sx, sy], i) => {
        const x = sx + ox;
        if (x < -20 || x > W + 20) return;
        const a = Math.max(0, Math.sin(t * 1.6 + i * 2.1));
        ctx.fillStyle = `rgba(255,255,255,${a})`;
        ctx.fillRect(x - 1, sy - 30, 2, 9); ctx.fillRect(x - 4, sy - 26, 9, 2);
      });
    });
  }

  // 캐릭터 앞쪽: 꽃잎, 햇살, 앞 풀
  function drawFront(ctx, camX, t, dt) {
    // 햇살 줄기
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 3; i++) {
      const a = 0.05 + 0.03 * Math.sin(t * 0.7 + i * 1.7);
      const gr = ctx.createLinearGradient(820, 0, 520, H);
      gr.addColorStop(0, `rgba(255,240,200,${a})`);
      gr.addColorStop(1, 'rgba(255,240,200,0)');
      ctx.fillStyle = gr;
      ctx.beginPath();
      const x0 = 760 + i * 70;
      ctx.moveTo(x0, 0); ctx.lineTo(x0 + 40, 0); ctx.lineTo(x0 - 360 + i * 30, H); ctx.lineTo(x0 - 440 + i * 30, H);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    // 꽃잎
    petals.forEach((p, i) => {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      p.sway += dt * 2;
      const x = p.x + Math.sin(p.sway) * 10;
      if (p.y > H + 10 || x < -20) petals[i] = newPetal(false);
      ctx.save();
      ctx.translate(x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.c;
      ctx.beginPath(); ctx.ellipse(0, 0, p.r, p.r * 0.55, 0, 0, TAU); ctx.fill();
      ctx.restore();
    });
    // 화면 앞 풀 (살랑살랑)
    const off = -(((camX * 1.25) % W) + W) % W;
    seed = 61;
    for (let i = 0; i < 26; i++) {
      const bx = (rr(0, W) + off + W) % W, h = rr(26, 54), lean = Math.sin(t * 1.8 + i) * 6;
      if (bx > 300 && bx < 860 && i % 3) continue;      // 가운데는 덜 가리게
      ctx.fillStyle = i % 2 ? 'rgba(70,150,60,0.9)' : 'rgba(95,175,75,0.9)';
      ctx.beginPath();
      ctx.moveTo(bx - 4, H); ctx.quadraticCurveTo(bx + lean * 0.4, H - h * 0.6, bx + lean, H - h); ctx.quadraticCurveTo(bx + 2 + lean * 0.4, H - h * 0.5, bx + 5, H);
      ctx.closePath(); ctx.fill();
    }
  }

  return { build, drawBack, drawFront, GY };
})();
