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
    <div className="p-4 min-h-screen bg-gray-900 text-gray-100">
      <h1 className="text-3xl font-bold mb-6 text-blue-400">Player Stats</h1>
      <div className="flex flex-wrap gap-4 mb-6">
        <label className="flex items-center gap-2">
          Filter by Position:{' '}
          <select 
            value={positionFilter} 
            onChange={(e) => setPositionFilter(e.target.value)}
            className="bg-gray-800 text-gray-100 border border-blue-500 rounded px-3 py-1 focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            {positions.map(pos => <option key={pos} value={pos}>{pos}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2">
          Year:{' '}
          <select 
            value={selectedYear} 
            onChange={(e) => setSelectedYear(e.target.value)}
            className="bg-gray-800 text-gray-100 border border-blue-500 rounded px-3 py-1 focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            <option value="2024">2024</option>
          </select>
        </label>
        <label className="flex items-center gap-2">
          Week:{' '}
          <select 
            value={selectedWeek} 
            onChange={(e) => setSelectedWeek(e.target.value)}
            className="bg-gray-800 text-gray-100 border border-blue-500 rounded px-3 py-1 focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            {weekOptions.map(w => <option key={w} value={w}>{w === 'All' ? 'All Weeks' : `Week ${w}`}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2">
          Owner:{' '}
          <select 
            value={ownerFilter} 
            onChange={(e) => setOwnerFilter(e.target.value)}
            className="bg-gray-800 text-gray-100 border border-blue-500 rounded px-3 py-1 focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            {ownerOptions.map((owner) => (
              <option key={owner} value={owner}>{owner}</option>
            ))}
          </select>
        </label>
        {selectedWeek === 'All' && (
          <label className="flex items-center gap-2">
            Sort by:{' '}
            <select 
              value={sortBy} 
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-gray-800 text-gray-100 border border-blue-500 rounded px-3 py-1 focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              <option value="totalPoints">Total Points</option>
              <option value="averagePoints">Average Points</option>
            </select>
          </label>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-800">
              <th className="border border-blue-600 px-4 py-3 text-left"></th>
              <th className="border border-blue-600 px-4 py-3 text-left">Name</th>
              <th className="border border-blue-600 px-4 py-3 text-left">Position</th>
              <th className="border border-blue-600 px-4 py-3 text-left">Team</th>
              <th className="border border-blue-600 px-4 py-3 text-left">
                {selectedWeek === 'All' ? 'Total Points' : 'Points'}
              </th>
              {selectedWeek === 'All' && (
                <th className="border border-blue-600 px-4 py-3 text-left">Avg Points</th>
              )}
              <th className="border border-blue-600 px-4 py-3 text-left">Owner</th>
            </tr>
          </thead>
          <tbody>
            {filteredPlayers.map((player, index) => (
              <tr key={player.id} className="hover:bg-gray-800 transition-colors">
                <td className="border border-blue-600 px-4 py-2 text-amber-400">{index + 1}.</td>
                <td className="border border-blue-600 px-4 py-2">{player.name}</td>
                <td className="border border-blue-600 px-4 py-2">{player.position}</td>
                <td className="border border-blue-600 px-4 py-2">{player.team}</td>
                <td className="border border-blue-600 px-4 py-2 text-amber-400">{player.totalPoints}</td>
                {selectedWeek === 'All' && (
                  <td className="border border-blue-600 px-4 py-2 text-amber-400">{player.averagePoints}</td>
                )}
                <td className="border border-blue-600 px-4 py-2">{ownerMap[player.id] || "Free Agent"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default PlayerTable;
