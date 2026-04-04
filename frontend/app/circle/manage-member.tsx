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
  KeyboardAvoidingView,
  Platform,
  Linking,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { useAuthStore, useCircleStore } from '../../lib/store';
import { useLanguage } from '../../lib/i18n';
import {
  FamilyRole,
  Relationship,
  ROLE_INFO,
  ROLE_PERMISSIONS,
  RELATIONSHIP_INFO,
} from '../../lib/familyRoles';

// Types
type InviteMethod = 'phone' | 'email' | 'code' | 'link';

interface MemberPermissions {
  canViewLiveLocation: boolean;
  canReceiveAlerts: boolean;
  canEditSafePlaces: boolean;
  canManageFamilyMembers: boolean;
  canStartSafeTrip: boolean;
  canViewWeeklyReport: boolean;
}

interface MemberData {
  role: FamilyRole;
  displayName: string;
  phoneNumber: string;
  email: string;
  relationship: Relationship;
  permissions: MemberPermissions;
}

// Default permissions based on role
const getDefaultPermissions = (role: FamilyRole): MemberPermissions => {
  const perms = ROLE_PERMISSIONS[role];
  return {
    canViewLiveLocation: perms.canViewLiveLocation,
    canReceiveAlerts: perms.canReceiveAlerts,
    canEditSafePlaces: perms.canEditSafePlaces,
    canManageFamilyMembers: perms.canInviteMembers || perms.canRemoveMembers,
    canStartSafeTrip: perms.canStartSafeTrip,
    canViewWeeklyReport: perms.canViewWeeklyReport,
  };
};

// Relationship options for each role
const relationshipOptions: Record<FamilyRole, Relationship[]> = {
  owner: ['mother', 'father', 'guardian', 'other'],
  parent: ['mother', 'father', 'other'],
  guardian: ['guardian', 'grandparent', 'aunt', 'uncle', 'other'],
  child: ['son', 'daughter', 'sibling', 'other'],
};

