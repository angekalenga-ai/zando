import {
  AGENT_REGISTRY,
  getAgentDefinition,
  getAllowedAgents,
  isAgentAllowed,
} from "./agents.ts";

import {
  createAgentPlan,
  detectLanguage,
} from "./planner.ts";
import { resolveLanguage } from "./orchestrator.ts";

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

Deno.test("Les permissions Support respectent les quatre cas de rôle", () => {
  assert(isAgentAllowed("customer", "support"), "Support autorisé au client.");
  assert(isAgentAllowed("seller", "support"), "Support autorisé au vendeur.");
  assert(isAgentAllowed("admin", "support"), "Support autorisé à l'administrateur.");
  assert(!isAgentAllowed("unknown", "support"), "Support interdit à un rôle inconnu.");
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


Deno.test("La langue française est détectée", () => {
  assert(
    detectLanguage("Bonjour, je voudrais acheter un produit, s'il vous plaît.") === "fr",
    "Le français doit être détecté.",
  );
});

Deno.test("La langue lingala est détectée", () => {
  assert(
    detectLanguage("Mbote, nalingi kosomba biloko. Okoki kosalisa ngai?") === "ln",
    "Le lingala doit être détecté.",
  );
});

Deno.test("La langue swahili est détectée", () => {
  assert(
    detectLanguage("Habari, nataka kununua bidhaa. Naomba msaada tafadhali.") === "sw",
    "Le swahili doit être détecté.",
  );
});

Deno.test("La langue anglaise est détectée", () => {
  assert(
    detectLanguage("Hello, I want to buy a product. Please help me.") === "en",
    "L'anglais doit être détecté.",
  );
});

Deno.test("Un message trop court conserve la langue automatique", () => {
  assert(
    detectLanguage("OK") === "auto",
    "Un message trop court doit retourner auto.",
  );
});

Deno.test("Le commerce reconnaît une demande en lingala", () => {
  const plan = createAgentPlan({
    requestId: "test-lingala-commerce",
    message: "Nalingi kosomba biloko.",
    role: "customer",
  });

  assert(
    plan.tasks.some((task) => task.agent === "commerce"),
    "L'agent commerce doit reconnaître kosomba.",
  );
});


Deno.test("Le vendeur reconnaît les demandes en lingala", () => {
  const messages = [
    "Nalingi koteka biloko na ngai",
    "Nalingi kotala biloko na ngai",
  ];

  for (const message of messages) {
    const plan = createAgentPlan({
      requestId: "test-seller-lingala",
      message,
      role: "seller",
    });

    assert(
      plan.tasks.some((task) => task.agent === "seller"),
      "L'agent seller doit reconnaître : " + message,
    );
  }
});

Deno.test("Le vendeur reconnaît les demandes en swahili", () => {
  const messages = [
    "Nataka kuuza bidhaa zangu dukani",
    "Nataka kusimamia duka langu",
  ];

  for (const message of messages) {
    const plan = createAgentPlan({
      requestId: "test-seller-swahili",
      message,
      role: "seller",
    });

    assert(
      plan.tasks.some((task) => task.agent === "seller"),
      "L'agent seller doit reconnaître : " + message,
    );
  }
});

Deno.test("Un client ne peut pas accéder à l'agent vendeur", () => {
  const plan = createAgentPlan({
    requestId: "test-customer-seller-restriction",
    message: "Nalingi koteka biloko na ngai. Vendeur, aide-moi.",
    role: "customer",
  });

  assert(
    !plan.tasks.some((task) => task.agent === "seller"),
    "Un client ne doit jamais recevoir l'agent seller.",
  );
});

Deno.test("Une langue explicitement choisie est toujours respectée", () => {
  const message = "Hello, I want to buy a product.";

  for (const language of ["fr", "ln", "sw", "en"] as const) {
    assert(
      resolveLanguage(language, message) === language,
      "La langue explicite doit être conservée : " + language,
    );
  }
});

Deno.test("La langue automatique est résolue par l'orchestrateur", () => {
  assert(
    resolveLanguage("auto", "Bonjour, je voudrais acheter un produit, s'il vous plaît.") === "fr",
    "Le français doit être résolu.",
  );
  assert(
    resolveLanguage("auto", "Mbote, nalingi kosomba biloko. Okoki kosalisa ngai?") === "ln",
    "Le lingala doit être résolu.",
  );
  assert(
    resolveLanguage("auto", "Habari, nataka kununua bidhaa. Naomba msaada tafadhali.") === "sw",
    "Le swahili doit être résolu.",
  );
  assert(
    resolveLanguage("auto", "Hello, I want to buy a product. Please help me.") === "en",
    "L'anglais doit être résolu.",
  );
});

Deno.test("Une langue ambiguë reste en mode automatique", () => {
  assert(
    resolveLanguage("auto", "OK") === "auto",
    "Un message ambigu doit conserver auto.",
  );
});


Deno.test("Les demandes logistiques sont reconnues dans les quatre langues", () => {
  const messages = [
    "Je veux suivre mon colis et ma livraison.",
    "Nalingi kolanda mzigo na ngai.",
    "Nataka kufuatilia mzigo wangu.",
    "I want to track my parcel.",
  ];

  for (const message of messages) {
    const plan = createAgentPlan({
      requestId: "test-logistics-admin",
      message,
      role: "admin",
    });

    assert(
      plan.tasks.some((task) => task.agent === "logistics"),
      "L'agent logistics doit reconnaître : " + message,
    );
  }
});

Deno.test("Les clients et vendeurs ne reçoivent jamais l'agent logistique", () => {
  for (const role of ["customer", "seller"] as const) {
    const plan = createAgentPlan({
      requestId: "test-logistics-restriction",
      message: "Je veux suivre mon colis et connaître la livraison.",
      role,
    });

    assert(
      !plan.tasks.some((task) => task.agent === "logistics"),
      "Le rôle " + role + " ne doit jamais recevoir logistics.",
    );

    assert(
      plan.tasks.some((task) => task.agent === "support"),
      "La demande du rôle " + role + " doit être prise en charge par support.",
    );
  }
});

Deno.test("Les modifications d’adresse de livraison sont reconnues", () => {
  const messages = [
    "Je veux changer mon adresse de livraison et le destinataire.",
    "Nalingi kobongola adresse ya livraison na ngai mpe kombo ya moto akozwa yango.",
    "Nataka kubadilisha anwani ya kupokea na jina la mpokeaji.",
    "I need to change my delivery address and recipient.",
  ];

  for (const message of messages) {
    const plan = createAgentPlan({
      requestId: "test-logistics-address",
      message,
      role: "admin",
    });

    assert(
      plan.tasks.some((task) => task.agent === "logistics"),
      "L’agent logistics doit reconnaître : " + message,
    );
  }
});

Deno.test("Les demandes de modification d’adresse respectent les permissions", () => {
  for (const role of ["customer", "seller"] as const) {
    const plan = createAgentPlan({
      requestId: "test-address-permissions",
      message: "Je veux changer mon adresse de livraison et le destinataire.",
      role,
    });

    assert(
      !plan.tasks.some((task) => task.agent === "logistics"),
      "Le rôle " + role + " ne doit pas recevoir logistics.",
    );

    assert(
      plan.tasks.some((task) => task.agent === "support"),
      "Le rôle " + role + " doit être orienté vers support.",
    );
  }
});

Deno.test("Les retards et colis non reçus sont reconnus dans les quatre langues", () => {
  const messages = [
    "Mon colis est en retard et je ne l'ai toujours pas reçu.",
    "Mokolo ya livraison eleki kasi nazwi colis te.",
    "Mzigo wangu umechelewa na bado sijaupata.",
    "My parcel is delayed and has not arrived.",
  ];

  for (const message of messages) {
    const plan = createAgentPlan({
      requestId: "test-logistics-delay",
      message,
      role: "admin",
    });

    assert(
      plan.tasks.some((task) => task.agent === "logistics"),
      "L'agent logistics doit reconnaître : " + message,
    );
  }
});

Deno.test("Les frais de livraison sont reconnus dans les quatre langues", () => {
  const messages = [
    "Je veux connaître les frais de livraison.",
    "Nalingi koyeba mbongo ya transport.",
    "Nataka kujua gharama ya usafirishaji.",
    "How much is the delivery fee?",
  ];

  for (const message of messages) {
    const plan = createAgentPlan({
      requestId: "test-logistics-fees",
      message,
      role: "admin",
    });

    assert(
      plan.tasks.some((task) => task.agent === "logistics"),
      "L'agent logistics doit reconnaître : " + message,
    );
  }
});

Deno.test("Security reconnaît les comptes compromis dans les quatre langues", () => {
  const messages = [
    "Mon compte a été piraté et mon mot de passe volé.",
    "Moto bakoti na compte na ngai kozanga ndingisa.",
    "Akaunti yangu imedukuliwa bila ruhusa.",
    "My account has been hacked without my permission.",
  ];

  for (const message of messages) {
    const plan = createAgentPlan({
      requestId: "test-security-account",
      message,
      role: "admin",
    });

    assert(
      plan.tasks.some((task) => task.agent === "security"),
      "Security doit reconnaître : " + message,
    );
  }
});

Deno.test("Security reconnaît les fraudes dans les quatre langues", () => {
  const messages = [
    "Je soupçonne une arnaque et une tentative de fraude.",
    "Moto bazali koluka kokosa ngai.",
    "Ninashuku utapeli na udanganyifu.",
    "I suspect a scam and an attempted fraud.",
  ];

  for (const message of messages) {
    const plan = createAgentPlan({
      requestId: "test-security-fraud",
      message,
      role: "admin",
    });

    assert(
      plan.tasks.some((task) => task.agent === "security"),
      "Security doit reconnaître : " + message,
    );
  }
});

Deno.test("Security reconnaît les connexions suspectes dans les quatre langues", () => {
  const messages = [
    "Une connexion inconnue et suspecte a été détectée sur mon compte.",
    "Moto moto ayebi te akoti na compte na ngai.",
    "Kuna kuingia kusikojulikana kwenye akaunti yangu.",
    "There was a suspicious login to my account.",
  ];

  for (const message of messages) {
    const plan = createAgentPlan({
      requestId: "test-security-login",
      message,
      role: "admin",
    });

    assert(
      plan.tasks.some((task) => task.agent === "security"),
      "Security doit reconnaître : " + message,
    );
  }
});

Deno.test("Security reconnaît les fuites de données personnelles dans les quatre langues", () => {
  const messages = [
    "Mes données personnelles ont été volées et divulguées.",
    "Ba données na ngai ebimi mpe bato bazwi yango.",
    "Taarifa zangu binafsi zimevuja.",
    "My personal data has been leaked.",
  ];

  for (const message of messages) {
    const plan = createAgentPlan({
      requestId: "test-security-data",
      message,
      role: "admin",
    });

    assert(
      plan.tasks.some((task) => task.agent === "security"),
      "Security doit reconnaître : " + message,
    );
  }
});

Deno.test("Support reconnaît les réclamations dans les quatre langues", () => {
  const messages = [
    "Je souhaite déposer une réclamation concernant ma commande.",
    "Nazali na likambo, nalingi kosenga msaada.",
    "Nina malalamiko kuhusu agizo langu.",
    "I want to make a complaint about my order.",
  ];

  for (const message of messages) {
    const plan = createAgentPlan({
      requestId: "test-support-complaint",
      message,
      role: "admin",
    });

    assert(
      plan.tasks.some((task) => task.agent === "support"),
      "Support doit reconnaître : " + message,
    );
  }
});

Deno.test("Support reconnaît les demandes de remboursement dans les quatre langues", () => {
  const messages = [
    "Je demande un remboursement pour ma commande.",
    "Nalingi kozongisa mbongo na ngai.",
    "Nataka kurejeshewa pesa yangu.",
    "I want a refund for this order.",
  ];

  for (const message of messages) {
    const plan = createAgentPlan({
      requestId: "test-support-refund",
      message,
      role: "admin",
    });

    assert(
      plan.tasks.some((task) => task.agent === "support"),
      "Support doit reconnaître : " + message,
    );
  }
});

Deno.test("Support reconnaît les paiements échoués dans les quatre langues", () => {
  const messages = [
    "Mon paiement a échoué.",
    "Mbongo na ngai elongi te.",
    "Malipo yameshindikana.",
    "My payment failed.",
  ];

  for (const message of messages) {
    const plan = createAgentPlan({
      requestId: "test-support-payment",
      message,
      role: "admin",
    });

    assert(
      plan.tasks.some((task) => task.agent === "support"),
      "Support doit reconnaître : " + message,
    );
  }
});

Deno.test("Support reconnaît les produits défectueux dans les quatre langues", () => {
  const messages = [
    "Le produit est défectueux.",
    "Eloko na ngai ebebi.",
    "Bidhaa yangu imeharibika.",
    "My product is defective.",
  ];

  for (const message of messages) {
    const plan = createAgentPlan({
      requestId: "test-support-defective",
      message,
      role: "admin",
    });

    assert(
      plan.tasks.some((task) => task.agent === "support"),
      "Support doit reconnaître : " + message,
    );
  }
});

Deno.test("Commerce reconnaît la recherche de produits dans les quatre langues", () => {
  const messages = [
    "Je cherche des chaussures sur Zando.",
    "Nazali koluka sapato na Zando.",
    "Natafuta viatu kwenye Zando.",
    "I am looking for shoes on Zando.",
  ];

  for (const message of messages) {
    const plan = createAgentPlan({
      requestId: "test-commerce-search",
      message,
      role: "customer",
    });

    assert(
      plan.tasks.some((task) => task.agent === "commerce"),
      "Commerce doit reconnaître la recherche : " + message,
    );
  }
});

Deno.test("Commerce reconnaît la comparaison de produits dans les quatre langues", () => {
  const messages = [
    "Je veux comparer ces deux téléphones.",
    "Nalingi kokokanisa biloko oyo mibale.",
    "Nataka kulinganisha bidhaa hizi mbili.",
    "I want to compare these two products.",
  ];

  for (const message of messages) {
    const plan = createAgentPlan({
      requestId: "test-commerce-comparison",
      message,
      role: "customer",
    });

    assert(
      plan.tasks.some((task) => task.agent === "commerce"),
      "Commerce doit reconnaître la comparaison : " + message,
    );
  }
});

Deno.test("Commerce reconnaît les demandes de prix dans les quatre langues", () => {
  const messages = [
    "Quel est le prix de ce téléphone ?",
    "Biloko oyo ezali na talo boni ?",
    "Bidhaa hii inauzwa bei gani ?",
    "How much does this product cost?",
  ];

  for (const message of messages) {
    const plan = createAgentPlan({
      requestId: "test-commerce-price",
      message,
      role: "customer",
    });

    assert(
      plan.tasks.some((task) => task.agent === "commerce"),
      "Commerce doit reconnaître la demande de prix : " + message,
    );
  }
});

Deno.test("Commerce reconnaît les demandes de budget dans les quatre langues", () => {
  const messages = [
    "Je cherche un téléphone à moins de 200 USD.",
    "Nazali koluka telefone na mbongo oyo eleki 200 te.",
    "Ninatafuta simu kwa bajeti isiyozidi dola 200.",
    "Find me a phone under $200.",
  ];

  for (const message of messages) {
    const plan = createAgentPlan({
      requestId: "test-commerce-budget",
      message,
      role: "customer",
    });

    assert(
      plan.tasks.some((task) => task.agent === "commerce"),
      "Commerce doit reconnaître le budget : " + message,
    );
  }
});

Deno.test("Commerce reconnaît les demandes de disponibilité dans les quatre langues", () => {
  const messages = [
    "Ce téléphone est-il disponible ?",
    "Telefoni oyo ezali na stock ?",
    "Je, simu hii inapatikana ?",
    "Is this phone in stock?",
  ];

  for (const message of messages) {
    const plan = createAgentPlan({
      requestId: "test-commerce-availability",
      message,
      role: "customer",
    });

    assert(
      plan.tasks.some((task) => task.agent === "commerce"),
      "Commerce doit reconnaître la disponibilité : " + message,
    );
  }
});

Deno.test("Commerce reconnaît les demandes de recommandations dans les quatre langues", () => {
  const messages = [
    "Recommande-moi un bon téléphone.",
    "Pesa ngai makanisi ya telefone moko ya malamu.",
    "Nipendekezee simu nzuri.",
    "Recommend a good phone for me.",
  ];

  for (const message of messages) {
    const plan = createAgentPlan({
      requestId: "test-commerce-recommendations",
      message,
      role: "customer",
    });

    assert(
      plan.tasks.some((task) => task.agent === "commerce"),
      "Commerce doit reconnaître la recommandation : " + message,
    );
  }
});
