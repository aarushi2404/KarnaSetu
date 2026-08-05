import { useCallback, useState } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet, TextInput, Alert } from "react-native";
import { useFocusEffect } from "expo-router";
import { supabase, Post, Ngo } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";

export default function NgoDashboard() {
  const { profile, signOut } = useAuth();
  const [ngo, setNgo] = useState<Ngo | null>(null);
  const [strayPosts, setStrayPosts] = useState<Post[]>([]);
  const [needTitle, setNeedTitle] = useState("");
  const [needDesc, setNeedDesc] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!profile) return;
    const { data: ngoData } = await supabase
      .from("ngos")
      .select("*")
      .eq("profile_id", profile.id)
      .single();
    setNgo(ngoData as Ngo);

    const { data: posts } = await supabase
      .from("posts")
      .select("*")
      .eq("type", "stray_found")
      .order("created_at", { ascending: false })
      .limit(20);
    setStrayPosts((posts as Post[]) ?? []);
  };

  useFocusEffect(
    useCallback(() => {
      load();
    }, [profile])
  );

  const postNeed = async () => {
    if (!needTitle) return Alert.alert("Missing info", "Add a title.");
    setBusy(true);
    const { error } = await supabase.from("posts").insert({
      author_id: profile?.id,
      type: "announcement",
      title: needTitle,
      description: needDesc,
      city: profile?.city,
    });
    setBusy(false);
    if (error) return Alert.alert("Could not post", error.message);
    setNeedTitle("");
    setNeedDesc("");
    Alert.alert("Posted", "Your need/announcement is now live.");
  };

  const statusBanner = () => {
    if (!profile) return null;
    if (profile.verification_status === "pending_verification")
      return <Text style={styles.pending}>⏳ Verification pending — an admin will review your documents.</Text>;
    if (profile.verification_status === "rejected")
      return <Text style={styles.rejected}>Your NGO was not approved. Contact support.</Text>;
    return <Text style={styles.approved}>✓ Verified NGO</Text>;
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{ngo?.org_name ?? "NGO Dashboard"}</Text>
        <TouchableOpacity onPress={signOut}>
          <Text style={styles.signOut}>Sign out</Text>
        </TouchableOpacity>
      </View>
      {statusBanner()}

      <View style={styles.postBox}>
        <Text style={styles.sectionTitle}>Post a Need / Announcement</Text>
        <TextInput style={styles.input} placeholder="Title" value={needTitle} onChangeText={setNeedTitle} />
        <TextInput
          style={[styles.input, { height: 70 }]}
          placeholder="Details"
          multiline
          value={needDesc}
          onChangeText={setNeedDesc}
        />
        <TouchableOpacity style={styles.button} onPress={postNeed} disabled={busy}>
          <Text style={styles.buttonText}>{busy ? "Posting..." : "Post"}</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>Nearby Stray / Found Reports</Text>
      <FlatList
        data={strayPosts}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, gap: 10 }}
        ListEmptyComponent={<Text style={styles.empty}>No reports right now.</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
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
  pending: { color: "#B45309", paddingHorizontal: 16, marginBottom: 8 },
  rejected: { color: "#B91C1C", paddingHorizontal: 16, marginBottom: 8 },
  approved: { color: "#15803D", paddingHorizontal: 16, marginBottom: 8, fontWeight: "600" },
  postBox: { backgroundColor: "#fff", margin: 16, padding: 14, borderRadius: 12 },
  sectionTitle: { fontWeight: "700", marginBottom: 8, paddingHorizontal: 16 },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    backgroundColor: "#fafafa",
  },
  button: { backgroundColor: "#E85D2C", borderRadius: 10, padding: 12, alignItems: "center" },
  buttonText: { color: "#fff", fontWeight: "700" },
  empty: { textAlign: "center", color: "#888", marginTop: 10 },
  card: { backgroundColor: "#fff", borderRadius: 12, padding: 14 },
  cardTitle: { fontSize: 15, fontWeight: "700" },
  cardDesc: { color: "#555", marginTop: 4 },
  cardCity: { color: "#999", marginTop: 6, fontSize: 12 },
});
