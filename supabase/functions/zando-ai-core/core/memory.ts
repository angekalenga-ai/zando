import type { AgentId, AgentMemory, AgentMemoryContext } from "./types.ts";
type UserRole = "customer" | "seller" | "admin";
type Language = "fr" | "ln" | "sw" | "en" | "auto";

export interface MemoryConfig {
  supabaseUrl: string;
  serviceKey: string;
  legacyKey: boolean;
}

interface Conversation {
  id: string;
}

interface Run {
  id: string;
}

interface AgentTrace {
  agent: string;
  status: "success" | "failed";
  content?: string;
  errorCode?: string;
}

const AGENTS = [
  "commerce", "seller", "security", "logistics",
  "support", "business", "language", "admin",
];

function getServiceKey(): { key: string; legacy: boolean } | null {
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();

  if (legacy) {
    return { key: legacy, legacy: true };
  }

  try {
    const raw = Deno.env.get("SUPABASE_SECRET_KEYS");
    if (!raw) return null;

    const keys = JSON.parse(raw);
    const configured = keys.default;

    if (typeof configured !== "string") return null;

    const key = Deno.env.get(configured)
      ?? (configured.startsWith("sb_secret_") ? configured : null);

    if (!key) return null;

    return { key, legacy: false };
  } catch {
    return null;
  }
}

export function createMemoryConfig(
  supabaseUrl: string,
): MemoryConfig | null {
  const secret = getServiceKey();

  if (!secret || !supabaseUrl) return null;

  return {
    supabaseUrl,
    serviceKey: secret.key,
    legacyKey: secret.legacy,
  };
}

async function databaseRequest(
  config: MemoryConfig,
  table: string,
  method: string,
  filters: Record<string, string> = {},
  body?: unknown,
  maxResponseBytes = 64 * 1024,
): Promise<unknown> {
  const url = new URL(`/rest/v1/${table}`, config.supabaseUrl);

  for (const [key, value] of Object.entries(filters)) {
    url.searchParams.set(key, value);
  }

  const headers = new Headers({
    apikey: config.serviceKey,
    Accept: "application/json",
  });

  if (config.legacyKey) {
    headers.set("Authorization", `Bearer ${config.serviceKey}`);
  }

  if (body !== undefined) {
    headers.set("Content-Type", "application/json");
    headers.set("Prefer", "return=representation");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7_000);

  try {
    const response = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
        throw new Error(`MEMORY_DATABASE_${response.status}`);
      }

      if (!response.body) return null;

      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let totalBytes = 0;

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          totalBytes += value.byteLength;

          if (totalBytes > maxResponseBytes) {
            await reader.cancel();
            throw new Error("MEMORY_RESPONSE_TOO_LARGE");
          }

          chunks.push(value);
        }
      } finally {
        reader.releaseLock();
      }

      if (totalBytes === 0) return null;

      const bytes = new Uint8Array(totalBytes);
      let offset = 0;

      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
      }

      const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      return JSON.parse(text);
    } finally {
    clearTimeout(timeout);
  }
}

function firstRow<T>(value: unknown): T | null {
  return Array.isArray(value) && value.length > 0
    ? value[0] as T
    : null;
}

export async function resolveConversation(
  config: MemoryConfig,
  userId: string,
  conversationId: string | null,
  title: string,
  language: Language,
): Promise<string> {
  if (conversationId) {
    if (
      conversationId.length > 64 ||
      !/^[0-9a-f-]{36}$/i.test(conversationId)
    ) {
      throw new Error("INVALID_CONVERSATION_ID");
    }

    const existing = await databaseRequest(
      config,
      "zando_ai_conversations",
      "GET",
      {
        id: `eq.${conversationId}`,
        user_id: `eq.${userId}`,
        select: "id",
        limit: "1",
      },
    );

    const row = firstRow<Conversation>(existing);

    if (!row) {
      throw new Error("CONVERSATION_NOT_FOUND");
    }

    return row.id;
  }

  const created = await databaseRequest(
    config,
    "zando_ai_conversations",
    "POST",
    {},
    {
      user_id: userId,
      title: title.slice(0, 160),
      language,
    },
  );

  const row = firstRow<Conversation>(created);

  if (!row) {
    throw new Error("CONVERSATION_CREATE_FAILED");
  }

  return row.id;
}

export async function saveConversationMessage(
  config: MemoryConfig,
  conversationId: string,
  userId: string,
  role: "user" | "assistant" | "agent",
  content: string,
  agentId?: string,
): Promise<void> {
  if (!content.trim() || content.length > 12_000) {
    throw new Error("INVALID_MEMORY_MESSAGE");
  }

  if (agentId && !AGENTS.includes(agentId)) {
    throw new Error("INVALID_MEMORY_AGENT");
  }

  await databaseRequest(
    config,
    "zando_ai_messages",
    "POST",
    {},
    {
      conversation_id: conversationId,
      user_id: userId,
      message_role: role,
      agent_id: agentId ?? null,
      content,
      metadata: {},
    },
  );

  await databaseRequest(
    config,
    "zando_ai_conversations",
    "PATCH",
    {
      id: `eq.${conversationId}`,
      user_id: `eq.${userId}`,
    },
    {
      updated_at: new Date().toISOString(),
      last_message_at: new Date().toISOString(),
    },
  );
}

