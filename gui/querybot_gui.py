import os
import sys
import queue
import threading
import subprocess
import tkinter as tk
from pathlib import Path
from tkinter import ttk, filedialog, messagebox

import yt_dlp
import imageio_ffmpeg

APP_NAME = "QueryBot Audio GUI"
DEFAULT_DIR = Path.home() / "Downloads" / "QueryBot_Audio"


class Cancelled(Exception):
    pass


class QueryBotAudioApp(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title(APP_NAME)
        self.geometry("760x520")
        self.minsize(680, 460)
        self.configure(bg="#08101f")

        self.msg_queue = queue.Queue()
        self.cancel_event = threading.Event()
        self.worker = None

        self.url_var = tk.StringVar()
        self.dir_var = tk.StringVar(value=str(DEFAULT_DIR))
        self.status_var = tk.StringVar(value="URL을 붙여넣고 변환을 시작하세요.")
        self.progress_var = tk.DoubleVar(value=0)

        self._build_ui()
        self.after(100, self._poll_queue)

    def _build_ui(self):
        style = ttk.Style(self)
        try:
            style.theme_use("clam")
        except Exception:
            pass

        style.configure("TFrame", background="#08101f")
        style.configure("Card.TFrame", background="#101a2d")
        style.configure("TLabel", background="#08101f", foreground="#edf3fb")
        style.configure("Card.TLabel", background="#101a2d", foreground="#edf3fb")
        style.configure("Muted.TLabel", background="#101a2d", foreground="#95a5bf")
        style.configure("Accent.TButton", font=("Segoe UI", 11, "bold"))
        style.configure("TProgressbar", thickness=14)

        outer = ttk.Frame(self, padding=24)
        outer.pack(fill="both", expand=True)

        title = ttk.Label(
            outer,
            text="QueryBot Audio",
            font=("Segoe UI", 24, "bold")
        )
        title.pack(anchor="w")

        subtitle = ttk.Label(
            outer,
            text="YouTube URL을 Windows PC에서 FLAC으로 변환합니다.",
            foreground="#95a5bf",
            font=("Segoe UI", 10)
        )
        subtitle.pack(anchor="w", pady=(4, 18))

        card = ttk.Frame(outer, style="Card.TFrame", padding=20)
        card.pack(fill="both", expand=True)

        ttk.Label(card, text="YouTube URL", style="Card.TLabel",
                  font=("Segoe UI", 10, "bold")).pack(anchor="w")

        self.url_entry = tk.Entry(
            card,
            textvariable=self.url_var,
            font=("Segoe UI", 11),
            bg="#0a1322",
            fg="#f5f7fb",
            insertbackground="#ffffff",
            relief="flat",
            highlightthickness=1,
            highlightbackground="#2a3a57",
            highlightcolor="#62a8ff"
        )
        self.url_entry.pack(fill="x", ipady=10, pady=(7, 16))

        ttk.Label(card, text="저장 폴더", style="Card.TLabel",
                  font=("Segoe UI", 10, "bold")).pack(anchor="w")

        row = ttk.Frame(card, style="Card.TFrame")
        row.pack(fill="x", pady=(7, 16))

        self.dir_entry = tk.Entry(
            row,
            textvariable=self.dir_var,
            font=("Segoe UI", 10),
            bg="#0a1322",
            fg="#dbe5f6",
            insertbackground="#ffffff",
            relief="flat",
            highlightthickness=1,
            highlightbackground="#2a3a57",
            highlightcolor="#62a8ff"
        )
        self.dir_entry.pack(side="left", fill="x", expand=True, ipady=8)

        ttk.Button(row, text="찾기", command=self.choose_dir).pack(side="left", padx=(8, 0))

        btns = ttk.Frame(card, style="Card.TFrame")
        btns.pack(fill="x")

        self.start_btn = ttk.Button(
            btns,
            text="FLAC 변환 시작",
            style="Accent.TButton",
            command=self.start_download
        )
        self.start_btn.pack(side="left")

        self.cancel_btn = ttk.Button(
            btns,
            text="취소",
            command=self.cancel_download,
            state="disabled"
        )
        self.cancel_btn.pack(side="left", padx=(8, 0))

        ttk.Button(
            btns,
            text="저장 폴더 열기",
            command=self.open_dir
        ).pack(side="right")

        self.progress = ttk.Progressbar(
            card,
            variable=self.progress_var,
            maximum=100,
            mode="determinate"
        )
        self.progress.pack(fill="x", pady=(22, 8))

        ttk.Label(
            card,
            textvariable=self.status_var,
            style="Muted.TLabel",
            wraplength=650
        ).pack(anchor="w")

        log_frame = ttk.Frame(card, style="Card.TFrame")
        log_frame.pack(fill="both", expand=True, pady=(16, 0))

        self.log = tk.Text(
            log_frame,
            height=8,
            bg="#0a1322",
            fg="#aebbd0",
            insertbackground="#ffffff",
            relief="flat",
            borderwidth=0,
            font=("Consolas", 9),
            wrap="word",
            state="disabled"
        )
        self.log.pack(fill="both", expand=True)

        note = ttk.Label(
            outer,
            text="재생목록 URL도 지원합니다. 다운로드 권한이 있는 콘텐츠에 사용하세요.",
            foreground="#71829f",
            font=("Segoe UI", 9)
        )
        note.pack(anchor="w", pady=(12, 0))

    def choose_dir(self):
        current = self.dir_var.get().strip() or str(DEFAULT_DIR)
        path = filedialog.askdirectory(initialdir=current)
        if path:
            self.dir_var.set(path)

    def open_dir(self):
        path = Path(self.dir_var.get().strip() or DEFAULT_DIR)
        path.mkdir(parents=True, exist_ok=True)
        try:
            os.startfile(str(path))
        except Exception:
            subprocess.Popen(["explorer.exe", str(path)])

    def append_log(self, text):
        self.log.configure(state="normal")
        self.log.insert("end", str(text).rstrip() + "\n")
        self.log.see("end")
        self.log.configure(state="disabled")

    def set_busy(self, busy):
        self.start_btn.configure(state="disabled" if busy else "normal")
        self.cancel_btn.configure(state="normal" if busy else "disabled")
        self.url_entry.configure(state="disabled" if busy else "normal")
        self.dir_entry.configure(state="disabled" if busy else "normal")

    def cancel_download(self):
        self.cancel_event.set()
        self.status_var.set("취소 요청 중…")
        self.append_log("사용자가 취소를 요청했습니다.")

    def _progress_hook(self, data):
        if self.cancel_event.is_set():
            raise Cancelled("변환 작업이 취소되었습니다.")

        status = data.get("status")
        if status == "downloading":
            downloaded = data.get("downloaded_bytes") or 0
            total = data.get("total_bytes") or data.get("total_bytes_estimate") or 0
            if total:
                pct = min(92, max(1, int(downloaded * 92 / total)))
            else:
                pct = 5

            speed = data.get("speed")
            eta = data.get("eta")
            detail = f"다운로드 {pct}%"
            if speed:
                detail += f" · {speed / 1024 / 1024:.1f} MB/s"
            if eta is not None:
                detail += f" · 약 {int(eta)}초"
            self.msg_queue.put(("progress", pct, detail))

        elif status == "finished":
            self.msg_queue.put(("progress", 93, "다운로드 완료 · FLAC 변환 중…"))

    def _post_hook(self, data):
        if self.cancel_event.is_set():
            raise Cancelled("변환 작업이 취소되었습니다.")

        status = data.get("status")
        if status == "started":
            self.msg_queue.put(("progress", 95, "FLAC 변환 시작…"))
        elif status == "processing":
            self.msg_queue.put(("progress", 97, "FLAC 후처리 중…"))
        elif status == "finished":
            self.msg_queue.put(("progress", 99, "FLAC 변환 마무리 중…"))

    def _base_options(self, out_dir):
        ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
        archive = out_dir / ".querybot_download_archive.txt"

        return {
            "format": "bestaudio/best",
            "outtmpl": str(out_dir / "%(playlist_title,NA)s" / "%(title)s [%(id)s].%(ext)s"),
            "paths": {"home": str(out_dir)},
            "ffmpeg_location": ffmpeg_exe,
            "postprocessors": [
                {
                    "key": "FFmpegExtractAudio",
                    "preferredcodec": "flac",
                },
                {
                    "key": "FFmpegMetadata",
                    "add_metadata": True,
                },
            ],
            "progress_hooks": [self._progress_hook],
            "postprocessor_hooks": [self._post_hook],
            "retries": 3,
            "fragment_retries": 3,
            "extractor_retries": 3,
            "socket_timeout": 20,
            "continuedl": True,
            "overwrites": False,
            "ignoreerrors": False,
            "download_archive": str(archive),
            "windowsfilenames": True,
            "quiet": True,
            "no_warnings": False,
            "http_headers": {
                "User-Agent": (
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/151.0.0.0 Safari/537.36"
                )
            },
        }

    def _download_worker(self, url, out_dir):
        attempts = [
            ("기본", None),
            ("web_embedded", "web_embedded"),
            ("android_vr", "android_vr"),
            ("web_safari", "web_safari"),
        ]

        last_error = None

        for name, client in attempts:
            if self.cancel_event.is_set():
                self.msg_queue.put(("cancelled",))
                return

            opts = self._base_options(out_dir)
            if client:
                opts["extractor_args"] = {
                    "youtube": {"player_client": [client]}
                }

            self.msg_queue.put(("log", f"다운로드 방식: {name}"))

            try:
                with yt_dlp.YoutubeDL(opts) as ydl:
                    ydl.download([url])

                if self.cancel_event.is_set():
                    self.msg_queue.put(("cancelled",))
                    return

                self.msg_queue.put(("done", str(out_dir)))
                return

            except Cancelled:
                self.msg_queue.put(("cancelled",))
                return
            except Exception as e:
                last_error = e
                text = str(e)
                self.msg_queue.put(("log", f"{name} 실패: {text}"))

                is_403 = ("403" in text) or ("forbidden" in text.lower())
                if not is_403:
                    break

        self.msg_queue.put(("error", str(last_error or "알 수 없는 오류")))

    def start_download(self):
        url = self.url_var.get().strip()
        if not url:
            messagebox.showwarning(APP_NAME, "YouTube URL을 입력하세요.")
            return

        out_dir = Path(self.dir_var.get().strip() or DEFAULT_DIR)
        out_dir.mkdir(parents=True, exist_ok=True)

        self.cancel_event.clear()
        self.progress_var.set(0)
        self.status_var.set("YouTube 정보를 확인하는 중…")
        self.append_log("=" * 50)
        self.append_log(f"URL: {url}")
        self.append_log(f"저장 폴더: {out_dir}")
        self.set_busy(True)

        self.worker = threading.Thread(
            target=self._download_worker,
            args=(url, out_dir),
            daemon=True
        )
        self.worker.start()

    def _poll_queue(self):
        try:
            while True:
                item = self.msg_queue.get_nowait()
                kind = item[0]

                if kind == "progress":
                    _, pct, msg = item
                    self.progress_var.set(pct)
                    self.status_var.set(msg)

                elif kind == "log":
                    self.append_log(item[1])

                elif kind == "done":
                    self.progress_var.set(100)
                    self.status_var.set("변환이 완료되었습니다.")
                    self.append_log("완료")
                    self.set_busy(False)

                elif kind == "cancelled":
                    self.status_var.set("변환이 취소되었습니다.")
                    self.append_log("취소됨")
                    self.set_busy(False)

                elif kind == "error":
                    self.status_var.set("변환에 실패했습니다.")
                    self.append_log("오류: " + item[1])
                    self.set_busy(False)
                    messagebox.showerror(APP_NAME, item[1])

        except queue.Empty:
            pass

        self.after(100, self._poll_queue)


if __name__ == "__main__":
    DEFAULT_DIR.mkdir(parents=True, exist_ok=True)
    app = QueryBotAudioApp()
    app.mainloop()
