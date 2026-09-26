"""Explicitly copy a selected Windows browser's current YouTube document.

This module never reads browser profiles, cookies, page source, or clipboard data.
The caller reads fresh clipboard HTML on the Qt GUI thread and validates it with
browser_playlist. No input is sent unless the exact document has verified focus.
"""
import ctypes
from ctypes import wintypes
import ntpath
import sys
import time
from urllib.parse import urlparse


BROWSERS = {'chrome.exe': 'Chrome', 'msedge.exe': 'Edge', 'brave.exe': 'Brave'}
YOUTUBE_HOSTS = {'youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com'}
MANUAL_HELP = "YouTube 페이지의 빈 곳을 누르고 Ctrl+A, Ctrl+C로 복사한 뒤 '화면 목록 붙여넣기'를 사용해주세요."


class CaptureError(RuntimeError):
    """An expected, user-readable failure that must not trigger a fallback lookup."""


def _youtube_url(value):
    if not isinstance(value, str):
        return ''
    value = value.strip()
    try:
        p = urlparse(value)
        if (p.scheme not in {'https', 'http'} or p.hostname not in YOUTUBE_HOSTS
                or p.username or p.password or p.port not in {None, 80, 443}):
            return ''
    except ValueError:
        return ''
    return value


def _address_url(value):
    """Chromium can omit the scheme in its accessible address-bar value."""
    if not isinstance(value, str):
        return ''
    value = value.strip()
    if any(value.startswith(host + '/') or value == host for host in YOUTUBE_HOSTS):
        value = 'https://' + value
    return _youtube_url(value)


class _MOUSEINPUT(ctypes.Structure):
    _fields_ = [('dx', wintypes.LONG), ('dy', wintypes.LONG), ('mouseData', wintypes.DWORD),
                ('dwFlags', wintypes.DWORD), ('time', wintypes.DWORD), ('dwExtraInfo', ctypes.c_size_t)]


class _KEYBDINPUT(ctypes.Structure):
    _fields_ = [('wVk', wintypes.WORD), ('wScan', wintypes.WORD), ('dwFlags', wintypes.DWORD),
                ('time', wintypes.DWORD), ('dwExtraInfo', ctypes.c_size_t)]


class _HARDWAREINPUT(ctypes.Structure):
    _fields_ = [('uMsg', wintypes.DWORD), ('wParamL', wintypes.WORD), ('wParamH', wintypes.WORD)]


class _INPUTUNION(ctypes.Union):
    _fields_ = [('mi', _MOUSEINPUT), ('ki', _KEYBDINPUT), ('hi', _HARDWAREINPUT)]


class _INPUT(ctypes.Structure):
    _anonymous_ = ('value',)
    _fields_ = [('type', wintypes.DWORD), ('value', _INPUTUNION)]


