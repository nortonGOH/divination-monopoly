#!/usr/bin/env python3
"""Reject known answer-bearing assets in this PUBLIC repository.
History cleanup requires a separate, coordinated procedure.
"""
import json
import re
import subprocess
import sys
from pathlib import Path
from unittest import TestCase, main as unittest_main

BLOCKED_EXACT = {
    'seed.sql', 'qa-source-60.json', 'questions.json',
    'new-choice-70.json', 'mountain-180.json', 'calendar-questions-80.json',
    'mountain-初階-60.json', 'mountain-中階-60.json', 'mountain-高階-60.json',
}
JSON_EXEMPT = {'package.json', 'package-lock.json', 'library/catalog.json'}
QUESTION_KEYS = {'prompt', 'options', 'answer'}

def banned_path(path):
    name = path.replace('\\', '/')
    return (name in BLOCKED_EXACT or name.startswith('quiz-imports/')
            or re.fullmatch(r'mountain-[^/]+\.json', name) is not None
            or re.fullmatch(r'calendar-questions-[^/]+\.json', name) is not None)

def contains_answer_bank(data):
    if isinstance(data, list):
        return any(contains_answer_bank(item) for item in data)
    if isinstance(data, dict):
        keys = set(data)
        if 'reference_answer' in keys or QUESTION_KEYS.issubset(keys):
            return True
        return any(contains_answer_bank(value) for value in data.values())
    return False

def check_contents(path, source):
    issues = []
    if path.endswith('.json') and path not in JSON_EXEMPT:
        try:
            if contains_answer_bank(json.loads(source)):
                issues.append('JSON contains a quiz answer bank')
        except json.JSONDecodeError:
            issues.append('Invalid JSON: cannot verify it is safe')
    if path == 'index.html':
        if not re.search(r'\bconst\s+FALLBACK_QUESTIONS\s*=\s*\[\s*\]\s*;', source):
            issues.append('Public fallback must remain an empty array')
    if path == 'setup.sql':
        if 'RETIRED SECURITY-SENSITIVE BOOTSTRAP SCRIPT' not in source:
            issues.append('Legacy SQL bootstrap must stay retired')
    return issues

class SelfTest(TestCase):
    def test_paths(self):
        for path in ['qa-source-60.json', 'quiz-imports/new.json',
                     'mountain-初階-60.json', 'seed.sql', 'questions.json']:
            self.assertTrue(banned_path(path), path)
        for path in ['library/catalog.json', 'package.json', 'setup.sql']:
            self.assertFalse(banned_path(path), path)

    def test_answer_keys(self):
        self.assertTrue(contains_answer_bank({'questions': [
            {'prompt': 'synthetic fixture', 'options': ['A','B'], 'answer': 0}]}))
        self.assertTrue(contains_answer_bank([{'reference_answer': 'synthetic fixture'}]))
        self.assertFalse(contains_answer_bank({'books': [{'title': 'safe catalog'}]}))

    def test_fallback(self):
        self.assertFalse(check_contents('index.html', 'const FALLBACK_QUESTIONS=[];'))
        self.assertTrue(check_contents('index.html', 'const FALLBACK_QUESTIONS=[{answer:0}];'))

def scan():
    files = subprocess.check_output(['git', 'ls-files', '-z']).decode().split('\0')
    failures = []
    for path in filter(None, files):
        if banned_path(path):
            failures.append((path, 'Known public answer artifact path'))
            continue
        if path.endswith('.json') or path in ('index.html', 'setup.sql'):
            try:
                contents = Path(path).read_text(encoding='utf-8')
            except (OSError, UnicodeError) as exc:
                failures.append((path, f'Cannot verify file: {exc}'))
                continue
            failures.extend((path, issue) for issue in check_contents(path, contents))
    if failures:
        for path, reason in failures:
            print(f'FAIL {path}: {reason}', file=sys.stderr)
        return 1
    print('PASS: no known answer-bearing public artifacts among tracked files')
    return 0

if __name__ == '__main__':
    if '--self-test' in sys.argv:
        sys.argv = [sys.argv[0]]
        unittest_main()
    else:
        raise SystemExit(scan())
