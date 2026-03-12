import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { useAuthStore, useCircleStore } from '../../lib/store';

// Mock family data
const mockFamily = {
  name: 'Smith Family',
  inviteCode: 'FAM123',
  members: [
    { id: '1', name: 'Sarah', role: 'parent', status: 'online', isAdmin: true },
    { id: '2', name: 'Mike', role: 'parent', status: 'online', isAdmin: true },
    { id: '3', name: 'Emma', role: 'child', status: 'online', age: 12 },
    { id: '4', name: 'Jake', role: 'child', status: 'online', age: 8 },
  ],
  places: [
    { id: '1', name: 'Home', type: 'home', address: '123 Main St' },
    { id: '2', name: 'School', type: 'school', address: 'Oak Elementary' },
  ],
};

export default function FamilyScreen() {
  const router = useRouter();
  const { profile, setUser, setProfile } = useAuthStore();
  const [showInviteCode, setShowInviteCode] = useState(false);

  const handleLogout = async () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await supabase.auth.signOut();
            setUser(null);
            setProfile(null);
            router.replace('/(auth)/login');
          }
        }
      ]
    );
  };

  const copyInviteCode = () => {
    Alert.alert('Invite Code', mockFamily.inviteCode, [
      { text: 'OK' }
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Family</Text>
        <TouchableOpacity style={styles.settingsButton} onPress={() => router.push('/settings')}>
          <Ionicons name="settings-outline" size={24} color="#94A3B8" />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Family Card */}
        <View style={styles.familyCard}>
          <View style={styles.familyHeader}>
            <View style={styles.familyIcon}>
              <Ionicons name="shield-checkmark" size={32} color="#6366F1" />
            </View>
            <View style={styles.familyInfo}>
              <Text style={styles.familyName}>{mockFamily.name}</Text>
              <Text style={styles.familyCount}>{mockFamily.members.length} members</Text>
            </View>
          </View>
          
          {/* Invite Button */}
          <TouchableOpacity style={styles.inviteButton} onPress={copyInviteCode}>
            <Ionicons name="person-add" size={20} color="#6366F1" />
            <Text style={styles.inviteText}>Invite Family Member</Text>
          </TouchableOpacity>
        </View>

        {/* Members Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Members</Text>
          {mockFamily.members.map((member) => (
            <TouchableOpacity key={member.id} style={styles.memberCard}>
              <View style={styles.memberAvatar}>
                <Text style={styles.memberInitial}>{member.name[0]}</Text>
                <View style={[
                  styles.statusDot,
                  { backgroundColor: member.status === 'online' ? '#10B981' : '#64748B' }
                ]} />
              </View>
              <View style={styles.memberInfo}>
                <View style={styles.memberNameRow}>
                  <Text style={styles.memberName}>{member.name}</Text>
                  {member.isAdmin && (
                    <View style={styles.adminBadge}>
                      <Text style={styles.adminText}>Admin</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.memberRole}>
                  {member.role === 'parent' ? 'Parent' : `Child${member.age ? ` • ${member.age} years` : ''}`}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#64748B" />
            </TouchableOpacity>
          ))}
        </View>

        {/* Safe Places Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Safe Places</Text>
            <TouchableOpacity style={styles.addButton} onPress={() => router.push('/place/create')}>
              <Ionicons name="add-circle" size={24} color="#6366F1" />
            </TouchableOpacity>
          </View>
          {mockFamily.places.map((place) => (
            <TouchableOpacity key={place.id} style={styles.placeCard}>
              <View style={[
                styles.placeIcon,
                { backgroundColor: place.type === 'home' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(99, 102, 241, 0.15)' }
              ]}>
                <Ionicons 
                  name={place.type === 'home' ? 'home' : 'school'} 
                  size={22} 
                  color={place.type === 'home' ? '#10B981' : '#6366F1'} 
                />
              </View>
              <View style={styles.placeInfo}>
                <Text style={styles.placeName}>{place.name}</Text>
                <Text style={styles.placeAddress}>{place.address}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#64748B" />
            </TouchableOpacity>
          ))}
        </View>

        {/* Quick Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Settings</Text>
          
          <TouchableOpacity style={styles.settingCard}>
            <View style={[styles.settingIcon, { backgroundColor: 'rgba(99, 102, 241, 0.15)' }]}>
              <Ionicons name="notifications" size={22} color="#6366F1" />
            </View>
            <View style={styles.settingInfo}>
              <Text style={styles.settingName}>Notifications</Text>
              <Text style={styles.settingDescription}>Manage alert preferences</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#64748B" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.settingCard}>
            <View style={[styles.settingIcon, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
              <Ionicons name="shield" size={22} color="#10B981" />
            </View>
            <View style={styles.settingInfo}>
              <Text style={styles.settingName}>Privacy</Text>
              <Text style={styles.settingDescription}>Location sharing settings</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#64748B" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.settingCard}>
            <View style={[styles.settingIcon, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
              <Ionicons name="help-circle" size={22} color="#F59E0B" />
            </View>
            <View style={styles.settingInfo}>
              <Text style={styles.settingName}>Help & Support</Text>
              <Text style={styles.settingDescription}>FAQs and contact</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#64748B" />
          </TouchableOpacity>
        </View>

        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out" size={22} color="#EF4444" />
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  settingsButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  familyCard: {
    backgroundColor: '#1E293B',
    marginHorizontal: 20,
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
  },
  familyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  familyIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  familyInfo: {
    marginLeft: 16,
  },
  familyName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  familyCount: {
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 2,
  },
  inviteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    borderRadius: 12,
    paddingVertical: 14,
    gap: 10,
  },
  inviteText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6366F1',
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  addButton: {
    marginBottom: 12,
  },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  memberAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#6366F1',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  memberInitial: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
  },
  statusDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#1E293B',
  },
  memberInfo: {
    flex: 1,
    marginLeft: 12,
  },
  memberNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  adminBadge: {
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  adminText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#6366F1',
  },
  memberRole: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 2,
  },
  placeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  placeIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeInfo: {
    flex: 1,
    marginLeft: 12,
  },
  placeName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  placeAddress: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 2,
  },
  settingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  settingIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingInfo: {
    flex: 1,
    marginLeft: 12,
  },
  settingName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  settingDescription: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    marginHorizontal: 20,
    borderRadius: 12,
    paddingVertical: 16,
    gap: 10,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#EF4444',
  },
});
