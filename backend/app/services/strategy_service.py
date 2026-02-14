"""
Stratejist Asistanı Servisi - Davranış Modellerine göre reklam stratejisi oluşturma.

Davranış Modelleri:
- RISK_MINIMIZER: Sadece kanıtlanmış kitlelere odaklan
- CREATIVE_LAB: 3-5 farklı kreatif varyasyonu test et
- BUDGET_GUARD: Harcama yapıp 0 sonuç getiren demografileri negatif listeye al
- FAST_CONVERSION: FOMO ve aciliyet vurgusu
- SCALE_READY: Geniş hedefleme (Advantage+) yapıları kur
"""

import json
import csv
import io
from typing import Optional
from dataclasses import dataclass, field
from app import config


@dataclass
class BehaviorModeRules:
    """Davranış modeli kuralları"""
    name: str
    name_tr: str
    description: str
    budget_multiplier: float = 1.0
    min_proven_audience_size: Optional[str] = None
    creative_variations: int = 1
    enable_fomo: bool = False
    enable_advantage_plus: bool = False
    exclude_zero_result_demo: bool = False
    focus_platforms: list[str] = field(default_factory=list)
    risk_level: str = "medium"  # low, medium, high
    cta_recommendations: list[str] = field(default_factory=list)
    targeting_logic: str = "balanced"  # strict, balanced, broad


BEHAVIOR_MODES = {
    "RISK_MINIMIZER": BehaviorModeRules(
        name="RISK_MINIMIZER",
        name_tr="Risk Minimize Etme",
        description="Sadece geçmişte %100 kanıtlanmış kitlelere ve platformlara odaklan. Şeffaf fiyat bilgisi ve net SSS kullanarak 'meraklı' kitleyi ele.",
        budget_multiplier=0.8,
        min_proven_audience_size="10M+",
        creative_variations=2,
        enable_fomo=False,
        enable_advantage_plus=False,
        exclude_zero_result_demo=True,
        focus_platforms=["facebook", "instagram"],
        risk_level="low",
        cta_recommendations=["LEARN_MORE", "CONTACT_US"],
        targeting_logic="strict"
    ),
    "CREATIVE_LAB": BehaviorModeRules(
        name="CREATIVE_LAB",
        name_tr="Kreatif Laboratuvarı",
        description="Tek bir reklam seti altında 3-5 farklı görsel ve metin varyasyonu oluştur. Bütçeyi bölüştürerek en iyi 'kancayı' (hook) bulmaya odaklan.",
        budget_multiplier=1.2,
        creative_variations=5,
        enable_fomo=False,
        enable_advantage_plus=False,
        exclude_zero_result_demo=False,
        focus_platforms=["facebook", "instagram", "messenger"],
        risk_level="medium",
        cta_recommendations=["LEARN_MORE", "SIGN_UP", "SHOP_NOW"],
        targeting_logic="balanced"
    ),
    "BUDGET_GUARD": BehaviorModeRules(
        name="BUDGET_GUARD",
        name_tr="Bütçe Koruyucu",
        description="Raporlarda harcama yapıp 0 sonuç getiren tüm demografileri (Yaş, Cinsiyet, Platform) otomatik olarak negatif listeye al ve hedeflemeden çıkar.",
        budget_multiplier=0.9,
        creative_variations=2,
        enable_fomo=False,
        enable_advantage_plus=False,
        exclude_zero_result_demo=True,
        focus_platforms=["facebook", "instagram"],
        risk_level="low",
        cta_recommendations=["LEARN_MORE", "MESSAGE"],
        targeting_logic="strict"
    ),
    "FAST_CONVERSION": BehaviorModeRules(
        name="FAST_CONVERSION",
        name_tr="Hızlı Dönüşüm (FOMO)",
        description="Metinlerde aciliyet (kontenjan sınırı, sınırlı süre) vurgusu yap. Karşılama mesajlarını doğrudan satışa yönlendir.",
        budget_multiplier=1.3,
        creative_variations=3,
        enable_fomo=True,
        enable_advantage_plus=False,
        exclude_zero_result_demo=False,
        focus_platforms=["instagram", "facebook", "whatsapp"],
        risk_level="high",
        cta_recommendations=["SHOP_NOW", "SIGN_UP", "CALL_NOW"],
        targeting_logic="balanced"
    ),
    "SCALE_READY": BehaviorModeRules(
        name="SCALE_READY",
        name_tr="Ölçekleme Hazırlığı",
        description="Başarılı kitleyi temel alarak 'Geniş Hedefleme' (Advantage+) yapıları kur ve yüksek bütçeli yayın senaryosu hazırla.",
        budget_multiplier=2.0,
        creative_variations=3,
        enable_fomo=False,
        enable_advantage_plus=True,
        exclude_zero_result_demo=True,
        focus_platforms=["facebook", "instagram", "audience_network"],
        risk_level="medium",
        cta_recommendations=["LEARN_MORE", "SHOP_NOW", "SIGN_UP"],
        targeting_logic="broad"
    ),
}


