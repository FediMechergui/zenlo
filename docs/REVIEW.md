# Zenlo — revue indépendante du noyau métier

**Mise à jour du 5 novembre 2026 :** la livraison étendue ajoute multi-entreprise, fournisseur/charges/règlements, obligations récurrentes, devis/BL, pièces conducteur vérifiées, schémas d'inspection et portail client. Les [notes de livraison V2](RELEASE-V2.md) décrivent le périmètre actuel et les nouvelles suites de tests. La section de preuve ci-dessous conserve la revue initiale datée du 4 novembre ; son décompte de 49 tests est historique.

Date de revue : 4 novembre 2026. Résultat constaté : **49 tests réussis, 0 échec** sur les migrations livrées `0000`, `0001` et `0002` et sur les modules métier présents lors de cette revue.

Le livrable constitue un pilote exécutable avec un noyau transactionnel vérifié. Cette revue ne certifie ni la conformité juridique de l'agence ni l'aptitude de l'ensemble des parcours à une exploitation sans accompagnement. Les essais HTTP, navigateur, authentification réelle, stockage distant et déploiement sont distincts de cette suite.

## Reproduire la vérification

Depuis `zenlo-app`, avec les dépendances installées et Node disposant de `node:sqlite` :

```powershell
node --test tests/backend-invariants.test.mjs
```

La suite charge tous les fichiers SQL générés du dossier `drizzle` dans des bases SQLite temporaires avec clés étrangères actives. Elle transpile et importe les vrais modules `server/domain.ts`, `server/db.ts`, `server/validation.ts`, `server/rentals.ts`, `server/finances.ts` et `server/operations.ts`. Seule la liaison Cloudflare D1 est remplacée par un adaptateur SQLite dont `batch()` exécute une transaction atomique.

La concurrence sur le dernier véhicule est exercée par deux workers et deux connexions indépendantes. Les courses lecture/écriture des services sont reproduites par une mutation contrôlée entre leur prélecture et leur transaction. Cette méthode vérifie les décisions métier et les gardes SQL ; elle ne mesure pas le débit du service Cloudflare ni ses latences en production. Le test n'est pas une campagne de charge ou un audit d'intrusion.

## Ce qui est effectivement vérifié

| Domaine | Preuve apportée par la suite |
| --- | --- |
| Disponibilité | Refus des réservations concurrentes, prolongations conflictuelles et chevauchements avec maintenance ; intervalles adjacents permis ; véhicule sorti en retard et maintenance inachevée toujours bloquants. |
| Retour tardif | La préparation du véhicule peut constater le retard réel sans supprimer une réservation future existante ; elle empêche de nouveaux engagements sur ce créneau. La résolution opérationnelle du conflit reste à réaliser. |
| Isolation et concurrence | Références interagences interdites par clés composites ; contrôle de version périmée et révocation de rôle pendant une écriture ; annulation atomique des écritures, séquences et traces associées en cas d'échec. |
| Encaissements | Plafonds des règlements et remboursements, restitution et imputation du dépôt limitées au solde disponible, dépôt distinct du chiffre d'affaires, interdiction de transformer un chèque non compensé en argent encaissé. |
| Caisse | Session ouverte obligatoire pour un mouvement espèces, fermeture immuable, remboursement ne rendant pas la caisse négative, calcul de clôture incluant un encaissement concurrent. L'imputation d'un dépôt ne crée pas un second mouvement physique. |
| Facturation | Facture émise immuable, correction par avoir lié, solde recalculé après avoir intégral, numérotation annulée si la transaction échoue ; identité client corrigée avant émission figée dans le document émis. |
| Circuit d'émission | Émission réelle bloquée si le circuit fiscal reste non qualifié, si le circuit électronique est requis sans connecteur ou si le circuit papier manque de justification. Modifier cette décision invalide l'approbation fiscale précédente sans revalidation explicite. |
| Historique | Mouvements financiers, inspections, audit et versions documentaires non réinscriptibles ; compteur kilométrique non décroissant. |
| Fiscalité et dates | Calculs en millimes, contribution journalière configurée incluse dans l'assiette TVA, arrondis et limites numériques, dates calendaires réelles et échéances selon Africa/Tunis. Une ancienne proposition ne peut pas être confirmée avec des taux modifiés silencieusement. |
| Parcours métier | Réservation → dépôt → départ → remplacement avec deux inspections réelles → retour. Conservation des segments kilométriques et du carburant, facturation du kilométrage excédentaire, préparation de l'ancien véhicule et maintien du dépôt séparé. Les frais supplémentaires au retour s'ajoutent aux options initiales sans les effacer, y compris si la saisie est zéro. |
| Politique de conservation | La validation du traitement et de l'hébergement nécessite une durée positive et une justification documentée. Les valeurs de la fixture de test sont fictives et ne constituent pas une durée de conservation recommandée. |
| Réessais réseau | Registre d'idempotence : résultat mémorisé et refus du même identifiant avec un corps de requête différent. |

Les régressions ont notamment permis de corriger l'encaissement concurrent d'une annulation, le départ concurrent d'une restitution de dépôt, les inspections artificielles lors d'un remplacement, le solde après avoir intégral, l'identité périmée dans une facture, les dates impossibles et la disponibilité d'une maintenance dépassée.

