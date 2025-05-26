import React, { useEffect, useState, useRef } from 'react';
import { db } from '../firebase';
import { collection, getDocs } from 'firebase/firestore';
import { getCache, setCache } from '../utils/cache';
import {LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine} from 'recharts';

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

function PlayerTable() {
  const [players, setPlayers] = useState([]);
  const [filteredPlayers, setFilteredPlayers] = useState([]);
  const [positionFilter, setPositionFilter] = useState('All');
  const [sortBy, setSortBy] = useState('totalPoints');
  const [selectedYear, setSelectedYear] = useState('2024');
  const [selectedWeek, setSelectedWeek] = useState('All');
  const [ownerMap, setOwnerMap] = useState({});
  const [ownerFilter, setOwnerFilter] = useState('All');
  const [teamFilter, setTeamFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [isMobilePanelOpen, setIsMobilePanelOpen] = useState(false);
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const filterRef = useRef(null);

  useEffect(() => {
    async function fetchData() {
      const cached = getCache('players_and_defenses');
      if (cached) {
        setPlayers(cached);
        return;
      }

      const [playerSnap, defenseSnap] = await Promise.all([
        getDocs(collection(db, 'players')),
        getDocs(collection(db, 'defense')),
      ]);

      const data = [];

      playerSnap.forEach((doc) => {
        const player = doc.data();
        data.push({
          id: doc.id,
          name: player.roster?.name,
          position: player.roster?.position,
          team: player.roster?.team,
          scoring: player.scoring || {},
        });
      });

      defenseSnap.forEach((doc) => {
        const team = doc.id;
        const scoring = doc.data();
        data.push({
          id: team,
          name: team,
          position: 'DST',
          team: team,
          scoring,
        });
      });

      setCache('players_and_defenses', data);
      setPlayers(data);
    }

    fetchData();
  }, []);

  useEffect(() => {
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
    if (positionFilter !== 'All') {
      filtered = filtered.filter(p => p.position === positionFilter);
    }

    if (teamFilter !== 'All') {
      filtered = filtered.filter(p => p.team === teamFilter);
    }

    if (ownerFilter !== 'All') {
      filtered = filtered.filter(p => (ownerMap[p.id] || 'Free Agent') === ownerFilter);
    }

    if (searchQuery.trim() !== '') {
      const query = searchQuery.trim().toLowerCase();
      filtered = filtered.filter(p => p.name.toLowerCase().includes(query));
    }

    filtered.sort((a, b) => b[sortBy] - a[sortBy]);

    setFilteredPlayers(filtered);
  }, [players, positionFilter, sortBy, selectedYear, selectedWeek, ownerFilter, ownerMap, teamFilter, searchQuery]);

  useEffect(() => {
    const fetchRosters = async () => {
      const cached = getCache('fantasy_rosters');
      if (cached) {
        setOwnerMap(cached);
        return;
      }

      const snapshot = await getDocs(collection(db, "fantasyTeams"));
      const map = {};
      snapshot.forEach((doc) => {
        const teamName = doc.id;
        const data = doc.data();
        if (Array.isArray(data.roster)) {
          data.roster.forEach(id => map[id] = teamName);
        }
      });

      setCache('fantasy_rosters', map);
      setOwnerMap(map);
    };

    fetchRosters();
  }, []);

  const positions = ['All', ...Array.from(new Set(players.map(p => p.position)))];
  const weekOptions = ['All', ...Array.from({ length: 18 }, (_, i) => (i + 1).toString())];
  const ownerOptions = ['All', ...Array.from(new Set([...Object.values(ownerMap), 'Free Agent']))];
  const teamOptions = ["All", ...[...new Set(players.map(p => p.team))].filter(t => t !== "All").sort()];

  const handlePlayerSelect = (player) => {
    setSelectedPlayer(player);
    if (window.innerWidth < 1024) { // lg breakpoint
      setIsMobilePanelOpen(true);
    }
  };

  const handleOverlayClick = (e) => {
    // Only close if clicking the overlay itself, not its children
    if (e.target === e.currentTarget) {
      setIsFilterPanelOpen(false);
    }
  };

  // Add click outside handler
  useEffect(() => {
    function handleClickOutside(event) {
      if (filterRef.current && !filterRef.current.contains(event.target)) {
        setIsFilterPanelOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div className="flex h-[calc(100vh-80px)] bg-primary text-primary overflow-hidden overscroll-none">
      {/* Left side: filters, search, table */}
      <div className="flex-1 flex flex-col p-6 relative overflow-hidden overscroll-none">
        {/* Search and Filters Container */}
        <div className="flex items-center gap-4 mb-6 w-full">
          {/* Filters Button and Dropdown */}
          <div className="relative" ref={filterRef}>
            <button
              onClick={() => setIsFilterPanelOpen(!isFilterPanelOpen)}
              className="flex items-center gap-2 bg-secondary text-primary border border-primary rounded-md px-4 py-2 hover:bg-[var(--color-bg-tertiary)] transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              Filters
            </button>

            {/* Dropdown Menu */}
            <div 
              className={`absolute top-full left-0 mt-2 w-96 bg-secondary rounded-lg shadow-lg border border-primary transform transition-all duration-200 origin-top-right z-50 ${
                isFilterPanelOpen 
                  ? 'opacity-100 scale-100' 
                  : 'opacity-0 scale-95 pointer-events-none'
              }`}
            >

              <div className="p-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-semibold mb-1">Year</label>
                      <select 
                        value={selectedYear} 
                        onChange={(e) => setSelectedYear(e.target.value)}
                        className="w-full bg-tertiary text-primary border border-primary rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary transition"
                      >
                        <option value="2024">2024</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold mb-1">Week</label>
                      <select 
                        value={selectedWeek} 
                        onChange={(e) => setSelectedWeek(e.target.value)}
                        className="w-full bg-tertiary text-primary border border-primary rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary transition"
                      >
                        {weekOptions.map(w => <option key={w} value={w}>{w === 'All' ? 'All Weeks' : `Week ${w}`}</option>)}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold mb-1">Position</label>
                      <select 
                        value={positionFilter} 
                        onChange={(e) => setPositionFilter(e.target.value)}
                        className="w-full bg-tertiary text-primary border border-primary rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary transition"
                      >
                        {positions.map(pos => <option key={pos} value={pos}>{pos}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-semibold mb-1">Team</label>
                      <select 
                        value={teamFilter} 
                        onChange={(e) => setTeamFilter(e.target.value)}
                        className="w-full bg-tertiary text-primary border border-primary rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary transition"
                      >
                        {teamOptions.map(team => <option key={team} value={team}>{team}</option>)}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold mb-1">Owner</label>
                      <select 
                        value={ownerFilter} 
                        onChange={(e) => setOwnerFilter(e.target.value)}
                        className="w-full bg-tertiary text-primary border border-primary rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary transition"
                      >
                        {ownerOptions.map((owner) => (
                          <option key={owner} value={owner}>{owner}</option>
                        ))}
                      </select>
                    </div>

                    {selectedWeek === 'All' && (
                      <div>
                        <label className="block text-sm font-semibold mb-1">Sort by</label>
                        <select 
                          value={sortBy} 
                          onChange={(e) => setSortBy(e.target.value)}
                          className="w-full bg-tertiary text-primary border border-primary rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary transition"
                        >
                          <option value="totalPoints">Total Points</option>
                          <option value="averagePoints">Average Points</option>
                        </select>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-4 flex justify-end">
                  <button
                    onClick={() => setIsFilterPanelOpen(false)}
                    className="bg-primary text-secondary px-4 py-1.5 rounded-md hover:bg-[var(--color-bg-tertiary)] transition-colors text-sm"
                  >
                    Apply Filters
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Search Bar */}
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search by player name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-secondary text-primary border border-primary rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>
        

        {/* Player Table Container */}
        <div className="flex-1 overflow-hidden overscroll-none">
          <div className="h-full overflow-y-auto pr-4 pb-4 overscroll-none">
            <div className="inline-block rounded-xl shadow-lg bg-secondary w-full">
              <div className="sticky top-0 bg-secondary border-b border-border z-10">
                <table className="w-full bg-muted">
                  <thead className="text-xs uppercase tracking-wide text-muted">
                    <tr>
                      <th className="px-3 py-2 text-right w-16 whitespace-nowrap bg-muted"></th>
                      <th className="px-3 py-2 text-left whitespace-nowrap bg-muted">Player</th>
                      <th className="px-3 py-2 text-center w-24 whitespace-nowrap bg-muted">Points</th>
                    </tr>
                  </thead>
                </table>
              </div>
              <table className="text-left divide-y divide-border w-full">
                <tbody className="text-sm">
                  {filteredPlayers.map((player, index) => (
                    <tr 
                      key={player.id} 
                      onClick={() => handlePlayerSelect(player)} 
                      className="hover:bg-[var(--color-bg-tertiary)] even:bg-[var(--color-bg-muted)] transition-colors duration-150 cursor-pointer"
                    >
                      <td className="px-3 py-3 text-right w-16">{index + 1}.</td>
                      <td className="px-3 py-3 text-left">
                        <div className="text-base font-semibold">{player.name}</div>
                        <div className="text-xs text-muted mt-1">
                          <span className={`position-${player.position}`}>{player.position}</span> · {player.team} · {ownerMap[player.id] || "Free Agent"}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-center w-24">
                        <div className="text-base font-semibold">{player.totalPoints}</div>
                        {selectedWeek === 'All' && (
                          <div className="text-xs text-muted mt-1">{player.averagePoints}</div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side Panel - Desktop */}
      <div className="hidden lg:block w-2/3 h-full overflow-y-auto bg-secondary p-6 overscroll-none">
        {selectedPlayer ? (
          <>
            <div className="flex space-x-6 items-center mb-6 border-b border-border pb-3">
              <h2 className="text-xl font-bold">{selectedPlayer.name}</h2>
              <p className="text-sm text-muted text-left">
                <span className={`position-${selectedPlayer.position}`}>{selectedPlayer.position}</span> · {selectedPlayer.team} · {ownerMap[selectedPlayer.id] || "Free Agent"}
              </p>
            </div>

            <h3 className="text-sm font-semibold mb-4 text-accent">
              Stats ({selectedWeek === 'All' ? 'Total' : `Week ${selectedWeek}`})
            </h3>

            <div className="grid grid-cols-3 gap-2 mb-6">
              {(() => {
                const isDefense = selectedPlayer.position === 'DST';
                const statNameMap = isDefense ? defenseStatNameMap : playerStatNameMap;
                const stats = selectedPlayer?.scoring[selectedYear] || {};
                const relevantWeeks =
                  selectedWeek === 'All'
                    ? Object.values(stats)
                    : stats[selectedWeek]
                    ? [stats[selectedWeek]]
                    : [];

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
                    <div key={statKey} className="bg-muted rounded-lg p-3">
                      <div className="text-xs text-muted mb-1">{statNameMap[statKey]}</div>
                      <div className="text-lg font-semibold">{combinedStats[statKey]}</div>
                    </div>
                  );
                });
              })()}
            </div>

            <div className="mt-8">
              <h3 className="text-sm font-semibold mb-4 text-accent">Weekly Points</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart
                  data={Array.from({ length: 18 }, (_, i) => {
                    const weekNum = (i + 1).toString();
                    const weekData = selectedPlayer.scoring?.[selectedYear]?.[weekNum];
                    // Only include weeks that have data
                    if (!weekData) return null;
                    return {
                      week: `W${weekNum}`,
                      points: weekData.points ?? 0,
                      isSelected: selectedWeek === weekNum
                    };
                  }).filter(Boolean)} // Remove null entries
                  margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                  <XAxis 
                    dataKey="week" 
                    stroke="#999"
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis 
                    stroke="#999"
                    tick={{ fontSize: 12 }}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'var(--color-bg-secondary)',
                      border: '1px solid var(--color-text-primary)',
                      borderRadius: '8px',
                      padding: '8px'
                    }}
                    labelStyle={{ color: 'var(--color-text-primary)', fontSize: '14px' }}
                    itemStyle={{ color: 'var(--color-text-accent)', fontSize: '16px' }}
                  />
                  <ReferenceLine 
                    y={selectedPlayer.scoring[selectedYear] ? 
                      Object.values(selectedPlayer.scoring[selectedYear])
                        .reduce((sum, week) => sum + (week.points || 0), 0) / 
                      Object.values(selectedPlayer.scoring[selectedYear]).length : 0}
                    stroke="#f59e0b"
                    strokeDasharray="3 3"
                    label={{ 
                      value: 'Avg', 
                      position: 'right',
                      fill: '#f59e0b',
                      fontSize: 12
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="points"
                    stroke="#6666ff"
                    strokeWidth={2}
                    dot={(props) => {
                      const { cx, cy, payload } = props;
                      if (!cx || !cy) return null;
                      return (
                        <circle
                          cx={cx}
                          cy={cy}
                          r={payload.isSelected ? 6 : 4}
                          fill={payload.isSelected ? "#f59e0b" : "#6666ff"}
                          stroke={payload.isSelected ? "#f59e0b" : "#6666ff"}
                        />
                      );
                    }}
                    activeDot={(props) => {
                      const { cx, cy, payload } = props;
                      if (!cx || !cy) return null;
                      return (
                        <circle
                          cx={cx}
                          cy={cy}
                          r={8}
                          fill={payload.isSelected ? "#f59e0b" : "#6666ff"}
                          stroke={payload.isSelected ? "#f59e0b" : "#6666ff"}
                        />
                      );
                    }}
                    connectNulls={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </>
        ) : (
          <div className="text-muted text-sm italic">Click a player to see details</div>
        )}
      </div>

      {/* Mobile Panel */}
      <div className={`lg:hidden fixed inset-0 bg-black bg-opacity-50 z-50 transition-opacity duration-300 overscroll-none ${isMobilePanelOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <div className={`absolute right-0 top-0 bottom-0 w-full max-w-md bg-secondary transform transition-transform duration-300 overscroll-none ${isMobilePanelOpen ? 'translate-x-0' : 'translate-x-full'}`}>
          <div className="h-full overflow-y-auto p-6 overscroll-none">
            <div className="flex justify-between items-center mb-3 border-b border-border pb-1">
              <div>
                <h2 className="text-xl font-bold">{selectedPlayer?.name}</h2>
                <p className="text-sm text-muted text-left">
                  <span className={`position-${selectedPlayer?.position}`}>{selectedPlayer?.position}</span> · {selectedPlayer?.team} · {ownerMap[selectedPlayer?.id] || "Free Agent"}
                </p>
              </div>
              <button 
                onClick={() => setIsMobilePanelOpen(false)}
                className="p-2 hover:bg-muted rounded-full transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {selectedPlayer && (
              <>
                <h3 className="text-sm font-semibold mb-1 text-accent">
                  Stats ({selectedWeek === 'All' ? 'Total' : `Week ${selectedWeek}`})
                </h3>

                <div className="grid grid-cols-3 gap-0.5 mb-6">
                  {(() => {
                    const isDefense = selectedPlayer.position === 'DST';
                    const statNameMap = isDefense ? defenseStatNameMap : playerStatNameMap;
                    const stats = selectedPlayer?.scoring[selectedYear] || {};
                    const relevantWeeks =
                      selectedWeek === 'All'
                        ? Object.values(stats)
                        : stats[selectedWeek]
                        ? [stats[selectedWeek]]
                        : [];

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
                        <div key={statKey} className="bg-muted rounded-lg py-1">
                          <div className="text-xs text-muted mb-1">{statNameMap[statKey]}</div>
                          <div className="text-lg font-semibold">{combinedStats[statKey]}</div>
                        </div>
                      );
                    });
                  })()}
                </div>

                <div className="mt-2">
                  <h3 className="text-sm font-semibold mb-1 text-accent">Weekly Points</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart
                      data={Array.from({ length: 18 }, (_, i) => {
                        const weekNum = (i + 1).toString();
                        const weekData = selectedPlayer.scoring?.[selectedYear]?.[weekNum];
                        // Only include weeks that have data
                        if (!weekData) return null;
                        return {
                          week: `W${weekNum}`,
                          points: weekData.points ?? 0,
                          isSelected: selectedWeek === weekNum
                        };
                      }).filter(Boolean)} // Remove null entries
                      margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                      <XAxis 
                        dataKey="week" 
                        stroke="#999"
                        tick={{ fontSize: 12 }}
                      />
                      <YAxis 
                        stroke="#999"
                        tick={{ fontSize: 12 }}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'var(--color-bg-secondary)',
                          border: '1px solid var(--color-text-primary)',
                          borderRadius: '8px',
                          padding: '8px'
                        }}
                        labelStyle={{ color: 'var(--color-text-primary)', fontSize: '14px' }}
                        itemStyle={{ color: 'var(--color-text-accent)', fontSize: '16px' }}
                      />
                      <ReferenceLine 
                        y={selectedPlayer.scoring[selectedYear] ? 
                          Object.values(selectedPlayer.scoring[selectedYear])
                            .reduce((sum, week) => sum + (week.points || 0), 0) / 
                          Object.values(selectedPlayer.scoring[selectedYear]).length : 0}
                        stroke="#f59e0b"
                        strokeDasharray="3 3"
                        label={{ 
                          value: 'Avg', 
                          position: 'right',
                          fill: '#f59e0b',
                          fontSize: 12
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="points"
                        stroke="#6666ff"
                        strokeWidth={2}
                        dot={(props) => {
                          const { cx, cy, payload } = props;
                          if (!cx || !cy) return null;
                          return (
                            <circle
                              cx={cx}
                              cy={cy}
                              r={payload.isSelected ? 6 : 4}
                              fill={payload.isSelected ? "#f59e0b" : "#6666ff"}
                              stroke={payload.isSelected ? "#f59e0b" : "#6666ff"}
                            />
                          );
                        }}
                        activeDot={(props) => {
                          const { cx, cy, payload } = props;
                          if (!cx || !cy) return null;
                          return (
                            <circle
                              cx={cx}
                              cy={cy}
                              r={8}
                              fill={payload.isSelected ? "#f59e0b" : "#6666ff"}
                              stroke={payload.isSelected ? "#f59e0b" : "#6666ff"}
                            />
                          );
                        }}
                        connectNulls={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default PlayerTable;
