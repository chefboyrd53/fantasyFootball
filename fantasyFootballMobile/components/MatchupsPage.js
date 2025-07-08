import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView, Platform } from 'react-native';
import { ScrollView as RNScrollView } from 'react-native';
import { db } from '../firebase';
import { collection, doc, getDoc, getDocs, updateDoc } from 'firebase/firestore';

const LINEUP_SLOTS = [
  { id: 'QB', label: 'QB', count: 1 },
  { id: 'RB', label: 'RB', count: 2 },
  { id: 'WR', label: 'WR', count: 3 },
  { id: 'TE', label: 'TE', count: 1 },
  { id: 'FLEX', label: 'FLEX', count: 1 },
  { id: 'K', label: 'K', count: 1 },
  { id: 'DST', label: 'DST', count: 1 },
];

const POSITION_COLORS = {
  QB: '#ff6666',
  RB: '#00ffcc',
  WR: '#33adff',
  TE: '#66ff33',
  FLEX: '#f59e0b',
  DST: '#bf8040',
  K: '#e066ff',
};

function getPositionColor(pos) {
  return POSITION_COLORS[pos] || '#fff';
}

export default function MatchupsPage() {
  const [selectedYear, setSelectedYear] = useState('2024');
  const [selectedWeek, setSelectedWeek] = useState('week1');
  const [matchups, setMatchups] = useState([]);
  const [expanded, setExpanded] = useState({});
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(null);
  const [availableWeeks, setAvailableWeeks] = useState([]);
  const [playersCache, setPlayersCache] = useState({});
  const [lineups, setLineups] = useState({});
  const [saving, setSaving] = useState(false);

  // Fetch current date (for current week logic)
  useEffect(() => {
    async function fetchCurrentDate() {
      const whenDoc = await getDoc(doc(db, 'currentDate', 'when'));
      if (whenDoc.exists()) {
        const data = whenDoc.data();
        setCurrentDate({ year: data.year, week: data.week });
      }
    }
    fetchCurrentDate();
  }, []);

  // Set available weeks when currentDate changes
  useEffect(() => {
    if (currentDate) {
      const weeks = [];
      for (let i = 1; i <= currentDate.week; i++) {
        weeks.push(`week${i}`);
      }
      setAvailableWeeks(weeks);
      setSelectedWeek(`week${currentDate.week}`);
      setSelectedYear(currentDate.year.toString());
    }
  }, [currentDate]);

  // Fetch matchups when year/week changes
  useEffect(() => {
    async function fetchMatchups() {
      setLoading(true);
      const gamesSnapshot = await getDocs(collection(db, 'matchups', selectedYear, 'weeks', selectedWeek, 'games'));
      const gamesData = gamesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMatchups(gamesData);
      setLoading(false);
      // Preload lineups
      const newLineups = {};
      for (const matchup of gamesData) {
        newLineups[matchup.id] = {
          home: matchup.homeLineup || {},
          away: matchup.awayLineup || {},
        };
      }
      setLineups(newLineups);
    }
    if (selectedYear && selectedWeek) fetchMatchups();
  }, [selectedYear, selectedWeek]);

  // Fetch players for a team
  async function fetchTeamPlayers(teamName) {
    if (playersCache[teamName]) return playersCache[teamName];
    const teamsSnapshot = await getDocs(collection(db, 'fantasyTeams'));
    const teamDoc = teamsSnapshot.docs.find(doc => doc.id === teamName);
    if (!teamDoc) return [];
    const roster = teamDoc.data().roster || [];
    const playerObjs = await Promise.all(roster.map(async (id) => {
      if (id.length <= 3) {
        const defenseDoc = await getDoc(doc(db, 'defense', id));
        if (defenseDoc.exists()) {
          return {
            id,
            name: id,
            position: 'DST',
            team: null,
            scoring: { ...defenseDoc.data() },
          };
        }
      } else {
        const playerDoc = await getDoc(doc(db, 'players', id));
        if (playerDoc.exists()) {
          const p = playerDoc.data();
          return {
            id,
            name: p.roster.name,
            position: p.roster.position,
            team: p.roster.team,
            scoring: p.scoring || {},
          };
        }
      }
      return null;
    }));
    const players = playerObjs.filter(Boolean);
    setPlayersCache(prev => ({ ...prev, [teamName]: players }));
    return players;
  }

  // Expand/collapse matchup
  const toggleExpand = (id) => {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Calculate team score
  function calculateTeamScore(players, lineup) {
    return Object.values(lineup)
      .flat()
      .reduce((total, playerId) => {
        const player = players.find(p => p.id === playerId);
        if (!player) return total;
        const weekNum = parseInt(selectedWeek.replace('week', ''));
        const playerScore = player.scoring?.[selectedYear]?.[weekNum]?.points || 0;
        return total + playerScore;
      }, 0);
  }

  // Render
  return (
    <View style={styles.container}>
      {/* Top Controls */}
      <View style={styles.topBarRow}>
        <View style={styles.filterModalItemRow}>
          <Text style={styles.filterLabel}>Year</Text>
          <RNScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.weekScroll} contentContainerStyle={{ paddingVertical: 4 }}>
            <TouchableOpacity
              style={[styles.toggleButton, selectedYear === '2024' ? styles.toggleButtonActive : null, { minWidth: 48, alignItems: 'center' }]}
              onPress={() => setSelectedYear('2024')}
            >
              <Text style={[styles.toggleButtonText, selectedYear === '2024' ? styles.toggleButtonTextActive : null]}>2024</Text>
            </TouchableOpacity>
          </RNScrollView>
        </View>
        <View style={styles.filterModalItemRow}>
          <Text style={styles.filterLabel}>Week</Text>
          <RNScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.weekScroll} contentContainerStyle={{ paddingVertical: 4 }}>
            {availableWeeks.map(week => (
              <TouchableOpacity
                key={week}
                style={[styles.toggleButton, selectedWeek === week ? styles.toggleButtonActive : null, { minWidth: 48, alignItems: 'center' }]}
                onPress={() => setSelectedWeek(week)}
              >
                <Text style={[styles.toggleButtonText, selectedWeek === week ? styles.toggleButtonTextActive : null]}>
                  {week === 'All' ? 'All Weeks' : 'W' + week.replace('week', '')}
                </Text>
              </TouchableOpacity>
            ))}
          </RNScrollView>
        </View>
      </View>
      {/* Matchups List */}
      {loading ? (
        <ActivityIndicator size="large" style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
          {matchups.map((matchup) => (
            <MatchupCard
              key={matchup.id}
              matchup={matchup}
              expanded={!!expanded[matchup.id]}
              toggleExpand={() => toggleExpand(matchup.id)}
              selectedYear={selectedYear}
              selectedWeek={selectedWeek}
              fetchTeamPlayers={fetchTeamPlayers}
              calculateTeamScore={calculateTeamScore}
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function MatchupCard({ matchup, expanded, toggleExpand, selectedYear, selectedWeek, fetchTeamPlayers, calculateTeamScore }) {
  const [homePlayers, setHomePlayers] = useState([]);
  const [awayPlayers, setAwayPlayers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Calculate scores directly from starter IDs without loading full player objects
  async function calculateScoreFromStarters(starterIds) {
    if (!starterIds || starterIds.length === 0) return 0;
    
    const weekNum = parseInt(selectedWeek.replace('week', ''));
    let totalScore = 0;
    
    for (const id of starterIds) {
      if (id.length <= 3) {
        // Defense team
        const defenseDoc = await getDoc(doc(db, 'defense', id));
        if (defenseDoc.exists()) {
          const scoring = defenseDoc.data();
          totalScore += scoring?.[selectedYear]?.[weekNum]?.points || 0;
        }
      } else {
        // Player
        const playerDoc = await getDoc(doc(db, 'players', id));
        if (playerDoc.exists()) {
          const player = playerDoc.data();
          totalScore += player.scoring?.[selectedYear]?.[weekNum]?.points || 0;
        }
      }
    }
    
    return totalScore;
  }

  // State for collapsed scores
  const [homeScore, setHomeScore] = useState(0);
  const [awayScore, setAwayScore] = useState(0);
  const [scoresLoading, setScoresLoading] = useState(true);

  // Calculate scores when matchup or week changes
  useEffect(() => {
    async function calculateScores() {
      setScoresLoading(true);
      const home = await calculateScoreFromStarters(matchup.homeStarters || []);
      const away = await calculateScoreFromStarters(matchup.awayStarters || []);
      setHomeScore(home);
      setAwayScore(away);
      setScoresLoading(false);
    }
    calculateScores();
  }, [matchup.homeStarters, matchup.awayStarters, selectedYear, selectedWeek]);

  // Fetch only the starter players for this matchup
  async function fetchPlayersByIds(playerIds) {
    const playerObjs = await Promise.all(playerIds.map(async (id) => {
      if (id.length <= 3) {
        const defenseDoc = await getDoc(doc(db, 'defense', id));
        if (defenseDoc.exists()) {
          return {
            id,
            name: id,
            position: 'DST',
            team: null,
            scoring: { ...defenseDoc.data() },
          };
        }
      } else {
        const playerDoc = await getDoc(doc(db, 'players', id));
        if (playerDoc.exists()) {
          const p = playerDoc.data();
          return {
            id,
            name: p.roster.name,
            position: p.roster.position,
            team: p.roster.team,
            scoring: p.scoring || {},
          };
        }
      }
      return null;
    }));
    return playerObjs.filter(Boolean);
  }

  useEffect(() => {
    let mounted = true;
    async function loadPlayers() {
      setLoading(true);
      const home = await fetchPlayersByIds(matchup.homeStarters || []);
      const away = await fetchPlayersByIds(matchup.awayStarters || []);
      if (mounted) {
        setHomePlayers(home);
        setAwayPlayers(away);
        setLoading(false);
      }
    }
    if (expanded) loadPlayers();
    return () => { mounted = false; };
  }, [expanded, matchup.homeStarters, matchup.awayStarters]);

  // Build slot arrays for each team, matching web logic
  function buildLineup(players, starterIds) {
    const slotObj = {};
    const usedPlayerIds = new Set();
    LINEUP_SLOTS.forEach(slot => {
      slotObj[slot.id] = Array(slot.count).fill('');
      const slotPlayers = (starterIds || []).filter(id => {
        const player = players.find(p => p.id === id);
        if (!player) return false;
        const isValidForSlot = (
          slot.id === 'FLEX'
            ? ['RB', 'WR', 'TE'].includes(player.position)
            : player.position === slot.id
        );
        return isValidForSlot && !usedPlayerIds.has(id);
      });
      slotPlayers.forEach((playerId, index) => {
        if (index < slot.count) {
          slotObj[slot.id][index] = playerId;
          usedPlayerIds.add(playerId);
        }
      });
    });
    return slotObj;
  }

  // Helper function to get last name
  function getLastName(fullName) {
    if (!fullName) return '';
    const parts = fullName.trim().split(' ');
    
    if (parts.length === 1) {
      return parts[0];
    }
    
    // Remove first name, keep everything else
    return parts.slice(1).join(' ');
  }

  const homeLineup = buildLineup(homePlayers, matchup.homeStarters);
  const awayLineup = buildLineup(awayPlayers, matchup.awayStarters);

  function renderLineupRows() {
    const rows = [];
    for (const slot of LINEUP_SLOTS) {
      for (let idx = 0; idx < slot.count; idx++) {
        const homePlayerId = (homeLineup[slot.id] || [])[idx];
        const awayPlayerId = (awayLineup[slot.id] || [])[idx];
        const homePlayer = homePlayers.find(p => p.id === homePlayerId);
        const awayPlayer = awayPlayers.find(p => p.id === awayPlayerId);
        const weekNum = parseInt(selectedWeek.replace('week', ''));
        const homePoints = homePlayer ? (homePlayer.scoring?.[selectedYear]?.[weekNum]?.points || 0) : 0;
        const awayPoints = awayPlayer ? (awayPlayer.scoring?.[selectedYear]?.[weekNum]?.points || 0) : 0;
        rows.push(
          <View key={slot.id + '-' + idx} style={styles.lineupRow3col}>
            {/* Home player info (left aligned) */}
            <View style={styles.lineupPlayerColLeft}>
              {homePlayer ? (
                <>
                  <Text style={styles.playerNameLeft}>{getLastName(homePlayer.name)}</Text>
                  <View style={styles.playerMetaRowLeft}>
                    <Text style={[styles.playerPositionLeft, { color: getPositionColor(homePlayer.position), fontWeight: 'bold' }]}>{homePlayer.position}</Text>
                    {homePlayer.team && homePlayer.position ? <Text style={styles.playerMetaDot}> ·</Text> : null}
                    {homePlayer.team ? <Text style={styles.playerTeamLeft}>{homePlayer.team}</Text> : null}
                  </View>
                </>
              ) : (
                <Text style={styles.emptySlot}>Empty</Text>
              )}
            </View>
            {/* Points */}
            <View style={styles.lineupPointsCol}>
              <Text style={styles.playerPoints}>{homePoints}</Text>
              <Text style={styles.playerPointsDivider}>-</Text>
              <Text style={styles.playerPoints}>{awayPoints}</Text>
            </View>
            {/* Away player info (right aligned) */}
            <View style={styles.lineupPlayerColRight}>
              {awayPlayer ? (
                <>
                  <Text style={styles.playerNameRight}>{getLastName(awayPlayer.name)}</Text>
                  <View style={styles.playerMetaRowRight}>
                    {awayPlayer.team ? <Text style={styles.playerTeamRight}>{awayPlayer.team}</Text> : null}
                    {awayPlayer.team && awayPlayer.position ? <Text style={styles.playerMetaDot}>· </Text> : null}
                    <Text style={[styles.playerPositionRight, { color: getPositionColor(awayPlayer.position), fontWeight: 'bold' }]}>{awayPlayer.position}</Text>
                  </View>
                </>
              ) : (
                <Text style={styles.emptySlot}>Empty</Text>
              )}
            </View>
          </View>
        );
      }
    }
    return rows;
  }

  return (
    <View style={styles.matchupCard}>
      {/* Collapsed Header */}
      <TouchableOpacity onPress={toggleExpand} style={styles.matchupHeader}>
        <View style={styles.teamNameCol}>
          <Text style={styles.teamName}>{matchup.homeTeam}</Text>
        </View>
        <View style={styles.scoreCol}>
          {scoresLoading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Text style={styles.score}>{homeScore}</Text>
              <Text style={styles.scoreDivider}>-</Text>
              <Text style={styles.score}>{awayScore}</Text>
            </>
          )}
        </View>
        <View style={styles.teamNameCol}>
          <Text style={styles.teamName}>{matchup.awayTeam}</Text>
        </View>
      </TouchableOpacity>
      {/* Expanded Content */}
      {expanded && (
        <View style={styles.lineupsContainer}>
          {loading ? (
            <ActivityIndicator size="small" style={{ marginVertical: 16 }} />
          ) : (
            <View style={styles.lineupsRowsContainer}>
              {renderLineupRows()}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#18181b',
    paddingTop: 8,
  },
  topBarRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 8,
    paddingHorizontal: 8,
    gap: 12,
  },
  filterModalItemRow: {
    flex: 0,
    marginBottom: 0,
    marginRight: 12,
  },
  filterLabel: {
    color: '#a1a1aa',
    fontSize: 13,
    marginBottom: 2,
  },
  weekScroll: {
    flexDirection: 'row',
    marginTop: 8,
    marginBottom: 8,
    minHeight: 44,
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
  matchupCard: {
    backgroundColor: '#232336',
    borderRadius: 12,
    marginHorizontal: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#6666ff',
    overflow: 'hidden',
  },
  matchupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: '#232336',
  },
  teamNameCol: {
    flex: 3,
    alignItems: 'center',
  },
  teamName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  scoreCol: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  score: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    minWidth: 32,
    textAlign: 'center',
  },
  scoreDivider: {
    color: '#fff',
    fontSize: 18,
    marginHorizontal: 4,
  },
  lineupsContainer: {
    backgroundColor: '#18181b',
    borderTopWidth: 1,
    borderTopColor: '#6666ff',
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  lineupsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  lineupCol: {
    flex: 1,
    gap: 4,
  },
  slotPlayersCol: {
    flex: 1,
  },
  playerRowCol: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    marginBottom: 8,
    gap: 0,
  },
  playerName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    marginRight: 4,
    textAlign: 'right', // right align
  },
  playerMeta: {
    color: '#a1a1aa',
    fontSize: 12,
    marginRight: 4,
  },
  playerMetaUnder: {
    color: '#a1a1aa',
    fontSize: 12,
    marginTop: 0,
    marginBottom: 0,
    textAlign: 'right', // right align
  },
  playerPoints: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 0,
    marginRight: 0,
  },
  emptySlot: {
    color: '#a1a1aa',
    fontStyle: 'italic',
    fontSize: 14,
  },
  lineupRow3col: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 0,
  },
  lineupPlayerCol: {
    flex: 3,
    alignItems: 'flex-end', // right align
    justifyContent: 'center',
    minWidth: 80,
  },
  lineupPointsCol: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 60,
  },
  playerPointsDivider: {
    color: '#fff',
    fontSize: 16,
    marginHorizontal: 2,
    fontWeight: 'bold',
  },
  lineupsRowsContainer: {
    width: '100%',
    paddingVertical: 4,
  },
  lineupPlayerColLeft: {
    flex: 3,
    alignItems: 'flex-start',
    justifyContent: 'center',
    minWidth: 80,
  },
  lineupPlayerColRight: {
    flex: 3,
    alignItems: 'flex-end',
    justifyContent: 'center',
    minWidth: 80,
  },
  playerNameLeft: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    marginRight: 4,
    textAlign: 'left',
  },
  playerMetaRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginTop: 0,
    marginBottom: 0,
  },
  playerPositionLeft: {
    fontSize: 12,
    textAlign: 'left',
    flexShrink: 0,
  },
  playerTeamLeft: {
    color: '#a1a1aa',
    fontSize: 12,
    marginLeft: 4,
    textAlign: 'left',
    flexShrink: 1,
  },
  playerNameRight: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    marginRight: 4,
    textAlign: 'right',
  },
  playerMetaRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginTop: 0,
    marginBottom: 0,
    justifyContent: 'flex-end',
  },
  playerTeamRight: {
    color: '#a1a1aa',
    fontSize: 12,
    marginRight: 4,
    textAlign: 'right',
    flexShrink: 1,
  },
  playerPositionRight: {
    fontSize: 12,
    textAlign: 'right',
    flexShrink: 0,
  },
  playerMetaDot: {
    color: '#a1a1aa',
    fontSize: 12,
    marginHorizontal: 1,
  },
}); 