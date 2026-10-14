// 별의 설화 — 챕터 4~10 배경 (Scenery.addTheme)
'use strict';
// 챕터 4 서리 설원 — 배경 (오로라 하늘, 눈 덮인 산맥, 얼음 성, 눈 쌓인 전나무, 깊은 눈밭)
Scenery.addTheme('snow', (K, cur) => {
  const { W, H, GY, TAU, rr, rnd, wave, canvas, ridge, wrap, vgrad, glow, blob } = K;

  // 곡선을 따라 선 긋기
  function edge(g, yAt, col, lw) {
    g.strokeStyle = col; g.lineWidth = lw;
    g.beginPath(); for (let x = 0; x <= W; x += 3) x ? g.lineTo(x, yAt(x)) : g.moveTo(x, yAt(x)); g.stroke();
  }
  // 뾰족한 봉우리 (|sin|을 뒤집어 꼭대기가 뾰족, k가 정수라 960마다 반복)
  const peaks = (x, parts) => parts.reduce((s, [k, a, ph]) => s + a * Math.pow(1 - Math.abs(Math.sin(Math.PI * k * x / W + ph)), 1.7), 0);

  // ── 하늘: 연보라빛 겨울 하늘 + 오로라 ──
  // 오로라 띠: 아래 가장자리가 가장 밝고 위로 갈수록 흐려지는 커튼
  function aurora(g, y0, parts, rgb, a, len) {
    for (let x = 0; x < W; x += 3) {
      const y = y0 + wave(x, parts), f = (0.68 + 0.32 * Math.sin(TAU * 2 * x / W + y0)) * rr(0.72, 1);
      const gr = g.createLinearGradient(0, y - len, 0, y + 10);
      gr.addColorStop(0, `rgba(${rgb},0)`);
      gr.addColorStop(0.55, `rgba(${rgb},${a * f * 0.45})`);
      gr.addColorStop(0.8, `rgba(${rgb},${a * f})`);
      gr.addColorStop(0.86, `rgba(255,255,255,${a * f * 0.5})`);
      gr.addColorStop(1, `rgba(${rgb},0)`);
      g.fillStyle = gr;
      g.fillRect(x, y - len, 3, len + 10);
    }
  }
  function sky() {
    return canvas(W, H, g => {
      K.setSeed(401);
      g.fillStyle = vgrad(g, 0, GY, [[0, '#6c82cc'], [0.3, '#9caee6'], [0.58, '#cdcbf0'], [0.82, '#eee7f6'], [1, '#fcf1ef']]);
      g.fillRect(0, 0, W, H);
      for (let i = 0; i < 30; i++) { g.fillStyle = `rgba(255,255,255,${rr(0.25, 0.7)})`; g.fillRect(rr(0, W), rr(6, 170), 1.6, 1.6); }
      aurora(g, 112, [[3, 22, 2.4], [7, 8, 0.3]], '200,150,255', 0.42, 80);
      aurora(g, 152, [[2, 30, 0.6], [5, 10, 1.9]], '100,240,200', 0.58, 110);
      aurora(g, 198, [[1, 26, 4.1], [4, 9, 1.2]], '140,210,255', 0.34, 70);
      // 희미한 겨울 해
      glow(g, 810, 128, 250, 'rgba(255,244,236,0.5)');
      glow(g, 810, 128, 70, 'rgba(255,252,245,0.9)');
      blob(g, 810, 128, 26, '#fffaf3');
      g.save(); g.translate(250, 84); g.scale(0.75, 0.75); K.drawCrackedStar(g, 0, 0); g.restore();
    });
  }

  // ── 먼 산맥: 눈 덮인 봉우리, 빛이 오른쪽 위에서 비쳐 왼쪽 비탈은 그늘 ──
  function range(g, yAt, c0, c1, snowY, snowA) {
    ridge(g, yAt, vgrad(g, 160, 380, [[0, c0], [1, c1]]));
    g.save();
    g.beginPath(); g.moveTo(0, H); for (let x = 0; x <= W; x += 3) g.lineTo(x, yAt(x)); g.lineTo(W, H); g.closePath(); g.clip();
    g.fillStyle = `rgba(255,255,255,${snowA})`;
    g.beginPath(); g.moveTo(0, 0);
    for (let x = 0; x <= W; x += 4) g.lineTo(x, snowY + wave(x, [[6, 8, 0.3], [17, 5, 1.1], [29, 3, 2]]));
    g.lineTo(W, 0); g.closePath(); g.fill();
    g.fillStyle = 'rgba(96,104,178,0.17)';
    for (let x = 0; x < W; x += 2) if (yAt(x + 2) - yAt(x) < -0.5) g.fillRect(x, yAt(x), 2, 420);
    g.restore();
  }
  function far() {
    return canvas(W, H, g => {
      range(g, x => 300 - peaks(x, [[3, 92, 0.4], [5, 38, 1.3], [12, 10, 0.2]]), '#b2bbe8', '#d6dcf3', 232, 0.88);
      g.fillStyle = vgrad(g, 200, 330, [[0, 'rgba(240,238,252,0)'], [1, 'rgba(240,238,252,0.55)']]);
      g.fillRect(0, 200, W, 130);
      range(g, x => 336 - peaks(x, [[4, 56, 2.1], [9, 18, 0.8]]) - wave(x, [[13, 3, 0.4]]), '#9fb1e0', '#c8d4ee', 296, 0.82);
      g.fillStyle = vgrad(g, 260, 380, [[0, 'rgba(244,242,252,0)'], [1, 'rgba(244,242,252,0.85)']]);
      g.fillRect(0, 260, W, 120);
    });
  }

  // ── 중간: 언덕 위 얼음 성 ──
  function pineSil(g, x, y, h, col) {
    g.fillStyle = col; g.beginPath();
    [[1, 0.42, 0.22], [0.72, 0.14, 0.3], [0.42, 0, 0.36]].forEach(([t, b, w]) => { g.moveTo(x, y - h * t); g.lineTo(x + h * w, y - h * b); g.lineTo(x - h * w, y - h * b); g.closePath(); });
    g.fill();
    g.fillStyle = 'rgba(255,255,255,0.7)'; g.beginPath(); g.moveTo(x, y - h); g.lineTo(x + h * 0.09, y - h * 0.78); g.lineTo(x - h * 0.09, y - h * 0.78); g.fill();
  }
  function tower(g, x, w, top, by, cone) {
    const gr = g.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
    gr.addColorStop(0, '#a6bfe6'); gr.addColorStop(0.6, '#e4f1ff'); gr.addColorStop(1, '#c6dbf5');
    g.fillStyle = gr; g.fillRect(x - w / 2, top, w, by - top);
    g.fillStyle = 'rgba(90,110,180,0.14)'; g.fillRect(x - w / 2, top + 5, w * 0.28, by - top - 5);
    // 수정 지붕 (왼쪽 면 그늘, 오른쪽 면 빛)
    g.fillStyle = '#90bbe8'; g.beginPath(); g.moveTo(x - w / 2 - 4, top + 3); g.lineTo(x, top - cone); g.lineTo(x + w * 0.08, top + 3); g.closePath(); g.fill();
    g.fillStyle = '#e8f7ff'; g.beginPath(); g.moveTo(x + w * 0.08, top + 3); g.lineTo(x, top - cone); g.lineTo(x + w / 2 + 4, top + 3); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(x, top - cone); g.lineTo(x + w * 0.08, top + 3); g.stroke();
    g.fillStyle = '#ffffff'; g.beginPath(); g.roundRect(x - w / 2 - 5, top - 1, w + 10, 6, 3); g.fill();   // 처마의 눈
    g.fillStyle = 'rgba(220,240,255,0.95)';
    for (let i = 0; i < 3; i++) { const ix = x - w / 2 + (i + 0.5) * w / 3; g.beginPath(); g.moveTo(ix - 2, top + 4); g.lineTo(ix, top + 11 + (i % 2) * 4); g.lineTo(ix + 2, top + 4); g.fill(); }
    if (by - top > 60) {                                       // 빛나는 창
      glow(g, x, top + 27, 15, 'rgba(160,230,255,0.75)');
      g.fillStyle = '#c8f4ff'; g.beginPath(); g.roundRect(x - 3.5, top + 20, 7, 13, 3.5); g.fill();
    }
    glow(g, x, top - cone, 9, 'rgba(255,255,255,0.95)');
  }
  function iceCastle(g, cx, by) {
    glow(g, cx, by - 120, 200, 'rgba(215,240,255,0.55)');
    [[-114, 16, 74, 30], [114, 16, 66, 28], [-72, 24, 124, 58], [76, 22, 112, 52]].forEach(([dx, w, h, c]) => tower(g, cx + dx, w, by - h, by, c));
    // 성벽과 흉벽
    g.fillStyle = vgrad(g, by - 66, by, [[0, '#dceafb'], [1, '#a9c3ea']]);
    g.fillRect(cx - 98, by - 58, 196, 58);
    for (let i = 0; i < 13; i++) {
      const bx = cx - 98 + i * 15.5;
      g.fillRect(bx, by - 67, 9, 10);
      g.fillStyle = '#ffffff'; g.beginPath(); g.roundRect(bx - 1.5, by - 69, 12, 4, 2); g.fill();
      g.fillStyle = vgrad(g, by - 66, by, [[0, '#dceafb'], [1, '#a9c3ea']]);
    }
    g.strokeStyle = 'rgba(120,150,210,0.3)'; g.lineWidth = 1.5;
    for (const y of [by - 40, by - 20]) { g.beginPath(); g.moveTo(cx - 98, y); g.lineTo(cx + 98, y); g.stroke(); }
    g.strokeStyle = 'rgba(255,255,255,0.45)'; g.lineWidth = 3;
    [[-84, -50, -66, -6], [40, -54, 58, -10], [-30, -48, -18, -26]].forEach(([a, b, c, d]) => { g.beginPath(); g.moveTo(cx + a, by + b); g.lineTo(cx + c, by + d); g.stroke(); });
    // 성문
    g.fillStyle = '#6d86c4'; g.beginPath(); g.moveTo(cx - 17, by); g.lineTo(cx - 17, by - 26); g.arc(cx, by - 26, 17, Math.PI, 0); g.lineTo(cx + 17, by); g.closePath(); g.fill();
    glow(g, cx, by - 16, 22, 'rgba(180,235,255,0.7)');
    // 가운데 큰 탑 + 별 모양 창
    tower(g, cx, 44, by - 162, by - 56, 98);
    glow(g, cx, by - 128, 26, 'rgba(170,235,255,0.8)');
    g.fillStyle = '#d8f8ff'; g.beginPath();
    for (let i = 0; i < 10; i++) { const r = i % 2 ? 4 : 9, a = -Math.PI / 2 + i * Math.PI / 5; g.lineTo(cx + Math.cos(a) * r, by - 128 + Math.sin(a) * r); }
    g.closePath(); g.fill();
    // 밑동의 눈 더미
    for (let x = cx - 136; x <= cx + 136; x += 17) blob(g, x, by + 5, rr(9, 15), '#f4f8ff');
  }
  function mid() {
    return canvas(W, H, g => {
      K.setSeed(411);
      const hy = x => 348 + wave(x, [[2, 12, 0.9], [5, 6, 2.2]]);
      for (let x = 0; x < W; x += 13) {
        const h = rr(16, 36), xx = x + rr(-4, 4), y = hy(xx) + 6;
        wrap(xx, 20, X => pineSil(g, X, y, h, 'rgba(118,142,196,0.78)'));
      }
      ridge(g, hy, vgrad(g, 320, 410, [[0, '#e8eff9'], [1, '#c6d5ee']]));
      edge(g, hy, 'rgba(255,255,255,0.95)', 3);
      iceCastle(g, 520, hy(520) + 10);
      g.fillStyle = vgrad(g, 300, 392, [[0, 'rgba(240,244,252,0)'], [0.6, 'rgba(240,244,252,0.35)'], [1, 'rgba(240,244,252,0)']]);
      g.fillRect(0, 300, W, 92);
    });
  }

  // ── 가까운 언덕: 눈 쌓인 전나무와 빛나는 얼음 결정 ──
  function snowPine(g, x, by, h) {
    const w = h * 0.4;
    g.fillStyle = 'rgba(140,165,220,0.3)'; g.beginPath(); g.ellipse(x - 14, by + 2, w * 1.1, 7, 0, 0, TAU); g.fill();   // 왼쪽으로 진 그림자
    g.fillStyle = '#5a4436'; g.fillRect(x - h * 0.04, by - h * 0.2, h * 0.08, h * 0.22);
    for (let i = 0; i < 4; i++) {
      const bot = by - h * 0.14 - i * h * 0.21, tw = w * (1 - i * 0.22), th = h * 0.34, top = bot - th;
      g.fillStyle = vgrad(g, top, bot, [[0, '#3f7672'], [1, '#22484b']]);
      g.beginPath(); g.moveTo(x, top); g.lineTo(x + tw, bot); g.quadraticCurveTo(x, bot + 7, x - tw, bot); g.closePath(); g.fill();
      // 가지 위 눈 (아래 끝이 물결)
      const sy = bot - th * 0.3, sw = tw * 0.74 + 3, n = 4;
      g.fillStyle = '#f6faff';
      g.beginPath(); g.moveTo(x, top - 1); g.lineTo(x + sw, sy);
      for (let k = 1; k <= n; k++) { const px = x + sw - k * 2 * sw / n; g.quadraticCurveTo(px + sw / n, sy + 7, px, sy); }
      g.closePath(); g.fill();
      g.fillStyle = 'rgba(150,175,225,0.4)';
      g.beginPath(); g.moveTo(x, top); g.lineTo(x - sw * 0.92, sy); g.lineTo(x - sw * 0.3, sy + 3); g.closePath(); g.fill();
    }
  }
  // 육각 기둥 얼음 결정 하나 (끝 위치를 돌려줌)
  function prism(g, x, by, len, w, ang) {
    g.save(); g.translate(x, by); g.rotate(ang);
    g.fillStyle = 'rgba(138,192,240,0.92)';
    g.beginPath(); g.moveTo(-w / 2, 6); g.lineTo(-w / 2, -len * 0.78); g.lineTo(0, -len); g.lineTo(w * 0.1, -len * 0.78); g.lineTo(w * 0.1, 6); g.closePath(); g.fill();
    g.fillStyle = 'rgba(230,248,255,0.95)';
    g.beginPath(); g.moveTo(w * 0.1, 6); g.lineTo(w * 0.1, -len * 0.78); g.lineTo(0, -len); g.lineTo(w / 2, -len * 0.78); g.lineTo(w / 2, 6); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(80,120,195,0.55)'; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(-w / 2, 6); g.lineTo(-w / 2, -len * 0.78); g.lineTo(0, -len); g.lineTo(w / 2, -len * 0.78); g.lineTo(w / 2, 6); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.95)';
    g.beginPath(); g.moveTo(w * 0.1, 4); g.lineTo(w * 0.1, -len * 0.78); g.lineTo(0, -len); g.stroke();
    g.restore();
    return [x + Math.sin(ang) * len, by - Math.cos(ang) * len];
  }
  const CLUSTER = [[-24, 70, 18, -0.4], [22, 62, 16, 0.42], [-36, 40, 12, -0.75], [34, 36, 11, 0.8], [10, 92, 20, 0.16], [-8, 112, 24, -0.08]];
  function crystals(g, x, by, s) {
    glow(g, x, by - 50 * s, 90 * s, 'rgba(170,230,255,0.5)');
    CLUSTER.forEach(([dx, len, w, a]) => {
      const [tx, ty] = prism(g, x + dx * s, by, len * s, w * s, a);
      K.light(tx, ty, 'near', '225,248,255', 2.5 + s);
    });
    g.fillStyle = '#f4f8ff'; g.beginPath(); g.ellipse(x, by + 4, 54 * s, 11 * s, 0, 0, TAU); g.fill();
    g.fillStyle = 'rgba(140,165,220,0.3)'; g.beginPath(); g.ellipse(x - 10 * s, by + 8 * s, 44 * s, 5 * s, 0, 0, TAU); g.fill();
  }
  function near() {
    return canvas(W, H, g => {
      K.setSeed(421);
      const hy = x => 384 + wave(x, [[2, 10, 0.4], [5, 5, 1.7], [9, 2, 0.6]]);
      ridge(g, hy, vgrad(g, 350, 440, [[0, '#f8fbff'], [1, '#c8d7f0']]));
      edge(g, hy, '#ffffff', 3);
      g.fillStyle = 'rgba(150,175,230,0.22)';
      [[140, 30, 90, 10], [420, 26, 110, 9], [610, 34, 70, 8], [900, 30, 80, 9]].forEach(([x, dy, rx, ry]) => wrap(x, rx, X => { g.beginPath(); g.ellipse(X, hy(x) + dy, rx, ry, 0, 0, TAU); g.fill(); }));
      [[70, 128], [168, 94], [330, 152], [452, 104], [905, 134], [580, 78]].forEach(([x, h]) => wrap(x, 70, X => snowPine(g, X, hy(x) + 6, h)));
      // 큰 얼음 결정 무리 (안에 별조각이 얼어 있음)
      const bx = 770, by = hy(770) + 8;
      crystals(g, bx, by, 1.45);
      glow(g, bx - 13, by - 82, 40, 'rgba(200,245,255,0.75)');
      g.fillStyle = '#eafcff'; g.beginPath();
      g.moveTo(bx - 20, by - 70); g.lineTo(bx - 16, by - 92); g.lineTo(bx - 10, by - 100); g.lineTo(bx - 6, by - 82); g.lineTo(bx - 8, by - 70); g.closePath(); g.fill();
      g.globalAlpha = 0.35; prism(g, bx - 8 * 1.45, by, 112 * 1.45, 24 * 1.45, -0.08); g.globalAlpha = 1;
      K.light(bx - 13, by - 84, 'near', '170,235,255', 26, 0);
      [[250, 0.5], [402, 0.42], [520, 0.55], [660, 0.42]].forEach(([x, s]) => crystals(g, x, hy(x) + 6, s));
      // 눈 덮인 덤불
      [[30, 1], [236, 0.8], [700, 1.05], [852, 0.85]].forEach(([x, s]) => wrap(x, 40, X => {
        const y = hy(x) + 4;
        blob(g, X - 12 * s, y, 13 * s, '#e6eef9'); blob(g, X + 10 * s, y - 2, 15 * s, '#eef4fc'); blob(g, X, y - 9 * s, 12 * s, '#ffffff');
      }));
    });
  }

  // ── 땅: 깊은 눈, 파란 그림자, 얼음 웅덩이, 별조각 ──
  function ground() {
    return canvas(W, H, g => {
      K.setSeed(431);
      const gy = x => GY - 4 + wave(x, [[4, 2, 0.3], [9, 1.5, 1.1]]);
      ridge(g, gy, vgrad(g, GY - 10, H, [[0, '#ffffff'], [0.16, '#eff4fd'], [0.6, '#d6e2f5'], [1, '#bccfec']]));
      for (let x = 0; x < W; x += 7) { const r = rr(4, 8); wrap(x, 10, X => blob(g, X, gy(x) + 3, r, '#ffffff')); }
      g.fillStyle = 'rgba(160,185,232,0.35)'; g.fillRect(0, GY + 4, W, 3);
      // 눈 둔덕과 파란 그림자
      for (let i = 0; i < 9; i++) {
        const x = rr(0, W), y = rr(GY + 22, H - 14), rx = rr(50, 120), ry = rr(5, 10);
        wrap(x, rx, X => {
          g.fillStyle = 'rgba(140,165,222,0.2)'; g.beginPath(); g.ellipse(X, y, rx, ry, 0, 0, TAU); g.fill();
          g.fillStyle = 'rgba(255,255,255,0.75)'; g.beginPath(); g.ellipse(X + rx * 0.08, y - ry * 0.7, rx * 0.8, ry * 0.55, 0, 0, TAU); g.fill();
        });
      }
      g.lineWidth = 2;
      for (let i = 0; i < 16; i++) {
        const x = rr(0, W), y = rr(GY + 16, H - 8), w = rr(40, 90);
        wrap(x, w, X => {
          g.strokeStyle = 'rgba(140,165,222,0.4)'; g.beginPath(); g.moveTo(X - w / 2, y); g.quadraticCurveTo(X, y - 6, X + w / 2, y); g.stroke();
          g.strokeStyle = 'rgba(255,255,255,0.9)'; g.beginPath(); g.moveTo(X - w / 2 + 4, y - 3); g.quadraticCurveTo(X, y - 9, X + w / 2 - 4, y - 3); g.stroke();
        });
      }
      // 얼음 웅덩이
      [[100, GY + 48, 70, 9], [395, GY + 96, 92, 11], [690, GY + 56, 62, 8], [960, GY + 108, 58, 8]].forEach(([x, y, rx, ry]) => wrap(x, rx, X => {
        const gr = g.createLinearGradient(X - rx, 0, X + rx, 0);
        gr.addColorStop(0, 'rgba(160,205,240,0.9)'); gr.addColorStop(0.5, 'rgba(222,244,255,0.95)'); gr.addColorStop(1, 'rgba(150,196,236,0.9)');
        g.fillStyle = gr; g.beginPath(); g.ellipse(X, y, rx, ry, 0, 0, TAU); g.fill();
        g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 2; g.stroke();
        g.strokeStyle = 'rgba(255,255,255,0.95)'; g.lineWidth = 1.6; g.beginPath();
        g.moveTo(X - rx * 0.5, y + ry * 0.3); g.lineTo(X - rx * 0.38, y - ry * 0.4); g.moveTo(X - rx * 0.32, y + ry * 0.35); g.lineTo(X - rx * 0.24, y - ry * 0.15);
        g.moveTo(X + rx * 0.3, y + ry * 0.4); g.lineTo(X + rx * 0.4, y - ry * 0.3); g.stroke();
      }));
      // 눈 모자를 쓴 돌
      for (let i = 0; i < 7; i++) {
        const x = rr(20, W - 20), y = rr(GY + 26, H - 12), s = rr(0.7, 1.3);
        g.fillStyle = '#8f9cba'; g.beginPath(); g.ellipse(x, y, 10 * s, 6 * s, 0, 0, TAU); g.fill();
        g.fillStyle = '#6f7c9c'; g.beginPath(); g.ellipse(x - 3 * s, y + 2 * s, 6 * s, 3 * s, 0, 0, TAU); g.fill();
        g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(x + 1, y - 4 * s, 9 * s, 3.6 * s, 0, 0, TAU); g.fill();
      }
      // 마른 풀과 늑대 발자국
      g.strokeStyle = 'rgba(130,140,170,0.8)'; g.lineWidth = 1.5;
      for (let i = 0; i < 12; i++) {
        const x = rr(10, W - 10), y = rr(GY + 12, H - 6);
        for (let k = -2; k <= 2; k++) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + k * 3, y - rr(6, 12)); g.stroke(); }
        blob(g, x, y + 1, 5, '#ffffff');
      }
      g.fillStyle = 'rgba(120,145,205,0.38)';
      [[250, GY + 30], [610, GY + 106]].forEach(([x0, y0]) => {
        for (let k = 0; k < 6; k++) {
          const px = x0 + k * 24, py = y0 + (k % 2) * 8;
          g.beginPath(); g.ellipse(px, py, 3.4, 2.6, 0, 0, TAU); g.fill();
          [[-3.2, -3.6], [0, -5], [3.2, -3.6]].forEach(([dx, dy]) => { g.beginPath(); g.arc(px + dx - 1, py + dy, 1.3, 0, TAU); g.fill(); });
        }
      });
      // 반짝이는 눈가루
      for (let i = 0; i < 24; i++) K.light(rr(10, W - 10), rr(GY + 8, H - 6), 'ground', '255,255,255', rr(1.2, 2));
      // 눈에 박힌 별조각
      [[180, GY + 64], [540, GY + 36], [830, GY + 86]].forEach(([x, y]) => {
        glow(g, x, y - 8, 34, 'rgba(90,140,220,0.28)');
        K.drawShard(g, x, y);
        g.fillStyle = 'rgba(110,175,240,0.55)';
        g.beginPath(); g.moveTo(x + 2, y - 24); g.lineTo(x + 7, y - 8); g.lineTo(x + 6, y); g.lineTo(x + 1, y - 2); g.closePath(); g.fill();
        g.strokeStyle = 'rgba(70,120,200,0.85)'; g.lineWidth = 1.5;
        g.beginPath(); g.moveTo(x - 7, y); g.lineTo(x - 3, y - 18); g.lineTo(x + 2, y - 24); g.lineTo(x + 7, y - 8); g.lineTo(x + 6, y); g.stroke();
        g.fillStyle = 'rgba(140,165,222,0.35)'; g.beginPath(); g.ellipse(x + 2, y + 3, 13, 3.5, 0, 0, TAU); g.fill();
        g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(x, y + 1, 11, 4, 0, 0, TAU); g.fill();
      });
    });
  }

  return {
    sky: sky(), far: far(), mid: mid(), near: near(), ground: ground(),
    fall: null, clouds: false, mote: 'custom', rayX: 790, rayDir: -1, rayRgb: '228,238,255',
    front: ['rgba(244,250,255,0.92)', 'rgba(200,222,248,0.92)'],
    // 내리는 눈송이 (큰 것은 결정 모양, 바람에 왼쪽으로 흘러감)
    moteCount: 46,
    moteMake: anywhere => {
      const r = rr(1.2, 4.2);
      return { x: anywhere ? rr(0, W) : rr(0, W + 160), y: anywhere ? rr(0, H) : rr(-30, -6), r,
        vx: rr(-34, -12), vy: 20 + r * 12 + rr(0, 10), a: rr(0.65, 1), rot: rr(0, TAU), vr: rr(-1.5, 1.5), sw: rr(0, TAU), sf: rr(1, 2.4) };
    },
    moteDraw: (ctx, p, dt) => {
      p.sw += dt * p.sf; p.rot += dt * p.vr;
      p.x += (p.vx + Math.sin(p.sw) * 16) * dt; p.y += p.vy * dt;
      if (p.y > H + 10 || p.x < -20) return false;
      ctx.globalAlpha = p.a;
      ctx.fillStyle = 'rgba(110,130,190,0.28)'; ctx.beginPath(); ctx.arc(p.x + 0.7, p.y + 0.9, p.r, 0, TAU); ctx.fill();
      if (p.r > 3.2) {
        ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.arc(0, 0, p.r, 0, TAU); ctx.fill();
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.3; ctx.beginPath();
        for (let k = 0; k < 3; k++) { const a = k * Math.PI / 3; ctx.moveTo(-Math.cos(a) * p.r * 1.3, -Math.sin(a) * p.r * 1.3); ctx.lineTo(Math.cos(a) * p.r * 1.3, Math.sin(a) * p.r * 1.3); }
        ctx.stroke();
      } else {
        ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 2, 0, TAU); ctx.fill();
        ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill();
      }
    },
  };
});

