import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
} from "react-native";
import { Link, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { supabase } from "@/lib/supabase";

type Role = "user" | "ngo";

export default function Signup() {
  const router = useRouter();

  const [role, setRole] = useState<Role>("user");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [orgName, setOrgName] = useState("");
  const [category, setCategory] = useState("");
  const [city, setCity] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [docUri, setDocUri] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const pickDoc = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.6,
    });

    if (!res.canceled) {
      setDocUri(res.assets[0].uri);
    }
  };

  const onSignup = async () => {
    // Basic validation
    if (!fullName.trim() || !email.trim() || !password.trim() || !phone.trim()) {
      return Alert.alert(
        "Missing info",
        "Please fill in your name, phone number, email and password."
      );
    }

    // Indian mobile number validation
    const cleanedPhone = phone.replace(/\D/g, "");

    if (cleanedPhone.length !== 10 || !/^[6-9]\d{9}$/.test(cleanedPhone)) {
      return Alert.alert(
        "Invalid phone number",
        "Please enter a valid 10-digit Indian mobile number."
      );
    }

    if (role === "ngo" && (!orgName.trim() || !category.trim())) {
      return Alert.alert(
        "Missing info",
        "Enter your organisation name and category."
      );
    }

    setBusy(true);

    try {
      // 1. Create Supabase Auth account
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            phone: cleanedPhone,
          },
        },
      });

      if (error) throw error;

      const userId = data.user?.id;

      if (!userId) {
        throw new Error(
          "Sign up did not return a user. Check your email to confirm."
        );
      }

      // 2. Create/update profile
      const { error: profileError } = await supabase.from("profiles").upsert({
        id: userId,
        role,
        full_name: fullName.trim(),
        phone: cleanedPhone,
        city: city.trim() || null,
        verification_status:
          role === "ngo" ? "pending_verification" : "approved",
      });

      if (profileError) throw profileError;

      // 3. If NGO, upload registration document and create NGO record
      if (role === "ngo") {
        let docUrl: string | null = null;

        if (docUri) {
          const fileExt = docUri.split(".").pop() || "jpg";
          const filePath = `${userId}/registration.${fileExt}`;

          const fileData = await fetch(docUri).then((r) => r.blob());

          const { error: uploadError } = await supabase.storage
            .from("ngo-docs")
            .upload(filePath, fileData, {
              upsert: true,
            });

          if (!uploadError) {
            const { data: pub } = supabase.storage
              .from("ngo-docs")
              .getPublicUrl(filePath);

            docUrl = pub.publicUrl;
          }
        }

        const { error: ngoError } = await supabase.from("ngos").insert({
          profile_id: userId,
          org_name: orgName.trim(),
          category: category.trim(),
          city: city.trim() || null,
          registration_doc_url: docUrl,
        });

        if (ngoError) throw ngoError;
      }

      Alert.alert(
        "Account created",
        role === "ngo"
          ? "Your NGO account is pending admin verification."
          : "Welcome to कर्णSetu!"
      );

      router.replace("/(auth)/login");
    } catch (e: any) {
      Alert.alert(
        "Sign up failed",
        e?.message ?? String(e)
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.logo}>कर्णSetu</Text>

      <Text style={styles.tagline}>
        Create your account
      </Text>

      {/* ROLE SELECTION */}
      <View style={styles.roleRow}>
        {(["user", "ngo"] as Role[]).map((r) => (
          <TouchableOpacity
            key={r}
            style={[
              styles.roleChip,
              role === r && styles.roleChipActive,
            ]}
            onPress={() => setRole(r)}
          >
            <Text
              style={
                role === r
                  ? styles.roleTextActive
                  : styles.roleText
              }
            >
              {r === "user"
                ? "Individual / Business"
                : "NGO / Shelter"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* NAME */}
      <TextInput
        style={styles.input}
        placeholder="Full name"
        placeholderTextColor="#888"
        value={fullName}
        onChangeText={setFullName}
        autoCapitalize="words"
      />

      {/* PHONE */}
      <TextInput
        style={styles.input}
        placeholder="Phone number"
        placeholderTextColor="#888"
        value={phone}
        onChangeText={(text) =>
          setPhone(text.replace(/\D/g, "").slice(0, 10))
        }
        keyboardType="phone-pad"
        maxLength={10}
      />

      {/* CITY */}
      <TextInput
        style={styles.input}
        placeholder="City"
        placeholderTextColor="#888"
        value={city}
        onChangeText={setCity}
        autoCapitalize="words"
      />

      {/* NGO FIELDS */}
      {role === "ngo" && (
        <>
          <TextInput
            style={styles.input}
            placeholder="Organisation name"
            placeholderTextColor="#888"
            value={orgName}
            onChangeText={setOrgName}
            autoCapitalize="words"
          />

          <TextInput
            style={styles.input}
            placeholder="Category (e.g. animal shelter, orphanage)"
            placeholderTextColor="#888"
            value={category}
            onChangeText={setCategory}
            autoCapitalize="words"
          />

          <TouchableOpacity
            style={styles.docButton}
            onPress={pickDoc}
          >
            <Text style={styles.docButtonText}>
              {docUri
                ? "Registration document selected ✓"
                : "Upload registration document"}
            </Text>
          </TouchableOpacity>
        </>
      )}

      {/* EMAIL */}
      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor="#888"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />

      {/* PASSWORD */}
      <TextInput
        style={styles.input}
        placeholder="Password"
        placeholderTextColor="#888"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      {/* SIGN UP */}
      <TouchableOpacity
        style={styles.button}
        onPress={onSignup}
        disabled={busy}
      >
        <Text style={styles.buttonText}>
          {busy ? "Creating account..." : "Sign Up"}
        </Text>
      </TouchableOpacity>

      {/* LOGIN */}
      <Link href="/(auth)/login" asChild>
        <TouchableOpacity>
          <Text style={styles.link}>
            Already have an account? Log in
          </Text>
        </TouchableOpacity>
      </Link>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#FFF8F3",
  },

  logo: {
    fontSize: 32,
    fontWeight: "800",
    color: "#E85D2C",
    textAlign: "center",
  },

  tagline: {
    textAlign: "center",
    color: "#555",
    marginBottom: 24,
    marginTop: 4,
  },

  roleRow: {
    flexDirection: "row",
    marginBottom: 16,
    gap: 8,
  },

  roleChip: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#E85D2C",
    borderRadius: 20,
    paddingVertical: 10,
    alignItems: "center",
  },

  roleChipActive: {
    backgroundColor: "#E85D2C",
  },

  roleText: {
    color: "#E85D2C",
    fontWeight: "600",
  },

  roleTextActive: {
    color: "#fff",
    fontWeight: "600",
  },

  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    backgroundColor: "#fff",
    color: "#222",
  },

  docButton: {
    borderWidth: 1,
    borderColor: "#E85D2C",
    borderStyle: "dashed",
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    alignItems: "center",
  },

  docButtonText: {
    color: "#E85D2C",
  },

  button: {
    backgroundColor: "#E85D2C",
    borderRadius: 10,
    padding: 15,
    alignItems: "center",
    marginTop: 8,
  },

  buttonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },

  link: {
    textAlign: "center",
    marginTop: 20,
    color: "#E85D2C",
  },
});