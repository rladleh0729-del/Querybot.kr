import unittest
from unittest.mock import Mock

import native_browser_capture as capture


URL = 'https://www.youtube.com/watch?v=HMdY9CYBrIU&list=RDHMdY9CYBrIU'


class FakeClock:
    def __init__(self):
        self.value = 0

    def now(self):
        return self.value

    def sleep(self, seconds):
        self.value += seconds


class CaptureGuardTests(unittest.TestCase):
    def setUp(self):
        self.clock = FakeClock()
        self.win = Mock()
        self.win.valid_window.return_value = True
        self.win.foreground.return_value = 100
        self.win.modifiers_held.return_value = False
        self.win.sequence.side_effect = [7, 8, 8, 8]
        self.win.html_available.return_value = True
        self.uia = Mock()
        self.document = object()
        self.uia.prepare_document.return_value = (self.document, URL)
        self.uia.document_focused.return_value = True

    def run_capture(self, cancelled=lambda: False):
        return capture._capture(self.win, self.uia, 100, 200, cancelled,
                                now=self.clock.now, sleep=self.clock.sleep)

    def test_success_returns_fresh_sequence_and_exact_document_url(self):
        result = self.run_capture()
        self.assertEqual(result, {'sequence': 8, 'url': URL, 'hwnd': 100, 'pid': 200})
        self.win.copy_page.assert_called_once_with()
        self.uia.focus_document.assert_called_once_with(self.document)
        self.assertGreaterEqual(self.clock.value, 0.05)

    def test_cancelled_before_start_does_not_activate_or_copy(self):
        with self.assertRaisesRegex(capture.CaptureError, '취소'):
            self.run_capture(lambda: True)
        self.win.activate.assert_not_called()
        self.win.copy_page.assert_not_called()

    def test_changed_window_identity_never_receives_input(self):
        self.win.valid_window.return_value = False
        with self.assertRaisesRegex(capture.CaptureError, '닫혔거나'):
            self.run_capture()
        self.win.copy_page.assert_not_called()

    def test_modifiers_held_never_receive_input(self):
        self.win.modifiers_held.return_value = True
        with self.assertRaisesRegex(capture.CaptureError, '키를 놓은'):
            self.run_capture()
        self.win.activate.assert_not_called()
        self.win.copy_page.assert_not_called()

    def test_foreground_cannot_be_acquired_is_bounded(self):
        self.win.foreground.return_value = 999
        with self.assertRaisesRegex(capture.CaptureError, '다른 창'):
            self.run_capture()
        self.assertLess(self.clock.value, 1.6)
        self.win.copy_page.assert_not_called()

    def test_foreground_lost_after_document_focus_aborts(self):
        self.uia.focus_document.side_effect = lambda _: setattr(self.win.foreground, 'return_value', 999)
        with self.assertRaisesRegex(capture.CaptureError, '다른 창'):
            self.run_capture()
        self.win.copy_page.assert_not_called()

    def test_exact_document_focus_required(self):
        self.uia.document_focused.return_value = False
        with self.assertRaisesRegex(capture.CaptureError, '선택을 확인'):
            self.run_capture()
        self.assertLess(self.clock.value, 1.6)
        self.win.copy_page.assert_not_called()

    def test_stale_clipboard_cannot_be_success(self):
        self.win.sequence.side_effect = None
        self.win.sequence.return_value = 7
        with self.assertRaisesRegex(capture.CaptureError, '새 페이지'):
            self.run_capture()
        self.win.copy_page.assert_called_once()
        self.assertLess(self.clock.value, 4.1)

    def test_fresh_plain_text_clipboard_cannot_be_success(self):
        self.win.sequence.side_effect = [7] + [8] * 100
        self.win.html_available.return_value = False
        with self.assertRaisesRegex(capture.CaptureError, '새 페이지'):
            self.run_capture()

    def test_cancellation_during_copy_wait_aborts(self):
        self.win.sequence.side_effect = None
        self.win.sequence.return_value = 7
        with self.assertRaisesRegex(capture.CaptureError, '취소'):
            self.run_capture(lambda: self.clock.value >= 0.1)
        self.assertLess(self.clock.value, 0.2)
        self.win.copy_page.assert_called_once()

    def test_zero_clipboard_sequence_aborts_before_copy(self):
        self.win.sequence.side_effect = None
        self.win.sequence.return_value = 0
        with self.assertRaisesRegex(capture.CaptureError, '클립보드'):
            self.run_capture()
        self.win.copy_page.assert_not_called()

    def test_page_changed_after_copy_aborts(self):
        self.uia.document_focused.side_effect = [True, True, False]
        with self.assertRaisesRegex(capture.CaptureError, '페이지가 바뀌'):
            self.run_capture()

    def test_window_changed_before_input_aborts(self):
        self.win.sequence.side_effect = lambda: setattr(self.win.valid_window, 'return_value', False) or 7
        with self.assertRaisesRegex(capture.CaptureError, '닫혔거나'):
            self.run_capture()
        self.win.copy_page.assert_not_called()


