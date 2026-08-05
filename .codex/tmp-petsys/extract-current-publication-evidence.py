import json
import re
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path
from pypdf import PdfReader
import pdfplumber

ROOT = Path(r'C:/Users/aldhy/OneDrive/Documents/GitHub/ArgantaLab')
MANIFEST = ROOT / '.codex/tmp-petsys/current-publication-downloads.json'
OUTPUT = ROOT / '.codex/tmp-petsys/current-publication-evidence.json'

AGE_RE = re.compile(
    r'\b(?:(?:early|middle|late|lower|upper|earliest|latest)\s+)?'
    r'(?:Cambrian|Ordovician|Silurian|Devonian|Carboniferous|Mississippian|Pennsylvanian|Permian|'
    r'Triassic|Jurassic|Cretaceous|Paleocene|Eocene|Oligocene|Miocene|Pliocene|Pleistocene|'
    r'Quaternary|Tertiary|Paleozoic|Mesozoic|Cenozoic)\b', re.I)
UNIT_RE = re.compile(
    r'\b(?:[A-Z][A-Za-z\'’-]+(?:\s+|/)){0,5}'
    r'(?:Formation|Group|Member|Shale|Shales|Sandstone|Limestone|Dolomite|Marl|Mudstone|Carbonate|Coal)\b')
TPS_RE = re.compile(r'([A-Z][A-Za-z0-9\-–/() ]{2,80}?(?:Total Petroleum System|TPS))\s*(?:\((\d{6})\))?', re.I)
AU_RE = re.compile(r'([A-Z][A-Za-z0-9\-–/() ]{2,100}?(?:Assessment Unit|AU))\s*(?:\((\d{8})\))?', re.I)

def clean(value):
    return re.sub(r'\s+', ' ', (value or '').replace('\u00ad', '')).strip()

def unique(values, limit=50):
    found = []
    seen = set()
    for value in values:
        value = clean(value)
        key = value.lower()
        if value and key not in seen:
            seen.add(key)
            found.append(value)
    return found[:limit]

def evidence_sentences(text, patterns, max_sentences=8, max_chars=7000):
    sentences = re.split(r'(?<=[.!?])\s+(?=[A-Z])', clean(text))
    selected = []
    for sentence in sentences:
        if 35 <= len(sentence) <= 1600 and any(re.search(pattern, sentence, re.I) for pattern in patterns):
            selected.append(sentence)
        if len(selected) >= max_sentences or sum(map(len, selected)) >= max_chars:
            break
    return ' '.join(unique(selected, max_sentences))[:max_chars]

def extract_pdf(task):
    publication, file_record = task
    pdf_path = ROOT / file_record['local_path']
    try:
        try:
            reader = PdfReader(str(pdf_path), strict=False)
            page_count = len(reader.pages)
            texts = [(page.extract_text() or '') for page in reader.pages[:80]]
        except Exception:
            with pdfplumber.open(pdf_path) as pdf:
                page_count = len(pdf.pages)
                texts = [(page.extract_text() or '') for page in pdf.pages[:80]]
        text = '\n'.join(texts)
        tps_matches = [{'name': clean(m.group(1)), 'code': m.group(2)} for m in TPS_RE.finditer(text)]
        au_matches = [{'name': clean(m.group(1)), 'code': m.group(2)} for m in AU_RE.finditer(text)]
        ages = unique(m.group(0) for m in AGE_RE.finditer(text))
        units = unique(m.group(0) for m in UNIT_RE.finditer(text))
        return {
            'publication_id': publication.get('publication_id'),
            'publication_title': publication.get('title'),
            'publication_series': publication.get('series'),
            'source_url': publication.get('source_url'),
            'pdf_url': file_record.get('pdf_url'),
            'local_path': file_record.get('local_path'),
            'page_count': page_count,
            'pages_extracted': min(page_count, 80),
            'extraction_status': 'parsed' if text.strip() else 'no-text',
            'tps_mentions': tps_matches[:40],
            'au_mentions': au_matches[:80],
            'reported_age_terms': ages,
            'unit_candidates': units,
            'source_evidence': evidence_sentences(text, [r'source rocks?', r'organically? rich', r'total organic carbon', r'kerogen']),
            'reservoir_evidence': evidence_sentences(text, [r'reservoir rocks?', r'reservoirs? (?:are|include|consist)', r'porosity', r'permeability']),
            'trap_seal_evidence': evidence_sentences(text, [r'traps? (?:are|include|consist)', r'trap types?', r'seals? (?:are|include|consist)', r'seal rocks?']),
            'generation_migration_evidence': evidence_sentences(text, [r'generation and migration', r'hydrocarbon generation', r'petroleum generation', r'migration pathways?', r'maturation', r'thermal maturity']),
            'geologic_framework_evidence': evidence_sentences(text, [r'geologic framework', r'basin evolution', r'extensional', r'compressional', r'foreland basin', r'passive margin', r'rift basin']),
            'text_chars': len(text),
        }
    except Exception as exc:
        return {
            'publication_id': publication.get('publication_id'),
            'publication_title': publication.get('title'),
            'publication_series': publication.get('series'),
            'source_url': publication.get('source_url'),
            'pdf_url': file_record.get('pdf_url'),
            'local_path': file_record.get('local_path'),
            'extraction_status': 'error',
            'error': str(exc),
        }

if __name__ == '__main__':
    manifest = json.loads(MANIFEST.read_text(encoding='utf-8'))
    tasks = []
    for publication in manifest['results']:
        for file_record in publication.get('files', []):
            if file_record.get('status') == 'downloaded':
                tasks.append((publication, file_record))
    with ProcessPoolExecutor(max_workers=6) as pool:
        records = list(pool.map(extract_pdf, tasks, chunksize=1))
    summary = {
        'pdfs': len(records),
        'parsed': sum(record.get('extraction_status') == 'parsed' for record in records),
        'no_text': sum(record.get('extraction_status') == 'no-text' for record in records),
        'errors': sum(record.get('extraction_status') == 'error' for record in records),
        'with_source_evidence': sum(bool(record.get('source_evidence')) for record in records),
        'with_reservoir_evidence': sum(bool(record.get('reservoir_evidence')) for record in records),
        'with_trap_seal_evidence': sum(bool(record.get('trap_seal_evidence')) for record in records),
        'with_generation_migration_evidence': sum(bool(record.get('generation_migration_evidence')) for record in records),
        'with_geologic_framework_evidence': sum(bool(record.get('geologic_framework_evidence')) for record in records),
    }
    OUTPUT.write_text(json.dumps({'summary': summary, 'records': records}, indent=2, ensure_ascii=False), encoding='utf-8')
    print(json.dumps(summary, indent=2))
