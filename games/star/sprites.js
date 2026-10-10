// 별의 설화 — 도트 그림 (코드로 그림)
// sprites/ 폴더에 같은 이름의 PNG(예: hero_m.png)를 넣으면 그 그림이 대신 쓰인다.
'use strict';

const SPRITE_SIZE = 32;

// 그림 그리는 도구: p(x, y, 너비, 높이, 색)
function makeSprite(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  const p = (x, y, ww, hh, col) => { g.fillStyle = col; g.fillRect(x, y, ww || 1, hh || 1); };
  draw(p, g);
  outline(c, '#1a1424');
  return c;
}

// 그림 바깥에 1픽셀 테두리를 자동으로 그린다
function outline(c, col) {
  const g = c.getContext('2d');
  const { width: w, height: h } = c;
  const src = g.getImageData(0, 0, w, h).data;
  const solid = (x, y) => x >= 0 && y >= 0 && x < w && y < h && src[(y * w + x) * 4 + 3] > 0;
  g.fillStyle = col;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (solid(x, y)) continue;
    if (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1)) g.fillRect(x, y, 1, 1);
  }
}

// 타원 채우기 (슬라임 몸 같은 둥근 모양)
function ellipse(p, cx, cy, rx, ry, col, cut) {
  for (let y = -ry; y <= ry; y++) for (let x = -rx; x <= rx; x++) {
    if ((x * x) / (rx * rx) + (y * y) / (ry * ry) > 1) continue;
    if (cut && !cut(cx + x, cy + y)) continue;
    p(cx + x, cy + y, 1, 1, col);
  }
}

// ── 주인공 (오른쪽을 봄) ─────────────────────────
function drawHero(gender) {
  const f = gender === 'f';
  const skin = '#f4cba3', skinD = '#d9a47c';
  const hair = f ? '#e6a64a' : '#6b3e22', hairD = f ? '#b87a2a' : '#4a2916';
  const cloth = f ? '#8b55c2' : '#3d70b8', clothD = f ? '#653a95' : '#2a5090';
  return makeSprite(32, 32, p => {
    // 뒤쪽 긴 머리 (여자)
    if (f) { p(9, 9, 4, 12, hairD); p(10, 20, 3, 2, hairD); }
    // 다리와 신발
    p(12, 25, 3, 4, '#4a3b2a'); p(17, 25, 3, 4, '#4a3b2a');
    p(11, 28, 4, 2, '#5a3a20'); p(17, 28, 4, 2, '#5a3a20');
    // 망토 (뒤)
    p(10, 16, 2, 9, '#a63a3a'); p(9, 20, 2, 5, '#8a2e2e');
    // 몸통 (튜닉)
    p(12, 16, 8, 8, cloth); p(12, 16, 2, 8, clothD);
    if (f) { p(11, 22, 10, 3, cloth); p(11, 24, 10, 1, clothD); }
    // 허리띠
    p(12, 22, 8, 1, '#6b4a2b'); p(16, 22, 1, 1, '#f0c95a');
    // 뒷팔
    p(11, 17, 2, 5, clothD); p(11, 22, 2, 1, skinD);
    // 머리
    p(12, 7, 8, 9, skin); p(12, 14, 8, 2, skinD);
    p(20, 10, 1, 3, skin); // 코
    // 눈
    p(18, 10, 1, 2, '#2a1d1a');
    if (f) p(19, 9, 1, 1, '#2a1d1a');
    p(17, 13, 2, 1, '#c0806a'); // 입
    // 앞머리
    p(11, 5, 10, 3, hair); p(11, 8, 3, 3, hair); p(14, 8, 2, 1, hair); p(19, 8, 2, 1, hair);
    p(12, 4, 7, 1, hair); p(11, 5, 2, 1, hairD);
    if (f) { p(11, 8, 2, 8, hair); p(20, 6, 1, 3, '#7ad0ff'); } // 머리핀
    else { p(18, 4, 2, 1, hairD); }
    // 앞팔과 손
    p(19, 17, 2, 4, cloth); p(20, 20, 2, 2, skin);
    // 검
    p(21, 19, 3, 1, '#8b6b3a'); p(22, 20, 1, 2, '#6b4a2b');
    p(22, 7, 2, 12, '#cfd8e6'); p(22, 7, 1, 12, '#ffffff'); p(23, 6, 1, 1, '#cfd8e6');
  });
}

