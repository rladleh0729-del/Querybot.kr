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

// ── 픽셀 지도로 그리기: 글자 하나가 픽셀 하나, '.'은 빈칸 ──
function fromMap(p, rows, pal) {
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const c = pal[row[x]];
      if (c) p(x, y, 1, 1, c);
    }
  });
}

// 소년 (오른쪽을 봄). 소녀·동료는 이 몸을 바탕으로 머리와 옷만 바꾼다
const BOY_MAP = [
  '', '',
  '..........hhhhh',
  '........hhhhhhhhh',
  '.......hhhhHHhhhhh',
  '......hhhhHHHhhhhhh',
  '......hhhhhhhhhhhhhh',
  '......hhhhhhhhhhhhhhh',
  '......dhhhhshhhshhhhh',
  '......dhhhsssshsssssh',
  '......dhhssssssssssss',
  '......dhhsssewsssewss',
  '......dhhssseessseess',
  '......dhhssseessseess',
  '......dhhsppssssksspp',
  '.......dhSssssssssss',
  '.............SS',
  '..........ccccccc',
  '.........cCccccccc',
  '.........bbbbbbbbb',
  '........Bbbbbbbbbb',
  '........Bbbbbbbbbb',
  '........Bllllglllb',
  '........Bbbbbbbbbb',
  '.........bbbbbbbbb',
  '..........nnn.nnn',
  '..........nnn.nnn',
  '.........ffff.ffff',
  '.........ffff.ffff',
];

// 긴 머리 (소녀와 여자 동료)
const GIRL_MAP = (() => {
  const m = BOY_MAP.slice();
  m[6] = '.....hhhhhhhhhhhhhhh';
  m[7] = '.....hhhhhhhhhhhhhhhh';
  for (let y = 8; y <= 14; y++) m[y] = '.....dh' + BOY_MAP[y].slice(7);
  m[15] = '.....dhhhSssssssssss';
  m[16] = '.....dhhh....SS';
  m[17] = '.....dhhh.ccccccc';
  m[18] = '.....dhhhcCccccccc';
  m[19] = '......dhhbbbbbbbbb';
  m[20] = '......dhBbbbbbbbbb';
  m[21] = '.......hBbbbbbbbbb';
  m[22] = '........Bllllglllb';
  m[23] = '.......BBbbbbbbbbbb';
  m[24] = '......BBbbbbbbbbbbbb';
  m[25] = '......BBBBBBBBBBBBBB';
  m[26] = '..........ss...ss';
  m[27] = '.........fff...fff';
  m[28] = '.........fff...fff';
  return m;
})();

const FACE = { s: '#ffdcbc', S: '#f2bc98', p: '#ff9aa8', e: '#2b2140', w: '#ffffff', k: '#c0606e' };

function drawHero(gender) {
  const boy = gender !== 'f';
  const pal = boy
    ? { ...FACE, h: '#7a4a2a', H: '#b07040', d: '#4e2e1a', c: '#e0504a', C: '#b03a36', b: '#3f7fd0', B: '#2c5ea3', l: '#6b4a2b', g: '#f0c95a', n: '#4a3b5a', f: '#5a3a20' }
    : { ...FACE, h: '#8a4a3a', H: '#c07a5a', d: '#5a2e22', c: '#ffffff', C: '#e0e0f0', b: '#e86a9a', B: '#c04c7a', l: '#ffd0e0', g: '#e0405a', f: '#7a3a4a' };
  return makeSprite(32, 32, p => {
    fromMap(p, boy ? BOY_MAP : GIRL_MAP, pal);
    if (!boy) {
      p(13, 10, 1, 1, FACE.e); p(18, 10, 1, 1, FACE.e);          // 속눈썹
      p(5, 3, 2, 3, '#e0405a'); p(8, 3, 2, 3, '#e0405a'); p(7, 4, 1, 1, '#b02a3a');   // 리본
    }
    // 검을 든 팔
    p(18, 19, 2, 2, pal.b);
    p(20, 7, 2, 13, '#e6ecf6'); p(21, 7, 1, 13, '#a8b4c8'); p(20, 6, 1, 1, '#e6ecf6');
    p(18, 20, 6, 1, '#d8a83a');
    p(20, 21, 2, 3, '#6b4a2b');
    p(19, 21, 2, 2, FACE.s);
  });
}