// 챕터 5 산호 바다 — 배경
Scenery.addTheme('sea', (K, cur) => {
  const { W, H, GY, TAU, rr, rnd, wave, canvas, ridge, wrap, vgrad, glow, blob } = K;
  // 곡선 윗선 경로
  const edge = (g, yAt) => { g.beginPath(); for (let x = 0; x <= W; x += 3) x ? g.lineTo(x, yAt(x)) : g.moveTo(x, yAt(x)); };
  // 미리 정해 둔 모양을 x에 그림 (가장자리에 걸치면 반대쪽에도)
  const place = (g, x, m, draw) => wrap(x, m, X => { g.save(); g.translate(X, 0); draw(g); g.restore(); });
  const hgrad = (g, x0, x1, stops) => { const gr = g.createLinearGradient(x0, 0, x1, 0); stops.forEach(([o, c]) => gr.addColorStop(o, c)); return gr; };

  // 물빛 그물 (커스틱): 출렁이는 고리
  function caustic(g, x, y, rx, ry, ph) {
    g.beginPath();
    for (let k = 0; k <= 16; k++) {
      const t = k / 16 * TAU, s = 1 + 0.22 * Math.sin(t * 3 + ph) + 0.1 * Math.sin(t * 5 + ph * 2);
      const px = x + Math.cos(t) * rx * s, py = y + Math.sin(t) * ry * s;
      k ? g.lineTo(px, py) : g.moveTo(px, py);
    }
    g.closePath();
  }

  // ── 먼 바위 더미: 울퉁불퉁한 실루엣 (점은 미리 정함) ──
  function makeStack(w, h) {
    return [[-w, 0], [-w * rr(0.7, 0.85), -h * rr(0.35, 0.5)], [-w * rr(0.45, 0.6), -h * rr(0.85, 0.95)], [-w * rr(0.1, 0.2), -h],
      [w * rr(0.15, 0.3), -h * rr(0.75, 0.92)], [w * rr(0.5, 0.65), -h * rr(0.5, 0.65)], [w * rr(0.8, 0.9), -h * rr(0.2, 0.3)], [w, 0]];
  }
  function stackPath(g, p) {
    g.beginPath(); g.moveTo(p[0][0], p[0][1]);
    for (let i = 1; i < p.length - 1; i++) g.quadraticCurveTo(p[i][0], p[i][1], (p[i][0] + p[i + 1][0]) / 2, (p[i][1] + p[i + 1][1]) / 2);
    g.lineTo(p[p.length - 1][0], p[p.length - 1][1]); g.closePath();
  }
  function drawStack(g, p, col, shade) {
    const w = p[p.length - 1][0];
    g.fillStyle = col; stackPath(g, p); g.fill();
    g.save(); g.clip();
    g.fillStyle = hgrad(g, -w * 0.1, w, [[0, 'rgba(0,0,0,0)'], [1, shade]]); g.fillRect(-w, -400, w * 2, 400);
    g.restore();
  }
  // 바위 아치 (가운데가 뚫림)
  function arch(g, col, shade) {
    const outer = () => { g.moveTo(-112, 0); g.quadraticCurveTo(-116, -92, -88, -150); g.quadraticCurveTo(-44, -198, 28, -186); g.quadraticCurveTo(98, -172, 106, -112); g.quadraticCurveTo(110, -50, 122, 0); g.closePath(); };
    g.fillStyle = col;
    g.beginPath(); outer(); g.moveTo(58, -6); g.ellipse(-4, -6, 62, 124, 0, 0, TAU); g.fill('evenodd');
    g.fillStyle = shade;
    g.beginPath(); g.moveTo(58, -6); g.ellipse(-4, -6, 62, 124, 0, 0, TAU); g.moveTo(72, -6); g.ellipse(-4, -10, 76, 132, 0, 0, TAU); g.fill('evenodd');
  }

  // ── 가라앉은 배 (먼 곳) ──
  function wreck(g, x, y, col) {
    g.save(); g.translate(x, y); g.rotate(-0.14); g.fillStyle = col; g.strokeStyle = col;
    g.beginPath(); g.moveTo(-120, -34); g.lineTo(-70, -30); g.lineTo(-60, -40); g.lineTo(60, -40); g.lineTo(70, -52); g.lineTo(112, -54);
    g.quadraticCurveTo(108, -10, 80, 14); g.lineTo(-86, 16); g.quadraticCurveTo(-112, 0, -120, -34); g.closePath(); g.fill();
    g.fillRect(-12, -170, 7, 134);
    g.fillRect(50, -118, 6, 68);
    g.lineWidth = 5; g.lineCap = 'round'; g.beginPath(); g.moveTo(-62, -140); g.lineTo(46, -146); g.stroke();
    g.globalAlpha = 0.7;
    g.beginPath(); g.moveTo(-56, -136); g.lineTo(40, -142); g.lineTo(30, -96); g.lineTo(10, -104); g.lineTo(-8, -84); g.lineTo(-30, -98); g.lineTo(-50, -86); g.closePath(); g.fill();
    g.globalAlpha = 1;
    g.fillStyle = 'rgba(130,210,235,0.55)';
    [-60, -30, 0, 30].forEach(px => { g.beginPath(); g.arc(px, -14, 4, 0, TAU); g.fill(); });
    g.restore();
  }

  // ── 산호·해초 모양 만들기 (무작위 값은 여기서 한 번만) ──
  function makeBranch(x, y, ang, len, w, depth, spread, out = []) {
    const x2 = x + Math.cos(ang) * len, y2 = y + Math.sin(ang) * len;
    out.push([x, y, x2, y2, w, depth]);
    if (depth > 0) {
      const n = rnd() < 0.6 ? 2 : 3;
      for (let i = 0; i < n; i++) makeBranch(x2, y2, ang + (i - (n - 1) / 2) * spread + rr(-0.25, 0.25), len * rr(0.62, 0.82), w * 0.7, depth - 1, spread, out);
    }
    return out;
  }
  function drawBranch(g, segs, c1, c2, tip) {
    g.lineCap = 'round';
    segs.forEach(([x, y, x2, y2, w]) => { g.strokeStyle = c2; g.lineWidth = w + 3; g.beginPath(); g.moveTo(x, y); g.lineTo(x2, y2); g.stroke(); });
    segs.forEach(([x, y, x2, y2, w]) => { g.strokeStyle = c1; g.lineWidth = w; g.beginPath(); g.moveTo(x, y); g.lineTo(x2, y2); g.stroke(); });
    segs.filter(s => s[5] === 0).forEach(([, , x2, y2, w]) => blob(g, x2, y2, w * 0.55 + 1, tip));
  }
  function makeKelp(h, n) {
    const ph = rr(0, TAU), amp = rr(8, 16), leaves = [];
    for (let i = 0; i < n; i++) leaves.push({ t: (i + 0.7) / (n + 0.4), s: i % 2 ? 1 : -1, len: rr(16, 28) });
    return { h, ph, amp, leaves };
  }
  function drawKelp(g, k, baseY, c1, c2, lw) {
    const at = t => [Math.sin(t * 5 + k.ph) * k.amp * t, baseY - k.h * t];
    g.lineCap = 'round'; g.strokeStyle = c1; g.lineWidth = lw;
    g.beginPath(); for (let i = 0; i <= 30; i++) { const [x, y] = at(i / 30); i ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke();
    k.leaves.forEach(l => {
      const [x, y] = at(l.t), L = l.len * lw / 4;
      g.fillStyle = c2;
      g.beginPath(); g.moveTo(x, y);
      g.quadraticCurveTo(x + l.s * L * 0.7, y - L * 0.1, x + l.s * L, y - L * 0.85);
      g.quadraticCurveTo(x + l.s * L * 0.25, y - L * 0.5, x, y);
      g.fill();
      blob(g, x + l.s * lw * 0.5, y - lw * 0.4, lw * 0.6, c1);
    });
  }
  // 부채 산호: 부채살 + 그물
  function seaFan(g, s, ph, c1, c2, fill) {
    const R = 62 * s, a0 = -Math.PI / 2 - 0.95, a1 = -Math.PI / 2 + 0.95, cy = -10 * s;
    const rim = i => { const a = a0 + (a1 - a0) * i / 18, r = R * (1 + 0.07 * Math.sin(i * 2.1 + ph)); return [Math.cos(a) * r, Math.sin(a) * r + cy]; };
    g.save();
    g.fillStyle = fill; g.beginPath(); g.moveTo(0, cy); for (let i = 0; i <= 18; i++) { const [x, y] = rim(i); g.lineTo(x, y); } g.closePath(); g.fill();
    g.clip();
    g.strokeStyle = c2; g.lineWidth = 1.3 * s;
    for (let k = 1; k <= 5; k++) { g.beginPath(); g.arc(0, cy, R * k / 5.4, a0 - 0.1, a1 + 0.1); g.stroke(); }
    g.restore();
    g.lineCap = 'round'; g.strokeStyle = c1;
    for (let i = 0; i <= 8; i++) { const [x, y] = rim(i * 18 / 8); g.lineWidth = 2.6 * s; g.beginPath(); g.moveTo(0, cy); g.quadraticCurveTo(x * 0.45 + (i - 4) * 2 * s, (y + cy) * 0.5 - 4 * s, x, y); g.stroke(); }
    g.lineWidth = 6 * s; g.beginPath(); g.moveTo(0, 4); g.lineTo(0, cy); g.stroke();
  }
  function brain(g, r, c1, c2, groove) {
    g.save();
    g.fillStyle = vgrad(g, -r, 0, [[0, c1], [1, c2]]);
    g.beginPath(); g.ellipse(0, 0, r * 1.25, r, 0, Math.PI, TAU); g.closePath(); g.fill();
    g.clip();
    g.strokeStyle = groove; g.lineWidth = 2;
    for (let i = -5; i <= 5; i++) {
      g.beginPath();
      for (let k = 0; k <= 16; k++) { const y = -r + k * r / 16, x = i * r * 0.24 + Math.sin(k * 1.3 + i * 2) * r * 0.07; k ? g.lineTo(x, y) : g.moveTo(x, y); }
      g.stroke();
    }
    g.fillStyle = 'rgba(255,255,255,0.22)'; g.beginPath(); g.ellipse(-r * 0.35, -r * 0.7, r * 0.45, r * 0.18, -0.3, 0, TAU); g.fill();
    g.restore();
  }
  function tubes(g, list, c1, c2, hole) {
    list.forEach(([dx, h, w]) => {
      g.fillStyle = vgrad(g, -h, 0, [[0, c1], [1, c2]]);
      g.beginPath(); g.roundRect(dx - w / 2, -h, w, h + 4, w * 0.45); g.fill();
      g.fillStyle = hole; g.beginPath(); g.ellipse(dx, -h + 4, w * 0.32, 2.6, 0, 0, TAU); g.fill();
    });
  }
  function makeAnem(n, r) {
    const t = [];
    for (let i = 0; i < n; i++) t.push({ a: -Math.PI + 0.35 + (i / (n - 1)) * (Math.PI - 0.7) + rr(-0.1, 0.1), len: r * rr(0.8, 1.15), curl: rr(-0.6, 0.6), back: i % 2 });
    return t;
  }
  function drawAnem(g, tents, r, c1, c2, tip) {
    g.fillStyle = vgrad(g, -r * 0.4, 4, [[0, c2], [1, '#4a2e5a']]);
    g.beginPath(); g.roundRect(-r * 0.32, -r * 0.4, r * 0.64, r * 0.48, 5); g.fill();
    g.lineCap = 'round';
    [1, 0].forEach(pass => tents.filter(t => t.back === pass).forEach(({ a, len, curl }) => {
      const ex = Math.cos(a) * len, ey = Math.sin(a) * len - r * 0.35;
      const cx = Math.cos(a + curl) * len * 0.6, cy = Math.sin(a + curl) * len * 0.6 - r * 0.35;
      g.strokeStyle = pass ? c2 : c1; g.lineWidth = r * 0.16;
      g.beginPath(); g.moveTo(0, -r * 0.35); g.quadraticCurveTo(cx, cy, ex, ey); g.stroke();
      blob(g, ex, ey, r * 0.1, tip);
    }));
  }
  function starfish(g, x, y, r, rot, c1, c2, flat) {
    g.save(); g.translate(x, y); g.scale(1, flat); g.rotate(rot);
    g.fillStyle = c1; g.strokeStyle = c1; g.lineJoin = 'round'; g.lineWidth = r * 0.3;
    g.beginPath();
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, d = i % 2 ? r * 0.42 : r; i ? g.lineTo(Math.cos(a) * d, Math.sin(a) * d) : g.moveTo(Math.cos(a) * d, Math.sin(a) * d); }
    g.closePath(); g.fill(); g.stroke();
    g.fillStyle = c2;
    for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * TAU / 5; [0.35, 0.65].forEach(d => { g.beginPath(); g.arc(Math.cos(a) * r * d, Math.sin(a) * r * d, r * 0.07, 0, TAU); g.fill(); }); }
    g.restore();
  }
  function scallop(g, x, y, s, c1, c2) {
    g.save(); g.translate(x, y); g.scale(s, s * 0.8);
    g.fillStyle = c1;
    g.beginPath(); g.moveTo(0, 4); g.lineTo(-9, -4); g.quadraticCurveTo(0, -15, 9, -4); g.closePath(); g.fill();
    g.fillRect(-3.5, 1.5, 7, 3.5);
    g.strokeStyle = c2; g.lineWidth = 1;
    for (let k = -3; k <= 3; k++) { g.beginPath(); g.moveTo(0, 3); g.lineTo(k * 2.6, -8.5 + Math.abs(k) * 0.9); g.stroke(); }
    g.restore();
  }
  function conch(g, x, y, s, rot, c1, c2) {
    g.save(); g.translate(x, y); g.rotate(rot); g.scale(s, s);
    g.fillStyle = c1;
    g.beginPath(); g.moveTo(-8, 2); g.quadraticCurveTo(-8, -6, 0, -6); g.lineTo(10, -2); g.lineTo(10, 1); g.quadraticCurveTo(0, 6, -8, 2); g.closePath(); g.fill();
    g.strokeStyle = c2; g.lineWidth = 1;
    [-3, 1, 5].forEach(px => { g.beginPath(); g.moveTo(px, -5.5); g.quadraticCurveTo(px + 1.5, -1, px, 3); g.stroke(); });
    g.fillStyle = 'rgba(255,255,255,0.55)'; g.beginPath(); g.ellipse(-3, -3, 3, 1.2, -0.2, 0, TAU); g.fill();
    g.restore();
  }
  function pearl(g, x, y, r) {
    glow(g, x, y, r * 4, 'rgba(225,250,255,0.6)');
    const gr = g.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
    gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.6, '#e4f2ff'); gr.addColorStop(1, '#a8c0e8');
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
  }
  // 작은 조개에 담긴 진주 (반짝임은 매 프레임)
  function pearlClam(g, x, y, s, layer) {
    g.fillStyle = '#c8a0d8'; g.beginPath(); g.ellipse(x, y, 10 * s, 5 * s, 0, 0, Math.PI); g.closePath(); g.fill();
    g.fillStyle = '#e8c8f0'; g.beginPath(); g.ellipse(x, y - 1, 10 * s, 7 * s, 0, Math.PI, TAU); g.closePath(); g.fill();
    g.fillStyle = '#8a5aa0'; g.beginPath(); g.ellipse(x, y, 8 * s, 2 * s, 0, 0, TAU); g.fill();
    pearl(g, x, y - 1.5 * s, 3.2 * s);
    K.light(x, y - 1.5 * s, layer, '230,250,255', 4 * s);
  }

  // ── 큰 대왕조개와 빛나는 진주 (가까운 곳의 명소) ──
  function giantClam(g, x, baseY) {
    // 뒤로 젖혀진 윗껍데기
    const top = g.createLinearGradient(0, baseY - 150, 0, baseY - 40);
    top.addColorStop(0, '#f0e0ff'); top.addColorStop(1, '#a88ac8');
    g.fillStyle = top;
    g.beginPath(); g.moveTo(x - 92, baseY - 40);
    for (let i = 0; i <= 6; i++) { const a = Math.PI + i * Math.PI / 6, px = x + Math.cos(a) * 96, py = baseY - 48 + Math.sin(a) * 96; g.quadraticCurveTo(px - Math.sin(a) * 8, py + Math.cos(a) * 8 - 6, px, py); }
    g.lineTo(x + 92, baseY - 40); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(120,80,160,0.35)'; g.lineWidth = 3;
    for (let i = 1; i < 6; i++) { const a = Math.PI + i * Math.PI / 6; g.beginPath(); g.moveTo(x, baseY - 46); g.lineTo(x + Math.cos(a) * 90, baseY - 48 + Math.sin(a) * 90); g.stroke(); }
    // 속살 (푸른 무늬)
    const mantle = g.createLinearGradient(0, baseY - 70, 0, baseY - 30);
    mantle.addColorStop(0, '#5ad0e8'); mantle.addColorStop(1, '#3a7ac8');
    g.fillStyle = mantle; g.beginPath(); g.ellipse(x, baseY - 42, 86, 24, 0, 0, TAU); g.fill();
    g.fillStyle = 'rgba(200,255,250,0.55)';
    for (let i = 0; i < 9; i++) { g.beginPath(); g.arc(x - 70 + i * 17.5, baseY - 42 + Math.sin(i * 1.7) * 9, 3, 0, TAU); g.fill(); }
    // 큰 진주
    pearl(g, x, baseY - 58, 20);
    g.fillStyle = 'rgba(255,255,255,0.9)'; g.beginPath(); g.ellipse(x - 7, baseY - 66, 6, 3.5, -0.5, 0, TAU); g.fill();
    K.light(x, baseY - 58, 'near', '210,245,255', 30, 0);
    // 아랫껍데기 (물결 가장자리)
    const low = g.createLinearGradient(0, baseY - 50, 0, baseY + 6);
    low.addColorStop(0, '#e8d4f8'); low.addColorStop(1, '#8a6ab0');
    g.fillStyle = low;
    g.beginPath(); g.moveTo(x - 100, baseY - 36);
    for (let i = 0; i < 8; i++) { const x0 = x - 100 + i * 25; g.quadraticCurveTo(x0 + 12.5, baseY - 52, x0 + 25, baseY - 36); }
    g.quadraticCurveTo(x + 96, baseY + 4, x, baseY + 6); g.quadraticCurveTo(x - 96, baseY + 4, x - 100, baseY - 36); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(100,60,140,0.35)'; g.lineWidth = 3;
    for (let i = 1; i < 8; i++) { const x0 = x - 100 + i * 25; g.beginPath(); g.moveTo(x0, baseY - 36); g.quadraticCurveTo(x0 + (x0 - x) * 0.1, baseY - 14, x + (x0 - x) * 0.55, baseY + 2); g.stroke(); }
    g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.ellipse(x - 50, baseY - 30, 26, 5, -0.1, 0, TAU); g.fill();
  }

  // ════════ 하늘 = 물빛 (움직이지 않음) ════════
  const sky = canvas(W, H, g => {
    K.setSeed(5101);
    g.fillStyle = vgrad(g, 0, H, [[0, '#9af4e6'], [0.08, '#5fdcdc'], [0.32, '#2fa6d0'], [0.62, '#1b6fae'], [1, '#0f3f7c']]);
    g.fillRect(0, 0, W, H);
    // 수면 너머로 일렁이는 금 간 별
    glow(g, 300, 70, 190, 'rgba(255,250,215,0.4)');
    g.save(); g.globalAlpha = 0.92; g.translate(300, 70); g.scale(0.85, 0.85); K.drawCrackedStar(g, 0, 0); g.restore();
    for (let i = 0; i < 10; i++) {
      const y0 = 30 + i * 8, ph = i * 2.1;
      g.fillStyle = hgrad(g, 210, 390, i % 2 ? [[0, 'rgba(70,200,220,0)'], [0.5, 'rgba(70,200,220,0.38)'], [1, 'rgba(70,200,220,0)']] : [[0, 'rgba(255,255,255,0)'], [0.5, 'rgba(255,255,255,0.3)'], [1, 'rgba(255,255,255,0)']]);
      g.beginPath();
      for (let x = 210; x <= 390; x += 4) { const y = y0 + Math.sin(x / 11 + ph) * 2.2; x === 210 ? g.moveTo(x, y) : g.lineTo(x, y); }
      for (let x = 390; x >= 210; x -= 4) g.lineTo(x, y0 + 2.4 + Math.sin(x / 11 + ph + 0.7) * 2.2);
      g.closePath(); g.fill();
    }
    // 수면 (밝은 물결 가장자리)
    const sy = x => 16 + wave(x, [[6, 3, 0.4], [15, 2, 1.7], [29, 1, 0.2]]);
    g.fillStyle = vgrad(g, 0, 26, [[0, 'rgba(240,255,250,0.85)'], [1, 'rgba(200,250,245,0.4)']]);
    g.beginPath(); g.moveTo(0, 0); for (let x = 0; x <= W; x += 3) g.lineTo(x, sy(x)); g.lineTo(W, 0); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 2; edge(g, sy); g.stroke();
    // 물빛 그물
    g.lineWidth = 1.6;
    for (let row = 0; row < 7; row++) {
      const y = 34 + row * 22, a = (0.22 * (1 - row / 7)).toFixed(3);
      g.strokeStyle = `rgba(230,255,250,${a})`;
      for (let x = rr(-30, 0); x < W + 30; x += rr(30, 42)) { caustic(g, x, y + rr(-5, 5), rr(14, 20), rr(8, 11) * (1 - row * 0.06), rr(0, TAU)); g.stroke(); }
    }
    // 빛기둥
    g.save(); g.globalCompositeOperation = 'lighter';
    [[90, 60, 0.12], [250, 40, 0.09], [470, 80, 0.11], [690, 50, 0.09], [850, 70, 0.11]].forEach(([x, w, a]) => {
      g.fillStyle = vgrad(g, 0, 430, [[0, `rgba(200,255,245,${a})`], [1, 'rgba(200,255,245,0)']]);
      g.beginPath(); g.moveTo(x, 0); g.lineTo(x + w, 0); g.lineTo(x + w * 1.6 - 180, 430); g.lineTo(x - w * 0.6 - 180, 430); g.closePath(); g.fill();
    });
    g.restore();
    // 떠다니는 플랑크톤
    for (let i = 0; i < 70; i++) { g.fillStyle = `rgba(230,255,255,${rr(0.15, 0.45).toFixed(2)})`; g.beginPath(); g.arc(rr(0, W), rr(40, 400), rr(0.6, 1.6), 0, TAU); g.fill(); }
  });

  // ════════ 먼 산호초 (푸른 안개) ════════
  const far = canvas(W, H, g => {
    K.setSeed(5102);
    const rock = '#2f80b4', shade = 'rgba(15,60,110,0.32)', fy = x => 316 + wave(x, [[2, 12, 0.8], [5, 7, 2.0], [11, 3, 0.4]]);
    place(g, 300, 0, g => { g.translate(0, 334); arch(g, '#3688bb', 'rgba(15,60,110,0.25)'); });
    [[70, 52, 170], [180, 30, 96], [455, 36, 118], [575, 58, 196], [880, 44, 140]].forEach(([x, w, h]) => {
      const p = makeStack(w, h);
      place(g, x, w + 4, g => { g.translate(0, 338); drawStack(g, p, rock, shade); });
    });
    wreck(g, 735, 318, '#3484b8');
    ridge(g, fy, vgrad(g, 290, 380, [[0, '#3a8cbe'], [1, '#56a8cc']]));
    // 먼 산호 실루엣
    [[130, 46], [390, 40], [650, 34], [945, 42]].forEach(([x, len]) => {
      const segs = makeBranch(0, 0, -Math.PI / 2, len * 0.5, 7, 3, 0.6), y = fy(x) + 6;
      place(g, x, 70, g => { g.translate(0, y); drawBranch(g, segs, '#3d90c0', '#3d90c0', '#3d90c0'); });
    });
    for (let x = 0; x < W; x += 30) { const r = rr(4, 9), y = fy(x) + 5; place(g, x, 12, g => blob(g, 0, y, r, '#3e92c2')); }
    g.fillStyle = vgrad(g, 140, 380, [[0, 'rgba(100,195,222,0)'], [1, 'rgba(100,195,222,0.55)']]);
    g.fillRect(0, 140, W, 240);
  });

  // ════════ 큰 산호와 다시마 숲 (천천히) ════════
  const mid = canvas(W, H, g => {
    K.setSeed(5103);
    const my = x => 350 + wave(x, [[3, 9, 1.1], [7, 4, 0.3]]);
    // 다시마 (뒤쪽)
    [[30, 300], [150, 250], [330, 290], [620, 270], [660, 210], [800, 300]].forEach(([x, h]) => {
      const k = makeKelp(h, Math.floor(h / 30)), y = my(x) + 6;
      place(g, x, 50, g => drawKelp(g, k, y, '#3c8a6a', '#4f9e72', 4));
    });
    ridge(g, my, vgrad(g, 330, 400, [[0, '#4a9ab2'], [1, '#3a86a4']]));
    g.strokeStyle = 'rgba(190,240,240,0.5)'; g.lineWidth = 2; edge(g, my); g.stroke();
    // 큰 가지 산호 (분홍·주황)
    [[220, 92, 13, '#e07aa8', '#a84a80', '#ffc0dc'], [905, 74, 11, '#e89a5a', '#a86030', '#ffd8a0'], [560, 58, 9, '#e07aa8', '#a84a80', '#ffc0dc']].forEach(([x, len, w, c1, c2, tip]) => {
      const segs = makeBranch(0, 0, -Math.PI / 2 + rr(-0.1, 0.1), len * 0.55, w, 3, 0.62), y = my(x) + 8;
      place(g, x, 110, g => { g.translate(0, y); drawBranch(g, segs, c1, c2, tip); });
    });
    // 부채 산호 (보라 그물 부채)
    [[470, 1], [80, 0.75]].forEach(([x, s]) => {
      const y = my(x) + 6, ph = rr(0, TAU);
      place(g, x, 80, g => { g.translate(0, y); seaFan(g, s, ph, '#c070d0', 'rgba(120,50,150,0.55)', 'rgba(205,125,225,0.5)'); });
    });
    // 뇌 산호, 관 해면
    [[380, 30], [720, 24], [130, 20]].forEach(([x, r]) => { const y = my(x) + 8; place(g, x, 50, g => { g.translate(0, y); brain(g, r, '#f0c070', '#c08a40', 'rgba(130,80,30,0.4)'); }); });
    [[760, [[-14, 40, 12], [0, 58, 14], [14, 34, 11], [26, 22, 9]]], [290, [[-8, 30, 10], [6, 44, 12], [18, 24, 9]]]].forEach(([x, list]) => {
      const y = my(x) + 6; place(g, x, 50, g => { g.translate(0, y); tubes(g, list, '#9a8ae8', '#5a4aa8', 'rgba(40,20,80,0.55)'); });
    });
    // 물 안개
    g.fillStyle = vgrad(g, 260, 380, [[0, 'rgba(110,200,225,0)'], [0.6, 'rgba(110,200,225,0.32)'], [1, 'rgba(110,200,225,0.1)']]);
    g.fillRect(0, 260, W, 120);
  });

  // ════════ 가까운 바위·말미잘·대왕조개 ════════
  const near = canvas(W, H, g => {
    K.setSeed(5104);
    const hy = x => 384 + wave(x, [[2, 10, 0.3], [5, 6, 1.4], [9, 3, 0.2]]);
    // 커다란 다시마 두 줄기 (화면 위로 뻗음)
    [[150, 420], [530, 400]].forEach(([x, h]) => { const k = makeKelp(h, 10), y = hy(x) + 6; place(g, x, 60, g => drawKelp(g, k, y, '#2f7a52', '#3f9460', 7)); });
    // 대왕조개는 바위 뒤에서 솟아 있다
    giantClam(g, 700, hy(700) + 4);
    ridge(g, hy, vgrad(g, 360, 440, [[0, '#56609a'], [1, '#3a4474']]));
    g.strokeStyle = 'rgba(170,220,240,0.55)'; g.lineWidth = 3; edge(g, hy); g.stroke();
    // 바위 덩어리
    const rockAt = [[60, 46, 30], [270, 60, 38], [430, 40, 26], [880, 54, 34]].map(([x, w, h]) => ({ x, w, h, bumps: [rr(-0.3, 0.3), rr(0.6, 0.9), rr(-0.2, 0.2)] }));
    rockAt.forEach(({ x, w, h, bumps }) => {
      const y = hy(x) + 6;
      place(g, x, w + 10, g => {
        g.fillStyle = vgrad(g, y - h - 10, y, [[0, '#7a86b8'], [1, '#4a5486']]);
        g.beginPath(); g.ellipse(0, y, w, h, 0, Math.PI, TAU); g.closePath(); g.fill();
        g.beginPath(); g.ellipse(-w * 0.45 + bumps[0] * 10, y - h * 0.5, w * 0.5, h * bumps[1], 0, Math.PI, TAU); g.closePath(); g.fill();
        g.fillStyle = 'rgba(190,230,250,0.35)'; g.beginPath(); g.ellipse(-w * 0.25, y - h * 0.82, w * 0.4, 4, bumps[2], 0, TAU); g.fill();
      });
    });
    // 말미잘
    [[60, 22, '#ff8ab0', '#d05a88', '#ffe0ec'], [270, 26, '#ffa860', '#d07030', '#fff0c0'], [460, 18, '#c890ff', '#8a5ad0', '#f0e0ff'], [880, 24, '#ff8ab0', '#d05a88', '#ffe0ec'], [330, 16, '#7ae0c8', '#3aa08a', '#e0fff4']].forEach(([x, r, c1, c2, tip]) => {
      const rk = rockAt.find(o => Math.abs(o.x - x) < 5), y = rk ? hy(x) + 6 - rk.h * 0.95 : hy(x) + 2;
      const tents = makeAnem(13, r);
      place(g, x, r + 10, g => { g.translate(0, y); drawAnem(g, tents, r, c1, c2, tip); });
    });
    // 성게, 불가사리, 진주 조개
    [[230, 0.9], [600, 1.1], [940, 0.8]].forEach(([x, s]) => {
      const y = hy(x) + 2, n = 14;
      place(g, x, 20, g => {
        g.strokeStyle = '#3a2050'; g.lineWidth = 1.6;
        for (let i = 0; i < n; i++) { const a = Math.PI + i * Math.PI / (n - 1); g.beginPath(); g.moveTo(0, y - 6 * s); g.lineTo(Math.cos(a) * 15 * s, y - 6 * s + Math.sin(a) * 15 * s); g.stroke(); }
        g.fillStyle = '#5a3070'; g.beginPath(); g.ellipse(0, y - 4 * s, 9 * s, 8 * s, 0, Math.PI, TAU); g.closePath(); g.fill();
        g.fillStyle = 'rgba(255,255,255,0.3)'; g.beginPath(); g.ellipse(-3 * s, y - 9 * s, 3 * s, 1.5 * s, -0.3, 0, TAU); g.fill();
      });
    });
    starfish(g, 300, hy(300) - 27, 11, 0.3, '#ff7a5a', '#ffd0a0', 0.8);   // 바위 위
    starfish(g, 410, hy(410) - 2, 9, -0.2, '#ffb040', '#fff0c0', 0.75);
    [[110, 1.1], [380, 0.9], [560, 1], [820, 1.2]].forEach(([x, s]) => pearlClam(g, x, hy(x) + 4, s, 'near'));
  });

  // ════════ 모래 바닥 (캐릭터와 같은 속도) ════════
  const ground = canvas(W, H, g => {
    K.setSeed(5105);
    const gy = x => GY - 4 + wave(x, [[4, 2, 0.6], [9, 1.5, 1.9]]);
    ridge(g, gy, vgrad(g, GY - 8, H, [[0, '#fbf2d8'], [0.18, '#efdeb6'], [0.6, '#dcc79c'], [1, '#c4ae86']]));
    g.save(); g.globalCompositeOperation = 'source-atop';
    g.fillStyle = vgrad(g, GY, H, [[0, 'rgba(60,170,210,0.06)'], [1, 'rgba(30,90,160,0.28)']]); g.fillRect(0, GY - 10, W, H);
    // 모래 위 물빛 그물
    g.lineWidth = 1.6;
    for (let i = 0; i < 46; i++) {
      const x = rr(0, W), y = rr(GY + 8, H - 10), rx = rr(16, 24), ry = rr(4, 7), ph = rr(0, TAU), a = (0.32 * (1 - (y - GY) / (H - GY) * 0.7)).toFixed(3);
      place(g, x, 30, g => { g.strokeStyle = `rgba(255,255,240,${a})`; caustic(g, 0, y, rx, ry, ph); g.stroke(); });
    }
    g.restore();
    g.strokeStyle = 'rgba(255,252,236,0.95)'; g.lineWidth = 2; edge(g, gy); g.stroke();
    // 모래 물결
    for (let i = 0; i < 26; i++) {
      const x = rr(0, W), y = rr(GY + 14, H - 8), w = rr(40, 90), dark = rnd() < 0.55;
      place(g, x, w / 2 + 4, g => {
        g.strokeStyle = dark ? 'rgba(170,140,90,0.35)' : 'rgba(255,250,230,0.6)'; g.lineWidth = 2;
        g.beginPath(); g.moveTo(-w / 2, y); g.quadraticCurveTo(0, y - 6, w / 2, y); g.stroke();
      });
    }
    // 바다풀 덤불 (가장자리)
    [[40, 5], [330, 4], [600, 6], [770, 4]].forEach(([x, n]) => {
      const blades = Array.from({ length: n }, () => [rr(-12, 12), rr(14, 30), rr(-8, 8)]), y = gy(x) + 4;
      place(g, x, 30, g => blades.forEach(([dx, h, lean]) => {
        g.fillStyle = '#4aa070'; g.beginPath(); g.moveTo(dx - 3, y); g.quadraticCurveTo(dx + lean * 0.3, y - h * 0.6, dx + lean, y - h); g.quadraticCurveTo(dx + 2 + lean * 0.3, y - h * 0.5, dx + 3, y); g.closePath(); g.fill();
      }));
    });
    // 조약돌
    for (let i = 0; i < 14; i++) {
      const x = rr(0, W), y = rr(GY + 20, H - 10), rx = rr(4, 8), ry = rr(2.5, 4.5);
      place(g, x, 12, g => {
        g.fillStyle = '#b8a890'; g.beginPath(); g.ellipse(0, y, rx, ry, 0, 0, TAU); g.fill();
        g.fillStyle = '#e0d4c0'; g.beginPath(); g.ellipse(-1.5, y - 1.5, rx * 0.4, ry * 0.4, 0, 0, TAU); g.fill();
      });
    }
    // 조개껍데기
    const shellCols = [['#ffc8c8', '#d88a90'], ['#fff0e0', '#d0b090'], ['#ffd8a8', '#d09060'], ['#e8d0ff', '#a888c8']];
    for (let i = 0; i < 16; i++) {
      const x = rr(0, W), y = rr(GY + 16, H - 8), [c1, c2] = shellCols[Math.floor(rnd() * 4)], s = rr(0.7, 1.2), kind = rnd() < 0.6, rot = rr(-0.6, 0.6);
      place(g, x, 16, g => kind ? scallop(g, 0, y, s, c1, c2) : conch(g, 0, y, s, rot, c1, c2));
    }
    // 불가사리
    [[250, GY + 50, 12, 0.4, '#ff7a5a', '#ffd8b0'], [690, GY + 96, 14, -0.3, '#ff9a4a', '#fff0c0'], [930, GY + 30, 9, 0.9, '#ff6a8a', '#ffd0e0'], [430, GY + 104, 10, 0.1, '#ffb040', '#fff0c0']].forEach(([x, y, r, rot, c1, c2]) => place(g, x, 20, g => starfish(g, 0, y, r, rot, c1, c2, 0.62)));
    // 모래에 떨어진 진주
    [[90, GY + 84], [560, GY + 66], [880, GY + 110]].forEach(([x, y]) => { pearl(g, x, y, 3.2); K.light(x, y, 'ground', '230,250,255', 4); });
    // 땅에 박힌 별조각
    [[170, GY + 60], [520, GY + 38], [820, GY + 84]].forEach(([x, y]) => K.drawShard(g, x, y));
  });

  // ── 떠오르는 물방울 ──
  const moteMake = anywhere => {
    const r = 1.4 + Math.random() * 3.6;
    return { x: Math.random() * W, y: anywhere ? Math.random() * H : H + 8 + Math.random() * 60, r, vy: -(16 + r * 9 + Math.random() * 12), ph: Math.random() * TAU, sw: 2 + Math.random() * 5 };
  };
  const moteDraw = (ctx, p, dt) => {
    p.y += p.vy * dt; p.ph += dt * (1.6 + p.r * 0.2);
    if (p.y < -12) return false;
    const x = p.x + Math.sin(p.ph) * p.sw;
    ctx.fillStyle = 'rgba(210,245,255,0.18)';
    ctx.beginPath(); ctx.arc(x, p.y, p.r, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(232,252,255,0.75)'; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath(); ctx.arc(x - p.r * 0.35, p.y - p.r * 0.35, Math.max(0.6, p.r * 0.28), 0, TAU); ctx.fill();
  };

  return { sky, far, mid, near, ground, fall: null, clouds: false, mote: 'custom', rayX: 760, rayDir: -1, rayRgb: '200,255,245',
    front: ['rgba(18,92,92,0.92)', 'rgba(28,118,104,0.92)'], moteCount: 30, moteMake, moteDraw };
});

