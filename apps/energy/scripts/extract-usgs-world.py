#!/usr/bin/env python
# extract-usgs-world.py — USGS 2012 World Assessment (DDS-69) → web GeoJSON + summaries.
# PUBLIC DOMAIN source (US Geological Survey); free to ship. Courtesy cite: USGS DDS-69.
# Reads the ESRI FileGDB (WEP_AU + CARA_AU assessment-unit polygons) + the tab-delimited
# summary tables, joins undiscovered-resource means per AU/province, dissolves AUs into
# province polygons, simplifies for the web, and writes apps/energy/public/world/*.
#
# One-time GIS prereq (GDAL-backed, isolated venv — does NOT touch global Python):
#   python -m venv .geovenv && .geovenv/Scripts/pip install pyogrio shapely pyproj
#   .geovenv/Scripts/python scripts/extract-usgs-world.py --gdb <DDS69ff.gdb> --tab <Tab tables>
# Deterministic. Emits: aus.geojson, provinces.geojson, regions.json, countries.json, index.json
import argparse, csv, json, os, re, sys
from collections import defaultdict

def parse_args():
    ap = argparse.ArgumentParser()
    ap.add_argument('--gdb', required=True, help='path to DDS69ff.gdb')
    ap.add_argument('--tab', required=True, help='path to USGS "Tab tables" folder')
    ap.add_argument('--out', required=True, help='output dir (public/world)')
    ap.add_argument('--simplify', type=float, default=0.02, help='deg tolerance')
    ap.add_argument('--precision', type=int, default=3, help='coord decimals')
    return ap.parse_args()

# ── tab-delimited reader: numbers are quoted with thousands commas e.g. "5,093.29" ──
def num(s):
    if s is None: return None
    s = str(s).strip().strip('"').replace(',', '')
    if s == '' or s.lower() == 'na': return None
    try: return float(s)
    except ValueError: return None

def read_tab(path):
    with open(path, 'r', encoding='utf-8-sig', newline='') as f:
        rows = list(csv.reader(f, delimiter='\t', quotechar='"'))
    if not rows: return [], []
    header = [h.strip().strip('"') for h in rows[0]]
    out = []
    for r in rows[1:]:
        if not any(c.strip() for c in r): continue
        out.append(dict(zip(header, r)))
    return header, out

def col(header, pattern):
    if not pattern: return None
    rx = re.compile(pattern, re.I)
    for h in header:
        if rx.search(h): return h
    return None

