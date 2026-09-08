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
import {
  supabase,
  VolunteerRequest,
  Ngo,
  Profile,
} from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import BottomNav from "@/components/BottomNav";

type ProfileInfo = Pick<
  Profile,
  "id" | "full_name" | "phone" | "city"
>;

type VolunteerDisplay = VolunteerRequest & {
  interestedProfiles: ProfileInfo[];
};

export default function NgoVolunteerBoard() {
  const { profile } = useAuth();
  const router = useRouter();

  const [ngo, setNgo] = useState<Ngo | null>(
    null
  );

  const [requests, setRequests] = useState<
    VolunteerDisplay[]
  >([]);

  const [modalOpen, setModalOpen] =
    useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] =
    useState("");
  const [slots, setSlots] = useState("1");

  const [eventDate, setEventDate] =
    useState<Date | null>(null);

  const [showDatePicker, setShowDatePicker] =
    useState(false);

  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!profile?.id) return;

    const { data: ngoData, error: ngoError } =
      await supabase
        .from("ngos")
        .select("*")
        .eq("profile_id", profile.id)
        .single();

    if (ngoError) {
      console.log(
        "NGO load error:",
        ngoError.message
      );
      return;
    }

    const ngoRecord =
      ngoData as Ngo;

    setNgo(ngoRecord);

    const { data, error } =
      await supabase
        .from("volunteer_requests")
        .select("*")
        .eq("ngo_id", ngoRecord.id)
        .order("created_at", {
          ascending: false,
        });

    if (error) {
      console.log(
        "Volunteer requests load error:",
        error.message
      );
      return;
    }

    const opportunities =
      (data as VolunteerRequest[]) ?? [];

    const volunteerIds = Array.from(
      new Set(
        opportunities.flatMap(
          (item) =>
            item.interested_users ?? []
        )
      )
    );

    if (volunteerIds.length === 0) {
      setRequests(
        opportunities.map((item) => ({
          ...item,
          interestedProfiles: [],
        }))
      );
      return;
    }

    const {
      data: profileData,
      error: profileError,
    } = await supabase
      .from("profiles")
      .select("id, full_name, phone, city")
      .in("id", volunteerIds);

    if (profileError) {
      console.log(
        "Volunteer profiles load error:",
        profileError.message
      );

      setRequests(
        opportunities.map((item) => ({
          ...item,
          interestedProfiles: [],
        }))
      );

      return;
    }

    const profileMap = new Map<
      string,
      ProfileInfo
    >();

    ((profileData as ProfileInfo[]) ?? []).forEach(
      (person) => {
        profileMap.set(person.id, person);
      }
    );

    const enriched =
      opportunities.map((item) => ({
        ...item,
        interestedProfiles: (
          item.interested_users ?? []
        )
          .map((id) =>
            profileMap.get(id)
          )
          .filter(
            (
              person
            ): person is ProfileInfo =>
              !!person
          ),
      }));

    setRequests(enriched);
  };

  useFocusEffect(
    useCallback(() => {
      load();
    }, [profile])
  );

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setSlots("1");
    setEventDate(null);
    setShowDatePicker(false);
  };

  const closeModal = () => {
    resetForm();
    setModalOpen(false);
  };

  const formatDateForDatabase = (
    date: Date
  ) => {
    const year = date.getFullYear();

    const month = String(
      date.getMonth() + 1
    ).padStart(2, "0");

    const day = String(
      date.getDate()
    ).padStart(2, "0");

    return `${year}-${month}-${day}`;
  };

  const formatDateForDisplay = (
    date: Date
  ) => {
    return date.toLocaleDateString(
      "en-IN",
      {
        day: "numeric",
        month: "short",
        year: "numeric",
      }
    );
  };

  const post = async () => {
    if (!profile?.id) {
      return Alert.alert(
        "Error",
        "You are not logged in."
      );
    }

    if (!ngo) {
      return Alert.alert(
        "Error",
        "NGO profile could not be found."
      );
    }

    if (!title.trim()) {
      return Alert.alert(
        "Missing info",
        "Add a title for the opportunity."
      );
    }

    const slotCount =
      Number(slots);

    if (
      !Number.isInteger(slotCount) ||
      slotCount < 1
    ) {
      return Alert.alert(
        "Invalid slots",
        "Enter a valid number of slots."
      );
    }

    setBusy(true);

    const { error } =
      await supabase
        .from("volunteer_requests")
        .insert({
          ngo_id: ngo.id,
          title: title.trim(),
          description:
            description.trim() || null,
          slots_needed: slotCount,
          event_date: eventDate
            ? formatDateForDatabase(
                eventDate
              )
            : null,
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
      "Opportunity posted",
      "Your volunteer opportunity is now visible to users."
    );

    load();
  };

  const renderVolunteer = (
    person: ProfileInfo
  ) => {
    return (
      <View
        key={person.id}
        style={styles.volunteerBox}
      >
        <Text style={styles.volunteerName}>
          {person.full_name ||
            "Name not available"}
        </Text>

        {person.phone ? (
          <Text style={styles.volunteerDetail}>
            📞 {person.phone}
          </Text>
        ) : null}

        {person.city ? (
          <Text style={styles.volunteerDetail}>
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
          <Text style={styles.back}>
            ‹ Back
          </Text>
        </TouchableOpacity>

        <Text style={styles.title}>
          Volunteer & CSR Opportunities
        </Text>

        <TouchableOpacity
          style={styles.addBtn}
          onPress={() =>
            setModalOpen(true)
          }
        >
          <Text style={styles.addBtnText}>
            + Post opportunity
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        style={{ flex: 1 }}
        data={requests}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          padding: 16,
          gap: 12,
          paddingBottom: 110,
        }}
        ListEmptyComponent={
          <Text style={styles.empty}>
            You haven't posted any
            opportunities yet.
          </Text>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>
              {item.title}
            </Text>

            {!!item.description && (
              <Text style={styles.cardDesc}>
                {item.description}
              </Text>
            )}

            <View style={styles.metaBox}>
              <Text style={styles.cardMeta}>
                👥 {item.slots_needed} slot
                {item.slots_needed === 1
                  ? ""
                  : "s"} needed
              </Text>

              {item.event_date ? (
                <Text style={styles.cardMeta}>
                  📅 {formatDateForDisplay(
                    new Date(
                      `${item.event_date}T00:00:00`
                    )
                  )}
                </Text>
              ) : null}
            </View>

            <Text style={styles.interestCount}>
              {item.interestedProfiles.length}{" "}
              volunteer
              {item.interestedProfiles
                  .length === 1
                ? ""
                : "s"}{" "}
              interested
            </Text>

            {item.interestedProfiles.length >
            0 ? (
              <View style={styles.interestedSection}>
                <Text
                  style={
                    styles.interestedHeading
                  }
                >
                  Interested volunteers
                </Text>

                {item.interestedProfiles.map(
                  renderVolunteer
                )}
              </View>
            ) : (
              <Text style={styles.noVolunteers}>
                No volunteers have expressed
                interest yet.
              </Text>
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
                Post a volunteer opportunity
              </Text>

              <Text style={styles.fieldLabel}>
                Opportunity title
              </Text>

              <TextInput
                style={styles.input}
                placeholder="e.g. Food distribution drive"
                placeholderTextColor="#999"
                value={title}
                onChangeText={setTitle}
              />

              <Text style={styles.fieldLabel}>
                What will volunteers do?
              </Text>

              <TextInput
                style={[
                  styles.input,
                  styles.descriptionInput,
                ]}
                placeholder="Describe the work volunteers will do..."
                placeholderTextColor="#999"
                multiline
                textAlignVertical="top"
                value={description}
                onChangeText={
                  setDescription
                }
              />

              <Text style={styles.fieldLabel}>
                Number of volunteers needed
              </Text>

              <TextInput
                style={styles.input}
                placeholder="e.g. 5"
                placeholderTextColor="#999"
                keyboardType="number-pad"
                value={slots}
                onChangeText={setSlots}
              />

              <Text style={styles.fieldLabel}>
                Event date
              </Text>

              <TouchableOpacity
                style={styles.dateButton}
                onPress={() =>
                  setShowDatePicker(true)
                }
              >
                <Text
                  style={
                    eventDate
                      ? styles.dateText
                      : styles.datePlaceholder
                  }
                >
                  {eventDate
                    ? formatDateForDisplay(
                        eventDate
                      )
                    : "Select event date"}
                </Text>
              </TouchableOpacity>

              {showDatePicker ? (
                <View
                  style={styles.datePickerContainer}
                >
                  <DateTimePicker
                    value={
                      eventDate ??
                      new Date()
                    }
                    mode="date"
                    display="default"
                    minimumDate={
                      new Date()
                    }
                    onChange={(
                      _event,
                      selectedDate
                    ) => {
                      setShowDatePicker(false);

                      if (selectedDate) {
                        setEventDate(
                          selectedDate
                        );
                      }
                    }}
                  />
                </View>
              ) : null}

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
                    : "Post opportunity"}
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

  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#222",
  },

  cardDesc: {
    color: "#444",
    marginTop: 8,
    lineHeight: 19,
  },

  metaBox: {
    marginTop: 8,
  },

  cardMeta: {
    color: "#777",
    fontSize: 12,
    marginTop: 3,
  },

  interestCount: {
    color: "#E85D2C",
    fontSize: 13,
    marginTop: 10,
    fontWeight: "700",
  },

  interestedSection: {
    marginTop: 10,
  },

  interestedHeading: {
    color: "#444",
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 6,
  },

  volunteerBox: {
    backgroundColor: "#FFF8F3",
    borderRadius: 10,
    padding: 10,
    marginTop: 6,
  },

  volunteerName: {
    color: "#222",
    fontSize: 14,
    fontWeight: "700",
  },

  volunteerDetail: {
    color: "#555",
    fontSize: 12,
    marginTop: 3,
  },

  noVolunteers: {
    color: "#888",
    fontSize: 12,
    marginTop: 8,
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
  },

  descriptionInput: {
    height: 90,
    textAlignVertical: "top",
  },

  dateButton: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    padding: 13,
    marginBottom: 10,
    backgroundColor: "#fff",
  },

  dateText: {
    color: "#222",
    fontSize: 14,
  },

  datePlaceholder: {
    color: "#999",
    fontSize: 14,
  },

  datePickerContainer: {
    alignItems: "flex-start",
    marginBottom: 10,
  },

  button: {
    backgroundColor: "#E85D2C",
    borderRadius: 10,
    padding: 14,
    alignItems: "center",
    marginTop: 4,
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