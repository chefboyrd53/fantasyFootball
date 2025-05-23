from firebaseSetup import db
from firebase_admin import firestore

def score(touchdownRows, week, year):

    for _, row in touchdownRows.iterrows():
        passerScore = 0
        carrierScore = 0

        if row['pass_touchdown']:
            passerId = row['passer_player_id']
            receiverId = row['td_player_id']
            yards = row['yards_gained']

            if yards <= 9:
                carrierScore = 6
                passerScore = 6
            elif 10 <= yards <= 39:
                carrierScore = 9
                passerScore = 9
            elif 40 <= yards <= 69:
                carrierScore = 12
                passerScore = 12
            elif 70 <= yards:
                carrierScore = 15
                passerScore = 15
            
            passerPosition = db.collection("players").document(passerId).get().to_dict().get("position")
            receiverPosition = db.collection("players").document(receiverId).get().to_dict().get("position")

            if passerPosition != 'QB':
                passerScore *= 2
            if receiverPosition != 'WR' and receiverPosition != 'TE':
                carrierScore *= 2

            db.collection("players").document(passerId).collection("years").document(str(year)).collection("weeks").document(f"week{week}").update({
                "points": firestore.Increment(passerScore),
                "passTds": firestore.Increment(1)
            })
            db.collection("players").document(receiverId).collection("years").document(str(year)).collection("weeks").document(f"week{week}").update({
                "points": firestore.Increment(carrierScore),
                "recTds": firestore.Increment(1)
            })
            

        elif row['rush_touchdown']:
            rusherId = row['td_player_id']
            yards = row['yards_gained']

            if yards <= 9:
                carrierScore = 6
            elif 10 <= yards <= 39:
                carrierScore = 9
            elif 40 <= yards <= 69:
                carrierScore = 12
            elif 70 <= yards:
                carrierScore = 15

            position = db.collection("players").document(rusherId).get().to_dict().get("position")
            if position != 'RB':
                carrierScore *= 2

            db.collection("players").document(rusherId).collection("years").document(str(year)).collection("weeks").document(f"week{week}").update({
                "points": firestore.Increment(carrierScore),
                "rushTds": firestore.Increment(1)
            })
