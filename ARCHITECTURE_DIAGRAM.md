# PDF Styling Architecture Diagram

## 🎨 System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                     PDF Export User Action                          │
│                  (Dashboard / Checklist Download)                   │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
        ┌────────────────────────────────────────┐
        │    OkDemarrage (Model)                 │
        │  + PlanAction (Dependencies)           │
        │  + ChecklistAuditLog (Audit Trail)     │
        └────────────────┬───────────────────────┘
                         │
                         ▼
        ┌───────────────────────────────────────────────────┐
        │  ChecklistService.exportChecklistPdf()            │
        │  ├─ Orchestrates PDF generation                  │
        │  └─ Calls renderPdf() method                     │
        └────────┬──────────────────────────────────────────┘
                 │
        ┌────────▼──────────────────────────────────────────┐
        │    PdfStyleLeoni (NEW - Style System)             │
        │                                                   │
        │  ┌──────────────────────────────────────────┐    │
        │  │ COLOR CONSTANTS (6 Primary + 4 Accents) │    │
        │  │ ├─ LEONI_DARK_GRAY (45, 50, 55)         │    │
        │  │ ├─ LEONI_MEDIUM_GRAY (100, 105, 110)    │    │
        │  │ ├─ LEONI_LIGHT_GRAY (200, 205, 210)     │    │
        │  │ ├─ LEONI_PALE_GRAY (240, 242, 245)      │    │
        │  │ ├─ ACCENT_BLUE (51, 102, 153) ← accent │    │
        │  │ ├─ STATUS colors (4 types)              │    │
        │  │ └─ CRITERIA colors (rouge/jaune/vert)   │    │
        │  └──────────────────────────────────────────┘    │
        │  ┌──────────────────────────────────────────┐    │
        │  │ DESIGN CONSTANTS (class Design)          │    │
        │  │ ├─ Spacing: MARGIN, SECTION_SPACING      │    │
        │  │ ├─ Heights: HEADER_HEIGHT, FOOTER_HEIGHT │    │
        │  │ ├─ Borders: BORDER_THICKNESS (0.75pt)   │    │
        │  │ └─ Fonts: 7 size constants               │    │
        │  └──────────────────────────────────────────┘    │
        │  ┌──────────────────────────────────────────┐    │
        │  │ HELPER METHODS (12+)                     │    │
        │  │ ├─ getStatusColor(status)                │    │
        │  │ ├─ getCritereColor(couleur)              │    │
        │  │ ├─ getTableHeaderBgColor()               │    │
        │  │ ├─ getTableRowAlternateColor()           │    │
        │  │ ├─ getSectionLineColor()                 │    │
        │  │ └─ ...and 7 more helpers                 │    │
        │  └──────────────────────────────────────────┘    │
        └────────┬──────────────────────────────────────────┘
                 │
        ┌────────▼──────────────────────────────────────────┐
        │  renderPdf() Method (Line 851+)                   │
        │                                                   │
        │  Calls Drawing Methods:                           │
        │  ├─ drawHeader()                                 │
        │  │   ├─ Uses: PdfStyleLeoni colors               │
        │  │   └─ Result: Professional header with logo    │
        │  │                                               │
        │  ├─ drawSectionTitle() [repeats per section]     │
        │  │   ├─ Uses: ACCENT_BLUE line, Design spacing  │
        │  │   └─ Result: Titled sections with blue line   │
        │  │                                               │
        │  ├─ drawTable()                                  │
        │  │   ├─ Calls drawRow() with PdfStyleLeoni       │
        │  │   ├─ Dark headers + alternating light rows    │
        │  │   └─ Thin borders, clean layout               │
        │  │                                               │
        │  └─ addPageNumbers()                             │
        │      ├─ Uses: Footer colors                      │
        │      └─ Result: Professional page numbering      │
        │                                                   │
        └────────┬──────────────────────────────────────────┘
                 │
                 ▼
        ┌───────────────────────────────────┐
        │  PDDocument (PDFBox)              │
        │  ├─ PDPage objects created        │
        │  ├─ PDPageContentStream drawn     │
        │  └─ Professional styling applied  │
        └────────┬──────────────────────────┘
                 │
                 ▼
        ┌───────────────────────────────────┐
        │  ByteArrayOutputStream            │
        │  (PDF binary data)                │
        └────────┬──────────────────────────┘
                 │
                 ▼
        ┌───────────────────────────────────┐
        │  Download / Response              │
        │  (application/pdf)                │
        └───────────────────────────────────┘
