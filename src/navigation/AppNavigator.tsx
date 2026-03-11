import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";

import HomeScreen from "../screens/HomeScreen";
import AttendanceHistoryScreen from "../screens/AttendanceHistoryScreen";

export type RootTabParamList = {
  Home: undefined;
  History: undefined;
};

const Tab = createBottomTabNavigator<RootTabParamList>();

const AppNavigator: React.FC = () => {
  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarIcon: ({ color, size }) => {
            let iconName: keyof typeof Ionicons.glyphMap = "home";

            if (route.name === "Home") {
              iconName = "location";
            } else if (route.name === "History") {
              iconName = "time";
            }

            return <Ionicons name={iconName} size={size} color={color} />;
          },
        })}
      >
        <Tab.Screen name="Home" component={HomeScreen} />
        <Tab.Screen name="History" component={AttendanceHistoryScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;