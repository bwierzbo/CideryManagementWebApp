# Dashboard Design Specification

*Cidery Management App — Version 1.0*
*Created: December 12, 2025*

---

## Overview

The dashboard is the first screen users see when they open the app. It should provide an at-a-glance view of cidery operations and enable quick access to common tasks. The design prioritizes clarity over comprehensiveness — showing what matters most for nano/small cideries without overwhelming the user.

---

## Design Principles

| Principle | Description |
|-----------|-------------|
| **Glanceable** | Key status visible in 3 seconds or less |
| **Actionable** | Every widget leads somewhere useful |
| **Role-appropriate** | Show what a cidery owner/operator needs, not everything possible |
| **Progressive disclosure** | Overview first, details on drill-down |
| **Mobile-friendly** | Works well on phone in the cellar |

### Color Coding Standard

| Color | Meaning | Usage |
|-------|---------|-------|
| Green | Normal / On track | Healthy batches, good inventory levels |
| Yellow/Amber | Needs attention | Approaching thresholds, upcoming tasks |
| Red | Act now | Overdue tasks, critical alerts, empty inventory |
| Blue | Informational | Neutral status, in-progress items |
| Gray | Inactive / Empty | Empty vessels, completed items |

---

## Dashboard Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│  HEADER: Logo / App Name          [Search] [Notifications] [User]  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐   │
│  │ METRIC CARD │ │ METRIC CARD │ │ METRIC CARD │ │ METRIC CARD │   │
│  │ Active      │ │ Ready to    │ │ Gallons in  │ │ TTB Period  │   │
│  │ Batches     │ │ Package     │ │ Production  │ │ Status      │   │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────┐ ┌─────────────────────────────┐│
│  │                                 │ │                             ││
│  │  CELLAR SNAPSHOT                │ │  QUICK ACTIONS              ││
│  │  (Mini vessel map)              │ │                             ││
│  │                                 │ │  [Record Measurement]       ││
│  │  [Tank] [Tank] [Barrel]         │ │  [Log Purchase]             ││
│  │  [IBC]  [IBC]  [Keg]            │ │  [Start Press Run]          ││
│  │                                 │ │  [Package Batch]            ││
│  │  Click to expand →              │ │  [Generate TTB Report]      ││
│  │                                 │ │                             ││
│  └─────────────────────────────────┘ └─────────────────────────────┘│
│                                                                     │
│  ┌─────────────────────────────────┐ ┌─────────────────────────────┐│
│  │                                 │ │                             ││
│  │  ATTENTION NEEDED               │ │  RECENT ACTIVITY            ││
│  │                                 │ │                             ││
│  │  ⚠️ Perry #2: 51 days, no       │ │  • SG logged: Northern Spy  ││
│  │     measurement in 14 days      │ │    (2 hours ago)            ││
│  │  ⚠️ Low inventory: Dry Cider    │ │  • Racking: Summer Blend 3  ││
│  │     (12 bottles remaining)      │ │    (yesterday)              ││
│  │  🔴 TTB report due in 3 days    │ │  • Purchase: 500 lbs Gala   ││
│  │                                 │ │    (2 days ago)             ││
│  └─────────────────────────────────┘ └─────────────────────────────┘│
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │  ACTIVE BATCHES                                          [View All]│
│  │                                                                   ││
│  │  Batch Name          Vessel        Status      Days   Last SG    ││
│  │  ───────────────────────────────────────────────────────────────  ││
│  │  Northern Spy        10 Barrel 1   Fermenting   2     1.055     ││
│  │  Summer Blend 4      1000 IBC 2    Aging       51     0.998     ││
│  │  Perry #2            1000 SS 1     Aging       51     1.002     ││
│  │  Raspberry Black...  225 Barrel 2  Conditioning 30    0.996     ││
│  │                                                                   ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Component Specifications

### 1. Metric Cards (Top Row)

Four key metrics displayed as cards. Each card is clickable and navigates to the relevant detail page.

#### Card 1: Active Batches

| Element | Specification |
|---------|---------------|
| Primary number | Count of batches with status != 'completed' and != 'archived' |
| Subtitle | Breakdown by status (e.g., "8 fermenting, 6 aging, 4 conditioning") |
| Click action | Navigate to Batches list, filtered to active |
| Color logic | Green if all healthy, Yellow if any need attention, Red if any critical |

#### Card 2: Ready to Package

| Element | Specification |
|---------|---------------|
| Primary number | Count of batches where status = 'conditioning' AND carbonation complete |
| Subtitle | Total gallons ready (e.g., "~150 gallons") |
| Click action | Navigate to Batches list, filtered to ready-to-package |
| Color logic | Blue (informational), Green if > 0 |

#### Card 3: Gallons in Production

| Element | Specification |
|---------|---------------|
| Primary number | Sum of currentVolumeLiters for all active batches, converted to gallons |
| Subtitle | Comparison to last month or capacity (e.g., "+12% vs last month") |
| Click action | Navigate to Production Overview or Batches |
| Color logic | Blue (informational) |