class _Win32:
    def __init__(self):
        if sys.platform != 'win32':
            raise CaptureError('열린 브라우저에서 가져오기는 Windows에서 사용할 수 있습니다.')
        self.user32 = ctypes.WinDLL('user32', use_last_error=True)
        self.kernel32 = ctypes.WinDLL('kernel32', use_last_error=True)
        u, k = self.user32, self.kernel32
        self._enum_proc = ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)
        signatures = [
            (u.EnumWindows, [self._enum_proc, wintypes.LPARAM], wintypes.BOOL),
            (u.IsWindow, [wintypes.HWND], wintypes.BOOL),
            (u.IsWindowVisible, [wintypes.HWND], wintypes.BOOL),
            (u.IsIconic, [wintypes.HWND], wintypes.BOOL),
            (u.GetWindowTextLengthW, [wintypes.HWND], ctypes.c_int),
            (u.GetWindowTextW, [wintypes.HWND, wintypes.LPWSTR, ctypes.c_int], ctypes.c_int),
            (u.GetWindowThreadProcessId, [wintypes.HWND, ctypes.POINTER(wintypes.DWORD)], wintypes.DWORD),
            (u.GetForegroundWindow, [], wintypes.HWND),
            (u.SetForegroundWindow, [wintypes.HWND], wintypes.BOOL),
            (u.ShowWindowAsync, [wintypes.HWND, ctypes.c_int], wintypes.BOOL),
            (u.GetAsyncKeyState, [ctypes.c_int], ctypes.c_short),
            (u.GetClipboardSequenceNumber, [], wintypes.DWORD),
            (u.RegisterClipboardFormatW, [wintypes.LPCWSTR], wintypes.UINT),
            (u.IsClipboardFormatAvailable, [wintypes.UINT], wintypes.BOOL),
            (u.SendInput, [wintypes.UINT, ctypes.POINTER(_INPUT), ctypes.c_int], wintypes.UINT),
            (k.OpenProcess, [wintypes.DWORD, wintypes.BOOL, wintypes.DWORD], wintypes.HANDLE),
            (k.QueryFullProcessImageNameW,
             [wintypes.HANDLE, wintypes.DWORD, wintypes.LPWSTR, ctypes.POINTER(wintypes.DWORD)], wintypes.BOOL),
            (k.CloseHandle, [wintypes.HANDLE], wintypes.BOOL),
        ]
        for fn, args, result in signatures:
            fn.argtypes, fn.restype = args, result

    def process_name(self, pid):
        handle = self.kernel32.OpenProcess(0x1000, False, int(pid))
        if not handle:
            return ''
        try:
            buf = ctypes.create_unicode_buffer(32768)
            size = wintypes.DWORD(len(buf))
            if not self.kernel32.QueryFullProcessImageNameW(handle, 0, buf, ctypes.byref(size)):
                return ''
            return ntpath.basename(buf.value).lower()
        finally:
            self.kernel32.CloseHandle(handle)

    def window_pid(self, hwnd):
        pid = wintypes.DWORD()
        self.user32.GetWindowThreadProcessId(int(hwnd), ctypes.byref(pid))
        return int(pid.value)

    def valid_window(self, hwnd, pid):
        return (bool(self.user32.IsWindow(int(hwnd))) and bool(self.user32.IsWindowVisible(int(hwnd)))
                and self.window_pid(hwnd) == int(pid) and self.process_name(pid) in BROWSERS)

    def windows(self):
        result = []

        @self._enum_proc
        def visit(hwnd, _):
            try:
                if not self.user32.IsWindowVisible(hwnd):
                    return True
                pid = self.window_pid(hwnd)
                exe = self.process_name(pid)
                if exe not in BROWSERS:
                    return True
                length = min(self.user32.GetWindowTextLengthW(hwnd), 4096)
                if length <= 0:
                    return True
                title = ctypes.create_unicode_buffer(length + 1)
                self.user32.GetWindowTextW(hwnd, title, len(title))
                if title.value.strip():
                    result.append({'hwnd': int(hwnd), 'pid': pid, 'title': title.value,
                                   'browser': BROWSERS[exe]})
            except (OSError, ValueError):
                pass  # A window can close while EnumWindows is running.
            return True

        if not self.user32.EnumWindows(visit, 0):
            raise CaptureError('열린 브라우저 창을 읽지 못했습니다. 잠시 후 다시 시도해주세요.')
        return result

    def foreground(self):
        return int(self.user32.GetForegroundWindow() or 0)

    def activate(self, hwnd):
        if self.user32.IsIconic(int(hwnd)):
            self.user32.ShowWindowAsync(int(hwnd), 9)  # SW_RESTORE
        self.user32.SetForegroundWindow(int(hwnd))

    def modifiers_held(self):
        return any(self.user32.GetAsyncKeyState(vk) & 0x8000
                   for vk in (0x10, 0x11, 0x12, 0x5B, 0x5C))

    def sequence(self):
        return int(self.user32.GetClipboardSequenceNumber())

    def html_available(self):
        fmt = self.user32.RegisterClipboardFormatW('HTML Format')
        return bool(fmt and self.user32.IsClipboardFormatAvailable(fmt))

    def copy_page(self):
        # One input batch cannot be interspersed with another SendInput batch.
        keys = [(0x11, 0), (0x41, 0), (0x41, 2), (0x43, 0), (0x43, 2), (0x11, 2)]
        events = (_INPUT * len(keys))()
        for event, (key, flags) in zip(events, keys):
            event.type = 1  # INPUT_KEYBOARD
            event.ki = _KEYBDINPUT(key, 0, flags, 0, 0)
        count = int(self.user32.SendInput(len(events), events, ctypes.sizeof(_INPUT)))
        if count != len(events):
            # Release only an injected modifier if a partial batch stopped early.
            if 0 < count < len(events):
                release = _INPUT(type=1)
                release.ki = _KEYBDINPUT(0x11, 0, 2, 0, 0)
                self.user32.SendInput(1, ctypes.byref(release), ctypes.sizeof(_INPUT))
            raise CaptureError('브라우저에 복사 명령을 보내지 못했습니다. 관리자 권한으로 실행 중인지 확인해주세요. ' + MANUAL_HELP)


