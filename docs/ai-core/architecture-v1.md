# ZANDO AI CORE — Architecture V1

## 1. Vision
ZANDO AI CORE est le moteur central d'intelligence artificielle
de Zando Panafricain.

Il coordonne huit agents spécialisés autour d'un orchestrateur,
d'un contexte commun et d'une infrastructure de mémoire.

La V1 fournit un moteur de raisonnement multi-agents.
L'accès autonome aux outils métier et aux services externes
sera ajouté progressivement.

## 2. Niveau d'autonomie
Niveau choisi : ADVANCED.

Le niveau ADVANCED définit l'ambition fonctionnelle du projet,
et non l'activation immédiate de toutes les capacités.

Dans la V1, les agents peuvent analyser, planifier,
collaborer en parallèle et formuler des recommandations
à partir du message utilisateur et des mémoires accessibles.

La recherche Web, les outils métier et les actions autonomes
ne sont pas encore intégrés.

Toute opération sensible nécessitera une autorisation
explicite et une validation humaine.

## 3. Langues
Langues prises en charge :
- Français
- Lingala
- Swahili
- Anglais

L'agent Language est chargé de la traduction
et de l'adaptation linguistique des réponses.
La détection automatique de la langue reste
à confirmer ou à compléter.

## 4. Orchestrateur
Nom : ZANDO AI CORE.

Responsabilités actuelles :
- recevoir une demande authentifiée ;
- identifier le rôle vérifié de l'utilisateur ;
- comprendre et planifier la demande ;
- sélectionner les agents autorisés ;
- organiser leur exécution parallèle ;
- charger les mémoires accessibles ;
- collecter et synthétiser les résultats ;
- enregistrer les conversations, exécutions et traces.

Les appels aux outils métier et aux services externes
seront intégrés dans des phases ultérieures.

## 5. Registre des agents
- commerce : assistance commerciale ;
- seller : accompagnement des vendeurs ;
- security : contrôles de sécurité ;
- logistics : livraison et suivi ;
- support : assistance utilisateurs ;
- business : analyse commerciale ;
- language : traduction et adaptation linguistique ;
- admin : supervision du marketplace.

## 6. Rôles et permissions
customer :
- commerce
- support
- language

seller :
- commerce
- seller
- support
- language

admin :
- tous les agents, dans les limites de ses permissions.

Les rôles doivent être vérifiés depuis une source fiable
côté serveur. Les métadonnées modifiables par l'utilisateur
ne constituent pas une preuve de permission.

## 7. Collaboration multi-agents
L'orchestrateur centralise la coordination des agents.

Dans cette V1 :
- il sélectionne les agents autorisés ;
- il prépare leurs tâches ;
- il contrôle leur exécution ;
- il exécute les tâches sélectionnées en parallèle ;
- il collecte les résultats ;
- il réalise une synthèse finale ;
- il conserve les traces des analyses produites.

Les agents ne communiquent pas directement entre eux.
Ils ne disposent pas encore d'outils externes autonomes.

La transmission directe de tâches, les échanges inter-agents
et les dépendances dynamiques restent des évolutions futures.

## 8. Mémoire partagée
La V1 comprend une infrastructure de mémoire persistante
reposant sur Supabase et PostgreSQL.

Elle comprend cinq catégories de données :
- conversations ;
- messages ;
- exécutions ;
- messages et traces des agents ;
- mémoires persistantes.

Les conversations, messages, exécutions et traces des agents
peuvent être enregistrés par le backend.

Le système sait charger trois catégories de mémoire :
- shared : mémoire partagée ;
- user : mémoire associée à l'utilisateur ;
- agent : mémoire propre à un agent.

Les mémoires existantes peuvent être consultées par les agents
autorisés. En revanche, la création automatique de nouvelles
mémoires et la promotion de connaissances vers la mémoire
partagée ne sont pas encore implémentées.

Les règles détaillées de conservation, de suppression et de
validation des connaissances restent à compléter.

## 9. Sécurité
- authentification Supabase ;
- vérification serveur des rôles ;
- permissions minimales ;
- limitation du débit ;
- validation des entrées ;
- protection des secrets côté serveur ;
- journalisation des actions ;
- refus des opérations non autorisées.

## 10. Actions sensibles
Les agents ne doivent pas modifier sans autorisation :
- commandes ;
- paiements ;
- stocks ;
- comptes ;
- adresses ;
- livraisons ;
- données des vendeurs.

La première version reste en lecture, analyse et conseil.

## 11. Fournisseur IA
Architecture compatible avec OpenRouter.
Les clés et paramètres privés restent côté serveur.
Les modèles doivent être configurables par agent.

## 12. Assistants existants
Zando Assistant, Seller Coach et Admin Coach sont conservés.
Leur intégration sera progressive après vérification
de leurs interfaces et de leurs fonctions backend.

## 13. Déploiement progressif
Phase 1 : orchestrateur et authentification.
Phase 2 : registre des agents et routage par rôle.
Phase 3 : exécution parallèle multi-agents et synthèse.
Phase 4 : infrastructure mémoire, chargement et contrôle des accès.
Phase 5 : enrichissement contrôlé de la mémoire.
Phase 6 : collaboration inter-agents avancée.
Phase 7 : tests, audit de sécurité et déploiement contrôlé.
Phase 8 : intégration progressive des assistants existants.
