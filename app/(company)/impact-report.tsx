import { useCallback, useState } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import { supabase, CsrEngagement } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";

interface Row extends CsrEngagement {
  ngos: { org_name: string } | null;
}

export default function ImpactReport() {
  const { profile } = useAuth();
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);

  const load = async () => {
    if (!profile) return;
    const { data } = await supabase
      .from("csr_engagements")
      .select("*, ngos(org_name)")
      .eq("company_id", profile.id)
      .order("engagement_date", { ascending: false });
    setRows((data as unknown as Row[]) ?? []);
  };

  useFocusEffect(useCallback(() => { load(); }, [profile]));

  const exportCsv = async () => {
    const header = "Date,NGO,Type,Amount,Hours,Description\n";
    const body = rows
      .map((r) =>
        [
          r.engagement_date,
          r.ngos?.org_name ?? "",
          r.engagement_type,
          r.amount ?? "",
          r.hours ?? "",
          `"${(r.description ?? "").replace(/"/g, '""')}"`,
        ].join(",")
      )
      .join("\n");

    const fileUri = FileSystem.documentDirectory + `karnasetu-csr-impact-report.csv`;
    await FileSystem.writeAsStringAsync(fileUri, header + body, { encoding: FileSystem.EncodingType.UTF8 });

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(fileUri, { mimeType: "text/csv", dialogTitle: "Export impact report" });
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Impact Report</Text>
        <TouchableOpacity style={styles.exportBtn} onPress={exportCsv}>
          <Text style={styles.exportText}>Export CSV</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={rows}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, gap: 10 }}
        ListEmptyComponent={<Text style={styles.empty}>No engagements logged yet.</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{item.ngos?.org_name ?? "NGO"}</Text>
            <Text style={styles.cardMeta}>
              {item.engagement_type.replace("_", " ")}
              {item.amount ? ` · ₹${item.amount}` : ""}
              {item.hours ? ` · ${item.hours}h` : ""}
              {" · "}{item.engagement_date}
            </Text>
            {!!item.description && <Text style={styles.cardDesc}>{item.description}</Text>}
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFF8F3" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 56, paddingHorizontal: 16 },
  back: { color: "#E85D2C" },
  title: { fontSize: 18, fontWeight: "700" },
  exportBtn: { backgroundColor: "#E85D2C", borderRadius: 8, paddingVertical: 6, paddingHorizontal: 12 },
  exportText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  empty: { textAlign: "center", color: "#888", marginTop: 40 },
  card: { backgroundColor: "#fff", borderRadius: 12, padding: 14 },
  cardTitle: { fontSize: 16, fontWeight: "700" },
  cardMeta: { color: "#888", fontSize: 12, marginTop: 2, textTransform: "capitalize" },
  cardDesc: { color: "#555", marginTop: 6 },
});