import { useCallback, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import {
  supabase,
  VolunteerRequest,
  Profile,
} from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import BottomNav from "@/components/BottomNav";

type ProfileInfo = Pick<
  Profile,
  "id" | "full_name" | "phone" | "city"
>;

type NgoWithProfile = {
  id: string;
  org_name: string;
  city: string | null;
  profile_id: string;
  profile?: ProfileInfo | null;
};

interface RequestWithNgo extends VolunteerRequest {
  ngos: NgoWithProfile | null;
}

export default function VolunteerBoard() {
  const { profile } = useAuth();
  const router = useRouter();

  const [requests, setRequests] = useState<RequestWithNgo[]>([]);

  const load = async () => {
    const { data, error } = await supabase
      .from("volunteer_requests")
      .select(
        `
        *,
        ngos (
          id,
          org_name,
          city,
          profile_id
        )
        `
      )
      .order("created_at", { ascending: false });

    if (error) {
      console.log(
        "Volunteer load error:",
        error.message
      );
      return;
    }

    const rawRequests =
      (data as unknown as RequestWithNgo[]) ?? [];

    const ngoProfileIds = Array.from(
      new Set(
        rawRequests
          .map((item) => item.ngos?.profile_id)
          .filter(
            (id): id is string => !!id
          )
      )
    );

    if (ngoProfileIds.length === 0) {
      setRequests(rawRequests);
      return;
    }

    const { data: profileData, error: profileError } =
      await supabase
        .from("profiles")
        .select("id, full_name, phone, city")
        .in("id", ngoProfileIds);

    if (profileError) {
      console.log(
        "NGO profile load error:",
        profileError.message
      );
      setRequests(rawRequests);
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

    const enrichedRequests =
      rawRequests.map((item) => ({
        ...item,
        ngos: item.ngos
          ? {
              ...item.ngos,
              profile:
                profileMap.get(
                  item.ngos.profile_id
                ) ?? null,
            }
          : null,
      }));

    setRequests(enrichedRequests);
  };

  useFocusEffect(
    useCallback(() => {
      load();
    }, [])
  );

  const toggleInterest = async (
    item: RequestWithNgo
  ) => {
    if (!profile?.id) {
      return Alert.alert(
        "Error",
        "You are not logged in."
      );
    }

    const already =
      item.interested_users?.includes(
        profile.id
      );

    const updated = already
      ? (item.interested_users ?? []).filter(
          (id) => id !== profile.id
        )
      : [
          ...(item.interested_users ?? []),
          profile.id,
        ];

    const { error } = await supabase
      .from("volunteer_requests")
      .update({
        interested_users: updated,
      })
      .eq("id", item.id);

    if (error) {
      return Alert.alert(
        "Could not update",
        error.message
      );
    }

    // Send notification only when newly interested
    if (!already && item.ngos?.profile_id) {
      const volunteerName =
        profile.full_name?.trim() ||
        "A user";

      const { error: notificationError } =
        await supabase
          .from("notifications")
          .insert({
            recipient_id:
              item.ngos.profile_id,
            type: "volunteer_interest",
            ref_id: item.id,
            message: `${volunteerName} is interested in your volunteer opportunity "${item.title}".`,
          });

      if (notificationError) {
        console.log(
          "Volunteer notification error:",
          notificationError.message
        );
      }

      Alert.alert(
        "Interest registered",
        `The NGO can now see your name and contact details for "${item.title}".`
      );
    } else if (already) {
      Alert.alert(
        "Interest removed",
        "You are no longer marked as interested."
      );
    }

    load();
  };

  const formatDate = (
    dateString: string | null
  ) => {
    if (!dateString) return null;

    const date = new Date(
      `${dateString}T00:00:00`
    );

    if (Number.isNaN(date.getTime())) {
      return dateString;
    }

    return date.toLocaleDateString(
      "en-IN",
      {
        day: "numeric",
        month: "short",
        year: "numeric",
      }
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
            No opportunities posted yet.
          </Text>
        }
        renderItem={({ item }) => {
          const interested =
            profile
              ? item.interested_users?.includes(
                  profile.id
                )
              : false;

          const ngoProfile =
            item.ngos?.profile;

          return (
            <View style={styles.card}>
              <View style={styles.titleRow}>
                <Text style={styles.cardTitle}>
                  {item.title}
                </Text>
              </View>

              <View style={styles.ngoBox}>
                <Text style={styles.sectionLabel}>
                  Organised by
                </Text>

                <Text style={styles.orgName}>
                  {item.ngos?.org_name ??
                    "NGO"}
                </Text>

                {ngoProfile?.full_name ? (
                  <Text style={styles.personText}>
                    Contact:{" "}
                    {ngoProfile.full_name}
                  </Text>
                ) : null}

                {ngoProfile?.phone ? (
                  <Text style={styles.personText}>
                    📞 {ngoProfile.phone}
                  </Text>
                ) : null}

                {item.ngos?.city ||
                ngoProfile?.city ? (
                  <Text style={styles.personText}>
                    📍{" "}
                    {item.ngos?.city ??
                      ngoProfile?.city}
                  </Text>
                ) : null}
              </View>

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
                    📅{" "}
                    {formatDate(
                      item.event_date
                    )}
                  </Text>
                ) : null}
              </View>

              <Text style={styles.interestCount}>
                {item.interested_users?.length ??
                  0}{" "}
                volunteer
                {(item.interested_users
                    ?.length ?? 0) === 1
                  ? ""
                  : "s"}{" "}
                interested
              </Text>

              <TouchableOpacity
                style={[
                  styles.interestBtn,
                  interested &&
                    styles.interestBtnActive,
                ]}
                onPress={() =>
                  toggleInterest(item)
                }
              >
                <Text
                  style={
                    interested
                      ? styles.interestTextActive
                      : styles.interestText
                  }
                >
                  {interested
                    ? "✓ Interested — tap to remove"
                    : "I'm interested"}
                </Text>
              </TouchableOpacity>
            </View>
          );
        }}
      />

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
    fontSize: 14,
  },

  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#222",
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

  titleRow: {
    marginBottom: 4,
  },

  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#222",
  },

  ngoBox: {
    backgroundColor: "#FFF8F3",
    borderRadius: 10,
    padding: 10,
    marginTop: 10,
  },

  sectionLabel: {
    color: "#777",
    fontSize: 11,
    fontWeight: "600",
    marginBottom: 3,
  },

  orgName: {
    color: "#E85D2C",
    fontSize: 14,
    fontWeight: "700",
  },

  personText: {
    color: "#555",
    fontSize: 12,
    marginTop: 3,
  },

  cardDesc: {
    color: "#444",
    marginTop: 10,
    lineHeight: 19,
  },

  metaBox: {
    marginTop: 10,
  },

  cardMeta: {
    color: "#777",
    fontSize: 12,
    marginTop: 3,
  },

  interestCount: {
    color: "#E85D2C",
    fontSize: 12,
    marginTop: 8,
    fontWeight: "600",
  },

  interestBtn: {
    borderWidth: 1,
    borderColor: "#E85D2C",
    borderRadius: 8,
    padding: 11,
    alignItems: "center",
    marginTop: 10,
  },

  interestBtnActive: {
    backgroundColor: "#E85D2C",
  },

  interestText: {
    color: "#E85D2C",
    fontWeight: "700",
  },

  interestTextActive: {
    color: "#fff",
    fontWeight: "700",
  },
});