import {
  AGENT_REGISTRY,
  getAgentDefinition,
  getAllowedAgents,
  isAgentAllowed,
} from "./agents.ts";

import { createAgentPlan } from "./planner.ts";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function assertThrows(
  callback: () => unknown,
  expectedMessage: string,
): void {
  try {
    callback();
  } catch (error) {
    assert(
      error instanceof Error && error.message === expectedMessage,
      `Erreur attendue : ${expectedMessage}`,
    );
    return;
  }

  throw new Error(`Une erreur ${expectedMessage} était attendue.`);
}

Deno.test("Les huit agents sont enregistrés", () => {
  assert(
    Object.keys(AGENT_REGISTRY).length === 8,
    "Le registre doit contenir huit agents.",
  );
});

Deno.test("Les permissions du client sont limitées", () => {
  const allowed = getAllowedAgents("customer");

  assert(allowed.length === 3, "Le client doit avoir trois agents.");

  assert(isAgentAllowed("customer", "commerce"), "Commerce autorisé.");
  assert(isAgentAllowed("customer", "support"), "Support autorisé.");
  assert(isAgentAllowed("customer", "language"), "Language autorisé.");

  assert(!isAgentAllowed("customer", "admin"), "Admin interdit.");
  assert(!isAgentAllowed("customer", "seller"), "Seller interdit.");
  assert(!isAgentAllowed("customer", "security"), "Security interdit.");
});

Deno.test("Les permissions du vendeur sont limitées", () => {
  const allowed = getAllowedAgents("seller");

  assert(allowed.length === 4, "Le vendeur doit avoir quatre agents.");

  assert(isAgentAllowed("seller", "seller"), "Seller autorisé.");
  assert(isAgentAllowed("seller", "commerce"), "Commerce autorisé.");

  assert(!isAgentAllowed("seller", "admin"), "Admin interdit.");
  assert(!isAgentAllowed("seller", "security"), "Security interdit.");
  assert(!isAgentAllowed("seller", "logistics"), "Logistics interdit.");
  assert(!isAgentAllowed("seller", "business"), "Business interdit.");
});

Deno.test("L'administrateur possède les huit agents", () => {
  assert(
    getAllowedAgents("admin").length === 8,
    "L'administrateur doit avoir huit agents.",
  );
});

Deno.test("Un rôle inconnu ne reçoit aucune permission", () => {
  assert(
    getAllowedAgents("unknown").length === 0,
    "Un rôle inconnu ne doit avoir aucune permission.",
  );
});

Deno.test("Chaque agent possède une définition complète", () => {
  for (const agent of getAllowedAgents("admin")) {
    const definition = getAgentDefinition(agent);

    assert(definition.id === agent, `Identifiant incorrect : ${agent}`);
    assert(definition.name.length > 0, `Nom manquant : ${agent}`);
    assert(
      definition.systemPrompt.length > 0,
      `Prompt manquant : ${agent}`,
    );
  }
});

Deno.test("Le planificateur sélectionne les agents autorisés", () => {
  const plan = createAgentPlan({
    requestId: "test-customer",
    message: "Je cherche un produit et son prix.",
    role: "customer",
  });

  assert(plan.tasks.length > 0, "Au moins un agent doit être sélectionné.");

  for (const task of plan.tasks) {
    assert(
      isAgentAllowed("customer", task.agent),
      `Agent interdit sélectionné : ${task.agent}`,
    );
  }
});

Deno.test("Le planificateur ne dépasse jamais trois agents", () => {
  const plan = createAgentPlan({
    requestId: "test-admin",
    message:
      "Fraude, vendeur, livraison, business, traduction, produit et administration.",
    role: "admin",
  });

  assert(plan.tasks.length <= 3, "Plus de trois agents sélectionnés.");
  assert(plan.maxAgents === 3, "La limite doit être trois.");

  const uniqueAgents = new Set(plan.tasks.map((task) => task.agent));

  assert(
    uniqueAgents.size === plan.tasks.length,
    "Un agent ne doit pas être sélectionné deux fois.",
  );
});

Deno.test("Le planificateur utilise Support par défaut pour un client", () => {
  const plan = createAgentPlan({
    requestId: "test-default",
    message: "Bonjour.",
    role: "customer",
  });

  assert(
    plan.tasks.length === 1 && plan.tasks[0].agent === "support",
    "Support doit être sélectionné par défaut.",
  );
});

Deno.test("Le planificateur rejette un rôle inconnu", () => {
  assertThrows(
    () =>
      createAgentPlan({
        requestId: "test-invalid-role",
        message: "Bonjour",
        role: "unknown",
      }),
    "ROLE_NOT_AUTHORIZED",
  );
});

Deno.test("Le planificateur rejette un message vide", () => {
  assertThrows(
    () =>
      createAgentPlan({
        requestId: "test-empty",
        message: "   ",
        role: "customer",
      }),
    "INVALID_MESSAGE",
  );
});

Deno.test("Le planificateur rejette un message trop long", () => {
  assertThrows(
    () =>
      createAgentPlan({
        requestId: "test-long",
        message: "a".repeat(4001),
        role: "customer",
      }),
    "INVALID_MESSAGE",
  );
});
