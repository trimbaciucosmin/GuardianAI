/**
 * Family Roles and Permissions System
 * 
 * Roles hierarchy:
 * - Owner: Full control, can delete circle, change all roles, transfer ownership
 * - Parent: Can manage members, edit places, view CHILDREN locations only
 * - Guardian: View children only, receives alerts, cannot edit
 * - Child: Tracked member, can see OWN location and Safe Trip only
 * 
 * ==================== IMPORTANT PRIVACY RULE ====================
 * Adults (Owner, Parent, Guardian) CANNOT see each other's location.
 * Adult location is only visible during:
 * - Active Safe Trip (contextual)
 * - SOS Emergency (contextual)
 * 
 * This ensures the app is a CHILD SAFETY tool, NOT adult surveillance.
 * There is NO toggle for "share my location with other parents".
 * =================================================================
 */

// Role types
export type FamilyRole = 'owner' | 'parent' | 'guardian' | 'child';

// Connection status (real-time)
export type ConnectionStatus = 'online' | 'offline';

// Setup/Account status (account state)
export type SetupStatus = 
  | 'invited'              // Invitation sent, not yet accepted
  | 'pending_connection'   // Accepted but device not connected
  | 'device_paired'        // Device connected but permissions missing
  | 'permissions_incomplete' // Missing required permissions
  | 'active';              // Fully set up and working

// Combined member status for display
export type MemberStatus = 
  | 'active'           // Fully connected and tracking
  | 'invited'          // Invitation sent, not yet accepted
  | 'pending'          // Accepted but not connected
  | 'device_paired'    // Device connected
  | 'permissions_incomplete' // Missing required permissions
  | 'offline';         // Was connected but currently offline

// Relationship types
export type Relationship = 
  | 'mother' 
  | 'father' 
  | 'son' 
  | 'daughter' 
  | 'guardian' 
  | 'grandparent'
  | 'aunt'
  | 'uncle'
  | 'sibling'
  | 'other';

// Permission definitions
export interface RolePermissions {
  // View permissions - PRIVACY: Adults cannot see other adults
  canViewChildrenLocation: boolean;  // View children's locations (main purpose)
  canViewAdultLocation: boolean;     // ALWAYS FALSE for normal viewing
  canViewOwnLocation: boolean;       // View OWN location
  canViewLocationHistory: boolean;
  canReceiveAlerts: boolean;
  canViewWeeklyReport: boolean;
  canViewActivityLog: boolean;
  canViewOwnSafeTrip: boolean;       // View own active Safe Trip
  
  // Edit permissions
  canEditSafePlaces: boolean;
  canEditSafeRoutes: boolean;
  canStartSafeTrip: boolean;
  
  // Management permissions
  canInviteMembers: boolean;
  canRemoveMembers: boolean;
  canChangeRoles: boolean;
  canRenameCircle: boolean;
  canDeleteCircle: boolean;
  canRegenerateInviteCode: boolean;
  
  // Admin permissions
  canTransferOwnership: boolean;
  canManagePermissions: boolean;
}

