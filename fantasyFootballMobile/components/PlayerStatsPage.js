import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, TextInput, Modal, StyleSheet, ActivityIndicator, ScrollView, Dimensions, Image, Alert } from 'react-native';
import { VictoryChart, VictoryLine, VictoryAxis, VictoryLabel } from 'victory-native';
import { Line } from 'react-native-svg';
import { ScrollView as RNScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../firebase';
import { doc, getDoc, updateDoc, getDocs, collection } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

const playerStatNameMap = {
  passYards: 'Passing Yards',
  rushYards: 'Rushing Yards',
  recYards: 'Receiving Yards',
  passTds: 'Passing Tds',
  rushTds: 'Rushing Tds',
  recTds: 'Receiving Tds',
  fgm: 'Field Goals',
  epm: 'Extra Points',
  '2pConvs': '2PT Converts',
};

const defenseStatNameMap = {
  touchdowns: 'Touchdowns',
  turnovers: 'Turnovers',
  sacks: 'Sacks',
  returnYards: 'Kickoff & Punt Return Yards',
  pointsAllowed: 'Points Allowed',
  safeties: 'Safeties',
  returned2pts: 'Returned 2 Point Conversions',
};

const POSITION_COLORS = {
  QB: '#ff6666',
  RB: '#00ffcc',
  WR: '#33adff',
  TE: '#66ff33',
  DST: '#bf8040',
  K: '#e066ff',
};

function getPositionColor(pos) {
  return POSITION_COLORS[pos] || '#fff';
}

const YEAR_OPTIONS = ['2024'];
const WEEK_OPTIONS = ['All', ...Array.from({ length: 18 }, (_, i) => (i + 1).toString())];

const TEAM_LOGOS = {
  ARI: require('../assets/teams/ARI.png'),
  ATL: require('../assets/teams/ATL.png'),
  BAL: require('../assets/teams/BAL.png'),
  BUF: require('../assets/teams/BUF.png'),
  CAR: require('../assets/teams/CAR.png'),
  CHI: require('../assets/teams/CHI.png'),
  CIN: require('../assets/teams/CIN.png'),
  CLE: require('../assets/teams/CLE.png'),
  DAL: require('../assets/teams/DAL.png'),
  DEN: require('../assets/teams/DEN.png'),
  DET: require('../assets/teams/DET.png'),
  GB: require('../assets/teams/GB.png'),
  HOU: require('../assets/teams/HOU.png'),
  IND: require('../assets/teams/IND.png'),
  JAX: require('../assets/teams/JAX.png'),
  KC: require('../assets/teams/KC.png'),
  LV: require('../assets/teams/LV.png'),
  LAC: require('../assets/teams/LAC.png'),
  LA: require('../assets/teams/LA.png'),
  MIA: require('../assets/teams/MIA.png'),
  MIN: require('../assets/teams/MIN.png'),
  NE: require('../assets/teams/NE.png'),
  NO: require('../assets/teams/NO.png'),
  NYG: require('../assets/teams/NYG.png'),
  NYJ: require('../assets/teams/NYJ.png'),
  PHI: require('../assets/teams/PHI.png'),
  PIT: require('../assets/teams/PIT.png'),
  SEA: require('../assets/teams/SEA.png'),
  SF: require('../assets/teams/SF.png'),
  TB: require('../assets/teams/TB.png'),
  TEN: require('../assets/teams/TEN.png'),
  WAS: require('../assets/teams/WAS.png'),
};

export default function PlayerStatsPage({ players, ownerMap, currentUser, onDataRefresh, currentDate }) {
  const isAdmin = currentUser && currentUser.email === 'chefboyrd53@gmail.com';
  const [filteredPlayers, setFilteredPlayers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedYear, setSelectedYear] = useState('2024');
  const [selectedWeek, setSelectedWeek] = useState('All');
  const [positionFilter, setPositionFilter] = useState('All');
  const [teamFilter, setTeamFilter] = useState('All');
  const [sortBy, setSortBy] = useState('totalPoints');
  const [teamOptions, setTeamOptions] = useState(['All']);
  const [positionOptions, setPositionOptions] = useState(['All']);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [yearOpen, setYearOpen] = useState(false);
  const [weekOpen, setWeekOpen] = useState(false);
  const [positionOpen, setPositionOpen] = useState(false);
  const [teamOpen, setTeamOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  // State for multi-select filters:
  const [selectedPositions, setSelectedPositions] = useState(['All']);
  const [selectedTeams, setSelectedTeams] = useState(['All']);
  // Owner filter for admin
  const [ownerOptions, setOwnerOptions] = useState(['All']);
  const [selectedOwners, setSelectedOwners] = useState(['All']);

  // Drop/Add functionality state
  const [isDropAddModalOpen, setIsDropAddModalOpen] = useState(false);
  const [playerToDrop, setPlayerToDrop] = useState(null);
  const [freeAgentSearchQuery, setFreeAgentSearchQuery] = useState('');
  const [filteredFreeAgents, setFilteredFreeAgents] = useState([]);
  const [selectedFreeAgent, setSelectedFreeAgent] = useState(null);
  const [isProcessingDropAdd, setIsProcessingDropAdd] = useState(false);
  const [userTeam, setUserTeam] = useState(null);
  const [userWaivers, setUserWaivers] = useState(0);

  // IR functionality state
  const [isIRModalOpen, setIsIRModalOpen] = useState(false);
  const [isIRPlacementModalOpen, setIsIRPlacementModalOpen] = useState(false);
  const [isIRRemovalModalOpen, setIsIRRemovalModalOpen] = useState(false);
  const [playerToIR, setPlayerToIR] = useState(null);
  const [playerToRemoveFromIR, setPlayerToRemoveFromIR] = useState(null);
  const [playerToDropForIR, setPlayerToDropForIR] = useState(null);
  const [isProcessingIR, setIsProcessingIR] = useState(false);
  const [userIRList, setUserIRList] = useState([]);
  const [canPlaceOnIR, setCanPlaceOnIR] = useState(false);

  useEffect(() => {
    if (players.length > 0) {
      // Set filter options
      setTeamOptions(['All', ...[...new Set(players.map(p => p.team))].filter(t => t !== 'All').sort()]);
      setPositionOptions(['All', ...Array.from(new Set(players.map(p => p.position)))]);
      setOwnerOptions(['All', ...Array.from(new Set([...Object.values(ownerMap), 'Free Agent']))]);
    }
  }, [players, ownerMap]);

  useEffect(() => {
    // Calculate points and filter
    const updated = players.map(player => {
      const yearData = player.scoring[selectedYear] || {};
      let relevantWeeks;
      if (selectedWeek === 'All') {
        relevantWeeks = Object.values(yearData);
      } else {
        const weekData = yearData[selectedWeek];
        relevantWeeks = weekData ? [weekData] : [];
      }
      const totalPoints = relevantWeeks.reduce((sum, w) => sum + (w.points || 0), 0);
      const averagePoints = relevantWeeks.length > 0 ? (totalPoints / relevantWeeks.length).toFixed(2) : '0.00';
      return {
        ...player,
        totalPoints,
        averagePoints: parseFloat(averagePoints),
      };
    });
    let filtered = [...updated];
    
    if (!isAdmin) {
      // Filter by current user's team (only show their players)
      if (currentUser && currentUser.email) {
        const userTeam = getUserTeamFromEmail(currentUser.email);
        if (userTeam) {
          // Show players on roster OR on IR
          filtered = filtered.filter(p => 
            ownerMap[p.id] === userTeam || 
            (userIRList && userIRList.includes(p.id))
          );
        } else {
          filtered = [];
        }
      }
    } else {
      // Admin: filter by owner if not All
      if (!(selectedOwners.length === 1 && selectedOwners[0] === 'All')) {
        filtered = filtered.filter(p => selectedOwners.includes(ownerMap[p.id] || 'Free Agent'));
      }
    }
    // Position filter (multi-select)
    if (!(selectedPositions.length === 1 && selectedPositions[0] === 'All')) {
      filtered = filtered.filter(p => selectedPositions.includes(p.position));
    }
    // Team filter (multi-select)
    if (!(selectedTeams.length === 1 && selectedTeams[0] === 'All')) {
      filtered = filtered.filter(p => selectedTeams.includes(p.team));
    }
    if (searchQuery.trim() !== '') {
      const query = searchQuery.trim().toLowerCase();
      filtered = filtered.filter(p => p.name.toLowerCase().includes(query));
    }
    filtered.sort((a, b) => b[sortBy] - a[sortBy]);
    setFilteredPlayers(filtered);
  }, [players, selectedPositions, selectedTeams, sortBy, selectedYear, selectedWeek, ownerMap, searchQuery, currentUser, isAdmin, selectedOwners, userIRList]);

  // Check if IR placement is allowed (weeks 1-11)
  useEffect(() => {
    if (currentDate && currentDate.week >= 1 && currentDate.week <= 11) {
      setCanPlaceOnIR(true);
    } else {
      setCanPlaceOnIR(false);
    }
  }, [currentDate]);

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

  // Fetch user team and waiver information
  useEffect(() => {
    const fetchUserTeamInfo = async () => {
      if (!currentUser || isAdmin) return;
      
      const teamName = getUserTeamFromEmail(currentUser.email);
      if (!teamName) return;
      
      setUserTeam(teamName);
      
      try {
        const teamDoc = await getDoc(doc(db, 'fantasyTeams', teamName));
        if (teamDoc.exists()) {
          const teamData = teamDoc.data();
          const waivers = teamData.waivers || 0;
          const irList = teamData.irList || [];
          setUserWaivers(waivers);
          setUserIRList(irList);
        }
      } catch (error) {
        console.error('Error fetching user team info:', error);
      }
    };
    
    fetchUserTeamInfo();
  }, [currentUser, isAdmin]);

  // Filter free agents when search query changes
  useEffect(() => {
    if (!isDropAddModalOpen && !isIRPlacementModalOpen) return;
    
    const freeAgents = players.filter(player => !ownerMap[player.id]);
    let filtered = [];
    
    if (freeAgentSearchQuery.trim() !== '') {
      const query = freeAgentSearchQuery.trim().toLowerCase();
      filtered = freeAgents.filter(player => 
        player.name.toLowerCase().includes(query) ||
        player.team.toLowerCase().includes(query) ||
        player.position.toLowerCase().includes(query)
      );
      
      // Sort by total points
      filtered.sort((a, b) => {
        const aPoints = a.scoring[selectedYear] ? 
          Object.values(a.scoring[selectedYear]).reduce((sum, week) => sum + (week.points || 0), 0) : 0;
        const bPoints = b.scoring[selectedYear] ? 
          Object.values(b.scoring[selectedYear]).reduce((sum, week) => sum + (week.points || 0), 0) : 0;
        return bPoints - aPoints;
      });
    }
    
    setFilteredFreeAgents(filtered);
  }, [freeAgentSearchQuery, players, ownerMap, isDropAddModalOpen, isIRPlacementModalOpen, selectedYear]);

  // Handle drop player action
  const handleDropPlayer = (player) => {
    if (!userTeam || userWaivers <= 0) {
      Alert.alert('Error', 'You have no waivers remaining or team not found.');
      return;
    }
    
    // Check if team has IR players and is trying to use their last waiver
    if (userIRList.length > 0 && userWaivers <= 1) {
      Alert.alert('Error', 'You must keep at least 1 waiver when you have a player on IR.');
      return;
    }
    
    if (ownerMap[player.id] !== userTeam) {
      Alert.alert('Error', 'You can only drop players from your own team.');
      return;
    }
    
    setPlayerToDrop(player);
    setSelectedFreeAgent(null);
    setFreeAgentSearchQuery('');
    setIsDropAddModalOpen(true);
  };



  // Handle complete drop/add transaction
  const handleCompleteDropAdd = async () => {
    if (!playerToDrop || !selectedFreeAgent || !userTeam) {
      Alert.alert('Error', 'Please select both a player to drop and a free agent to add.');
      return;
    }
    
    if (userWaivers <= 0) {
      Alert.alert('Error', 'You have no waivers remaining.');
      return;
    }
    
    setIsProcessingDropAdd(true);
    
    try {
      // Verify ownership hasn't changed
      const teamDoc = await getDoc(doc(db, 'fantasyTeams', userTeam));
      if (!teamDoc.exists()) {
        throw new Error('Team not found');
      }
      
      const teamData = teamDoc.data();
      const currentRoster = teamData.roster || [];
      const currentWaivers = teamData.waivers || 0;
      
      // Check if player is still on the team
      if (!currentRoster.includes(playerToDrop.id)) {
        Alert.alert('Error', 'Player is no longer on your team. Please refresh and try again.');
        setIsProcessingDropAdd(false);
        
        // Clear cache and refresh data when ownership conflict occurs
        try {
          await AsyncStorage.clear();
          console.log('Cache cleared after ownership conflict');
        } catch (error) {
          console.error('Error clearing cache:', error);
        }
        
        if (onDataRefresh) {
          onDataRefresh();
        }
        return;
      }
      
      // Check if free agent is still available
      const allTeamsSnapshot = await getDocs(collection(db, 'fantasyTeams'));
      let freeAgentStillAvailable = true;
      allTeamsSnapshot.forEach(doc => {
        const roster = doc.data().roster || [];
        if (roster.includes(selectedFreeAgent.id)) {
          freeAgentStillAvailable = false;
        }
      });
      
      if (!freeAgentStillAvailable) {
        Alert.alert('Error', 'Selected free agent is no longer available. Please refresh and try again.');
        setIsProcessingDropAdd(false);
        
        // Clear cache and refresh data when free agent conflict occurs
        try {
          await AsyncStorage.clear();
          console.log('Cache cleared after free agent conflict');
        } catch (error) {
          console.error('Error clearing cache:', error);
        }
        
        if (onDataRefresh) {
          onDataRefresh();
        }
        return;
      }
      
      // Check if we have enough waivers
      if (currentWaivers <= 0) {
        Alert.alert('Error', 'You have no waivers remaining.');
        setIsProcessingDropAdd(false);
        return;
      }
      
      // Check if team has IR players and is trying to use their last waiver
      if (currentIRList.length > 0 && currentWaivers <= 1) {
        Alert.alert('Error', 'You must keep at least 1 waiver when you have a player on IR.');
        setIsProcessingDropAdd(false);
        return;
      }
      
      // Perform the transaction
      const newRoster = currentRoster.filter(id => id !== playerToDrop.id);
      newRoster.push(selectedFreeAgent.id);
      
      await updateDoc(doc(db, 'fantasyTeams', userTeam), {
        roster: newRoster,
        waivers: currentWaivers - 1
      });
      
      // Update local state
      setUserWaivers(currentWaivers - 1);
      
      Alert.alert('Success', `Successfully dropped ${playerToDrop.name} and added ${selectedFreeAgent.name}. Waivers remaining: ${currentWaivers - 1}`);
      
      // Close modal and refresh data
      setIsDropAddModalOpen(false);
      setPlayerToDrop(null);
      setSelectedFreeAgent(null);
      setFreeAgentSearchQuery('');
      setSelectedPlayer(null);
      
      // Clear cache and trigger a refresh of the parent component's data
      try {
        await AsyncStorage.clear();
        console.log('Cache cleared after drop/add transaction');
      } catch (error) {
        console.error('Error clearing cache:', error);
      }
      
      if (onDataRefresh) {
        onDataRefresh();
      }
      
    } catch (error) {
      console.error('Error processing drop/add:', error);
      Alert.alert('Error', 'Failed to process drop/add transaction. Please try again.');
    } finally {
      setIsProcessingDropAdd(false);
    }
  };

  // Handle IR placement with pickup
  const handlePlaceOnIR = (player) => {
    if (!userTeam || !canPlaceOnIR) {
      Alert.alert('Error', 'IR placement is only allowed between weeks 1-11.');
      return;
    }
    
    if (userIRList.length >= 1) {
      Alert.alert('Error', 'You can only have one player on IR at a time.');
      return;
    }
    
    if (ownerMap[player.id] !== userTeam) {
      Alert.alert('Error', 'You can only place your own players on IR.');
      return;
    }
    
    setPlayerToIR(player);
    setSelectedFreeAgent(null);
    setFreeAgentSearchQuery('');
    setIsIRPlacementModalOpen(true);
  };

  // Handle IR removal
  const handleRemoveFromIR = (player) => {
    if (!userTeam || userWaivers <= 1) {
      Alert.alert('Error', 'You must have at least 2 waivers to remove a player from IR (1 for the transaction, 1 reserved for future IR removal).');
      return;
    }
    
    if (!userIRList.includes(player.id)) {
      Alert.alert('Error', 'This player is not on your IR list.');
      return;
    }
    
    setPlayerToRemoveFromIR(player);
    setPlayerToDropForIR(null);
    setIsIRRemovalModalOpen(true);
  };

  // Complete IR placement transaction
  const handleCompleteIRPlacement = async () => {
    if (!playerToIR || !selectedFreeAgent || !userTeam) {
      Alert.alert('Error', 'Please select both a player to place on IR and a free agent to add.');
      return;
    }
    
    if (userWaivers <= 0) {
      Alert.alert('Error', 'You have no waivers remaining.');
      return;
    }
    
    setIsProcessingIR(true);
    
    try {
      // Verify ownership hasn't changed
      const teamDoc = await getDoc(doc(db, 'fantasyTeams', userTeam));
      if (!teamDoc.exists()) {
        throw new Error('Team not found');
      }
      
      const teamData = teamDoc.data();
      const currentRoster = teamData.roster || [];
      const currentIRList = teamData.irList || [];
      const currentWaivers = teamData.waivers || 0;
      
      // Check if player is still on the team
      if (!currentRoster.includes(playerToIR.id)) {
        Alert.alert('Error', 'Player is no longer on your team. Please refresh and try again.');
        setIsProcessingIR(false);
        
        // Clear cache and refresh data
        try {
          await AsyncStorage.clear();
          console.log('Cache cleared after IR ownership conflict');
        } catch (error) {
          console.error('Error clearing cache:', error);
        }
        
        if (onDataRefresh) {
          onDataRefresh();
        }
        return;
      }
      
      // Check if free agent is still available
      const allTeamsSnapshot = await getDocs(collection(db, 'fantasyTeams'));
      let freeAgentStillAvailable = true;
      allTeamsSnapshot.forEach(doc => {
        const roster = doc.data().roster || [];
        if (roster.includes(selectedFreeAgent.id)) {
          freeAgentStillAvailable = false;
        }
      });
      
      if (!freeAgentStillAvailable) {
        Alert.alert('Error', 'Selected free agent is no longer available. Please refresh and try again.');
        setIsProcessingIR(false);
        
        // Clear cache and refresh data
        try {
          await AsyncStorage.clear();
          console.log('Cache cleared after free agent conflict');
        } catch (error) {
          console.error('Error clearing cache:', error);
        }
        
        if (onDataRefresh) {
          onDataRefresh();
        }
        return;
      }
      
      // Check if we have enough waivers
      if (currentWaivers <= 0) {
        Alert.alert('Error', 'You have no waivers remaining.');
        setIsProcessingIR(false);
        return;
      }
      
      // Perform the transaction
      const newRoster = currentRoster.filter(id => id !== playerToIR.id);
      newRoster.push(selectedFreeAgent.id);
      const newIRList = [...currentIRList, playerToIR.id];
      
      await updateDoc(doc(db, 'fantasyTeams', userTeam), {
        roster: newRoster,
        irList: newIRList,
        waivers: currentWaivers - 1
      });
      
      // Update local state
      setUserWaivers(currentWaivers - 1);
      setUserIRList(newIRList);
      
      Alert.alert('Success', `Successfully placed ${playerToIR.name} on IR and added ${selectedFreeAgent.name}. Waivers remaining: ${currentWaivers - 1}`);
      
      // Close modal and refresh data
      setIsIRPlacementModalOpen(false);
      setPlayerToIR(null);
      setSelectedFreeAgent(null);
      setFreeAgentSearchQuery('');
      setSelectedPlayer(null);
      
      // Clear cache and trigger a refresh
      try {
        await AsyncStorage.clear();
        console.log('Cache cleared after IR placement');
      } catch (error) {
        console.error('Error clearing cache:', error);
      }
      
      if (onDataRefresh) {
        onDataRefresh();
      }
      
    } catch (error) {
      console.error('Error processing IR placement:', error);
      Alert.alert('Error', 'Failed to process IR placement. Please try again.');
    } finally {
      setIsProcessingIR(false);
    }
  };

  // Complete IR removal transaction
  const handleCompleteIRRemoval = async () => {
    if (!playerToRemoveFromIR || !playerToDropForIR || !userTeam) {
      Alert.alert('Error', 'Please select a player to remove from IR and a player to drop.');
      return;
    }
    
    if (userWaivers <= 1) {
      Alert.alert('Error', 'You must have at least 2 waivers to remove a player from IR.');
      return;
    }
    
    setIsProcessingIR(true);
    
    try {
      // Verify ownership hasn't changed
      const teamDoc = await getDoc(doc(db, 'fantasyTeams', userTeam));
      if (!teamDoc.exists()) {
        throw new Error('Team not found');
      }
      
      const teamData = teamDoc.data();
      const currentRoster = teamData.roster || [];
      const currentIRList = teamData.irList || [];
      const currentWaivers = teamData.waivers || 0;
      
      // Check if player is still on IR
      if (!currentIRList.includes(playerToRemoveFromIR.id)) {
        Alert.alert('Error', 'Player is no longer on IR. Please refresh and try again.');
        setIsProcessingIR(false);
        
        // Clear cache and refresh data
        try {
          await AsyncStorage.clear();
          console.log('Cache cleared after IR removal conflict');
        } catch (error) {
          console.error('Error clearing cache:', error);
        }
        
        if (onDataRefresh) {
          onDataRefresh();
        }
        return;
      }
      
      // Check if player to drop is still on the team
      if (!currentRoster.includes(playerToDropForIR.id)) {
        Alert.alert('Error', 'Player to drop is no longer on your team. Please refresh and try again.');
        setIsProcessingIR(false);
        
        // Clear cache and refresh data
        try {
          await AsyncStorage.clear();
          console.log('Cache cleared after drop player conflict');
        } catch (error) {
          console.error('Error clearing cache:', error);
        }
        
        if (onDataRefresh) {
          onDataRefresh();
        }
        return;
      }
      
      // Check if we have enough waivers
      if (currentWaivers <= 1) {
        Alert.alert('Error', 'You must have at least 2 waivers to remove a player from IR.');
        setIsProcessingIR(false);
        return;
      }
      
      // Perform the transaction
      const newRoster = currentRoster.filter(id => id !== playerToDropForIR.id);
      newRoster.push(playerToRemoveFromIR.id);
      const newIRList = currentIRList.filter(id => id !== playerToRemoveFromIR.id);
      
      await updateDoc(doc(db, 'fantasyTeams', userTeam), {
        roster: newRoster,
        irList: newIRList,
        waivers: currentWaivers - 1
      });
      
      // Update local state
      setUserWaivers(currentWaivers - 1);
      setUserIRList(newIRList);
      
      Alert.alert('Success', `Successfully removed ${playerToRemoveFromIR.name} from IR and dropped ${playerToDropForIR.name}. Waivers remaining: ${currentWaivers - 1}`);
      
      // Close modal and refresh data
      setIsIRRemovalModalOpen(false);
      setPlayerToRemoveFromIR(null);
      setPlayerToDropForIR(null);
      setSelectedPlayer(null);
      
      // Clear cache and trigger a refresh
      try {
        await AsyncStorage.clear();
        console.log('Cache cleared after IR removal');
      } catch (error) {
        console.error('Error clearing cache:', error);
      }
      
      if (onDataRefresh) {
        onDataRefresh();
      }
      
    } catch (error) {
      console.error('Error processing IR removal:', error);
      Alert.alert('Error', 'Failed to process IR removal. Please try again.');
    } finally {
      setIsProcessingIR(false);
    }
  };

  const renderPlayer = ({ item, index }) => {
    const isOnIR = userIRList && userIRList.includes(item.id);
    // For IR players, we need to find their actual owner from the team data
    let owner = ownerMap[item.id] || 'Free Agent';
    if (isOnIR && !ownerMap[item.id]) {
      // If player is on IR but not in ownerMap, they should still be owned by their team
      // We'll need to find which team has them on IR
      if (userTeam && userIRList.includes(item.id)) {
        owner = userTeam;
      }
    }
    
    return (
      <TouchableOpacity style={[styles.row, index % 2 === 0 ? styles.rowEven : styles.rowOdd]} onPress={() => setSelectedPlayer(item)}>
        <Text style={styles.rank}>{index + 1}.</Text>
        <View style={{ flex: 1, alignItems: 'flex-start' }}>
          <Text style={[styles.name, isOnIR && styles.irPlayerName]}>{item.name || ''}</Text>
          <Text style={styles.meta}>
            <Text style={{ color: getPositionColor(item.position)}}>{item.position || ''}</Text>
            <Text> · {item.team || ''} · {owner}</Text>
            {isOnIR && <Text style={styles.irBadge}> · IR</Text>}
          </Text>
        </View>
        <View style={styles.pointsCol}>
          <Text style={styles.points}>{item.totalPoints || 0}</Text>
          {selectedWeek === 'All' && (
            <Text style={styles.avgPoints}>{item.averagePoints || 0}</Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  // Chart width
  const chartWidth = Dimensions.get('window').width;

  return (
    <>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.filterButton} onPress={() => setIsFilterModalOpen(true)}>
          <Ionicons name="filter" size={24} color="#6666ff" />
        </TouchableOpacity>
        <View style={{ flex: 1, position: 'relative' }}>
          <TextInput
            style={styles.input}
            placeholder="Search by player name..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#a1a1aa"
            keyboardAppearance="dark"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              style={styles.clearSearchIcon}
              onPress={() => setSearchQuery('')}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close-circle" size={20} color="#6666ff" />
            </TouchableOpacity>
          )}
        </View>
      </View>
      <Modal
        visible={isFilterModalOpen}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setIsFilterModalOpen(false)}
      >
        <View style={{ flex: 1 }}>
          {/* Overlay: appears instantly, does not animate */}
          {isFilterModalOpen && (
            <TouchableOpacity
              style={styles.instantOverlay}
              activeOpacity={1}
              onPress={() => setIsFilterModalOpen(false)}
            />
          )}
          {/* Panel: slides up from the bottom */}
          <View style={styles.filterModalContent}>
            <TouchableOpacity style={styles.closeIconFilters} onPress={() => setIsFilterModalOpen(false)}>
              <Text style={styles.closeIconText}>×</Text>
            </TouchableOpacity>
            <Text style={styles.filterModalTitle}>Filters</Text>
            <View style={styles.filtersDivider} />
            <View style={styles.filterModalScroll}>
              <View style={styles.filterModalItem}>
                <Text style={styles.filterLabel}>Year</Text>
                <RNScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.weekScroll} contentContainerStyle={{ paddingVertical: 4 }}>
                  {YEAR_OPTIONS.map(y => (
                    <TouchableOpacity
                      key={y}
                      style={[styles.toggleButton, selectedYear === y ? styles.toggleButtonActive : null, { minWidth: 48, alignItems: 'center' }]}
                      onPress={() => setSelectedYear(y)}
                    >
                      <Text style={[styles.toggleButtonText, selectedYear === y ? styles.toggleButtonTextActive : null]}>{y}</Text>
                    </TouchableOpacity>
                  ))}
                </RNScrollView>
              </View>
              <View style={styles.filterModalItem}>
                <Text style={styles.filterLabel}>Week</Text>
                <RNScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.weekScroll} contentContainerStyle={{ paddingVertical: 4 }}>
                  {WEEK_OPTIONS.map(w => (
                    <TouchableOpacity
                      key={w}
                      style={[styles.toggleButton, selectedWeek === w ? styles.toggleButtonActive : null, { minWidth: 48, alignItems: 'center' }]}
                      onPress={() => setSelectedWeek(w)}
                    >
                      <Text style={[styles.toggleButtonText, selectedWeek === w ? styles.toggleButtonTextActive : null]}>{w === 'All' ? 'All Weeks' : 'W' + w}</Text>
                    </TouchableOpacity>
                  ))}
                </RNScrollView>
              </View>
              <View style={styles.filterModalItem}>
                <Text style={styles.filterLabel}>Position</Text>
                <RNScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.weekScroll} contentContainerStyle={{ paddingVertical: 4 }}>
                  {positionOptions.map(pos => (
                    <TouchableOpacity
                      key={pos}
                      style={[styles.toggleButton, selectedPositions.includes(pos) ? styles.toggleButtonActive : null, { minWidth: 48, alignItems: 'center' }]}
                      onPress={() => {
                        if (pos === 'All') {
                          setSelectedPositions(['All']);
                        } else {
                          setSelectedPositions(prev => prev.includes(pos)
                            ? prev.filter(p => p !== pos && p !== 'All')
                            : [...prev.filter(p => p !== 'All'), pos]);
                        }
                      }}
                    >
                      <Text style={[styles.toggleButtonText, selectedPositions.includes(pos) ? styles.toggleButtonTextActive : null]}>{pos}</Text>
                    </TouchableOpacity>
                  ))}
                </RNScrollView>
              </View>
              <View style={styles.filterModalItem}>
                <Text style={styles.filterLabel}>Team</Text>
                <RNScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.weekScroll} contentContainerStyle={{ paddingVertical: 4 }}>
                  {teamOptions.map(team => (
                    <TouchableOpacity
                      key={team}
                      style={[
                        styles.teamLogoChip,
                        selectedTeams.includes(team) ? styles.teamLogoChipActive : null,
                        { minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' }
                      ]}
                      onPress={() => {
                        if (team === 'All') {
                          setSelectedTeams(['All']);
                        } else {
                          setSelectedTeams(prev => prev.includes(team)
                            ? prev.filter(t => t !== team && t !== 'All')
                            : [...prev.filter(t => t !== 'All'), team]);
                        }
                      }}
                    >
                      {team === 'All' ? (
                        <Text style={[styles.toggleButtonText, selectedTeams.includes(team) ? styles.toggleButtonTextActive : null]}>All</Text>
                      ) : (
                        <Image
                          source={TEAM_LOGOS[team]}
                          style={styles.teamLogoImg}
                          resizeMode="contain"
                        />
                      )}
                    </TouchableOpacity>
                  ))}
                </RNScrollView>
              </View>

              {selectedWeek === 'All' && (
                <View style={styles.filterModalItem}>
                  <Text style={styles.filterLabel}>Sort By</Text>
                  <View style={styles.sortToggleRow}>
                    <TouchableOpacity
                      style={[styles.sortToggleButton, sortBy === 'totalPoints' ? styles.sortToggleButtonActive : null]}
                      onPress={() => setSortBy('totalPoints')}
                    >
                      <Text style={[styles.sortToggleButtonText, sortBy === 'totalPoints' ? styles.sortToggleButtonTextActive : null]}>Total Points</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.sortToggleButton, sortBy === 'averagePoints' ? styles.sortToggleButtonActive : null]}
                      onPress={() => setSortBy('averagePoints')}
                    >
                      <Text style={[styles.sortToggleButtonText, sortBy === 'averagePoints' ? styles.sortToggleButtonTextActive : null]}>Average Points</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
              {isAdmin && (
                <View style={styles.filterModalItem}>
                  <Text style={styles.filterLabel}>Owner</Text>
                  <RNScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.weekScroll} contentContainerStyle={{ paddingVertical: 4 }}>
                    {ownerOptions.map(owner => (
                      <TouchableOpacity
                        key={owner}
                        style={[styles.toggleButton, selectedOwners.includes(owner) ? styles.toggleButtonActive : null, { minWidth: 48, alignItems: 'center' }]}
                        onPress={() => {
                          if (owner === 'All') {
                            setSelectedOwners(['All']);
                          } else {
                            setSelectedOwners(prev => prev.includes(owner)
                              ? prev.filter(o => o !== owner && o !== 'All')
                              : [...prev.filter(o => o !== 'All'), owner]);
                          }
                        }}
                      >
                        <Text style={[styles.toggleButtonText, selectedOwners.includes(owner) ? styles.toggleButtonTextActive : null]}>{owner}</Text>
                      </TouchableOpacity>
                    ))}
                  </RNScrollView>
                </View>
              )}
            </View>
          </View>
        </View>
      </Modal>
      {!players || players.length === 0 ? (
        <ActivityIndicator size="large" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={filteredPlayers}
          keyExtractor={item => item.id}
          renderItem={renderPlayer}
          contentContainerStyle={{ paddingBottom: 40 }}
        />
      )}
      <Modal
        visible={!!selectedPlayer}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setSelectedPlayer(null)}
      >
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.modalContent} style={{flex: 1, width: '100%'}}>
            <TouchableOpacity style={styles.closeIconStats} onPress={() => setSelectedPlayer(null)}>
              <Text style={styles.closeIconText}>×</Text>
            </TouchableOpacity>
            {selectedPlayer && (
              <>
                <Text style={[styles.modalTitle, userIRList && userIRList.includes(selectedPlayer.id) && styles.irPlayerName]}>{selectedPlayer.name || ''}</Text>
                <Text style={[styles.meta, styles.modalMeta]}>
                  <Text style={{ color: getPositionColor(selectedPlayer.position)}}>{selectedPlayer.position || ''}</Text>
                  <Text> · {selectedPlayer.team || ''} · {ownerMap[selectedPlayer.id] || 'Free Agent'}</Text>
                  {userIRList && userIRList.includes(selectedPlayer.id) && <Text style={styles.irBadge}> · IR</Text>}
                </Text>
                
                <View style={styles.statsDivider} />
                
                {/* Drop/Add Overlay - appears on top of existing modal */}
                {isDropAddModalOpen && (
                  <View style={styles.dropAddOverlay}>
                    <View style={styles.dropAddModalContent}>
                      <TouchableOpacity style={styles.closeIconFilters} onPress={() => setIsDropAddModalOpen(false)}>
                        <Text style={styles.closeIconText}>×</Text>
                      </TouchableOpacity>
                      
                      <Text style={styles.dropAddModalTitle}>Drop & Add Player</Text>
                      <View style={styles.filtersDivider} />
                      
                      {/* Player to Drop Section */}
                      <View style={styles.dropAddSection}>
                        <Text style={styles.dropAddSectionTitle}>Dropping:</Text>
                        {playerToDrop && (
                          <View style={styles.selectedPlayerCard}>
                            <Text style={styles.selectedPlayerName}>{playerToDrop.name}</Text>
                            <Text style={styles.selectedPlayerMeta}>
                              <Text style={{ color: getPositionColor(playerToDrop.position)}}>{playerToDrop.position}</Text>
                              <Text> · {playerToDrop.team}</Text>
                            </Text>
                          </View>
                        )}
                      </View>
                      
                      <View style={styles.filtersDivider} />
                      
                      {/* Free Agent Search Section */}
                      <View style={styles.dropAddSection}>
                        <Text style={styles.dropAddSectionTitle}>Add Free Agent:</Text>
                        <TextInput
                          style={styles.freeAgentSearchInput}
                          placeholder="Search free agents..."
                          value={freeAgentSearchQuery}
                          onChangeText={setFreeAgentSearchQuery}
                          placeholderTextColor="#a1a1aa"
                          keyboardAppearance="dark"
                        />
                        
                        <ScrollView style={styles.freeAgentList} showsVerticalScrollIndicator={false}>
                          {filteredFreeAgents.length === 0 ? (
                            <Text style={{ color: '#a1a1aa', fontStyle: 'italic', textAlign: 'center', marginTop: 20 }}>
                              Search for free agents to add
                            </Text>
                          ) : (
                            filteredFreeAgents.slice(0, 20).map((player, index) => (
                              <TouchableOpacity
                                key={player.id}
                                style={[
                                  styles.freeAgentItem,
                                  selectedFreeAgent?.id === player.id && styles.freeAgentItemSelected
                                ]}
                                onPress={() => setSelectedFreeAgent(player)}
                              >
                                <View style={styles.freeAgentItemContent}>
                                  <Text style={styles.freeAgentName}>{player.name}</Text>
                                  <Text style={styles.freeAgentMeta}>
                                    <Text style={{ color: getPositionColor(player.position)}}>{player.position}</Text>
                                    <Text> · {player.team}</Text>
                                  </Text>
                                </View>
                              </TouchableOpacity>
                            ))
                          )}
                        </ScrollView>
                      </View>
                      
                      <View style={styles.filtersDivider} />
                      
                      {/* Complete Transaction Button */}
                      <TouchableOpacity
                        style={[
                          styles.completeTransactionButton,
                          (!selectedFreeAgent || isProcessingDropAdd) && styles.completeTransactionButtonDisabled
                        ]}
                        onPress={handleCompleteDropAdd}
                        disabled={!selectedFreeAgent || isProcessingDropAdd}
                      >
                        {isProcessingDropAdd ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                                                  <Text style={styles.completeTransactionButtonText}>
                          Complete Transaction (Costs 1 Waiver)
                        </Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {/* IR Placement Overlay - appears on top of existing modal */}
                {isIRPlacementModalOpen && (
                  <View style={styles.dropAddOverlay}>
                    <View style={styles.irModalContent}>
                      <TouchableOpacity style={styles.closeIconFilters} onPress={() => setIsIRPlacementModalOpen(false)}>
                        <Text style={styles.closeIconText}>×</Text>
                      </TouchableOpacity>
                      
                      <Text style={styles.irModalTitle}>Place Player on IR & Add Free Agent</Text>
                      <View style={styles.filtersDivider} />
                      
                      {/* Player to Place on IR Section */}
                      <View style={styles.dropAddSection}>
                        <Text style={styles.dropAddSectionTitle}>Placing on IR:</Text>
                        {playerToIR && (
                          <View style={styles.selectedPlayerCard}>
                            <Text style={styles.selectedPlayerName}>{playerToIR.name}</Text>
                            <Text style={styles.selectedPlayerMeta}>
                              <Text style={{ color: getPositionColor(playerToIR.position)}}>{playerToIR.position}</Text>
                              <Text> · {playerToIR.team}</Text>
                            </Text>
                          </View>
                        )}
                      </View>
                      
                      <View style={styles.filtersDivider} />
                      
                      {/* Free Agent Search Section */}
                      <View style={styles.dropAddSection}>
                        <Text style={styles.dropAddSectionTitle}>Add Free Agent:</Text>
                        <TextInput
                          style={styles.freeAgentSearchInput}
                          placeholder="Search free agents..."
                          value={freeAgentSearchQuery}
                          onChangeText={setFreeAgentSearchQuery}
                          placeholderTextColor="#a1a1aa"
                          keyboardAppearance="dark"
                        />
                        
                        <ScrollView style={styles.freeAgentList} showsVerticalScrollIndicator={false}>
                          {filteredFreeAgents.length === 0 ? (
                            <Text style={{ color: '#a1a1aa', fontStyle: 'italic', textAlign: 'center', marginTop: 20 }}>
                              Search for free agents to add
                            </Text>
                          ) : (
                            filteredFreeAgents.slice(0, 20).map((player, index) => (
                              <TouchableOpacity
                                key={player.id}
                                style={[
                                  styles.freeAgentItem,
                                  selectedFreeAgent?.id === player.id && styles.freeAgentItemSelected
                                ]}
                                onPress={() => setSelectedFreeAgent(player)}
                              >
                                <View style={styles.freeAgentItemContent}>
                                  <Text style={styles.freeAgentName}>{player.name}</Text>
                                  <Text style={styles.freeAgentMeta}>
                                    <Text style={{ color: getPositionColor(player.position)}}>{player.position}</Text>
                                    <Text> · {player.team}</Text>
                                  </Text>
                                </View>
                              </TouchableOpacity>
                            ))
                          )}
                        </ScrollView>
                      </View>
                      
                      <View style={styles.filtersDivider} />
                      
                      {/* Complete Transaction Button */}
                      <TouchableOpacity
                        style={[
                          styles.completeTransactionButton,
                          (!selectedFreeAgent || isProcessingIR) && styles.completeTransactionButtonDisabled
                        ]}
                        onPress={handleCompleteIRPlacement}
                        disabled={!selectedFreeAgent || isProcessingIR}
                      >
                        {isProcessingIR ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <Text style={styles.completeTransactionButtonText}>
                            Place on IR & Add Player (Costs 1 Waiver)
                          </Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {/* IR Removal Overlay - appears on top of existing modal */}
                {isIRRemovalModalOpen && (
                  <View style={styles.dropAddOverlay}>
                    <View style={styles.irModalContent}>
                      <TouchableOpacity style={styles.closeIconFilters} onPress={() => setIsIRRemovalModalOpen(false)}>
                        <Text style={styles.closeIconText}>×</Text>
                      </TouchableOpacity>
                      
                      <Text style={styles.irModalTitle}>Remove Player from IR</Text>
                      <View style={styles.filtersDivider} />
                      
                      {/* Player to Remove from IR Section */}
                      <View style={styles.dropAddSection}>
                        <Text style={styles.dropAddSectionTitle}>Removing from IR:</Text>
                        {playerToRemoveFromIR && (
                          <View style={styles.selectedPlayerCard}>
                            <Text style={styles.selectedPlayerName}>{playerToRemoveFromIR.name}</Text>
                            <Text style={styles.selectedPlayerMeta}>
                              <Text style={{ color: getPositionColor(playerToRemoveFromIR.position)}}>{playerToRemoveFromIR.position}</Text>
                              <Text> · {playerToRemoveFromIR.team}</Text>
                            </Text>
                          </View>
                        )}
                      </View>
                      
                      <View style={styles.filtersDivider} />
                      
                      {/* Player to Drop Section */}
                      <View style={styles.dropAddSection}>
                        <Text style={styles.dropAddSectionTitle}>Drop Player:</Text>
                        <ScrollView style={styles.dropPlayerList} showsVerticalScrollIndicator={false}>
                          {(() => {
                            const userRoster = players.filter(p => ownerMap[p.id] === userTeam && !userIRList.includes(p.id));
                            return userRoster.map((player, index) => (
                              <TouchableOpacity
                                key={player.id}
                                style={[
                                  styles.dropPlayerItem,
                                  playerToDropForIR?.id === player.id && styles.dropPlayerItemSelected
                                ]}
                                onPress={() => setPlayerToDropForIR(player)}
                              >
                                <View style={styles.dropPlayerItemContent}>
                                  <Text style={styles.dropPlayerName}>{player.name}</Text>
                                  <Text style={styles.dropPlayerMeta}>
                                    <Text style={{ color: getPositionColor(player.position)}}>{player.position}</Text>
                                    <Text> · {player.team}</Text>
                                  </Text>
                                </View>
                              </TouchableOpacity>
                            ));
                          })()}
                        </ScrollView>
                      </View>
                      
                      <View style={styles.filtersDivider} />
                      
                      <TouchableOpacity
                        style={[
                          styles.completeTransactionButton,
                          (!playerToDropForIR || isProcessingIR) && styles.completeTransactionButtonDisabled
                        ]}
                        onPress={handleCompleteIRRemoval}
                        disabled={!playerToDropForIR || isProcessingIR}
                      >
                        {isProcessingIR ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <Text style={styles.completeTransactionButtonText}>
                            Remove from IR (Costs 1 Waiver)
                          </Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
                
                <Text style={styles.sectionTitle}>
                  Stats ({selectedWeek === 'All' ? 'Total' : 'Week ' + selectedWeek})
                </Text>
                <View style={styles.statGrid}>
                  {(() => {
                    const isDefense = selectedPlayer.position === 'DST';
                    const statNameMap = isDefense ? defenseStatNameMap : playerStatNameMap;
                    const stats = selectedPlayer?.scoring[selectedYear] || {};
                    let relevantWeeks;
                    if (selectedWeek === 'All') {
                      relevantWeeks = Object.values(stats);
                    } else {
                      const weekData = stats[selectedWeek];
                      relevantWeeks = weekData ? [weekData] : [];
                    }
                    const combinedStats = relevantWeeks.reduce((acc, week) => {
                      Object.entries(week).forEach(([key, value]) => {
                        acc[key] = (acc[key] || 0) + value;
                      });
                      return acc;
                    }, {});
                    const statOrder = isDefense
                      ? Object.keys(defenseStatNameMap)
                      : Object.keys(playerStatNameMap);
                    return statOrder.map((statKey) => {
                      if (combinedStats[statKey] == null) return null;
                      return (
                        <View key={statKey} style={styles.statCell}>
                          <Text style={styles.statLabel}>{statNameMap[statKey]}</Text>
                          <Text style={styles.statValue}>{combinedStats[statKey]}</Text>
                        </View>
                      );
                    });
                  })()}
                </View>
                <Text style={styles.sectionTitle}>Weekly Points</Text>
                <View style={{ alignItems: 'center', width: '100%' }}>
                  {(() => {
                    const stats = selectedPlayer?.scoring[selectedYear] || {};
                    const data = Array.from({ length: 18 }, (_, i) => {
                      const weekNum = (i + 1).toString();
                      const weekData = stats[weekNum];
                      if (!weekData) return null;
                      return {
                        x: i + 1,
                        y: weekData.points ?? 0,
                      };
                    }).filter(Boolean);
                    if (data.length === 0) {
                      return <Text style={{ color: '#a1a1aa', fontStyle: 'italic', marginBottom: 12 }}>No weekly data</Text>;
                    }
                    // Calculate average
                    const avg = data.reduce((sum, d) => sum + d.y, 0) / data.length;
                    const weekTicks = data.map(d => d.x);
                    const everyOtherWeekTicks = weekTicks.filter((_, i) => i % 2 === 0);
                    const minWeek = Math.min(...weekTicks);
                    const maxWeek = Math.max(...weekTicks);
                    return (
                      <>
                        <VictoryChart
                          width={chartWidth}
                          height={220}
                          domain={{ x: [minWeek, maxWeek] }}
                          domainPadding={{ x: 0, y: 20 }}
                          padding={{ left: 48, right: 24, top: 24, bottom: 40 }}
                        >
                          <VictoryAxis
                            tickValues={everyOtherWeekTicks}
                            tickFormat={t => 'W' + t}
                            style={{
                              axis: { stroke: '#a1a1aa' },
                              tickLabels: { fill: '#fff', fontSize: 12 },
                              grid: { stroke: '#333', strokeDasharray: '4,4' },
                            }}
                            gridComponent={<Line />}
                          />
                          <VictoryAxis
                            dependentAxis
                            style={{
                              axis: { stroke: '#a1a1aa' },
                              tickLabels: { fill: '#fff', fontSize: 12 },
                              grid: { stroke: '#333', strokeDasharray: '4,4' },
                            }}
                            gridComponent={<Line />}
                          />
                          <VictoryLine
                            data={data}
                            style={{ data: { stroke: '#6666ff', strokeWidth: 3 } }}
                            interpolation="monotoneX"
                          />
                          {/* Average line */}
                          <VictoryLine
                            data={data.map(d => ({ x: d.x, y: avg }))}
                            style={{ data: { stroke: '#f59e0b', strokeDasharray: '6,6', strokeWidth: 2 } }}
                          />
                        </VictoryChart>
                      </>
                    );
                  })()}
                </View>
                
                {/* Action buttons for non-admin users */}
                {!isAdmin && userTeam && (ownerMap[selectedPlayer.id] === userTeam || (userIRList && userIRList.includes(selectedPlayer.id))) && (
                  <View style={styles.actionButtonsContainer}>
                    {/* Drop button - only show for roster players */}
                    {ownerMap[selectedPlayer.id] === userTeam && (
                      <TouchableOpacity 
                        style={[styles.dropButton, (userWaivers <= 0 || (userIRList.length > 0 && userWaivers <= 1)) && styles.dropButtonDisabled]} 
                        onPress={() => handleDropPlayer(selectedPlayer)}
                        disabled={userWaivers <= 0 || (userIRList.length > 0 && userWaivers <= 1)}
                      >
                        <Text style={[styles.dropButtonText, (userWaivers <= 0 || (userIRList.length > 0 && userWaivers <= 1)) && styles.dropButtonTextDisabled]}>
                          Drop Player
                        </Text>
                      </TouchableOpacity>
                    )}
                    
                    {/* IR Placement button - only show for roster players */}
                    {ownerMap[selectedPlayer.id] === userTeam && canPlaceOnIR && userIRList.length === 0 && (
                      <TouchableOpacity 
                        style={[styles.irButton, userWaivers <= 0 && styles.irButtonDisabled]} 
                        onPress={() => handlePlaceOnIR(selectedPlayer)}
                        disabled={userWaivers <= 0}
                      >
                        <Text style={[styles.irButtonText, userWaivers <= 0 && styles.irButtonTextDisabled]}>
                          Place on IR
                        </Text>
                      </TouchableOpacity>
                    )}
                    
                    {/* IR Removal button - only show for IR players */}
                    {userIRList && userIRList.includes(selectedPlayer.id) && (
                      <TouchableOpacity 
                        style={[styles.irButton, userWaivers <= 1 && styles.irButtonDisabled]} 
                        onPress={() => handleRemoveFromIR(selectedPlayer)}
                        disabled={userWaivers <= 1}
                      >
                        <Text style={[styles.irButtonText, userWaivers <= 1 && styles.irButtonTextDisabled]}>
                          Remove from IR
                        </Text>
                      </TouchableOpacity>
                    )}
                    
                    <Text style={styles.waiversText}>
                      {userWaivers} waiver{userWaivers !== 1 ? 's' : ''} remaining
                    </Text>
                  </View>
                )}
              </>
            )}
          </ScrollView>
        </View>
      </Modal>

    </>
  );
}

const styles = StyleSheet.create({
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
  // Drop/Add functionality styles
  actionButtonsContainer: {
    paddingHorizontal: 20,
    marginTop: 16,
    marginBottom: 20,
    alignItems: 'center',
    alignSelf: 'center',
    width: '100%',
  },
  dropButtonContainer: {
    paddingHorizontal: 20,
    marginTop: 16,
    marginBottom: 20,
    alignItems: 'center',
    alignSelf: 'center',
    width: '100%',
  },
  dropButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ff6666',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    justifyContent: 'center',
  },
  dropButtonDisabled: {
    backgroundColor: '#333',
  },
  dropButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
    marginLeft: 6,
  },
  dropButtonTextDisabled: {
    color: '#666',
  },
  irButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f59e0b',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    justifyContent: 'center',
    marginTop: 8,
  },
  irButtonDisabled: {
    backgroundColor: '#333',
  },
  irButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
    marginLeft: 6,
  },
  irButtonTextDisabled: {
    color: '#666',
  },
  irPlayerName: {
    fontStyle: 'italic',
    color: '#f59e0b',
  },
  irBadge: {
    color: '#f59e0b',
    fontWeight: 'bold',
    fontStyle: 'italic',
  },
  waiversText: {
    color: '#a1a1aa',
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
  },
  dropAddOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.8)',
    zIndex: 9999,
    justifyContent: 'flex-end',
  },
  dropAddModalContent: {
    backgroundColor: '#232336',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 30,
    paddingHorizontal: 20,
    paddingBottom: 60,
    minHeight: 600,
    width: '100%',
    alignItems: 'flex-start',
    position: 'relative',
    zIndex: 10000,
  },
  dropAddModalTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 5,
    textAlign: 'left',
    alignSelf: 'flex-start',
  },
  dropAddSection: {
    width: '100%',
    marginBottom: 16,
  },
  dropAddSectionTitle: {
    color: '#f59e0b',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  selectedPlayerCard: {
    backgroundColor: '#18181b',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#ff6666',
  },
  selectedPlayerName: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  selectedPlayerMeta: {
    color: '#a1a1aa',
    fontSize: 14,
  },
  freeAgentSearchInput: {
    backgroundColor: '#18181b',
    borderColor: '#6666ff',
    borderWidth: 1,
    borderRadius: 8,
    color: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    marginBottom: 12,
  },
  freeAgentList: {
    maxHeight: 300,
    width: '100%',
  },
  freeAgentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#18181b',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#333',
  },
  freeAgentItemSelected: {
    borderColor: '#6666ff',
    backgroundColor: '#2a2a3a',
  },
  freeAgentItemContent: {
    flex: 1,
  },
  freeAgentName: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: 2,
  },
  freeAgentMeta: {
    color: '#a1a1aa',
    fontSize: 14,
  },
  freeAgentPoints: {
    backgroundColor: '#6666ff',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 40,
    alignItems: 'center',
  },
  freeAgentPointsText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  completeTransactionButton: {
    backgroundColor: '#6666ff',
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginTop: 16,
  },
  completeTransactionButtonDisabled: {
    backgroundColor: '#333',
  },
  completeTransactionButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  
  // IR Modal styles
  irModalContent: {
    backgroundColor: '#232336',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 30,
    paddingHorizontal: 20,
    paddingBottom: 60,
    minHeight: 500,
    width: '100%',
    alignItems: 'flex-start',
    position: 'relative',
    zIndex: 10000,
  },
  irModalTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 5,
    textAlign: 'left',
    alignSelf: 'flex-start',
  },
  irSection: {
    width: '100%',
    marginBottom: 16,
  },
  irSectionTitle: {
    color: '#f59e0b',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  irInfoText: {
    color: '#a1a1aa',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  dropPlayerList: {
    maxHeight: 200,
    width: '100%',
  },
  dropPlayerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#18181b',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#333',
  },
  dropPlayerItemSelected: {
    borderColor: '#6666ff',
    backgroundColor: '#2a2a3a',
  },
  dropPlayerItemContent: {
    flex: 1,
  },
  dropPlayerName: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: 2,
  },
  dropPlayerMeta: {
    color: '#a1a1aa',
    fontSize: 14,
  },
}); 