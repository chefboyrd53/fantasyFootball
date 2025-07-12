import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { clearAppCache, getCacheStats } from '../utils/cache';
import { Alert } from 'react-native';

export default function SettingsPage({ onLogout, user }) {
  const clearAppCacheHandler = async () => {
    try {
      const clearedCount = await clearAppCache();
      Alert.alert('Cache Cleared', `Cleared ${clearedCount} app cache entries. Authentication data preserved.`);
    } catch (e) {
      console.error('SettingsPage: Error clearing cache:', e);
      Alert.alert('Error', 'Failed to clear cache.');
    }
  };

  const showCacheStats = async () => {
    try {
      const stats = await getCacheStats();
      if (stats) {
        Alert.alert('Cache Statistics', 
          `Total entries: ${stats.total}\n` +
          `App cache: ${stats.app}\n` +
          `Firebase: ${stats.firebase}\n` +
          `Other: ${stats.other}\n\n` +
          `By type:\n` +
          `- Players: ${stats.byType.players}\n` +
          `- Matchups: ${stats.byType.matchups}\n` +
          `- Rosters: ${stats.byType.rosters}\n` +
          `- Scores: ${stats.byType.scores}\n` +
          `- Current Date: ${stats.byType.current_date}`
        );
      } else {
        Alert.alert('Cache Statistics', 'Unable to retrieve cache statistics.');
      }
    } catch (e) {
      console.error('SettingsPage: Error getting cache stats:', e);
      Alert.alert('Error', 'Failed to get cache statistics.');
    }
  };

  const handleLogout = async () => {
    try {
      console.log('SettingsPage: Logout initiated, clearing cache first');
      
      // Clear app cache before logout
      await clearAppCache();
      
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
        onPress={clearAppCacheHandler}
      >
        <Text style={styles.clearCacheButtonText}>Clear Cache</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.cacheStatsButton}
        onPress={showCacheStats}
      >
        <Text style={styles.cacheStatsButtonText}>Cache Statistics</Text>
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
  cacheStatsButton: {
    backgroundColor: '#33adff',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 32,
    alignItems: 'center',
    marginTop: 16,
  },
  cacheStatsButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
}); 