import type {
  AgentId,
  AgentPlan,
  AgentTask,
  SupportedLanguage,
} from "./types.ts";

import {
  getAllowedAgents,
} from "./agents.ts";

const MAX_SPECIALISTS = 3;

const LANGUAGE_PATTERNS: Record<SupportedLanguage, RegExp[]> = {
  fr: [
    /\b(bonjour|salut|merci|comment|pourquoi|combien|je|mon|ma|mes|vous|nous|avec|pour|est|une|des|les|dans|faire|veux|voudrais)\b/,
    /\b(est ce que|s il vous plait|j ai besoin|je voudrais|je veux)\b/,
  ],
  ln: [
    /\b(mbote|mbote na yo|nalingi|nazali|nakoki|naza|oyo|wana|ndenge|nini|boni|pesa|kosomba|koteka|biloko|mosala|makambo|ebele|moke|te)\b/,
    /\b(nalingi kosomba|nalingi koteka|nasengi yo|okoki kosalisa)\b/,
  ],
  sw: [
    /\b(habari|tafadhali|asante|nina|nataka|naweza|ninahitaji|bei|bidhaa|nunua|kuuza|duka|bidhaa|mzigo|agiza|vipi|nini|yangu|yako|kwangu|sana|ndiyo|hapana)\b/,
    /\b(nataka kununua|nataka kuuza|naomba msaada|unaweza kusaidia)\b/,
  ],
  en: [
    /\b(hello|hi|please|thanks|thank|how|what|why|where|when|who|can|could|would|should|i|my|me|we|you|your|the|is|are|for|with|need|want|help)\b/,
    /\b(i want|i need|how much|help me|can you)\b/,
  ],
};

const ROUTES: ReadonlyArray<{
  agent: AgentId;
  patterns: RegExp[];
}> = [
  {
    agent: "security",
    patterns: [
      /\b(fraude|piratage|securite|attaque|arnaque|hackage|scam|fraud|hacked|hack|security|wizi|utapeli|udanganyifu|pirate|piratee|vole|volee|mot de passe|password|bakoti|kozanga|ndingisa|imedukuliwa|ruhusa|kokosa|compromis|compromised|connexion|inconnue|suspecte|login|suspicious|akoti|ayebi|kuingia|kusikojulikana|donnees|personnelles|divulguees|fuite|ebimi|taarifa|binafsi|zimevuja|leaked|leak|breach|stolen|unauthorized)\b/,
    ],
  },
  {
    agent: "support",
    patterns: [
      /\b(reclamation|reclamations|plainte|plaintes|remboursement|rembourser|rembourse|remboursez|paiement echoue|paiement refuse|double paiement|produit defectueux|article defectueux|defectueux|non conforme|incomplet|manquant|probleme|assistance|malalamiko|malalamiko yangu|kurejeshewa|rudisha pesa|marejesho|malipo yameshindikana|imelipwa mara mbili|imeharibika|tatizo|msaada|likambo|mokakatano|kozongisa mbongo|mbongo na ngai|bafuti ngai mbala mibale|complaint|complaints|complain|refund|refunded|refunds|payment failed|payment declined|charged twice|defective|damaged|wrong item|missing item|incomplete|problem|issue|assistance)\b/,
    ],
  },
  {
    agent: "seller",
    patterns: [
      /\b(vendeur|boutique|stock|mes produits|mes ventes|catalogue vendeur|my store|my products|my sales|seller|shop|duka langu|biashara yangu|bidhaa zangu|mali yangu|nalingi koteka|koteka biloko na ngai|biloko na ngai)\b/,
    ],
  },
  {
    agent: "logistics",
    patterns: [
      /\b(livraison|livrer|expedition|transport|colis|livreur|delivery|deliver|shipping|parcel|courier|usafiri|usafirishaji|mzigo|kusafirisha|kupeleka|anwani|mpokeaji|retard|retarde|retardee|bloque|bloquee|frais|cout|tarif|eleki|mbongo|chelewa|kuchelewa|gharama|late|delayed|delay|fee|fees|cost)\b/,
    ],
  },
  {
    agent: "business",
    patterns: [
      /\b(business|strategie|chiffre d affaires|rentabilite|marketing|croissance|profit|growth|revenue|strategy|faida|biashara|mapato|ukuaji|mkakati)\b/,
    ],
  },
  {
    agent: "language",
    patterns: [
      /\b(traduire|traduction|lingala|swahili|anglais|translate|translation|tafsiri|kutafsiri)\b/,
    ],
  },
  {
    agent: "commerce",
    patterns: [
      /\b(produit|produits|chercher|cherche|rechercher|recherche|chaussure|chaussures|acheter|achat|prix|commande|comparaison|comparer|comparez|kokokanisa|kulinganisha|linganisha|comparison|comparing|catalogue|buy|purchase|price|order|product|products|compare|search|searching|find|looking for|shoes|koluka|luka|sapato|nunua|bei|talo|boni|bidhaa|ninatafuta|simu|bajeti|isiyozidi|dola|disponible|stock|inapatikana|recommande|recommander|conseille|makanisi|nipendekezee|recommend|recommendation|viatu|kutafuta|tafuta|natafuta|agiza|kuagiza|kosomba|somba|koteka)\b/,
    ],
  },
  {
    agent: "admin",
    patterns: [
      /\b(supervision|administration|tableau de bord|gouvernance|dashboard|management|admin|usimamizi|utawala|uongozi)\b/,
    ],
  },
];

export function normalizeMessage(message: string): string {
  return message
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[’']/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function detectLanguage(
  message: string,
): SupportedLanguage | "auto" {
  const normalized = normalizeMessage(message);

  if (normalized.length < 3) {
    return "auto";
  }

  const scores = (
    Object.entries(LANGUAGE_PATTERNS) as [
      SupportedLanguage,
      RegExp[],
    ][]
  ).map(([language, patterns]) => ({
    language,
    score: patterns.reduce(
      (total, pattern) => total + (pattern.test(normalized) ? 1 : 0),
      0,
    ),
  }));

  scores.sort((a, b) => b.score - a.score);

  const best = scores[0];
  const second = scores[1];

  if (!best || best.score < 2) {
    return "auto";
  }

  if (second && best.score - second.score < 1) {
    return "auto";
  }

  return best.language;
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
