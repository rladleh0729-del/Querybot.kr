import os
import sys
import socket
import threading
import subprocess
import webbrowser
import mimetypes
import json
from concurrent.futures import ThreadPoolExecutor, as_completed
from urllib.parse import urlparse
from pathlib import Path
from datetime import datetime

import requests
from mutagen.flac import FLAC, Picture

from PySide6.QtCore import Qt, QThread, Signal, QTimer, QSettings, QRectF, QFile, QUrl, QSize
from PySide6.QtNetwork import QNetworkAccessManager, QNetworkRequest
from PySide6.QtGui import QIcon, QPixmap, QPainter, QColor, QPen
from PySide6.QtWidgets import (
    QApplication, QMainWindow, QWidget, QHBoxLayout, QVBoxLayout,
    QLabel, QPushButton, QLineEdit, QStackedWidget, QFrame,
    QTableWidget, QTableWidgetItem, QHeaderView, QAbstractItemView,
    QProgressBar, QMessageBox, QFormLayout, QCheckBox,
    QDialog, QFileDialog, QComboBox
)

import server as backend
from browser_playlist import from_browser_html, playlist_id

if hasattr(backend, "AUTO_OPEN_FOLDER"):
    backend.AUTO_OPEN_FOLDER = False

APP_NAME = "QueryBot Audio"
DEFAULT_HIBY_URL = "http://192.168.0.11:4399"
DEFAULT_HIBY_PATH = "/data/mnt/sd_0/"
AUDIO_EXTENSIONS = {".flac", ".mp3", ".wav", ".m4a", ".aac", ".ogg", ".opus"}

def human_size(size: int) -> str:
    units = ["B", "KB", "MB", "GB"]
    value = float(size)
    for unit in units:
        if value < 1024 or unit == units[-1]:
            return f"{value:.1f} {unit}" if unit != "B" else f"{int(value)} B"
        value /= 1024
    return f"{size} B"


def reveal_file(path: Path):
    if path.exists():
        # explorer.exe는 /select, 와 경로가 붙어 있어야 선택이 안정적으로 동작한다.
        subprocess.Popen(["explorer.exe", f'/select,"{path}"'])


def play_file(path: Path):
    if path.exists():
        os.startfile(str(path))


def safe_audio_filename(name: str, fallback="audio.flac") -> str:
    """Windows에서 사용할 수 있는 안전한 FLAC 파일명으로 정리."""
    invalid = '<>:"/\\|?*'
    cleaned = "".join(
        "_" if ch in invalid else ch
        for ch in str(name)
    )

    cleaned = cleaned.strip().rstrip(". ")

    if not cleaned:
        cleaned = fallback

    if not cleaned.lower().endswith(".flac"):
        cleaned += ".flac"

    # 너무 긴 파일명은 경로 문제를 피하기 위해 적당히 제한
    if len(cleaned) > 180:
        stem = Path(cleaned).stem[:175]
        cleaned = stem.rstrip(". ") + ".flac"

    return cleaned


def first_tag(audio: FLAC, key: str, default=""):
    value = audio.get(key)
    if value:
        return str(value[0])
    return default


class ConvertWorker(QThread):
    progress = Signal(int, str)
    success = Signal(dict)
    failed = Signal(str)

    def __init__(self, url: str):
        super().__init__()
        self.url = url
        self._last_percent = -1

    def _emit_progress(self, percent: int, message: str):
        percent = max(0, min(100, int(percent)))

        # 같은 퍼센트가 너무 자주 들어오면 UI 이벤트를 줄인다.
        if percent != self._last_percent or percent in (0, 100):
            self._last_percent = percent
            self.progress.emit(percent, message)

    def _download_hook(self, data):
        if self.isInterruptionRequested():
            raise RuntimeError("변환 작업이 취소되었습니다.")

        status = data.get("status")

        if status == "downloading":
            downloaded = data.get("downloaded_bytes") or 0
            total = (
                data.get("total_bytes")
                or data.get("total_bytes_estimate")
                or 0
            )

            if total > 0:
                raw_percent = int(downloaded * 100 / total)

                # 다운로드 구간은 전체 작업의 0~92%
                ui_percent = int(raw_percent * 0.92)

                speed = data.get("speed")
                eta = data.get("eta")

                details = [f"다운로드 {raw_percent}%"]

                if speed:
                    details.append(
                        f"{human_size(int(speed))}/s"
                    )

                if eta is not None:
                    details.append(
                        f"약 {int(eta)}초 남음"
                    )

                self._emit_progress(
                    ui_percent,
                    " · ".join(details)
                )

            else:
                self._emit_progress(
                    5,
                    "다운로드 중..."
                )

        elif status == "finished":
            self._emit_progress(
                93,
                "다운로드 완료 · FLAC 변환 준비 중..."
            )

    def _postprocessor_hook(self, data):
        if self.isInterruptionRequested():
            raise RuntimeError("변환 작업이 취소되었습니다.")

        status = data.get("status")
        pp_name = (
            data.get("postprocessor")
            or "오디오 처리"
        )

        if status == "started":
            self._emit_progress(
                95,
                f"{pp_name} · FLAC 변환 중..."
            )

        elif status == "processing":
            self._emit_progress(
                97,
                f"{pp_name} · 후처리 중..."
            )

        elif status == "finished":
            self._emit_progress(
                99,
                "FLAC 변환 완료 · 태그 저장 중..."
            )

    def run(self):
        try:
            self._emit_progress(
                1,
                "YouTube 정보를 확인하는 중..."
            )

            # server.py가 hook을 정식 인자로 받으므로
            # yt_dlp.YoutubeDL 전역 몽키패치가 필요 없다.
            result = backend.download_flac(
                self.url,
                progress_hooks=[
                    self._download_hook
                ],
                postprocessor_hooks=[
                    self._postprocessor_hook
                ],
                cancel_check=self.isInterruptionRequested,
            )

            if not isinstance(result, dict):
                result = {
                    "path": str(result)
                }

            self._emit_progress(
                100,
                "모든 작업 완료"
            )

            self.success.emit(result)

        except Exception as e:
            self.failed.emit(str(e))


class AudioConvertWorker(QThread):
    progress=Signal(int,str)
    success=Signal(dict)
    failed=Signal(str)
    def __init__(self,url,format_name):
        super().__init__(); self.url=url; self.format_name=format_name; self._last=-1
    def run(self):
        try:
            result=backend.download_audio(self.url,self.format_name,progress_hooks=[self._progress_hook],postprocessor_hooks=[self._post_hook],cancel_check=self.isInterruptionRequested)
            self.progress.emit(100,"변환 완료"); self.success.emit(result)
        except Exception as e: self.failed.emit(str(e))
    def _progress_hook(self,data):
        if self.isInterruptionRequested(): raise RuntimeError("변환 작업이 취소되었습니다.")
        if data.get("status")=="downloading":
            got=data.get("downloaded_bytes") or 0; total=data.get("total_bytes") or data.get("total_bytes_estimate") or 0
            self._emit(int(got*92/total) if total else 5,"다운로드 중")
        elif data.get("status")=="finished": self._emit(93,"다운로드 완료 · 형식 변환 중")
    def _post_hook(self,data):
        if self.isInterruptionRequested(): raise RuntimeError("변환 작업이 취소되었습니다.")
        pct={"started":95,"processing":97,"finished":99}.get(data.get("status"))
        if pct is not None: self._emit(pct,f"{self.format_name.upper()} 변환 중")
    def _emit(self,pct,msg):
        pct=max(0,min(100,int(pct)))
        if pct!=self._last or pct in (0,100): self._last=pct; self.progress.emit(pct,msg)


class PlaylistConvertWorker(QThread):
    progress = Signal(int, str)
    success = Signal(dict)
    failed = Signal(str)

    def __init__(self, url: str):
        super().__init__()
        self.url = url
        self._last_percent = -1

    def _emit_progress(self, percent: int, message: str):
        percent = max(
            0,
            min(100, int(percent))
        )

        if (
            percent != self._last_percent
            or percent in (0, 100)
        ):
            self._last_percent = percent
            self.progress.emit(
                percent,
                message
            )

    def run(self):
        try:
            self._emit_progress(
                0,
                "YouTube 재생목록 정보를 확인하는 중..."
            )

            result = backend.download_playlist_flac(
                self.url,
                progress_callback=self._emit_progress,
                cancel_check=self.isInterruptionRequested,
            )

            self._emit_progress(
                100,
                "재생목록 모든 작업 완료"
            )

            self.success.emit(result)

        except Exception as e:
            self.failed.emit(str(e))



class UploadWorker(QThread):
    progress = Signal(int, int, str)
    batch_finished = Signal(list, list)

    def __init__(self, files, base_url: str, remote_path: str):
        super().__init__()
        self.files = [Path(p) for p in files]
        self.base_url = base_url.rstrip("/")
        self.remote_path = remote_path

    def _remote_has_file(self, filename: str) -> bool:
        """
        업로드 응답이 끊긴 경우 실제 HiBy에 파일이 들어갔는지 확인한다.
        이미 존재하면 중복 재전송하지 않고 성공으로 간주한다.
        """
        try:
            response = requests.get(
                f"{self.base_url}/list",
                params={"path": self.remote_path},
                timeout=(3, 20),
            )

            if response.status_code != 200:
                return False

            data = response.json()

            if not isinstance(data, list):
                return False

            target = filename.casefold()

            for item in data:
                if not isinstance(item, dict):
                    continue

                name = str(
                    item.get("name")
                    or ""
                ).casefold()

                if name == target:
                    return True

            return False

        except Exception:
            return False

    def _upload_one(self, file_path: Path):
        mime = (
            mimetypes.guess_type(
                file_path.name
            )[0]
            or "application/octet-stream"
        )

        last_error = None

        # 일시적인 Wi-Fi/HiBy HTTP 오류는 최대 3번까지 재시도.
        for attempt in range(1, 4):
            if self.isInterruptionRequested():
                raise RuntimeError(
                    "HiBy 전송 작업이 취소되었습니다."
                )

            try:
                with file_path.open("rb") as f:
                    response = requests.post(
                        f"{self.base_url}/upload",
                        data={
                            "path": self.remote_path
                        },
                        files={
                            "files[]": (
                                file_path.name,
                                f,
                                mime
                            )
                        },
                        timeout=(5, 180),
                    )

                if response.status_code == 200:
                    return True, ""

                last_error = (
                    f"HTTP {response.status_code}"
                )

            except Exception as e:
                last_error = str(e)

                # 서버 응답만 유실됐을 가능성이 있으므로
                # 실제 파일 존재 여부를 확인한다.
                if self._remote_has_file(
                    file_path.name
                ):
                    return True, ""

            if attempt < 3:
                # 1.5초, 3초 간격으로 재시도
                time.sleep(1.5 * attempt)

        return False, str(
            last_error
            or "알 수 없는 전송 오류"
        )

    def run(self):
        uploaded = []
        failed = []
        total = len(self.files)

        for i, file_path in enumerate(
            self.files,
            start=1
        ):
            if self.isInterruptionRequested():
                failed.append({
                    "path": str(file_path),
                    "name": file_path.name,
                    "reason": "작업이 취소되었습니다.",
                })

                # 취소 시 남은 파일도 실패 목록에 남겨 실제 전송수와
                # 요청수를 혼동하지 않게 한다.
                for remaining in self.files[i:]:
                    failed.append({
                        "path": str(remaining),
                        "name": remaining.name,
                        "reason": "작업이 취소되었습니다.",
                    })
                break

            if not file_path.exists():
                failed.append({
                    "path": str(file_path),
                    "name": file_path.name,
                    "reason": "로컬 파일이 없습니다.",
                })
                self.progress.emit(
                    i,
                    total,
                    file_path.name
                )
                continue

            self.progress.emit(
                i - 1,
                total,
                file_path.name
            )

            ok, reason = self._upload_one(
                file_path
            )

            if ok:
                uploaded.append(
                    str(file_path)
                )
            else:
                # 한 곡 실패해도 전체 HiBy 전송을 중단하지 않는다.
                failed.append({
                    "path": str(file_path),
                    "name": file_path.name,
                    "reason": reason,
                })

            self.progress.emit(
                i,
                total,
                file_path.name
            )

        self.batch_finished.emit(
            uploaded,
            failed
        )


class PingWorker(QThread):
    finished_ping = Signal(bool, str)

    def __init__(self, base_url: str):
        super().__init__()
        self.base_url = base_url.rstrip("/")

    def run(self):
        try:
            r = requests.get(self.base_url, timeout=2.5)
            ok = 200 <= r.status_code < 500
            self.finished_ping.emit(ok, f"HTTP {r.status_code}")
        except Exception as e:
            self.finished_ping.emit(False, str(e))



class HiByDiscoveryWorker(QThread):
    found = Signal(str)
    failed = Signal(str)
    status = Signal(str)

    def __init__(self, seed_url: str, remote_path: str):
        super().__init__()
        self.seed_url = (seed_url or "").strip().rstrip("/")
        self.remote_path = remote_path or "/data/mnt/sd_0/"

    def _normalize_url(self, value: str):
        value = (value or "").strip().rstrip("/")

        if not value:
            return ""

        if "://" not in value:
            value = "http://" + value

        parsed = urlparse(value)

        if not parsed.hostname:
            return ""

        port = parsed.port or 4399
        return f"http://{parsed.hostname}:{port}"

    def _prefix_from_seed(self):
        normalized = self._normalize_url(self.seed_url)

        if normalized:
            host = urlparse(normalized).hostname or ""

            parts = host.split(".")

            if (
                len(parts) == 4
                and all(
                    part.isdigit()
                    and 0 <= int(part) <= 255
                    for part in parts
                )
            ):
                return ".".join(parts[:3])

        # 설정 주소가 유효하지 않을 때 현재 PC의 LAN IP를 보조적으로 사용
        try:
            sock = socket.socket(
                socket.AF_INET,
                socket.SOCK_DGRAM
            )
            sock.settimeout(0.2)

            # 실제 데이터 전송 없이 라우팅 기준 로컬 IP만 얻는다.
            sock.connect(("8.8.8.8", 80))
            local_ip = sock.getsockname()[0]
            sock.close()

            parts = local_ip.split(".")

            if len(parts) == 4:
                return ".".join(parts[:3])

        except Exception:
            pass

        return None

    def _verify_hiby(self, base_url: str):
        try:
            response = requests.get(
                f"{base_url}/list",
                params={"path": self.remote_path},
                timeout=(0.35, 0.9),
            )

            if response.status_code != 200:
                return False

            data = response.json()
            return isinstance(data, list)

        except Exception:
            return False

    def _probe_ip(self, ip: str):
        if self.isInterruptionRequested():
            return None

        try:
            with socket.create_connection(
                (ip, 4399),
                timeout=0.18
            ):
                pass
        except OSError:
            return None

        base_url = f"http://{ip}:4399"

        if self._verify_hiby(base_url):
            return base_url

        return None

    def run(self):
        try:
            # 먼저 현재 저장 주소를 빠르게 재검증한다.
            current_url = self._normalize_url(
                self.seed_url
            )

            if (
                current_url
                and self._verify_hiby(current_url)
            ):
                self.found.emit(current_url)
                return

            prefix = self._prefix_from_seed()

            if not prefix:
                self.failed.emit(
                    "검색할 로컬 네트워크 대역을 확인할 수 없습니다."
                )
                return

            self.status.emit(
                f"{prefix}.1 ~ {prefix}.254에서 HiBy 검색 중..."
            )

            ips = [
                f"{prefix}.{i}"
                for i in range(1, 255)
            ]

            executor = ThreadPoolExecutor(
                max_workers=64
            )

            futures = {
                executor.submit(
                    self._probe_ip,
                    ip
                ): ip
                for ip in ips
            }

            found_url = None

            try:
                for future in as_completed(
                    futures
                ):
                    if self.isInterruptionRequested():
                        break

                    try:
                        result = future.result()
                    except Exception:
                        result = None

                    if result:
                        found_url = result
                        break

            finally:
                for future in futures:
                    if not future.done():
                        future.cancel()

                executor.shutdown(
                    wait=False,
                    cancel_futures=True
                )

            if self.isInterruptionRequested():
                self.failed.emit(
                    "HiBy 자동 검색이 취소되었습니다."
                )
                return

            if found_url:
                self.found.emit(found_url)
            else:
                self.failed.emit(
                    f"{prefix}.0/24 네트워크에서 HiBy를 찾지 못했습니다."
                )

        except Exception as e:
            self.failed.emit(str(e))


class HibyListWorker(QThread):
    success = Signal(list)
    failed = Signal(str)

    def __init__(self, base_url: str, remote_path: str):
        super().__init__()
        self.base_url = base_url.rstrip("/")
        self.remote_path = remote_path

    def run(self):
        try:
            response = requests.get(
                f"{self.base_url}/list",
                params={"path": self.remote_path},
                timeout=(3, 15),
            )

            if response.status_code != 200:
                raise RuntimeError(
                    f"HiBy 목록 조회 실패: HTTP {response.status_code}"
                )

            data = response.json()

            if not isinstance(data, list):
                raise RuntimeError("HiBy 목록 응답 형식이 올바르지 않습니다.")

            self.success.emit(data)

        except Exception as e:
            self.failed.emit(str(e))


class HibyDeleteWorker(QThread):
    progress = Signal(int, int, str)
    finished_delete = Signal(list, list)

    def __init__(self, base_url: str, items):
        super().__init__()
        self.base_url = base_url.rstrip("/")
        self.items = list(items)

    def run(self):
        deleted = []
        failed = []
        total = len(self.items)

        for i, item in enumerate(self.items, start=1):
            if self.isInterruptionRequested():
                failed.append({
                    "name": item.get("name", ""),
                    "reason": "작업이 취소되었습니다."
                })
                break

            name = item.get("name") or ""
            path = item.get("path") or ""

            self.progress.emit(
                i - 1,
                total,
                name
            )

            try:
                response = requests.post(
                    f"{self.base_url}/delete",
                    data={"path": path},
                    timeout=(3, 30),
                )

                if response.status_code != 200:
                    raise RuntimeError(
                        f"HTTP {response.status_code}"
                    )

                deleted.append({
                    "name": name,
                    "path": path,
                })

            except Exception as e:
                failed.append({
                    "name": name,
                    "path": path,
                    "reason": str(e),
                })

            self.progress.emit(
                i,
                total,
                name
            )

        self.finished_delete.emit(
            deleted,
            failed
        )


class ToggleSwitch(QCheckBox):
    """고대비 ON/OFF 토글 스위치."""

    def __init__(self, parent=None):
        super().__init__(parent)
        self.setCursor(Qt.PointingHandCursor)
        self.setFixedSize(52, 28)
        self.setText("")

    def hitButton(self, pos):
        # QCheckBox 기본 클릭 영역은 indicator 중심으로 잡혀
        # 오른쪽 일부가 클릭되지 않을 수 있으므로 전체 위젯을 클릭 영역으로 사용
        return self.rect().contains(pos)

    def paintEvent(self, event):
        painter = QPainter(self)
        painter.setRenderHint(QPainter.Antialiasing)

        track = QRectF(1, 1, self.width() - 2, self.height() - 2)

        if self.isChecked():
            bg = QColor("#FF365F")
            border = QColor("#FF7891")
            knob_x = self.width() - 25
        else:
            bg = QColor("#2A313D")
            border = QColor("#667085")
            knob_x = 3

        painter.setPen(QPen(border, 1))
        painter.setBrush(bg)
        painter.drawRoundedRect(track, 13, 13)

        painter.setPen(Qt.NoPen)
        painter.setBrush(QColor("#FFFFFF"))
        painter.drawEllipse(QRectF(knob_x, 3, 22, 22))


