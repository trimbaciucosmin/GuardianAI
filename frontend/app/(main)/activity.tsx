import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Mock data for activity timeline
const mockTimeline = [
  { id: '1', type: 'arrival', title: 'Emma arrived at School', time: '8:15 AM', icon: 'school', color: '#10B981' },
  { id: '2', type: 'departure', title: 'Jake left Home', time: '8:30 AM', icon: 'home', color: '#6366F1' },
  { id: '3', type: 'arrival', title: 'Jake arrived at School', time: '8:52 AM', icon: 'school', color: '#10B981' },
  { id: '4', type: 'screen', title: 'Emma exceeded screen time', time: '2:30 PM', icon: 'phone-portrait', color: '#F59E0B' },
  { id: '5', type: 'arrival', title: 'Emma arrived at Home', time: '3:45 PM', icon: 'home', color: '#10B981' },
];

// Calculate safety score based on mock data
const calculateSafetyScore = () => {
  // Mock calculation
  const arrivedSchool = true; // +20
  const arrivedHome = true; // +20
  const noRouteDeviations = true; // +20
  const noSOS = true; // +20
  const screenTimeLimitOK = false; // +20
  
  let score = 0;
  if (arrivedSchool) score += 20;
  if (arrivedHome) score += 20;
  if (noRouteDeviations) score += 20;
  if (noSOS) score += 20;
  if (screenTimeLimitOK) score += 20;
  
  return score;
};

const getSafetyStatus = (score: number) => {
  if (score >= 80) return { label: 'Safe', color: '#10B981' };
  if (score >= 50) return { label: 'Attention', color: '#F59E0B' };
  return { label: 'Risk', color: '#EF4444' };
};

export default function ActivityScreen() {
  const insets = useSafeAreaInsets();
  const [selectedDay, setSelectedDay] = useState('Today');
  const safetyScore = calculateSafetyScore();
  const safetyStatus = getSafetyStatus(safetyScore);

  const days = ['Today', 'Yesterday', 'This Week'];
  
  // Tab bar height
  const tabBarHeight = 60 + insets.bottom;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Text style={styles.title}>Activity</Text>
        <Text style={styles.subtitle}>Daily Safety Report</Text>
      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: tabBarHeight + 16 }}
      >
        {/* Safety Score Card */}
        <View style={styles.scoreCard}>
          <View style={styles.scoreHeader}>
            <Text style={styles.scoreLabel}>Family Safety Score</Text>
            <View style={[styles.statusBadge, { backgroundColor: safetyStatus.color }]}>
              <Text style={styles.statusText}>{safetyStatus.label}</Text>
            </View>
          </View>
          
          <View style={styles.scoreDisplay}>
            <Text style={[styles.scoreNumber, { color: safetyStatus.color }]}>{safetyScore}</Text>
            <Text style={styles.scoreMax}>/100</Text>
          </View>

          {/* Score Breakdown */}
          <View style={styles.scoreBreakdown}>
            <View style={styles.scoreItem}>
              <Ionicons name="checkmark-circle" size={20} color="#10B981" />
              <Text style={styles.scoreItemText}>School arrival</Text>
            </View>
            <View style={styles.scoreItem}>
              <Ionicons name="checkmark-circle" size={20} color="#10B981" />
              <Text style={styles.scoreItemText}>Home arrival</Text>
            </View>
            <View style={styles.scoreItem}>
              <Ionicons name="checkmark-circle" size={20} color="#10B981" />
              <Text style={styles.scoreItemText}>No route issues</Text>
            </View>
            <View style={styles.scoreItem}>
              <Ionicons name="checkmark-circle" size={20} color="#10B981" />
              <Text style={styles.scoreItemText}>No SOS events</Text>
            </View>
            <View style={styles.scoreItem}>
              <Ionicons name="alert-circle" size={20} color="#F59E0B" />
              <Text style={styles.scoreItemText}>Screen time exceeded</Text>
            </View>
          </View>
        </View>

        {/* Quick Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Ionicons name="enter" size={24} color="#10B981" />
            <Text style={styles.statNumber}>4</Text>
            <Text style={styles.statLabel}>Arrivals</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="exit" size={24} color="#6366F1" />
            <Text style={styles.statNumber}>3</Text>
            <Text style={styles.statLabel}>Departures</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="alert" size={24} color="#F59E0B" />
            <Text style={styles.statNumber}>1</Text>
            <Text style={styles.statLabel}>Alerts</Text>
          </View>
        </View>

        {/* Day Selector */}
        <View style={styles.daySelector}>
          {days.map((day) => (
            <TouchableOpacity
              key={day}
              style={[styles.dayButton, selectedDay === day && styles.dayButtonActive]}
              onPress={() => setSelectedDay(day)}
            >
              <Text style={[styles.dayText, selectedDay === day && styles.dayTextActive]}>
                {day}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Timeline */}
        <View style={styles.timeline}>
          <Text style={styles.timelineTitle}>Timeline</Text>
          {mockTimeline.map((event, index) => (
            <View key={event.id} style={styles.timelineItem}>
              <View style={styles.timelineLeft}>
                <View style={[styles.timelineIcon, { backgroundColor: `${event.color}20` }]}>
                  <Ionicons name={event.icon as any} size={18} color={event.color} />
                </View>
                {index < mockTimeline.length - 1 && <View style={styles.timelineLine} />}
              </View>
              <View style={styles.timelineContent}>
                <Text style={styles.timelineText}>{event.title}</Text>
                <Text style={styles.timelineTime}>{event.time}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 4,
  },
  scoreCard: {
    backgroundColor: '#1E293B',
    marginHorizontal: 20,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
  },
  scoreHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  scoreLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#94A3B8',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  scoreDisplay: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    marginBottom: 20,
  },
  scoreNumber: {
    fontSize: 72,
    fontWeight: '800',
  },
  scoreMax: {
    fontSize: 24,
    color: '#64748B',
    marginLeft: 4,
  },
  scoreBreakdown: {
    gap: 10,
  },
  scoreItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  scoreItemText: {
    color: '#E2E8F0',
    fontSize: 14,
  },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 4,
  },
  daySelector: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 8,
    marginBottom: 20,
  },
  dayButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#1E293B',
  },
  dayButtonActive: {
    backgroundColor: '#6366F1',
  },
  dayText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94A3B8',
  },
  dayTextActive: {
    color: '#FFFFFF',
  },
  timeline: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  timelineTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  timelineItem: {
    flexDirection: 'row',
  },
  timelineLeft: {
    alignItems: 'center',
    width: 44,
  },
  timelineIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: '#334155',
    marginVertical: 4,
  },
  timelineContent: {
    flex: 1,
    paddingLeft: 12,
    paddingBottom: 20,
  },
  timelineText: {
    fontSize: 15,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  timelineTime: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
  },
});
