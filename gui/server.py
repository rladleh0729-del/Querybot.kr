from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pathlib import Path
from urllib.parse import urlparse, parse_qs
from io import BytesIO
import asyncio, os, re, subprocess, requests, yt_dlp, imageio_ffmpeg
from mutagen import File as MutagenFile
from mutagen.flac import FLAC, Picture
from PIL import Image

app=FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

DOWNLOAD_DIR=Path.home()/"Downloads"/"YouTube_FLAC"
DOWNLOAD_DIR.mkdir(parents=True,exist_ok=True)
AUTO_OPEN_FOLDER=False
FFMPEG_EXE=Path(imageio_ffmpeg.get_ffmpeg_exe())
SERVICE_ID="youtube-flac-converter"
API_VERSION="2"

class VideoRequest(BaseModel):
    title:str|None=None
    url:str|None=None
    videoId:str|None=None

def get_youtube_video_id(url:str):
    try:
        p=urlparse(url)
        if p.path=="/watch":
            return parse_qs(p.query).get("v",[None])[0]
        if "youtu.be" in p.netloc.lower():
            return p.path.strip("/").split("/")[0] or None
        parts=[x for x in p.path.split("/") if x]
        if parts and parts[0] in {"shorts","embed","live"} and len(parts)>1:
            return parts[1]
    except Exception:
        pass
    return None

def _clean_title(value):
    text=str(value or "").strip()
    text=re.sub(r"\s*[\(\[](official\s+)?(music\s+)?video[\)\]]\s*$","",text,flags=re.I)
    return text.strip() or "audio"

def _cover_bytes(url):
    if not url:
        return None
    try:
        r=requests.get(url,timeout=15)
        r.raise_for_status()
        img=Image.open(BytesIO(r.content)).convert("RGB")
        out=BytesIO()
        img.save(out,format="JPEG",quality=92)
        return out.getvalue()
    except Exception:
        return None

def write_audio_tags(path:Path,info:dict,source_url:str,format_name:str):
    audio=MutagenFile(str(path),easy=True)
    if audio is None: return
    title=info.get("track") or _clean_title(info.get("title"))
    artist=info.get("artist") or info.get("creator") or info.get("uploader") or ""
    album=info.get("album") or ""
    audio["title"]=str(title or path.stem)
    if artist: audio["artist"]=str(artist)
    if album: audio["album"]=str(album)
    date=str(info.get("release_year") or info.get("upload_date") or "")[:4]
    if date.isdigit(): audio["date"]=date
    audio["comment"]=source_url
    cover=_cover_bytes(info.get("thumbnail"))
    audio.save()
    if cover and str(format_name).lower()=="flac":
        flac=FLAC(str(path))
        pic=Picture()
        pic.type=3
        pic.mime="image/jpeg"
        pic.desc="Cover"
        pic.data=cover
        flac.clear_pictures()
        flac.add_picture(pic)
        flac.save()

def open_download_folder():
    DOWNLOAD_DIR.mkdir(parents=True,exist_ok=True)
    if os.name=="nt":
        os.startfile(str(DOWNLOAD_DIR))
    else:
        subprocess.Popen(["xdg-open",str(DOWNLOAD_DIR)])
    return {"status":"success","folder":str(DOWNLOAD_DIR)}

def _headers():
    return {"User-Agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36"}

def _attempts():
    return [
        ("default",None),
        ("web_embedded","web_embedded"),
        ("android_vr","android_vr"),
        ("web_safari","web_safari"),
    ]

def download_audio(url:str,format_name="mp3",progress_hooks=None,postprocessor_hooks=None,cancel_check=None):
    format_name=str(format_name or "mp3").lower()
    if format_name not in {"mp3","m4a","wav","flac","opus","vorbis"}: raise ValueError("지원하지 않는 음원 형식입니다.")
    def cancelled():
        if cancel_check and cancel_check(): raise RuntimeError("변환 작업이 취소되었습니다.")
    cancelled()
    base={"format":"bestaudio/best","outtmpl":str(DOWNLOAD_DIR/"%(title)s [%(id)s].%(ext)s"),"ffmpeg_location":str(FFMPEG_EXE),
        "postprocessors":[{"key":"FFmpegExtractAudio","preferredcodec":format_name}],"noplaylist":True,"quiet":False,"no_warnings":False,
        "retries":3,"fragment_retries":3,"extractor_retries":3,"socket_timeout":20,"continuedl":True,"http_headers":_headers()}
    if progress_hooks: base["progress_hooks"]=list(progress_hooks)
    if postprocessor_hooks: base["postprocessor_hooks"]=list(postprocessor_hooks)
    info=None; original=None; last=None
    for _,client in _attempts():
        cancelled(); opts=dict(base); opts["http_headers"]=dict(base["http_headers"])
        if client: opts["extractor_args"]={"youtube":{"player_client":[client]}}
        try:
            with yt_dlp.YoutubeDL(opts) as ydl: info=ydl.extract_info(url,download=True); cancelled(); original=ydl.prepare_filename(info)
            last=None; break
        except Exception as e:
            last=e
            if cancel_check and cancel_check(): raise RuntimeError("변환 작업이 취소되었습니다.")
            if "403" not in str(e).lower() and "forbidden" not in str(e).lower(): raise
    if last is not None or not info or not original: raise RuntimeError(f"YouTube 음원 요청 실패: {last}")
    output=Path(original).with_suffix("."+format_name)
    if not output.exists(): raise FileNotFoundError(f"변환된 음원 파일을 찾을 수 없습니다: {output}")
    try: write_audio_tags(output,info,url,format_name)
    except Exception: pass
    return {"path":str(output),"title":info.get("track") or info.get("title"),"artist":info.get("artist") or info.get("uploader"),"id":info.get("id"),"format":format_name}


