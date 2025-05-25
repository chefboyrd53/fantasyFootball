import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, getDocs } from 'firebase/firestore';
import { getCache, setCache } from '../utils/cache';

function PlayerTable() {
  const [players, setPlayers] = useState([]);
  const [filteredPlayers, setFilteredPlayers] = useState([]);
  const [positionFilter, setPositionFilter] = useState('All');
  const [sortBy, setSortBy] = useState('totalPoints');
  const [selectedYear, setSelectedYear] = useState('2024');
  const [selectedWeek, setSelectedWeek] = useState('All');
  const [ownerMap, setOwnerMap] = useState({});
  const [ownerFilter, setOwnerFilter] = useState('All');


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

    if (ownerFilter !== 'All') {
      filtered = filtered.filter(p => (ownerMap[p.id] || 'Free Agent') === ownerFilter);
    }

    filtered.sort((a, b) => b[sortBy] - a[sortBy]);

    setFilteredPlayers(filtered);
  }, [players, positionFilter, sortBy, selectedYear, selectedWeek, ownerFilter, ownerMap]);

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



  return (
    <div className="p-4 min-h-screen bg-primary text-primary flex flex-col items-center">
      <h1 className="text-3xl font-bold mb-6 text-accent">Player Stats</h1>
      <div className="flex flex-wrap justify-center gap-6 mb-6 w-full text-sm">
        <label className="flex flex-col sm:flex-row items-start sm:items-center gap-1 sm:gap-2 text-secondary">
          <span className="whitespace-nowrap font-semibold">Position:</span>
          <select 
            value={positionFilter} 
            onChange={(e) => setPositionFilter(e.target.value)}
            className="bg-secondary text-primary border border-primary rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary transition"
          >
            {positions.map(pos => <option key={pos} value={pos}>{pos}</option>)}
          </select>
        </label>

        <label className="flex flex-col sm:flex-row items-start sm:items-center gap-1 sm:gap-2 text-secondary">
          <span className="whitespace-nowrap font-semibold">Year:</span>
          <select 
            value={selectedYear} 
            onChange={(e) => setSelectedYear(e.target.value)}
            className="bg-secondary text-primary border border-primary rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary transition"
          >
            <option value="2024">2024</option>
          </select>
        </label>

        <label className="flex flex-col sm:flex-row items-start sm:items-center gap-1 sm:gap-2 text-secondary">
          <span className="whitespace-nowrap font-semibold">Week:</span>
          <select 
            value={selectedWeek} 
            onChange={(e) => setSelectedWeek(e.target.value)}
            className="bg-secondary text-primary border border-primary rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary transition"
          >
            {weekOptions.map(w => <option key={w} value={w}>{w === 'All' ? 'All Weeks' : `Week ${w}`}</option>)}
          </select>
        </label>

        <label className="flex flex-col sm:flex-row items-start sm:items-center gap-1 sm:gap-2 text-secondary">
          <span className="whitespace-nowrap font-semibold">Owner:</span>
          <select 
            value={ownerFilter} 
            onChange={(e) => setOwnerFilter(e.target.value)}
            className="bg-secondary text-primary border border-primary rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary transition"
          >
            {ownerOptions.map((owner) => (
              <option key={owner} value={owner}>{owner}</option>
            ))}
          </select>
        </label>

        {selectedWeek === 'All' && (
          <label className="flex flex-col sm:flex-row items-start sm:items-center gap-1 sm:gap-2 text-secondary">
            <span className="whitespace-nowrap font-semibold">Sort by:</span>
            <select 
              value={sortBy} 
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-secondary text-primary border border-primary rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary transition"
            >
              <option value="totalPoints">Total Points</option>
              <option value="averagePoints">Average Points</option>
            </select>
          </label>
        )}
      </div>

      <div className="flex justify-center p-4">
        <div className="inline-block rounded-xl shadow-lg bg-secondary overflow-x-auto">
          <table className="text-left divide-y divide-border w-full">
            <thead className="bg-muted text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-3 py-2 text-center w-1 whitespace-nowrap"></th>
                <th className="px-3 py-2 text-left whitespace-nowrap">Player</th>
                <th className="px-3 py-2 text-center w-1 whitespace-nowrap">Points</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {filteredPlayers.map((player, index) => (
                <tr key={player.id} className="hover:bg-[var(--color-bg-tertiary)] even:bg-[var(--color-bg-muted)] transition-colors duration-150">
                  <td className="px-3 py-3 text-right text-xs">{index + 1}.</td>

                  <td className="px-3 py-3 text-left">
                    <div className="text-base font-semibold">{player.name}</div>
                    <div className="text-xs text-muted mt-1">
                      <span className={`position-${player.position}`}>{player.position}</span> · {player.team} · {ownerMap[player.id] || "Free Agent"}
                    </div>
                  </td>

                  <td className="px-3 py-3 text-center">
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
  );
}

export default PlayerTable;
