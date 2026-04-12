import { supabase } from "./client";

export async function rememberAuthor(
  chatId: number,
  messageId: number,
  userId: number,
): Promise<void> {
  const { error } = await supabase.from("message_authors").upsert(
    {
      chat_id: chatId,
      message_id: messageId,
      user_id: userId,
      created_at: new Date().toISOString(),
    },
    { onConflict: "chat_id,message_id" },
  );
  if (error) console.error("message_authors upsert error:", error.message);
}

export async function lookupAuthor(
  chatId: number,
  messageId: number,
): Promise<number | null> {
  const { data, error } = await supabase
    .from("message_authors")
    .select("user_id")
    .eq("chat_id", chatId)
    .eq("message_id", messageId)
    .maybeSingle();

  if (error) {
    console.error("message_authors select error:", error.message);
    return null;
  }
  return data?.user_id ?? null;
}