// Default permissions by role
// PRIVACY: canViewAdultLocation is ALWAYS false - adults don't monitor each other
export const ROLE_PERMISSIONS: Record<FamilyRole, RolePermissions> = {
  owner: {
    // View - CHILDREN only, NOT other adults
    canViewChildrenLocation: true,   // Main purpose: child safety
    canViewAdultLocation: false,     // PRIVACY: No adult surveillance
    canViewOwnLocation: true,
    canViewLocationHistory: true,
    canReceiveAlerts: true,
    canViewWeeklyReport: true,
    canViewActivityLog: true,
    canViewOwnSafeTrip: true,
    // Edit
    canEditSafePlaces: true,
    canEditSafeRoutes: true,
    canStartSafeTrip: true,
    // Management
    canInviteMembers: true,
    canRemoveMembers: true,
    canChangeRoles: true,
    canRenameCircle: true,
    canDeleteCircle: true,
    canRegenerateInviteCode: true,
    // Admin
    canTransferOwnership: true,
    canManagePermissions: true,
  },
  parent: {
    // View - CHILDREN only, NOT other adults
    canViewChildrenLocation: true,   // Main purpose: child safety
    canViewAdultLocation: false,     // PRIVACY: No adult surveillance
    canViewOwnLocation: true,
    canViewLocationHistory: true,
    canReceiveAlerts: true,
    canViewWeeklyReport: true,
    canViewActivityLog: true,
    canViewOwnSafeTrip: true,
    // Edit
    canEditSafePlaces: true,
    canEditSafeRoutes: true,
    canStartSafeTrip: true,
    // Management
    canInviteMembers: true,
    canRemoveMembers: true,
    canChangeRoles: false,
    canRenameCircle: false,
    canDeleteCircle: false,
    canRegenerateInviteCode: true,
    // Admin
    canTransferOwnership: false,
    canManagePermissions: false,
  },
  guardian: {
    // View - CHILDREN only, NOT other adults
    canViewChildrenLocation: true,   // Main purpose: child safety
    canViewAdultLocation: false,     // PRIVACY: No adult surveillance
    canViewOwnLocation: true,
    canViewLocationHistory: true,
    canReceiveAlerts: true,
    canViewWeeklyReport: true,
    canViewActivityLog: false,
    canViewOwnSafeTrip: true,
    // Edit
    canEditSafePlaces: false,
    canEditSafeRoutes: false,
    canStartSafeTrip: true,
    // Management
    canInviteMembers: false,
    canRemoveMembers: false,
    canChangeRoles: false,
    canRenameCircle: false,
    canDeleteCircle: false,
    canRegenerateInviteCode: false,
    // Admin
    canTransferOwnership: false,
    canManagePermissions: false,
  },
  child: {
    // View - Child can ONLY see OWN location and OWN Safe Trip
    canViewChildrenLocation: false,  // Cannot see other children
    canViewAdultLocation: false,     // Cannot see adults
    canViewOwnLocation: true,        // CAN see own location
    canViewLocationHistory: false,
    canReceiveAlerts: false,
    canViewWeeklyReport: false,
    canViewActivityLog: false,
    canViewOwnSafeTrip: true,        // CAN see own Safe Trip
    // Edit
    canEditSafePlaces: false,
    canEditSafeRoutes: false,
    canStartSafeTrip: false,
    // Management
    canInviteMembers: false,
    canRemoveMembers: false,
    canChangeRoles: false,
    canRenameCircle: false,
    canDeleteCircle: false,
    canRegenerateInviteCode: false,
    // Admin
    canTransferOwnership: false,
    canManagePermissions: false,
  },
};

// Role display info
export const ROLE_INFO: Record<FamilyRole, {
  label: string;
  labelRo: string;
  description: string;
  descriptionRo: string;
  color: string;
  icon: string;
  badgeColor: string;
}> = {
  owner: {
    label: 'Owner',
    labelRo: 'Proprietar',
    description: 'Full control of the family circle',
    descriptionRo: 'Control complet al cercului familiei',
    color: '#F59E0B',
    icon: 'shield-checkmark',
    badgeColor: 'rgba(245, 158, 11, 0.15)',
  },
  parent: {
    label: 'Parent',
    labelRo: 'Părinte',
    description: 'Can manage members and places',
    descriptionRo: 'Poate gestiona membrii și locurile',
    color: '#6366F1',
    icon: 'person',
    badgeColor: 'rgba(99, 102, 241, 0.15)',
  },
  guardian: {
    label: 'Guardian',
    labelRo: 'Gardian',
    description: 'Can view locations and receive alerts',
    descriptionRo: 'Poate vedea locațiile și primi alerte',
    color: '#8B5CF6',
    icon: 'eye',
    badgeColor: 'rgba(139, 92, 246, 0.15)',
  },
  child: {
    label: 'Child',
    labelRo: 'Copil',
    description: 'Tracked family member',
    descriptionRo: 'Membru urmărit al familiei',
    color: '#10B981',
    icon: 'happy',
    badgeColor: 'rgba(16, 185, 129, 0.15)',
  },
};

// Status display info
export const STATUS_INFO: Record<MemberStatus, {
  label: string;
  labelRo: string;
  color: string;
  icon: string;
}> = {
  active: {
    label: 'Active',
    labelRo: 'Activ',
    color: '#10B981',
    icon: 'checkmark-circle',
  },
  invited: {
    label: 'Invited',
    labelRo: 'Invitat',
    color: '#F59E0B',
    icon: 'mail',
  },
  pending: {
    label: 'Pending Connection',
    labelRo: 'În așteptare',
    color: '#F59E0B',
    icon: 'time',
  },
  device_paired: {
    label: 'Device Paired',
    labelRo: 'Dispozitiv conectat',
    color: '#3B82F6',
    icon: 'phone-portrait',
  },
  permissions_incomplete: {
    label: 'Permissions Needed',
    labelRo: 'Permisiuni necesare',
    color: '#EF4444',
    icon: 'alert-circle',
  },
  offline: {
    label: 'Offline',
    labelRo: 'Deconectat',
    color: '#64748B',
    icon: 'cloud-offline',
  },
};

