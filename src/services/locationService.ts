import * as Location from 'expo-location';

export const requestLocationPermission = async (): Promise<boolean> => {
  const { status } = await Location.requestForegroundPermissionsAsync();
  return status === Location.PermissionStatus.GRANTED;
};

export const checkLocationServicesEnabled = async (): Promise<boolean> => {
  return Location.hasServicesEnabledAsync();
};

export const watchUserLocation = async (
  onLocation: (location: Location.LocationObject) => void,
  onError: (error: Error) => void
): Promise<() => void> => {
  try {
    const subscription = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: 3000,
        distanceInterval: 5,
      },
      onLocation
    );

    return () => {
      subscription.remove();
    };
  } catch (e: any) {
    onError(e);
    return () => {};
  }
};