// ── 챕터 1 몬스터 (왼쪽을 봄) ───────────────────
function drawSlime() {
  return makeSprite(32, 32, p => {
    ellipse(p, 16, 22, 11, 8, '#55c46a', (x, y) => y <= 29);
    ellipse(p, 16, 23, 9, 5, '#6fd982');
    p(8, 29, 17, 1, '#3e9a52');
    p(10, 17, 3, 2, '#c8ffd2'); p(11, 16, 2, 1, '#ffffff'); // 반짝임
    p(11, 21, 2, 3, '#1d2a20'); p(16, 21, 2, 3, '#1d2a20');     // 눈
    p(11, 21, 1, 1, '#ffffff'); p(16, 21, 1, 1, '#ffffff');
    p(13, 26, 3, 1, '#2e6e3b');                                 // 입
  });
}

function drawMushroom() {
  return makeSprite(32, 32, p => {
    // 줄기 (몸)
    p(11, 17, 10, 11, '#f2e2c2'); p(18, 17, 3, 11, '#d8c49c');
    p(10, 28, 5, 2, '#8a5a3a'); p(17, 28, 5, 2, '#8a5a3a'); // 발
    // 얼굴
    p(12, 20, 2, 2, '#2a1d1a'); p(16, 20, 2, 2, '#2a1d1a');
    p(13, 24, 3, 1, '#a0604a');
    p(10, 22, 2, 1, '#f0a0a0'); // 볼
    // 갓
    ellipse(p, 16, 12, 12, 7, '#d8443c', (x, y) => y <= 16);
    p(4, 16, 24, 2, '#a82e2a');
    p(9, 8, 3, 3, '#fff3e6'); p(17, 6, 4, 3, '#fff3e6'); p(22, 11, 3, 2, '#fff3e6'); p(12, 13, 2, 2, '#fff3e6');
    // 머리 위 꽃
    p(15, 3, 1, 3, '#4a8a3a'); p(14, 2, 3, 1, '#ffd25e'); p(15, 1, 1, 3, '#ffd25e'); p(15, 2, 1, 1, '#ff8a3a');
  });
}

function drawBee() {
  return makeSprite(32, 32, p => {
    // 날개
    ellipse(p, 17, 9, 4, 5, '#d8f0ff'); ellipse(p, 22, 10, 3, 4, '#bfe4fb');
    // 몸통
    ellipse(p, 18, 18, 9, 6, '#f2c43a');
    p(15, 12, 2, 12, '#2a2020'); p(20, 13, 2, 11, '#2a2020');
    p(27, 17, 3, 2, '#2a2020'); // 침
    // 머리
    ellipse(p, 8, 17, 5, 5, '#f2c43a');
    p(5, 15, 2, 3, '#2a1d1a'); p(5, 15, 1, 1, '#ffffff');
    p(5, 20, 3, 1, '#a0604a');
    p(8, 10, 1, 3, '#2a2020'); p(7, 9, 1, 1, '#2a2020'); // 더듬이
    // 다리
    p(14, 24, 1, 3, '#2a2020'); p(19, 24, 1, 3, '#2a2020');
  });
}

