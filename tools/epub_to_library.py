#!/usr/bin/env python3
"""Extract readable non-DRM EPUB chapters to a same-site, citation-trackable JSON library.

No internet, third-party packages, OCR, guessed missing characters, or automatic
simplified-to-traditional rewriting. Only run on texts you have permission to
publish. EPUB reflow does not provide verifiable printed page numbers.
"""
from __future__ import annotations
import argparse
import json
import posixpath
import re
import sys
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import unquote

CONTAINER_NS = {'c': 'urn:oasis:names:tc:opendocument:xmlns:container'}
OPF_NS = {'o': 'http://www.idpf.org/2007/opf', 'd': 'http://purl.org/dc/elements/1.1/'}
BLOCKS = {'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'blockquote', 'li', 'pre'}
SKIP = {'script', 'style', 'nav', 'svg'}

def local(tag):
    return tag.rsplit('}', 1)[-1].lower()

def clean(t):
    # Keep ideographs, punctuation and original variant characters unchanged.
    return re.sub(r'[\t\r\n ]+', ' ', t).strip()

def parse_xml_blocks(data):
    root = ET.fromstring(data)
    out = []
    def walk(node, inside_block=False, skip=False):
        tag = local(node.tag)
        if skip or tag in SKIP:
            return
        if tag in BLOCKS and not inside_block:
            txt = clean(''.join(node.itertext()))
            if txt: out.append({'kind':tag, 'text':txt})
            return
        for child in node:
            walk(child, inside_block or tag in BLOCKS, False)
    walk(root)
    if not out:
        body = next((el for el in root.iter() if local(el.tag)=='body'), root)
        txt=clean(''.join(body.itertext()))
        if txt:out=[{'kind':'p','text':txt}]
    return out

class LooseHTML(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.stack=[];self.chunks=[];self.blocks=[]
    def handle_starttag(self,tag,attrs):
        self.stack.append(tag)
        if tag in BLOCKS:self.chunks.append([tag,[]])
    def handle_data(self,data):
        if self.chunks:self.chunks[-1][1].append(data)
    def handle_endtag(self,tag):
        if self.chunks and self.chunks[-1][0]==tag:
            kind,parts=self.chunks.pop()
            txt=clean(''.join(parts))
            if txt:self.blocks.append({'kind':kind,'text':txt})
        if tag in self.stack:
            for i in range(len(self.stack)-1,-1,-1):
                if self.stack[i]==tag:self.stack=self.stack[:i];break

def extract_blocks(data):
    try:return parse_xml_blocks(data)
    except ET.ParseError:
        parser=LooseHTML();parser.feed(data.decode('utf-8','replace'))
        return parser.blocks

def title_from(blocks, fallback):
    for b in blocks[:8]:
        if b['kind'].startswith('h') and len(b['text']) <= 150:
            return b['text']
    return fallback

def main():
    ap=argparse.ArgumentParser(description='Convert an EPUB to a local JSON library; for non-DRM EPUB with public-distribution rights.')
    ap.add_argument('epub',type=Path)
    ap.add_argument('--id',required=True,help='ASCII book ID, e.g., shiji')
    ap.add_argument('--title',help='Displayed title, e.g., 《史記》')
    ap.add_argument('--edition',default='版本未指定；正式引用前須查核',help='Editor, publisher, or source edition metadata')
    ap.add_argument('--out',type=Path,default=Path('library'),help='Output library directory, default ./library')
    args=ap.parse_args()
    if not re.fullmatch('[a-z][a-z0-9_-]{0,63}',args.id):ap.error('--id must be lowercase ASCII letters, numbers, hyphens or underscores')
    if not args.epub.is_file():ap.error('EPUB not found')
    with zipfile.ZipFile(args.epub) as z:
        bad=z.testzip()
        if bad:raise ValueError(f'Corrupt ZIP member: {bad}')
        if any(n.startswith('META-INF/encryption.xml') for n in z.namelist()):
            raise ValueError('EPUB contains encryption metadata; DRM/encrypted EPUB is unsupported')
        container=ET.fromstring(z.read('META-INF/container.xml'))
        rootfile=container.find('.//c:rootfile',CONTAINER_NS)
        if rootfile is None:raise ValueError('Cannot find EPUB OPF rootfile')
        opf_path=rootfile.attrib['full-path']
        opf=ET.fromstring(z.read(opf_path))
        title_elem=opf.find('.//d:title',OPF_NS)
        title=args.title or (title_elem.text.strip() if title_elem is not None and title_elem.text else args.epub.stem)
        manifest={it.attrib['id']:it.attrib for it in opf.findall('.//o:manifest/o:item',OPF_NS)}
        spine=opf.findall('.//o:spine/o:itemref',OPF_NS)
        chapters=[]
        for order,itemref in enumerate(spine,1):
            item=manifest.get(itemref.attrib.get('idref'))
            if not item or item.get('media-type') not in ('application/xhtml+xml','text/html'):
                continue
            if 'nav' in item.get('properties','').split():continue
            path=posixpath.normpath(posixpath.join(posixpath.dirname(opf_path),unquote(item['href'].split('#')[0])))
            if path.startswith('../') or path not in z.namelist():
                print('WARNING skipped missing or unsafe path: '+path,file=sys.stderr);continue
            blocks=extract_blocks(z.read(path))
            if not blocks:continue
            chapters.append({'id':f'{args.id}-{order:04d}','title':title_from(blocks,posixpath.basename(path)),
                             'source_path':path,'spine_index':order,'paragraphs':blocks})
    if not chapters:raise ValueError('No readable EPUB chapters; inspect source. No text was inferred.')
    args.out.mkdir(parents=True,exist_ok=True)
    books_dir=args.out/'books';books_dir.mkdir(exist_ok=True)
    book_path=books_dir/f'{args.id}.json'
    data={'id':args.id,'title':title,'edition':args.edition,'epub_filename':args.epub.name,
          'chapters':chapters}
    book_path.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    catalog_path=args.out/'catalog.json'
    catalog=json.loads(catalog_path.read_text(encoding='utf-8')) if catalog_path.exists() else {'version':1,'books':[]}
    record={'id':args.id,'title':title,'file':f'./library/books/{args.id}.json','edition':args.edition}
    catalog['books']=[x for x in catalog.get('books',[]) if x.get('id')!=args.id]+[record]
    catalog_path.write_text(json.dumps(catalog,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(f'Created {book_path} ({len(chapters)} chapters; '+str(sum(len(c['paragraphs']) for c in chapters))+' blocks)')
    print('Updated '+str(catalog_path))
    print('Review the content and ensure you may republish it before uploading the library to a PUBLIC GitHub repo.')
if __name__=='__main__':main()
