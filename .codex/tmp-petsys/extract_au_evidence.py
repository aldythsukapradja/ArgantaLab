import json
import re
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path
from pypdf import PdfReader
import pdfplumber

ROOT = Path('C:/Users/aldhy/OneDrive/Documents/GitHub/ArgantaLab')
SOURCE_ROOT = ROOT / '.codex/tmp-petsys/sources/extracted'
OUTPUT = ROOT / '.codex/tmp-petsys/au-evidence.json'

HEADINGS = [
    ('description', r'DESCRIPTION'),
    ('source_rocks', r'SOURCE\s+ROCKS?'),
    ('maturation', r'MATURATION|GENERATION\s+AND\s+MIGRATION'),
    ('migration', r'MIGRATION'),
    ('reservoir_rocks', r'RESERVOIR(?:\s+ROCKS?)?(?:\s*\([^\n:]+\))?|RESERVOIRS?'),
    ('traps_seals', r'TRAPS?\s+(?:AND|&)\s+SEALS?|TRAPS?/SEALS?'),
]
HEADING_RE = re.compile(r'(?im)^\s*(' + '|'.join(p for _, p in HEADINGS) + r')\s*:\s*')
AGE_RE = re.compile(
    r'\b(?:(?:early|middle|late|lower|upper|earliest|latest)\s+)?'
    r'(?:Cambrian|Ordovician|Silurian|Devonian|Carboniferous|Mississippian|Pennsylvanian|Permian|'
    r'Triassic|Jurassic|Cretaceous|Paleocene|Eocene|Oligocene|Miocene|Pliocene|Pleistocene|'
    r'Quaternary|Tertiary|Paleozoic|Mesozoic|Cenozoic)\b', re.I)
UNIT_RE = re.compile(
    r'\b(?:[A-Z][A-Za-z\'’-]+(?:\s+|/)){0,4}'
    r'(?:Formation|Group|Member|Shale|Shales|Sandstone|Limestone|Dolomite|Marl|Mudstone|Carbonate|Coal)\b')

def clean(value):
    value = value.replace('\u00ad', '').replace('\x00', ' ')
    return re.sub(r'\s+', ' ', value).strip()

def section_map(text):
    matches = list(HEADING_RE.finditer(text))
    result = {key: '' for key, _ in HEADINGS}
    for i, match in enumerate(matches):
        heading = match.group(1).upper()
        key = next((k for k, p in HEADINGS if re.fullmatch(p, heading, re.I)), None)
        if not key or result[key]:
            continue
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        value = text[match.end():end]
        value = re.split(r'(?im)^\s*REFERENCES?\s*:', value)[0]
        result[key] = clean(value)[:7000]
    return result

def unique_matches(pattern, text, limit=30):
    found = []
    for match in pattern.finditer(text or ''):
        value = clean(match.group(0))
        if value.lower() not in {v.lower() for v in found}:
            found.append(value)
    return found[:limit]

