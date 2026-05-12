import { withSupabase } from "@supabase/server";
import type { Greeting, Platform } from "./types.ts";

export type { Platform } from "./types.ts";

export function createApp(_platform: Platform) {
  return {
    fetch: withSupabase({ auth: ["user", "publishable"] }, async (req, ctx) => {
      const { name } = (await req.json()) as { name: string };

      const { data, error } = await ctx.supabaseAdmin
        .from("greetings")
        .select<"language, greeting", Greeting>("language, greeting");

      if (error) return new Response(`db error: ${error.message}`, { status: 500 });
      if (!data?.length) return new Response("no greetings seeded", { status: 500 });

      const pick = data[Math.floor(Math.random() * data.length)];
      return Response.json({ greeting: pick.greeting, language: pick.language, name });
    }),
  };
}
