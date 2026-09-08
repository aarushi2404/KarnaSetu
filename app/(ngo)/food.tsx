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
import { supabase, FoodListing, Ngo, Profile } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import BottomNav from "@/components/BottomNav";

interface FoodDisplay extends FoodListing {
  business?: Pick<Profile, "full_name" | "phone" | "city"> | null;
}

export default function NgoFoodBoard() {
  const { profile } = useAuth();
  const router = useRouter();

  const [listings, setListings] = useState<FoodDisplay[]>([]);
  const [ngo, setNgo] = useState<Ngo | null>(null);

  const load = async () => {
    if (!profile) return;

    const { data: ngoData, error: ngoError } = await supabase
      .from("ngos")
      .select("*")
      .eq("profile_id", profile.id)
      .single();

    if (ngoError) {
      console.log("NGO load error:", ngoError.message);
    }

    const currentNgo = ngoData as Ngo | null;
    setNgo(currentNgo);

    const { data, error } = await supabase
      .from("food_listings")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.log("Food load error:", error.message);
      return;
    }

    const foodData = (data as FoodListing[]) ?? [];

    const businessIds = foodData.map((item) => item.business_id);

    let businessMap: Record<
      string,
      Pick<Profile, "full_name" | "phone" | "city">
    > = {};

    if (businessIds.length > 0) {
      const { data: profiles, error: profileError } = await supabase
        .from("profiles")
        .select("id, full_name, phone, city")
        .in("id", businessIds);

      if (!profileError && profiles) {
        profiles.forEach((p) => {
          businessMap[p.id] = {
            full_name: p.full_name,
            phone: p.phone,
            city: p.city,
          };
        });
      }
    }

    const enriched = foodData.map((item) => ({
      ...item,
      business: businessMap[item.business_id] ?? null,
    }));

    setListings(enriched);
  };

  useFocusEffect(
    useCallback(() => {
      load();
    }, [profile])
  );

  const claim = async (listing: FoodListing) => {
    if (!ngo) {
      return Alert.alert(
        "NGO profile missing",
        "Your NGO profile isn't set up yet."
      );
    }

    if (profile?.verification_status !== "approved") {
      return Alert.alert(
        "Pending verification",
        "Your NGO must be approved before claiming listings."
      );
    }

    const { data, error } = await supabase
      .from("food_listings")
      .update({
        status: "claimed",
        claimed_by_ngo_id: ngo.id,
      })
      .eq("id", listing.id)
      .eq("status", "open")
      .select();

    if (error) {
      return Alert.alert("Could not claim", error.message);
    }

    if (!data || data.length === 0) {
      return Alert.alert(
        "Could not claim",
        "This listing may already be claimed."
      );
    }

    const ngoName = ngo.org_name;

    const { error: notificationError } = await supabase
      .from("notifications")
      .insert({
        recipient_id: listing.business_id,
        type: "food_claimed",
        ref_id: listing.id,
        message: `${ngoName} claimed your surplus food listing "${listing.description}".`,
      });

    if (notificationError) {
      console.log(
        "Notification error:",
        notificationError.message
      );
    }

    Alert.alert(
      "Success",
      `"${listing.description}" has been claimed by ${ngoName}.`
    );

    load();
  };

  const statusColor = (status: FoodListing["status"]) =>
    status === "open"
      ? "#15803D"
      : status === "claimed"
      ? "#B45309"
      : "#999";

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>‹ Back</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Surplus Food Board</Text>
      </View>

      <FlatList
        style={{ flex: 1 }}
        data={listings}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          padding: 16,
          gap: 12,
          paddingBottom: 30,
        }}
        ListEmptyComponent={
          <Text style={styles.empty}>
            No listings right now.
          </Text>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardTop}>
              <Text style={styles.cardTitle}>
                {item.description}
              </Text>

              <Text
                style={[
                  styles.statusTag,
                  { color: statusColor(item.status) },
                ]}
              >
                {item.status}
              </Text>
            </View>

            <Text style={styles.cardMeta}>
              Qty: {item.quantity}
            </Text>

            <Text style={styles.cardMeta}>
              Pickup by:{" "}
              {new Date(item.pickup_by).toLocaleString()}
            </Text>

            {!!item.city && (
              <Text style={styles.cardCity}>
                📍 {item.city}
              </Text>
            )}

            {item.business && (
              <View style={styles.ownerBox}>
                <Text style={styles.ownerLabel}>
                  Listed by
                </Text>

                <Text style={styles.ownerName}>
                  👤 {item.business.full_name}
                </Text>

                {!!item.business.phone && (
                  <Text style={styles.ownerDetail}>
                    📞 {item.business.phone}
                  </Text>
                )}

                {!!item.business.city && (
                  <Text style={styles.ownerDetail}>
                    📍 {item.business.city}
                  </Text>
                )}
              </View>
            )}

            {item.status === "open" && (
              <TouchableOpacity
                style={styles.claimBtn}
                onPress={() => claim(item)}
              >
                <Text style={styles.claimText}>
                  Claim this listing
                </Text>
              </TouchableOpacity>
            )}

            {item.status === "claimed" &&
              item.claimed_by_ngo_id === ngo?.id && (
                <View style={styles.claimedBox}>
                  <Text style={styles.claimedBySelf}>
                    ✓ You claimed this listing
                  </Text>

                  <Text style={styles.claimedSubtext}>
                    Coordinate pickup with the person who listed it.
                  </Text>
                </View>
              )}

            {item.status === "claimed" &&
              item.claimed_by_ngo_id !== ngo?.id && (
                <Text style={styles.alreadyClaimed}>
                  This listing has already been claimed by another NGO.
                </Text>
              )}
          </View>
        )}
      />

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
    fontSize: 16,
  },

  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111",
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

  ownerBox: {
    backgroundColor: "#F7F7F7",
    borderRadius: 10,
    padding: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#E5E5E5",
  },

  ownerLabel: {
    color: "#888",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 4,
  },

  ownerName: {
    color: "#222",
    fontSize: 14,
    fontWeight: "700",
  },

  ownerDetail: {
    color: "#555",
    fontSize: 13,
    marginTop: 4,
  },

  claimBtn: {
    backgroundColor: "#E85D2C",
    borderRadius: 10,
    padding: 12,
    alignItems: "center",
    marginTop: 12,
  },

  claimText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
  },

  claimedBox: {
    backgroundColor: "#F0FDF4",
    borderRadius: 10,
    padding: 12,
    marginTop: 12,
  },

  claimedBySelf: {
    color: "#15803D",
    fontWeight: "700",
  },

  claimedSubtext: {
    color: "#555",
    fontSize: 12,
    marginTop: 4,
  },

  alreadyClaimed: {
    color: "#B45309",
    fontSize: 12,
    marginTop: 12,
    fontWeight: "600",
  },
});