// 챕터 6 불꽃 화산 — 배경
Scenery.addTheme('volcano', (K, cur) => {
  const { W, H, GY, TAU } = K;
  const edge = (g, f) => { g.beginPath(); for (let x = 0; x <= W; x += 3) x ? g.lineTo(x, f(x)) : g.moveTo(x, f(x)); };
  // 같은 색으로 옅어지는 빛 (K.glow는 흰빛으로 번지므로 용암빛은 이걸 씀)
  function hot(g, x, y, r, rgb, a) {
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, `rgba(${rgb},${a})`); gr.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // 빛나는 용암 금: 넓은 빛 → 주황 → 밝은 심 (dx만큼 옮겨 그림)
  function lava(g, pts, w, dx = 0) {
    g.lineCap = 'round'; g.lineJoin = 'round';
    [[w * 3.4, 'rgba(255,90,30,0.22)'], [w * 1.7, 'rgba(255,130,40,0.85)'], [w * 0.6, '#ffe08a']].forEach(([lw, c]) => {
      g.strokeStyle = c; g.lineWidth = lw; g.beginPath();
      pts.forEach(([x, y], i) => i ? g.lineTo(x + dx, y) : g.moveTo(x + dx, y));
      g.stroke();
    });
  }
  // 지그재그 금 하나 (점 목록)
  function crackPts(x, y, n, step, dir) {
    const pts = [[x, y]];
    for (let i = 0; i < n; i++) { x += step * dir + K.rr(-4, 4); y += K.rr(-7, 7); pts.push([x, y]); }
    return pts;
  }
  // 화산재 구름 (아래쪽이 용암빛으로 물듦)
  function ash(g, x, y, s) {
    const puffs = [];
    for (let i = 0; i < 8; i++) { const u = i / 7; puffs.push([x + (u - 0.5) * 170 * s + K.rr(-12, 12) * s, y - Math.sin(u * Math.PI) * 14 * s + K.rr(-5, 5) * s, K.rr(16, 28) * s * (0.6 + 0.4 * Math.sin(u * Math.PI))]); }
    const el = (px, py, r, c) => { g.fillStyle = c; g.beginPath(); g.ellipse(px, py, r * 1.45, r, 0, 0, TAU); g.fill(); };
    puffs.forEach(([px, py, r]) => el(px, py + r * 0.35, r, 'rgba(255,120,70,0.18)'));
    puffs.forEach(([px, py, r]) => el(px, py, r, 'rgba(46,20,32,0.55)'));
    puffs.forEach(([px, py, r]) => el(px - r * 0.25, py - r * 0.35, r * 0.5, 'rgba(96,52,66,0.3)'));
  }

  // ── 하늘: 검붉은 하늘, 화산재, 붉게 물든 금 간 별 ──
  const sky = K.canvas(W, H, g => {
    K.setSeed(601);
    g.fillStyle = K.vgrad(g, 0, GY, [[0, '#1c0a16'], [0.3, '#3c1024'], [0.58, '#7e2428'], [0.8, '#c8502a'], [1, '#f08a3e']]);
    g.fillRect(0, 0, W, H);
    hot(g, 470, 340, 440, '255,120,50', 0.35);
    for (let i = 0; i < 40; i++) K.blob(g, K.rr(0, W), K.rr(0, 180), K.rr(0.6, 1.4), `rgba(255,190,150,${K.rr(0.2, 0.6).toFixed(2)})`);
    const st = K.canvas(300, 300, s => {
      K.drawCrackedStar(s, 140, 140);
      s.globalCompositeOperation = 'source-atop';
      s.fillStyle = 'rgba(255,90,60,0.4)'; s.fillRect(0, 0, 300, 300);
    });
    hot(g, 230, 92, 150, '255,80,60', 0.3);
    g.save(); g.translate(230 - 140 * 0.8, 92 - 140 * 0.8); g.scale(0.8, 0.8); g.drawImage(st, 0, 0); g.restore();
    [[90, 168, 1.0], [330, 58, 0.9], [770, 118, 1.2], [930, 40, 0.75], [300, 218, 0.75], [700, 240, 0.6]].forEach(([x, y, s]) => ash(g, x, y, s));
  });

  // ── 먼 곳: 연기를 뿜는 화산 ──
  const VX = 470;
  const far = K.canvas(W, H, g => {
    K.setSeed(602);
    K.ridge(g, x => 292 + K.wave(x, [[2, 22, 0.8], [5, 10, 2.0], [11, 4, 0.4]]), K.vgrad(g, 240, 380, [[0, '#7a3440'], [1, '#a04a46']]));
    // 연기 기둥 (분화구에서 오른쪽 위로 번짐): 한 덩어리 실루엣 → 윗면 빛·아래 용암빛 → 위로 갈수록 옅게
    const plume = K.canvas(W, H, p => {
      const puffs = [];
      for (let i = 0; i <= 24; i++) {
        const t = i / 24, cx = VX + t * t * 150, cy = 142 - t * 210, spread = 6 + t * 80;
        for (let k = 0; k < 4; k++) puffs.push([cx + K.rr(-spread, spread) * 0.7, cy + K.rr(-10, 10), 12 + t * 42 + K.rr(-4, 5)]);
      }
      puffs.forEach(([x, y, r]) => K.blob(p, x, y, r, '#3e1e2a'));
      p.globalCompositeOperation = 'source-atop';
      puffs.forEach(([x, y, r], i) => { if (i % 2) K.blob(p, x - r * 0.3, y - r * 0.38, r * 0.55, 'rgba(120,70,84,0.55)'); });
      hot(p, VX, 150, 150, '255,130,60', 0.75);
      p.globalCompositeOperation = 'destination-in';
      p.fillStyle = K.vgrad(p, -70, 150, [[0, 'rgba(0,0,0,0.25)'], [1, 'rgba(0,0,0,0.95)']]);
      p.fillRect(0, 0, W, H);
    });
    g.drawImage(plume, 0, 0);
    hot(g, VX, 140, 130, '255,150,70', 0.55);
    // 화산 몸통
    g.fillStyle = K.vgrad(g, 140, 380, [[0, '#5a2232'], [1, '#8a3a40']]);
    g.beginPath();
    g.moveTo(VX - 320, 380); g.quadraticCurveTo(VX - 110, 330, VX - 62, 152);
    g.lineTo(VX - 34, 141); g.lineTo(VX - 6, 147); g.lineTo(VX + 26, 139); g.lineTo(VX + 62, 152);
    g.quadraticCurveTo(VX + 110, 330, VX + 320, 380);
    g.closePath(); g.fill();
    // 왼쪽 비탈은 빛을 받아 조금 밝게
    g.fillStyle = 'rgba(255,140,100,0.12)';
    g.beginPath(); g.moveTo(VX - 320, 380); g.quadraticCurveTo(VX - 110, 330, VX - 62, 152); g.lineTo(VX - 20, 150); g.quadraticCurveTo(VX - 60, 300, VX - 120, 380); g.closePath(); g.fill();
    // 분화구 빛과 흘러내리는 용암
    g.fillStyle = 'rgba(255,200,110,0.95)';
    g.beginPath(); g.ellipse(VX, 147, 46, 5, 0, 0, TAU); g.fill();
    lava(g, [[VX - 18, 148], [VX - 34, 190], [VX - 60, 236], [VX - 84, 290], [VX - 120, 352]], 2);
    lava(g, [[VX + 22, 146], [VX + 36, 200], [VX + 66, 258], [VX + 112, 330]], 1.8);
    lava(g, [[VX + 2, 150], [VX - 4, 186], [VX + 6, 222]], 1.4);
    // 튀어 오르는 용암 덩이
    [[VX - 30, 112, 3], [VX + 18, 100, 2.5], [VX + 46, 120, 2], [VX - 8, 84, 2], [VX + 64, 96, 1.6]].forEach(([x, y, r]) => {
      hot(g, x, y, r * 5, '255,170,80', 0.6); K.blob(g, x, y, r, '#ffd27a');
    });
    // 앞쪽 낮은 산줄기 + 아지랑이
    K.ridge(g, x => 334 + K.wave(x, [[3, 12, 2.4], [7, 5, 0.9]]), K.vgrad(g, 310, 380, [[0, '#8a3a42'], [1, '#a8524a']]));
    g.fillStyle = K.vgrad(g, 240, 380, [[0, 'rgba(255,140,90,0)'], [1, 'rgba(255,150,100,0.55)']]);
    g.fillRect(0, 240, W, 140);
  });

  // ── 중간: 현무암 기둥 절벽과 용암 폭포·강 ──
  const mid = K.canvas(W, H, g => {
    K.setSeed(603);
    const my = x => 340 + K.wave(x, [[3, 10, 0.6], [7, 4, 1.7]]);
    const falls = [];
    // 현무암 기둥 무리 (cx 가운데, n 개수, hMax 높이, fall 용암 폭포가 흐르는 기둥 번호)
    [[170, 13, 178, 4], [880, 9, 124, 3]].forEach(([cx, n, hMax, fall]) => {
      const w = 17, base = my(cx) + 20;
      for (let i = 0; i < n; i++) {
        const x = cx - n * w / 2 + i * w, u = i / (n - 1);
        const h = hMax * (0.45 + 0.55 * Math.sin(Math.PI * (0.15 + 0.75 * u))) + K.rr(-14, 10);
        g.fillStyle = K.vgrad(g, base - h, base, [[0, '#4a2a38'], [1, '#2a1822']]);
        g.fillRect(x, base - h, w, h);
        g.fillStyle = 'rgba(255,170,140,0.12)'; g.fillRect(x, base - h, 5, h);       // 왼쪽 면 빛
        g.fillStyle = 'rgba(20,8,14,0.35)'; g.fillRect(x + w - 4, base - h, 4, h);    // 오른쪽 그늘
        g.fillStyle = '#6e4450';                                                       // 윗면 (육각)
        g.beginPath(); g.moveTo(x, base - h); g.lineTo(x + 4, base - h - 4); g.lineTo(x + w - 4, base - h - 4); g.lineTo(x + w, base - h); g.lineTo(x + w - 4, base - h + 3); g.lineTo(x + 4, base - h + 3); g.closePath(); g.fill();
        if (i === fall) falls.push([x + w / 2, base - h + 2, base]);
      }
    });
    K.ridge(g, my, K.vgrad(g, 310, 400, [[0, '#4a2630'], [1, '#3a1e28']]));
    // 용암 폭포
    falls.forEach(([x, top, bot]) => {
      hot(g, x, (top + bot) / 2, 70, '255,120,40', 0.35);
      g.fillStyle = K.vgrad(g, top, bot, [[0, '#ffe08a'], [0.35, '#ffa040'], [1, '#ff5a1a']]);
      g.beginPath(); g.moveTo(x - 7, top); g.lineTo(x + 7, top); g.lineTo(x + 10, bot); g.lineTo(x - 10, bot); g.closePath(); g.fill();
      g.fillStyle = 'rgba(255,250,200,0.7)'; g.fillRect(x - 3, top, 2, bot - top); g.fillRect(x + 3, top + 10, 1.5, bot - top - 10);
      hot(g, x, bot, 40, '255,200,110', 0.7);
    });
    // 굽이치는 용암 강
    const ry = x => my(x) + 11 + K.wave(x, [[4, 4, 0.3], [9, 2, 1.2]]);
    const th = x => 3.4 + K.wave(x, [[5, 1.6, 0.8], [11, 0.9, 2.1]]);          // 강폭 (넓었다 좁았다)
    g.lineCap = 'round';
    g.strokeStyle = 'rgba(255,100,40,0.22)'; g.lineWidth = 22; edge(g, ry); g.stroke();
    g.fillStyle = '#ff8a2a';
    g.beginPath();
    for (let x = 0; x <= W; x += 3) x ? g.lineTo(x, ry(x) - th(x)) : g.moveTo(x, ry(x) - th(x));
    for (let x = W; x >= 0; x -= 3) g.lineTo(x, ry(x) + th(x));
    g.closePath(); g.fill();
    g.strokeStyle = '#ffc860'; g.lineWidth = 2.2; edge(g, x => ry(x) - th(x) * 0.25); g.stroke();
    g.strokeStyle = 'rgba(255,250,210,0.85)'; g.lineWidth = 1; edge(g, x => ry(x) - th(x) * 0.4); g.stroke();
    // 위쪽 윤곽 빛 + 아지랑이
    g.strokeStyle = 'rgba(255,140,90,0.35)'; g.lineWidth = 2; edge(g, my); g.stroke();
    g.fillStyle = K.vgrad(g, 280, 380, [[0, 'rgba(255,120,70,0)'], [0.6, 'rgba(255,120,70,0.2)'], [1, 'rgba(255,120,70,0)']]);
    g.fillRect(0, 280, W, 100);
  });

  // ── 가까운 곳: 검은 흑요석 바위와 빛나는 틈 ──
  function prism(g, x, baseY, w, h, lean) {     // 흑요석 기둥 하나
    const L = x - w / 2, R = x + w / 2, top = baseY - h;
    g.fillStyle = K.vgrad(g, top, baseY, [[0, '#4a3c66'], [0.5, '#221a30'], [1, '#140e1a']]);
    g.beginPath(); g.moveTo(L, baseY); g.lineTo(L + lean, top + w * 0.45); g.lineTo(x + lean, top); g.lineTo(R + lean, top + w * 0.45); g.lineTo(R, baseY); g.closePath(); g.fill();
    g.fillStyle = 'rgba(10,6,14,0.45)';                                              // 오른쪽 면 그늘
    g.beginPath(); g.moveTo(x + lean * 0.4, baseY); g.lineTo(x + lean, top); g.lineTo(R + lean, top + w * 0.45); g.lineTo(R, baseY); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(210,190,255,0.45)'; g.lineWidth = 1.5;                       // 유리 같은 모서리 빛
    g.beginPath(); g.moveTo(L + 2, baseY - 6); g.lineTo(L + lean + 2, top + w * 0.45); g.lineTo(x + lean, top + 2); g.stroke();
    g.fillStyle = K.vgrad(g, baseY - 50, baseY, [[0, 'rgba(255,110,40,0)'], [1, 'rgba(255,110,40,0.3)']]);  // 용암 반사
    g.fillRect(L - 2, baseY - 50, w + 4, 50);
  }
  function rock(g, x, y, w, h, cr) {             // 반짝이는 흑요석 바위
    g.fillStyle = K.vgrad(g, y - h, y, [[0, '#3c3050'], [1, '#150f1a']]);
    g.beginPath(); g.moveTo(x - w, y); g.lineTo(x - w * 0.8, y - h * 0.55); g.lineTo(x - w * 0.3, y - h); g.lineTo(x + w * 0.35, y - h * 0.85); g.lineTo(x + w * 0.85, y - h * 0.4); g.lineTo(x + w, y); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(200,180,255,0.4)'; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(x - w * 0.75, y - h * 0.5); g.lineTo(x - w * 0.3, y - h + 2); g.lineTo(x + w * 0.3, y - h * 0.84); g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.ellipse(x - w * 0.35, y - h * 0.72, w * 0.12, h * 0.06, -0.6, 0, TAU); g.fill();
    lava(g, cr.map(([a, b]) => [x + a * w, y - b * h]), 1.4);
    const lx = x + cr[1][0] * w;
    if (lx >= 0 && lx < W) K.light(lx, y - cr[1][1] * h, 'near', '255,170,80', 3.5);
  }
  const near = K.canvas(W, H, g => {
    K.setSeed(604);
    const hy = x => 382 + K.wave(x, [[2, 12, 1.4], [5, 6, 0.2], [9, 3, 2.2]]);
    // 큰 흑요석 결정 무리 (안에 별조각이 잠들어 있음)
    const cx = 800, cb = hy(800) + 12;
    K.wrap(cx, 170, X => hot(g, X, cb - 120, 170, '255,110,50', 0.28));
    [[-78, 44, 132, -10], [70, 40, 120, 12], [-38, 50, 172, -6], [34, 48, 156, 8], [0, 62, 214, 0], [-112, 30, 80, -14], [104, 28, 74, 14]]
      .sort((p, q) => p[2] - q[2]).forEach(([dx, w, h, lean]) => prism(g, cx + dx, cb, w, h, lean));
    K.glow(g, cx, cb - 150, 60, 'rgba(180,240,255,0.55)');
    g.fillStyle = '#e0f8ff';
    g.beginPath(); g.moveTo(cx - 7, cb - 136); g.lineTo(cx - 3, cb - 160); g.lineTo(cx + 3, cb - 168); g.lineTo(cx + 8, cb - 146); g.lineTo(cx + 5, cb - 134); g.closePath(); g.fill();
    K.light(cx, cb - 150, 'near', '180,240,255', 22, 0);
    K.ridge(g, hy, K.vgrad(g, 350, 440, [[0, '#30202a'], [1, '#1c1218']]));
    g.strokeStyle = 'rgba(255,130,70,0.55)'; g.lineWidth = 2.5; edge(g, hy); g.stroke();
    // 결정 밑동의 용암 웅덩이
    hot(g, cx, hy(cx) + 8, 90, '255,130,50', 0.45);
    g.fillStyle = K.vgrad(g, hy(cx), hy(cx) + 16, [[0, '#ffd070'], [1, '#ff6a1a']]);
    g.beginPath(); g.ellipse(cx, hy(cx) + 8, 92, 9, 0, 0, TAU); g.fill();
    // 흑요석 바위들
    [[60, 46, 50], [230, 34, 38], [390, 56, 62], [540, 30, 30], [650, 40, 44]].forEach(([x, w, h]) => {
      const cr = [[K.rr(-0.5, -0.2), K.rr(0.1, 0.3)], [K.rr(-0.1, 0.15), K.rr(0.35, 0.55)], [K.rr(0.25, 0.5), K.rr(0.55, 0.75)]];
      K.wrap(x, w + 10, xx => rock(g, xx, hy(x) + 8, w, h, cr));
    });
    // 뾰족한 흑요석 가시
    [[150, 9, 40], [166, 7, 26], [320, 8, 34], [470, 7, 28], [590, 8, 30], [930, 9, 42], [946, 6, 24]].forEach(([x, w, h]) => {
      const y = hy(x) + 6;
      g.fillStyle = K.vgrad(g, y - h, y, [[0, '#4a3c64'], [1, '#18111e']]);
      g.beginPath(); g.moveTo(x - w, y); g.lineTo(x + K.rr(-3, 3), y - h); g.lineTo(x + w, y); g.closePath(); g.fill();
    });
  });

  // ── 땅: 갈라진 검은 바위와 빛나는 용암 줄기 ──
  const ground = K.canvas(W, H, g => {
    K.setSeed(605);
    const gy = x => GY - 4 + K.wave(x, [[5, 2, 0.9], [13, 1.4, 0.3]]);
    K.ridge(g, gy, K.vgrad(g, GY - 8, H, [[0, '#6e4440'], [0.1, '#4c302e'], [0.55, '#352220'], [1, '#201416']]));
    g.strokeStyle = 'rgba(255,160,90,0.6)'; g.lineWidth = 2; edge(g, gy); g.stroke();
    // 굳은 용암 판 무늬
    for (let i = 0; i < 26; i++) {
      const x = K.rr(0, W), y = K.rr(GY + 16, H - 10), w = K.rr(26, 60), h = K.rr(6, 12), c = K.rnd() < 0.5 ? 'rgba(110,70,64,0.35)' : 'rgba(18,10,12,0.3)';
      K.wrap(x, w + 4, xx => { g.fillStyle = c; g.beginPath(); g.moveTo(xx - w, y); g.lineTo(xx - w * 0.5, y - h); g.lineTo(xx + w * 0.6, y - h * 0.8); g.lineTo(xx + w, y + 1); g.lineTo(xx + w * 0.3, y + h * 0.6); g.closePath(); g.fill(); });
    }
    // 빛나는 용암 줄기
    for (let i = 0; i < 7; i++) {
      const x = K.rr(0, W), y = K.rr(GY + 26, H - 24), dir = K.rnd() < 0.5 ? -1 : 1;
      const pts = crackPts(x, y, Math.floor(K.rr(5, 9)), K.rr(14, 22), dir);
      const branch = crackPts(...pts[2], 3, 12, -dir * 0.3);
      K.wrap(x, 200, xx => { lava(g, pts, 1.6, xx - x); lava(g, branch, 1.1, xx - x); });
      [pts[1], pts[4]].forEach(([lx, ly]) => K.light(((lx % W) + W) % W, ly, 'ground', '255,200,110', 3));
    }
    // 작은 용암 웅덩이
    [[330, GY + 104], [700, GY + 64]].forEach(([x, y]) => {
      hot(g, x, y, 60, '255,130,50', 0.5);
      g.fillStyle = '#2a1a1c'; g.beginPath(); g.ellipse(x, y, 40, 10, 0, 0, TAU); g.fill();
      g.fillStyle = K.vgrad(g, y - 7, y + 7, [[0, '#ffe08a'], [0.5, '#ff9a3a'], [1, '#e0501a']]);
      g.beginPath(); g.ellipse(x, y, 34, 7, 0, 0, TAU); g.fill();
      K.light(x - 12, y - 1, 'ground', '255,240,170', 2.5); K.light(x + 14, y + 1, 'ground', '255,240,170', 2.5);
    });
    // 돌멩이
    for (let i = 0; i < 12; i++) {
      const x = K.rr(20, W - 20), y = K.rr(GY + 20, H - 10), rx = K.rr(5, 10), ry = K.rr(3, 6);
      g.fillStyle = '#1e1620'; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, TAU); g.fill();
      g.fillStyle = 'rgba(190,170,240,0.4)'; g.beginPath(); g.ellipse(x - rx * 0.3, y - ry * 0.4, rx * 0.35, ry * 0.3, 0, 0, TAU); g.fill();
    }
    [[170, GY + 66], [540, GY + 34], [830, GY + 94]].forEach(([x, y]) => K.drawShard(g, x, y));
  });

  return {
    sky, far, mid, near, ground, fall: null, clouds: false, mote: 'custom',
    rayX: 620, rayDir: -1, rayRgb: '255,150,90', front: ['rgba(34,20,24,0.92)', 'rgba(84,40,30,0.9)'],
    // 위로 떠오르는 불티 (가끔 회색 재가 내려옴)
    moteCount: 36,
    moteMake: anywhere => {
      const ash = Math.random() < 0.22;
      return { ash, x: Math.random() * W, y: anywhere ? Math.random() * H : ash ? -10 : H + Math.random() * 30,
        vx: ash ? -10 - Math.random() * 14 : -6 - Math.random() * 24, vy: ash ? 12 + Math.random() * 14 : -(30 + Math.random() * 50),
        r: ash ? 1.4 + Math.random() * 1.6 : 1 + Math.random() * 1.8, ph: Math.random() * TAU, hot: Math.random() };
    },
    moteDraw: (ctx, p, dt) => {
      p.ph += dt * 3;
      p.x += (p.vx + Math.sin(p.ph) * (p.ash ? 8 : 14)) * dt; p.y += p.vy * dt;
      if (p.y < -14 || p.x < -14 || p.x > W + 14 || (p.ash && p.y > H + 14)) return false;   // 불티는 화면 아래에서 올라오는 중일 수 있음
      if (p.ash) {
        ctx.fillStyle = 'rgba(70,58,62,0.55)';
        ctx.beginPath(); ctx.ellipse(p.x, p.y, p.r * 1.6, p.r, p.ph * 0.4, 0, TAU); ctx.fill();
        return true;
      }
      const a = Math.max(0, (0.55 + 0.45 * Math.sin(p.ph * 2.3)) * Math.min(1, p.y / 160));
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = `rgba(255,${110 + p.hot * 70 | 0},40,${(a * 0.3).toFixed(3)})`;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 3.5, 0, TAU); ctx.fill();
      ctx.fillStyle = `rgba(255,${200 + p.hot * 50 | 0},${120 + p.hot * 80 | 0},${a.toFixed(3)})`;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill();
      return true;
    },
  };
});