```

---

## 🎯 Data Flow: Color Selection

```
User Downloads PDF
    │
    ▼
renderPdf() Method
    │
    ├─ For Section Title:
    │   └─ PdfStyleLeoni.getSectionLineColor()
    │       → Returns ACCENT_BLUE (51, 102, 153)
    │       → Drawn as 2pt line under section
    │
    ├─ For Table Header:
    │   └─ PdfStyleLeoni.getTableHeaderBgColor()
    │       → Returns LEONI_DARK_GRAY (45, 50, 55)
    │       → Plus getTableHeaderTextColor() = WHITE
    │
    ├─ For Table Rows (alternating):
    │   ├─ Even rows: LEONI_WHITE
    │   └─ Odd rows: getTableRowAlternateColor()
    │       → Returns (248, 249, 251) - very subtle gray
    │
    ├─ For Status Badge:
    │   └─ PdfStyleLeoni.getStatusColor(status)
    │       ├─ "SOUMIS" → STATUS_SOUMIS blue
    │       ├─ "VALIDE" → STATUS_VALIDE green
    │       ├─ "REJETE" → STATUS_REJETE red
    │       └─ "EN_COURS" → STATUS_EN_COURS orange
    │
    ├─ For Criteria Color:
    │   └─ PdfStyleLeoni.getCritereColor(couleur)
    │       ├─ "rouge" → ACCENT_RED
    │       ├─ "jaune" → ACCENT_YELLOW
    │       └─ "vert" → ACCENT_GREEN
    │
    └─ Result: Professional, minimal-color PDF
```

---

## 📊 Method Hierarchy

```
ChecklistService
│
├─ exportChecklistPdf()
│  └─ byte[] renderPdf(OkDemarrage, List<PlanAction>, List<ChecklistAuditLogDTO>)
│     │
│     ├─ createPdfContext()  ← Initialize with PdfStyleLeoni
│     │
│     ├─ float drawHeader()
│     │  └─ Uses: getHeaderBackgroundColor(), Design.FONT_*
│     │
│     ├─ PdfPageState drawKeyValueTable()
│     │  └─ drawTable()
│     │     ├─ buildRowLayout()
│     │     └─ drawRow()
│     │        ├─ getTableHeaderBgColor()
│     │        ├─ getTableRowAlternateColor()
│     │        └─ getTableBorderColor()
│     │
│     ├─ PdfPageState drawSectionTitle()
│     │  └─ getSectionLineColor() → ACCENT_BLUE
│     │
│     ├─ void drawRightAlignedText()
│     │  └─ Footer text in getFooterTextColor()
│     │
│     └─ void addPageNumbers()
│        ├─ getFooterBorderColor()
│        └─ getFooterTextColor()
│
└─ (Static utility methods)
   ├─ buildRowLayout()
   ├─ drawText()
   ├─ drawParagraph()
   ├─ wrapTextToWidth()
   ├─ loadLogo()
   └─ formatUser()
