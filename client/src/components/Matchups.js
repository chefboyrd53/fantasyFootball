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

const customStyles = {
  control: (base, state) => ({
    ...base,
    backgroundColor: 'var(--color-bg-primary)',
    borderColor: 'transparent',
    boxShadow: state.isFocused ? '0 0 0 2px var(--color-primary)' : 'none',
    '&:hover': {
      borderColor: 'var(--color-border)'
    },
    minHeight: '2.5rem'
  }),
  menu: (base) => ({
    ...base,
    backgroundColor: 'var(--color-bg-primary)',
    zIndex: 9999,
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
    wordBreak: 'break-word'
  }),
  singleValue: (base) => ({
    ...base,
    color: 'white',
    whiteSpace: 'normal',
    wordBreak: 'break-word'
  }),
  input: (base) => ({
    ...base,
    color: 'white'
  }),
  indicatorsContainer: () => ({
    display: 'none'
  })
};

const topSelectStyles = {
  ...customStyles,
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
  indicatorsContainer: (base) => ({
    ...base,
    display: 'flex'
  })
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
          <span>{team}</span>
        )}
        {isAway && team && (
          <span>{team}</span>
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
    <div className="min-h-screen bg-primary text-primary">
      <div className="p-4 sm:p-6">
        {/* Top Controls */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-4 mb-4 sm:mb-6">
          <Select
            value={yearOptions.find(opt => opt.value === selectedYear)}
            onChange={(selected) => setSelectedYear(selected.value)}
            options={yearOptions}
            styles={topSelectStyles}
            placeholder="Select year"
            components={{ IndicatorSeparator: () => null }}
            isSearchable={false}
            menuPortalTarget={document.body}
          />

          <Select
            value={weekOptions.find(opt => opt.value === selectedWeek)}
            onChange={(selected) => setSelectedWeek(selected.value)}
            options={weekOptions}
            styles={topSelectStyles}
            placeholder="Select week"
            components={{ IndicatorSeparator: () => null }}
            isSearchable={false}
            menuPortalTarget={document.body}
          />

          <button
            onClick={refreshCache}
            className="bg-secondary p-2 rounded-lg hover:bg-[var(--color-bg-tertiary)] focus:outline-none transition-all duration-200 flex items-center justify-center"
            title="Refresh Data"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>

        {/* Matchups List */}
        <div className="space-y-4">
          {loading ? (
            <div className="text-muted text-sm italic">Loading...</div>
          ) : (
            matchups.map((matchup) => {
              const scores = calculateTotalScore(matchup.id);
              return (
                <div key={matchup.id} className="bg-secondary rounded-xl shadow-lg overflow-hidden">
                  {/* Collapsed Header */}
                  <div 
                    onClick={() => handleExpandMatchup(matchup.id)}
                    className="p-3 sm:p-4 cursor-pointer hover:bg-[var(--color-bg-tertiary)] transition-colors"
                  >
                    <div className="grid grid-cols-12 items-center gap-2 sm:gap-4">
                      <div className="col-span-5 text-left text-base sm:text-xl truncate">
                        {matchup.homeTeam}
                      </div>
                      <div className="col-span-2 flex justify-center items-center gap-1 sm:gap-2 text-lg sm:text-2xl font-bold">
                        <div className="min-w-[2rem] sm:min-w-[2.5rem] text-right">{scores.home}</div>
                        <div className="h-8 border-r border-primary mx-1 sm:mx-2"></div>
                        <div className="min-w-[2rem] sm:min-w-[2.5rem] text-left">{scores.away}</div>
                      </div>
                      <div className="col-span-5 text-right text-base sm:text-xl truncate">
                        {matchup.awayTeam}
                      </div>
                    </div>
                  </div>

                  {/* Expanded Content */}
                  {expandedMatchups.has(matchup.id) && (
                    <div className="border-t border-border">
                      <div className="p-3 sm:p-4">
                        <div className="w-full">
                          <div className="space-y-2">
                            {LINEUP_SLOTS.map(slot => (
                              <React.Fragment key={slot.id}>
                                {Array.from({ length: slot.count }).map((_, index) => (
                                  <div key={index} className="grid grid-cols-2 gap-2 min-h-[3.5rem]">
                                    {/* Home Team */}
                                    <div className="flex flex-col justify-center">
                                      {isCurrentWeek() ? (
                                        <Select
                                          value={matchupLineups[matchup.id]?.home[slot.id]?.[index] ? {
                                            value: matchupLineups[matchup.id].home[slot.id][index],
                                            label: matchupPlayers[matchup.id]?.home.find(p => p.id === matchupLineups[matchup.id].home[slot.id][index])?.name || '',
                                            team: matchupPlayers[matchup.id]?.home.find(p => p.id === matchupLineups[matchup.id].home[slot.id][index])?.team,
                                            position: slot.label,
                                            playerPosition: matchupPlayers[matchup.id]?.home.find(p => p.id === matchupLineups[matchup.id].home[slot.id][index])?.position,
                                            score: getPlayerScore(matchupLineups[matchup.id].home[slot.id][index], matchupPlayers[matchup.id]?.home || []),
                                            isSelected: true
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
                                              playerPosition: player.position,
                                              score: getPlayerScore(player.id, matchupPlayers[matchup.id]?.home || [])
                                            }))
                                          ]}
                                          styles={customStyles}
                                          formatOptionLabel={({ label, team, position, playerPosition, score, isSelected }) => (
                                            <div className="flex justify-between items-center w-full min-h-[3.5rem] sm:min-h-0">
                                              <div className="flex flex-col">
                                                <div className="font-medium break-words text-sm sm:text-base">{label}</div>
                                                <div className="flex items-center text-xs text-gray-400">
                                                  <span className={POSITION_COLORS[position === 'FLEX' && playerPosition ? playerPosition : position]}>
                                                    {position === 'FLEX' && playerPosition ? playerPosition : position}
                                                  </span>
                                                  {team && (
                                                    <>
                                                      <span className="mx-1">·</span>
                                                      <span>{team}</span>
                                                    </>
                                                  )}
                                                </div>
                                              </div>
                                              {isSelected && (
                                                <div className="ml-2 text-white pl-2 py-1 text-sm whitespace-nowrap">
                                                  {score}
                                                </div>
                                              )}
                                            </div>
                                          )}
                                          isClearable={false}
                                          placeholder={`Empty ${slot.label}`}
                                          className="w-full"
                                          components={{ IndicatorSeparator: () => null }}
                                          isSearchable={false}
                                          menuPortalTarget={document.body}
                                        />
                                      ) : (
                                        <div className="w-full bg-primary text-white px-3 py-1 rounded min-h-[3.85rem] sm:min-h-0 flex items-center justify-between">
                                          <div className="flex flex-col gap-0.5">
                                            {matchupLineups[matchup.id]?.home[slot.id]?.[index] ? (
                                              (() => {
                                                const player = matchupPlayers[matchup.id]?.home.find(p => p.id === matchupLineups[matchup.id].home[slot.id][index]);
                                                return player ? (
                                                  <>
                                                    <div className="font-medium leading-tight break-words text-sm sm:text-base">{player.name}</div>
                                                    <div className="flex items-center text-xs text-gray-400 leading-tight">
                                                      <span className={POSITION_COLORS[slot.label === 'FLEX' ? player.position : slot.label]}>
                                                        {slot.label === 'FLEX' ? player.position : slot.label}
                                                      </span>
                                                      {player.team && (
                                                        <>
                                                          <span className="mx-1">·</span>
                                                          <span>{player.team}</span>
                                                        </>
                                                      )}
                                                    </div>
                                                  </>
                                                ) : `Empty ${slot.label}`;
                                              })()
                                            ) : `Empty ${slot.label}`}
                                          </div>
                                          <div className="ml-2 text-white pl-2 py-1 text-sm">
                                            {matchupLineups[matchup.id]?.home[slot.id]?.[index] ? 
                                              getPlayerScore(matchupLineups[matchup.id].home[slot.id][index], matchupPlayers[matchup.id]?.home || []) : 
                                              0}
                                          </div>
                                        </div>
                                      )}
                                    </div>

                                    {/* Away Team */}
                                    <div className="flex flex-col justify-center">
                                      {isCurrentWeek() ? (
                                        <Select
                                          value={matchupLineups[matchup.id]?.away[slot.id]?.[index] ? {
                                            value: matchupLineups[matchup.id].away[slot.id][index],
                                            label: matchupPlayers[matchup.id]?.away.find(p => p.id === matchupLineups[matchup.id].away[slot.id][index])?.name || '',
                                            team: matchupPlayers[matchup.id]?.away.find(p => p.id === matchupLineups[matchup.id].away[slot.id][index])?.team,
                                            position: slot.label,
                                            playerPosition: matchupPlayers[matchup.id]?.away.find(p => p.id === matchupLineups[matchup.id].away[slot.id][index])?.position,
                                            score: getPlayerScore(matchupLineups[matchup.id].away[slot.id][index], matchupPlayers[matchup.id]?.away || []),
                                            isSelected: true,
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
                                              score: getPlayerScore(player.id, matchupPlayers[matchup.id]?.away || []),
                                              isAway: true
                                            }))
                                          ]}
                                          styles={{
                                            ...customStyles,
                                            control: (base, state) => ({
                                              ...customStyles.control(base, state),
                                              flexDirection: 'row-reverse'
                                            }),
                                            valueContainer: (base) => ({
                                              ...base,
                                              flexDirection: 'row-reverse'
                                            }),
                                            placeholder: (base) => ({
                                              ...base,
                                              textAlign: 'right',
                                              width: '100%'
                                            })
                                          }}
                                          formatOptionLabel={({ label, team, position, playerPosition, score, isSelected, isAway }) => (
                                            <div className="flex justify-between items-center w-full min-h-[3.5rem] sm:min-h-0">
                                              {isSelected && (
                                                <div className="mr-2 text-white pr-2 py-1 text-sm whitespace-nowrap">
                                                  {score}
                                                </div>
                                              )}
                                              <div className="flex flex-col items-end w-full">
                                                <div className="font-medium break-words text-sm sm:text-base text-right w-full">{label}</div>
                                                <div className="flex items-center text-xs text-gray-400 justify-end w-full">
                                                  {team && (
                                                    <>
                                                      <span>{team}</span>
                                                      <span className="mx-1">·</span>
                                                    </>
                                                  )}
                                                  <span className={POSITION_COLORS[position === 'FLEX' && playerPosition ? playerPosition : position]}>
                                                    {position === 'FLEX' && playerPosition ? playerPosition : position}
                                                  </span>
                                                </div>
                                              </div>
                                            </div>
                                          )}
                                          isClearable={false}
                                          placeholder={`Empty ${slot.label}`}
                                          className="w-full"
                                          components={{ IndicatorSeparator: () => null }}
                                          isSearchable={false}
                                          menuPortalTarget={document.body}
                                        />
                                      ) : (
                                        <div className="w-full bg-primary text-white px-3 py-1 rounded min-h-[3.85rem] sm:min-h-0 flex items-center justify-between">
                                          <div className="text-white pr-2 py-1 text-sm">
                                            {matchupLineups[matchup.id]?.away[slot.id]?.[index] ? 
                                              getPlayerScore(matchupLineups[matchup.id].away[slot.id][index], matchupPlayers[matchup.id]?.away || []) : 
                                              0}
                                          </div>
                                          <div className="flex flex-col gap-0.5 items-end">
                                            {matchupLineups[matchup.id]?.away[slot.id]?.[index] ? (
                                              (() => {
                                                const player = matchupPlayers[matchup.id]?.away.find(p => p.id === matchupLineups[matchup.id].away[slot.id][index]);
                                                return player ? (
                                                  <>
                                                    <div className="font-medium leading-tight text-right break-words text-sm sm:text-base">{player.name}</div>
                                                    <div className="flex items-center text-xs text-gray-400 leading-tight justify-end">
                                                      {player.team && (
                                                        <>
                                                          <span>{player.team}</span>
                                                          <span className="mx-1">·</span>
                                                        </>
                                                      )}
                                                      <span className={POSITION_COLORS[slot.label === 'FLEX' ? player.position : slot.label]}>
                                                        {slot.label === 'FLEX' ? player.position : slot.label}
                                                      </span>
                                                    </div>
                                                  </>
                                                ) : <div className="text-right w-full">Empty {slot.label}</div>;
                                              })()
                                            ) : <div className="text-right w-full">Empty {slot.label}</div>}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </React.Fragment>
                            ))}
                          </div>
                        </div>

                        {isCurrentWeek() && (
                          <button
                            onClick={() => handleSubmitStarters(matchup.id)}
                            className="mt-4 w-full bg-primary px-4 py-2 rounded-lg border border-primary hover:bg-[var(--color-bg-tertiary)] transition-colors"
                          >
                            Save Starters
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default Matchups; 