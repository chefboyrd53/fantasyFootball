import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import { getCache, setCache } from '../utils/cache';

function FantasyRosters() {
  const [teams, setTeams] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      const cached = getCache('fantasy_roster_details');
      if (cached) {
        setTeams(cached);
        return;
      }

      const teamsSnapshot = await getDocs(collection(db, 'fantasyTeams'));
      const loadedTeams = [];

      for (let teamDoc of teamsSnapshot.docs) {
        const teamData = teamDoc.data();
        const rosterDetails = [];

        for (let playerId of teamData.roster || []) {
          if (playerId.length <= 3) {
            const defenseDoc = await getDoc(doc(db, 'defense', playerId));
            if (defenseDoc.exists()) {
              rosterDetails.push({
                id: playerId,
                name: playerId,
                type: 'DEF',
              });
            }
          } else {
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

      setCache('fantasy_roster_details', loadedTeams);
      setTeams(loadedTeams);
    };

    fetchData();
  }, []);

  return (
    <div className="p-4 min-h-screen bg-primary text-primary">
      <h1 className="text-3xl font-bold mb-6 text-accent">Fantasy Rosters</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {teams.map((team, i) => (
          <div key={i} className="bg-secondary rounded-lg p-6 shadow-lg border border-primary hover:border-primary-light transition-colors">
            <h2 className="text-xl font-semibold mb-4 text-accent border-b border-primary pb-2">{team.name}</h2>
            <ul className="space-y-2">
              {team.roster.map((player, j) => (
                <li key={j} className="flex items-center gap-2 text-secondary hover:text-primary transition-colors">
                  <span className="text-accent">•</span>
                  {player.name} 
                  <span className="text-muted">
                    {player.position ? `(${player.position})` : '(DEF)'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

export default FantasyRosters;
