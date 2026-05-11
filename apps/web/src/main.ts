import {
  handler,
  handlerLineCount,
  handlerVanilla,
  handlerVanillaLineCount,
  entrypoints,
} from "virtual:highlighted-code";

type Runtime = {
  id: "supabase" | "vercel" | "cloudflare";
  url: string | undefined;
  entrypointPath: string;
};

const RUNTIMES: Record<Runtime["id"], Runtime> = {
  supabase: {
    id: "supabase",
    url: import.meta.env.VITE_SUPABASE_FN_URL,
    entrypointPath: "apps/supabase/supabase/functions/hello/index.ts",
  },
  vercel: {
    id: "vercel",
    url: import.meta.env.VITE_VERCEL_FN_URL,
    entrypointPath: "apps/vercel/api/hello.ts",
  },
  cloudflare: {
    id: "cloudflare",
    url: import.meta.env.VITE_CF_FN_URL,
    entrypointPath: "apps/cloudflare/src/index.ts",
  },
};

const APIKEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

const $ = <T extends Element = HTMLElement>(s: string) =>
  document.querySelector(s) as T | null;

/* ─── Inject highlighted handler + initial entrypoint ─── */

const handlerCodeEl = $("#handler-code")!;
const handlerLineCountEls = [$("#handler-line-count"), $("#handler-line-count-2")];

type HandlerVariant = "with" | "without";
const VARIANTS: Record<HandlerVariant, { html: string; lines: number }> = {
  with:    { html: handler,        lines: handlerLineCount },
  without: { html: handlerVanilla, lines: handlerVanillaLineCount },
};

function setHandlerVariant(variant: HandlerVariant) {
  const v = VARIANTS[variant];
  handlerCodeEl.innerHTML = v.html;
  handlerLineCountEls.forEach((el) => {
    if (el) el.textContent = `${v.lines} lines`;
  });
  handlerSnippet?.setAttribute("data-variant", variant);
  document.querySelectorAll<HTMLButtonElement>(".variant-btn").forEach((btn) => {
    const active = btn.dataset.variant === variant;
    btn.classList.toggle("active", active);
    btn.setAttribute("aria-selected", String(active));
  });
}

/* ─── Collapsible shared handler ─── */
const handlerSnippet = document.querySelector<HTMLElement>(".snippet-handler");
const handlerToggle = $("#handler-toggle") as HTMLButtonElement | null;
const handlerShowAll = $("#handler-show-all") as HTMLButtonElement | null;

function toggleHandler() {
  if (!handlerSnippet) return;
  const collapsed = handlerSnippet.hasAttribute("data-collapsed");
  if (collapsed) {
    handlerSnippet.removeAttribute("data-collapsed");
    handlerToggle?.setAttribute("aria-expanded", "true");
    handlerShowAll?.setAttribute("aria-expanded", "true");
  } else {
    handlerSnippet.setAttribute("data-collapsed", "");
    handlerToggle?.setAttribute("aria-expanded", "false");
    handlerShowAll?.setAttribute("aria-expanded", "false");
  }
}

handlerToggle?.addEventListener("click", toggleHandler);
handlerShowAll?.addEventListener("click", toggleHandler);

document.querySelectorAll<HTMLButtonElement>(".variant-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    setHandlerVariant(btn.dataset.variant as HandlerVariant);
  });
});

setHandlerVariant("with");

const entryCodeEl = $("#entry-code")!;
const snippetPathLabel = $("#snippet-path-label")!;
let activeRuntime: Runtime["id"] = "supabase";

setEntrypoint("supabase");

function setEntrypoint(id: Runtime["id"]) {
  activeRuntime = id;
  entryCodeEl.classList.add("swapping");
  setTimeout(() => {
    entryCodeEl.innerHTML = entrypoints[id];
    snippetPathLabel.textContent = RUNTIMES[id].entrypointPath;
    entryCodeEl.classList.remove("swapping");
  }, 120);
}

/* ─── Tabs ─── */

const tabs = document.querySelectorAll<HTMLElement>(".tab");
const underline = $("#tab-underline")!;

function moveUnderline(tab: HTMLElement) {
  const tabsContainer = tab.parentElement!;
  const offset = tab.offsetLeft - tabsContainer.scrollLeft - 4;
  underline.style.transform = `translateX(${offset}px)`;
  underline.style.width = `${tab.offsetWidth}px`;
}

tabs.forEach((t) => {
  t.addEventListener("click", () => {
    tabs.forEach((x) => {
      x.classList.remove("active");
      x.setAttribute("aria-selected", "false");
    });
    t.classList.add("active");
    t.setAttribute("aria-selected", "true");
    moveUnderline(t);
    setEntrypoint(t.dataset.rt as Runtime["id"]);
  });
});

const initialTab = document.querySelector<HTMLElement>(".tab.active")!;
window.addEventListener("load", () => {
  // Wait for fonts so widths are correct.
  requestAnimationFrame(() => moveUnderline(initialTab));
});
window.addEventListener("resize", () => {
  const active = document.querySelector<HTMLElement>(".tab.active");
  if (active) moveUnderline(active);
});

