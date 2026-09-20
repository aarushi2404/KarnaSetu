import { useCallback, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { supabase, Ngo, NgoResource, NgoResourceCategory } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import BottomNav from "@/components/BottomNav";

const CATEGORIES: { key: NgoResourceCategory; label: string }[] = [
  { key: "food", label: "Food" },
  { key: "medical", label: "Medical" },
  { key: "clothing", label: "Clothing" },
  { key: "other", label: "Other" },
];

export default function NgoInventory() {
  const { profile } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [ngo, setNgo] = useState<Ngo | null>(null);
  const [resources, setResources] = useState<NgoResource[]>([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("units");
  const [category, setCategory] = useState<NgoResourceCategory>("food");
  const [initialQty, setInitialQty] = useState("");
  const [lowStock, setLowStock] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!profile) return;
    setLoading(true);

    const { data: ngoData } = await supabase
      .from("ngos")
      .select("*")
      .eq("profile_id", profile.id)
      .single();

    const currentNgo = ngoData as Ngo | null;
    setNgo(currentNgo);

    if (currentNgo) {
      const { data, error } = await supabase
        .from("ngo_resources")
        .select("*")
        .eq("ngo_id", currentNgo.id)
        .order("category", { ascending: true })
        .order("name", { ascending: true });

      if (error) {
        console.log("Inventory load error:", error.message);
      } else {
        setResources((data as NgoResource[]) ?? []);
      }
    }

    setLoading(false);
  };

  useFocusEffect(
    useCallback(() => {
      load();
    }, [profile])
  );

  const resetForm = () => {
    setName("");
    setUnit("units");
    setCategory("food");
    setInitialQty("");
    setLowStock("");
  };

  const addResource = async () => {
    if (!ngo) return;
    if (!name.trim()) {
      return Alert.alert("Missing info", "Enter a resource name.");
    }
    const qty = Number(initialQty);
    if (initialQty && (isNaN(qty) || qty < 0)) {
      return Alert.alert("Invalid quantity", "Starting quantity can't be negative.");
    }

    setBusy(true);
    const { error } = await supabase.from("ngo_resources").insert({
      ngo_id: ngo.id,
      category,
      name: name.trim(),
      unit: unit.trim() || "units",
      quantity: initialQty ? qty : 0,
      low_stock_threshold: lowStock ? Number(lowStock) : 0,
    });
    setBusy(false);

    if (error) {
      return Alert.alert(
        "Could not add",
        error.message.includes("duplicate")
          ? "You already have a resource with this name in this category."
          : error.message
      );
    }

    resetForm();
    setModalOpen(false);
    load();
  };

  const adjust = async (resource: NgoResource, delta: number) => {
    if (resource.quantity + delta < 0) {
      return Alert.alert("Invalid change", "Stock can't go below zero.");
    }
    const { error } = await supabase.rpc("adjust_ngo_resource", {
      p_resource_id: resource.id,
      p_change: delta,
      p_reason: delta > 0 ? "Manual restock" : "Manual usage",
    });
    if (error) {
      return Alert.alert("Could not update", error.message);
    }
    load();
  };

  const isLow = (r: NgoResource) =>
    r.low_stock_threshold > 0 && r.quantity <= r.low_stock_threshold;

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
        <Text style={styles.title}>Inventory</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setModalOpen(true)}>
          <Text style={styles.addBtnText}>+ Add resource</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        style={{ flex: 1 }}
        data={resources}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 30 }}
        ListEmptyComponent={
          <Text style={styles.empty}>
            No resources tracked yet. Add food, medical supplies, clothing,
            or other donated goods to start tracking stock.
          </Text>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardTop}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{item.name}</Text>
                <Text style={styles.cardCategory}>
                  {CATEGORIES.find((c) => c.key === item.category)?.label}
                </Text>
              </View>
              {isLow(item) && (
                <View style={styles.lowBadge}>
                  <Text style={styles.lowBadgeText}>
                    {item.quantity <= 0 ? "Out of stock" : "Low stock"}
                  </Text>
                </View>
              )}
            </View>

            <Text style={styles.qtyText}>
              {item.quantity} {item.unit}
            </Text>

            <View style={styles.adjustRow}>
              <TouchableOpacity
                style={styles.adjustBtn}
                onPress={() => adjust(item, -1)}
              >
                <Text style={styles.adjustBtnText}>−1</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.adjustBtn}
                onPress={() => adjust(item, -10)}
              >
                <Text style={styles.adjustBtnText}>−10</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.adjustBtn, styles.adjustBtnAdd]}
                onPress={() => adjust(item, 10)}
              >
                <Text style={styles.adjustBtnAddText}>+10</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.adjustBtn, styles.adjustBtnAdd]}
                onPress={() => adjust(item, 1)}
              >
                <Text style={styles.adjustBtnAddText}>+1</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      />

      <Modal
        visible={modalOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setModalOpen(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalBackdrop}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={styles.modalCard}>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.formContent}
            >
              <Text style={styles.modalTitle}>Add resource</Text>

              <View style={styles.chipRow}>
                {CATEGORIES.map((c) => (
                  <TouchableOpacity
                    key={c.key}
                    style={[styles.chip, category === c.key && styles.chipActive]}
                    onPress={() => setCategory(c.key)}
                  >
                    <Text style={category === c.key ? styles.chipTextActive : styles.chipText}>
                      {c.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Name</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Rice, Winter blankets, Paracetamol"
                value={name}
                onChangeText={setName}
              />

              <Text style={styles.label}>Unit</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. kg, pieces, boxes"
                value={unit}
                onChangeText={setUnit}
              />

              <Text style={styles.label}>Starting quantity</Text>
              <TextInput
                style={styles.input}
                placeholder="0"
                keyboardType="numeric"
                value={initialQty}
                onChangeText={setInitialQty}
              />

              <Text style={styles.label}>Low-stock alert threshold (optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 10"
                keyboardType="numeric"
                value={lowStock}
                onChangeText={setLowStock}
              />

              <TouchableOpacity
                style={[styles.button, busy && styles.buttonDisabled]}
                onPress={addResource}
                disabled={busy}
              >
                <Text style={styles.buttonText}>
                  {busy ? "Adding..." : "Add resource"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => setModalOpen(false)} disabled={busy}>
                <Text style={styles.cancel}>Cancel</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <BottomNav variant="ngo" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFF8F3" },
  center: { flex: 1, backgroundColor: "#FFF8F3", alignItems: "center", justifyContent: "center" },
  header: { paddingTop: 56, paddingHorizontal: 16, paddingBottom: 8 },
  back: { color: "#E85D2C", marginBottom: 8, fontSize: 16 },
  title: { fontSize: 20, fontWeight: "700", color: "#111", marginBottom: 10 },
  addBtn: { backgroundColor: "#E85D2C", paddingVertical: 12, borderRadius: 20, alignItems: "center" },
  addBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  empty: { textAlign: "center", color: "#888", marginTop: 40, paddingHorizontal: 20 },
  card: { backgroundColor: "#fff", borderRadius: 14, padding: 16 },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  cardTitle: { fontSize: 16, fontWeight: "700", color: "#111" },
  cardCategory: { color: "#888", fontSize: 12, marginTop: 2, textTransform: "capitalize" },
  lowBadge: { backgroundColor: "#FEE2E2", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  lowBadgeText: { color: "#B91C1C", fontSize: 11, fontWeight: "700" },
  qtyText: { fontSize: 24, fontWeight: "800", color: "#111", marginTop: 10 },
  adjustRow: { flexDirection: "row", gap: 8, marginTop: 12 },
  adjustBtn: {
    flex: 1,
    backgroundColor: "#F7F7F7",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E5E5",
  },
  adjustBtnText: { color: "#B91C1C", fontWeight: "700" },
  adjustBtnAdd: { backgroundColor: "#F0FDF4", borderColor: "#BBF7D0" },
  adjustBtnAddText: { color: "#15803D", fontWeight: "700" },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  modalCard: { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "90%" },
  formContent: { padding: 20, paddingBottom: 35 },
  modalTitle: { fontSize: 22, fontWeight: "700", marginBottom: 18, color: "#111" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  chip: { borderWidth: 1, borderColor: "#E85D2C", borderRadius: 16, paddingVertical: 8, paddingHorizontal: 14 },
  chipActive: { backgroundColor: "#E85D2C" },
  chipText: { color: "#E85D2C", fontSize: 13 },
  chipTextActive: { color: "#fff", fontSize: 13, fontWeight: "700" },
  label: { fontSize: 14, fontWeight: "600", color: "#333", marginBottom: 6, marginTop: 4 },
  input: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#D8D8D8",
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 14,
    marginBottom: 12,
    fontSize: 16,
    color: "#222",
  },
  button: { backgroundColor: "#E85D2C", borderRadius: 12, padding: 15, alignItems: "center" },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  cancel: { textAlign: "center", marginTop: 16, color: "#777", fontSize: 15 },
});
