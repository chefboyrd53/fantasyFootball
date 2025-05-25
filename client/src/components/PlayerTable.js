import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, getDocs } from 'firebase/firestore';

function PlayerTable() {
  const [players, setPlayers] = useState([]);
  const [filteredPlayers, setFilteredPlayers] = useState([]);
  const [positionFilter, setPositionFilter] = useState('All');
  const [sortBy, setSortBy] = useState('totalPoints');
  const [selectedYear, setSelectedYear] = useState('2024');
  const [selectedWeek, setSelectedWeek] = useState('All');

  useEffect(() => {
    async function fetchData() {
      const [playerSnap, defenseSnap] = await Promise.all([
        getDocs(collection(db, 'players')),
        getDocs(collection(db, 'defense')),
      ]);

      const players = [];

      // Process players
      playerSnap.forEach((doc) => {
        const data = doc.data();
        players.push({
          id: doc.id,
          name: data.roster?.name,
          position: data.roster?.position,
          team: data.roster?.team,
          scoring: data.scoring || {},
        });
      });

      // Process defenses
      defenseSnap.forEach((doc) => {
        const team = doc.id;
        const scoring = doc.data(); // year -> week -> data

        players.push({
          id: `DEF-${team}`,
          name: team,
          position: 'DST',
          team: team,
          scoring,
        });
      });

      setPlayers(players);
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
      filtered = filtered.filter(player => player.position === positionFilter);
    }

    filtered.sort((a, b) => b[sortBy] - a[sortBy]);

    setFilteredPlayers(filtered);
  }, [players, positionFilter, sortBy, selectedYear, selectedWeek]);

  const positions = ['All', ...Array.from(new Set(players.map(p => p.position)))];
  const weekOptions = ['All', ...Array.from({ length: 18 }, (_, i) => (i + 1).toString())];

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Player Stats</h1>

      <div className="flex flex-wrap gap-4 mb-4">
        <label>
          Filter by Position:{' '}
          <select value={positionFilter} onChange={(e) => setPositionFilter(e.target.value)}>
            {positions.map((pos) => (
              <option key={pos} value={pos}>{pos}</option>
            ))}
          </select>
        </label>

        {selectedWeek === 'All' && (
          <label>
            Sort by:{' '}
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="totalPoints">Total Points</option>
              <option value="averagePoints">Average Points</option>
            </select>
          </label>
        )}

        <label>
          Year:{' '}
          <select value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)}>
            <option value="2024">2024</option>
            {/* Extend this with dynamic years if needed */}
          </select>
        </label>

        <label>
          Week:{' '}
          <select value={selectedWeek} onChange={(e) => setSelectedWeek(e.target.value)}>
            {weekOptions.map((w) => (
              <option key={w} value={w}>{w === 'All' ? 'All Weeks' : `Week ${w}`}</option>
            ))}
          </select>
        </label>
      </div>

      <table className="table-auto border-collapse border border-gray-300 w-full">
        <thead>
          <tr className="bg-gray-200">
            <th></th>
            <th className="border border-gray-300 px-4 py-2">Name</th>
            <th className="border border-gray-300 px-4 py-2">Position</th>
            <th className="border border-gray-300 px-4 py-2">Team</th>
            <th className="border border-gray-300 px-4 py-2">
              {selectedWeek === 'All' ? 'Total Points' : 'Points'}
            </th>
            {selectedWeek === 'All' && (
              <th className="border border-gray-300 px-4 py-2">Avg Points</th>
            )}
          </tr>
        </thead>
        <tbody>
          {filteredPlayers.map((player, index) => (
            <tr key={player.id}>
              <td className="border border-gray-300 px-4 py-2">{index + 1}</td>
              <td className="border border-gray-300 px-4 py-2">{player.name}</td>
              <td className="border border-gray-300 px-4 py-2">{player.position}</td>
              <td className="border border-gray-300 px-4 py-2">{player.team}</td>
              <td className="border border-gray-300 px-4 py-2">{player.totalPoints}</td>
              {selectedWeek === 'All' && (
                <td className="border border-gray-300 px-4 py-2">{player.averagePoints}</td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default PlayerTable;
