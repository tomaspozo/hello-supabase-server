import { withSupabase } from "@supabase/server";

const app = {
  fetch: withSupabase({ auth: "publishable" }, async (req, ctx) => {
    const { name } = (await req.json()) as { name: string };

    const { data, error } = await ctx.supabaseAdmin
      .from("greetings")
      .select("language, greeting");

    if (error) return new Response(`db error: ${error.message}`, { status: 500 });
    if (!data?.length) return new Response("no greetings seeded", { status: 500 });

    const pick = data[Math.floor(Math.random() * data.length)];
    return new Response(`${pick.greeting}, ${name}! (${pick.language})`);
  }),
};

export default app;
