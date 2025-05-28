import { useState, useEffect } from 'react';
import { collection, doc, getDoc, getDocs, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { getCache, setCache, clearCache } from '../utils/cache';
import Select from 'react-select';
import { ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import React from 'react';

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
  QB: 'position-QB',
  RB: 'position-RB',
  WR: 'position-WR',
  TE: 'position-TE',
  FLEX: 'position-FLEX',
  DST: 'position-DST',
  K: 'position-K'
};

const Matchups = () => {
  const [selectedYear, setSelectedYear] = useState('2024');
  const [selectedWeek, setSelectedWeek] = useState('week1');
  const [matchups, setMatchups] = useState([]);
  const [expandedMatchups, setExpandedMatchups] = useState(new Set());
  const [matchupLineups, setMatchupLineups] = useState({});
  const [matchupPlayers, setMatchupPlayers] = useState({});
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(null);
  const [availableWeeks, setAvailableWeeks] = useState([]);

  // Custom styles for react-select
  const expandedSelectStyles = {
    control: (base, state) => ({
      ...base,
      backgroundColor: 'var(--color-bg-primary)',
      borderColor: 'transparent',
      boxShadow: state.isFocused ? '0 0 0 2px var(--color-primary)' : 'none',
      '&:hover': {
        borderColor: 'var(--color-border)'
      },
      minHeight: '3.5rem',
      '@media (min-width: 640px)': {
        minHeight: '2.5rem'
      }
    }),
    menu: (base) => ({
      ...base,
      backgroundColor: 'var(--color-bg-primary)',
      zIndex: 9999,
      position: 'absolute',
      width: '100%'
    }),
    menuList: (base) => ({
      ...base,
      maxHeight: '300px'
    }),
    option: (base, state) => ({
      ...base,
      backgroundColor: state.isFocused ? 'var(--color-bg-tertiary)' : 'var(--color-bg-primary)',
      color: 'white',
      '&:hover': {
        backgroundColor: 'var(--color-bg-tertiary)'
      },
      whiteSpace: 'normal',
      wordBreak: 'break-word',
      fontSize: '0.875rem',
      '@media (min-width: 640px)': {
        fontSize: '1rem'
      }
    }),
    singleValue: (base) => ({
      ...base,
      color: 'white',
      whiteSpace: 'normal',
      wordBreak: 'break-word',
      fontSize: '0.875rem',
      '@media (min-width: 640px)': {
        fontSize: '1rem'
      }
    }),
    input: (base) => ({
      ...base,
      color: 'white',
      fontSize: '0.875rem',
      '@media (min-width: 640px)': {
        fontSize: '1rem'
      }
    }),
    indicatorsContainer: () => ({
      display: 'none'
    })
  };

  const awaySelectStyles = {
    ...expandedSelectStyles,
    control: (base, state) => ({
      ...expandedSelectStyles.control(base, state),
      flexDirection: 'row-reverse'
    }),
    valueContainer: (base) => ({
      ...base,
      flexDirection: 'row-reverse'
    }),
    placeholder: (base) => ({
      ...base,
      textAlign: 'right',
      fontSize: '0.875rem',
      '@media (min-width: 640px)': {
        fontSize: '1rem'
      }
    }),
  };

  const topSelectStyles = {
    control: (base, state) => ({
      ...base,
      backgroundColor: 'var(--color-bg-secondary)',
      borderColor: 'transparent',
      boxShadow: state.isFocused ? '0 0 0 2px var(--color-primary)' : 'none',
      '&:hover': {
        borderColor: 'var(--color-border)'
      },
      minHeight: '2.5rem'
    }),
    menu: (base) => ({
      ...base,
      backgroundColor: 'var(--color-bg-secondary)',
      zIndex: 9999
    }),
    option: (base, state) => ({
      ...base,
      backgroundColor: state.isFocused ? 'var(--color-bg-tertiary)' : 'var(--color-bg-secondary)',
      color: 'white',
      '&:hover': {
        backgroundColor: 'var(--color-bg-tertiary)'
      },
      whiteSpace: 'normal',
      wordBreak: 'break-word',
      fontSize: '0.875rem',
      '@media (min-width: 640px)': {
        fontSize: '1rem'
      }
    }),
    singleValue: (base) => ({
      ...base,
      color: 'white',
      whiteSpace: 'normal',
      wordBreak: 'break-word',
      fontSize: '0.875rem',
      '@media (min-width: 640px)': {
        fontSize: '1rem'
      }
    }),
    input: (base) => ({
      ...base,
      color: 'white',
      fontSize: '0.875rem',
      '@media (min-width: 640px)': {
        fontSize: '1rem'
      }
    })
  };

  // Format option for react-select
  const formatOptionLabel = ({ label, team, position, playerPosition, isAway }) => (
    <div className="flex flex-col w-full">
      <div className={`font-medium break-words text-sm sm:text-base ${isAway ? 'text-right' : ''}`}>{label}</div>
      <div className={`flex items-center text-xs text-muted ${isAway ? 'justify-end' : ''}`}>
        {!isAway && position && (
          <span className={POSITION_COLORS[position === 'FLEX' && playerPosition ? playerPosition : position]}>
            {position === 'FLEX' && playerPosition ? playerPosition : position}
          </span>
        )}
        {!isAway && position && team && (
          <span className="mx-1">·</span>
        )}
        {!isAway && team && (
          <span>({team})</span>
        )}
        {isAway && team && (
          <span>({team})</span>
        )}
        {isAway && team && position && (
          <span className="mx-1">·</span>
        )}
        {isAway && position && (
          <span className={POSITION_COLORS[position === 'FLEX' && playerPosition ? playerPosition : position]}>
            {position === 'FLEX' && playerPosition ? playerPosition : position}
          </span>
        )}
      </div>
    </div>
  );

  // Fetch current date
  const fetchCurrentDate = async () => {
    try {
      const whenDoc = await getDoc(doc(db, 'currentDate', 'when'));
      if (whenDoc.exists()) {
        const data = whenDoc.data();
        setCurrentDate({
          year: data.year,
          week: data.week
        });
      }
    } catch (error) {
      console.error('Error fetching current date:', error);
    }
  };

  // Fetch available weeks based on current date
  const fetchAvailableWeeks = async () => {
    if (!currentDate) return;
    
    const weeks = [];
    for (let i = 1; i <= currentDate.week; i++) {
      weeks.push(`week${i}`);
    }
    setAvailableWeeks(weeks);
    
    // Set initial selected week to current week
    setSelectedWeek(`week${currentDate.week}`);
    setSelectedYear(currentDate.year.toString());
  };

  // Check if selected week is current week
  const isCurrentWeek = () => {
    if (!currentDate) return false;
    return selectedYear === currentDate.year.toString() && 
           parseInt(selectedWeek.replace('week', '')) === currentDate.week;
  };

  // Fetch players for a team
  const fetchTeamPlayers = async (teamName) => {
    try {
      const cacheKey = `players_${teamName}_${selectedYear}_${selectedWeek}`;
      const cachedPlayers = getCache(cacheKey);
      if (cachedPlayers) {
        return cachedPlayers;
      }
  
      const teamsSnapshot = await getDocs(collection(db, 'fantasyTeams'));
      const teamDoc = teamsSnapshot.docs.find(doc => doc.id === teamName);
      
      if (!teamDoc) {
        console.warn(`No fantasy team found with ID: ${teamName}`);
        return [];
      }
  
      const roster = teamDoc.data().roster || [];
      const validRoster = roster.filter(id => id);
  
      const playerPromises = validRoster.map(async (id) => {
        if (id.length <= 3) {
          const defenseDoc = await getDoc(doc(db, 'defense', id));
          if (defenseDoc.exists()) {
            return {
              id,
              name: id,
              position: 'DST',
              team: null,
              scoring: { ...defenseDoc.data() }
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
              scoring: p.scoring
            };
          }
        }
        return null;
      });
  
      const players = (await Promise.all(playerPromises)).filter(Boolean);
      setCache(cacheKey, players);
      return players;
    } catch (error) {
      console.error('Error fetching team players:', error);
      return [];
    }
  };

  const fetchPlayersByIds = async (playerIds) => {
    try {
      const cacheKey = `players_${playerIds.join('_')}_${selectedYear}_${selectedWeek}`;
      const cachedPlayers = getCache(cacheKey);
      if (cachedPlayers) return cachedPlayers;
  
      const playerPromises = playerIds.map(async (id) => {
        if (id.length <= 3) {
          const defenseDoc = await getDoc(doc(db, 'defense', id));
          if (defenseDoc.exists()) {
            return {
              id,
              name: id,
              position: 'DST',
              team: null,
              scoring: { ...defenseDoc.data() }
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
              scoring: p.scoring
            };
          }
        }
        return null;
      });
  
      const players = (await Promise.all(playerPromises)).filter(Boolean);
      setCache(cacheKey, players);
      return players;
    } catch (error) {
      console.error('Error fetching players by ID:', error);
      return [];
    }
  };
  
  // Preload all player data for the week
  const preloadPlayerData = async (matchups) => {
    const allPlayers = {};
    const allLineups = {};

    for (const matchup of matchups) {
      let homePlayers = [];
      let awayPlayers = [];
      let homeLineup = {};
      let awayLineup = {};

      if (isCurrentWeek()) {
        homePlayers = await fetchTeamPlayers(matchup.homeTeam);
        awayPlayers = await fetchTeamPlayers(matchup.awayTeam);
      } else {
        homePlayers = await fetchPlayersByIds(matchup.homeStarters || []);
        awayPlayers = await fetchPlayersByIds(matchup.awayStarters || []);
      }

      // Initialize lineups
      if (matchup.homeStarters) {
        const homeLineupObj = {};
        const usedPlayerIds = new Set();
        LINEUP_SLOTS.forEach(slot => {
          homeLineupObj[slot.id] = Array(slot.count).fill('');
          const slotPlayers = matchup.homeStarters.filter(id => {
            const player = homePlayers.find(p => p.id === id);
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
              homeLineupObj[slot.id][index] = playerId;
              usedPlayerIds.add(playerId);
            }
          });
        });
        homeLineup = homeLineupObj;
      } else {
        homeLineup = LINEUP_SLOTS.reduce((acc, slot) => {
          acc[slot.id] = Array(slot.count).fill('');
          return acc;
        }, {});
      }

      if (matchup.awayStarters) {
        const awayLineupObj = {};
        const usedPlayerIds = new Set();
        LINEUP_SLOTS.forEach(slot => {
          awayLineupObj[slot.id] = Array(slot.count).fill('');
          const slotPlayers = matchup.awayStarters.filter(id => {
            const player = awayPlayers.find(p => p.id === id);
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
              awayLineupObj[slot.id][index] = playerId;
              usedPlayerIds.add(playerId);
            }
          });
        });
        awayLineup = awayLineupObj;
      } else {
        awayLineup = LINEUP_SLOTS.reduce((acc, slot) => {
          acc[slot.id] = Array(slot.count).fill('');
          return acc;
        }, {});
      }

      allPlayers[matchup.id] = {
        home: homePlayers,
        away: awayPlayers
      };
      allLineups[matchup.id] = {
        home: homeLineup,
        away: awayLineup
      };
    }

    setMatchupPlayers(allPlayers);
    setMatchupLineups(allLineups);
  };

  // Fetch matchups for selected year and week
  const fetchMatchups = async () => {
    setLoading(true);
    try {
      const cacheKey = `matchups_${selectedYear}_${selectedWeek}`;
      const cachedData = getCache(cacheKey);
      
      let gamesData;
      if (cachedData) {
        gamesData = cachedData;
      } else {
        const gamesSnapshot = await getDocs(collection(db, 'matchups', selectedYear, 'weeks', selectedWeek, 'games'));
        gamesData = gamesSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setCache(cacheKey, gamesData);
      }
      
      setMatchups(gamesData);
      await preloadPlayerData(gamesData);
    } catch (error) {
      console.error('Error fetching matchups:', error);
    }
    setLoading(false);
  };

  // Handle matchup expansion
  const handleExpandMatchup = (matchupId) => {
    setExpandedMatchups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(matchupId)) {
        newSet.delete(matchupId);
      } else {
        newSet.add(matchupId);
      }
      return newSet;
    });
  };

  // Calculate total score for lineup
  const calculateTotalScore = (matchupId) => {
    const players = matchupPlayers[matchupId];
    const lineups = matchupLineups[matchupId];
    if (!players || !lineups) return { home: 0, away: 0 };

    const calculateTeamScore = (players, lineup) => {
      return Object.values(lineup)
        .flat()
        .reduce((total, playerId) => {
          const player = players.find(p => p.id === playerId);
          if (!player) return total;
          const weekNum = parseInt(selectedWeek.replace('week', ''));
          const playerScore = player.scoring?.[selectedYear]?.[weekNum]?.points || 0;
          return total + playerScore;
        }, 0);
    };

    return {
      home: calculateTeamScore(players.home, lineups.home),
      away: calculateTeamScore(players.away, lineups.away)
    };
  };

  // Handle lineup changes
  const handleLineupChange = (matchupId, team, slot, value, index) => {
    setMatchupLineups(prev => {
      const newLineups = { ...prev };
      const teamLineup = { ...newLineups[matchupId][team] };
      if (!teamLineup[slot]) {
        teamLineup[slot] = Array(LINEUP_SLOTS.find(s => s.id === slot).count).fill('');
      }
      teamLineup[slot] = [...teamLineup[slot]];
      teamLineup[slot][index] = value;
      newLineups[matchupId] = {
        ...newLineups[matchupId],
        [team]: teamLineup
      };
      return newLineups;
    });
  };

  // Submit starters to Firestore
  const handleSubmitStarters = async (matchupId) => {
    try {
      const gameRef = doc(db, 'matchups', selectedYear, 'weeks', selectedWeek, 'games', matchupId);
      const lineups = matchupLineups[matchupId];
      const homeStarters = Object.values(lineups.home).flat();
      const awayStarters = Object.values(lineups.away).flat();
      
      await updateDoc(gameRef, {
        homeStarters,
        awayStarters
      });

      // Clear cache for current week
      const cacheKeys = [
        `matchups_${selectedYear}_${selectedWeek}`,
        `players_${matchups.find(m => m.id === matchupId)?.homeTeam}_${selectedYear}_${selectedWeek}`,
        `players_${matchups.find(m => m.id === matchupId)?.awayTeam}_${selectedYear}_${selectedWeek}`
      ];
      
      cacheKeys.forEach(key => clearCache(key));
      
      // Refetch matchups
      const gamesSnapshot = await getDocs(collection(db, 'matchups', selectedYear, 'weeks', selectedWeek, 'games'));
      const gamesData = gamesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      setMatchups(gamesData);
      setCache(`matchups_${selectedYear}_${selectedWeek}`, gamesData);
      
      // If there's an expanded matchup, refresh its data too
      if (expandedMatchups.has(matchupId)) {
        const newMatchups = gamesData.filter(matchup => expandedMatchups.has(matchup.id));
        await preloadPlayerData(newMatchups);
      }

      // Add a small delay and refresh the page
      setTimeout(() => {
        window.location.reload();
      }, 500);
    } catch (error) {
      console.error('Error saving starters:', error);
      alert('Error saving starters');
    }
  };

  // Get available players for a slot
  const getAvailablePlayers = (players, slot, currentLineup, selectedPlayerId) => {
    const selectedPlayerIds = Object.values(currentLineup)
      .flat()
      .filter(id => id !== '' && id !== selectedPlayerId);
  
    return players
      .filter(player => {
        if (slot === 'FLEX' && !['RB', 'WR', 'TE'].includes(player.position)) return false;
        if (slot !== 'FLEX' && player.position !== slot) return false;
        return !selectedPlayerIds.includes(player.id);
      })
      .map(player => ({
        value: player.id,
        label: player.name,
        team: player.team,
        position: player.position
      }));
  };
  

  // Get player score
  const getPlayerScore = (playerId, players) => {
    const player = players.find(p => p.id === playerId);
    if (!player) return 0;
    const weekNum = parseInt(selectedWeek.replace('week', ''));
    return player.scoring?.[selectedYear]?.[weekNum]?.points || 0;
  };

  // Add refreshCache function
  const refreshCache = async () => {
    setLoading(true);
    try {
      // Clear cache for current week
      const cacheKeys = [
        `matchups_${selectedYear}_${selectedWeek}`,
        ...matchups.map(matchup => [
          `players_${matchup.homeTeam}_${selectedYear}_${selectedWeek}`,
          `players_${matchup.awayTeam}_${selectedYear}_${selectedWeek}`
        ]).flat()
      ];
      
      cacheKeys.forEach(key => clearCache(key));
      
      // Refetch matchups
      const gamesSnapshot = await getDocs(collection(db, 'matchups', selectedYear, 'weeks', selectedWeek, 'games'));
      const gamesData = gamesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      setMatchups(gamesData);
      setCache(`matchups_${selectedYear}_${selectedWeek}`, gamesData);
      
      // If there's an expanded matchup, refresh its data too
      if (expandedMatchups.size > 0) {
        const newMatchups = gamesData.filter(matchup => expandedMatchups.has(matchup.id));
        await preloadPlayerData(newMatchups);
      }

      // Add a small delay and refresh the page
      setTimeout(() => {
        window.location.reload();
      }, 500);
    } catch (error) {
      console.error('Error refreshing cache:', error);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchCurrentDate();
  }, []);

  useEffect(() => {
    if (currentDate) {
      fetchAvailableWeeks();
    }
  }, [currentDate]);

  useEffect(() => {
    fetchMatchups();
    // Reset expanded matchup when week changes
    setExpandedMatchups(new Set());
  }, [selectedYear, selectedWeek]);

  const yearOptions = [
    { value: '2024', label: '2024' },
  ];

  const weekOptions = availableWeeks.map(week => ({
    value: week,
    label: `Week ${week.replace('week', '')}`
  }));

  return (
    <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-8 max-w-full overflow-x-hidden">
      <div className="mb-4 sm:mb-8">
        
        {/* Year and Week Selection */}
        <div className="flex flex-row items-center gap-2 sm:gap-4 mb-4 sm:mb-6">
          
          <Select
            value={yearOptions.find(opt => opt.value === selectedYear)}
            onChange={(selected) => setSelectedYear(selected.value)}
            options={yearOptions}
            styles={{
              ...topSelectStyles,
              control: (base, state) => ({
                ...topSelectStyles.control(base, state),
                minWidth: '80px'
              })
            }}
            placeholder="Select year"
            components={{ IndicatorSeparator: () => null }}
            isSearchable={false}
          />

          <Select
            value={weekOptions.find(opt => opt.value === selectedWeek)}
            onChange={(selected) => setSelectedWeek(selected.value)}
            options={weekOptions}
            styles={{
              ...topSelectStyles,
              control: (base, state) => ({
                ...topSelectStyles.control(base, state),
                minWidth: '80px'
              })
            }}
            placeholder="Select week"
            components={{ IndicatorSeparator: () => null }}
            isSearchable={false}
          />

          <button
            onClick={refreshCache}
            className="bg-primary p-2 rounded-lg hover:text-white hover:bg-[var(--color-primary)] focus:outline-none transition-all duration-200 flex items-center justify-center"
            title="Refresh Data"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>

        {/* Matchups List */}
        {loading ? (
          <div>Loading...</div>
        ) : (
          <div className="space-y-4">
            {matchups.map((matchup) => {
              const scores = calculateTotalScore(matchup.id);
              return (
                <div key={matchup.id} className="bg-secondary px-2 sm:px-4 py-2 rounded-lg">
                  {/* Collapsed Headers */}
                  <div className="grid grid-cols-12 items-center gap-1 sm:gap-2 w-full">
                    <div className="col-span-2 flex justify-end"></div>
                    <div className="col-span-3 text-left text-base sm:text-xl truncate">{matchup.homeTeam}</div>

                    <div className="col-span-2 flex justify-center items-center gap-1 sm:gap-2 text-lg sm:text-2xl font-bold">
                      <div className="min-w-[2.5rem] w-[2.5rem] sm:min-w-[3rem] sm:w-[3rem] md:min-w-[4rem] md:w-[4rem] flex justify-end">
                        <span className="tabular-nums inline-block w-full text-right">{scores.home}</span>
                      </div>
                      <div className="h-8 sm:h-10 border-r border-primary mx-1 sm:mx-2 flex-shrink-0"></div>
                      <div className="min-w-[2.5rem] w-[2.5rem] sm:min-w-[3rem] sm:w-[3rem] md:min-w-[4rem] md:w-[4rem] flex justify-start">
                        <span className="tabular-nums inline-block w-full text-left">{scores.away}</span>
                      </div>
                    </div>

                    <div className="col-span-3 text-right text-base sm:text-xl truncate">{matchup.awayTeam}</div>

                    <div className="col-span-2 flex justify-end">
                      <button
                        onClick={() => handleExpandMatchup(matchup.id)}
                        className="p-1 sm:p-2 hover:bg-primary/20 rounded-full transition"
                        aria-label={expandedMatchups.has(matchup.id) ? 'Collapse' : 'Expand'}
                      >
                        {expandedMatchups.has(matchup.id) ? (
                          <ChevronUp className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                        ) : (
                          <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Expanded View */}
                  {expandedMatchups.has(matchup.id) && (
                    <div className="mt-0 relative">
                      <div className="w-full overflow-visible">
                        <table className="w-full table-fixed">
                          <thead>
                            <tr>
                              <th className="w-1/2 border-r border-primary"></th>
                              <th className="w-1/2"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {LINEUP_SLOTS.map(slot => (
                              <React.Fragment key={slot.id}>
                                {Array.from({ length: slot.count }).map((_, index) => (
                                  <tr key={index} className="h-12">
                                    <td className="pr-2 sm:pr-4 border-r border-primary">
                                      <div className="flex justify-between items-center">
                                        <div className="flex-1 min-w-0 max-w-[calc(100%-60px)]">
                                          {isCurrentWeek() ? (
                                            <Select
                                              value={matchupLineups[matchup.id]?.home[slot.id]?.[index] ? {
                                                value: matchupLineups[matchup.id].home[slot.id][index],
                                                label: matchupPlayers[matchup.id]?.home.find(p => p.id === matchupLineups[matchup.id].home[slot.id][index])?.name || '',
                                                team: matchupPlayers[matchup.id]?.home.find(p => p.id === matchupLineups[matchup.id].home[slot.id][index])?.team,
                                                position: slot.label,
                                                playerPosition: matchupPlayers[matchup.id]?.home.find(p => p.id === matchupLineups[matchup.id].home[slot.id][index])?.position
                                              } : null}
                                              onChange={(option) => handleLineupChange(matchup.id, 'home', slot.id, option?.value || '', index)}
                                              options={[
                                                { value: '', label: `Empty ${slot.label}`, position: slot.label },
                                                ...getAvailablePlayers(
                                                  matchupPlayers[matchup.id]?.home || [],
                                                  slot.id,
                                                  matchupLineups[matchup.id]?.home || {},
                                                  matchupLineups[matchup.id]?.home[slot.id]?.[index]
                                                ).map(player => ({
                                                  ...player,
                                                  position: slot.label,
                                                  playerPosition: player.position
                                                }))
                                              ]}
                                              styles={{
                                                ...expandedSelectStyles,
                                                control: (base, state) => ({
                                                  ...expandedSelectStyles.control(base, state),
                                                  minWidth: '120px'
                                                })
                                              }}
                                              formatOptionLabel={formatOptionLabel}
                                              isClearable={false}
                                              placeholder={`Empty ${slot.label}`}
                                              className="w-full"
                                              components={{ IndicatorSeparator: () => null }}
                                              isSearchable={false}
                                            />
                                          ) : (
                                            <div className="w-full bg-primary text-white px-2 sm:px-3 py-1 sm:py-1.5 rounded min-h-[3.5rem] sm:min-h-[2.5rem] flex items-center">
                                              {matchupLineups[matchup.id]?.home[slot.id]?.[index] ? (
                                                (() => {
                                                  const player = matchupPlayers[matchup.id]?.home.find(p => p.id === matchupLineups[matchup.id].home[slot.id][index]);
                                                  return player ? (
                                                    <div className="flex flex-col gap-0.5">
                                                      <div className="font-medium leading-tight break-words text-sm sm:text-base">{player.name}</div>
                                                      <div className="flex items-center text-xs text-gray-400 leading-tight">
                                                        <span className={POSITION_COLORS[slot.label === 'FLEX' ? player.position : slot.label]}>
                                                          {slot.label === 'FLEX' ? player.position : slot.label}
                                                        </span>
                                                        {player.team && (
                                                          <span className="mx-1">·</span>
                                                        )}
                                                        {player.team && (
                                                          <span>({player.team})</span>
                                                        )}
                                                      </div>
                                                    </div>
                                                  ) : `Empty ${slot.label}`;
                                                })()
                                              ) : `Empty ${slot.label}`}
                                            </div>
                                          )}
                                        </div>
                                        <div className="ml-2 sm:ml-4 bg-primary text-white px-2 sm:px-3 py-1.5 sm:py-2 rounded min-w-[50px] sm:min-w-[60px] text-center flex-shrink-0">
                                          {matchupLineups[matchup.id]?.home[slot.id]?.[index] ? 
                                            getPlayerScore(matchupLineups[matchup.id].home[slot.id][index], matchupPlayers[matchup.id]?.home || []) : 
                                            0}
                                        </div>
                                      </div>
                                    </td>
                                    <td className="pl-2 sm:pl-4">
                                      <div className="flex justify-between items-center">
                                        <div className="bg-primary text-white px-2 sm:px-3 py-1.5 sm:py-2 rounded min-w-[50px] sm:min-w-[60px] text-center flex-shrink-0">
                                          {matchupLineups[matchup.id]?.away[slot.id]?.[index] ? 
                                            getPlayerScore(matchupLineups[matchup.id].away[slot.id][index], matchupPlayers[matchup.id]?.away || []) : 
                                            0}
                                        </div>
                                        <div className="flex-1 ml-2 sm:ml-4 min-w-0 max-w-[calc(100%-60px)]">
                                          {isCurrentWeek() ? (
                                            <Select
                                              value={matchupLineups[matchup.id]?.away[slot.id]?.[index] ? {
                                                value: matchupLineups[matchup.id].away[slot.id][index],
                                                label: matchupPlayers[matchup.id]?.away.find(p => p.id === matchupLineups[matchup.id].away[slot.id][index])?.name || '',
                                                team: matchupPlayers[matchup.id]?.away.find(p => p.id === matchupLineups[matchup.id].away[slot.id][index])?.team,
                                                position: slot.label,
                                                playerPosition: matchupPlayers[matchup.id]?.away.find(p => p.id === matchupLineups[matchup.id].away[slot.id][index])?.position,
                                                isAway: true
                                              } : null}
                                              onChange={(option) => handleLineupChange(matchup.id, 'away', slot.id, option?.value || '', index)}
                                              options={[
                                                { value: '', label: `Empty ${slot.label}`, position: slot.label, isAway: true },
                                                ...getAvailablePlayers(
                                                  matchupPlayers[matchup.id]?.away || [],
                                                  slot.id,
                                                  matchupLineups[matchup.id]?.away || {},
                                                  matchupLineups[matchup.id]?.away[slot.id]?.[index]
                                                ).map(player => ({
                                                  ...player,
                                                  position: slot.label,
                                                  playerPosition: player.position,
                                                  isAway: true
                                                }))
                                              ]}
                                              styles={{
                                                ...awaySelectStyles,
                                                control: (base, state) => ({
                                                  ...awaySelectStyles.control(base, state),
                                                  minWidth: '120px'
                                                })
                                              }}
                                              formatOptionLabel={formatOptionLabel}
                                              isClearable={false}
                                              placeholder={`Empty ${slot.label}`}
                                              className="w-full"
                                              components={{ IndicatorSeparator: () => null }}
                                              isSearchable={false}
                                            />
                                          ) : (
                                            <div className="w-full bg-primary text-white px-2 sm:px-3 py-1 sm:py-1.5 rounded min-h-[3.5rem] sm:min-h-[2.5rem] flex items-center">
                                              {matchupLineups[matchup.id]?.away[slot.id]?.[index] ? (
                                                (() => {
                                                  const player = matchupPlayers[matchup.id]?.away.find(p => p.id === matchupLineups[matchup.id].away[slot.id][index]);
                                                  return player ? (
                                                    <div className="flex flex-col gap-0.5 w-full">
                                                      <div className="font-medium leading-tight text-right break-words text-sm sm:text-base">{player.name}</div>
                                                      <div className="flex items-center text-xs text-gray-400 leading-tight justify-end">
                                                        {player.team && (
                                                          <span>({player.team})</span>
                                                        )}
                                                        {player.team && (
                                                          <span className="mx-1">·</span>
                                                        )}
                                                        <span className={POSITION_COLORS[slot.label === 'FLEX' ? player.position : slot.label]}>
                                                          {slot.label === 'FLEX' ? player.position : slot.label}
                                                        </span>
                                                      </div>
                                                    </div>
                                                  ) : <div className="text-right w-full">Empty {slot.label}</div>;
                                                })()
                                              ) : <div className="text-right w-full">Empty {slot.label}</div>}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </React.Fragment>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {isCurrentWeek() && (
                        <button
                          onClick={() => handleSubmitStarters(matchup.id)}
                          className="mt-4 mb-2 bg-primary px-4 py-2 rounded-lg border border-primary hover:bg-[var(--color-bg-tertiary)] transition-colors w-full sm:w-auto"
                        >
                          Save Starters
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default Matchups; 