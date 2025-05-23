from localStorage import storePlayerData, getPlayerData

def scoreFg(fgRows, week, year):
    for _, row in fgRows.iterrows():
        score = 0

        if row['field_goal_result'] == 'made':
            playerId = row['kicker_player_id']
            yards = row['kick_distance']

            if yards <= 39:
                score = 3
            elif 40 <= yards <= 49:
                score = 5
            elif 50 <= yards <= 59:
                score = 10
            elif 60 <= yards <= 65:
                score = 15
            elif 66 <= yards:
                score = 20

            # Update kicker data
            kicker_data = getPlayerData(playerId, year, week)
            kicker_data.update({
                "points": kicker_data.get("points", 0) + score,
                "fgm": kicker_data.get("fgm", 0) + 1
            })
            storePlayerData(playerId, year, week, kicker_data)
            
        elif row['extra_point_result'] == 'good':
            playerId = row['kicker_player_id']
            score = 1

            # Update kicker data
            kicker_data = getPlayerData(playerId, year, week)
            kicker_data.update({
                "points": kicker_data.get("points", 0) + score,
                "epm": kicker_data.get("epm", 0) + 1
            })
            storePlayerData(playerId, year, week, kicker_data)
