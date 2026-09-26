"""Visible, app-owned YouTube browser; capture only its current playlist DOM."""
import json
from pathlib import Path
from urllib.parse import urlparse, parse_qs, urlencode

from PySide6.QtCore import QStandardPaths, QTimer, QUrl
from PySide6.QtWidgets import QDialog, QVBoxLayout, QHBoxLayout, QLineEdit, QPushButton, QLabel
from PySide6.QtWebEngineCore import QWebEngineProfile, QWebEnginePage, QWebEngineScript
from PySide6.QtWebEngineWidgets import QWebEngineView

from browser_playlist import from_browser_html, playlist_id


def youtube_url(text):
    text = str(text or '').strip()
    if not text:
        return 'https://www.youtube.com/'
    if text.startswith(('www.youtube.com/', 'youtube.com/', 'youtu.be/')):
        text = 'https://' + text
    p = urlparse(text)
    if p.scheme not in {'http', 'https'} or p.username or p.password:
        raise ValueError('YouTube 영상 또는 재생목록 주소를 입력해주세요.')
    if p.hostname == 'youtu.be':
        query = parse_qs(p.query)
        query['v'] = [p.path.strip('/')]
        return 'https://www.youtube.com/watch?' + urlencode(query, doseq=True)
    if p.hostname not in {'youtube.com', 'www.youtube.com', 'm.youtube.com'}:
        raise ValueError('YouTube 영상 또는 재생목록 주소를 입력해주세요.')
    return p._replace(scheme='https', netloc='www.youtube.com').geturl()


# Inspect the rendered playlist container only, not recommendations or JS data.
# Offscreen rows within a scroller are included; hidden/old SPA panels are not.
CAPTURE_SCRIPT = r"""(() => {
  const url = location.href;
  const pid = new URL(url).searchParams.get('list');
  const visible = e => !!e.getClientRects().length &&
    getComputedStyle(e).visibility !== 'hidden' && !e.closest('[hidden]');
  const containers = [...document.querySelectorAll(
    'ytd-playlist-panel-renderer, ytd-playlist-video-list-renderer')].filter(visible);
  for (const container of containers) {
    const rows = [...container.querySelectorAll(
      'ytd-playlist-panel-video-renderer, ytd-playlist-video-renderer')].filter(row => {
      if (!visible(row)) return false;
      return [...row.querySelectorAll('a[href]')].some(a => {
        try {
          const u = new URL(a.href, url);
          return u.hostname === 'www.youtube.com' && u.pathname === '/watch' &&
            u.searchParams.get('list') === pid && u.searchParams.has('v');
        } catch (_) { return false; }
      });
    });
    if (pid && rows.length) return JSON.stringify({url, html: rows.map(r => r.outerHTML).join('')});
  }
  return JSON.stringify({url, html: ''});
})()"""


def browser_snapshot(payload, current_url):
    try:
        data = json.loads(payload)
    except (TypeError, ValueError):
        raise ValueError('화면을 읽지 못했습니다. 로딩이 끝난 뒤 다시 눌러주세요.') from None
    if not isinstance(data, dict) or data.get('url') != current_url:
        raise ValueError('페이지가 바뀌었습니다. 현재 목록을 확인하고 다시 눌러주세요.')
    youtube_url(current_url)
    if not playlist_id(current_url) or not data.get('html'):
        raise ValueError('이 화면에 열린 재생목록이 없습니다. YouTube에서 재생목록이나 Mix를 열어주세요.')
    try:
        snapshot = from_browser_html(data['html'], current_url)
    except ValueError:
        raise ValueError('목록을 정확히 읽지 못했습니다. 목록이 표시될 때까지 기다린 뒤 다시 눌러주세요.') from None
    snapshot.update(source='embedded_browser', title='YouTube 화면에서 가져온 재생목록', source_url=current_url)
    return snapshot


