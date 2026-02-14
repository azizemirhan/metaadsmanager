"""
Hedef kitle seçenekleri API - Demografik Bilgiler, İlgi Alanları, Davranışlar.
Meta Ads Manager'da manuel reklam oluşturma için özet üretiminde kullanılır.
"""
import os
from pathlib import Path
from fastapi import APIRouter, HTTPException

router = APIRouter(tags=["Targeting"])

# Docker'da TARGETING_FILES_DIR=/project ile proje kökü mount edilir
_roottmp = Path(__file__).resolve().parent.parent.parent.parent
_fallback = Path(os.getenv("TARGETING_FILES_DIR", ""))
BASE_DIR = _fallback if _fallback and _fallback.exists() else _roottmp

DEMOGRAPHICS_FILE = BASE_DIR / "Meta - Demografik Bilgiler.txt"
BEHAVIORS_FILE = BASE_DIR / "Meta - Davranışlar.txt"
INTERESTS_FILE = BASE_DIR / "Meta -  İlgi Alanları.txt"
INTERESTS_ALT = BASE_DIR / "Meta - İlgi Alanları.txt"


def _parse_targeting_file(file_path: Path) -> list[dict]:
    """Txt dosyasını parse eder; label ve size içeren öğeleri döner."""
    items: list[dict] = []
    if not file_path.exists():
        return items

    try:
        content = file_path.read_text(encoding="utf-8", errors="replace")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Dosya okunamadı: {e}")

    # Satır formatı: "   * Etiket (Büyüklük: X - Y)" veya "   * Alt Kategori"
    buyukluk_marker = "(Büyüklük:"

    for line in content.splitlines():
        line = line.rstrip()
        if "*" not in line:
            continue
        idx = line.find("*")
        rest = line[idx + 1 :].strip()
        if not rest:
            continue

        if buyukluk_marker in rest:
            i = rest.rfind(buyukluk_marker)
            label = rest[:i].strip().rstrip("(").strip()
            start = i + len(buyukluk_marker)
            end = rest.find(")", start)
            size_val = rest[start:end].strip() if end >= 0 else None
        else:
            label = rest
            size_val = None

        # Çok kısa veya boş etiketleri atla
        if len(label) < 2:
            continue

        items.append({"label": label, "size": size_val})
    return items


def get_targeting_options_data() -> dict:
    """Demografik bilgiler, ilgi alanları ve davranışları döner (AI ve API için)."""
    interests_path = INTERESTS_FILE if INTERESTS_FILE.exists() else INTERESTS_ALT
    return {
        "demographics": _parse_targeting_file(DEMOGRAPHICS_FILE),
        "interests": _parse_targeting_file(interests_path),
        "behaviors": _parse_targeting_file(BEHAVIORS_FILE),
    }


@router.get("/options")
async def get_targeting_options():
    """Demografik bilgiler, ilgi alanları ve davranışları döner."""
    return get_targeting_options_data()
