# Zenlo — livraison étendue du 5 novembre 2026

Cette livraison remplace l'interface initiale par un espace d'exploitation sobre : navigation claire, tableaux homogènes, planning, dossier de location, centre documentaire et formulaires adaptés au mobile. Les actions décrites ci-dessous écrivent dans D1 et, pour les fichiers, dans R2 privé.

## Parcours disponibles

1. Configurer le profil de l'entreprise : logo, adresse, fax, matricule fiscal, RNE, contacts, forme juridique, capital, banque, RIB, couleur et pied de page. Les documents figés gardent leur ancien profil lors d'une modification ultérieure.
2. Ajouter un véhicule depuis une recherche marque/modèle, choisir sa carrosserie et renseigner son VIN, compteur, tarifs et validités. Le catalogue local contient 85 marques et 860 modèles ; NHTSA vPIC apporte un enrichissement optionnel. La saisie libre reste possible lorsque le catalogue est incomplet ou indisponible. Le catalogue n'est pas présenté comme exhaustif mondialement.
3. Constituer le dossier conducteur : copies JPEG/PNG de CIN/identité et permis, contrôle des originaux par un responsable, vérification enregistrée. Le recto des deux pièces est obligatoire au départ réel ; les versos peuvent aussi être exigés. La vérification est liée à l'identité consultée et refusée si celle-ci change entre lecture et écriture.
4. Préparer une réservation puis émettre un devis numéroté. Enregistrer acceptation, refus ou annulation. L'acceptation d'un devis ne réserve pas implicitement la capacité du parc ; la confirmation de location effectue ce contrôle.
5. Au départ et au retour, renseigner onze points de contrôle et placer des repères sur les quatre vues. Types : rayure, enfoncement, fissure, pièce manquante, anomalie mécanique et modification. Importance, note et évolution sont conservées. Un dommage existant doit rester présent ou être explicitement résolu. Les contrôles ne sont jamais recopiés comme accomplis.
6. Calculer les kilomètres par affectation de véhicule, y compris remplacement. Les photos, relevés, états de départ et de retour restent consultables. Un contrôle bloquant au retour immobilise le véhicule tout en permettant d'enregistrer sa restitution réelle.
7. Générer devis, BL, contrat, état des lieux, facture, avoir et relevé de caution, puis imprimer ou enregistrer en PDF. Les BL utilisent les versions de remise du contrat ; les factures émises et leurs montants restent immuables.
8. Gérer fournisseurs et dépenses, joindre un reçu, enregistrer des règlements partiels confirmés et suivre le solde. Les clôtures de maintenance et d'échéance créent exactement une charge liée, sans la compter une seconde fois dans les rapports.
9. Planifier assurances, visites techniques, vignettes, services, pneumatiques et autres obligations. Date ou kilométrage, rappel, périodicité, réalisation, coût réel et prochaine échéance sont persistants. Une assurance/visite renouvelée met aussi à jour sa validité dans le parc.
10. Générer les rapports d'activité, finances, parc et charges avec bornes de dates en heure de Tunis. Le facturé net utilise les factures à leur émission et les avoirs à leur création. Les encaissements, charges et règlements fournisseurs restent des indicateurs distincts.
11. Autoriser un client à consulter un dossier précis sur `/client`, avec expiration et révocation. Il retrouve documents, photos, contrôles et kilomètres, puis peut confirmer sa lecture. Cette confirmation n'est pas une signature électronique et ne vaut pas acceptation de dommages facturés.
12. Créer plusieurs entreprises et changer de rôle selon l'appartenance. Six rôles internes, révocation des membres, pièces privées, données masquées selon rôle et contrôle de périmètre côté serveur.

## Vérification

- `npm test` : 116 tests réussis, 0 échec ; migrations réelles dans SQLite, services et routes réels, contrôles de concurrence, droits, pièces, portail, rapports, montants et schémas.
- `npm run typecheck` : interfaces, routes et composants TypeScript.
- `node tests/http.integration.mjs` : parcours de location historique, 14 contrôles HTTP.
- `node tests/http-v2.integration.mjs` : 11 parcours d'extension, fichiers, multi-entreprise, fournisseurs, documents, vrai export PDF et accès client.
- `npm run test:browser` : 28 contrôles des onze rubriques desktop/mobile et formulaires.
- `npm run test:browser:workflows` : huit parcours avec écriture par l'interface, dont profil, fournisseur, charge/règlement, devis, récurrence et isolation d'entreprise.
- `node tests/vehicle-browser.integration.mjs` : six contrôles de recherche, clavier, repères, checklist, kilomètres et mobile.

Les tests HTTP utilisent uniquement la base locale fictive. Les images, le PDF d'exemple et les résultats détaillés restent dans `outputs/`. Les migrations 0003 à 0005 ajoutent les données et protections sans remplacer les historiques existants.

## Conditions et limites précises

L'accès à un site privé et l'appartenance Zenlo sont deux autorisations. Ajouter un collaborateur ou un client dans l'application ne l'invite pas automatiquement dans Sites ; un propriétaire doit aussi lui donner accès au site. Aucun e-mail ou SMS n'est envoyé par cette livraison. Un e-mail de compte authentifié autorisé est nécessaire au portail.

Les silhouettes sont des outils de repérage adaptés à sept carrosseries. Elles ne sont pas des plans homologués de chaque modèle. Les photographies du véhicule réel complètent le constat. L'ancien historique conserve ses inspections textuelles : il n'est pas transformé artificiellement en contrôles structurés effectués.

Les pièces acceptées sont JPEG/PNG, 5 Mo par fichier, avec métadonnées identifiantes retirées. Le contrôle est humain, sans OCR, vérification automatique d'identité ni certification d'authenticité. La politique de conservation ne déclenche pas encore une purge automatique.

Les règlements enregistrent des opérations réalisées ailleurs. Il n'y a pas de connecteur bancaire, PSP, compensation de chèque, transmission El Fatoora ni signature qualifiée configurés. Les clôtures de caisse concernent les espèces de location ; les paiements fournisseurs sont enregistrés par banque/carte. Le grand livre, les avoirs fournisseurs, les commandes/réceptions et la paie ne sont pas un module comptable complet livré.

Une entreprise isolée n'est pas une succursale avec transferts internes : ce dernier modèle, les conducteurs multiples, le client payeur distinct, les sinistres complets, les tarifs saisonniers, l'arabe/RTL, les portails publics de réservation et la télématique demeurent des extensions.

La mise en exploitation réelle nécessite les validations fiscales, contractuelles, INPDP/hébergement et techniques recensées dans [REVIEW.md](REVIEW.md), ainsi qu'une restauration réellement exercée et une recette adaptée au volume. Les vues chargent l'historique de l'entreprise ; pagination et archivage doivent être qualifiés pour de longues périodes et de grands réseaux.