```

---

## 🎨 Before → After Visual

### BEFORE (Generic Colors)
```
┌─────────────────────────────────┐
│ HEADER: Random gray             │  RGB (???, ???, ???)
├─────────────────────────────────┤
│ Section Title                   │  Basic line
│ ┌────────────────────────────┐  │
│ │ Table: Mixed bright colors │  │  ← No consistency
│ │ ┌──────────────────────┐   │  │  ← Hard to read
│ │ │ Random border colors │   │  │
│ │ └──────────────────────┘   │  │
│ └────────────────────────────┘  │
│                                 │
│ Footer: text                    │  No styling
└─────────────────────────────────┘
```

### AFTER (Professional Leoni)
```
┌─────────────────────────────────┐
│ HEADER: Pale Gray (240,242,245) │  Professional background
├─────────────────────────────────┤
│ Section Title (Dark Gray)       │  + Blue accent line (51,102,153)
│ ┌────────────────────────────┐  │
│ │ Header: Dark Gray (45,50,55)  │  Professional header
│ │ with White text (255,255,255) │
│ ├────────────────────────────┤  │
│ │ Row: White bg              │  │
│ ├────────────────────────────┤  │
│ │ Row: Very Light Gray alt   │  │  Subtle zebra
│ │ (248,249,251)              │  │
│ ├────────────────────────────┤  │
│ │ Borders: Light Gray (0.75) │  │  Professional thin line
│ └────────────────────────────┘  │
│ ─────────────────────────────── │  Footer separator
│ Page 1 / 10 (Medium Gray)       │  Professional footer
└─────────────────────────────────┘
```

---

## 📦 Class Dependencies

```
PdfStyleLeoni (INDEPENDENT)
    ├─ No dependencies on other classes
    ├─ Pure static constants and methods
    └─ Zero overhead

ChecklistService (DEPENDS ON: PdfStyleLeoni)
    ├─ Imports: import com.example.service.PdfStyleLeoni;
    ├─ Calls: PdfStyleLeoni.getXxxColor()
    ├─ Uses: PdfStyleLeoni.Design.FONT_* constants
    └─ Result: Professional styling throughout

PDFBox (DEPENDENCY OF: ChecklistService)
    ├─ PDDocument
    ├─ PDPage
    ├─ PDPageContentStream
    ├─ PDFont
    └─ PDImageXObject
```

---

## ✨ Key Features

### PdfStyleLeoni.java
```
✓ 6 primary color shades (gray spectrum)
✓ 4 accent colors (minimal palette)
✓ 4 status indicator colors
✓ 8 design spacing constants
✓ 7 typography sizes
✓ 12+ smart color helper methods
✓ ~200 lines total
✓ Zero external dependencies
✓ Static access (no instantiation needed)
```

### ChecklistService Updates
```
✓ Constants reference PdfStyleLeoni
✓ drawHeader() uses professional styling
✓ drawSectionTitle() adds accent color lines
✓ drawRow() implements zebra striping
✓ addPageNumbers() styles footer
✓ All methods centralize color management
```

---

## 🔄 Color Application Logic

```
PdfStyleLeoni.getStatusColor(String status)
    │
    ├─ "SOUMIS"       → (100, 120, 150)  Blue
    ├─ "VALIDE_N1"    → (70, 120, 70)    Green
    ├─ "VALIDE_N2"    → (70, 120, 70)    Green
    ├─ "VALIDE_FINAL" → (70, 120, 70)    Green
    ├─ "REJETE"       → (180, 60, 60)    Red
    ├─ "EN_COURS"     → (180, 140, 40)   Orange
    └─ default        → (100, 105, 110)  Medium Gray

PdfStyleLeoni.getCritereColor(String couleur)
    │
    ├─ "rouge"  → (204, 51, 51)   Red
    ├─ "jaune"  → (153, 102, 51)  Ocre
    ├─ "vert"   → (51, 102, 51)   Green
    └─ default  → (200, 205, 210) Light Gray
```

---

## 📈 Implementation Impact

```
Before: Scattered hardcoded colors
    → PDDocument creation point: Many color() calls
    → drawHeader(): Color hardcoded
    → drawRow(): Color hardcoded
    → addPageNumbers(): Color hardcoded
    → Result: No consistency, hard to maintain

After: Centralized PdfStyleLeoni
    → All colors in one file
    → Methods reference PdfStyleLeoni
    → Change color in one place → affects all PDFs
    → Clear design intent and constants
    → Result: Professional, maintainable
```

---

**Status:** ✅ COMPLETE  
**Build:** SUCCESS (3.852s)  
**Date:** 2026-07-13
