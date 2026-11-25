import type {
  AgentId,
  AgentPlan,
  AgentTask,
} from "./types.ts";

import {
  getAllowedAgents,
} from "./agents.ts";

const MAX_SPECIALISTS = 3;

const ROUTES: ReadonlyArray<{
  agent: AgentId;
  patterns: RegExp[];
}> = [
  {
    agent: "security",
    patterns: [
      /fraude|piratage|sécurité|securite|attaque|arnaque|hackage/,
    ],
  },
  {
    agent: "seller",
    patterns: [
      /vendeur|boutique|mon stock|mes produits|mes ventes|catalogue vendeur/,
    ],
  },
  {
    agent: "logistics",
    patterns: [
      /livraison|livrer|expédition|expedition|transport|colis|livreur/,
    ],
  },
  {
    agent: "business",
    patterns: [
      /business|stratégie|strategie|chiffre d'affaires|rentabilité|rentabilite|marketing|croissance/,
    ],
  },
  {
    agent: "language",
    patterns: [
      /traduire|traduction|lingala|swahili|anglais|translate/,
    ],
  },
  {
    agent: "commerce",
    patterns: [
      /produit|acheter|achat|prix|commande|comparaison|catalogue/,
    ],
  },
  {
    agent: "admin",
    patterns: [
      /supervision|administration|tableau de bord|gouvernance/,
    ],
  },
];

function normalizeMessage(message: string): string {
  return message
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function detectAgents(
  message: string,
  allowedAgents: readonly AgentId[],
): AgentId[] {
  const normalized = normalizeMessage(message);
  const selected: AgentId[] = [];

  for (const route of ROUTES) {
    if (
      allowedAgents.includes(route.agent) &&
      route.patterns.some((pattern) => pattern.test(normalized)) &&
      !selected.includes(route.agent)
    ) {
      selected.push(route.agent);
    }

    if (selected.length >= MAX_SPECIALISTS) {
      break;
    }
  }

  return selected;
}

function createTask(
  agent: AgentId,
  index: number,
): AgentTask {
  return {
    id: `task_${index + 1}`,
    agent,
    objective: "Analyser la demande sous l'angle de spécialisation attribué. Distinguer les faits, les hypothèses et les recommandations. Ne pas inventer de données ni effectuer d'opérations.",
    dependsOn: [],
  };
}

export function createAgentPlan(input: {
  requestId: string;
  message: string;
  role: string;
}): AgentPlan {
  const message = input.message.trim();

  if (!message || message.length > 4000) {
    throw new Error("INVALID_MESSAGE");
  }

  const allowedAgents = getAllowedAgents(input.role);

  if (allowedAgents.length === 0) {
    throw new Error("ROLE_NOT_AUTHORIZED");
  }

  const detected = detectAgents(message, allowedAgents);

  const authorized = detected.filter((agent) =>
    allowedAgents.includes(agent)
  );

  let selected = authorized.slice(0, MAX_SPECIALISTS);

  if (selected.length === 0) {
    selected = allowedAgents.includes("support")
      ? ["support"]
      : [allowedAgents[0]];
  }

  const tasks = selected.map((agent, index) =>
    createTask(agent, index)
  );

  return {
    requestId: input.requestId,
    tasks,
    maxAgents: MAX_SPECIALISTS,
    requiresSynthesis: tasks.length > 1,
  };
}
