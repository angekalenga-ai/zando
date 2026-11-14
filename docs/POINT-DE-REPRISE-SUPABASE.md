# Point de reprise — validation Supabase et coaches Zando

Dernière mise à jour : 2026-11-14

## Où reprendre

Reprendre directement par les tests fonctionnels après les restrictions appliquées sur `public.profiles`. Ne pas refaire l’audit déjà terminé et ne pas ajouter de nouvelles fonctionnalités avant ces tests.

## État confirmé

- Le schéma réel contient `profiles.role`, `stores.owner_id`, `products.store_id`, `products.status`, `products.price`, `products.currency`, `products.stock_quantity` et les colonnes attendues par le coach vendeur.
- `products.image_url` n’existe pas. Le coach admin a été ajusté pour ne plus la sélectionner et indique que l’évaluation de la présence d’images n’est pas possible avec ce schéma : commit `609bda6e598d9dcd31ef18d66fa2d772e9b7e440`.
- Le trigger `auth.users.on_auth_user_created` appelle `public.handle_new_user_profile()`, fonction `SECURITY DEFINER`, qui crée un profil avec le rôle `customer` et un panier.
- Les privilèges clients sur `public.profiles` ont été restreints dans Supabase SQL Editor : suppression de l’insertion/suppression directe, retrait des droits `TRUNCATE`/`TRIGGER`, retrait du droit de mise à jour de `role`, et suppression de la politique `profiles_insert_own`.
- Vérification post-correction : `authenticated` conserve `SELECT` sur la table et `SELECT`/`UPDATE` uniquement sur les champs de profil personnels autorisés (`full_name`, `phone`, `avatar_url`); il n’a plus de droit d’écriture sur `role`. Aucun privilège de table ou de colonne n’a été retourné pour `anon` ni `PUBLIC` dans les requêtes de vérification partagées.
- Les fonctions coach utilisent le JWT utilisateur et la clé anon pour les lectures, de sorte que les règles RLS s’appliquent; aucun accès `service_role` n’est utilisé dans leur code.
- Le coach vendeur exige le rôle `seller` et lit la boutique liée à `owner_id`, puis ses produits.
- Le coach admin exige le rôle `admin` et ne réalise que des lectures, bornées à un échantillon de boutiques et de produits.

## Tests restant à faire

Avec des comptes de test dédiés, sans partager les mots de passe ni jetons :

1. Inscrire un nouveau compte client depuis l’application et vérifier que le trigger crée son profil avec `role = 'customer'`.
2. Vérifier qu’un client peut modifier ses champs personnels autorisés, mais ne peut pas modifier son rôle ni créer/supprimer directement un profil.
3. Vérifier que le compte vendeur peut accéder à son dashboard et appeler `zando-seller-coach`, mais ne voit pas les données d’une autre boutique.
4. Vérifier que le compte admin peut appeler `zando-admin-coach` et que les comptes non-admin reçoivent un refus.
5. Vérifier les réponses et journaux des fonctions Edge; confirmer que les fonctions sont déployées avec les secrets nécessaires, sans révéler ces valeurs.

## Précautions

- Ne pas coller de mots de passe, access tokens, `service_role`, ni secrets IA dans le dépôt ou la conversation.
- Ne pas réintroduire `profiles_insert_own` ou l’écriture client sur `profiles.role` sans nouvelle analyse de sécurité.
- Ne pas considérer les coaches validés en production tant que les tests fonctionnels ci-dessus ne sont pas passés.
- Le rate limit actuellement en mémoire des Edge Functions est local à chaque instance et ne constitue pas un quota global.

## Dernier résultat utilisateur

Les vérifications après restriction ont retourné uniquement le privilège de table `SELECT` pour `authenticated` et les droits de colonnes personnels listés ci-dessus. L’utilisateur souhaite reprendre exactement à ce point, sans recommencer les étapes précédentes.