class _UIAutomation:
    """COM resources are created and released within the calling worker thread."""
    def __init__(self):
        self.client = None
        self._com = None
        self._address_element = None
        try:
            # comtypes initializes its import thread. Reuse that initialization on
            # first import; explicitly initialize each subsequent worker thread.
            first_import = 'comtypes' not in sys.modules
            import comtypes
            from comtypes import client
            self._com = comtypes
            if not first_import:
                comtypes.CoInitialize()
            self._initialized = True
            module = client.GetModule('UIAutomationCore.dll')
            self.client = client.CreateObject(getattr(module, 'CUIAutomation8', module.CUIAutomation),
                                              interface=module.IUIAutomation)
            try:
                bounded = self.client.QueryInterface(module.IUIAutomation2)
                bounded.ConnectionTimeout = 1500
                bounded.TransactionTimeout = 2000
                self.client = bounded
            except (AttributeError, comtypes.COMError):
                # Older providers retain their system timeout; never bypass the
                # document/focus checks just because IUIAutomation2 is unavailable.
                pass
        except Exception as exc:
            self.close()
            raise CaptureError('브라우저 화면 연결 구성 요소를 준비하지 못했습니다. ' + MANUAL_HELP) from exc

    def close(self):
        self._address_element = None
        self.client = None
        if getattr(self, '_initialized', False):
            self._initialized = False
            self._com.CoUninitialize()

    @staticmethod
    def _document_url(element):
        for property_id in (30045, 30093):  # Value.Value, LegacyIAccessible.Value
            try:
                url = _youtube_url(element.GetCurrentPropertyValue(property_id))
                if url:
                    return url
            except Exception:
                continue
        return ''

    def _top_document(self, element, root):
        walker = self.client.ControlViewWalker
        parent = walker.GetParentElement(element)
        for _ in range(32):
            if not parent:
                return False
            if self.client.CompareElements(parent, root):
                return True
            if parent.CurrentControlType == 50030:
                return False  # Never select a YouTube iframe in another page.
            parent = walker.GetParentElement(parent)
        return False

    def _find_address_element(self, root):
        # Only browser chrome is considered: input controls inside page documents
        # (including YouTube search and comments) cannot provide the source URL.
        condition = self.client.CreatePropertyCondition(30003, 50004)  # ControlType.Edit
        edits = root.FindAll(4, condition)
        if edits.Length > 64:
            return None, ''
        candidates = []
        for index in range(edits.Length):
            item = edits.GetElement(index)
            if item.CurrentIsOffscreen or not item.CurrentIsEnabled:
                continue
            if not self._top_document(item, root):
                continue
            url = _address_url(item.GetCurrentPropertyValue(30045))
            if url:
                candidates.append((item, url))
        return candidates[0] if len(candidates) == 1 else (None, '')

    def prepare_document(self, hwnd):
        root = self.client.ElementFromHandle(int(hwnd))
        condition = self.client.CreatePropertyCondition(30003, 50030)  # ControlType.Document
        documents = root.FindAll(4, condition)  # TreeScope.Descendants
        if documents.Length > 64:
            raise CaptureError('브라우저 화면을 확실하게 구분하지 못했습니다. ' + MANUAL_HELP)
        candidates = []
        for index in range(documents.Length):
            item = documents.GetElement(index)
            if item.CurrentIsOffscreen or not item.CurrentIsEnabled:
                continue
            if self._top_document(item, root):
                candidates.append(item)
        if len(candidates) != 1:
            raise CaptureError('활성 YouTube 페이지를 확실하게 구분하지 못했습니다. ' + MANUAL_HELP)
        document = candidates[0]
        url = self._document_url(document)
        if not url:
            self._address_element, url = self._find_address_element(root)
        if not url:
            raise CaptureError('선택한 창에서 YouTube 주소를 확인하지 못했습니다. 원하는 YouTube 탭을 연 뒤 다시 시도해주세요. ' + MANUAL_HELP)
        if not document.CurrentIsKeyboardFocusable:
            raise CaptureError('YouTube 페이지에 복사 명령을 보낼 수 없습니다. ' + MANUAL_HELP)
        return document, url

    def focus_document(self, document):
        document.SetFocus()

    def document_focused(self, document, url):
        focused = self.client.GetFocusedElement()
        current_url = (self._document_url(document) if self._address_element is None
                       else _address_url(self._address_element.GetCurrentPropertyValue(30045)))
        return bool(focused and self.client.CompareElements(focused, document)
                    and current_url == url)