// Relationship display info
export const RELATIONSHIP_INFO: Record<Relationship, {
  label: string;
  labelRo: string;
}> = {
  mother: { label: 'Mother', labelRo: 'Mamă' },
  father: { label: 'Father', labelRo: 'Tată' },
  son: { label: 'Son', labelRo: 'Fiu' },
  daughter: { label: 'Daughter', labelRo: 'Fiică' },
  guardian: { label: 'Guardian', labelRo: 'Gardian' },
  grandparent: { label: 'Grandparent', labelRo: 'Bunic/Bunică' },
  aunt: { label: 'Aunt', labelRo: 'Mătușă' },
  uncle: { label: 'Uncle', labelRo: 'Unchi' },
  sibling: { label: 'Sibling', labelRo: 'Frate/Soră' },
  other: { label: 'Other', labelRo: 'Altul' },
};

// Helper functions
export function getPermissionsForRole(role: FamilyRole): RolePermissions {
  return ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.child;
}

export function canPerformAction(
  userRole: FamilyRole,
  action: keyof RolePermissions
): boolean {
  const permissions = getPermissionsForRole(userRole);
  return permissions[action] ?? false;
}

export function getRoleLabel(role: FamilyRole, language: 'en' | 'ro' = 'en'): string {
  const info = ROLE_INFO[role];
  return language === 'ro' ? info.labelRo : info.label;
}

export function getStatusLabel(status: MemberStatus, language: 'en' | 'ro' = 'en'): string {
  const info = STATUS_INFO[status];
  return language === 'ro' ? info.labelRo : info.label;
}

export function getRelationshipLabel(relationship: Relationship, language: 'en' | 'ro' = 'en'): string {
  const info = RELATIONSHIP_INFO[relationship];
  return language === 'ro' ? info.labelRo : info.label;
}

// Get available roles that a user can assign
export function getAssignableRoles(userRole: FamilyRole): FamilyRole[] {
  switch (userRole) {
    case 'owner':
      return ['parent', 'guardian', 'child'];
    case 'parent':
      return ['guardian', 'child']; // Parents can only add guardians and children
    default:
      return [];
  }
}

// Check if user can change another member's role
export function canChangeRole(
  userRole: FamilyRole,
  targetCurrentRole: FamilyRole,
  targetNewRole: FamilyRole
): boolean {
  // Only owner can change roles
  if (userRole !== 'owner') {
    return false;
  }
  
  // Cannot change owner role (must transfer ownership instead)
  if (targetCurrentRole === 'owner') {
    return false;
  }
  
  // Cannot promote to owner (must transfer)
  if (targetNewRole === 'owner') {
    return false;
  }
  
  return true;
}

// Check if user can remove a member
export function canRemoveMember(
  userRole: FamilyRole,
  targetRole: FamilyRole
): boolean {
  // Owner can remove anyone except themselves
  if (userRole === 'owner') {
    return targetRole !== 'owner';
  }
  
  // Parent can remove guardians and children
  if (userRole === 'parent') {
    return targetRole === 'guardian' || targetRole === 'child';
  }
  
  return false;
}

// ===============================
// LOCATION VISIBILITY RULES
// ===============================

/**
 * Check if a member's location should be visible to the viewer
 * 
 * PRIVACY RULES:
 * - Adults (owner, parent, guardian) can see CHILDREN locations
 * - Adults CANNOT see other adults' locations normally
 * - Adult location visible only during: Safe Trip, SOS
 * - Children can only see their OWN location
 */
export function canViewMemberLocation(
  viewerRole: FamilyRole,
  targetRole: FamilyRole,
  targetHasActiveSafeTrip: boolean = false,
  targetHasActiveSOS: boolean = false
): boolean {
  // Child can only see own location (handled separately)
  if (viewerRole === 'child') {
    return false;
  }

  // Target is a child - adults can see children
  if (targetRole === 'child') {
    return true;
  }

  // Target is an adult (owner, parent, guardian)
  // Normally NOT visible, BUT visible during Safe Trip or SOS
  if (targetHasActiveSOS) {
    return true; // SOS overrides privacy for emergency
  }

  if (targetHasActiveSafeTrip) {
    return true; // Safe Trip allows tracking while active
  }

  // Default: Adults cannot see other adults
  return false;
}

/**
 * Get list of members whose location is visible to the viewer
 */
export function getVisibleMembers<T extends { role: FamilyRole; hasActiveSafeTrip?: boolean; hasActiveSOS?: boolean }>(
  viewerRole: FamilyRole,
  allMembers: T[]
): T[] {
  return allMembers.filter(member => 
    canViewMemberLocation(
      viewerRole, 
      member.role,
      member.hasActiveSafeTrip || false,
      member.hasActiveSOS || false
    )
  );
}

