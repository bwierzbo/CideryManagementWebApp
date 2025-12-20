# Cidery App — Action Item Summary

*Generated: December 10, 2025*

---

## High Priority

| # | Capability | Category | Description |
|---|------------|----------|-------------|
| A | Dashboard that works | Core | Functional metrics, quick actions, at-a-glance status |
| B | Recipe management | Core | Recipe schema + UI — foundation for planning and consistency |
| C | TTB report auto-generation | Compliance | Auto-populate Form 5120.17 from production data |
| E | Spirits inventory + fortified batches | Product Line | Track TIB receipts, brandy inventory, link to source cider batch, enable pommeau production |
| S | Undo / revision history | Differentiator | Audit log, view history, restore previous states |
| T | Auto-save | Differentiator | Never lose work — continuous draft saving |
| X | Mobile-optimized cellar entry | Differentiator | Touch-friendly, works with wet hands, quick measurement logging |
| AD | Settings / configuration module | Differentiator | Tailor workflow to operation type (orchard vs juice, bottles vs kegs, etc.) |
| AE | Input validation & business rules | Differentiator | Prevent impossible/nonsensical inputs, smart defaults, warnings vs blocks |

---

## Medium Priority

| # | Capability | Category | Description |
|---|------------|----------|-------------|
| D | Planning module | Strategic | Production planning, vessel/equipment scheduling, material requirements, financial projections |
| F | Barrel-specific tracking | Product Line | Age, toast level, previous contents, fill history |
| G | COGS calculation | Financial | True cost per unit across all inputs |
| J | ABV/CO₂ tax class validation | Compliance | Ensure 7-8.5% ABV ciders meet CO₂ threshold for $0.226 rate |
| U | Progressive disclosure / onboarding | Differentiator | Simple by default, reveal advanced features as needed |
| V | Flexible / custom reports | Differentiator | User-defined reports, filters, exports |
| AA | Voice input | Differentiator | Hands-free data entry in cellar |

---

## Lower Priority (Strategic)

| # | Capability | Category | Description |
|---|------------|----------|-------------|
| H | Pricing table by channel/package | Financial | Required for margin analysis and planning projections |
| I | Sales reporting / margin analysis | Financial | Business intelligence on profitability |
| L | Lot code traceability report | Compliance | Full trace from fruit to package for recall readiness |
| W | Open API | Differentiator | Enable custom integrations, data portability |
| AB | AI cider expert | Differentiator | Recommendations, troubleshooting, style guidance |
| Y | Feedback loop / roadmap visibility | Differentiator | User feature requests, voting, transparency |

---

## Parking Lot (Future)

| # | Capability | Category | Description |
|---|------------|----------|-------------|
| K | COLA (label approval) tracking | Compliance | Store label approvals for reference |
| M | Vessel map filtering | UX | Filter by status (fermenting/aging/empty) |
| N | Batch naming display | UX | Show custom name first, date second |
| P | Wholesale account management | Growth | Customer/account tracking when wholesale scales |
| Q | Sanitation / cleaning logs | Operations | Audit readiness |
| R | Equipment maintenance scheduling | Operations | Preventive maintenance tracking |
| 11 | TTB tax class for fortified products | Compliance | Research reporting requirements for pommeau |
| 12 | Brite tank workflow | Operations | UI for "fill from brite → multiple kegs" when ready |

---

## Baseline Expectations

| # | Item | Description |
|---|------|-------------|
| Z | Fast, responsive app | No Ekos-style slowdowns |
| AC | Modern UX | Clean, intuitive, not legacy feel |

---

## Schema Work Required

| Item | Table/Change Needed |
|------|---------------------|
| B - Recipes | New `recipes` + `recipeIngredients` tables |
| E - Spirits | New `spiritsInventory` table |
| E - Fortified | Add `spirits` to `batchCompositions.sourceType`, add `fortified` batch type |
| F - Barrels | Add barrel-specific fields to vessels or new `barrelDetails` table |
| H - Pricing | New `productPricing` table (channel × package size × price) |
| S - Undo | New `auditLog` table (entity, field, old value, new value, user, timestamp) |
| AD - Settings | New `organizationSettings` table |

