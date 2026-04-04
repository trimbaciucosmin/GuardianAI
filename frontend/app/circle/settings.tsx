import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  Share,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { useAuthStore, useCircleStore } from '../../lib/store';
import { useLanguage } from '../../lib/i18n';
import {
  FamilyRole,
  SetupStatus,
  validateCircleDelete,
  validateLeaveCircle,
  CircleMemberInfo,
} from '../../lib/familyRoles';

export default function CircleSettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const { currentCircle, setCurrentCircle, setCircles } = useCircleStore();
  const { t, language } = useLanguage();
  const lang = language as 'en' | 'ro';

  const [isLoading, setIsLoading] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [newCircleName, setNewCircleName] = useState(currentCircle?.name || '');
  const [showInviteCode, setShowInviteCode] = useState(false);
  const [currentUserRole, setCurrentUserRole] = useState<FamilyRole>('parent');
  const [allMembers, setAllMembers] = useState<CircleMemberInfo[]>([]);

  useEffect(() => {
    setNewCircleName(currentCircle?.name || '');
    loadCircleData();
  }, [currentCircle?.name]);

  const loadCircleData = async () => {
    if (!currentCircle?.id || !user?.id) return;

    try {
      // Get current user's role
      const { data: memberData } = await supabase
        .from('circle_members')
        .select('role')
        .eq('circle_id', currentCircle.id)
        .eq('user_id', user.id)
        .single();

      if (memberData) {
        setCurrentUserRole(memberData.role as FamilyRole);
      }

      // Get all members for validation
      const { data: membersData } = await supabase
        .from('circle_members')
        .select(`id, user_id, role, profiles:user_id (id)`)
        .eq('circle_id', currentCircle.id);

      if (membersData) {
        const membersInfo: CircleMemberInfo[] = membersData.map((m: any) => ({
          id: m.id,
          userId: m.user_id,
          role: m.role as FamilyRole,
          setupStatus: m.profiles?.id ? 'active' : 'invited' as SetupStatus,
        }));
        setAllMembers(membersInfo);
      }
    } catch (error) {
      console.error('Load circle data error:', error);
    }
  };

  // Rename circle
  const handleRenameCircle = async () => {
    if (!currentCircle?.id || !newCircleName.trim()) {
      Alert.alert('Error', 'Please enter a valid name');
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('family_circles')
        .update({ name: newCircleName.trim() })
        .eq('id', currentCircle.id);

      if (error) throw error;

      setCurrentCircle({ ...currentCircle, name: newCircleName.trim() });
      setEditingName(false);
      Alert.alert('Success', 'Circle name updated!');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update circle name');
    } finally {
      setIsLoading(false);
    }
  };

  // Generate new invite code
  const handleRegenerateCode = async () => {
    if (!currentCircle?.id) return;

    Alert.alert(
      'Regenerate Code',
      'This will invalidate the current invite code. Anyone with the old code won\'t be able to join.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Regenerate',
          onPress: async () => {
            setIsLoading(true);
            try {
              const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
              let newCode = '';
              for (let i = 0; i < 6; i++) {
                newCode += chars.charAt(Math.floor(Math.random() * chars.length));
              }

              const { error } = await supabase
                .from('family_circles')
                .update({ invite_code: newCode })
                .eq('id', currentCircle.id);

              if (error) throw error;

              setCurrentCircle({ ...currentCircle, invite_code: newCode });
              Alert.alert('Success', `New invite code: ${newCode}`);
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to regenerate code');
            } finally {
              setIsLoading(false);
            }
          }
        }
      ]
    );
  };

  // Share invite
  const handleShareCircle = async () => {
    if (!currentCircle?.invite_code) {
      Alert.alert('Error', 'No invite code available');
      return;
    }

    try {
      await Share.share({
        message: `Join my family circle "${currentCircle.name}" on Guardian AI!\n\nInvite code: ${currentCircle.invite_code}\n\nDownload the app and use this code to join our family circle.`,
      });
    } catch (error) {
      Alert.alert('Invite Code', currentCircle.invite_code);
    }
  };

  // Leave circle
  const handleLeaveCircle = async () => {
    if (!currentCircle?.id || !user?.id) return;

    // Validate leave action
    const currentMember = allMembers.find(m => m.userId === user.id);
    if (!currentMember) return;

    const validation = validateLeaveCircle(allMembers, currentMember);
    
    if (!validation.canRemove) {
      Alert.alert(
        lang === 'ro' ? 'Acțiune interzisă' : 'Action Not Allowed',
        lang === 'ro' ? validation.reasonRo : validation.reason
      );
      return;
    }

    Alert.alert(
      lang === 'ro' ? 'Părăsește cercul' : 'Leave Circle',
      lang === 'ro' 
        ? 'Ești sigur că vrei să părăsești acest cerc? Nu vei mai primi alerte sau vedea locațiile familiei.'
        : 'Are you sure you want to leave this family circle? You will no longer receive alerts or see family locations.',
      [
        { text: lang === 'ro' ? 'Anulează' : 'Cancel', style: 'cancel' },
        {
          text: lang === 'ro' ? 'Părăsește' : 'Leave',
          style: 'destructive',
          onPress: async () => {
            setIsLoading(true);
            try {
              const { error } = await supabase
                .from('circle_members')
                .delete()
                .eq('circle_id', currentCircle.id)
                .eq('user_id', user.id);

              if (error) throw error;

              setCurrentCircle(null);
              setCircles([]);
              Alert.alert(lang === 'ro' ? 'Succes' : 'Success', lang === 'ro' ? 'Ai părăsit cercul' : 'You have left the circle');
              router.replace('/(main)/family');
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to leave circle');
            } finally {
              setIsLoading(false);
            }
          }
        }
      ]
    );
  };

  // Delete circle (admin only)
  const handleDeleteCircle = async () => {
    if (!currentCircle?.id) return;

    // Validate delete action
    const validation = validateCircleDelete(allMembers, currentUserRole);
    
    if (!validation.canDelete) {
      Alert.alert(
        lang === 'ro' ? 'Acțiune interzisă' : 'Action Not Allowed',
        lang === 'ro' ? validation.reasonRo : validation.reason
      );
      return;
    }

    // First confirmation
    Alert.alert(
      lang === 'ro' ? 'Șterge cercul' : 'Delete Circle',
      lang === 'ro' 
        ? `Ești sigur că vrei să ștergi acest cerc?\n\n${validation.reasonRo || 'Această acțiune nu poate fi anulată.'}`
        : `Are you sure you want to delete this family circle?\n\n${validation.reason || 'This action cannot be undone.'}`,
      [
        { text: lang === 'ro' ? 'Anulează' : 'Cancel', style: 'cancel' },
        {
          text: lang === 'ro' ? 'Continuă' : 'Continue',
          style: 'destructive',
          onPress: () => {
            // Second confirmation (double confirm)
            Alert.alert(
              lang === 'ro' ? 'Confirmare finală' : 'Final Confirmation',
              lang === 'ro' 
                ? 'ATENȚIE: Toate datele vor fi șterse permanent, inclusiv locurile sigure și istoricul. Scrie "ȘTERGE" pentru a confirma.'
                : 'WARNING: All data will be permanently deleted including safe places and history. Type "DELETE" to confirm.',
              [
                { text: lang === 'ro' ? 'Anulează' : 'Cancel', style: 'cancel' },
                {
                  text: lang === 'ro' ? 'DA, ȘTERGE TOT' : 'YES, DELETE ALL',
                  style: 'destructive',
                  onPress: executeDeleteCircle,
                },
              ]
            );
          }
        }
      ]
    );
  };

  const executeDeleteCircle = async () => {
    if (!currentCircle?.id) return;
    
    setIsLoading(true);
    try {
      // Delete all members first
      await supabase
        .from('circle_members')
        .delete()
        .eq('circle_id', currentCircle.id);

      // Delete all places
      await supabase
        .from('places')
        .delete()
        .eq('circle_id', currentCircle.id);

      // Delete circle
      const { error } = await supabase
        .from('family_circles')
        .delete()
        .eq('id', currentCircle.id);

      if (error) throw error;

      setCurrentCircle(null);
      setCircles([]);
      Alert.alert(lang === 'ro' ? 'Succes' : 'Success', lang === 'ro' ? 'Cercul a fost șters' : 'Circle deleted');
      router.replace('/(main)/family');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to delete circle');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Circle Settings</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Circle Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Circle Information</Text>
          
          {/* Circle Name */}
          <View style={styles.settingCard}>
            <View style={styles.settingIcon}>
              <Ionicons name="people" size={24} color="#6366F1" />
            </View>
            <View style={styles.settingContent}>
              <Text style={styles.settingLabel}>Circle Name</Text>
              {editingName ? (
                <View style={styles.editNameContainer}>
                  <TextInput
                    style={styles.nameInput}
                    value={newCircleName}
                    onChangeText={setNewCircleName}
                    placeholder="Enter circle name"
                    placeholderTextColor="#64748B"
                    autoFocus
                  />
                  <View style={styles.editActions}>
                    <TouchableOpacity 
                      style={styles.cancelEditBtn}
                      onPress={() => {
                        setEditingName(false);
                        setNewCircleName(currentCircle?.name || '');
                      }}
                    >
                      <Text style={{ color: '#94A3B8', fontSize: 14, fontWeight: '600' }}>
                        {lang === 'ro' ? 'Anulează' : 'Cancel'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={styles.saveEditBtn}
                      onPress={handleRenameCircle}
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '700' }}>
                          {lang === 'ro' ? 'Salvează' : 'Save'}
                        </Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View style={styles.nameRow}>
                  <Text style={styles.settingValue}>{currentCircle?.name || 'My Family'}</Text>
                  <TouchableOpacity onPress={() => setEditingName(true)}>
                    <Ionicons name="create-outline" size={20} color="#6366F1" />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>

          {/* Created Date */}
          <View style={styles.settingCard}>
            <View style={styles.settingIcon}>
              <Ionicons name="calendar" size={24} color="#10B981" />
            </View>
            <View style={styles.settingContent}>
              <Text style={styles.settingLabel}>Created</Text>
              <Text style={styles.settingValue}>
                {currentCircle?.created_at 
                  ? new Date(currentCircle.created_at).toLocaleDateString()
                  : 'Unknown'}
              </Text>
            </View>
          </View>
        </View>

        {/* Invite Code Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Invite Code</Text>
          
          <TouchableOpacity 
            style={styles.inviteCodeCard}
            onPress={() => setShowInviteCode(!showInviteCode)}
          >
            <View style={styles.inviteCodeHeader}>
              <View style={styles.inviteCodeIcon}>
                <Ionicons name="key" size={24} color="#F59E0B" />
              </View>
              <View style={styles.inviteCodeInfo}>
                <Text style={styles.inviteCodeLabel}>Circle Invite Code</Text>
                <Text style={styles.inviteCodeHint}>Tap to {showInviteCode ? 'hide' : 'reveal'}</Text>
              </View>
              <Ionicons 
                name={showInviteCode ? "eye-off" : "eye"} 
                size={22} 
                color="#64748B" 
              />
            </View>
            
            {showInviteCode && (
              <View style={styles.inviteCodeDisplay}>
                <Text style={styles.inviteCodeValue}>{currentCircle?.invite_code || '------'}</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Invite Actions */}
          <View style={styles.inviteActions}>
            <TouchableOpacity style={styles.inviteActionBtn} onPress={handleShareCircle}>
              <Ionicons name="share-social" size={20} color="#6366F1" />
              <Text style={styles.inviteActionText}>Share</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.inviteActionBtn} onPress={handleRegenerateCode}>
              <Ionicons name="refresh" size={20} color="#6366F1" />
              <Text style={styles.inviteActionText}>Regenerate</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>

          <TouchableOpacity 
            style={styles.actionCard}
            onPress={() => router.push('/circle/manage-member')}
          >
            <View style={[styles.actionIcon, { backgroundColor: 'rgba(99, 102, 241, 0.15)' }]}>
              <Ionicons name="person-add" size={22} color="#6366F1" />
            </View>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Add Family Member</Text>
              <Text style={styles.actionDesc}>Invite child, parent, or guardian</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#64748B" />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.actionCard}
            onPress={() => router.push('/circle/join')}
          >
            <View style={[styles.actionIcon, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
              <Ionicons name="enter" size={22} color="#10B981" />
            </View>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Join Another Circle</Text>
              <Text style={styles.actionDesc}>Enter an invite code</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#64748B" />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.actionCard}
            onPress={() => router.push('/place/create')}
          >
            <View style={[styles.actionIcon, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
              <Ionicons name="location" size={22} color="#F59E0B" />
            </View>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Add Safe Place</Text>
              <Text style={styles.actionDesc}>Home, school, or custom location</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#64748B" />
          </TouchableOpacity>
        </View>

        {/* Danger Zone */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: '#EF4444' }]}>Danger Zone</Text>

          <TouchableOpacity style={styles.dangerCard} onPress={handleLeaveCircle}>
            <Ionicons name="exit" size={22} color="#EF4444" />
            <View style={styles.dangerContent}>
              <Text style={styles.dangerTitle}>Leave Circle</Text>
              <Text style={styles.dangerDesc}>Stop receiving alerts and tracking</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.dangerCard} onPress={handleDeleteCircle}>
            <Ionicons name="trash" size={22} color="#EF4444" />
            <View style={styles.dangerContent}>
              <Text style={styles.dangerTitle}>Delete Circle</Text>
              <Text style={styles.dangerDesc}>Permanently remove this circle</Text>
            </View>
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#6366F1" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  headerRight: {
    width: 44,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  section: {
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  settingCard: {
    flexDirection: 'row',
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
  },
  settingIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingContent: {
    flex: 1,
    marginLeft: 14,
    justifyContent: 'center',
  },
  settingLabel: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 4,
  },
  settingValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  editNameContainer: {
    gap: 10,
  },
  nameInput: {
    fontSize: 16,
    fontWeight: '500',
    color: '#FFFFFF',
    backgroundColor: '#0F172A',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#6366F1',
  },
  editActions: {
    flexDirection: 'row',
    gap: 8,
  },
  cancelEditBtn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveEditBtn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#6366F1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  inviteCodeCard: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },
  inviteCodeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  inviteCodeIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  inviteCodeInfo: {
    flex: 1,
    marginLeft: 14,
  },
  inviteCodeLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  inviteCodeHint: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  inviteCodeDisplay: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#334155',
    alignItems: 'center',
  },
  inviteCodeValue: {
    fontSize: 32,
    fontWeight: '700',
    color: '#F59E0B',
    letterSpacing: 6,
  },
  inviteActions: {
    flexDirection: 'row',
    gap: 12,
  },
  inviteActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    borderRadius: 12,
    paddingVertical: 14,
    gap: 8,
  },
  inviteActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6366F1',
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  actionIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionContent: {
    flex: 1,
    marginLeft: 14,
  },
  actionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  actionDesc: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  dangerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
  },
  dangerContent: {
    flex: 1,
    marginLeft: 14,
  },
  dangerTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#EF4444',
  },
  dangerDesc: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