/**
 * Check if member is an adult role
 */
export function isAdultRole(role: FamilyRole): boolean {
  return role === 'owner' || role === 'parent' || role === 'guardian';
}

/**
 * Get privacy message for adult location visibility
 */
export function getAdultPrivacyMessage(language: 'en' | 'ro' = 'en'): {
  title: string;
  message: string;
  contextualNote: string;
} {
  if (language === 'ro') {
    return {
      title: 'Siguranța copiilor este prioritatea noastră',
      message: 'Guardian AI este dedicat siguranței copiilor. Locația adulților nu este vizibilă altor adulți.',
      contextualNote: 'Locația adulților devine vizibilă doar în timpul Safe Trip sau SOS.',
    };
  }
  
  return {
    title: 'Child safety is our priority',
    message: 'Guardian AI is dedicated to child safety. Adult location is not visible to other adults.',
    contextualNote: 'Adult location becomes visible only during Safe Trip or SOS.',
  };
}

// Determine member status based on various factors
export function determineMemberStatus(member: {
  hasAcceptedInvite?: boolean;
  hasConnectedDevice?: boolean;
  hasRequiredPermissions?: boolean;
  lastSeenAt?: string;
  isOnline?: boolean;
}): MemberStatus {
  // Check in order of priority
  if (!member.hasAcceptedInvite) {
    return 'invited';
  }
  
  if (!member.hasConnectedDevice) {
    return 'pending';
  }
  
  if (!member.hasRequiredPermissions) {
    return 'permissions_incomplete';
  }
  
  if (member.isOnline) {
    return 'active';
  }
  
  // If was connected but not online now
  if (member.lastSeenAt) {
    return 'offline';
  }
  
  return 'device_paired';
}

// ===============================
// PROTECTION & VALIDATION HELPERS
// ===============================

export interface CircleMemberInfo {
  id: string;
  userId: string;
  role: FamilyRole;
  setupStatus: SetupStatus;
}

export interface RemovalValidation {
  canRemove: boolean;
  reason?: string;
  reasonRo?: string;
  requiresDoubleConfirm?: boolean;
}

export interface CircleDeleteValidation {
  canDelete: boolean;
  reason?: string;
  reasonRo?: string;
  requiresDoubleConfirm: boolean;
}

export interface OwnerTransferValidation {
  canTransfer: boolean;
  eligibleRecipients: CircleMemberInfo[];
  reason?: string;
  reasonRo?: string;
}

/**
 * Check if a member can be removed from the circle
 * Protections:
 * - Cannot remove the last Owner
 * - Cannot leave circle without adult if active Child exists
 * - Requires double confirmation for removing Child
 */
export function validateMemberRemoval(
  members: CircleMemberInfo[],
  targetMember: CircleMemberInfo,
  currentUserRole: FamilyRole
): RemovalValidation {
  // Basic permission check
  if (!canRemoveMember(currentUserRole, targetMember.role)) {
    return {
      canRemove: false,
      reason: 'You do not have permission to remove this member',
      reasonRo: 'Nu ai permisiunea să elimini acest membru',
    };
  }

  // Protection: Cannot remove the last Owner
  const owners = members.filter(m => m.role === 'owner');
  if (targetMember.role === 'owner' && owners.length <= 1) {
    return {
      canRemove: false,
      reason: 'Cannot remove the last owner. Transfer ownership first.',
      reasonRo: 'Nu poți elimina ultimul proprietar. Transferă proprietatea mai întâi.',
    };
  }

  // Protection: Cannot leave circle without adult if active Child exists
  const adults = members.filter(m => m.role === 'owner' || m.role === 'parent');
  const activeChildren = members.filter(m => 
    m.role === 'child' && 
    (m.setupStatus === 'active' || m.setupStatus === 'device_paired')
  );

  // If removing an adult and there's only one adult left with active children
  if ((targetMember.role === 'owner' || targetMember.role === 'parent') && 
      adults.length <= 1 && 
      activeChildren.length > 0) {
    return {
      canRemove: false,
      reason: 'Cannot remove the last adult when there are active children in the circle.',
      reasonRo: 'Nu poți elimina ultimul adult când există copii activi în cerc.',
    };
  }

  // Requires double confirmation for removing Child
  if (targetMember.role === 'child') {
    return {
      canRemove: true,
      requiresDoubleConfirm: true,
    };
  }

  return { canRemove: true };
}

/**
 * Check if the circle can be deleted
 * Protections:
 * - Only Owner can delete
 * - Requires double confirmation always
 */
