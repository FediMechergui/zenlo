# Zenlo — exigences tunisiennes et positionnement produit

Date de recherche : **4 novembre 2026**, selon la date de travail du projet. Ce document distingue les textes effectivement consultés, les choix de conception et les validations propres à chaque agence. Il ne constitue ni une certification du logiciel ni une validation fiscale d'une entreprise.

## Décisions immédiates pour le produit

1. Gérer les montants en **millimes entiers**, avec affichage TND à trois décimales. Les taux et règles d'arrondi sont versionnés ; le devis accepté et la facture conservent leurs paramètres de calcul.
2. Ajouter un **prélèvement journalier de location automobile**, distinct de la TVA, du timbre, des frais commerciaux et de la caution. La note commune 07/2026 confirme un montant de 2 TND par jour et véhicule et son inclusion dans l'assiette de TVA. L'éligibilité dépend notamment de la date juridique du contrat ; un simple test sur la date de départ est insuffisant.
3. Afficher séparément **état commercial**, **règlement** et **état de transmission électronique**. Une facture PDF générée par Zenlo ne prouve aucune acceptation par TTN.
4. Exiger un registre de validation par agence : règle, source, date d'effet, validateur, justification, version et scénario de test. Une valeur de démonstration n'est pas un paramétrage approuvé.
5. Conserver les documents véhicule avec dates de validité et résultat de contrôle. Le départ vérifie leur couverture sur le séjour selon la politique validée, ainsi que l'état technique réel.
6. Préserver les données par société, limiter les copies d'identité et éviter les listes noires partagées entre sociétés. La recherche de doublons ne doit pas devenir une recherche dans les clients des autres agences indépendantes.
7. Prévoir une mise en production avec données fictives tant que les responsabilités, l'hébergement, les formalités données personnelles et le paramétrage fiscal de l'agence ne sont pas validés.

## 1. Prélèvement de 2 TND : lacune concrète du cahier initial

