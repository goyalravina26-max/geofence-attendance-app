import AsyncStorage from '@react-native-async-storage/async-storage';
import { ATTENDANCE_STORAGE_KEY } from '../constants/officeLocation';

export type AttendanceStatus = "CHECK_IN" | "CHECK_OUT";

export interface AttendanceRecord {
  id: string;
  timestamp: string;
  latitude: number;
  longitude: number;
  status: AttendanceStatus;
}

export const getLatestAttendanceRecord = async (): Promise<AttendanceRecord | null> => {
  const records = await getAttendanceRecords();
  return records.length > 0 ? records[0] : null;
};

export const isCurrentlyCheckedIn = async (): Promise<boolean> => {
  const latest = await getLatestAttendanceRecord();
  return latest?.status === "CHECK_IN";
};

export const getAttendanceRecords = async (): Promise<AttendanceRecord[]> => {
  try {
    const data = await AsyncStorage.getItem(ATTENDANCE_STORAGE_KEY);
    if (!data) return [];
    return JSON.parse(data) as AttendanceRecord[];
  } catch {
    return [];
  }
};

export const addAttendanceRecord = async (
  record: AttendanceRecord
): Promise<void> => {
  try {
    const existing = await getAttendanceRecords();
    const updated = [record, ...existing];
    await AsyncStorage.setItem(
      ATTENDANCE_STORAGE_KEY,
      JSON.stringify(updated)
    );
  } catch (e) {
    console.error("Failed to save attendance record", e);
    throw e;
  }
};