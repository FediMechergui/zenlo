# Zenlo · Gestion de location automobile

Application française pour un pilote d'agence tunisienne de 10 à 50 véhicules : parcours de location persistant, cautions séparées des revenus, documents versionnés et protections transactionnelles testées.

**Statut : pilote fonctionnel à recetter avec l'agence.** La [revue de préparation](docs/REVIEW.md) détaille les preuves, limites et extensions restantes. Ce projet ne constitue pas une certification fiscale ni une intégration TTN opérationnelle.

## Commencer

Se connecter au site privé puis choisir explicitement une démonstration ou une agence vide. La démonstration comprend 16 véhicules, 10 clients, des locations, échéances, interventions et mouvements fictifs. Les documents portent une mention de démonstration.

Le choix s'applique à cet espace. Une démonstration ne se transforme pas automatiquement en agence réelle et ses données ne sont pas effacées silencieusement. Préparer un déploiement de production distinct pour le lancement.

Parcours : tableau de bord → planning → réservation → caution → départ avec inspection → retour → facture → règlement et restitution. Les prolongations, remplacements et avoirs conservent l'historique.

## Fonctions livrées

| Domaine | Fonctionnement |
| --- | --- |
| Tableau de bord | Départs, retours, retards, documents, soldes et cautions issus des données persistantes. |
| Planning | Calendrier hebdomadaire, locations et immobilisations ; contrôle des chevauchements en base. |
| Locations | Brouillon, confirmation, annulation, départ, prolongation, remplacement avec deux inspections et retour. |
| Parc et clients | Création, modification, dates documentaires, compteur, permis, adresse, recherche et historique. |
| Inspections | Kilométrage, carburant, dommages et accord consigné par l'agent ; photos privées JPEG/PNG et empreintes. |
| Documents | Contrats versionnés et imprimables, factures et relevés de caution. |
| Finance | Paiements enregistrés, dépôts et restitutions, remboursements, factures, avoirs intégraux, caisse et écarts. |
| Maintenance | Blocage du planning, coûts et prestataires ; remise en service explicite. |
| Rapports | Indicateurs, exports CSV et rapprochement du prélèvement journalier par mois de facturation. |
| Migration | Modèles CSV véhicules/clients, prévisualisation, erreurs par ligne, doublons et reprise idempotente. |
| Accès | Authentification Sites, isolation des agences, rôles serveur, audit et fichiers privés. |

Les paiements bancaires/carte sont enregistrés après confirmation externe ; Zenlo ne débite pas une carte et ne transmet pas de virement. Les dépenses saisies sont des charges, pas des sorties automatiques de caisse.

## Paramètres tunisiens

Montants TND en millimes entiers, trois décimales, UTC en stockage et Africa/Tunis à l'affichage. La durée commerciale du pilote est la tranche de 24 heures commencée ; elle reste à faire accepter contractuellement et qualifier fiscalement.

Le prélèvement automobile de référence est configurable à 2 000 millimes par jour, séparé des frais et cautions, avec inclusion configurable dans la base TVA. TVA et timbre sont initialement à qualifier. Chaque dossier conserve ses paramètres.

Le circuit de facturation doit être qualifié : papier documenté ou électronique requis. L'émission réelle reste bloquée si la décision manque ou si un connecteur requis est absent. La conservation est initialement non qualifiée ; aucune purge automatique n'est revendiquée.

La [recherche tunisienne et concurrentielle](docs/research/tunisia-and-market.md) contient les sources, dates, limites de consultation et documents officiels avec empreintes. Elle distingue les fonctionnalités annoncées par les concurrents des hypothèses de différenciation.

## Architecture

React 19, TypeScript et Vinext ; API modulaire, Cloudflare D1 et R2. `.openai/hosting.json` déclare les ressources. Les données métier ne dépendent pas du stockage local du navigateur.

Les écritures sensibles combinent transactions D1, contraintes SQL, contrôle de version, registre d'idempotence et audit atomique. Le serveur résout le périmètre depuis l'identité et l'appartenance. Voir [les invariants](server/README.md), [le contrat API](IMPLEMENTATION-CONTRACT.md) et [la revue](docs/REVIEW.md).

L'authentification suppose la passerelle Sites qui vérifie l'identité ; ne pas exposer directement le Worker en faisant confiance à des en-têtes client. Ajouter un membre dans Zenlo ne modifie pas le partage du site et n'envoie aucun message.

## Développement

Environnement vérifié : Node 24, npm, Windows PowerShell et profil Sites portable.

```powershell
npm ci
npm run typecheck
npm test
npm run build
```

Appliquer les migrations locales une seule fois, dans l'ordre, avant le premier lancement :

```powershell
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_mighty_stellaris.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0001_loose_blockbuster.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0002_maintenance_overrun.sql
npm run dev -- --hostname 127.0.0.1
```

L'authentification de développement est limitée au loopback : `/signin-with-chatgpt?return_to=/`. Elle n'est pas incluse dans le build de production. Les bases locale et hébergée sont distinctes.

Serveur local actif et Chromium Playwright disponible :

```powershell
npm run test:http
npm run test:browser
```

Les tests HTTP créent exclusivement des données fictives locales et refusent une URL distante. Captures et résultats : `outputs/`, ignoré par Git. La suite métier utilise les vraies migrations et services avec un adaptateur SQLite transactionnel ; elle ne mesure pas la charge ou la disponibilité distante.

Les migrations appliquées sont immuables. Ajouter une migration pour chaque évolution ; ne pas rejouer les scripts de référence du dossier `db/`.

## Mise en service

Réunir les validations de [REVIEW.md](docs/REVIEW.md) puis suivre [OPERATIONS.md](docs/OPERATIONS.md). Les tests ne remplacent pas l'approbation de l'agence, de son comptable ou de ses conseils.

Le périmètre complet du PDF reste une feuille de route : multisuccursales, réservation par catégorie, conducteurs multiples, comptabilité générale, achats et sinistres avancés, tarification saisonnière, arabe/RTL, chèques compensés, préautorisations et connecteurs externes. Ils ne sont pas présentés comme livrés par ce pilote.
