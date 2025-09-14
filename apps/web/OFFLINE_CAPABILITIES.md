# Offline Capabilities & Resume Functionality

This document describes the comprehensive offline capability system implemented for the pressing workflow, enabling seamless operation during connectivity issues common in cidery production environments.

## Overview

The offline capability system consists of:

1. **Local Storage Persistence** - Press run drafts saved automatically
2. **Service Worker** - PWA functionality and resource caching
3. **Background Synchronization** - Automatic sync when connectivity restored
4. **Resume Functionality** - Complete state restoration for interrupted workflows
5. **Optimistic UI Updates** - Immediate feedback with conflict resolution
6. **Network Detection** - Real-time connectivity status and adaptive behavior

## Architecture

### Core Components

```
┌─────────────────────────────────────────────────────────────┐
│                    Offline Architecture                     │
├─────────────────────────────────────────────────────────────┤
│  React Components (UI)                                     │
│  ├── PressingPage (with draft sections)                    │
│  ├── OfflineFruitLoadForm (optimistic updates)             │
│  └── ConflictResolutionUI (manual resolution)              │
├─────────────────────────────────────────────────────────────┤
│  Custom Hooks                                              │
│  ├── usePressRunDrafts (draft management)                  │
│  ├── useNetworkSync (synchronization)                      │
│  └── useOfflineCapability (storage quotas)                 │
├─────────────────────────────────────────────────────────────┤
│  Core Libraries                                            │
│  ├── OfflineStorageManager (localStorage wrapper)          │
│  ├── ConflictResolutionManager (conflict handling)         │
│  └── ServiceWorkerManager (PWA & caching)                  │
├─────────────────────────────────────────────────────────────┤
│  Storage Layer                                             │
│  ├── LocalStorage (JSON-based persistence)                 │
│  ├── Service Worker Cache (resource caching)               │
│  └── Background Sync Queue (pending operations)            │
└─────────────────────────────────────────────────────────────┘
```

## Features

### 1. Local Storage Persistence

**Auto-save every 30 seconds:**
- Press run metadata (vendor, notes, timestamps)
- All fruit load entries with complete data
- Draft status tracking (draft → syncing → synced → error)
- Automatic cleanup of synced drafts after 48 hours

**Storage Schema:**
```typescript
interface PressRunDraft {
  id: string
  vendorId: string
  vendorName?: string
  status: 'draft' | 'syncing' | 'synced' | 'error'
  startTime: string
  loads: PressRunLoadDraft[]
  lastModified: string
  syncAttempts: number
  notes?: string
  totalAppleWeightKg: number
}

interface PressRunLoadDraft {
  id: string
  purchaseLineId: string
  appleVarietyId: string
  appleVarietyName: string
  weightKg: number
  weightUnitEntered: 'lbs' | 'kg'
  originalWeight: number
  originalWeightUnit: 'kg' | 'lb' | 'bushel'
  brixMeasured?: number
  phMeasured?: number
  appleCondition?: 'excellent' | 'good' | 'fair' | 'poor'
  defectPercentage?: number
  notes?: string
  status: 'pending' | 'confirmed' | 'error'
  loadSequence: number
}
```

**Storage Quotas:**
- Maximum 50MB storage usage
- Maximum 100 drafts retained
- Storage quota monitoring with user notifications
- Automatic cleanup of old synced drafts

### 2. Service Worker Implementation

**PWA Features:**
- Standalone app installation capability
- App shortcuts for common actions
- Offline page fallback
- Resource versioning and cache invalidation

**Caching Strategy:**
- **Static Assets**: Cache-first (HTML, CSS, JS, images)
- **API Endpoints**: Network-first with cache fallback
- **Pressing Pages**: Cache-first with network update
- **Critical Data**: Always cached (apple varieties, vessel lists)

**Background Sync:**
- Automatic sync registration when offline operations occur
- Retry logic with exponential backoff
- Sync progress notifications
- Error handling and reporting

### 3. Background Synchronization

**Automatic Sync Triggers:**
- Network connectivity restoration
- Browser focus events
- Manual refresh requests
- Periodic sync intervals (when supported)

**Sync Process:**
```typescript
// 1. Create press run on server
const pressRun = await createPressRun({
  vendorId: draft.vendorId,
  startTime: draft.startTime,
  notes: draft.notes,
})

// 2. Add all loads sequentially
for (const load of draft.loads) {
  await addLoad({
    pressRunId: pressRun.id,
    ...load
  })
}

// 3. Update draft status
draft.status = 'synced'
```

**Conflict Resolution:**
- Server timestamp comparison
- Field-level conflict detection
- Automatic merge strategies
- Manual resolution UI for complex conflicts

### 4. Resume Functionality

**Draft Display:**
- Visual distinction between draft and active press runs
- Time since last modification
- Load count and total weight preview
- Sync status indicators

**State Restoration:**
- Complete form state recovery
- Sequence number continuity
- Quality measurements preserved
- Notes and observations maintained

**Resume Process:**
1. User selects draft from pressing page
2. Navigate to resume interface
3. All data pre-populated in forms
4. Continue adding loads or complete press run
5. Automatic sync when online

### 5. Optimistic UI Updates

**Immediate Feedback:**
- Fruit loads appear instantly when added
- Visual confirmation with status badges
- Offline/online indicators
- Auto-save status display

**Error Handling:**
- Rollback mechanism for failed operations
- Clear error messages and retry options
- Visual distinction between confirmed and pending operations
- Batch operation support

