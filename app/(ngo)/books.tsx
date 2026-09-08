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
import { useFocusEffect, useRouter } from "expo-router";
import { supabase, BookDonation, Profile } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import BottomNav from "@/components/BottomNav";

type ProfileInfo = Pick<Profile, "id" | "full_name" | "phone" | "city">;

type BookDisplay = BookDonation & {
  ownerProfile?: ProfileInfo | null;
  requesterProfile?: ProfileInfo | null;
};

export default function BooksBoard() {
  const { profile } = useAuth();
  const router = useRouter();

  const [items, setItems] = useState<BookDisplay[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [itemDesc, setItemDesc] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data, error } = await supabase
      .from("book_donations")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.log("Books load error:", error.message);
      return;
    }

    const books = (data as BookDonation[]) ?? [];

    const profileIds = Array.from(
      new Set(
        books.flatMap((book) =>
          [book.owner_id, book.requested_by].filter(
            (id): id is string => !!id
          )
        )
      )
    );

    if (profileIds.length === 0) {
      setItems(books);
      return;
    }

    const { data: profileData, error: profileError } =
      await supabase
        .from("profiles")
        .select("id, full_name, phone, city")
        .in("id", profileIds);

    if (profileError) {
      console.log(
        "Profiles load error:",
        profileError.message
      );
      setItems(books);
      return;
    }

    const profileMap = new Map<string, ProfileInfo>();

    ((profileData as ProfileInfo[]) ?? []).forEach((person) => {
      profileMap.set(person.id, person);
    });

    const enriched: BookDisplay[] = books.map((book) => ({
      ...book,
      ownerProfile: profileMap.get(book.owner_id) ?? null,
      requesterProfile: book.requested_by
        ? profileMap.get(book.requested_by) ?? null
        : null,
    }));

    setItems(enriched);
  };

  useFocusEffect(
    useCallback(() => {
      load();
    }, [])
  );

  const closeModal = () => {
    setItemDesc("");
    setModalOpen(false);
  };

  const post = async () => {
    if (!profile?.id) {
      return Alert.alert(
        "Error",
        "You are not logged in."
      );
    }

    if (!itemDesc.trim()) {
      return Alert.alert(
        "Missing info",
        "Describe the item(s) you're giving away."
      );
    }

    setBusy(true);

    const { error } = await supabase
      .from("book_donations")
      .insert({
        owner_id: profile.id,
        item_desc: itemDesc.trim(),
        status: "available",
      });

    setBusy(false);

    if (error) {
      return Alert.alert(
        "Could not post",
        error.message
      );
    }

    closeModal();

    Alert.alert(
      "Listing posted",
      "Your book/item is now visible to people who may need it."
    );

    load();
  };

  const request = async (item: BookDisplay) => {
    if (!profile?.id) {
      return Alert.alert(
        "Error",
        "You are not logged in."
      );
    }

    if (item.owner_id === profile.id) {
      return Alert.alert(
        "Your listing",
        "You cannot request an item that you listed yourself."
      );
    }

    const { data, error } = await supabase
      .from("book_donations")
      .update({
        status: "reserved",
        requested_by: profile.id,
      })
      .eq("id", item.id)
      .eq("status", "available")
      .select();

    if (error) {
      return Alert.alert(
        "Could not request",
        error.message
      );
    }

    if (!data || data.length === 0) {
      return Alert.alert(
        "Could not request",
        "This item may already be reserved."
      );
    }

    const requesterName =
      profile.full_name?.trim() || "A user";

    const { error: notificationError } =
      await supabase
        .from("notifications")
        .insert({
          recipient_id: item.owner_id,
          type: "book_requested",
          ref_id: item.id,
          message: `${requesterName} has requested your donated item "${item.item_desc}".`,
        });

    if (notificationError) {
      console.log(
        "Notification error:",
        notificationError.message
      );
    }

    Alert.alert(
      "Requested",
      "The owner can now see your name and contact details to coordinate the handover."
    );

    load();
  };

  const markFulfilled = async (item: BookDisplay) => {
    const { error } = await supabase
      .from("book_donations")
      .update({
        status: "fulfilled",
      })
      .eq("id", item.id);

    if (error) {
      return Alert.alert(
        "Error",
        error.message
      );
    }

    Alert.alert(
      "Marked as handed over",
      "This item has been marked as fulfilled."
    );

    load();
  };

  const statusColor = (
    status: BookDonation["status"]
  ) =>
    status === "available"
      ? "#15803D"
      : status === "reserved"
      ? "#B45309"
      : "#999";

  const renderPersonInfo = (
    label: string,
    person: ProfileInfo | null | undefined
  ) => {
    if (!person) {
      return (
        <View style={styles.personBox}>
          <Text style={styles.personLabel}>
            {label}
          </Text>
          <Text style={styles.personName}>
            Profile unavailable
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.personBox}>
        <Text style={styles.personLabel}>
          {label}
        </Text>

        <Text style={styles.personName}>
          {person.full_name || "Name not available"}
        </Text>

        {person.phone ? (
          <Text style={styles.personDetail}>
            📞 {person.phone}
          </Text>
        ) : null}

        {person.city ? (
          <Text style={styles.personDetail}>
            📍 {person.city}
          </Text>
        ) : null}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
        >
          <Text style={styles.back}>‹ Back</Text>
        </TouchableOpacity>

        <Text style={styles.title}>
          Books & Items Board
        </Text>

        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => setModalOpen(true)}
        >
          <Text style={styles.addBtnText}>
            + Give an item
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        style={{ flex: 1 }}
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          padding: 16,
          gap: 12,
          paddingBottom: 110,
        }}
        ListEmptyComponent={
          <Text style={styles.empty}>
            Nothing listed yet.
          </Text>
        }
        renderItem={({ item }) => {
          const isOwner =
            item.owner_id === profile?.id;

          const isRequester =
            item.requested_by === profile?.id;

          return (
            <View style={styles.card}>
              <View style={styles.cardTop}>
                <Text style={styles.cardTitle}>
                  {item.item_desc}
                </Text>

                <Text
                  style={[
                    styles.statusTag,
                    {
                      color: statusColor(
                        item.status
                      ),
                    },
                  ]}
                >
                  {item.status}
                </Text>
              </View>

              {isOwner ? (
                <Text style={styles.youTag}>
                  ✓ Listed by you
                </Text>
              ) : (
                renderPersonInfo(
                  "Listed by",
                  item.ownerProfile
                )
              )}

              {item.status === "reserved" &&
                item.requesterProfile && (
                  <>
                    {isRequester ? (
                      <Text style={styles.youTag}>
                        ✓ You requested this item
                      </Text>
                    ) : null}

                    {renderPersonInfo(
                      "Requested by",
                      item.requesterProfile
                    )}
                  </>
                )}

              {!isOwner &&
                item.status === "available" && (
                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() =>
                      request(item)
                    }
                  >
                    <Text style={styles.actionText}>
                      Request this item
                    </Text>
                  </TouchableOpacity>
                )}

              {isOwner &&
                item.status === "reserved" && (
                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() =>
                      markFulfilled(item)
                    }
                  >
                    <Text style={styles.actionText}>
                      Mark as handed over
                    </Text>
                  </TouchableOpacity>
                )}

              {isRequester &&
                item.status === "reserved" && (
                  <Text
                    style={styles.handoverText}
                  >
                    Coordinate the handover
                    directly with the owner.
                  </Text>
                )}
            </View>
          );
        }}
      />

      <Modal
        visible={modalOpen}
        animationType="slide"
        transparent
        onRequestClose={closeModal}
      >
        <KeyboardAvoidingView
          style={styles.modalBackdrop}
          behavior={
            Platform.OS === "ios"
              ? "padding"
              : "height"
          }
        >
          <ScrollView
            contentContainerStyle={
              styles.modalScroll
            }
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>
                Give away books or items
              </Text>

              <Text style={styles.fieldLabel}>
                What are you giving away?
              </Text>

              <TextInput
                style={styles.input}
                placeholder="e.g. 10 Class 8 NCERT textbooks"
                placeholderTextColor="#999"
                value={itemDesc}
                onChangeText={setItemDesc}
                multiline
                textAlignVertical="top"
              />

              <TouchableOpacity
                style={[
                  styles.button,
                  busy &&
                    styles.buttonDisabled,
                ]}
                onPress={post}
                disabled={busy}
              >
                <Text style={styles.buttonText}>
                  {busy
                    ? "Posting..."
                    : "Post listing"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={closeModal}
                disabled={busy}
              >
                <Text style={styles.cancel}>
                  Cancel
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      <BottomNav variant="ngo" />
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
    fontSize: 14,
  },

  title: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 10,
    color: "#222",
  },

  addBtn: {
    backgroundColor: "#E85D2C",
    paddingVertical: 10,
    borderRadius: 20,
    alignItems: "center",
  },

  addBtnText: {
    color: "#fff",
    fontWeight: "600",
  },

  empty: {
    textAlign: "center",
    color: "#888",
    marginTop: 40,
  },

  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    elevation: 1,
  },

  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },

  cardTitle: {
    fontSize: 15,
    fontWeight: "700",
    flex: 1,
    marginRight: 8,
    color: "#222",
  },

  statusTag: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
  },

  youTag: {
    color: "#15803D",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 8,
  },

  personBox: {
    backgroundColor: "#FFF8F3",
    borderRadius: 10,
    padding: 10,
    marginTop: 10,
  },

  personLabel: {
    fontSize: 11,
    color: "#777",
    fontWeight: "600",
    marginBottom: 3,
  },

  personName: {
    fontSize: 14,
    color: "#222",
    fontWeight: "700",
  },

  personDetail: {
    fontSize: 12,
    color: "#555",
    marginTop: 3,
  },

  actionBtn: {
    backgroundColor: "#E85D2C",
    borderRadius: 8,
    padding: 10,
    alignItems: "center",
    marginTop: 10,
  },

  actionText: {
    color: "#fff",
    fontWeight: "700",
  },

  handoverText: {
    color: "#666",
    fontSize: 12,
    marginTop: 10,
    lineHeight: 17,
  },

  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },

  modalScroll: {
    flexGrow: 1,
    justifyContent: "flex-end",
  },

  modalCard: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 30,
  },

  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 16,
    color: "#222",
  },

  fieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#444",
    marginBottom: 6,
  },

  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
    color: "#222",
    backgroundColor: "#fff",
    minHeight: 90,
  },

  button: {
    backgroundColor: "#E85D2C",
    borderRadius: 10,
    padding: 14,
    alignItems: "center",
  },

  buttonDisabled: {
    opacity: 0.6,
  },

  buttonText: {
    color: "#fff",
    fontWeight: "700",
  },

  cancel: {
    textAlign: "center",
    marginTop: 14,
    color: "#888",
    padding: 5,
  },
});