import { Stack } from "expo-router";

export default function NgoLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="food" />
      <Stack.Screen name="books" />
      <Stack.Screen name="volunteer" />
      <Stack.Screen name="notifications" />
    </Stack>
  );
}