#### Card 4: TTB Period Status

| Element | Specification |
|---------|---------------|
| Primary display | Current period (e.g., "December 2025") |
| Subtitle | Days until due, or "Report submitted" |
| Click action | Navigate to TTB Reports |
| Color logic | Green if submitted, Yellow if <14 days, Red if <7 days or overdue |

---

### 2. Cellar Snapshot (Mini Vessel Map)

A compact visual representation of vessels and their current state.

| Element | Specification |
|---------|---------------|
| Layout | Grid of vessel icons/cards, grouped by location if configured |
| Vessel display | Small card with: Name, Fill level bar, Current batch name (truncated) |
| Fill level colors | Green (0-50%), Blue (51-85%), Yellow (86-95%), Red (96-100%) |
| Empty vessel | Gray, labeled "Empty" |
| Vessel icons | Optional: Different shapes for tank vs barrel vs IBC |
| Click action (vessel) | Navigate to vessel detail or batch detail |
| Click action (expand) | Navigate to full Cellar / Vessel Map page |
| Max vessels shown | 8-12 (configurable), with "+X more" indicator if exceeded |

---

### 3. Quick Actions (Sidebar)

Buttons for the most common tasks. These should be the actions performed daily or weekly.

| Action | Icon | Destination |
|--------|------|-------------|
| Record Measurement | 📏 or thermometer | Modal or page to log SG/pH/temp for a batch |
| Log Purchase | 📦 | New fruit/material purchase form |
| Start Press Run | 🍎 | New press run form |
| Package Batch | 🍾 | New bottle run or keg fill form |
| Generate TTB Report | 📋 | TTB report generation page |

**Configuration:** Quick Actions should be configurable in Settings. Users can show/hide actions based on their workflow. For example, a juice-purchaser would hide "Start Press Run."

---

### 4. Attention Needed (Alerts)

A list of items requiring user action, sorted by urgency.

| Alert Type | Trigger Condition | Priority |
|------------|-------------------|----------|
| TTB report overdue | Due date passed, status != submitted | Critical (Red) |
| TTB report due soon | Due date within 7 days | High (Yellow) |
| Batch stalled | No measurements logged in X days (configurable, default 14) | Medium (Yellow) |
| Low inventory | Packaged inventory below threshold | Medium (Yellow) |
| Batch aging long | Active days > threshold (configurable, default 90) | Low (Blue) |
| Empty vessel available | Vessel has no batch assigned | Info (Gray) |

**Display:**
- Show top 5 alerts by default
- "View all" link if more exist
- Each alert is clickable → navigates to relevant entity
- Dismissable? (TBD — may want persistent until resolved)

**No alerts state:** Display friendly message: "✓ All clear — no items need attention"

---

### 5. Recent Activity

A timeline of recent actions taken in the system.

| Element | Specification |
|---------|---------------|
| Source | Query recent entries from: batchMeasurements, batchAdditives, batchRackingOperations, batchTransfers, fruitPurchases, bottleRuns, kegFills |
| Display | Activity description, batch/entity name, relative timestamp |
| Max items | 5-7 most recent |
| Click action | Navigate to the relevant entity detail page |

**Activity format examples:**
- "SG logged for Northern Spy (1.055) — 2 hours ago"
- "Racking completed: Summer Blend 3 — yesterday"
- "Purchase recorded: 500 lbs Gala from Smith Orchard — 2 days ago"
- "Bottled: 144 bottles of Dry Cider — 3 days ago"

---

### 6. Active Batches Table

A sortable list of current production batches.

| Column | Data Source | Sortable |
|--------|-------------|----------|
| Batch Name | batches.name or batches.customName | Yes |
| Vessel | vessels.name (via batches.vesselId) | Yes |
| Status | batches.status | Yes |
| Days Active | Calculated: today - batches.createdAt | Yes |
| Last SG | Most recent batchMeasurements.specificGravity | Yes |
| ABV | batches.abv (if calculated) | Yes |

**Default sort:** Days Active descending (oldest first — these likely need attention)

**Row click:** Navigate to batch detail page

**View All:** Navigate to full Batches list

**Max rows:** 5-10, configurable

---

## Mobile Layout

On mobile (< 768px), the dashboard stacks vertically:

```
┌─────────────────────────┐
│  Metric Cards (2x2)     │
├─────────────────────────┤
│  Quick Actions          │
│  (horizontal scroll or  │
│   expandable)           │
├─────────────────────────┤
│  Attention Needed       │
├─────────────────────────┤
│  Cellar Snapshot        │
│  (compact grid)         │
├─────────────────────────┤
│  Active Batches         │
│  (card view, not table) │
├─────────────────────────┤
│  Recent Activity        │
└─────────────────────────┘
```

**Mobile-specific considerations:**
- Quick Actions as floating action button (FAB) with expandable menu
- Metric cards as 2x2 grid
- Active Batches as cards instead of table rows
- Touch-friendly tap targets (min 44px)

---

## Data Requirements

### Queries Needed

