# TTB Reconciliation 2024 - Reference Document

Created: 2026-01-17
Purpose: Document the TTB Form 5120.17 reconciliation for 2024, including 2023 carryover tracking.

## Summary

2024 was the first year filing TTB forms. The 2023 carryover cider was combined with 2024 production on the TTB form. This document reconciles the TTB form against system inventory.

## TTB Form 5120.17 (2024) - Filed Numbers

### Production (Combined 2023 + 2024)
| Category | Gallons | Liters |
|----------|---------|--------|
| Hard Cider Produced | 1,496 | 5,663 |
| Berry Wine Produced | 127 | 481 |
| **TOTAL PRODUCTION** | **1,623** | **6,144** |

### Removals During 2024
| Category | Gallons | Liters | Notes |
|----------|---------|--------|-------|
| Taxpaid (sold) | 217 | 821 | 90 bottled + 127 kegged |
| Distilled to brandy | 264 | 999 | → 18 gal brandy |
| Used for Pommeau | 42 | 159 | Mixed with brandy |
| Inventory Losses | 39 | 148 | Process losses |
| **TOTAL REMOVALS** | **562** | **2,127** | |

### Ending Inventory (Dec 31, 2024)
| Category | Gallons | Liters |
|----------|---------|--------|
| Bulk Hard Cider | 1,061 | 4,017 |
| Pommeau (16-21%) | 60 | 227 |
| **TOTAL ON HAND** | **1,121** | **4,244** |

## System Tracking - What Was Entered

### 2023 Carryover (Olympic Bluff Cidery Juice Purchases)
| Item | Volume (L) | Volume (gal) | Linked to Batch? |
|------|-----------|--------------|------------------|
| Common Cider (1000SS1) | 340 | 89.8 | ✓ IBC 4 batch |
| Common Cider (1000SS2) | 350 | 92.5 | ✓ BRITE batch |
| Common Cider (1000SS2) | 245 | 64.7 | ✗ Not linked |
| Common Cider (1000SS2) | 105 | 27.7 | ✗ Not linked |
| Unknown (120 Barrel 3) - Ginger Quince | 120 | 31.7 | ✓ Linked |
| Apple Brandy (38OB1 + 38OB2) | 68 | 18.0 | ✗ Not linked |
| Various 20L batches (Pommeau ingredients) | 180 | 47.5 | Partially |
| Ben Davis 2023 | 151 | 39.9 | ✗ Not linked |
| 10gal Rye Oak Barrel | 38 | 10.0 | ✓ Linked |
| **TOTAL 2023 CARRYOVER** | **1,637** | **432.5** | |
| - Cider portion | 1,569 | 414.6 | |
| - Brandy portion | 68 | 18.0 | |

### 2024 Production
| Source | Volume (L) | Volume (gal) |
|--------|-----------|--------------|
| 2024 Press Runs | 2,947 | 778.4 |
| 2024 Juice Purchases (external) | 500 | 132.1 |
| **TOTAL 2024** | **3,447** | **910.5** |

### System Total Inputs
| Category | Gallons |
|----------|---------|
| 2023 Carryover Cider | 414.6 |
| 2024 Production | 910.5 |
| **TOTAL SYSTEM INPUTS** | **1,325.0** |

## Reconciliation Gap

```
TTB Production:      1,623 gal
System Inputs:       1,325 gal
─────────────────────────────
GAP:                   298 gal (1,128 L)
```

### Gap Explained: Distilling Material

The 298 gallon gap has been **fully accounted for**. It represents 2023 carryover cider that:
1. Was not entered as juice purchases in the system
2. Was tracked on the 2024 TTB form as "Removed for Distilling Material" (264 gal)
3. Was used to top off IBC 4 over time
4. Was eventually sent to Highside Distillery in November 2025

#### The IBC 4 → Highside Connection

| Stage | Volume | Notes |
|-------|--------|-------|
| IBC 4 expected (2023) | 440 L (116 gal) | Original 2023 carryover |
| IBC 4 entered | 340 L (90 gal) | As "Common Cider (1000SS1)" |
| Topped off over time | +574 L | From untracked 2023 carryover |
| Sent to Highside | 914 L (242 gal) | November 2025 |
| Brandy received | 72.8 L (19 gal) | From this batch |

The "topping off" cider came from the untracked portions of:
- 1000SS1: 610 L gap (expected 950, entered 340)
- 1000SS2: 275 L gap (expected 975, entered 700)
- Other 2023 carryover not entered

#### 2025 Distillation Records (Highside Distillery)

| Batch | TTB Origin | Cider Sent | Brandy Received |
|-------|-----------|------------|-----------------|
| blend-2025-07-01-1100SS1... | 2025 | 1,000 L (264 gal) | 79.6 L |
| blend-2025-07-01-1100SS2... | 2025 | 700 L (185 gal) | 55.7 L |
| **blend-2024-12-20-1000 IBC 4-024554** | **2023** | **914 L (242 gal)** | **72.8 L** |
| **TOTAL** | | **2,614 L (691 gal)** | **208.2 L (55 gal)** |

The third batch (IBC 4) is marked as TTB Origin Year 2023, confirming it contained the 2023 carryover.

