# Instructions pour GitHub Copilot

## Projet
Zando est une marketplace panafricaine. L'interface actuelle est une application web HTML, CSS et JavaScript vanilla servie depuis `public/`. Le projet utilise CommonJS côté Node et Supabase est présent dans les dépendances.

## Principes de travail
- Répondre en français par défaut et conserver les textes de l'interface en français, sauf demande contraire.
- Avant une modification, examiner les fichiers et conventions déjà utilisés. Privilégier les changements petits, cohérents avec l'architecture existante.
- Préserver l'expérience mobile, l'accessibilité (libellés, clavier, focus, contrastes) et la compatibilité avec les marchés africains (devises, langues, réseaux et appareils variés).
- Ne pas inventer de comportements, prix, disponibilité, options de paiement ou règles de livraison. Signaler les hypothèses.
- Ne jamais exposer de secrets, clés API ou données personnelles dans le navigateur, le dépôt, les journaux ou les réponses. Les appels aux fournisseurs d'IA doivent passer par un serveur de confiance.
- Ne jamais effectuer d'achat, paiement, modification de commande ou autre action sensible sans consentement explicite et vérification côté serveur.
- Ne pas introduire de framework, service payant ou nouvelle dépendance importante sans expliquer pourquoi et obtenir l'accord du propriétaire.
- Ne pas remplacer des pages ou fonctions existantes sans vérifier leurs usages et leurs intégrations Supabase.

## Vérifications
- Exécuter les vérifications disponibles après les changements et expliquer celles qui n'ont pas pu être exécutées.
- Le script `npm test` est actuellement un placeholder qui échoue ; ne pas le présenter comme une suite de tests valide.
- Pour le JavaScript navigateur, respecter la configuration ESLint existante (`eslint.config.js`).

## Assistant IA intégré
L'application est actuellement servie comme site statique. Toute fonctionnalité d'IA intégrée doit utiliser une API serveur sécurisée ; ne pas placer de clé de fournisseur dans `public/` ni appeler un modèle directement depuis le navigateur avec un secret. Vérifier le fournisseur, l'hébergement, l'authentification, les limites d'usage et la politique de confidentialité avant d'implémenter les appels réels.
