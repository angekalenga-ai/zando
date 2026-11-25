export type AgentId =
  | "commerce"
  | "seller"
  | "security"
  | "logistics"
  | "support"
  | "business"
  | "language"
  | "admin";

export type UserRole = "customer" | "seller" | "admin";

export type SupportedLanguage = "fr" | "ln" | "sw" | "en";

export type AgentResultStatus = "success" | "failed";

export interface AgentDefinition {
  id: AgentId;
  name: string;
  description: string;
  systemPrompt: string;
}

export interface AgentTask {
  id: string;
  agent: AgentId;
  objective: string;
  dependsOn: string[];
}

export interface AgentPlan {
  requestId: string;
  tasks: AgentTask[];
  maxAgents: number;
  requiresSynthesis: boolean;
}

export interface AgentMemory {
  id: string;
  scope: "shared" | "user" | "agent";
  memory_type: string;
  content: string;
  confidence: number;
}

export interface AgentMemoryContext {
  shared: AgentMemory[];
  user: AgentMemory[];
  agent: AgentMemory[];
}

export interface AgentExecutionContext {
  requestId: string;
  userId: string;
  role: UserRole;
  language: SupportedLanguage | "auto";
  originalMessage: string;
  allowedAgents: readonly AgentId[];
  deadlineAt: number;
  agentMemories?: Partial<Record<AgentId, AgentMemoryContext>>;
}

export interface AgentResult {
  taskId: string;
  agent: AgentId;
  status: AgentResultStatus;
  content?: string;
  errorCode?: string;
}

export interface OrchestrationResult {
  requestId: string;
  success: boolean;
  agentsInvolved: AgentId[];
  answer: string;
  results: AgentResult[];
  collaboration: "none_v1" | "single_agent_v1" | "multi_agent_v1";
}
