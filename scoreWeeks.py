import nfl_data_py as nfl
from scoring import yardageScoring, tdScoring, fgScoring, dstScoring

year = 2024
week = 1

playByPlaydf = nfl.import_pbp_data([year], downcast=False, cache=False, alt_path=None)
weeklydf = nfl.import_weekly_data([year], downcast=False)


# yardage scoring and 2 point conversions
playerRows = weeklydf[(weeklydf['week'] == week)]
yardageScoring.scoreYardage(playerRows, week, year)
print("did yardage scoring for", playerRows.shape[0], "players")

# increment score/data with tds
touchdownRows = playByPlaydf[(playByPlaydf['touchdown'] == 1) & (playByPlaydf['week'] == week)]
tdScoring.score(touchdownRows, week, year)
print("did touchdown scoring for", touchdownRows.shape[0], "rows")

# field goals and extra points
fgRows = playByPlaydf[((playByPlaydf['field_goal_result'] == 'made') | (playByPlaydf['extra_point_result'] == 'good')) & (playByPlaydf['week'] == week)]
fgScoring.scoreFg(fgRows, week, year)
print("did fg and extra point scoring for", fgRows.shape[0], "kicks")

# defense and special teams scoring
dstScoring.scoreDST(playByPlaydf, week, year)
print("did defense and special teams scoring")
