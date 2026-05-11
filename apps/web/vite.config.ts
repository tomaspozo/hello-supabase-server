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
  supabase: `import app from "@hello-supabase-server/handler";\n\nDeno.serve(app.fetch);`,
  vercel: `export { default } from "../../../packages/handler/src/index.ts";`,
  cloudflare: `export { default } from "@hello-supabase-server/handler";`,
} as const;

const SHIKI_THEMES = { light: "vitesse-light", dark: "vitesse-black" } as const;

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
      const entrypoints = {
        supabase: await codeToHtml(ENTRYPOINTS.supabase, opts),
        vercel: await codeToHtml(ENTRYPOINTS.vercel, opts),
        cloudflare: await codeToHtml(ENTRYPOINTS.cloudflare, opts),
      };
      const lineCount = handlerSrc.split("\n").length;

      return [
        `export const handler = ${JSON.stringify(handler)};`,
        `export const handlerLineCount = ${lineCount};`,
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