La loi de finances 2026 prévoit à l'article 20(7) un prélèvement de deux dinars sur le prix journalier de location de chaque voiture, versé mensuellement par les entreprises de location. L'article 53 étend par ailleurs le texte relatif à la facturation électronique aux prestations de services. Source officielle effectivement téléchargée : [loi n° 2025-17, PDF du ministère des Finances](https://www.finances.gov.tn/sites/default/files/2026-01/115725.pdf), pages PDF 4 et 13.

La [note commune DGELF n° 07/2026](https://jibaya.tn/docs/note-commune-n07-2026/) précise : agences relevant du cahier des charges du 16 janvier 2020 ; prélèvement par jour de location et véhicule ; inclusion dans la base de TVA ; versement suivant les échéances TVA ; application aux contrats conclus à partir du 1er janvier 2026, avec exclusion des contrats ayant acquis date certaine avant cette date. Le texte arabe original, trois pages, a été téléchargé et sa page 3 contrôlée visuellement. [PDF officiel](https://jibaya.tn/wp-content/uploads/2026/03/%D9%85%D8%B0%D9%83%D8%B1%D8%A9-%D8%B9%D8%A7%D9%85%D8%A9-%D8%B9%D8%AF%D8%AF-07.pdf).

**Conséquences de conception proposées :** conserver `levyPerDayMillimes`, `levyDays`, `levyAmountMillimes`, `levyVatTaxable`, la version de règle, la date de conclusion du contrat et les justificatifs d'une exception. Produire un état mensuel détaillé relié aux locations et aux corrections. Définir avec le comptable le comptage des journées partielles, la ventilation entre mois, les avenants et remplacements, les annulations et les avoirs. Ne pas réutiliser le même champ pour la contribution sociale sur les résultats de l'entreprise et ce prélèvement de location.

## 2. Facturation et El Fatoora

La [note commune DGELF n° 02/2026](https://jibaya.tn/docs/note-commune-n02-2026/), huit pages consultées dans leur version arabe originale, rappelle les mentions de facture, la signature électronique et la référence délivrée par l'organisme de traitement. Elle décrit une application progressive : les prestataires ayant finalisé leur adhésion suivent le dispositif ; ceux ayant déposé une demande sans achever les formalités continuent les factures papier selon les règles applicables. [PDF officiel](https://jibaya.tn/wp-content/uploads/2026/01/%D9%85%D8%B0%D9%83%D8%B1%D8%A9-%D8%B9%D8%A7%D9%85%D8%A9-%D8%B9%D8%AF%D8%AF-2-%D9%84%D8%B3%D9%86%D8%A9-2026.pdf), notamment pages 4, 7 et 8.

**Point de vigilance sur l'actualité :** le [communiqué officiel de l'ARP du 2 avril 2026](https://www.arp.tn/blog/1/post/2026-9508) décrit un amendement adopté **en commission** visant à différer l'application de l'article 53. Ce communiqué ne démontre pas, à lui seul, une promulgation ou une date de report légalement entrée en vigueur. Cette recherche n'établit pas une abrogation générale ni une exemption pour toute agence de location. Faire confirmer la situation effective de l'agence à la date de mise en production.

**Modèle recommandé :**

- Facture : brouillon, émise, corrigée par avoir ; séquence unique par société et série.
- Paiement : non réglée, partiellement réglée, réglée ; avances non affectées visibles.
- Intégration : non configurée, à préparer, prête, envoyée, résultat inconnu, acceptée, rejetée.
- Dossier TTN : adhésion, environnement, version du schéma, certificat, signataire habilité, réception, identifiant externe, empreinte et historique des tentatives.

Les paramètres et documents d'interface doivent provenir de l'opérateur pour l'agence concernée. Le [point d'entrée TTN](https://www.tradenet.com.tn/elfatoora.html) n'a pas pu être consulté intégralement pendant cette recherche ; **aucune version XSD, URL API ou homologation n'est déclarée validée**. Un connecteur indisponible doit rester explicitement non configuré. Après un timeout, rechercher le résultat avant toute réémission.

## 3. Exploitation de location et documents

Le ministère référence le cahier des charges approuvé le 16 janvier 2020 pour la location de voitures particulières, mixtes et camionnettes. Son [PDF officiel identifié](https://www.transport.tn/uploads/CahierCharges/81.pdf) est indexé ; son téléchargement direct a échoué pour problème de certificat. Le [portail réglementaire du ministère](https://www.transport.tn/fr/terrestre/reglement) référence aussi les documents d'exploitation et les cartes d'exploitation. Le contenu intégral et ses éventuelles modifications doivent donc être obtenus et validés avant de figer les contrôles juridiques.

**À modéliser dès maintenant :** immatriculation, VIN, première mise en circulation, puissance/catégorie, entrée et sortie du parc, propriété ou mise à disposition, agence de rattachement, documents avec émetteur et dates, inspection et état technique. Prévoir une règle d'âge maximal paramétrable sans inventer un seuil universel. Conserver les véhicules sortis pour l'historique des contrats.

Le contrôle de départ doit distinguer « document absent », « document expiré », « non requis pour ce cas » et « contrôle en attente ». Un responsable ne doit pas pouvoir contourner silencieusement un blocage. Les paramètres contractuels d'âge du conducteur, d'ancienneté du permis, de franchise et de caution sont liés aux conditions effectivement acceptées et à l'assurance applicable.

## 4. Données personnelles et hébergement

Les documents officiels de l'INPDP identifient la déclaration préalable du traitement (article 7 de la loi organique 2004-63) et l'autorisation de transfert à l'étranger (articles 50 à 52). Voir le [manuel de procédures INPDP](https://www.inpdp.tn/Manuel_procedures_INPDP.pdf) et la [présentation INPDP sur les transferts](https://www.inpdp.tn/bos.pdf). Ces extraits officiels étaient accessibles via l'index de recherche ; leur téléchargement intégral a échoué. Le [recueil INPDP](https://inpdp.tn/Receuil_INPDP.pdf) reproduit aussi l'article 45 relatif à la fin de conservation.

**Conséquences de conception proposées :** inventaire des catégories de données, finalités, destinataires, pays d'hébergement et sous-traitants ; durées configurées et documentées ; droits d'accès et journalisation des consultations sensibles ; procédure d'accès, rectification, clôture et conservation justifiée. Ne pas appliquer une durée indéfinie aux pièces d'identité. Sauvegardes, assistance étrangère, logs et services de messagerie font partie du périmètre à examiner. Un hébergement privé ne vaut pas autorisation de transfert.

## 5. Comparaison de trois offres existantes

Constats issus de leurs propres pages publiques consultées. Une fonctionnalité annoncée n'est pas un test de qualité ; l'absence d'une mention ne prouve pas l'absence de la fonctionnalité.

| Offre | Capacités annoncées et source | Conséquence pour Zenlo |
|---|---|---|
| Fleevera, marché tunisien | Contrats issus des réservations, photos d'inspection, avenants, calcul des suppléments, factures, exports et suivi de flotte. [Page fonctionnalités](https://fleevera.com/fonctionnalites). | Les contrats PDF, inspections mobiles et marges véhicule sont déjà des attentes du marché. La qualité du parcours et sa fiabilité doivent être démontrées. |
| HQ Rental Software | Sa documentation répertorie calendrier, flotte, tarifs, paiements, cautions, factures, ventilation de facturation, e-invoice, amendes, libre-service, application mobile et exports récurrents. [Base de connaissances officielle](https://hqrs.notion.site/Knowledge-Base-b3dc775703154b14b2ba62fad43c7032). | Construire un dossier location cohérent et des opérations financières explicites. La mention « e-invoice » ne prouve pas une intégration tunisienne. |
| Rent Centric | Facturation, paiements et remboursements, rapprochement, rapports par véhicule/agence, multi-société et interfaces comptables sont annoncés. [Page financière officielle](https://www8.rentcentric.com/technology-add-ons/accounting-financial/). | Les rapports financiers et intégrations ne suffisent pas à différencier Zenlo ; fournir des totaux rapprochables et des exports stables. |

**Hypothèses de différenciation à tester auprès d'agences pilotes :**

- Comprendre immédiatement *pourquoi* un départ ou une réservation est bloqué et quelles alternatives sont réellement disponibles.
- Retrouver chaque millime de caution : encaissé, utilisé avec pièce, à restituer, remboursé, litigieux ; aucune confusion avec le revenu.
- Conserver les preuves au fil d'une prolongation, d'un remplacement ou d'une contestation, sans écraser le dossier signé.
- Afficher la provenance et l'approbation des paramètres tunisiens ; éviter une étiquette générale « conforme » sans justification.
- Réduire la ressaisie entre comptoir et terrain, y compris reprise de brouillons après interruption réseau, sans confirmer hors ligne une disponibilité ou un paiement.
- Donner à l'agence ses données et documents par export structuré, avec contrôle des totaux.

Ces points sont des objectifs produit, **pas des lacunes universelles démontrées chez les concurrents**. Les vérifier par entretiens, démonstrations concurrentes et mesures avant/après en pilote.

## 6. Registre de validation avant données réelles

| Élément / pièce à réunir | Responsable de validation | Résultat attendu |
|---|---|---|
| Identité juridique, matricule fiscal, RNE, agences et régime fiscal | Dirigeant + comptable | Société et branches exactes ; pièces justificatives ; périmètre d'activité confirmé. |
| Cahier des charges applicable, déclaration d'exploitation et éventuelles mises à jour | Dirigeant + conseil compétent / administration concernée | Texte applicable obtenu ; obligations converties en contrôles paramétrés et testés. |
| Liste des documents véhicule requis : carte grise, assurance, carte d'exploitation, contrôle technique et autres pièces selon le cas | Responsable parc + conseil compétent / assureur | Obligatoire ou non, date de validité et règle de blocage définis pour chaque type. Cette liste de travail ne présume pas leur applicabilité universelle. |
| Contrat FR/AR et annexes : conducteur, franchise, caution, retard, carburant, km, dommage, contestation | Conseil juridique + assureur + dirigeant | Versions approuvées, modalités d'acceptation et remise au client. |
| TVA, prélèvement journalier, timbre, retenues, acomptes et avoirs | Expert-comptable / responsable fiscal | Taux, assiettes, dates et exceptions approuvés ; calculs de recette signés. |
| Situation El Fatoora, preuve d'adhésion, certificat, signataire, schémas et accès officiels | Comptable + intégrateur TTN | Applicabilité et circuit autorisé confirmés ; tests acceptation/rejet/timeout ; preuve d'enregistrement conservée. |
| Déclaration des traitements, autorisations nécessaires, pays et sous-traitants | Responsable de traitement + conseil données personnelles | Formalités et contrats adaptés au déploiement réel, y compris sauvegardes et assistance. |
| Droits des utilisateurs et séparation des fonctions | Dirigeant + responsable sécurité | Matrice d'autorisations ; accès inter-sociétés refusé ; corrections sensibles auditées. |
| Soldes de départ : caisse, impayés, avances, cautions et contrats ouverts | Comptable + responsable agence | Rapprochement signé avant basculement ; aucune fausse recette créée par l'import. |
| Sauvegarde/restauration base et pièces, continuité et support | Responsable technique + dirigeant | Restauration réellement exécutée ; RPO/RTO mesurés ; procédures d'incident et de reprise. |

## 7. Recette minimale à rendre mesurable

- Deux confirmations concurrentes sur le dernier véhicule : une seule occupation confirmée.
- Double clic ou notification financière répétée : aucun doublon de paiement ou remboursement.
- Retour en retard affectant une réservation suivante : alerte et résolution explicite, sans déplacement silencieux.
- Remplacement de véhicule : un contrat, deux segments, inspections et kilométrages correctement attribués.
- Caution 1 000,000 TND, utilisation justifiée 150,000 et restitution 850,000 : solde zéro, revenu distinct.
- Facture avec prélèvement journalier : base de TVA reproductible depuis la règle fiscale figée ; exception historique documentée.
- Facture émise : correction par pièce liée, sans modification silencieuse de l'original.
- Lien direct API, export ou fichier d'une autre société : accès refusé.
- Panne pendant transmission externe : état inconnu puis rapprochement, sans fausse acceptation.
- Restauration : montants, affectations, pièces et historique cohérents.

## Traçabilité de la recherche

Les PDF officiels DGELF 02/2026 et 07/2026 et la loi de finances hébergée par le ministère sont conservés dans `research/sources/`, avec images des pages utiles, texte extrait et empreintes SHA-256. Aucun taux de TVA général, timbre universel, durée de conservation ou connecteur bancaire n'est déclaré validé par cette recherche. Les limites de consultation des sites Transport, INPDP et TTN sont indiquées ci-dessus pour permettre une reprise ciblée.