def main():
    a = parse_args()
    os.makedirs(a.out, exist_ok=True)
    import pyogrio
    from shapely.geometry import shape, mapping
    from shapely.ops import unary_union, transform
    from shapely import set_precision, make_valid
    import pyproj

    # ---- 1 · resource summaries (means) keyed by code ----
    def load_summary(fname, code_key_rx, name_key_rx):
        header, rows = read_tab(os.path.join(a.tab, fname))
        c_code = col(header, code_key_rx); c_name = col(header, name_key_rx)
        c_oil = col(header, r'Oil in Oil Fields.*Mean')
        c_gog = col(header, r'Gas in Gas Fields.*Mean')
        c_goo = col(header, r'Gas in Oil Fields.*Mean')
        c_ngl = col(header, r'NGL.*Oil Fields.*Mean') or col(header, r'Liquids.*Gas Fields.*Mean')
        by = {}
        for r in rows:
            code = (r.get(c_code) or '').strip().strip('"')
            if not code: continue
            oil = num(r.get(c_oil)); gasG = num(r.get(c_gog)) or 0; gasO = num(r.get(c_goo)) or 0
            gas = (gasG + gasO) or None
            boe = None
            if oil is not None or gas is not None:
                boe = (oil or 0) + ((gas or 0) / 6.0)  # BCFG→MMBOE @6:1
            by[code] = {'name': (r.get(c_name) or '').strip().strip('"'),
                        'oilMean': oil, 'gasMean': gas, 'boeMean': round(boe, 1) if boe else None}
        return by

    prov_sum = load_summary('Province Summary.txt', r'Province Code', r'Province Name')
    au_sum   = load_summary('AU Summary.txt', r'Assessment Unit Code', r'Assessment Unit Name')
    # regions + countries → plain JSON (no geometry)
    reg_h, reg_r = read_tab(os.path.join(a.tab, 'Region Summary.txt'))
    ctry_h, ctry_r = read_tab(os.path.join(a.tab, 'Country Summary.txt'))
    def summarize(header, rows, code_rx, name_rx):
        c_code = col(header, code_rx); c_name = col(header, name_rx)
        c_oil = col(header, r'Oil in Oil Fields.*Mean'); c_gog = col(header, r'Gas in Gas Fields.*Mean'); c_goo = col(header, r'Gas in Oil Fields.*Mean')
        out = []
        for r in rows:
            nm = (r.get(c_name) or '').strip().strip('"')
            if not nm: continue
            oil = num(r.get(c_oil)); gas = (num(r.get(c_gog)) or 0) + (num(r.get(c_goo)) or 0)
            out.append({'code': (r.get(c_code) or '').strip().strip('"') if c_code else None, 'name': nm,
                        'oilMean': oil, 'gasMean': gas or None, 'boeMean': round((oil or 0)+(gas/6.0), 1) if (oil or gas) else None})
        return out
    regions = summarize(reg_h, reg_r, r'Region Code', r'Region Name')
    countries = summarize(ctry_h, ctry_r, None, r'Country')

    # ---- 2 · AU polygons from the FileGDB (WEP_AU wgs84 + CARA_AU reprojected) ----
    def read_layer(layer, reproject=False):
        gdf = pyogrio.read_dataframe(a.gdb, layer=layer)
        if reproject and gdf.crs is not None:
            gdf = gdf.to_crs('EPSG:4326')
        return gdf
    wep = read_layer('WEP_AU')
    cara = read_layer('CARA_AU', reproject=True)

    tol, prec = a.simplify, a.precision
    def clean_geom(geom):
        g = geom.simplify(tol, preserve_topology=True)
        if not g.is_valid: g = make_valid(g)
        try:
            g2 = set_precision(g, 10 ** (-prec))
            g = g2 if not g2.is_empty else g
        except Exception: pass
        if not g.is_valid: g = make_valid(g)
        return g

    def norm_code(v):  # pyogrio reads code fields as floats → "4025.0"; normalise to "4025"
        s = str(v).strip()
        if s.endswith('.0'): s = s[:-2]
        return s

    au_features = []
    prov_geoms = defaultdict(list)
    prov_names = {}
    def add_rows(gdf, m):  # m = field-name map for the two layers' differing schemas
        for _, row in gdf.iterrows():
            geom = row.geometry
            if geom is None or geom.is_empty: continue
            g = clean_geom(geom)
            au_code = norm_code(row[m['au']])
            prv_code = norm_code(row[m['prv']])
            prv_name = str(row[m['prvN']]).strip()
            props = {
                'auCode': au_code, 'auName': str(row[m['auN']]).strip(),
                'tps': str(row.get(m['tps'], '')).strip() if m.get('tps') else None,
                'prvCode': prv_code, 'prvName': prv_name,
                'regCode': norm_code(row[m['reg']]) if m.get('reg') else None,
                'regName': str(row[m['regN']]).strip(),
            }
            s = au_sum.get(au_code, {})
            props.update({'oilMean': s.get('oilMean'), 'gasMean': s.get('gasMean'), 'boeMean': s.get('boeMean')})
            au_features.append({'type': 'Feature', 'properties': props, 'geometry': mapping(g)})
            prov_geoms[prv_code].append(g)
            if prv_name: prov_names[prv_code] = prv_name
    add_rows(wep, {'au': 'AU_CODE', 'auN': 'AU_NAME', 'tps': 'TPS_NAME', 'prv': 'PRV_CODE', 'prvN': 'PRV_NAME', 'reg': 'REG_CODE', 'regN': 'REG_NAME'})
    add_rows(cara, {'au': 'ASSESSCODE', 'auN': 'ASSESSNAME', 'prv': 'PROVCODE', 'prvN': 'PROV_NAME', 'reg': 'REG_NUM', 'regN': 'REG_NAME'})

    # ---- 3 · dissolve AUs → province polygons ----
    prov_features = []
    for prv_code, geoms in prov_geoms.items():
        valid = [make_valid(g) if not g.is_valid else g for g in geoms]
        try:
            merged = unary_union(valid)
        except Exception:
            merged = unary_union([g.buffer(0) for g in valid])
        merged = clean_geom(merged)
        s = prov_sum.get(prv_code, {})
        prov_features.append({'type': 'Feature', 'properties': {
            'prvCode': prv_code, 'prvName': s.get('name') or prov_names.get(prv_code) or '',
            'oilMean': s.get('oilMean'), 'gasMean': s.get('gasMean'), 'boeMean': s.get('boeMean'),
        }, 'geometry': mapping(merged)})

    # ---- 4 · write ----
    def wj(name, obj):
        with open(os.path.join(a.out, name), 'w', encoding='utf-8') as f: json.dump(obj, f, separators=(',', ':'))
    wj('aus.geojson', {'type': 'FeatureCollection', 'features': au_features})
    wj('provinces.geojson', {'type': 'FeatureCollection', 'features': prov_features})
    wj('regions.json', regions)
    wj('countries.json', countries)
    volve = next((f['properties'] for f in prov_features if f['properties']['prvCode'] == '4025'), None)
    manifest = {
        'version': '1.0.0', 'source': 'USGS 2012 World Assessment of Undiscovered Oil and Gas Resources (DDS-69)',
        'licence': 'Public Domain (US Geological Survey)', 'crs': 'WGS84 (EPSG:4326)',
        'counts': {'regions': len(regions), 'countries': len(countries), 'provinces': len(prov_features), 'aus': len(au_features)},
        'volveContext': {'region': '4 · Europe', 'province': '4025 · North Sea Graben', 'au': '40250101 · Viking Graben',
                         'provinceResource': volve},
    }
    wj('index.json', manifest)
    print('[world] done →', a.out)
    for k, v in manifest['counts'].items(): print(f'  {k:10} {v}')
    print('[world] Volve province (4025):', json.dumps(volve))

if __name__ == '__main__':
    main()