def parse_csv_data(csv_content: str) -> list[dict]:
    """CSV içeriğini parse eder ve dict listesi döner."""
    if not csv_content.strip():
        return []
    
    try:
        # CSV başlıklarını otomatik tespit et
        dialect = csv.Sniffer().sniff(csv_content[:1024])
        reader = csv.DictReader(io.StringIO(csv_content), dialect=dialect)
        return list(reader)
    except Exception:
        # Basit comma-separated dene
        try:
            reader = csv.DictReader(io.StringIO(csv_content))
            return list(reader)
        except Exception:
            return []


def parse_json_data(json_content: str) -> list[dict]:
    """JSON içeriğini parse eder."""
    try:
        data = json.loads(json_content)
        if isinstance(data, list):
            return data
        elif isinstance(data, dict) and "data" in data:
            return data["data"]
        elif isinstance(data, dict):
            return [data]
        return []
    except Exception:
        return []


def analyze_performance_data(rows: list[dict]) -> dict:
    """
    Ham performans verilerini analiz eder.
    En düşük CPC, en yüksek CTR, en iyi demografikleri bulur.
    """
    if not rows:
        return {
            "best_ctr": None,
            "lowest_cpc": None,
            "best_demographics": [],
            "worst_demographics": [],
            "platform_performance": {},
            "age_performance": {},
            "gender_performance": {}
        }
    
    # Sayısal alanları çıkar
    processed_rows = []
    for row in rows:
        processed = {}
        for k, v in row.items():
            key = k.lower().strip()
            if isinstance(v, (int, float)):
                processed[key] = v
            else:
                # String sayıları dönüştür
                try:
                    processed[key] = float(v) if v else 0
                except (ValueError, TypeError):
                    processed[key] = v
        processed_rows.append(processed)
    
    # En iyi performans gösterenleri bul
    best_ctr_row = None
    lowest_cpc_row = None
    best_ctr = 0
    lowest_cpc = float('inf')
    
    platform_stats = {}
    age_stats = {}
    gender_stats = {}
    
    for row in processed_rows:
        ctr = row.get('ctr', 0) or row.get('click_through_rate', 0) or 0
        cpc = row.get('cpc', float('inf')) or row.get('cost_per_click', float('inf')) or float('inf')
        spend = row.get('spend', 0) or row.get('cost', 0) or 0
        clicks = row.get('clicks', 0) or 0
        impressions = row.get('impressions', 0) or 0
        
        if ctr > best_ctr and impressions > 100:
            best_ctr = ctr
            best_ctr_row = row
        
        if cpc < lowest_cpc and clicks > 0 and cpc > 0:
            lowest_cpc = cpc
            lowest_cpc_row = row
        
        # Platform bazlı analiz
        platform = row.get('platform', row.get('publisher_platform', 'unknown'))
        if platform and platform != 'unknown':
            if platform not in platform_stats:
                platform_stats[platform] = {'spend': 0, 'clicks': 0, 'impressions': 0, 'ctr_sum': 0, 'count': 0}
            platform_stats[platform]['spend'] += spend
            platform_stats[platform]['clicks'] += clicks
            platform_stats[platform]['impressions'] += impressions
            platform_stats[platform]['ctr_sum'] += ctr
            platform_stats[platform]['count'] += 1
        
        # Yaş bazlı analiz
        age = row.get('age', row.get('age_range', 'unknown'))
        if age and age != 'unknown':
            if age not in age_stats:
                age_stats[age] = {'spend': 0, 'clicks': 0, 'ctr_sum': 0, 'count': 0}
            age_stats[age]['spend'] += spend
            age_stats[age]['clicks'] += clicks
            age_stats[age]['ctr_sum'] += ctr
            age_stats[age]['count'] += 1
        
        # Cinsiyet bazlı analiz
        gender = row.get('gender', 'unknown')
        if gender and gender != 'unknown':
            if gender not in gender_stats:
                gender_stats[gender] = {'spend': 0, 'clicks': 0, 'ctr_sum': 0, 'count': 0}
            gender_stats[gender]['spend'] += spend
            gender_stats[gender]['clicks'] += clicks
            gender_stats[gender]['ctr_sum'] += ctr
            gender_stats[gender]['count'] += 1
    
    # Ortalama CTR hesapla
    for platform in platform_stats:
        stats = platform_stats[platform]
        stats['avg_ctr'] = stats['ctr_sum'] / stats['count'] if stats['count'] > 0 else 0
        stats['cpc'] = stats['spend'] / stats['clicks'] if stats['clicks'] > 0 else 0
    
    for age in age_stats:
        stats = age_stats[age]
        stats['avg_ctr'] = stats['ctr_sum'] / stats['count'] if stats['count'] > 0 else 0
    
    for gender in gender_stats:
        stats = gender_stats[gender]
        stats['avg_ctr'] = stats['ctr_sum'] / stats['count'] if stats['count'] > 0 else 0
    
    # En iyi ve en kötü performans gösterenleri sırala
    sorted_platforms = sorted(platform_stats.items(), key=lambda x: x[1].get('avg_ctr', 0), reverse=True)
    sorted_ages = sorted(age_stats.items(), key=lambda x: x[1].get('avg_ctr', 0), reverse=True)
    
    return {
        "best_ctr": {"value": best_ctr, "row": best_ctr_row},
        "lowest_cpc": {"value": lowest_cpc, "row": lowest_cpc_row},
        "platform_performance": platform_stats,
        "age_performance": age_stats,
        "gender_performance": gender_stats,
        "best_platforms": [p[0] for p in sorted_platforms[:3]],
        "best_ages": [a[0] for a in sorted_ages[:3] if a[1].get('spend', 0) > 0],
        "worst_platforms": [p[0] for p in sorted_platforms[-2:] if p[1].get('spend', 0) > 0 and p[1].get('clicks', 0) == 0],
        "worst_ages": [a[0] for a in sorted_ages[-2:] if a[1].get('spend', 0) > 0 and a[1].get('clicks', 0) == 0],
        "total_spend": sum(r.get('spend', 0) or r.get('cost', 0) or 0 for r in processed_rows),
        "total_clicks": sum(r.get('clicks', 0) or 0 for r in processed_rows),
        "total_impressions": sum(r.get('impressions', 0) or 0 for r in processed_rows),
    }