def get_playlist_entries(url:str):
    base={
        "extract_flat":True,
        "skip_download":True,
        "quiet":True,
        "ignoreerrors":True,
        "playlistend":500,
        "http_headers":_headers(),
    }
    last=None
    for _,client in _attempts():
        opts=dict(base)
        if client:
            opts["extractor_args"]={"youtube":{"player_client":[client]}}
        try:
            with yt_dlp.YoutubeDL(opts) as ydl:
                info=ydl.extract_info(url,download=False)
            entries=[]
            for e in (info or {}).get("entries") or []:
                if not e: continue
                vid=e.get("id")
                u=f"https://www.youtube.com/watch?v={vid}" if vid else (e.get("webpage_url") or e.get("url"))
                if not u: continue
                entries.append({"id":vid,"title":e.get("title") or "제목 없음","url":u})
            if entries:
                is_mix="list=RD" in url or "start_radio=1" in url
                if is_mix:
                    current_id=get_youtube_video_id(url)
                    entries=[entry for entry in entries if entry.get("id")==current_id] if current_id else []
                    if not entries:
                        entries=[{"id":current_id,"title":"Mix 주소에 포함된 현재 영상","url":f"https://www.youtube.com/watch?v={current_id}"}] if current_id else []
                if entries:
                    return {
                        "title":(info or {}).get("title") or ("YouTube Mix · 현재 영상만" if is_mix else "YouTube 재생목록"),
                        "id":(info or {}).get("id"),
                        "entries":entries,
                        "count":len(entries),
                        "reported_total":(info or {}).get("playlist_count") or len(entries),
                        "source_url":url,
                        "is_mix":is_mix,
                    }
        except Exception as e:
            last=e
    raise RuntimeError(f"재생목록을 읽지 못했습니다: {last}")

def download_playlist_audio(url:str,format_name="mp3",progress_callback=None,cancel_check=None,playlist_snapshot=None):
    def cancelled():
        if cancel_check and cancel_check(): raise RuntimeError("재생목록 변환 작업이 취소되었습니다.")
    playlist=playlist_snapshot if playlist_snapshot else get_playlist_entries(url)
    entries=list(playlist.get("entries") or [])
    total=len(entries)
    if not total: raise RuntimeError("선택한 재생목록 영상이 없습니다.")
    results=[]; failed=[]
    def emit(p,m):
        if progress_callback:
            try: progress_callback(max(0,min(100,int(p))),str(m))
            except Exception: pass
    for idx,e in enumerate(entries,start=1):
        cancelled(); title=e.get("title") or f"{idx}번 영상"
        def hook(data,_idx=idx,_title=title):
            cancelled(); st=data.get("status"); pct=5
            if st=="downloading":
                done=data.get("downloaded_bytes") or 0; size=data.get("total_bytes") or data.get("total_bytes_estimate") or 0
                pct=int(done*92/size) if size else 5
            elif st=="finished": pct=93
            emit(int(((_idx-1)+pct/100)*100/total),f"[{_idx}/{total}] {_title} · 다운로드 중")
        def post(data,_idx=idx,_title=title):
            pct={"started":95,"processing":97,"finished":99}.get(data.get("status"))
            if pct is not None: emit(int(((_idx-1)+pct/100)*100/total),f"[{_idx}/{total}] {_title} · {format_name.upper()} 변환 중")
        try:
            r=download_audio(e["url"],format_name,[hook],[post],cancel_check); r["playlist_index"]=idx; r["playlist_title"]=playlist.get("title"); results.append(r)
            emit(int(idx*100/total),f"[{idx}/{total}] {_title} · 완료")
        except Exception as ex:
            if cancel_check and cancel_check(): raise RuntimeError("재생목록 변환 작업이 취소되었습니다.")
            failed.append({"index":idx,"title":title,"url":e.get("url"),"message":str(ex)})
            emit(int(idx*100/total),f"[{idx}/{total}] {_title} · 실패, 다음 곡 계속")
    if not results: raise RuntimeError(f"선택한 영상 변환에 모두 실패했습니다: {failed[-1]['message'] if failed else '알 수 없는 오류'}")
    emit(100,f"재생목록 변환 완료 · 성공 {len(results)}곡"+(f" · 실패 {len(failed)}곡" if failed else ""))
    return {"playlist_title":playlist.get("title") or "YouTube 재생목록","playlist_id":playlist.get("id"),"total":total,"completed":len(results),"failed_count":len(failed),"results":results,"failed":failed}


@app.get("/health")
def health():
    return {"status":"ok","service":SERVICE_ID,"api_version":API_VERSION}

@app.get("/")
def home():
    return {"status":"ok","service":SERVICE_ID}

@app.get("/ping")
def ping():
    return {"ok":True,"status":"connected","message":"QueryBot Audio local engine is ready."}

@app.get("/open-folder")
def open_folder():
    return open_download_folder()

@app.post("/extract")
async def extract(video:VideoRequest):
    url=(video.url or "").strip()
    if not url:
        return {"status":"error","message":"YouTube URL이 없습니다."}
    result=await asyncio.to_thread(download_audio,url,'mp3')
    return {"status":"success",**result}
