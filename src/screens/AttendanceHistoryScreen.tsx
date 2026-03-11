import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, FlatList, RefreshControl } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import {
  AttendanceRecord,
  getAttendanceRecords,
} from "../storage/attendanceStorage";

const AttendanceHistoryScreen: React.FC = () => {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const data = await getAttendanceRecords();
    setRecords(data);
  }, []);

  useEffect(() => {
    const init = async () => {
      await load();
      setLoading(false);
    };
    init();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      // Reload when the user switches to History tab
      load();
    }, [load])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  

 return (
  <View style={styles.container}>
    <View style={styles.header}>
      <Text style={styles.headerTitle}>Attendance History</Text>
    </View>

    {loading ? (
      <Text style={styles.helper}>Loading records...</Text>
    ) : records.length === 0 ? (
      <Text style={styles.helper}>No attendance records yet.</Text>
    ) : (
      <FlatList
        data={records}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={{ padding: 16 }}
        renderItem={({ item }) => {
          const date = new Date(item.timestamp);
          return (
            <View style={styles.card}>
              <View style={styles.row}>
                <Text style={styles.status}>{item.status}</Text>
                <Text style={styles.time}>{date.toLocaleString()}</Text>
              </View>

              <View style={styles.divider} />

              <View style={styles.row}>
                <Text style={styles.label}>Latitude:</Text>
                <Text style={styles.value}>{item.latitude.toFixed(5)}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>Longitude:</Text>
                <Text style={styles.value}>{item.longitude.toFixed(5)}</Text>
              </View>
            </View>
          );
        }}
      />
    )}
  </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f1f5f9",
  },

  header: {
    paddingTop: 50,
    paddingBottom: 16,
    alignItems: "center",
    backgroundColor: "#4f46e5",
  },

  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#fff",
  },

  helper: {
    textAlign: "center",
    marginTop: 20,
    fontSize: 13,
    color: "#6b7280",
  },

  card: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 14,
    marginBottom: 12,
    elevation: 3,
  },

  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },

  status: {
    fontWeight: "700",
    color: "#16a34a",
    fontSize: 14,
  },

  time: {
    fontSize: 12,
    color: "#374151",
  },

  divider: {
    height: 1,
    backgroundColor: "#e5e7eb",
    marginVertical: 8,
  },

  label: {
    fontSize: 13,
    color: "#6b7280",
    fontWeight: "500",
  },

  value: {
    fontSize: 13,
    color: "#111827",
    fontWeight: "600",
  },
});

export default AttendanceHistoryScreen;

