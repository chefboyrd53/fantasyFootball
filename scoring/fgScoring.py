from firebaseSetup import db
from firebase_admin import firestore

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

            kickerEntry = db.collection("players").document(playerId).collection("years").document(str(year)).collection("weeks").document(f"week{week}")

            if kickerEntry.get().exists:
                kickerEntry.update({
                    "points": firestore.Increment(score),
                    "fgm": firestore.Increment(1)
                })
            else:
                kickerEntry.set({
                    "points": score,
                    "passYards": 0,
                    "rushYards": 0,
                    "recYards": 0,
                    "passTds": 0,
                    "rushTds": 0,
                    "recTds": 0,
                    "fgm": 1,
                    "epm": 0,
                    "2pConvs": 0
                })
            
        elif row['extra_point_result'] == 'good':
            playerId = row['kicker_player_id']
            score = 1

            kickerEntry = db.collection("players").document(playerId).collection("years").document(str(year)).collection("weeks").document(f"week{week}")

            if kickerEntry.get().exists:
                kickerEntry.update({
                    "points": firestore.Increment(score),
                    "epm": firestore.Increment(1)
                })
            else:
                kickerEntry.set({
                    "points": score,
                    "passYards": 0,
                    "rushYards": 0,
                    "recYards": 0,
                    "passTds": 0,
                    "rushTds": 0,
                    "recTds": 0,
                    "fgm": 0,
                    "epm": 1,
                    "2pConvs": 0
                })