export function validateCircleDelete(
  members: CircleMemberInfo[],
  currentUserRole: FamilyRole
): CircleDeleteValidation {
  // Only owner can delete
  if (currentUserRole !== 'owner') {
    return {
      canDelete: false,
      reason: 'Only the owner can delete the family circle.',
      reasonRo: 'Doar proprietarul poate șterge cercul familiei.',
      requiresDoubleConfirm: false,
    };
  }

  // Check for active children (warning but can proceed)
  const activeChildren = members.filter(m => 
    m.role === 'child' && 
    (m.setupStatus === 'active' || m.setupStatus === 'device_paired')
  );

  if (activeChildren.length > 0) {
    return {
      canDelete: true,
      reason: `This will remove ${activeChildren.length} active child(ren) from tracking.`,
      reasonRo: `Aceasta va elimina ${activeChildren.length} copil(i) activ(i) din urmărire.`,
      requiresDoubleConfirm: true,
    };
  }

  return {
    canDelete: true,
    requiresDoubleConfirm: true,
  };
}

/**
 * Validate and get eligible recipients for ownership transfer
 */
export function validateOwnershipTransfer(
  members: CircleMemberInfo[],
  currentUserRole: FamilyRole,
  currentUserId: string
): OwnerTransferValidation {
  // Only owner can transfer
  if (currentUserRole !== 'owner') {
    return {
      canTransfer: false,
      eligibleRecipients: [],
      reason: 'Only the owner can transfer ownership.',
      reasonRo: 'Doar proprietarul poate transfera proprietatea.',
    };
  }

  // Find eligible recipients (Parents only, with active status)
  const eligibleRecipients = members.filter(m => 
    m.role === 'parent' && 
    m.userId !== currentUserId &&
    (m.setupStatus === 'active' || m.setupStatus === 'device_paired')
  );

  if (eligibleRecipients.length === 0) {
    return {
      canTransfer: false,
      eligibleRecipients: [],
      reason: 'No eligible parents to transfer ownership to. Add a parent first.',
      reasonRo: 'Nu există părinți eligibili pentru transfer. Adaugă mai întâi un părinte.',
    };
  }

  return {
    canTransfer: true,
    eligibleRecipients,
  };
}

/**
 * Check if user can leave the circle
 */
export function validateLeaveCircle(
  members: CircleMemberInfo[],
  currentMember: CircleMemberInfo
): RemovalValidation {
  // Owner cannot leave, must transfer first
  if (currentMember.role === 'owner') {
    const otherOwners = members.filter(m => m.role === 'owner' && m.userId !== currentMember.userId);
    if (otherOwners.length === 0) {
      return {
        canRemove: false,
        reason: 'Owner cannot leave the circle. Transfer ownership first or delete the circle.',
        reasonRo: 'Proprietarul nu poate părăsi cercul. Transferă proprietatea sau șterge cercul.',
      };
    }
  }

  // Adults cannot leave if they're the last adult with active children
  if (currentMember.role === 'owner' || currentMember.role === 'parent') {
    const otherAdults = members.filter(m => 
      (m.role === 'owner' || m.role === 'parent') && 
      m.userId !== currentMember.userId
    );
    const activeChildren = members.filter(m => 
      m.role === 'child' && 
      (m.setupStatus === 'active' || m.setupStatus === 'device_paired')
    );

    if (otherAdults.length === 0 && activeChildren.length > 0) {
      return {
        canRemove: false,
        reason: 'Cannot leave when you are the last adult with active children.',
        reasonRo: 'Nu poți părăsi cercul când ești ultimul adult cu copii activi.',
      };
    }
  }

  return { canRemove: true };
}

/**
 * Generate invite code
 */
export function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Get connection status text
 */
export function getConnectionStatusText(
  isOnline: boolean,
  lastSeenAt?: string | null,
  language: 'en' | 'ro' = 'en'
): string {
  if (isOnline) {
    return language === 'ro' ? 'Online' : 'Online';
  }
  
  if (!lastSeenAt) {
    return language === 'ro' ? 'Niciodată conectat' : 'Never connected';
  }

  const now = new Date();
  const then = new Date(lastSeenAt);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 1) {
    return language === 'ro' ? 'Acum' : 'Just now';
  }
  if (diffMins < 60) {
    return language === 'ro' ? `Acum ${diffMins} min` : `${diffMins}m ago`;
  }
  
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) {
    return language === 'ro' ? `Acum ${diffHours} ore` : `${diffHours}h ago`;
  }
  
  const diffDays = Math.floor(diffHours / 24);
  return language === 'ro' ? `Acum ${diffDays} zile` : `${diffDays}d ago`;
}

