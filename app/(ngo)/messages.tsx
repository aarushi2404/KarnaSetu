import { useCallback, useState } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";

interface Row {
  id: string;
  last_message_at: string;
  profiles: { id: string; full_name: string } | null;
}

export default function NgoMessages() {
  const { profile } = useAuth();
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);

  const load = async () => {
    if (!profile) return;
    const { data: ngoRow } = await supabase.from("ngos").select("id").eq("profile_id", profile.id).single();
    if (!ngoRow) return;
    const { data } = await supabase
      .from("conversations")
      .select("id, last_message_at, profiles:user_id(id, full_name)")
      .eq("ngo_id", ngoRow.id)
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
        ListEmptyComponent={<Text style={styles.empty}>No conversations yet.</Text>}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() =>
              router.push({
                pathname: "/(ngo)/chat",
                params: { conversationId: item.id, peerName: item.profiles?.full_name ?? "User" },
              })
            }
          >
            <Text style={styles.cardTitle}>{item.profiles?.full_name ?? "User"}</Text>
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