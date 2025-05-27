import { useState, useEffect } from 'react';
import { collection, doc, getDoc, getDocs, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { getCache, setCache } from '../utils/cache';

const Matchups = () => {
  const [selectedYear, setSelectedYear] = useState('2024');
  const [selectedWeek, setSelectedWeek] = useState('week1');
  const [matchups, setMatchups] = useState([]);
  const [expandedMatchup, setExpandedMatchup] = useState(null);
  const [homeStarters, setHomeStarters] = useState([]);
  const [awayStarters, setAwayStarters] = useState([]);
  const [homePlayers, setHomePlayers] = useState([]);
  const [awayPlayers, setAwayPlayers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch matchups for selected year and week
  const fetchMatchups = async () => {
    setLoading(true);
    try {
      const cacheKey = `matchups_${selectedYear}_${selectedWeek}`;
      const cachedData = getCache(cacheKey);
      
      if (cachedData) {
        setMatchups(cachedData);
        setLoading(false);
        return;
      }

      const gamesSnapshot = await getDocs(collection(db, 'matchups', selectedYear, 'weeks', selectedWeek, 'games'));
      const gamesData = gamesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      setMatchups(gamesData);
      setCache(cacheKey, gamesData);
    } catch (error) {
      console.error('Error fetching matchups:', error);
    }
    setLoading(false);
  };

  // Fetch players for a team
  const fetchTeamPlayers = async (teamName) => {
    try {
      const teamsSnapshot = await getDocs(collection(db, 'fantasyTeams'));
      const teamDoc = teamsSnapshot.docs.find(doc => doc.id === teamName);
      
      if (!teamDoc) {
        console.warn(`No fantasy team found with ID: ${teamName}`);
        return [];
      }

      const roster = teamDoc.data().roster || [];
      const validRoster = roster.filter(id => id && id !== 'NO' && id !== 'MIN');
      
      const playerPromises = validRoster.map(async (id) => {
        if (id.length <= 3) {
          const defenseDoc = await getDoc(doc(db, 'defense', id));
          if (defenseDoc.exists()) {
            return {
              id,
              name: id,
              position: 'DST',
              team: null,
              scoring: defenseDoc.data().scoring
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

      const players = await Promise.all(playerPromises);
      return players.filter(Boolean);
    } catch (error) {
      console.error('Error fetching team players:', error);
      return [];
    }
  };

  // Handle matchup expansion
  const handleExpandMatchup = async (matchup) => {
    setExpandedMatchup(matchup);
    const homePlayers = await fetchTeamPlayers(matchup.homeTeam);
    const awayPlayers = await fetchTeamPlayers(matchup.awayTeam);
    setHomePlayers(homePlayers);
    setAwayPlayers(awayPlayers);
    
    // Set initial starters if they exist
    if (matchup.homeStarters) {
      setHomeStarters(matchup.homeStarters);
    }
    if (matchup.awayStarters) {
      setAwayStarters(matchup.awayStarters);
    }
  };

  // Calculate total score for starters
  const calculateTotalScore = (players, starterIds) => {
    return players
      .filter(player => starterIds.includes(player.id))
      .reduce((total, player) => {
        const weekNum = parseInt(selectedWeek.replace('week', ''));
        const playerScore = player.scoring?.[selectedYear]?.[weekNum]?.points || 0;
        return total + playerScore;
      }, 0);
  };

  // Submit starters to Firestore
  const handleSubmitStarters = async () => {
    if (!expandedMatchup) return;

    try {
      const gameRef = doc(db, 'matchups', selectedYear, 'weeks', selectedWeek, 'games', expandedMatchup.id);
      await updateDoc(gameRef, {
        homeStarters: homeStarters,
        awayStarters: awayStarters,
        homeBench: homePlayers
          .filter(p => !homeStarters.includes(p.id))
          .map(p => p.id),
        awayBench: awayPlayers
          .filter(p => !awayStarters.includes(p.id))
          .map(p => p.id)
      });
      alert('Starters saved successfully!');
    } catch (error) {
      console.error('Error saving starters:', error);
      alert('Error saving starters');
    }
  };

  useEffect(() => {
    fetchMatchups();
  }, [selectedYear, selectedWeek]);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-4">Matchups</h1>
        
        {/* Year and Week Selection */}
        <div className="flex gap-4 mb-6">
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="bg-secondary text-primary px-4 py-2 rounded-lg"
          >
            <option value="2024">2024</option>
          </select>
          
          <select
            value={selectedWeek}
            onChange={(e) => setSelectedWeek(e.target.value)}
            className="bg-secondary text-primary px-4 py-2 rounded-lg"
          >
            {Array.from({ length: 18 }, (_, i) => `week${i + 1}`).map(week => (
              <option key={week} value={week}>{week}</option>
            ))}
          </select>
        </div>

        {/* Matchups List */}
        {loading ? (
          <div>Loading...</div>
        ) : (
          <div className="space-y-4">
            {matchups.map((matchup) => (
              <div key={matchup.id} className="bg-secondary p-4 rounded-lg">
                <div className="flex justify-between items-center">
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold">{matchup.homeTeam} vs {matchup.awayTeam}</h3>
                    <p className="text-muted">Score: {matchup.homeScore || 0} - {matchup.awayScore || 0}</p>
                  </div>
                  <button
                    onClick={() => handleExpandMatchup(matchup)}
                    className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-dark"
                  >
                    {expandedMatchup?.id === matchup.id ? 'Collapse' : 'Expand'}
                  </button>
                </div>

                {/* Expanded View */}
                {expandedMatchup?.id === matchup.id && (
                  <div className="mt-4 space-y-6">
                    {/* Home Team Players */}
                    <div>
                      <h4 className="text-lg font-semibold mb-2">{matchup.homeTeam}</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {homePlayers.map(player => {
                          const weekNum = parseInt(selectedWeek.replace('week', ''));
                          const playerScore = player.scoring?.[selectedYear]?.[weekNum]?.points || 0;
                          return (
                            <div key={player.id} className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={homeStarters.includes(player.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setHomeStarters([...homeStarters, player.id]);
                                  } else {
                                    setHomeStarters(homeStarters.filter(id => id !== player.id));
                                  }
                                }}
                                className="form-checkbox"
                              />
                              <span className={`position-${player.position}`}>
                                {player.name} ({player.position})
                              </span>
                              <span className="ml-auto">{playerScore}</span>
                            </div>
                          );
                        })}
                      </div>
                      <div className="mt-2 text-right">
                        Total Score: {calculateTotalScore(homePlayers, homeStarters)}
                      </div>
                    </div>

                    {/* Away Team Players */}
                    <div>
                      <h4 className="text-lg font-semibold mb-2">{matchup.awayTeam}</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {awayPlayers.map(player => {
                          const weekNum = parseInt(selectedWeek.replace('week', ''));
                          const playerScore = player.scoring?.[selectedYear]?.[weekNum]?.points || 0;
                          return (
                            <div key={player.id} className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={awayStarters.includes(player.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setAwayStarters([...awayStarters, player.id]);
                                  } else {
                                    setAwayStarters(awayStarters.filter(id => id !== player.id));
                                  }
                                }}
                                className="form-checkbox"
                              />
                              <span className={`position-${player.position}`}>
                                {player.name} ({player.position})
                              </span>
                              <span className="ml-auto">{playerScore}</span>
                            </div>
                          );
                        })}
                      </div>
                      <div className="mt-2 text-right">
                        Total Score: {calculateTotalScore(awayPlayers, awayStarters)}
                      </div>
                    </div>

                    <button
                      onClick={handleSubmitStarters}
                      className="w-full bg-accent text-white px-4 py-2 rounded-lg hover:bg-accent-dark"
                    >
                      Save Starters
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Matchups; 