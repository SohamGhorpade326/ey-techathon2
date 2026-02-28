import os
import json
from translator import translate_text

# Resolve frontend `RFPPilot` folder (try sibling paths since backend may be RFPPilot2)
curr_dir = os.path.dirname(__file__)
parent_dir = os.path.abspath(os.path.join(curr_dir, '..'))
candidates = [
    os.path.join(parent_dir, 'RFPilot'),
    os.path.join(parent_dir, '..', 'RFPilot'),
    os.path.join(parent_dir, '..', '..', 'RFPilot'),
    # also try common alternate name
    os.path.join(parent_dir, 'RFPPilot'),
    os.path.join(parent_dir, '..', 'RFPPilot'),
]
BASE_FRONTEND = None
for c in candidates:
    if os.path.isdir(c):
        manifest_candidate = os.path.join(c, 'locales_manifest.json')
        if os.path.isfile(manifest_candidate):
            BASE_FRONTEND = c
            break
        # keep first existing dir as fallback
        if BASE_FRONTEND is None:
            BASE_FRONTEND = c
            # don't break; prefer a dir that contains manifest
            continue

if BASE_FRONTEND is None:
    raise FileNotFoundError(f"Could not locate RFPPilot frontend folder. Checked: {candidates}")

PUBLIC_LOCALES = os.path.join(BASE_FRONTEND, 'public', 'locales')
MANIFEST_PATH = os.path.join(BASE_FRONTEND, 'locales_manifest.json')

os.makedirs(PUBLIC_LOCALES, exist_ok=True)

with open(MANIFEST_PATH, 'r', encoding='utf-8') as f:
    manifest = json.load(f)

langs = {
    'hi': 'hi',
    'mr': 'mr'
}

for lang_code in langs:
    out = {}
    keys = list(manifest.keys())
    texts = [manifest[k] for k in keys]
    print(f"Translating {len(keys)} keys to {lang_code}...")
    try:
        # translator.translate_text supports single text; translate in loop to be safe
        for k, txt in zip(keys, texts):
            try:
                tr = translate_text(txt, target_lang=lang_code)
            except Exception as e:
                print(f"Translate failed for key {k}: {e}")
                tr = txt
            out[k] = tr
    except Exception as e:
        print("Batch translate failed:", e)

    out_path = os.path.join(PUBLIC_LOCALES, f"{lang_code}.json")
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
    print(f"Wrote {out_path}")

print("Locale generation complete.")