// 챕터 7 하늘 섬 — 배경
Scenery.addTheme('sky', (K, cur) => {
  const { W, H, GY, TAU, rnd, rr, wave, canvas, ridge, wrap, vgrad, glow, blob } = K;

  // 동그라미 여러 개를 한 번에 칠해 하나의 구름으로 합친다
  function puffs(g, list, fill) {
    g.beginPath();
    list.forEach(([x, y, r]) => { g.moveTo(x + r, y); g.arc(x, y, r, 0, TAU); });
    g.fillStyle = fill; g.fill();
  }
  // 가로로 끝없이 이어지는 구름 둑: 윗선 topAt(x)를 따라 뭉게뭉게, 아래는 꽉 채움
  function bank(g, topAt, step, r0, r1, fill, hi) {
    const list = [];
    for (let x = 0; x < W; x += step) {
      const r = rr(r0, r1), y = topAt(x) + r * 0.85;
      wrap(x, r1 + 4, X => list.push([X, y, r]));
    }
    puffs(g, list, fill);
    ridge(g, x => topAt(x) + r1 * 0.9, fill);
    list.forEach(([x, y, r]) => glow(g, x - r * 0.22, y - r * 0.32, r * 0.85, hi));
  }
  // 떠 있는 섬: 위는 풀밭, 아래는 거꾸로 선 바위 뿌리. f = { dx, len, w } 폭포
  function isle(g, x, y, w, c, f) {
    const h = Math.min(w * 0.8, 130);
    g.fillStyle = vgrad(g, y, y + h, [[0, c.rock], [1, c.rockD]]);
    g.beginPath();
    g.moveTo(x - w / 2, y);
    g.lineTo(x - w * 0.4, y + h * 0.3); g.lineTo(x - w * 0.25, y + h * 0.42); g.lineTo(x - w * 0.15, y + h * 0.8); g.lineTo(x - w * 0.03, y + h);
    g.lineTo(x + w * 0.08, y + h * 0.68); g.lineTo(x + w * 0.22, y + h * 0.55); g.lineTo(x + w * 0.38, y + h * 0.26); g.lineTo(x + w / 2, y);
    g.closePath(); g.fill();
    g.strokeStyle = c.line; g.lineWidth = Math.max(1, w / 70);
    g.beginPath();
    g.moveTo(x - w * 0.32, y + h * 0.1); g.lineTo(x - w * 0.14, y + h * 0.5);
    g.moveTo(x + w * 0.16, y + h * 0.08); g.lineTo(x + w * 0.05, y + h * 0.55);
    g.moveTo(x - w * 0.42, y + h * 0.16); g.lineTo(x + w * 0.4, y + h * 0.14);
    g.stroke();
    // 늘어진 풀과 풀밭 윗면
    g.fillStyle = c.grassD;
    for (let k = -2; k <= 2; k++) { g.beginPath(); g.ellipse(x + k * w * 0.19, y + w * 0.07 + 1, w * 0.08 + 1, w * 0.06 + 2, 0, 0, TAU); g.fill(); }
    g.fillStyle = c.grass; g.beginPath(); g.ellipse(x, y, w / 2 + 3, w * 0.09 + 2, 0, 0, TAU); g.fill();
    g.fillStyle = c.hi; g.beginPath(); g.ellipse(x - w * 0.08, y - w * 0.03, w * 0.3, w * 0.04 + 1, 0, 0, TAU); g.fill();
    if (w >= 80) [[-0.28, 0.13], [0.24, 0.1]].forEach(([dx, s]) => {          // 작은 나무
      const tx = x + dx * w, r = w * s;
      blob(g, tx, y - r * 0.7, r, c.tree); blob(g, tx - r * 0.3, y - r, r * 0.6, c.hi);
    });
    if (f) {                                                              // 허공으로 쏟아지는 폭포
      const fx = x + f.dx * w;
      g.fillStyle = vgrad(g, y, y + f.len, [[0, c.fall], [0.75, c.fall], [1, 'rgba(255,255,255,0)']]);
      g.fillRect(fx - f.w / 2, y - 1, f.w, f.len);
      g.fillStyle = 'rgba(255,255,255,0.55)';
      g.fillRect(fx - f.w * 0.3, y, Math.max(1, f.w * 0.15), f.len * 0.8);
      glow(g, fx, y + 2, f.w * 1.6, 'rgba(255,255,255,0.6)');
    }
  }
  // 하얀 대리석 기둥 (broken이면 위가 부서짐)
  function column(g, x, base, h, wd, c, broken) {
    const top = base - h;
    const gr = g.createLinearGradient(x - wd / 2, 0, x + wd / 2, 0);
    gr.addColorStop(0, c.hi); gr.addColorStop(0.55, c.mid); gr.addColorStop(1, c.shade);
    g.fillStyle = gr;
    g.beginPath(); g.moveTo(x - wd / 2, base);
    if (broken) { g.lineTo(x - wd / 2, top + 6); g.lineTo(x - wd * 0.2, top); g.lineTo(x, top + 8); g.lineTo(x + wd * 0.25, top + 2); g.lineTo(x + wd / 2, top + 10); }
    else { g.lineTo(x - wd / 2, top); g.lineTo(x + wd / 2, top); }
    g.lineTo(x + wd / 2, base); g.closePath(); g.fill();
    g.strokeStyle = c.flute; g.lineWidth = Math.max(1, wd / 12);
    for (let k = -1; k <= 1; k++) { g.beginPath(); g.moveTo(x + k * wd * 0.25, top + (broken ? 12 : 4)); g.lineTo(x + k * wd * 0.25, base - 4); g.stroke(); }
    g.fillStyle = c.gold; g.fillRect(x - wd / 2 - 3, base - 6, wd + 6, 6);
    if (!broken) {
      g.fillStyle = c.gold; g.fillRect(x - wd / 2 - 4, top - 4, wd + 8, 7);
      g.fillStyle = c.hi; g.fillRect(x - wd / 2 - 6, top - 10, wd + 12, 6);
    }
  }

  const FAR2 = { rock: '#c8cbe6', rockD: 'rgba(214,220,240,0)', line: 'rgba(150,150,195,0.25)', grass: '#c6e0cc', grassD: '#b4d2c0', hi: '#dcecdc', tree: '#b2d0be', fall: 'rgba(255,255,255,0.6)' };
  const FAR1 = { rock: '#aaaed8', rockD: 'rgba(196,204,236,0.1)', line: 'rgba(120,120,175,0.3)', grass: '#a6d4a8', grassD: '#90c09a', hi: '#c6e8c0', tree: '#86c096', fall: 'rgba(255,255,255,0.88)' };
  const MID = { rock: '#9890c6', rockD: 'rgba(170,176,222,0.35)', line: 'rgba(80,70,140,0.3)', grass: '#86c47a', grassD: '#6aaa6c', hi: '#b0e098', tree: '#62aa66', fall: 'rgba(236,250,255,0.95)' };
  const MARBLE_MID = { hi: '#fbf9ff', mid: '#e8e4f4', shade: '#b8b2d6', flute: 'rgba(150,140,190,0.35)', gold: '#e6cf96' };
  const MARBLE_NEAR = { hi: '#ffffff', mid: '#f2eff8', shade: '#c2bcdc', flute: 'rgba(150,140,190,0.4)', gold: '#f0cc74' };

  // ── 하늘: 높은 곳의 짙은 파랑 → 지평선의 연한 금빛, 바로 가까이 보이는 금 간 별 ──
  const sky = canvas(W, H, g => {
    g.fillStyle = vgrad(g, 0, GY, [[0, '#1a48aa'], [0.3, '#3a80dc'], [0.58, '#86c2f0'], [0.8, '#d6ecf4'], [0.92, '#fbeec8'], [1, '#ffe0a4']]);
    g.fillRect(0, 0, W, H);
    K.setSeed(701);
    g.strokeStyle = 'rgba(255,255,255,0.2)'; g.lineCap = 'round';
    for (let i = 0; i < 10; i++) {                                         // 높은 하늘의 새털구름
      const x = rr(-60, W), y = rr(36, 230), w = rr(90, 220);
      g.lineWidth = rr(3, 8); g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + w / 2, y - rr(6, 18), x + w, y + rr(-5, 5)); g.stroke();
    }
    glow(g, 780, 118, 330, 'rgba(255,246,214,0.5)');                     // 해
    glow(g, 780, 118, 110, 'rgba(255,252,236,0.95)');
    blob(g, 780, 118, 40, '#fffcf0');
    g.save(); g.translate(250, 118); g.scale(1.45, 1.45); K.drawCrackedStar(g, 0, 0); g.restore();
    g.fillStyle = vgrad(g, 250, GY, [[0, 'rgba(255,240,200,0)'], [1, 'rgba(255,236,190,0.45)']]);
    g.fillRect(0, 250, W, GY - 250);
  });

  // ── 먼 곳: 폭포를 쏟는 떠 있는 섬들과 구름 바다 (흐릿하게) ──
  const far = canvas(W, H, g => {
    K.setSeed(702);
    [[60, 236, 44], [300, 206, 34], [520, 262, 56], [722, 218, 30], [900, 250, 40]].forEach(([x, y, w]) => wrap(x, w, X => isle(g, X, y, w, FAR2)));
    g.globalCompositeOperation = 'source-atop';                           // 가장 먼 섬만 더 흐리게
    g.fillStyle = 'rgba(226,234,250,0.45)'; g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'source-over';
    [[150, 180, 120, 0.3, 170], [430, 146, 78, -0.32, 130], [650, 206, 150, 0.33, 150], [870, 160, 96, 0.3, 160]].forEach(([x, y, w, dx, len]) =>
      wrap(x, w, X => isle(g, X, y, w, FAR1, { dx, len, w: Math.max(4, w * 0.06) })));
    g.globalCompositeOperation = 'source-atop';                           // 공기 원근 (아래로 갈수록 뿌옇게)
    g.fillStyle = vgrad(g, 120, 340, [[0, 'rgba(236,240,250,0.15)'], [1, 'rgba(250,244,232,0.6)']]);
    g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'source-over';
    bank(g, x => 318 + wave(x, [[3, 9, 0.4], [7, 5, 1.6]]), 20, 12, 24,
      vgrad(g, 300, 420, [[0, '#fdf8ee'], [1, '#f0e2c6']]), 'rgba(255,255,255,0.55)');
  });

  // ── 중간: 큰 뭉게구름 둑과 하늘 신전 폐허 (폭포는 움직이는 물줄기) ──
  const IX = 690, IY = 200, IW = 240, FALL = Math.round(IX - 0.42 * IW);
  const mid = canvas(W, H, g => {
    K.setSeed(703);
    // 뒤쪽 솟은 뭉게구름
    const tower = (x, y, s) => {
      const P = [[-70, 10, 34], [-38, -16, 40], [0, -38, 50], [38, -12, 40], [72, 12, 30], [-10, 16, 44], [30, 18, 36]];
      puffs(g, P.map(([dx, dy, r]) => [x + dx * s, y + dy * s, r * s]), vgrad(g, y - 90 * s, y + 50 * s, [[0, '#ffffff'], [0.6, '#e6ebf8'], [1, '#c8d1ee']]));
      P.slice(0, 5).forEach(([dx, dy, r]) => blob(g, x + (dx - r * 0.25) * s, y + (dy - r * 0.32) * s, r * 0.55 * s, 'rgba(255,255,255,0.7)'));
    };
    tower(380, 300, 1.1); wrap(60, 120, X => tower(X, 318, 0.85));
    // 왼쪽 작은 폐허 섬
    isle(g, 180, 252, 120, MID);
    column(g, 160, 250, 46, 14, MARBLE_MID, true); column(g, 202, 250, 30, 14, MARBLE_MID, true);
    g.fillStyle = '#d8d4ea'; g.save(); g.translate(180, 246); g.rotate(0.12); g.fillRect(-8, -5, 22, 7); g.restore();
    // 신전 섬
    isle(g, IX, IY, IW, MID, { dx: -0.42, len: 150, w: 22 });
    g.fillStyle = '#ece8f6'; g.fillRect(IX - 80, IY - 12, 168, 10);       // 계단 바닥
    g.fillStyle = '#d4cee6'; g.fillRect(IX - 66, IY - 20, 140, 8);
    [[-48, 106, false], [-16, 106, false], [16, 106, false], [48, 60, true]].forEach(([dx, h, b]) => column(g, IX + dx, IY - 20, h, 18, MARBLE_MID, b));
    // 무너진 지붕돌과 삼각 박공
    g.fillStyle = '#f2eef8'; g.fillRect(IX - 62, IY - 146, 98, 12);
    g.fillStyle = '#e6cf96'; g.fillRect(IX - 62, IY - 136, 98, 3);
    g.fillStyle = '#ece8f6';
    g.beginPath(); g.moveTo(IX - 66, IY - 146); g.lineTo(IX - 10, IY - 178); g.lineTo(IX + 8, IY - 168); g.lineTo(IX + 2, IY - 160); g.lineTo(IX + 22, IY - 150); g.lineTo(IX + 36, IY - 146); g.closePath(); g.fill();
    g.fillStyle = 'rgba(160,150,200,0.35)';
    g.beginPath(); g.moveTo(IX - 50, IY - 148); g.lineTo(IX - 10, IY - 170); g.lineTo(IX - 4, IY - 165); g.lineTo(IX - 40, IY - 148); g.closePath(); g.fill();
    // 기둥 사이 금빛 해 문양과 하늘색 깃발
    glow(g, IX, IY - 78, 34, 'rgba(255,236,170,0.75)');
    g.strokeStyle = '#e8c870'; g.lineWidth = 3; g.beginPath(); g.arc(IX, IY - 78, 12, 0, TAU); g.stroke();
    blob(g, IX, IY - 78, 6, '#fff3c4');
    [[-32, 30], [0, 24]].forEach(([dx, len]) => {
      g.fillStyle = '#7cb6ee';
      g.beginPath(); g.moveTo(IX + dx - 7, IY - 134); g.lineTo(IX + dx + 7, IY - 134); g.lineTo(IX + dx + 7, IY - 134 + len); g.lineTo(IX + dx, IY - 140 + len); g.lineTo(IX + dx - 7, IY - 134 + len); g.closePath(); g.fill();
      g.fillStyle = '#f4dc94'; g.fillRect(IX + dx - 7, IY - 134, 14, 3);
    });
    // 폭포 끝의 물안개와 앞의 구름 둑
    bank(g, x => 318 + wave(x, [[2, 14, 0.9], [5, 8, 2.3], [9, 3, 0.4]]), 26, 20, 38,
      vgrad(g, 290, 400, [[0, '#f8faff'], [0.45, '#dfe5f6'], [1, '#bcc6e8']]), 'rgba(255,255,255,0.6)');
    glow(g, FALL, 336, 46, 'rgba(255,255,255,0.9)');
    g.fillStyle = vgrad(g, 360, 420, [[0, 'rgba(190,200,236,0)'], [1, 'rgba(190,200,236,0.4)']]);
    g.fillRect(0, 360, W, 60);
  });

  // ── 가까운 곳: 흰 기둥, 풍경(바람 종), 작은 떠 있는 바위, 구름 언덕 ──
  const near = canvas(W, H, g => {
    K.setSeed(704);
    const hy = x => 374 + wave(x, [[2, 10, 0.5], [5, 6, 1.7], [11, 2, 0.3]]);
    // 작은 떠 있는 바위
    [[300, 196, 40], [560, 128, 26], [44, 238, 30]].forEach(([x, y, w]) => wrap(x, w, X => {
      g.fillStyle = vgrad(g, y, y + w * 0.9, [[0, '#a29ac8'], [1, '#d0cce8']]);
      g.beginPath(); g.moveTo(X - w / 2, y); g.lineTo(X - w * 0.2, y + w * 0.6); g.lineTo(X + w * 0.05, y + w * 0.9); g.lineTo(X + w * 0.3, y + w * 0.4); g.lineTo(X + w / 2, y); g.closePath(); g.fill();
      g.fillStyle = '#8ccc7c'; g.beginPath(); g.ellipse(X, y, w / 2 + 2, w * 0.12 + 2, 0, 0, TAU); g.fill();
      g.fillStyle = '#b8e6a0'; g.beginPath(); g.ellipse(X - w * 0.1, y - w * 0.04, w * 0.28, w * 0.06 + 1, 0, 0, TAU); g.fill();
      g.fillStyle = '#f0d890'; [-0.25, 0.05, 0.3].forEach(d => g.fillRect(X + d * w, y - 6, 2, 6));
    }));
    [[300, 196 + 40], [560, 128 + 26], [44, 238 + 30]].forEach(([x, y]) => K.light(x, y + 6, 'near', '200,240,255', 2.5));
    // 흰 기둥들
    column(g, 120, hy(120) + 10, 168, 30, MARBLE_NEAR, false);
    column(g, 452, hy(452) + 10, 104, 30, MARBLE_NEAR, true);
    // 풍경을 매단 문 (두 기둥 + 들보)
    const gx0 = 760, gx1 = 892, gb = Math.min(hy(gx0), hy(gx1)) + 10, gt = gb - 178;
    column(g, gx0, gb, 178, 26, MARBLE_NEAR, false); column(g, gx1, gb, 178, 26, MARBLE_NEAR, false);
    g.fillStyle = vgrad(g, gt - 30, gt - 10, [[0, '#ffffff'], [1, '#d8d2ea']]); g.fillRect(gx0 - 26, gt - 30, gx1 - gx0 + 52, 20);
    g.fillStyle = '#f0cc74'; g.fillRect(gx0 - 26, gt - 12, gx1 - gx0 + 52, 4);
    [[786, 44], [812, 70], [838, 52], [864, 34]].forEach(([x, len]) => {
      const y0 = gt - 8, y1 = y0 + len;
      g.strokeStyle = 'rgba(120,110,150,0.8)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(x, y0); g.lineTo(x, y1); g.stroke();
      g.fillStyle = '#f2c860'; g.beginPath(); g.ellipse(x, y1 - 14, 8, 3, 0, Math.PI, TAU); g.fill();
      [-5, 0, 5].forEach((d, k) => { g.fillStyle = k === 1 ? '#fff0b8' : '#e8c26a'; g.fillRect(x + d - 1.5, y1 - 14, 3, 10 + k * 3); });
      g.fillStyle = '#ffffff';
      g.beginPath(); g.moveTo(x, y1 + 4); g.lineTo(x + 3, y1 + 8); g.lineTo(x, y1 + 12); g.lineTo(x - 3, y1 + 8); g.closePath(); g.fill();
      g.fillStyle = 'rgba(160,210,255,0.85)';                                  // 바람에 날리는 종이 꼬리
      g.beginPath(); g.moveTo(x, y1 + 12); g.quadraticCurveTo(x - 8, y1 + 22, x - 14, y1 + 30); g.lineTo(x - 9, y1 + 31); g.quadraticCurveTo(x - 4, y1 + 22, x + 2, y1 + 13); g.closePath(); g.fill();
      K.light(x, y1 + 8, 'near', '255,244,200', 3.5);
    });
    // 구름 언덕
    bank(g, hy, 18, 14, 26, vgrad(g, 345, 425, [[0, '#ffffff'], [0.45, '#e9edf9'], [1, '#bfc8ea']]), 'rgba(255,255,255,0.85)');
    // 연한 금빛 풀
    for (let i = 0; i < 18; i++) {
      const x = rr(0, W), y = hy(x) + rr(8, 20), n = 4 + Math.floor(rnd() * 3), hh = rr(10, 18);
      wrap(x, 20, X => {
        for (let k = 0; k < n; k++) {
          const lean = (k - (n - 1) / 2) * 3;
          g.fillStyle = k % 2 ? '#e8c874' : '#f6e2a0';
          g.beginPath(); g.moveTo(X + lean * 0.4 - 1.5, y); g.quadraticCurveTo(X + lean * 0.7, y - hh * 0.6, X + lean * 1.3, y - hh + Math.abs(lean)); g.lineTo(X + lean * 0.4 + 1.5, y); g.closePath(); g.fill();
        }
      });
    }
  });

  // ── 땅: 폭신한 구름 길, 연한 금빛 풀, 별조각 ──
  const ground = canvas(W, H, g => {
    K.setSeed(705);
    const gy = x => GY - 4 + wave(x, [[5, 2, 0.3], [12, 1.5, 1.1]]);
    ridge(g, gy, vgrad(g, GY - 10, H, [[0, '#fdfdff'], [0.22, '#eef1fb'], [0.6, '#d8def3'], [1, '#b6c0e4']]));
    // 뭉게 가장자리
    for (let x = 0; x < W; x += 13) {
      const r = rr(6, 15), y = gy(x) + r * 0.75 + rr(-1, 2);
      wrap(x, 18, X => { blob(g, X, y + 3, r, 'rgba(200,210,240,0.7)'); blob(g, X, y, r, '#ffffff'); });
    }
    g.fillStyle = 'rgba(255,255,255,0.45)';                                // 엷은 구름 결
    for (let i = 0; i < 12; i++) {
      const x = rr(0, W), y = rr(GY + 30, H - 8), w = rr(40, 100);
      wrap(x, w, X => { g.beginPath(); g.ellipse(X, y, w, rr(1.5, 3), 0, 0, TAU); g.fill(); });
    }
    // 구름 결 (그늘 → 빛)
    // 구름 바닥 위의 작은 뭉게 더미 (아래쪽일수록 크고 그늘 진함)
    const drifts = [];
    for (let i = 0; i < 16; i++) { const y = rr(GY + 26, H - 6), k = (y - GY) / (H - GY); drifts.push([rr(0, W), y, 6 + 12 * k, k]); }
    drifts.sort((a, b) => a[1] - b[1]);
    drifts.forEach(([x, y, r, k]) => wrap(x, r * 2.4, X => {
      g.fillStyle = `rgba(140,154,212,${0.18 + 0.2 * k})`;
      g.beginPath(); g.ellipse(X + r * 0.1, y + r * 0.42, r * 2.1, r * 0.4, 0, 0, TAU); g.fill();
      puffs(g, [[X - r * 1.15, y, r * 0.55], [X - r * 0.4, y - r * 0.32, r * 0.78], [X + r * 0.5, y - r * 0.18, r * 0.68], [X + r * 1.2, y + r * 0.04, r * 0.48]],
        vgrad(g, y - r * 1.1, y + r * 0.55, [[0, '#ffffff'], [1, '#dde3f6']]));
      glow(g, X - r * 0.5, y - r * 0.55, r * 0.75, 'rgba(255,255,255,0.85)');
    }));
    // 작은 금빛 꽃
    for (let i = 0; i < 12; i++) {
      const x = rr(10, W - 10), y = rr(GY + 16, H - 10), s = rr(2.2, 3.4);
      for (let k = 0; k < 5; k++) { const a = k * TAU / 5 - Math.PI / 2; blob(g, x + Math.cos(a) * s, y + Math.sin(a) * s, s * 0.75, '#fff7dc'); }
      blob(g, x, y, s * 0.55, '#f0b840');
    }
    // 연한 금빛 풀 덤불
    for (let i = 0; i < 30; i++) {
      const edge = i < 10, x = rr(0, W), y = edge ? gy(x) + 4 : rr(GY + 14, H - 6), n = 5 + Math.floor(rnd() * 3), hh = rr(9, 17);
      const tip = [];
      wrap(x, 20, X => {
        for (let k = 0; k < n; k++) {
          const lean = (k - (n - 1) / 2) * 2.6;
          g.fillStyle = ['#f4d684', '#deb456', '#fff0b4'][k % 3];
          g.beginPath(); g.moveTo(X + lean * 0.4 - 1.6, y); g.quadraticCurveTo(X + lean * 0.7, y - hh * 0.6, X + lean * 1.3, y - hh + Math.abs(lean) * 0.8); g.lineTo(X + lean * 0.4 + 1.6, y); g.closePath(); g.fill();
        }
        g.fillStyle = 'rgba(255,255,255,0.85)'; g.beginPath(); g.ellipse(X, y + 1, 7, 2.6, 0, 0, TAU); g.fill();
        if (X === x) tip.push([X, y - hh]);
      });
      if (i % 4 === 0) tip.forEach(([tx, ty]) => K.light(tx, ty, 'ground', '255,236,170', 2.2));
    }
    [[170, GY + 64], [520, GY + 38], [830, GY + 86]].forEach(([x, y]) => {
      K.drawShard(g, x, y);
      g.fillStyle = '#e6eaf8'; g.beginPath(); g.ellipse(x, y + 2, 13, 4.5, 0, 0, TAU); g.fill();   // 구름에 반쯤 묻힘
      g.fillStyle = 'rgba(255,255,255,0.9)'; g.beginPath(); g.ellipse(x - 2, y + 0.5, 9, 2.4, 0, 0, TAU); g.fill();
    });
  });

  return {
    sky, far, mid, near, ground, fall: FALL, clouds: true, mote: 'custom', rayX: 760, rayDir: -1, rayRgb: '255,240,200',
    front: ['rgba(240,244,255,0.88)', 'rgba(236,206,124,0.9)'],
    moteCount: 26,
    // 깃털(f)과 작은 구름 조각(w)이 바람을 타고 왼쪽으로 흘러감
    moteMake: anywhere => rnd() < 0.6
      ? { t: 'f', x: anywhere ? rr(0, W) : W + rr(10, 80), y: anywhere ? rr(0, H) : rr(-20, H * 0.6), vx: rr(-70, -30), vy: rr(8, 24),
        rot: rr(0, TAU), vr: rr(-1.2, 1.2), sway: rr(0, TAU), s: rr(6, 10), c: rnd() < 0.75 ? '255,255,255' : '255,234,176' }
      : { t: 'w', x: anywhere ? rr(0, W) : W + rr(30, 120), y: rr(40, H - 50), vx: rr(-50, -22), r: rr(8, 18), a: rr(0.18, 0.4), ph: rr(0, TAU) },
    moteDraw: (ctx, p, dt) => {
      if (p.t === 'w') {
        p.x += p.vx * dt; p.ph += dt;
        const y = p.y + Math.sin(p.ph) * 4;
        ctx.fillStyle = `rgba(255,255,255,${p.a})`;
        ctx.beginPath();
        [[0, 0, 1.6, 0.55], [-0.5, -0.3, 0.7, 0.5], [0.5, -0.2, 0.8, 0.55]].forEach(([dx, dy, rx, ry]) => {
          const cx = p.x + dx * p.r, cy = y + dy * p.r;
          ctx.moveTo(cx + rx * p.r, cy); ctx.ellipse(cx, cy, rx * p.r, ry * p.r, 0, 0, TAU);
        });
        ctx.fill();
        return p.x > -p.r * 3;
      }
      p.sway += dt * 1.6; p.rot += p.vr * dt;
      p.x += p.vx * dt; p.y += (p.vy + Math.sin(p.sway) * 14) * dt;
      ctx.translate(p.x, p.y); ctx.rotate(p.rot + Math.sin(p.sway) * 0.5);
      const s = p.s;
      ctx.fillStyle = `rgba(${p.c},0.95)`; ctx.strokeStyle = 'rgba(170,182,228,0.6)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(-s, 0); ctx.quadraticCurveTo(-s * 0.1, -s * 0.6, s, -s * 0.05); ctx.quadraticCurveTo(0, s * 0.42, -s, 0);
      ctx.fill(); ctx.stroke();
      ctx.strokeStyle = 'rgba(206,190,160,0.75)';
      ctx.beginPath(); ctx.moveTo(-s * 1.35, s * 0.08); ctx.quadraticCurveTo(0, -s * 0.1, s * 0.85, -s * 0.06); ctx.stroke();
      return p.x > -20 && p.y < H + 20;
    },
  };
});

