#!/usr/bin/env python3
"""Generate the no-JavaScript snapshot from the same JSON used by the 3D gallery."""
import html
import json
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]


def escape(value):
    return html.escape(str(value), quote=True)


def load(name):
    return json.loads((ROOT / 'content' / f'{name}.json').read_text())


def tags(values):
    return '<div class="tag-row">' + ''.join(f'<span>{escape(v)}</span>' for v in values) + '</div>'


def entries(data):
    if not data.get('items'):
        return f'<p class="empty">{escape(data.get("emptyMessage", "待补充"))}</p>'
    result = ''
    ids = set()
    for item in data['items']:
        assert item.get('id') and item['id'] not in ids, 'Each entry needs a unique id'
        ids.add(item['id'])
        result += '<article>'
        if item.get('status'):
            result += f'<span class="item-status">{escape(item["status"])}</span>'
        result += f'<h3>{escape(item.get("title") or "标题待补充")}</h3>'
        result += f'<p>{escape(item.get("summary") or "摘要待补充")}</p>'
        if item.get('body') and item['body'] != item.get('summary'):
            result += f'<p>{escape(item["body"])}</p>'
        result += tags(item.get('tags', []))
        url = item.get('url', '')
        if urlparse(url).scheme in ('https', 'http'):
            result += f'<a class="content-link" href="{escape(url)}" target="_blank" rel="noopener noreferrer">查看条目 ↗</a>'
        result += '</article>'
    return result


def build():
    p = load('profile')
    result = '<section data-section="about">'
    result += f'<h2>{escape(p["name"])}</h2><p>{escape(p["intro"])}</p><p>长期目标</p>'
    result += tags(p['focus']) + f'<p>{escape(p["focusEn"])}</p><h3>正在积累的工具</h3>'
    result += tags(p['skills']) + f'<p>工作之外 · {escape(p["interest"])}</p></section>'
    result += '<section data-section="work"><h2>现在在做的事</h2>' + entries(load('projects')) + '</section>'
    result += '<section data-section="notes"><h2>学习笔记</h2>' + entries(load('notes'))
    result += '<h3>论文与阅读</h3>' + entries(load('papers')) + '</section>'
    result += '<section data-section="contact"><h2>保持联系</h2><p>从这里，继续交流。</p>'
    for c in p['contacts']:
        assert urlparse(c['url']).scheme in ('https', 'http')
        result += f'<a class="content-link" href="{escape(c["url"])}" target="_blank" rel="noopener noreferrer"><small>{escape(c["label"])}</small><span>{escape(c["text"])} ↗</span></a>'
    result += '</section>'
    path = ROOT / 'index.html'
    current = path.read_text()
    start, end = '<!-- GENERATED_CONTENT_START -->', '<!-- GENERATED_CONTENT_END -->'
    before, rest = current.split(start)
    _, after = rest.split(end)
    path.write_text(before + start + '\n' + result + '\n        ' + end + after)
    print('Generated readable HTML from content/*.json')


if __name__ == '__main__':
    build()