def extract_one(path_string):
    path = Path(path_string)
    try:
        try:
            reader = PdfReader(str(path))
            text = '\n'.join((page.extract_text() or '') for page in reader.pages[:3])
        except Exception:
            # Some official DDS-60 files have a damaged startxref but remain readable.
            with pdfplumber.open(path) as pdf:
                text = '\n'.join((page.extract_text() or '') for page in pdf.pages[:3])
        sections = section_map(text)
        au_match = re.search(r'ASSESSMENT\s+UNITS?\s*:\s*(.*?)\s*\((\d{8})\)', text, re.I | re.S)
        if not au_match:
            au_match = re.search(r'Assessment\s+Unit:\s*(.*?)\s*Number:\s*(\d{8})', text, re.I | re.S)
        tps_match = re.search(r'TOTAL\s+PETROLEUM\s+SYSTEMS?\s*:\s*(.*?)\s*(?:\((\d{6})\)|Number:\s*(\d{6}))', text, re.I | re.S)
        province_match = re.search(r'USGS\s+PROVINCE\s*:\s*(.*?)\s*\((\d{4})\)', text, re.I | re.S)
        geologist_match = re.search(r'GEOLOGIST\s*:\s*([^\n]+)', text, re.I)
        au_code = au_match.group(2) if au_match else None
        if not au_code:
            filename_match = re.fullmatch(r'au(\d{4})(\d)(\d)\.pdf', path.name, re.I)
            if filename_match:
                au_code = f'{filename_match.group(1)}0{filename_match.group(2)}0{filename_match.group(3)}'
        tps_code = (tps_match.group(2) or tps_match.group(3)) if tps_match else (au_code[:6] if au_code else None)
        region_match = re.search(r'reg(\d+)', str(path), re.I)
        rel = path.relative_to(SOURCE_ROOT).as_posix()
        all_evidence = ' '.join(sections.values())
        if not sections['migration'] and sections['maturation'] and re.search(r'GENERATION\s+AND\s+MIGRATION', text, re.I):
            sections['migration'] = sections['maturation']
        return {
            'au_code': au_code,
            'au_name_reported': clean(au_match.group(1)) if au_match else None,
            'tps_code': tps_code,
            'tps_name_reported': clean(tps_match.group(1)) if tps_match else None,
            'province_code': province_match.group(2) if province_match else (au_code[:4] if au_code else None),
            'province_name_reported': clean(province_match.group(1)) if province_match else None,
            'assessment_geologist': clean(geologist_match.group(1)) if geologist_match else None,
            'description': sections['description'],
            'source_rocks': sections['source_rocks'],
            'maturation': sections['maturation'],
            'migration': sections['migration'],
            'reservoir_rocks': sections['reservoir_rocks'],
            'traps_seals': sections['traps_seals'],
            'source_age_terms': unique_matches(AGE_RE, sections['source_rocks']),
            'maturation_age_terms': unique_matches(AGE_RE, sections['maturation']),
            'reservoir_age_terms': unique_matches(AGE_RE, sections['reservoir_rocks']),
            'source_unit_candidates': unique_matches(UNIT_RE, sections['source_rocks']),
            'reservoir_unit_candidates': unique_matches(UNIT_RE, sections['reservoir_rocks']),
            'seal_unit_candidates': unique_matches(UNIT_RE, sections['traps_seals']),
            'evidence_chars': len(all_evidence),
            'archive_region': int(region_match.group(1)) if region_match else None,
            'source_archive_url': f'https://pubs.usgs.gov/dds/dds-060/regions/reg{region_match.group(1)}.zip' if region_match else None,
            'source_member_path': rel,
            'extraction_status': 'parsed' if au_code and sections['source_rocks'] and sections['reservoir_rocks'] else 'partial',
        }
    except Exception as exc:
        return {'source_member_path': path.relative_to(SOURCE_ROOT).as_posix(), 'extraction_status': 'error', 'error': str(exc)}

if __name__ == '__main__':
    paths = [str(path) for path in sorted(SOURCE_ROOT.rglob('au*.pdf'))]
    with ProcessPoolExecutor(max_workers=8) as pool:
        records = list(pool.map(extract_one, paths, chunksize=4))
    OUTPUT.write_text(json.dumps(records, indent=2, ensure_ascii=False), encoding='utf-8')
    summary = {
        'files': len(records),
        'parsed': sum(r.get('extraction_status') == 'parsed' for r in records),
        'partial': sum(r.get('extraction_status') == 'partial' for r in records),
        'errors': sum(r.get('extraction_status') == 'error' for r in records),
        'unique_aus': len({r.get('au_code') for r in records if r.get('au_code')}),
        'unique_tps': len({r.get('tps_code') for r in records if r.get('tps_code')}),
        'with_source_units': sum(bool(r.get('source_unit_candidates')) for r in records),
        'with_reservoir_units': sum(bool(r.get('reservoir_unit_candidates')) for r in records),
    }
    print(json.dumps(summary, indent=2))
