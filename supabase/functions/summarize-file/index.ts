import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader) return respond({ error: "Sign in to summarize files." }, 401);
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return respond({ error: "Sign in to summarize files." }, 401);
    const { fileId } = await request.json() as { fileId?: string };
    if (!fileId) return respond({ error: "A file is required." }, 400);
    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiKey) return respond({ error: "AI summary is not configured. Add GEMINI_API_KEY in Supabase Edge Function secrets." }, 503);

    const { data: file } = await admin.from("files").select("id, name, mime_type, storage_key, owner_id, is_deleted").eq("id", fileId).eq("is_deleted", false).maybeSingle();
    if (!file) return respond({ error: "File not found." }, 404);
    const { data: share } = await admin.from("shares").select("id").eq("resource_type", "file").eq("resource_id", fileId).eq("grantee_user_id", user.id).maybeSingle();
    if (file.owner_id !== user.id && !share) return respond({ error: "You do not have access to this file." }, 403);
    const { data: signed, error: signedError } = await admin.storage.from("drive-files").createSignedUrl(file.storage_key, 300);
    if (signedError || !signed) return respond({ error: "Could not read the file." }, 500);
    const fileResponse = await fetch(signed.signedUrl);
    if (!fileResponse.ok) return respond({ error: "Could not download the file for analysis." }, 500);
    const bytes = new Uint8Array(await fileResponse.arrayBuffer());
    if (bytes.byteLength > 20 * 1024 * 1024) return respond({ error: "This file is too large to summarize (20 MB maximum)." }, 413);
    const base64 = encodeBase64(bytes);
    const model = Deno.env.get("GEMINI_MODEL") ?? "gemini-2.0-flash";
    const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(geminiKey)}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: "Summarize this file clearly in 5 concise bullet points. Mention the main topic, key facts, dates, actions, and important conclusions. Do not invent details." }, { inline_data: { mime_type: file.mime_type || "application/octet-stream", data: base64 } }] }] }),
    });
    const result = await geminiResponse.json();
    if (!geminiResponse.ok) return respond({ error: result?.error?.message || "Gemini could not summarize this file." }, 502);
    const text = result?.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text || "").join("\n").trim();
    if (!text) return respond({ error: "Gemini returned an empty summary." }, 502);
    return respond({ summary: text });
  } catch (error) {
    return respond({ error: error instanceof Error ? error.message : "Could not summarize this file." }, 500);
  }
});

function encodeBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  return btoa(binary);
}

function respond(body: Record<string, string>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}