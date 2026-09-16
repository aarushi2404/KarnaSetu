import { Stack } from "expo-router";

export default function CompanyLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="log-engagement" />
      <Stack.Screen name="impact-report" />
    </Stack>
  );
}