def _guard(win, hwnd, pid, cancelled, require_foreground=True):
    if cancelled():
        raise CaptureError('목록 가져오기를 취소했습니다.')
    if not win.valid_window(hwnd, pid):
        raise CaptureError('선택한 브라우저 창이 닫혔거나 바뀌었습니다. 다시 선택해주세요.')
    if require_foreground and win.foreground() != hwnd:
        raise CaptureError('다른 창으로 전환되어 복사를 중단했습니다. 다시 시도해주세요.')
    if win.modifiers_held():
        raise CaptureError('Ctrl, Alt, Shift, Windows 키를 놓은 뒤 다시 시도해주세요.')


def _capture(win, uia, hwnd, pid, cancelled, *, now=time.monotonic, sleep=time.sleep):
    """Injectable state machine; unit tests never call the real Windows APIs."""
    _guard(win, hwnd, pid, cancelled, require_foreground=False)
    win.activate(hwnd)
    deadline = now() + 1.5
    while win.foreground() != hwnd and now() < deadline:
        _guard(win, hwnd, pid, cancelled, require_foreground=False)
        sleep(0.05)
    _guard(win, hwnd, pid, cancelled)
    document, url = uia.prepare_document(hwnd)
    _guard(win, hwnd, pid, cancelled)
    uia.focus_document(document)
    deadline = now() + 1.5
    while not uia.document_focused(document, url) and now() < deadline:
        _guard(win, hwnd, pid, cancelled)
        sleep(0.05)
    _guard(win, hwnd, pid, cancelled)
    if not uia.document_focused(document, url):
        raise CaptureError('YouTube 페이지 선택을 확인하지 못해 복사를 중단했습니다. ' + MANUAL_HELP)
    before = win.sequence()
    if not before:
        raise CaptureError('Windows 클립보드에 접근하지 못했습니다. 잠시 후 다시 시도해주세요.')
    # Recheck after COM calls: neither foreground activation nor SetFocus alone
    # proves that our target is still receiving input now.
    _guard(win, hwnd, pid, cancelled)
    win.copy_page()
    deadline = now() + 4.0
    last_sequence = None
    while now() < deadline:
        _guard(win, hwnd, pid, cancelled)
        sequence = win.sequence()
        if sequence and sequence != before and win.html_available():
            # Require two successive samples so partially published clipboard
            # formats aren't immediately returned to the GUI thread.
            if sequence == last_sequence:
                if not uia.document_focused(document, url):
                    raise CaptureError('복사 중 YouTube 페이지가 바뀌었습니다. 다시 시도해주세요.')
                _guard(win, hwnd, pid, cancelled)
                if win.sequence() == sequence:
                    return {'sequence': sequence, 'url': url, 'hwnd': hwnd, 'pid': pid}
            last_sequence = sequence
        else:
            last_sequence = None
        sleep(0.05)
    raise CaptureError('새 페이지 내용이 복사되지 않았습니다. ' + MANUAL_HELP)


def list_browser_windows():
    """Read only visible Chrome, Edge and Brave top-level windows."""
    return _Win32().windows()


def clipboard_sequence():
    return _Win32().sequence()


def foreground_window():
    return _Win32().foreground()


def check_runtime():
    """Load the packaged COM client/type library without inspecting any UI."""
    if sys.platform != 'win32':
        raise CaptureError('Windows에서만 사용할 수 있습니다.')
    uia = _UIAutomation()
    uia.close()


def capture_browser(hwnd, pid, cancelled=lambda: False):
    """Called on a worker thread; read returned fresh HTML on the Qt main thread.

    Clipboard contents deliberately remain the result of the user's explicit
    copy operation. The caller must recheck sequence before reading the HTML.
    """
    hwnd, pid = int(hwnd), int(pid)
    uia = None
    try:
        win = _Win32()
        _guard(win, hwnd, pid, cancelled, require_foreground=False)
        uia = _UIAutomation()
        return _capture(win, uia, hwnd, pid, cancelled)
    except CaptureError:
        raise
    except Exception as exc:
        raise CaptureError('브라우저 화면을 가져오지 못했습니다. ' + MANUAL_HELP) from exc
    finally:
        if uia is not None:
            uia.close()
