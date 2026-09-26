"""GUI integration checks for explicitly requested native browser copying.

All native operations and dialogs are mocked: these tests never activate a
browser, issue keyboard input, or use the real clipboard.
"""
import os
import unittest
from unittest.mock import MagicMock, patch

os.environ.setdefault("QT_QPA_PLATFORM", "offscreen")

import querybot_gui as gui
import native_browser_capture as native


PID = "RDHMdY9CYBrIU"
CAPTURED_URL = "https://www.youtube.com/watch?v=yHKXRcZxpG8&list=" + PID + "&index=4"
TARGET = {"hwnd": 123, "pid": 456, "browser": "Brave", "title": "Mix - YouTube"}
EXPECTED = [
    ("HMdY9CYBrIU", "BRODYAGA FUNK (PHONK)"),
    ("MTBmJO62zps", "AVANGARD (Slowed + Reverb)"),
    ("U1yfpCfGsFE", "Avangards"),
    ("yHKXRcZxpG8", "FUNK UNIVERSO (Slowed)"),
]
HTML = "".join(
    '<ytd-playlist-panel-video-renderer>'
    f'<a href="/watch?v={video_id}&amp;list={PID}&amp;index={index}">'
    f'<span id="video-title" title="{title}">{title}</span></a>'
    '</ytd-playlist-panel-video-renderer>'
    for index, (video_id, title) in enumerate(EXPECTED, 1)
)


def window_stub():
    window = MagicMock()
    window.convert_worker = None
    window.playlist_preview_worker = None
    window.browser_capture_worker = None
    window._qb_closing = False
    # A valid but obsolete GUI URL must not reject the current browser's Mix.
    window.url_input.text.return_value = "https://www.youtube.com/playlist?list=PLold"
    return window