def confirm_dark(parent, title: str, message: str) -> bool:
    """앱 테마와 일치하는 확인창. Windows 기본 흰 배경/흰 글자 충돌 방지."""
    box = QMessageBox(parent)
    box.setIcon(QMessageBox.Question)
    box.setWindowTitle(title)
    box.setText(message)
    box.setStandardButtons(
        QMessageBox.Yes | QMessageBox.No
    )
    box.setDefaultButton(QMessageBox.No)

    box.setStyleSheet("""
        QMessageBox {
            background: #171D26;
        }

        QMessageBox QLabel {
            background: transparent;
            color: #F3F5F8;
            min-width: 420px;
            font-size: 13px;
        }

        QMessageBox QPushButton {
            min-width: 90px;
            min-height: 36px;
            padding: 0 14px;
            border-radius: 8px;
            background: #252D39;
            border: 1px solid #465264;
            color: #F4F6F8;
            font-weight: 700;
        }

        QMessageBox QPushButton:hover {
            background: #313B49;
            border-color: #68768B;
        }

        QMessageBox QPushButton:default {
            background: #2A2026;
            border-color: #704052;
            color: #FFB0BF;
        }
    """)

    return box.exec() == QMessageBox.Yes



class TagEditorDialog(QDialog):
    def __init__(self, path: Path, parent=None):
        super().__init__(parent)

        self.original_path = Path(path)
        self.result_path = self.original_path
        self.cover_action = "keep"
        self.new_cover_path = None

        self.setWindowTitle("FLAC 태그 / 파일명 수정")
        self.setMinimumWidth(650)

        root = QVBoxLayout(self)
        root.setContentsMargins(22, 20, 22, 20)
        root.setSpacing(16)

        header = QHBoxLayout()

        self.cover_preview = QLabel("♪")
        self.cover_preview.setAlignment(Qt.AlignCenter)
        self.cover_preview.setFixedSize(130, 130)
        self.cover_preview.setObjectName("coverBox")
        header.addWidget(self.cover_preview)

        title_box = QVBoxLayout()
        title = QLabel("곡 정보 수정")
        title.setObjectName("statusTitle")
        title_box.addWidget(title)

        subtitle = QLabel(
            "제목·아티스트·앨범 등의 FLAC 태그와 파일명을 함께 수정합니다."
        )
        subtitle.setObjectName("statusText")
        subtitle.setWordWrap(True)
        title_box.addWidget(subtitle)

        cover_buttons = QHBoxLayout()

        change_cover_btn = QPushButton("커버 변경")
        change_cover_btn.setObjectName("secondaryButton")
        change_cover_btn.clicked.connect(self.choose_cover)
        cover_buttons.addWidget(change_cover_btn)

        remove_cover_btn = QPushButton("커버 제거")
        remove_cover_btn.setObjectName("secondaryButton")
        remove_cover_btn.clicked.connect(self.remove_cover)
        cover_buttons.addWidget(remove_cover_btn)

        cover_buttons.addStretch()
        title_box.addLayout(cover_buttons)
        title_box.addStretch()

        header.addLayout(title_box, 1)
        root.addLayout(header)

        form = QFormLayout()
        form.setSpacing(10)

        self.title_input = QLineEdit()
        self.artist_input = QLineEdit()
        self.album_input = QLineEdit()
        self.date_input = QLineEdit()
        self.genre_input = QLineEdit()
        self.filename_input = QLineEdit()

        self.date_input.setPlaceholderText("예: 2026")
        self.genre_input.setPlaceholderText("예: Pop, Rock, Classical")

        form.addRow("제목", self.title_input)
        form.addRow("아티스트", self.artist_input)
        form.addRow("앨범", self.album_input)
        form.addRow("연도", self.date_input)
        form.addRow("장르", self.genre_input)
        form.addRow("파일명", self.filename_input)

        root.addLayout(form)

        filename_row = QHBoxLayout()
        filename_row.addStretch()

        auto_name_btn = QPushButton("아티스트 - 제목으로 파일명 만들기")
        auto_name_btn.setObjectName("secondaryButton")
        auto_name_btn.clicked.connect(self.make_auto_filename)
        filename_row.addWidget(auto_name_btn)

        root.addLayout(filename_row)

        button_row = QHBoxLayout()
        button_row.addStretch()

        cancel_btn = QPushButton("취소")
        cancel_btn.setObjectName("secondaryButton")
        cancel_btn.clicked.connect(self.reject)
        button_row.addWidget(cancel_btn)

        save_btn = QPushButton("저장")
        save_btn.setObjectName("accentButton")
        save_btn.clicked.connect(self.save_changes)
        button_row.addWidget(save_btn)

        root.addLayout(button_row)

        self.setStyleSheet("""
            QDialog {
                background: #11161E;
                color: #F3F5F8;
            }

            QLabel {
                color: #E8ECF2;
            }

            QLineEdit {
                min-height: 38px;
                padding: 0 10px;
                background: #171D26;
                border: 1px solid #364151;
                border-radius: 8px;
                color: #F3F5F8;
                selection-background-color: #A8425C;
            }

            QLineEdit:focus {
                border-color: #A8425C;
            }

            #coverBox {
                background: #171D26;
                border: 1px solid #303A49;
                border-radius: 12px;
                color: #738096;
                font-size: 34px;
            }

            #statusTitle {
                color: #FFFFFF;
                font-size: 18px;
                font-weight: 800;
            }

            #statusText {
                color: #98A2B2;
                font-size: 12px;
            }

            QPushButton {
                min-height: 38px;
                padding: 0 14px;
                border-radius: 8px;
                font-weight: 700;
            }

            #secondaryButton {
                background: #202733;
                border: 1px solid #3A4555;
                color: #DDE3EC;
            }

            #secondaryButton:hover {
                background: #2B3442;
            }

            #accentButton {
                background: #B63F5C;
                border: 1px solid #D0506E;
                color: #FFFFFF;
            }

            #accentButton:hover {
                background: #C94B69;
            }
        """)

        self.load_current_values()

    def load_current_values(self):
        try:
            audio = FLAC(str(self.original_path))
        except Exception as e:
            QMessageBox.warning(
                self,
                "파일 읽기 실패",
                str(e)
            )
            self.reject()
            return

        self.title_input.setText(
            first_tag(
                audio,
                "TITLE",
                self.original_path.stem
            )
        )
        self.artist_input.setText(
            first_tag(audio, "ARTIST")
        )
        self.album_input.setText(
            first_tag(audio, "ALBUM")
        )
        self.date_input.setText(
            first_tag(audio, "DATE")
        )
        self.genre_input.setText(
            first_tag(audio, "GENRE")
        )
        self.filename_input.setText(
            self.original_path.name
        )

        if audio.pictures:
            pixmap = QPixmap()

            if pixmap.loadFromData(
                audio.pictures[0].data
            ):
                self.cover_preview.setPixmap(
                    pixmap.scaled(
                        self.cover_preview.size(),
                        Qt.KeepAspectRatio,
                        Qt.SmoothTransformation
                    )
                )

    def choose_cover(self):
        filename, _ = QFileDialog.getOpenFileName(
            self,
            "앨범 커버 선택",
            "",
            "이미지 파일 (*.jpg *.jpeg *.png)"
        )

        if not filename:
            return

        self.new_cover_path = Path(filename)
        self.cover_action = "replace"

        pixmap = QPixmap(filename)

        if not pixmap.isNull():
            self.cover_preview.setPixmap(
                pixmap.scaled(
                    self.cover_preview.size(),
                    Qt.KeepAspectRatio,
                    Qt.SmoothTransformation
                )
            )

    def remove_cover(self):
        self.cover_action = "remove"
        self.new_cover_path = None
        self.cover_preview.clear()
        self.cover_preview.setText("♪")

    def make_auto_filename(self):
        artist = self.artist_input.text().strip()
        title = self.title_input.text().strip()

        if artist and title:
            base = f"{artist} - {title}"
        elif title:
            base = title
        elif artist:
            base = artist
        else:
            base = self.original_path.stem

        self.filename_input.setText(
            safe_audio_filename(
                base,
                self.original_path.name
            )
        )

    def save_changes(self):
        title = self.title_input.text().strip()
        artist = self.artist_input.text().strip()
        album = self.album_input.text().strip()
        date = self.date_input.text().strip()
        genre = self.genre_input.text().strip()

        new_filename = safe_audio_filename(
            self.filename_input.text(),
            self.original_path.name
        )

        new_path = (
            self.original_path.parent
            / new_filename
        )

        # 덮어쓰기 방지
        if (
            new_path.resolve()
            != self.original_path.resolve()
            and new_path.exists()
        ):
            QMessageBox.warning(
                self,
                "파일명 중복",
                (
                    "같은 이름의 파일이 이미 있습니다.\n\n"
                    f"{new_filename}"
                )
            )
            return

        try:
            audio = FLAC(
                str(self.original_path)
            )

            def set_or_delete(key, value):
                if value:
                    audio[key] = [value]
                elif key in audio:
                    del audio[key]

            set_or_delete("TITLE", title)
            set_or_delete("ARTIST", artist)
            set_or_delete("ALBUM", album)
            set_or_delete("DATE", date)
            set_or_delete("GENRE", genre)

            if self.cover_action == "remove":
                audio.clear_pictures()

            elif (
                self.cover_action == "replace"
                and self.new_cover_path
            ):
                image_path = self.new_cover_path
                data = image_path.read_bytes()

                picture = Picture()
                picture.type = 3
                picture.desc = "Cover"
                picture.data = data

                suffix = (
                    image_path.suffix
                    .lower()
                )

                picture.mime = (
                    "image/png"
                    if suffix == ".png"
                    else "image/jpeg"
                )

                audio.clear_pictures()
                audio.add_picture(picture)

            audio.save()

            if (
                new_path.resolve()
                != self.original_path.resolve()
            ):
                self.original_path.rename(
                    new_path
                )

            self.result_path = new_path
            self.accept()

        except Exception as e:
            QMessageBox.warning(
                self,
                "저장 실패",
                str(e)
            )



class MainWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        self.settings = QSettings("LocalTools", "YouTubeFLACConverter")
        self.hiby_url = self.settings.value("hiby_url", DEFAULT_HIBY_URL)
        self.hiby_path = self.settings.value("hiby_path", DEFAULT_HIBY_PATH)
        self.auto_upload = self.settings.value("auto_upload", False, type=bool)

        self.hiby_remote_items = []
        self.hiby_list_loaded = False
        self.hiby_list_state = "idle"   # idle / loading / loaded / error
        self.hiby_list_error = ""
        self.hiby_list_request_silent = False
        self.hiby_upload_records = self.load_hiby_upload_records()

        self.library_filter_mode = "all"

        self.last_file = None
        self.convert_worker = None
        self.upload_worker = None
        self.ping_worker = None
        self.hiby_list_worker = None
        self.hiby_delete_worker = None
        self.hiby_discovery_worker = None
        self.hiby_auto_discovery_attempted = False

        # 자동 전송 감시 상태
        # Chrome 확장프로그램에서 변환한 파일도 감지하기 위해
        # 다운로드 폴더의 새/변경 FLAC을 안정화 후 감시한다.
        self.auto_upload_watch = {}
        self.current_upload_files = []
        self.current_upload_is_auto = False


        self.setWindowTitle(APP_NAME)
        self.resize(1120, 740)
        self.setMinimumSize(980, 650)

        icon_path = Path(__file__).resolve().parent / "flac_converter.ico"
        if icon_path.exists():
            self.setWindowIcon(QIcon(str(icon_path)))

        self.build_ui()
        self.apply_style()
        self.refresh_library()

        # 프로그램 시작 시 HiBy 파일목록을 미리 읽어 보관함 상태에 반영
        QTimer.singleShot(
            1200,
            lambda: self.refresh_hiby_files(silent=True)
        )


        # 시작 당시 존재하던 파일은 자동 전송 대상에서 제외한다.
        self.reset_auto_upload_watch_baseline()

        self.auto_upload_timer = QTimer(self)
        self.auto_upload_timer.timeout.connect(
            self.scan_auto_upload_folder
        )
        self.auto_upload_timer.start(1500)

    def load_hiby_upload_records(self):
        raw = self.settings.value(
            "hiby_upload_records",
            "{}"
        )

        if isinstance(raw, dict):
            return raw

        try:
            data = json.loads(str(raw))
            return data if isinstance(data, dict) else {}
        except Exception:
            return {}

    def save_hiby_upload_records(self):
        try:
            self.settings.setValue(
                "hiby_upload_records",
                json.dumps(
                    self.hiby_upload_records,
                    ensure_ascii=False
                )
            )
        except Exception:
            pass

    def local_track_identity(self, path: Path):
        """FLAC의 YOUTUBE_ID를 우선 사용해 로컬 파일명이 바뀌어도 추적한다."""
        try:
            if path.suffix.lower() == ".flac":
                audio = FLAC(str(path))
                youtube_id = first_tag(
                    audio,
                    "YOUTUBE_ID"
                )

                if youtube_id:
                    return f"youtube:{youtube_id}"
        except Exception:
            pass

        try:
            stat = path.stat()
            return (
                f"file:{path.name.lower()}:"
                f"{stat.st_size}"
            )
        except Exception:
            return f"file:{path.name.lower()}"

    def remember_hiby_match(
        self,
        local_path: Path,
        remote_item: dict
    ):
        identity = self.local_track_identity(
            local_path
        )

        try:
            size = int(
                remote_item.get("size")
                or 0
            )
        except Exception:
            size = 0

        record = {
            "remote_name": str(
                remote_item.get("name")
                or ""
            ),
            "remote_path": str(
                remote_item.get("path")
                or ""
            ),
            "size": size,
            "ctime": str(
                remote_item.get("ctime")
                or ""
            ),
        }

        if (
            self.hiby_upload_records.get(identity)
            != record
        ):
            self.hiby_upload_records[
                identity
            ] = record
            return True

        return False

    def hiby_status_for_local(self, path: Path):
        if self.hiby_list_state == "loading":
            return (
                "… 확인 중",
                "#9CA3AF",
                "HiBy 목록을 확인 중입니다.",
                False
            )

        if self.hiby_list_state == "error":
            return (
                "! 확인 실패",
                "#FF9BAD",
                (
                    "HiBy 목록을 불러오지 못했습니다. "
                    + (self.hiby_list_error or "")
                ),
                False
            )

        if self.hiby_list_state in ("idle",):
            return (
                "○ 확인 필요",
                "#9CA3AF",
                "HiBy 상태 새로고침이 필요합니다.",
                False
            )

        if not self.hiby_list_loaded:
            return (
                "○ 확인 필요",
                "#9CA3AF",
                "HiBy 목록이 아직 준비되지 않았습니다.",
                False
            )

        try:
            local_size = path.stat().st_size
        except Exception:
            local_size = None

        local_name = path.name.lower()

        remote_files = [
            item
            for item in self.hiby_remote_items
            if not str(
                item.get("path", "")
            ).endswith("/")
        ]

        # 1) 파일명 + 크기가 일치하면 확정
        for item in remote_files:
            name = str(
                item.get("name")
                or ""
            )

            if name.lower() != local_name:
                continue

            try:
                remote_size = int(
                    item.get("size")
                    or 0
                )
            except Exception:
                remote_size = 0

            if (
                local_size is None
                or remote_size == 0
                or remote_size == local_size
            ):
                dirty = self.remember_hiby_match(
                    path,
                    item
                )

                return (
                    "✓ 전송됨",
                    "#6DE6AC",
                    "HiBy에 같은 파일명으로 있습니다.",
                    dirty
                )

        # 2) 이전에 확정한 전송 기록의 size + ctime으로 이름 변경 추적
        identity = self.local_track_identity(
            path
        )
        record = self.hiby_upload_records.get(
            identity
        )

        if record:
            try:
                record_size = int(
                    record.get("size")
                    or 0
                )
            except Exception:
                record_size = 0

            record_ctime = str(
                record.get("ctime")
                or ""
            )

            for item in remote_files:
                try:
                    remote_size = int(
                        item.get("size")
                        or 0
                    )
                except Exception:
                    remote_size = 0

                remote_ctime = str(
                    item.get("ctime")
                    or ""
                )

                if (
                    record_size
                    and record_ctime
                    and remote_size == record_size
                    and remote_ctime == record_ctime
                ):
                    current_name = str(
                        item.get("name")
                        or ""
                    )
                    old_name = str(
                        record.get("remote_name")
                        or ""
                    )
                    dirty = False

                    if current_name != old_name:
                        record["remote_name"] = current_name
                        record["remote_path"] = str(
                            item.get("path")
                            or ""
                        )
                        self.hiby_upload_records[
                            identity
                        ] = record
                        dirty = True

                    return (
                        "≈ 전송됨 · 이름 변경",
                        "#F6C760",
                        (
                            "파일명이 달라졌지만 "
                            "전송 당시 크기와 ctime이 일치합니다."
                        ),
                        dirty
                    )

        # 3) 과거 기록이 없는 파일은 같은 크기가 딱 하나면 추정만 표시
        if local_size is not None:
            size_matches = []

            for item in remote_files:
                try:
                    remote_size = int(
                        item.get("size")
                        or 0
                    )
                except Exception:
                    remote_size = 0

                if remote_size == local_size:
                    size_matches.append(item)

            if len(size_matches) == 1:
                return (
                    "≈ 이름 변경 가능성",
                    "#D7AFFF",
                    (
                        "파일명은 다르지만 같은 크기의 "
                        "HiBy 파일이 하나 있습니다."
                    ),
                    False
                )

        return (
            "— 미전송",
            "#7E8798",
            "현재 HiBy 목록에서 찾지 못했습니다.",
            False
        )

    def update_library_hiby_status(self):
        if not hasattr(
            self,
            "library_table"
        ):
            return

        records_changed = False

        for row in range(
            self.library_table.rowCount()
        ):
            file_item = self.library_table.item(
                row,
                0
            )

            if not file_item:
                continue

            path_text = file_item.data(
                Qt.UserRole
            )

            if not path_text:
                continue

            status_text, color, tip, dirty = (
                self.hiby_status_for_local(
                    Path(path_text)
                )
            )

            records_changed = (
                records_changed
                or dirty
            )

            status_item = QTableWidgetItem(
                status_text
            )
            status_item.setForeground(
                QColor(color)
            )
            status_item.setToolTip(tip)

            self.library_table.setItem(
                row,
                4,
                status_item
            )

        if records_changed:
            self.save_hiby_upload_records()

        if hasattr(
            self,
            "library_search_input"
        ):
            self.apply_library_filters()

    def file_signature(self, path: Path):
        try:
            stat = path.stat()
            return (
                int(stat.st_size),
                int(stat.st_mtime_ns)
            )
        except Exception:
            return None

    def reset_auto_upload_watch_baseline(self):
        folder = Path(
            backend.DOWNLOAD_DIR
        )

        folder.mkdir(
            parents=True,
            exist_ok=True
        )

        current = {}

        for path in folder.glob("*.flac"):
            try:
                key = str(path.resolve())
            except Exception:
                key = str(path)

            current[key] = {
                "path": path,
                "sig": self.file_signature(path),
                "stable": 2,
                "handled": True,
            }

        self.auto_upload_watch = current

    def mark_auto_upload_handled(self, path: Path):
        try:
            key = str(
                Path(path).resolve()
            )
        except Exception:
            key = str(path)

        self.auto_upload_watch[key] = {
            "path": Path(path),
            "sig": self.file_signature(
                Path(path)
            ),
            "stable": 2,
            "handled": True,
            "retry_after": 0,
        }

    def on_auto_upload_toggled(self, checked):
        # 스위치를 누르는 즉시 실제 설정값도 바꾼다.
        # 별도로 '설정 저장'을 누르지 않아도 적용된다.
        self.auto_upload = bool(checked)

        self.settings.setValue(
            "auto_upload",
            self.auto_upload
        )

        self.auto_upload_state.setText(
            "ON"
            if self.auto_upload
            else "OFF"
        )

        if self.auto_upload:
            # 켜는 순간 이미 있던 과거 파일은 보내지 않고
            # 이후 생성/변경되는 파일만 자동 전송한다.
            self.reset_auto_upload_watch_baseline()

    def scan_auto_upload_folder(self):
        if not self.auto_upload:
            return

        # 이미 전송 중이면 다음 타이머에서 다시 확인
        if (
            self.upload_worker
            and self.upload_worker.isRunning()
        ):
            return

        folder = Path(
            backend.DOWNLOAD_DIR
        )

        if not folder.exists():
            return

        existing_keys = set()
        ready_files = []

        for path in folder.glob("*.flac"):
            try:
                key = str(path.resolve())
            except Exception:
                key = str(path)

            existing_keys.add(key)

            sig = self.file_signature(path)

            if sig is None:
                continue

            state = self.auto_upload_watch.get(
                key
            )

            if state is None:
                # 처음 발견. 아직 변환/태그 작성 중일 수 있으므로
                # 다음 스캔까지 기다린다.
                self.auto_upload_watch[key] = {
                    "path": path,
                    "sig": sig,
                    "stable": 0,
                    "handled": False,
                }
                continue

            if state.get("sig") == sig:
                state["stable"] = (
                    int(
                        state.get(
                            "stable",
                            0
                        )
                    )
                    + 1
                )
            else:
                # 파일이 계속 쓰이는 중이면 안정화 카운터를 다시 시작
                state["sig"] = sig
                state["stable"] = 0
                state["handled"] = False

            state["path"] = path
            self.auto_upload_watch[
                key
            ] = state

            retry_after = float(
                state.get(
                    "retry_after",
                    0
                )
                or 0
            )

            if (
                not state.get(
                    "handled",
                    False
                )
                and state.get(
                    "stable",
                    0
                ) >= 1
                and time.time() >= retry_after
            ):
                ready_files.append(path)

        # 삭제된 파일 감시정보 정리
        for key in list(
            self.auto_upload_watch.keys()
        ):
            if key not in existing_keys:
                self.auto_upload_watch.pop(
                    key,
                    None
                )

        if not ready_files:
            return

        # 실제 업로드에 성공한 파일만 handled=True로 표시한다.
        # 실패한 파일은 잠시 뒤 자동 재시도할 수 있도록 미처리 상태로 둔다.
        self.upload_files_to_hiby(
            ready_files,
            is_auto=True
        )

    def build_ui(self):
        central = QWidget()
        self.setCentralWidget(central)
        root = QHBoxLayout(central)
        root.setContentsMargins(0, 0, 0, 0)
        root.setSpacing(0)

        self.sidebar = QFrame()
        self.sidebar.setObjectName("sidebar")
        self.sidebar.setFixedWidth(220)
        side_layout = QVBoxLayout(self.sidebar)
        side_layout.setContentsMargins(18, 22, 18, 20)
        side_layout.setSpacing(8)

        title = QLabel("♪  FLAC Converter")
        title.setObjectName("appTitle")
        side_layout.addWidget(title)
        subtitle = QLabel("YouTube · FLAC · HiBy")
        subtitle.setObjectName("appSubTitle")
        side_layout.addWidget(subtitle)
        side_layout.addSpacing(22)

        self.nav_buttons = []
        nav_items = [
            ("◉   FLAC 변환", 0),
            ("▤   FLAC 보관함", 1),
            ("⇧   HiBy 플레이어", 2),
            ("⚙   설정", 3),
        ]
        for text, index in nav_items:
            btn = QPushButton(text)
            btn.setObjectName("navButton")
            btn.setCheckable(True)
            btn.clicked.connect(lambda checked=False, i=index: self.switch_page(i))
            side_layout.addWidget(btn)
            self.nav_buttons.append(btn)

        side_layout.addStretch()
        self.server_status = QLabel("● 로컬 변환 엔진")
        self.server_status.setObjectName("serverStatus")
        side_layout.addWidget(self.server_status)
        root.addWidget(self.sidebar)

        self.pages = QStackedWidget()
        root.addWidget(self.pages, 1)
        self.pages.addWidget(self.build_convert_page())
        self.pages.addWidget(self.build_library_page())
        self.pages.addWidget(self.build_hiby_page())
        self.pages.addWidget(self.build_settings_page())
        self.switch_page(0)

    def build_convert_page(self):
        page = QWidget()
        layout = QVBoxLayout(page)
        layout.setContentsMargins(34, 30, 34, 28)
        layout.setSpacing(18)

        title = QLabel("YouTube FLAC 변환")
        title.setObjectName("pageTitle")
        layout.addWidget(title)
        desc = QLabel("영상 1개 또는 YouTube 재생목록 전체를 FLAC으로 변환하고, 태그와 앨범커버까지 자동 저장합니다.")
        desc.setObjectName("pageDesc")
        layout.addWidget(desc)

        input_card = QFrame()
        input_card.setObjectName("card")
        card_layout = QVBoxLayout(input_card)
        card_layout.setContentsMargins(22, 22, 22, 22)
        input_label = QLabel("YouTube 주소")
        input_label.setObjectName("fieldLabel")
        card_layout.addWidget(input_label)

        row = QHBoxLayout()
        self.url_input = QLineEdit()
        self.url_input.setPlaceholderText("영상 / Shorts / 재생목록 주소를 붙여넣으세요")
        self.url_input.returnPressed.connect(self.start_conversion)
        row.addWidget(self.url_input, 1)

        paste_btn = QPushButton("붙여넣기")
        paste_btn.setObjectName("secondaryButton")
        paste_btn.clicked.connect(self.paste_url)
        row.addWidget(paste_btn)

        self.convert_btn = QPushButton("FLAC 변환")
        self.convert_btn.setObjectName("primaryButton")
        self.convert_btn.clicked.connect(self.start_conversion)
        row.addWidget(self.convert_btn)

        self.playlist_convert_btn = QPushButton("재생목록 전체")
        self.playlist_convert_btn.setObjectName("accentButton")
        self.playlist_convert_btn.clicked.connect(
            self.start_playlist_conversion
        )
        row.addWidget(self.playlist_convert_btn)

        card_layout.addLayout(row)

        self.convert_progress = QProgressBar()
        self.convert_progress.setRange(0, 100)
        self.convert_progress.setValue(0)
        self.convert_progress.setTextVisible(True)
        self.convert_progress.setFormat("%p%")
        self.convert_progress.hide()
        card_layout.addWidget(self.convert_progress)
        layout.addWidget(input_card)

        self.convert_status_card = QFrame()
        self.convert_status_card.setObjectName("card")
        status_layout = QVBoxLayout(self.convert_status_card)
        status_layout.setContentsMargins(22, 22, 22, 22)

        self.convert_status_title = QLabel("변환 준비 완료")
        self.convert_status_title.setObjectName("statusTitle")
        status_layout.addWidget(self.convert_status_title)
        self.convert_status_text = QLabel("YouTube 주소를 입력한 뒤 FLAC 변환을 누르세요.")
        self.convert_status_text.setWordWrap(True)
        self.convert_status_text.setObjectName("statusText")
        status_layout.addWidget(self.convert_status_text)

        action_row = QHBoxLayout()
        self.result_folder_btn = QPushButton("폴더 열기")
        self.result_folder_btn.setObjectName("secondaryButton")
        self.result_folder_btn.clicked.connect(self.open_download_folder)
        action_row.addWidget(self.result_folder_btn)

        self.result_reveal_btn = QPushButton("파일 위치 보기")
        self.result_reveal_btn.setObjectName("secondaryButton")
        self.result_reveal_btn.clicked.connect(self.reveal_last_file)
        self.result_reveal_btn.setEnabled(False)
        action_row.addWidget(self.result_reveal_btn)

        self.result_hiby_btn = QPushButton("HiBy로 전송")
        self.result_hiby_btn.setObjectName("accentButton")
        self.result_hiby_btn.clicked.connect(self.upload_last_to_hiby)
        self.result_hiby_btn.setEnabled(False)
        action_row.addWidget(self.result_hiby_btn)
        action_row.addStretch()
        status_layout.addLayout(action_row)

        layout.addWidget(self.convert_status_card)
        layout.addStretch()
        return page

    def build_library_page(self):
        page = QWidget()
        layout = QVBoxLayout(page)
        layout.setContentsMargins(34, 30, 34, 28)
        layout.setSpacing(16)

        top = QHBoxLayout()
        title_box = QVBoxLayout()
        title = QLabel("FLAC 보관함")
        title.setObjectName("pageTitle")
        title_box.addWidget(title)
        self.library_subtitle = QLabel(str(backend.DOWNLOAD_DIR))
        self.library_subtitle.setObjectName("pageDesc")
        title_box.addWidget(self.library_subtitle)
        top.addLayout(title_box)
        top.addStretch()

        refresh_btn = QPushButton("새로고침")
        refresh_btn.setObjectName("secondaryButton")
        refresh_btn.clicked.connect(self.refresh_library)
        top.addWidget(refresh_btn)

        hiby_refresh_btn = QPushButton("HiBy 상태 확인")
        hiby_refresh_btn.setObjectName("secondaryButton")
        hiby_refresh_btn.clicked.connect(
            lambda: self.refresh_hiby_files(silent=False)
        )
        top.addWidget(hiby_refresh_btn)

        folder_btn = QPushButton("폴더 열기")
        folder_btn.setObjectName("secondaryButton")
        folder_btn.clicked.connect(self.open_download_folder)
        top.addWidget(folder_btn)

        self.upload_selected_btn = QPushButton("선택곡 → HiBy")
        self.upload_selected_btn.setObjectName("accentButton")
        self.upload_selected_btn.clicked.connect(self.upload_selected_to_hiby)
        top.addWidget(self.upload_selected_btn)

        delete_selected_btn = QPushButton("선택 파일 삭제")
        delete_selected_btn.setObjectName("dangerButton")
        delete_selected_btn.clicked.connect(self.delete_selected_local_files)
        top.addWidget(delete_selected_btn)

        layout.addLayout(top)

        # -------------------------------------------------
        # 검색 / HiBy 상태 필터
        # -------------------------------------------------
        filter_card = QFrame()
        filter_card.setObjectName("libraryFilterCard")

        filter_layout = QHBoxLayout(filter_card)
        filter_layout.setContentsMargins(14, 12, 14, 12)
        filter_layout.setSpacing(8)

        self.library_search_input = QLineEdit()
        self.library_search_input.setPlaceholderText(
            "곡명 · 아티스트 · 앨범 · 파일명 검색"
        )
        self.library_search_input.setClearButtonEnabled(True)
        self.library_search_input.textChanged.connect(
            self.apply_library_filters
        )
        filter_layout.addWidget(
            self.library_search_input,
            1
        )

        self.filter_all_btn = QPushButton("전체")
        self.filter_all_btn.setObjectName("filterButton")
        self.filter_all_btn.setCheckable(True)
        self.filter_all_btn.setChecked(True)
        self.filter_all_btn.clicked.connect(
            lambda: self.set_library_filter("all")
        )
        filter_layout.addWidget(self.filter_all_btn)

        self.filter_sent_btn = QPushButton("HiBy 전송됨")
        self.filter_sent_btn.setObjectName("filterButton")
        self.filter_sent_btn.setCheckable(True)
        self.filter_sent_btn.clicked.connect(
            lambda: self.set_library_filter("sent")
        )
        filter_layout.addWidget(self.filter_sent_btn)

        self.filter_unsent_btn = QPushButton("미전송만")
        self.filter_unsent_btn.setObjectName("filterButton")
        self.filter_unsent_btn.setCheckable(True)
        self.filter_unsent_btn.clicked.connect(
            lambda: self.set_library_filter("unsent")
        )
        filter_layout.addWidget(self.filter_unsent_btn)

        self.upload_unsent_btn = QPushButton(
            "미전송 모두 HiBy"
        )
        self.upload_unsent_btn.setObjectName(
            "accentButton"
        )
        self.upload_unsent_btn.clicked.connect(
            self.upload_all_unsent_to_hiby
        )
        filter_layout.addWidget(
            self.upload_unsent_btn
        )

        layout.addWidget(filter_card)

        self.library_table = QTableWidget(0, 7)
        self.library_table.setHorizontalHeaderLabels(
            [
                "파일명",
                "제목",
                "아티스트",
                "앨범",
                "HiBy 상태",
                "용량",
                "저장일",
            ]
        )
        self.library_table.setSelectionBehavior(QAbstractItemView.SelectRows)
        self.library_table.setSelectionMode(QAbstractItemView.ExtendedSelection)
        self.library_table.setEditTriggers(QAbstractItemView.NoEditTriggers)
        self.library_table.verticalHeader().setVisible(False)
        self.library_table.horizontalHeader().setSectionResizeMode(
            0,
            QHeaderView.Stretch
        )
        self.library_table.horizontalHeader().setSectionResizeMode(
            1,
            QHeaderView.Stretch
        )
        for col in range(2, 7):
            self.library_table.horizontalHeader().setSectionResizeMode(
                col,
                QHeaderView.ResizeToContents
            )
        self.library_table.itemSelectionChanged.connect(self.show_selected_metadata)
        self.library_table.doubleClicked.connect(self.play_selected_file)
        layout.addWidget(self.library_table, 1)

        detail = QFrame()
        detail.setObjectName("card")
        detail_layout = QHBoxLayout(detail)
        detail_layout.setContentsMargins(18, 18, 18, 18)

        self.cover_label = QLabel("♪")
        self.cover_label.setObjectName("coverBox")
        self.cover_label.setAlignment(Qt.AlignCenter)
        self.cover_label.setFixedSize(115, 115)
        detail_layout.addWidget(self.cover_label)

        meta_layout = QVBoxLayout()
        self.meta_title = QLabel("파일을 선택하세요")
        self.meta_title.setObjectName("statusTitle")
        meta_layout.addWidget(self.meta_title)
        self.meta_info = QLabel("제목 · 아티스트 · 앨범 정보가 여기에 표시됩니다.")
        self.meta_info.setWordWrap(True)
        self.meta_info.setObjectName("statusText")
        meta_layout.addWidget(self.meta_info)
        meta_layout.addStretch()

        btn_row = QHBoxLayout()
        play_btn = QPushButton("재생")
        play_btn.setObjectName("secondaryButton")
        play_btn.clicked.connect(self.play_selected_file)
        btn_row.addWidget(play_btn)
        reveal_btn = QPushButton("파일 위치")
        reveal_btn.setObjectName("secondaryButton")
        reveal_btn.clicked.connect(self.reveal_selected_file)
        btn_row.addWidget(reveal_btn)

        edit_tag_btn = QPushButton("태그 / 파일명 수정")
        edit_tag_btn.setObjectName("secondaryButton")
        edit_tag_btn.clicked.connect(
            self.edit_selected_flac
        )
        btn_row.addWidget(edit_tag_btn)

        upload_btn = QPushButton("HiBy 전송")
        upload_btn.setObjectName("accentButton")
        upload_btn.clicked.connect(self.upload_selected_to_hiby)
        btn_row.addWidget(upload_btn)

        delete_btn = QPushButton("삭제")
        delete_btn.setObjectName("dangerButton")
        delete_btn.clicked.connect(self.delete_selected_local_files)
        btn_row.addWidget(delete_btn)

        btn_row.addStretch()
        meta_layout.addLayout(btn_row)

        detail_layout.addLayout(meta_layout, 1)
        layout.addWidget(detail)
        return page

    def build_hiby_page(self):
        page = QWidget()
        layout = QVBoxLayout(page)
        layout.setContentsMargins(34, 30, 34, 28)
        layout.setSpacing(16)

        title = QLabel("HiBy 플레이어")
        title.setObjectName("pageTitle")
        layout.addWidget(title)

        desc = QLabel(
            "HiBy의 파일을 직접 확인하고, PC의 FLAC을 전송하거나 HiBy 파일을 삭제할 수 있습니다."
        )
        desc.setObjectName("pageDesc")
        layout.addWidget(desc)

        # -------------------------------------------------
        # 연결 / 전송 카드
        # -------------------------------------------------
        card = QFrame()
        card.setObjectName("card")
        card_layout = QVBoxLayout(card)
        card_layout.setContentsMargins(20, 18, 20, 18)
        card_layout.setSpacing(12)

        status_row = QHBoxLayout()

        status_box = QVBoxLayout()
        self.hiby_status_title = QLabel("HiBy 연결 확인 전")
        self.hiby_status_title.setObjectName("statusTitle")
        status_box.addWidget(self.hiby_status_title)

        self.hiby_status_text = QLabel(
            f"주소: {self.hiby_url}  ·  위치: {self.hiby_path}"
        )
        self.hiby_status_text.setObjectName("statusText")
        status_box.addWidget(self.hiby_status_text)

        status_row.addLayout(status_box)
        status_row.addStretch()

        check_btn = QPushButton("연결 확인")
        check_btn.setObjectName("secondaryButton")
        check_btn.clicked.connect(self.check_hiby)
        status_row.addWidget(check_btn)

        find_btn = QPushButton("HiBy 자동 찾기")
        find_btn.setObjectName("secondaryButton")
        find_btn.clicked.connect(
            lambda: self.discover_hiby(silent=False)
        )
        status_row.addWidget(find_btn)

        open_web_btn = QPushButton("HiBy 웹 열기")
        open_web_btn.setObjectName("secondaryButton")
        open_web_btn.clicked.connect(
            lambda: webbrowser.open(self.hiby_url)
        )
        status_row.addWidget(open_web_btn)

        latest_btn = QPushButton("최근 FLAC 전송")
        latest_btn.setObjectName("accentButton")
        latest_btn.clicked.connect(
            self.upload_latest_to_hiby
        )
        status_row.addWidget(latest_btn)

        card_layout.addLayout(status_row)

        self.hiby_progress = QProgressBar()
        self.hiby_progress.setRange(0, 100)
        self.hiby_progress.setValue(0)
        card_layout.addWidget(self.hiby_progress)

        self.hiby_progress_text = QLabel("대기 중")
        self.hiby_progress_text.setObjectName("statusText")
        card_layout.addWidget(self.hiby_progress_text)

        layout.addWidget(card)

        # -------------------------------------------------
        # HiBy 파일 목록 카드
        # -------------------------------------------------
        files_card = QFrame()
        files_card.setObjectName("card")
        files_layout = QVBoxLayout(files_card)
        files_layout.setContentsMargins(18, 16, 18, 18)
        files_layout.setSpacing(12)

        files_header = QHBoxLayout()

        files_title_box = QVBoxLayout()
        files_title = QLabel("HiBy 파일")
        files_title.setObjectName("statusTitle")
        files_title_box.addWidget(files_title)

        self.hiby_files_subtitle = QLabel(
            f"{self.hiby_path} · 목록을 불러오려면 새로고침을 누르세요."
        )
        self.hiby_files_subtitle.setObjectName("statusText")
        files_title_box.addWidget(
            self.hiby_files_subtitle
        )

        files_header.addLayout(files_title_box)
        files_header.addStretch()

        refresh_btn = QPushButton("새로고침")
        refresh_btn.setObjectName("secondaryButton")
        refresh_btn.clicked.connect(
            self.refresh_hiby_files
        )
        files_header.addWidget(refresh_btn)

        self.hiby_delete_btn = QPushButton("선택 파일 삭제")
        self.hiby_delete_btn.setObjectName("dangerButton")
        self.hiby_delete_btn.clicked.connect(
            self.delete_selected_hiby_files
        )
        files_header.addWidget(
            self.hiby_delete_btn
        )

        files_layout.addLayout(files_header)

        self.hiby_table = QTableWidget(0, 4)
        self.hiby_table.setHorizontalHeaderLabels(
            ["이름", "종류", "크기", "날짜"]
        )
        self.hiby_table.setSelectionBehavior(
            QAbstractItemView.SelectRows
        )
        self.hiby_table.setSelectionMode(
            QAbstractItemView.ExtendedSelection
        )
        self.hiby_table.setEditTriggers(
            QAbstractItemView.NoEditTriggers
        )
        self.hiby_table.verticalHeader().setVisible(False)

        self.hiby_table.horizontalHeader().setSectionResizeMode(
            0,
            QHeaderView.Stretch
        )
        self.hiby_table.horizontalHeader().setSectionResizeMode(
            1,
            QHeaderView.ResizeToContents
        )
        self.hiby_table.horizontalHeader().setSectionResizeMode(
            2,
            QHeaderView.ResizeToContents
        )
        self.hiby_table.horizontalHeader().setSectionResizeMode(
            3,
            QHeaderView.ResizeToContents
        )

        files_layout.addWidget(
            self.hiby_table,
            1
        )

        note = QLabel(
            "※ 안전을 위해 이 화면에서는 파일만 삭제합니다. 폴더는 삭제하지 않습니다."
        )
        note.setObjectName("statusText")
        files_layout.addWidget(note)

        layout.addWidget(
            files_card,
            1
        )

        return page

    def build_settings_page(self):
        page = QWidget()
        layout = QVBoxLayout(page)
        layout.setContentsMargins(36, 32, 36, 30)
        layout.setSpacing(18)

        title = QLabel("설정")
        title.setObjectName("pageTitle")
        layout.addWidget(title)

        desc = QLabel("HiBy 연결, 저장 위치와 자동 전송 옵션을 관리합니다.")
        desc.setObjectName("pageDesc")
        layout.addWidget(desc)

        card = QFrame()
        card.setObjectName("settingsCard")
        card.setMaximumWidth(900)

        card_layout = QVBoxLayout(card)
        card_layout.setContentsMargins(0, 0, 0, 0)
        card_layout.setSpacing(0)

        row1 = QFrame()
        row1.setObjectName("settingRow")
        row1_layout = QHBoxLayout(row1)
        row1_layout.setContentsMargins(24, 18, 24, 18)
        row1_layout.setSpacing(18)

        info1 = QVBoxLayout()
        label1 = QLabel("HiBy 주소")
        label1.setObjectName("settingLabel")
        hint1 = QLabel("플레이어의 Wi-Fi 전송 웹 주소")
        hint1.setObjectName("settingHint")
        info1.addWidget(label1)
        info1.addWidget(hint1)
        row1_layout.addLayout(info1)
        row1_layout.addStretch()

        self.setting_hiby_url = QLineEdit(self.hiby_url)
        self.setting_hiby_url.setMinimumWidth(360)
        self.setting_hiby_url.setMaximumWidth(430)
        row1_layout.addWidget(self.setting_hiby_url)

        self.settings_hiby_status = QLabel("● 확인 전")
        self.settings_hiby_status.setObjectName("settingStatus")
        self.settings_hiby_status.setProperty("online", False)
        row1_layout.addWidget(self.settings_hiby_status)

        test_btn = QPushButton("연결 테스트")
        test_btn.setObjectName("compactButton")
        test_btn.clicked.connect(
            lambda: self.check_hiby(self.setting_hiby_url.text().strip())
        )
        row1_layout.addWidget(test_btn)

        auto_find_btn = QPushButton("자동 찾기")
        auto_find_btn.setObjectName("compactButton")
        auto_find_btn.clicked.connect(
            lambda: self.discover_hiby(silent=False)
        )
        row1_layout.addWidget(auto_find_btn)

        card_layout.addWidget(row1)

        divider1 = QFrame()
        divider1.setObjectName("settingDivider")
        divider1.setFixedHeight(1)
        card_layout.addWidget(divider1)

        row2 = QFrame()
        row2.setObjectName("settingRow")
        row2_layout = QHBoxLayout(row2)
        row2_layout.setContentsMargins(24, 18, 24, 18)
        row2_layout.setSpacing(18)

        info2 = QVBoxLayout()
        label2 = QLabel("HiBy 전송 위치")
        label2.setObjectName("settingLabel")
        hint2 = QLabel("현재는 SD 카드 최상위 폴더로 바로 전송")
        hint2.setObjectName("settingHint")
        info2.addWidget(label2)
        info2.addWidget(hint2)
        row2_layout.addLayout(info2)
        row2_layout.addStretch()

        self.setting_hiby_path = QLineEdit(self.hiby_path)
        self.setting_hiby_path.setMinimumWidth(470)
        self.setting_hiby_path.setMaximumWidth(560)
        row2_layout.addWidget(self.setting_hiby_path)

        card_layout.addWidget(row2)

        divider2 = QFrame()
        divider2.setObjectName("settingDivider")
        divider2.setFixedHeight(1)
        card_layout.addWidget(divider2)

        row3 = QFrame()
        row3.setObjectName("settingRow")
        row3_layout = QHBoxLayout(row3)
        row3_layout.setContentsMargins(24, 18, 24, 18)
        row3_layout.setSpacing(18)

        info3 = QVBoxLayout()
        label3 = QLabel("FLAC 저장 위치")
        label3.setObjectName("settingLabel")
        hint3 = QLabel("변환된 음원이 저장되는 Windows 폴더")
        hint3.setObjectName("settingHint")
        info3.addWidget(label3)
        info3.addWidget(hint3)
        row3_layout.addLayout(info3)
        row3_layout.addStretch()

        download_dir = QLineEdit(str(backend.DOWNLOAD_DIR))
        download_dir.setReadOnly(True)
        download_dir.setMinimumWidth(360)
        download_dir.setMaximumWidth(430)
        row3_layout.addWidget(download_dir)

        folder_btn = QPushButton("폴더 열기")
        folder_btn.setObjectName("compactButton")
        folder_btn.clicked.connect(self.open_download_folder)
        row3_layout.addWidget(folder_btn)

        card_layout.addWidget(row3)

        divider3 = QFrame()
        divider3.setObjectName("settingDivider")
        divider3.setFixedHeight(1)
        card_layout.addWidget(divider3)

        row4 = QFrame()
        row4.setObjectName("settingRow")
        row4_layout = QHBoxLayout(row4)
        row4_layout.setContentsMargins(24, 19, 24, 19)
        row4_layout.setSpacing(18)

        info4 = QVBoxLayout()
        label4 = QLabel("변환 완료 후 자동 전송")
        label4.setObjectName("settingLabel")
        hint4 = QLabel("FLAC 변환이 끝나면 HiBy 플레이어로 즉시 전송합니다.")
        hint4.setObjectName("settingHint")
        info4.addWidget(label4)
        info4.addWidget(hint4)
        row4_layout.addLayout(info4)
        row4_layout.addStretch()

        self.auto_upload_state = QLabel("ON" if self.auto_upload else "OFF")
        self.auto_upload_state.setObjectName("toggleState")
        row4_layout.addWidget(self.auto_upload_state)

        self.auto_upload_checkbox = ToggleSwitch()
        self.auto_upload_checkbox.setChecked(
            self.auto_upload
        )
        self.auto_upload_checkbox.toggled.connect(
            self.on_auto_upload_toggled
        )
        row4_layout.addWidget(
            self.auto_upload_checkbox
        )

        card_layout.addWidget(row4)

        footer = QFrame()
        footer.setObjectName("settingsFooter")
        footer_layout = QHBoxLayout(footer)
        footer_layout.setContentsMargins(24, 16, 24, 18)

        footer_hint = QLabel("변경사항은 이 PC에 저장됩니다.")
        footer_hint.setObjectName("settingHint")
        footer_layout.addWidget(footer_hint)
        footer_layout.addStretch()

        save_btn = QPushButton("설정 저장")
        save_btn.setObjectName("primaryButton")
        save_btn.setMinimumWidth(110)
        save_btn.clicked.connect(self.save_settings)
        footer_layout.addWidget(save_btn)

        card_layout.addWidget(footer)

        layout.addWidget(card, alignment=Qt.AlignLeft)
        layout.addStretch()

        return page

    def switch_page(self, index):
        self.pages.setCurrentIndex(index)
        for i, btn in enumerate(self.nav_buttons):
            btn.setChecked(i == index)
        if index == 1:
            self.refresh_library()
        elif index == 2:
            self.refresh_hiby_text()
            self.refresh_hiby_files()

    def paste_url(self):
        self.url_input.setText(QApplication.clipboard().text().strip())

    def start_conversion(self):
        url = self.url_input.text().strip()
        if not url:
            QMessageBox.information(self, "주소 필요", "YouTube 주소를 입력해주세요.")
            return
        if self.convert_worker and self.convert_worker.isRunning():
            return

        self.convert_btn.setEnabled(False)
        self.playlist_convert_btn.setEnabled(False)
        self.convert_progress.setValue(0)
        self.convert_progress.show()
        self.convert_status_title.setText("변환 중...")
        self.convert_status_text.setText("YouTube 정보를 확인하는 중...")

        self.convert_worker = ConvertWorker(url)
        self.convert_worker.progress.connect(self.conversion_progress)
        self.convert_worker.success.connect(self.conversion_done)
        self.convert_worker.failed.connect(self.conversion_failed)
        self.convert_worker.start()


    def start_playlist_conversion(self):
        url = self.url_input.text().strip()

        if not url:
            QMessageBox.information(
                self,
                "주소 필요",
                "YouTube 재생목록 주소를 입력해주세요."
            )
            return

        if (
            self.convert_worker
            and self.convert_worker.isRunning()
        ):
            return

        self.convert_btn.setEnabled(False)
        self.playlist_convert_btn.setEnabled(False)

        self.convert_progress.setValue(0)
        self.convert_progress.show()

        self.convert_status_title.setText(
            "재생목록 변환 중..."
        )
        self.convert_status_text.setText(
            "재생목록 정보를 확인하는 중..."
        )

        self.convert_worker = PlaylistConvertWorker(
            url
        )

        self.convert_worker.progress.connect(
            self.conversion_progress
        )
        self.convert_worker.success.connect(
            self.playlist_conversion_done
        )
        self.convert_worker.failed.connect(
            self.conversion_failed
        )

        self.convert_worker.start()

    def conversion_progress(self, percent, message):
        self.convert_progress.setValue(percent)
        self.convert_status_text.setText(message)

    def conversion_done(self, result):
        self.convert_btn.setEnabled(True)
        self.playlist_convert_btn.setEnabled(True)
        self.convert_progress.setValue(100)
        path_text = result.get("path") or result.get("file")
        if path_text:
            self.last_file = Path(path_text)
            self.result_reveal_btn.setEnabled(True)
            self.result_hiby_btn.setEnabled(True)

        title = result.get("title") or (self.last_file.name if self.last_file else "FLAC 파일")
        artist = result.get("artist") or ""
        self.convert_status_title.setText("✓ FLAC 변환 완료")
        self.convert_status_text.setText(
            f"{title}"
            + (f"\n아티스트: {artist}" if artist else "")
            + (f"\n저장: {self.last_file}" if self.last_file else "")
        )
        self.refresh_library()

        if self.auto_upload and self.last_file:
            # GUI에서 직접 변환한 경우 즉시 전송한다.
            # 폴더 감시기가 같은 파일을 다시 보내지 않도록 먼저 표시.
            self.mark_auto_upload_handled(
                self.last_file
            )
            self.upload_files_to_hiby(
                [self.last_file],
                is_auto=True
            )


    def playlist_conversion_done(self, result):
        self.convert_btn.setEnabled(True)
        self.playlist_convert_btn.setEnabled(True)

        self.convert_progress.setValue(100)

        results = (
            result.get("results")
            if isinstance(result, dict)
            else []
        ) or []

        files = []

        for item in results:
            if not isinstance(item, dict):
                continue

            path_text = (
                item.get("path")
                or item.get("file")
            )

            if path_text:
                path = Path(path_text)

                if path.exists():
                    files.append(path)

        if files:
            self.last_file = files[-1]
            self.result_reveal_btn.setEnabled(True)
            self.result_hiby_btn.setEnabled(True)

        playlist_title = (
            result.get("playlist_title")
            or "YouTube 재생목록"
        )

        total = int(
            result.get("total")
            or len(results)
        )

        completed = int(
            result.get("completed")
            or len(results)
        )

        failed_count = int(
            result.get("failed_count")
            or 0
        )

        self.convert_status_title.setText(
            "✓ 재생목록 변환 완료"
        )

        summary = (
            f"{playlist_title}\n"
            f"성공 {completed}/{total}곡"
        )

        if failed_count:
            summary += (
                f" · 실패 {failed_count}곡"
            )

        if self.last_file:
            summary += (
                f"\n마지막 저장: {self.last_file}"
            )

        self.convert_status_text.setText(
            summary
        )

        self.refresh_library()

        # 내 PC 전용 자동 HiBy 전송 설정이 ON이면
        # 아직 실제 전송 성공으로 확인되지 않은 파일만 보낸다.
        if self.auto_upload and files:
            pending_files = []

            for path in files:
                try:
                    key = str(
                        Path(path).resolve()
                    )
                except Exception:
                    key = str(path)

                state = self.auto_upload_watch.get(
                    key
                )

                if (
                    state
                    and state.get(
                        "handled",
                        False
                    )
                ):
                    continue

                pending_files.append(path)

            if pending_files:
                self.upload_files_to_hiby(
                    pending_files,
                    is_auto=True
                )

    def conversion_failed(self, message):
        self.convert_btn.setEnabled(True)
        self.playlist_convert_btn.setEnabled(True)
        self.convert_progress.setValue(0)
        self.convert_progress.hide()
        self.convert_status_title.setText("변환 실패")
        self.convert_status_text.setText(message)

    def reveal_last_file(self):
        if self.last_file:
            reveal_file(self.last_file)

    def open_download_folder(self):
        try:
            backend.open_download_folder()
        except Exception:
            os.startfile(str(backend.DOWNLOAD_DIR))

    def set_library_filter(self, mode):
        self.library_filter_mode = mode

        buttons = {
            "all": self.filter_all_btn,
            "sent": self.filter_sent_btn,
            "unsent": self.filter_unsent_btn,
        }

        for key, button in buttons.items():
            button.setChecked(
                key == mode
            )

        self.apply_library_filters()

    def library_row_is_sent(self, row):
        item = self.library_table.item(
            row,
            4
        )

        if not item:
            return False

        status = item.text().strip()

        return (
            status.startswith("✓")
            or status.startswith("≈ 전송됨")
        )

    def library_row_is_unsent(self, row):
        item = self.library_table.item(
            row,
            4
        )

        if not item:
            return False

        status = item.text().strip()

        # "이름 변경 가능성"은 중복 전송 위험이 있어
        # 자동 미전송 목록에서는 제외한다.
        return status.startswith("— 미전송")

    def apply_library_filters(self):
        if not hasattr(
            self,
            "library_table"
        ):
            return

        query = ""

        if hasattr(
            self,
            "library_search_input"
        ):
            query = (
                self.library_search_input
                .text()
                .strip()
                .casefold()
            )

        visible_count = 0
        unsent_total = 0

        for row in range(
            self.library_table.rowCount()
        ):
            searchable = []

            # 파일명 / 제목 / 아티스트 / 앨범
            for col in range(0, 4):
                item = self.library_table.item(
                    row,
                    col
                )

                if item:
                    searchable.append(
                        item.text()
                    )

            text_value = " ".join(
                searchable
            ).casefold()

            search_ok = (
                not query
                or query in text_value
            )

            filter_ok = True

            if (
                self.library_filter_mode
                == "sent"
            ):
                filter_ok = (
                    self.library_row_is_sent(
                        row
                    )
                )

            elif (
                self.library_filter_mode
                == "unsent"
            ):
                filter_ok = (
                    self.library_row_is_unsent(
                        row
                    )
                )

            hide = not (
                search_ok
                and filter_ok
            )

            self.library_table.setRowHidden(
                row,
                hide
            )

            if not hide:
                visible_count += 1

            if self.library_row_is_unsent(
                row
            ):
                unsent_total += 1

        if hasattr(
            self,
            "upload_unsent_btn"
        ):
            self.upload_unsent_btn.setText(
                f"미전송 {unsent_total}곡 모두 HiBy"
            )
            self.upload_unsent_btn.setEnabled(
                unsent_total > 0
                and self.hiby_list_loaded
            )

        if hasattr(
            self,
            "library_subtitle"
        ):
            folder = Path(
                backend.DOWNLOAD_DIR
            )

            total = (
                self.library_table.rowCount()
            )

            if (
                query
                or self.library_filter_mode
                != "all"
            ):
                self.library_subtitle.setText(
                    f"{folder}  ·  "
                    f"{visible_count}/{total}개 표시"
                )
            else:
                self.library_subtitle.setText(
                    f"{folder}  ·  "
                    f"{total}개 파일"
                )

    def all_unsent_paths(self):
        paths = []

        for row in range(
            self.library_table.rowCount()
        ):
            if not self.library_row_is_unsent(
                row
            ):
                continue

            file_item = self.library_table.item(
                row,
                0
            )

            if not file_item:
                continue

            path_text = file_item.data(
                Qt.UserRole
            )

            if path_text:
                path = Path(path_text)

                if path.exists():
                    paths.append(path)

        return paths

    def upload_all_unsent_to_hiby(self):
        if not self.hiby_list_loaded:
            QMessageBox.information(
                self,
                "HiBy 확인 필요",
                "먼저 HiBy 상태를 확인해주세요."
            )
            self.refresh_hiby_files(
                silent=False
            )
            return

        files = self.all_unsent_paths()

        if not files:
            QMessageBox.information(
                self,
                "미전송 없음",
                "현재 HiBy에 미전송으로 확인된 곡이 없습니다."
            )
            return

        preview = "\\n".join(
            f"• {path.name}"
            for path in files[:6]
        )

        if len(files) > 6:
            preview += (
                f"\\n외 {len(files) - 6}곡"
            )

        if not confirm_dark(
            self,
            "미전송 곡 일괄 전송",
            (
                f"HiBy에 미전송으로 확인된 "
                f"{len(files)}곡을 모두 전송할까요?\\n\\n"
                f"{preview}"
            )
        ):
            return

        self.upload_files_to_hiby(
            files
        )

    def refresh_library(self):
        folder = Path(backend.DOWNLOAD_DIR)
        folder.mkdir(parents=True, exist_ok=True)
        files = sorted(
            [p for p in folder.iterdir() if p.is_file() and p.suffix.lower() in AUDIO_EXTENSIONS],
            key=lambda p: p.stat().st_mtime,
            reverse=True,
        )
        self.library_table.setRowCount(0)

        for path in files:
            title = artist = album = ""
            if path.suffix.lower() == ".flac":
                try:
                    audio = FLAC(str(path))
                    title = first_tag(audio, "TITLE")
                    artist = first_tag(audio, "ARTIST")
                    album = first_tag(audio, "ALBUM")
                except Exception:
                    pass

            row = self.library_table.rowCount()
            self.library_table.insertRow(row)
            file_item = QTableWidgetItem(path.name)
            file_item.setData(Qt.UserRole, str(path))
            stat = path.stat()

            values = [
                file_item,
                QTableWidgetItem(title),
                QTableWidgetItem(artist),
                QTableWidgetItem(album),
                QTableWidgetItem("… 확인 중"),
                QTableWidgetItem(
                    human_size(stat.st_size)
                ),
                QTableWidgetItem(
                    datetime.fromtimestamp(
                        stat.st_mtime
                    ).strftime(
                        "%Y-%m-%d %H:%M"
                    )
                ),
            ]
            for col, item in enumerate(values):
                self.library_table.setItem(row, col, item)

        self.library_subtitle.setText(
            f"{folder}  ·  {len(files)}개 파일"
        )
        self.update_library_hiby_status()
        self.apply_library_filters()

    def selected_paths(self):
        rows = sorted({index.row() for index in self.library_table.selectionModel().selectedRows()})
        paths = []
        for row in rows:
            item = self.library_table.item(row, 0)
            if item:
                path = item.data(Qt.UserRole)
                if path:
                    paths.append(Path(path))
        return paths

    def current_selected_path(self):
        paths = self.selected_paths()
        return paths[0] if paths else None

    def show_selected_metadata(self):
        path = self.current_selected_path()
        self.cover_label.clear()
        self.cover_label.setText("♪")

        if not path:
            self.meta_title.setText("파일을 선택하세요")
            self.meta_info.setText("제목 · 아티스트 · 앨범 정보가 여기에 표시됩니다.")
            return

        self.meta_title.setText(path.name)
        if path.suffix.lower() != ".flac":
            self.meta_info.setText(human_size(path.stat().st_size))
            return

        try:
            audio = FLAC(str(path))
            title = first_tag(audio, "TITLE", path.stem)
            artist = first_tag(audio, "ARTIST", "-")
            album = first_tag(audio, "ALBUM", "-")
            date = first_tag(audio, "DATE", "-")
            self.meta_title.setText(title)
            self.meta_info.setText(
                f"아티스트: {artist}\n앨범: {album}\n연도: {date}\n파일: {path.name}"
            )
            if audio.pictures:
                pixmap = QPixmap()
                if pixmap.loadFromData(audio.pictures[0].data):
                    self.cover_label.setPixmap(
                        pixmap.scaled(
                            self.cover_label.size(), Qt.KeepAspectRatio, Qt.SmoothTransformation
                        )
                    )
        except Exception as e:
            self.meta_info.setText(str(e))

    def select_library_path(self, target_path: Path):
        target = str(
            Path(target_path).resolve()
        )

        for row in range(
            self.library_table.rowCount()
        ):
            item = self.library_table.item(
                row,
                0
            )

            if not item:
                continue

            value = item.data(
                Qt.UserRole
            )

            if not value:
                continue

            try:
                current = str(
                    Path(value).resolve()
                )
            except Exception:
                current = str(value)

            if current == target:
                self.library_table.selectRow(
                    row
                )
                self.library_table.scrollToItem(
                    item
                )
                self.show_selected_metadata()
                return

    def edit_selected_flac(self):
        paths = self.selected_paths()

        if not paths:
            QMessageBox.information(
                self,
                "선택 필요",
                "수정할 FLAC 파일을 하나 선택해주세요."
            )
            return

        if len(paths) != 1:
            QMessageBox.information(
                self,
                "한 곡만 선택",
                "태그 수정은 한 번에 한 곡씩 가능합니다."
            )
            return

        path = paths[0]

        if path.suffix.lower() != ".flac":
            QMessageBox.information(
                self,
                "FLAC 파일 필요",
                "현재 태그 편집은 FLAC 파일에만 적용됩니다."
            )
            return

        old_path = path
        dialog = TagEditorDialog(
            path,
            self
        )

        if dialog.exec() != QDialog.Accepted:
            return

        new_path = dialog.result_path

        # 마지막 변환 파일을 이름 변경했다면 참조도 새 경로로 교체
        if self.last_file:
            try:
                if (
                    self.last_file.resolve()
                    == old_path.resolve()
                ):
                    self.last_file = new_path
            except Exception:
                pass

        self.refresh_library()
        self.select_library_path(
            new_path
        )

        QMessageBox.information(
            self,
            "저장 완료",
            (
                "태그와 파일 정보를 저장했습니다.\n\n"
                f"{new_path.name}"
            )
        )

    def play_selected_file(self):
        path = self.current_selected_path()
        if path:
            play_file(path)

    def reveal_selected_file(self):
        path = self.current_selected_path()
        if path:
            reveal_file(path)

    def delete_selected_local_files(self):
        paths = self.selected_paths()

        if not paths:
            QMessageBox.information(
                self,
                "선택 필요",
                "삭제할 파일을 보관함에서 선택해주세요."
            )
            return

        if len(paths) == 1:
            message = (
                "다음 파일을 Windows 휴지통으로 보낼까요?\n\n"
                f"{paths[0].name}"
            )
        else:
            preview = "\n".join(
                f"• {p.name}"
                for p in paths[:5]
            )

            if len(paths) > 5:
                preview += f"\n외 {len(paths) - 5}개"

            message = (
                f"선택한 {len(paths)}개 파일을 Windows 휴지통으로 보낼까요?\n\n"
                f"{preview}"
            )

        if not confirm_dark(
            self,
            "파일 삭제",
            message
        ):
            return

        deleted = []
        failed = []

        for path in paths:
            try:
                if not path.exists():
                    failed.append(
                        (path.name, "파일이 이미 없습니다.")
                    )
                    continue

                # 영구 삭제가 아니라 Windows 휴지통으로 이동.
                # QFile은 "/" 경로 구분자를 가장 안전하게 처리한다.
                qt_path = str(path).replace("\\", "/")

                if QFile.moveToTrash(qt_path):
                    deleted.append(path)
                else:
                    failed.append(
                        (path.name, "Windows 휴지통 이동에 실패했습니다.")
                    )

            except Exception as e:
                failed.append(
                    (path.name, str(e))
                )

        if self.last_file and any(
            self.last_file.resolve() == p.resolve()
            for p in deleted
        ):
            self.last_file = None
            self.result_reveal_btn.setEnabled(False)
            self.result_hiby_btn.setEnabled(False)

        self.refresh_library()

        if failed:
            details = "\n".join(
                f"• {name}: {reason}"
                for name, reason in failed[:8]
            )

            if len(failed) > 8:
                details += f"\n외 {len(failed) - 8}개"

            QMessageBox.warning(
                self,
                "일부 삭제 실패",
                f"{len(deleted)}개 삭제 완료, "
                f"{len(failed)}개 실패했습니다.\n\n"
                f"{details}"
            )

        else:
            QMessageBox.information(
                self,
                "삭제 완료",
                f"{len(deleted)}개 파일을 Windows 휴지통으로 보냈습니다."
            )

    def refresh_hiby_text(self):
        self.hiby_status_text.setText(f"주소: {self.hiby_url}\n전송 위치: {self.hiby_path}")

    def refresh_hiby_files(
        self,
        silent=False
    ):
        if (
            self.hiby_list_worker
            and self.hiby_list_worker.isRunning()
        ):
            return

        self.hiby_list_request_silent = silent
        self.hiby_list_loaded = False
        self.hiby_list_state = "loading"
        self.hiby_list_error = ""

        if hasattr(
            self,
            "hiby_files_subtitle"
        ):
            self.hiby_files_subtitle.setText(
                f"{self.hiby_path} · 목록 불러오는 중..."
            )

        self.update_library_hiby_status()

        self.hiby_list_worker = HibyListWorker(
            self.hiby_url,
            self.hiby_path
        )
        self.hiby_list_worker.success.connect(
            self.hiby_files_loaded
        )
        self.hiby_list_worker.failed.connect(
            self.hiby_files_failed
        )
        self.hiby_list_worker.start()

    def hiby_files_loaded(self, items):
        self.hiby_remote_items = list(items)
        self.hiby_list_loaded = True
        self.hiby_list_state = "loaded"
        self.hiby_list_error = ""
        self.hiby_auto_discovery_attempted = False

        # 폴더 먼저, 그 다음 파일 이름순으로 표시
        items = sorted(
            items,
            key=lambda item: (
                0 if str(item.get("path", "")).endswith("/") else 1,
                str(item.get("name", "")).lower()
            )
        )

        self.hiby_table.setRowCount(0)

        file_count = 0
        folder_count = 0

        for item in items:
            name = str(item.get("name") or "")
            path = str(item.get("path") or "")
            size = item.get("size")
            ctime = item.get("ctime")

            is_dir = path.endswith("/")

            if is_dir:
                folder_count += 1
            else:
                file_count += 1

            row = self.hiby_table.rowCount()
            self.hiby_table.insertRow(row)

            name_item = QTableWidgetItem(
                ("📁  " if is_dir else "♪  ") + name
            )
            name_item.setData(
                Qt.UserRole,
                path
            )
            name_item.setData(
                Qt.UserRole + 1,
                is_dir
            )
            name_item.setData(
                Qt.UserRole + 2,
                name
            )

            type_item = QTableWidgetItem(
                "폴더" if is_dir else "파일"
            )

            if is_dir or size in (None, ""):
                size_text = "-"
            else:
                try:
                    size_text = human_size(int(size))
                except Exception:
                    size_text = str(size)

            size_item = QTableWidgetItem(
                size_text
            )

            date_text = "-"
            if ctime not in (None, ""):
                try:
                    ts = int(str(ctime))
                    date_text = datetime.fromtimestamp(
                        ts
                    ).strftime("%Y-%m-%d %H:%M")
                except Exception:
                    date_text = str(ctime)

            date_item = QTableWidgetItem(
                date_text
            )

            self.hiby_table.setItem(
                row, 0, name_item
            )
            self.hiby_table.setItem(
                row, 1, type_item
            )
            self.hiby_table.setItem(
                row, 2, size_item
            )
            self.hiby_table.setItem(
                row, 3, date_item
            )

        self.hiby_files_subtitle.setText(
            f"{self.hiby_path} · "
            f"파일 {file_count}개 · 폴더 {folder_count}개"
        )

        self.update_library_hiby_status()
        self.hiby_list_request_silent = False

    def hiby_files_failed(self, message):
        was_silent = self.hiby_list_request_silent

        self.hiby_list_loaded = False
        self.hiby_remote_items = []
        self.hiby_list_state = "error"
        self.hiby_list_error = str(message)

        if hasattr(
            self,
            "hiby_files_subtitle"
        ):
            self.hiby_files_subtitle.setText(
                f"{self.hiby_path} · 목록 조회 실패"
            )

        self.update_library_hiby_status()
        self.hiby_list_request_silent = False

        # 프로그램 시작 시 저장된 IP가 바뀌었으면 같은 대역에서 자동 재검색
        if (
            was_silent
            and not self.hiby_auto_discovery_attempted
        ):
            self.hiby_auto_discovery_attempted = True

            QTimer.singleShot(
                100,
                lambda: self.discover_hiby(
                    silent=True
                )
            )
            return

        if not was_silent:
            QMessageBox.warning(
                self,
                "HiBy 목록 조회 실패",
                message
            )

    def selected_hiby_items(self):
        rows = sorted({
            index.row()
            for index in
            self.hiby_table.selectionModel().selectedRows()
        })

        result = []

        for row in rows:
            item = self.hiby_table.item(
                row,
                0
            )

            if not item:
                continue

            result.append({
                "path": item.data(Qt.UserRole),
                "is_dir": bool(
                    item.data(Qt.UserRole + 1)
                ),
                "name": item.data(
                    Qt.UserRole + 2
                ) or item.text(),
            })

        return result

    def delete_selected_hiby_files(self):
        selected = self.selected_hiby_items()

        if not selected:
            QMessageBox.information(
                self,
                "선택 필요",
                "HiBy에서 삭제할 파일을 선택해주세요."
            )
            return

        folders = [
            item
            for item in selected
            if item["is_dir"]
        ]

        files = [
            item
            for item in selected
            if not item["is_dir"]
        ]

        if not files:
            QMessageBox.information(
                self,
                "파일 선택 필요",
                "안전을 위해 폴더 삭제는 막아두었습니다. "
                "삭제할 파일을 선택해주세요."
            )
            return

        preview = "\n".join(
            f"• {item['name']}"
            for item in files[:6]
        )

        if len(files) > 6:
            preview += (
                f"\n외 {len(files) - 6}개"
            )

        extra = ""
        if folders:
            extra = (
                f"\n\n선택된 폴더 {len(folders)}개는 "
                "삭제하지 않습니다."
            )

        if not confirm_dark(
            self,
            "HiBy 파일 삭제",
            f"HiBy 플레이어에서 다음 "
            f"{len(files)}개 파일을 삭제할까요?\n\n"
            f"{preview}"
            f"{extra}\n\n"
            "※ HiBy 삭제는 Windows 휴지통을 거치지 않습니다."
        ):
            return

        if (
            self.hiby_delete_worker
            and self.hiby_delete_worker.isRunning()
        ):
            QMessageBox.information(
                self,
                "삭제 중",
                "이미 HiBy 삭제 작업이 진행 중입니다."
            )
            return

        self.hiby_delete_btn.setEnabled(False)
        self.hiby_progress.setValue(0)
        self.hiby_status_title.setText(
            "HiBy 파일 삭제 중..."
        )
        self.hiby_progress_text.setText(
            f"{len(files)}개 파일 삭제 준비 중..."
        )

        self.hiby_delete_worker = HibyDeleteWorker(
            self.hiby_url,
            files
        )
        self.hiby_delete_worker.progress.connect(
            self.hiby_delete_progress
        )
        self.hiby_delete_worker.finished_delete.connect(
            self.hiby_delete_done
        )
        self.hiby_delete_worker.start()

    def hiby_delete_progress(
        self,
        done,
        total,
        filename
    ):
        percent = (
            int(done / total * 100)
            if total
            else 0
        )

        self.hiby_progress.setValue(
            percent
        )
        self.hiby_progress_text.setText(
            f"삭제 {done}/{total} · {filename}"
        )

    def hiby_delete_done(
        self,
        deleted,
        failed
    ):
        self.hiby_delete_btn.setEnabled(True)

        total = len(deleted) + len(failed)

        if total:
            self.hiby_progress.setValue(
                int(len(deleted) / total * 100)
            )

        if failed:
            self.hiby_status_title.setText(
                "HiBy 파일 일부 삭제 실패"
            )

            details = "\n".join(
                f"• {item.get('name', '')}: "
                f"{item.get('reason', '실패')}"
                for item in failed[:8]
            )

            if len(failed) > 8:
                details += (
                    f"\n외 {len(failed) - 8}개"
                )

            self.hiby_progress_text.setText(
                f"{len(deleted)}개 삭제 · "
                f"{len(failed)}개 실패"
            )

            QMessageBox.warning(
                self,
                "일부 삭제 실패",
                f"{len(deleted)}개 삭제 완료, "
                f"{len(failed)}개 실패했습니다.\n\n"
                f"{details}"
            )

        else:
            self.hiby_progress.setValue(100)
            self.hiby_status_title.setText(
                "✓ HiBy 파일 삭제 완료"
            )
            self.hiby_progress_text.setText(
                f"{len(deleted)}개 파일을 삭제했습니다."
            )

        self.refresh_hiby_files()

    def discover_hiby(self, silent=False):
        if (
            self.hiby_discovery_worker
            and self.hiby_discovery_worker.isRunning()
        ):
            if not silent:
                QMessageBox.information(
                    self,
                    "검색 중",
                    "이미 HiBy 자동 검색이 진행 중입니다."
                )
            return

        # 설정창에 사용자가 입력한 값이 있으면 그 네트워크 대역을 우선 사용
        seed_url = self.hiby_url

        if hasattr(
            self,
            "setting_hiby_url"
        ):
            edited = (
                self.setting_hiby_url
                .text()
                .strip()
            )

            if edited:
                seed_url = edited

        self.hiby_status_title.setText(
            "HiBy 자동 검색 중..."
        )
        self.hiby_progress_text.setText(
            "같은 Wi-Fi의 4399 포트를 확인하고 있습니다."
        )

        if hasattr(
            self,
            "settings_hiby_status"
        ):
            self.settings_hiby_status.setText(
                "● 자동 검색 중"
            )

        self.hiby_discovery_worker = (
            HiByDiscoveryWorker(
                seed_url,
                self.hiby_path
            )
        )

        self.hiby_discovery_worker.status.connect(
            self.hiby_discovery_status
        )

        self.hiby_discovery_worker.found.connect(
            lambda url, s=silent:
                self.hiby_discovery_found(
                    url,
                    s
                )
        )

        self.hiby_discovery_worker.failed.connect(
            lambda message, s=silent:
                self.hiby_discovery_failed(
                    message,
                    s
                )
        )

        self.hiby_discovery_worker.start()

    def hiby_discovery_status(self, message):
        self.hiby_progress_text.setText(
            message
        )

        if hasattr(
            self,
            "settings_hiby_status"
        ):
            self.settings_hiby_status.setText(
                "● 검색 중"
            )

    def hiby_discovery_found(
        self,
        url,
        silent=False
    ):
        old_url = self.hiby_url
        self.hiby_url = (
            str(url)
            .strip()
            .rstrip("/")
        )

        # 발견한 주소를 다음 실행에도 그대로 사용
        self.settings.setValue(
            "hiby_url",
            self.hiby_url
        )

        if hasattr(
            self,
            "setting_hiby_url"
        ):
            self.setting_hiby_url.setText(
                self.hiby_url
            )

        self.refresh_hiby_text()

        self.hiby_status_title.setText(
            "● HiBy 자동 발견"
        )

        if old_url != self.hiby_url:
            self.hiby_progress_text.setText(
                f"{old_url} → {self.hiby_url}"
            )
        else:
            self.hiby_progress_text.setText(
                f"HiBy 주소 확인: {self.hiby_url}"
            )

        if hasattr(
            self,
            "settings_hiby_status"
        ):
            self.settings_hiby_status.setText(
                "● 자동 발견"
            )
            self.settings_hiby_status.setProperty(
                "online",
                True
            )
            self.settings_hiby_status.style().unpolish(
                self.settings_hiby_status
            )
            self.settings_hiby_status.style().polish(
                self.settings_hiby_status
            )

        self.hiby_auto_discovery_attempted = False

        # 새 주소로 실제 파일 목록까지 바로 확인
        QTimer.singleShot(
            100,
            lambda: self.refresh_hiby_files(
                silent=True
            )
        )

        if not silent and old_url != self.hiby_url:
            QMessageBox.information(
                self,
                "HiBy 발견",
                (
                    "HiBy 플레이어를 찾았습니다.\n\n"
                    f"{self.hiby_url}\n\n"
                    "이 주소를 자동 저장했습니다."
                )
            )

    def hiby_discovery_failed(
        self,
        message,
        silent=False
    ):
        self.hiby_status_title.setText(
            "● HiBy 자동 검색 실패"
        )
        self.hiby_progress_text.setText(
            str(message)
        )

        if hasattr(
            self,
            "settings_hiby_status"
        ):
            self.settings_hiby_status.setText(
                "● 검색 실패"
            )
            self.settings_hiby_status.setProperty(
                "online",
                False
            )
            self.settings_hiby_status.style().unpolish(
                self.settings_hiby_status
            )
            self.settings_hiby_status.style().polish(
                self.settings_hiby_status
            )

        if not silent:
            QMessageBox.warning(
                self,
                "HiBy 자동 검색 실패",
                str(message)
            )

    def check_hiby(self, url=None):
        if self.ping_worker and self.ping_worker.isRunning():
            return

        target_url = (url or self.hiby_url).strip().rstrip("/")
        if not target_url:
            QMessageBox.warning(self, "주소 필요", "HiBy 주소를 입력해주세요.")
            return

        self.hiby_status_title.setText("HiBy 연결 확인 중...")
        self.ping_worker = PingWorker(target_url)
        self.ping_worker.finished_ping.connect(self.hiby_ping_done)
        self.ping_worker.start()

    def hiby_ping_done(self, ok, detail):
        self.hiby_status_title.setText("● HiBy 연결됨" if ok else "● HiBy 연결 실패")
        self.hiby_progress_text.setText(detail)

        if hasattr(self, "settings_hiby_status"):
            self.settings_hiby_status.setText("● 연결됨" if ok else "● 연결 실패")
            self.settings_hiby_status.setProperty("online", bool(ok))
            self.settings_hiby_status.style().unpolish(self.settings_hiby_status)
            self.settings_hiby_status.style().polish(self.settings_hiby_status)

    def upload_last_to_hiby(self):
        if self.last_file:
            self.upload_files_to_hiby([self.last_file])

    def upload_latest_to_hiby(self):
        folder = Path(backend.DOWNLOAD_DIR)
        files = sorted(
            [p for p in folder.glob("*.flac") if p.is_file()],
            key=lambda p: p.stat().st_mtime,
            reverse=True,
        )
        if not files:
            QMessageBox.information(self, "파일 없음", "전송할 FLAC 파일이 없습니다.")
            return
        self.upload_files_to_hiby([files[0]])

    def upload_selected_to_hiby(self):
        files = self.selected_paths()
        if not files:
            QMessageBox.information(self, "선택 필요", "보관함에서 전송할 파일을 선택해주세요.")
            return
        self.upload_files_to_hiby(files)

    def upload_files_to_hiby(
        self,
        files,
        is_auto=False
    ):
        if (
            self.upload_worker
            and self.upload_worker.isRunning()
        ):
            if not is_auto:
                QMessageBox.information(
                    self,
                    "전송 중",
                    "이미 HiBy 전송이 진행 중입니다."
                )
            return

        files = [
            Path(path)
            for path in files
            if Path(path).exists()
        ]

        if not files:
            return

        self.current_upload_files = list(
            files
        )
        self.current_upload_is_auto = bool(
            is_auto
        )

        self.hiby_progress.setValue(0)

        prefix = (
            "자동 전송"
            if is_auto
            else "전송"
        )

        self.hiby_progress_text.setText(
            f"{len(files)}개 파일 {prefix} 준비 중..."
        )

        self.hiby_status_title.setText(
            "HiBy 자동 전송 중..."
            if is_auto
            else "HiBy 전송 중..."
        )

        self.upload_worker = UploadWorker(
            files,
            self.hiby_url,
            self.hiby_path
        )
        self.upload_worker.progress.connect(
            self.upload_progress
        )
        self.upload_worker.batch_finished.connect(
            self.upload_batch_finished
        )
        self.upload_worker.start()

    def upload_progress(self, done, total, filename):
        percent = int(done / total * 100) if total else 0
        self.hiby_progress.setValue(percent)
        self.hiby_progress_text.setText(f"{done}/{total} · {filename}")

    def upload_batch_finished(
        self,
        uploaded_paths,
        failed_records
    ):
        was_auto = self.current_upload_is_auto

        uploaded_paths = [
            Path(path)
            for path in (
                uploaded_paths
                or []
            )
        ]

        failed_records = (
            failed_records
            or []
        )

        total = (
            len(uploaded_paths)
            + len(failed_records)
        )

        # 실제 전송 성공한 파일만 자동감시에서 완료 처리.
        for path in uploaded_paths:
            self.mark_auto_upload_handled(
                path
            )

        # 실패 파일은 30초 후 자동 재시도 가능하게 둔다.
        if was_auto:
            retry_at = (
                time.time()
                + 30
            )

            for item in failed_records:
                path_text = (
                    item.get("path")
                    if isinstance(
                        item,
                        dict
                    )
                    else ""
                )

                if not path_text:
                    continue

                path = Path(path_text)

                try:
                    key = str(
                        path.resolve()
                    )
                except Exception:
                    key = str(path)

                state = self.auto_upload_watch.get(
                    key,
                    {
                        "path": path,
                        "sig": self.file_signature(
                            path
                        ),
                        "stable": 2,
                    }
                )

                state["handled"] = False
                state["retry_after"] = (
                    retry_at
                )

                self.auto_upload_watch[
                    key
                ] = state

        success_count = len(
            uploaded_paths
        )
        failed_count = len(
            failed_records
        )

        if failed_count == 0:
            self.hiby_progress.setValue(
                100
            )

            self.hiby_status_title.setText(
                "✓ HiBy 자동 전송 완료"
                if was_auto
                else "✓ HiBy 전송 완료"
            )

            self.hiby_progress_text.setText(
                f"{success_count}/{total}개 파일을 "
                f"{self.hiby_path}에 전송했습니다."
            )

        else:
            percent = int(
                success_count
                / total
                * 100
            ) if total else 0

            self.hiby_progress.setValue(
                percent
            )

            self.hiby_status_title.setText(
                "HiBy 자동 전송 일부 실패"
                if was_auto
                else "HiBy 전송 일부 실패"
            )

            retry_text = (
                " · 실패 파일은 30초 후 자동 재시도"
                if was_auto
                else ""
            )

            self.hiby_progress_text.setText(
                f"성공 {success_count}/{total} · "
                f"실패 {failed_count}"
                + retry_text
            )

        self.current_upload_files = []
        self.current_upload_is_auto = False

        # 실제 HiBy 목록을 다시 읽어서
        # '전송됨/미전송' 상태를 실제 파일 기준으로 갱신한다.
        self.refresh_hiby_files(
            silent=True
        )
        self.refresh_library()


    def save_settings(self):
        url = self.setting_hiby_url.text().strip().rstrip("/")
        path = self.setting_hiby_path.text().strip()
        if not url:
            QMessageBox.warning(self, "설정 오류", "HiBy 주소를 입력해주세요.")
            return
        if not path:
            QMessageBox.warning(self, "설정 오류", "HiBy 전송 위치를 입력해주세요.")
            return
        if not path.endswith("/"):
            path += "/"

        hiby_target_changed = (
            url != self.hiby_url
            or path != self.hiby_path
        )

        self.hiby_url = url
        self.hiby_path = path
        self.auto_upload = self.auto_upload_checkbox.isChecked()

        if hiby_target_changed:
            self.hiby_remote_items = []
            self.hiby_list_loaded = False
            self.hiby_list_state = "idle"
            self.hiby_list_error = ""
            self.hiby_auto_discovery_attempted = False
        self.settings.setValue("hiby_url", self.hiby_url)
        self.settings.setValue("hiby_path", self.hiby_path)
        self.settings.setValue(
            "auto_upload",
            self.auto_upload
        )
        self.refresh_hiby_text()

        if hiby_target_changed:
            self.refresh_hiby_files(
                silent=True
            )

        QMessageBox.information(
            self,
            "저장 완료",
            "설정을 저장했습니다."
        )

    def apply_style(self):
        self.setStyleSheet("""
            /* ===== Base ===== */
            QMainWindow {
                background: #0B0F15;
            }

            QWidget {
                color: #F4F6FA;
                font-family: "Segoe UI", "Malgun Gothic";
                font-size: 13px;
            }

            QLabel {
                background: transparent;
                border: none;
            }

            QStackedWidget,
            QStackedWidget > QWidget {
                background: #0F141C;
            }

            /* ===== Sidebar ===== */
            #sidebar {
                background: #121821;
                border-right: 1px solid #242C38;
            }

            #appTitle {
                background: transparent;
                font-size: 19px;
                font-weight: 800;
                color: #FFFFFF;
                padding: 2px 0;
            }

            #appSubTitle {
                background: transparent;
                color: #747D90;
                font-size: 11px;
                padding-bottom: 4px;
            }

            #navButton {
                text-align: left;
                min-height: 48px;
                padding: 0 15px;
                border: 1px solid transparent;
                border-left: 3px solid transparent;
                border-radius: 10px;
                color: #AAB2C2;
                background: transparent;
                font-size: 13px;
                font-weight: 600;
            }

            #navButton:hover {
                background: #1F2530;
                color: #FFFFFF;
                border-color: #2B3340;
            }

            #navButton:checked {
                background: #222936;
                color: #FFFFFF;
                border: 1px solid #303A49;
                border-left: 3px solid #FF3B63;
                font-weight: 700;
            }

            #serverStatus {
                color: #929BAD;
                font-size: 11px;
                padding: 10px 11px;
                background: #10141B;
                border: 1px solid #252B35;
                border-radius: 9px;
            }

            #serverStatus[online="true"] {
                color: #61D99C;
                border-color: #244C3C;
                background: #111D1A;
            }

            /* ===== Page headers ===== */
            #pageTitle {
                background: transparent;
                font-size: 27px;
                font-weight: 800;
                color: #FFFFFF;
                letter-spacing: -0.3px;
            }

            #pageDesc {
                background: transparent;
                color: #7E8799;
                font-size: 12px;
            }

            /* ===== Cards ===== */
            #card {
                background: #191E27;
                border: 1px solid #2A313D;
                border-radius: 14px;
            }

            #fieldLabel {
                background: transparent;
                color: #DDE2EA;
                font-weight: 700;
                margin-bottom: 6px;
            }

            #statusTitle {
                background: transparent;
                font-size: 16px;
                font-weight: 750;
                color: #FFFFFF;
            }

            #statusText {
                background: transparent;
                color: #9BA5B6;
                line-height: 1.5;
            }

            /* ===== Inputs ===== */
            QLineEdit {
                min-height: 42px;
                background: #0F141B;
                border: 1px solid #353D4A;
                border-radius: 9px;
                padding: 0 13px;
                color: #F7F8FA;
                selection-background-color: #FF3B63;
                selection-color: #FFFFFF;
            }

            QLineEdit:hover {
                border-color: #485364;
            }

            QLineEdit:focus {
                background: #111722;
                border: 1px solid #FF4A6D;
            }

            QLineEdit:read-only {
                color: #8C95A7;
                background: #11151C;
            }

            /* ===== Buttons ===== */
            QPushButton {
                min-height: 40px;
                padding: 0 17px;
                border-radius: 9px;
                font-weight: 700;
            }

            QPushButton:disabled {
                color: #666F80;
                background: #1A1F28;
                border-color: #292F3A;
            }

            #primaryButton {
                background: #F02955;
                border: 1px solid #FF4A70;
                color: #FFFFFF;
            }

            #primaryButton:hover {
                background: #FF365F;
                border-color: #FF708A;
            }

            #primaryButton:pressed {
                background: #D91E48;
            }

            #accentButton {
                background: #2B2028;
                border: 1px solid #B52C49;
                color: #FF9AAF;
            }

            #accentButton:hover {
                background: #3A222D;
                border-color: #EF4164;
                color: #FFFFFF;
            }

            /* ===== Dialogs ===== */
            QMessageBox {
                background: #171D26;
            }

            QMessageBox QLabel {
                background: transparent;
                color: #F3F5F8;
            }

            QMessageBox QPushButton {
                min-width: 86px;
                min-height: 34px;
                padding: 0 12px;
                border-radius: 8px;
                background: #252D39;
                border: 1px solid #465264;
                color: #F4F6F8;
            }

            QMessageBox QPushButton:hover {
                background: #313B49;
                border-color: #68768B;
            }

            #libraryFilterCard {
                background: #141A23;
                border: 1px solid #29323F;
                border-radius: 12px;
            }

            #filterButton {
                min-height: 38px;
                padding: 0 13px;
                background: #202733;
                border: 1px solid #364151;
                color: #AEB6C4;
                border-radius: 9px;
                font-size: 12px;
                font-weight: 700;
            }

            #filterButton:hover {
                background: #29313F;
                border-color: #526074;
                color: #FFFFFF;
            }

            #filterButton:checked {
                background: #34202A;
                border-color: #A8425C;
                color: #FFB1C0;
            }

            #dangerButton {
                background: #2A171D;
                border: 1px solid #68303E;
                color: #FF9BAD;
            }

            #dangerButton:hover {
                background: #3A1A23;
                border-color: #A23D55;
                color: #FFFFFF;
            }

            #dangerButton:pressed {
                background: #4A1C28;
            }

            #secondaryButton {
                background: #222833;
                border: 1px solid #343D4A;
                color: #DCE1E8;
            }

            #secondaryButton:hover {
                background: #2A313D;
                border-color: #485466;
                color: #FFFFFF;
            }

            /* ===== Library ===== */
            #coverBox {
                background: #10151C;
                border: 1px solid #313947;
                border-radius: 12px;
                color: #626D7F;
                font-size: 32px;
            }

            QTableWidget {
                background: #151A22;
                alternate-background-color: #171D26;
                border: 1px solid #2A313D;
                border-radius: 11px;
                gridline-color: #242B35;
                color: #E8EBF0;
                selection-background-color: #303847;
                selection-color: #FFFFFF;
                outline: none;
            }

            QHeaderView::section {
                background: #1E242E;
                color: #9FA8B8;
                border: 0;
                border-bottom: 1px solid #303744;
                padding: 11px;
                font-weight: 700;
            }

            QTableWidget::item {
                padding: 9px;
                border-bottom: 1px solid #222933;
            }

            QTableWidget::item:selected {
                background: #313A49;
                color: #FFFFFF;
            }

            /* ===== Progress ===== */
            QProgressBar {
                min-height: 22px;
                max-height: 22px;
                background: #0D1117;
                border: 1px solid #242A33;
                border-radius: 4px;
                text-align: center;
            }

            QProgressBar::chunk {
                background: #FF365F;
                border-radius: 3px;
            }


            /* ===== Premium settings ===== */
            #settingsCard {
                background: #171D26;
                border: 1px solid #2A3340;
                border-radius: 16px;
            }

            #settingRow {
                background: transparent;
                border: none;
            }

            #settingRow:hover {
                background: #1A212C;
            }

            #settingDivider {
                background: #28313D;
                border: none;
                margin-left: 24px;
                margin-right: 24px;
            }

            #settingsFooter {
                background: #141A23;
                border-top: 1px solid #2A3340;
                border-bottom-left-radius: 16px;
                border-bottom-right-radius: 16px;
            }

            #settingLabel {
                color: #F3F5F8;
                font-size: 13px;
                font-weight: 750;
            }

            #settingHint {
                color: #778296;
                font-size: 11px;
            }

            #settingStatus {
                min-width: 64px;
                min-height: 28px;
                padding: 0 9px;
                border-radius: 14px;
                background: #202733;
                border: 1px solid #384353;
                color: #9FA9B9;
                font-size: 11px;
                font-weight: 700;
            }

            #settingStatus[online="true"] {
                background: #10231C;
                border: 1px solid #285C47;
                color: #6DE6AC;
            }

            #compactButton {
                min-height: 38px;
                padding: 0 13px;
                background: #202733;
                border: 1px solid #364151;
                color: #D8DDE6;
                border-radius: 9px;
                font-size: 12px;
            }

            #compactButton:hover {
                background: #29313F;
                border-color: #526074;
                color: #FFFFFF;
            }

            #toggleState {
                color: #7F8A9D;
                font-size: 11px;
                font-weight: 800;
                min-width: 24px;
            }

            /* ===== Scrollbar ===== */
            QScrollBar:vertical {
                background: transparent;
                width: 10px;
                margin: 2px;
            }

            QScrollBar::handle:vertical {
                background: #353D4B;
                min-height: 28px;
                border-radius: 5px;
            }

            QScrollBar::handle:vertical:hover {
                background: #4B5668;
            }

            QScrollBar::add-line:vertical,
            QScrollBar::sub-line:vertical,
            QScrollBar::add-page:vertical,
            QScrollBar::sub-page:vertical {
                background: transparent;
                height: 0px;
            }

            QToolTip {
                background: #1B2029;
                color: #FFFFFF;
                border: 1px solid #3A4351;
                padding: 6px 8px;
            }
        """)

    def closeEvent(self, event):
        workers = [
            self.convert_worker,
            self.upload_worker,
            self.ping_worker,
            self.hiby_list_worker,
            self.hiby_delete_worker,
            self.hiby_discovery_worker,
        ]

        running = [w for w in workers if w and w.isRunning()]

        if running:
            for worker in running:
                worker.requestInterruption()

            # 다운로드/업로드의 현재 블로킹 구간이 끝날 시간을 잠깐 준다.
            all_stopped = True
            for worker in running:
                if not worker.wait(3000):
                    all_stopped = False

            if not all_stopped:
                QMessageBox.information(
                    self,
                    "작업 진행 중",
                    "현재 변환 또는 전송 작업이 진행 중입니다.\n"
                    "작업이 끝난 뒤 프로그램을 종료해주세요."
                )
                event.ignore()
                return

        event.accept()


