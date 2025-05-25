import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, doc, getDoc, getDocs } from 'firebase/firestore';

function FantasyRosters() {
  const [teams, setTeams] = useState([]);
  const [players, setPlayers] = useState({});
  const [defenses, setDefenses] = useState({});

  useEffect(() => {
    const fetchData = async () => {
      const teamsSnapshot = await getDocs(collection(db, 'fantasyTeams'));
      const loadedTeams = [];

      for (let teamDoc of teamsSnapshot.docs) {
        const teamData = teamDoc.data();
        const rosterDetails = [];

        for (let playerId of teamData.roster || []) {
          if (playerId.length <= 3) {
            // Defense
            const defenseDoc = await getDoc(doc(db, 'defense', playerId));
            if (defenseDoc.exists()) {
              rosterDetails.push({
                id: playerId,
                name: playerId,
                type: 'DEF',
              });
            }
          } else {
            // Player
            const playerDoc = await getDoc(doc(db, 'players', playerId));
            if (playerDoc.exists()) {
              const p = playerDoc.data();
              rosterDetails.push({
                id: playerId,
                name: p.roster.name,
                position: p.roster.position,
                team: p.roster.team,
              });
            }
          }
        }

        loadedTeams.push({
          name: teamDoc.id,
          roster: rosterDetails,
        });
      }

      setTeams(loadedTeams);
    };

    fetchData();
  }, []);

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Fantasy Rosters</h1>
      {teams.map((team, i) => (
        <div key={i} className="mb-8">
          <h2 className="text-xl font-semibold mb-2">{team.name}</h2>
          <ul className="list-disc pl-6">
            {team.roster.map((player, j) => (
              <li key={j}>
                {player.name} {player.position ? `(${player.position})` : '(DEF)'}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

export default FantasyRosters;