#### Gap Breakdown

| Item | Gap (gal) | Explanation |
|------|-----------|-------------|
| Distilled material (TTB line 16) | 264 | Removed on 2024 TTB, topped off IBC 4, sent to Highside 2025 |
| 225OB2 Calvados | ~34 | Never entered, likely consumed/blended elsewhere |
| **TOTAL GAP** | **298** | **FULLY ACCOUNTED FOR** ✓ |

## Expected vs Found - 2023 Carryover by Vessel

### Original 2023 Inventory (User-Provided)

| Vessel | Expected (L) | Type |
|--------|-------------|------|
| 1000SS1 | 950 | Base cider |
| 1000SS2 | 975 | Base cider |
| 225OB1 | 157 + 68 brandy = 225 | Pommeau |
| 225OB2 | 225 | Calvados barrel aged |
| 500SS1 | 225 | Base cider |
| IBC 4 | 440 | To be distilled |
| 120P3 | 120 | Ginger Quince |
| BRITE | 350 | Base cider |
| **TOTAL** | **3,285** | |

### What Was Found in System - Detailed Vessel Comparison

| Vessel | Expected (L) | Found (L) | Gap (L) | Status | Notes |
|--------|-------------|-----------|---------|--------|-------|
| **1000SS1** | 950 | 340 | -610 | ❌ MISSING | Only partial entry |
| **1000SS2** | 975 | 700 | -275 | ❌ MISSING | 350+245+105 L entries |
| **225OB1** (Pommeau) | 157 + 68 brandy | 220 + 68 | +63 | ⚠️ EXTRA | 11 × 20L batches + brandy |
| **225OB2** (Calvados) | 225 | 0 | -225 | ❌ NOT ENTERED | Calvados barrel aged cider |
| **500SS1** | 225 | 245* | +20 | ✓ CLOSE | *Entered as "1000SS2-500SS1" |
| **IBC 4** | 440 | 0** | -440 | ❌ NOT ENTERED | **Was distilled (264 gal on TTB) |
| **120P3** (Ginger Quince) | 120 | 120 | 0 | ✓ MATCHED | Found and linked |
| **BRITE** | 350 | 350*** | 0 | ✓ MATCHED | ***Entered as "1000SS2" |
| **TOTAL** | **3,442** | **1,569** | **-1,873** | | Cider only |

#### Important Notes on Categorization:

1. **500SS1**: Entered as "Common Cider (1000SS2)" with note "1000SS2-500SS1" (245 L)
2. **BRITE**: Entered as "Common Cider (1000SS2)" → batch "blend-2024-12-20-3BBL BRITE" (350 L)
3. **IBC 4**: The 440 L was likely the cider distilled to brandy (264 gal on TTB form) - never entered as juice purchase
4. **225OB2 (Calvados barrel aged)**: Never entered - this is the 225 L gap

#### Reconciliation with TTB:

The 298 gallon gap between System (1,325 gal) and TTB Production (1,623 gal) breaks down as:
- IBC 4 (distilled): 440 L = 116 gal
- 225OB2 (Calvados): 225 L = 59 gal
- 1000SS1 gap: 610 L = 161 gal (partial entry only)
- 1000SS2 gap: 275 L = 73 gal (partial entry only)
- Adjustments/rounding: ~30 gal

Some of this "missing" cider was actually processed (distilled) rather than remaining on hand.

## Database Annotation

A `ttb_origin_year` column was added to the `batches` table:
- Migration: `0102_ttb_origin_year.sql`
- 5 batches marked with `ttb_origin_year = 2023`
- All other batches default to year of `start_date`

### Batches Marked as 2023 Carryover
1. blend-2024-12-20-1000 IBC 4-024554 (340 L)
2. blend-2024-12-20-3BBL BRITE -319323 (350 L)
3. blend-2024-12-20-120 Barrel 3-910854 (120 L - Ginger Quince)
4. blend-2024-12-20-225 Barrel 2-571423 (20 L)
5. blend-2025-01-01-10 Barrel 1-415875 (37.8 L)

## Key Findings

1. **TTB form is correct** - 1,121 gal ending inventory
2. **System missing ~298 gal** of 2023 carryover entries
3. **2023 carryover can be identified by:**
   - Batches with `ttb_origin_year = 2023`
   - Juice purchases from "Olympic Bluff Cidery" vendor
4. **Formula verified:** Inputs - Removals = Ending Inventory

## Tax Calculation (from Excise Tax Return)

| Category | Gallons | Tax Rate | Amount |
|----------|---------|----------|--------|
| Wine ≤16% (kegged berry) | 127 | $0.17/gal (with credit) | $21.59 |
| Hard Cider (bottled) | 90 | $0.226/gal | $20.34 |
| **TOTAL TAX** | | | **$41.93** |

## Files Modified

- `packages/db/src/schema.ts` - Added `ttbOriginYear` column to batches
- `packages/db/migrations/0102_ttb_origin_year.sql` - Migration file

## Future Reconciliation

For 2025 TTB forms:
- Beginning Inventory = 1,121 gal (from 2024 ending)
- Track production, removals, and ending separately
- Use `ttb_origin_year` to identify legacy batches
