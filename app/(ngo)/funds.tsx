import { useCallback, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { supabase, Campaign, Donation, Ngo, Profile } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import BottomNav from "@/components/BottomNav";

interface DonationDisplay extends Donation {
  donor?: Pick<Profile, "full_name"> | null;
}

const formatINR = (amount: number) =>
  `₹${amount.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

export default function NgoFundTracker() {
  const { profile } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [ngo, setNgo] = useState<Ngo | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [recentDonations, setRecentDonations] = useState<DonationDisplay[]>([]);
  const [totalReceived, setTotalReceived] = useState(0);
  const [uncampaignedTotal, setUncampaignedTotal] = useState(0);

  const load = async () => {
    if (!profile) return;
    setLoading(true);

    const { data: ngoData, error: ngoError } = await supabase
      .from("ngos")
      .select("*")
      .eq("profile_id", profile.id)
      .single();

    if (ngoError || !ngoData) {
      setLoading(false);
      return;
    }

    const currentNgo = ngoData as Ngo;
    setNgo(currentNgo);

    // Campaign-wise breakdown. campaigns.raised_amount is the running total
    // already tracked by the existing schema — this reuses it rather than
    // re-summing donations client-side.
    const { data: campaignData } = await supabase
      .from("campaigns")
      .select("*")
      .eq("ngo_id", currentNgo.id)
      .order("created_at", { ascending: false });
    setCampaigns((campaignData as Campaign[]) ?? []);

    // Only successful donations count as funds actually received.
    const { data: donationData } = await supabase
      .from("donations")
      .select("*")
      .eq("ngo_id", currentNgo.id)
      .eq("status", "success")
      .order("created_at", { ascending: false });

    const donations = (donationData as Donation[]) ?? [];

    const total = donations.reduce((sum, d) => sum + Number(d.amount), 0);
    setTotalReceived(total);

    const uncampaigned = donations
      .filter((d) => !d.campaign_id)
      .reduce((sum, d) => sum + Number(d.amount), 0);
    setUncampaignedTotal(uncampaigned);

    const recent = donations.slice(0, 10);
    const donorIds = [...new Set(recent.map((d) => d.donor_id))];

    let donorMap: Record<string, Pick<Profile, "full_name">> = {};
    if (donorIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", donorIds);
      (profiles ?? []).forEach((p) => {
        donorMap[p.id] = { full_name: p.full_name };
      });
    }

    setRecentDonations(
      recent.map((d) => ({ ...d, donor: donorMap[d.donor_id] ?? null }))
    );

    setLoading(false);
  };

  useFocusEffect(
    useCallback(() => {
      load();
    }, [profile])
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#E85D2C" size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Fund Tracker</Text>
      </View>

      <FlatList
        style={{ flex: 1 }}
        data={campaigns}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 30 }}
        ListHeaderComponent={
          <>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Total funds received</Text>
              <Text style={styles.summaryAmount}>{formatINR(totalReceived)}</Text>
              <Text style={styles.summaryHint}>
                Across {campaigns.length} campaign{campaigns.length === 1 ? "" : "s"}
                {uncampaignedTotal > 0
                  ? ` · ${formatINR(uncampaignedTotal)} general (no campaign)`
                  : ""}
              </Text>
            </View>

            <Text style={styles.sectionTitle}>Campaign breakdown</Text>
          </>
        }
        ListEmptyComponent={
          <Text style={styles.empty}>
            No campaigns yet. Donations without a campaign still count toward
            your total above.
          </Text>
        }
        renderItem={({ item }) => {
          const pct =
            item.goal_amount > 0
              ? Math.min(100, Math.round((item.raised_amount / item.goal_amount) * 100))
              : 0;
          return (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${pct}%` }]} />
              </View>
              <Text style={styles.cardMeta}>
                {formatINR(item.raised_amount)} raised of {formatINR(item.goal_amount)} goal
                {"  "}({pct}%)
              </Text>
              {!!item.deadline && (
                <Text style={styles.cardMeta}>
                  Deadline: {new Date(item.deadline).toLocaleDateString()}
                </Text>
              )}
            </View>
          );
        }}
        ListFooterComponent={
          <>
            <Text style={[styles.sectionTitle, { marginTop: 20 }]}>
              Recent transactions
            </Text>
            {recentDonations.length === 0 ? (
              <Text style={styles.empty}>No donations recorded yet.</Text>
            ) : (
              recentDonations.map((d) => (
                <View key={d.id} style={styles.txnRow}>
                  <View>
                    <Text style={styles.txnDonor}>
                      {d.donor?.full_name ?? "Anonymous"}
                    </Text>
                    <Text style={styles.txnDate}>
                      {new Date(d.created_at).toLocaleDateString()}
                    </Text>
                  </View>
                  <Text style={styles.txnAmount}>{formatINR(d.amount)}</Text>
                </View>
              ))
            )}

            <View style={styles.utilisationNote}>
              <Text style={styles.utilisationTitle}>Fund utilisation</Text>
              <Text style={styles.utilisationText}>
                The current schema tracks funds received and campaign goals,
                but not how funds are spent — there is no expense/utilisation
                table yet. Add one (e.g. an `ngo_expenses` table linked to
                `campaigns`) to show utilisation breakdowns here.
              </Text>
            </View>
          </>
        }
      />

      <BottomNav variant="ngo" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFF8F3" },
  center: { flex: 1, backgroundColor: "#FFF8F3", alignItems: "center", justifyContent: "center" },
  header: { paddingTop: 56, paddingHorizontal: 16, paddingBottom: 8 },
  back: { color: "#E85D2C", marginBottom: 8, fontSize: 16 },
  title: { fontSize: 20, fontWeight: "700", color: "#111" },
  summaryCard: {
    backgroundColor: "#E85D2C",
    borderRadius: 16,
    padding: 20,
    marginBottom: 8,
  },
  summaryLabel: { color: "#FFE4D6", fontSize: 13, fontWeight: "600" },
  summaryAmount: { color: "#fff", fontSize: 32, fontWeight: "800", marginTop: 6 },
  summaryHint: { color: "#FFE4D6", fontSize: 12, marginTop: 8 },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: "#111", marginBottom: 4, marginTop: 4 },
  empty: { textAlign: "center", color: "#888", marginTop: 10, marginBottom: 10 },
  card: { backgroundColor: "#fff", borderRadius: 14, padding: 16 },
  cardTitle: { fontSize: 15, fontWeight: "700", color: "#111", marginBottom: 8 },
  cardMeta: { color: "#555", marginTop: 6, fontSize: 13 },
  progressTrack: { height: 8, backgroundColor: "#F0E4DC", borderRadius: 4, overflow: "hidden" },
  progressFill: { height: 8, backgroundColor: "#E85D2C" },
  txnRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    marginTop: 8,
  },
  txnDonor: { fontWeight: "700", color: "#111", fontSize: 14 },
  txnDate: { color: "#888", fontSize: 12, marginTop: 2 },
  txnAmount: { fontWeight: "800", color: "#15803D", fontSize: 15 },
  utilisationNote: {
    backgroundColor: "#FFF3E9",
    borderRadius: 12,
    padding: 14,
    marginTop: 20,
    borderWidth: 1,
    borderColor: "#F0D6C8",
  },
  utilisationTitle: { fontWeight: "700", color: "#B45309", marginBottom: 4 },
  utilisationText: { color: "#7A4A1F", fontSize: 12, lineHeight: 18 },
});
