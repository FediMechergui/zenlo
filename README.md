# Zenlo · Gestion de location automobile

Application française de gestion d'entreprises de location automobile en Tunisie : exploitation, documents personnalisés, contrôles du véhicule, achats, trésorerie et espace client. L'interface est calibrée pour des agences de 10 à 50 véhicules ; plusieurs entreprises peuvent être gérées avec des rôles distincts.

**Version étendue du 5 novembre 2026.** Les parcours livrés sont persistants et testés. Les [notes de livraison](docs/RELEASE-V2.md) et la [revue de préparation](docs/REVIEW.md) distinguent les fonctions exécutables des intégrations et validations encore nécessaires. Ce projet ne constitue pas une certification fiscale ni une intégration TTN opérationnelle.

Les flottes mixtes incluent désormais camions, motos, scooters, minibus, autocars et quads, avec silhouettes réglables, bibliothèque de modèles par entreprise et géométrie figée dans les constats. Voir la section dédiée des notes de livraison.

## Commencer

Se connecter au site privé puis choisir explicitement une démonstration ou une agence vide. La démonstration comprend 16 véhicules, 10 clients, des locations, échéances, interventions et mouvements fictifs. Les documents portent une mention de démonstration.

Le choix s'applique à l'entreprise créée. Le sélecteur d'entreprise permet d'en créer une autre, vide ou de démonstration. Une démonstration ne se transforme pas en entreprise réelle et ses données ne sont pas effacées silencieusement. Les identités, membres et opérations sont isolés par entreprise ; les sites de recette et de production doivent rester distincts.

Parcours : tableau de bord → planning → réservation → caution → départ avec inspection → retour → facture → règlement et restitution. Les prolongations, remplacements et avoirs conservent l'historique.

## Fonctions livrées

| Domaine | Fonctionnement |
| --- | --- |
| Tableau de bord | Départs, retours, retards, documents, soldes et cautions issus des données persistantes. |
| Planning | Calendrier hebdomadaire, locations et immobilisations ; contrôle des chevauchements en base. |
| Locations | Brouillon, confirmation, annulation, départ, prolongation, remplacement avec deux inspections et retour. |
| Parc et clients | Catalogue local de 85 marques et 860 modèles, enrichissement NHTSA, saisie libre, carrosserie, VIN, dates documentaires, compteur et dossier conducteur. |
| Inspections | Quatre vues annotables, 11 contrôles, dommages hérités ou résolus, compteur et carburant, photos privées ; chaque véhicule remplacé conserve son segment kilométrique. |
| Justificatifs | Copies recto/verso CIN et permis, stockage privé, vérification par responsable, invalidation lors d'un changement d'identité et archivage tracé. |
| Documents | Devis numérotés et décisions, contrats versionnés, BL de remise, états des lieux, factures, avoirs et cautions ; impression/PDF au profil de l'agence. |
| Profil agence | Logo, raison sociale, adresse, téléphone, fax, e-mail, site, MF, RNE, forme juridique, capital, banque/RIB, couleur et pied de page. |
| Finance | Paiements enregistrés, dépôts et restitutions, remboursements, factures, avoirs intégraux, caisse et écarts. |
| Achats | Fiches fournisseurs, charges, échéances, reçus privés, règlements partiels bancaires/carte et soldes protégés contre les trop-payés. |
| Maintenance | Blocage du planning ; clôture générant une seule dépense liée ; échéances assurance, visite, vignette, entretien, pneus et autres, récurrentes par date/km. |
| Rapports | Filtres par période, activité, finances, parc et charges imprimables/PDF ; exports CSV et rapprochement du prélèvement journalier. |
| Espace client | Dossiers explicitement autorisés par e-mail, durée d'accès, documents, constats et photos, kilomètres conclus et confirmation de lecture ; révocation immédiate aux requêtes suivantes. |
| Migration | Modèles CSV véhicules/clients, prévisualisation, erreurs par ligne, doublons et reprise idempotente. |
| Accès | Entreprises isolées, sélecteur d'entreprise, propriétaire, responsable, agent, comptable, mécanicien et lecteur ; contrôles serveur et audit. |

Les paiements bancaires/carte sont enregistrés après confirmation externe ; Zenlo ne débite pas une carte et ne transmet pas de virement. Les dépenses sont des charges avec règlements fournisseurs distincts. Ces règlements ne sont pas des sorties de la caisse espèces des locations. Les schémas de constat varient par carrosserie : ils ne constituent pas des plans techniques exacts de chaque constructeur.

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
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0003_known_phantom_reporter.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0004_brief_cobalt_man.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0005_chemical_nebula.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0006_cold_landau.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0007_premium_thunderball.sql
npm run dev -- --host 127.0.0.1
```

L'authentification de développement est limitée au loopback : `/signin-with-chatgpt?return_to=/`. Elle n'est pas incluse dans le build de production. Les bases locale et hébergée sont distinctes.

Serveur local actif et Chromium Playwright disponible :

```powershell
npm run test:http
node tests/http-v2.integration.mjs
npm run test:browser
node tests/vehicle-browser.integration.mjs
node tests/mixed-fleet.integration.mjs
```

Les tests HTTP créent exclusivement des données fictives locales et refusent une URL distante. Captures et résultats : `outputs/`, ignoré par Git. La suite métier utilise les vraies migrations et services avec un adaptateur SQLite transactionnel ; elle ne mesure pas la charge ou la disponibilité distante.

Les migrations appliquées sont immuables. Ajouter une migration pour chaque évolution ; ne pas rejouer les scripts de référence du dossier `db/`.

## Mise en service

Réunir les validations de [REVIEW.md](docs/REVIEW.md) puis suivre [OPERATIONS.md](docs/OPERATIONS.md). Les tests ne remplacent pas l'approbation de l'agence, de son comptable ou de ses conseils.

Le périmètre complet du PDF reste plus large : succursales avec transferts internes, réservation par capacité de catégorie, conducteurs multiples, comptabilité générale, achats avec commandes/réceptions et avoirs fournisseurs, sinistres avancés, tarification saisonnière, arabe/RTL, chèques compensés, préautorisations et connecteurs externes. Ces extensions ne sont pas présentées comme livrées.
