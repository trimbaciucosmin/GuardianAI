import { create } from 'zustand';
import { Profile, FamilyCircle, CircleMember, Place, LiveLocation, AnomalyAlert, Notification, SOSEvent, MonitoredTrip, DeviceStatus, MapMember } from '../types';

// Auth Store
interface AuthState {
  user: any | null;
  profile: Profile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  setUser: (user: any) => void;
  setProfile: (profile: Profile | null) => void;
  setLoading: (loading: boolean) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  profile: null,
  isLoading: true,
  isAuthenticated: false,
  setUser: (user) => set({ user, isAuthenticated: !!user }),
  setProfile: (profile) => set({ profile }),
  setLoading: (isLoading) => set({ isLoading }),
  logout: () => set({ user: null, profile: null, isAuthenticated: false }),
}));

// Family Circle Store
interface CircleState {
  circles: FamilyCircle[];
  currentCircle: FamilyCircle | null;
  members: CircleMember[];
  setCircles: (circles: FamilyCircle[]) => void;
  setCurrentCircle: (circle: FamilyCircle | null) => void;
  setMembers: (members: CircleMember[]) => void;
  addCircle: (circle: FamilyCircle) => void;
  removeCircle: (id: string) => void;
}

export const useCircleStore = create<CircleState>((set) => ({
  circles: [],
  currentCircle: null,
  members: [],
  setCircles: (circles) => set({ circles }),
  setCurrentCircle: (currentCircle) => set({ currentCircle }),
  setMembers: (members) => set({ members }),
  addCircle: (circle) => set((state) => ({ circles: [...state.circles, circle] })),
  removeCircle: (id) => set((state) => ({ circles: state.circles.filter((c) => c.id !== id) })),
}));

// Location Store
interface LocationState {
  myLocation: LiveLocation | null;
  memberLocations: Map<string, LiveLocation>;
  mapMembers: MapMember[];
  setMyLocation: (location: LiveLocation | null) => void;
  updateMemberLocation: (userId: string, location: LiveLocation) => void;
  setMapMembers: (members: MapMember[]) => void;
  clearLocations: () => void;
}

export const useLocationStore = create<LocationState>((set) => ({
  myLocation: null,
  memberLocations: new Map(),
  mapMembers: [],
  setMyLocation: (myLocation) => set({ myLocation }),
  updateMemberLocation: (userId, location) =>
    set((state) => {
      const newMap = new Map(state.memberLocations);
      newMap.set(userId, location);
      return { memberLocations: newMap };
    }),
  setMapMembers: (mapMembers) => set({ mapMembers }),
  clearLocations: () => set({ myLocation: null, memberLocations: new Map(), mapMembers: [] }),
}));

// Places Store
interface PlacesState {
  places: Place[];
  setPlaces: (places: Place[]) => void;
  addPlace: (place: Place) => void;
  updatePlace: (id: string, place: Partial<Place>) => void;
  removePlace: (id: string) => void;
}

export const usePlacesStore = create<PlacesState>((set) => ({
  places: [],
  setPlaces: (places) => set({ places }),
  addPlace: (place) => set((state) => ({ places: [...state.places, place] })),
  updatePlace: (id, updates) =>
    set((state) => ({
      places: state.places.map((p) => (p.id === id ? { ...p, ...updates } : p)),
    })),
  removePlace: (id) => set((state) => ({ places: state.places.filter((p) => p.id !== id) })),
}));

// Alerts Store
interface AlertsState {
  alerts: AnomalyAlert[];
  unreadCount: number;
  setAlerts: (alerts: AnomalyAlert[]) => void;
  addAlert: (alert: AnomalyAlert) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
}

export const useAlertsStore = create<AlertsState>((set) => ({
  alerts: [],
  unreadCount: 0,
  setAlerts: (alerts) => set({ alerts, unreadCount: alerts.filter((a) => !a.is_read).length }),
  addAlert: (alert) =>
    set((state) => ({
      alerts: [alert, ...state.alerts],
      unreadCount: state.unreadCount + 1,
    })),
  markAsRead: (id) =>
    set((state) => {
      const alerts = state.alerts.map((a) => (a.id === id ? { ...a, is_read: true } : a));
      return { alerts, unreadCount: alerts.filter((a) => !a.is_read).length };
    }),
  markAllAsRead: () =>
    set((state) => ({
      alerts: state.alerts.map((a) => ({ ...a, is_read: true })),
      unreadCount: 0,
    })),
}));

