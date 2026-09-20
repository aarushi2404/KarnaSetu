import { useEffect, useState } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet, TextInput, Alert, Modal } from "react-native";
import { useRouter } from "expo-router";
import { supabase, Ngo, NgoRating, NgoRatingSummary } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";

export default function BrowseNgos() {
  const { profile } = useAuth();
  const router = useRouter();
  const [ngos, setNgos] = useState<Ngo[]>([]);
  const [amounts, setAmounts] = useState<Record<string, string>>({});

  const [summaries, setSummaries] = useState<Record<string, NgoRatingSummary>>({});
  const [myRatings, setMyRatings] = useState<Record<string, NgoRating>>({});
  const [rateModalNgo, setRateModalNgo] = useState<Ngo | null>(null);
  const [ratingValue, setRatingValue] = useState(5);
  const [reviewText, setReviewText] = useState("");
  const [rateBusy, setRateBusy] = useState(false);

  const loadRatings = async (ngoList: Ngo[]) => {
    if (ngoList.length === 0) return;
    const ngoIds = ngoList.map((n) => n.id);

    const { data: summaryData } = await supabase
      .from("ngo_rating_summary")
      .select("*")
      .in("ngo_id", ngoIds);

    const summaryMap: Record<string, NgoRatingSummary> = {};
    (summaryData as NgoRatingSummary[] | null ?? []).forEach((s) => {
      summaryMap[s.ngo_id] = s;
    });
    setSummaries(summaryMap);

    if (profile) {
      const { data: mine } = await supabase
        .from("ngo_ratings")
        .select("*")
        .eq("user_id", profile.id)
        .in("ngo_id", ngoIds);

      const mineMap: Record<string, NgoRating> = {};
      (mine as NgoRating[] | null ?? []).forEach((r) => {
        mineMap[r.ngo_id] = r;
      });
      setMyRatings(mineMap);
    }
  };

  useEffect(() => {
    supabase
      .from("ngos")
      .select("*, profiles!inner(verification_status)")
      .eq("profiles.verification_status", "approved")
      .then(({ data }) => {
        const list = (data as unknown as Ngo[]) ?? [];
        setNgos(list);
        loadRatings(list);
      });
  }, [profile]);

  const openRateModal = (ngo: Ngo) => {
    const mine = myRatings[ngo.id];
    setRatingValue(mine?.rating ?? 5);
    setReviewText(mine?.review ?? "");
    setRateModalNgo(ngo);
  };

  const submitRating = async () => {
    if (!rateModalNgo || !profile) return;
    if (ratingValue < 1 || ratingValue > 5) {
      return Alert.alert("Invalid rating", "Choose 1 to 5 stars.");
    }
    setRateBusy(true);
    const { error } = await supabase.rpc("upsert_ngo_rating", {
      p_ngo_id: rateModalNgo.id,
      p_rating: ratingValue,
      p_review: reviewText.trim() || null,
    });
    setRateBusy(false);
    if (error) return Alert.alert("Could not submit rating", error.message);

    setRateModalNgo(null);
    loadRatings(ngos);
  };

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

  // Find-or-create the conversation, then navigate into it.
  const openChat = async (ngo: Ngo) => {
    if (!profile) return;
    const { data: existing } = await supabase
      .from("conversations")
      .select("id")
      .eq("user_id", profile.id)
      .eq("ngo_id", ngo.id)
      .maybeSingle();

    let conversationId = existing?.id as string | undefined;
    if (!conversationId) {
      const { data: created, error } = await supabase
        .from("conversations")
        .insert({ user_id: profile.id, ngo_id: ngo.id })
        .select("id")
        .single();
      if (error) return Alert.alert("Could not start chat", error.message);
      conversationId = created.id;
    }
    router.push({ pathname: "/(user)/chat", params: { conversationId, peerName: ngo.org_name } });
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
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
              <Text style={styles.cardTitle}>{item.org_name}</Text>
              <TouchableOpacity onPress={() => openChat(item)}>
                <Text style={styles.messageLink}>💬 Message</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.cardMeta}>{item.category} {item.city ? `· ${item.city}` : ""}</Text>
            {!!item.description && <Text style={styles.cardDesc}>{item.description}</Text>}

            <View style={styles.ratingRow}>
              <Text style={styles.ratingStars}>
                {summaries[item.id]?.average_rating
                  ? "★".repeat(Math.round(summaries[item.id].average_rating!)) +
                    "☆".repeat(5 - Math.round(summaries[item.id].average_rating!))
                  : "☆☆☆☆☆"}
              </Text>
              <Text style={styles.ratingCount}>
                {summaries[item.id]?.average_rating
                  ? `${summaries[item.id].average_rating!.toFixed(1)} (${summaries[item.id].total_ratings} review${summaries[item.id].total_ratings === 1 ? "" : "s"})`
                  : "No reviews yet"}
              </Text>
              <TouchableOpacity onPress={() => openRateModal(item)}>
                <Text style={styles.rateLink}>
                  {myRatings[item.id] ? "Edit your rating" : "Rate this NGO"}
                </Text>
              </TouchableOpacity>
            </View>

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

      <Modal
        visible={!!rateModalNgo}
        animationType="slide"
        transparent
        onRequestClose={() => setRateModalNgo(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              Rate {rateModalNgo?.org_name}
            </Text>

            <View style={styles.starPicker}>
              {[1, 2, 3, 4, 5].map((n) => (
                <TouchableOpacity key={n} onPress={() => setRatingValue(n)}>
                  <Text style={styles.starPick}>{n <= ratingValue ? "★" : "☆"}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              style={styles.reviewInput}
              placeholder="Optional review"
              multiline
              value={reviewText}
              onChangeText={setReviewText}
            />

            <TouchableOpacity
              style={[styles.button, rateBusy && { opacity: 0.6 }]}
              onPress={submitRating}
              disabled={rateBusy}
            >
              <Text style={styles.buttonText}>{rateBusy ? "Submitting..." : "Submit rating"}</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setRateModalNgo(null)} disabled={rateBusy}>
              <Text style={styles.cancel}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  messageLink: { color: "#2563EB", fontWeight: "600", fontSize: 13 },
  donateRow: { flexDirection: "row", gap: 8, marginTop: 10 },
  amountInput: { flex: 1, borderWidth: 1, borderColor: "#ddd", borderRadius: 8, padding: 10 },
  donateBtn: { backgroundColor: "#E85D2C", borderRadius: 8, paddingHorizontal: 16, justifyContent: "center" },
  donateText: { color: "#fff", fontWeight: "700" },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8, flexWrap: "wrap" },
  ratingStars: { color: "#F59E0B", fontSize: 14 },
  ratingCount: { color: "#888", fontSize: 12 },
  rateLink: { color: "#2563EB", fontWeight: "600", fontSize: 12, marginLeft: "auto" },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", padding: 24 },
  modalCard: { backgroundColor: "#fff", borderRadius: 20, padding: 24 },
  modalTitle: { fontSize: 18, fontWeight: "700", marginBottom: 16, color: "#111" },
  starPicker: { flexDirection: "row", gap: 6, marginBottom: 16, justifyContent: "center" },
  starPick: { fontSize: 34, color: "#F59E0B" },
  reviewInput: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    padding: 12,
    minHeight: 80,
    textAlignVertical: "top",
    marginBottom: 16,
  },
  button: { backgroundColor: "#E85D2C", borderRadius: 10, padding: 14, alignItems: "center" },
  buttonText: { color: "#fff", fontWeight: "700" },
  cancel: { textAlign: "center", marginTop: 14, color: "#888" },
});