def main():
    QApplication.setAttribute(Qt.AA_ShareOpenGLContexts)
    app = QApplication(sys.argv)
    app.setApplicationName(APP_NAME)
    if "--check-browser" in sys.argv:
        from browser_check import check_browser
        sys.exit(check_browser(app))
    if "--check-startup" in sys.argv:
        return
    window = MainWindow()
    window.show()
    sys.exit(app.exec())



# === QUERYBOT_PUBLIC_NO_HIBY_BEGIN ===
# Public standalone GUI: mature PySide6 interface, local FLAC features only.
# HiBy UI, network calls, status checks and automatic transfers are not used.

_QB_STATE_DIR = Path(
    os.environ.get("APPDATA") or (Path.home() / "AppData" / "Roaming")
) / "QueryBotAudio"
_QB_STATE_DIR.mkdir(parents=True, exist_ok=True)
_QB_PENDING = _QB_STATE_DIR / "pending_job.json"


def _qb_save_pending(data):
    try:
        _QB_PENDING.write_text(
            json.dumps(data, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
    except Exception:
        pass


def _qb_load_pending():
    try:
        if not _QB_PENDING.exists():
            return None
        data=json.loads(_QB_PENDING.read_text(encoding="utf-8"))
        return data if isinstance(data,dict) else None
    except Exception:
        return None


def _qb_clear_pending():
    try:
        if _QB_PENDING.exists():
            _QB_PENDING.unlink()
    except Exception:
        pass


def _qb_video_id(entry_or_url):
    try:
        if isinstance(entry_or_url,dict):
            value=str(entry_or_url.get("id") or entry_or_url.get("video_id") or "").strip()
            if value:
                return value
            entry_or_url=entry_or_url.get("url") or ""
        return backend.get_youtube_video_id(str(entry_or_url))
    except Exception:
        return None


def _qb_local_for_id(video_id):
    if not video_id:
        return None
    suffix=f" [{video_id}].flac".lower()
    folder=Path(backend.DOWNLOAD_DIR)
    try:
        for p in folder.glob("*.flac"):
            if p.name.lower().endswith(suffix):
                return p
    except Exception:
        pass
    return None


class _QBPlaylistWorker(QThread):
    progress=Signal(int,str)
    success=Signal(dict)
    failed=Signal(str)

    def __init__(self,url,snapshot,format_name):
        super().__init__()
        self.url=url
        self.snapshot=snapshot
        self.format_name=format_name

    def run(self):
        try:
            result=backend.download_playlist_audio(
                self.url,
                self.format_name,
                progress_callback=lambda p,m:self.progress.emit(int(p),str(m)),
                cancel_check=self.isInterruptionRequested,
                playlist_snapshot=self.snapshot,
            )
            self.success.emit(result)
        except Exception as e:
            self.failed.emit(str(e))


class _QBPlaylistLookupWorker(QThread):
    success=Signal(dict)
    failed=Signal(str)

    def __init__(self,url):
        super().__init__()
        self.url=url

    def run(self):
        try:
            snapshot=backend.get_playlist_entries(self.url)
            if not self.isInterruptionRequested(): self.success.emit(snapshot)
        except Exception as exc:
            if not self.isInterruptionRequested(): self.failed.emit(str(exc))


class _QBPlaylistDialog(QDialog):
    def __init__(self,snapshot,parent=None,format_name="mp3"):
        super().__init__(parent)
        self.entries=backend.normalize_playlist_entries(snapshot.get("entries") or [])
        self.setWindowTitle("재생목록 곡 선택")
        self.setStyleSheet("""
            QDialog { background: #10151e; font-family: "Malgun Gothic", "Segoe UI"; }
            QLabel { color: #e8edf6; background: transparent; }
            QLabel#statusTitle { color: #ffffff; font-size: 18px; font-weight: 600; }
            QLabel#statusText { color: #bdc8da; }
            QTableWidget { background: #151d29; color: #e8edf6; gridline-color: #2c384b;
                           selection-background-color: #31496b; border: 1px solid #344056; }
            QTableCornerButton::section { background: #202c3d; border: 0; }
            QHeaderView::section { background: #202c3d; color: #dae4f4; padding: 10px; border: 0; }
            QTableWidget::indicator { width: 18px; height: 18px; }
            QTableWidget::indicator:unchecked { background: #10151e; border: 1px solid #8b9db8; }
            QTableWidget::indicator:checked { background: #ff3765; border: 2px solid #ffc7d3; }
            QPushButton { background: #263348; color: #ffffff; padding: 10px 14px; border: 1px solid #52647e; border-radius: 6px; }
            QPushButton:hover { background: #374b68; }
            QPushButton#accentButton { background: #c51d4a; }
        """)
        self.resize(1000,680)
        root=QVBoxLayout(self)
        root.setContentsMargins(18,18,18,18)
        root.setSpacing(12)
        title=QLabel(snapshot.get("title") or "YouTube 재생목록")
        title.setObjectName("statusTitle")
        root.addWidget(title)
        source_label={"browser_copy":"브라우저에서 복사한 화면 목록","embedded_browser":"앱 안의 YouTube 화면 목록"}.get(snapshot.get("source"),"주소로 새로 조회한 목록")
        info=QLabel(f"{source_label}  ·  목록 ID: {snapshot.get('id') or '확인 안 됨'}  ·  {len(self.entries)}개 영상")
        info.setObjectName("statusText")
        root.addWidget(info)
        note=f"체크한 곡을 {format_name.upper()} 형식으로 변환합니다. 제목을 두 번 누르면 영상을 열어 확인할 수 있습니다."
        if snapshot.get("source")=="embedded_browser":
            note+="\n가져올 때 이 창에 로드된 곡만 포함됩니다. 아래 확인한 곡과 순서 그대로 변환합니다."
        elif snapshot.get("source")=="browser_copy":
            note+="\n복사할 때 페이지에 로드된 곡만 포함됩니다. 아래 목록을 그대로 사용하며, 새 Mix로 바꾸지 않습니다."
        elif snapshot.get("is_mix"): note+="\nYouTube Mix는 조회 시점과 로그인 상태에 따라 구성이 달라질 수 있습니다. 아래 확인한 목록 그대로 변환합니다."
        if snapshot.get("limit_reached"): note+="\n최대 500개 항목까지 조회했습니다."
        desc=QLabel(note)
        desc.setObjectName("statusText")
        desc.setWordWrap(True)
        root.addWidget(desc)
        self.table=QTableWidget(0,4)
        self.table.setHorizontalHeaderLabels(["선택","영상 제목","영상 ID","영상 주소"])
        self.table.setSelectionBehavior(QAbstractItemView.SelectRows)
        self.table.setEditTriggers(QAbstractItemView.NoEditTriggers)
        self.table.verticalHeader().setVisible(True)
        self.table.setIconSize(QSize(88,50))
        self.table.cellDoubleClicked.connect(lambda row,col: webbrowser.open(self.entries[row]["url"]) if col else None)
        self.table.horizontalHeader().setSectionResizeMode(0,QHeaderView.ResizeToContents)
        self.table.horizontalHeader().setSectionResizeMode(1,QHeaderView.Stretch)
        self.table.horizontalHeader().setSectionResizeMode(2,QHeaderView.ResizeToContents)
        self.table.horizontalHeader().setSectionResizeMode(3,QHeaderView.Stretch)
        root.addWidget(self.table,1)
        for row,entry in enumerate(self.entries):
            local=_qb_local_for_id(_qb_video_id(entry),format_name)
            entry["_qb_local"]=str(local) if local else ""
            self.table.insertRow(row)
            self.table.setRowHeight(row,60)
            if entry.get("browser_index"):
                self.table.setVerticalHeaderItem(row,QTableWidgetItem(str(entry["browser_index"])))
            ck=QTableWidgetItem("")
            ck.setFlags(Qt.ItemIsEnabled|Qt.ItemIsUserCheckable|Qt.ItemIsSelectable)
            ck.setCheckState(Qt.Unchecked if local else Qt.Checked)
            self.table.setItem(row,0,ck)
            self.table.setItem(row,1,QTableWidgetItem(str(entry.get("title") or "제목 없음")))
            self.table.setItem(row,2,QTableWidgetItem(str(_qb_video_id(entry) or "ID 확인 안 됨")))
            self.table.setItem(row,3,QTableWidgetItem(str(entry.get("url") or "")))
        self.network=QNetworkAccessManager(self)
        self.thumbnail_queue=list(enumerate(self.entries))
        self.finished.connect(lambda *_: self.thumbnail_queue.clear())
        for _ in range(min(4,len(self.thumbnail_queue))): self.load_thumbnail()
        buttons=QHBoxLayout()
        for label,fn in [("신규만 선택",self.select_new),("전체 선택",lambda:self.set_all(True)),("전체 해제",lambda:self.set_all(False))]:
            button=QPushButton(label); button.setObjectName("secondaryButton"); button.clicked.connect(fn); buttons.addWidget(button)
        buttons.addStretch()
        cancel=QPushButton("취소"); cancel.setObjectName("secondaryButton"); cancel.clicked.connect(self.reject); buttons.addWidget(cancel)
        run=QPushButton("선택한 영상 변환"); run.setObjectName("accentButton"); run.clicked.connect(self.accept_checked); buttons.addWidget(run)
        root.addLayout(buttons)

    def load_thumbnail(self):
        if not self.thumbnail_queue: return
        row,entry=self.thumbnail_queue.pop(0)
        request=QNetworkRequest(QUrl(f"https://i.ytimg.com/vi/{entry['id']}/default.jpg"))
        request.setTransferTimeout(8000)
        reply=self.network.get(request)
        def finished():
            pix=QPixmap()
            if pix.loadFromData(bytes(reply.readAll())):
                self.table.item(row,1).setIcon(QIcon(pix))
            reply.deleteLater()
            self.load_thumbnail()
        reply.finished.connect(finished)

    def set_all(self,value):
        state=Qt.Checked if value else Qt.Unchecked
        for row in range(self.table.rowCount()):
            self.table.item(row,0).setCheckState(state)

    def select_new(self):
        for row,entry in enumerate(self.entries):
            self.table.item(row,0).setCheckState(Qt.Unchecked if entry.get("_qb_local") else Qt.Checked)

    def selected_entries(self):
        out=[]
        for row,entry in enumerate(self.entries):
            if self.table.item(row,0).checkState()!=Qt.Checked: continue
            item=dict(entry); item["_qb_overwrite"]=bool(item.get("_qb_local")); out.append(item)
        return out

    def accept_checked(self):
        if not self.selected_entries():
            QMessageBox.information(self,"선택 필요","변환할 영상을 하나 이상 체크해주세요.")
            return
        self.accept()


def _qb_init(self):
    QMainWindow.__init__(self)
    self.settings=QSettings("QueryBot","QueryBotAudio")
    self.last_file=None
    self.convert_worker=None
    self.playlist_preview_worker=None
    self.upload_worker=None
    self.ping_worker=None
    self.library_filter_mode="all"


    self.setWindowTitle(APP_NAME)
    self.resize(1160,760)
    self.setMinimumSize(980,650)

    icon_path=Path(__file__).resolve().parent/"flac_converter.ico"
    if icon_path.exists():
        self.setWindowIcon(QIcon(str(icon_path)))

    self.build_ui()
    self.apply_style()
    self.refresh_library()


    QTimer.singleShot(1200,lambda:_qb_offer_resume(self))


def _qb_build_ui(self):
    central=QWidget()
    self.setCentralWidget(central)
    root=QHBoxLayout(central)
    root.setContentsMargins(0,0,0,0)
    root.setSpacing(0)

    self.sidebar=QFrame()
    self.sidebar.setObjectName("sidebar")
    self.sidebar.setFixedWidth(220)
    side=QVBoxLayout(self.sidebar)
    side.setContentsMargins(18,22,18,20)
    side.setSpacing(8)

    title=QLabel("♪  QueryBot Audio")
    title.setObjectName("appTitle")
    side.addWidget(title)
    subtitle=QLabel("YouTube · 음원 변환")
    subtitle.setObjectName("appSubTitle")
    side.addWidget(subtitle)
    side.addSpacing(22)

    self.nav_buttons=[]
    for label,index in [
        ("◉   음원 변환",0),
        ("▤   음원 보관함",1),
        ("⚙   설정",2),
    ]:
        btn=QPushButton(label)
        btn.setObjectName("navButton")
        btn.setCheckable(True)
        btn.clicked.connect(lambda checked=False,i=index:self.switch_page(i))
        side.addWidget(btn)
        self.nav_buttons.append(btn)

    side.addStretch()
    self.server_status=QLabel("● 로컬 변환 엔진")
    self.server_status.setObjectName("serverStatus")
    side.addWidget(self.server_status)
    root.addWidget(self.sidebar)

    self.pages=QStackedWidget()
    root.addWidget(self.pages,1)
    self.pages.addWidget(self.build_convert_page())
    self.pages.addWidget(self.build_library_page())
    self.pages.addWidget(self.build_settings_page())
    self.switch_page(0)


def _qb_build_convert_page(self):
    page=QWidget()
    layout=QVBoxLayout(page)
    layout.setContentsMargins(34,30,34,28)
    layout.setSpacing(18)

    title=QLabel("음원 변환")
    title.setObjectName("pageTitle")
    layout.addWidget(title)
    desc=QLabel(
        "YouTube 영상이나 재생목록에서 음원을 선택한 형식으로 저장합니다. "
        "재생목록은 목록의 제목과 영상 주소를 확인한 뒤 원하는 곡만 골라 변환할 수 있습니다."
    )
    desc.setWordWrap(True)
    desc.setObjectName("pageDesc")
    layout.addWidget(desc)

    card=QFrame()
    card.setObjectName("card")
    c=QVBoxLayout(card)
    c.setContentsMargins(22,22,22,22)
    lab=QLabel("저장 형식")
    lab.setObjectName("fieldLabel")
    c.addWidget(lab)
    self.format_combo=QComboBox()
    self.format_combo.addItem("MP3 · 호환성이 높은 일반 음원", "mp3")
    self.format_combo.addItem("M4A · AAC 오디오", "m4a")
    self.format_combo.addItem("WAV · 비압축 오디오", "wav")
    self.format_combo.addItem("FLAC · 무손실 저장", "flac")
    self.format_combo.setCurrentIndex(max(0,self.format_combo.findData(self.settings.value("audio_format","mp3"))))
    self.format_combo.currentIndexChanged.connect(lambda *_: self.settings.setValue("audio_format",self.format_combo.currentData()))
    c.addWidget(self.format_combo)
    address_label=QLabel("영상 또는 재생목록 주소")
    address_label.setObjectName("fieldLabel")
    c.addWidget(address_label)

    row=QHBoxLayout()
    self.url_input=QLineEdit()
    self.url_input.setPlaceholderText("영상 / Shorts / 재생목록 주소를 붙여넣으세요")
    self.url_input.returnPressed.connect(self.start_conversion)
    row.addWidget(self.url_input,1)

    paste=QPushButton("붙여넣기")
    paste.setObjectName("secondaryButton")
    paste.clicked.connect(self.paste_url)
    row.addWidget(paste)

    self.convert_btn=QPushButton("음원 변환")
    self.convert_btn.setObjectName("primaryButton")
    self.convert_btn.clicked.connect(self.start_conversion)
    row.addWidget(self.convert_btn)

    self.playlist_convert_btn=QPushButton("YouTube에서 목록 선택")
    self.playlist_convert_btn.setObjectName("accentButton")
    self.playlist_convert_btn.clicked.connect(self.start_playlist_conversion)
    row.addWidget(self.playlist_convert_btn)
    c.addLayout(row)

    copy_row=QHBoxLayout()
    self.browser_playlist_btn=QPushButton("화면 목록 붙여넣기")
    self.browser_playlist_btn.setObjectName("secondaryButton")
    self.browser_playlist_btn.clicked.connect(lambda:_qb_import_browser_playlist(self))
    copy_row.addWidget(self.browser_playlist_btn)
    quick_lookup=QPushButton("주소로 빠른 조회")
    quick_lookup.setObjectName("secondaryButton")
    quick_lookup.clicked.connect(lambda:_qb_start_playlist(self))
    copy_row.addWidget(quick_lookup)
    copy_hint=QLabel("앱 안에서 YouTube 목록을 확인하고 ‘이 목록 가져오기’를 누르세요.\n다른 브라우저의 목록은 화면 복사 후 붙여넣기도 가능합니다.")
    copy_hint.setWordWrap(True)
    copy_hint.setObjectName("statusText")
    copy_row.addWidget(copy_hint,1)
    c.addLayout(copy_row)

    self.convert_progress=QProgressBar()
    self.convert_progress.setRange(0,100)
    self.convert_progress.setValue(0)
    self.convert_progress.setTextVisible(True)
    self.convert_progress.setFormat("%p%")
    self.convert_progress.hide()
    c.addWidget(self.convert_progress)
    layout.addWidget(card)

    status=QFrame()
    status.setObjectName("card")
    s=QVBoxLayout(status)
    s.setContentsMargins(22,22,22,22)
    self.convert_status_title=QLabel("변환 준비 완료")
    self.convert_status_title.setObjectName("statusTitle")
    s.addWidget(self.convert_status_title)
    self.convert_status_text=QLabel("주소를 입력하고 저장 형식을 선택한 뒤 변환을 시작하세요.")
    self.convert_status_text.setWordWrap(True)
    self.convert_status_text.setObjectName("statusText")
    s.addWidget(self.convert_status_text)

    actions=QHBoxLayout()
    self.result_folder_btn=QPushButton("저장 폴더 열기")
    self.result_folder_btn.setObjectName("secondaryButton")
    self.result_folder_btn.clicked.connect(self.open_download_folder)
    actions.addWidget(self.result_folder_btn)
    self.result_reveal_btn=QPushButton("파일 위치 보기")
    self.result_reveal_btn.setObjectName("secondaryButton")
    self.result_reveal_btn.clicked.connect(self.reveal_last_file)
    self.result_reveal_btn.setEnabled(False)
    actions.addWidget(self.result_reveal_btn)
    actions.addStretch()
    s.addLayout(actions)
    layout.addWidget(status)
    layout.addStretch()
    return page


def _qb_build_library_page(self):
    page=QWidget()
    layout=QVBoxLayout(page)
    layout.setContentsMargins(34,30,34,28)
    layout.setSpacing(16)

    top=QHBoxLayout()
    title_box=QVBoxLayout()
    title=QLabel("음원 보관함")
    title.setObjectName("pageTitle")
    title_box.addWidget(title)
    self.library_subtitle=QLabel(str(backend.DOWNLOAD_DIR))
    self.library_subtitle.setObjectName("pageDesc")
    title_box.addWidget(self.library_subtitle)
    top.addLayout(title_box)
    top.addStretch()

    refresh=QPushButton("새로고침")
    refresh.setObjectName("secondaryButton")
    refresh.clicked.connect(self.refresh_library)
    top.addWidget(refresh)
    folder=QPushButton("폴더 열기")
    folder.setObjectName("secondaryButton")
    folder.clicked.connect(self.open_download_folder)
    top.addWidget(folder)
    delete=QPushButton("선택 파일 삭제")
    delete.setObjectName("dangerButton")
    delete.clicked.connect(self.delete_selected_local_files)
    top.addWidget(delete)
    layout.addLayout(top)

    filter_card=QFrame()
    filter_card.setObjectName("libraryFilterCard")
    fl=QHBoxLayout(filter_card)
    fl.setContentsMargins(14,12,14,12)
    self.library_search_input=QLineEdit()
    self.library_search_input.setPlaceholderText("곡명 · 아티스트 · 앨범 · 파일명 검색")
    self.library_search_input.setClearButtonEnabled(True)
    self.library_search_input.textChanged.connect(self.apply_library_filters)
    fl.addWidget(self.library_search_input,1)
    layout.addWidget(filter_card)

    self.library_table=QTableWidget(0,6)
    self.library_table.setHorizontalHeaderLabels(
        ["파일명","제목","아티스트","앨범","용량","저장일"]
    )
    self.library_table.setSelectionBehavior(QAbstractItemView.SelectRows)
    self.library_table.setSelectionMode(QAbstractItemView.ExtendedSelection)
    self.library_table.setEditTriggers(QAbstractItemView.NoEditTriggers)
    self.library_table.verticalHeader().setVisible(False)
    self.library_table.horizontalHeader().setSectionResizeMode(0,QHeaderView.Stretch)
    self.library_table.horizontalHeader().setSectionResizeMode(1,QHeaderView.Stretch)
    for col in range(2,6):
        self.library_table.horizontalHeader().setSectionResizeMode(col,QHeaderView.ResizeToContents)
    self.library_table.itemSelectionChanged.connect(self.show_selected_metadata)
    self.library_table.doubleClicked.connect(self.play_selected_file)
    layout.addWidget(self.library_table,1)

    detail=QFrame()
    detail.setObjectName("card")
    dl=QHBoxLayout(detail)
    dl.setContentsMargins(18,18,18,18)
    self.cover_label=QLabel("♪")
    self.cover_label.setObjectName("coverBox")
    self.cover_label.setAlignment(Qt.AlignCenter)
    self.cover_label.setFixedSize(115,115)
    dl.addWidget(self.cover_label)

    meta=QVBoxLayout()
    self.meta_title=QLabel("파일을 선택하세요")
    self.meta_title.setObjectName("statusTitle")
    meta.addWidget(self.meta_title)
    self.meta_info=QLabel("제목 · 아티스트 · 앨범 정보가 여기에 표시됩니다.")
    self.meta_info.setWordWrap(True)
    self.meta_info.setObjectName("statusText")
    meta.addWidget(self.meta_info)
    meta.addStretch()

    br=QHBoxLayout()
    for label,handler in [
        ("재생",self.play_selected_file),
        ("파일 위치",self.reveal_selected_file),
        ("태그 / 파일명 수정",self.edit_selected_flac),
    ]:
        b=QPushButton(label)
        b.setObjectName("secondaryButton")
        b.clicked.connect(handler)
        br.addWidget(b)
    d=QPushButton("삭제")
    d.setObjectName("dangerButton")
    d.clicked.connect(self.delete_selected_local_files)
    br.addWidget(d)
    br.addStretch()
    meta.addLayout(br)
    dl.addLayout(meta,1)
    layout.addWidget(detail)
    return page


def _qb_build_settings_page(self):
    page=QWidget()
    layout=QVBoxLayout(page)
    layout.setContentsMargins(36,32,36,30)
    layout.setSpacing(18)
    title=QLabel("설정")
    title.setObjectName("pageTitle")
    layout.addWidget(title)
    desc=QLabel("저장 위치와 로컬 변환 엔진 상태를 확인합니다.")
    desc.setObjectName("pageDesc")
    layout.addWidget(desc)

    card=QFrame()
    card.setObjectName("settingsCard")
    card.setMaximumWidth(900)
    cl=QVBoxLayout(card)
    cl.setContentsMargins(0,0,0,0)
    cl.setSpacing(0)

    row=QFrame()
    row.setObjectName("settingRow")
    rl=QHBoxLayout(row)
    rl.setContentsMargins(24,18,24,18)
    info=QVBoxLayout()
    a=QLabel("음원 저장 위치")
    a.setObjectName("settingLabel")
    b=QLabel("변환된 음원이 저장되는 Windows 폴더")
    b.setObjectName("settingHint")
    info.addWidget(a); info.addWidget(b)
    rl.addLayout(info); rl.addStretch()
    path=QLineEdit(str(backend.DOWNLOAD_DIR))
    path.setReadOnly(True)
    path.setMinimumWidth(420)
    rl.addWidget(path)
    open_btn=QPushButton("폴더 열기")
    open_btn.setObjectName("compactButton")
    open_btn.clicked.connect(self.open_download_folder)
    rl.addWidget(open_btn)
    cl.addWidget(row)

    div=QFrame()
    div.setObjectName("settingDivider")
    div.setFixedHeight(1)
    cl.addWidget(div)

    row2=QFrame()
    row2.setObjectName("settingRow")
    r2=QHBoxLayout(row2)
    r2.setContentsMargins(24,18,24,18)
    info2=QVBoxLayout()
    a2=QLabel("로컬 변환 엔진")
    a2.setObjectName("settingLabel")
    b2=QLabel("앱 내 로컬 처리 · 외부 플레이어 전송 기능 없음")
    b2.setObjectName("settingHint")
    info2.addWidget(a2); info2.addWidget(b2)
    r2.addLayout(info2); r2.addStretch()
    st=QLabel("● 준비됨")
    st.setObjectName("settingStatus")
    r2.addWidget(st)
    cl.addWidget(row2)

    layout.addWidget(card,alignment=Qt.AlignLeft)
    layout.addStretch()
    return page


def _qb_switch_page(self,index):
    self.pages.setCurrentIndex(index)
    for i,b in enumerate(self.nav_buttons):
        b.setChecked(i==index)
    if index==1:
        self.refresh_library()


def _qb_apply_library_filters(self):
    query=self.library_search_input.text().strip().lower() if hasattr(self,"library_search_input") else ""
    for row in range(self.library_table.rowCount()):
        text=" ".join(
            (self.library_table.item(row,col).text() if self.library_table.item(row,col) else "")
            for col in range(self.library_table.columnCount())
        ).lower()
        self.library_table.setRowHidden(row,bool(query and query not in text))


def _qb_refresh_library(self):
    folder=Path(backend.DOWNLOAD_DIR)
    folder.mkdir(parents=True,exist_ok=True)
    files=sorted(
        [p for p in folder.iterdir() if p.is_file() and p.suffix.lower() in AUDIO_EXTENSIONS],
        key=lambda p:p.stat().st_mtime,
        reverse=True,
    )
    self.library_table.setRowCount(0)
    for path in files:
        title=artist=album=""
        if path.suffix.lower()==".flac":
            try:
                audio=FLAC(str(path))
                title=first_tag(audio,"TITLE")
                artist=first_tag(audio,"ARTIST")
                album=first_tag(audio,"ALBUM")
            except Exception:
                pass
        row=self.library_table.rowCount()
        self.library_table.insertRow(row)
        fi=QTableWidgetItem(path.name)
        fi.setData(Qt.UserRole,str(path))
        stat=path.stat()
        vals=[
            fi,QTableWidgetItem(title),QTableWidgetItem(artist),QTableWidgetItem(album),
            QTableWidgetItem(human_size(stat.st_size)),
            QTableWidgetItem(datetime.fromtimestamp(stat.st_mtime).strftime("%Y-%m-%d %H:%M")),
        ]
        for col,item in enumerate(vals):
            self.library_table.setItem(row,col,item)
    self.library_subtitle.setText(f"{folder}  ·  {len(files)}개 파일")
    self.apply_library_filters()


def _qb_delete_selected_local_files(self):
    paths=self.selected_paths()
    if not paths:
        QMessageBox.information(self,"선택 필요","삭제할 파일을 보관함에서 선택해주세요.")
        return
    preview="\n".join(f"• {p.name}" for p in paths[:5])
    if len(paths)>5:
        preview+=f"\n외 {len(paths)-5}개"
    if not confirm_dark(
        self,"파일 삭제",
        f"선택한 {len(paths)}개 파일을 Windows 휴지통으로 보낼까요?\n\n{preview}"
    ):
        return
    deleted=[]
    failed=[]
    for p in paths:
        try:
            if p.exists() and QFile.moveToTrash(str(p).replace("\\","/")):
                deleted.append(p)
            else:
                failed.append(p.name)
        except Exception:
            failed.append(p.name)
    if self.last_file:
        try:
            if any(self.last_file.resolve()==p.resolve() for p in deleted):
                self.last_file=None
                self.result_reveal_btn.setEnabled(False)
        except Exception:
            pass
    self.refresh_library()
    if failed:
        QMessageBox.warning(self,"일부 삭제 실패",f"{len(deleted)}개 삭제, {len(failed)}개 실패했습니다.")


def _qb_selected_format(self):
    return str(self.format_combo.currentData() or "mp3").lower()


def _qb_local_for_id(video_id,format_name="mp3"):
    if not video_id: return None
    ext="."+str(format_name or "mp3").lower()
    suffix=f" [{video_id}]{ext}".lower()
    folder=Path(backend.DOWNLOAD_DIR)
    try:
        for path in folder.glob("*"+ext):
            if path.name.lower().endswith(suffix): return path
    except Exception: pass
    return None


def _qb_launch_single(self,url):
    format_name=_qb_selected_format(self)
    self.convert_btn.setEnabled(False)
    self.playlist_convert_btn.setEnabled(False)
    self.convert_progress.setValue(0)
    self.convert_progress.show()
    self.convert_status_title.setText("음원 변환 중...")
    self.convert_status_text.setText(f"{format_name.upper()} 형식으로 변환하고 있습니다.")
    _qb_save_pending({"type":"single","url":url,"format":format_name})
    self.convert_worker=AudioConvertWorker(url,format_name)
    self.convert_worker.progress.connect(self.conversion_progress)
    self.convert_worker.success.connect(self.conversion_done)
    self.convert_worker.failed.connect(self.conversion_failed)
    self.convert_worker.start()


def _qb_start_conversion(self):
    url=self.url_input.text().strip()
    if not url:
        QMessageBox.information(self,"주소 필요","YouTube 영상 주소를 입력해주세요.")
        return
    if self.convert_worker and self.convert_worker.isRunning(): return
    lookup=getattr(self,"playlist_preview_worker",None)
    if lookup and lookup.isRunning(): return
    format_name=_qb_selected_format(self)
    local=_qb_local_for_id(_qb_video_id(url),format_name)
    if local:
        box=QMessageBox(self); box.setIcon(QMessageBox.Question); box.setWindowTitle("이미 변환된 파일")
        box.setText(f"같은 영상의 {format_name.upper()} 파일이 이미 있습니다.\n\n{local.name}\n\n기존 파일을 휴지통으로 보내고 다시 변환할까요?")
        box.setStandardButtons(QMessageBox.Yes|QMessageBox.No)
        if box.button(QMessageBox.Yes): box.button(QMessageBox.Yes).setText("덮어쓰기")
        if box.button(QMessageBox.No): box.button(QMessageBox.No).setText("취소")
        if box.exec()!=QMessageBox.Yes: return
        if not QFile.moveToTrash(str(local).replace("\\","/")):
            QMessageBox.warning(self,"덮어쓰기 실패","기존 파일을 휴지통으로 보내지 못했습니다."); return
    _qb_launch_single(self,url)


def _qb_import_browser_playlist(self):
    if self.convert_worker and self.convert_worker.isRunning():
        QMessageBox.information(self,"작업 진행 중","현재 변환이 끝난 뒤 목록을 가져와주세요.")
        return
    lookup=getattr(self,"playlist_preview_worker",None)
    if lookup and lookup.isRunning():
        QMessageBox.information(self,"목록 조회 중","주소 조회가 끝난 뒤 화면 목록을 가져와주세요.")
        return
    try:
        mime=QApplication.clipboard().mimeData()
        snapshot=from_browser_html(mime.html() if mime and mime.hasHtml() else "",self.url_input.text().strip())
    except ValueError as exc:
        QMessageBox.information(self,"화면 목록 복사 방법",str(exc))
        return
    self.convert_btn.setEnabled(False); self.playlist_convert_btn.setEnabled(False)
    _qb_playlist_ready(self,snapshot["source_url"],snapshot)


def _qb_open_youtube(self):
    if self.convert_worker and self.convert_worker.isRunning():
        QMessageBox.information(self,"작업 진행 중","현재 변환이 끝난 뒤 목록을 가져와주세요.")
        return
    lookup=getattr(self,"playlist_preview_worker",None)
    if lookup and lookup.isRunning(): return
    from youtube_browser import YouTubeBrowserDialog
    try:
        if not hasattr(self,"youtube_browser_dialog"):
            self.youtube_browser_dialog=YouTubeBrowserDialog(self)
        dialog=self.youtube_browser_dialog
        dialog.open_url(self.url_input.text().strip())
    except (ValueError, RuntimeError) as exc:
        QMessageBox.information(self,"YouTube 열기",str(exc))
        return
    if dialog.exec()!=QDialog.Accepted or not dialog.snapshot: return
    snapshot=dialog.snapshot
    self.url_input.setText(snapshot["source_url"])
    self.convert_btn.setEnabled(False); self.playlist_convert_btn.setEnabled(False)
    _qb_playlist_ready(self,snapshot["source_url"],snapshot)


def _qb_start_playlist(self):
    url=self.url_input.text().strip()
    if not url:
        QMessageBox.information(self,"주소 필요","재생목록 주소를 입력해주세요."); return
    if self.convert_worker and self.convert_worker.isRunning(): return
    lookup=getattr(self,"playlist_preview_worker",None)
    if lookup and lookup.isRunning(): return
    if playlist_id(url).startswith("RD"):
        box=QMessageBox(self)
        box.setWindowTitle("Mix 목록 가져오기")
        box.setText("현재 브라우저와 같은 곡을 가져오려면 YouTube 페이지를 Ctrl+A, Ctrl+C로 복사한 뒤 '화면 목록 붙여넣기'를 사용하세요.\n\n주소로 새로 조회하면 브라우저와 다른 Mix가 생성될 수 있습니다.")
        copied=box.addButton("화면 목록 붙여넣기",QMessageBox.AcceptRole)
        fresh=box.addButton("주소로 새 Mix 조회",QMessageBox.ActionRole)
        box.addButton("취소",QMessageBox.RejectRole)
        box.exec()
        if box.clickedButton()==copied:
            _qb_import_browser_playlist(self)
            return
        if box.clickedButton()!=fresh: return
    self.convert_btn.setEnabled(False); self.playlist_convert_btn.setEnabled(False)
    self.convert_progress.setValue(0); self.convert_progress.show()
    self.convert_status_title.setText("재생목록 확인 중...")
    self.convert_status_text.setText("목록을 읽고 각 영상의 제목과 주소를 확인합니다.")
    self.playlist_preview_worker=_QBPlaylistLookupWorker(url)
    self.playlist_preview_worker.success.connect(lambda snapshot:_qb_playlist_ready(self,url,snapshot))
    self.playlist_preview_worker.failed.connect(lambda message:_qb_playlist_lookup_failed(self,message))
    self.playlist_preview_worker.start()


def _qb_playlist_lookup_failed(self,message):
    self.convert_btn.setEnabled(True); self.playlist_convert_btn.setEnabled(True); self.convert_progress.hide()
    self.convert_status_title.setText("재생목록 확인 실패"); self.convert_status_text.setText(message)


def _qb_playlist_ready(self,url,snapshot):
    format_name=_qb_selected_format(self)
    dialog=_QBPlaylistDialog(snapshot,self,format_name)
    if dialog.exec()!=QDialog.Accepted:
        self.convert_btn.setEnabled(True); self.playlist_convert_btn.setEnabled(True); self.convert_progress.hide()
        self.convert_status_title.setText("재생목록 선택 취소"); self.convert_status_text.setText("선택을 취소했습니다."); return
    selected=dialog.selected_entries()
    clean=[]
    for entry in selected:
        item=dict(entry); local=item.pop("_qb_local",""); overwrite=bool(item.pop("_qb_overwrite",False))
        if overwrite and local:
            if not QFile.moveToTrash(str(local)):
                _qb_playlist_lookup_failed(self,"기존 파일을 휴지통으로 보내지 못했습니다: "+str(local))
                return
        clean.append(item)
    selected_snapshot=dict(snapshot); selected_snapshot["entries"]=clean; selected_snapshot["count"]=len(clean)
    format_name=_qb_selected_format(self)
    _qb_save_pending({"type":"playlist","url":url,"snapshot":selected_snapshot,"format":format_name})
    self.convert_status_title.setText("선택한 음원 변환 중...")
    self.convert_status_text.setText(f"{len(clean)}개 영상을 {format_name.upper()} 형식으로 변환합니다.")
    self.convert_worker=_QBPlaylistWorker(url,selected_snapshot,format_name)
    self.convert_worker.progress.connect(self.conversion_progress)
    self.convert_worker.success.connect(self.playlist_conversion_done)
    self.convert_worker.failed.connect(self.conversion_failed)
    self.convert_worker.start()


def _qb_conversion_done(self,result):
    self.convert_btn.setEnabled(True)
    self.playlist_convert_btn.setEnabled(True)
    self.convert_progress.setValue(100)
    path_text=result.get("path") or result.get("file")
    if path_text:
        self.last_file=Path(path_text)
        self.result_reveal_btn.setEnabled(True)
    title=result.get("title") or (self.last_file.name if self.last_file else "음원 파일")
    artist=result.get("artist") or ""
    self.convert_status_title.setText(f"✓ 음원 변환 완료 · {Path(path_text).suffix.upper().lstrip('.') if path_text else '완료'}")
    self.convert_status_text.setText(
        f"{title}"
        +(f"\n아티스트: {artist}" if artist else "")
        +(f"\n저장: {self.last_file}" if self.last_file else "")
    )
    _qb_clear_pending()
    self.refresh_library()


def _qb_playlist_done(self,result):
    self.convert_btn.setEnabled(True)
    self.playlist_convert_btn.setEnabled(True)
    self.convert_progress.setValue(100)
    results=(result.get("results") if isinstance(result,dict) else []) or []
    files=[]
    for item in results:
        if isinstance(item,dict):
            pt=item.get("path") or item.get("file")
            if pt and Path(pt).exists():
                files.append(Path(pt))
    if files:
        self.last_file=files[-1]
        self.result_reveal_btn.setEnabled(True)
    title=result.get("playlist_title") or "YouTube 재생목록"
    total=int(result.get("total") or len(results))
    completed=int(result.get("completed") or len(results))
    failed=int(result.get("failed_count") or 0)
    msg=f"{title}\n성공 {completed}/{total}곡"
    if failed:
        msg+=f" · 실패 {failed}곡"
    if self.last_file:
        msg+=f"\n마지막 저장: {self.last_file}"
    self.convert_status_title.setText("✓ 재생목록 변환 완료")
    self.convert_status_text.setText(msg)
    _qb_clear_pending()
    self.refresh_library()


def _qb_offer_resume(self):
    pending=_qb_load_pending()
    if not pending:
        return
    typ=pending.get("type")
    if typ=="single":
        url=str(pending.get("url") or "").strip()
        if not url:
            _qb_clear_pending(); return
        if _qb_local_for_id(_qb_video_id(url),str(pending.get("format") or "mp3")):
            _qb_clear_pending(); return
        if QMessageBox.question(
            self,"지난 작업 이어하기",
            "이전에 완료되지 않은 단일 변환 작업이 있습니다.\n지금 이어서 처리할까요?",
            QMessageBox.Yes|QMessageBox.No
        )==QMessageBox.Yes:
            self.url_input.setText(url)
            self.format_combo.setCurrentIndex(max(0,self.format_combo.findData(str(pending.get("format") or "mp3"))))
            _qb_launch_single(self,url)
        return

    if typ=="playlist":
        url=str(pending.get("url") or "").strip()
        snap=pending.get("snapshot")
        if not url or not isinstance(snap,dict):
            _qb_clear_pending(); return
        remaining=[
            dict(e) for e in (snap.get("entries") or [])
            if not _qb_local_for_id(_qb_video_id(e),str(pending.get("format") or "mp3"))
        ]
        if not remaining:
            _qb_clear_pending(); return
        if QMessageBox.question(
            self,"지난 재생목록 이어하기",
            f"이전에 완료되지 않은 재생목록 작업이 있습니다.\n"
            f"아직 PC에 없는 {len(remaining)}곡을 이어서 변환할까요?",
            QMessageBox.Yes|QMessageBox.No
        )!=QMessageBox.Yes:
            return
        rs=dict(snap)
        rs["entries"]=remaining
        rs["count"]=len(remaining)
        self.url_input.setText(url)
        self.convert_btn.setEnabled(False)
        self.playlist_convert_btn.setEnabled(False)
        self.convert_progress.setValue(0)
        self.convert_progress.show()
        self.convert_status_title.setText("지난 작업 이어서 변환 중...")
        self.convert_status_text.setText(f"남은 {len(remaining)}곡을 처리합니다.")
        format_name=str(pending.get("format") or "mp3")
        self.format_combo.setCurrentIndex(max(0,self.format_combo.findData(format_name)))
        _qb_save_pending({"type":"playlist","url":url,"snapshot":rs,"format":format_name})
        self.convert_worker=_QBPlaylistWorker(url,rs,format_name)
        self.convert_worker.progress.connect(self.conversion_progress)
        self.convert_worker.success.connect(self.playlist_conversion_done)
        self.convert_worker.failed.connect(self.conversion_failed)
        self.convert_worker.start()


def _qb_close_event(self,event):
    workers=[
        w for w in [self.convert_worker,getattr(self,"playlist_preview_worker",None)]
        if w and w.isRunning()
    ]
    for w in workers:
        w.requestInterruption()
    for w in workers:
        w.wait(100)
    if any(w.isRunning() for w in workers):
        event.ignore()
        self.convert_status_title.setText("작업을 정리한 뒤 종료합니다...")
        QTimer.singleShot(500,self.close)
        return
    event.accept()


MainWindow.__init__=_qb_init
MainWindow.build_ui=_qb_build_ui
MainWindow.build_convert_page=_qb_build_convert_page
MainWindow.build_library_page=_qb_build_library_page
MainWindow.build_settings_page=_qb_build_settings_page
MainWindow.switch_page=_qb_switch_page
MainWindow.apply_library_filters=_qb_apply_library_filters
MainWindow.refresh_library=_qb_refresh_library
MainWindow.delete_selected_local_files=_qb_delete_selected_local_files
MainWindow.start_conversion=_qb_start_conversion
MainWindow.start_playlist_conversion=_qb_open_youtube
MainWindow.conversion_done=_qb_conversion_done
MainWindow.playlist_conversion_done=_qb_playlist_done
MainWindow.closeEvent=_qb_close_event

# === QUERYBOT_PUBLIC_NO_HIBY_END ===

if __name__ == "__main__":
    main()
