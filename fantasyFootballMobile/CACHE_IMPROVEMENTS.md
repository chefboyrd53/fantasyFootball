# Cache System Improvements

## Overview

The caching system has been completely refactored to reduce unnecessary Firestore reads and improve app performance. The new system provides centralized cache management with intelligent invalidation strategies.

## Key Improvements

### 1. Centralized Cache Management (`utils/cache.js`)

- **Unified API**: All cache operations go through a single utility module
- **Type-specific caching**: Different cache types (players, matchups, rosters, scores) with appropriate expiration times
- **Automatic validation**: Cache entries are validated for freshness and structure
- **User-specific caching**: Cache keys include user context to prevent data leakage

### 2. Intelligent Cache Expiration

```javascript
const CACHE_CONFIG = {
  EXPIRATION: {
    PLAYERS_DATA: 24 * 60 * 60 * 1000, // 24 hours
    MATCHUPS_DATA: 30 * 60 * 1000, // 30 minutes for current week
    ROSTERS_DATA: 60 * 60 * 1000, // 1 hour
    SCORES_DATA: 15 * 60 * 1000, // 15 minutes
    CURRENT_DATE: 60 * 60 * 1000, // 1 hour
  }
};
```

### 3. Smart Cache Invalidation

The system now intelligently invalidates cache based on data changes:

- **Waiver transactions**: Clears player, roster, and scores cache
- **IR moves**: Clears relevant cache types
- **Lineup changes**: Updates matchups cache and triggers refresh
- **Pull-to-refresh**: Clears specific page cache and fetches fresh data

### 4. Reduced Firestore Reads

#### Before:
- Every page load triggered Firestore reads
- No intelligent caching strategy
- Cache cleared on every data change

#### After:
- **Current week data**: Cached for 30 minutes (matchups) to 24 hours (players)
- **Historical data**: Not cached to save storage
- **Scores**: Cached for 15 minutes with intelligent preloading
- **Selective invalidation**: Only relevant cache types cleared on data changes

### 5. Enhanced User Experience

- **Faster loading**: Cached data loads instantly
- **Offline resilience**: App works with cached data when offline
- **Pull-to-refresh**: Users can manually refresh when needed
- **Cache statistics**: Users can view cache status in settings

## Cache Types and Usage

### Players Cache
- **Purpose**: Store player data and owner mapping
- **Expiration**: 24 hours
- **Invalidation**: On waiver/IR transactions
- **Key**: `ff_players_{user}_{year}_{week}`

### Matchups Cache
- **Purpose**: Store matchup data and lineups
- **Expiration**: 30 minutes (current week only)
- **Invalidation**: On lineup changes, waiver transactions
- **Key**: `ff_matchups_{user}_{year}_{week}`

### Rosters Cache
- **Purpose**: Store team rosters with waivers and IR data
- **Expiration**: 1 hour
- **Invalidation**: On waiver/IR transactions
- **Key**: `ff_rosters_{user}`

### Scores Cache
- **Purpose**: Store individual player scores
- **Expiration**: 15 minutes
- **Invalidation**: On score updates, waiver transactions
- **Key**: `ff_scores_{user}_{year}_{week}`

### Current Date Cache
- **Purpose**: Store current NFL week/year
- **Expiration**: 1 hour
- **Invalidation**: On date changes
- **Key**: `ff_current_date`

## Implementation Details

### Cache Entry Structure
```javascript
{
  data: any,           // The actual cached data
  timestamp: number,   // When the cache was created
  version: '1.0'       // For future cache versioning
}
```

### Cache Validation
- Checks for valid structure
- Validates expiration time
- Automatically removes invalid entries

### Error Handling
- Graceful fallback to Firestore on cache errors
- Logging for debugging
- No app crashes on cache failures

## Usage Examples

### Setting Cache
```javascript
import { cachePlayers } from '../utils/cache';

await cachePlayers.set(user, year, week, data);
```

### Getting Cache
```javascript
const cached = await cachePlayers.get(user, year, week);
if (cached) {
  // Use cached data
} else {
  // Fetch from Firestore
}
```

### Clearing Cache
```javascript
import { invalidateCacheOnDataChange } from '../utils/cache';

await invalidateCacheOnDataChange(user, 'waiver_transaction');
```

## Performance Benefits

### Reduced Firestore Reads
- **Players data**: From every load to once per 24 hours
- **Matchups data**: From every load to once per 30 minutes
- **Scores data**: Intelligent preloading reduces individual reads
- **Rosters data**: From every load to once per hour

### Faster App Performance
- **Instant loading**: Cached data loads immediately
- **Reduced network usage**: Fewer API calls
- **Better offline experience**: App works with cached data

### Improved User Experience
- **Consistent performance**: No more loading delays
- **Pull-to-refresh**: Users control when to get fresh data
- **Cache visibility**: Users can see cache status and clear if needed

## Migration Notes

### Old Cache Keys
The old cache system used keys like:
- `ff_cache_{user}_{year}_{week}`
- `rosters_cache_{user}`
- `matchups_cache_{user}_{year}_{week}`
- `scores_cache_{user}_{year}_{week}`

### New Cache Keys
The new system uses:
- `ff_players_{user}_{year}_{week}`
- `ff_rosters_{user}`
- `ff_matchups_{user}_{year}_{week}`
- `ff_scores_{user}_{year}_{week}`
- `ff_current_date`

### Automatic Migration
The new system automatically handles migration by:
- Using new cache keys for all new data
- Gracefully handling missing old cache data
- Preserving Firebase authentication data

## Future Enhancements

### Planned Features
- **Cache compression**: Reduce storage usage
- **Background refresh**: Update cache in background
- **Cache analytics**: Track cache hit rates
- **Selective field caching**: Cache only needed fields

### Monitoring
- Cache statistics in settings
- Console logging for debugging
- Performance metrics tracking

## Troubleshooting

### Common Issues
1. **Cache not updating**: Check expiration times and invalidation triggers
2. **Stale data**: Use pull-to-refresh or clear cache manually
3. **Storage issues**: Clear cache in settings

### Debug Commands
```javascript
// View cache statistics
import { getCacheStats } from '../utils/cache';
const stats = await getCacheStats();
console.log(stats);

// Clear all cache
import { clearAppCache } from '../utils/cache';
await clearAppCache();
``` 