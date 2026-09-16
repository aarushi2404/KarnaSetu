import { useCallback, useState } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { supabase, Ngo } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";

export default function CompanyDashboard() {
  const { profile, signOut } = useAuth();
  const router = useRouter();
  const [ngos, setNgos] = useState<Ngo[]>([]);
  const [stats, setStats] = useState({ engagements: 0, totalDonated: 0, totalHours: 0 });

  const load = async () => {
    if (!profile) return;
    const { data: ngoData } = await supabase
      .from("ngos")
      .select("*, profiles!inner(verification_status)")
      .eq("profiles.verification_status", "approved")
      .limit(10);
    setNgos((ngoData as unknown as Ngo[]) ?? []);

    const { data: engagements } = await supabase
      .from("csr_engagements")
      .select("engagement_type, amount, hours")
      .eq("company_id", profile.id);

    const totalDonated = (engagements ?? [])
      .filter((e) => e.engagement_type === "donation")
      .reduce((s, e) => s + (e.amount ?? 0), 0);
    const totalHours = (engagements ?? [])
      .filter((e) => e.engagement_type === "volunteer_hours")
      .reduce((s, e) => s + (e.hours ?? 0), 0);

    setStats({ engagements: engagements?.length ?? 0, totalDonated, totalHours });
  };

  useFocusEffect(useCallback(() => { load(); }, [profile]));

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>CSR Portal</Text>
        <TouchableOpacity onPress={signOut}>
          <Text style={styles.signOut}>Sign out</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.statsRow}>
        <Stat label="Engagements" value={stats.engagements} />
        <Stat label="₹ Donated" value={stats.totalDonated} />
        <Stat label="Volunteer hrs" value={stats.totalHours} />
      </View>

      <View style={styles.actionsRow}>
        <TouchableOpacity style={styles.primaryBtn} onPress={() => router.push("/(company)/log-engagement")}>
          <Text style={styles.primaryBtnText}>+ Log CSR engagement</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryBtn} onPress={() => router.push("/(company)/impact-report")}>
          <Text style={styles.secondaryBtnText}>View impact report</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>Verified NGOs you can engage with</Text>
      <FlatList
        data={ngos}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, gap: 10 }}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{item.org_name}</Text>
            <Text style={styles.cardMeta}>{item.category} {item.city ? `· ${item.city}` : ""}</Text>
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
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, paddingTop: 56 },
  title: { fontSize: 20, fontWeight: "700" },
  signOut: { color: "#E85D2C" },
  statsRow: { flexDirection: "row", paddingHorizontal: 16, gap: 8, marginBottom: 8 },
  stat: { flex: 1, backgroundColor: "#fff", borderRadius: 12, padding: 12, alignItems: "center" },
  statValue: { fontSize: 18, fontWeight: "800", color: "#E85D2C" },
  statLabel: { fontSize: 11, color: "#888" },
  actionsRow: { flexDirection: "row", gap: 8, paddingHorizontal: 16, marginTop: 4 },
  primaryBtn: { flex: 1, backgroundColor: "#E85D2C", borderRadius: 10, padding: 12, alignItems: "center" },
  primaryBtnText: { color: "#fff", fontWeight: "700" },
  secondaryBtn: { flex: 1, backgroundColor: "#fff", borderRadius: 10, padding: 12, alignItems: "center", borderWidth: 1, borderColor: "#E85D2C" },
  secondaryBtnText: { color: "#E85D2C", fontWeight: "700" },
  sectionTitle: { fontWeight: "700", paddingHorizontal: 16, marginTop: 16 },
  card: { backgroundColor: "#fff", borderRadius: 12, padding: 14 },
  cardTitle: { fontSize: 16, fontWeight: "700" },
  cardMeta: { color: "#888", fontSize: 12, marginTop: 2 },
});