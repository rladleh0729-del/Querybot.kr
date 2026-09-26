import os
os.environ.setdefault('QT_QPA_PLATFORM', 'offscreen')
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch, MagicMock
import server
import querybot_gui as gui
from PySide6.QtWidgets import QApplication
from PySide6.QtCore import Qt

URL='https://www.youtube.com/watch?v=yHKXRcZxpG8&list=RDHMdY9CYBrIU&index=4'
ENTRIES=[{'id':'yHKXRcZxpG8','title':'FUNK UNIVERSO (Slowed)'},
         {'id':'HMdY9CYBrIU','title':'BRODYAGA FUNK (PHONK)'},
         {'id':'yHKXRcZxpG8','title':'duplicate'},None,{'id':'invalid'}]

class PlaylistTests(unittest.TestCase):
    def test_normalization(self):
        rows=server.normalize_playlist_entries(ENTRIES)
        self.assertEqual([x['id'] for x in rows],['yHKXRcZxpG8','HMdY9CYBrIU'])
        self.assertEqual(rows[0]['title'],ENTRIES[0]['title'])
        self.assertEqual(rows[1]['url'],'https://www.youtube.com/watch?v=HMdY9CYBrIU')

    def test_mix_keeps_full_list_and_original_url(self):
        with patch.object(server.yt_dlp,'YoutubeDL') as factory:
            engine=factory.return_value.__enter__.return_value
            engine.extract_info.return_value={'entries':ENTRIES,'title':'Mix'}
            result=server.get_playlist_entries(URL)
            engine.extract_info.assert_called_once_with(URL,download=False)
            self.assertEqual(result['count'],2)
            self.assertTrue(result['is_mix'])
            self.assertFalse(factory.call_args.args[0]['noplaylist'])

    def test_invalid_input(self):
        for url in ['https://example.com/watch?v=yHKXRcZxpG8&list=x','https://youtube.com/watch?v=yHKXRcZxpG8']:
            with self.assertRaises(ValueError): server.get_playlist_entries(url)

    def test_selected_snapshot_and_formats(self):
        for fmt in ['mp3','m4a','wav','flac']:
            with self.subTest(fmt=fmt), patch.object(server,'get_playlist_entries',side_effect=AssertionError('must not refetch')), patch.object(server,'download_audio',return_value={'path':'out.'+fmt}) as download:
                messages=[]
                result=server.download_playlist_audio(URL,fmt,progress_callback=lambda p,m:messages.append(m),playlist_snapshot={'entries':[ENTRIES[1]]})
                self.assertEqual(download.call_args.args[:2],('https://www.youtube.com/watch?v=HMdY9CYBrIU',fmt))
                self.assertEqual(result['completed'],1)
                self.assertEqual(result['failed_count'],0)
                self.assertTrue(any('BRODYAGA' in m and '완료' in m for m in messages))

    def test_failure_does_not_abort_next_song(self):
        with patch.object(server,'download_audio',side_effect=[RuntimeError('unavailable'),{'path':'ok.mp3'}]):
            result=server.download_playlist_audio(URL,playlist_snapshot={'entries':ENTRIES[:2]})
            self.assertEqual((result['completed'],result['failed_count']),(1,1))

    def test_dialog_selection_and_format_duplicates(self):
        app=QApplication.instance() or QApplication([])
        with tempfile.TemporaryDirectory() as folder, patch.object(server,'DOWNLOAD_DIR',Path(folder)), patch.object(gui._QBPlaylistDialog,'load_thumbnail'):
            (Path(folder)/'existing [yHKXRcZxpG8].flac').touch()
            dialog=gui._QBPlaylistDialog({'entries':ENTRIES,'title':'Mix'},format_name='flac')
            self.assertEqual(dialog.table.rowCount(),2)
            self.assertEqual(dialog.table.item(0,0).checkState(),Qt.Unchecked)
            self.assertEqual([x['id'] for x in dialog.selected_entries()],['HMdY9CYBrIU'])
            dialog.set_all(True)
            self.assertEqual(len(dialog.selected_entries()),2)
            dialog.set_all(False)
            self.assertEqual(dialog.selected_entries(),[])
            dialog.select_new()
            self.assertEqual(len(dialog.selected_entries()),1)
            dialog.close()

if __name__=='__main__': unittest.main()
