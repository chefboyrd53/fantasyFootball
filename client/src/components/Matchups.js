import { useState, useEffect } from 'react';
import { collection, doc, getDoc, getDocs, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { getCache, setCache, clearCache } from '../utils/cache';
import Select from 'react-select';
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
      }
    }),
    menu: (base) => ({
      ...base,
      backgroundColor: 'var(--color-bg-primary)',
      zIndex: 9999
    }),
    option: (base, state) => ({
      ...base,
      backgroundColor: state.isFocused ? 'var(--color-bg-tertiary)' : 'var(--color-bg-primary)',
      color: 'white',
      '&:hover': {
        backgroundColor: 'var(--color-bg-tertiary)'
      }
    }),
    singleValue: (base) => ({
      ...base,
      color: 'white'
    }),
    input: (base) => ({
      ...base,
      color: 'white'
    })
  };

  const topSelectStyles = {
    control: (base, state) => ({
      ...base,
      backgroundColor: 'var(--color-bg-secondary)',
      borderColor: 'transparent',
      boxShadow: state.isFocused ? '0 0 0 2px var(--color-primary)' : 'none',
      '&:hover': {
        borderColor: 'var(--color-border)'
      }
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
      }
    }),
    singleValue: (base) => ({
      ...base,
      color: 'white'
    }),
    input: (base) => ({
      ...base,
      color: 'white'
    })
  };

  // Format option for react-select
  const formatOptionLabel = ({ label, team }) => (
    <div className="flex items-center">
      <span>{label}</span>
      {team && (
        <span className="ml-2 text-sm text-muted">({team})</span>
      )}
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
      alert('Starters saved successfully!');
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
        team: player.team
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
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        
        {/* Year and Week Selection */}
        <div className="flex gap-4 mb-6">
          
          <Select
            value={yearOptions.find(opt => opt.value === selectedYear)}
            onChange={(selected) => setSelectedYear(selected.value)}
            options={yearOptions}
            styles={topSelectStyles} // Optional: reuse your react-select styles
            placeholder="Select year"
            components={{ IndicatorSeparator: () => null }}
          />

          <Select
            value={weekOptions.find(opt => opt.value === selectedWeek)}
            onChange={(selected) => setSelectedWeek(selected.value)}
            options={weekOptions}
            styles={topSelectStyles}
            placeholder="Select week"
            components={{ IndicatorSeparator: () => null }}
          />

          <button
            onClick={refreshCache}
            className="bg-accent text-white px-4 py-2 rounded-lg hover:bg-accent-dark flex items-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
            </svg>
            Refresh Data
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
                <div key={matchup.id} className="bg-secondary p-4 rounded-lg">
                  <div className="flex justify-between items-center mb-4">
                    <div className="flex-1">
                      <div className="flex justify-between items-center">
                        <div className="text-xl font-semibold">{matchup.homeTeam}</div>
                        <div className="text-2xl font-bold">{scores.home}</div>
                      </div>
                      <div className="flex justify-between items-center mt-2">
                        <div className="text-xl font-semibold">{matchup.awayTeam}</div>
                        <div className="text-2xl font-bold">{scores.away}</div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleExpandMatchup(matchup.id)}
                      className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-dark ml-4"
                    >
                      {expandedMatchups.has(matchup.id) ? 'Collapse' : 'Expand'}
                    </button>
                  </div>

                  {/* Expanded View */}
                  {expandedMatchups.has(matchup.id) && (
                    <div className="mt-4">
                      <table className="w-full">
                        <thead>
                          <tr>
                            <th className="w-1/4 text-left">{matchup.homeTeam}</th>
                            <th className="w-1/6 text-center">Score</th>
                            <th className="w-1/12 border-l border-r border-primary"></th>
                            <th className="w-1/6 text-center">Score</th>
                            <th className="w-1/4 text-right">{matchup.awayTeam}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {LINEUP_SLOTS.map(slot => (
                            <React.Fragment key={slot.id}>
                              <tr>
                                <td colSpan="5" className="py-2">
                                  <h5 className="font-medium text-lg">{slot.label}</h5>
                                </td>
                              </tr>
                              {Array.from({ length: slot.count }).map((_, index) => (
                                <tr key={index} className="h-12">
                                  <td className="pr-4">
                                    {isCurrentWeek() ? (
                                      <Select
                                        value={matchupLineups[matchup.id]?.home[slot.id]?.[index] ? {
                                          value: matchupLineups[matchup.id].home[slot.id][index],
                                          label: matchupPlayers[matchup.id]?.home.find(p => p.id === matchupLineups[matchup.id].home[slot.id][index])?.name || '',
                                          team: matchupPlayers[matchup.id]?.home.find(p => p.id === matchupLineups[matchup.id].home[slot.id][index])?.team
                                        } : null}
                                        onChange={(option) => handleLineupChange(matchup.id, 'home', slot.id, option?.value || '', index)}
                                        options={[
                                          { value: '', label: 'Empty' },
                                          ...getAvailablePlayers(
                                            matchupPlayers[matchup.id]?.home || [],
                                            slot.id,
                                            matchupLineups[matchup.id]?.home || {},
                                            matchupLineups[matchup.id]?.home[slot.id]?.[index]
                                          )
                                        ]}
                                        styles={expandedSelectStyles}
                                        formatOptionLabel={formatOptionLabel}
                                        isClearable={false}
                                        placeholder="Empty"
                                        className="w-full"
                                        components={{ IndicatorSeparator: () => null }}
                                      />
                                    ) : (
                                      <div className="w-full bg-primary text-white px-3 py-2 rounded">
                                        {matchupLineups[matchup.id]?.home[slot.id]?.[index] ? (
                                          (() => {
                                            const player = matchupPlayers[matchup.id]?.home.find(p => p.id === matchupLineups[matchup.id].home[slot.id][index]);
                                            return player ? (
                                              <div className="flex items-center">
                                                <span>{player.name}</span>
                                                {player.team && (
                                                  <span className="ml-2 text-sm text-gray-400">({player.team})</span>
                                                )}
                                              </div>
                                            ) : 'Empty';
                                          })()
                                        ) : 'Empty'}
                                      </div>
                                    )}
                                  </td>
                                  <td className="bg-primary text-white px-3 py-2 rounded text-right">
                                    {matchupLineups[matchup.id]?.home[slot.id]?.[index] ? 
                                      getPlayerScore(matchupLineups[matchup.id].home[slot.id][index], matchupPlayers[matchup.id]?.home || []) : 
                                      0}
                                  </td>
                                  <td className="border-l border-r border-primary"></td>
                                  <td className="bg-primary text-white px-3 py-2 rounded text-left">
                                    {matchupLineups[matchup.id]?.away[slot.id]?.[index] ? 
                                      getPlayerScore(matchupLineups[matchup.id].away[slot.id][index], matchupPlayers[matchup.id]?.away || []) : 
                                      0}
                                  </td>
                                  <td className="pl-4">
                                    {isCurrentWeek() ? (
                                      <Select
                                        value={matchupLineups[matchup.id]?.away[slot.id]?.[index] ? {
                                          value: matchupLineups[matchup.id].away[slot.id][index],
                                          label: matchupPlayers[matchup.id]?.away.find(p => p.id === matchupLineups[matchup.id].away[slot.id][index])?.name || '',
                                          team: matchupPlayers[matchup.id]?.away.find(p => p.id === matchupLineups[matchup.id].away[slot.id][index])?.team
                                        } : null}
                                        onChange={(option) => handleLineupChange(matchup.id, 'away', slot.id, option?.value || '', index)}
                                        options={[
                                          { value: '', label: 'Empty' },
                                          ...getAvailablePlayers(
                                            matchupPlayers[matchup.id]?.away || [],
                                            slot.id,
                                            matchupLineups[matchup.id]?.away || {},
                                            matchupLineups[matchup.id]?.away[slot.id]?.[index]
                                          )
                                        ]}
                                        styles={expandedSelectStyles}
                                        formatOptionLabel={formatOptionLabel}
                                        isClearable={false}
                                        placeholder="Empty"
                                        className="w-full"
                                        components={{ IndicatorSeparator: () => null }}
                                      />
                                    ) : (
                                      <div className="w-full bg-primary text-white px-3 py-2 rounded">
                                        {matchupLineups[matchup.id]?.away[slot.id]?.[index] ? (
                                          (() => {
                                            const player = matchupPlayers[matchup.id]?.away.find(p => p.id === matchupLineups[matchup.id].away[slot.id][index]);
                                            return player ? (
                                              <div className="flex items-center">
                                                <span>{player.name}</span>
                                                {player.team && (
                                                  <span className="ml-2 text-sm text-gray-400">({player.team})</span>
                                                )}
                                              </div>
                                            ) : 'Empty';
                                          })()
                                        ) : 'Empty'}
                                      </div>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </React.Fragment>
                          ))}
                        </tbody>
                      </table>

                      {isCurrentWeek() && (
                        <button
                          onClick={() => handleSubmitStarters(matchup.id)}
                          className="w-full mt-6 bg-accent text-white px-4 py-2 rounded-lg hover:bg-accent-dark"
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