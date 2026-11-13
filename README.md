# Assistant IA Zando — première version

Cette version ajoute une page d’assistance accessible à `/assistant.html` et une Supabase Edge Function qui appelle un fournisseur compatible avec l’API OpenAI Chat Completions. Le navigateur ne reçoit jamais la clé du fournisseur.

## Fonctionnement

- Connexion obligatoire avec un compte Zando existant (Supabase Auth).
- Réponses en français ou dans la langue du message.
- Suggestions fondées sur un maximum de 12 produits actifs visibles publiquement.
- L’historique de conversation reste en mémoire dans la page et n’est pas enregistré dans la base.
- L’assistant ne peut pas modifier de compte, consulter les commandes, effectuer de paiements ou garantir des informations de livraison.

## Configuration et déploiement

1. Installe la Supabase CLI, connecte-toi puis lie le dépôt au projet :
   ```bash
   supabase login
   supabase link --project-ref kcrliiinrjlrcspnaeac
   ```
2. Configure les secrets **dans Supabase**, jamais dans les fichiers `public/` :
   ```bash
   supabase secrets set AI_API_KEY=... AI_MODEL=...
   ```
   `AI_MODEL` doit être un modèle activé pour ton compte. Facultatif : `AI_API_URL` pour un fournisseur compatible OpenAI (par défaut `https://api.openai.com/v1`) et `APP_ORIGIN` pour limiter les origines web autorisées, par exemple `https://ton-domaine.example`.
3. Déploie la fonction :
   ```bash
   supabase functions deploy zando-assistant
   ```
   La vérification JWT est activée dans `supabase/config.toml`. L’URL du projet, la clé publique Supabase et l’URL de la fonction sont utilisées côté client ; aucune clé fournisseur ne l’est.
4. Déploie le site statique incluant `public/assistant.html` et `public/js/assistant.js`, puis ouvre `/assistant.html`. Le compte utilisateur doit déjà exister et être activé dans Zando.

## Limites avant une ouverture publique

La fonction est réservée aux utilisateurs authentifiés et impose une limite indicative de 8 messages par minute et par utilisateur dans une instance Edge. Cette limite en mémoire n’est pas un système distribué fiable ; avant d’ouvrir largement l’assistant, ajoute un rate limit durable (par exemple via une fonction SQL transactionnelle ou un service dédié), configure les plafonds de dépense du fournisseur et valide la politique de confidentialité et de conservation des données. Les messages sont transmis au fournisseur IA configuré pour générer les réponses.

## Vérification

Après déploiement, teste la connexion, une demande de produit présent dans le catalogue, une demande sur une politique absente (l’assistant doit reconnaître qu’il ne sait pas), une session expirée et plusieurs requêtes rapprochées. Le dépôt ne contient pas encore de suite de tests automatisée valide.
