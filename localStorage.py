import json
import os
from typing import Dict, Any, Union

# Create local_data directory if it doesn't exist
LOCAL_DATA_DIR = "local_data"
if not os.path.exists(LOCAL_DATA_DIR):
    os.makedirs(LOCAL_DATA_DIR)

# File paths for local storage
PLAYERS_FILE = os.path.join(LOCAL_DATA_DIR, "players.json")
DEFENSE_FILE = os.path.join(LOCAL_DATA_DIR, "defense.json")

# Initialize data structures
players_data = {}  # Will contain both roster and scoring data
defense_data = {}  # Will be organized by team -> year -> week -> stats

def convert_to_int(value: Union[int, float, str, Any]) -> Union[int, str, Any]:
    """Convert numeric values to integers, leave other types unchanged"""
    if isinstance(value, (int, float)):
        return int(value)
    return value

def convert_dict_values(data: Dict[str, Any]) -> Dict[str, Any]:
    """Convert all numeric values in a dictionary to integers"""
    return {key: convert_to_int(value) for key, value in data.items()}

def loadFromFiles():
    """Load all data from local JSON files"""
    global players_data, defense_data
    
    # Load players data (combined roster and scoring)
    if os.path.exists(PLAYERS_FILE):
        with open(PLAYERS_FILE, 'r') as f:
            players_data = json.load(f)
    
    # Load defense data
    if os.path.exists(DEFENSE_FILE):
        with open(DEFENSE_FILE, 'r') as f:
            defense_data = json.load(f)

def saveToFiles():
    """Save all data to local JSON files"""
    # Save players data (combined roster and scoring)
    with open(PLAYERS_FILE, 'w') as f:
        json.dump(players_data, f, indent=2)
    
    # Save defense data
    with open(DEFENSE_FILE, 'w') as f:
        json.dump(defense_data, f, indent=2)

def storePlayerData(player_id: str, year: int, week: int, data: Dict[str, Any]):
    """Store player scoring data"""
    # Only store data for players who have roster information
    if player_id not in players_data or "roster" not in players_data[player_id] or not players_data[player_id]["roster"]:
        return
    
    if "scoring" not in players_data[player_id]:
        players_data[player_id]["scoring"] = {}
    
    if str(year) not in players_data[player_id]["scoring"]:
        players_data[player_id]["scoring"][str(year)] = {}
    
    if str(week) not in players_data[player_id]["scoring"][str(year)]:
        players_data[player_id]["scoring"][str(year)][str(week)] = {}
    
    # Convert numeric values to integers
    converted_data = convert_dict_values(data)
    
    # If player already has data for this week, update it
    if str(week) in players_data[player_id]["scoring"][str(year)]:
        current_data = players_data[player_id]["scoring"][str(year)][str(week)]
        
        # For all stats, use the new values directly since they represent the total for the week
        for key, value in converted_data.items():
            current_data[key] = value
                    
        players_data[player_id]["scoring"][str(year)][str(week)] = current_data
    else:
        players_data[player_id]["scoring"][str(year)][str(week)] = converted_data

def getPlayerData(player_id: str, year: int, week: int) -> Dict[str, Any]:
    """Get player data for a specific player, year, and week"""
    try:
        return players_data[player_id]["scoring"][str(year)][str(week)].copy()
    except KeyError:
        return {
            "points": 0,
            "passYards": 0,
            "rushYards": 0,
            "recYards": 0,
            "passTds": 0,
            "rushTds": 0,
            "recTds": 0,
            "fgm": 0,
            "epm": 0,
            "2pConvs": 0
        }

def storeDefenseData(team: str, year: int, week: int, data: Dict[str, Any]):
    """Store defense scoring data"""
    if team not in defense_data:
        defense_data[team] = {}
    
    if str(year) not in defense_data[team]:
        defense_data[team][str(year)] = {}
    
    if str(week) not in defense_data[team][str(year)]:
        defense_data[team][str(year)][str(week)] = {}
    
    # Convert numeric values to integers
    converted_data = convert_dict_values(data)
    
    # If team already has data for this week, update it
    if str(week) in defense_data[team][str(year)]:
        current_data = defense_data[team][str(year)][str(week)]
        
        # For all stats, use the new values directly since they represent the total for the week
        for key, value in converted_data.items():
            current_data[key] = value
                    
        defense_data[team][str(year)][str(week)] = current_data
    else:
        defense_data[team][str(year)][str(week)] = converted_data

def getDefenseData(team: str, year: int, week: int) -> Dict[str, Any]:
    """Get defense data for a specific team, year, and week"""
    try:
        return defense_data[team][str(year)][str(week)].copy()
    except KeyError:
        return {
            "points": 0,
            "touchdowns": 0,
            "turnovers": 0,
            "sacks": 0,
            "safeties": 0,
            "returned2pts": 0,
            "returnYards": 0,
            "pointsAllowed": 0
        }

def storePlayerRoster(player_id: str, player_info: Dict[str, Any]):
    """Store player roster information"""
    if player_id not in players_data:
        players_data[player_id] = {"roster": {}, "scoring": {}}
    # Convert any numeric values in roster info to integers
    players_data[player_id]["roster"] = convert_dict_values(player_info)

def getPlayerRoster(player_id: str) -> Dict[str, Any]:
    """Get player roster information"""
    try:
        return players_data[player_id]["roster"]
    except KeyError:
        return {}

def syncToFirebase(db):
    """Sync all local data to Firebase"""
    # Sync players data (both roster and scoring)
    for player_id, player_data in players_data.items():
        # Sync roster data
        if "roster" in player_data:
            db.collection('roster').document(player_id).set(player_data["roster"])
        
        # Sync scoring data
        if "scoring" in player_data:
            for year, year_data in player_data["scoring"].items():
                for week, week_data in year_data.items():
                    db.collection('players').document(f"{year}_{week}_{player_id}").set(week_data)
    
    # Sync defense data
    for team, team_data in defense_data.items():
        for year, year_data in team_data.items():
            for week, week_data in year_data.items():
                db.collection('defense').document(f"{year}_{week}_{team}").set(week_data) 