/* ─── Theme toggle ─── */

type Theme = "dark" | "light";
const themeBtn = $("#theme-toggle") as HTMLButtonElement | null;
const themeLabel = $("#theme-label");

function currentTheme(): Theme {
  return (document.documentElement.getAttribute("data-theme") as Theme) || "dark";
}

function applyTheme(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
  if (themeLabel) themeLabel.textContent = theme;
  try { localStorage.setItem("theme", theme); } catch {}
}

applyTheme(currentTheme());

themeBtn?.addEventListener("click", () => {
  applyTheme(currentTheme() === "dark" ? "light" : "dark");
});

/* ─── Status bar Ln/Col ─── */

const nameInput = $("#name-input") as HTMLInputElement;
const cursorEl = $("#status-cursor")!;
nameInput.addEventListener("input", () => {
  cursorEl.textContent = `Ln 1, Col ${nameInput.value.length + 1}`;
});

/* ─── Submit ─── */

const form = $("#greet-form") as HTMLFormElement;
const runBtn = form.querySelector<HTMLButtonElement>(".run")!;
const repl = form;
const log = $("#term-log")!;
const termMeta = $("#term-meta")!;
const clearBtn = $("#term-clear")!;

clearBtn.addEventListener("click", () => {
  log.innerHTML =
    '<li class="hint"><span class="comment">// type a name above and press enter</span></li>';
  termMeta.textContent = "3 channels · idle";
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = (nameInput.value.trim() || "friend");

  if (!APIKEY) {
    appendLine({ kind: "err", body: "missing VITE_SUPABASE_PUBLISHABLE_KEY at build time" });
    return;
  }

  // Clear hint on first run
  log.querySelector(".hint")?.remove();

  runBtn.disabled = true;
  repl.classList.add("is-running");
  termMeta.textContent = "3 channels · running";

  // Eager request line
  appendRequestLine(name);

  const t0 = performance.now();
  const tasks = (Object.values(RUNTIMES) as Runtime[]).map((rt) => callOne(rt, name, t0));
  await Promise.allSettled(tasks);

  termMeta.textContent = `3 channels · done in ${Math.round(performance.now() - t0)}ms`;
  runBtn.disabled = false;
  repl.classList.remove("is-running");
});

/* ─── Per-runtime fetch ─── */

async function callOne(rt: Runtime, name: string, t0: number): Promise<void> {
  if (!rt.url) {
    appendLine({
      kind: "err",
      rt: rt.id,
      ms: 0,
      body: `set VITE_${rt.id.toUpperCase()}_FN_URL`,
    });
    return;
  }

  try {
    const res = await fetch(rt.url, {
      method: "POST",
      headers: { "content-type": "application/json", apikey: APIKEY! },
      body: JSON.stringify({ name }),
    });
    const ms = Math.round(performance.now() - t0);
    const text = (await res.text()).trim();

    if (!res.ok) {
      appendLine({
        kind: "err",
        rt: rt.id,
        ms,
        body: `${res.status} ${text || res.statusText}`,
      });
      return;
    }

    appendLine({ kind: "ok", rt: rt.id, ms, body: parseGreeting(text) });
  } catch (err) {
    const ms = Math.round(performance.now() - t0);
    appendLine({
      kind: "err",
      rt: rt.id,
      ms,
      body: (err as Error).message,
    });
  }
}

/* ─── Terminal log helpers ─── */

type LineSpec =
  | { kind: "req"; body: string }
  | {
      kind: "ok" | "err";
      rt: Runtime["id"];
      ms: number;
      body: string | { greeting: string; greeted: string; language: string };
    };

function appendLine(spec: LineSpec): void {
  const li = document.createElement("li");

  if (spec.kind === "req") {
    li.classList.add("req");
    li.innerHTML = `<span class="icon req">→</span><span class="body">${escapeHtml(spec.body)}</span>`;
  } else {
    const isOk = spec.kind === "ok";
    const icon = isOk ? "✓" : "✗";
    const iconClass = isOk ? "ok" : "err";
    const bodyHtml =
      typeof spec.body === "string"
        ? escapeHtml(spec.body)
        : `<span class="greeting">${escapeHtml(spec.body.greeting)}, ${escapeHtml(spec.body.greeted)}!</span><span class="lang">— ${escapeHtml(spec.body.language)}</span>`;

    li.innerHTML =
      `<span class="icon ${iconClass}">${icon}</span>` +
      `<span class="rt ${spec.rt}">${spec.rt}</span>` +
      `<span class="arrow">·</span>` +
      `<span class="ms">${spec.ms}ms</span>` +
      `<span class="body">${bodyHtml}</span>`;
  }

  log.appendChild(li);
  log.scrollTop = log.scrollHeight;
}

function appendRequestLine(name: string) {
  appendLine({ kind: "req", body: `POST /hello { "name": "${name}" }` });
}

function parseGreeting(text: string):
  | string
  | { greeting: string; greeted: string; language: string } {
  const m = text.match(/^(.+?), (.+?)! \((.+?)\)$/);
  if (!m) return text;
  return { greeting: m[1], greeted: m[2], language: m[3] };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
