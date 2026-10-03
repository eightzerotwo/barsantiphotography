#!/usr/bin/env python3
"""Fill captions.txt in each photo folder from file names and known projects.

Rules: a name containing a known token gets that credit; a copy of a file in a
subfolder (same byte size) gets the same credit as the root file; lines already
filled by hand are kept. Run after renaming or adding photos, before `npm run build`.
"""
import os, re, json, sys
ROOT = json.load(open(os.path.join(os.path.dirname(__file__), '..', 'src', 'site.json')))['photos']
HEADER = ("# One line per photo:  filename | Project | Architect · Builder · Designer | Town, ST\n"
          "# Later fields are optional. Lines starting with # are ignored. Same project = same three fields on every frame.\n")
# token (case-insensitive, matched in file name) -> (project, makers, town)
RULES = [
    ('100 hood',          ('100 Hood Park Drive', 'SMMA · Lee Kennedy Co.', 'Charlestown, MA')),
    ('john cole',         ('', 'John Cole, architect', 'New Hampshire')),
    ('josiah quincy',     ('Josiah Quincy Upper School', 'HMFH Architects · Turner Construction', 'Boston, MA')),
    ('maryann',           ('', 'Maryann Thompson Architects', 'Cambridge, MA')),
    ('pathways',          ('Pathways Respite House', '', 'Vermont')),
    ('slough farm',       ('Slough Farm', 'Maryann Thompson Architects', 'Edgartown, MA')),
    ('south mountain',    ('', 'South Mountain Company', "Martha's Vineyard, MA")),
    ('pauls school',      ("St. Paul's School", 'Annum Architects', 'Concord, NH')),
    ('mv-',               ('', '', "Martha's Vineyard, MA")),
]
PHOTO = re.compile(r'\.(jpe?g|png|tiff?)$', re.I)

def read_sheet(d):
    p = os.path.join(d, 'captions.txt'); out = {}
    if os.path.exists(p):
        for l in open(p):
            l = l.strip()
            if not l or l.startswith('#'): continue
            parts = [x.strip() for x in l.split('|')]
            if len(parts) >= 2 and any(parts[1:]): out[parts[0]] = tuple((parts[1:] + ['', '', ''])[:3])
    return out

def by_rule(name):
    n = name.lower()
    for tok, v in RULES:
        if tok in n: return v
    return None

folders = [ROOT] + [os.path.join(ROOT, d) for d in sorted(os.listdir(ROOT)) if os.path.isdir(os.path.join(ROOT, d)) and not d.startswith('.')]
by_size = {}
for d in folders:  # first pass: everything we can learn, keyed by file size
    kept = read_sheet(d)
    for f in os.listdir(d):
        if not PHOTO.search(f): continue
        v = kept.get(f) or by_rule(f)
        if v: by_size.setdefault(os.path.getsize(os.path.join(d, f)), v)
for d in folders:  # second pass: write sheets
    kept = read_sheet(d); lines = []
    for f in sorted([f for f in os.listdir(d) if PHOTO.search(f)], key=str.lower):
        v = kept.get(f) or by_rule(f) or by_size.get(os.path.getsize(os.path.join(d, f)))
        lines.append(f"{f} | {v[0]} | {v[1]} | {v[2]}" if v else f"{f} |  |  | ")
    open(os.path.join(d, 'captions.txt'), 'w').write(HEADER + '\n'.join(lines) + '\n')
    print(f"{os.path.basename(d) or 'root'}: {sum(1 for l in lines if l.split('|')[1].strip() or l.split('|')[2].strip() or l.split('|')[3].strip())}/{len(lines)} credited")
    for l in lines: print('   ' + l)
