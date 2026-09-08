import { Stack } from "expo-router";

export default function UserLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="create-post" />
      <Stack.Screen name="ngos" />
      <Stack.Screen name="food" />
      <Stack.Screen name="books" />
      <Stack.Screen name="volunteer" />
      <Stack.Screen name="notifications" />
    </Stack>
  );
}
