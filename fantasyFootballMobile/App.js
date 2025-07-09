import 'react-native-reanimated';
import React, { useEffect, useState, useRef } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, Animated, Image } from 'react-native';
import { db, auth } from './firebase';
import { collection, getDocs, doc, getDoc, query } from 'firebase/firestore';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { Ionicons } from '@expo/vector-icons';
import PlayerStatsPage from './components/PlayerStatsPage';
import RostersPage from './components/RostersPage';
import MatchupsPage from './components/MatchupsPage';
import LoginPage from './components/LoginPage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SettingsPage from './components/SettingsPage';

export default function App() {
  const [players, setPlayers] = useState([]);
  const [ownerMap, setOwnerMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(null); // { year, week }
  const [lastFetchedDate, setLastFetchedDate] = useState(null); // { year, week }
  // Navigation state:
  const [currentPage, setCurrentPage] = useState('playerStats');
  // In-memory cache for player/defense/fantasyTeams data
  const dataCache = useRef({});

  // Utility: get admin status
  const isAdmin = user && user.email === 'chefboyrd53@gmail.com';

  // Utility: cache key for AsyncStorage
  const getCacheKey = (date, user) => `ff_cache_${user?.email || 'nouser'}_${date?.year}_${date?.week}`;

  // Listen for authentication state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Fetch currentDate from Firestore on mount and when app resumes
  useEffect(() => {
    async function fetchCurrentDate() {
      try {
        const whenDoc = await getDoc(doc(db, 'currentDate', 'when'));
        if (whenDoc.exists()) {
          const data = whenDoc.data();
          setCurrentDate({ year: data.year, week: data.week });
        } else {
          // Set a fallback currentDate if the document doesn't exist
          setCurrentDate({ year: 2024, week: 1 });
        }
      } catch (err) {
        console.error('App: Error fetching currentDate:', err);
        // Set a fallback currentDate if there's an error
        setCurrentDate({ year: 2024, week: 1 });
      }
    }
    fetchCurrentDate();
    // Optionally, add AppState listener to refresh on resume
  }, []);

  // Only fetch player/defense/fantasyTeams data if currentDate changes
  useEffect(() => {
    if (!user || !currentDate) return;
    // Try to load from AsyncStorage first
    (async () => {
      const cacheKey = getCacheKey(currentDate, user);
      try {
        const cached = await AsyncStorage.getItem(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          setPlayers(parsed.players);
          setOwnerMap(parsed.ownerMap);
          setLoading(false);
          dataCache.current = { ...parsed, year: currentDate.year, week: currentDate.week };
          return;
        }
      } catch (err) {
        // Ignore cache errors, fallback to fetch
      }
      // If not cached, fetch from Firestore
      fetchData(currentDate.year, currentDate.week);
    })();
  }, [user, currentDate, currentPage]);



  async function fetchData(year, week) {
    setLoading(true);
    // Use .select() to limit fields if possible (Firestore web SDK supports it)
    let playerQ = collection(db, 'players');
    let defenseQ = collection(db, 'defense');
    // Always fetch fantasyTeams to build ownerMap (needed for all pages)
    // If you want to limit fields, you can use query(playerQ, select('roster', 'scoring'))
    // But for now, fetch all fields (Firestore free tier charges per doc, not per field)
    // If you want to optimize further, uncomment below:
    // import { query, select } from 'firebase/firestore';
    // playerQ = query(playerQ, select('roster', 'scoring'));
    // defenseQ = query(defenseQ, select('scoring'));
    const [playerSnap, defenseSnap, fantasySnap] = await Promise.all([
      getDocs(playerQ),
      getDocs(defenseQ),
      getDocs(collection(db, 'fantasyTeams')),
    ]);
    const data = [];
    playerSnap.forEach((doc) => {
      const player = doc.data();
      if (player && player.roster) {
        data.push({
          id: doc.id,
          name: player.roster.name || '',
          position: player.roster.position || '',
          team: player.roster.team || '',
          scoring: player.scoring || {},
        });
      }
    });
    defenseSnap.forEach((doc) => {
      const team = doc.id;
      const scoring = doc.data();
      if (team) {
        data.push({
          id: team,
          name: team,
          position: 'DST',
          team: team,
          scoring: scoring || {},
        });
      }
    });
    // Build owner map
    const map = {};
    fantasySnap.forEach((doc) => {
      const teamName = doc.id;
      const data = doc.data();
      if (teamName && data && Array.isArray(data.roster)) {
        data.roster.forEach(id => {
          if (id) {
            map[id] = teamName;
          }
        });
      }
    });
    setOwnerMap(map);
    setPlayers(data);
    setLoading(false);
    // Cache the data for this date in memory and AsyncStorage
    dataCache.current = {
      year,
      week,
      players: data,
      ownerMap: map,
    };
    const cacheKey = getCacheKey({ year, week }, user);
    try {
      await AsyncStorage.setItem(cacheKey, JSON.stringify({ players: data, ownerMap: map }));
    } catch (err) {
      // Ignore cache errors
    }
    setLastFetchedDate({ year, week });
  }

  const handleLoginSuccess = (user) => {
    setUser(user);
  };

  const handleLogout = async () => {
    try {
      setPlayers([]);
      setOwnerMap({});
      await signOut(auth);
      setUser(null);
      setCurrentPage('playerStats');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const renderCurrentPage = () => {
    if (loading) {
      return null;
    }
    // Ensure we have valid data
    const safePlayers = players || [];
    const safeOwnerMap = ownerMap || {};
    switch (currentPage) {
      case 'playerStats':
        return <PlayerStatsPage players={safePlayers} ownerMap={safeOwnerMap} currentUser={user} />;
      case 'rosters':
        return <RostersPage players={safePlayers} ownerMap={safeOwnerMap} />;
      case 'matchups':
        return <MatchupsPage currentUser={user} currentDate={currentDate} />;
      case 'settings':
        return <SettingsPage onLogout={handleLogout} user={user} />;
      default:
        return <PlayerStatsPage players={safePlayers} ownerMap={safeOwnerMap} currentUser={user} />;
    }
  };

  // Show loading screen while checking authentication
  if (authLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Image source={require('./assets/icon.png')} style={styles.loadingLogo} resizeMode="contain" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  // Show login page if not authenticated
  if (!user) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <View style={styles.container}>
      {/* Top Navbar */}
      <View style={styles.navbar}>
        <Image source={require('./assets/icon.png')} style={styles.navbarLogo} resizeMode="contain" />
        <View style={styles.navbarRight}>
          <TouchableOpacity style={styles.settingsButton} onPress={() => setCurrentPage('settings')}>
            <Ionicons name="settings-sharp" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
      <View style={{ flex: 1 }}>
        {renderCurrentPage()}
      </View>
      {/* Bottom Navbar */}
      <View style={styles.bottomNavbar}>
        <TouchableOpacity style={styles.bottomNavItem} onPress={() => setCurrentPage('playerStats')}>
          <Ionicons name="stats-chart" size={24} color={currentPage === 'playerStats' ? '#f59e0b' : '#fff'} />
          <Text style={[styles.bottomNavLabel, currentPage === 'playerStats' && styles.bottomNavLabelActive]}>Stats</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.bottomNavItem} onPress={() => setCurrentPage('rosters')}>
          <Ionicons name="people" size={24} color={currentPage === 'rosters' ? '#f59e0b' : '#fff'} />
          <Text style={[styles.bottomNavLabel, currentPage === 'rosters' && styles.bottomNavLabelActive]}>Rosters</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.bottomNavItem} onPress={() => setCurrentPage('matchups')}>
          <Ionicons name="american-football" size={24} color={currentPage === 'matchups' ? '#f59e0b' : '#fff'} />
          <Text style={[styles.bottomNavLabel, currentPage === 'matchups' && styles.bottomNavLabelActive]}>Matchups</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#18181b',
    paddingTop: 50,
    paddingHorizontal: 0, // Remove horizontal padding for full width navbars
  },
  header: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
    textAlign: 'center',
  },
  input: {
    backgroundColor: '#18181b',
    borderColor: '#6666ff',
    borderWidth: 1,
    borderRadius: 8,
    color: '#fff',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#232336',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  rank: {
    color: '#a1a1aa',
    fontWeight: 'bold',
    width: 32,
    textAlign: 'right',
    fontSize: 16,
    marginRight: 8,
  },
  name: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 18,
  },
  meta: {
    color: '#a1a1aa',
    fontSize: 14,
    marginTop: 2,
    textAlign: 'left',
    alignSelf: 'flex-start',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    flex: 1,
    backgroundColor: '#232336',
    width: '100%',
    maxWidth: '100%',
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    paddingTop: 60,
    paddingHorizontal: 0,
    borderRadius: 0,
  },
  modalTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'left',
    alignSelf: 'flex-start',
    paddingLeft: 20,
  },
  sectionTitle: {
    color: '#f59e0b',
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'left',
    alignSelf: 'flex-start',
    paddingLeft: 20,
  },
  statGrid: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
    paddingVertical: 8,
  },
  statCell: {
    width: '33.33%',
    alignItems: 'center',
    marginBottom: 12,
    paddingVertical: 6,
  },
  statLabel: {
    color: '#a1a1aa',
    fontSize: 13,
    marginBottom: 2,
    textAlign: 'center',
  },
  statValue: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 18,
    textAlign: 'center',
  },
  closeIconFilters: {
    position: 'absolute',
    top: 18,
    right: 18,
    zIndex: 10,
    padding: 8,
  },
  closeIconStats: {
    position: 'absolute',
    top: 60,
    right: 18,
    zIndex: 10,
    padding: 8,
  },
  closeIconText: {
    color: '#fff',
    fontSize: 28,
    fontWeight: 'bold',
  },
  filterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    marginBottom: 30,
  },
  filterItem: {
    flex: 1,
    marginRight: 8,
    minWidth: 0,
    marginBottom: 20,
  },
  filterLabel: {
    color: '#a1a1aa',
    fontSize: 13,
    marginBottom: 2,
  },
  dropdown: {
    backgroundColor: '#18181b',
    borderColor: '#6666ff',
    borderRadius: 8,
    minWidth: 0,
  },
  points: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 18,
    marginLeft: 8,
    width: 60,
    textAlign: 'right',
  },
  statsDivider: {
    height: 1,
    backgroundColor: '#fff',
    opacity: 1,
    marginVertical: 12,
    marginLeft: 0,
    marginRight: 0,
    width: '90%',
    alignSelf: 'center',
  },
  filtersDivider: {
    height: 1,
    backgroundColor: '#fff',
    opacity: 1,
    marginVertical: 12,
    marginLeft: 0,
    marginRight: 0,
    width: '100%',
    alignSelf: 'center',
  },
  modalMeta: {
    paddingLeft: 20,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    backgroundColor: '#18181b',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    zIndex: 50,
  },
  filterButton: {
    backgroundColor: '#18181b',
    borderColor: '#6666ff',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
  },
  filterButtonText: {
    color: '#6666ff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  filterPanel: {
    backgroundColor: '#232336',
    borderRadius: 8,
    padding: 8,
    borderColor: '#6666ff',
    borderWidth: 1,
    zIndex: 2,
    minHeight: 150,
    flexDirection: 'column',
  },
  rowEven: {
    backgroundColor: '#232336',
  },
  rowOdd: {
    backgroundColor: '#18181b',
  },
  filterModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  filterModalContent: {
    backgroundColor: '#232336',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 30, // reduced from 60
    paddingHorizontal: 20,
    paddingBottom: 60, // increased from 40
    minHeight: 500,
    width: '100%',
    alignItems: 'flex-start',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 2,
  },
  filterModalTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 5,
    textAlign: 'left',
    alignSelf: 'flex-start',
  },
  filterModalScroll: {
    width: '100%',
  },
  filterModalItem: {
    width: '100%',
    marginBottom: 8,
  },
  pickerWheelContainer: {
    backgroundColor: '#18181b',
    borderRadius: 8,
    borderColor: '#6666ff',
    borderWidth: 1,
    marginBottom: 16,
  },
  pickerWheel: {
    color: '#fff',
    width: '100%',
    height: 44,
  },
  pickerWheelItem: {
    color: '#fff',
    fontSize: 18,
  },
  toggleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  toggleButton: {
    backgroundColor: '#18181b',
    borderColor: '#6666ff',
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginRight: 8,
    marginBottom: 8,
  },
  toggleButtonActive: {
    backgroundColor: '#6666ff',
    borderColor: '#6666ff',
  },
  toggleButtonText: {
    color: '#fff',
    fontSize: 15,
  },
  toggleButtonTextActive: {
    color: '#18181b',
    fontWeight: 'bold',
  },
  sortToggleRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  sortToggleButton: {
    backgroundColor: '#18181b',
    borderColor: '#6666ff',
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
  },
  sortToggleButtonActive: {
    backgroundColor: '#6666ff',
    borderColor: '#6666ff',
  },
  sortToggleButtonText: {
    color: '#fff',
    fontSize: 15,
  },
  sortToggleButtonTextActive: {
    color: '#18181b',
    fontWeight: 'bold',
  },
  weekScroll: {
    flexDirection: 'row',
    marginTop: 8,
    marginBottom: 8,
    minHeight: 44,
  },
  teamLogoChip: {
    backgroundColor: '#18181b',
    borderColor: '#6666ff',
    borderWidth: 1,
    borderRadius: 24,
    marginRight: 8,
    marginBottom: 8,
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  teamLogoChipActive: {
    backgroundColor: '#6666ff',
    borderColor: '#6666ff',
  },
  teamLogoImg: {
    width: 32,
    height: 32,
  },
  avgPoints: {
    color: '#a1a1aa',
    fontSize: 13,
    textAlign: 'right',
    marginTop: 2,
  },
  pointsCol: {
    flexDirection: 'column',
    alignItems: 'flex-end',
    minWidth: 60,
  },
  filterIcon: {
    color: '#6666ff',
    fontSize: 22,
    fontWeight: 'bold',
  },
  instantOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    zIndex: 1,
  },
  clearSearchIcon: {
    position: 'absolute',
    right: 10,
    top: '50%',
    marginTop: -10,
    zIndex: 2,
  },
  navbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 8,
    backgroundColor: '#232336',
    borderBottomWidth: 1,
    borderBottomColor: '#6666ff',
    zIndex: 100,
    marginHorizontal: 0,
    marginTop: -50,
  },
  navbarLogo: {
    width: 32,
    height: 32,
  },
  navbarRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userEmail: {
    color: '#fff',
    fontSize: 16,
    marginRight: 10,
  },
  settingsButton: {
    padding: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#18181b',
  },
  loadingLogo: {
    width: 80,
    height: 80,
    marginBottom: 20,
  },
  loadingText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  menuButton: {
    padding: 8,
  },
  placeholderPage: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#18181b',
    padding: 20,
  },
  placeholderTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  placeholderText: {
    color: '#a1a1aa',
    fontSize: 18,
    textAlign: 'center',
  },
  rostersContainer: {
    flex: 1,
    backgroundColor: '#18181b',
  },
  divisionSection: {
    marginBottom: 24,
  },
  divisionTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  divisionTitleGold: {
    color: '#f59e0b',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  teamsGrid: {
    paddingHorizontal: 16,
  },
  teamCard: {
    backgroundColor: '#232336',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#6666ff',
  },
  teamCardTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#6666ff',
    paddingBottom: 8,
  },
  positionGroup: {
    marginBottom: 12,
  },
  positionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  playerName: {
    color: '#fff',
    fontSize: 14,
  },
  playerTeam: {
    color: '#a1a1aa',
    fontSize: 12,
    marginLeft: 4,
  },
  bottomNavbar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#232336',
    borderTopWidth: 1,
    borderTopColor: '#6666ff',
    paddingVertical: 4,
    paddingBottom: 20, // Add padding to avoid iOS home indicator
    height: 76, // Increase height to accommodate padding
  },
  bottomNavItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomNavLabel: {
    color: '#a1a1aa',
    fontSize: 11,
    marginTop: 2,
  },
  bottomNavLabelActive: {
    color: '#f59e0b',
    fontWeight: 'bold',
  },
});
