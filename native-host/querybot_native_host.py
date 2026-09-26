"""Chrome Native Messaging host for QueryBot Audio Converter."""

import json
import struct
import sys

from server import DOWNLOAD_DIR, download_audio, open_download_folder


def read_message():
    header = sys.stdin.buffer.read(4)
    if not header:
        return None
    if len(header) != 4:
        raise ValueError("Incomplete Native Messaging header")
    size = struct.unpack("<I", header)[0]
    if size > 1024 * 1024:
        raise ValueError("Native Messaging request is too large")
    payload = sys.stdin.buffer.read(size)
    if len(payload) != size:
        raise ValueError("Incomplete Native Messaging request")
    return json.loads(payload.decode("utf-8"))


def write_message(message):
    payload = json.dumps(message, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    sys.stdout.buffer.write(struct.pack("<I", len(payload)))
    sys.stdout.buffer.write(payload)
    sys.stdout.buffer.flush()


def youtube_url(value):
    from urllib.parse import urlparse

    url = str(value or "").strip()
    parsed = urlparse(url)
    host = (parsed.hostname or "").lower()
    allowed = {"youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com", "youtu.be"}
    if parsed.scheme != "https" or host not in allowed:
        raise ValueError("유효한 YouTube 주소를 찾을 수 없습니다.")
    return url


def handle(request):
    if not isinstance(request, dict):
        raise ValueError("잘못된 Native Messaging 요청입니다.")
    action = request.get("action")
    data = request.get("data") or {}
    if not isinstance(data, dict):
        raise ValueError("잘못된 요청 데이터입니다.")

    if action == "ping":
        return {"ok": True, "status": "connected", "folder": str(DOWNLOAD_DIR)}
    if action == "open_folder":
        return open_download_folder()
    if action == "extract":
        url = youtube_url(data.get("url"))
        result = download_audio(url, "flac")
        return {"ok": True, "status": "success", **result}
    raise ValueError("지원하지 않는 Native Messaging 작업입니다.")


def main():
    try:
        request = read_message()
        if request is None:
            return 0
        try:
            response = handle(request)
        except Exception as exc:
            response = {"ok": False, "status": "error", "message": str(exc)}
        write_message(response)
        return 0
    except Exception as exc:
        print(f"QueryBot Native Host: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
