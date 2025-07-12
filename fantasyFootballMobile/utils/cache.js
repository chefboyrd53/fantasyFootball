import AsyncStorage from '@react-native-async-storage/async-storage';

// Cache configuration
const CACHE_CONFIG = {
  // Cache expiration times (in milliseconds)
  EXPIRATION: {
    PLAYERS_DATA: 24 * 60 * 60 * 1000, // 24 hours
    MATCHUPS_DATA: 30 * 60 * 1000, // 30 minutes for current week
    ROSTERS_DATA: 60 * 60 * 1000, // 1 hour
    SCORES_DATA: 15 * 60 * 1000, // 15 minutes
    CURRENT_DATE: 60 * 60 * 1000, // 1 hour
  },
  
  // Cache key prefixes
  PREFIXES: {
    PLAYERS: 'ff_players_',
    MATCHUPS: 'ff_matchups_',
    ROSTERS: 'ff_rosters_',
    SCORES: 'ff_scores_',
    CURRENT_DATE: 'ff_current_date_',
  }
};

// Cache entry structure
const createCacheEntry = (data, timestamp = Date.now()) => ({
  data,
  timestamp,
  version: '1.0' // For future cache versioning
});

// Validate cache entry
const isValidCacheEntry = (entry, maxAge) => {
  if (!entry || !entry.data || !entry.timestamp) {
    return false;
  }
  
  if (maxAge && (Date.now() - entry.timestamp) > maxAge) {
    return false;
  }
  
  return true;
};

// Get cache key with user context
const getCacheKey = (prefix, user, ...additionalKeys) => {
  const userKey = user?.email || 'nouser';
  const additionalKeyString = additionalKeys.length > 0 ? `_${additionalKeys.join('_')}` : '';
  return `${prefix}${userKey}${additionalKeyString}`;
};

// Set cache entry
export const setCache = async (key, data, maxAge = null) => {
  try {
    const entry = createCacheEntry(data);
    await AsyncStorage.setItem(key, JSON.stringify(entry));
    console.log(`Cache: Set ${key}`);
    return true;
  } catch (error) {
    console.error(`Cache: Error setting ${key}:`, error);
    return false;
  }
};

// Get cache entry
export const getCache = async (key, maxAge = null) => {
  try {
    const cached = await AsyncStorage.getItem(key);
    if (!cached) {
      return null;
    }
    
    const entry = JSON.parse(cached);
    if (!isValidCacheEntry(entry, maxAge)) {
      // Remove invalid cache entry
      await AsyncStorage.removeItem(key);
      return null;
    }
    
    console.log(`Cache: Hit ${key}`);
    return entry.data;
  } catch (error) {
    console.error(`Cache: Error getting ${key}:`, error);
    return null;
  }
};

// Remove specific cache entry
export const removeCache = async (key) => {
  try {
    await AsyncStorage.removeItem(key);
    console.log(`Cache: Removed ${key}`);
    return true;
  } catch (error) {
    console.error(`Cache: Error removing ${key}:`, error);
    return false;
  }
};

// Clear all app cache (preserve Firebase auth)
export const clearAppCache = async () => {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const cacheKeys = allKeys.filter(key => 
      key.startsWith('ff_') && !key.includes('firebase')
    );
    
    if (cacheKeys.length > 0) {
      await AsyncStorage.multiRemove(cacheKeys);
      console.log(`Cache: Cleared ${cacheKeys.length} entries`);
    }
    
    return cacheKeys.length;
  } catch (error) {
    console.error('Cache: Error clearing app cache:', error);
    return 0;
  }
};

// Clear specific cache types
export const clearCacheByType = async (type, user = null) => {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    let cacheKeys = [];
    
    switch (type) {
      case 'players':
        cacheKeys = allKeys.filter(key => key.startsWith(CACHE_CONFIG.PREFIXES.PLAYERS));
        break;
      case 'matchups':
        cacheKeys = allKeys.filter(key => key.startsWith(CACHE_CONFIG.PREFIXES.MATCHUPS));
        break;
      case 'rosters':
        cacheKeys = allKeys.filter(key => key.startsWith(CACHE_CONFIG.PREFIXES.ROSTERS));
        break;
      case 'scores':
        cacheKeys = allKeys.filter(key => key.startsWith(CACHE_CONFIG.PREFIXES.SCORES));
        break;
      case 'current_date':
        cacheKeys = allKeys.filter(key => key.startsWith(CACHE_CONFIG.PREFIXES.CURRENT_DATE));
        break;
      default:
        return 0;
    }
    
    if (user) {
      const userKey = user.email || 'nouser';
      cacheKeys = cacheKeys.filter(key => key.includes(userKey));
    }
    
    if (cacheKeys.length > 0) {
      await AsyncStorage.multiRemove(cacheKeys);
      console.log(`Cache: Cleared ${cacheKeys.length} ${type} entries`);
    }
    
    return cacheKeys.length;
  } catch (error) {
    console.error(`Cache: Error clearing ${type} cache:`, error);
    return 0;
  }
};

// Cache management for specific data types
export const cachePlayers = {
  set: (user, year, week, data) => {
    const key = getCacheKey(CACHE_CONFIG.PREFIXES.PLAYERS, user, year, week);
    return setCache(key, data, CACHE_CONFIG.EXPIRATION.PLAYERS_DATA);
  },
  
  get: (user, year, week) => {
    const key = getCacheKey(CACHE_CONFIG.PREFIXES.PLAYERS, user, year, week);
    return getCache(key, CACHE_CONFIG.EXPIRATION.PLAYERS_DATA);
  },
  
  clear: (user = null) => clearCacheByType('players', user)
};

