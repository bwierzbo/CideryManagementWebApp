# Database Fixes

## 2025-01-23: Fixed Keg Remaining Volume

**Issue**: Existing keg fills had `remaining_volume` set to NULL or 0, showing 0.0L remaining in the kegs table even though kegs were full.

**Root Cause**: The `remaining_volume` field was added later and existing records weren't backfilled.

**Fix**: 
```sql
UPDATE keg_fills 
SET remaining_volume = volume_taken 
WHERE remaining_volume IS NULL OR remaining_volume = 0;
```

**Result**: Updated 9 keg fills to show correct remaining volume (19.50L for all filled kegs).

**Prevention**: New keg fills are created with `remainingVolume: kegVolume.volumeTaken.toString()` in the fillKegs mutation (packages/api/src/routers/kegs.ts line 864).
