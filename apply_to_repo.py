#!/usr/bin/env python3
"""Non-destructive installer for v22 admin bank classification UI.
Run at repository root with: python apply_to_repo.py
"""
from pathlib import Path
import shutil
import sys

repo = Path.cwd()
home = Path(__file__).resolve().parent
index = repo / 'index.html'
script = repo / 'challenge-v22-bank-taxonomy-and-highlight.js'
source = home / script.name

if not index.is_file():
    raise SystemExit('找不到 index.html：請將安裝程式放在 GitHub 專案根目錄執行。')
if not source.is_file():
    raise SystemExit('找不到 challenge-v22-bank-taxonomy-and-highlight.js。')
html = index.read_text('utf-8')
reference = '<script src="./challenge-v19-bank-stats.js"></script>'
new_script = '<script src="./challenge-v22-bank-taxonomy-and-highlight.js"></script>'
if reference not in html:
    raise SystemExit('未找到第 19 版題庫統計腳本；未更動任何檔案。請先確認網站版本。')
if 'quiz-challenge-v7.js' not in html:
    raise SystemExit('未找到會員登入腳本；未更動任何檔案。')
if new_script in html:
    print('首頁已包含 v22 新版腳本，檢查檔案即可。')
else:
    html = html.replace(reference,reference+'\n'+new_script)
    backup = repo / 'index.html.pre_v22.bak'
    if not backup.exists(): shutil.copyfile(index,backup)
    index.write_text(html,'utf-8')
    print('已更新 index.html，原始檔備份為 index.html.pre_v22.bak')
if source.resolve() != script.resolve():
    shutil.copyfile(source,script)
print('已安裝',script.name)
print('請 git add index.html',script.name)
print('再 git commit 與 git push 推送至 GitHub Pages。')