// ── 챕터 1 보스: 거대 슬라임 왕 (64×64, 왼쪽을 봄) ──
function drawSlimeKing() {
  return makeSprite(64, 64, p => {
    ellipse(p, 32, 44, 27, 18, '#3a9a52', (x, y) => y <= 61);
    ellipse(p, 32, 45, 25, 15, '#55c46a');
    ellipse(p, 33, 48, 19, 10, '#6fd982');
    p(10, 61, 45, 1, '#2f8044');
    p(14, 34, 7, 3, '#c8ffd2'); p(16, 32, 4, 2, '#ffffff'); p(13, 38, 2, 3, '#c8ffd2');   // 반짝임
    // 화난 눈
    p(16, 42, 6, 7, '#1d2a20'); p(29, 42, 6, 7, '#1d2a20');
    p(17, 43, 2, 2, '#ffffff'); p(30, 43, 2, 2, '#ffffff');
    p(13, 38, 3, 1, '#1d2a20'); p(16, 39, 3, 1, '#1d2a20'); p(19, 40, 3, 1, '#1d2a20');
    p(29, 40, 3, 1, '#1d2a20'); p(32, 39, 3, 1, '#1d2a20'); p(35, 38, 3, 1, '#1d2a20');
    // 입과 송곳니
    p(19, 53, 14, 2, '#2e6e3b'); p(21, 55, 2, 2, '#ffffff'); p(29, 55, 2, 2, '#ffffff');
    // 왕관
    p(19, 21, 26, 7, '#f0c040'); p(19, 15, 4, 6, '#f0c040'); p(30, 11, 4, 10, '#f0c040'); p(41, 15, 4, 6, '#f0c040');
    p(19, 21, 26, 1, '#ffe27a'); p(31, 12, 2, 2, '#ffe27a'); p(20, 16, 2, 1, '#ffe27a'); p(42, 16, 2, 1, '#ffe27a');
    p(24, 23, 3, 3, '#e0405a'); p(31, 23, 3, 3, '#7ad0ff'); p(38, 23, 3, 3, '#e0405a');
    // 몸속에 삼킨 별조각
    p(40, 47, 3, 9, '#d6f3ff'); p(38, 49, 7, 5, '#d6f3ff'); p(41, 48, 1, 6, '#ffffff');
  });
}

// ── 동료: 미르 (견습 약초사, 오른쪽을 봄) ──
function drawMiru() {
  return makeSprite(32, 32, p => {
    p(12, 25, 3, 4, '#4a3b2a'); p(17, 25, 3, 4, '#4a3b2a');
    p(11, 28, 4, 2, '#5a3a20'); p(17, 28, 4, 2, '#5a3a20');
    // 초록 망토
    p(10, 15, 12, 11, '#4f9a5a'); p(10, 15, 3, 11, '#3d7a47'); p(11, 24, 10, 2, '#3d7a47');
    p(14, 17, 4, 7, '#f2e6c8');                                 // 앞치마
    p(15, 19, 2, 2, '#e0405a');                                 // 약초 주머니 단추
    // 머리
    p(12, 7, 8, 9, '#f4cba3'); p(12, 14, 8, 2, '#d9a47c');
    p(20, 10, 1, 3, '#f4cba3');
    p(18, 10, 1, 2, '#2a1d1a'); p(19, 9, 1, 1, '#2a1d1a');
    p(17, 13, 2, 1, '#c0806a');
    // 청록 단발
    p(11, 5, 10, 3, '#3fb4a8'); p(11, 8, 3, 6, '#3fb4a8'); p(14, 8, 2, 1, '#3fb4a8'); p(19, 8, 2, 2, '#3fb4a8');
    p(12, 4, 7, 1, '#3fb4a8'); p(11, 5, 2, 1, '#2a8a80'); p(11, 12, 2, 3, '#2a8a80');
    p(17, 4, 3, 2, '#ff9ac0');                                  // 꽃핀
    // 지팡이와 잎
    p(21, 8, 1, 21, '#8a5a34'); p(22, 6, 3, 3, '#6fd982'); p(20, 5, 2, 2, '#6fd982');
    p(20, 18, 2, 2, '#f4cba3');
  });
}

// ── 로비 캠프 소품 ──────────────────────────────
function drawTent() {
  return makeSprite(48, 40, p => {
    for (let i = 0; i < 26; i++) p(24 - i, 6 + i, i * 2 + 1, 1, i % 6 < 3 ? '#d9b07a' : '#c89a62');
    p(0, 32, 48, 2, '#a87a48');
    for (let i = 0; i < 14; i++) p(24 - (i >> 1), 18 + i, i + 1, 1, '#3a2a20'); // 입구
    p(23, 2, 2, 5, '#6b4a2b'); p(25, 2, 6, 3, '#e05a4a'); // 깃발
  });
}

