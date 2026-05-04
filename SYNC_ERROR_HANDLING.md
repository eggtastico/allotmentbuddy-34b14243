# Sync & Error Handling Improvements

## Issue #4: Silent Error Handling in useFavouritePlants.ts ✓ FIXED

### Problem
Database operations were fire-and-forget with silent failures:
```tsx
// OLD - Silent failure
supabase
  .from('favourite_plants')
  .insert(...)
  .catch(err => console.error(...));  // Only logs, no user feedback
```

**Impact:**
- UI updates immediately even if database fails
- Users unaware of sync failures
- Data inconsistency between local and remote
- No retry mechanism

### Solution
Implemented proper error handling with user feedback:

1. **Added toast notifications** on all Supabase operations
2. **Proper `.then()` handling** for response errors
3. **User feedback** when operations fail
4. **Consistent error messages** across operations

### Updated Functions in useFavouritePlants.ts
- ✓ Migration on first login (lines 66-81)
- ✓ `toggleFavourite()` - add/remove from favourites (lines 96-142)
- ✓ `setQuantity()` - update plant quantities (lines 144-164)
- ✓ `reorder()` - update favourite order (lines 166-185)

### Example - Before vs After

**Before (Silent Failure):**
```tsx
toggleFavourite = (plantId: string) => {
  setFavourites(prev => {
    supabase.from('favourite_plants').delete()
      .catch(err => console.error(...));  // ❌ No user notification
    return prev.filter(...);
  });
};
```

**After (Proper Error Handling):**
```tsx
toggleFavourite = (plantId: string) => {
  setFavourites(prev => {
    supabase.from('favourite_plants').delete()
      .then(({ error }) => {
        if (error) {
          console.error('Failed to remove favourite plant:', error);
          toast.error('Failed to remove from favourites. Try again.');  // ✓ User sees error
        }
      })
      .catch(err => {
        console.error('Unexpected error:', err);
        toast.error('Failed to remove from favourites. Try again.');
      });
    return prev.filter(...);
  });
};
```

### Key Changes
1. Check response `error` object in `.then()`
2. Show `toast.error()` to user on failure
3. Handle both error cases: response errors AND network exceptions
4. Log to console for debugging

---

## Issue #5: Incomplete Offline Sync Logic in useOfflineSync.ts ✓ FIXED

### Problem
Sync operations were **simulated** instead of actually syncing:
```tsx
// OLD - Just marking as synced without syncing
for (const item of pendingItems) {
  if (item.id) {
    await markAsSynced(item.id);  // ❌ No actual Supabase sync
  }
}
```

**Impact:**
- Offline changes marked as "synced" but never reached server
- Data loss on app reinstall
- No actual data consistency
- Comment in code: "In a real app, this would call your Supabase API"

### Solution
Implemented **actual syncing to Supabase**:

1. **Created `syncItemToSupabase()` helper** that handles:
   - Gardens (create/update/delete)
   - Plants (create/update/delete)
   - Garden beds (create/update/delete)
   - Photos (metadata sync)

2. **Proper error handling per item**:
   - Sync failures don't stop other items
   - Track success/failure counts
   - Provide user feedback with toast

3. **Updated `triggerSync()` to**:
   - Actually call `syncItemToSupabase()` for each item
   - Track synced vs failed items
   - Show user feedback on results
   - Only mark as synced after successful Supabase operation

### Sync Flow Now

```
Pending Items in Queue
    ↓
[For each item]
    ↓
Sync to Supabase
    ├─ Success → Mark as synced → Remove from queue
    └─ Failure → Keep in queue → Show error toast
    ↓
Update sync status with results
    ↓
Show user: "Synced 5/5" or "Synced 4/5. 1 failed."
```

### Entity Type Handling

**Gardens:**
```tsx
case "garden":
  if (action === "create" || "update")
    → supabase.from("garden_plans").upsert(data)
  if (action === "delete")
    → supabase.from("garden_plans").delete()
```

**Plants:**
```tsx
case "plant":
  if (action === "create" || "update")
    → supabase.from("placed_plants").upsert(data)
  if (action === "delete")
    → supabase.from("placed_plants").delete()
```

**Garden Beds:**
```tsx
case "bed":
  if (action === "create" || "update")
    → supabase.from("garden_beds").upsert(data)
  if (action === "delete")
    → supabase.from("garden_beds").delete()
```

**Photos:**
```tsx
case "photo":
  if (action === "create")
    → supabase.from("garden_photos").insert(metadata)
  if (action === "delete")
    → supabase.from("garden_photos").delete()
```

### User Feedback

**Success:**
```
Toast: "Synced 5 changes"
Status: pendingChanges = 0
```

**Partial Failure:**
```
Toast: "Synced 4/5. 1 failed."
Status: pendingChanges = 1 (remaining failures)
```

**Complete Failure:**
```
Toast: "Sync failed: [error message]"
Status: lastError set, items remain in queue
```

---

## Testing the Fixes

### Test #4: Favourite Plants Error Handling
1. Toggle a favourite plant
2. Disconnect network (DevTools → Offline)
3. Try to add/remove/reorder favorites
4. See toast error: "Failed to [action]. Try again."
5. Reconnect network
6. Changes eventually sync

### Test #5: Offline Sync
1. Go offline (DevTools → Offline)
2. Make changes to gardens/plants
3. Changes queued in IndexedDB
4. Come back online
5. Sync automatically triggers
6. See toast: "Synced X changes"
7. Verify data in Supabase dashboard

---

## Error Handling Pattern

Use this pattern for all Supabase operations:

```tsx
supabase
  .from('table')
  .operation()
  .then(({ data, error }) => {
    if (error) {
      console.error('Operation failed:', error);
      toast.error('User-friendly message here');
      return;
    }
    // Success handling
    setData(data);
  })
  .catch(err => {
    // Network/unexpected errors
    console.error('Unexpected error:', err);
    toast.error('Something went wrong. Try again.');
  });
```

---

## Related Issues

- Issue #4: Silent error handling in data operations
- Issue #5: Offline sync not actually syncing
- Next: Implement automatic retries for failed syncs
- Future: Add exponential backoff for retry logic

---

**Last Updated:** 2026-04-14
**Status:** ✓ Complete
