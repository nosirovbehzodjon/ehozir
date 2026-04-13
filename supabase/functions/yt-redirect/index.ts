import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseKey);

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const contentId = parseInt(url.searchParams.get("id") ?? "", 10);
  const chatId = url.searchParams.get("chat");

  if (isNaN(contentId)) {
    return new Response("Missing or invalid content id", { status: 400 });
  }

  const { data: content, error } = await supabase
    .from("useful_content")
    .select("link")
    .eq("id", contentId)
    .maybeSingle();

  if (error || !content) {
    return new Response("Content not found", { status: 404 });
  }

  await supabase.from("useful_content_clicks").insert({
    content_id: contentId,
    chat_id: chatId ? Number(chatId) : null,
  });

  return new Response(null, {
    status: 302,
    headers: { Location: content.link },
  });
});
