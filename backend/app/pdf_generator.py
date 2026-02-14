# -*- coding: utf-8 -*-
"""AI analiz sonuçlarını PDF'e dönüştürme modülü."""

import re
from datetime import datetime
from pathlib import Path
from typing import Optional

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.enums import TA_LEFT, TA_CENTER


def _register_fonts():
    """Türkçe karakter desteği için fontları kaydet."""
    try:
        # Sistemde varsa DejaVu fontlarını kullan
        pdfmetrics.registerFont(TTFont('DejaVuSans', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'))
        pdfmetrics.registerFont(TTFont('DejaVuSans-Bold', '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'))
        return 'DejaVuSans', 'DejaVuSans-Bold'
    except:
        try:
            # macOS fontları
            pdfmetrics.registerFont(TTFont('Helvetica', '/System/Library/Fonts/Helvetica.ttc'))
            return 'Helvetica', 'Helvetica-Bold'
        except:
            # Varsayılan fontlar
            return 'Helvetica', 'Helvetica-Bold'


def _markdown_to_pdf_elements(text: str, styles) -> list:
    """Markdown metnini ReportLab elementlerine dönüştür."""
    elements = []
    lines = text.split('\n')
    
    normal_style = styles['Normal']
    heading1_style = styles['Heading1']
    heading2_style = styles['Heading2']
    heading3_style = styles['Heading3']
    bullet_style = styles['Bullet']
    
    i = 0
    while i < len(lines):
        line = lines[i].strip()
        
        if not line:
            # Çok fazla boş satır ekleme, sadece küçük boşluk
            i += 1
            continue
        
        # Başlıklar - Spacer ekleme, stil zaten spaceAfter içeriyor
        if line.startswith('# '):
            elements.append(Paragraph(line[2:], heading1_style))
        elif line.startswith('## '):
            elements.append(Paragraph(line[3:], heading2_style))
        elif line.startswith('### '):
            elements.append(Paragraph(line[4:], heading3_style))
        elif line.startswith('#### '):
            elements.append(Paragraph(line[5:], heading3_style))
        
        # Kalın metin (**text**)
        elif line.startswith('**') and line.endswith('**'):
            clean = line.replace('**', '')
            elements.append(Paragraph(f"<b>{clean}</b>", normal_style))
        
        # Liste öğeleri
        elif line.startswith('* ') or line.startswith('- '):
            content = line[2:]
            # İçinde ** varsa kalın yap
            content = re.sub(r'\*\*(.*?)\*\*', r'<b>\1</b>', content)
            elements.append(Paragraph(f"• {content}", bullet_style))
        
        # Sayfa sonu ayırıcı (---) - PDF'de sayfa sonu yerine ince çizgi kullan
        elif line == '---':
            # Şablonlar arasına ince ayırıcı çizgi ekle, sayfa sonu değil
            line_data = [['']]
            line_table = Table(line_data, colWidths=[16 * cm])
            line_table.setStyle(TableStyle([
                ('LINEBELOW', (0, 0), (-1, 0), 0.5, colors.HexColor('#e5e7eb')),
                ('TOPPADDING', (0, 0), (-1, 0), 6),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 6),
            ]))
            elements.append(line_table)
        
        # Normal metin
        else:
            # Markdown kalınlık işaretlerini HTML'e çevir
            line = re.sub(r'\*\*(.*?)\*\*', r'<b>\1</b>', line)
            elements.append(Paragraph(line, normal_style))
        
        i += 1
    
    return elements


def generate_analysis_pdf(
    analysis_text: str,
    report_name: str,
    output_path: Path,
) -> Optional[Path]:
    """
    AI analiz metnini PDF'e dönüştürür.
    
    Args:
        analysis_text: Markdown formatında analiz metni
        report_name: Rapor adı (PDF başlığı için)
        output_path: PDF'in kaydedileceği yol
    
    Returns:
        Kaydedilen PDF dosyasının yolu veya None
    """
    try:
        font_normal, font_bold = _register_fonts()
        
        doc = SimpleDocTemplate(
            str(output_path),
            pagesize=A4,
            rightMargin=2 * cm,
            leftMargin=2 * cm,
            topMargin=2 * cm,
            bottomMargin=2 * cm,
        )
        
        # Stil tanımları
        styles = getSampleStyleSheet()
        
        # Başlık stili
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontName=font_bold,
            fontSize=18,
            textColor=colors.HexColor('#1e40af'),
            spaceAfter=20,
            alignment=TA_CENTER,
        )
        
        # Heading1 stili - daha kompakt
        h1_style = ParagraphStyle(
            'CustomH1',
            parent=styles['Heading1'],
            fontName=font_bold,
            fontSize=14,
            textColor=colors.HexColor('#1e3a5f'),
            spaceAfter=6,
            spaceBefore=10,
        )
        
        # Heading2 stili - daha kompakt
        h2_style = ParagraphStyle(
            'CustomH2',
            parent=styles['Heading2'],
            fontName=font_bold,
            fontSize=12,
            textColor=colors.HexColor('#2563eb'),
            spaceAfter=4,
            spaceBefore=8,
        )
        
        # Heading3 stili - daha kompakt
        h3_style = ParagraphStyle(
            'CustomH3',
            parent=styles['Heading3'],
            fontName=font_bold,
            fontSize=11,
            textColor=colors.HexColor('#374151'),
            spaceAfter=4,
            spaceBefore=6,
        )
        
        # Normal metin stili
        normal_style = ParagraphStyle(
            'CustomNormal',
            parent=styles['Normal'],
            fontName=font_normal,
            fontSize=10,
            leading=14,
            textColor=colors.HexColor('#1f2937'),
        )
        
        # Liste öğesi stili
        bullet_style = ParagraphStyle(
            'CustomBullet',
            parent=styles['Normal'],
            fontName=font_normal,
            fontSize=10,
            leading=14,
            leftIndent=20,
            textColor=colors.HexColor('#1f2937'),
        )
        
        elements = []
        
        # Başlık
        elements.append(Paragraph(f"AI Rapor Analizi: {report_name}", title_style))
        elements.append(Spacer(1, 0.3 * cm))
        
        # Tarih
        date_style = ParagraphStyle(
            'DateStyle',
            parent=normal_style,
            fontSize=9,
            textColor=colors.gray,
            alignment=TA_CENTER,
        )
        elements.append(Paragraph(f"Oluşturulma Tarihi: {datetime.now().strftime('%d.%m.%Y %H:%M')}", date_style))
        elements.append(Spacer(1, 0.5 * cm))
        
        # Çizgi
        line_data = [['']]
        line_table = Table(line_data, colWidths=[16 * cm])
        line_table.setStyle(TableStyle([
            ('LINEBELOW', (0, 0), (-1, 0), 1, colors.HexColor('#2563eb')),
        ]))
        elements.append(line_table)
        elements.append(Spacer(1, 0.5 * cm))
        
        # Analiz içeriği - özel stillerle
        custom_styles = {
            'Heading1': h1_style,
            'Heading2': h2_style,
            'Heading3': h3_style,
            'Normal': normal_style,
            'Bullet': bullet_style,
        }
        content_elements = _markdown_to_pdf_elements(analysis_text, custom_styles)
        elements.extend(content_elements)
        
        # Footer
        elements.append(Spacer(1, 2 * cm))
        footer_style = ParagraphStyle(
            'Footer',
            parent=normal_style,
            fontSize=8,
            textColor=colors.gray,
            alignment=TA_CENTER,
        )
        elements.append(Paragraph("— Meta Ads Dashboard AI Analiz Raporu —", footer_style))
        
        # PDF oluştur
        doc.build(elements)
        
        return output_path if output_path.exists() else None
        
    except Exception as e:
        print(f"PDF oluşturma hatası: {e}")
        return None
