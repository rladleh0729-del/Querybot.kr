"""Read an explicitly copied YouTube playlist without querying YouTube again.

Only playlist row elements are accepted. Recommendations, scripts and arbitrary
page links are never interpreted as playlist membership. No browser cookies or
browser profile access is required.
"""
from html.parser import HTMLParser
import re
from urllib.parse import parse_qs, urljoin, urlparse

ROW_TAGS = {'ytd-playlist-panel-video-renderer', 'ytd-playlist-video-renderer'}
HOSTS = {'www.youtube.com', 'youtube.com', 'm.youtube.com', 'music.youtube.com'}


def playlist_id(url):
    parsed = urlparse(str(url or ''))
    if parsed.hostname not in HOSTS or parsed.scheme not in {'https', 'http'}:
        return ''
    return parse_qs(parsed.query).get('list', [''])[0]


class _PlaylistHTML(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.rows = []
        self.row = None
        self.row_tag = ''
        self.title_tag = ''
        self.ignored = 0

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag in {'script', 'style', 'template'}:
            self.ignored += 1
        if self.ignored:
            return
        if tag in ROW_TAGS:
            self.row_tag = tag
            self.row = {'href': '', 'title': '', 'title_text': [], 'hidden': 'hidden' in attrs}
        if self.row is None:
            return
        if tag == 'a' and not self.row['href']:
            href = attrs.get('href', '')
            absolute = urljoin('https://www.youtube.com', href)
            parsed = urlparse(absolute)
            query = parse_qs(parsed.query)
            if parsed.hostname in HOSTS and parsed.path == '/watch' and query.get('v') and query.get('list'):
                self.row['href'] = absolute
        if attrs.get('id') == 'video-title':
            self.row['title'] = attrs.get('title', '')
            self.title_tag = tag

    def handle_data(self, text):
        if self.row is not None and self.title_tag and not self.ignored:
            self.row['title_text'].append(text)

    def handle_endtag(self, tag):
        if tag in {'script', 'style', 'template'} and self.ignored:
            self.ignored -= 1
            return
        if self.ignored:
            return
        if tag == self.title_tag:
            self.title_tag = ''
        if tag == self.row_tag and self.row is not None:
            self.rows.append(self.row)
            self.row = None
            self.row_tag = self.title_tag = ''


def from_browser_html(html, expected_url=''):
    if not isinstance(html, str) or not html.strip():
        raise ValueError('페이지 내용이 복사되지 않았습니다. YouTube 페이지의 빈 곳을 누른 뒤 Ctrl+A, Ctrl+C를 눌러주세요. 주소만 복사하면 화면 목록을 가져올 수 없습니다.')
    if len(html) > 16 * 1024 * 1024:
        raise ValueError('복사한 페이지가 너무 큽니다. 재생목록 영역만 선택해 다시 복사해주세요.')
    parser = _PlaylistHTML()
    parser.feed(html)
    parser.close()
    entries = []
    lists = set()
    seen = set()
    source_url = ''
    for row in parser.rows:
        if row['hidden'] or not row['href']:
            continue
        query = parse_qs(urlparse(row['href']).query)
        vid = query.get('v', [''])[0]
        pid = query.get('list', [''])[0]
        if not re.fullmatch(r'[A-Za-z0-9_-]{11}', vid):
            continue
        lists.add(pid)
        if vid in seen:
            continue
        seen.add(vid)
        title = ' '.join((row['title'] or ''.join(row['title_text'])).split())
        if not title:
            raise ValueError('제목이 빠진 곡이 있습니다. 페이지 내용 전체를 다시 복사해주세요.')
        index = query.get('index', [''])[0]
        entries.append({'id': vid, 'title': title, 'url': f'https://www.youtube.com/watch?v={vid}',
                        'browser_index': int(index) if index.isdigit() else len(entries) + 1})
        if not source_url:
            source_url = row['href']
    if not entries:
        raise ValueError('복사한 내용에서 재생목록을 찾지 못했습니다. YouTube에서 목록을 펼친 뒤 페이지의 빈 곳을 누르고 Ctrl+A, Ctrl+C로 다시 복사해주세요.')
    if len(lists) != 1:
        raise ValueError('복사한 내용에 서로 다른 재생목록이 있습니다. 원하는 목록만 복사해주세요.')
    pid = next(iter(lists))
    expected = playlist_id(expected_url)
    if expected and expected != pid:
        raise ValueError('입력한 주소와 복사한 페이지의 재생목록이 다릅니다. 주소를 지우거나 같은 목록을 다시 복사해주세요.')
    return {'title': '브라우저에서 복사한 재생목록', 'id': pid, 'entries': entries,
            'count': len(entries), 'source_url': source_url, 'source': 'browser_copy',
            'is_mix': pid.startswith('RD'), 'loaded_only': True}
