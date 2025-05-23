from collections import defaultdict
import json
import os

# Local storage for player data and roster
# Structure: {playerId: {"roster": {...}, "data": {year: {week: {...}}}}}
playerStore = defaultdict(lambda: {"roster": {}, "data": defaultdict(lambda: defaultdict(dict))})

# Local storage for defense data
defenseData = defaultdict(lambda: defaultdict(lambda: defaultdict(dict)))

def storePlayerData(playerId, year, week, data):
    """Store player data locally"""
    playerStore[playerId]["data"][year][week].update(data)

def getPlayerData(playerId, year, week):
    """Get player data from local storage"""
    return playerStore[playerId]["data"][year][week]

def storePlayerRoster(playerId, playerInfo):
    """Store player roster information locally"""
    playerStore[playerId]["roster"] = playerInfo

def getPlayerRoster(playerId):
    """Get player roster information from local storage"""
    return playerStore[playerId]["roster"] if playerId in playerStore else None

def storeDefenseData(team, year, week, data):
    """Store defense data locally"""
    defenseData[team][year][week].update(data)

def getDefenseData(team, year, week):
    """Get defense data from local storage"""
    return defenseData[team][year][week]

def saveToFiles():
    """Save all local data to JSON files"""
    os.makedirs('local_data', exist_ok=True)
    # Save player store (roster + data)
    # Convert defaultdicts to dicts for JSON serialization
    def convert(obj):
        if isinstance(obj, defaultdict):
            return {k: convert(v) for k, v in obj.items()}
        return obj
    with open('local_data/player_store.json', 'w') as f:
        json.dump(convert(playerStore), f, indent=2)
    # Save defense data
    with open('local_data/defense_data.json', 'w') as f:
        json.dump(convert(defenseData), f, indent=2)
    print("Saved all data to local_data directory")

def loadFromFiles():
    """Load all local data from JSON files"""
    try:
        def to_defaultdict(d, depth=2):
            if depth == 0:
                return d
            return defaultdict(lambda: defaultdict(dict) if depth == 2 else dict, {k: to_defaultdict(v, depth-1) for k, v in d.items()})
        # Load player store
        with open('local_data/player_store.json', 'r') as f:
            raw = json.load(f)
            for playerId, pdata in raw.items():
                playerStore[playerId]["roster"] = pdata.get("roster", {})
                playerStore[playerId]["data"] = to_defaultdict(pdata.get("data", {}), 2)
        # Load defense data
        with open('local_data/defense_data.json', 'r') as f:
            defenseData.clear()
            d = json.load(f)
            for team, years in d.items():
                defenseData[team] = to_defaultdict(years, 2)
        print("Loaded all data from local_data directory")
    except FileNotFoundError:
        print("No existing data files found")

def syncToFirebase(db):
    """Sync all local data to Firebase"""
    from firebase_admin import firestore
    # Sync player data and roster
    for playerId, pdata in playerStore.items():
        # Sync roster
        db.collection("players").document(playerId).set(pdata["roster"])
        # Sync data
        for year, weeks in pdata["data"].items():
            for week, data in weeks.items():
                doc_ref = db.collection("players").document(playerId).collection("years").document(str(year)).collection("weeks").document(f"week{week}")
                if doc_ref.get().exists:
                    doc_ref.update(data)
                else:
                    doc_ref.set(data)
    # Sync defense data
    for team, years in defenseData.items():
        for year, weeks in years.items():
            for week, data in weeks.items():
                doc_ref = db.collection("defenses").document(team).collection("years").document(str(year)).collection("weeks").document(f"week{week}")
                if doc_ref.get().exists:
                    doc_ref.update(data)
                else:
                    doc_ref.set(data)
    # Clear local storage after successful sync
    playerStore.clear()
    defenseData.clear() 