"""Run Windows checks against the actual optimized EXE and its bundled FFmpeg."""
import argparse
import ctypes
from ctypes import wintypes
import hashlib
import json
import os
from pathlib import Path
import subprocess
import tempfile
import time
import wave

import pefile
import psutil
from PIL import ImageGrab
from PyInstaller.archive.readers import CArchiveReader


def full_window_check(exe, screenshot):
    user32 = ctypes.windll.user32
    user32.GetWindowTextW.argtypes = [wintypes.HWND, wintypes.LPWSTR, ctypes.c_int]
    user32.IsWindowVisible.argtypes = [wintypes.HWND]
    user32.GetWindowThreadProcessId.argtypes = [wintypes.HWND, ctypes.POINTER(wintypes.DWORD)]
    user32.GetWindowRect.argtypes = [wintypes.HWND, ctypes.POINTER(wintypes.RECT)]
    user32.PostMessageW.argtypes = [wintypes.HWND, wintypes.UINT, wintypes.WPARAM, wintypes.LPARAM]
    user32.SendMessageTimeoutW.argtypes = [wintypes.HWND, wintypes.UINT, wintypes.WPARAM,
        wintypes.LPARAM, wintypes.UINT, wintypes.UINT, ctypes.POINTER(ctypes.c_size_t)]
    callback_type = ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)
    user32.EnumWindows.argtypes = [callback_type, wintypes.LPARAM]
    env = dict(os.environ)
    env.pop("QT_QPA_PLATFORM", None)
    proc = subprocess.Popen([str(exe)], env=env)
    hwnd = None
    started = time.perf_counter()
    try:
        while time.perf_counter() - started < 90:
            if proc.poll() is not None:
                raise AssertionError(f"GUI exited before showing its window: {proc.returncode}")
            pids = {proc.pid} | {p.pid for p in psutil.Process(proc.pid).children(recursive=True)}
            found = []
            @callback_type
            def callback(window, unused):
                pid = wintypes.DWORD()
                user32.GetWindowThreadProcessId(window, ctypes.byref(pid))
                title = ctypes.create_unicode_buffer(512)
                user32.GetWindowTextW(window, title, 512)
                if pid.value in pids and user32.IsWindowVisible(window) and title.value == "QueryBot Audio":
                    found.append(window)
                return True
            user32.EnumWindows(callback, 0)
            if found:
                hwnd = found[0]
                break
            time.sleep(0.25)
        if hwnd is None:
            raise AssertionError("No visible QueryBot Audio main window")
        ready_seconds = round(time.perf_counter() - started, 3)
        time.sleep(2)
        result = ctypes.c_size_t()
        if not user32.SendMessageTimeoutW(hwnd, 0, 0, 0, 2, 5000, ctypes.byref(result)):
            raise AssertionError("GUI is not responding")
        rect = wintypes.RECT()
        if not user32.GetWindowRect(hwnd, ctypes.byref(rect)):
            raise AssertionError("Could not read GUI dimensions")
        image = ImageGrab.grab(bbox=(rect.left, rect.top, rect.right, rect.bottom), all_screens=True)
        image.save(screenshot)
        user32.PostMessageW(hwnd, 0x0010, 0, 0)
        code = proc.wait(timeout=20)
        if code:
            raise AssertionError(f"GUI clean close failed: {code}")
        return {"status": "passed", "responsive": True, "clean_close": True,
                "window_size": [rect.right-rect.left, rect.bottom-rect.top],
                "seconds_to_window_single_ci_sample": ready_seconds}
    finally:
        if proc.poll() is None:
            for p in psutil.Process(proc.pid).children(recursive=True):
                try:
                    p.kill()
                except psutil.NoSuchProcess:
                    pass
            proc.kill()
            proc.wait(timeout=20)


def verify(exe, report_path):
    exe = Path(exe).resolve()
    report_path = Path(report_path).resolve()
    report = json.loads(report_path.read_text(encoding="utf-8"))
    results = {}
    env = dict(os.environ, QT_QPA_PLATFORM="offscreen")
    # Fresh isolated profile, so a pending user job can never start in CI.
    with tempfile.TemporaryDirectory(prefix="querybot-check-") as tmp:
        tmp = Path(tmp)
        env["APPDATA"] = str(tmp / "appdata")
        env["LOCALAPPDATA"] = str(tmp / "localappdata")
        for name in ("--check-startup", "--check-browser", "--check-capture-runtime"):
            start = time.perf_counter()
            completed = subprocess.run([str(exe), name], env=env, capture_output=True, timeout=120)
            print(name, completed.returncode, completed.stdout.decode(errors="replace"),
                  completed.stderr.decode(errors="replace"), flush=True)
            if completed.returncode:
                raise AssertionError(f"{name} failed: {completed.returncode}")
            results[name] = {"status": "passed", "seconds": round(time.perf_counter()-start, 3)}

        reader = CArchiveReader(str(exe))
        ffmpeg_name = next(n for n in reader.toc if n.startswith("imageio_ffmpeg") and n.endswith(".exe"))
        ffmpeg = tmp / "ffmpeg.exe"
        ffmpeg.write_bytes(reader.extract(ffmpeg_name))
        sample = tmp / "sample.wav"
        with wave.open(str(sample), "wb") as wav:
            wav.setparams((1, 2, 44100, 0, "NONE", "not compressed"))
            wav.writeframes(b"\0\0" * 11025)
        formats = {"flac": ("flac", "flac"), "mp3": ("mp3", "libmp3lame"),
                   "m4a": ("m4a", "aac"), "wav": ("wav", "pcm_s16le"),
                   "opus": ("opus", "libopus"), "vorbis": ("ogg", "libvorbis")}
        audio = {}
        for name, (suffix, codec) in formats.items():
            target = tmp / ("result." + suffix)
            subprocess.run([str(ffmpeg), "-hide_banner", "-loglevel", "error", "-y",
                            "-i", str(sample), "-c:a", codec, str(target)], check=True, timeout=30)
            subprocess.run([str(ffmpeg), "-hide_banner", "-loglevel", "error", "-i",
                            str(target), "-f", "null", "-"], check=True, timeout=30)
            audio[name] = {"status": "encode and decode passed", "bytes": target.stat().st_size}
        results["bundled_ffmpeg_six_formats"] = audio
    results["main_window"] = full_window_check(exe, report_path.parent / "QueryBotAudioGUI_preview.png")
    with pefile.PE(str(exe)) as pe:
        if pe.generate_checksum() != pe.OPTIONAL_HEADER.CheckSum:
            raise AssertionError("PE checksum mismatch")
        if not hasattr(pe, "VS_FIXEDFILEINFO"):
            raise AssertionError("Product version metadata missing")
        results["windows_product_metadata"] = "passed"
    with exe.open("rb") as f:
        digest = hashlib.file_digest(f, "sha256").hexdigest()
    if digest != report["output_sha256"]:
        raise AssertionError("Artifact changed after optimization")
    report["validation"]["windows_runtime"] = "passed"
    report["windows_checks"] = results
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(results, indent=2))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("exe")
    parser.add_argument("report")
    args = parser.parse_args()
    verify(args.exe, args.report)