def extract_lessons_from_analysis(analysis_text: str) -> list[str]:
    """Geçmiş analiz metninden somut dersler çıkarır."""
    lessons = []
    
    # "Somut Öneriler" bölümünü bul
    if "SOMUT ÖNERİLER" in analysis_text or "Somut Öneriler" in analysis_text:
        lines = analysis_text.split('\n')
        in_suggestions = False
        for line in lines:
            if 'SOMUT ÖNERİLER' in line.upper() or 'Somut Öneriler' in line:
                in_suggestions = True
                continue
            if in_suggestions:
                if line.strip().startswith('5.') or line.strip().startswith('💰') or 'BÜTÇE' in line.upper():
                    break
                if line.strip() and (line.strip().startswith('-') or line.strip().startswith('•') or 
                                    any(line.strip().startswith(str(i)) for i in range(1, 10))):
                    lessons.append(line.strip().lstrip('- •').strip())
    
    # Dikkat edilmesi gerekenleri de ekle
    if "DİKKAT EDİLMESİ GEREKENLER" in analysis_text or "Dikkat Edilmesi Gerekenler" in analysis_text:
        lines = analysis_text.split('\n')
        in_warnings = False
        for line in lines:
            if 'DİKKAT' in line.upper() or 'Dikkat' in line:
                in_warnings = True
                continue
            if in_warnings:
                if 'SOMUT' in line.upper() or 'GÜÇLÜ' in line.upper():
                    break
                if line.strip() and (line.strip().startswith('-') or line.strip().startswith('•')):
                    lesson = line.strip().lstrip('- •').strip()
                    if lesson and lesson not in lessons:
                        lessons.append(lesson)
    
    return lessons


