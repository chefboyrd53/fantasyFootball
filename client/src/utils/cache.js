export const getCache = (key) => {
  try {
    const cached = localStorage.getItem(key);
    return cached ? JSON.parse(cached) : null;
  } catch (e) {
    console.error('Error reading cache', e);
    return null;
  }
};

export const setCache = (key, data) => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
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