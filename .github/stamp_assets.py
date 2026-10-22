"""Add ?v=<commit> to every asset URL in the built site, so a browser never mixes
cached files from an old deploy with new ones. Run by the deploy workflow on the
copy in _site/; the repo's own files stay untouched.

Usage: python3 .github/stamp_assets.py <site_dir> <version>
"""
import re
import sys
from pathlib import Path

site, version = Path(sys.argv[1]), sys.argv[2]
tag = f"?v={version}"

# (file pattern, regex for the URL up to its closing quote, how many matches at least)
RULES = [
    ("viewer/index.html", r'(href="style\.css)"', 1),
    ("viewer/index.html", r'(src="app\.js)"', 1),
    ("viewer/*.js", r'(from "\./[\w-]+\.js)"', 1),
    ("viewer/*.js", r'(new Worker\("worker\.js)"', 1),
    ("viewer/worker.js", r"(fetch\(`\.\./\$\{path\})`", 1),  # the Python files
]

for pattern, regex, at_least in RULES:
    found = 0
    for path in site.glob(pattern):
        text = path.read_text(encoding="utf-8")
        text, count = re.subn(regex, lambda m: m.group(1) + tag + m.group(0)[-1], text)
        path.write_text(text, encoding="utf-8")
        found += count
    if found < at_least:
        # A renamed file or changed import style would silently bring the cache mix-ups back.
        sys.exit(f"stamp_assets: no match for {regex!r} in {pattern}")
    print(f"stamped {found:2d} x {regex}")
