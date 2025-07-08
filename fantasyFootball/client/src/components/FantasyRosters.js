import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import { getCache, setCache } from '../utils/cache';

// Position colors and order
const POSITION_COLORS = {
  QB: 'position-QB',
  RB: 'position-RB',
  WR: 'position-WR',
  TE: 'position-TE',
  DST: 'position-DST',
  K: 'position-K'
};

const POSITION_ORDER = ['QB', 'RB', 'WR', 'TE', 'K', 'DST'];

const TEAM_ORDER = {
  blue: ['Paul', 'Mick', 'Steve', 'Jason'],
  gold: ['Mike', 'Chris', 'Mark', 'John']
};

function FantasyRosters() {
  const [teams, setTeams] = useState({ blue: [], gold: [] });

  useEffect(() => {
    const fetchData = async () => {
      const cached = getCache('fantasy_roster_details');
      if (cached) {
        setTeams(cached);
        return;
      }

      const teamsSnapshot = await getDocs(collection(db, 'fantasyTeams'));
      const loadedTeams = { blue: [], gold: [] };

      for (let teamDoc of teamsSnapshot.docs) {
        const teamData = teamDoc.data();
        const rosterDetails = await Promise.all(
          (teamData.roster || []).map(async (playerId) => {
            if (playerId.length <= 3) {
              const defenseDoc = await getDoc(doc(db, 'defense', playerId));
              if (defenseDoc.exists()) {
                return {
                  id: playerId,
                  name: playerId,
                  position: 'DST',
                  team: null
                };
              }
            } else {
              const playerDoc = await getDoc(doc(db, 'players', playerId));
              if (playerDoc.exists()) {
                const p = playerDoc.data();
                return {
                  id: playerId,
                  name: p.roster.name,
                  position: p.roster.position,
                  team: p.roster.team
                };
              }
            }
            return null;
          })
        );

        const teamInfo = {
          name: teamDoc.id,
          roster: rosterDetails.filter(Boolean),
          waivers: teamData.waivers || 0,
        };

        if (teamData.division === 'blue') {
          loadedTeams.blue.push(teamInfo);
        } else if (teamData.division === 'gold') {
          loadedTeams.gold.push(teamInfo);
        }
      }

      // Sort teams according to specified order
      const normalize = (name) => name.trim().toLowerCase();
      loadedTeams.blue.sort((a, b) => 
        TEAM_ORDER.blue.findIndex(n => normalize(n) === normalize(a.name)) -
        TEAM_ORDER.blue.findIndex(n => normalize(n) === normalize(b.name))
      );

      loadedTeams.gold.sort((a, b) => 
        TEAM_ORDER.gold.findIndex(n => normalize(n) === normalize(a.name)) -
        TEAM_ORDER.gold.findIndex(n => normalize(n) === normalize(b.name))
      );


      setCache('fantasy_roster_details', loadedTeams);
      setTeams(loadedTeams);
    };

    fetchData();
  }, []);

  const TeamCard = ({ team, division }) => {
    // Group players by position
    const playersByPosition = team.roster.reduce((acc, player) => {
      const pos = player.position || 'DST';
      if (!acc[pos]) acc[pos] = [];
      acc[pos].push(player);
      return acc;
    }, {});

    const divisionColor = division === 'blue' ? 'text-secondary' : 'text-accent';

    return (
      <div className="bg-secondary rounded-lg p-3 sm:p-6 shadow-lg border border-primary hover:border-primary-light transition-colors">
        <h2 className={`text-lg sm:text-xl font-semibold ${divisionColor} border-b border-primary pb-2 mb-3 sm:mb-4`}>{team.name}</h2>
        
        <div className="space-y-3 sm:space-y-4">
          {POSITION_ORDER.map(position => {
            const players = playersByPosition[position] || [];
            if (players.length === 0) return null;

            return (
              <div key={position} className="space-y-1">
                <h3 className={`text-xs sm:text-sm font-semibold ${POSITION_COLORS[position]}`}>{position}</h3>
                <div className="space-y-1">
                  {players.map((player, j) => (
                    <div key={j} className="flex items-center gap-2 text-secondary hover:text-primary transition-colors">
                      <span className="text-primary text-sm sm:text-base">{player.name}</span>
                      {player.team && (
                        <span className="text-muted text-xs sm:text-sm">({player.team})</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-3 sm:mt-4 pt-2 border-t border-primary text-xs sm:text-sm text-muted">
          Waivers: {team.waivers}
        </div>
      </div>
    );
  };

  return (
    <div className="p-2 sm:p-4 min-h-screen bg-primary text-primary">
      {/* Blue Division */}
      <div className="mb-4 sm:mb-8">
        <h2 className="text-xl sm:text-2xl font-bold mb-2 sm:mb-4 text-secondary">Blue Division</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
          {teams.blue.map((team, i) => (
            <TeamCard key={i} team={team} division="blue" />
          ))}
        </div>
      </div>

      {/* Gold Division */}
      <div>
        <h2 className="text-xl sm:text-2xl font-bold mb-2 sm:mb-4 text-accent">Gold Division</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
          {teams.gold.map((team, i) => (
            <TeamCard key={i} team={team} division="gold" />
          ))}
        </div>
      </div>
    </div>
  );
}


export default FantasyRosters;
