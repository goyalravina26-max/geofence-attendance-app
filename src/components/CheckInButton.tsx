import React from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from "react-native";

interface Props {
  loading: boolean;
  saving: boolean;
  disabled: boolean;
  disabledReason: string | null;
  title: string;
  savingTitle?: string;
  backgroundColor: string;
  onPress: () => void;
}

const CheckInButton: React.FC<Props> = ({
  loading,
  saving,
  disabled,
  disabledReason,
  title,
  savingTitle,
  backgroundColor,
  onPress,
}) => {
  const buttonText =
    loading ? "Initializing..." : saving ? savingTitle ?? "Saving..." : title;

  return (
    <View style={styles.container}>
      <Pressable
        onPress={onPress}
        disabled={disabled}
        style={({ pressed }) => [
          styles.button,
          { backgroundColor },
          (disabled || loading || saving) && styles.buttonDisabled,
          pressed && !disabled && !loading && !saving && styles.buttonPressed,
        ]}
        accessibilityRole="button"
      >
        {saving ? (
          <View style={styles.row}>
            <ActivityIndicator color="#fff" />
            <Text style={styles.buttonText}>{buttonText}</Text>
          </View>
        ) : (
          <Text style={styles.buttonText}>{buttonText}</Text>
        )}
      </Pressable>
      {disabledReason ? <Text style={styles.helper}>{disabledReason}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { marginTop: 16 },
  button: {
    height: 48,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  buttonPressed: {
    opacity: 0.9,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  helper: { marginTop: 8, fontSize: 12, color: '#b45309',marginHorizontal: 12, },
});

export default CheckInButton;