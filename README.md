# Geofence Attendance App

A React Native mobile application that demonstrates **real-time location tracking** and a **geofence-based attendance system**.  
Users can mark attendance only when they are inside the predefined office geofence area.

## Features

- Real-time GPS location tracking
- Map view showing user and office location
- Geofence detection with 100m radius
- Check-In / Check-Out attendance system
- Attendance history screen
- Local storage using AsyncStorage
- Location permission handling
- GPS disabled detection with settings redirect
- Works even when internet is unavailable

## Tech Stack

- React Native (Expo)
- React Native Maps
- Expo Location
- AsyncStorage
- Geolib
- React Navigation

## Installation

```bash
git clone https://github.com/goyalravina26-max/geofence-attendance-app.git
cd geofence-attendance-app
npm install
npx expo start
