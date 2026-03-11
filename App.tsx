import React from "react";
import { StatusBar } from "expo-status-bar";
import AppNavigator from "./src/navigation/AppNavigator";

const App: React.FC = () => {
  return (
    <>
      <AppNavigator />
      <StatusBar style="auto" />
    </>
  );
};

export default App;