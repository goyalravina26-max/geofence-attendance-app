import { getDistance } from 'geolib';
import { OFFICE_LOCATION, GEOFENCE_RADIUS_METERS } from '../constants/officeLocation';

export const isInsideGeofence = (latitude: number, longitude: number): boolean => {
  const distance = getDistance(
    { latitude, longitude },
    { latitude: OFFICE_LOCATION.latitude, longitude: OFFICE_LOCATION.longitude }
  );

  return distance <= GEOFENCE_RADIUS_METERS;
};

export const getDistanceFromOffice = (latitude: number, longitude: number): number => {
  return getDistance(
    { latitude, longitude },
    { latitude: OFFICE_LOCATION.latitude, longitude: OFFICE_LOCATION.longitude }
  );
};