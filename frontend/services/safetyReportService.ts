/**
 * Weekly Safety Report Service
 * Generates comprehensive safety statistics for family members
 */

import { supabase } from '../lib/supabase';

export interface SafetyReportData {
  period: {
    startDate: string;
    endDate: string;
    weekNumber: number;
  };
  summary: {
    totalArrivals: number;
    totalDepartures: number;
    totalDeviations: number;
    totalTamperAlerts: number;
    totalSosEvents: number;
    avgResponseTime: number; // in minutes
  };
  placeStats: PlaceStatistics[];
  memberStats: MemberStatistics[];
  deviationDetails: DeviationDetail[];
  tamperDetails: TamperDetail[];
  dailyActivity: DailyActivity[];
  safetyScore: number; // 0-100
  insights: string[];
}

export interface PlaceStatistics {
  placeId: string;
  placeName: string;
  placeType: string;
  totalVisits: number;
  totalTimeSpentMinutes: number;
  avgVisitDuration: number;
  firstVisit: string;
  lastVisit: string;
}

export interface MemberStatistics {
  userId: string;
  name: string;
  totalLocationsRecorded: number;
  totalDistanceTraveled: number; // in meters
  avgBatteryLevel: number;
  onlinePercentage: number;
  mostVisitedPlace: string;
  deviationCount: number;
}

export interface DeviationDetail {
  id: string;
  type: string;
  memberName: string;
  location: string;
  timestamp: string;
  resolved: boolean;
}

export interface TamperDetail {
  id: string;
  eventType: string;
  memberName: string;
  severity: string;
  timestamp: string;
  resolved: boolean;
}

export interface DailyActivity {
  date: string;
  dayOfWeek: string;
  arrivals: number;
  departures: number;
  deviations: number;
  activeMembers: number;
}

/**
 * Get the start and end dates for a given week offset
 * offset: 0 = current week, -1 = last week, etc.
 */
