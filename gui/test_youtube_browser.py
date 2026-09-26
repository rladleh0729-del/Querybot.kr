import json
import os
import unittest
from unittest.mock import MagicMock, patch

os.environ.setdefault('QT_QPA_PLATFORM', 'offscreen')
from youtube_browser import youtube_url, browser_snapshot, YouTubeBrowserDialog
from test_browser_playlist import HTML, EXPECTED, PID

URL = 'https://www.youtube.com/watch?v=HMdY9CYBrIU&list=' + PID


class EmbeddedBrowserTests(unittest.TestCase):
    def test_preserves_current_url_and_exact_order(self):
        snapshot = browser_snapshot(json.dumps({'url': URL, 'html': HTML}), URL)
        self.assertEqual([(e['id'], e['title']) for e in snapshot['entries']], EXPECTED)
        self.assertEqual(snapshot['source_url'], URL)
        self.assertEqual(snapshot['source'], 'embedded_browser')

    def test_rejects_navigation_race_and_empty_panel(self):
        for data in [None, {}, {'url': URL+'x', 'html': HTML}, {'url': URL, 'html': ''}]:
            with self.assertRaises(ValueError): browser_snapshot(json.dumps(data), URL)

    def test_rejects_old_playlist_dom(self):
        other = 'https://www.youtube.com/playlist?list=PLother'
        with self.assertRaises(ValueError):
            browser_snapshot(json.dumps({'url': other, 'html': HTML}), other)

    def test_normalizes_supported_urls(self):
        self.assertEqual(youtube_url(''), 'https://www.youtube.com/')
        self.assertIn('v=HMdY9CYBrIU', youtube_url('https://youtu.be/HMdY9CYBrIU?list='+PID))
        self.assertIn('list='+PID, youtube_url('youtube.com/playlist?list='+PID))
        for url in ['file:///x', 'javascript:alert(1)', 'https://youtube.com.evil.test/', 'https://user@youtube.com/']:
            with self.assertRaises(ValueError): youtube_url(url)

    def test_late_callback_after_close_or_navigation_is_ignored(self):
        dialog = MagicMock()
        dialog._reading = True
        dialog._epoch = 2
        YouTubeBrowserDialog._captured(dialog, 1, json.dumps({'url': URL, 'html': HTML}))
        dialog.accept.assert_not_called()
        dialog._reading = False
        YouTubeBrowserDialog._captured(dialog, 2, json.dumps({'url': URL, 'html': HTML}))
        dialog.accept.assert_not_called()

    def test_gui_uses_snapshot_without_second_lookup(self):
        import querybot_gui as gui
        window = MagicMock()
        window.convert_worker = None
        window.playlist_preview_worker = None
        window.browser_capture_worker = None
        window.url_input.text.return_value = URL
        dialog = window.youtube_browser_dialog
        dialog.exec.return_value = gui.QDialog.Accepted
        dialog.snapshot = browser_snapshot(json.dumps({'url': URL, 'html': HTML}), URL)
        with patch.object(gui, '_qb_playlist_ready') as ready, patch.object(gui.backend, 'get_playlist_entries', side_effect=AssertionError('must not refetch')):
            gui._qb_open_youtube(window)
        self.assertEqual(ready.call_args.args[2], dialog.snapshot)


if __name__ == '__main__':
    unittest.main()