export async function startMemoryRun(
  config: MemoryConfig,
  requestId: string,
  conversationId: string,
  userId: string,
  role: UserRole,
  language: Language,
): Promise<string> {
  const created = await databaseRequest(
    config,
    "zando_ai_runs",
    "POST",
    {},
    {
      request_id: requestId,
      conversation_id: conversationId,
      user_id: userId,
      user_role: role,
      language,
      status: "running",
      agents_involved: [],
      collaboration_mode: "none_v1",
      started_at: new Date().toISOString(),
    },
  );

  const row = firstRow<Run>(created);

  if (!row) {
    throw new Error("MEMORY_RUN_CREATE_FAILED");
  }

  return row.id;
}

export async function finishMemoryRun(
  config: MemoryConfig,
  runId: string,
  userId: string,
  success: boolean,
  agents: string[],
  collaboration: "none_v1" | "single_agent_v1" | "multi_agent_v1",
  answer: string,
): Promise<void> {
  const safeAgents = agents.filter((agent) => AGENTS.includes(agent));

  await databaseRequest(
    config,
    "zando_ai_runs",
    "PATCH",
    {
      id: `eq.${runId}`,
      user_id: `eq.${userId}`,
    },
    {
      status: success ? "completed" : "failed",
      agents_involved: safeAgents,
      collaboration_mode: collaboration,
      outcome_summary: answer.slice(0, 12_000),
      finished_at: new Date().toISOString(),
    },
  );
}

export async function saveAgentTraces(
  config: MemoryConfig,
  runId: string,
  traces: AgentTrace[],
): Promise<void> {
  const rows = traces
    .filter((trace) =>
      AGENTS.includes(trace.agent) &&
      trace.status === "success" &&
      typeof trace.content === "string" &&
      trace.content.trim().length > 0
    )
    .slice(0, 3)
    .map((trace, index) => ({
      run_id: runId,
      agent_id: trace.agent,
      recipient_agent_id: null,
      message_type: "analysis",
      content: trace.content!.slice(0, 12_000),
      sequence_no: index + 1,
    }));

  if (rows.length === 0) return;

  await databaseRequest(
    config,
    "zando_ai_agent_messages",
    "POST",
    {},
    rows,
  );
}

function validMemoryRows(
  value: unknown,
  expectedScope: "shared" | "user" | "agent",
  limit: number,
): AgentMemory[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((row): row is Record<string, unknown> =>
      Boolean(
        row &&
        typeof row === "object" &&
        (row as Record<string, unknown>).scope === expectedScope &&
        typeof (row as Record<string, unknown>).id === "string" &&
        typeof (row as Record<string, unknown>).memory_type === "string" &&
        typeof (row as Record<string, unknown>).content === "string" &&
        ((row as Record<string, unknown>).content as string).trim().length > 0
      )
    )
    .slice(0, limit)
    .map((row) => ({
      id: row.id as string,
      scope: expectedScope,
      memory_type: (row.memory_type as string).slice(0, 80),
      content: (row.content as string).trim().slice(0, 1000),
      confidence:
        typeof row.confidence === "number" &&
        Number.isFinite(row.confidence)
          ? Math.max(0, Math.min(1, row.confidence))
          : 0,
    }));
}

export async function loadAgentMemories(
  config: MemoryConfig,
  userId: string,
  agentIds: readonly AgentId[],
): Promise<Partial<Record<AgentId, AgentMemoryContext>>> {
  const allowed = AGENTS.filter((agent) => agentIds.includes(agent as AgentId))
    as AgentId[];

  const output: Partial<Record<AgentId, AgentMemoryContext>> = {};

  for (const agent of allowed) {
    output[agent] = {
      shared: [],
      user: [],
      agent: [],
    };
  }

  if (
    !userId ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId) ||
    allowed.length === 0
  ) {
    return output;
  }

  const expirationFilter =
    `(expires_at.is.null,expires_at.gt.${new Date().toISOString()})`;

  const requests = await Promise.allSettled([
    databaseRequest(config, "zando_ai_memories", "GET", {
      select: "id,scope,memory_type,content,confidence",
      scope: "eq.shared",
      status: "eq.active",
      or: expirationFilter,
      order: "confidence.desc,updated_at.desc",
      limit: "3",
    }, undefined, 192 * 1024),

    databaseRequest(config, "zando_ai_memories", "GET", {
      select: "id,scope,memory_type,content,confidence",
      scope: "eq.user",
      owner_user_id: `eq.${userId}`,
      status: "eq.active",
      or: expirationFilter,
      order: "confidence.desc,updated_at.desc",
      limit: "3",
    }, undefined, 192 * 1024),

    ...allowed.map((agent) =>
      databaseRequest(config, "zando_ai_memories", "GET", {
        select: "id,scope,memory_type,content,confidence",
        scope: "eq.agent",
        owner_agent_id: `eq.${agent}`,
        status: "eq.active",
        or: expirationFilter,
        order: "confidence.desc,updated_at.desc",
        limit: "2",
      }, undefined, 192 * 1024)
    ),
  ]);

  const sharedRows = requests[0].status === "fulfilled"
    ? validMemoryRows(requests[0].value, "shared", 3)
    : [];

  const userRows = requests[1].status === "fulfilled"
    ? validMemoryRows(requests[1].value, "user", 3)
    : [];

  for (let i = 0; i < allowed.length; i++) {
    const agent = allowed[i];
    const result = requests[i + 2];

    const ownRows = result.status === "fulfilled"
      ? validMemoryRows(result.value, "agent", 2)
      : [];

    output[agent] = {
      shared: sharedRows,
      user: userRows,
      agent: ownRows,
    };
  }

  return output;
}
