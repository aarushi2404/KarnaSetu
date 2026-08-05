import { useEffect, useState } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet, TextInput, Alert } from "react-native";
import { useRouter } from "expo-router";
import { supabase, Ngo } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";

export default function BrowseNgos() {
  const { profile } = useAuth();
  const router = useRouter();
  const [ngos, setNgos] = useState<Ngo[]>([]);
  const [amounts, setAmounts] = useState<Record<string, string>>({});

  useEffect(() => {
    supabase
      .from("ngos")
      .select("*, profiles!inner(verification_status)")
      .eq("profiles.verification_status", "approved")
      .then(({ data }) => setNgos((data as unknown as Ngo[]) ?? []));
  }, []);

  // Donation flow: creates a "pending" donation row, then would hand off to Razorpay
  // checkout (test mode) in a real build — see README "Payments" section.
  const donate = async (ngoId: string) => {
    const amount = Number(amounts[ngoId] ?? 0);
    if (!amount || amount <= 0) return Alert.alert("Enter an amount", "Enter a donation amount first.");
    const { error } = await supabase.from("donations").insert({
      donor_id: profile?.id,
      ngo_id: ngoId,
      amount,
      status: "pending",
    });
    if (error) return Alert.alert("Could not donate", error.message);
    Alert.alert("Thank you!", "Your donation was recorded (test mode). Razorpay checkout hooks in here.");
    setAmounts((a) => ({ ...a, [ngoId]: "" }));
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Verified NGOs</Text>
      </View>
      <FlatList
        data={ngos}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        ListEmptyComponent={<Text style={styles.empty}>No verified NGOs yet.</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{item.org_name}</Text>
            <Text style={styles.cardMeta}>{item.category} {item.city ? `· ${item.city}` : ""}</Text>
            {!!item.description && <Text style={styles.cardDesc}>{item.description}</Text>}
            <View style={styles.donateRow}>
              <TextInput
                style={styles.amountInput}
                placeholder="₹ amount"
                keyboardType="number-pad"
                value={amounts[item.id] ?? ""}
                onChangeText={(v) => setAmounts((a) => ({ ...a, [item.id]: v }))}
              />
              <TouchableOpacity style={styles.donateBtn} onPress={() => donate(item.id)}>
                <Text style={styles.donateText}>Donate</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFF8F3" },
  header: { paddingTop: 56, paddingHorizontal: 16 },
  back: { color: "#E85D2C", marginBottom: 8 },
  title: { fontSize: 20, fontWeight: "700", marginBottom: 8 },
  empty: { textAlign: "center", color: "#888", marginTop: 40 },
  card: { backgroundColor: "#fff", borderRadius: 12, padding: 14, elevation: 1 },
  cardTitle: { fontSize: 16, fontWeight: "700" },
  cardMeta: { color: "#888", fontSize: 12, marginTop: 2 },
  cardDesc: { color: "#555", marginTop: 6 },
  donateRow: { flexDirection: "row", gap: 8, marginTop: 10 },
  amountInput: { flex: 1, borderWidth: 1, borderColor: "#ddd", borderRadius: 8, padding: 10 },
  donateBtn: { backgroundColor: "#E85D2C", borderRadius: 8, paddingHorizontal: 16, justifyContent: "center" },
  donateText: { color: "#fff", fontWeight: "700" },
});
