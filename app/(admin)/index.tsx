import { useCallback, useState } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Linking, Alert } from "react-native";
import { useFocusEffect } from "expo-router";
import { supabase, Ngo } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";

interface PendingNgo extends Ngo {
  profiles: { full_name: string; verification_status: string } | null;
}

export default function AdminDashboard() {
  const { signOut } = useAuth();
  const [pending, setPending] = useState<PendingNgo[]>([]);
  const [stats, setStats] = useState({ ngos: 0, users: 0, posts: 0, donations: 0 });

  const load = async () => {
    const { data } = await supabase
      .from("ngos")
      .select("*, profiles!inner(full_name, verification_status)")
      .eq("profiles.verification_status", "pending_verification");
    setPending((data as unknown as PendingNgo[]) ?? []);

    const [{ count: ngoCount }, { count: userCount }, { count: postCount }, { count: donationCount }] =
      await Promise.all([
        supabase.from("ngos").select("*", { count: "exact", head: true }),
        supabase.from("profiles").select("*", { count: "exact", head: true }).eq("role", "user"),
        supabase.from("posts").select("*", { count: "exact", head: true }),
        supabase.from("donations").select("*", { count: "exact", head: true }),
      ]);
    setStats({
      ngos: ngoCount ?? 0,
      users: userCount ?? 0,
      posts: postCount ?? 0,
      donations: donationCount ?? 0,
    });
  };

  useFocusEffect(
    useCallback(() => {
      load();
    }, [])
  );

  const decide = async (ngoRow: PendingNgo, decision: "approved" | "rejected") => {
    const { error } = await supabase
      .from("profiles")
      .update({ verification_status: decision })
      .eq("id", ngoRow.profile_id);
    if (error) return Alert.alert("Error", error.message);
    load();
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Admin</Text>
        <TouchableOpacity onPress={signOut}>
          <Text style={styles.signOut}>Sign out</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.statsRow}>
        <Stat label="NGOs" value={stats.ngos} />
        <Stat label="Users" value={stats.users} />
        <Stat label="Posts" value={stats.posts} />
        <Stat label="Donations" value={stats.donations} />
      </View>

      <Text style={styles.sectionTitle}>Pending NGO Approvals</Text>
      <FlatList
        data={pending}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        ListEmptyComponent={<Text style={styles.empty}>Nothing pending. 🎉</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{item.org_name}</Text>
            <Text style={styles.cardMeta}>{item.category} · {item.profiles?.full_name}</Text>
            {!!item.registration_doc_url && (
              <TouchableOpacity onPress={() => Linking.openURL(item.registration_doc_url!)}>
                <Text style={styles.docLink}>View registration document</Text>
              </TouchableOpacity>
            )}
            <View style={styles.actionsRow}>
              <TouchableOpacity style={styles.approveBtn} onPress={() => decide(item, "approved")}>
                <Text style={styles.actionText}>Approve</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.rejectBtn} onPress={() => decide(item, "rejected")}>
                <Text style={styles.actionText}>Reject</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      />
    </View>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
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
  statsRow: { flexDirection: "row", paddingHorizontal: 16, gap: 8, marginBottom: 8 },
  stat: { flex: 1, backgroundColor: "#fff", borderRadius: 12, padding: 12, alignItems: "center" },
  statValue: { fontSize: 20, fontWeight: "800", color: "#E85D2C" },
  statLabel: { fontSize: 11, color: "#888" },
  sectionTitle: { fontWeight: "700", paddingHorizontal: 16, marginTop: 8 },
  empty: { textAlign: "center", color: "#888", marginTop: 20 },
  card: { backgroundColor: "#fff", borderRadius: 12, padding: 14 },
  cardTitle: { fontSize: 16, fontWeight: "700" },
  cardMeta: { color: "#888", fontSize: 12, marginTop: 2 },
  docLink: { color: "#2563EB", marginTop: 8 },
  actionsRow: { flexDirection: "row", gap: 8, marginTop: 12 },
  approveBtn: { backgroundColor: "#15803D", borderRadius: 8, paddingVertical: 8, paddingHorizontal: 16 },
  rejectBtn: { backgroundColor: "#B91C1C", borderRadius: 8, paddingVertical: 8, paddingHorizontal: 16 },
  actionText: { color: "#fff", fontWeight: "700" },
});