// 챕터 8 태엽 시계탑 — 배경
// 호박빛·청록 노을 하늘과 구름 속 거대한 시계, 먼 시계탑 실루엣, 놋쇠 톱니·증기 파이프, 리벳 박힌 철판 바닥
Scenery.addTheme('clock', (K, cur) => {
  const { W, H, GY, TAU } = K;

  // 톱니바퀴 경로 (배경용, 외곽선 없음)
  function cogPath(g, cx, cy, ro, n, rot = 0, depth = 0.18) {
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
  function cog(g, cx, cy, ro, n, fill, rot = 0, depth) { g.beginPath(); cogPath(g, cx, cy, ro, n, rot, depth); g.fillStyle = fill; g.fill(); }

  // 시계판: hh시 mm분
  function clockFace(g, x, y, r, face, rim, ink, hh, mm) {
    K.blob(g, x, y, r * 1.1, rim);
    K.blob(g, x, y, r, face);
    g.strokeStyle = ink; g.lineCap = 'round';
    for (let i = 0; i < 12; i++) {
      const a = i * TAU / 12, big = i % 3 === 0, r0 = r * (big ? 0.7 : 0.8);
      g.lineWidth = r * (big ? 0.07 : 0.035);
      g.beginPath(); g.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0); g.lineTo(x + Math.cos(a) * r * 0.9, y + Math.sin(a) * r * 0.9); g.stroke();
    }
    const ha = (hh + mm / 60) / 12 * TAU - TAU / 4, ma = mm / 60 * TAU - TAU / 4;
    g.lineWidth = r * 0.08; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(ha) * r * 0.48, y + Math.sin(ha) * r * 0.48); g.stroke();
    g.lineWidth = r * 0.05; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(ma) * r * 0.72, y + Math.sin(ma) * r * 0.72); g.stroke();
    K.blob(g, x, y, r * 0.07, ink);
  }

  // 놋쇠 리벳
  function rivet(g, x, y, r = 2.2) {
    K.blob(g, x + 0.6, y + 0.8, r * 1.15, 'rgba(40,26,18,0.5)');
    K.blob(g, x, y, r, '#c8a070');
    K.blob(g, x - 0.7, y - 0.7, r * 0.4, 'rgba(255,240,210,0.9)');
  }

  // ── 하늘 (움직이지 않음) ──
  const sky = K.canvas(W, H, g => {
    g.fillStyle = K.vgrad(g, 0, GY, [[0, '#103644'], [0.28, '#246a76'], [0.46, '#6a9a96'], [0.6, '#d4a888'], [0.78, '#f6b46c'], [1, '#ffe2a8']]);
    g.fillRect(0, 0, W, H);
    K.setSeed(801);
    for (let i = 0; i < 70; i++) {                       // 위쪽 작은 별
      const x = K.rr(0, W), y = K.rr(0, 170), r = K.rr(0.6, 1.6), a = K.rr(0.25, 0.85) * (1 - y / 210);
      g.fillStyle = `rgba(255,250,225,${a})`; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    }
    // 지평선의 노을 해
    K.glow(g, 600, 340, 320, 'rgba(255,196,120,0.5)');
    K.glow(g, 600, 340, 110, 'rgba(255,236,190,0.85)');
    K.blob(g, 600, 340, 44, '#fff2cc');
    // 구름 속 거대한 시계들 (반투명)
    [[170, 168, 112, 0.34, 10, 8], [822, 118, 78, 0.27, 4, 40], [585, 58, 36, 0.2, 12, 0]].forEach(([x, y, r, a, hh, mm]) => {
      g.save(); g.globalAlpha = a; clockFace(g, x, y, r, '#fff4dc', '#d8a860', '#6a4a30', hh, mm); g.restore();
    });
    // 구름 띠 (시계를 반쯤 가림): 불투명하게 따로 그린 뒤 반투명으로 얹어 겹친 자국이 없게
    const band = (y0, amp, r0, col, hi, shade, alpha) => {
      const puffs = [];
      for (let x = -40; x <= W + 40; x += 22) {
        const r = r0 * K.rr(0.6, 1.25);
        puffs.push([x + K.rr(-6, 6), y0 + K.wave(x, [[3, amp, 0.5], [7, amp * 0.4, 2]]) + K.rr(-6, 6), r]);
      }
      const c = K.canvas(W, H, b => {
        puffs.forEach(([x, y, r]) => K.blob(b, x, y, r, col));
        b.fillStyle = col; b.fillRect(0, y0 - 2, W, r0 * 0.7);
        puffs.forEach(([x, y, r]) => K.blob(b, x - r * 0.18, y - r * 0.32, r * 0.62, hi));
        b.globalCompositeOperation = 'source-atop';
        b.fillStyle = K.vgrad(b, y0 - r0, y0 + r0, [[0, 'rgba(255,255,255,0)'], [1, shade]]);
        b.fillRect(0, 0, W, H);
      });
      g.save(); g.globalAlpha = alpha; g.drawImage(c, 0, 0); g.restore();
    };
    band(150, 14, 26, '#a8c4c8', '#e6f0ec', 'rgba(110,130,150,0.6)', 0.42);
    band(238, 10, 30, '#ffc8a0', '#fff0dc', 'rgba(220,140,110,0.6)', 0.6);
    // 금 간 별
    g.save(); g.translate(400, 84); g.scale(0.72, 0.72); K.drawCrackedStar(g, 0, 0); g.restore();
  });

  // ── 먼 시계탑 실루엣 (흐릿함) ──
  function tower(g, x, top, w, base, col, lit) {
    g.fillStyle = col;
    g.fillRect(x - w / 2, top + w * 0.8, w, base - top - w * 0.8);              // 몸통
    g.fillRect(x - w * 0.62, top + w * 0.22, w * 1.24, w * 0.66);              // 시계 방
    g.fillRect(x - w * 0.7, top + w * 0.86, w * 1.4, 4);                       // 난간
    g.beginPath(); g.moveTo(x - w * 0.72, top + w * 0.26); g.lineTo(x, top - w * 0.85); g.lineTo(x + w * 0.72, top + w * 0.26); g.closePath(); g.fill();
    g.fillRect(x - 1.5, top - w * 1.25, 3, w * 0.5);                           // 첨탑
    K.blob(g, x, top + w * 0.55, w * 0.27, lit);                               // 빛나는 시계판
    g.strokeStyle = col; g.lineWidth = Math.max(1.5, w * 0.045); g.lineCap = 'round';
    g.beginPath(); g.moveTo(x, top + w * 0.55); g.lineTo(x, top + w * 0.37); g.moveTo(x, top + w * 0.55); g.lineTo(x + w * 0.14, top + w * 0.6); g.stroke();
    g.fillStyle = lit;
    for (let y = top + w * 1.25; y < base - 30; y += 34) g.fillRect(x - 2, y, 4, 9);   // 창문
  }
  const far = K.canvas(W, H, g => {
    K.setSeed(811);
    for (let x = 0; x < W; x += 40) {                    // 아주 먼 지붕들
      const h = K.rr(30, 70), w = K.rr(30, 46);
      K.wrap(x, 40, X => {
        g.fillStyle = '#c29c8e';
        g.fillRect(X - w / 2, 300 - h, w, h + 40);
        g.beginPath(); g.moveTo(X - w / 2 - 4, 300 - h); g.lineTo(X, 300 - h - w * 0.4); g.lineTo(X + w / 2 + 4, 300 - h); g.closePath(); g.fill();
      });
    }
    [[80, 150, 50], [270, 118, 38], [440, 170, 58], [640, 128, 44], [800, 100, 62], [925, 165, 34]].forEach(([x, top, w]) =>
      K.wrap(x, w, X => tower(g, X, top, w, 330, '#7e8698', 'rgba(255,238,190,0.9)')));
    K.ridge(g, x => 316 + K.wave(x, [[3, 8, 0.4], [7, 4, 1.2]]), K.vgrad(g, 296, 380, [[0, '#8a8890'], [1, '#b0a4a0']]));
    // 공기 원근 (아래쪽 노을 안개)
    g.fillStyle = K.vgrad(g, 170, 380, [[0, 'rgba(255,214,170,0)'], [1, 'rgba(255,214,170,0.72)']]);
    g.fillRect(0, 170, W, 210);
  });

  // ── 거대한 톱니·증기 파이프 (천천히) ──
  const mid = K.canvas(W, H, g => {
    K.setSeed(821);
    const my = x => 344 + K.wave(x, [[4, 6, 0.9], [9, 3, 0.2]]);
    // 놋쇠 톱니 (바퀴살 사이로 뒤가 보임)
    [[170, 300, 118, 20, 0.1], [450, 336, 70, 14, 0.3], [700, 286, 136, 22, 0.05], [905, 330, 52, 12, 0.2]].forEach(([x, y, r, n, rot]) => K.wrap(x, r + 4, X => {
      cog(g, X, y, r, n, K.vgrad(g, y - r, y + r * 0.3, [[0, '#c8a066'], [1, '#86684a']]), rot, 0.12);
      g.globalCompositeOperation = 'destination-out';
      for (let k = 0; k < 6; k++) {
        const a = rot + k * TAU / 6 + TAU / 12;
        g.beginPath(); g.moveTo(X + Math.cos(a - 0.36) * r * 0.26, y + Math.sin(a - 0.36) * r * 0.26);
        g.arc(X, y, r * 0.68, a - 0.4, a + 0.4);
        g.lineTo(X + Math.cos(a + 0.36) * r * 0.26, y + Math.sin(a + 0.36) * r * 0.26);
        g.closePath(); g.fill();
      }
      g.globalCompositeOperation = 'source-over';
      g.strokeStyle = 'rgba(90,60,40,0.35)'; g.lineWidth = r * 0.04; g.beginPath(); g.arc(X, y, r * 0.78, 0, TAU); g.stroke();
      g.strokeStyle = 'rgba(255,236,190,0.35)'; g.lineWidth = r * 0.04; g.beginPath(); g.arc(X, y, r * 0.84, Math.PI * 1.1, Math.PI * 1.6); g.stroke();
      K.blob(g, X, y, r * 0.2, '#a88458'); K.blob(g, X, y, r * 0.09, '#6a4e36');
    }));
    // 증기 배출구와 김
    const py = 312;
    [[330, 236], [590, 214], [860, 250]].forEach(([x, top]) => K.wrap(x, 40, X => {
      const pg = g.createLinearGradient(X - 9, 0, X + 9, 0);
      pg.addColorStop(0, '#7a5234'); pg.addColorStop(0.4, '#c88e5e'); pg.addColorStop(1, '#5e3e26');
      g.fillStyle = pg; g.fillRect(X - 9, top, 18, py - top);
      g.fillStyle = '#5e3e26'; g.fillRect(X - 13, top - 8, 26, 10); g.fillRect(X - 12, top + 40, 24, 6);
      for (let k = 0; k < 5; k++) K.blob(g, X + k * 7 + Math.sin(k * 2.1) * 4, top - 16 - k * 19, 10 + k * 5, `rgba(255,246,236,${0.5 - k * 0.09})`);
    }));
    // 가로로 길게 이어진 파이프
    g.fillStyle = K.vgrad(g, py - 8, py + 8, [[0, '#d8a070'], [0.45, '#b07448'], [1, '#6a4428']]);
    g.fillRect(0, py - 8, W, 16);
    g.fillStyle = 'rgba(255,230,190,0.4)'; g.fillRect(0, py - 6, W, 2);
    for (let x = 60; x < W; x += 120) { g.fillStyle = '#6a4a2e'; g.fillRect(x - 6, py - 11, 12, 22); g.fillStyle = 'rgba(255,220,170,0.4)'; g.fillRect(x - 5, py - 10, 3, 20); }
    // 기계 지붕선
    for (let x = 20; x < W; x += 70) {
      const w = K.rr(12, 20), h = K.rr(14, 36);
      K.wrap(x, 30, X => { g.fillStyle = '#76685c'; g.fillRect(X - w / 2, my(X) - h, w, h + 8); g.fillRect(X - w / 2 - 3, my(X) - h - 4, w + 6, 5); });
    }
    K.ridge(g, my, K.vgrad(g, 320, 400, [[0, '#7a6c60'], [1, '#8a7c6c']]));
    g.strokeStyle = 'rgba(255,220,170,0.45)'; g.lineWidth = 2;
    g.beginPath(); for (let x = 0; x <= W; x += 3) x ? g.lineTo(x, my(x)) : g.moveTo(x, my(x)); g.stroke();
    // 공기 원근
    g.fillStyle = K.vgrad(g, 140, 380, [[0, 'rgba(255,220,180,0)'], [0.7, 'rgba(255,220,180,0.26)'], [1, 'rgba(255,220,180,0.4)']]);
    g.fillRect(0, 140, W, 240);
  });

  // ── 놋쇠 기계·가로등·톱니 울타리 (보통 속도) ──
  function bigClock(g, x, by) {
    cog(g, x + 76, by - 128, 38, 12, '#6a4a2e', 0.2);                         // 옆으로 삐져나온 톱니
    cog(g, x - 70, by - 190, 24, 10, '#7a5636', 0.1);
    const body = g.createLinearGradient(x - 86, 0, x + 86, 0);
    body.addColorStop(0, '#5e4028'); body.addColorStop(0.45, '#b08050'); body.addColorStop(1, '#4e3420');
    g.fillStyle = body;
    g.beginPath(); g.moveTo(x - 86, by); g.lineTo(x - 70, by - 150); g.quadraticCurveTo(x - 70, by - 232, x, by - 236); g.quadraticCurveTo(x + 70, by - 232, x + 70, by - 150); g.lineTo(x + 86, by); g.closePath(); g.fill();
    g.fillStyle = 'rgba(255,230,180,0.25)'; g.fillRect(x - 40, by - 220, 6, 210);
    g.fillStyle = '#7a5434'; g.beginPath(); g.ellipse(x, by - 236, 20, 11, 0, Math.PI, TAU); g.fill();
    g.fillRect(x - 2, by - 272, 4, 36); K.blob(g, x, by - 274, 5, '#f0c870');
    // 큰 시계판
    K.blob(g, x, by - 150, 64, '#4e3420');
    const rim = g.createLinearGradient(0, by - 210, 0, by - 90);
    rim.addColorStop(0, '#ffe6a0'); rim.addColorStop(0.5, '#d8a048'); rim.addColorStop(1, '#8a5a24');
    K.blob(g, x, by - 150, 60, rim);
    const face = g.createRadialGradient(x - 14, by - 166, 4, x, by - 150, 52);
    face.addColorStop(0, '#fffaea'); face.addColorStop(1, '#f0d8a0');
    K.blob(g, x, by - 150, 52, face);
    clockFace(g, x, by - 150, 52, 'rgba(0,0,0,0)', 'rgba(0,0,0,0)', '#4a3020', 7, 25);
    // 시계 중심의 별조각
    K.glow(g, x, by - 150, 30, 'rgba(170,235,255,0.75)');
    g.fillStyle = '#e0f8ff';
    g.beginPath(); g.moveTo(x - 5, by - 141); g.lineTo(x - 3, by - 155); g.lineTo(x + 2, by - 161); g.lineTo(x + 6, by - 149); g.lineTo(x + 4, by - 141); g.closePath(); g.fill();
    K.light(x, by - 150, 'near', '170,235,255', 26, 0);
    // 둘레 전구
    for (let i = 0; i < 16; i++) {
      const a = i * TAU / 16, bx = x + Math.cos(a) * 58, byy = by - 150 + Math.sin(a) * 58;
      K.blob(g, bx, byy, 2.6, '#fff0c0');
      K.light(bx, byy, 'near', '255,224,150', 3.4, i * 0.8);
    }
    // 진자 창
    g.fillStyle = '#2a1c14'; g.beginPath(); g.roundRect(x - 24, by - 80, 48, 70, 14); g.fill();
    g.fillStyle = '#1e3a44'; g.beginPath(); g.roundRect(x - 19, by - 75, 38, 60, 11); g.fill();
    g.fillStyle = '#e8b448'; g.fillRect(x - 1.5, by - 75, 3, 38); K.blob(g, x, by - 32, 9, '#e8b448'); K.blob(g, x - 3, by - 35, 3, 'rgba(255,246,210,0.8)');
  }
  function machine(g, x, by, w, h) {
    g.fillStyle = '#7a5434'; g.fillRect(x + w * 0.28, by - h - 22, 8, 24); g.fillRect(x + w * 0.28 - 3, by - h - 24, 14, 5);
    const gr = g.createLinearGradient(0, by - h, 0, by);
    gr.addColorStop(0, '#c89a5a'); gr.addColorStop(1, '#7a5634');
    g.fillStyle = gr; g.beginPath(); g.roundRect(x - w / 2, by - h, w, h, 6); g.fill();
    g.fillStyle = 'rgba(255,236,190,0.4)'; g.fillRect(x - w / 2 + 5, by - h + 3, w - 10, 3);
    const gx = x - w * 0.2, gy = by - h * 0.55, gr2 = h * 0.22;                 // 계기판
    K.blob(g, gx, gy, gr2 + 2, '#4e3420'); K.blob(g, gx, gy, gr2, '#fff4d8');
    g.strokeStyle = '#c0402a'; g.lineWidth = 2; g.beginPath(); g.moveTo(gx, gy); g.lineTo(gx + Math.cos(-0.7) * gr2 * 0.8, gy + Math.sin(-0.7) * gr2 * 0.8); g.stroke();
    const vx = x + w * 0.24, vr = h * 0.17;                                     // 빨간 밸브 바퀴
    g.strokeStyle = '#a83a2a'; g.lineWidth = 3; g.beginPath(); g.arc(vx, gy, vr, 0, TAU); g.stroke();
    g.lineWidth = 2; g.beginPath(); g.moveTo(vx - vr, gy); g.lineTo(vx + vr, gy); g.moveTo(vx, gy - vr); g.lineTo(vx, gy + vr); g.stroke();
    [[x - w / 2 + 5, by - h + 10], [x + w / 2 - 5, by - h + 10], [x - w / 2 + 5, by - 6], [x + w / 2 - 5, by - 6]].forEach(([rx, ry]) => rivet(g, rx, ry, 1.8));
    K.blob(g, x + w * 0.02, by - h * 0.2, 3, '#ffc070');                      // 표시등
    K.light(x + w * 0.02, by - h * 0.2, 'near', '255,170,90', 3.6);
  }
  function lamp(g, x, by) {
    K.glow(g, x, by - 108, 40, 'rgba(255,214,140,0.45)');
    g.fillStyle = '#3a2a1e';
    g.fillRect(x - 2.5, by - 100, 5, 100); g.fillRect(x - 7, by - 7, 14, 7); g.fillRect(x - 5, by - 60, 10, 4);
    g.beginPath(); g.moveTo(x - 11, by - 116); g.lineTo(x, by - 127); g.lineTo(x + 11, by - 116); g.closePath(); g.fill();
    g.fillStyle = '#ffe6a8'; g.fillRect(x - 7, by - 116, 14, 15);
    g.fillStyle = '#3a2a1e'; g.fillRect(x - 9, by - 102, 18, 3); g.fillRect(x - 1, by - 116, 2, 15);
    K.blob(g, x, by - 129, 2.5, '#3a2a1e');
  }
  const near = K.canvas(W, H, g => {
    K.setSeed(831);
    const hy = x => 382 + K.wave(x, [[2, 7, 0.5], [5, 4, 1.7]]);
    bigClock(g, 690, hy(690) + 6);
    for (let x = 24; x < W; x += 48) {                   // 톱니 울타리 (아래는 언덕에 가려짐)
      if (x > 590 && x < 790) continue;
      const y = hy(x) + 4;
      cog(g, x, y, 18, 10, K.vgrad(g, y - 18, y + 6, [[0, '#c08a50'], [1, '#6a4a2e']]), (x * 0.13) % 1, 0.24);
      g.strokeStyle = 'rgba(255,230,180,0.5)'; g.lineWidth = 2; g.beginPath(); g.arc(x, y, 10, Math.PI * 1.15, Math.PI * 1.7); g.stroke();
      K.blob(g, x, y, 5, '#4a3424'); K.blob(g, x - 1, y - 1, 1.6, 'rgba(255,236,200,0.7)');
    }
    K.ridge(g, hy, K.vgrad(g, 360, 430, [[0, '#6a4e36'], [1, '#4a3424']]));
    g.strokeStyle = 'rgba(240,196,120,0.9)'; g.lineWidth = 3;
    g.beginPath(); for (let x = 0; x <= W; x += 3) x ? g.lineTo(x, hy(x)) : g.moveTo(x, hy(x)); g.stroke();
    for (let x = 12; x < W; x += 24) K.blob(g, x, hy(x) + 7, 1.6, 'rgba(255,220,150,0.6)');
    [[220, 70, 46], [470, 56, 38]].forEach(([x, w, h]) => machine(g, x, hy(x) + 10, w, h));
    [110, 360, 560, 880].forEach(x => { lamp(g, x, hy(x) + 4); K.light(x, hy(x) - 104, 'near', '255,226,160', 14); });
  });

  // ── 리벳 박힌 철판 바닥 (캐릭터와 같은 속도) ──
  const ground = K.canvas(W, H, g => {
    K.setSeed(841);
    const top = GY - 6;
    K.ridge(g, () => top, K.vgrad(g, top, H, [[0, '#b28e68'], [0.25, '#9a8270'], [1, '#6a5a52']]));
    // 철판 (벽돌처럼 엇갈린 이음매, 가로 960마다 반복)
    [[top + 12, top + 42, 160, 0], [top + 42, top + 78, 160, 80], [top + 78, top + 120, 192, 40], [top + 120, H, 192, 136]].forEach(([y0, y1, sp, off]) => {
      for (let sx = off; sx < W + off; sx += sp) {
        const x0 = sx % W, tint = K.rnd() < 0.5 ? `rgba(255,240,210,${K.rr(0.03, 0.09)})` : `rgba(40,24,16,${K.rr(0.04, 0.1)})`;
        K.wrap(x0, sp, X => { g.fillStyle = tint; g.fillRect(X, y0, sp, y1 - y0); });
        K.wrap(x0, 4, X => { g.fillStyle = 'rgba(40,26,18,0.55)'; g.fillRect(X - 1, y0, 2, y1 - y0); g.fillStyle = 'rgba(255,230,190,0.25)'; g.fillRect(X + 1, y0, 1.5, y1 - y0); });
        if (y1 - y0 > 20) [[8, y0 + 6], [sp - 8, y0 + 6], [8, y1 - 6], [sp - 8, y1 - 6]].forEach(([dx, ry]) => K.wrap((x0 + dx) % W, 6, X => rivet(g, X, ry)));
      }
      g.fillStyle = 'rgba(40,26,18,0.5)'; g.fillRect(0, y0 - 1, W, 2);
      g.fillStyle = 'rgba(255,230,190,0.22)'; g.fillRect(0, y0 + 1, W, 1.5);
    });
    // 놋쇠 테두리
    g.fillStyle = K.vgrad(g, top, top + 10, [[0, '#ffe0a0'], [0.4, '#d8a050'], [1, '#8a5a2a']]);
    g.fillRect(0, top, W, 10);
    g.fillStyle = 'rgba(40,26,18,0.55)'; g.fillRect(0, top + 10, W, 2);
    for (let x = 12; x < W; x += 24) K.blob(g, x, top + 5, 1.7, 'rgba(255,246,220,0.9)');
    // 기름 얼룩과 긁힌 자국
    for (let i = 0; i < 8; i++) {
      const x = K.rr(40, W - 40), y = K.rr(top + 24, H - 12);
      g.fillStyle = 'rgba(40,28,30,0.16)'; g.beginPath(); g.ellipse(x, y, K.rr(14, 30), K.rr(4, 8), 0, 0, TAU); g.fill();
    }
    g.strokeStyle = 'rgba(255,236,210,0.22)'; g.lineWidth = 1.2;
    for (let i = 0; i < 26; i++) {
      const x = K.rr(20, W - 20), y = K.rr(top + 18, H - 6), l = K.rr(6, 18);
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + l, y + K.rr(-2, 2)); g.stroke();
    }
    // 바닥 환풍구 (아래에서 불빛)
    [[300, top + 58], [700, top + 100]].forEach(([x, y]) => {
      g.fillStyle = '#2e2420'; g.beginPath(); g.roundRect(x - 36, y - 11, 72, 22, 6); g.fill();
      g.fillStyle = 'rgba(255,150,60,0.45)'; g.fillRect(x - 31, y - 6, 62, 12);
      g.fillStyle = '#5a4434'; for (let k = -28; k <= 28; k += 8) g.fillRect(x + k - 1.5, y - 9, 3, 18);
      K.light(x, y, 'ground', '255,150,70', 16);
    });
    // 굴러다니는 작은 톱니와 볼트
    for (let i = 0; i < 7; i++) {
      const x = K.rr(30, W - 30), y = K.rr(top + 26, H - 10), r = K.rr(4, 7);
      cog(g, x + 1, y + 1.5, r, 8, 'rgba(40,26,18,0.4)', i, 0.28);
      cog(g, x, y, r, 8, '#d8a858', i, 0.28); K.blob(g, x, y, r * 0.32, '#5a4030');
    }
    // 바닥 표시등
    [[60, top + 30], [430, top + 92], [610, top + 28], [910, top + 70]].forEach(([x, y], i) => {
      K.blob(g, x, y, 4.5, '#3a2a20'); K.blob(g, x, y, 3, i % 2 ? '#8ae0ff' : '#ffc070');
      K.light(x, y, 'ground', i % 2 ? '150,230,255' : '255,190,110', 4);
    });
    [[170, GY + 70], [520, GY + 44], [840, GY + 92]].forEach(([x, y]) => K.drawShard(g, x, y));
  });

  // ── 떠다니는 불꽃과 작은 톱니 ──
  const moteMake = anywhere => K.rnd() < 0.3
    ? { t: 1, x: anywhere ? K.rr(0, W) : W + K.rr(10, 60), y: K.rr(60, H - 70), vx: K.rr(-42, -16), r: K.rr(3.5, 7), rot: K.rr(0, TAU), vr: K.rr(-1.6, 1.6), ph: K.rr(0, TAU), a: K.rr(0.45, 0.8) }
    : { t: 0, x: K.rr(0, W), y: anywhere ? K.rr(140, H) : K.rr(GY - 40, H + 10), vx: K.rr(-30, 12), vy: K.rr(-70, -28), r: K.rr(1, 2.2), life: K.rr(2.5, 6), ph: K.rr(0, TAU) };
  const moteDraw = (ctx, p, dt) => {
    if (p.t) {
      p.x += p.vx * dt; p.ph += dt; p.rot += p.vr * dt;
      const y = p.y + Math.sin(p.ph) * 8;
      ctx.globalAlpha = p.a;
      cog(ctx, p.x, y, p.r, 8, '#e0b060', p.rot, 0.28);
      ctx.beginPath(); ctx.arc(p.x, y, p.r * 0.35, 0, TAU); ctx.fillStyle = '#6a4a2a'; ctx.fill();
      return p.x > -20;
    }
    p.life -= dt; p.ph += dt * 9;
    p.x += (p.vx + Math.sin(p.ph * 0.3) * 10) * dt; p.y += p.vy * dt;
    const a = Math.max(0, Math.min(1, p.life)) * (0.55 + 0.45 * Math.sin(p.ph));
    ctx.fillStyle = `rgba(255,170,70,${a * 0.3})`; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 4, 0, TAU); ctx.fill();
    ctx.fillStyle = `rgba(255,240,190,${a})`; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill();
    return p.life > 0 && p.y > -10;
  };

  return { sky, far, mid, near, ground, fall: null, clouds: false, mote: 'custom', rayX: 760, rayDir: -1, rayRgb: '255,220,160',
    front: ['rgba(70,52,36,0.9)', 'rgba(108,80,48,0.9)'], moteCount: 30, moteMake, moteDraw };
});

