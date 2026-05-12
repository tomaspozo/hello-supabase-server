import {
  handler,
  handlerLineCount,
  handlerVanilla,
  handlerVanillaLineCount,
  entrypoints,
} from "virtual:highlighted-code";
import { supabase, type Session } from "./supabase";

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
  const tasks = (Object.values(RUNTIMES) as Runtime[]).map((rt) => callOne(rt, name));
  await Promise.allSettled(tasks);

  if (session) await refreshStats();

  termMeta.textContent = `3 channels · done in ${Math.round(performance.now() - t0)}ms`;
  runBtn.disabled = false;
  repl.classList.remove("is-running");
});

/* ─── Per-runtime fetch ─── */

type GreetingResponse = { greeting: string; name: string; language: string };

async function callOne(rt: Runtime, name: string): Promise<void> {
  if (!rt.url) {
    appendLine({
      kind: "err",
      rt: rt.id,
      ms: 0,
      body: `set VITE_${rt.id.toUpperCase()}_FN_URL`,
    });
    return;
  }

  const headers: Record<string, string> = {
    "content-type": "application/json",
    apikey: APIKEY!,
  };
  if (session) headers.authorization = `Bearer ${session.access_token}`;

  const requestId = crypto.randomUUID();
  const t0 = performance.now();

  try {
    const res = await fetch(rt.url, {
      method: "POST",
      headers,
      body: JSON.stringify({ name }),
    });
    const ms = Math.round(performance.now() - t0);
    const raw = await res.text();

    if (!res.ok) {
      appendLine({
        kind: "err",
        rt: rt.id,
        ms,
        body: `${res.status} ${raw.trim() || res.statusText}`,
      });
      return;
    }

    let payload: GreetingResponse | string;
    try {
      payload = JSON.parse(raw) as GreetingResponse;
    } catch {
      payload = raw.trim();
    }
    const body =
      typeof payload === "string"
        ? payload
        : { greeting: payload.greeting, greeted: payload.name, language: payload.language };
    appendLine({ kind: "ok", rt: rt.id, ms, body });

    await logInvocation(requestId, rt.id, ms);
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

async function logInvocation(
  requestId: string,
  platform: Runtime["id"],
  latency_ms: number,
): Promise<void> {
  if (!session || !supabase) return;
  const { error } = await supabase
    .from("invocations")
    .insert({ request_id: requestId, user_id: session.user.id, platform, latency_ms });
  if (error) console.warn(`[${platform}] invocation log failed:`, error.message);
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

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/* ─── Auth ─── */

let session: Session | null = null;

const authModal = $("#auth-modal") as HTMLElement | null;
const authBackdrop = $("#auth-modal-backdrop") as HTMLElement | null;
const authCloseBtn = $("#auth-close") as HTMLButtonElement | null;
const authOpenBtn = $("#auth-open") as HTMLButtonElement | null;
const statsSigninBtn = $("#stats-signin") as HTMLButtonElement | null;
const titleAuthLabel = $("#title-auth-label");

const authForm = $("#auth-form") as HTMLFormElement | null;
const authEmail = $("#auth-email") as HTMLInputElement | null;
const authPassword = $("#auth-password") as HTMLInputElement | null;
const authMsg = $("#auth-msg");
const authEmailLabel = $("#auth-email-label");
const signupBtn = $("#signup-btn") as HTMLButtonElement | null;
const signoutBtn = $("#signout-btn") as HTMLButtonElement | null;
const statsRefreshBtn = $("#stats-refresh") as HTMLButtonElement | null;
const statsBody = $("#stats-body");
const statsMeta = $("#stats-meta");

function setAuthMsg(text: string, kind: "error" | "info" = "info") {
  if (!authMsg) return;
  authMsg.textContent = text;
  authMsg.dataset.kind = kind;
}

function openAuthModal() {
  if (!authModal) return;
  authModal.removeAttribute("hidden");
  requestAnimationFrame(() => {
    if (session) return;
    authEmail?.focus();
  });
}

function closeAuthModal() {
  if (!authModal) return;
  authModal.setAttribute("hidden", "");
  setAuthMsg("");
}

authOpenBtn?.addEventListener("click", openAuthModal);
statsSigninBtn?.addEventListener("click", openAuthModal);
authBackdrop?.addEventListener("click", closeAuthModal);
authCloseBtn?.addEventListener("click", closeAuthModal);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && authModal && !authModal.hasAttribute("hidden")) closeAuthModal();
});

function applySession(s: Session | null) {
  session = s;
  document.body.setAttribute("data-auth", s ? "in" : "out");
  if (titleAuthLabel) titleAuthLabel.textContent = s?.user.email ?? "sign in";
  if (s?.user.email && authEmailLabel) authEmailLabel.textContent = s.user.email;
  if (s) {
    setAuthMsg("");
    closeAuthModal();
    refreshStats();
  } else {
    renderStats([]);
  }
}

if (supabase) {
  supabase.auth.getSession().then(({ data }) => applySession(data.session));
  supabase.auth.onAuthStateChange((_event, s) => applySession(s));
} else {
  applySession(null);
  setAuthMsg("auth disabled — set VITE_SUPABASE_URL in apps/web/.env", "error");
}

authForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!supabase) return;
  const email = authEmail?.value.trim();
  const password = authPassword?.value;
  if (!email || !password) return;
  setAuthMsg("signing in…");
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) setAuthMsg(error.message, "error");
});

signupBtn?.addEventListener("click", async () => {
  if (!supabase) return;
  const email = authEmail?.value.trim();
  const password = authPassword?.value;
  if (!email || !password) {
    setAuthMsg("email + password required", "error");
    return;
  }
  setAuthMsg("creating account…");
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) {
    setAuthMsg(error.message, "error");
    return;
  }
  if (!data.session) {
    setAuthMsg("check your email to confirm your account", "info");
  }
});

signoutBtn?.addEventListener("click", async () => {
  if (!supabase) return;
  await supabase.auth.signOut();
  closeAuthModal();
});

/* ─── Stats ─── */

const PLATFORMS: Runtime["id"][] = ["supabase", "vercel", "cloudflare"];

statsRefreshBtn?.addEventListener("click", () => refreshStats());

async function refreshStats() {
  if (!session || !supabase) return;
  if (statsMeta) statsMeta.textContent = "loading…";
  const { data, error } = await supabase
    .from("invocations")
    .select("platform, latency_ms")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) {
    if (statsMeta) statsMeta.textContent = `error: ${error.message}`;
    return;
  }
  renderStats(data ?? []);
  if (statsMeta) statsMeta.textContent = `your last ${Math.min(data?.length ?? 0, 100)} calls`;
}

function renderStats(rows: Array<{ platform: string; latency_ms: number }>) {
  if (!statsBody) return;
  const buckets = new Map<string, number[]>();
  for (const r of rows) {
    const arr = buckets.get(r.platform) ?? [];
    arr.push(r.latency_ms);
    buckets.set(r.platform, arr);
  }

  statsBody.innerHTML = "";
  for (const id of PLATFORMS) {
    const lats = buckets.get(id) ?? [];
    const avg = lats.length
      ? Math.round(lats.reduce((a, b) => a + b, 0) / lats.length)
      : null;
    const tr = document.createElement("tr");
    tr.setAttribute("data-rt", id);
    tr.innerHTML =
      `<td><span class="rt ${id}">${id}</span></td>` +
      `<td class="num">${lats.length || "—"}</td>` +
      `<td class="num">${avg == null ? "—" : avg + "ms"}</td>`;
    statsBody.appendChild(tr);
  }
}
