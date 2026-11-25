import type { AgentId, SupportedLanguage } from "./core/types.ts";
import { runOrchestration } from "./core/orchestrator.ts";
import {
  createMemoryConfig,
  resolveConversation,
  saveConversationMessage,
  startMemoryRun,
  finishMemoryRun,
  saveAgentTraces,
} from "./core/memory.ts";

function corsHeaders(origin: string | null): Headers {
  const headers = new Headers({
    "Vary": "Origin",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  });

  const allowed = (Deno.env.get("APP_ORIGINS") ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (origin && allowed.includes(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
  }

  return headers;
}

function respond(
  body: Record<string, unknown>,
  status: number,
  headers: HeadersInit,
) {
  return new Response(JSON.stringify(body), { status, headers });
}

function getPublicKey(): string | null {
  const legacy = Deno.env.get("SUPABASE_ANON_KEY")
    ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");

  if (legacy) return legacy;

  try {
    const raw = Deno.env.get("SUPABASE_PUBLISHABLE_KEYS");
    if (!raw) return null;

    const keys = JSON.parse(raw);
    const defaultKey = keys.default;

    if (typeof defaultKey !== "string") return null;

    return Deno.env.get(defaultKey)
      ?? (defaultKey.startsWith("sb_publishable_") ? defaultKey : null);
  } catch {
    return null;
  }
}

async function checkRateLimit(
  token: string,
  supabaseUrl: string,
  apiKey: string
): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5_000);

  try {
    const response = await fetch(
      new URL("/rest/v1/rpc/consume_zando_ai_core_quota", supabaseUrl),
      {
        method: "POST",
        headers: {
          apikey: apiKey,
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: "{}",
        signal: controller.signal,
      }
    );

    if (!response.ok) {
      throw new Error(`Rate limit RPC failed: ${response.status}`);
    }

    const result: unknown = await readJsonLimited(response, 1_024);

    if (typeof result !== "boolean") {
      throw new Error("Unexpected rate limit response");
    }

    return result;
  } finally {
    clearTimeout(timeout);
  }
}

async function readJsonLimited(
  response: Response,
  maxBytes: number,
): Promise<unknown> {
  const reader = response.body?.getReader();

  if (!reader) {
    throw new Error("Empty response body");
  }

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      totalBytes += value.byteLength;

      if (totalBytes > maxBytes) {
        await reader.cancel().catch(() => {});
        throw new Error("Response size limit exceeded");
      }

      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;

  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  return JSON.parse(text);
}

async function readRequestLimited(
  request: Request,
  maxBytes: number,
  timeoutMs: number,
): Promise<Uint8Array> {
  const reader = request.body?.getReader();

  if (!reader) {
    throw new Error("Request body missing");
  }

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  let timedOut = false;

  const timeout = setTimeout(() => {
    timedOut = true;
    void reader.cancel().catch(() => {});
  }, timeoutMs);

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (timedOut) {
        throw new Error("Request body timeout");
      }

      if (done) break;

      totalBytes += value.byteLength;

      if (totalBytes > maxBytes) {
        await reader.cancel().catch(() => {});
        throw new Error("Request body too large");
      }

      chunks.push(value);
    }

    const bytes = new Uint8Array(totalBytes);
    let offset = 0;

    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }

    return bytes;
  } catch (error) {
    if (timedOut) {
      throw new Error("Request body timeout");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
    reader.releaseLock();
  }
}

async function authenticate(
  token: string,
  supabaseUrl: string,
  apiKey: string,
): Promise<
  | { status: "ok"; user: { id: string; role: string } }
  | { status: "invalid" }
  | { status: "unavailable" }
  | { status: "timeout" }
> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);

  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        apikey: apiKey,
        Authorization: `Bearer ${token}`,
      },
      signal: controller.signal,
    });

    if (response.status === 401 || response.status === 403) {
      return { status: "invalid" };
    }

    if (!response.ok) {
      return { status: "unavailable" };
    }

    const user = await readJsonLimited(response, 16_000);

    if (!user || typeof user !== "object" || !("id" in user)) {
      return { status: "invalid" };
    }

    const userId = (user as { id?: unknown }).id;

    if (typeof userId !== "string" || !userId) {
      return { status: "invalid" };
    }

    const profileUrl = new URL("/rest/v1/profiles", supabaseUrl);
    profileUrl.searchParams.set("id", `eq.${userId}`);
    profileUrl.searchParams.set("select", "role");
    profileUrl.searchParams.set("limit", "1");

    const profileResponse = await fetch(profileUrl, {
      headers: {
        apikey: apiKey,
        Authorization: `Bearer ${token}`,
      },
      signal: controller.signal,
    });

    if (!profileResponse.ok) {
      return { status: "unavailable" };
    }

    const profiles = await readJsonLimited(profileResponse, 16_000);

    if (!Array.isArray(profiles) || !profiles[0]) {
      return { status: "unavailable" };
    }

    const role = profiles[0].role;

    if (typeof role !== "string" || !role) {
      return { status: "unavailable" };
    }

    return {
      status: "ok",
      user: { id: userId, role },
    };
  } catch (error) {
    if (controller.signal.aborted) {
      return { status: "timeout" };
    }

    console.error(
      "Supabase authentication error:",
      error instanceof Error ? error.message : "Unknown error",
    );

    return { status: "unavailable" };
  } finally {
    clearTimeout(timeout);
  }
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("Origin");
  const headers = corsHeaders(origin);

  if (origin && !headers.has("Access-Control-Allow-Origin")) {
    return respond({ error: "Origine non autorisée." }, 403, headers);
  }

  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 204, headers });
  }

  if (req.method !== "POST") {
    return respond({ error: "Méthode non autorisée." }, 405, headers);
  }

  try {
    const contentLength = Number(req.headers.get("content-length") ?? 0);
    if (Number.isFinite(contentLength) && contentLength > 8_000) {
      return respond({ error: "Requête trop volumineuse." }, 413, headers);
    }

    const authorization = req.headers.get("Authorization") ?? "";
    const token = authorization.startsWith("Bearer ")
      ? authorization.slice(7)
      : "";

    if (!token) {
      return respond({ error: "Authentification requise." }, 401, headers);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const apiKey = getPublicKey();

    if (!supabaseUrl || !apiKey) {
      return respond({ error: "Configuration Supabase incomplète." }, 500, headers);
    }

    const authResult = await authenticate(token, supabaseUrl, apiKey);

    if (authResult.status === "invalid") {
      return respond({ error: "Session invalide ou expirée." }, 401, headers);
    }

    if (authResult.status === "timeout") {
      return respond({ error: "Le délai de vérification de la session est dépassé." }, 504, headers);
    }

    if (authResult.status === "unavailable") {
      return respond({ error: "Le service d'authentification ou le profil est temporairement inaccessible." }, 503, headers);
    }

    const user = authResult.user;

    let bytes: Uint8Array;

    try {
      bytes = await readRequestLimited(req, 8_000, 10_000);
    } catch (error) {
      const reason = error instanceof Error ? error.message : "";

      if (reason === "Request body too large") {
        return respond({ error: "Requête trop volumineuse." }, 413, headers);
      }

      if (reason === "Request body timeout") {
        return respond({ error: "Délai de réception de la requête dépassé." }, 408, headers);
      }

      return respond({ error: "Corps de requête manquant ou illisible." }, 400, headers);
    }

    let body: unknown;

    try {
      body = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    } catch {
      return respond({ error: "Format JSON invalide." }, 400, headers);
    }

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return respond({ error: "Corps JSON invalide." }, 400, headers);
    }

    const payload = body as Record<string, unknown>;

    const message = typeof payload.message === "string"
      ? payload.message.trim()
      : "";

    if (!message || message.length > 4_000) {
      return respond({ error: "Message vide ou trop long (4 000 caractères maximum)." }, 400, headers);
    }


if (!["customer", "seller", "admin"].includes(user.role)) {
  return respond({
    error: "Ton rôle ne permet pas d'utiliser ZANDO AI CORE.",
    role: user.role,
  }, 403, headers);
}

const rawConversationId = payload.conversation_id;
if (
  rawConversationId !== undefined &&
  rawConversationId !== null &&
  typeof rawConversationId !== "string"
) {
  return respond({ error: "Identifiant de conversation invalide." }, 400, headers);
}
const requestedConversationId =
  typeof rawConversationId === "string" && rawConversationId.trim()
    ? rawConversationId.trim()
    : null;

const apiKeyAI = Deno.env.get("AI_API_KEY")?.trim();
const apiUrl = Deno.env.get("AI_API_URL")
  ?? "https://openrouter.ai/api/v1/chat/completions";

const models: Partial<Record<AgentId, string>> = {};

for (const agent of [
  "commerce", "seller", "security", "logistics",
  "support", "business", "language", "admin",
] as const) {
  const configuredModel = Deno.env
    .get(`ZANDO_AI_MODEL_${agent.toUpperCase()}`)
    ?.trim();

  if (configuredModel) {
    models[agent] = configuredModel;
  }
}

const defaultModel =
  Deno.env.get("ZANDO_AI_MODEL_DEFAULT")?.trim()
  || Deno.env.get("AI_MODEL")?.trim()
  || Object.values(models).find(
    (value): value is string => Boolean(value),
  );

if (!apiKeyAI || !defaultModel) {
  return respond({
    error: "Le fournisseur IA ou le modèle n'est pas encore configuré.",
    status: "configuration_required",
  }, 503, headers);
}

let providerUrl: URL;

try {
  providerUrl = new URL(apiUrl);
} catch {
  return respond({
    error: "L'URL du fournisseur IA est invalide.",
    status: "configuration_required",
  }, 503, headers);
}

if (
  providerUrl.protocol !== "https:" ||
  !providerUrl.hostname ||
  providerUrl.username ||
  providerUrl.password
) {
  return respond({
    error: "L'URL du fournisseur IA doit être une adresse HTTPS valide et sécurisée.",
    status: "configuration_required",
  }, 503, headers);
}

let rateLimitAllowed: boolean;

    try {
      rateLimitAllowed = await checkRateLimit(token, supabaseUrl, apiKey);
    } catch (error) {
      console.error(
        "AI rate limit error:",
        error instanceof Error ? error.message : "Unknown error"
      );

      return respond(
        { error: "La protection anti-abus est temporairement indisponible." },
        503,
        headers
      );
    }

    if (!rateLimitAllowed) {
      return respond(
        { error: "Limite atteinte. Réessaie dans une minute." },
        429,
        headers
      );
    }


const supportedLanguages = ["fr", "ln", "sw", "en"] as const;

const language: SupportedLanguage | "auto" =
  typeof payload.language === "string" &&
  supportedLanguages.includes(payload.language as SupportedLanguage)
    ? payload.language as SupportedLanguage
    : "auto";

const memoryConfig = createMemoryConfig(supabaseUrl);
if (!memoryConfig) {
  return respond({
    error: "La mémoire sécurisée de ZANDO AI CORE n'est pas configurée.",
    status: "memory_configuration_required",
  }, 503, headers);
}

const requestId = crypto.randomUUID();
let conversationId: string;
let memoryRunId: string;

try {
  conversationId = await resolveConversation(
    memoryConfig,
    user.id,
    requestedConversationId,
    message,
    language,
  );

  await saveConversationMessage(
    memoryConfig,
    conversationId,
    user.id,
    "user",
    message,
  );

  memoryRunId = await startMemoryRun(
    memoryConfig,
    requestId,
    conversationId,
    user.id,
    user.role as "customer" | "seller" | "admin",
    language,
  );
} catch (error) {
  console.error(
    "ZANDO AI memory initialization failed:",
    error instanceof Error ? error.message : "Unknown error",
  );
  return respond({
    error: "Impossible d'enregistrer la conversation pour le moment.",
  }, 503, headers);
}


let orchestration: Awaited<ReturnType<typeof runOrchestration>>;

try {
  orchestration = await runOrchestration({
    requestId,
    userId: user.id,
    role: user.role,
    message,
    language,
    apiKey: apiKeyAI,
    apiUrl: providerUrl.toString(),
    defaultModel,
    models,
    deadlineMs: 45_000,
    memoryConfig,
  });
} catch (error) {
  try {
    await finishMemoryRun(
      memoryConfig,
      memoryRunId,
      user.id,
      false,
      [],
      "none_v1",
      "Exécution interrompue.",
    );
  } catch {
    console.error("Unable to close failed ZANDO AI run.");
  }
  throw error;
}



let memoryPersisted = true;

const memoryWrites = await Promise.allSettled([
  finishMemoryRun(
    memoryConfig,
    memoryRunId,
    user.id,
    orchestration.success,
    orchestration.agentsInvolved,
    orchestration.collaboration,
    orchestration.answer,
  ),
  saveAgentTraces(
    memoryConfig,
    memoryRunId,
    orchestration.results,
  ),
  saveConversationMessage(
    memoryConfig,
    conversationId,
    user.id,
    "assistant",
    orchestration.answer.slice(0, 12_000),
  ),
]);

memoryPersisted = memoryWrites.every(
  (result) => result.status === "fulfilled",
);

if (!memoryPersisted) {
  console.error("One or more ZANDO AI memory writes failed.");
}

if (!orchestration.success) {
  return respond({
    success: false,
    core: "ZANDO AI CORE",
    role: user.role,
    agents_involved: [],
    conversation_id: conversationId,
    memory_persisted: memoryPersisted,
    answer: orchestration.answer,
    collaboration: "none_v1",
  }, 502, headers);
}

return respond({
  success: true,
  core: "ZANDO AI CORE",
  request_id: orchestration.requestId,
  conversation_id: conversationId,
  memory_persisted: memoryPersisted,
  agent: orchestration.agentsInvolved.length === 1
    ? orchestration.agentsInvolved[0]
    : null,
  agents_involved: orchestration.agentsInvolved,
  role: user.role,
  answer: orchestration.answer,
  collaboration: orchestration.collaboration,
}, 200, headers);

  } catch (error) {
    console.error("ZANDO AI CORE error:", error instanceof Error ? error.message : "Unknown error");
    return respond({ error: "Une erreur interne est survenue." }, 500, corsHeaders(req.headers.get("Origin")));
  }
})
