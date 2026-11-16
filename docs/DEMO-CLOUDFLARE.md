# Bac à sable public sur Cloudflare

Déploiement autonome de Zenlo, réservé à la démonstration (données fictives uniquement).

## Mode démonstration

`ZENLO_DEMO_MODE=1` remplace la passerelle d'identité Sites (`worker/demo-identity.ts`) :

- tout en-tête `oai-*` envoyé par le navigateur est ignoré ;
- chaque navigateur reçoit un cookie visiteur aléatoire (HttpOnly) et devient un utilisateur distinct ;
- un visiteur ne voit jamais les agences d'un autre visiteur.

Ne jamais activer ce mode sur un déploiement contenant des données réelles.

## Workers Builds (dépôt GitHub)

Variables de build :

| Variable | Exemple |
| --- | --- |
| `ZENLO_WORKER_NAME` | `zenlo-demo` |
| `ZENLO_D1_NAME` | `zenlo-demo` |
| `ZENLO_D1_ID` | identifiant de la base D1 |
| `ZENLO_R2_BUCKET` | `zenlo-demo` |
| `ZENLO_DEMO_MODE` | `1` |
| `NODE_VERSION` | `22` |

- Commande de build : `npm run build`
- Commande de déploiement : `npx wrangler d1 migrations apply DB --remote --config dist/server/wrangler.json && npx wrangler deploy`

Les migrations `drizzle/` sont appliquées dans l'ordre et une seule fois (suivi Wrangler).
