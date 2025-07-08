// Cache version - increment this when making breaking changes
const CACHE_VERSION = '1.0.0';

export const getCache = (key) => {
  try {
    const cached = localStorage.getItem(key);
    if (!cached) return null;
    
    const parsed = JSON.parse(cached);
    // Check if the cached data has a version and if it matches current version
    if (parsed.version !== CACHE_VERSION) {
      // Clear outdated cache
      localStorage.removeItem(key);
      return null;
    }
    return parsed.data;
  } catch (e) {
    console.error('Error reading cache', e);
    return null;
  }
};

export const setCache = (key, data) => {
  try {
    const cacheData = {
      version: CACHE_VERSION,
      data: data
    };
    localStorage.setItem(key, JSON.stringify(cacheData));
  } catch (e) {
    console.error('Error setting cache', e);
  }
};

export const clearCache = (key) => {
  try {
    localStorage.removeItem(key);
  } catch (e) {
    console.error('Error clearing cache', e);
  }
};