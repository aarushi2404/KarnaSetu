import { useEffect, useRef, useState } from "react";
import { View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { supabase, Message } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";

export default function Chat() {
  const { conversationId, peerName } = useLocalSearchParams<{ conversationId: string; peerName?: string }>();
  const { profile } = useAuth();
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    if (!conversationId) return;

    supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .then(({ data }) => setMessages((data as Message[]) ?? []));

    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as Message]);
          listRef.current?.scrollToEnd({ animated: true });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId]);

  const send = async () => {
    const body = draft.trim();
    if (!body || !profile) return;
    setDraft("");
    const { error } = await supabase.from("messages").insert({
      conversation_id: conversationId,
      sender_id: profile.id,
      body,
    });
    if (error) console.warn(error.message);
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{peerName ?? "Chat"}</Text>
      </View>

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, gap: 8 }}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        renderItem={({ item }) => {
          const mine = item.sender_id === profile?.id;
          return (
            <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
              <Text style={mine ? styles.bubbleTextMine : styles.bubbleText}>{item.body}</Text>
            </View>
          );
        }}
      />

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="Type a message…"
          value={draft}
          onChangeText={setDraft}
          multiline
        />
        <TouchableOpacity style={styles.sendBtn} onPress={send}>
          <Text style={styles.sendText}>Send</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFF8F3" },
  header: { paddingTop: 56, paddingHorizontal: 16, paddingBottom: 8 },
  back: { color: "#E85D2C", marginBottom: 8 },
  title: { fontSize: 18, fontWeight: "700" },
  bubble: { maxWidth: "78%", borderRadius: 14, padding: 10 },
  bubbleMine: { backgroundColor: "#E85D2C", alignSelf: "flex-end", borderBottomRightRadius: 3 },
  bubbleTheirs: { backgroundColor: "#fff", alignSelf: "flex-start", borderBottomLeftRadius: 3 },
  bubbleText: { color: "#222" },
  bubbleTextMine: { color: "#fff" },
  inputRow: { flexDirection: "row", gap: 8, padding: 12, borderTopWidth: 1, borderTopColor: "#eee", backgroundColor: "#fff" },
  input: { flex: 1, borderWidth: 1, borderColor: "#ddd", borderRadius: 10, padding: 10, maxHeight: 100 },
  sendBtn: { backgroundColor: "#E85D2C", borderRadius: 10, paddingHorizontal: 16, justifyContent: "center" },
  sendText: { color: "#fff", fontWeight: "700" },
});