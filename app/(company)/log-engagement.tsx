import { useEffect, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView } from "react-native";
import { Picker } from "@react-native-picker/picker";
import { useRouter } from "expo-router";
import { supabase, Ngo, CsrEngagement } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";

export default function LogEngagement() {
  const { profile } = useAuth();
  const router = useRouter();
  const [ngos, setNgos] = useState<Ngo[]>([]);
  const [ngoId, setNgoId] = useState("");
  const [type, setType] = useState<CsrEngagement["engagement_type"]>("donation");
  const [amount, setAmount] = useState("");
  const [hours, setHours] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase
      .from("ngos")
      .select("*, profiles!inner(verification_status)")
      .eq("profiles.verification_status", "approved")
      .then(({ data }) => setNgos((data as unknown as Ngo[]) ?? []));
  }, []);

  const submit = async () => {
    if (!ngoId) return Alert.alert("Pick an NGO", "Choose which NGO this engagement is with.");
    if (type === "donation" && !Number(amount)) return Alert.alert("Enter an amount");
    if (type === "volunteer_hours" && !Number(hours)) return Alert.alert("Enter hours");

    setBusy(true);
    const { error } = await supabase.from("csr_engagements").insert({
      company_id: profile?.id,
      ngo_id: ngoId,
      engagement_type: type,
      amount: type === "donation" ? Number(amount) : null,
      hours: type === "volunteer_hours" ? Number(hours) : null,
      description: description.trim() || null,
    });
    setBusy(false);
    if (error) return Alert.alert("Error", error.message);
    Alert.alert("Logged", "CSR engagement recorded.");
    router.back();
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, paddingTop: 56, gap: 12 }}>
      <TouchableOpacity onPress={() => router.back()}>
        <Text style={styles.back}>‹ Back</Text>
      </TouchableOpacity>
      <Text style={styles.title}>Log CSR Engagement</Text>

      <Text style={styles.label}>NGO</Text>
      <View style={styles.pickerWrap}>
        <Picker selectedValue={ngoId} onValueChange={setNgoId}>
          <Picker.Item label="Select an NGO…" value="" />
          {ngos.map((n) => (
            <Picker.Item key={n.id} label={n.org_name} value={n.id} />
          ))}
        </Picker>
      </View>

      <Text style={styles.label}>Type</Text>
      <View style={styles.pickerWrap}>
        <Picker selectedValue={type} onValueChange={(v) => setType(v)}>
          <Picker.Item label="Donation" value="donation" />
          <Picker.Item label="Volunteer hours" value="volunteer_hours" />
          <Picker.Item label="Food drive" value="food_drive" />
          <Picker.Item label="Other" value="other" />
        </Picker>
      </View>

      {type === "donation" && (
        <TextInput style={styles.input} placeholder="₹ amount" keyboardType="number-pad" value={amount} onChangeText={setAmount} />
      )}
      {type === "volunteer_hours" && (
        <TextInput style={styles.input} placeholder="Hours" keyboardType="number-pad" value={hours} onChangeText={setHours} />
      )}
      <TextInput
        style={[styles.input, { height: 80 }]}
        placeholder="Description (optional)"
        multiline
        value={description}
        onChangeText={setDescription}
      />

      <TouchableOpacity style={styles.submitBtn} disabled={busy} onPress={submit}>
        <Text style={styles.submitText}>{busy ? "Saving…" : "Save engagement"}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFF8F3" },
  back: { color: "#E85D2C" },
  title: { fontSize: 20, fontWeight: "700" },
  label: { fontWeight: "600", marginTop: 4 },
  pickerWrap: { backgroundColor: "#fff", borderRadius: 10, borderWidth: 1, borderColor: "#ddd" },
  input: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#ddd", borderRadius: 10, padding: 12 },
  submitBtn: { backgroundColor: "#E85D2C", borderRadius: 10, padding: 14, alignItems: "center", marginTop: 8 },
  submitText: { color: "#fff", fontWeight: "700" },
});