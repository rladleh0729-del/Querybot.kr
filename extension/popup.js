const page=document.getElementById("page");
const status=document.getElementById("status");
const convert=document.getElementById("convert");
const ping=document.getElementById("ping");
const folder=document.getElementById("folder");

let tabInfo={title:"",url:"",videoId:null};

function videoIdFrom(url){
  try{
    const u=new URL(url);
    if(u.hostname.includes("youtu.be")) return u.pathname.split("/").filter(Boolean)[0]||null;
    if(u.pathname==="/watch") return u.searchParams.get("v");
    const p=u.pathname.split("/").filter(Boolean);
    if(["shorts","embed","live"].includes(p[0])) return p[1]||null;
  }catch(e){}
  return null;
}
function show(msg,type=""){status.textContent=msg;status.className="status "+type}
async function init(){
  const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
  tabInfo={title:tab?.title||"",url:tab?.url||"",videoId:videoIdFrom(tab?.url||"")};
  page.textContent=tabInfo.title+"\n"+tabInfo.url;
  convert.disabled=!tabInfo.url.includes("youtube");
}
init().catch(e=>show(e.message,"err"));

ping.onclick=async()=>{
  show("Windows 연결 확인 중…");
  const r=await chrome.runtime.sendMessage({type:"NATIVE_PING"});
  show(r?.status==="success"?"Windows 연결 정상":(r?.data?.message||"연결 실패"),r?.status==="success"?"ok":"err");
};
folder.onclick=async()=>{
  const r=await chrome.runtime.sendMessage({type:"OPEN_FOLDER"});
  show(r?.status==="success"?"저장 폴더를 열었습니다.":(r?.data?.message||"폴더 열기 실패"),r?.status==="success"?"ok":"err");
};
convert.onclick=async()=>{
  convert.disabled=true;show("변환 요청 중…");
  const r=await chrome.runtime.sendMessage({type:"EXTRACT_FLAC",data:tabInfo});
  show(r?.status==="success"?"FLAC 변환 요청 완료":(r?.data?.message||"변환 실패"),r?.status==="success"?"ok":"err");
  convert.disabled=false;
};