```typescript
// 1. Active batch count and breakdown
SELECT status, COUNT(*) FROM batches 
WHERE status NOT IN ('completed', 'archived') 
GROUP BY status;

// 2. Ready to package
SELECT * FROM batches 
WHERE status = 'conditioning' 
AND EXISTS (carbonation operation marked complete);

// 3. Total volume in production
SELECT SUM(currentVolumeLiters) FROM batches 
WHERE status NOT IN ('completed', 'archived');

// 4. TTB period status
SELECT * FROM ttbReportingPeriods 
WHERE year = currentYear AND month = currentMonth;

// 5. Vessels with current batch
SELECT v.*, b.name as batchName, b.currentVolumeLiters 
FROM vessels v 
LEFT JOIN batches b ON b.vesselId = v.id AND b.status != 'completed';

// 6. Alerts (multiple queries or complex joins)
// - Batches with no recent measurements
// - Low inventory items
// - TTB due dates

// 7. Recent activity (union of multiple tables)
// - Last 10 measurements, additives, rackings, purchases, packaging ops
// - Ordered by timestamp descending

// 8. Active batches list
SELECT b.*, v.name as vesselName, 
       (SELECT specificGravity FROM batchMeasurements 
        WHERE batchId = b.id ORDER BY measuredAt DESC LIMIT 1) as lastSg
FROM batches b
LEFT JOIN vessels v ON b.vesselId = v.id
WHERE b.status NOT IN ('completed', 'archived')
ORDER BY b.createdAt ASC
LIMIT 10;
```

---

## Configuration Options (Settings Integration)

These dashboard preferences should be stored in `organizationSettings` or a separate `dashboardSettings` table:

| Setting | Options | Default |
|---------|---------|---------|
| Metric cards visible | Multi-select from available metrics | All 4 |
| Quick actions visible | Multi-select from available actions | All 5 |
| Stalled batch threshold | Number of days | 14 |
| Long aging threshold | Number of days | 90 |
| Low inventory threshold | Number of units | 24 |
| Max vessels in snapshot | Number | 12 |
| Max batches in list | Number | 10 |
| Default batch sort | Column + direction | Days Active DESC |

---

## Empty States

### New User (No Data)

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│                    Welcome to [App Name]! 🍎                        │
│                                                                     │
│     Let's get your cidery set up. Here's where to start:           │
│                                                                     │
│     1. [Add your vessels] — Tell us about your tanks and barrels   │
│     2. [Record a purchase] — Log your first fruit or juice         │
│     3. [Start a press run] — Begin your first batch                │
│                                                                     │
│     Or, [Import existing data] if you have records to bring in.    │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### No Active Batches

- Metric card shows "0" with subtitle "Start your first batch →"
- Active Batches section shows: "No active batches. [Start a press run] to begin."

### No Alerts

- Attention Needed shows: "✓ All clear — no items need attention"

---

## Performance Considerations

| Concern | Mitigation |
|---------|------------|
| Dashboard load time | Cache aggregated metrics, refresh on interval or action |
| Many batches | Paginate or limit, with "View All" link |
| Many vessels | Limit snapshot to configurable max |
| Real-time updates | Consider polling interval (30-60 seconds) or WebSocket for critical alerts |

**Target:** Dashboard should load in < 2 seconds on desktop, < 3 seconds on mobile.

---

## Implementation Phases

### Phase 1: Core Metrics + Batch List
- [ ] Metric cards (4)
- [ ] Active Batches table
- [ ] Basic click-through navigation

### Phase 2: Visual Elements
- [ ] Cellar Snapshot (mini vessel map)
- [ ] Recent Activity feed
- [ ] Mobile layout

### Phase 3: Intelligence
- [ ] Attention Needed alerts
- [ ] Alert threshold configuration
- [ ] Empty states and onboarding

### Phase 4: Polish
- [ ] Quick Actions (configurable)
- [ ] Dashboard settings/preferences
- [ ] Performance optimization

---

## Open Questions

1. **Notifications:** Should alerts also appear as push notifications or just on dashboard?

2. **Multiple users:** Do different users see different dashboards, or is it organization-wide?

3. **Time period selector:** Should dashboard show "today" vs "this week" vs "this month" data?

4. **Comparison metrics:** Show vs last month? vs same month last year? vs target?

5. **Widget customization:** Should users be able to rearrange dashboard widgets (drag-and-drop)?

---

## Appendix: Competitor Reference

### Ekos Dashboard Features
- 150+ metrics dashboards
- Facility floorplan view
- Quick Overview for financial activity
- Fermentation data graphs

### Breww Dashboard Features
- KPI tracking dashboard
- Color-coded vessel view with fill levels
- Icons for vessel status (cleaning, carbonating, chilling)
- Interactive schedule calendar
- Batch planning tools

### Design Inspiration Sources
- Manufacturing dashboard best practices (role-based views, color coding)
- Real-time production monitoring patterns
- Mobile-first cellar entry workflows

---

*This specification will be updated as implementation progresses and user feedback is gathered.*