export default function ManageMemberScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const { user } = useAuthStore();
  const { currentCircle } = useCircleStore();
  const { t } = useLanguage();

  // Mode: 'add' or 'edit'
  const mode = params.mode as string || 'add';
  const existingMemberId = params.memberId as string;

  // UI State
  const [currentStep, setCurrentStep] = useState<'select-role' | 'member-details' | 'permissions' | 'invite'>('select-role');
  const [isLoading, setIsLoading] = useState(false);
  const [generatedCode, setGeneratedCode] = useState<string>('');

  // Member data
  const [memberData, setMemberData] = useState<MemberData>({
    role: 'child',
    displayName: '',
    phoneNumber: '',
    email: '',
    relationship: 'son',
    permissions: getDefaultPermissions('child'),
  });

  // Invite method
  const [inviteMethod, setInviteMethod] = useState<InviteMethod>('code');

  // Generate invite code
  const generateInviteCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  useEffect(() => {
    if (currentStep === 'invite') {
      setGeneratedCode(generateInviteCode());
    }
  }, [currentStep]);

  // Handle role selection
  const handleRoleSelect = (role: FamilyRole) => {
    setMemberData({
      ...memberData,
      role,
      relationship: relationshipOptions[role][0],
      permissions: getDefaultPermissions(role),
    });
    setCurrentStep('member-details');
  };

  // Handle permission toggle
  const togglePermission = (key: keyof MemberPermissions) => {
    setMemberData({
      ...memberData,
      permissions: {
        ...memberData.permissions,
        [key]: !memberData.permissions[key],
      },
    });
  };

  // Save member invite to database
  const saveMemberInvite = async () => {
    if (!currentCircle?.id || !user?.id) {
      Alert.alert('Error', 'No circle found');
      return;
    }

    setIsLoading(true);
    try {
      // Create pending member/invite record
      const { error } = await supabase
        .from('circle_invites')
        .insert({
          circle_id: currentCircle.id,
          invited_by: user.id,
          invite_code: generatedCode,
          role: memberData.role,
          display_name: memberData.displayName || null,
          phone_number: memberData.phoneNumber || null,
          email: memberData.email || null,
          relationship: memberData.relationship,
          permissions: memberData.permissions,
          status: 'pending',
          created_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
        });

      if (error) {
        // Table might not exist, use alternative approach
        console.log('circle_invites not available, using share');
      }

      return true;
    } catch (error) {
      console.error('Save invite error:', error);
    } finally {
      setIsLoading(false);
    }
    return true;
  };

  // Get app download/access link
  const getAppLink = () => {
    // For testing via Expo Go
    const expoLink = 'https://expo.dev/go';
    // Preview web link
    const webPreviewLink = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://guardianai-production-929d.up.railway.app';
    
    return {
      expoLink,
      webPreviewLink,
      // Future App Store / Play Store links
      appStoreLink: 'https://apps.apple.com/app/guardian-ai', // placeholder
      playStoreLink: 'https://play.google.com/store/apps/details?id=com.guardianai.app', // placeholder
    };
  };

  // Share invite
  const handleShareInvite = async () => {
    await saveMemberInvite();

    const links = getAppLink();
    const roleText = memberData.role === 'child' ? 'child' : memberData.role === 'parent' ? 'parent' : 'guardian';
    
    const message = `🛡️ Join our family circle on Guardian AI as a ${roleText}!

📱 How to join:

1️⃣ Download "Expo Go" app:
   • iPhone: ${links.expoLink}
   • Android: ${links.expoLink}

2️⃣ Open this link in Expo Go:
   ${links.webPreviewLink}

3️⃣ Tap "Join Family Circle" and enter code:
   🔑 ${generatedCode}

👨‍👩‍👧‍👦 Circle: ${currentCircle?.name || 'Family Circle'}

This code is valid for 7 days.`;

    try {
      await Share.share({ message });
    } catch (error) {
      Alert.alert('Invite Code', generatedCode);
    }
  };

  // Copy code to clipboard
  const handleCopyCode = async () => {
    const links = getAppLink();
    const message = `Guardian AI Invite Code: ${generatedCode}

Download Expo Go: ${links.expoLink}
Open app: ${links.webPreviewLink}`;

    try {
      await Share.share({ message });
    } catch (error) {
      Alert.alert('Invite Code', generatedCode);
    }
  };

  // Send SMS invite
  const handleSendSMS = async () => {
    if (!memberData.phoneNumber) {
      Alert.alert('Error', 'Please enter a phone number');
      return;
    }
    await saveMemberInvite();
    
    const links = getAppLink();
    const message = `Join our family on Guardian AI! 
Code: ${generatedCode}
App: ${links.webPreviewLink}
(Download Expo Go first: ${links.expoLink})`;

    // Open SMS app with pre-filled message
    const smsUrl = `sms:${memberData.phoneNumber}?body=${encodeURIComponent(message)}`;
    try {
      const canOpen = await Linking.canOpenURL(smsUrl);
      if (canOpen) {
        await Linking.openURL(smsUrl);
      } else {
        Alert.alert('SMS Invite', `Send this to ${memberData.phoneNumber}:\n\n${message}`);
      }
    } catch (error) {
      Alert.alert('SMS Invite', `Send this to ${memberData.phoneNumber}:\n\n${message}`);
    }
  };

  // Send email invite
  const handleSendEmail = async () => {
    if (!memberData.email) {
      Alert.alert('Error', 'Please enter an email address');
      return;
    }
    await saveMemberInvite();
    
    const links = getAppLink();
    const subject = `Join our family on Guardian AI`;
    const body = `Hi!

I'd like you to join our family circle on Guardian AI.

📱 How to join:

1. Download "Expo Go" app from App Store or Play Store
   Link: ${links.expoLink}

2. Open this link in Expo Go:
   ${links.webPreviewLink}

3. Tap "Join Family Circle" and enter this code:
   🔑 ${generatedCode}

Circle: ${currentCircle?.name || 'Family Circle'}

This code is valid for 7 days.

See you in the app!`;

    const emailUrl = `mailto:${memberData.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    try {
      const canOpen = await Linking.canOpenURL(emailUrl);
      if (canOpen) {
        await Linking.openURL(emailUrl);
      } else {
        Alert.alert('Email Invite', `Send this to ${memberData.email}:\n\n${body}`);
      }
    } catch (error) {
      Alert.alert('Email Invite', `Send this to ${memberData.email}:\n\n${body}`);
    }
  };

  // Render role selection step
  const renderRoleSelection = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Add Family Member</Text>
      <Text style={styles.stepSubtitle}>Choose the type of member to add</Text>

      {/* Child Option */}
      <TouchableOpacity
        style={styles.roleCard}
        onPress={() => handleRoleSelect('child')}
      >
        <View style={[styles.roleIcon, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
          <Ionicons name="happy" size={32} color="#10B981" />
        </View>
        <View style={styles.roleInfo}>
          <Text style={styles.roleTitle}>Add Child</Text>
          <Text style={styles.roleDescription}>
            Track location, set safe places, receive alerts when they arrive or leave
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={24} color="#64748B" />
      </TouchableOpacity>

      {/* Parent Option */}
      <TouchableOpacity
        style={styles.roleCard}
        onPress={() => handleRoleSelect('parent')}
      >
        <View style={[styles.roleIcon, { backgroundColor: 'rgba(99, 102, 241, 0.15)' }]}>
          <Ionicons name="person" size={32} color="#6366F1" />
        </View>
        <View style={styles.roleInfo}>
          <Text style={styles.roleTitle}>Add Parent</Text>
          <Text style={styles.roleDescription}>
            Full access to manage family, view locations, edit places, and receive all alerts
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={24} color="#64748B" />
      </TouchableOpacity>

      {/* Guardian Option */}
      <TouchableOpacity
        style={styles.roleCard}
        onPress={() => handleRoleSelect('guardian')}
      >
        <View style={[styles.roleIcon, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
          <Ionicons name="shield" size={32} color="#F59E0B" />
        </View>
        <View style={styles.roleInfo}>
          <Text style={styles.roleTitle}>Add Guardian</Text>
          <Text style={styles.roleDescription}>
            View locations and receive alerts, but cannot manage family settings
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={24} color="#64748B" />
      </TouchableOpacity>

      {/* Divider */}
      <View style={styles.divider} />

      {/* Quick Actions */}
      <Text style={styles.quickActionsTitle}>Quick Actions</Text>

      <TouchableOpacity
        style={styles.quickActionCard}
        onPress={() => {
          setCurrentStep('invite');
          setGeneratedCode(currentCircle?.invite_code || generateInviteCode());
        }}
      >
        <View style={[styles.quickActionIcon, { backgroundColor: 'rgba(99, 102, 241, 0.15)' }]}>
          <Ionicons name="qr-code" size={24} color="#6366F1" />
        </View>
        <View style={styles.quickActionInfo}>
          <Text style={styles.quickActionTitle}>Share Circle Code</Text>
          <Text style={styles.quickActionDescription}>Quick invite with existing circle code</Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.quickActionCard}
        onPress={() => router.push('/circle/join')}
      >
        <View style={[styles.quickActionIcon, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
          <Ionicons name="enter" size={24} color="#10B981" />
        </View>
        <View style={styles.quickActionInfo}>
          <Text style={styles.quickActionTitle}>Join by Code</Text>
          <Text style={styles.quickActionDescription}>Enter an invite code to join another circle</Text>
        </View>
      </TouchableOpacity>
    </View>
  );

  // Render member details step
  const renderMemberDetails = () => (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.stepContent}
    >
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={styles.stepTitle}>
          {memberData.role === 'child' ? 'Child' : memberData.role === 'parent' ? 'Parent' : 'Guardian'} Details
        </Text>
        <Text style={styles.stepSubtitle}>Enter the member information (optional)</Text>

        {/* Role Badge */}
        <View style={styles.selectedRoleBadge}>
          <Ionicons
            name={memberData.role === 'child' ? 'happy' : memberData.role === 'parent' ? 'person' : 'shield'}
            size={20}
            color={memberData.role === 'child' ? '#10B981' : memberData.role === 'parent' ? '#6366F1' : '#F59E0B'}
          />
          <Text style={styles.selectedRoleText}>
            {memberData.role.charAt(0).toUpperCase() + memberData.role.slice(1)}
          </Text>
          <TouchableOpacity onPress={() => setCurrentStep('select-role')}>
            <Text style={styles.changeRoleText}>Change</Text>
          </TouchableOpacity>
        </View>

        {/* Display Name */}
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Display Name</Text>
          <TextInput
            style={styles.textInput}
            value={memberData.displayName}
            onChangeText={(text) => setMemberData({ ...memberData, displayName: text })}
            placeholder="Enter name"
            placeholderTextColor="#64748B"
          />
        </View>

        {/* Phone Number */}
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Phone Number</Text>
          <TextInput
            style={styles.textInput}
            value={memberData.phoneNumber}
            onChangeText={(text) => setMemberData({ ...memberData, phoneNumber: text })}
            placeholder="+40 7XX XXX XXX"
            placeholderTextColor="#64748B"
            keyboardType="phone-pad"
          />
        </View>

        {/* Email (Optional) */}
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Email (Optional)</Text>
          <TextInput
            style={styles.textInput}
            value={memberData.email}
            onChangeText={(text) => setMemberData({ ...memberData, email: text })}
            placeholder="email@example.com"
            placeholderTextColor="#64748B"
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>

        {/* Relationship */}
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Relationship</Text>
          <View style={styles.relationshipGrid}>
            {relationshipOptions[memberData.role].map((rel) => (
              <TouchableOpacity
                key={rel}
                style={[
                  styles.relationshipOption,
                  memberData.relationship === rel && styles.relationshipOptionActive,
                ]}
                onPress={() => setMemberData({ ...memberData, relationship: rel })}
              >
                <Text
                  style={[
                    styles.relationshipText,
                    memberData.relationship === rel && styles.relationshipTextActive,
                  ]}
                >
                  {rel.charAt(0).toUpperCase() + rel.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Continue Button */}
        <TouchableOpacity
          style={styles.continueButton}
          onPress={() => {
            if (memberData.role === 'child') {
              setCurrentStep('invite'); // Children skip permissions
            } else {
              setCurrentStep('permissions');
            }
          }}
        >
          <Text style={styles.continueButtonText}>Continue</Text>
          <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );

  // Render permissions step (for parent/guardian only)
  const renderPermissions = () => (
    <ScrollView style={styles.stepContent} showsVerticalScrollIndicator={false}>
      <Text style={styles.stepTitle}>Permissions</Text>
      <Text style={styles.stepSubtitle}>
        Set what this {memberData.role} can do in the family circle
      </Text>

      <View style={styles.permissionsList}>
        <TouchableOpacity
          style={styles.permissionItem}
          onPress={() => togglePermission('canViewLiveLocation')}
        >
          <View style={styles.permissionInfo}>
            <Ionicons name="location" size={24} color="#6366F1" />
            <View style={styles.permissionText}>
              <Text style={styles.permissionTitle}>View Live Location</Text>
              <Text style={styles.permissionDesc}>See real-time location of family members</Text>
            </View>
          </View>
          <View style={[styles.toggle, memberData.permissions.canViewLiveLocation && styles.toggleActive]}>
            <View style={[styles.toggleKnob, memberData.permissions.canViewLiveLocation && styles.toggleKnobActive]} />
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.permissionItem}
          onPress={() => togglePermission('canReceiveAlerts')}
        >
          <View style={styles.permissionInfo}>
            <Ionicons name="notifications" size={24} color="#F59E0B" />
            <View style={styles.permissionText}>
              <Text style={styles.permissionTitle}>Receive Alerts</Text>
              <Text style={styles.permissionDesc}>Get notified about safety events</Text>
            </View>
          </View>
          <View style={[styles.toggle, memberData.permissions.canReceiveAlerts && styles.toggleActive]}>
            <View style={[styles.toggleKnob, memberData.permissions.canReceiveAlerts && styles.toggleKnobActive]} />
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.permissionItem}
          onPress={() => togglePermission('canEditSafePlaces')}
        >
          <View style={styles.permissionInfo}>
            <Ionicons name="bookmark" size={24} color="#10B981" />
            <View style={styles.permissionText}>
              <Text style={styles.permissionTitle}>Edit Safe Places</Text>
              <Text style={styles.permissionDesc}>Add, edit, or remove safe places</Text>
            </View>
          </View>
          <View style={[styles.toggle, memberData.permissions.canEditSafePlaces && styles.toggleActive]}>
            <View style={[styles.toggleKnob, memberData.permissions.canEditSafePlaces && styles.toggleKnobActive]} />
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.permissionItem}
          onPress={() => togglePermission('canManageFamilyMembers')}
        >
          <View style={styles.permissionInfo}>
            <Ionicons name="people" size={24} color="#8B5CF6" />
            <View style={styles.permissionText}>
              <Text style={styles.permissionTitle}>Manage Family Members</Text>
              <Text style={styles.permissionDesc}>Invite, remove, or change member roles</Text>
            </View>
          </View>
          <View style={[styles.toggle, memberData.permissions.canManageFamilyMembers && styles.toggleActive]}>
            <View style={[styles.toggleKnob, memberData.permissions.canManageFamilyMembers && styles.toggleKnobActive]} />
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.permissionItem}
          onPress={() => togglePermission('canStartSafeTrip')}
        >
          <View style={styles.permissionInfo}>
            <Ionicons name="navigate" size={24} color="#EC4899" />
            <View style={styles.permissionText}>
              <Text style={styles.permissionTitle}>Start Safe Trip</Text>
              <Text style={styles.permissionDesc}>Create and monitor safe trips</Text>
            </View>
          </View>
          <View style={[styles.toggle, memberData.permissions.canStartSafeTrip && styles.toggleActive]}>
            <View style={[styles.toggleKnob, memberData.permissions.canStartSafeTrip && styles.toggleKnobActive]} />
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.permissionItem}
          onPress={() => togglePermission('canViewWeeklyReport')}
        >
          <View style={styles.permissionInfo}>
            <Ionicons name="stats-chart" size={24} color="#14B8A6" />
            <View style={styles.permissionText}>
              <Text style={styles.permissionTitle}>View Weekly Report</Text>
              <Text style={styles.permissionDesc}>Access weekly safety reports</Text>
            </View>
          </View>
          <View style={[styles.toggle, memberData.permissions.canViewWeeklyReport && styles.toggleActive]}>
            <View style={[styles.toggleKnob, memberData.permissions.canViewWeeklyReport && styles.toggleKnobActive]} />
          </View>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={styles.continueButton}
        onPress={() => setCurrentStep('invite')}
      >
        <Text style={styles.continueButtonText}>Continue to Invite</Text>
        <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
      </TouchableOpacity>
    </ScrollView>
  );

  // Render invite step
  const renderInvite = () => (
    <ScrollView style={styles.stepContent} showsVerticalScrollIndicator={false}>
      <Text style={styles.stepTitle}>Send Invitation</Text>
      <Text style={styles.stepSubtitle}>
        Choose how to invite {memberData.displayName || 'the new member'}
      </Text>

      {/* App Download Info */}
      <View style={styles.downloadInfoCard}>
        <View style={styles.downloadInfoHeader}>
          <Ionicons name="download" size={24} color="#10B981" />
          <Text style={styles.downloadInfoTitle}>Step 1: Download the App</Text>
        </View>
        <Text style={styles.downloadInfoText}>
          The invited member needs to download Guardian AI from:
        </Text>
        <View style={styles.storeLinks}>
          <View style={styles.storeLink}>
            <Ionicons name="logo-google-playstore" size={20} color="#6366F1" />
            <Text style={styles.storeLinkText}>Google Play Store</Text>
          </View>
          <View style={styles.storeLink}>
            <Ionicons name="logo-apple-appstore" size={20} color="#6366F1" />
            <Text style={styles.storeLinkText}>Apple App Store</Text>
          </View>
        </View>
      </View>

      {/* Invite Code Display */}
      <View style={styles.inviteCodeCard}>
        <View style={styles.inviteCodeHeader}>
          <Ionicons name="key" size={20} color="#F59E0B" />
          <Text style={styles.inviteCodeHeaderText}>Step 2: Enter Invite Code</Text>
        </View>
        <Text style={styles.inviteCodeLabel}>Invite Code</Text>
        <Text style={styles.inviteCodeValue}>{generatedCode}</Text>
        <Text style={styles.inviteCodeHint}>
          {memberData.role === 'child' ? 'Child Mode will activate after joining' : 'Valid for 7 days'}
        </Text>
        <View style={styles.codeInstructions}>
          <Text style={styles.codeInstructionText}>
            After downloading, tap "Join Family Circle" and enter this code.
          </Text>
        </View>
      </View>

      {/* Role & Permissions Summary */}
      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>Invitation Details</Text>
        {memberData.displayName && (
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Name:</Text>
            <Text style={styles.summaryValue}>{memberData.displayName}</Text>
          </View>
        )}
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Role:</Text>
          <Text style={[styles.summaryValue, { textTransform: 'capitalize' }]}>{memberData.role}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Relationship:</Text>
          <Text style={[styles.summaryValue, { textTransform: 'capitalize' }]}>{memberData.relationship}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Circle:</Text>
          <Text style={styles.summaryValue}>{currentCircle?.name || 'Family Circle'}</Text>
        </View>
      </View>

      {/* Invite Methods */}
      <Text style={styles.inviteMethodsTitle}>Invite Method</Text>

      <View style={styles.inviteMethodsGrid}>
        <TouchableOpacity
          style={[styles.inviteMethodCard, inviteMethod === 'link' && styles.inviteMethodCardActive]}
          onPress={() => setInviteMethod('link')}
        >
          <Ionicons name="share-social" size={28} color={inviteMethod === 'link' ? '#6366F1' : '#64748B'} />
          <Text style={[styles.inviteMethodText, inviteMethod === 'link' && styles.inviteMethodTextActive]}>
            Share Link
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.inviteMethodCard, inviteMethod === 'code' && styles.inviteMethodCardActive]}
          onPress={() => setInviteMethod('code')}
        >
          <Ionicons name="key" size={28} color={inviteMethod === 'code' ? '#6366F1' : '#64748B'} />
          <Text style={[styles.inviteMethodText, inviteMethod === 'code' && styles.inviteMethodTextActive]}>
            Copy Code
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.inviteMethodCard, inviteMethod === 'phone' && styles.inviteMethodCardActive]}
          onPress={() => setInviteMethod('phone')}
        >
          <Ionicons name="chatbubble" size={28} color={inviteMethod === 'phone' ? '#6366F1' : '#64748B'} />
          <Text style={[styles.inviteMethodText, inviteMethod === 'phone' && styles.inviteMethodTextActive]}>
            SMS
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.inviteMethodCard, inviteMethod === 'email' && styles.inviteMethodCardActive]}
          onPress={() => setInviteMethod('email')}
        >
          <Ionicons name="mail" size={28} color={inviteMethod === 'email' ? '#6366F1' : '#64748B'} />
          <Text style={[styles.inviteMethodText, inviteMethod === 'email' && styles.inviteMethodTextActive]}>
            Email
          </Text>
        </TouchableOpacity>
      </View>

      {/* Action Button based on method */}
      {inviteMethod === 'link' && (
        <TouchableOpacity style={styles.primaryButton} onPress={handleShareInvite}>
          <Ionicons name="share-social" size={22} color="#FFFFFF" />
          <Text style={styles.primaryButtonText}>Share Invitation</Text>
        </TouchableOpacity>
      )}

      {inviteMethod === 'code' && (
        <TouchableOpacity style={styles.primaryButton} onPress={handleCopyCode}>
          <Ionicons name="copy" size={22} color="#FFFFFF" />
          <Text style={styles.primaryButtonText}>Copy & Share Code</Text>
        </TouchableOpacity>
      )}

      {inviteMethod === 'phone' && (
        <View>
          {!memberData.phoneNumber && (
            <TextInput
              style={[styles.textInput, { marginBottom: 12 }]}
              placeholder="Enter phone number"
              placeholderTextColor="#64748B"
              keyboardType="phone-pad"
              value={memberData.phoneNumber}
              onChangeText={(text) => setMemberData({ ...memberData, phoneNumber: text })}
            />
          )}
          <TouchableOpacity style={styles.primaryButton} onPress={handleSendSMS}>
            <Ionicons name="send" size={22} color="#FFFFFF" />
            <Text style={styles.primaryButtonText}>Send SMS Invite</Text>
          </TouchableOpacity>
        </View>
      )}

      {inviteMethod === 'email' && (
        <View>
          {!memberData.email && (
            <TextInput
              style={[styles.textInput, { marginBottom: 12 }]}
              placeholder="Enter email address"
              placeholderTextColor="#64748B"
              keyboardType="email-address"
              autoCapitalize="none"
              value={memberData.email}
              onChangeText={(text) => setMemberData({ ...memberData, email: text })}
            />
          )}
          <TouchableOpacity style={styles.primaryButton} onPress={handleSendEmail}>
            <Ionicons name="send" size={22} color="#FFFFFF" />
            <Text style={styles.primaryButtonText}>Send Email Invite</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Child Mode Info */}
      {memberData.role === 'child' && (
        <View style={styles.childModeInfo}>
          <Ionicons name="information-circle" size={24} color="#10B981" />
          <Text style={styles.childModeText}>
            After joining, the child's app will switch to Child Mode with simplified interface and location tracking enabled.
          </Text>
        </View>
      )}

      {/* Done Button */}
      <TouchableOpacity
        style={styles.doneButton}
        onPress={() => router.back()}
      >
        <Text style={styles.doneButtonText}>Done</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  // Progress indicator
  const getStepNumber = () => {
    switch (currentStep) {
      case 'select-role': return 1;
      case 'member-details': return 2;
      case 'permissions': return 3;
      case 'invite': return memberData.role === 'child' ? 3 : 4;
    }
  };

  const totalSteps = memberData.role === 'child' ? 3 : 4;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            if (currentStep === 'select-role') {
              router.back();
            } else if (currentStep === 'member-details') {
              setCurrentStep('select-role');
            } else if (currentStep === 'permissions') {
              setCurrentStep('member-details');
            } else if (currentStep === 'invite') {
              if (memberData.role === 'child') {
                setCurrentStep('member-details');
              } else {
                setCurrentStep('permissions');
              }
            }
          }}
        >
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {currentStep === 'select-role' ? 'Add Member' : 
           currentStep === 'invite' ? 'Send Invite' : 
           `Step ${getStepNumber()} of ${totalSteps}`}
        </Text>
        <View style={styles.headerRight} />
      </View>

      {/* Progress Bar */}
      {currentStep !== 'select-role' && (
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${(getStepNumber() / totalSteps) * 100}%` }]} />
        </View>
      )}

      {/* Content */}
      {currentStep === 'select-role' && renderRoleSelection()}
      {currentStep === 'member-details' && renderMemberDetails()}
      {currentStep === 'permissions' && renderPermissions()}
      {currentStep === 'invite' && renderInvite()}

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
  progressBar: {
    height: 4,
    backgroundColor: '#1E293B',
    marginHorizontal: 20,
    borderRadius: 2,
    marginBottom: 16,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#6366F1',
    borderRadius: 2,
  },
  stepContent: {
    flex: 1,
    paddingHorizontal: 20,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  stepSubtitle: {
    fontSize: 15,
    color: '#94A3B8',
    marginBottom: 24,
  },
  roleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  roleIcon: {
    width: 64,
    height: 64,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  roleInfo: {
    flex: 1,
    marginLeft: 16,
    marginRight: 8,
  },
  roleTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  roleDescription: {
    fontSize: 13,
    color: '#94A3B8',
    lineHeight: 18,
  },
  divider: {
    height: 1,
    backgroundColor: '#334155',
    marginVertical: 24,
  },
  quickActionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#94A3B8',
    marginBottom: 12,
  },
  quickActionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  quickActionIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickActionInfo: {
    flex: 1,
    marginLeft: 12,
  },
  quickActionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  quickActionDescription: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  selectedRoleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
    gap: 8,
  },
  selectedRoleText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
    flex: 1,
  },
  changeRoleText: {
    fontSize: 14,
    color: '#6366F1',
    fontWeight: '500',
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94A3B8',
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#FFFFFF',
  },
  relationshipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  relationshipOption: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#1E293B',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  relationshipOptionActive: {
    borderColor: '#6366F1',
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
  },
  relationshipText: {
    fontSize: 14,
    color: '#94A3B8',
    fontWeight: '500',
  },
  relationshipTextActive: {
    color: '#6366F1',
  },
  continueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6366F1',
    borderRadius: 12,
    paddingVertical: 16,
    gap: 8,
    marginTop: 24,
    marginBottom: 32,
  },
  continueButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  permissionsList: {
    marginTop: 8,
  },
  permissionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
  },
  permissionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  permissionText: {
    marginLeft: 14,
    flex: 1,
  },
  permissionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  permissionDesc: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  toggle: {
    width: 48,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#334155',
    padding: 2,
    justifyContent: 'center',
  },
  toggleActive: {
    backgroundColor: '#6366F1',
  },
  toggleKnob: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
  },
  toggleKnobActive: {
    alignSelf: 'flex-end',
  },
  inviteCodeCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
  },
  inviteCodeLabel: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 8,
  },
  inviteCodeValue: {
    fontSize: 36,
    fontWeight: '700',
    color: '#6366F1',
    letterSpacing: 6,
    marginBottom: 8,
  },
  inviteCodeHint: {
    fontSize: 13,
    color: '#94A3B8',
  },
  summaryCard: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#94A3B8',
  },
  summaryValue: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  inviteMethodsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  inviteMethodsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  inviteMethodCard: {
    width: '48%',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  inviteMethodCardActive: {
    borderColor: '#6366F1',
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
  },
  inviteMethodText: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 8,
    fontWeight: '500',
  },
  inviteMethodTextActive: {
    color: '#6366F1',
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6366F1',
    borderRadius: 12,
    paddingVertical: 16,
    gap: 10,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  childModeInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginTop: 20,
    gap: 12,
  },
  childModeText: {
    flex: 1,
    fontSize: 13,
    color: '#10B981',
    lineHeight: 20,
  },
  doneButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#334155',
    borderRadius: 12,
    paddingVertical: 16,
    marginTop: 16,
    marginBottom: 32,
  },
  doneButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#94A3B8',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Download Info Card
  downloadInfoCard: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)',
  },
  downloadInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  downloadInfoTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#10B981',
  },
  downloadInfoText: {
    fontSize: 13,
    color: '#94A3B8',
    marginBottom: 12,
  },
  storeLinks: {
    flexDirection: 'row',
    gap: 12,
  },
  storeLink: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 8,
  },
  storeLinkText: {
    fontSize: 12,
    color: '#6366F1',
    fontWeight: '500',
  },
  // Invite Code Card improvements
  inviteCodeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  inviteCodeHeaderText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F59E0B',
  },
  codeInstructions: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  codeInstructionText: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
  },
});
