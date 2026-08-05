import { useCallback, useState } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { supabase, Post } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";

export default function UserFeed() {
  const { profile, signOut } = useAuth();
  const router = useRouter();
  const [posts, setPosts] = useState<Post[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from("posts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    setPosts((data as Post[]) ?? []);
  };

  useFocusEffect(
    useCallback(() => {
      load();
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Hi, {profile?.full_name?.split(" ")[0] ?? "there"} 👋</Text>
        <TouchableOpacity onPress={signOut}>
          <Text style={styles.signOut}>Sign out</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.actionsRow}>
        <TouchableOpacity style={styles.actionBtn} onPress={() => router.push("/(user)/create-post")}>
          <Text style={styles.actionText}>+ Post</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={() => router.push("/(user)/ngos")}>
          <Text style={styles.actionText}>Browse NGOs</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        ListEmptyComponent={<Text style={styles.empty}>No posts yet. Be the first!</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.cardType}>{item.type.replace("_", " ").toUpperCase()}</Text>
            <Text style={styles.cardTitle}>{item.title}</Text>
            {!!item.description && <Text style={styles.cardDesc}>{item.description}</Text>}
            {!!item.city && <Text style={styles.cardCity}>📍 {item.city}</Text>}
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFF8F3" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    paddingTop: 56,
  },
  title: { fontSize: 20, fontWeight: "700" },
  signOut: { color: "#E85D2C" },
  actionsRow: { flexDirection: "row", gap: 10, paddingHorizontal: 16, marginBottom: 8 },
  actionBtn: { backgroundColor: "#E85D2C", paddingVertical: 10, paddingHorizontal: 16, borderRadius: 20 },
  actionText: { color: "#fff", fontWeight: "600" },
  empty: { textAlign: "center", color: "#888", marginTop: 40 },
  card: { backgroundColor: "#fff", borderRadius: 12, padding: 14, elevation: 1 },
  cardType: { fontSize: 11, color: "#E85D2C", fontWeight: "700", marginBottom: 4 },
  cardTitle: { fontSize: 16, fontWeight: "700" },
  cardDesc: { color: "#555", marginTop: 4 },
  cardCity: { color: "#999", marginTop: 6, fontSize: 12 },
});