// 챕터 9 그림자 성 — 배경
Scenery.addTheme('shadow', (K, cur) => {
  const { W, H, GY, TAU } = K;

  // ── 하늘: 남보라 밤하늘, 큰 초승달, 흐릿한 금 간 별 ──
  const sky = K.canvas(W, H, g => {
    g.fillStyle = K.vgrad(g, 0, GY, [[0, '#0c0820'], [0.35, '#1e1642'], [0.7, '#402a66'], [1, '#6e4482']]);
    g.fillRect(0, 0, W, H);
    K.setSeed(901);
    for (let i = 0; i < 130; i++) {                      // 작은 별
      const x = K.rr(0, W), y = K.rr(0, 300) * K.rr(0.4, 1);
      K.blob(g, x, y, K.rr(0.5, 1.5), `rgba(235,225,255,${K.rr(0.25, 0.85).toFixed(2)})`);
    }
    // 금 간 별 (어둡게 가려짐)
    const st = K.canvas(320, 320, s => K.drawCrackedStar(s, 160, 160));
    K.glow(g, 250, 96, 120, 'rgba(170,120,230,0.25)');
    g.globalAlpha = 0.5; g.drawImage(st, 250 - 112, 96 - 112, 224, 224); g.globalAlpha = 1;
    // 큰 초승달
    K.glow(g, 730, 128, 280, 'rgba(190,160,255,0.24)');
    K.glow(g, 714, 140, 110, 'rgba(240,230,255,0.3)');
    const moon = K.canvas(200, 200, m => {
      m.fillStyle = 'rgba(52,36,96,0.7)';                   // 어두운 쪽 (희미하게 보임)
      m.beginPath(); m.arc(100, 100, 62, 0, TAU); m.fill();
      const lit = K.canvas(200, 200, c => {
        const gr = c.createRadialGradient(76, 116, 6, 100, 100, 66);
        gr.addColorStop(0, '#fffdf4'); gr.addColorStop(0.6, '#f0e6ff'); gr.addColorStop(1, '#cbb8ee');
        c.fillStyle = gr; c.beginPath(); c.arc(100, 100, 62, 0, TAU); c.fill();
        c.fillStyle = 'rgba(170,150,220,0.4)';
        [[54, 112, 7], [70, 140, 5], [50, 86, 4]].forEach(([x, y, r]) => { c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); });
        c.globalCompositeOperation = 'destination-out'; c.fillStyle = '#000';
        c.beginPath(); c.arc(116, 88, 60, 0, TAU); c.fill();
      });
      m.drawImage(lit, 0, 0);
    });
    g.drawImage(moon, 640, 20);
    // 달을 가로지르는 얇은 구름 (부드러운 띠)
    [[700, 168, 130, 9], [820, 196, 90, 6], [380, 214, 170, 8], [110, 176, 120, 7], [560, 252, 210, 10]].forEach(([x, y, w, h]) => {
      g.save(); g.translate(x, y); g.scale(w / 40, h / 40);
      K.glow(g, 0, 0, 40, 'rgba(120,86,176,0.6)');
      K.glow(g, -6, -14, 26, 'rgba(210,180,250,0.22)');
      g.restore();
    });
    g.fillStyle = K.vgrad(g, 260, GY, [[0, 'rgba(160,110,190,0)'], [1, 'rgba(160,110,190,0.4)']]);
    g.fillRect(0, 260, W, GY - 260);
  });

  // ── 먼 곳: 절벽 위 고딕 성 실루엣 (흐릿하게) ──
  function tower(g, x, top, w, roof, base) {
    g.fillRect(x - w / 2, top, w, base - top);
    g.beginPath(); g.moveTo(x - w / 2 - 4, top + 2); g.lineTo(x, top - roof); g.lineTo(x + w / 2 + 4, top + 2); g.closePath(); g.fill();
    for (let k = 0; k < 3; k++) g.fillRect(x - w / 2 - 3 + k * (w + 6) / 3, top - 2, (w + 6) / 6, 4);
  }
  const far = K.canvas(W, H, g => {
    K.ridge(g, x => 292 + K.wave(x, [[2, 24, 0.8], [5, 10, 2.0], [11, 4, 0.3]]), K.vgrad(g, 230, 380, [[0, '#4a3a74'], [1, '#64508a']]));
    // 절벽
    const col = '#3a2c62';
    g.fillStyle = col;
    g.beginPath();
    g.moveTo(470, 380); g.lineTo(500, 300); g.lineTo(512, 262); g.lineTo(530, 246); g.lineTo(560, 238); g.lineTo(690, 236);
    g.lineTo(712, 250); g.lineTo(722, 282); g.lineTo(740, 320); g.lineTo(770, 380); g.closePath(); g.fill();
    // 성
    tower(g, 548, 150, 24, 34, 242);
    tower(g, 600, 120, 30, 48, 240);
    tower(g, 664, 96, 22, 56, 240);
    tower(g, 700, 170, 18, 26, 244);
    g.fillRect(552, 176, 150, 64);                          // 성벽
    for (let x = 556; x < 700; x += 12) g.fillRect(x, 170, 6, 8);
    g.beginPath(); g.moveTo(618, 176); g.quadraticCurveTo(632, 160, 646, 176); g.fill();
    // 불 켜진 창
    [[600, 150], [600, 176], [664, 128], [664, 160], [548, 182], [580, 204], [632, 206], [690, 196], [700, 186]].forEach(([x, y]) => {
      K.glow(g, x, y, 9, 'rgba(255,190,140,0.5)');
      g.fillStyle = '#ffd8a0'; g.beginPath(); g.roundRect(x - 2, y - 3, 4, 6, 2); g.fill();
    });
    // 왼쪽 먼 폐탑
    g.fillStyle = 'rgba(70,56,112,0.9)';
    tower(g, 150, 210, 20, 30, 300);
    g.fillRect(132, 250, 60, 50);
    ridge2(g);
    g.fillStyle = K.vgrad(g, 250, 380, [[0, 'rgba(140,110,180,0)'], [1, 'rgba(140,110,180,0.6)']]);
    g.fillRect(0, 250, W, 130);
  });
  function ridge2(g) { K.ridge(g, x => 330 + K.wave(x, [[3, 12, 1.4], [7, 6, 0.5]]), K.vgrad(g, 300, 380, [[0, '#4e3e78'], [1, '#6a5490']])); }

  // ── 중간: 첨탑, 무너진 성벽, 빛나는 스테인드글라스 ──
  const midY = x => 344 + K.wave(x, [[3, 8, 0.6], [8, 4, 1.7]]);
  function spire(g, x, top, w) {
    g.fillStyle = K.vgrad(g, top, 360, [[0, '#2e2250'], [1, '#3c2c62']]);
    g.fillRect(x - w / 2, top, w, 360 - top);
    g.beginPath(); g.moveTo(x - w / 2 - 5, top + 2); g.lineTo(x, top - w * 2.2); g.lineTo(x + w / 2 + 5, top + 2); g.closePath(); g.fill();
    g.fillStyle = 'rgba(180,150,230,0.22)'; g.fillRect(x - w / 2, top, 4, 360 - top);           // 달빛 받는 쪽
    for (let y = top + 24; y < 320; y += 46) {
      K.glow(g, x, y, 14, 'rgba(200,140,255,0.45)');
      g.fillStyle = '#d8a8ff'; g.beginPath(); g.moveTo(x - 4, y + 8); g.lineTo(x - 4, y - 2); g.quadraticCurveTo(x, y - 9, x + 4, y - 2); g.lineTo(x + 4, y + 8); g.closePath(); g.fill();
    }
  }
  function wallPiece(g, x0, x1, top) {
    K.setSeed(Math.round(x0 * 7 + 3));
    const base = 360;
    g.fillStyle = K.vgrad(g, top, base, [[0, '#33265a'], [1, '#2a1e48']]);
    g.beginPath(); g.moveTo(x0, base); g.lineTo(x0, top + K.rr(10, 24));
    for (let x = x0; x < x1; x += 14) { const h = K.rr(0, 1) < 0.7 ? top : top + K.rr(8, 22); g.lineTo(x, h); g.lineTo(x + 8, h); g.lineTo(x + 8, h + 8); g.lineTo(x + 14, h + 8); }
    g.lineTo(x1, top + K.rr(16, 36)); g.lineTo(x1, base); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(16,8,32,0.35)'; g.lineWidth = 1.5;               // 돌 줄눈
    for (let y = top + 18; y < base; y += 14) {
      g.beginPath(); g.moveTo(x0 + 2, y); g.lineTo(x1 - 2, y); g.stroke();
      for (let x = x0 + ((y / 14) % 2) * 12 + 6; x < x1 - 4; x += 24) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 14); g.stroke(); }
    }
    g.fillStyle = 'rgba(190,160,240,0.2)'; g.fillRect(x0, top + 8, 3, base - top);
  }
  function roseWindow(g, x, y) {
    // 무너진 예배당 벽과 장미창
    g.fillStyle = K.vgrad(g, y - 80, 360, [[0, '#3a2c64'], [1, '#2c2050']]);
    g.beginPath(); g.moveTo(x - 62, 360); g.lineTo(x - 62, y - 20); g.quadraticCurveTo(x - 60, y - 84, x, y - 104); g.quadraticCurveTo(x + 60, y - 84, x + 62, y - 20);
    g.lineTo(x + 62, y + 4); g.lineTo(x + 52, y + 10); g.lineTo(x + 58, 360); g.closePath(); g.fill();
    g.fillStyle = 'rgba(190,160,240,0.22)'; g.fillRect(x - 62, y - 20, 4, 360 - y + 20);
    K.glow(g, x, y - 30, 90, 'rgba(200,120,255,0.4)');
    const cols = ['#c070ff', '#5a8aff', '#ff5aa8', '#ffd05a', '#7ae0ff', '#c070ff', '#ff5aa8', '#5a8aff'];
    for (let i = 0; i < 8; i++) {
      const a0 = i * TAU / 8 - Math.PI / 2, a1 = a0 + TAU / 8;
      g.fillStyle = cols[i];
      g.beginPath(); g.moveTo(x, y - 30); g.arc(x, y - 30, 32, a0, a1); g.closePath(); g.fill();
    }
    g.strokeStyle = '#1c1234'; g.lineWidth = 3;
    g.beginPath(); g.arc(x, y - 30, 33, 0, TAU); g.stroke();
    for (let i = 0; i < 8; i++) { const a = i * TAU / 8 - Math.PI / 2; g.beginPath(); g.moveTo(x, y - 30); g.lineTo(x + Math.cos(a) * 33, y - 30 + Math.sin(a) * 33); g.stroke(); }
    g.beginPath(); g.arc(x, y - 30, 16, 0, TAU); g.stroke();
    g.fillStyle = '#fff0ff'; g.beginPath(); g.arc(x, y - 30, 7, 0, TAU); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.ellipse(x - 12, y - 44, 8, 4, -0.6, 0, TAU); g.fill();
    // 아래쪽 뾰족 창 두 개
    [x - 30, x + 30].forEach(wx => {
      K.glow(g, wx, y + 30, 22, 'rgba(200,140,255,0.4)');
      g.fillStyle = '#b07ae8'; g.beginPath(); g.moveTo(wx - 8, y + 50); g.lineTo(wx - 8, y + 22); g.quadraticCurveTo(wx, y + 8, wx + 8, y + 22); g.lineTo(wx + 8, y + 50); g.closePath(); g.fill();
      g.strokeStyle = '#1c1234'; g.lineWidth = 2; g.beginPath(); g.moveTo(wx, y + 14); g.lineTo(wx, y + 50); g.moveTo(wx - 8, y + 32); g.lineTo(wx + 8, y + 32); g.stroke();
    });
  }
  const mid = K.canvas(W, H, g => {
    K.ridge(g, midY, K.vgrad(g, 310, 400, [[0, '#2e2250'], [1, '#3a2c5e']]));
    spire(g, 110, 170, 22);
    spire(g, 560, 140, 26);
    spire(g, 830, 190, 20);
    wallPiece(g, 20, 190, 286);
    wallPiece(g, 470, 640, 300);
    wallPiece(g, 700, 790, 312);
    roseWindow(g, 330, 270);
    g.fillStyle = K.vgrad(g, 290, 372, [[0, 'rgba(170,140,220,0)'], [0.6, 'rgba(170,140,220,0.3)'], [1, 'rgba(170,140,220,0.05)']]);
    g.fillRect(0, 290, W, 82);
  });

  // ── 가까운 곳: 비틀린 죽은 나무, 비석, 보라 촛불과 등불 ──
  const nearY = x => 382 + K.wave(x, [[2, 10, 0.9], [5, 5, 2.3], [9, 2, 0.4]]);
  function branch(g, x, y, ang, len, w, depth) {
    const x1 = x + Math.cos(ang) * len, y1 = y + Math.sin(ang) * len;
    const bend = K.rr(-0.5, 0.5) * len;
    g.lineWidth = w; g.beginPath(); g.moveTo(x, y);
    g.quadraticCurveTo((x + x1) / 2 + Math.cos(ang + Math.PI / 2) * bend, (y + y1) / 2 + Math.sin(ang + Math.PI / 2) * bend, x1, y1); g.stroke();
    if (depth <= 0 || w < 1.5) return;
    const n = depth > 2 ? 2 : (K.rnd() < 0.5 ? 2 : 3);
    for (let i = 0; i < n; i++) branch(g, x1, y1, ang + K.rr(-0.75, 0.75) + (i - (n - 1) / 2) * 0.5, len * K.rr(0.58, 0.78), w * 0.62, depth - 1);
    if (depth === 1 && K.rnd() < 0.5) {                 // 끝이 동그랗게 말린 가지
      g.lineWidth = Math.max(1.2, w * 0.5); g.beginPath(); g.arc(x1 + 4, y1, 4, Math.PI, Math.PI * 2.6); g.stroke();
    }
  }
  function deadTree(g, x, baseY, h, seed) {
    K.setSeed(seed);
    g.strokeStyle = '#1a1028'; g.fillStyle = '#1a1028'; g.lineCap = 'round';
    g.beginPath(); g.moveTo(x - h * 0.16, baseY + 4); g.quadraticCurveTo(x - h * 0.05, baseY - h * 0.1, x - h * 0.04, baseY - h * 0.45);
    g.quadraticCurveTo(x + h * 0.06, baseY - h * 0.6, x - h * 0.02, baseY - h * 0.7); g.lineTo(x + h * 0.05, baseY - h * 0.68);
    g.quadraticCurveTo(x + h * 0.1, baseY - h * 0.5, x + h * 0.05, baseY - h * 0.4); g.quadraticCurveTo(x + h * 0.05, baseY - h * 0.1, x + h * 0.18, baseY + 4); g.closePath(); g.fill();
    branch(g, x, baseY - h * 0.66, -Math.PI / 2 - 0.5, h * 0.36, h * 0.06, 4);
    branch(g, x, baseY - h * 0.66, -Math.PI / 2 + 0.55, h * 0.34, h * 0.055, 4);
    branch(g, x - h * 0.02, baseY - h * 0.45, -Math.PI + 0.35, h * 0.28, h * 0.045, 3);
    g.strokeStyle = 'rgba(160,130,210,0.25)'; g.lineWidth = 2;     // 달빛 테두리
    g.beginPath(); g.moveTo(x - h * 0.03, baseY - 6); g.quadraticCurveTo(x - h * 0.06, baseY - h * 0.3, x - h * 0.03, baseY - h * 0.5); g.stroke();
  }
  function tomb(g, x, y, w, h, kind, tilt) {
    g.save(); g.translate(x, y); g.rotate(tilt);
    const fill = K.vgrad(g, -h, 0, [[0, '#62568a'], [1, '#3a3060']]);
    g.fillStyle = fill;
    if (kind === 'cross') {
      g.fillRect(-w * 0.14, -h, w * 0.28, h); g.fillRect(-w / 2, -h * 0.74, w, w * 0.28);
      g.fillStyle = 'rgba(210,190,255,0.3)'; g.fillRect(-w * 0.14, -h, 2.5, h); g.fillRect(-w / 2, -h * 0.74, w, 2.5);
    } else {
      g.beginPath(); g.moveTo(-w / 2, 0); g.lineTo(-w / 2, -h + w / 2); g.arc(0, -h + w / 2, w / 2, Math.PI, TAU); g.lineTo(w / 2, 0); g.closePath(); g.fill();
      g.fillStyle = 'rgba(210,190,255,0.28)'; g.fillRect(-w / 2, -h + w / 2, 3, h - w / 2);
      g.strokeStyle = 'rgba(30,20,50,0.6)'; g.lineWidth = 2;               // 새긴 십자와 금
      g.beginPath(); g.moveTo(0, -h + w * 0.35); g.lineTo(0, -h + w * 0.95); g.moveTo(-w * 0.18, -h + w * 0.55); g.lineTo(w * 0.18, -h + w * 0.55);
      g.moveTo(w * 0.3, -h * 0.5); g.lineTo(w * 0.15, -h * 0.35); g.lineTo(w * 0.28, -h * 0.2); g.stroke();
    }
    g.fillStyle = 'rgba(110,140,100,0.55)'; g.beginPath(); g.ellipse(-w * 0.2, -2, w * 0.3, 3, 0, 0, TAU); g.fill();
    g.restore();
  }
  function candle(g, x, y, h, layer) {
    g.fillStyle = '#b38ae8'; g.fillRect(x - 2.5, y - h, 5, h);
    g.fillStyle = 'rgba(255,255,255,0.4)'; g.fillRect(x - 2.5, y - h, 1.5, h);
    K.glow(g, x, y - h - 4, 20, 'rgba(210,140,255,0.55)');
    g.fillStyle = '#f4d8ff'; g.beginPath(); g.ellipse(x, y - h - 4, 2.2, 4, 0, 0, TAU); g.fill();
    K.light(x, y - h - 4, layer, '230,170,255', 4);
  }
  function lantern(g, x, baseY) {
    g.fillStyle = '#1e1430';
    g.fillRect(x - 2.5, baseY - 92, 5, 92); g.fillRect(x - 8, baseY - 4, 16, 6);
    g.strokeStyle = '#1e1430'; g.lineWidth = 3; g.lineCap = 'round';
    g.beginPath(); g.moveTo(x, baseY - 88); g.quadraticCurveTo(x + 16, baseY - 92, x + 22, baseY - 80); g.stroke();
    const lx = x + 22, ly = baseY - 64;
    K.glow(g, lx, ly, 46, 'rgba(190,120,255,0.4)');
    g.fillStyle = '#e8c8ff'; g.beginPath(); g.roundRect(lx - 7, ly - 10, 14, 20, 3); g.fill();
    g.fillStyle = '#1e1430'; g.fillRect(lx - 9, ly - 13, 18, 4); g.fillRect(lx - 7, ly + 9, 14, 3);
    g.beginPath(); g.moveTo(lx - 6, ly - 13); g.lineTo(lx, ly - 18); g.lineTo(lx + 6, ly - 13); g.closePath(); g.fill();
    g.fillRect(lx - 0.75, ly - 10, 1.5, 20);
    K.light(lx, ly, 'near', '200,140,255', 16);
  }
  function fence(g, x0, x1) {
    g.strokeStyle = '#1a1028'; g.fillStyle = '#1a1028'; g.lineWidth = 3;
    for (let x = x0; x <= x1; x += 12) {
      const y = nearY(x) + 4;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - 44); g.stroke();
      g.beginPath(); g.moveTo(x - 3.5, y - 43); g.lineTo(x, y - 52); g.lineTo(x + 3.5, y - 43); g.closePath(); g.fill();
    }
    g.lineWidth = 3;
    [34, 12].forEach(d => { g.beginPath(); for (let x = x0; x <= x1; x += 6) x === x0 ? g.moveTo(x, nearY(x) + 4 - d) : g.lineTo(x, nearY(x) + 4 - d); g.stroke(); });
  }
  const near = K.canvas(W, H, g => {
    K.ridge(g, nearY, K.vgrad(g, 360, 440, [[0, '#2c2044'], [1, '#1c1430']]));
    g.strokeStyle = 'rgba(170,140,220,0.5)'; g.lineWidth = 2.5;
    g.beginPath(); for (let x = 0; x <= W; x += 3) x ? g.lineTo(x, nearY(x)) : g.moveTo(x, nearY(x)); g.stroke();
    deadTree(g, 150, nearY(150) + 6, 230, 311);
    deadTree(g, 650, nearY(650) + 6, 190, 523);
    K.wrap(930, 80, x => deadTree(g, x, nearY(930) + 6, 120, 777));
    fence(g, 440, 560);
    [[260, 26, 40, 'round', -0.06], [300, 22, 32, 'cross', 0.08], [380, 24, 36, 'round', 0.1], [740, 28, 44, 'round', -0.04], [800, 22, 36, 'cross', -0.12], [40, 22, 30, 'round', 0.12]]
      .forEach(([x, w, h, kind, tilt]) => K.wrap(x, 30, xx => tomb(g, xx, nearY(x) + 8, w, h, kind, tilt)));
    candle(g, 268, nearY(268) + 8, 12, 'near'); candle(g, 392, nearY(392) + 9, 9, 'near'); candle(g, 752, nearY(752) + 8, 14, 'near'); candle(g, 726, nearY(726) + 10, 8, 'near');
    lantern(g, 590, nearY(590) + 6);
    lantern(g, 880, nearY(880) + 6);
  });

  // ── 땅: 어두운 돌 타일, 깔린 안개, 별조각 셋 ──
  const groundY = x => GY - 4 + K.wave(x, [[6, 1.5, 0.3], [15, 1, 1.1]]);
  const ground = K.canvas(W, H, g => {
    K.ridge(g, groundY, K.vgrad(g, GY - 8, H, [[0, '#4a4068'], [0.1, '#3a3056'], [0.6, '#2a2242'], [1, '#1c1630']]));
    g.save();
    g.beginPath(); g.moveTo(0, H); for (let x = 0; x <= W; x += 3) g.lineTo(x, groundY(x)); g.lineTo(W, H); g.closePath(); g.clip();
    K.setSeed(919);
    const rows = [[GY - 8, 18, 48], [GY + 10, 20, 60], [GY + 30, 24, 64], [GY + 54, 30, 80], [GY + 84, 40, 96]];
    rows.forEach(([y0, rh, tw], r) => {
      const off = (r % 2) * tw / 2 + 6;
      for (let i = 0; i < W / tw; i++) {
        const shade = K.rr(0, 1), crack = K.rnd() < 0.25, moss = K.rnd() < 0.3, cx = K.rr(0.2, 0.8);
        K.wrap(off + i * tw, tw, X => {
          g.fillStyle = `rgb(${Math.round(52 + shade * 16)},${Math.round(44 + shade * 12)},${Math.round(80 + shade * 18)})`;
          g.fillRect(X + 1.5, y0 + 1.5, tw - 3, rh - 3);
          g.fillStyle = 'rgba(190,170,240,0.16)'; g.fillRect(X + 2, y0 + 2, tw - 4, 2);
          g.fillStyle = 'rgba(10,6,20,0.3)'; g.fillRect(X + 2, y0 + rh - 4, tw - 4, 2.5);
          if (crack) { g.strokeStyle = 'rgba(14,8,28,0.6)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(X + tw * cx, y0 + 3); g.lineTo(X + tw * cx + 5, y0 + rh * 0.5); g.lineTo(X + tw * cx - 2, y0 + rh - 3); g.stroke(); }
          if (moss) { g.fillStyle = 'rgba(100,130,110,0.45)'; g.beginPath(); g.ellipse(X + tw * cx, y0 + rh - 1, 8, 2.5, 0, 0, TAU); g.fill(); }
        });
      }
      g.fillStyle = 'rgba(12,8,24,0.75)'; g.fillRect(0, y0 - 0.5, W, 2);
    });
    // 달빛이 비친 웅덩이
    [[330, GY + 70, 46], [690, GY + 104, 60]].forEach(([x, y, w]) => K.wrap(x, w, X => {
      g.fillStyle = 'rgba(30,20,60,0.85)'; g.beginPath(); g.ellipse(X, y, w, 7, 0, 0, TAU); g.fill();
      g.fillStyle = 'rgba(220,200,255,0.5)'; g.beginPath(); g.ellipse(X + w * 0.25, y - 1, w * 0.25, 1.6, 0, 0, TAU); g.fill();
      g.fillStyle = 'rgba(200,170,255,0.25)'; g.beginPath(); g.ellipse(X - w * 0.3, y + 1, w * 0.15, 1.2, 0, 0, TAU); g.fill();
    }));
    // 깔린 안개
    for (let i = 0; i < 9; i++) {
      const x = K.rr(0, W), y = K.rr(GY + 6, H - 20), r = K.rr(50, 90);
      K.wrap(x, r * 3, X => { g.save(); g.translate(X, y); g.scale(2.6, 0.36); K.glow(g, 0, 0, r, 'rgba(200,180,245,0.11)'); g.restore(); });
    }
    g.restore();
    // 땅 윗선 (달빛 테두리)와 가시 덩굴
    g.strokeStyle = 'rgba(190,170,240,0.6)'; g.lineWidth = 3;
    g.beginPath(); for (let x = 0; x <= W; x += 3) x ? g.lineTo(x, groundY(x)) : g.moveTo(x, groundY(x)); g.stroke();
    for (let x = 0; x < W; x += 7) {
      const y = groundY(x), h = K.rr(4, 10);
      g.fillStyle = K.rnd() < 0.5 ? '#3a2456' : '#4e3270';
      g.beginPath(); g.moveTo(x - 2, y + 2); g.lineTo(x + K.rr(-2, 2), y - h); g.lineTo(x + 3, y + 2); g.closePath(); g.fill();
    }
    // 바닥 촛불 (반짝임은 매 프레임)
    [[60, GY + 30], [452, GY + 96], [600, GY + 34], [900, GY + 72]].forEach(([x, y]) => candle(g, x, y, K.rr(8, 13), 'ground'));
    [[180, GY + 66], [520, GY + 52], [800, GY + 92]].forEach(([x, y]) => K.drawShard(g, x, y));
  });

  return {
    sky, far, mid, near, ground, fall: null, clouds: false, mote: 'custom',
    rayX: 760, rayDir: -1, rayRgb: '200,180,255', front: ['rgba(34,18,54,0.94)', 'rgba(58,32,86,0.92)'],
    moteCount: 30,
    // 보라 도깨비불(대부분)과 작은 박쥐
    moteMake: anywhere => K.rnd() < 0.22
      ? { t: 'bat', x: anywhere ? K.rr(0, W) : W + K.rr(20, 160), y: K.rr(50, 250), vx: K.rr(-130, -70), ph: K.rr(0, TAU), s: K.rr(0.7, 1.15) }
      : { t: 'wisp', x: K.rr(0, W), y: K.rr(200, H - 30), vx: K.rr(-14, 14), vy: K.rr(-10, 4), ph: K.rr(0, TAU), r: K.rr(2, 3.4), age: 0, life: K.rr(6, 14) },
    moteDraw: (ctx, p, dt) => {
      if (p.t === 'bat') {
        p.x += p.vx * dt; p.ph += dt * 14;
        if (p.x < -30) return false;
        const y = p.y + Math.sin(p.ph * 0.18) * 12, f = Math.sin(p.ph);
        ctx.translate(p.x, y); ctx.scale(p.s, p.s);
        ctx.fillStyle = 'rgba(26,14,42,0.9)';
        for (const s of [-1, 1]) {
          ctx.beginPath(); ctx.moveTo(s * 2, -1);
          ctx.quadraticCurveTo(s * 8, -5 - f * 6, s * 14, -2 - f * 7);
          ctx.quadraticCurveTo(s * 11, 1, s * 9, 3); ctx.quadraticCurveTo(s * 6, 1, s * 2, 3); ctx.closePath(); ctx.fill();
        }
        ctx.beginPath(); ctx.ellipse(0, 0, 3.6, 3.2, 0, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.moveTo(-3, -2); ctx.lineTo(-2.4, -5.5); ctx.lineTo(-0.8, -2.5); ctx.moveTo(3, -2); ctx.lineTo(2.4, -5.5); ctx.lineTo(0.8, -2.5); ctx.fill();
        ctx.fillStyle = 'rgba(255,130,210,0.95)'; ctx.fillRect(-2.2, -1, 1.3, 1.3); ctx.fillRect(0.9, -1, 1.3, 1.3);
        return true;
      }
      p.ph += dt * 1.5; p.life -= dt; p.age += dt;
      p.x += (p.vx + Math.sin(p.ph) * 10) * dt; p.y += (p.vy + Math.cos(p.ph * 0.7) * 8) * dt;
      if (p.life <= 0 || p.x < -20 || p.x > W + 20 || p.y < 120 || p.y > H) return false;
      const a = (0.45 + 0.55 * Math.max(0, Math.sin(p.ph * 1.6))) * Math.min(1, p.age, p.life / 1.5);
      ctx.fillStyle = `rgba(190,110,255,${a * 0.28})`;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 4.5, 0, TAU); ctx.fill();
      ctx.fillStyle = `rgba(210,160,255,${a * 0.55})`;
      ctx.beginPath(); ctx.ellipse(p.x, p.y - p.r * 1.6, p.r * 0.75, p.r * 1.8, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = `rgba(245,225,255,${a})`;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill();
      return true;
    },
  };
});

