const dict={ko:{features:'기능',download:'다운로드',guide:'설치 방법',privacy:'개인정보처리방침'},en:{features:'Features',download:'Download',guide:'Setup guide',privacy:'Privacy'}};
function setLang(l){localStorage.qbLang=l;document.documentElement.lang=l;document.querySelectorAll('[data-ko]').forEach(e=>e.textContent=e.dataset[l]||e.dataset.ko);document.querySelectorAll('.lang').forEach(e=>e.textContent=l==='ko'?'EN':'한국어')}
// 폰 아래 탭 바 (2026-10-21): 폰에선 위쪽 메뉴가 숨겨져 다른 페이지로 갈 수 없어서. AI 페이지는 자체 서랍 메뉴가 있어 넣지 않음
function addTabbar(){if(document.body.classList.contains('qa-page')||document.querySelector('.tabbar'))return;
const I={home:'<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',ai:'<path d="M4 5h16v11H9l-5 4z"/><path d="M9 10.5h.01M12 10.5h.01M15 10.5h.01"/>',games:'<rect x="2.5" y="7" width="19" height="11" rx="5"/><path d="M7 10.5v4M5 12.5h4M15.5 12h.01M18 14h.01"/>',download:'<path d="M12 3v12M7 10l5 5 5-5M4 20h16"/>'};
const T=[['home','/','홈','Home'],['ai','/ai/','AI','AI'],['games','/games/','게임','Games'],['download','/download/','다운로드','Download']];
const p=location.pathname,cur=p.startsWith('/ai')?'ai':p.startsWith('/games')?'games':p.startsWith('/download')?'download':p==='/'||p==='/index.html'?'home':'';
const n=document.createElement('nav');n.className='tabbar';n.setAttribute('aria-label','페이지 이동');
n.innerHTML=T.map(([k,h,ko,en])=>`<a href="${h}"${k===cur?' class="on" aria-current="page"':''}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[k]}</svg><span data-ko="${ko}" data-en="${en}">${ko}</span></a>`).join('');
document.body.appendChild(n);document.body.classList.add('has-tabbar')}
document.addEventListener('DOMContentLoaded',()=>{addTabbar();setLang(localStorage.qbLang||'ko');document.querySelectorAll('.lang').forEach(b=>b.onclick=()=>setLang(document.documentElement.lang==='ko'?'en':'ko'))});
// 마우스를 따라가는 연한 원 (2026-10-21): 마우스가 있는 기기에서만, '움직임 줄이기' 설정이면 끔. 살짝 늦게 부드럽게 따라온다.
(()=>{const mq=q=>window.matchMedia&&matchMedia(q).matches;if(!mq('(hover:hover) and (pointer:fine)')||mq('(prefers-reduced-motion: reduce)'))return;
const g=document.createElement('div');g.className='cursor-glow';g.setAttribute('aria-hidden','true');let x=0,y=0,cx=0,cy=0,raf=0,seen=false;
const tick=()=>{cx+=(x-cx)*.16;cy+=(y-cy)*.16;g.style.transform=`translate3d(${cx}px,${cy}px,0)`;raf=Math.abs(x-cx)+Math.abs(y-cy)>.4?requestAnimationFrame(tick):0};
addEventListener('pointermove',e=>{if(e.pointerType&&e.pointerType!=='mouse')return;x=e.clientX;y=e.clientY;if(!seen){seen=true;cx=x;cy=y;if(!g.isConnected)document.body.appendChild(g)}g.classList.add('on');if(!raf)raf=requestAnimationFrame(tick)},{passive:true});
document.documentElement.addEventListener('mouseleave',()=>g.classList.remove('on'));addEventListener('blur',()=>g.classList.remove('on'))})();
