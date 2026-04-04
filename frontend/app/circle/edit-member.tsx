import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Share,
  Modal,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { useAuthStore, useCircleStore } from '../../lib/store';
import { useLanguage } from '../../lib/i18n';
import {
  FamilyRole,
  MemberStatus,
  SetupStatus,
  Relationship,
  RolePermissions,
  ROLE_INFO,
  STATUS_INFO,
  RELATIONSHIP_INFO,
  ROLE_PERMISSIONS,
  getAssignableRoles,
  canChangeRole,
  canRemoveMember,
  validateMemberRemoval,
  validateOwnershipTransfer,
  generateInviteCode,
  getConnectionStatusText,
  CircleMemberInfo,
} from '../../lib/familyRoles';

export default function EditMemberScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const { user } = useAuthStore();
  const { currentCircle } = useCircleStore();
  const { t, language } = useLanguage();
  const lang = language as 'en' | 'ro';

  const memberId = params.memberId as string;
  const memberUserId = params.userId as string;

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  // Member data
  const [name, setName] = useState('');
  const [role, setRole] = useState<FamilyRole>('child');
  const [relationship, setRelationship] = useState<Relationship>('other');
  const [status, setStatus] = useState<MemberStatus>('invited');
  const [setupStatus, setSetupStatus] = useState<SetupStatus>('invited');
  const [isOnline, setIsOnline] = useState(false);
  const [lastSeen, setLastSeen] = useState<string | null>(null);
  const [customPermissions, setCustomPermissions] = useState<Partial<RolePermissions>>({});
  
  // Current user's role and all members
  const [currentUserRole, setCurrentUserRole] = useState<FamilyRole>('parent');
  const [allMembers, setAllMembers] = useState<CircleMemberInfo[]>([]);
  
  // Invite code for this member
  const [memberInviteCode, setMemberInviteCode] = useState<string>('');
  
  // Transfer ownership modal
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [eligibleParents, setEligibleParents] = useState<any[]>([]);

  useEffect(() => {
    loadMemberData();
  }, [memberId]);

  const loadMemberData = async () => {
    if (!memberId || !currentCircle?.id) {
      setIsLoading(false);
      return;
    }

    try {
      // Get member data
      const { data: memberData, error } = await supabase
        .from('circle_members')
        .select(`
          *,
          profiles:user_id (
            id,
            name,
            role
          )
        `)
        .eq('id', memberId)
        .single();

      if (error) throw error;

      if (memberData) {
        setName(memberData.profiles?.name || '');
        setRole((memberData.role || 'child') as FamilyRole);
        setRelationship((memberData.relationship || 'other') as Relationship);
        
        // Determine status based on data
        if (memberData.profiles?.id) {
          setStatus('active');
        } else {
          setStatus('invited');
        }
        
        // Load custom permissions if any
        if (memberData.permissions) {
          setCustomPermissions(memberData.permissions);
        }
      }

      // Get current user's role in circle
      const { data: currentMember } = await supabase
        .from('circle_members')
        .select('role')
        .eq('circle_id', currentCircle.id)
        .eq('user_id', user?.id)
        .single();

      if (currentMember) {
        setCurrentUserRole(currentMember.role as FamilyRole);
      }

      // Get all members for validation
      const { data: membersData } = await supabase
        .from('circle_members')
        .select(`
          id,
          user_id,
          role,
          profiles:user_id (id, name)
        `)
        .eq('circle_id', currentCircle.id);

      if (membersData) {
        const membersInfo: CircleMemberInfo[] = membersData.map((m: any) => ({
          id: m.id,
          userId: m.user_id,
          role: m.role as FamilyRole,
          setupStatus: m.profiles?.id ? 'active' : 'invited' as SetupStatus,
        }));
        setAllMembers(membersInfo);

        // Find eligible parents for transfer (only if current user is owner)
        if (currentMember?.role === 'owner') {
          const parents = membersData.filter((m: any) => 
            m.role === 'parent' && m.profiles?.id
          );
          setEligibleParents(parents);
        }
      }

      // Generate invite code for pending/invited members
      if (status === 'invited' || status === 'pending') {
        setMemberInviteCode(generateInviteCode());
      }
    } catch (error) {
      console.error('Load member error:', error);
      Alert.alert('Error', 'Failed to load member data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!memberId || !currentCircle?.id) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('circle_members')
        .update({
          role: role,
        })
        .eq('id', memberId);

      if (error) throw error;

      Alert.alert(
        lang === 'ro' ? 'Succes' : 'Success',
        lang === 'ro' ? 'Datele membrului au fost actualizate' : 'Member data updated',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update member');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveMember = () => {
    // Validate removal with all protections
    const thisMember: CircleMemberInfo = {
      id: memberId,
      userId: memberUserId,
      role: role,
      setupStatus: status === 'active' ? 'active' : status === 'invited' ? 'invited' : 'pending_connection',
    };
    
    const validation = validateMemberRemoval(allMembers, thisMember, currentUserRole);
    
    if (!validation.canRemove) {
      Alert.alert(
        lang === 'ro' ? 'Acțiune interzisă' : 'Action Not Allowed',
        lang === 'ro' ? validation.reasonRo : validation.reason
      );
      return;
    }

    // For children, require double confirmation
    if (validation.requiresDoubleConfirm) {
      Alert.alert(
        lang === 'ro' ? 'Confirmare necesară' : 'Confirmation Required',
        lang === 'ro' 
          ? `Ești sigur că vrei să elimini pe ${name}? Această acțiune va opri urmărirea locației.`
          : `Are you sure you want to remove ${name}? This will stop location tracking.`,
        [
          { text: lang === 'ro' ? 'Anulează' : 'Cancel', style: 'cancel' },
          {
            text: lang === 'ro' ? 'Confirmă eliminarea' : 'Confirm Removal',
            style: 'destructive',
            onPress: () => {
              // Second confirmation
              Alert.alert(
                lang === 'ro' ? 'Ultimă confirmare' : 'Final Confirmation',
                lang === 'ro' 
                  ? `Aceasta este o acțiune ireversibilă. ${name} va fi eliminat din Family Circle.`
                  : `This action cannot be undone. ${name} will be removed from the Family Circle.`,
                [
                  { text: lang === 'ro' ? 'Anulează' : 'Cancel', style: 'cancel' },
                  {
                    text: lang === 'ro' ? 'DA, Elimină' : 'YES, Remove',
                    style: 'destructive',
                    onPress: executeRemoval,
                  },
                ]
              );
            },
          },
        ]
      );
    } else {
      // Single confirmation for non-children
      Alert.alert(
        lang === 'ro' ? 'Elimină membru' : 'Remove Member',
        lang === 'ro' 
          ? `Ești sigur că vrei să elimini pe ${name} din cerc?`
          : `Are you sure you want to remove ${name} from the circle?`,
        [
          { text: lang === 'ro' ? 'Anulează' : 'Cancel', style: 'cancel' },
          {
            text: lang === 'ro' ? 'Elimină' : 'Remove',
            style: 'destructive',
            onPress: executeRemoval,
          },
        ]
      );
    }
  };

  const executeRemoval = async () => {
    try {
      const { error } = await supabase
        .from('circle_members')
        .delete()
        .eq('id', memberId);

      if (error) throw error;

      Alert.alert(
        lang === 'ro' ? 'Eliminat' : 'Removed',
        lang === 'ro' ? 'Membrul a fost eliminat' : 'Member has been removed',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to remove member');
    }
  };

  // Copy invite code
  const handleCopyInviteCode = async () => {
    try {
      await Share.share({ message: memberInviteCode });
    } catch (error) {
      Alert.alert(lang === 'ro' ? 'Cod invitație' : 'Invite Code', memberInviteCode);
    }
  };

  // Regenerate invite code
  const handleRegenerateInvite = () => {
    const newCode = generateInviteCode();
    setMemberInviteCode(newCode);
    Alert.alert(
      lang === 'ro' ? 'Cod regenerat' : 'Code Regenerated',
      lang === 'ro' ? `Noul cod: ${newCode}` : `New code: ${newCode}`
    );
  };

  // Share invite link
  const handleShareInvite = async () => {
    const message = lang === 'ro'
      ? `Alătură-te cercului nostru de familie pe Guardian AI!\n\nCod invitație: ${memberInviteCode}\n\nCircle: ${currentCircle?.name || 'Family Circle'}`
      : `Join our family circle on Guardian AI!\n\nInvite code: ${memberInviteCode}\n\nCircle: ${currentCircle?.name || 'Family Circle'}`;

    try {
      await Share.share({ message });
    } catch (error) {
      Alert.alert(lang === 'ro' ? 'Cod invitație' : 'Invite Code', memberInviteCode);
    }
  };

  // Transfer ownership
  const handleTransferOwnership = async (targetMember: any) => {
    if (currentUserRole !== 'owner') return;

    Alert.alert(
      lang === 'ro' ? 'Transfer proprietate' : 'Transfer Ownership',
      lang === 'ro' 
        ? `Ești sigur că vrei să transferi proprietatea către ${targetMember.profiles?.name}? Vei deveni Parent.`
        : `Are you sure you want to transfer ownership to ${targetMember.profiles?.name}? You will become a Parent.`,
      [
        { text: lang === 'ro' ? 'Anulează' : 'Cancel', style: 'cancel' },
        {
          text: lang === 'ro' ? 'Transferă' : 'Transfer',
          onPress: async () => {
            try {
              // Update target to Owner
              await supabase
                .from('circle_members')
                .update({ role: 'owner' })
                .eq('id', targetMember.id);

              // Update current user to Parent
              const { data: currentMemberData } = await supabase
                .from('circle_members')
                .select('id')
                .eq('circle_id', currentCircle?.id)
                .eq('user_id', user?.id)
                .single();

              if (currentMemberData) {
                await supabase
                  .from('circle_members')
                  .update({ role: 'parent' })
                  .eq('id', currentMemberData.id);
              }

              Alert.alert(
                lang === 'ro' ? 'Succes' : 'Success',
                lang === 'ro' ? 'Proprietatea a fost transferată' : 'Ownership has been transferred',
                [{ text: 'OK', onPress: () => router.back() }]
              );
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to transfer ownership');
            }
          },
        },
      ]
    );

    setShowTransferModal(false);
  };

  const handleResendInvite = async () => {
    Alert.alert(
      lang === 'ro' ? 'Invitație retrimisă' : 'Invite Resent',
      lang === 'ro' 
        ? 'O nouă invitație a fost trimisă'
        : 'A new invitation has been sent'
    );
  };

  // Get assignable roles based on current user's role
  const assignableRoles = getAssignableRoles(currentUserRole);

  // Check if current user can change this member's role
  const canChangeThisRole = (newRole: FamilyRole) => 
    canChangeRole(currentUserRole, role, newRole);

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {lang === 'ro' ? 'Editare membru' : 'Edit Member'}
        </Text>
        <TouchableOpacity
          style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.saveButtonText}>
              {lang === 'ro' ? 'Salvează' : 'Save'}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Member Avatar & Name */}
          <View style={styles.profileSection}>
            <View style={[styles.avatar, { backgroundColor: ROLE_INFO[role].badgeColor }]}>
              <Text style={[styles.avatarText, { color: ROLE_INFO[role].color }]}>
                {name?.[0]?.toUpperCase() || '?'}
              </Text>
            </View>
            <Text style={styles.profileName}>{name || 'Unknown'}</Text>
            <View style={[styles.statusBadge, { backgroundColor: STATUS_INFO[status].color + '20' }]}>
              <Ionicons name={STATUS_INFO[status].icon as any} size={14} color={STATUS_INFO[status].color} />
              <Text style={[styles.statusText, { color: STATUS_INFO[status].color }]}>
                {lang === 'ro' ? STATUS_INFO[status].labelRo : STATUS_INFO[status].label}
              </Text>
            </View>
          </View>

          {/* Role Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {lang === 'ro' ? 'Rol în familie' : 'Family Role'}
            </Text>
            <View style={styles.roleGrid}>
              {(['owner', 'parent', 'guardian', 'child'] as FamilyRole[]).map((r) => {
                const roleInfo = ROLE_INFO[r];
                const isSelected = role === r;
                const canSelect = r === role || (assignableRoles.includes(r) && canChangeThisRole(r));
                
                return (
                  <TouchableOpacity
                    key={r}
                    style={[
                      styles.roleCard,
                      isSelected && styles.roleCardSelected,
                      !canSelect && styles.roleCardDisabled,
                    ]}
                    onPress={() => canSelect && setRole(r)}
                    disabled={!canSelect}
                  >
                    <View style={[styles.roleIcon, { backgroundColor: roleInfo.badgeColor }]}>
                      <Ionicons name={roleInfo.icon as any} size={24} color={roleInfo.color} />
                    </View>
                    <Text style={[styles.roleLabel, isSelected && styles.roleLabelSelected]}>
                      {lang === 'ro' ? roleInfo.labelRo : roleInfo.label}
                    </Text>
                    {!canSelect && r !== role && (
                      <Ionicons name="lock-closed" size={14} color="#64748B" style={styles.lockIcon} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Relationship Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {lang === 'ro' ? 'Relație' : 'Relationship'}
            </Text>
            <View style={styles.relationshipGrid}>
              {(Object.keys(RELATIONSHIP_INFO) as Relationship[]).map((rel) => (
                <TouchableOpacity
                  key={rel}
                  style={[
                    styles.relationshipChip,
                    relationship === rel && styles.relationshipChipSelected,
                  ]}
                  onPress={() => setRelationship(rel)}
                >
                  <Text
                    style={[
                      styles.relationshipChipText,
                      relationship === rel && styles.relationshipChipTextSelected,
                    ]}
                  >
                    {lang === 'ro' ? RELATIONSHIP_INFO[rel].labelRo : RELATIONSHIP_INFO[rel].label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Status Section (for invited/pending members) */}
          {(status === 'invited' || status === 'pending' || status === 'permissions_incomplete') && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                {lang === 'ro' ? 'Status conexiune' : 'Connection Status'}
              </Text>
              <View style={styles.statusCard}>
                <View style={styles.statusCardHeader}>
                  <Ionicons 
                    name={STATUS_INFO[status].icon as any} 
                    size={24} 
                    color={STATUS_INFO[status].color} 
                  />
                  <Text style={[styles.statusCardTitle, { color: STATUS_INFO[status].color }]}>
                    {lang === 'ro' ? STATUS_INFO[status].labelRo : STATUS_INFO[status].label}
                  </Text>
                </View>
                <Text style={styles.statusCardDesc}>
                  {status === 'invited' && (lang === 'ro' 
                    ? 'Membrul nu a acceptat încă invitația'
                    : 'Member has not accepted the invitation yet'
                  )}
                  {status === 'pending' && (lang === 'ro' 
                    ? 'În așteptarea conectării dispozitivului'
                    : 'Waiting for device to connect'
                  )}
                  {status === 'permissions_incomplete' && (lang === 'ro' 
                    ? 'Membrul trebuie să acorde permisiuni în aplicație'
                    : 'Member needs to grant permissions in the app'
                  )}
                </Text>

                {/* Invite Code Display */}
                <View style={styles.inviteCodeBox}>
                  <Text style={styles.inviteCodeLabel}>
                    {lang === 'ro' ? 'Cod invitație' : 'Invite Code'}
                  </Text>
                  <Text style={styles.inviteCodeValue}>{memberInviteCode}</Text>
                </View>

                {/* Invite Actions */}
                <View style={styles.inviteActionsRow}>
                  <TouchableOpacity style={styles.inviteActionBtn} onPress={handleCopyInviteCode}>
                    <Ionicons name="copy" size={18} color="#6366F1" />
                    <Text style={styles.inviteActionText}>
                      {lang === 'ro' ? 'Copiază' : 'Copy'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.inviteActionBtn} onPress={handleShareInvite}>
                    <Ionicons name="share-social" size={18} color="#6366F1" />
                    <Text style={styles.inviteActionText}>
                      {lang === 'ro' ? 'Trimite' : 'Share'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.inviteActionBtn} onPress={handleRegenerateInvite}>
                    <Ionicons name="refresh" size={18} color="#F59E0B" />
                    <Text style={[styles.inviteActionText, { color: '#F59E0B' }]}>
                      {lang === 'ro' ? 'Regenerează' : 'Regenerate'}
                    </Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity style={styles.resendButton} onPress={handleResendInvite}>
                  <Ionicons name="mail" size={18} color="#6366F1" />
                  <Text style={styles.resendButtonText}>
                    {lang === 'ro' ? 'Retrimite invitația' : 'Resend Invitation'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Permissions Section (for non-child roles) */}
          {role !== 'child' && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                {lang === 'ro' ? 'Permisiuni' : 'Permissions'}
              </Text>
              <View style={styles.permissionsList}>
                {/* View Permissions */}
                <PermissionItem
                  icon="location"
                  label={lang === 'ro' ? 'Vedere locație live' : 'View live location'}
                  enabled={ROLE_PERMISSIONS[role].canViewLiveLocation}
                />
                <PermissionItem
                  icon="notifications"
                  label={lang === 'ro' ? 'Primire alerte' : 'Receive alerts'}
                  enabled={ROLE_PERMISSIONS[role].canReceiveAlerts}
                />
                <PermissionItem
                  icon="stats-chart"
                  label={lang === 'ro' ? 'Raport săptămânal' : 'Weekly report'}
                  enabled={ROLE_PERMISSIONS[role].canViewWeeklyReport}
                />
                
                {/* Edit Permissions */}
                <PermissionItem
                  icon="bookmark"
                  label={lang === 'ro' ? 'Editare locuri sigure' : 'Edit safe places'}
                  enabled={ROLE_PERMISSIONS[role].canEditSafePlaces}
                />
                <PermissionItem
                  icon="people"
                  label={lang === 'ro' ? 'Gestionare membri' : 'Manage members'}
                  enabled={ROLE_PERMISSIONS[role].canManageFamilyMembers}
                />
                
                {/* Admin Permissions */}
                <PermissionItem
                  icon="create"
                  label={lang === 'ro' ? 'Redenumire cerc' : 'Rename circle'}
                  enabled={ROLE_PERMISSIONS[role].canRenameCircle}
                />
                <PermissionItem
                  icon="trash"
                  label={lang === 'ro' ? 'Ștergere cerc' : 'Delete circle'}
                  enabled={ROLE_PERMISSIONS[role].canDeleteCircle}
                />
              </View>
            </View>
          )}

          {/* Owner Transfer Section (for Owner only, viewing a Parent) */}
          {currentUserRole === 'owner' && role === 'parent' && status === 'active' && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                {lang === 'ro' ? 'Transfer proprietate' : 'Ownership Transfer'}
              </Text>
              <TouchableOpacity 
                style={styles.transferButton}
                onPress={() => handleTransferOwnership({ 
                  id: memberId, 
                  profiles: { name } 
                })}
              >
                <Ionicons name="swap-horizontal" size={20} color="#F59E0B" />
                <View style={styles.transferInfo}>
                  <Text style={styles.transferTitle}>
                    {lang === 'ro' ? 'Transferă proprietatea' : 'Transfer Ownership'}
                  </Text>
                  <Text style={styles.transferDesc}>
                    {lang === 'ro' 
                      ? `Face pe ${name} noul Owner. Tu vei deveni Parent.`
                      : `Make ${name} the new Owner. You will become a Parent.`
                    }
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>
          )}

          {/* Danger Zone */}
          {canRemoveMember(currentUserRole, role) && (
            <View style={styles.dangerSection}>
              <TouchableOpacity style={styles.removeButton} onPress={handleRemoveMember}>
                <Ionicons name="person-remove" size={20} color="#EF4444" />
                <Text style={styles.removeButtonText}>
                  {lang === 'ro' ? 'Elimină din cerc' : 'Remove from Circle'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

// Permission item component
function PermissionItem({ 
  icon, 
  label, 
  enabled 
}: { 
  icon: string; 
  label: string; 
  enabled: boolean;
}) {
  return (
    <View style={styles.permissionItem}>
      <View style={styles.permissionInfo}>
        <Ionicons 
          name={icon as any} 
          size={20} 
          color={enabled ? '#6366F1' : '#64748B'} 
        />
        <Text style={[styles.permissionLabel, !enabled && styles.permissionLabelDisabled]}>
          {label}
        </Text>
      </View>
      <Ionicons 
        name={enabled ? 'checkmark-circle' : 'close-circle'} 
        size={22} 
        color={enabled ? '#10B981' : '#64748B'} 
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
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
  saveButton: {
    backgroundColor: '#6366F1',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  profileSection: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: '700',
  },
  profileName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  roleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  roleCard: {
    width: '48%',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    position: 'relative',
  },
  roleCardSelected: {
    borderColor: '#6366F1',
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
  },
  roleCardDisabled: {
    opacity: 0.5,
  },
  roleIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  roleLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  roleLabelSelected: {
    color: '#6366F1',
  },
  lockIcon: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  relationshipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  relationshipChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#1E293B',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  relationshipChipSelected: {
    borderColor: '#6366F1',
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
  },
  relationshipChipText: {
    fontSize: 13,
    color: '#94A3B8',
    fontWeight: '500',
  },
  relationshipChipTextSelected: {
    color: '#6366F1',
  },
  statusCard: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 16,
  },
  statusCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  statusCardTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  statusCardDesc: {
    fontSize: 14,
    color: '#94A3B8',
    marginBottom: 16,
    lineHeight: 20,
  },
  resendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    borderRadius: 10,
    paddingVertical: 12,
    gap: 8,
  },
  resendButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6366F1',
  },
  permissionsList: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    overflow: 'hidden',
  },
  permissionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  permissionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  permissionLabel: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  permissionLabelDisabled: {
    color: '#64748B',
  },
  dangerSection: {
    marginTop: 8,
    marginBottom: 24,
  },
  removeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 14,
    paddingVertical: 16,
    gap: 10,
  },
  removeButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#EF4444',
  },
  // Invite Code styles
  inviteCodeBox: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 12,
  },
  inviteCodeLabel: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 4,
  },
  inviteCodeValue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#6366F1',
    letterSpacing: 4,
  },
  inviteActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  inviteActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    borderRadius: 10,
    paddingVertical: 10,
    gap: 6,
  },
  inviteActionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6366F1',
  },
  // Transfer ownership styles
  transferButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderRadius: 14,
    padding: 16,
  },
  transferInfo: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  transferTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#F59E0B',
  },
  transferDesc: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
});