// Notifications Store
interface NotificationsState {
  notifications: Notification[];
  unreadCount: number;
  setNotifications: (notifications: Notification[]) => void;
  addNotification: (notification: Notification) => void;
  markAsRead: (id: string) => void;
}

export const useNotificationsStore = create<NotificationsState>((set) => ({
  notifications: [],
  unreadCount: 0,
  setNotifications: (notifications) =>
    set({ notifications, unreadCount: notifications.filter((n) => !n.is_read).length }),
  addNotification: (notification) =>
    set((state) => ({
      notifications: [notification, ...state.notifications],
      unreadCount: state.unreadCount + 1,
    })),
  markAsRead: (id) =>
    set((state) => {
      const notifications = state.notifications.map((n) =>
        n.id === id ? { ...n, is_read: true } : n
      );
      return { notifications, unreadCount: notifications.filter((n) => !n.is_read).length };
    }),
}));

// SOS Store
interface SOSState {
  activeSOSEvents: SOSEvent[];
  myActivesSOS: SOSEvent | null;
  setActiveSOSEvents: (events: SOSEvent[]) => void;
  setMyActiveSOS: (event: SOSEvent | null) => void;
  addSOSEvent: (event: SOSEvent) => void;
  removeSOSEvent: (id: string) => void;
}

export const useSOSStore = create<SOSState>((set) => ({
  activeSOSEvents: [],
  myActivesSOS: null,
  setActiveSOSEvents: (activeSOSEvents) => set({ activeSOSEvents }),
  setMyActiveSOS: (myActivesSOS) => set({ myActivesSOS }),
  addSOSEvent: (event) =>
    set((state) => ({ activeSOSEvents: [event, ...state.activeSOSEvents] })),
  removeSOSEvent: (id) =>
    set((state) => ({ activeSOSEvents: state.activeSOSEvents.filter((e) => e.id !== id) })),
}));

// Trip Store
interface TripState {
  activeTrips: MonitoredTrip[];
  myActiveTrip: MonitoredTrip | null;
  setActiveTrips: (trips: MonitoredTrip[]) => void;
  setMyActiveTrip: (trip: MonitoredTrip | null) => void;
  addTrip: (trip: MonitoredTrip) => void;
  updateTrip: (id: string, updates: Partial<MonitoredTrip>) => void;
}

export const useTripStore = create<TripState>((set) => ({
  activeTrips: [],
  myActiveTrip: null,
  setActiveTrips: (activeTrips) => set({ activeTrips }),
  setMyActiveTrip: (myActiveTrip) => set({ myActiveTrip }),
  addTrip: (trip) => set((state) => ({ activeTrips: [trip, ...state.activeTrips] })),
  updateTrip: (id, updates) =>
    set((state) => ({
      activeTrips: state.activeTrips.map((t) => (t.id === id ? { ...t, ...updates } : t)),
    })),
}));

// Device Status Store
interface DeviceState {
  myDeviceStatus: DeviceStatus | null;
  memberDeviceStatus: Map<string, DeviceStatus>;
  setMyDeviceStatus: (status: DeviceStatus | null) => void;
  updateMemberDeviceStatus: (userId: string, status: DeviceStatus) => void;
}

export const useDeviceStore = create<DeviceState>((set) => ({
  myDeviceStatus: null,
  memberDeviceStatus: new Map(),
  setMyDeviceStatus: (myDeviceStatus) => set({ myDeviceStatus }),
  updateMemberDeviceStatus: (userId, status) =>
    set((state) => {
      const newMap = new Map(state.memberDeviceStatus);
      newMap.set(userId, status);
      return { memberDeviceStatus: newMap };
    }),
}));
