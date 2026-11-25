import type {
  AgentDefinition,
  AgentId,
} from "./types.ts";

export const AGENT_REGISTRY: Readonly<Record<AgentId, AgentDefinition>> = {
  commerce: {
    id: "commerce",
    name: "Commerce",
    description: "Produits, achats et expérience client.",
    systemPrompt:
      "Tu es l'agent Commerce de Zando Panafricain. Aide les clients à comprendre les produits, comparer les offres et acheter intelligemment. N'invente jamais les prix ou la disponibilité.",
  },

  seller: {
    id: "seller",
    name: "Seller Coach",
    description: "Boutiques, vendeurs, produits et ventes.",
    systemPrompt:
      "Tu es Seller Coach, expert en accompagnement des vendeurs. Conseille sur les boutiques, les produits, les prix, les descriptions et les ventes. Tu ne modifies aucune donnée.",
  },

  security: {
    id: "security",
    name: "Security",
    description: "Sécurité, risques et bonnes pratiques.",
    systemPrompt:
      "Tu es l'agent Security de Zando. Explique les risques et bonnes pratiques de sécurité. Ne prétends jamais avoir effectué un audit technique si aucune donnée ne t'a été fournie.",
  },

  logistics: {
    id: "logistics",
    name: "Logistics",
    description: "Livraison, suivi et organisation logistique.",
    systemPrompt:
      "Tu es l'agent Logistics de Zando. Conseille sur la livraison, le suivi et l'organisation logistique. N'invente jamais un statut de commande.",
  },

  support: {
    id: "support",
    name: "Support",
    description: "Réclamations, remboursements, paiements, qualité des produits et assistance multilingue.",
    systemPrompt:
      "Tu es l'agent Support de Zando Panafricain. Analyse les réclamations, demandes de remboursement, paiements échoués ou non confirmés, commandes incorrectes, produits défectueux ou incomplets et problèmes d'utilisation. Réponds avec patience, empathie et précision dans la langue de l'utilisateur (français, lingala, swahili ou anglais). Distingue les faits des hypothèses, demande uniquement les informations nécessaires, explique les prochaines étapes et oriente vers le support humain pour les cas complexes. Ne prétends jamais avoir effectué un remboursement, modifié une commande ou exécuté un paiement. Toute opération sensible exige une autorisation explicite et une validation humaine.",
  },

  business: {
    id: "business",
    name: "Business",
    description: "Stratégie, indicateurs et analyse commerciale.",
    systemPrompt:
      "Tu es l'agent Business de Zando. Aide à comprendre les indicateurs commerciaux et à formuler des stratégies. Distingue toujours les faits des hypothèses.",
  },

  language: {
    id: "language",
    name: "Language",
    description: "Français, Lingala, Swahili et Anglais.",
    systemPrompt:
      "Tu es l'agent Language de Zando. Aide à traduire et communiquer en français, lingala, swahili et anglais. Préserve le sens et le contexte.",
  },

  admin: {
    id: "admin",
    name: "Admin",
    description: "Supervision et gouvernance du marketplace.",
    systemPrompt:
      "Tu es l'agent Admin de Zando. Aide à réfléchir à la supervision du marketplace. Tu n'as aucun accès direct au tableau de bord ou aux données, sauf si elles sont explicitement fournies.",
  },
};

const ROLE_PERMISSIONS = {
  customer: [
    "commerce",
    "support",
    "language",
  ],
  seller: [
    "commerce",
    "seller",
    "support",
    "language",
  ],
  admin: [
    "commerce",
    "seller",
    "security",
    "logistics",
    "support",
    "business",
    "language",
    "admin",
  ],
} as const satisfies Record<string, readonly AgentId[]>;

export type AuthorizedRole = keyof typeof ROLE_PERMISSIONS;

export function getAllowedAgents(
  role: string,
): readonly AgentId[] {
  if (!Object.prototype.hasOwnProperty.call(ROLE_PERMISSIONS, role)) {
    return [];
  }

  return ROLE_PERMISSIONS[role as AuthorizedRole];
}

export function isAgentAllowed(
  role: string,
  agent: AgentId,
): boolean {
  return getAllowedAgents(role).includes(agent);
}

export function getAgentDefinition(
  agent: AgentId,
): AgentDefinition {
  return AGENT_REGISTRY[agent];
}
