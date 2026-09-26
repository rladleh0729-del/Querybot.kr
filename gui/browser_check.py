"""Offline packaged WebEngine smoke check: renderer, DOM capture and parser."""
from PySide6.QtCore import QTimer, QUrl
from youtube_browser import YouTubeBrowserDialog


def check_browser(app):
    dialog = YouTubeBrowserDialog(persistent=False)
    url = 'https://www.youtube.com/watch?v=HMdY9CYBrIU&list=RDHMdY9CYBrIU'
    def row(vid, title, attrs=''):
        return (f'<ytd-playlist-panel-video-renderer {attrs}>'
                f'<a href="/watch?v={vid}&amp;list=RDHMdY9CYBrIU">'
                f'<span id="video-title" title="{title}">{title}</span></a>'
                '</ytd-playlist-panel-video-renderer>')
    html = ('<style>ytd-playlist-panel-renderer,ytd-playlist-panel-video-renderer{display:block}'
            '[hidden]{display:none!important}</style><ytd-playlist-panel-renderer>'
            + row('HMdY9CYBrIU', 'First') + row('MTBmJO62zps', 'Second')
            + row('yHKXRcZxpG8', 'Hidden', 'hidden') + '</ytd-playlist-panel-renderer>'
            + row('U1yfpCfGsFE', 'Recommendation outside playlist'))
    def loaded(ok):
        if ok:
            dialog.capture()
        else:
            app.exit(2)
    def finished(result):
        entries = (dialog.snapshot or {}).get('entries', [])
        matched = [(e['id'], e['title']) for e in entries] == [
            ('HMdY9CYBrIU', 'First'), ('MTBmJO62zps', 'Second')]
        app.exit(0 if result and matched else 3)
    app.setQuitOnLastWindowClosed(False)
    dialog.finished.connect(finished)
    dialog.view.loadFinished.connect(loaded)
    dialog.show()
    dialog.view.setHtml(html, QUrl(url))
    deadline = QTimer()
    deadline.setSingleShot(True)
    deadline.timeout.connect(lambda: app.exit(4))
    deadline.start(30000)
    result = app.exec()
    deadline.stop()
    from shiboken6 import delete
    delete(dialog)
    return result