class YouTubeBrowserDialog(QDialog):
    def __init__(self, parent=None, persistent=True):
        super().__init__(parent)
        self.setWindowTitle('YouTube에서 목록 선택 · QueryBot Audio')
        self.resize(1180, 780)
        self.setMinimumSize(960, 620)
        self.setStyleSheet('''
            QDialog { background: #0f141c; color: #f2f5fa; }
            QLabel { color: #c8d4e4; background: transparent; font-size: 12px; }
            QLineEdit { background: #182230; color: #f2f5fa; border: 1px solid #40516a;
                        border-radius: 7px; padding: 10px; }
            QPushButton { background: #263346; color: #f2f5fa; border: 1px solid #40516a;
                          border-radius: 7px; padding: 10px 14px; }
            QPushButton:hover { background: #34465e; }
            QPushButton:disabled { background: #182230; color: #8390a2; }
            QPushButton#primaryButton { background: #ed245c; border-color: #ed245c; font-weight: bold; }
            QPushButton#primaryButton:hover { background: #ff3f72; }
            QPushButton#primaryButton:disabled { background: #583347; border-color: #583347; }
        ''')
        self.snapshot = None
        self._epoch = 0
        self._reading = False
        self._last_requested = ''
        root = QVBoxLayout(self)
        nav = QHBoxLayout()
        self.back_button = QPushButton('뒤로')
        self.address = QLineEdit()
        self.address.setPlaceholderText('YouTube 주소를 붙여넣거나 아래 화면에서 검색하세요')
        self.go_button = QPushButton('열기')
        nav.addWidget(self.back_button)
        nav.addWidget(self.address, 1)
        nav.addWidget(self.go_button)
        root.addLayout(nav)
        self.hint = QLabel('목록 확인 → 이 목록 가져오기 → 곡 선택·변환. 더 많은 곡은 재생목록 안에서 아래로 스크롤하세요.')
        self.hint.setWordWrap(True)
        root.addWidget(self.hint)

        # Create the view before the profile: Qt destroys the page before its profile.
        self.view = QWebEngineView(self)
        if persistent:
            self.profile = QWebEngineProfile('querybot-youtube', self)
            base = Path(QStandardPaths.writableLocation(QStandardPaths.AppLocalDataLocation)) / 'youtube-browser'
            self.profile.setPersistentStoragePath(str(base / 'storage'))
            self.profile.setCachePath(str(base / 'cache'))
        else:
            self.profile = QWebEngineProfile(self)
        self.profile.downloadRequested.connect(lambda download: download.cancel())
        self.page = QWebEnginePage(self.profile, self.view)
        self.view.setPage(self.page)
        self.page.setAudioMuted(True)
        self.page.newWindowRequested.connect(lambda request: self.navigate(request.requestedUrl().toString()))
        self.page.renderProcessTerminated.connect(lambda *_: self._show_error('YouTube 화면이 종료되었습니다. 주소 옆 열기를 눌러 다시 열어주세요.'))
        root.addWidget(self.view, 1)
        bottom = QHBoxLayout()
        self.status = QLabel('YouTube를 여는 중…')
        self.status.setWordWrap(True)
        bottom.addWidget(self.status, 1)
        close = QPushButton('닫기')
        close.clicked.connect(self.reject)
        bottom.addWidget(close)
        self.import_button = QPushButton('이 목록 가져오기')
        self.import_button.setObjectName('primaryButton')
        self.import_button.clicked.connect(self.capture)
        bottom.addWidget(self.import_button)
        root.addLayout(bottom)
        self.go_button.clicked.connect(lambda: self.navigate(self.address.text()))
        self.address.returnPressed.connect(lambda: self.navigate(self.address.text()))
        self.back_button.clicked.connect(self.view.back)
        self.view.urlChanged.connect(self._url_changed)
        self.view.loadStarted.connect(self._load_started)
        self.view.loadFinished.connect(self._load_finished)
        self.timeout = QTimer(self)
        self.timeout.setSingleShot(True)
        self.timeout.timeout.connect(lambda: self._show_error('화면 응답이 늦습니다. 로딩이 끝나면 다시 눌러주세요.'))

    def open_url(self, url):
        self.snapshot = None
        normalized = youtube_url(url)
        if normalized != self._last_requested:
            self.navigate(normalized)

    def navigate(self, url):
        try:
            normalized = youtube_url(url)
        except ValueError as exc:
            self._show_error(str(exc))
            return
        self._last_requested = normalized
        self.view.setUrl(QUrl(normalized))

    def _url_changed(self, url):
        self._epoch += 1
        self.address.setText(url.toString())

    def _load_started(self):
        self._epoch += 1
        self._reading = False
        self.timeout.stop()
        self.import_button.setEnabled(False)
        self.status.setText('YouTube를 여는 중…')

    def _load_finished(self, ok):
        self.import_button.setEnabled(True)
        self.status.setText('이 창의 재생목록을 확인한 뒤 가져오세요.' if ok else '페이지를 열지 못했습니다. 연결을 확인한 뒤 열기를 눌러주세요.')

    def _show_error(self, message):
        self._epoch += 1
        self._reading = False
        self.timeout.stop()
        self.import_button.setEnabled(True)
        self.status.setText(message)

    def capture(self):
        if self._reading:
            return
        self._reading = True
        self.import_button.setEnabled(False)
        self.status.setText('이 화면의 곡과 순서를 가져오는 중…')
        epoch = self._epoch
        self.timeout.start(15000)
        self.page.runJavaScript(CAPTURE_SCRIPT, QWebEngineScript.ApplicationWorld,
                                lambda payload: self._captured(epoch, payload))

    def _captured(self, epoch, payload):
        if not self._reading or epoch != self._epoch:
            return
        self.timeout.stop()
        self._reading = False
        self.import_button.setEnabled(True)
        try:
            self.snapshot = browser_snapshot(payload, self.view.url().toString())
        except ValueError as exc:
            self._show_error(str(exc))
            return
        self._last_requested = self.snapshot['source_url']
        self.accept()

    def done(self, result):
        self._epoch += 1
        self._reading = False
        self.timeout.stop()
        self.page.runJavaScript("document.querySelectorAll('video,audio').forEach(v => v.pause())")
        super().done(result)
