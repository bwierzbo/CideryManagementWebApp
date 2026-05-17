/**
 * Builds human-readable messages for the dashboard "Recent Activity" widget
 * from raw audit_log rows. Performs ID → name lookups (batch, vessel, vendor)
 * so the widget can render a single descriptive line per entry.
 */

import { db, batches, vessels, vendors } from "db";
import { inArray } from "drizzle-orm";

export interface RawActivityRow {
  id: string;
  tableName: string;
  recordId: string;
  operation: string;
  changedAt: Date;
  changedByEmail: string | null;
  oldData: unknown;
  newData: unknown;
  userName: string | null;
  userEmail: string | null;
}

export interface FormattedActivity {
  id: string;
  tableName: string;
  recordId: string;
  operation: string;
  changedAt: Date;
  userName: string;
  message: string;
  /**
   * False if the referenced record has been soft-deleted (or never existed).
   * The widget uses this to suppress dead-end links.
   */
  linkable: boolean;
}

type Json = Record<string, any> | null | undefined;

function get(d: Json, ...keys: string[]): any {
  if (!d) return undefined;
  for (const k of keys) {
    if (k in d && d[k] !== null && d[k] !== undefined) return d[k];
  }
  return undefined;
}

function num(v: any): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function fmtSG(v: any): string | null {
  const n = num(v);
  return n === null ? null : `SG ${n.toFixed(3)}`;
}
function fmtPH(v: any): string | null {
  const n = num(v);
  return n === null ? null : `pH ${n.toFixed(1)}`;
}
function fmtTemp(v: any): string | null {
  const n = num(v);
  return n === null ? null : `${Math.round(n)}°C`;
}
function fmtVol(v: any, unit?: string): string | null {
  const n = num(v);
  if (n === null) return null;
  const u = unit || "L";
  return Number.isInteger(n) ? `${n}${u}` : `${n.toFixed(1)}${u}`;
}

