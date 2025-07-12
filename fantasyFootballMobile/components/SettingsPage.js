import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';

export default function SettingsPage({ onLogout, user }) {
  const clearAppCache = async () => {
    try {
      // Get all keys from AsyncStorage
      const allKeys = await AsyncStorage.getAllKeys();
      
      // Filter out app-specific cache keys (preserve Firebase auth keys)
      const cacheKeys = allKeys.filter(key => 
        key.startsWith('ff_cache_') ||
        key.startsWith('rosters_cache_') ||
        key.startsWith('matchups_cache_') ||
        key.startsWith('scores_cache_')
      );
      
      console.log('SettingsPage: Clearing app cache keys:', cacheKeys);
      
      if (cacheKeys.length > 0) {
        // Remove only the app cache keys
        await AsyncStorage.multiRemove(cacheKeys);
        Alert.alert('Cache Cleared', `Cleared ${cacheKeys.length} app cache entries. Authentication data preserved.`);
      } else {
        Alert.alert('Cache Cleared', 'No app cache data found to clear.');
      }
    } catch (e) {
      console.error('SettingsPage: Error clearing cache:', e);
      Alert.alert('Error', 'Failed to clear cache.');
    }
  };

  const handleLogout = async () => {
    try {
      console.log('SettingsPage: Logout initiated, clearing cache first');
      
      // Clear app cache before logout
      const allKeys = await AsyncStorage.getAllKeys();
      const cacheKeys = allKeys.filter(key => 
        key.startsWith('ff_cache_') ||
        key.startsWith('rosters_cache_') ||
        key.startsWith('matchups_cache_') ||
        key.startsWith('scores_cache_')
      );
      
      if (cacheKeys.length > 0) {
        console.log('SettingsPage: Clearing cache before logout:', cacheKeys);
        await AsyncStorage.multiRemove(cacheKeys);
      }
      
      // Now call the original logout function
      onLogout();
    } catch (e) {
      console.error('SettingsPage: Error during logout cache clearing:', e);
      // Still proceed with logout even if cache clearing fails
      onLogout();
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Settings</Text>
      <View style={styles.section}>
        <Text style={styles.label}>Logged in as:</Text>
        <Text style={styles.email}>{user?.email}</Text>
      </View>
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutButtonText}>Logout</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.clearCacheButton}
        onPress={clearAppCache}
      >
        <Text style={styles.clearCacheButtonText}>Clear Cache</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#18181b',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  header: {
    color: '#fff',
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 32,
  },
  section: {
    marginBottom: 32,
    alignItems: 'center',
  },
  label: {
    color: '#a1a1aa',
    fontSize: 16,
    marginBottom: 4,
  },
  email: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  logoutButton: {
    backgroundColor: '#f59e0b',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 32,
    alignItems: 'center',
  },
  logoutButtonText: {
    color: '#18181b',
    fontSize: 18,
    fontWeight: 'bold',
  },
  clearCacheButton: {
    backgroundColor: '#6666ff',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 32,
    alignItems: 'center',
    marginTop: 16,
  },
  clearCacheButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
}); 