// ── 동료: 미르 (치유형, 약초사) ──
function drawMiru() {
  const pal = { ...FACE, h: '#3fb4a8', H: '#86dcd2', d: '#2a8a80', c: '#f2e6c8', C: '#d8c8a8', b: '#4f9a5a', B: '#3d7a47', l: '#f2e6c8', g: '#e0405a', f: '#5a3a20' };
  return makeSprite(32, 32, p => {
    fromMap(p, GIRL_MAP, pal);
    p(13, 10, 1, 1, FACE.e); p(18, 10, 1, 1, FACE.e);
    p(6, 4, 3, 2, '#ff9ac0'); p(7, 3, 1, 1, '#ffd25e');           // 꽃핀
    p(12, 19, 5, 5, '#f2e6c8'); p(14, 21, 1, 1, '#e0405a');       // 앞치마와 약초 주머니
    // 지팡이와 잎
    p(21, 5, 1, 24, '#8a5a34');
    p(19, 3, 3, 2, '#6fd982'); p(22, 4, 2, 2, '#6fd982'); p(21, 2, 1, 2, '#9ef0a8');
    p(19, 20, 2, 2, FACE.s);
  });
}

// ── 동료: 세린 (마법형, 반요정 마법사) ──
function drawSerin() {
  const pal = { ...FACE, s: '#ffe6d6', h: '#cfc6f4', H: '#ffffff', d: '#9a90d0', c: '#f0c95a', C: '#c89a3a', b: '#5a3fa0', B: '#40288a', l: '#f0c95a', g: '#7ad0ff', f: '#3a2a5a' };
  return makeSprite(32, 32, p => {
    fromMap(p, GIRL_MAP, pal);
    p(13, 10, 1, 1, FACE.e); p(18, 10, 1, 1, FACE.e);
    p(6, 10, 2, 2, pal.s); p(5, 9, 1, 1, pal.s);                  // 뾰족한 귀
    p(9, 2, 8, 1, '#40288a'); p(10, 1, 6, 1, '#5a3fa0');           // 작은 마법사 모자 챙
    // 보주 지팡이
    p(21, 8, 1, 21, '#8a6aa0');
    p(20, 4, 3, 3, '#7ad0ff'); p(20, 4, 1, 1, '#ffffff'); p(19, 5, 1, 1, '#bfe8ff'); p(23, 5, 1, 1, '#bfe8ff');
    p(19, 20, 2, 2, pal.s);
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

// ── 챕터 2 몬스터 (왼쪽을 봄) ──
function drawWisp() {
  return makeSprite(32, 32, p => {
    ellipse(p, 21, 13, 5, 7, '#c8f5ff'); ellipse(p, 25, 16, 4, 6, '#a8e6f5');
    ellipse(p, 14, 18, 8, 8, '#8ee6a4'); ellipse(p, 14, 18, 6, 6, '#c8ffd2'); p(10, 13, 3, 2, '#ffffff');
    p(10, 17, 2, 3, '#1d2a20'); p(15, 17, 2, 3, '#1d2a20'); p(10, 17, 1, 1, '#ffffff'); p(15, 17, 1, 1, '#ffffff');
    p(11, 21, 1, 1, '#ff9aa8'); p(17, 21, 1, 1, '#ff9aa8'); p(13, 22, 3, 1, '#3a8a52');
    p(9, 9, 10, 2, '#4f9a4a'); p(11, 7, 6, 2, '#6fbf5a'); p(14, 5, 1, 2, '#3d7a3a');
    p(21, 25, 2, 2, '#e0fff0'); p(25, 28, 1, 1, '#e0fff0'); p(7, 27, 1, 1, '#e0fff0');
  });
}

function drawToadstool() {
  return makeSprite(32, 32, p => {
    p(11, 17, 10, 11, '#e8dcc8'); p(18, 17, 3, 11, '#cbbca4');
    p(10, 28, 5, 2, '#5a3a50'); p(17, 28, 5, 2, '#5a3a50');
    p(12, 20, 2, 3, '#2a1d1a'); p(16, 20, 2, 3, '#2a1d1a');
    p(11, 19, 3, 1, '#2a1d1a'); p(16, 18, 3, 1, '#2a1d1a');
    p(13, 25, 4, 1, '#7a3a5a');
    ellipse(p, 16, 12, 13, 7, '#8a3fb0', (x, y) => y <= 16); p(3, 16, 26, 2, '#62288a');
    p(8, 8, 3, 3, '#d8ff70'); p(17, 6, 4, 3, '#d8ff70'); p(23, 11, 3, 2, '#d8ff70'); p(12, 12, 2, 2, '#d8ff70');
    p(6, 18, 1, 3, '#b070e0'); p(25, 18, 1, 2, '#b070e0');
  });
}

function drawSprout() {
  return makeSprite(32, 32, p => {
    p(9, 14, 14, 14, '#8a5a34'); p(9, 14, 3, 14, '#6b4428'); p(20, 14, 3, 14, '#a8703e');
    p(9, 13, 14, 2, '#c89a5a'); p(11, 13, 10, 1, '#e0b878');
    p(7, 26, 4, 3, '#6b4428'); p(21, 26, 4, 3, '#6b4428');
    p(11, 18, 3, 3, '#ffe27a'); p(17, 18, 3, 3, '#ffe27a'); p(12, 19, 1, 1, '#fff8d0'); p(18, 19, 1, 1, '#fff8d0');
    p(13, 23, 6, 1, '#4a2e18');
    p(15, 7, 2, 6, '#4f9a4a'); ellipse(p, 12, 7, 3, 2, '#6fd982'); ellipse(p, 20, 6, 3, 2, '#6fd982');
    p(10, 16, 2, 2, '#5aa04a'); p(20, 22, 2, 2, '#5aa04a');
  });
}

// ── 챕터 2 보스: 고목 수호자 (64×64, 왼쪽을 봄) ──
function drawTreant() {
  return makeSprite(64, 64, p => {
    p(18, 22, 28, 36, '#7a4e2e'); p(18, 22, 6, 36, '#5a3820'); p(40, 22, 6, 36, '#8f6038');
    for (let y = 26; y < 56; y += 6) p(25, y, 1, 4, '#5a3820'), p(35, y + 2, 1, 4, '#5a3820');
    p(12, 56, 12, 6, '#5a3820'); p(40, 56, 12, 6, '#5a3820'); p(26, 57, 12, 5, '#6b4428');
    p(6, 30, 12, 5, '#6b4428'); p(3, 25, 5, 7, '#6b4428'); p(46, 32, 12, 5, '#6b4428'); p(56, 27, 4, 7, '#6b4428');
    ellipse(p, 5, 23, 5, 4, '#4f9a4a'); ellipse(p, 58, 25, 5, 4, '#4f9a4a');
    ellipse(p, 32, 14, 25, 12, '#3f8a44'); ellipse(p, 23, 10, 10, 7, '#5aaa52'); ellipse(p, 42, 12, 9, 6, '#5aaa52'); ellipse(p, 32, 6, 8, 5, '#6fc060');
    p(14, 18, 3, 3, '#ff9ac0'); p(46, 8, 3, 3, '#ff9ac0');                      // 꽃
    p(20, 33, 7, 5, '#2a1a10'); p(31, 33, 7, 5, '#2a1a10'); p(21, 34, 3, 3, '#ffe27a'); p(32, 34, 3, 3, '#ffe27a');
    p(18, 30, 9, 2, '#4a2e18'); p(30, 30, 9, 2, '#4a2e18');
    p(22, 44, 14, 4, '#2a1a10'); p(24, 45, 10, 2, '#3a2414');
    p(19, 24, 7, 3, '#5aa04a'); p(38, 50, 6, 3, '#5aa04a'); p(20, 52, 4, 2, '#5aa04a');
    p(40, 38, 3, 8, '#d6f3ff'); p(38, 40, 7, 4, '#d6f3ff'); p(41, 39, 1, 6, '#ffffff');   // 가슴의 별조각
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
    serin: drawSerin(),
    wisp: drawWisp(),
    toadstool: drawToadstool(),
    sprout: drawSprout(),
    treant: drawTreant(),
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
