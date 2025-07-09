import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView, Platform, Modal } from 'react-native';
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

export default function MatchupsPage({ currentUser }) {
  const isAdmin = currentUser && currentUser.email === 'chefboyrd53@gmail.com';
  const [selectedYear, setSelectedYear] = useState('2024');
  const [selectedWeek, setSelectedWeek] = useState('week1');
  const [matchups, setMatchups] = useState([]);
  const [filteredMatchups, setFilteredMatchups] = useState([]);
  const [expanded, setExpanded] = useState({});
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(null);
  const [availableWeeks, setAvailableWeeks] = useState([]);
  const [playersCache, setPlayersCache] = useState({});
  const [lineups, setLineups] = useState({});
  const [saving, setSaving] = useState(false);
  const [userTeam, setUserTeam] = useState(null);
  const [userTeamPlayers, setUserTeamPlayers] = useState([]);
  const [userLineup, setUserLineup] = useState({});
  const [showLineupModal, setShowLineupModal] = useState(false);

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

  // Filter matchups based on current user and week
  useEffect(() => {
    if (isAdmin) {
      setFilteredMatchups(matchups);
      return;
    }
    if (!currentUser || !matchups.length) {
      setFilteredMatchups(matchups);
      return;
    }
    const isCurrentWeek = currentDate && selectedWeek === `week${currentDate.week}`;
    if (isCurrentWeek) {
      // For current week, only show the user's matchup
      const userTeam = getUserTeamFromEmail(currentUser.email);
      if (userTeam) {
        const userMatchup = matchups.find(matchup => 
          matchup.homeTeam === userTeam || matchup.awayTeam === userTeam
        );
        setFilteredMatchups(userMatchup ? [userMatchup] : []);
      } else {
        setFilteredMatchups([]);
      }
    } else {
      // For past weeks, show all matchups
      setFilteredMatchups(matchups);
    }
  }, [matchups, currentUser, currentDate, selectedWeek, isAdmin]);

  // Helper function to map user email to team name
  const getUserTeamFromEmail = (email) => {
    const emailPrefix = email.split('@')[0].toLowerCase();
    
    // Map email prefixes to team names
    // You'll need to update this mapping based on your actual user emails
    const emailToTeamMap = {
      'paul': 'Paul',
      'mick': 'Mick', 
      'steve': 'Steve',
      'jason': 'Jason',
      'mike': 'Mike',
      'njemail25': 'Chris',
      'mark': 'Mark',
      'john': 'John',
      // Add more mappings as needed
    };
    
    return emailToTeamMap[emailPrefix] || null;
  };

  // Set user team when currentUser changes
  useEffect(() => {
    if (currentUser && currentUser.email) {
      const team = getUserTeamFromEmail(currentUser.email);
      setUserTeam(team);
    }
  }, [currentUser]);

  // Fetch user's team players when userTeam changes
  useEffect(() => {
    if (userTeam) {
      fetchTeamPlayers(userTeam).then(players => {
        setUserTeamPlayers(players);
      });
    }
  }, [userTeam]);

  // Check if current week and user can manage lineup
  const isCurrentWeek = currentDate && selectedWeek === `week${currentDate.week}`;
  const canManageLineup = isCurrentWeek && userTeam && !isAdmin;

  // Get current user's lineup from matchup data
  const getCurrentUserLineup = () => {
    if (!userTeam || !matchups.length) return {};
    
    const userMatchup = matchups.find(m => 
      m.homeTeam === userTeam || m.awayTeam === userTeam
    );
    
    if (!userMatchup) return {};
    
    const isHomeTeam = userMatchup.homeTeam === userTeam;
    const starterIds = isHomeTeam ? userMatchup.homeStarters : userMatchup.awayStarters;
    
    if (!starterIds || !Array.isArray(starterIds)) return {};
    
    // Convert flat array to slot-based structure
    const lineup = {};
    const usedPlayerIds = new Set();
    
    LINEUP_SLOTS.forEach(slot => {
      lineup[slot.id] = [];
      const slotPlayers = starterIds.filter(id => {
        const player = userTeamPlayers.find(p => p.id === id);
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
          lineup[slot.id].push(playerId);
          usedPlayerIds.add(playerId);
        }
      });
    });
    
    return lineup;
  };

  // Save lineup to Firebase
  const saveLineup = async (lineup) => {
    if (!userTeam || !isCurrentWeek) return;
    
    setSaving(true);
    try {
      // Find the user's matchup
      const userMatchup = matchups.find(m => 
        m.homeTeam === userTeam || m.awayTeam === userTeam
      );
      
      if (userMatchup) {
        const isHomeTeam = userMatchup.homeTeam === userTeam;
        const updateData = isHomeTeam 
          ? { homeStarters: Object.values(lineup).flat().filter(id => id) }
          : { awayStarters: Object.values(lineup).flat().filter(id => id) };
        
        // Update the specific matchup document
        const matchupDoc = doc(db, 'matchups', selectedYear, 'weeks', selectedWeek, 'games', userMatchup.id);
        await updateDoc(matchupDoc, updateData);
        
        // Update local state
        setMatchups(prev => prev.map(m => 
          m.id === userMatchup.id 
            ? { ...m, ...updateData }
            : m
        ));
      }
    } catch (error) {
      console.error('Error saving lineup:', error);
    } finally {
      setSaving(false);
    }
  };

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
          {filteredMatchups.map((matchup) => (
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
          {canManageLineup && (
            <View style={styles.setLineupButtonContainer}>
              <TouchableOpacity
                style={styles.manageLineupButton}
                onPress={() => setShowLineupModal(true)}
              >
                <Text style={[styles.manageLineupButtonText, styles.manageLineupButtonTextActive]}>Set Lineup</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      )}
      
      {/* Lineup Management Modal */}
      {showLineupModal && (
        <LineupModal
          visible={showLineupModal}
          onClose={() => setShowLineupModal(false)}
          players={userTeamPlayers}
          currentLineup={getCurrentUserLineup()}
          onSave={saveLineup}
          saving={saving}
          userTeam={userTeam}
        />
      )}
    </View>
  );
}

function LineupModal({ visible, onClose, players, currentLineup, onSave, saving, userTeam }) {
  const [lineup, setLineup] = useState({});
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [showPlayerPicker, setShowPlayerPicker] = useState(false);

  // Initialize lineup when modal opens
  useEffect(() => {
    if (visible) {
      setLineup(currentLineup || {});
    }
  }, [visible, currentLineup]);

  // Group players by position
  const playersByPosition = players.reduce((acc, player) => {
    const pos = player.position;
    if (!acc[pos]) acc[pos] = [];
    acc[pos].push(player);
    return acc;
  }, {});

  // Get available players for a slot
  const getAvailablePlayers = (slotId) => {
    if (slotId === 'FLEX') {
      return [...(playersByPosition.RB || []), ...(playersByPosition.WR || []), ...(playersByPosition.TE || [])];
    }
    return playersByPosition[slotId] || [];
  };

  // Check if player is already in lineup
  const isPlayerInLineup = (playerId) => {
    return Object.values(lineup).flat().includes(playerId);
  };

  // Set player for slot and index (replace any existing player in that slot position)
  const setPlayerForSlot = (slotId, index, playerId) => {
    setLineup(prev => {
      const newLineup = { ...prev };
      if (!newLineup[slotId]) newLineup[slotId] = Array(index + 1).fill('');
      // Remove player from all slots first
      Object.keys(newLineup).forEach(key => {
        newLineup[key] = newLineup[key].map(id => (id === playerId ? '' : id));
      });
      // Set the player at the correct index
      newLineup[slotId][index] = playerId;
      return newLineup;
    });
  };

  // Get player by ID
  const getPlayerById = (playerId) => {
    return players.find(p => p.id === playerId);
  };

  const handleSave = () => {
    onSave(lineup);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.lineupModalContent}>
          <View style={styles.lineupModalHeader}>
            <Text style={styles.lineupModalTitle}>Set Lineup - {userTeam}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>×</Text>
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.lineupModalBody}>
            {LINEUP_SLOTS.map(slot => (
              <View key={slot.id} style={styles.lineupSlot}>
                <Text style={styles.lineupSlotTitle}>
                  <Text style={{ color: getPositionColor(slot.id) }}>{slot.label}</Text>
                  <Text style={{ color: '#a1a1aa' }}> ({slot.count})</Text>
                </Text>
                <View style={styles.lineupSlotPlayers}>
                  {Array.from({ length: slot.count }, (_, index) => {
                    const playerId = lineup[slot.id]?.[index];
                    const player = playerId ? getPlayerById(playerId) : null;
                    return (
                      <TouchableOpacity
                        key={index}
                        style={[styles.lineupPlayerSlot, player ? styles.lineupPlayerSlotFilled : styles.lineupPlayerSlotEmpty]}
                        onPress={() => {
                          setSelectedSlot({ slotId: slot.id, index });
                          setShowPlayerPicker(true);
                        }}
                      >
                        {player ? (
                          <View style={styles.lineupPlayerInfo}>
                            <Text style={styles.lineupPlayerName}>{player.name}</Text>
                            <Text style={styles.lineupPlayerMeta}>
                              <Text style={{ color: getPositionColor(player.position) }}>{player.position}</Text>
                              {player.team ? <Text>{' • '}{player.team}</Text> : null}
                            </Text>
                          </View>
                        ) : (
                          <Text style={styles.lineupPlayerEmpty}>Tap to add player</Text>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ))}
          </ScrollView>
          
          <View style={styles.lineupModalFooter}>
            <TouchableOpacity
              style={[styles.saveLineupButton, saving && styles.saveLineupButtonDisabled]}
              onPress={handleSave}
              disabled={saving}
            >
              <Text style={styles.saveLineupButtonText}>
                {saving ? 'Saving...' : 'Save Lineup'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
      
      {/* Player Picker Modal */}
      <Modal
        visible={showPlayerPicker}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowPlayerPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.playerPickerContent}>
            <View style={styles.playerPickerHeader}>
              <Text style={styles.playerPickerTitle}>Select Player</Text>
              <TouchableOpacity onPress={() => setShowPlayerPicker(false)} style={styles.closeButton}>
                <Text style={styles.closeButtonText}>×</Text>
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.playerPickerBody}>
              {getAvailablePlayers(selectedSlot?.slotId).map(player => (
                <TouchableOpacity
                  key={player.id}
                  style={[
                    styles.playerPickerItem,
                    isPlayerInLineup(player.id) && styles.playerPickerItemSelected
                  ]}
                  onPress={() => {
                    if (!isPlayerInLineup(player.id) || (lineup[selectedSlot.slotId]?.[selectedSlot.index] === player.id)) {
                      setPlayerForSlot(selectedSlot.slotId, selectedSlot.index, player.id);
                    }
                    setShowPlayerPicker(false);
                  }}
                  disabled={isPlayerInLineup(player.id) && (lineup[selectedSlot?.slotId]?.[selectedSlot?.index] !== player.id)}
                >
                  <View style={styles.playerPickerInfo}>
                    <Text style={styles.playerPickerName}>{player.name}</Text>
                    <Text style={styles.playerPickerMeta}>
                      <Text style={{ color: getPositionColor(player.position) }}>{player.position}</Text>
                      {player.team ? <Text>{' • '}{player.team}</Text> : null}
                    </Text>
                  </View>
                  {isPlayerInLineup(player.id) && (lineup[selectedSlot?.slotId]?.[selectedSlot?.index] !== player.id) && (
                    <Text style={styles.playerPickerSelectedText}>In Lineup</Text>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </Modal>
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
  // Lineup Management Styles
  manageLineupButton: {
    backgroundColor: '#f59e0b',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginLeft: 8,
  },
  manageLineupButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  manageLineupButtonTextActive: {
    color: '#18181b',
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  lineupModalContent: {
    backgroundColor: '#232336',
    borderRadius: 16,
    width: '90%',
    height: '80%',
    borderWidth: 1,
    borderColor: '#6666ff',
  },
  lineupModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#6666ff',
  },
  lineupModalTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 4,
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  lineupModalBody: {
    flex: 1,
    padding: 16,
    paddingBottom: 20,
  },
  lineupSlot: {
    marginBottom: 20,
  },
  lineupSlotTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  lineupSlotPlayers: {
    gap: 8,
  },
  lineupPlayerSlot: {
    borderWidth: 1,
    borderColor: '#6666ff',
    borderRadius: 8,
    padding: 12,
    minHeight: 60,
  },
  lineupPlayerSlotEmpty: {
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  lineupPlayerSlotFilled: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lineupPlayerInfo: {
    flex: 1,
  },
  lineupPlayerName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  lineupPlayerMeta: {
    color: '#a1a1aa',
    fontSize: 14,
    marginTop: 2,
  },
  lineupPlayerEmpty: {
    color: '#a1a1aa',
    fontSize: 16,
    fontStyle: 'italic',
  },
  removePlayerButton: {
    backgroundColor: '#ff6666',
    borderRadius: 16,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removePlayerButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  lineupModalFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#6666ff',
  },
  saveLineupButton: {
    backgroundColor: '#6666ff',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  saveLineupButtonDisabled: {
    backgroundColor: '#4a4a6a',
  },
  saveLineupButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  playerPickerContent: {
    backgroundColor: '#232336',
    borderRadius: 16,
    width: '90%',
    height: '80%',
    borderWidth: 1,
    borderColor: '#6666ff',
  },
  playerPickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#6666ff',
  },
  playerPickerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  playerPickerBody: {
    flex: 1,
    padding: 16,
    paddingBottom: 20,
  },
  playerPickerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#18181b',
  },
  playerPickerItemSelected: {
    backgroundColor: '#18181b',
  },
  playerPickerInfo: {
    flex: 1,
  },
  playerPickerName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  playerPickerMeta: {
    color: '#a1a1aa',
    fontSize: 14,
    marginTop: 2,
  },
  playerPickerSelectedText: {
    color: '#6666ff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  setLineupButtonContainer: {
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
}); 