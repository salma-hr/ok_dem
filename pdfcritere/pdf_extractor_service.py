"""
Service d'extraction PDF — OK Démarrage
Endpoint FastAPI appelé par Spring Boot
Port : 8002
"""

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import pdfplumber
import re
import tempfile
import os
import logging

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("pdf-extractor")

app = FastAPI(title="OK Démarrage — PDF Extractor", version="2.1.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# ── Mappings ──────────────────────────────────────────────────────────────────

COULEUR_MAP = {
    'rouge': 'Rouge', 'رمحأ': 'Rouge',
    'jaune': 'Jaune', 'رفصأ': 'Jaune',
    'vert':  'Vert',  'رضخأ': 'Vert',
}

# Listes de tuples — itérer avec "for keys, val in MAP:", jamais .items()
CATEGORIE_MAP = [
    (['qualit'],                              'QUALITE'),
    (['technique'],                           'TECHNIQUE'),
    (['séc', 'sec', '5s', 'ةملاس', 'ةمﻼس'], 'SECURITE'),
]
MOYEN_MAP = [
    (['simulation'],        'SIMULATION'),
    (['production'],        'EN_PRODUCTION'),
    (['essai', 'faisceau'], 'ESSAI'),
    (['manuel'],            'MANUEL'),
]

PREFIX_RE = re.compile(
    r'^[MA]\.?\s*(?:Méthode|Machine|Matière|Milieu|Maitrise|'
    r'Œuvre|Oeuvre|Main[- ]d\'œuvre)\s*[:\-–]\s*',
    re.IGNORECASE,
)
HEADER_RE = re.compile(r'crit[eé]r', re.IGNORECASE)
NUM_RE    = re.compile(r'\b(\d+)\b')


# ── Helpers ───────────────────────────────────────────────────────────────────

def safe_cell(row: list, idx: int) -> str:
    if idx < len(row) and row[idx] is not None:
        return str(row[idx]).strip()
    return ''


def norm_couleur(val: str) -> Optional[str]:
    if not val:
        return None
    v = val.lower().split('\n')[0].strip()
    for k, r in COULEUR_MAP.items():
        if k in v:
            return r
    return None


def norm_categorie(text: str) -> Optional[str]:
    if not text:
        return None
    t = text.lower()
    for keys, cat in CATEGORIE_MAP:
        if any(k in t for k in keys):
            return cat
    return None


def norm_moyen(val: str) -> str:
    if not val:
        return 'VISUEL'
    v = val.lower().replace('\n', ' ').replace('/', ' ').strip()
    for keys, m in MOYEN_MAP:
        if any(k in v for k in keys):
            return m
    return 'VISUEL'


def clean_fr(text: str) -> str:
    if not text:
        return ''
    text = PREFIX_RE.sub('', text)
    return re.sub(r'\s+', ' ', text).strip('*').strip()


def is_arabic(text: str) -> bool:
    if not text:
        return False
    arabic = sum(1 for c in text if '\u0600' <= c <= '\u06FF')
    return arabic > len(text) * 0.3


def looks_like_description(text: str) -> bool:
    """Vrai si le texte ressemble à une description de critère (assez long, pas un nombre seul)."""
    t = text.strip()
    return len(t) >= 10 and not t.isdigit()


# ── Détection de layout ───────────────────────────────────────────────────────

def detect_layout(table: list) -> dict:
    cols = {'id': 0, 'fr': 1, 'ar': 2, 'couleur': 3, 'moyen': 5}
    ar_locked = False  # ← nouveau flag

    header = None
    for row in table[:5]:
        if not row:
            continue
        cells_low = [str(c).lower().strip() if c else '' for c in row]
        if any(c in ('id', 'description') for c in cells_low):
            header = row
            break

    if header is not None:
        for i, cell in enumerate(header):
            if cell is None:
                continue
            c = str(cell).lower().strip()
            if c == 'id':
                cols['id'] = i
            elif 'description' in c and not is_arabic(str(cell)):
                cols['fr'] = i
            elif 'فصو' in c:
                cols['ar'] = i
                ar_locked = True   # ← verrouille dès que 'فصو' trouvé
            elif not ar_locked and is_arabic(str(cell)):
                # Évite les cellules mixtes "Lundi\nنينثلإا"
                cell_str = str(cell).strip()
                ar_ratio = sum(1 for ch in cell_str if '\u0600' <= ch <= '\u06FF') / max(len(cell_str), 1)
                if ar_ratio > 0.6:  # colonne majoritairement arabe
                    cols['ar'] = i
            elif any(k in c for k in ('drap', 'ltpm', 'drapeu')):
                cols['couleur'] = i
            elif any(k in c for k in ('moyen', 'outil')):
                cols['moyen'] = i
        return cols

    # Fallback heuristique (inchangé)
    couleur_hits, moyen_hits, ar_hits = {}, {}, {}
    for row in table:
        if not row:
            continue
        for i, cell in enumerate(row):
            if not cell:
                continue
            s = str(cell).lower()
            if any(k in s for k in ('rouge', 'jaune', 'vert', 'رمحأ', 'رفصأ')):
                couleur_hits[i] = couleur_hits.get(i, 0) + 1
            if any(k in s for k in ('visuel', 'simul', 'produc', 'essai', 'manuel')):
                moyen_hits[i] = moyen_hits.get(i, 0) + 1
            if is_arabic(s) and len(s) > 5:
                ar_hits[i] = ar_hits.get(i, 0) + 1

    if couleur_hits:
        cols['couleur'] = max(couleur_hits, key=couleur_hits.get)
    if moyen_hits:
        for c in sorted(moyen_hits, key=moyen_hits.get, reverse=True):
            if c != cols['couleur']:
                cols['moyen'] = c
                break
    if ar_hits:
        for c in sorted(ar_hits, key=ar_hits.get, reverse=True):
            if c not in (cols['couleur'], cols['moyen']):
                cols['ar'] = c
                break

    return cols

def fix_arabic_order(text: str) -> str:
    """
    pdfplumber extrait l'arabe en ordre visuel (RTL inversé).
    Cette fonction le reconvertit en ordre logique Unicode ligne par ligne.
    """
    if not text or not is_arabic(text):
        return text
    lines = text.split('\n')
    fixed = []
    for line in lines:
        line = line.strip()
        if not line:
            continue
        if is_arabic(line):
            fixed.append(line[::-1])   # inversion visuel → logique
        else:
            fixed.append(line)
    return ' '.join(fixed)

def find_num_and_fr(row: list, col_id: int, col_fr: int):
    """
    Stratégie robuste pour extraire (numéro, description_fr) depuis une ligne.

    Gère 3 cas :
      1. Normal   : num dans col_id, desc dans col_fr
      2. Fusionné : "1 Vérifier..." dans une seule cellule
      3. Décalé   : num dans une colonne inattendue (ex: PDF Montage où id est col 0
                    mais pdfplumber le place dans la colonne du numéro de ligne)
    """
    # Cas 1 : standard
    cell_id = safe_cell(row, col_id)
    cell_fr = safe_cell(row, col_fr)
    nums_id = NUM_RE.findall(cell_id)

    if nums_id and looks_like_description(cell_fr):
        return nums_id, cell_fr

    # Cas 2 : num et description fusionnés dans la même cellule
    # ex: "1 Vérifier l'existence..." ou "1\nVérifier..."
    for idx, cell in enumerate(row):
        if cell is None:
            continue
        s = str(cell).strip()
        m = re.match(r'^(\d+)\s*[\n\r:.\-]?\s*(.{10,})', s, re.DOTALL)
        if m:
            candidate_fr = m.group(2).strip()
            if looks_like_description(candidate_fr):
                return [m.group(1)], candidate_fr

    # Cas 3 : cherche un numéro dans n'importe quelle cellule courte,
    #          et la description dans la cellule la plus longue de la ligne
    short_num = None
    for cell in row:
        if cell is None:
            continue
        s = str(cell).strip()
        if re.fullmatch(r'\d{1,3}', s):
            short_num = s
            break

    if short_num:
        # Cherche la cellule la plus longue comme description
        best_fr = ''
        for cell in row:
            if cell is None:
                continue
            s = str(cell).strip()
            if len(s) > len(best_fr) and looks_like_description(s) and not s.isdigit():
                best_fr = s
        if best_fr:
            return [short_num], best_fr

    return [], ''


# ── Schémas ───────────────────────────────────────────────────────────────────

class CritereExtrait(BaseModel):
    numero: int
    nom: str
    nomAr: str
    couleur: str
    type: str
    moyenVerification: str
    warning: Optional[str] = None


class ExtractionResult(BaseModel):
    processusNom: str
    nbCriteres: int
    criteres: List[CritereExtrait]
    warnings: List[str]


# ── Nom du processus ──────────────────────────────────────────────────────────

def extract_processus_nom(filename: str) -> str:
    name = filename
    name = re.sub(r'^\d+[-.\s]*', '', name)
    name = re.sub(r'[Cc]hecklist\s+de\s+v[eé]rif(?:ication)?\s*\.?\s*', '', name, flags=re.IGNORECASE)
    name = re.sub(r'\s*&?\s*PDCA.*', '', name, flags=re.IGNORECASE)
    name = re.sub(r'\s*\([Ff]r[-–][Aa]r\).*', '', name)
    name = re.sub(r'\s*\([Ff]r\).*', '', name)
    name = re.sub(r'_\d+$', '', name)
    name = re.sub(r'\.pdf$', '', name, flags=re.IGNORECASE)
    return re.sub(r'\s+', ' ', name).strip(' .-_')


# ── Extraction principale ─────────────────────────────────────────────────────

def extract_from_bytes(pdf_bytes: bytes, filename: str) -> ExtractionResult:
    processus_nom = extract_processus_nom(filename)
    criteres: List[CritereExtrait] = []
    warnings: List[str] = []
    categorie = 'QUALITE'

    with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as tmp:
        tmp.write(pdf_bytes)
        tmp_path = tmp.name

    try:
        with pdfplumber.open(tmp_path) as pdf:
            if not pdf.pages:
                raise ValueError("PDF vide")

            page   = pdf.pages[0]
            tables = page.extract_tables()

            if not tables:
                warnings.append("Aucun tableau trouvé dans le PDF")
                return ExtractionResult(
                    processusNom=processus_nom, nbCriteres=0,
                    criteres=[], warnings=warnings,
                )

            table = tables[0]
            cols  = detect_layout(table)

            log.info(
                f"[{filename}] layout → "
                f"id={cols['id']} fr={cols['fr']} ar={cols['ar']} "
                f"couleur={cols['couleur']} moyen={cols['moyen']}"
            )

            seen_nums: set = set()

            for row in table:
                if not row or len(row) < 2:
                    continue

                cell_id      = safe_cell(row, cols['id'])
                cell_fr_raw  = safe_cell(row, cols['fr'])
                cell_ar      = safe_cell(row, cols['ar'])
                cell_couleur = safe_cell(row, cols['couleur'])
                cell_moyen   = safe_cell(row, cols['moyen'])

                # ── Détection en-tête de catégorie ──
                combined = (cell_id + ' ' + cell_fr_raw).strip()
                if HEADER_RE.search(combined) and not NUM_RE.search(cell_id):
                    cat = norm_categorie(combined)
                    if cat:
                        categorie = cat
                    continue

                # ── Extraction robuste numéro + description ──
                nums, fr_raw = find_num_and_fr(row, cols['id'], cols['fr'])
                if not nums:
                    continue

                fr = clean_fr(fr_raw)
                if not fr or len(fr) < 4:
                    continue

                # ── Couleur : drapeau → arabe → scan ligne ──
                couleur = norm_couleur(cell_couleur)
                if not couleur:
                    couleur = norm_couleur(cell_ar)
                if not couleur:
                    for i, cell in enumerate(row):
                        if cell and i not in (cols['id'], cols['fr'], cols['ar']):
                            c = norm_couleur(str(cell))
                            if c:
                                couleur = c
                                break
                warn = None
                if not couleur:
                    couleur = 'Jaune'
                    warn = f"Couleur non détectée pour #{nums[0]}, défaut Jaune"
                    warnings.append(warn)

                moyen = norm_moyen(cell_moyen)
                ar = re.sub(r'\s+', ' ', fix_arabic_order(cell_ar)).strip()


                for n in nums:
                    num = int(n)
                    if num in seen_nums:
                        continue
                    seen_nums.add(num)
                    criteres.append(CritereExtrait(
                        numero=num,
                        nom=fr,
                        nomAr=ar,
                        couleur=couleur,
                        type=categorie,
                        moyenVerification=moyen,
                        warning=warn,
                    ))

    finally:
        os.unlink(tmp_path)

    criteres.sort(key=lambda c: c.numero)

    return ExtractionResult(
        processusNom=processus_nom,
        nbCriteres=len(criteres),
        criteres=criteres,
        warnings=warnings,
    )


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.post("/extract-pdf", response_model=ExtractionResult)
async def extract_pdf(file: UploadFile = File(...)):
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Fichier PDF requis")
    try:
        content = await file.read()
        result  = extract_from_bytes(content, file.filename)
        log.info(
            f"Extraction '{file.filename}' → "
            f"{result.nbCriteres} critères, {len(result.warnings)} warnings"
        )
        return result
    except Exception as e:
        log.exception(f"Erreur extraction pour '{file.filename}'")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/health")
def health():
    return {"status": "ok", "service": "pdf-extractor", "version": "2.1.0"}