function getWeekDates(offset: number = 0): { start: Date; end: Date; weekNumber: number } {
  const now = new Date();
  const currentDay = now.getDay();
  const mondayOffset = currentDay === 0 ? -6 : 1 - currentDay;
  
  const monday = new Date(now);
  monday.setDate(now.getDate() + mondayOffset + (offset * 7));
  monday.setHours(0, 0, 0, 0);
  
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  
  // Calculate week number
  const startOfYear = new Date(monday.getFullYear(), 0, 1);
  const days = Math.floor((monday.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
  const weekNumber = Math.ceil((days + startOfYear.getDay() + 1) / 7);
  
  return { start: monday, end: sunday, weekNumber };
}

/**
 * Generate weekly safety report for a circle
 */
export async function generateWeeklyReport(
  circleId: string,
  weekOffset: number = 0
): Promise<SafetyReportData | null> {
  try {
    const { start, end, weekNumber } = getWeekDates(weekOffset);
    const startISO = start.toISOString();
    const endISO = end.toISOString();
    
    // Fetch all data in parallel
    const [
      geofenceEvents,
      deviations,
      tamperEvents,
      sosEvents,
      places,
      members
    ] = await Promise.all([
      // Geofence events (arrivals/departures)
      supabase
        .from('geofence_events')
        .select('*')
        .eq('circle_id', circleId)
        .gte('detected_at', startISO)
        .lte('detected_at', endISO)
        .then(r => r.data || []),
      
      // Route deviations
      supabase
        .from('route_deviations')
        .select('*, profiles:user_id(name)')
        .eq('circle_id', circleId)
        .gte('detected_at', startISO)
        .lte('detected_at', endISO)
        .then(r => r.data || []),
      
      // Tamper events
      supabase
        .from('tamper_events')
        .select('*, profiles:user_id(name)')
        .eq('circle_id', circleId)
        .gte('detected_at', startISO)
        .lte('detected_at', endISO)
        .then(r => r.data || []),
      
      // SOS events
      supabase
        .from('sos_events')
        .select('*')
        .eq('circle_id', circleId)
        .gte('created_at', startISO)
        .lte('created_at', endISO)
        .then(r => r.data || []),
      
      // Safe places
      supabase
        .from('places')
        .select('*')
        .eq('circle_id', circleId)
        .eq('is_active', true)
        .then(r => r.data || []),
      
      // Circle members
      supabase
        .from('circle_members')
        .select('*, profiles:user_id(name)')
        .eq('circle_id', circleId)
        .then(r => r.data || [])
    ]);
    
    // Calculate arrivals and departures
    const arrivals = geofenceEvents.filter((e: any) => e.event_type === 'arrival');
    const departures = geofenceEvents.filter((e: any) => e.event_type === 'departure');
    
    // Calculate place statistics
    const placeStats: PlaceStatistics[] = places.map((place: any) => {
      const placeArrivals = arrivals.filter((a: any) => a.place_id === place.id);
      const placeDepartures = departures.filter((d: any) => d.place_id === place.id);
      
      // Estimate time spent (arrival to departure pairs)
      let totalTimeMinutes = 0;
      placeArrivals.forEach((arrival: any) => {
        const matchingDeparture = placeDepartures.find((dep: any) => 
          new Date(dep.detected_at) > new Date(arrival.detected_at) &&
          dep.user_id === arrival.user_id
        );
        if (matchingDeparture) {
          const duration = new Date(matchingDeparture.detected_at).getTime() - 
                          new Date(arrival.detected_at).getTime();
          totalTimeMinutes += duration / (1000 * 60);
        }
      });
      
      return {
        placeId: place.id,
        placeName: place.name,
        placeType: place.category || 'custom',
        totalVisits: placeArrivals.length,
        totalTimeSpentMinutes: Math.round(totalTimeMinutes),
        avgVisitDuration: placeArrivals.length > 0 
          ? Math.round(totalTimeMinutes / placeArrivals.length) 
          : 0,
        firstVisit: placeArrivals.length > 0 
          ? placeArrivals[0].detected_at 
          : '',
        lastVisit: placeArrivals.length > 0 
          ? placeArrivals[placeArrivals.length - 1].detected_at 
          : '',
      };
    });
    
    // Calculate member statistics
    const memberStats: MemberStatistics[] = members
      .filter((m: any) => m.role === 'child')
      .map((member: any) => {
        const memberArrivals = arrivals.filter((a: any) => a.user_id === member.user_id);
        const memberDeviations = deviations.filter((d: any) => d.user_id === member.user_id);
        
        // Find most visited place
        const visitCounts: Record<string, number> = {};
        memberArrivals.forEach((a: any) => {
          visitCounts[a.place_name] = (visitCounts[a.place_name] || 0) + 1;
        });
        const mostVisited = Object.entries(visitCounts)
          .sort(([,a], [,b]) => b - a)[0];
        
        return {
          userId: member.user_id,
          name: member.profiles?.name || 'Unknown',
          totalLocationsRecorded: memberArrivals.length + departures.filter((d: any) => d.user_id === member.user_id).length,
          totalDistanceTraveled: 0, // Would need location history
          avgBatteryLevel: 75, // Would need battery history
          onlinePercentage: 95, // Would need presence data
          mostVisitedPlace: mostVisited ? mostVisited[0] : 'N/A',
          deviationCount: memberDeviations.length,
        };
      });
    
    // Format deviation details
    const deviationDetails: DeviationDetail[] = deviations.map((d: any) => ({
      id: d.id,
      type: d.deviation_type,
      memberName: d.profiles?.name || 'Unknown',
      location: d.address || `${d.latitude?.toFixed(4)}, ${d.longitude?.toFixed(4)}`,
      timestamp: d.detected_at,
      resolved: !!d.resolved_at,
    }));
    
    // Format tamper details
    const tamperDetails: TamperDetail[] = tamperEvents.map((t: any) => ({
      id: t.id,
      eventType: t.event_type,
      memberName: t.profiles?.name || 'Unknown',
      severity: t.severity,
      timestamp: t.detected_at,
      resolved: !!t.resolved_at,
    }));
    
    // Calculate daily activity
    const dailyActivity: DailyActivity[] = [];
    const dayNames = ['Duminică', 'Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri', 'Sâmbătă'];
    
    for (let i = 0; i < 7; i++) {
      const day = new Date(start);
      day.setDate(start.getDate() + i);
      const dayStr = day.toISOString().split('T')[0];
      
      const dayArrivals = arrivals.filter((a: any) => 
        a.detected_at.startsWith(dayStr)
      ).length;
      const dayDepartures = departures.filter((d: any) => 
        d.detected_at.startsWith(dayStr)
      ).length;
      const dayDeviations = deviations.filter((d: any) => 
        d.detected_at.startsWith(dayStr)
      ).length;
      
      dailyActivity.push({
        date: dayStr,
        dayOfWeek: dayNames[day.getDay()],
        arrivals: dayArrivals,
        departures: dayDepartures,
        deviations: dayDeviations,
        activeMembers: memberStats.length,
      });
    }
    
    // Calculate safety score (0-100)
    let safetyScore = 100;
    // Deduct points for deviations
    safetyScore -= Math.min(30, deviations.length * 5);
    // Deduct points for tamper alerts
    safetyScore -= Math.min(20, tamperEvents.length * 3);
    // Deduct points for SOS events
    safetyScore -= Math.min(30, sosEvents.length * 10);
    // Bonus for consistent check-ins
    if (arrivals.length >= 10) safetyScore += 5;
    safetyScore = Math.max(0, Math.min(100, safetyScore));
    
    // Generate insights
    const insights: string[] = [];
    
    if (deviations.length === 0) {
      insights.push('🎉 Nicio deviere de traseu în această săptămână!');
    } else {
      insights.push(`⚠️ ${deviations.length} devieri de traseu detectate.`);
    }
    
    if (tamperEvents.length === 0) {
      insights.push('✅ Nicio alertă de securitate în această săptămână.');
    } else {
      insights.push(`🔒 ${tamperEvents.length} alerte de securitate înregistrate.`);
    }
    
    const mostActivePlace = placeStats.sort((a, b) => b.totalVisits - a.totalVisits)[0];
    if (mostActivePlace && mostActivePlace.totalVisits > 0) {
      insights.push(`📍 Cel mai vizitat loc: ${mostActivePlace.placeName} (${mostActivePlace.totalVisits} vizite)`);
    }
    
    if (arrivals.length + departures.length > 20) {
      insights.push('📊 Activitate ridicată în această săptămână!');
    }
    
    const avgResponseTime = sosEvents.length > 0
      ? sosEvents.reduce((sum: number, e: any) => {
          if (e.resolved_at) {
            return sum + (new Date(e.resolved_at).getTime() - new Date(e.created_at).getTime()) / (1000 * 60);
          }
          return sum;
        }, 0) / sosEvents.filter((e: any) => e.resolved_at).length
      : 0;
    
    return {
      period: {
        startDate: startISO,
        endDate: endISO,
        weekNumber,
      },
      summary: {
        totalArrivals: arrivals.length,
        totalDepartures: departures.length,
        totalDeviations: deviations.length,
        totalTamperAlerts: tamperEvents.length,
        totalSosEvents: sosEvents.length,
        avgResponseTime: Math.round(avgResponseTime),
      },
      placeStats,
      memberStats,
      deviationDetails,
      tamperDetails,
      dailyActivity,
      safetyScore,
      insights,
    };
  } catch (error) {
    console.error('[SafetyReport] Error generating report:', error);
    return null;
  }
}

/**
 * Get safety score color based on value
 */
export function getSafetyScoreColor(score: number): string {
  if (score >= 80) return '#10B981'; // Green
  if (score >= 60) return '#F59E0B'; // Amber
  if (score >= 40) return '#F97316'; // Orange
  return '#EF4444'; // Red
}

/**
 * Get safety score label
 */
export function getSafetyScoreLabel(score: number, language: 'en' | 'ro' = 'ro'): string {
  const labels = {
    en: {
      excellent: 'Excellent',
      good: 'Good',
      fair: 'Fair',
      needsAttention: 'Needs Attention',
    },
    ro: {
      excellent: 'Excelent',
      good: 'Bun',
      fair: 'Acceptabil',
      needsAttention: 'Necesită atenție',
    },
  };
  
  if (score >= 80) return labels[language].excellent;
  if (score >= 60) return labels[language].good;
  if (score >= 40) return labels[language].fair;
  return labels[language].needsAttention;
}

/**
 * Format duration for display
 */
export function formatDuration(minutes: number, language: 'en' | 'ro' = 'ro'): string {
  if (minutes < 60) {
    return language === 'ro' ? `${minutes} min` : `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (language === 'ro') {
    return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
  }
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}
