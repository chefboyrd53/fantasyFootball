import nfl_data_py as nfl
from firebaseSetup import db

# get roster
year = 2024
allPlayers = nfl.import_seasonal_rosters([year])

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
