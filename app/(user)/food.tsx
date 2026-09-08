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
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useFocusEffect, useRouter } from "expo-router";
import { supabase, FoodListing, Ngo, Profile } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import BottomNav from "@/components/BottomNav";

interface FoodDisplay extends FoodListing {
  claimedNgo?: Ngo & {
    profile?: Pick<Profile, "full_name" | "phone"> | null;
  };
}

export default function FoodBoard() {
  const { profile } = useAuth();
  const router = useRouter();

  const [listings, setListings] = useState<FoodDisplay[]>([]);
  const [modalOpen, setModalOpen] = useState(false);

  const [description, setDescription] = useState("");
  const [quantity, setQuantity] = useState("");
  const [city, setCity] = useState(profile?.city ?? "");

  const [pickupDate, setPickupDate] = useState(() => {
    const date = new Date();
    date.setHours(date.getHours() + 4);
    return date;
  });

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data, error } = await supabase
      .from("food_listings")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.log("Food load error:", error.message);
      return;
    }

    const foodData = (data as FoodListing[]) ?? [];

    const claimedNgoIds = foodData
      .filter((item) => item.claimed_by_ngo_id)
      .map((item) => item.claimed_by_ngo_id as string);

    let ngoMap: Record<string, FoodDisplay["claimedNgo"]> = {};

    if (claimedNgoIds.length > 0) {
      const { data: ngos, error: ngoError } = await supabase
        .from("ngos")
        .select("*")
        .in("id", claimedNgoIds);

      if (!ngoError && ngos) {
        const ngoRows = ngos as Ngo[];

        const profileIds = ngoRows.map((ngo) => ngo.profile_id);

        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name, phone")
          .in("id", profileIds);

        const profileMap: Record<
          string,
          Pick<Profile, "full_name" | "phone">
        > = {};

        (profiles ?? []).forEach((p) => {
          profileMap[p.id] = {
            full_name: p.full_name,
            phone: p.phone,
          };
        });

        ngoRows.forEach((ngo) => {
          ngoMap[ngo.id] = {
            ...ngo,
            profile: profileMap[ngo.profile_id] ?? null,
          };
        });
      }
    }

    const enriched = foodData.map((item) => ({
      ...item,
      claimedNgo: item.claimed_by_ngo_id
        ? ngoMap[item.claimed_by_ngo_id]
        : undefined,
    }));

    setListings(enriched);
  };

  useFocusEffect(
    useCallback(() => {
      load();
    }, [])
  );

  const resetForm = () => {
    setDescription("");
    setQuantity("");
    setCity(profile?.city ?? "");

    const defaultDate = new Date();
    defaultDate.setHours(defaultDate.getHours() + 4);
    setPickupDate(defaultDate);
  };

  const closeModal = () => {
    if (busy) return;
    resetForm();
    setModalOpen(false);
  };

  const post = async () => {
    if (!profile?.id) {
      return Alert.alert("Error", "You are not logged in.");
    }

    if (!description.trim() || !quantity.trim() || !city.trim()) {
      return Alert.alert(
        "Missing information",
        "Please enter the food description, quantity, and city."
      );
    }

    if (pickupDate <= new Date()) {
      return Alert.alert(
        "Invalid pickup time",
        "Please choose a future pickup date and time."
      );
    }

    setBusy(true);

    const { error } = await supabase.from("food_listings").insert({
      business_id: profile.id,
      description: description.trim(),
      quantity: quantity.trim(),
      pickup_by: pickupDate.toISOString(),
      city: city.trim(),
      status: "open",
    });

    setBusy(false);

    if (error) {
      return Alert.alert("Could not post", error.message);
    }

    Alert.alert("Success", "Your surplus food listing has been posted.");

    closeModal();
    load();
  };

  const statusColor = (status: FoodListing["status"]) =>
    status === "open"
      ? "#15803D"
      : status === "claimed"
      ? "#B45309"
      : "#999";

  const formatDate = (date: Date) =>
    date.toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
    });

  const formatTime = (date: Date) =>
    date.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>‹ Back</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Surplus Food Board</Text>

        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => {
            setCity(profile?.city ?? "");
            setModalOpen(true);
          }}
        >
          <Text style={styles.addBtnText}>+ List food</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        style={{ flex: 1 }}
        data={listings}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <Text style={styles.empty}>
            No listings yet. Be the first to share surplus food!
          </Text>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardTop}>
              <Text style={styles.cardTitle}>{item.description}</Text>

              <Text
                style={[
                  styles.statusTag,
                  { color: statusColor(item.status) },
                ]}
              >
                {item.status}
              </Text>
            </View>

            <Text style={styles.cardMeta}>Qty: {item.quantity}</Text>

            <Text style={styles.cardMeta}>
              Pickup by: {new Date(item.pickup_by).toLocaleString()}
            </Text>

            {!!item.city && (
              <Text style={styles.cardCity}>📍 {item.city}</Text>
            )}

            {item.status === "claimed" && item.claimedNgo && (
              <View style={styles.personBox}>
                <Text style={styles.personLabel}>Claimed by</Text>

                <Text style={styles.personName}>
                  🏢 {item.claimedNgo.org_name}
                </Text>

                {!!item.claimedNgo.profile?.full_name && (
                  <Text style={styles.personDetail}>
                    Contact person: {item.claimedNgo.profile.full_name}
                  </Text>
                )}

                {!!item.claimedNgo.profile?.phone && (
                  <Text style={styles.personDetail}>
                    📞 {item.claimedNgo.profile.phone}
                  </Text>
                )}

                {!!item.claimedNgo.city && (
                  <Text style={styles.personDetail}>
                    📍 {item.claimedNgo.city}
                  </Text>
                )}
              </View>
            )}
          </View>
        )}
      />

      <Modal
        visible={modalOpen}
        animationType="slide"
        transparent
        onRequestClose={closeModal}
      >
        <KeyboardAvoidingView
          style={styles.modalBackdrop}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={styles.modalCard}>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.formContent}
            >
              <Text style={styles.modalTitle}>List surplus food</Text>

              <Text style={styles.label}>What's available?</Text>

              <TextInput
                style={styles.input}
                placeholder="e.g. 20 fresh veg meals"
                placeholderTextColor="#999"
                value={description}
                onChangeText={setDescription}
                returnKeyType="next"
              />

              <Text style={styles.label}>Quantity</Text>

              <TextInput
                style={styles.input}
                placeholder="e.g. 20 plates, 5 kg rice"
                placeholderTextColor="#999"
                value={quantity}
                onChangeText={setQuantity}
                returnKeyType="next"
              />

              <Text style={styles.label}>Pickup date</Text>

              <TouchableOpacity
                style={styles.selectBox}
                onPress={() => setShowDatePicker(true)}
              >
                <Text style={styles.selectText}>
                  📅 {formatDate(pickupDate)}
                </Text>
              </TouchableOpacity>

              {showDatePicker && (
                <DateTimePicker
                  value={pickupDate}
                  mode="date"
                  minimumDate={new Date()}
                  onChange={(event, selectedDate) => {
                    setShowDatePicker(false);

                    if (selectedDate) {
                      const updated = new Date(selectedDate);
                      updated.setHours(
                        pickupDate.getHours(),
                        pickupDate.getMinutes()
                      );
                      setPickupDate(updated);
                    }
                  }}
                />
              )}

              <Text style={styles.label}>Pickup time</Text>

              <TouchableOpacity
                style={styles.selectBox}
                onPress={() => setShowTimePicker(true)}
              >
                <Text style={styles.selectText}>
                  🕐 {formatTime(pickupDate)}
                </Text>
              </TouchableOpacity>

              {showTimePicker && (
                <DateTimePicker
                  value={pickupDate}
                  mode="time"
                  onChange={(event, selectedDate) => {
                    setShowTimePicker(false);

                    if (selectedDate) {
                      const updated = new Date(pickupDate);
                      updated.setHours(
                        selectedDate.getHours(),
                        selectedDate.getMinutes()
                      );
                      setPickupDate(updated);
                    }
                  }}
                />
              )}

              <Text style={styles.label}>Pickup city</Text>

              <TextInput
                style={styles.input}
                placeholder="Enter city"
                placeholderTextColor="#999"
                value={city}
                onChangeText={setCity}
                autoCapitalize="words"
              />

              <Text style={styles.hint}>
                Choose the date, time, and city that work for pickup.
              </Text>

              <TouchableOpacity
                style={[styles.button, busy && styles.buttonDisabled]}
                onPress={post}
                disabled={busy}
              >
                <Text style={styles.buttonText}>
                  {busy ? "Posting..." : "Post listing"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={closeModal} disabled={busy}>
                <Text style={styles.cancel}>Cancel</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <BottomNav variant="user" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFF8F3",
  },

  header: {
    paddingTop: 56,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },

  back: {
    color: "#E85D2C",
    marginBottom: 8,
    fontSize: 16,
  },

  title: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 10,
    color: "#111",
  },

  addBtn: {
    backgroundColor: "#E85D2C",
    paddingVertical: 12,
    borderRadius: 20,
    alignItems: "center",
  },

  addBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
  },

  empty: {
    textAlign: "center",
    color: "#888",
    marginTop: 40,
  },

  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
  },

  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },

  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    flex: 1,
    marginRight: 8,
    color: "#111",
  },

  statusTag: {
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },

  cardMeta: {
    color: "#555",
    marginTop: 6,
    fontSize: 13,
  },

  cardCity: {
    color: "#666",
    marginTop: 7,
    fontSize: 13,
  },

  personBox: {
    backgroundColor: "#FFF8F3",
    borderRadius: 10,
    padding: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#F0D6C8",
  },

  personLabel: {
    color: "#888",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 4,
  },

  personName: {
    color: "#222",
    fontSize: 14,
    fontWeight: "700",
  },

  personDetail: {
    color: "#555",
    fontSize: 13,
    marginTop: 4,
  },

  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },

  modalCard: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "90%",
  },

  formContent: {
    padding: 20,
    paddingBottom: 35,
  },

  modalTitle: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 18,
    color: "#111",
  },

  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginBottom: 6,
    marginTop: 4,
  },

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

  selectBox: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#D8D8D8",
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 15,
    marginBottom: 12,
  },

  selectText: {
    color: "#222",
    fontSize: 16,
  },

  hint: {
    color: "#777",
    fontSize: 12,
    marginBottom: 14,
    lineHeight: 18,
  },

  button: {
    backgroundColor: "#E85D2C",
    borderRadius: 12,
    padding: 15,
    alignItems: "center",
  },

  buttonDisabled: {
    opacity: 0.6,
  },

  buttonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },

  cancel: {
    textAlign: "center",
    marginTop: 16,
    color: "#777",
    fontSize: 15,
  },
});