class BrowserCaptureGuiTests(unittest.TestCase):
    def setUp(self):
        self.window = window_stub()
        self.mime = MagicMock()
        self.mime.hasHtml.return_value = True
        self.mime.html.return_value = HTML
        self.clipboard = MagicMock()
        self.clipboard.mimeData.return_value = self.mime
        self.result = {"url": CAPTURED_URL, "sequence": 77}
        self.clipboard_patch = patch.object(gui.QApplication, "clipboard", return_value=self.clipboard)
        self.clipboard_patch.start()
        self.addCleanup(self.clipboard_patch.stop)
        self.refetch = patch.object(
            gui.backend, "get_playlist_entries", side_effect=AssertionError("must not refetch")
        ).start()
        self.addCleanup(patch.stopall)

    def test_ready_uses_exact_captured_url_and_order_without_refetch(self):
        with patch.object(native, "clipboard_sequence", side_effect=[77, 77]) as sequence, \
                patch.object(gui, "_qb_capture_return"), \
                patch.object(gui, "_qb_playlist_ready") as ready:
            gui._qb_capture_ready(self.window, TARGET, self.result)
        self.assertEqual(sequence.call_count, 2)
        ready.assert_called_once()
        window, url, snapshot = ready.call_args.args
        self.assertIs(window, self.window)
        self.assertEqual(url, CAPTURED_URL)
        self.assertEqual([(e["id"], e["title"]) for e in snapshot["entries"]], EXPECTED)
        self.assertEqual([e["browser_index"] for e in snapshot["entries"]], [1, 2, 3, 4])
        self.window.url_input.setText.assert_called_once_with(CAPTURED_URL)
        self.refetch.assert_not_called()

    def test_stale_sequence_before_read_does_not_read_clipboard_or_convert(self):
        with patch.object(native, "clipboard_sequence", return_value=78), \
                patch.object(gui, "_qb_capture_failed") as failed, \
                patch.object(gui, "_qb_playlist_ready") as ready:
            gui._qb_capture_ready(self.window, TARGET, self.result)
        failed.assert_called_once()
        self.clipboard.mimeData.assert_not_called()
        ready.assert_not_called()
        self.window.url_input.setText.assert_not_called()

    def test_clipboard_change_during_html_read_does_not_convert(self):
        with patch.object(native, "clipboard_sequence", side_effect=[77, 78]), \
                patch.object(gui, "_qb_capture_failed") as failed, \
                patch.object(gui, "_qb_playlist_ready") as ready:
            gui._qb_capture_ready(self.window, TARGET, self.result)
        self.mime.html.assert_called_once()
        failed.assert_called_once()
        ready.assert_not_called()
        self.window.url_input.setText.assert_not_called()

    def test_missing_html_or_plain_text_never_starts_conversion(self):
        for mime_available, has_html, html in [(False, False, ""), (True, False, ""), (True, True, CAPTURED_URL)]:
            with self.subTest(mime_available=mime_available, has_html=has_html, html=html):
                self.clipboard.mimeData.return_value = self.mime if mime_available else None
                self.mime.hasHtml.return_value = has_html
                self.mime.html.return_value = html
                with patch.object(native, "clipboard_sequence", return_value=77), \
                        patch.object(gui, "_qb_capture_failed") as failed, \
                        patch.object(gui, "_qb_playlist_ready") as ready:
                    gui._qb_capture_ready(self.window, TARGET, self.result)
                failed.assert_called_once()
                ready.assert_not_called()
        self.refetch.assert_not_called()

    def test_captured_url_and_copied_playlist_mismatch_fails(self):
        self.result["url"] = "https://www.youtube.com/playlist?list=PLanother"
        with patch.object(native, "clipboard_sequence", return_value=77), \
                patch.object(gui, "_qb_capture_failed") as failed, \
                patch.object(gui, "_qb_playlist_ready") as ready:
            gui._qb_capture_ready(self.window, TARGET, self.result)
        failed.assert_called_once()
        ready.assert_not_called()

    def test_multiple_window_selection_cancellation_starts_nothing(self):
        other = dict(TARGET, hwnd=789, pid=987, title="Other Mix - YouTube")
        with patch.object(native, "list_browser_windows", return_value=[TARGET, other]), \
                patch.object(gui.QInputDialog, "getItem", return_value=("", False)) as choose, \
                patch.object(gui, "_QBBrowserCaptureWorker") as worker, \
                patch.object(gui, "_qb_capture_controls") as controls:
            gui._qb_capture_current_browser(self.window)
        choose.assert_called_once()
        worker.assert_not_called()
        controls.assert_not_called()
        self.assertIsNone(self.window.browser_capture_worker)

    def test_single_youtube_window_starts_only_selected_target(self):
        unrelated = dict(TARGET, hwnd=999, title="A different browser page")
        with patch.object(native, "list_browser_windows", return_value=[unrelated, TARGET]), \
                patch.object(gui.QInputDialog, "getItem") as choose, \
                patch.object(gui, "_QBBrowserCaptureWorker") as worker:
            gui._qb_capture_current_browser(self.window)
        choose.assert_not_called()
        worker.assert_called_once_with(TARGET, self.window)
        worker.return_value.start.assert_called_once()
        worker.return_value.success.connect.assert_called_once()
        worker.return_value.failed.connect.assert_called_once()
        self.window.browser_playlist_btn.setEnabled.assert_called_once_with(False)

    def test_current_browser_action_guarded_during_each_active_worker(self):
        for attribute in ("browser_capture_worker", "convert_worker", "playlist_preview_worker"):
            with self.subTest(attribute=attribute):
                window = window_stub()
                active = MagicMock()
                active.isRunning.return_value = True
                setattr(window, attribute, active)
                with patch.object(native, "list_browser_windows") as windows, \
                        patch.object(gui, "_QBBrowserCaptureWorker") as worker:
                    gui._qb_capture_current_browser(window)
                windows.assert_not_called()
                worker.assert_not_called()

    def test_other_import_and_conversion_paths_guarded_during_capture(self):
        active = MagicMock()
        active.isRunning.return_value = True
        self.window.browser_capture_worker = active
        with patch.object(gui, "_qb_playlist_ready") as ready, \
                patch.object(gui, "_qb_launch_single") as single, \
                patch.object(gui, "_QBPlaylistLookupWorker") as lookup, \
                patch.object(gui.QMessageBox, "information") as message:
            for action in (gui._qb_start_conversion, gui._qb_start_playlist,
                           gui._qb_import_browser_playlist, gui._qb_open_youtube):
                action(self.window)
        self.clipboard.mimeData.assert_not_called()
        ready.assert_not_called()
        single.assert_not_called()
        lookup.assert_not_called()
        message.assert_not_called()

    def test_capture_failure_restores_controls_without_fallback(self):
        with patch.object(gui, "_qb_capture_return"), \
                patch.object(gui, "_qb_playlist_ready") as ready:
            gui._qb_capture_failed(self.window, TARGET, "focus changed")
        for button in (self.window.convert_btn, self.window.playlist_convert_btn,
                       self.window.browser_playlist_btn):
            button.setEnabled.assert_called_once_with(True)
        self.assertIn("focus changed", self.window.convert_status_text.setText.call_args.args[0])
        ready.assert_not_called()
        self.refetch.assert_not_called()

    def test_return_does_not_steal_focus_from_user_selected_window(self):
        with patch.object(native, "foreground_window", return_value=999):
            gui._qb_capture_return(self.window, TARGET)
        self.window.raise_.assert_not_called()
        self.window.activateWindow.assert_not_called()

    def test_late_capture_result_during_close_never_starts_conversion(self):
        self.window._qb_closing = True
        with patch.object(native, "clipboard_sequence") as sequence, \
                patch.object(gui, "_qb_playlist_ready") as ready:
            gui._qb_capture_ready(self.window, TARGET, self.result)
        sequence.assert_not_called()
        self.clipboard.mimeData.assert_not_called()
        ready.assert_not_called()

    def test_resume_defers_while_capture_is_running(self):
        active = MagicMock()
        active.isRunning.return_value = True
        self.window.browser_capture_worker = active
        with patch.object(gui.QTimer, "singleShot") as timer, \
                patch.object(gui, "_qb_load_pending") as pending, \
                patch.object(gui, "_qb_launch_single") as launch:
            gui._qb_offer_resume(self.window)
        timer.assert_called_once()
        pending.assert_not_called()
        launch.assert_not_called()


if __name__ == "__main__":
    unittest.main()
