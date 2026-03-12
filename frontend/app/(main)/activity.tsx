import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

// Safety score configuration with clear labels
const getSafetyConfig = (score: number) => {
  if (score >= 80) {
    return {
      label: 'Safe',
      color: '#10B981',
      bgColor: 'rgba(16, 185, 129, 0.15)',
      icon: 'shield-checkmark',
      message: 'Everything looks great! All family members arrived safely today.',
    };
  } else if (score >= 50) {
    return {
      label: 'Attention',
      color: '#F59E0B',
      bgColor: 'rgba(245, 158, 11, 0.15)',
      icon: 'warning',
      message: 'Some items need your attention. Check the alerts below.',
    };
  } else {
    return {
      label: 'Risk',
      color: '#EF4444',
      bgColor: 'rgba(239, 68, 68, 0.15)',
      icon: 'alert-circle',
      message: 'Immediate attention required. Review the timeline for details.',
    };
  }
};

// Mock data for demonstration
const mockTimeline = [
  {
    id: '1',
    type: 'arrival',
    icon: 'checkmark-circle',
    color: '#10B981',
    title: 'Emma arrived at Home',
    subtitle: 'Safe arrival confirmed',
    time: '3:45 PM',
    isNew: true,
  },
  {
    id: '2',
    type: 'departure',
    icon: 'exit',
    color: '#6366F1',
    title: 'Emma left School',
    subtitle: 'Oak Elementary School',
    time: '3:30 PM',
    isNew: false,
  },
  {
    id: '3',
    type: 'arrival',
    icon: 'checkmark-circle',
    color: '#10B981',
    title: 'Emma arrived at School',
    subtitle: 'On time arrival',
    time: '8:15 AM',
    isNew: false,
  },
  {
    id: '4',
    type: 'departure',
    icon: 'exit',
    color: '#6366F1',
    title: 'Emma left Home',
    subtitle: 'Started trip to school',
    time: '7:55 AM',
    isNew: false,
  },
];

export default function ActivityScreen() {
  const insets = useSafeAreaInsets();
  const [safetyScore] = useState(92);
  const tabBarHeight = 60 + insets.bottom;
  
  const safetyConfig = getSafetyConfig(safetyScore);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Text style={styles.title}>Activity</Text>
        <Text style={styles.date}>Today, December 12</Text>
      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: tabBarHeight + 16 }}
      >
        {/* Safety Score Card */}
        <View style={styles.scoreCard}>
          <View style={styles.scoreHeader}>
            <Text style={styles.scoreTitle}>Daily Safety Score</Text>
            <View style={[styles.scoreBadge, { backgroundColor: safetyConfig.bgColor }]}>
              <Ionicons name={safetyConfig.icon as any} size={16} color={safetyConfig.color} />
              <Text style={[styles.scoreBadgeText, { color: safetyConfig.color }]}>
                {safetyConfig.label}
              </Text>
            </View>
          </View>
          
          <View style={styles.scoreDisplay}>
            <Text style={[styles.scoreNumber, { color: safetyConfig.color }]}>{safetyScore}</Text>
            <Text style={styles.scoreMax}>/100</Text>
          </View>
          
          {/* Score explanation */}
          <View style={[styles.scoreExplanation, { backgroundColor: safetyConfig.bgColor }]}>
            <Ionicons name="information-circle" size={18} color={safetyConfig.color} />
            <Text style={[styles.scoreExplanationText, { color: safetyConfig.color }]}>
              {safetyConfig.message}
            </Text>
          </View>

          {/* Score factors */}
          <View style={styles.scoreFactors}>
            <Text style={styles.factorsTitle}>What affects this score:</Text>
            <View style={styles.factorsList}>
              <View style={styles.factorItem}>
                <Ionicons name="checkmark" size={14} color="#10B981" />
                <Text style={styles.factorText}>School arrival on time</Text>
              </View>
              <View style={styles.factorItem}>
                <Ionicons name="checkmark" size={14} color="#10B981" />
                <Text style={styles.factorText}>Home arrival confirmed</Text>
              </View>
              <View style={styles.factorItem}>
                <Ionicons name="checkmark" size={14} color="#10B981" />
                <Text style={styles.factorText}>No route deviations</Text>
              </View>
              <View style={styles.factorItem}>
                <Ionicons name="checkmark" size={14} color="#10B981" />
                <Text style={styles.factorText}>Battery level healthy</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Quick Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
              <Ionicons name="enter" size={20} color="#10B981" />
            </View>
            <Text style={styles.statNumber}>2</Text>
            <Text style={styles.statLabel}>Arrivals</Text>
          </View>
          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: 'rgba(99, 102, 241, 0.15)' }]}>
              <Ionicons name="exit" size={20} color="#6366F1" />
            </View>
            <Text style={styles.statNumber}>2</Text>
            <Text style={styles.statLabel}>Departures</Text>
          </View>
          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
              <Ionicons name="notifications" size={20} color="#F59E0B" />
            </View>
            <Text style={styles.statNumber}>0</Text>
            <Text style={styles.statLabel}>Alerts</Text>
          </View>
        </View>

        {/* Timeline Section */}
        <View style={styles.timelineSection}>
          <Text style={styles.sectionTitle}>Today's Timeline</Text>
          
          {mockTimeline.map((event, index) => (
            <View key={event.id} style={styles.timelineItem}>
              {/* Timeline connector */}
              {index < mockTimeline.length - 1 && (
                <View style={styles.timelineConnector} />
              )}
              
              {/* Event icon */}
              <View style={[styles.eventIcon, { backgroundColor: `${event.color}20` }]}>
                <Ionicons name={event.icon as any} size={20} color={event.color} />
              </View>
              
              {/* Event content */}
              <View style={styles.eventContent}>
                <View style={styles.eventHeader}>
                  <Text style={styles.eventTitle}>{event.title}</Text>
                  {event.isNew && (
                    <View style={styles.newBadge}>
                      <Text style={styles.newBadgeText}>NEW</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.eventSubtitle}>{event.subtitle}</Text>
              </View>
              
              {/* Time */}
              <Text style={styles.eventTime}>{event.time}</Text>
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
    paddingBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  date: {
    fontSize: 14,
    color: '#64748B',
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
    marginBottom: 12,
  },
  scoreTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#94A3B8',
  },
  scoreBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  scoreBadgeText: {
    fontSize: 14,
    fontWeight: '700',
  },
  scoreDisplay: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 16,
  },
  scoreNumber: {
    fontSize: 64,
    fontWeight: '800',
  },
  scoreMax: {
    fontSize: 24,
    fontWeight: '600',
    color: '#64748B',
    marginLeft: 4,
  },
  scoreExplanation: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    gap: 10,
    marginBottom: 16,
  },
  scoreExplanationText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },
  scoreFactors: {
    borderTopWidth: 1,
    borderTopColor: '#334155',
    paddingTop: 16,
  },
  factorsTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  factorsList: {
    gap: 8,
  },
  factorItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  factorText: {
    fontSize: 13,
    color: '#94A3B8',
  },
  statsRow: {
    flexDirection: 'row',
    marginHorizontal: 20,
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  statLabel: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  timelineSection: {
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
    position: 'relative',
  },
  timelineConnector: {
    position: 'absolute',
    left: 20,
    top: 44,
    bottom: -16,
    width: 2,
    backgroundColor: '#334155',
  },
  eventIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  eventContent: {
    flex: 1,
    paddingTop: 2,
  },
  eventHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  eventTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  newBadge: {
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  newBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#818CF8',
  },
  eventSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  eventTime: {
    fontSize: 12,
    color: '#64748B',
    paddingTop: 4,
  },
});
