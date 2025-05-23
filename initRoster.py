import nfl_data_py as nfl
from firebaseSetup import db

# get roster
year = 2024
allPlayers = nfl.import_seasonal_rosters([year])

emptyStats = {
    "points": 0,
    "passYards": 0,
    "rushYards": 0,
    "recYards": 0,
    "passTds": 0,
    "rushTds": 0,
    "recTds": 0
}

for _, row in allPlayers.iterrows():
    position = row['position']

    if position == 'QB' or position == 'RB' or position == 'WR' or position =='TE' or position == 'K':
        playerId = row['player_id']
        name = row['player_name']
        team = row['team']

        playerInfo = {
            "name": name,
            "position": position,
            "team": team
        }

        db.collection("players").document(playerId).set(playerInfo)

print("initialized", year, "rosters into database")