function titleCase(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Convert camelCase or snake_case schema field names into operator-friendly
 * labels for the activity feed. e.g. "originalGravity" → "original gravity",
 * "actual_abv" → "actual abv".
 */
function humanizeFieldName(field: string): string {
  return field
    // Insert space between camelCase boundaries
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    // snake_case → spaces
    .replace(/_/g, " ")
    .toLowerCase();
}

/**
 * Collect all referenced batch/vessel/vendor IDs from the audit rows so we
 * can batch-fetch their display names in one query each.
 */
function collectIds(rows: RawActivityRow[]) {
  const batchIds = new Set<string>();
  const vesselIds = new Set<string>();
  const vendorIds = new Set<string>();

  for (const r of rows) {
    const data = (r.newData ?? r.oldData ?? {}) as Json;

    if (r.tableName === "batches") batchIds.add(r.recordId);
    if (r.tableName === "vessels") vesselIds.add(r.recordId);
    if (r.tableName === "vendors") vendorIds.add(r.recordId);

    const batchId = get(data, "batchId", "batch_id");
    const sourceBatchId = get(data, "sourceBatchId", "source_batch_id");
    const destBatchId = get(data, "destinationBatchId", "destination_batch_id");
    const vesselId = get(data, "vesselId", "vessel_id");
    const sourceVesselId = get(data, "sourceVesselId", "source_vessel_id");
    const destVesselId = get(data, "destinationVesselId", "destination_vessel_id");
    const vendorId = get(data, "vendorId", "vendor_id");

    if (typeof batchId === "string") batchIds.add(batchId);
    if (typeof sourceBatchId === "string") batchIds.add(sourceBatchId);
    if (typeof destBatchId === "string") batchIds.add(destBatchId);
    if (typeof vesselId === "string") vesselIds.add(vesselId);
    if (typeof sourceVesselId === "string") vesselIds.add(sourceVesselId);
    if (typeof destVesselId === "string") vesselIds.add(destVesselId);
    if (typeof vendorId === "string") vendorIds.add(vendorId);

    // For batches.update where vessel changed, look at oldData too
    if (r.tableName === "batches" && r.oldData) {
      const oldVesselId = get(r.oldData as Json, "vesselId", "vessel_id");
      if (typeof oldVesselId === "string") vesselIds.add(oldVesselId);
    }
  }

  return { batchIds, vesselIds, vendorIds };
}

interface Lookups {
  batchById: Map<string, { batchNumber: string; customName: string | null; vesselId: string | null; deleted: boolean }>;
  vesselNameById: Map<string, string>;
  vesselDeletedById: Map<string, boolean>;
  vendorNameById: Map<string, string>;
}

async function fetchLookups(ids: ReturnType<typeof collectIds>): Promise<Lookups> {
  const [batchRows, vesselRows, vendorRows] = await Promise.all([
    ids.batchIds.size > 0
      ? db
          .select({
            id: batches.id,
            batchNumber: batches.batchNumber,
            customName: batches.customName,
            vesselId: batches.vesselId,
            deletedAt: batches.deletedAt,
          })
          .from(batches)
          .where(inArray(batches.id, Array.from(ids.batchIds)))
      : Promise.resolve([] as { id: string; batchNumber: string; customName: string | null; vesselId: string | null; deletedAt: Date | null }[]),
    ids.vesselIds.size > 0
      ? db
          .select({ id: vessels.id, name: vessels.name, deletedAt: vessels.deletedAt })
          .from(vessels)
          .where(inArray(vessels.id, Array.from(ids.vesselIds)))
      : Promise.resolve([] as { id: string; name: string | null; deletedAt: Date | null }[]),
    ids.vendorIds.size > 0
      ? db
          .select({ id: vendors.id, name: vendors.name })
          .from(vendors)
          .where(inArray(vendors.id, Array.from(ids.vendorIds)))
      : Promise.resolve([] as { id: string; name: string }[]),
  ]);

  const lookups: Lookups = {
    batchById: new Map(),
    vesselNameById: new Map(),
    vesselDeletedById: new Map(),
    vendorNameById: new Map(),
  };

  for (const b of batchRows) {
    lookups.batchById.set(b.id, {
      batchNumber: b.batchNumber,
      customName: b.customName,
      vesselId: b.vesselId,
      deleted: b.deletedAt !== null,
    });
  }
  for (const v of vesselRows) {
    if (v.name) lookups.vesselNameById.set(v.id, v.name);
    lookups.vesselDeletedById.set(v.id, v.deletedAt !== null);
  }
  for (const v of vendorRows) {
    lookups.vendorNameById.set(v.id, v.name);
  }

  // Backfill: any vessel referenced via a batch's vesselId
  const extraVesselIds = new Set<string>();
  for (const b of lookups.batchById.values()) {
    if (b.vesselId && !lookups.vesselNameById.has(b.vesselId)) {
      extraVesselIds.add(b.vesselId);
    }
  }
  if (extraVesselIds.size > 0) {
    const more = await db
      .select({ id: vessels.id, name: vessels.name })
      .from(vessels)
      .where(inArray(vessels.id, Array.from(extraVesselIds)));
    for (const v of more) {
      if (v.name) lookups.vesselNameById.set(v.id, v.name);
    }
  }

  return lookups;
}

function batchLabel(id: string | undefined, lookups: Lookups): string {
  if (!id) return "?";
  const b = lookups.batchById.get(id);
  if (!b) return "?";
  return b.customName || b.batchNumber;
}

function vesselLabel(id: string | undefined, lookups: Lookups): string {
  if (!id) return "?";
  return lookups.vesselNameById.get(id) || "?";
}

function vendorLabel(id: string | undefined, lookups: Lookups): string {
  if (!id) return "?";
  return lookups.vendorNameById.get(id) || "?";
}

/** Compare old/new for a list of fields, return [field, oldVal, newVal] for changed ones. */
function changedFields(
  oldData: Json,
  newData: Json,
  fields: string[],
): Array<[string, any, any]> {
  if (!oldData || !newData) return [];
  const changes: Array<[string, any, any]> = [];
  for (const f of fields) {
    const o = (oldData as any)[f];
    const n = (newData as any)[f];
    // Loose equality across number/string for decimals stored as text
    if (String(o ?? "") !== String(n ?? "")) {
      changes.push([f, o, n]);
    }
  }
  return changes;
}

function buildMeasurementMessage(r: RawActivityRow, lookups: Lookups): string {
  const data = (r.newData ?? r.oldData ?? {}) as Json;
  const batchId = get(data, "batchId", "batch_id");
  const batch = batchId ? lookups.batchById.get(batchId) : undefined;
  const batchName = batch ? batch.customName || batch.batchNumber : "?";
  const vesselName = batch?.vesselId
    ? lookups.vesselNameById.get(batch.vesselId) || ""
    : "";
  const inVessel = vesselName ? ` in ${vesselName}` : "";

  if (r.operation === "create") {
    const parts = [
      fmtSG(get(data, "specificGravity", "specific_gravity")),
      fmtPH(get(data, "ph")),
      fmtTemp(get(data, "temperature")),
      fmtVol(get(data, "volume"), get(data, "volumeUnit", "volume_unit")),
    ].filter(Boolean) as string[];
    const detail = parts.length ? ` · ${parts.join(", ")}` : "";
    return `Measurement on ${batchName}${inVessel}${detail}`;
  }

  if (r.operation === "update") {
    const fields = ["specificGravity", "ph", "temperature", "volume", "abv", "totalAcidity", "sensoryNotes", "notes"];
    const changes = changedFields(r.oldData as Json, r.newData as Json, fields);
    if (changes.length === 0) {
      return `Measurement updated on ${batchName}${inVessel}`;
    }
    const [field, oldV, newV] = changes[0];
    const labelMap: Record<string, (v: any) => string | null> = {
      specificGravity: (v) => fmtSG(v),
      ph: (v) => fmtPH(v),
      temperature: (v) => fmtTemp(v),
      volume: (v) => fmtVol(v),
    };
    if (labelMap[field]) {
      const oldStr = labelMap[field](oldV) ?? "—";
      const newStr = labelMap[field](newV) ?? "—";
      // Strip the prefix from old (e.g., "SG 1.012" -> just keep prefix on new)
      const prefix = newStr.split(" ")[0];
      const oldNum = oldStr.replace(`${prefix} `, "");
      const newNum = newStr.replace(`${prefix} `, "");
      return `Measurement updated on ${batchName}${inVessel} · ${prefix} ${oldNum} → ${newNum}`;
    }
    return `Measurement updated on ${batchName}${inVessel} · ${titleCase(field)}`;
  }

  return `Measurement ${r.operation} on ${batchName}${inVessel}`;
}

function describeBatchStatusChange(name: string, oldStatus: string | null, newStatus: string): string {
  // Show explicit "from X to Y" so operators see exactly what changed.
  // Falls back to a one-sided message if old status is unknown.
  const from = oldStatus ? titleCase(oldStatus) : null;
  const to = titleCase(newStatus);
  if (newStatus === "discarded") {
    return from ? `${name} discarded (was ${from})` : `${name} discarded`;
  }
  if (newStatus === "completed") {
    // Note: when contents are transferred to another vessel, the source row
    // closes but the cider lives on under a new batch ID. "closed" is
    // intentionally vague — it doesn't necessarily mean the cider is done.
    return from ? `${name} batch closed (was ${from})` : `${name} batch closed`;
  }
  return from
    ? `${name} status: ${from} → ${to}`
    : `${name} now ${to}`;
}

/**
 * Detects "metadata-only" audit rows — rows that don't reflect a real change
 * to the entity's columns but use the audit log to record an event with
 * arbitrary keys (e.g., autoEmptied, previousStatus, residualVolumeL,
 * reason). Without this check, the single-field fallback ends up surfacing
 * meaningless field names like "previousStatus" to the user.
 */
function describeMetaEvent(name: string, oldData: Json, newData: Json): string | null {
  const merged = { ...(oldData || {}), ...(newData || {}) } as Record<string, any>;
  // Auto-empty event after a transfer leaves a residual under the minimum
  if (merged.autoEmptied === true || merged.previousStatus !== undefined) {
    const residual = merged.residualVolumeL;
    const residualStr = typeof residual === "number"
      ? ` (residual ${residual.toFixed(2)}L)`
      : "";
    return `${name} auto-completed${residualStr}`;
  }
  return null;
}

function buildBatchMessage(r: RawActivityRow, lookups: Lookups): string {
  const data = (r.newData ?? {}) as Json;
  const batch = lookups.batchById.get(r.recordId);
  const name = batch?.customName || batch?.batchNumber || (get(data, "batchNumber", "batch_number") as string) || "?";

  if (r.operation === "create") {
    const vesselId = get(data, "vesselId", "vessel_id");
    const vesselName = vesselId ? lookups.vesselNameById.get(vesselId) : null;
    return vesselName
      ? `Batch ${name} created in ${vesselName}`
      : `Batch ${name} created`;
  }

  if (r.operation === "update" && r.oldData && r.newData) {
    const old = r.oldData as Json;
    const nw = r.newData as Json;

    // Detect metadata-only audit rows (auto-empty, etc.) before falling into
    // the regular field-diff path — they have non-schema keys like
    // `previousStatus` that would otherwise leak into the message.
    const metaMessage = describeMetaEvent(name, old, nw);
    if (metaMessage) return metaMessage;

    // Status change wins. Show explicit FROM → TO.
    const oldStatus = get(old, "status");
    const newStatus = get(nw, "status");
    if (oldStatus !== newStatus && newStatus) {
      return describeBatchStatusChange(name, oldStatus ? String(oldStatus) : null, String(newStatus));
    }

    // Vessel change next. Note: in this system a transfer creates a NEW batch
    // in the destination vessel, then sets the source batch's vesselId to null
    // — so "vesselId → null" really means "the cider was transferred out and
    // now lives under a new batch ID elsewhere", not that it was discarded.
    const oldVessel = get(old, "vesselId", "vessel_id");
    const newVessel = get(nw, "vesselId", "vessel_id");
    if (oldVessel !== newVessel) {
      const fromName = oldVessel ? lookups.vesselNameById.get(oldVessel) || "a vessel" : null;
      const toName = newVessel ? lookups.vesselNameById.get(newVessel) || "a vessel" : null;

      if (fromName && !toName) return `${name} emptied from ${fromName}`;
      if (!fromName && toName) return `${name} placed in ${toName}`;
      if (fromName && toName) return `${name} moved from ${fromName} → ${toName}`;
    }

    // Custom name change
    const oldCustomName = get(old, "customName", "custom_name");
    const newCustomName = get(nw, "customName", "custom_name");
    if (oldCustomName !== newCustomName && newCustomName) {
      const from = oldCustomName ? `"${oldCustomName}"` : "(unnamed)";
      return `Batch renamed from ${from} to "${newCustomName}"`;
    }

    // Volume change
    const oldVol = get(old, "currentVolume", "current_volume");
    const newVol = get(nw, "currentVolume", "current_volume");
    if (oldVol !== newVol && newVol !== undefined) {
      const oldN = num(oldVol);
      const newN = num(newVol);
      if (oldN !== null && newN !== null) {
        const delta = newN - oldN;
        const sign = delta > 0 ? "+" : "";
        return `${name} volume: ${oldN.toFixed(1)}L → ${newN.toFixed(1)}L (${sign}${delta.toFixed(1)}L)`;
      }
    }

    // Single-field fallback — but skip noisy/internal fields and only mention
    // the field if it's something an operator would recognize.
    const ignoreFields = new Set([
      "updatedAt", "updated_at",
      "currentVolumeLiters", "current_volume_liters",
      "currentVolumeUnit", "current_volume_unit",
      "fermentationStageUpdatedAt", "fermentation_stage_updated_at",
    ]);
    const candidateFields = Object.keys(nw || {}).filter((k) => !ignoreFields.has(k));
    const changes = changedFields(old, nw, candidateFields);
    if (changes.length === 1) {
      return `${name} updated · ${humanizeFieldName(changes[0][0])}`;
    }
    if (changes.length > 1) {
      return `${name} updated · ${changes.length} fields`;
    }
    return `${name} updated`;
  }

  if (r.operation === "soft_delete" || r.operation === "delete") {
    return `${name} deleted`;
  }
  return `Batch ${name} ${r.operation}`;
}

/**
 * Vessel statuses are limited (available / cleaning / maintenance) so we
 * pick the verb based on which transition happened instead of just naming
 * the new state. "X marked Available" is meaningless to operators — they
 * want to know whether it was cleaned or finished maintenance.
 */
function describeVesselStatusChange(
  name: string,
  oldStatus: string | undefined,
  newStatus: string,
): string {
  if (newStatus === "available") {
    if (oldStatus === "cleaning") return `${name} cleaned`;
    if (oldStatus === "maintenance") return `${name} maintenance complete`;
    return `${name} ready`;
  }
  if (newStatus === "cleaning") return `${name} cleaning started`;
  if (newStatus === "maintenance") return `${name} sent to maintenance`;
  return `${name} → ${titleCase(newStatus)}`;
}

function buildVesselMessage(r: RawActivityRow, lookups: Lookups): string {
  const name = lookups.vesselNameById.get(r.recordId) || (get(r.newData as Json, "name") as string) || "Vessel";

  if (r.operation === "create") {
    return `Vessel ${name} added`;
  }

  if (r.operation === "update" && r.oldData && r.newData) {
    const old = r.oldData as Json;
    const nw = r.newData as Json;

    const oldStatus = get(old, "status");
    const newStatus = get(nw, "status");
    if (oldStatus !== newStatus && newStatus) {
      return describeVesselStatusChange(name, oldStatus ? String(oldStatus) : undefined, String(newStatus));
    }

    // Rename: show explicit FROM → TO so case changes etc. are obvious.
    const oldName = get(old, "name");
    const newName = get(nw, "name");
    if (oldName !== newName && newName) {
      return oldName
        ? `Vessel renamed from "${oldName}" to "${newName}"`
        : `Vessel renamed to "${newName}"`;
    }

    // Capacity change
    const oldCap = num(get(old, "capacity"));
    const newCap = num(get(nw, "capacity"));
    if (oldCap !== newCap && newCap !== null) {
      const unit = get(nw, "capacityUnit", "capacity_unit") || "L";
      return `${name} capacity: ${oldCap ?? "?"} → ${newCap} ${unit}`;
    }

    const ignoreFields = new Set([
      "updatedAt", "updated_at",
      "capacityLiters", "capacity_liters",
      "cleanedAt", "cleaned_at",
      "cleanedBy", "cleaned_by",
    ]);
    const candidateFields = Object.keys(nw || {}).filter((k) => !ignoreFields.has(k));
    const changes = changedFields(old, nw, candidateFields);
    if (changes.length === 1) {
      return `${name} updated · ${humanizeFieldName(changes[0][0])}`;
    }
    if (changes.length > 1) {
      return `${name} updated · ${changes.length} fields`;
    }
    return `${name} updated`;
  }

  if (r.operation === "soft_delete" || r.operation === "delete") {
    return `Vessel ${name} deleted`;
  }
  return `${name} ${r.operation}`;
}

function buildTransferMessage(r: RawActivityRow, lookups: Lookups): string {
  const data = (r.newData ?? r.oldData ?? {}) as Json;
  const sourceBatchId = get(data, "sourceBatchId", "source_batch_id");
  const sourceVesselId = get(data, "sourceVesselId", "source_vessel_id");
  const destVesselId = get(data, "destinationVesselId", "destination_vessel_id");
  const vol = fmtVol(get(data, "volumeTransferred", "volume_transferred"), get(data, "volumeTransferredUnit", "volume_transferred_unit"));

  const src = vesselLabel(sourceVesselId, lookups);
  const dst = vesselLabel(destVesselId, lookups);
  const batch = batchLabel(sourceBatchId, lookups);

  if (r.operation === "create") {
    const volStr = vol ? `${vol} ` : "";
    return `Transferred ${volStr}from ${src} → ${dst} (${batch})`;
  }
  return `Transfer ${r.operation} · ${src} → ${dst} (${batch})`;
}

function buildAdditiveMessage(r: RawActivityRow, lookups: Lookups): string {
  const data = (r.newData ?? r.oldData ?? {}) as Json;
  const batchId = get(data, "batchId", "batch_id");
  const batchName = batchLabel(batchId, lookups);
  const additiveName = get(data, "additiveName", "additive_name") || "additive";
  const amount = num(get(data, "amount"));
  const unit = get(data, "unit") || "";
  const amtStr = amount !== null ? `${amount} ${unit}`.trim() + " " : "";

  if (r.operation === "create") {
    return `Added ${amtStr}${additiveName} to ${batchName}`;
  }
  if (r.operation === "update") {
    return `Updated ${additiveName} addition on ${batchName}`;
  }
  if (r.operation === "delete" || r.operation === "soft_delete") {
    return `Removed ${additiveName} from ${batchName}`;
  }
  return `${additiveName} on ${batchName} (${r.operation})`;
}

function buildPressRunMessage(r: RawActivityRow, lookups: Lookups): string {
  const data = (r.newData ?? r.oldData ?? {}) as Json;
  const name = get(data, "pressRunName", "press_run_name") || "Press Run";
  const vol = fmtVol(get(data, "totalJuiceVolume", "total_juice_volume"), get(data, "totalJuiceVolumeUnit", "total_juice_volume_unit"));
  const vendorId = get(data, "vendorId", "vendor_id");
  const vendor = vendorId ? lookups.vendorNameById.get(vendorId) : null;

  if (r.operation === "create") {
    const parts = [vol, vendor ? `from ${vendor}` : null].filter(Boolean);
    return parts.length
      ? `Press Run ${name} created · ${parts.join(" ")}`
      : `Press Run ${name} created`;
  }

  if (r.operation === "update" && r.oldData && r.newData) {
    const oldStatus = get(r.oldData as Json, "status");
    const newStatus = get(r.newData as Json, "status");
    if (oldStatus !== newStatus && newStatus) {
      return `Press Run ${name} ${titleCase(String(newStatus))}`;
    }
    return `Press Run ${name} updated`;
  }

  return `Press Run ${name} ${r.operation}`;
}

function buildPurchaseMessage(r: RawActivityRow, lookups: Lookups, kind: string): string {
  const data = (r.newData ?? r.oldData ?? {}) as Json;
  const vendorId = get(data, "vendorId", "vendor_id");
  const vendor = vendorId ? lookups.vendorNameById.get(vendorId) || "?" : "?";
  const invoice = get(data, "invoiceNumber", "invoice_number");

  if (r.operation === "create") {
    const inv = invoice ? ` · invoice ${invoice}` : "";
    return `${kind} purchase from ${vendor}${inv}`;
  }
  return `${kind} purchase ${r.operation} · ${vendor}`;
}

function buildBottleRunMessage(r: RawActivityRow, lookups: Lookups): string {
  const data = (r.newData ?? r.oldData ?? {}) as Json;
  const batchId = get(data, "batchId", "batch_id");
  const batchName = batchLabel(batchId, lookups);
  const units = num(get(data, "unitsProduced", "units_produced"));
  const sizeML = num(get(data, "packageSizeML", "package_size_ml"));
  const volumeL = num(get(data, "volumeTakenL", "volume_taken_liters", "volume_taken"));
  const packageType = get(data, "packageType", "package_type");

  // Build a readable container description: "750mL bottles", "kegs", or just "bottles"/"units"
  const container =
    sizeML ? `${sizeML}mL bottles` :
    packageType === "keg" ? "kegs" :
    packageType === "bottle" ? "bottles" :
    "units";

  // Volume suffix for context: "(99L)" — useful when units alone don't tell
  // the operator how much actually left the tank.
  const volSuffix = volumeL !== null ? ` (${volumeL}L)` : "";

  if (r.operation === "create") {
    if (units !== null) {
      return `${batchName} packaged into ${units} ${container}${volSuffix}`;
    }
    return volumeL !== null
      ? `${batchName} packaged · ${volumeL}L`
      : `${batchName} packaged`;
  }
  return `Packaging on ${batchName} ${r.operation}`;
}

function buildKegFillMessage(r: RawActivityRow, lookups: Lookups): string {
  const data = (r.newData ?? r.oldData ?? {}) as Json;
  const batchId = get(data, "batchId", "batch_id");
  const batchName = batchLabel(batchId, lookups);
  const units = num(get(data, "kegsProduced", "kegs_produced", "unitsProduced", "units_produced"));
  const volume = num(get(data, "volumeTaken", "volume_taken"));
  const volSuffix = volume !== null ? ` (${volume}L)` : "";

  if (r.operation === "create") {
    if (units !== null) return `${batchName} packaged into ${units} kegs${volSuffix}`;
    if (volume !== null) return `${batchName} kegged · ${volume}L`;
    return `Keg fill on ${batchName}`;
  }
  return `Keg fill on ${batchName} ${r.operation}`;
}

function buildCarbonationMessage(r: RawActivityRow, lookups: Lookups): string {
  const data = (r.newData ?? r.oldData ?? {}) as Json;
  const batchId = get(data, "batchId", "batch_id");
  const batchName = batchLabel(batchId, lookups);
  const targetCo2 = num(get(data, "targetCo2Volumes", "target_co2_volumes"));

  if (r.operation === "create") {
    return targetCo2 !== null
      ? `Carbonation started on ${batchName} · target ${targetCo2.toFixed(1)} vols CO₂`
      : `Carbonation started on ${batchName}`;
  }

  if (r.operation === "update" && r.newData) {
    const completedAt = get(r.newData as Json, "completedAt", "completed_at");
    const oldCompletedAt = get(r.oldData as Json, "completedAt", "completed_at");
    if (completedAt && !oldCompletedAt) {
      return `Carbonation completed on ${batchName}`;
    }
    return `Carbonation updated on ${batchName}`;
  }

  return `Carbonation ${r.operation} on ${batchName}`;
}

function buildVendorMessage(r: RawActivityRow): string {
  const data = (r.newData ?? r.oldData ?? {}) as Json;
  const name = get(data, "name") || "Vendor";

  if (r.operation === "create") return `Vendor ${name} added`;
  if (r.operation === "update") return `Vendor ${name} updated`;
  return `Vendor ${name} ${r.operation}`;
}

function buildFallbackMessage(r: RawActivityRow): string {
  const verb =
    r.operation === "create" ? "added" :
    r.operation === "update" ? "updated" :
    r.operation === "delete" || r.operation === "soft_delete" ? "deleted" :
    r.operation === "restore" ? "restored" :
    r.operation;
  // Try to extract a useful label from the row data when possible.
  const data = (r.newData ?? r.oldData ?? {}) as Json;
  const label =
    (typeof data?.name === "string" && data.name) ||
    (typeof data?.batchNumber === "string" && data.batchNumber) ||
    (typeof data?.invoiceNumber === "string" && data.invoiceNumber) ||
    null;
  const entity = titleCase(r.tableName).replace(/s$/, "");
  return label
    ? `${entity} ${label} ${verb}`
    : `${entity} ${verb}`;
}

/**
 * Format a single audit row into a user-facing message.
 */
function formatRow(r: RawActivityRow, lookups: Lookups): string {
  switch (r.tableName) {
    case "batch_measurements": return buildMeasurementMessage(r, lookups);
    case "batches":            return buildBatchMessage(r, lookups);
    case "vessels":            return buildVesselMessage(r, lookups);
    case "batch_transfers":    return buildTransferMessage(r, lookups);
    case "batch_additives":    return buildAdditiveMessage(r, lookups);
    case "press_runs":         return buildPressRunMessage(r, lookups);
    case "basefruit_purchases":   return buildPurchaseMessage(r, lookups, "Base fruit");
    case "juice_purchases":       return buildPurchaseMessage(r, lookups, "Juice");
    case "additive_purchases":    return buildPurchaseMessage(r, lookups, "Additive");
    case "packaging_purchases":   return buildPurchaseMessage(r, lookups, "Packaging");
    case "bottle_runs":               return buildBottleRunMessage(r, lookups);
    // packaging_run (singular) is a custom audit event written by the
    // packaging flow with shape { batchId, vesselId, packageType,
    // volumeTakenL, unitsProduced, lossL }. Same renderer, batchLabel
    // handles the lookup.
    case "packaging_run":             return buildBottleRunMessage(r, lookups);
    case "keg_fills":                 return buildKegFillMessage(r, lookups);
    case "batch_carbonation_operations": return buildCarbonationMessage(r, lookups);
    case "vendors":            return buildVendorMessage(r);
    default:                   return buildFallbackMessage(r);
  }
}

/**
 * Returns whether the audit row's primary record can still be linked to —
 * false if hard-deleted (not in lookup) or soft-deleted.
 */
function isLinkable(r: RawActivityRow, lookups: Lookups): boolean {
  if (r.operation === "delete" || r.operation === "soft_delete") return false;

  if (r.tableName === "batches") {
    const b = lookups.batchById.get(r.recordId);
    return !!b && !b.deleted;
  }
  if (r.tableName === "vessels") {
    if (!lookups.vesselDeletedById.has(r.recordId)) return false;
    return !lookups.vesselDeletedById.get(r.recordId);
  }
  // Other tables: assume linkable; the widget's hrefFor decides if it links.
  return true;
}

/**
 * Main entry: takes raw audit rows, returns formatted activity entries.
 */
export async function formatRecentActivity(
  rows: RawActivityRow[],
): Promise<FormattedActivity[]> {
  if (rows.length === 0) return [];
  const lookups = await fetchLookups(collectIds(rows));
  return rows.map((r) => ({
    id: r.id,
    tableName: r.tableName,
    recordId: r.recordId,
    operation: r.operation,
    changedAt: r.changedAt,
    userName: r.userName ?? r.changedByEmail ?? "System",
    message: formatRow(r, lookups),
    linkable: isLinkable(r, lookups),
  }));
}
