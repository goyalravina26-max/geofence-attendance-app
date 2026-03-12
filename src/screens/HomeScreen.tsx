import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Alert, Pressable, Linking, Platform, ScrollView, AppState, AppStateStatus } from 'react-native';
import MapView, { Circle, Marker, Region } from 'react-native-maps';
import * as Location from 'expo-location';
import {
  checkLocationServicesEnabled,
  requestLocationPermission,
} from '../services/locationService';
import { isInsideGeofence,getDistanceFromOffice  } from '../utils/geofence';
import { OFFICE_LOCATION, GEOFENCE_RADIUS_METERS } from '../constants/officeLocation';
import CheckInButton from "../components/CheckInButton";
import {
  addAttendanceRecord,
  AttendanceRecord,
  isCurrentlyCheckedIn,
} from "../storage/attendanceStorage";

interface GeofencedLocationState {
  location: Location.LocationObject | null;
  insideGeofence: boolean;
  permissionGranted: boolean;
  gpsEnabled: boolean;
  loading: boolean;
  error: string | null;
}

const HomeScreen: React.FC = () => {
  const [state, setState] = useState<GeofencedLocationState>({
    location: null,
    insideGeofence: false,
    permissionGranted: false,
    gpsEnabled: true,
    loading: true,
    error: null,
  });

  const [saving, setSaving] = useState(false);
  const [checkedIn, setCheckedIn] = useState(false);

  const lastAppStateRef = useRef<AppStateStatus>(AppState.currentState as AppStateStatus);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshInFlightRef = useRef(false);
  const subscriptionRef = useRef<Location.LocationSubscription | null>(null);
  const settingsReturnRefreshRef = useRef(false);
  const requestedOnceRef = useRef(false);

  useEffect(() => {
    const loadStatus = async () => {
      try {
        const status = await isCurrentlyCheckedIn();
        setCheckedIn(status);
      } catch (e) {
        console.warn("Failed to load attendance status", e);
      }
    };

    loadStatus();
  }, []);

 useEffect(() => {
  const stopWatching = () => {
    if (subscriptionRef.current) {
      subscriptionRef.current.remove();
      subscriptionRef.current = null;
    }
  };

  const initOrRefresh = async (allowPrompt: boolean) => {
    if (refreshInFlightRef.current) return;
    refreshInFlightRef.current = true;
    stopWatching();

    try {
      const servicesEnabled = await checkLocationServicesEnabled();
      if (!servicesEnabled) {
        setState(prev => ({
          ...prev,
          gpsEnabled: false,
          loading: false,
          error: 'Location services (GPS) are disabled.',
        }));
        return;
      }

      // If user enabled permission from Settings, refresh current status.
      const currentPerm = await Location.getForegroundPermissionsAsync();
      const alreadyGranted =
        currentPerm.status === Location.PermissionStatus.GRANTED ||
        currentPerm.granted === true;

      let granted = alreadyGranted;
      if (!granted && allowPrompt && !requestedOnceRef.current) {
        requestedOnceRef.current = true;
        granted = await requestLocationPermission();
      }
      if (!granted) {
        setState(prev => ({
          ...prev,
          permissionGranted: false,
          loading: false,
          error: 'Location permission not granted.',
        }));
        return;
      }

      setState(prev => ({
        ...prev,
        permissionGranted: true,
        gpsEnabled: true,
        loading: true,
        error: null,
      }));

      subscriptionRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          distanceInterval: 5,
        },
        (location) => {
          const { latitude, longitude } = location.coords;
          const inside = isInsideGeofence(latitude, longitude);

          setState({
            location,
            insideGeofence: inside,
            permissionGranted: true,
            gpsEnabled: true,
            loading: false,
            error: null,
          });
        }
      );
    } catch (e: any) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: e?.message || 'Unexpected error initializing location.',
      }));
    } finally {
      refreshInFlightRef.current = false;
    }
  };

  initOrRefresh(true);

  const onAppStateChange = (nextState: AppStateStatus) => {
    // Refresh only when returning to foreground (prevents repeated flicker/blink).
    const prevState = lastAppStateRef.current;
    lastAppStateRef.current = nextState;

    if ((prevState === 'background' || prevState === 'inactive') && nextState === 'active') {
      if (!settingsReturnRefreshRef.current) return;
      settingsReturnRefreshRef.current = false;
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = setTimeout(() => {
        initOrRefresh(false);
      }, 350);
    }
  };

  const appStateSub = AppState.addEventListener('change', onAppStateChange);

  return () => {
    appStateSub.remove();
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    stopWatching();
  };
}, []);

  const { location, insideGeofence, gpsEnabled, permissionGranted, loading, error } = state;

  const latitude = location?.coords.latitude ?? null;
  const longitude = location?.coords.longitude ?? null;

  const hasLocation = latitude != null && longitude != null;
  const distance = hasLocation
  ? getDistanceFromOffice(latitude!, longitude!)
  : null;

  const region: Region | undefined = hasLocation ? {
      latitude: latitude!,
      longitude: longitude!,
      latitudeDelta: 0.002,
      longitudeDelta: 0.002,
    }
  : undefined;

  let disabledReason: string | null = null;

  if (!gpsEnabled) {
    disabledReason = "GPS is disabled.";
  } else if (!permissionGranted) {
    disabledReason = "Location permission not granted.";
  } else if (!insideGeofence) {
    disabledReason = "You are outside the office geofence.";
  }

  const handleAttendanceAction = useCallback(() => {
  if (!location) {
    Alert.alert("Location not ready", "Please wait for current location.");
    return;
  }

  if (!insideGeofence) {
    Alert.alert(
      "Outside geofence",
      "You must be inside the office geofence to check in/out."
    );
    return;
  }

  const action = checkedIn ? "Check Out" : "Check In";

  Alert.alert(
    checkedIn ? "Confirm Check Out" : "Confirm Check In",
    `Are you sure you want to ${action}?`,
    [
      {
        text: "Cancel",
        style: "cancel",
      },
      {
        text: action,
        onPress: async () => {
          try {
            setSaving(true);

            const record: AttendanceRecord = {
              id: Date.now().toString(),
              timestamp: new Date().toISOString(),
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
              status: checkedIn ? "CHECK_OUT" : "CHECK_IN",
            };

            await addAttendanceRecord(record);

            setCheckedIn(!checkedIn);

            Alert.alert(
              "Success",
              checkedIn
                ? "Checked out successfully."
                : "Checked in successfully."
            );
          } catch (e: any) {
            Alert.alert(
              "Error",
              e?.message
                ? `Failed to save attendance: ${e.message}`
                : "Failed to save attendance record."
            );
          } finally {
            setSaving(false);
          }
        },
      },
    ]
  );
}, [location, insideGeofence, checkedIn]);

  return (
    <ScrollView style={styles.container}>

    <View style={styles.header}>
      <Text style={styles.headerTitle}>Office Attendance</Text>
    </View>

      {!gpsEnabled && (
        <Text style={styles.warning}>
          GPS is disabled. Please enable Location Services in device settings.
        </Text>
      )}

      {error ? <Text style={styles.warning}>{error}</Text> : null}

      {!permissionGranted && !loading && (
        <Pressable
          style={styles.settingsButton}
          onPress={() => {
            settingsReturnRefreshRef.current = true;
            Linking.openSettings().catch(() => {
              Alert.alert(
                'Open Settings',
                Platform.select({
                  ios: 'Please open Settings > Privacy > Location Services and enable location for this app.',
                  android: 'Please open Settings > Apps > Attendance App and enable Location permission.',
                  default: 'Please open system settings and enable location permission for this app.',
                }) as string
              );
            });
          }}
        >
          <Text style={styles.settingsButtonText}>Open App Settings</Text>
        </Pressable>
      )}

      <View style={styles.mapContainer}>
        {hasLocation && region ? (
          <MapView
            style={styles.map}
            initialRegion={{
              ...OFFICE_LOCATION,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            }}
            {...(region ? { region } : {})}
          >
            <Circle
              center={OFFICE_LOCATION}
              radius={GEOFENCE_RADIUS_METERS}
              strokeColor={insideGeofence ? 'rgba(22,163,74,0.9)' : 'rgba(220,38,38,0.9)'}
              fillColor={insideGeofence ? 'rgba(22,163,74,0.2)' : 'rgba(220,38,38,0.2)'}
            />

            <Marker coordinate={OFFICE_LOCATION} title="Office">
                <Text style={styles.markerText}>🏢</Text>
              </Marker>
            
           {hasLocation  && (
              <Marker
                coordinate={{ latitude: latitude!, longitude: longitude! }}
                title="You"
                pinColor={insideGeofence ? "green" : "red"}
              />
            )}
          </MapView>
        ) : (
          <View style={styles.mapPlaceholder}>
            <Text style={styles.placeholderText}>Waiting for location...</Text>
          </View>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Office Location</Text>
        <Text style={styles.officeText}>Geofence Radius: 100m</Text>
         <View style={styles.divider} />
          {distance !== null && (
          <>
          <Text style={styles.sectionTitle}>Distance from Office</Text>
          <Text style={styles.officeText}>{distance} meters</Text>
          </>
          )}
        <View style={styles.statusContainer}>
        <Text style={styles.statusLabel}>Status:</Text>

        <Text
          style={[
            styles.statusBadge,
            insideGeofence ? styles.statusInside : styles.statusOutside,
          ]}
        >
          {insideGeofence ? 'Inside Geofence' : 'Outside Geofence'}
        </Text>
      </View>
    </View>

      <CheckInButton
        loading={loading}
        saving={saving}
        disabled={loading || saving || !insideGeofence || !gpsEnabled || !permissionGranted}
        disabledReason={disabledReason}
        title={checkedIn ? "Check Out" : "Check In"}
        savingTitle={checkedIn ? "Checking out..." : "Checking in..."}
        onPress={handleAttendanceAction}
        backgroundColor={checkedIn ? "#ef4444" : "#22c55e"}
      />

      <Text style={styles.offlineNote}>
        Note: Attendance is stored locally and works offline. Map tiles may not load without
        internet.
      </Text>

    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f1f5f9',
  },

  header: {
    paddingTop: 50,
    paddingBottom: 16,
    alignItems: 'center',
    backgroundColor: '#4f46e5',
  },

  headerTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },

  warning: {
    color: '#dc2626',
    fontSize: 13,
    marginHorizontal: 16,
    marginTop: 8,
  },

  settingsButton: {
    marginHorizontal: 16,
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#2563eb',
    alignSelf: 'flex-start',
  },

  settingsButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },

  mapContainer: {
    height: 320,
    margin: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },

  map: {
    flex: 1,
  },

  mapPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#e5e7eb',
  },

  placeholderText: {
    color: '#6b7280',
  },

  card: {
    marginHorizontal: 16,
    padding: 16,
    borderRadius: 14,
    backgroundColor: '#fff',
    elevation: 4,
  },

  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },

  coords: {
    fontSize: 15,
    marginTop: 4,
    fontWeight: '500',
  },

  officeText: {
    fontSize: 14,
    marginTop: 4,
    color: '#6b7280',
  },

  divider: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginVertical: 12,
  },

  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },

  statusLabel: {
    fontSize: 14,
    marginRight: 8,
  },

  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },

  statusInside: {
    backgroundColor: '#16a34a',
  },

  statusOutside: {
    backgroundColor: '#dc2626',
  },

  offlineNote: {
    textAlign: 'center',
    marginTop: 12,
    fontSize: 11,
    color: '#6b7280',
  },
  officeMarker: {
  backgroundColor: "#2563eb",
  padding: 8,
  borderRadius: 20,
  },
markerText: {
  fontSize: 16,
  color: "#fff",
}
});

export default HomeScreen;