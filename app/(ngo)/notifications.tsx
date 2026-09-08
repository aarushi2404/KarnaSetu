import { useCallback, useState } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { supabase, AppNotification } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import BottomNav from "@/components/BottomNav";

export default function Notifications() {
  const { profile } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<AppNotification[]>([]);

  const load = async () => {
    if (!profile) return;
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("recipient_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(50);
    setItems((data as AppNotification[]) ?? []);
  };

  useFocusEffect(
    useCallback(() => {
      load();
    }, [profile])
  );

  const markRead = async (item: AppNotification) => {
    if (item.read_status) return;
    await supabase.from("notifications").update({ read_status: true }).eq("id", item.id);
    load();
  };

  const timeAgo = (iso: string) => {
    const diffMs = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Notifications</Text>
      </View>

      <FlatList
        style={{ flex: 1 }}
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, gap: 10 }}
        ListEmptyComponent={<Text style={styles.empty}>You're all caught up.</Text>}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.card, !item.read_status && styles.cardUnread]}
            onPress={() => markRead(item)}
          >
            {!item.read_status && <View style={styles.dot} />}
            <View style={{ flex: 1 }}>
              <Text style={styles.message}>{item.message}</Text>
              <Text style={styles.time}>{timeAgo(item.created_at)}</Text>
            </View>
          </TouchableOpacity>
        )}
      />
      <BottomNav variant="ngo" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFF8F3" },
  header: { paddingTop: 56, paddingHorizontal: 16, paddingBottom: 8 },
  back: { color: "#E85D2C", marginBottom: 8 },
  title: { fontSize: 20, fontWeight: "700" },
  empty: { textAlign: "center", color: "#888", marginTop: 40 },
  card: { flexDirection: "row", backgroundColor: "#fff", borderRadius: 12, padding: 14, alignItems: "flex-start" },
  cardUnread: { backgroundColor: "#FFF0E8" },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#E85D2C", marginRight: 10, marginTop: 5 },
  message: { color: "#333", fontSize: 14 },
  time: { color: "#999", fontSize: 11, marginTop: 4 },
});
