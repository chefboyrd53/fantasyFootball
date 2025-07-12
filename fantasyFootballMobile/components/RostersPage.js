import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, Image, RefreshControl } from 'react-native';
import { db } from '../firebase';
import { collection, getDocs } from 'firebase/firestore';
import { cacheRosters } from '../utils/cache';

const POSITION_COLORS = {
  QB: '#ff6666',
  RB: '#00ffcc',
  WR: '#33adff',
  TE: '#66ff33',
  DST: '#bf8040',
  K: '#e066ff',
};

const POSITION_ORDER = ['QB', 'RB', 'WR', 'TE', 'K', 'DST'];

const TEAM_ORDER = {
  blue: ['Paul', 'Mick', 'Steve', 'Jason'],
  gold: ['Mike', 'Chris', 'Mark', 'John']
};

function getPositionColor(pos) {
  return POSITION_COLORS[pos] || '#fff';
}

const NAVY_BLUE = '#6666ff';

export default function RostersPage({ players, ownerMap, currentUser, onDataRefresh }) {
  const [teams, setTeams] = useState({ blue: [], gold: [] });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastFetchedDate, setLastFetchedDate] = useState(null);
  const [dataLoaded, setDataLoaded] = useState(false);

  // Function to fetch teams data from Firestore
  const fetchTeamsData = useCallback(async (isRefresh = false) => {
    // Get current values from props to avoid stale closure issues
    const currentPlayers = players;
    const currentOwnerMap = ownerMap;
    
    if (currentPlayers.length === 0 || Object.keys(currentOwnerMap).length === 0) {
      console.log('RostersPage: Skipping fetch - no players or ownerMap data');
      return;
    }

    console.log('RostersPage: fetchTeamsData called, isRefresh:', isRefresh);

    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      console.log('RostersPage: Fetching fantasy teams data from Firestore');
      // Fetch fantasy teams data to get waivers information
      const fantasyTeamsSnapshot = await getDocs(collection(db, 'fantasyTeams'));
      const fantasyTeamsData = {};
      
      fantasyTeamsSnapshot.forEach((doc) => {
        const teamData = doc.data();
        fantasyTeamsData[doc.id] = {
          waivers: teamData.waivers || 0,
          division: teamData.division || 'blue',
          irList: teamData.irList || []
        };
      });

      console.log('RostersPage: Found', Object.keys(fantasyTeamsData).length, 'fantasy teams');

      // Build team rosters using the original roster order from fantasy teams
      const teamMap = {};
      
      fantasyTeamsSnapshot.forEach((doc) => {
        const teamData = doc.data();
        const teamName = doc.id;
        
        if (!teamMap[teamName]) {
          teamMap[teamName] = [];
        }
        
        // Process roster in original order
        if (Array.isArray(teamData.roster)) {
          teamData.roster.forEach(playerId => {
            // Find the player in our players array
            const player = currentPlayers.find(p => p.id === playerId);
            if (player) {
              teamMap[teamName].push(player);
            }
          });
        }
      });

      console.log('RostersPage: Built team map with', Object.keys(teamMap).length, 'teams');

      // Determine divisions and add waivers data
      const loadedTeams = { blue: [], gold: [] };
      
      Object.entries(teamMap).forEach(([teamName, roster]) => {
        const fantasyTeamData = fantasyTeamsData[teamName] || { waivers: 0, division: 'blue', irList: [] };
        
        // Get IR players
        const irPlayers = [];
        if (Array.isArray(fantasyTeamData.irList)) {
          fantasyTeamData.irList.forEach(playerId => {
            const player = currentPlayers.find(p => p.id === playerId);
            if (player) {
              irPlayers.push(player);
            }
          });
        }
        
        const teamInfo = {
          name: teamName,
          roster: roster,
          irList: irPlayers,
          waivers: fantasyTeamData.waivers,
        };

        // Use the division from the fantasy team data, fallback to name matching
        const division = fantasyTeamData.division || 
          (TEAM_ORDER.blue.some(name => name.toLowerCase() === teamName.toLowerCase()) ? 'blue' :
           TEAM_ORDER.gold.some(name => name.toLowerCase() === teamName.toLowerCase()) ? 'gold' : 'blue');

        if (division === 'blue') {
          loadedTeams.blue.push(teamInfo);
        } else {
          loadedTeams.gold.push(teamInfo);
        }
      });

      // Sort teams according to specified order
      const normalize = (name) => name.trim().toLowerCase();
      loadedTeams.blue.sort((a, b) => 
        TEAM_ORDER.blue.findIndex(n => normalize(n) === normalize(a.name)) -
        TEAM_ORDER.blue.findIndex(n => normalize(n) === normalize(b.name))
      );

      loadedTeams.gold.sort((a, b) => 
        TEAM_ORDER.gold.findIndex(n => normalize(n) === normalize(a.name)) -
        TEAM_ORDER.gold.findIndex(n => normalize(n) === normalize(b.name))
      );

      console.log('RostersPage: Organized teams - Blue:', loadedTeams.blue.length, 'Gold:', loadedTeams.gold.length);

      setTeams(loadedTeams);
      setDataLoaded(true);
      
      // Cache the data
      try {
        await cacheRosters.set(currentUser, {
          teams: loadedTeams,
          timestamp: Date.now()
        });
        console.log('RostersPage: Data cached successfully');
      } catch (err) {
        console.log('RostersPage: Error caching data:', err);
        // Ignore cache errors
      }
      
      setLastFetchedDate(Date.now());
      console.log('RostersPage: Data fetch completed successfully');
    } catch (error) {
      console.error('RostersPage: Error fetching fantasy teams data:', error);
      // Fallback to the old method without waivers
      const loadedTeams = { blue: [], gold: [] };
      
      Object.entries(teamMap).forEach(([teamName, roster]) => {
        const teamInfo = {
          name: teamName,
          roster: roster,
          irList: [],
          waivers: 0,
        };

        if (TEAM_ORDER.blue.some(name => name.toLowerCase() === teamName.toLowerCase())) {
          loadedTeams.blue.push(teamInfo);
        } else if (TEAM_ORDER.gold.some(name => name.toLowerCase() === teamName.toLowerCase())) {
          loadedTeams.gold.push(teamInfo);
        } else {
          loadedTeams.blue.push(teamInfo);
        }
      });

      setTeams(loadedTeams);
    } finally {
      if (isRefresh) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
      console.log('RostersPage: Loading state updated');
    }
  }, [currentUser]);

  // Load cached data or fetch from Firestore
  useEffect(() => {
    if (players.length === 0 || Object.keys(ownerMap).length === 0) {
      setLoading(false);
      return;
    }

    // Only load data if we haven't loaded it yet or if the data has changed
    if (dataLoaded && teams.blue.length > 0 && teams.gold.length > 0) {
      console.log('RostersPage: Data already loaded, skipping');
      return;
    }

    const loadData = async () => {
      console.log('RostersPage: Starting data load');
      
      // Try to load from cache first
      try {
        const cached = await cacheRosters.get(currentUser);
        if (cached) {
          console.log('RostersPage: Found cached data, loading from cache');
          setTeams(cached.teams);
          setLastFetchedDate(cached.timestamp);
          setLoading(false);
          setDataLoaded(true);
          return;
        } else {
          console.log('RostersPage: No cached data found, will fetch from Firestore');
        }
      } catch (err) {
        console.log('RostersPage: Error reading cache, will fetch from Firestore:', err);
        // Ignore cache errors, fallback to fetch
      }
      
      // If not cached, fetch from Firestore
      console.log('RostersPage: Fetching data from Firestore');
      fetchTeamsData();
    };

    loadData();
  }, [players, ownerMap, currentUser, dataLoaded, teams.blue.length, teams.gold.length]);

  // Pull to refresh handler
  const onRefresh = useCallback(() => {
    console.log('RostersPage: Pull-to-refresh triggered');
    fetchTeamsData(true);
  }, [fetchTeamsData]);

  const TeamCard = ({ team, division }) => {
    // Group players by position while preserving original order
    const playersByPosition = {};
    
    // First pass: create position groups
    team.roster.forEach(player => {
      const pos = player.position || 'DST';
      if (!playersByPosition[pos]) {
        playersByPosition[pos] = [];
      }
    });
    
    // Second pass: add players in their original order
    team.roster.forEach(player => {
      const pos = player.position || 'DST';
      playersByPosition[pos].push(player);
    });

    const divisionColor = division === 'blue' ? NAVY_BLUE : '#f59e0b';

    return (
      <View style={styles.teamCard}>
        <Text style={[styles.teamCardTitle, { color: divisionColor }]}>{team.name}</Text>
        
        <View style={styles.teamCardContent}>
          {POSITION_ORDER.map(position => {
            const players = playersByPosition[position] || [];
            if (players.length === 0) return null;

            return (
              <View key={position} style={styles.positionGroup}>
                <Text style={[styles.positionTitle, { color: getPositionColor(position) }]}>{position}</Text>
                <View style={styles.playersList}>
                  {players.map((player, j) => (
                    <View key={j} style={styles.playerRow}>
                      <Text style={styles.playerName}>{player.name || ''}</Text>
                      {player.team && (
                        <Text style={styles.playerTeam}>({player.team})</Text>
                      )}
                    </View>
                  ))}
                </View>
              </View>
            );
          })}
        </View>

        {/* IR Section */}
        {team.irList && team.irList.length > 0 && (
          <View style={styles.positionGroup}>
            <Text style={[styles.positionTitle, { color: '#f59e0b' }]}>IR</Text>
            <View style={styles.playersList}>
              {team.irList.map((player, j) => (
                <View key={j} style={styles.playerRow}>
                  <Text style={styles.irPlayerName}>{player.name || ''}</Text>
                  {player.team && (
                    <Text style={styles.irPlayerTeam}>({player.team})</Text>
                  )}
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={styles.teamFooter}>
          <Text style={styles.waiversText}>Waivers: {team.waivers}</Text>
        </View>
      </View>
    );
  };

  if (!players || players.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading rosters...</Text>
      </View>
    );
  }

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          colors={['#fff']}
        />
      }
    >
      {/* Blue Division */}
      <View style={styles.divisionSection}>
        <Text style={styles.divisionTitle}>Blue Division</Text>
        <View style={styles.teamsGrid}>
          {teams.blue.map((team, i) => (
            <TeamCard key={i} team={team} division="blue" />
          ))}
        </View>
      </View>

      {/* Gold Division */}
      <View style={styles.divisionSection}>
        <Text style={styles.divisionTitleGold}>Gold Division</Text>
        <View style={styles.teamsGrid}>
          {teams.gold.map((team, i) => (
            <TeamCard key={i} team={team} division="gold" />
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#18181b',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#18181b',
  },
  loadingText: {
    color: '#fff',
    fontSize: 18,
  },
  divisionSection: {
    marginBottom: 24,
  },
  divisionTitle: {
    color: NAVY_BLUE,
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
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
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#6666ff',
    paddingBottom: 8,
  },
  teamCardContent: {
    marginBottom: 12,
  },
  positionGroup: {
    marginBottom: 12,
  },
  positionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  playersList: {
    marginLeft: 8,
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
  teamFooter: {
    borderTopWidth: 1,
    borderTopColor: '#6666ff',
    paddingTop: 8,
  },
  waiversText: {
    color: '#a1a1aa',
    fontSize: 12,
  },
  irPlayerName: {
    color: '#a1a1aa',
    fontSize: 14,
    fontStyle: 'italic',
  },
  irPlayerTeam: {
    color: '#666',
    fontSize: 12,
    marginLeft: 4,
    fontStyle: 'italic',
  },
}); 