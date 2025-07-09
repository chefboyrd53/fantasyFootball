import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';

export default function SettingsPage({ onLogout, user }) {
  return (
    <View style={styles.container}>
      <Text style={styles.header}>Settings</Text>
      <View style={styles.section}>
        <Text style={styles.label}>Logged in as:</Text>
        <Text style={styles.email}>{user?.email}</Text>
      </View>
      <TouchableOpacity style={styles.logoutButton} onPress={onLogout}>
        <Text style={styles.logoutButtonText}>Logout</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.clearCacheButton}
        onPress={async () => {
          try {
            await AsyncStorage.clear();
            Alert.alert('Cache Cleared', 'AsyncStorage has been cleared.');
          } catch (e) {
            Alert.alert('Error', 'Failed to clear cache.');
          }
        }}
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