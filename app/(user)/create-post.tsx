import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { useRouter } from "expo-router";
import { supabase, PostType } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";

const TYPES: { key: PostType; label: string }[] = [
  { key: "stray_found", label: "Stray / Found Animal" },
  { key: "adoption", label: "Adoption" },
  { key: "announcement", label: "Announcement" },
  { key: "update", label: "Community Update" },
];

export default function CreatePost() {
  const { profile } = useAuth();
  const router = useRouter();
  const [type, setType] = useState<PostType>("stray_found");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [city, setCity] = useState(profile?.city ?? "");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!title) return Alert.alert("Missing info", "Add a title for your post.");
    setBusy(true);
    const { error } = await supabase.from("posts").insert({
      author_id: profile?.id,
      type,
      title,
      description,
      city,
    });
    setBusy(false);
    if (error) return Alert.alert("Could not post", error.message);
    // If it's a stray/found post, notify nearby shelters via an Edge Function (see supabase/functions)
    if (type === "stray_found") {
      supabase.functions.invoke("notify-nearby-shelters", { body: { city } }).catch(() => {});
    }
    router.back();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>New Post</Text>

      <View style={styles.chipRow}>
        {TYPES.map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[styles.chip, type === t.key && styles.chipActive]}
            onPress={() => setType(t.key)}
          >
            <Text style={type === t.key ? styles.chipTextActive : styles.chipText}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TextInput style={styles.input} placeholder="Title" value={title} onChangeText={setTitle} />
      <TextInput
        style={[styles.input, { height: 100 }]}
        placeholder="Description"
        multiline
        value={description}
        onChangeText={setDescription}
      />
      <TextInput style={styles.input} placeholder="City" value={city} onChangeText={setCity} />

      <TouchableOpacity style={styles.button} onPress={submit} disabled={busy}>
        <Text style={styles.buttonText}>{busy ? "Posting..." : "Post"}</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => router.back()}>
        <Text style={styles.cancel}>Cancel</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFF8F3", padding: 20, paddingTop: 56 },
  header: { fontSize: 22, fontWeight: "700", marginBottom: 16 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  chip: { borderWidth: 1, borderColor: "#E85D2C", borderRadius: 16, paddingVertical: 6, paddingHorizontal: 12 },
  chipActive: { backgroundColor: "#E85D2C" },
  chipText: { color: "#E85D2C", fontSize: 12 },
  chipTextActive: { color: "#fff", fontSize: 12 },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    backgroundColor: "#fff",
  },
  button: { backgroundColor: "#E85D2C", borderRadius: 10, padding: 15, alignItems: "center" },
  buttonText: { color: "#fff", fontWeight: "700" },
  cancel: { textAlign: "center", marginTop: 16, color: "#888" },
});
