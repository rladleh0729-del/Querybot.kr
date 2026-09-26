import unittest
from browser_playlist import from_browser_html

PID = 'RDHMdY9CYBrIU'
EXPECTED = [('HMdY9CYBrIU','BRODYAGA FUNK (PHONK)'),
            ('MTBmJO62zps','AVANGARD (Slowed + Reverb)'),
            ('U1yfpCfGsFE','Avangards'),('yHKXRcZxpG8','FUNK UNIVERSO (Slowed)')]


def row(vid, title, index, pid=PID):
    return f'''<ytd-playlist-panel-video-renderer id="playlist-items">
      <a id="wc-endpoint" href="/watch?v={vid}&amp;list={pid}&amp;index={index}">
        <div><a id="thumbnail" href="/watch?v={vid}&amp;list={pid}&amp;index={index}"><img></a></div>
        <h4><span id="video-title" title="{title}">{title}</span></h4>
      </a></ytd-playlist-panel-video-renderer>'''


HTML = ''.join(row(vid,title,i) for i,(vid,title) in enumerate(EXPECTED,1))


class BrowserPlaylistTests(unittest.TestCase):
    def test_exact_browser_order_and_titles(self):
        result=from_browser_html(HTML)
        self.assertEqual([(x['id'],x['title']) for x in result['entries']],EXPECTED)
        self.assertEqual([x['browser_index'] for x in result['entries']],[1,2,3,4])
        self.assertEqual(result['source'],'browser_copy')
        self.assertEqual(result['id'],PID)
        self.assertTrue(result['loaded_only'])

    def test_ignores_recommendations_even_with_same_list(self):
        outside='<a href="/watch?v=uZCr_SKGIts&amp;list='+PID+'&amp;index=2">Revenge</a>'
        self.assertEqual(from_browser_html(outside+HTML+outside)['count'],4)

    def test_no_plain_url_or_title_search_fallback(self):
        for content in ['', 'https://youtube.com/watch?v=HMdY9CYBrIU&list='+PID, 'BRODYAGA FUNK']:
            with self.assertRaises(ValueError): from_browser_html(content)

    def test_rejects_other_playlist(self):
        with self.assertRaises(ValueError): from_browser_html(HTML,'https://youtube.com/playlist?list=PLdifferent')

    def test_rejects_mixed_playlists(self):
        with self.assertRaises(ValueError): from_browser_html(HTML+row('uZCr_SKGIts','Different',1,'PLdifferent'))

    def test_missing_title_rejected(self):
        with self.assertRaises(ValueError): from_browser_html(row('HMdY9CYBrIU','',1))

    def test_title_entities_and_text(self):
        result=from_browser_html(row('HMdY9CYBrIU','A &amp; B &quot;C&quot;',3))
        self.assertEqual(result['entries'][0]['title'],'A & B "C"')
        self.assertEqual(from_browser_html(HTML.replace('title="Avangards"',''))['entries'][2]['title'],'Avangards')

    def test_scripts_templates_and_external_links_ignored(self):
        extra='<template>'+row('uZCr_SKGIts','Fake',0)+'</template><script>'+row('uZCr_SKGIts','Fake',0)+'</script>'
        self.assertEqual(from_browser_html(extra+HTML)['count'],4)
        with self.assertRaises(ValueError): from_browser_html(HTML.replace('/watch?', 'https://example.com/watch?'))

    def test_keeps_partial_window_numbering(self):
        result=from_browser_html(row('MTBmJO62zps','AVANGARD',12)+row('U1yfpCfGsFE','Avangards',13))
        self.assertEqual([x['browser_index'] for x in result['entries']],[12,13])

    def test_gui_import_uses_copied_html_without_network_lookup(self):
        import os
        os.environ.setdefault('QT_QPA_PLATFORM','offscreen')
        from unittest.mock import MagicMock, patch
        import querybot_gui as gui
        from PySide6.QtCore import QMimeData
        mime=QMimeData(); mime.setHtml(HTML)
        clipboard=MagicMock(); clipboard.mimeData.return_value=mime
        window=MagicMock(); window.convert_worker=None; window.playlist_preview_worker=None
        window.url_input.text.return_value=''
        with patch.object(gui.QApplication,'clipboard',return_value=clipboard), patch.object(gui,'_qb_playlist_ready') as ready, patch.object(gui.backend,'get_playlist_entries',side_effect=AssertionError('must not refetch')):
            gui._qb_import_browser_playlist(window)
        self.assertEqual([(e['id'],e['title']) for e in ready.call_args.args[2]['entries']],EXPECTED)


if __name__=='__main__': unittest.main()
