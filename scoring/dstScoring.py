from firebaseSetup import db
from firebase_admin import firestore

def scoreDST(playByPlaydf, week, year):
    score = 0

    # defensive touchdown
    touchdownRows = playByPlaydf[(playByPlaydf['td_team'] == playByPlaydf['defteam']) & (playByPlaydf['week'] == week)]
    for _, row in touchdownRows.iterrows():
        defTeam = row['defteam']
        score = 10

        defEntry = db.collection("defenses").document(defTeam).collection("years").document(str(year)).collection("weeks").document(f"week{week}")
        if defEntry.get().exists:
            defEntry.update({
                "points": firestore.Increment(score),
                "touchdowns": firestore.Increment(1),
            })
        else:
            defEntry.set({
                "points": score,
                "touchdowns": 1,
                "turnovers": 0,
                "sacks": 0,
                "safeties": 0,
                "returned2pts": 0,
                "returnYards": 0,
                "pointsAllowed": 0
            })

    # turnovers
    turnoverRows = playByPlaydf[((playByPlaydf['interception']) | (playByPlaydf['fumble_lost'])) & (playByPlaydf['week'] == week)]
    for _, row in turnoverRows.iterrows():
        defTeam = row['defteam']
        score = 2

        defEntry = db.collection("defenses").document(defTeam).collection("years").document(str(year)).collection("weeks").document(f"week{week}")
        if defEntry.get().exists:
            defEntry.update({
                "points": firestore.Increment(score),
                "turnovers": firestore.Increment(1),
            })
        else:
            defEntry.set({
                "points": score,
                "touchdowns": 0,
                "turnovers": 1,
                "sacks": 0,
                "safeties": 0,
                "returned2pts": 0,
                "returnYards": 0,
                "pointsAllowed": 0
            })

    # sacks
    sackRows = playByPlaydf[(playByPlaydf['sack']) & (playByPlaydf['week'] == week)]
    for _, row in sackRows.iterrows():
        defTeam = row['defteam']
        score = 1

        defEntry = db.collection("defenses").document(defTeam).collection("years").document(str(year)).collection("weeks").document(f"week{week}")
        if defEntry.get().exists:
            defEntry.update({
                "points": firestore.Increment(score),
                "sacks": firestore.Increment(1),
            })
        else:
            defEntry.set({
                "points": score,
                "touchdowns": 0,
                "turnovers": 0,
                "sacks": 1,
                "safeties": 0,
                "returned2pts": 0,
                "returnYards": 0,
                "pointsAllowed": 0
            })

    # safety
    safetyRows = playByPlaydf[(playByPlaydf['safety']) & (playByPlaydf['week'] == week)]
    for _, row in safetyRows.iterrows():
        defTeam = row['defteam']
        score = 12

        defEntry = db.collection("defenses").document(defTeam).collection("years").document(str(year)).collection("weeks").document(f"week{week}")
        if defEntry.get().exists:
            defEntry.update({
                "points": firestore.Increment(score),
                "safeties": firestore.Increment(1),
            })
        else:
            defEntry.set({
                "points": score,
                "touchdowns": 0,
                "turnovers": 0,
                "sacks": 0,
                "safeties": 1,
                "returned2pts": 0,
                "returnYards": 0,
                "pointsAllowed": 0
            })

    # defense blocks PAT and returns it for PAT, defense intercepts or recovers fumble of 2 pt conversion and returns it
    specialRows = playByPlaydf[(playByPlaydf['defensive_extra_point_conv']) & (playByPlaydf['week'] == week)]
    for _, row in specialRows.iterrows():
        defTeam = row['defteam']
        score = 12

        defEntry = db.collection("defenses").document(defTeam).collection("years").document(str(year)).collection("weeks").document(f"week{week}")
        if defEntry.get().exists:
            defEntry.update({
                "points": firestore.Increment(score),
                "returned2pts": firestore.Increment(1),
            })
        else:
            defEntry.set({
                "points": score,
                "touchdowns": 0,
                "turnovers": 0,
                "sacks": 0,
                "safeties": 0,
                "returned2pts": 1,
                "returnYards": 0,
                "pointsAllowed": 0
            })

    # combined punt + kickoff return yards (no point updates)
    returnRows = playByPlaydf[((playByPlaydf['punt_attempt']) | (playByPlaydf['kickoff_attempt'])) & (playByPlaydf['week'] == week)]
    for _, row in returnRows.iterrows():
        defTeam = row['return_team']
        yards = row['return_yards']


        defEntry = db.collection("defenses").document(defTeam).collection("years").document(str(year)).collection("weeks").document(f"week{week}")
        if defEntry.get().exists:
            defEntry.update({"returnYards": firestore.Increment(yards)})
        else:
            defEntry.set({
                "points": 0,
                "touchdowns": 0,
                "turnovers": 0,
                "sacks": 0,
                "safeties": 0,
                "returned2pts": 0,
                "returnYards": yards,
                "pointsAllowed": 0
            })

    # end of game check for points allowed and add points for return yards
    weekGames = playByPlaydf[(playByPlaydf['week'] == week)]
    finalPlays = weekGames.sort_values(['game_id', 'play_id']).groupby('game_id').tail(1)
    for _, row in finalPlays.iterrows():
        homeTeam = row['home_team']
        awayTeam = row['away_team']
        homeTeamPoints = row['home_score']
        awayTeamPoints = row['away_score']
        homeScore = 0
        awayScore = 0
        
        if homeTeamPoints == 0:
            awayScore = 12
        elif 1 <= homeTeamPoints <= 3:
            awayScore = 9
        elif 4 <= homeTeamPoints <= 6:
            awayScore = 6
        elif 7 <= homeTeamPoints <= 10:
            awayScore = 3

        if awayTeamPoints == 0:
            homeScore = 12
        elif 1 <= awayTeamPoints <= 3:
            homeScore = 9
        elif 4 <= awayTeamPoints <= 6:
            homeScore = 6
        elif 7 <= awayTeamPoints <= 10:
            homeScore = 3

        homeEntry = db.collection("defenses").document(homeTeam).collection("years").document(str(year)).collection("weeks").document(f"week{week}")
        awayEntry = db.collection("defenses").document(awayTeam).collection("years").document(str(year)).collection("weeks").document(f"week{week}")
        homeGet = homeEntry.get()
        awayGet = awayEntry.get()

        if homeGet.exists:
            homeEntry.update({
                "points": firestore.Increment(homeScore),
                "pointsAllowed": awayTeamPoints,
            })
        else:
            homeEntry.set({
                "points": homeScore,
                "touchdowns": 0,
                "turnovers": 0,
                "sacks": 0,
                "safeties": 0,
                "returned2pts": 0,
                "returnYards": 0,
                "pointsAllowed": awayTeamPoints
            })

        if awayGet.exists:
            awayEntry.update({
                "points": firestore.Increment(awayScore),
                "pointsAllowed": homeTeamPoints,
            })
        else:
            awayEntry.set({
                "points": awayScore,
                "touchdowns": 0,
                "turnovers": 0,
                "sacks": 0,
                "safeties": 0,
                "returned2pts": 0,
                "returnYards": 0,
                "pointsAllowed": homeTeamPoints
            })

        totalReturnYards = homeGet.to_dict().get("returnYards")
        if 75 <= totalReturnYards <= 99:
            homeEntry.update({"points": firestore.Increment(3)})
        elif 100 <= totalReturnYards <= 149:
            homeEntry.update({"points": firestore.Increment(6)})
        elif 150 <= totalReturnYards:
            homeEntry.update({"points": firestore.Increment(9)})

        totalReturnYards = awayGet.to_dict().get("returnYards")
        if 75 <= totalReturnYards <= 99:
            awayEntry.update({"points": firestore.Increment(3)})
        elif 100 <= totalReturnYards <= 149:
            awayEntry.update({"points": firestore.Increment(6)})
        elif 150 <= totalReturnYards:
            awayEntry.update({"points": firestore.Increment(9)})
    

    


