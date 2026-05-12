import { defineConfig, type Plugin } from "vite";
import { codeToHtml } from "shiki";
import { readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const VIRTUAL_ID = "virtual:highlighted-code";
const RESOLVED_VIRTUAL_ID = "\0" + VIRTUAL_ID;
const here = dirname(fileURLToPath(import.meta.url));
const handlerPath = resolve(here, "../../packages/handler/src/index.ts");

const ENTRYPOINTS = {
  supabase: `import { createApp } from "@hello-supabase-server/handler";\n\nDeno.serve(createApp("supabase").fetch);`,
  vercel: `import { createApp } from "../../../packages/handler/src/index.ts";\n\nexport default createApp("vercel");`,
  cloudflare: `import { createApp } from "@hello-supabase-server/handler";\n\nexport default createApp("cloudflare");`,
} as const;

const HANDLER_VANILLA = `import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type, apikey, authorization",
};

const reply = (body: string, status = 200) =>
  new Response(body, { status, headers: CORS });

const app = {
  fetch: async (req: Request): Promise<Response> => {
    if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

    if (req.headers.get("apikey") !== process.env.SUPABASE_PUBLISHABLE_KEY) {
      return reply("unauthorized", 401);
    }

    const { name } = (await req.json()) as { name: string };

    const { data, error } = await supabaseAdmin
      .from("greetings")
      .select("language, greeting");

    if (error) return reply(\`db error: \${error.message}\`, 500);
    if (!data?.length) return reply("no greetings seeded", 500);

    const pick = data[Math.floor(Math.random() * data.length)];
    return reply(\`\${pick.greeting}, \${name}! (\${pick.language})\`);
  },
};

export default app;`;

const SHIKI_THEMES = { light: "github-light", dark: "github-dark" } as const;

function highlightedCodePlugin(): Plugin {
  return {
    name: "highlighted-code",
    resolveId(id) {
      if (id === VIRTUAL_ID) return RESOLVED_VIRTUAL_ID;
    },
    async load(id) {
      if (id !== RESOLVED_VIRTUAL_ID) return;
      const handlerSrc = (await readFile(handlerPath, "utf8")).trimEnd();

      const opts = {
        lang: "ts" as const,
        themes: SHIKI_THEMES,
        defaultColor: false as const,
      };
      const handler = await codeToHtml(handlerSrc, opts);
      const handlerVanilla = await codeToHtml(HANDLER_VANILLA, opts);
      const entrypoints = {
        supabase: await codeToHtml(ENTRYPOINTS.supabase, opts),
        vercel: await codeToHtml(ENTRYPOINTS.vercel, opts),
        cloudflare: await codeToHtml(ENTRYPOINTS.cloudflare, opts),
      };
      const lineCount = handlerSrc.split("\n").length;
      const vanillaLineCount = HANDLER_VANILLA.split("\n").length;

      return [
        `export const handler = ${JSON.stringify(handler)};`,
        `export const handlerLineCount = ${lineCount};`,
        `export const handlerVanilla = ${JSON.stringify(handlerVanilla)};`,
        `export const handlerVanillaLineCount = ${vanillaLineCount};`,
        `export const entrypoints = ${JSON.stringify(entrypoints)};`,
      ].join("\n");
    },
    handleHotUpdate({ file, server }) {
      if (file === handlerPath) {
        const mod = server.moduleGraph.getModuleById(RESOLVED_VIRTUAL_ID);
        if (mod) server.moduleGraph.invalidateModule(mod);
        server.ws.send({ type: "full-reload" });
      }
    },
  };
}

export default defineConfig({
  plugins: [highlightedCodePlugin()],
  build: {
    target: "es2022",
    cssCodeSplit: false,
  },
});