def generate_behavior_mode_prompt(
    behavior_mode: str,
    performance_analysis: dict,
    past_lessons: list[str],
    user_context: str
) -> str:
    """Seçilen davranış modeline göre AI prompt'u oluşturur."""
    
    mode = BEHAVIOR_MODES.get(behavior_mode, BEHAVIOR_MODES["RISK_MINIMIZER"])
    
    # Performans özeti
    perf_summary = f"""
## HAM VERİ ANALİZİ (Meta Ads Performans Verileri)
- Toplam Harcama: {performance_analysis.get('total_spend', 0):.2f} TL
- Toplam Tıklama: {performance_analysis.get('total_clicks', 0)}
- Toplam Gösterim: {performance_analysis.get('total_impressions', 0)}
- En İyi CTR: %{(performance_analysis.get('best_ctr') or {}).get('value', 0):.2f}
- En Düşük CPC: {(performance_analysis.get('lowest_cpc') or {}).get('value', 0):.2f} TL
- En İyi Platformlar: {', '.join(performance_analysis.get('best_platforms', []))}
- En İyi Yaş Grupları: {', '.join(performance_analysis.get('best_ages', []))}
- Performansı 0 Olan (Harcama var, sonuç yok): 
  - Platformlar: {', '.join(performance_analysis.get('worst_platforms', [])) or 'Yok'}
  - Yaş Grupları: {', '.join(performance_analysis.get('worst_ages', [])) or 'Yok'}
"""
    
    # Geçmiş dersler
    lessons_text = "\n".join([f"- {l}" for l in past_lessons]) if past_lessons else "- Geçmiş analiz notu bulunmuyor."
    
    # Davranış modu kuralları
    mode_rules = f"""
## STRATEJİK DAVRANIŞ MODELİ: {mode.name_tr}

AÇIKLAMA: {mode.description}

UYGULANACAK KURALLAR:
1. Bütçe Çarpanı: {mode.budget_multiplier}x (mevcut bütçeyi bu oranda ayarla)
2. Kreatif Varyasyon Sayısı: {mode.creative_variations} adet
3. FOMO/Aciliyet: {'Aktif' if mode.enable_fomo else 'Pasif'}
4. Advantage+ Kullanımı: {'Aktif' if mode.enable_advantage_plus else 'Pasif'}
5. Negatif Liste: {'Harcama yapıp 0 sonuç getiren demografileri hariç tut' if mode.exclude_zero_result_demo else 'Tüm demografiler değerlendirilebilir'}
6. Odaklanılacak Platformlar: {', '.join(mode.focus_platforms)}
7. Risk Seviyesi: {mode.risk_level}
8. Önerilen CTA'lar: {', '.join(mode.cta_recommendations)}
9. Hedefleme Mantığı: {mode.targeting_logic}

MODEL-SPECİFİK TALİMATLAR:
"""
    
    if behavior_mode == "RISK_MINIMIZER":
        mode_rules += """
- SADECE kanıtlanmış, yüksek performanslı kitleleri seç (en az 10M+ erişim)
- Şeffaf fiyat bilgisi kullan (paket fiyatları net yaz)
- SSS (Sıkça Sorulan Sorular) bölümü mutlaka ekle
- "Meraklı" kitleyi ele - detaylı bilgi isteyen kullanıcıları hedefle
- Düşük risk, düşük getiri stratejisi - güvenilirliği öne çıkar
"""
    elif behavior_mode == "CREATIVE_LAB":
        mode_rules += """
- Tek reklam seti altında 5 farklı kreatif varyasyonu planla
- Her varyasyon farklı bir "hook" (kanca) kullanmalı:
  * Varyasyon 1: Duygusal yaklaşım (hikaye)
  * Varyasyon 2: Mantıksal yaklaşım (rakamlar, istatistikler)
  * Varyasyon 3: FOMO yaklaşımı (sınırlı süre/kontenjan)
  * Varyasyon 4: Sosyal kanıt (müşteri yorumları)
  * Varyasyon 5: Soru-cevap formatı
- Bütçeyi eşit dağıt, en iyi performans göstereni belirle
"""
    elif behavior_mode == "BUDGET_GUARD":
        mode_rules += """
- Ham veride "harcama var ama sonuç yok" demografileri OTOMATİK olarak negatif listeye al
- Yaş gruplarından performansı 0 olanları hariç tut
- Platformlardan performansı 0 olanları hariç tut
- Cinsiyet bazlı performans analizi yap, düşük performanslıyı hariç tut
- Günlük bütçeyi düşük başlat, kanıtlanmış kitlelerde artır
"""
    elif behavior_mode == "FAST_CONVERSION":
        mode_rules += """
- Tüm metinlerde ACİLİYET vurgusu yap:
  * "Sadece 3 kontenjan kaldı"
  * "Son 48 saat"
  * "İlk 10 başvuruya özel"
- Karşılama mesajlarını doğrudan satışa yönlendir
- CTA: SHOP_NOW, SIGN_UP veya CALL_NOW kullan
- Instagram ve WhatsApp öncelikli platformlar
- Anlık karar almayı tetikleyen dil kullan
"""
    elif behavior_mode == "SCALE_READY":
        mode_rules += """
- Advantage+ (Otomatik hedefleme) aktif et
- Geniş kitle hedefleme (yaş aralığını geniş tut)
- Yüksek bütçe senaryosu hazırla (mevcut bütçenin 2x)
- Facebook, Instagram VE Audience Network kullan
- Ölçeklenebilir kreatifler hazırla (farklı formatlara uyumlu)
- Lookalike (benzer kitle) oluşturma hazırlığı yap
"""
    
    full_prompt = f"""{mode_rules}

{perf_summary}

## GEÇMİŞ ANALİZ DERSLERİ (Tekrarlanmaması gereken hatalar):
{lessons_text}

## KULLANICI BAĞLAMI (Reklam çıkılacak ürün/hizmet):
{user_context}

## GÖREV:
Yukarıdaki DAVRANIŞ MODELİ kurallarını, HAM VERİ analizini ve GEÇMİŞ DERSLERİ dikkate alarak eksiksiz bir reklam özeti JSON'u oluştur.

ÖNEMLİ:
1. Ham veride en iyi performans gösteren demografikleri kullan
2. Geçmiş derslerdeki hataları TEKRARLAMA
3. Davranış modelinin kurallarını eksiksiz uygula
4. Sadece geçerli JSON döndür, başka metin ekleme
"""
    
    return full_prompt


def get_behavior_mode_info(mode_key: str) -> dict:
    """Davranış modu bilgilerini döner."""
    mode = BEHAVIOR_MODES.get(mode_key)
    if not mode:
        return {"error": "Geçersiz mod"}
    return {
        "key": mode.name,
        "name": mode.name_tr,
        "description": mode.description,
        "risk_level": mode.risk_level,
        "budget_multiplier": mode.budget_multiplier,
        "creative_variations": mode.creative_variations,
        "features": [
            f"Bütçe çarpanı: {mode.budget_multiplier}x",
            f"Kreatif varyasyon: {mode.creative_variations}",
            "FOMO/Aciliyet" if mode.enable_fomo else "Standart mesajlaşma",
            "Advantage+" if mode.enable_advantage_plus else "Manuel hedefleme",
            "Negatif liste aktif" if mode.exclude_zero_result_demo else "Tüm demografiler",
            f"Odak platformlar: {', '.join(mode.focus_platforms)}",
        ]
    }


def get_all_behavior_modes() -> list[dict]:
    """Tüm davranış modlarını listeler."""
    return [get_behavior_mode_info(key) for key in BEHAVIOR_MODES.keys()]
