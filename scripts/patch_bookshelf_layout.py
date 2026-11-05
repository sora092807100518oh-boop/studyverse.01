from pathlib import Path
p=Path('/home/ubuntu/studyverse-site/client/src/index.css')
s=p.read_text()
s=s.replace('.set-item { flex-wrap: wrap; }.set-item-main { flex-basis: calc(100% - 41px); }.set-actions { flex-basis: 100%; }', '.set-item { flex-wrap: wrap; isolation: isolate; }.set-item-main { flex-basis: calc(100% - 41px); position: relative; z-index: 1; }.set-actions { position: relative; z-index: 25; flex-basis: 100%; pointer-events: auto; } .set-actions button { position: relative; z-index: 26; pointer-events: auto; }')
s=s.replace('.set-grid .set-actions { padding-top: 0; }', '.set-grid .set-actions { padding-top: 0; margin-top: auto; }')
p.write_text(s)
