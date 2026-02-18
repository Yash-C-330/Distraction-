import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BarChart } from 'react-native-gifted-charts';

const EXPO_PUBLIC_BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
const screenWidth = Dimensions.get('window').width;

interface Stats {
  totalHours: number;
  sessionsCount: number;
  currentStreak: number;
  weeklyData: number[];
}

export default function StatsScreen() {
  const [stats, setStats] = useState<Stats>({
    totalHours: 0,
    sessionsCount: 0,
    currentStreak: 0,
    weeklyData: [0, 0, 0, 0, 0, 0, 0],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchStats = async () => {
    try {
      const response = await fetch(
        `${EXPO_PUBLIC_BACKEND_URL}/api/stats?userId=default_user`
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch stats');
      }

      const data = await response.json();
      setStats({
        totalHours: data.totalHours || 0,
        sessionsCount: data.sessionsCount || 0,
        currentStreak: data.currentStreak || 0,
        weeklyData: data.weeklyData || [0, 0, 0, 0, 0, 0, 0],
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatHours = (hours: number) => {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  };

  const chartData = [
    { value: stats.weeklyData[0], label: 'Mon', frontColor: '#64B5F6' },
    { value: stats.weeklyData[1], label: 'Tue', frontColor: '#64B5F6' },
    { value: stats.weeklyData[2], label: 'Wed', frontColor: '#64B5F6' },
    { value: stats.weeklyData[3], label: 'Thu', frontColor: '#64B5F6' },
    { value: stats.weeklyData[4], label: 'Fri', frontColor: '#64B5F6' },
    { value: stats.weeklyData[5], label: 'Sat', frontColor: '#4A90E2' },
    { value: stats.weeklyData[6], label: 'Sun', frontColor: '#4A90E2' },
  ];

  const maxValue = Math.max(...stats.weeklyData, 1);

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4A90E2" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Your Progress</Text>
            <Text style={styles.subtitle}>Keep up the great work!</Text>
          </View>

          {/* Stats Cards */}
          <View style={styles.statsGrid}>
            <View style={[styles.statCard, styles.statCardPrimary]}>
              <Ionicons name="time" size={32} color="#FFFFFF" />
              <Text style={styles.statValue}>{formatHours(stats.totalHours)}</Text>
              <Text style={styles.statLabel}>Total Focus Time</Text>
            </View>

            <View style={styles.statCard}>
              <Ionicons name="checkmark-circle" size={32} color="#4A90E2" />
              <Text style={[styles.statValue, styles.statValueSecondary]}>
                {stats.sessionsCount}
              </Text>
              <Text style={[styles.statLabel, styles.statLabelSecondary]}>
                Sessions Completed
              </Text>
            </View>
          </View>

          {/* Streak Card */}
          <View style={styles.streakCard}>
            <View style={styles.streakIconContainer}>
              <Ionicons name="flame" size={40} color="#FF6B6B" />
            </View>
            <View style={styles.streakContent}>
              <Text style={styles.streakValue}>{stats.currentStreak} Days</Text>
              <Text style={styles.streakLabel}>Current Streak</Text>
            </View>
            {stats.currentStreak > 0 && (
              <View style={styles.streakBadge}>
                <Ionicons name="trophy" size={24} color="#FFD700" />
              </View>
            )}
          </View>

          {/* Weekly Chart */}
          <View style={styles.chartContainer}>
            <Text style={styles.chartTitle}>Weekly Focus Time</Text>
            <Text style={styles.chartSubtitle}>Hours per day</Text>
            
            <View style={styles.chartWrapper}>
              <BarChart
                data={chartData}
                width={screenWidth - 80}
                height={200}
                barWidth={32}
                barBorderRadius={8}
                noOfSections={4}
                maxValue={maxValue}
                yAxisThickness={0}
                xAxisThickness={1}
                xAxisColor="#E3F2FD"
                yAxisTextStyle={{ color: '#7f8c8d', fontSize: 12 }}
                xAxisLabelTextStyle={{ color: '#7f8c8d', fontSize: 12 }}
                hideRules
                spacing={16}
                isAnimated
                animationDuration={800}
              />
            </View>
          </View>

          {/* Motivational Message */}
          {stats.currentStreak >= 7 && (
            <View style={styles.achievementCard}>
              <Ionicons name="star" size={32} color="#FFD700" />
              <View style={styles.achievementContent}>
                <Text style={styles.achievementTitle}>Amazing!</Text>
                <Text style={styles.achievementText}>
                  You've maintained a {stats.currentStreak}-day streak. Keep it up!
                </Text>
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F5F9FC',
  },
  scrollContent: {
    flexGrow: 1,
  },
  container: {
    flex: 1,
    padding: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    marginTop: 20,
    marginBottom: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#2C3E50',
  },
  subtitle: {
    fontSize: 16,
    color: '#7f8c8d',
    marginTop: 4,
  },
  statsGrid: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E3F2FD',
  },
  statCardPrimary: {
    backgroundColor: '#4A90E2',
    borderColor: '#4A90E2',
  },
  statValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginTop: 12,
  },
  statValueSecondary: {
    color: '#2C3E50',
  },
  statLabel: {
    fontSize: 12,
    color: '#FFFFFF',
    marginTop: 4,
    textAlign: 'center',
  },
  statLabelSecondary: {
    color: '#7f8c8d',
  },
  streakCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 2,
    borderColor: '#FFE5E5',
  },
  streakIconContainer: {
    marginRight: 16,
  },
  streakContent: {
    flex: 1,
  },
  streakValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2C3E50',
  },
  streakLabel: {
    fontSize: 14,
    color: '#7f8c8d',
    marginTop: 2,
  },
  streakBadge: {
    marginLeft: 12,
  },
  chartContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#E3F2FD',
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2C3E50',
    marginBottom: 4,
  },
  chartSubtitle: {
    fontSize: 14,
    color: '#7f8c8d',
    marginBottom: 20,
  },
  chartWrapper: {
    alignItems: 'center',
  },
  achievementCard: {
    flexDirection: 'row',
    backgroundColor: '#FFF9E6',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFD700',
  },
  achievementContent: {
    flex: 1,
    marginLeft: 16,
  },
  achievementTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2C3E50',
  },
  achievementText: {
    fontSize: 14,
    color: '#7f8c8d',
    marginTop: 4,
    lineHeight: 20,
  },
});
