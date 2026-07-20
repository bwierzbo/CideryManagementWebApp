# Form Specs — TTB F 5120.17 + WA LIQ-774 (from Olympic Bluffs 2025 filings)

Extracted 2026-07-06 from the owner's actual filed 2025 forms. Use to build the printable/submittable generators (plan Phase 7).

## Filer identity (Olympic Bluffs Cidery)
- **TTB:** Olympic Bluffs Cidery LLC, 519 Finn Hall Rd, Port Angeles WA 98362, (360) 670-7206. **EIN 85-3197182**, **Registry BWN-WA-21759**.
- **WA LIQ:** Olympic Bluffs Cidery, 1025 Finn Hall Rd, Port Angeles WA 98362. **License 434739** (LicID 20148). Certifier: Scott Wierzbanowski, swierzbo@yahoo.com. *(Note the two addresses differ — 519 vs 1025 Finn Hall Rd; confirm which is current.)*
- These come from org settings; the form generators should pull them from a single config.

## TTB F 5120.17 — "Report of Wine Premises Operations" (OMB 1513-0053, rev 01/2018)
- **Filed ANNUALLY** by this proprietor (2025 filing has PERIOD COVERED = "2025", year-only).
- **Part I columns (tax classes):** (a) Not over 16% · (b) Over 16–21% · (c) Over 21–24% · (d) Artificially Carbonated · (e) Sparkling (BF/BP sub-lines) · (f) **Hard Cider** (≥0.5% & <8.5% ABV, ≤0.64 g CO2/100mL, apple/pear).
- **Section A (Bulk)** lines: 1 On-hand begin · 2 Produced by Fermentation · 3 Sweetening · 4 Wine Spirits · 5 Blending · 6 Amelioration · 7 Received in Bond · 8 Bottled Wine Dumped to Bulk · 9 Inventory Gains · 10–11 write-in · **12 TOTAL** · 13 Bottled · 14 Removed Taxpaid · 15 Transfers in Bond · 16 Distilling Material · 17 Vinegar · 18 Sweetening · 19 Wine Spirits · 20 Blending · 21 Amelioration · 22 Effervescent · 23 Testing · 24–28 write-in · 29 Losses · 30 Inventory Losses · 31 On-hand End · **32 TOTAL**.
- **Section B (Bottled)** lines: 1 On-hand begin · 2 Bottled · 3 Received in Bond · 4 Taxpaid Returned · 5–6 write-in · 7 TOTAL · 8 Removed Taxpaid · 9 Transferred in Bond · 10 Dumped to Bulk · 11 Family Use · 12 Removed for Export · 13 Tasting · 14–16 write-in · 17 Testing · 18 Breakage · 19 Inventory Shortage · 20 On-hand End · 21 TOTAL.
- **"Change of Tax Class"** appears as a write-in on both the add and subtract sides (e.g. HC 675 moved class).

### FILED 2025 numbers (annual) — Hard Cider col (f), the reconciliation anchor
- Line 2 Produced by fermentation: **4,808**
- Line 12 TOTAL bulk in: **5,874**
- Line 31 **On-hand end: 4,093**  ← system currently computes **2,773** (short **~1,319**)
- Line 13 Bottled: **149** · other classes: (a) 731 total-in / 17 end area; (b) 179; carbonated/sparkling 0.
- Section B bottled HC: on-hand end **149**.
- These match the golden test constants (4092.3, 5873.7, etc.) — the golden test IS the filed 2025 form.

## WA LIQ-774 — "Domestic Winery Summary Tax Report" (WSLCB)
- **Filed ANNUALLY by this owner** (the "December 2025" on the sample is the calendar-year period-end; the boxes carry full-year 2025 totals). Both forms are annual for Olympic Bluffs. Categories: **Cider · Non-Fortified · Fortified**.
- **Box (1) Total NET Gallons** = NET production, computed from the TTB 5120.17 (Section A: add lines 2–6,9,(10&11); subtract 16–23,29,30,(24–28)). Sample: **6,762.00**.
- **Removals (2)–(9):** (2) TOTAL AT WINERY = TTB Section B line 8 [Taxpaid Removals] + line 12 [Exports], cols a–f = **770**; (3)-(8) federal-taxpaid-area & warehouse adjustments (all 0 here); **(9) TOTAL = 770**.
- **Non-taxable (10)–(12):** (10) bottled sold to out-of-state wineries bond-to-bond; (11) WA Distributors (Form 777); (12) WSLCB/Military/ICC/exports out of WA. All 0 in sample.
- **Taxable sales (13)–(16):** (13) Winery retail incl. direct ship + samples + donations + charged tasting = Cider 143 / NonFort 544 / Fort 49 / **736**; (14) WA retail licensees = 6/22/6/**34**; **(15) TOTAL taxable = 149 / 566 / 55 / 770**; (16) (11)+(12)+(15) must equal (9).
- **Tax (17)–(24):** Cider (15)×**$0.308135** = 45.91 · Non-Fort ×**$0.867623** = 491.07 · Fort ×**$1.717076** = 94.44 · **(20) Total = 631.42**; (21) late penalty 2%/mo of (20); (22) mead gallons excluded; **(23) WA Wine Commission assessment = $0.08/gal on (Non-Fort+Fort), cider & mead excluded** = 49.68; **(24) Total Due = (20)+(21)+(23)**.
- **LIQ-777** (referenced by box 11): per-distributor breakdown of WA distributor sales.

### Source-data mapping (cidery DB → LIQ-774)
- Box (1) net production, (2) taxpaid removals: **derive from the TTB 5120.17 generator** (single source of truth).
- (13)/(14) taxable sales by channel × category: `inventory_distributions` / packaging removals grouped by sales channel (retail/direct/samples/donations vs WA licensees) and tax category (cider vs non-fortified vs fortified by ABV).
- Rounding: whole gallons.

## Open items
- TTB filed annually but LIQ filed monthly — confirm how the owner derives monthly LIQ box (1)/(2) from an annual TTB (likely per-month TTB computed internally). May need per-month 5120.17 generation.
- Confirm current premises address (519 vs 1025 Finn Hall Rd).