class UrlValidationTests(unittest.TestCase):
    def test_only_full_youtube_document_urls_accepted(self):
        self.assertEqual(capture._youtube_url(URL), URL)
        self.assertEqual(capture._youtube_url('https://music.youtube.com/playlist?list=PLx'),
                         'https://music.youtube.com/playlist?list=PLx')
        for bad in ('youtube.com/watch?v=abc', 'https://youtube.com.evil.test/',
                    'https://youtube.com@evil.test/', 'https://user@youtube.com/',
                    'file:///youtube.com', 'javascript:youtube.com', 'https://youtube.com:999/',
                    'https://youtube.com:bad/', None, object()):
            with self.subTest(value=bad):
                self.assertEqual(capture._youtube_url(bad), '')

    def test_address_value_can_omit_scheme_but_cannot_spoof_host(self):
        self.assertEqual(capture._address_url('www.youtube.com/watch?v=abc'),
                         'https://www.youtube.com/watch?v=abc')
        for bad in ('youtube.com.evil.test/watch?v=abc', 'youtube.com@evil.test/',
                    'www.youtube.com search', 'https://evil.test/?youtube.com', None):
            self.assertEqual(capture._address_url(bad), '')


class DocumentValidationTests(unittest.TestCase):
    def setUp(self):
        self.uia = capture._UIAutomation.__new__(capture._UIAutomation)
        self.uia.client = Mock()
        self.uia._address_element = None
        self.root = self.element(50032, '')
        self.document = self.element(50030, URL)
        self.uia.client.ElementFromHandle.return_value = self.root
        self.uia.client.CompareElements.side_effect = lambda a, b: a is b
        self.uia.client.ControlViewWalker.GetParentElement.return_value = self.root
        self.root.FindAll.return_value = self.array([self.document])

    @staticmethod
    def element(kind, url):
        element = Mock()
        element.CurrentControlType = kind
        element.CurrentIsOffscreen = False
        element.CurrentIsEnabled = True
        element.CurrentIsKeyboardFocusable = True
        element.GetCurrentPropertyValue.return_value = url
        return element

    @staticmethod
    def array(items):
        array = Mock()
        array.Length = len(items)
        array.GetElement.side_effect = items.__getitem__
        return array

    def test_document_own_url_is_preferred(self):
        document, url = self.uia.prepare_document(100)
        self.assertIs(document, self.document)
        self.assertEqual(url, URL)
        self.assertIsNone(self.uia._address_element)

    def test_multiple_visible_documents_are_rejected(self):
        self.root.FindAll.return_value = self.array([self.document, self.element(50030, URL)])
        with self.assertRaisesRegex(capture.CaptureError, '확실하게'):
            self.uia.prepare_document(100)

    def test_youtube_iframe_in_other_page_is_not_a_top_document(self):
        frame_parent = self.element(50030, 'https://example.com/')
        self.uia.client.ControlViewWalker.GetParentElement.return_value = frame_parent
        with self.assertRaisesRegex(capture.CaptureError, '확실하게'):
            self.uia.prepare_document(100)

    def test_unique_browser_chrome_address_is_a_fallback(self):
        self.document.GetCurrentPropertyValue.return_value = ''
        address = self.element(50004, URL.removeprefix('https://'))
        self.root.FindAll.side_effect = [self.array([self.document]), self.array([address])]
        document, url = self.uia.prepare_document(100)
        self.assertIs(document, self.document)
        self.assertEqual(url, URL)
        self.assertIs(self.uia._address_element, address)

    def test_page_search_field_cannot_supply_browser_url(self):
        self.document.GetCurrentPropertyValue.return_value = ''
        search = self.element(50004, URL)
        self.root.FindAll.side_effect = [self.array([self.document]), self.array([search])]
        self.uia.client.ControlViewWalker.GetParentElement.side_effect = (
            lambda item: self.document if item is search else self.root)
        with self.assertRaisesRegex(capture.CaptureError, '주소를 확인'):
            self.uia.prepare_document(100)

    def test_input_focus_inside_page_does_not_count_as_document_focus(self):
        self.uia.client.GetFocusedElement.return_value = self.element(50004, '')
        self.assertFalse(self.uia.document_focused(self.document, URL))

    def test_changed_url_does_not_count_as_same_document(self):
        self.uia.client.GetFocusedElement.return_value = self.document
        self.document.GetCurrentPropertyValue.return_value = URL + '&index=2'
        self.assertFalse(self.uia.document_focused(self.document, URL))


if __name__ == '__main__':
    unittest.main()
