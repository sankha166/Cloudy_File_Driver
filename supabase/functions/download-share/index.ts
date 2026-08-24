import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");
    if (!token || token.length < 32) {
      return new Response(JSON.stringify({ error: "Invalid link" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: link, error } = await supabase.rpc("resolve_link_share", {
      p_token: token,
    }).maybeSingle();

    if (error || !link) {
      return new Response(JSON.stringify({ error: "Link not found or expired" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (link.resource_type !== "file") {
      return new Response(JSON.stringify({ error: "Only file downloads are supported" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (link.password_protected) {
      const password = url.searchParams.get("password");
      if (!password) {
        return new Response(JSON.stringify({ requires_password: true }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: fullLink } = await supabase
        .from("link_shares")
        .select("password_hash")
        .eq("token", token)
        .maybeSingle();
      const valid = fullLink?.password_hash
        ? await crypto.subtle.digest("SHA-256", new TextEncoder().encode(password))
            .then((buf) => Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("")) === fullLink.password_hash
        : false;
      if (!valid) {
        return new Response(JSON.stringify({ error: "Incorrect password" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const { data: file } = await supabase
      .from("files")
      .select("name, mime_type, storage_key")
      .eq("id", link.resource_id)
      .maybeSingle();

    if (!file) {
      return new Response(JSON.stringify({ error: "File not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: signed, error: signedError } = await supabase
      .storage
      .from("drive-files")
      .createSignedUrl(file.storage_key, 300);

    if (signedError || !signed) {
      return new Response(JSON.stringify({ error: "Could not generate download URL" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      name: file.name,
      mime_type: file.mime_type,
      download_url: signed.signedUrl,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch {
    return new Response(JSON.stringify({ error: "Unexpected error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