**Status Indicators:**
- ✅ Confirmed (successfully synced)
- 🔄 Pending (waiting for sync)
- ⚠️ Error (sync failed, retry needed)
- 📶 Offline (saved locally only)

### 6. Network Detection

**Real-time Status:**
- Online/offline status monitoring
- Connection quality indicators
- Sync opportunity detection
- Adaptive UI behavior

**Network Events:**
```typescript
// Automatic detection
window.addEventListener('online', handleOnlineEvent)
window.addEventListener('offline', handleOfflineEvent)

// Manual sync trigger
const syncResult = await syncAllDrafts()
```

## Usage Examples

### Creating an Offline Press Run

```typescript
// 1. Create draft (works offline)
const { createDraft } = usePressRunDrafts()
const result = createDraft('vendor-123', 'Orchard ABC')

// 2. Add loads (immediate feedback)
const { addLoad } = usePressRunDraft(result.draftId)
await addLoad({
  purchaseLineId: 'purchase-456',
  appleVarietyId: 'variety-789',
  // ... other fields
})

// 3. Automatic sync when online
// No additional code needed - happens automatically
```

### Resuming a Draft

```typescript
// 1. Get available drafts
const { drafts } = usePressRunDrafts()

// 2. Load specific draft
const { draft } = usePressRunDraft(selectedDraftId)

// 3. Continue working
// All state restored automatically
```

### Handling Conflicts

```typescript
// Automatic resolution (most cases)
const { syncDraft } = useNetworkSync()
const result = await syncDraft(draft)

// Manual resolution (when needed)
if (result.requiresManualReview) {
  // Show conflict resolution UI
  // User chooses: local, server, or custom merge
}
```

## File Structure

```
src/
├── lib/
│   ├── offline-storage.ts      # Core storage management
│   ├── conflict-resolution.ts  # Conflict handling
│   └── service-worker.ts       # PWA and caching
├── hooks/
│   └── use-press-run-drafts.ts # React integration
├── components/
│   └── pressing/
│       ├── OfflineFruitLoadForm.tsx    # Enhanced form
│       └── ConflictResolutionUI.tsx    # Manual resolution
├── app/
│   └── pressing/
│       └── page.tsx            # Updated with draft sections
└── public/
    ├── sw.js                   # Service Worker
    └── manifest.json           # PWA manifest
```

## Testing

Comprehensive test coverage includes:

- **Unit Tests**: Storage operations, conflict resolution, sync logic
- **Integration Tests**: Complete offline workflows
- **Mock Tests**: Network conditions, storage quotas
- **Edge Cases**: Data corruption, storage limits, concurrent conflicts

Run tests:
```bash
pnpm test offline-functionality.test.ts
```

## Browser Support

**Minimum Requirements:**
- Service Worker: Chrome 45+, Firefox 44+, Safari 11.1+
- Local Storage: Universal support
- Background Sync: Chrome 49+, Firefox 81+ (fallback for others)
- PWA Features: Chrome 57+, Firefox 58+, Safari 11.1+

**Graceful Degradation:**
- Core functionality works without Service Worker
- Background sync falls back to manual sync
- PWA features optional enhancement

## Performance Considerations

**Storage Efficiency:**
- JSON compression for large drafts
- Lazy loading of draft details
- Automatic cleanup of old data
- Storage quota monitoring

**Network Optimization:**
- Batch sync operations
- Delta sync for large datasets
- Compression for API payloads
- Request deduplication

**Memory Management:**
- Event listener cleanup
- Timer cancellation
- Cache size limits
- Memory leak prevention

## Security Considerations

**Data Protection:**
- No sensitive data in local storage
- Automatic cleanup of synced data
- User-initiated data clearing
- No authentication tokens cached

**Sync Security:**
- Server-side validation of all synced data
- Audit logging for conflict resolutions
- User attribution for manual resolutions
- Data integrity checks

## Troubleshooting

### Common Issues

**Sync Failures:**
1. Check network connectivity
2. Verify server availability
3. Review conflict resolution requirements
4. Check storage quotas

**Storage Issues:**
1. Clear browser cache
2. Reset application data
3. Check available storage space
4. Review quota settings

**PWA Installation:**
1. Ensure HTTPS connection
2. Check manifest.json validity
3. Verify Service Worker registration
4. Review browser PWA support

### Debug Tools

**Local Storage Inspector:**
```typescript
// View all drafts
console.log(offlineStorage.getAllDrafts())

// Check storage info
console.log(offlineStorage.getStorageInfo())

// View sync queue
console.log(offlineStorage.getSyncQueue())
```

**Network Status:**
```typescript
const { isOnline, syncing } = useNetworkSync()
console.log('Online:', isOnline, 'Syncing:', syncing)
```

## Future Enhancements

**Planned Features:**
- IndexedDB migration for larger storage
- Real-time collaboration conflict detection
- Advanced sync scheduling
- Enhanced conflict resolution UI
- Cross-device draft synchronization

**Performance Improvements:**
- Web Workers for large data processing
- Streaming sync for big datasets
- Advanced caching strategies
- Network quality adaptation

## Migration Guide

### From Previous Version

No breaking changes - offline functionality is additive enhancement.

### Data Migration

Existing press runs remain unaffected. New offline functionality applies only to future press runs created with the updated system.

## Support

For issues or questions regarding offline functionality:

1. Check browser console for error messages
2. Review network connectivity
3. Verify storage quota availability
4. Test with different network conditions
5. Consult troubleshooting section above

The offline capability system is designed to provide seamless operation in challenging production environments while maintaining data integrity and user experience quality.