function drawChest(open) {
  return makeSprite(24, 20, p => {
    p(2, 8, 20, 11, '#9a5a2a'); p(2, 8, 20, 2, '#b8723a');
    p(2, 13, 20, 1, '#6b3a1a'); p(2, 8, 2, 11, '#6b3a1a'); p(20, 8, 2, 11, '#6b3a1a');
    if (open) { p(2, 2, 20, 5, '#b8723a'); p(4, 6, 16, 3, '#ffd25e'); p(7, 5, 3, 2, '#fff3b0'); p(14, 5, 3, 2, '#fff3b0'); }
    else { p(1, 3, 22, 6, '#b8723a'); p(1, 3, 22, 1, '#d08a4a'); }
    p(10, 9, 4, 5, '#f0c95a'); p(11, 11, 2, 2, '#6b4a10'); // 자물쇠
  });
}

function drawPotion() {
  return makeSprite(16, 16, p => {
    p(6, 1, 4, 1, '#8a5a3a'); p(6, 2, 4, 2, '#b8b8d0');           // 코르크, 목
    p(4, 4, 8, 1, '#d8d8ec');
    p(3, 5, 10, 9, '#e85a6a'); p(4, 14, 8, 1, '#c03a4a');          // 병 속 물약
    p(3, 5, 10, 2, '#f0f0ff'); p(4, 7, 2, 4, '#ffb0b8');           // 빈 윗부분, 반짝임
    p(12, 6, 1, 7, '#b03040');
  });
}

// ── 장비 아이콘 (16×16) ─────────────────────────
function drawSwordIcon() {
  return makeSprite(16, 16, p => {
    for (let i = 0; i < 9; i++) { p(5 + i, 9 - i, 2, 2, '#dfe6f2'); p(6 + i, 9 - i, 1, 1, '#ffffff'); }
    p(3, 9, 5, 2, '#c89a3a'); p(5, 7, 2, 6, '#c89a3a');      // 손잡이 가드
    p(2, 12, 3, 2, '#6b4a2b'); p(1, 13, 2, 2, '#f0c95a');     // 손잡이, 끝
  });
}

function drawArmorIcon() {
  return makeSprite(16, 16, p => {
    p(3, 2, 3, 3, '#8a96b0'); p(10, 2, 3, 3, '#8a96b0');      // 어깨
    p(4, 4, 8, 10, '#a8b4cc'); p(6, 2, 4, 3, '#a8b4cc');
    p(7, 3, 2, 1, '#2a2f40');                                 // 목
    p(4, 4, 2, 10, '#c8d2e6'); p(7, 6, 2, 6, '#f0c95a');      // 빛, 무늬
    p(4, 13, 8, 1, '#6a7590');
  });
}

function drawRingIcon() {
  return makeSprite(16, 16, (p, g) => {
    ellipse(p, 8, 10, 5, 4, '#f0c95a');
    ellipse(p, 8, 10, 3, 2, '#000');
    g.globalCompositeOperation = 'destination-out';
    ellipse(p, 8, 10, 3, 2, '#000');                          // 가운데 구멍
    g.globalCompositeOperation = 'source-over';
    p(4, 11, 2, 1, '#c8901e');
    p(6, 2, 5, 5, '#7ad0ff'); p(7, 3, 2, 2, '#e0f6ff'); p(5, 4, 7, 1, '#7ad0ff');
  });
}

// 모든 그림 준비. sprites/이름.png 파일이 있으면 그것을 우선 사용한다.
const SPR = {};
function loadSprites() {
  const built = {
    hero_m: drawHero('m'),
    hero_f: drawHero('f'),
    slime: drawSlime(),
    mushroom: drawMushroom(),
    bee: drawBee(),
    tent: drawTent(),
    chest: drawChest(false),
    chest_full: drawChest(true),
    potion: drawPotion(),
    slime_king: drawSlimeKing(),
    miru: drawMiru(),
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