// 챕터 10 별의 제단 — 배경
// 깊은 우주: 성운과 별, 하늘을 가득 채운 금 간 별. 멀리 떠 있는 바위섬과 행성,
// 가운데 수정 기둥과 옛 별 제단 아치, 가까이 빛나는 수정 무리와 떠도는 룬, 별자리가 새겨진 수정 바닥.
Scenery.addTheme('cosmos', (K, cur) => {
  const { W, H, GY, TAU, rnd, rr, wave, canvas, ridge, wrap, vgrad, glow, blob } = K;
  const SX = 560, SY = 118;                   // 금 간 거대한 별의 자리

  // 네 갈래 반짝임
  function sparkle(g, x, y, s, c) {
    g.fillStyle = c; g.beginPath();
    g.moveTo(x, y - s); g.quadraticCurveTo(x, y, x + s, y); g.quadraticCurveTo(x, y, x, y + s);
    g.quadraticCurveTo(x, y, x - s, y); g.quadraticCurveTo(x, y, x, y - s);
    g.fill();
  }
  // 다섯 갈래 별 (외곽선 없음)
  function star5(g, x, y, r, c) {
    g.fillStyle = c; g.beginPath();
    for (let i = 0; i < 10; i++) {
      const d = i % 2 ? r * 0.45 : r, a = -Math.PI / 2 + i * Math.PI / 5;
      i ? g.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d) : g.moveTo(x + Math.cos(a) * d, y + Math.sin(a) * d);
    }
    g.closePath(); g.fill();
  }
  // 수정 하나 (밑 가운데 x, 바닥 y, 폭 w, 높이 h, 끝 기울기 lean)
  function crystal(g, x, y, w, h, lean, c1, c2, edge) {
    const tx = x + lean, ty = y - h, sh = Math.min(h * 0.22, w * 0.9);
    g.fillStyle = vgrad(g, ty, y, [[0, c1], [1, c2]]);
    g.beginPath(); g.moveTo(x - w / 2, y); g.lineTo(tx - w / 2, ty + sh); g.lineTo(tx, ty); g.lineTo(tx + w / 2, ty + sh); g.lineTo(x + w / 2, y); g.closePath(); g.fill();
    g.fillStyle = 'rgba(20,10,60,0.3)';           // 오른쪽 면 그늘
    g.beginPath(); g.moveTo(x + w * 0.08, y); g.lineTo(tx + w * 0.08, ty + sh); g.lineTo(tx, ty); g.lineTo(tx + w / 2, ty + sh); g.lineTo(x + w / 2, y); g.closePath(); g.fill();
    if (edge) {                                    // 왼쪽 모서리 빛
      g.strokeStyle = edge; g.lineWidth = Math.max(1, w * 0.08);
      g.beginPath(); g.moveTo(x - w * 0.3, y); g.lineTo(tx - w * 0.3, ty + sh); g.lineTo(tx, ty + 1); g.stroke();
    }
  }
  // 고리 행성 (ring = 고리 색 또는 null)
  function planet(g, x, y, r, cols, ring) {
    const ringHalf = (a0, a1) => {
      g.save(); g.translate(x, y); g.rotate(-0.22);
      g.strokeStyle = ring; g.lineWidth = r * 0.14; g.beginPath(); g.ellipse(0, 0, r * 1.85, r * 0.42, 0, a0, a1); g.stroke();
      g.strokeStyle = 'rgba(255,255,255,0.25)'; g.lineWidth = r * 0.04; g.beginPath(); g.ellipse(0, 0, r * 1.62, r * 0.35, 0, a0, a1); g.stroke();
      g.restore();
    };
    if (ring) ringHalf(Math.PI, TAU);
    const gr = g.createRadialGradient(x - r * 0.4, y - r * 0.45, r * 0.1, x, y, r);
    gr.addColorStop(0, cols[0]); gr.addColorStop(0.6, cols[1]); gr.addColorStop(1, cols[2]);
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    g.save(); g.beginPath(); g.arc(x, y, r, 0, TAU); g.clip();
    g.translate(x, y); g.rotate(-0.22);
    g.fillStyle = 'rgba(255,255,255,0.13)';
    [-0.5, -0.12, 0.3].forEach(k => g.fillRect(-r, r * k, r * 2, r * 0.13));
    g.fillStyle = 'rgba(30,10,70,0.28)';           // 그늘 쪽
    g.beginPath(); g.rect(-r * 2, -r * 2, r * 4, r * 4); g.arc(-r * 0.2, -r * 0.25, r * 1.05, 0, TAU); g.fill('evenodd');
    g.restore();
    if (ring) ringHalf(0, Math.PI);
  }
  // 떠 있는 바위섬 (위는 수정, 아래는 뾰족한 바위)
  function rockIsle(g, x, y, w, top, side, dark, cr) {
    g.fillStyle = vgrad(g, y, y + w * 0.85, [[0, side], [1, dark]]);
    g.beginPath(); g.moveTo(x - w / 2, y);
    g.quadraticCurveTo(x - w * 0.42, y + w * 0.28, x - w * 0.2, y + w * 0.42);
    g.lineTo(x - w * 0.05, y + w * 0.85); g.lineTo(x + w * 0.08, y + w * 0.5);
    g.lineTo(x + w * 0.2, y + w * 0.6); g.lineTo(x + w * 0.26, y + w * 0.34);
    g.quadraticCurveTo(x + w * 0.44, y + w * 0.2, x + w / 2, y); g.closePath(); g.fill();
    crystal(g, x - w * 0.16, y + 1, w * 0.13, w * 0.34, -2, cr[0], cr[1]);
    crystal(g, x + w * 0.06, y + 1, w * 0.09, w * 0.22, 2, cr[0], cr[1]);
    crystal(g, x + w * 0.24, y + 1, w * 0.07, w * 0.14, 1, cr[0], cr[1]);
    g.fillStyle = top; g.beginPath(); g.ellipse(x, y, w / 2, w * 0.09, 0, 0, TAU); g.fill();
  }

  // ── 하늘 (움직이지 않음) ──
  const sky = canvas(W, H, g => {
    g.fillStyle = vgrad(g, 0, GY, [[0, '#080620'], [0.32, '#171045'], [0.62, '#36226e'], [0.85, '#6e3c8e'], [1, '#c06a9e']]);
    g.fillRect(0, 0, W, H);
    K.setSeed(1010);
    // 성운 (보라·청록·분홍)
    [[150, 120, 190, '130,80,230', 0.3], [330, 250, 160, '60,200,210', 0.2], [860, 240, 210, '255,110,180', 0.22], [900, 70, 150, '80,200,230', 0.18],
      [470, 330, 260, '210,90,200', 0.18], [40, 320, 170, '255,120,190', 0.16], [770, 60, 140, '150,110,255', 0.2]].forEach(([x, y, r, c, a]) => {
      for (let i = 0; i < 6; i++) glow(g, x + rr(-r, r) * 0.5, y + rr(-r, r) * 0.25, r * rr(0.45, 0.9), `rgba(${c},${a})`);
    });
    // 은하수 띠
    g.save(); g.translate(480, 210); g.rotate(-0.28);
    for (let i = 0; i < 46; i++) glow(g, rr(-600, 600), rr(-26, 26), rr(26, 64), 'rgba(225,210,255,0.07)');
    for (let i = 0; i < 160; i++) blob(g, rr(-600, 600), rr(-40, 40) * rnd(), rr(0.4, 1.1), `rgba(255,250,240,${rr(0.3, 0.8).toFixed(2)})`);
    g.restore();
    // 별
    for (let i = 0; i < 300; i++) {
      const x = rr(0, W), y = rr(0, GY - 30), r = rr(0.4, 1.3), a = rr(0.35, 1) * (1 - y / 600);
      blob(g, x, y, r, `rgba(255,${rr(235, 255) | 0},${rr(215, 255) | 0},${a.toFixed(2)})`);
    }
    for (let i = 0; i < 22; i++) {
      const x = rr(0, W), y = rr(10, 300), s = rr(3, 7);
      glow(g, x, y, s * 2.4, 'rgba(220,220,255,0.35)'); sparkle(g, x, y, s, 'rgba(255,255,255,0.9)');
    }
    // 금 간 거대한 별 — 하늘의 주인공
    glow(g, SX, SY, 400, 'rgba(255,225,190,0.16)');
    for (let i = 0; i < 12; i++) {                 // 별에서 뻗는 빛살
      const a = i * TAU / 12 + 0.3, len = i % 2 ? 260 : 380, sw = i % 2 ? 0.05 : 0.07;
      const fade = g.createRadialGradient(SX, SY, 0, SX, SY, len);
      fade.addColorStop(0, 'rgba(255,240,210,0.16)'); fade.addColorStop(1, 'rgba(255,240,210,0)');
      g.fillStyle = fade;
      g.beginPath(); g.moveTo(SX, SY); g.lineTo(SX + Math.cos(a - sw) * len, SY + Math.sin(a - sw) * len); g.lineTo(SX + Math.cos(a + sw) * len, SY + Math.sin(a + sw) * len); g.closePath(); g.fill();
    }
    g.strokeStyle = 'rgba(255,236,200,0.22)'; g.lineWidth = 2; g.beginPath(); g.arc(SX, SY, 172, 0, TAU); g.stroke();
    g.strokeStyle = 'rgba(180,230,255,0.12)'; g.lineWidth = 8; g.beginPath(); g.arc(SX, SY, 214, 0, TAU); g.stroke();
    g.save(); g.translate(SX, SY); g.scale(3, 3);
    K.drawCrackedStar(g, 0, 0);
    // 금 사이로 새어 나오는 하늘빛과 공허
    const crack = () => {
      g.beginPath();
      g.moveTo(-2, -30); g.lineTo(4, -10); g.lineTo(-3, 2); g.lineTo(8, 14); g.lineTo(20, 22);
      g.moveTo(4, -10); g.lineTo(16, -6); g.moveTo(-3, 2); g.lineTo(-16, 8);
    };
    g.strokeStyle = 'rgba(150,225,255,0.5)'; g.lineWidth = 2.2; crack(); g.stroke();
    g.strokeStyle = 'rgba(70,30,140,0.85)'; g.lineWidth = 0.6; crack(); g.stroke();
    g.restore();
    // 세상으로 떨어지는 조각들
    [[SX - 140, SY + 104, 5], [SX - 200, SY + 160, 3.5], [SX - 76, SY + 140, 4], [SX + 150, SY - 50, 3], [SX - 260, SY + 214, 2.6], [SX + 230, SY + 30, 2.4]].forEach(([x, y, s]) => {
      g.strokeStyle = 'rgba(255,240,200,0.18)'; g.lineWidth = s * 0.8;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + (x - SX) * 0.25, y + (y - SY) * 0.25 - 4); g.stroke();
      glow(g, x, y, s * 4, 'rgba(255,240,190,0.6)');
      g.fillStyle = '#fff4c8'; g.beginPath(); g.moveTo(x, y - s); g.lineTo(x + s * 0.7, y); g.lineTo(x, y + s); g.lineTo(x - s * 0.7, y); g.closePath(); g.fill();
    });
    // 지평선 쪽 분홍 빛
    g.fillStyle = vgrad(g, 250, GY, [[0, 'rgba(255,150,210,0)'], [1, 'rgba(255,170,215,0.3)']]);
    g.fillRect(0, 250, W, GY - 250);
  });

  // ── 먼 곳: 행성과 떠 있는 바위섬 (흐릿하게) ──
  const far = canvas(W, H, g => {
    K.setSeed(1020);
    planet(g, 200, 296, 60, ['#f4c8e6', '#b67ec6', '#6e4296'], 'rgba(240,205,245,0.55)');
    planet(g, 905, 238, 14, ['#e0fbf8', '#7cc6d2', '#4a7aa8'], null);
    [[70, 256, 80], [330, 222, 50], [500, 292, 40], [790, 236, 90]].forEach(([x, y, w]) => wrap(x, w, X =>
      rockIsle(g, X, y, w, '#a894d8', '#7a66b4', '#56448e', ['#e2d6ff', '#8a74cc'])));
    // 먼 수정 산등성이
    const fy = x => 322 + wave(x, [[2, 12, 0.6], [5, 7, 1.9], [11, 4, 0.4]]);
    ridge(g, fy, vgrad(g, 290, 380, [[0, '#6a54a8'], [1, '#8a6cb8']]));
    for (let i = 0; i < 16; i++) {
      const x = rr(0, W), h = rr(16, 46), w = rr(7, 13), lean = rr(-4, 4);
      wrap(x, 20, X => crystal(g, X, fy(X) + 5, w, h, lean, '#b4a0e6', '#6a54a8'));
    }
    // 공기 원근 (아래쪽은 성운빛 안개)
    g.fillStyle = vgrad(g, 230, 380, [[0, 'rgba(200,140,210,0)'], [1, 'rgba(205,150,215,0.38)']]);
    g.fillRect(0, 230, W, 150);
  });

  // ── 가운데: 수정 기둥과 옛 별 제단 아치 ──
  function column(g, x, base, w, h, lean, broken) {
    crystal(g, x, base, w, h, lean, '#9886d8', '#3e3282', 'rgba(220,228,255,0.5)');
    if (broken) {                                  // 부러진 끝
      g.fillStyle = '#2a2266';
      g.beginPath(); g.moveTo(x + lean - w * 0.6, base - h - 2); g.lineTo(x + lean + w * 0.6, base - h - 2); g.lineTo(x + lean + w * 0.6, base - h + h * 0.18);
      g.lineTo(x + lean + w * 0.15, base - h + h * 0.1); g.lineTo(x + lean - w * 0.1, base - h + h * 0.2); g.lineTo(x + lean - w * 0.6, base - h + h * 0.12); g.closePath();
      g.globalCompositeOperation = 'destination-out'; g.fill(); g.globalCompositeOperation = 'source-over';
    } else glow(g, x + lean, base - h, 22, 'rgba(210,200,255,0.35)');
  }
  function arch(g, x, base, w, colH, broken) {
    const cw = w * 0.16, ay = base - colH, R = w / 2;
    const st = vgrad(g, ay - R, base, [[0, '#a292d8'], [1, '#4c3e8a']]);
    g.fillStyle = st;
    g.fillRect(x - R, ay, cw, colH);
    g.fillRect(x + R - cw, broken ? ay + colH * 0.35 : ay, cw, broken ? colH * 0.65 : colH);
    g.beginPath(); g.arc(x, ay, R, Math.PI, broken ? Math.PI * 1.62 : TAU);
    g.arc(x, ay, R - cw, broken ? Math.PI * 1.62 : TAU, Math.PI, true); g.closePath(); g.fill();
    g.fillStyle = 'rgba(30,18,80,0.3)';
    g.fillRect(x - R + cw * 0.6, ay, cw * 0.4, colH);
    g.fillRect(x + R - cw * 0.4, broken ? ay + colH * 0.35 : ay, cw * 0.4, broken ? colH * 0.65 : colH);
    g.fillStyle = '#d2c8f6';                        // 기둥머리와 받침
    g.fillRect(x - R - 4, ay - 3, cw + 8, 6); g.fillRect(x - R - 5, base - 7, cw + 10, 7);
    if (!broken) g.fillRect(x + R - cw - 4, ay - 3, cw + 8, 6);
    g.fillRect(x + R - cw - 5, base - 7, cw + 10, 7);
    g.fillStyle = 'rgba(255,225,150,0.7)';          // 금빛 띠
    g.fillRect(x - R, ay + colH * 0.3, cw, 2); g.fillRect(x + R - cw, ay + colH * 0.5, cw, 2);
    if (!broken) {                                  // 이맛돌의 별
      const ky = ay - R + cw / 2;
      glow(g, x, ky, 34, 'rgba(255,230,160,0.5)');
      star5(g, x, ky, cw * 0.62, '#ffefb8');
    }
    // 기둥의 빛나는 룬
    g.fillStyle = 'rgba(190,225,255,0.85)';
    [0.45, 0.65].forEach(k => { g.fillRect(x - R + cw / 2 - 1, ay + colH * k, 2, 6); g.fillRect(x - R + cw / 2 - 3, ay + colH * k + 2, 6, 2); });
  }
  const mid = canvas(W, H, g => {
    K.setSeed(1030);
    const my = x => 346 + wave(x, [[3, 9, 1.4], [8, 4, 0.2]]);
    ridge(g, my, vgrad(g, 320, 400, [[0, '#4c3e8c'], [1, '#5e4e9e']]));
    g.strokeStyle = 'rgba(195,185,255,0.5)'; g.lineWidth = 2;
    g.beginPath(); for (let x = 0; x <= W; x += 3) x ? g.lineTo(x, my(x)) : g.moveTo(x, my(x)); g.stroke();
    [[40, 128, 26, -4, false], [130, 150, 32, 3, false], [196, 92, 20, 6, true], [470, 104, 24, -3, true], [575, 140, 28, 4, false], [630, 86, 18, -5, false], [900, 132, 28, -2, false]]
      .forEach(([x, h, w, lean, br]) => wrap(x, w, X => column(g, X, my(X) + 8, w, h, lean, br)));
    arch(g, 320, my(320) + 8, 150, 78, false);
    arch(g, 780, my(780) + 8, 112, 62, true);
    // 아래쪽 안개
    g.fillStyle = vgrad(g, 290, 380, [[0, 'rgba(190,170,240,0)'], [0.6, 'rgba(190,170,240,0.28)'], [1, 'rgba(190,170,240,0)']]);
    g.fillRect(0, 290, W, 90);
  });

  // ── 가까운 곳: 별의 제단, 빛나는 수정 무리, 떠도는 룬 ──
  const CRY = { cyan: ['#dcfcff', '#3a9ec8', '150,235,255'], pink: ['#ffe2f4', '#c05aa8', '255,170,230'], violet: ['#efe4ff', '#6a4ac8', '200,170,255'] };
  const nx = x => ((x % W) + W) % W;
  function cluster(g, x, y, s, c) {
    glow(g, x, y - 28 * s, 54 * s, `rgba(${c[2]},0.32)`);
    [[-14, 28, 9, -5], [-6, 18, 7, -9], [0, 52, 13, 2], [12, 36, 10, 6], [22, 16, 6, 9]].forEach(([dx, h, w, lean]) =>
      crystal(g, x + dx * s, y + 2, w * s, h * s, lean * s, c[0], c[1], 'rgba(255,255,255,0.65)'));
  }
  function clusterLights(x, y, s, c) {
    K.light(nx(x + 2 * s), y - 50 * s, 'near', c[2], 3.2);
    K.light(nx(x + 18 * s), y - 32 * s, 'near', c[2], 2.4);
    K.light(nx(x - 19 * s), y - 24 * s, 'near', c[2], 2.2);
  }
  function altar(g, x, base) {
    [[236, '#6a5cb0', '#4a3e8a'], [184, '#7a6cc0', '#54489a'], [132, '#8a7cd0', '#5e52a8']].forEach(([w, c1, c2], i) => {
      const y = base - 16 * (i + 1);
      g.fillStyle = vgrad(g, y, y + 16, [[0, c1], [1, c2]]); g.fillRect(x - w / 2, y, w, 16);
      g.fillStyle = 'rgba(225,215,255,0.55)'; g.fillRect(x - w / 2, y, w, 2.5);
      g.fillStyle = 'rgba(255,220,140,0.6)'; g.fillRect(x - w / 2 + 6, y + 9, w - 12, 1.5);
    });
    const top = base - 48;
    [-52, 52].forEach(dx => {                       // 별을 받친 두 기둥
      const px = x + dx;
      g.fillStyle = vgrad(g, top - 76, top, [[0, '#b4a8ea'], [1, '#6a5cb0']]); g.fillRect(px - 9, top - 70, 18, 70);
      g.fillStyle = 'rgba(30,20,80,0.3)'; g.fillRect(px + 3, top - 70, 6, 70);
      g.fillStyle = '#d4caf8'; g.fillRect(px - 13, top - 76, 26, 7); g.fillRect(px - 12, top - 6, 24, 6);
      glow(g, px, top - 90, 22, 'rgba(255,235,170,0.6)'); star5(g, px, top - 90, 9, '#fff2c0');
      K.light(px, top - 90, 'near', '255,240,190', 3.5);
    });
    const cy = top - 104;                           // 떠 있는 고리: 별조각 열 개가 들어갈 자리
    g.fillStyle = vgrad(g, cy, top, [[0, 'rgba(255,245,210,0.35)'], [1, 'rgba(255,245,210,0)']]); g.fillRect(x - 16, cy, 32, top - cy);
    glow(g, x, cy, 92, 'rgba(190,220,255,0.32)');
    g.strokeStyle = 'rgba(255,225,150,0.9)'; g.lineWidth = 5; g.beginPath(); g.arc(x, cy, 46, 0, TAU); g.stroke();
    g.strokeStyle = 'rgba(200,230,255,0.7)'; g.lineWidth = 2; g.beginPath(); g.arc(x, cy, 36, 0, TAU); g.stroke();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + i * TAU / 10, px = x + Math.cos(a) * 46, py = cy + Math.sin(a) * 46;
      g.fillStyle = '#fff4cc'; g.beginPath(); g.moveTo(px, py - 5); g.lineTo(px + 3.5, py); g.lineTo(px, py + 5); g.lineTo(px - 3.5, py); g.closePath(); g.fill();
    }
    glow(g, x, cy, 42, 'rgba(255,250,220,0.85)');
    star5(g, x, cy, 17, '#fffbe8');
    K.light(x, cy, 'near', '255,245,210', 30);
  }
  function rune(g, x, y, k, rgb) {
    glow(g, x, y, 18, `rgba(${rgb},0.4)`);
    g.strokeStyle = `rgba(${rgb},0.9)`; g.lineWidth = 1.8; g.beginPath();
    if (k === 0) { g.arc(x, y, 6, 0, TAU); g.moveTo(x, y - 9); g.lineTo(x, y + 9); }
    else if (k === 1) { g.moveTo(x - 6, y + 6); g.lineTo(x, y - 7); g.lineTo(x + 6, y + 6); g.closePath(); g.moveTo(x - 3, y + 1); g.lineTo(x + 3, y + 1); }
    else if (k === 2) { g.moveTo(x - 6, y - 6); g.lineTo(x + 6, y + 6); g.moveTo(x + 6, y - 6); g.lineTo(x - 6, y + 6); g.moveTo(x - 8, y); g.lineTo(x + 8, y); }
    else { g.moveTo(x, y - 8); g.lineTo(x + 6, y); g.lineTo(x, y + 8); g.lineTo(x - 6, y); g.closePath(); g.moveTo(x + 2.5, y); g.arc(x, y, 2.5, 0, TAU); }
    g.stroke();
  }
  const near = canvas(W, H, g => {
    K.setSeed(1040);
    const hy = x => 382 + wave(x, [[2, 11, 0.9], [5, 6, 2.6], [9, 3, 0.7]]);
    ridge(g, hy, vgrad(g, 350, 430, [[0, '#30296a'], [1, '#221c50']]));
    g.strokeStyle = 'rgba(165,175,255,0.75)'; g.lineWidth = 2.5;
    g.beginPath(); for (let x = 0; x <= W; x += 3) x ? g.lineTo(x, hy(x)) : g.moveTo(x, hy(x)); g.stroke();
    altar(g, 690, hy(690) + 8);
    [[70, 1.0, CRY.pink], [250, 0.8, CRY.cyan], [420, 1.1, CRY.violet], [532, 0.7, CRY.cyan], [915, 0.95, CRY.pink]].forEach(([x, s, c]) => {
      const y = hy(x) + 6;
      wrap(x, 50, X => cluster(g, X, y, s, c));
      clusterLights(x, y, s, c);
    });
    // 떠도는 룬
    const rgbs = ['170,220,255', '255,200,240', '220,200,255'];
    for (let i = 0, n = 0; i < 40 && n < 9; i++) {
      const x = rr(20, W - 20), y = rr(170, 320), k = Math.floor(rnd() * 4), c = rgbs[Math.floor(rnd() * 3)];
      if (x > 560 && x < 820) continue;             // 제단 둘레는 비워 둠
      rune(g, x, y, k, c); K.light(x, y, 'near', c, 2.4); n++;
    }
  });

  // ── 땅: 별자리가 새겨진 수정 바닥 ──
  const ground = canvas(W, H, g => {
    K.setSeed(1050);
    const gy = x => GY - 4 + wave(x, [[5, 2, 0.3], [12, 1.4, 1.1]]);
    ridge(g, gy, vgrad(g, GY - 8, H, [[0, '#6a64c0'], [0.07, '#3c3680'], [0.5, '#262058'], [1, '#141032']]));
    // 수정 바닥 무늬 (가로 80마다 반복이라 이음매 없음)
    g.save(); g.beginPath(); g.rect(0, GY + 4, W, H - GY - 4); g.clip();
    g.strokeStyle = 'rgba(160,150,240,0.13)'; g.lineWidth = 1.5;
    for (let k = -8; k <= 20; k++) {
      g.beginPath(); g.moveTo(k * 80, GY); g.lineTo(k * 80 + (H - GY) * 0.9, H);
      g.moveTo(k * 80, GY); g.lineTo(k * 80 - (H - GY) * 0.9, H); g.stroke();
    }
    g.restore();
    g.strokeStyle = 'rgba(195,205,255,0.85)'; g.lineWidth = 2;
    g.beginPath(); for (let x = 0; x <= W; x += 3) x ? g.lineTo(x, gy(x)) : g.moveTo(x, gy(x)); g.stroke();
    // 땅 가장자리의 작은 수정
    for (let i = 0; i < 22; i++) {
      const x = rr(0, W), h = rr(6, 16), w = rr(4, 7), lean = rr(-2, 2), c = rnd() < 0.5 ? ['#dcfcff', '#4aa8d0'] : ['#efe4ff', '#7a5ad0'];
      wrap(x, 12, X => crystal(g, X, gy(X) + 4, w, h, lean, c[0], c[1]));
    }
    // 별가루
    for (let i = 0; i < 170; i++) blob(g, rr(0, W), rr(GY + 8, H - 2), rr(0.5, 1.3), `rgba(230,235,255,${rr(0.2, 0.6).toFixed(2)})`);
    for (let i = 0; i < 12; i++) { const x = rr(10, W - 10), y = rr(GY + 20, H - 10); sparkle(g, x, y, rr(2.5, 4.5), 'rgba(240,245,255,0.7)'); }
    // 별자리
    const cons = [[96, GY + 62, [[0, 0], [26, -14], [52, -6], [70, 14], [44, 26]]], [370, GY + 94, [[0, 0], [22, 12], [48, 4], [64, 22], [90, 16], [112, 30]]],
      [640, GY + 50, [[0, 0], [30, 10], [24, 36], [56, 40]]], [850, GY + 100, [[0, 0], [20, -16], [46, -12], [62, -30]]]];
    cons.forEach(([cx, cy, pts]) => {
      wrap(cx, 120, X => {
        g.strokeStyle = 'rgba(170,215,255,0.45)'; g.lineWidth = 1.3; g.beginPath();
        pts.forEach(([dx, dy], i) => i ? g.lineTo(X + dx, cy + dy) : g.moveTo(X + dx, cy + dy)); g.stroke();
        pts.forEach(([dx, dy], i) => { glow(g, X + dx, cy + dy, 8, 'rgba(200,230,255,0.7)'); blob(g, X + dx, cy + dy, i % 2 ? 1.6 : 2.3, '#f4faff'); });
      });
      pts.forEach(([dx, dy], i) => { if (i % 2 === 0) K.light(nx(cx + dx), cy + dy, 'ground', '210,235,255', 2.2); });
    });
    // 바닥에 박힌 별조각
    [[240, GY + 68], [540, GY + 38], [790, GY + 88]].forEach(([x, y]) => K.drawShard(g, x, y));
  });

  // ── 반짝이는 별가루 (천천히 떠오르며 깜빡임) ──
  const DUST = ['255,245,210', '255,245,210', '190,230,255', '255,195,235'];
  const moteMake = anywhere => {
    const max = rr(4, 9);
    return { x: rr(0, W), y: rr(30, H - 20), vx: rr(-14, -3), vy: rr(-12, -3), ph: rr(0, TAU), sp: rr(2, 4.5), r: rr(0.9, 2.2),
      c: DUST[Math.floor(rnd() * DUST.length)], max, life: anywhere ? rr(0.5, max) : max };
  };
  const moteDraw = (ctx, p, dt) => {
    p.life -= dt; p.ph += dt * p.sp; p.x += p.vx * dt; p.y += p.vy * dt;
    if (p.life <= 0 || p.x < -10 || p.y < -10) return false;
    const a = Math.sin(Math.PI * p.life / p.max) * (0.45 + 0.55 * Math.max(0, Math.sin(p.ph)));
    const s = p.r * (2.2 + Math.sin(p.ph) * 0.8);
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = `rgba(${p.c},${(a * 0.22).toFixed(3)})`;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 3.6, 0, TAU); ctx.fill();
    ctx.fillStyle = `rgba(${p.c},${a.toFixed(3)})`;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - s); ctx.quadraticCurveTo(p.x, p.y, p.x + s, p.y); ctx.quadraticCurveTo(p.x, p.y, p.x, p.y + s);
    ctx.quadraticCurveTo(p.x, p.y, p.x - s, p.y); ctx.quadraticCurveTo(p.x, p.y, p.x, p.y - s);
    ctx.fill();
  };

  return { sky, far, mid, near, ground, fall: null, clouds: false, mote: 'custom', rayX: 600, rayDir: -1, rayRgb: '225,215,255',
    front: ['rgba(28,26,74,0.92)', 'rgba(50,44,108,0.92)'], moteCount: 36, moteMake, moteDraw };
});

