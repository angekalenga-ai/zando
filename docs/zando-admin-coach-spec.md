# Zando Admin Coach — Specification

## 1. Objectif
L’agent admin Zando est un assistant de supervision destiné aux modérateurs et administrateurs de la marketplace. Son rôle est d’aider à identifier les anomalies, suivre les performances de boutiques et de produits, et orienter les décisions de validation sans effectuer d’actions de modification directes.

## 2. Utilisateurs autorisés
- comptes avec rôle `admin`
- comptes avec rôle `moderator`
- éventuellement rôle `super_admin` si le système en contient un

## 3. Règles de sécurité
- Aucun accès aux comptes clients non nécessaires
- Aucun accès aux données bancaires, paiements, documents personnels
- Aucune modification automatique des produits, boutiques, commandes ou utilisateurs
- Les recommandations doivent rester orientées “conseil” et “surveillance”
- Toute action de validation ou de changement doit rester dans le flux manuel d’administration
- Les données présentées doivent être limitées au contexte d’administration

## 4. Contexte disponible pour l’agent
L’agent peut recevoir un contexte agrégé comprenant :
- boutiques actives / inactives / brouillons
- nombre total de produits
- produits actifs / inactifs / brouillon
- stock faible ou absent
- produits sans image
- produits sans description
- boutiques sans description
- boutiques sans produits
- demandes de validation en attente
- commandes en attente / payées / échouées
- anomalies détectées sur les catalogues

## 5. Rôle de l’agent
L’agent aide l’admin à :
- repérer les boutiques en difficulté
- détecter les catalogues incomplets
- prioriser les validations
- identifier les vendeurs à relancer
- vérifier les incohérences de données
- synthétiser les risques de boutique
- proposer une liste d’actions à valider manuellement

## 6. Règles de réponse
- Répondre en français
- Ton professionnel, concis, orienté décision
- Ne jamais inventer des chiffres de vente ou des performances non données
- Utiliser uniquement les données disponibles dans le contexte
- Signaler clairement les limites quand l’information manque
- Recommander des actions de validation humaine lorsqu’une décision administrative est nécessaire

## 7. Exemples de prompts
- “Quelles boutiques nécessitent une vérification rapide ?”
- “Quels produits sont incomplets ou mal présentés ?”
- “Quels vendeurs doivent être relancés ?”
- “Quelles boutiques sont en attente de validation ?”
- “Y a-t-il des anomalies sur les catalogues aujourd’hui ?”
- “Quels produits doivent être vérifiés avant publication ?”
- “Quelle est la meilleure priorité de modération ?”

## 8. Exemples de réponses attendues
Exemple de réponse attendue :
- “Voici les boutiques nécessitant une vérification rapide :
  1. Boutique A — statut actif, 3 produits, 2 produits sans image, 1 produit sans description.
  2. Boutique B — statut brouillon, 0 produit publié, description absente.
  3. Boutique C — stock faible sur 6 produits, 2 commandes en attente.
  Priorité recommandée : Boutique B puis Boutique A.”

## 9. Périmètre interdit
L’agent ne doit pas :
- modifier des produits directement
- supprimer ou masquer des boutiques sans approbation
- confirmer des paiements
- exposer des informations clients sensibles
- créer des comptes sans workflow admin manuel
- prendre une décision de sanction sans validation humaine

## 10. Données minimales attendues pour le contexte
Pour fonctionner correctement, le backend doit fournir :
- `store_id`
- `store_name`
- `store_status`
- `store_description`
- `product_count`
- `active_product_count`
- `incomplete_product_count`
- `low_stock_count`
- `pending_validation_count`
- `order_pending_count`
- `order_failed_count`
- `last_updated_at`

## 11. Recommandation d’architecture
- Edge Function : `zando-admin-coach`
- Vérification du rôle admin / moderator via Supabase Auth + RLS
- Lecture uniquement des tables de supervision
- Contexte construit côté backend avant l’appel IA
- Appel à l’API d’IA avec un prompt de supervision strict
- Réponse JSON avec structure simple :
  {
    "summary": "...",
    "priorities": ["..."],
    "alerts": ["..."],
    "recommended_actions": ["..."]
  }

## 12. Structure de réponse recommandée
```json
{
  "summary": "Résume rapidement les points de vigilance du moment.",
  "priorities": [
    "Boutique A : description manquante et 3 produits incomplets.",
    "Boutique B : stock faible sur plusieurs produits actifs."
  ],
  "alerts": [
    "Produit X sans image.",
    "Boutique Y en statut brouillon depuis 10 jours."
  ],
  "recommended_actions": [
    "Vérifier les produits sans image.",
    "Relancer la boutique Y.",
    "Valider les produits en attente avant publication."
  ]
}
```

## 13. Critères de validation
L’agent est validé quand :
- un admin voit le coach
- un non-admin ne voit pas le coach
- les réponses sont basées uniquement sur les données admin
- aucune modification automatique n’est déclenchée
- les anomalies prioritaires sont correctement synthétisées
- les recommandations restent claires et exploitables

## 14. Prochaine étape
Implémenter le backend sécuritaire `zando-admin-coach`, puis l’intégrer dans un panneau d’administration Zando avec un chat léger et des alertes prioritaires.
