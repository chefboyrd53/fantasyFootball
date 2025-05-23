import nfl_data_py as nfl
from scoring import yardageScoring, tdScoring

year = 2024
week = 1

playByPlaydf = nfl.import_pbp_data([year], downcast=False, cache=False, alt_path=None)
weeklydf = nfl.import_weekly_data([year], downcast=False)

# yardage scoring first
playerRows = weeklydf[(weeklydf['week'] == week)]
yardageScoring.scoreYardage(playerRows, week, year)
print("did yardage scoring for", playerRows.shape[0], "players")

# increment score/data with tds
touchdownRows = playByPlaydf[(playByPlaydf['touchdown'] == 1) & (playByPlaydf['week'] == week)]
tdScoring.score(touchdownRows, week, year)
print("did touchdown scoring for", touchdownRows.shape[0], "rows")
