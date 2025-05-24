import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, getDocs } from 'firebase/firestore';

function PlayerTable() {
  const [players, setPlayers] = useState([]);

  useEffect(() => {
    async function fetchPlayers() {
      const querySnapshot = await getDocs(collection(db, 'players'));
      const playerData = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        const scoring = data.scoring?.['2024'] ?? {};
        const totalPoints = Object.values(scoring).reduce((sum, week) => sum + (week.points || 0), 0);

        playerData.push({
          id: doc.id,
          name: data.roster?.name,
          position: data.roster?.position,
          team: data.roster?.team,
          totalPoints,
        });
      });

      // 🔽 Sort by totalPoints descending
      playerData.sort((a, b) => b.totalPoints - a.totalPoints);

      setPlayers(playerData);
    }

    fetchPlayers();
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Player Stats</h1>
      <table className="table-auto border-collapse border border-gray-300 w-full">
        <thead>
          <tr className="bg-gray-200">
            <th className="border border-gray-300 px-4 py-2">Name</th>
            <th className="border border-gray-300 px-4 py-2">Position</th>
            <th className="border border-gray-300 px-4 py-2">Team</th>
            <th className="border border-gray-300 px-4 py-2">Total Points</th>
          </tr>
        </thead>
        <tbody>
          {players.map((player) => (
            <tr key={player.id}>
              <td className="border border-gray-300 px-4 py-2">{player.name}</td>
              <td className="border border-gray-300 px-4 py-2">{player.position}</td>
              <td className="border border-gray-300 px-4 py-2">{player.team}</td>
              <td className="border border-gray-300 px-4 py-2">{player.totalPoints}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default PlayerTable;
