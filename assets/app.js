const dict={ko:{features:'기능',download:'다운로드',guide:'설치 방법',privacy:'개인정보처리방침'},en:{features:'Features',download:'Download',guide:'Setup guide',privacy:'Privacy'}};
function setLang(l){localStorage.qbLang=l;document.documentElement.lang=l;document.querySelectorAll('[data-ko]').forEach(e=>e.textContent=e.dataset[l]||e.dataset.ko);document.querySelectorAll('.lang').forEach(e=>e.textContent=l==='ko'?'EN':'한국어')}
document.addEventListener('DOMContentLoaded',()=>{setLang(localStorage.qbLang||'ko');document.querySelectorAll('.lang').forEach(b=>b.onclick=()=>setLang(document.documentElement.lang==='ko'?'en':'ko'))});
// 마우스를 따라가는 연한 원 (2026-10-21): 마우스가 있는 기기에서만, '움직임 줄이기' 설정이면 끔. 살짝 늦게 부드럽게 따라온다.
(()=>{const mq=q=>window.matchMedia&&matchMedia(q).matches;if(!mq('(hover:hover) and (pointer:fine)')||mq('(prefers-reduced-motion: reduce)'))return;
const g=document.createElement('div');g.className='cursor-glow';g.setAttribute('aria-hidden','true');let x=0,y=0,cx=0,cy=0,raf=0,seen=false;
const tick=()=>{cx+=(x-cx)*.16;cy+=(y-cy)*.16;g.style.transform=`translate3d(${cx}px,${cy}px,0)`;raf=Math.abs(x-cx)+Math.abs(y-cy)>.4?requestAnimationFrame(tick):0};
addEventListener('pointermove',e=>{if(e.pointerType&&e.pointerType!=='mouse')return;x=e.clientX;y=e.clientY;if(!seen){seen=true;cx=x;cy=y;if(!g.isConnected)document.body.appendChild(g)}g.classList.add('on');if(!raf)raf=requestAnimationFrame(tick)},{passive:true});
document.documentElement.addEventListener('mouseleave',()=>g.classList.remove('on'));addEventListener('blur',()=>g.classList.remove('on'))})();
