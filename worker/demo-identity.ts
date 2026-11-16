// Public demo sandbox identity.
//
// In production on Sites, a trusted gateway authenticates the user and adds the
// `oai-authenticated-user-*` headers. A standalone Cloudflare deployment has no
// such gateway, so when ZENLO_DEMO_MODE=1 this module takes its place:
//
// - every incoming `oai-*` header is discarded, so a visitor can never claim an
//   identity by sending headers;
// - each browser receives its own random, HttpOnly visitor cookie and is mapped
//   to a separate demo user, so visitors never see each other's agencies;
// - sign-in / sign-out simply issue or clear that cookie.
//
// This mode must never be enabled on a deployment that holds real data.

const COOKIE = "zenlo_demo_visitor";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days
const VISITOR_ID = /^[a-f0-9]{32}$/;

function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get("cookie") ?? "";
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return rest.join("=");
  }
  return null;
}

function safeReturnTo(url: URL): string {
  const value = url.searchParams.get("return_to") ?? "/";
  if (!value.startsWith("/") || value.startsWith("//")) return "/";
  if (/^\/(signin|signout)-with-chatgpt/.test(value)) return "/";
  return value;
}

function newVisitorId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function cookieHeader(value: string, maxAge: number): string {
  return `${COOKIE}=${value}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;
}

export type DemoResult =
  | { kind: "response"; response: Response }
  | { kind: "request"; request: Request; setCookie: string | null };

export function applyDemoIdentity(request: Request): DemoResult {
  const url = new URL(request.url);

  if (url.pathname === "/signout-with-chatgpt") {
    return {
      kind: "response",
      response: new Response(null, {
        status: 303,
        headers: { Location: safeReturnTo(url), "Set-Cookie": cookieHeader("", 0) },
      }),
    };
  }

  const existing = readCookie(request, COOKIE);
  const visitor = existing && VISITOR_ID.test(existing) ? existing : null;
  const id = visitor ?? newVisitorId();
  const setCookie = visitor ? null : cookieHeader(id, MAX_AGE);

  if (url.pathname === "/signin-with-chatgpt" || url.pathname === "/callback") {
    const headers = new Headers({ Location: safeReturnTo(url) });
    if (setCookie) headers.set("Set-Cookie", setCookie);
    return { kind: "response", response: new Response(null, { status: 303, headers }) };
  }

  const headers = new Headers(request.headers);
  for (const name of [...headers.keys()]) {
    if (name.toLowerCase().startsWith("oai-")) headers.delete(name);
  }
  headers.set("oai-authenticated-user-id", `demo-${id}`);
  headers.set("oai-authenticated-user-email", `visiteur-${id.slice(0, 8)}@demo.zenlo`);
  headers.set("oai-authenticated-user-full-name", encodeURIComponent("Visiteur démo"));
  headers.set("oai-authenticated-user-full-name-encoding", "percent-encoded-utf-8");

  return { kind: "request", request: new Request(request, { headers }), setCookie };
}
