import { useCallback, useState } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";

interface Row {
  id: string;
  last_message_at: string;
  ngos: { id: string; org_name: string } | null;
}

export default function Messages() {
  const { profile } = useAuth();
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);

  const load = async () => {
    if (!profile) return;
    const { data } = await supabase
      .from("conversations")
      .select("id, last_message_at, ngos(id, org_name)")
      .eq("user_id", profile.id)
      .order("last_message_at", { ascending: false });
    setRows((data as unknown as Row[]) ?? []);
  };

  useFocusEffect(useCallback(() => { load(); }, [profile]));

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Messages</Text>
      <FlatList
        data={rows}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, gap: 10 }}
        ListEmptyComponent={<Text style={styles.empty}>No conversations yet — message an NGO from its profile.</Text>}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() =>
              router.push({
                pathname: "/(user)/chat",
                params: { conversationId: item.id, peerName: item.ngos?.org_name ?? "NGO" },
              })
            }
          >
            <Text style={styles.cardTitle}>{item.ngos?.org_name ?? "NGO"}</Text>
            <Text style={styles.cardMeta}>{new Date(item.last_message_at).toLocaleString()}</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFF8F3" },
  title: { fontSize: 20, fontWeight: "700", paddingTop: 56, paddingHorizontal: 16 },
  empty: { textAlign: "center", color: "#888", marginTop: 40 },
  card: { backgroundColor: "#fff", borderRadius: 12, padding: 14 },
  cardTitle: { fontSize: 16, fontWeight: "700" },
  cardMeta: { color: "#888", fontSize: 12, marginTop: 2 },
});