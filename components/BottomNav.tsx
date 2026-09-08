import { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter, usePathname } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";

interface Tab {
  label: string;
  icon: string;
  path: string;
}

const USER_TABS: Tab[] = [
  { label: "Feed", icon: "🏠", path: "/(user)" },
  { label: "Food", icon: "🍲", path: "/(user)/food" },
  { label: "Books", icon: "📚", path: "/(user)/books" },
  { label: "Volunteer", icon: "🤝", path: "/(user)/volunteer" },
  { label: "Alerts", icon: "🔔", path: "/(user)/notifications" },
];

const NGO_TABS: Tab[] = [
  { label: "Home", icon: "🏠", path: "/(ngo)" },
  { label: "Food", icon: "🍲", path: "/(ngo)/food" },
  { label: "Books", icon: "📚", path: "/(ngo)/books" },
  { label: "Volunteer", icon: "🤝", path: "/(ngo)/volunteer" },
  { label: "Alerts", icon: "🔔", path: "/(ngo)/notifications" },
];

export default function BottomNav({ variant }: { variant: "user" | "ngo" }) {
  const router = useRouter();
  const pathname = usePathname();
  const { profile } = useAuth();
  const [unread, setUnread] = useState(0);
  const tabs = variant === "user" ? USER_TABS : NGO_TABS;

  const loadUnread = async () => {
    if (!profile) return;
    const { count } = await supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("recipient_id", profile.id)
      .eq("read_status", false);
    setUnread(count ?? 0);
  };

  useEffect(() => {
    loadUnread();
    const interval = setInterval(loadUnread, 15000);
    return () => clearInterval(interval);
  }, [profile, pathname]);

  return (
    <View style={styles.bar}>
      {tabs.map((tab) => {
        const active = pathname === tab.path;
        return (
          <TouchableOpacity key={tab.path} style={styles.tab} onPress={() => router.push(tab.path as any)}>
            <View>
              <Text style={[styles.icon, active && styles.iconActive]}>{tab.icon}</Text>
              {tab.label === "Alerts" && unread > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{unread > 9 ? "9+" : unread}</Text>
                </View>
              )}
            </View>
            <Text style={[styles.label, active && styles.labelActive]}>{tab.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "#eee",
    backgroundColor: "#fff",
    paddingTop: 8,
    paddingBottom: 22,
  },
  tab: { flex: 1, alignItems: "center" },
  icon: { fontSize: 20, opacity: 0.5 },
  iconActive: { opacity: 1 },
  label: { fontSize: 11, color: "#aaa", marginTop: 2 },
  labelActive: { color: "#E85D2C", fontWeight: "700" },
  badge: {
    position: "absolute",
    top: -4,
    right: -8,
    backgroundColor: "#E85D2C",
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  badgeText: { color: "#fff", fontSize: 9, fontWeight: "700" },
});