export const cacheMatchups = {
  set: (user, year, week, data) => {
    const key = getCacheKey(CACHE_CONFIG.PREFIXES.MATCHUPS, user, year, week);
    return setCache(key, data, CACHE_CONFIG.EXPIRATION.MATCHUPS_DATA);
  },
  
  get: (user, year, week) => {
    const key = getCacheKey(CACHE_CONFIG.PREFIXES.MATCHUPS, user, year, week);
    return getCache(key, CACHE_CONFIG.EXPIRATION.MATCHUPS_DATA);
  },
  
  clear: (user = null) => clearCacheByType('matchups', user)
};

export const cacheRosters = {
  set: (user, data) => {
    const key = getCacheKey(CACHE_CONFIG.PREFIXES.ROSTERS, user);
    return setCache(key, data, CACHE_CONFIG.EXPIRATION.ROSTERS_DATA);
  },
  
  get: (user) => {
    const key = getCacheKey(CACHE_CONFIG.PREFIXES.ROSTERS, user);
    return getCache(key, CACHE_CONFIG.EXPIRATION.ROSTERS_DATA);
  },
  
  clear: (user = null) => clearCacheByType('rosters', user)
};

export const cacheScores = {
  set: (user, year, week, data) => {
    const key = getCacheKey(CACHE_CONFIG.PREFIXES.SCORES, user, year, week);
    return setCache(key, data, CACHE_CONFIG.EXPIRATION.SCORES_DATA);
  },
  
  get: (user, year, week) => {
    const key = getCacheKey(CACHE_CONFIG.PREFIXES.SCORES, user, year, week);
    return getCache(key, CACHE_CONFIG.EXPIRATION.SCORES_DATA);
  },
  
  clear: (user = null) => clearCacheByType('scores', user)
};

export const cacheCurrentDate = {
  set: (data) => {
    const key = CACHE_CONFIG.PREFIXES.CURRENT_DATE;
    return setCache(key, data, CACHE_CONFIG.EXPIRATION.CURRENT_DATE);
  },
  
  get: () => {
    const key = CACHE_CONFIG.PREFIXES.CURRENT_DATE;
    return getCache(key, CACHE_CONFIG.EXPIRATION.CURRENT_DATE);
  },
  
  clear: () => clearCacheByType('current_date')
};

// Invalidate cache when data changes (waivers, IR moves, lineups)
export const invalidateCacheOnDataChange = async (user, changeType = 'general') => {
  try {
    console.log(`Cache: Invalidating cache for ${changeType} change`);
    
    switch (changeType) {
      case 'lineup_change':
        // Lineup changes only affect matchup data and scores for current week
        console.log('Cache: Clearing matchups and scores cache for lineup change');
        await Promise.all([
          cacheMatchups.clear(user),
          cacheScores.clear(user)
        ]);
        break;
        
      case 'waiver_transaction':
      case 'ir_move':
      case 'ir_placement':
      case 'ir_removal':
      case 'ir_ownership_conflict':
      case 'ir_free_agent_conflict':
      case 'ir_removal_conflict':
      case 'ir_drop_conflict':
        // Waiver and IR moves affect rosters and all related data
        console.log('Cache: Clearing all cache for roster-affecting change');
        await Promise.all([
          cachePlayers.clear(user),
          cacheRosters.clear(user),
          cacheScores.clear(user),
          cacheMatchups.clear(user)
        ]);
        break;
        
      default:
        // General changes - clear everything
        console.log('Cache: Clearing all cache for general change');
        await Promise.all([
          cachePlayers.clear(user),
          cacheRosters.clear(user),
          cacheScores.clear(user),
          cacheMatchups.clear(user)
        ]);
        break;
    }
    
    console.log('Cache: Cache invalidation completed');
  } catch (error) {
    console.error('Cache: Error during cache invalidation:', error);
  }
};

// Get cache statistics
export const getCacheStats = async () => {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const stats = {
      total: allKeys.length,
      app: 0,
      firebase: 0,
      other: 0,
      byType: {
        players: 0,
        matchups: 0,
        rosters: 0,
        scores: 0,
        current_date: 0
      }
    };
    
    allKeys.forEach(key => {
      if (key.startsWith('ff_')) {
        stats.app++;
        if (key.startsWith(CACHE_CONFIG.PREFIXES.PLAYERS)) stats.byType.players++;
        else if (key.startsWith(CACHE_CONFIG.PREFIXES.MATCHUPS)) stats.byType.matchups++;
        else if (key.startsWith(CACHE_CONFIG.PREFIXES.ROSTERS)) stats.byType.rosters++;
        else if (key.startsWith(CACHE_CONFIG.PREFIXES.SCORES)) stats.byType.scores++;
        else if (key.startsWith(CACHE_CONFIG.PREFIXES.CURRENT_DATE)) stats.byType.current_date++;
      } else if (key.includes('firebase')) {
        stats.firebase++;
      } else {
        stats.other++;
      }
    });
    
    return stats;
  } catch (error) {
    console.error('Cache: Error getting cache stats:', error);
    return null;
  }
};

export { CACHE_CONFIG }; 