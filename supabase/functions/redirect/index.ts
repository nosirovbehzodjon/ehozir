import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseKey);

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const newsId = parseInt(url.searchParams.get("id") ?? "", 10);
  const chatId = url.searchParams.get("chat");

  if (isNaN(newsId)) {
    return new Response("Missing or invalid news id", { status: 400 });
  }

  // Look up the news link
  const { data: news, error } = await supabase
    .from("news")
    .select("link")
    .eq("id", newsId)
    .maybeSingle();

  if (error || !news) {
    return new Response("News not found", { status: 404 });
  }

  // Record the click
  await supabase.from("news_clicks").insert({
    news_id: newsId,
    chat_id: chatId ? Number(chatId) : null,
  });

  // Redirect to the actual website
  return new Response(null, {
    status: 302,
    headers: { Location: news.link },
  });
});
