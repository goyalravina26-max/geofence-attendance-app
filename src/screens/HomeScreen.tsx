import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, Alert } from 'react-native';
import MapView, { Circle, Marker, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import * as Location from 'expo-location';
import {
  checkLocationServicesEnabled,
  requestLocationPermission,
  watchUserLocation,
} from '../services/locationService';
import { isInsideGeofence } from '../utils/geofence';
import { OFFICE_LOCATION, GEOFENCE_RADIUS_METERS } from '../constants/officeLocation';
import CheckInButton from "../components/CheckInButton";
import {
  addAttendanceRecord,
  AttendanceRecord,
  isCurrentlyCheckedIn,
} from "../storage/attendanceStorage";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { MaterialIcons } from "@expo/vector-icons";

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
    let unsubscribe: (() => void) | undefined;

    const init = async () => {
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

        const granted = await requestLocationPermission();
        if (!granted) {
          setState(prev => ({
            ...prev,
            permissionGranted: false,
            loading: false,
            error: 'Location permission not granted.',
          }));
          return;
        }

        unsubscribe = await watchUserLocation(
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
          },
          (e) => {
            setState(prev => ({
              ...prev,
              loading: false,
              error: e?.message || 'Error watching location.',
            }));
          }
        );
      } catch (e: any) {
        setState(prev => ({
          ...prev,
          loading: false,
          error: e?.message || 'Unexpected error initializing location.',
        }));
      }
    };

    init();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const { location, insideGeofence, gpsEnabled, permissionGranted, loading, error } = state;

  const latitude = location?.coords.latitude ?? null;
  const longitude = location?.coords.longitude ?? null;

  const hasLocation = latitude != null && longitude != null;

  const region: Region | undefined = hasLocation
    ? {
        latitude: latitude!,
        longitude: longitude!,
        latitudeDelta: 0.002,
        longitudeDelta: 0.002,
      }
    : undefined;

  const disabledReason =
    !gpsEnabled
      ? 'GPS is disabled.'
      : !permissionGranted
      ? 'Location permission not granted.'
      : !insideGeofence
      ? 'You are outside the office geofence.'
      : null;

  const handleAttendanceAction = useCallback(async () => {
    if (!location) {
      Alert.alert('Location not ready', 'Please wait for current location.');
      return;
    }
    if (!insideGeofence) {
      Alert.alert(
        "Outside geofence",
        "You must be inside the office geofence to check in/out."
      );
      return;
    }

    try {
      setSaving(true);
      const record: AttendanceRecord = {
        id: `${Date.now()}`,
        timestamp: new Date().toISOString(),
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        status: checkedIn ? "CHECK_OUT" : "CHECK_IN",
      };
      await addAttendanceRecord(record);
      setCheckedIn(!checkedIn);
      Alert.alert(
        "Success",
        checkedIn ? "Checked out successfully." : "Checked in successfully."
      );
    } catch (e: any) {
      console.error("Error in handleCheckIn", e);
      Alert.alert(
        "Error",
        e?.message ? `Failed to save attendance: ${e.message}` : "Failed to save attendance record."
      );
    } finally {
      setSaving(false);
    }
  }, [location, insideGeofence, checkedIn]);

  return (
    <View style={styles.container}>

    <View style={styles.header}>
      <Text style={styles.headerTitle}>Office Attendance</Text>
    </View>

      {!gpsEnabled && (
        <Text style={styles.warning}>
          GPS is disabled. Please enable Location Services in device settings.
        </Text>
      )}

      {error ? <Text style={styles.warning}>{error}</Text> : null}

      <View style={styles.mapContainer}>
        {hasLocation && region ? (
          <MapView
            style={styles.map}
            provider={PROVIDER_GOOGLE}
            region={region}
          >
          <Circle
            center={OFFICE_LOCATION}
            radius={GEOFENCE_RADIUS_METERS}
            strokeColor={insideGeofence ? 'rgba(22,163,74,0.9)' : 'rgba(220,38,38,0.9)'}
            fillColor={insideGeofence ? 'rgba(22,163,74,0.2)' : 'rgba(220,38,38,0.2)'}
          />

            <Marker coordinate={OFFICE_LOCATION} title="Office">
              <MaterialIcons name="business" size={30} color="#2563eb" />
            </Marker>
            
            <Marker
              coordinate={{ latitude: latitude!, longitude: longitude! }}
              title="You"
              pinColor={insideGeofence ? 'green' : 'red'}
            />
          </MapView>
        ) : (
          <View style={styles.mapPlaceholder}>
            <Text style={styles.placeholderText}>Waiting for location...</Text>
          </View>
        )}
       </View>

    <View style={styles.card}>

      <Text style={styles.sectionTitle}>Current Location</Text>
      <Text style={styles.coords}>
        {latitude && longitude
          ? `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`
          : 'Fetching location...'}
      </Text>

      <View style={styles.divider} />

      <Text style={styles.sectionTitle}>Office Location</Text>
      <Text style={styles.officeText}>Geofence Radius: 100m</Text>

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

    </View>
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