import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, TextInput, Modal, StyleSheet, ActivityIndicator, ScrollView, Dimensions, Image } from 'react-native';
import { VictoryChart, VictoryLine, VictoryAxis, VictoryLabel } from 'victory-native';
import { Line } from 'react-native-svg';
import { ScrollView as RNScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const playerStatNameMap = {
  passYards: 'Passing Yards',
  rushYards: 'Rushing Yards',
  recYards: 'Receiving Yards',
  passTds: 'Passing Tds',
  rushTds: 'Rushing Tds',
  recTds: 'Receiving Tds',
  fgm: 'Field Goals',
  epm: 'Extra Points',
  '2pConvs': '2PT Converts',
};

const defenseStatNameMap = {
  touchdowns: 'Touchdowns',
  turnovers: 'Turnovers',
  sacks: 'Sacks',
  returnYards: 'Kickoff & Punt Return Yards',
  pointsAllowed: 'Points Allowed',
  safeties: 'Safeties',
  returned2pts: 'Returned 2 Point Conversions',
};

const POSITION_COLORS = {
  QB: '#ff6666',
  RB: '#00ffcc',
  WR: '#33adff',
  TE: '#66ff33',
  DST: '#bf8040',
  K: '#e066ff',
};

function getPositionColor(pos) {
  return POSITION_COLORS[pos] || '#fff';
}

const YEAR_OPTIONS = ['2024'];
const WEEK_OPTIONS = ['All', ...Array.from({ length: 18 }, (_, i) => (i + 1).toString())];

const TEAM_LOGOS = {
  ARI: require('../assets/teams/ARI.png'),
  ATL: require('../assets/teams/ATL.png'),
  BAL: require('../assets/teams/BAL.png'),
  BUF: require('../assets/teams/BUF.png'),
  CAR: require('../assets/teams/CAR.png'),
  CHI: require('../assets/teams/CHI.png'),
  CIN: require('../assets/teams/CIN.png'),
  CLE: require('../assets/teams/CLE.png'),
  DAL: require('../assets/teams/DAL.png'),
  DEN: require('../assets/teams/DEN.png'),
  DET: require('../assets/teams/DET.png'),
  GB: require('../assets/teams/GB.png'),
  HOU: require('../assets/teams/HOU.png'),
  IND: require('../assets/teams/IND.png'),
  JAX: require('../assets/teams/JAX.png'),
  KC: require('../assets/teams/KC.png'),
  LV: require('../assets/teams/LV.png'),
  LAC: require('../assets/teams/LAC.png'),
  LA: require('../assets/teams/LA.png'),
  MIA: require('../assets/teams/MIA.png'),
  MIN: require('../assets/teams/MIN.png'),
  NE: require('../assets/teams/NE.png'),
  NO: require('../assets/teams/NO.png'),
  NYG: require('../assets/teams/NYG.png'),
  NYJ: require('../assets/teams/NYJ.png'),
  PHI: require('../assets/teams/PHI.png'),
  PIT: require('../assets/teams/PIT.png'),
  SEA: require('../assets/teams/SEA.png'),
  SF: require('../assets/teams/SF.png'),
  TB: require('../assets/teams/TB.png'),
  TEN: require('../assets/teams/TEN.png'),
  WAS: require('../assets/teams/WAS.png'),
};

export default function PlayerStatsPage({ players, ownerMap }) {
  const [filteredPlayers, setFilteredPlayers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedYear, setSelectedYear] = useState('2024');
  const [selectedWeek, setSelectedWeek] = useState('All');
  const [positionFilter, setPositionFilter] = useState('All');
  const [teamFilter, setTeamFilter] = useState('All');
  const [ownerFilter, setOwnerFilter] = useState('All');
  const [sortBy, setSortBy] = useState('totalPoints');
  const [teamOptions, setTeamOptions] = useState(['All']);
  const [positionOptions, setPositionOptions] = useState(['All']);
  const [ownerOptions, setOwnerOptions] = useState(['All']);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [yearOpen, setYearOpen] = useState(false);
  const [weekOpen, setWeekOpen] = useState(false);
  const [positionOpen, setPositionOpen] = useState(false);
  const [teamOpen, setTeamOpen] = useState(false);
  const [ownerOpen, setOwnerOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  // State for multi-select filters:
  const [selectedPositions, setSelectedPositions] = useState(['All']);
  const [selectedTeams, setSelectedTeams] = useState(['All']);
  const [selectedOwners, setSelectedOwners] = useState(['All']);

  useEffect(() => {
    if (players.length > 0) {
      // Set filter options
      setTeamOptions(['All', ...[...new Set(players.map(p => p.team))].filter(t => t !== 'All').sort()]);
      setPositionOptions(['All', ...Array.from(new Set(players.map(p => p.position)))]);
      setOwnerOptions(['All', ...Array.from(new Set([...Object.values(ownerMap), 'Free Agent']))]);
    }
  }, [players, ownerMap]);

  useEffect(() => {
    // Calculate points and filter
    const updated = players.map(player => {
      const yearData = player.scoring[selectedYear] || {};
      let relevantWeeks;
      if (selectedWeek === 'All') {
        relevantWeeks = Object.values(yearData);
      } else {
        const weekData = yearData[selectedWeek];
        relevantWeeks = weekData ? [weekData] : [];
      }
      const totalPoints = relevantWeeks.reduce((sum, w) => sum + (w.points || 0), 0);
      const averagePoints = relevantWeeks.length > 0 ? (totalPoints / relevantWeeks.length).toFixed(2) : '0.00';
      return {
        ...player,
        totalPoints,
        averagePoints: parseFloat(averagePoints),
      };
    });
    let filtered = [...updated];
    // Position filter (multi-select)
    if (!(selectedPositions.length === 1 && selectedPositions[0] === 'All')) {
      filtered = filtered.filter(p => selectedPositions.includes(p.position));
    }
    // Team filter (multi-select)
    if (!(selectedTeams.length === 1 && selectedTeams[0] === 'All')) {
      filtered = filtered.filter(p => selectedTeams.includes(p.team));
    }
    // Owner filter (multi-select)
    if (!(selectedOwners.length === 1 && selectedOwners[0] === 'All')) {
      filtered = filtered.filter(p => selectedOwners.includes(ownerMap[p.id] || 'Free Agent'));
    }
    if (searchQuery.trim() !== '') {
      const query = searchQuery.trim().toLowerCase();
      filtered = filtered.filter(p => p.name.toLowerCase().includes(query));
    }
    filtered.sort((a, b) => b[sortBy] - a[sortBy]);
    setFilteredPlayers(filtered);
  }, [players, selectedPositions, selectedTeams, selectedOwners, sortBy, selectedYear, selectedWeek, ownerMap, searchQuery]);

  const renderPlayer = ({ item, index }) => (
    <TouchableOpacity style={[styles.row, index % 2 === 0 ? styles.rowEven : styles.rowOdd]} onPress={() => setSelectedPlayer(item)}>
      <Text style={styles.rank}>{index + 1}.</Text>
      <View style={{ flex: 1, alignItems: 'flex-start' }}>
        <Text style={styles.name}>{item.name || ''}</Text>
        <Text style={styles.meta}>
          <Text style={{ color: getPositionColor(item.position)}}>{item.position || ''}</Text>
          <Text> · {item.team || ''} · {ownerMap[item.id] || 'Free Agent'}</Text>
        </Text>
      </View>
      <View style={styles.pointsCol}>
        <Text style={styles.points}>{item.totalPoints || 0}</Text>
        {selectedWeek === 'All' && (
          <Text style={styles.avgPoints}>{item.averagePoints || 0}</Text>
        )}
      </View>
    </TouchableOpacity>
  );

  // Chart width
  const chartWidth = Dimensions.get('window').width;

  return (
    <>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.filterButton} onPress={() => setIsFilterModalOpen(true)}>
          <Ionicons name="filter" size={24} color="#6666ff" />
        </TouchableOpacity>
        <View style={{ flex: 1, position: 'relative' }}>
          <TextInput
            style={styles.input}
            placeholder="Search by player name..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#a1a1aa"
            keyboardAppearance="dark"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              style={styles.clearSearchIcon}
              onPress={() => setSearchQuery('')}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close-circle" size={20} color="#6666ff" />
            </TouchableOpacity>
          )}
        </View>
      </View>
      <Modal
        visible={isFilterModalOpen}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setIsFilterModalOpen(false)}
      >
        <View style={{ flex: 1 }}>
          {/* Overlay: appears instantly, does not animate */}
          {isFilterModalOpen && (
            <TouchableOpacity
              style={styles.instantOverlay}
              activeOpacity={1}
              onPress={() => setIsFilterModalOpen(false)}
            />
          )}
          {/* Panel: slides up from the bottom */}
          <View style={styles.filterModalContent}>
            <TouchableOpacity style={styles.closeIconFilters} onPress={() => setIsFilterModalOpen(false)}>
              <Text style={styles.closeIconText}>×</Text>
            </TouchableOpacity>
            <Text style={styles.filterModalTitle}>Filters</Text>
            <View style={styles.filtersDivider} />
            <View style={styles.filterModalScroll}>
              <View style={styles.filterModalItem}>
                <Text style={styles.filterLabel}>Year</Text>
                <RNScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.weekScroll} contentContainerStyle={{ paddingVertical: 4 }}>
                  {YEAR_OPTIONS.map(y => (
                    <TouchableOpacity
                      key={y}
                      style={[styles.toggleButton, selectedYear === y ? styles.toggleButtonActive : null, { minWidth: 48, alignItems: 'center' }]}
                      onPress={() => setSelectedYear(y)}
                    >
                      <Text style={[styles.toggleButtonText, selectedYear === y ? styles.toggleButtonTextActive : null]}>{y}</Text>
                    </TouchableOpacity>
                  ))}
                </RNScrollView>
              </View>
              <View style={styles.filterModalItem}>
                <Text style={styles.filterLabel}>Week</Text>
                <RNScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.weekScroll} contentContainerStyle={{ paddingVertical: 4 }}>
                  {WEEK_OPTIONS.map(w => (
                    <TouchableOpacity
                      key={w}
                      style={[styles.toggleButton, selectedWeek === w ? styles.toggleButtonActive : null, { minWidth: 48, alignItems: 'center' }]}
                      onPress={() => setSelectedWeek(w)}
                    >
                      <Text style={[styles.toggleButtonText, selectedWeek === w ? styles.toggleButtonTextActive : null]}>{w === 'All' ? 'All Weeks' : 'W' + w}</Text>
                    </TouchableOpacity>
                  ))}
                </RNScrollView>
              </View>
              <View style={styles.filterModalItem}>
                <Text style={styles.filterLabel}>Position</Text>
                <RNScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.weekScroll} contentContainerStyle={{ paddingVertical: 4 }}>
                  {positionOptions.map(pos => (
                    <TouchableOpacity
                      key={pos}
                      style={[styles.toggleButton, selectedPositions.includes(pos) ? styles.toggleButtonActive : null, { minWidth: 48, alignItems: 'center' }]}
                      onPress={() => {
                        if (pos === 'All') {
                          setSelectedPositions(['All']);
                        } else {
                          setSelectedPositions(prev => prev.includes(pos)
                            ? prev.filter(p => p !== pos && p !== 'All')
                            : [...prev.filter(p => p !== 'All'), pos]);
                        }
                      }}
                    >
                      <Text style={[styles.toggleButtonText, selectedPositions.includes(pos) ? styles.toggleButtonTextActive : null]}>{pos}</Text>
                    </TouchableOpacity>
                  ))}
                </RNScrollView>
              </View>
              <View style={styles.filterModalItem}>
                <Text style={styles.filterLabel}>Team</Text>
                <RNScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.weekScroll} contentContainerStyle={{ paddingVertical: 4 }}>
                  {teamOptions.map(team => (
                    <TouchableOpacity
                      key={team}
                      style={[
                        styles.teamLogoChip,
                        selectedTeams.includes(team) ? styles.teamLogoChipActive : null,
                        { minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' }
                      ]}
                      onPress={() => {
                        if (team === 'All') {
                          setSelectedTeams(['All']);
                        } else {
                          setSelectedTeams(prev => prev.includes(team)
                            ? prev.filter(t => t !== team && t !== 'All')
                            : [...prev.filter(t => t !== 'All'), team]);
                        }
                      }}
                    >
                      {team === 'All' ? (
                        <Text style={[styles.toggleButtonText, selectedTeams.includes(team) ? styles.toggleButtonTextActive : null]}>All</Text>
                      ) : (
                        <Image
                          source={TEAM_LOGOS[team]}
                          style={styles.teamLogoImg}
                          resizeMode="contain"
                        />
                      )}
                    </TouchableOpacity>
                  ))}
                </RNScrollView>
              </View>
              <View style={styles.filterModalItem}>
                <Text style={styles.filterLabel}>Owner</Text>
                <RNScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.weekScroll} contentContainerStyle={{ paddingVertical: 4 }}>
                  {ownerOptions.map(owner => (
                    <TouchableOpacity
                      key={owner}
                      style={[styles.toggleButton, selectedOwners.includes(owner) ? styles.toggleButtonActive : null, { minWidth: 48, alignItems: 'center' }]}
                      onPress={() => {
                        if (owner === 'All') {
                          setSelectedOwners(['All']);
                        } else {
                          setSelectedOwners(prev => prev.includes(owner)
                            ? prev.filter(o => o !== owner && o !== 'All')
                            : [...prev.filter(o => o !== 'All'), owner]);
                        }
                      }}
                    >
                      <Text style={[styles.toggleButtonText, selectedOwners.includes(owner) ? styles.toggleButtonTextActive : null]}>{owner}</Text>
                    </TouchableOpacity>
                  ))}
                </RNScrollView>
              </View>
              {selectedWeek === 'All' && (
                <View style={styles.filterModalItem}>
                  <Text style={styles.filterLabel}>Sort By</Text>
                  <View style={styles.sortToggleRow}>
                    <TouchableOpacity
                      style={[styles.sortToggleButton, sortBy === 'totalPoints' ? styles.sortToggleButtonActive : null]}
                      onPress={() => setSortBy('totalPoints')}
                    >
                      <Text style={[styles.sortToggleButtonText, sortBy === 'totalPoints' ? styles.sortToggleButtonTextActive : null]}>Total Points</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.sortToggleButton, sortBy === 'averagePoints' ? styles.sortToggleButtonActive : null]}
                      onPress={() => setSortBy('averagePoints')}
                    >
                      <Text style={[styles.sortToggleButtonText, sortBy === 'averagePoints' ? styles.sortToggleButtonTextActive : null]}>Average Points</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          </View>
        </View>
      </Modal>
      {!players || players.length === 0 ? (
        <ActivityIndicator size="large" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={filteredPlayers}
          keyExtractor={item => item.id}
          renderItem={renderPlayer}
          contentContainerStyle={{ paddingBottom: 40 }}
        />
      )}
      <Modal
        visible={!!selectedPlayer}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setSelectedPlayer(null)}
      >
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.modalContent} style={{flex: 1, width: '100%'}}>
            <TouchableOpacity style={styles.closeIconStats} onPress={() => setSelectedPlayer(null)}>
              <Text style={styles.closeIconText}>×</Text>
            </TouchableOpacity>
            {selectedPlayer && (
              <>
                <Text style={styles.modalTitle}>{selectedPlayer.name || ''}</Text>
                <Text style={[styles.meta, styles.modalMeta]}>
                  <Text style={{ color: getPositionColor(selectedPlayer.position)}}>{selectedPlayer.position || ''}</Text>
                  <Text> · {selectedPlayer.team || ''} · {ownerMap[selectedPlayer.id] || 'Free Agent'}</Text>
                </Text>
                <View style={styles.statsDivider} />
                <Text style={styles.sectionTitle}>
                  Stats ({selectedWeek === 'All' ? 'Total' : 'Week ' + selectedWeek})
                </Text>
                <View style={styles.statGrid}>
                  {(() => {
                    const isDefense = selectedPlayer.position === 'DST';
                    const statNameMap = isDefense ? defenseStatNameMap : playerStatNameMap;
                    const stats = selectedPlayer?.scoring[selectedYear] || {};
                    let relevantWeeks;
                    if (selectedWeek === 'All') {
                      relevantWeeks = Object.values(stats);
                    } else {
                      const weekData = stats[selectedWeek];
                      relevantWeeks = weekData ? [weekData] : [];
                    }
                    const combinedStats = relevantWeeks.reduce((acc, week) => {
                      Object.entries(week).forEach(([key, value]) => {
                        acc[key] = (acc[key] || 0) + value;
                      });
                      return acc;
                    }, {});
                    const statOrder = isDefense
                      ? Object.keys(defenseStatNameMap)
                      : Object.keys(playerStatNameMap);
                    return statOrder.map((statKey) => {
                      if (combinedStats[statKey] == null) return null;
                      return (
                        <View key={statKey} style={styles.statCell}>
                          <Text style={styles.statLabel}>{statNameMap[statKey]}</Text>
                          <Text style={styles.statValue}>{combinedStats[statKey]}</Text>
                        </View>
                      );
                    });
                  })()}
                </View>
                <Text style={styles.sectionTitle}>Weekly Points</Text>
                <View style={{ alignItems: 'center', width: '100%' }}>
                  {(() => {
                    const stats = selectedPlayer?.scoring[selectedYear] || {};
                    const data = Array.from({ length: 18 }, (_, i) => {
                      const weekNum = (i + 1).toString();
                      const weekData = stats[weekNum];
                      if (!weekData) return null;
                      return {
                        x: i + 1,
                        y: weekData.points ?? 0,
                      };
                    }).filter(Boolean);
                    if (data.length === 0) {
                      return <Text style={{ color: '#a1a1aa', fontStyle: 'italic', marginBottom: 12 }}>No weekly data</Text>;
                    }
                    // Calculate average
                    const avg = data.reduce((sum, d) => sum + d.y, 0) / data.length;
                    const weekTicks = data.map(d => d.x);
                    const everyOtherWeekTicks = weekTicks.filter((_, i) => i % 2 === 0);
                    const minWeek = Math.min(...weekTicks);
                    const maxWeek = Math.max(...weekTicks);
                    return (
                      <>
                        <VictoryChart
                          width={chartWidth}
                          height={220}
                          domain={{ x: [minWeek, maxWeek] }}
                          domainPadding={{ x: 0, y: 20 }}
                          padding={{ left: 48, right: 24, top: 24, bottom: 40 }}
                        >
                          <VictoryAxis
                            tickValues={everyOtherWeekTicks}
                            tickFormat={t => 'W' + t}
                            style={{
                              axis: { stroke: '#a1a1aa' },
                              tickLabels: { fill: '#fff', fontSize: 12 },
                              grid: { stroke: '#333', strokeDasharray: '4,4' },
                            }}
                            gridComponent={<Line />}
                          />
                          <VictoryAxis
                            dependentAxis
                            style={{
                              axis: { stroke: '#a1a1aa' },
                              tickLabels: { fill: '#fff', fontSize: 12 },
                              grid: { stroke: '#333', strokeDasharray: '4,4' },
                            }}
                            gridComponent={<Line />}
                          />
                          <VictoryLine
                            data={data}
                            style={{ data: { stroke: '#6666ff', strokeWidth: 3 } }}
                            interpolation="monotoneX"
                          />
                          {/* Average line */}
                          <VictoryLine
                            data={data.map(d => ({ x: d.x, y: avg }))}
                            style={{ data: { stroke: '#f59e0b', strokeDasharray: '6,6', strokeWidth: 2 } }}
                          />
                        </VictoryChart>
                      </>
                    );
                  })()}
                </View>
              </>
            )}
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  input: {
    backgroundColor: '#18181b',
    borderColor: '#6666ff',
    borderWidth: 1,
    borderRadius: 8,
    color: '#fff',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#232336',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  rank: {
    color: '#a1a1aa',
    fontWeight: 'bold',
    width: 32,
    textAlign: 'right',
    fontSize: 16,
    marginRight: 8,
  },
  name: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 18,
  },
  meta: {
    color: '#a1a1aa',
    fontSize: 14,
    marginTop: 2,
    textAlign: 'left',
    alignSelf: 'flex-start',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    flex: 1,
    backgroundColor: '#232336',
    width: '100%',
    maxWidth: '100%',
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    paddingTop: 60,
    paddingHorizontal: 0,
    borderRadius: 0,
  },
  modalTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'left',
    alignSelf: 'flex-start',
    paddingLeft: 20,
  },
  sectionTitle: {
    color: '#f59e0b',
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'left',
    alignSelf: 'flex-start',
    paddingLeft: 20,
  },
  statGrid: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
    paddingVertical: 8,
  },
  statCell: {
    width: '33.33%',
    alignItems: 'center',
    marginBottom: 12,
    paddingVertical: 6,
  },
  statLabel: {
    color: '#a1a1aa',
    fontSize: 13,
    marginBottom: 2,
    textAlign: 'center',
  },
  statValue: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 18,
    textAlign: 'center',
  },
  closeIconFilters: {
    position: 'absolute',
    top: 18,
    right: 18,
    zIndex: 10,
    padding: 8,
  },
  closeIconStats: {
    position: 'absolute',
    top: 60,
    right: 18,
    zIndex: 10,
    padding: 8,
  },
  closeIconText: {
    color: '#fff',
    fontSize: 28,
    fontWeight: 'bold',
  },
  filterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    marginBottom: 30,
  },
  filterItem: {
    flex: 1,
    marginRight: 8,
    minWidth: 0,
    marginBottom: 20,
  },
  filterLabel: {
    color: '#a1a1aa',
    fontSize: 13,
    marginBottom: 2,
  },
  dropdown: {
    backgroundColor: '#18181b',
    borderColor: '#6666ff',
    borderRadius: 8,
    minWidth: 0,
  },
  points: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 18,
    marginLeft: 8,
    width: 60,
    textAlign: 'right',
  },
  statsDivider: {
    height: 1,
    backgroundColor: '#fff',
    opacity: 1,
    marginVertical: 12,
    marginLeft: 0,
    marginRight: 0,
    width: '90%',
    alignSelf: 'center',
  },
  filtersDivider: {
    height: 1,
    backgroundColor: '#fff',
    opacity: 1,
    marginVertical: 12,
    marginLeft: 0,
    marginRight: 0,
    width: '100%',
    alignSelf: 'center',
  },
  modalMeta: {
    paddingLeft: 20,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    backgroundColor: '#18181b',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    zIndex: 50,
  },
  filterButton: {
    backgroundColor: '#18181b',
    borderColor: '#6666ff',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
  },
  filterButtonText: {
    color: '#6666ff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  filterPanel: {
    backgroundColor: '#232336',
    borderRadius: 8,
    padding: 8,
    borderColor: '#6666ff',
    borderWidth: 1,
    zIndex: 2,
    minHeight: 150,
    flexDirection: 'column',
  },
  rowEven: {
    backgroundColor: '#232336',
  },
  rowOdd: {
    backgroundColor: '#18181b',
  },
  filterModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  filterModalContent: {
    backgroundColor: '#232336',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 30, // reduced from 60
    paddingHorizontal: 20,
    paddingBottom: 60, // increased from 40
    minHeight: 500,
    width: '100%',
    alignItems: 'flex-start',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 2,
  },
  filterModalTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 5,
    textAlign: 'left',
    alignSelf: 'flex-start',
  },
  filterModalScroll: {
    width: '100%',
  },
  filterModalItem: {
    width: '100%',
    marginBottom: 8,
  },
  pickerWheelContainer: {
    backgroundColor: '#18181b',
    borderRadius: 8,
    borderColor: '#6666ff',
    borderWidth: 1,
    marginBottom: 16,
  },
  pickerWheel: {
    color: '#fff',
    width: '100%',
    height: 44,
  },
  pickerWheelItem: {
    color: '#fff',
    fontSize: 18,
  },
  toggleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  toggleButton: {
    backgroundColor: '#18181b',
    borderColor: '#6666ff',
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginRight: 8,
    marginBottom: 8,
  },
  toggleButtonActive: {
    backgroundColor: '#6666ff',
    borderColor: '#6666ff',
  },
  toggleButtonText: {
    color: '#fff',
    fontSize: 15,
  },
  toggleButtonTextActive: {
    color: '#18181b',
    fontWeight: 'bold',
  },
  sortToggleRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  sortToggleButton: {
    backgroundColor: '#18181b',
    borderColor: '#6666ff',
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
  },
  sortToggleButtonActive: {
    backgroundColor: '#6666ff',
    borderColor: '#6666ff',
  },
  sortToggleButtonText: {
    color: '#fff',
    fontSize: 15,
  },
  sortToggleButtonTextActive: {
    color: '#18181b',
    fontWeight: 'bold',
  },
  weekScroll: {
    flexDirection: 'row',
    marginTop: 8,
    marginBottom: 8,
    minHeight: 44,
  },
  teamLogoChip: {
    backgroundColor: '#18181b',
    borderColor: '#6666ff',
    borderWidth: 1,
    borderRadius: 24,
    marginRight: 8,
    marginBottom: 8,
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  teamLogoChipActive: {
    backgroundColor: '#6666ff',
    borderColor: '#6666ff',
  },
  teamLogoImg: {
    width: 32,
    height: 32,
  },
  avgPoints: {
    color: '#a1a1aa',
    fontSize: 13,
    textAlign: 'right',
    marginTop: 2,
  },
  pointsCol: {
    flexDirection: 'column',
    alignItems: 'flex-end',
    minWidth: 60,
  },
  filterIcon: {
    color: '#6666ff',
    fontSize: 22,
    fontWeight: 'bold',
  },
  instantOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    zIndex: 1,
  },
  clearSearchIcon: {
    position: 'absolute',
    right: 10,
    top: '50%',
    marginTop: -10,
    zIndex: 2,
  },
}); 