---

## Differentiators vs. Ekos

| Ekos Weakness | Your Answer |
|---------------|-------------|
| Hard to correct mistakes | Undo / revision history |
| No auto-save | Auto-save everything |
| Overwhelming for beginners | Progressive disclosure + settings to hide unused features |
| Reporting not customizable | Flexible custom reports |
| No public API | Open API |
| Mobile app problematic | Mobile-first cellar experience |
| Feature requests ignored | Feedback loop + roadmap visibility |
| Server performance | Modern stack (Neon/Vercel) |

---

## Unique Features

| Feature | Description |
|---------|-------------|
| Voice input | Hands-free cellar entry |
| AI cider expert | Style guidance, troubleshooting |
| Tailored workflows | Settings hide what you don't use |
| Input validation | Can't enter bad data |

---

## Production Workflow Reference

```
┌─────────────────────────────────────────────────────────────────────┐
│                         FRUIT ACQUISITION                           │
│  Purchase/Harvest → Storage/Sweating → Wash/Sort                   │
└─────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────┐
│                         JUICE EXTRACTION                            │
│  Mill → Press → Treat (sulfite, enzyme, settle)                    │
└─────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────┐
│                          FERMENTATION                               │
│  Pitch Yeast → Monitor (SG, temp, pH) → Fermentation Complete      │
└─────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────┐
│                      POST-FERMENTATION                              │
│  Rack → Age → Blend → Fine/Filter → Adjust                         │
└─────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────┐
│                          CARBONATION                                │
│  Forced (tank/keg) OR Bottle Conditioning OR Still                 │
└─────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────┐
│                           PACKAGING                                 │
│  Fill (bottles/cans/kegs) → Pasteurize? → QC → Lot Code           │
└─────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────┐
│                      INVENTORY & SALES                              │
│  Stock → Sell (by channel) → Adjust (breakage, samples)           │
└─────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────┐
│                        TTB REPORTING                                │
│  Monthly: Inventory + Production + Removals + Tax                  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Settings Module — Key Configuration Areas

### Operation Profile
- Fruit source: Own orchard / Purchase fruit / Purchase juice / Mixed
- Production scale: Nano / Small / Medium
- Primary products: Cider / Perry / Fortified

### Workflow Configuration
- Packaging types: Bottles / Cans / Kegs / Bag-in-box
- Carbonation methods: Forced / Bottle conditioning / Pét-nat / Still
- Filtration: Yes / No
- Pasteurization: Yes / No
- Barrel aging: Yes / No

### Sales Configuration
- Active sales channels: Tasting room / Wholesale / Online DTC / Events
- POS integration: Square / Toast / None

### Compliance Configuration
- TTB reporting required: Yes / No
- State selection
- Small producer credit: Yes / No

### UX Preferences
- Units: Imperial / Metric / Both
- Date format
- Temperature unit
- Theme: Light / Dark / System
- Density units: SG / Brix / Plato

---

## Input Validation — Key Rules

### Range Validation
- Date: 10 years ago → Today + 1 year
- Volume: 0.1 gal → Vessel capacity
- ABV: 0% → 25%
- SG: 0.990 → 1.200
- pH: 0 → 14
- CO₂ volumes: 0 → 5.0

### Logical Validation
- End date ≥ Start date
- Output ≤ Input
- FG ≤ OG
- Fill ≤ Vessel capacity
- Loss ≤ Starting volume
- Blend percentages sum to 100%

### Sequence Validation
- Press run must complete before batch creation
- Fermentation must complete before carbonation
- Batch must have volume before packaging
- Inventory must exist before distribution

---

*This document will be updated as priorities change and items are completed.*