## Périmètre restant à développer ou qualifier

Ces fonctions ne doivent pas être présentées comme livrées ou certifiées :

- Réservation garantie par capacité de catégorie avec affectation différée d'un véhicule, surclassement automatique et optimisation de flotte. Le noyau actuel engage un véhicule identifié.
- Organisation multisuccursales : stocks, caisses, droits, transferts, restitution dans une autre agence et consolidation. L'isolation entre espaces clients ne constitue pas un module multisuccursales.
- Distinction complète du payeur, de l'entreprise cliente, du signataire et de plusieurs conducteurs avec leurs habilitations et pièces propres.
- Connexion contractuelle et technique à TTN/El Fatoora : envoi, validation du schéma officiel, signature requise, référence d'acceptation, rejet, reprise, rapprochement et archivage réglementaire. Une facture imprimable et un export CSV ne prouvent pas son acceptation électronique.
- Cycle complet du chèque reçu, remis, compensé, rejeté et régularisé. Les chèques sont refusés comme encaissements définitifs dans le noyau actuel.
- Préautorisation bancaire du dépôt, capture, libération et rapprochement automatique avec un prestataire de paiement. Les mouvements actuels sont des écritures métier enregistrées par l'opérateur.
- Comptabilité générale, écritures en partie double, clôture fiscale, immobilisations, commandes/réceptions, avoirs fournisseurs, paie et rapprochement bancaire. Les fournisseurs, charges, dettes et règlements partiels banque/carte sont désormais livrés ; ils ne constituent pas un grand livre ni une intégration à la caisse espèces.
- Tarification saisonnière et commerciale avancée, taxes par ligne, commissions apporteurs, retenues à la source, devises multiples et migration exhaustive d'un historique comptable.
- Matrice exhaustive des documents d'exploitation automobile, franchises et exclusions d'assurance, conducteur supplémentaire, sinistre et recouvrement contentieux. Les champs d'assurance et de visite technique ne couvrent pas tous ces dossiers.
- Signature électronique qualifiée et preuve d'identité du signataire. Une acceptation saisie par l'agent et une version documentaire conservée ne suffisent pas à qualifier juridiquement la signature.
- Purge programmée, gel probatoire, exercice complet des droits des personnes et export de toutes les preuves de suppression. Le paramètre de conservation exprime une politique ; il ne prouve pas son exécution automatique.
- Exploitation hors ligne avec résolution des conflits, télémétrie/GPS et portail de réservation publique. L'espace locataire authentifié sur invitation de dossier est désormais livré ; l'autorisation du site privé reste nécessaire.

## Conditions d'ouverture à des opérations réelles

| Validation | Preuve attendue | Responsable |
| --- | --- | --- |
| Exploitation automobile | Cahier des charges applicable et version en vigueur ; situation de l'agence et dossiers véhicules, assurances, pièces et contrôles requis | Exploitant avec conseil juridique/autorité compétente |
| Fiscalité | Profil signé et daté précisant TVA, timbre, contribution journalière, assiette, règle des fractions de journée, cas d'exemption et traitement des avoirs ; rapprochement de factures exemples | Expert-comptable/fiscaliste tunisien |
| Contribution 2026 | Validation de l'application de l'article 20(7) et de la note commune 07/2026, y compris contrats antérieurs concernés ; rapprochement de l'export avec la déclaration retenue | Expert-comptable |
| Facturation électronique | Décision documentée sur le champ et le calendrier applicables à l'agence ; contrat et recette du connecteur si requis | Expert-comptable, TTN et intégrateur |
| Contrats et inspections | Conditions contractuelles approuvées, versions, états des lieux, franchises, remplacement, retard, carburant, kilométrage et modalités d'acceptation | Exploitant et conseil juridique |
| Données personnelles | Formalités INPDP applicables, information des locataires, finalités, pièces collectées, durées et accès ; qualification de l'hébergement et des transferts à l'étranger | Responsable du traitement et conseil compétent |
| Exploitation technique | Recette sur l'environnement déployé, vérification des permissions réelles, stockage privé, sauvegarde et restauration réellement exercées, supervision et procédure d'incident | Responsable technique |
| Reprise et rapprochement | Contrôle des soldes d'ouverture, dépôts détenus, véhicules effectivement disponibles, factures et avoirs en cours ; scénario complet exécuté avec les équipes | Responsable agence et comptable |

Les cases de validation de l'application constituent une trace déclarative de l'agence. Elles ne remplacent pas ces preuves externes. Le taux TVA et le timbre ne sont pas déclarés universels par la suite de tests.

L'export de contribution journalière fournit un détail par facture, avec statuts et références d'avoir. Son filtre mensuel porte sur la date d'émission de facture ; il doit être rapproché par le comptable selon la règle déclarative retenue. Il ne constitue pas une déclaration fiscale transmise.

La recherche réglementaire, les sources officielles conservées et les limites de lecture sont documentées dans [la note Tunisie et marché](research/tunisia-and-market.md). Les sources comparatives ne permettent pas d'affirmer qu'aucun concurrent ne couvre une fonctionnalité ; l'avantage recherché de Zenlo est une intégration vérifiable des besoins de l'agence tunisienne.
