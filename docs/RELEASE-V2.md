# Zenlo — livraison étendue du 5 novembre 2026

**Mise à jour :** [la livraison des dossiers Tunisie](RELEASE-V3.md) ajoute les passeports, conducteurs et payeurs distincts, conformité, sinistres, instruments bancaires, retenues, tarifs, livraisons, transferts, conservation et reprise. Elle précise les intégrations encore non configurées et les limites réelles de chaque parcours.

Cette livraison remplace l'interface initiale par un espace d'exploitation sobre : navigation claire, tableaux homogènes, planning, dossier de location, centre documentaire et formulaires adaptés au mobile. Les actions décrites ci-dessous écrivent dans D1 et, pour les fichiers, dans R2 privé.

## Extension : bibliothèque originale Zenlo

La première collection ajoute **4 modèles et 32 vues vectorielles originales** : Clio V phase 1 (2019–2022), 208 II phase 1 thermique (2019–2022), Daily fourgon H2 (2019–2020) et MT-07 (2021–2022). Sélection dans le schéma du véhicule, recherche et filtre, pièces nommées, contrôle d'identité/année côté serveur, vérification déclarée par l'agence et réutilisation dans ses modèles enregistrés. Les constats, PDF et portail client conservent la révision choisie.

Les dessins sont **des illustrations schématiques à vérifier sur la variante réelle**, pas des plans constructeur exacts ni un catalogue mondial complet. Ils sont écrits en SVG dans Zenlo, sans incorporation de dessins CCVision. `npm run export:drawings` génère les 32 SVG, leur manifeste et une galerie autonome. Voir [la documentation de la bibliothèque](ORIGINAL-VEHICLE-LIBRARY.md) pour l'utilisation, les limites et l'ajout de modèles sans modifier les anciennes révisions.

## Extension : vues détaillées et références par modèle

Les nouveaux véhicules utilisent huit vues : avant, arrière, gauche, droite, dessus, habitacle/assises, tableau de bord/commandes et coffre/chargement. Les quinze carrosseries disposent de détails de pièces (rétroviseurs, poignées, éclairage, essuie-glaces, roues, commandes, assises et équipements selon la famille). **Agrandir** facilite le placement précis des repères. Les anciens constats conservent leurs quatre vues ; activer les vues détaillées dans la fiche ne les redessine pas.

Dans **Schéma du modèle → Configurer les références**, importer des images JPEG/PNG propres à la génération et à la variante. Renseigner marque, modèle, années de fabrication, génération, configuration, source/licence et vérificateur. L’API refuse une référence d’un autre modèle, d’une autre année ou d’une autre entreprise. Chaque vue importée remplace intégralement le dessin générique, sans déformation par les curseurs. La vérification par l’agence exige huit vues et les métadonnées ; ce n’est pas une certification constructeur.

Les **zones de pièces** permettent de définir jusqu’à 60 zones nommées sur les références. Cliquer une zone préremplit la pièce du constat ; le nom reste modifiable et accessible au clavier. Le constat conserve les pièces, coordonnées et références. Les rapports et le portail client utilisent cette copie historique. Le bouton d’impression attend le chargement des images et signale un échec au lieu de lancer un PDF incomplet.

Les fichiers sont privés et immuables, dédupliqués par entreprise, limités à 5 Mo par vue et 2 000 images par entreprise. Les propriétaires/responsables les importent ; un client ne peut lire que les images présentes dans les constats d’un dossier qui lui est explicitement accordé. Retirer une référence d’une fiche ne supprime pas l’image des anciens rapports. La migration 0008 ajoute leur catalogue. Aucune bibliothèque externe ni clé fournisseur n’est incluse dans cette livraison. Hors collection originale et références importées, les gabarits restent explicitement génériques.

### Recherche des illustrations — 5 novembre 2026

Les sources consultées ne permettent pas de promettre un dessin exact de chaque modèle, intérieur et extérieur. La couverture doit être vérifiée par génération, facelift, marché, carrosserie et configuration réelle. Les camions exigent notamment la cabine, l’empattement et le montage de caisse ; les deux côtés ne doivent pas être obtenus automatiquement par symétrie lorsque les pièces diffèrent.

| Fournisseur | Utilité constatée | Limite pour Zenlo |
| --- | --- | --- |
| [CCVision CAR-SPECIAL](https://www.ccvision.de/en/car-special/product-info.html) | Dessins extérieurs en cinq vues ; catalogue couvrant notamment voitures, utilitaires, poids lourds, autobus et deux-roues. | Les [conditions standard](https://www.ccvision.de/en/service/help/car-special.html) interdisent l’intégration dans un logiciel et prévoient une licence spéciale pour ces usages. Aucun droit d’intégration SaaS acquis. |
| [Outlines](https://getoutlines.com/vector-drawings/2240/2016-2018-renault-clio-drawings) | Exemple précis disponible : Clio IV 5 portes facelift 2016–2018 ; vues et pièces en couches vectorielles. | Le fournisseur précise que ses dessins ne sont pas des plans exacts de réparation. Sa [FAQ](https://getoutlines.com/help/faq-and-support) exclut les intérieurs et zones de chargement. Vérifier les droits SaaS, les deux côtés et chaque référence ; ne pas confondre « REQUEST » avec un fichier disponible. |
| [Pro Vehicle Outlines](https://www.provehicleoutlines.com/) | Bibliothèque extérieure de voitures, utilitaires, camions et véhicules spécialisés européens/nord-américains. | L’[EULA](https://www.provehicleoutlines.com/pvo-eula/) ne constitue pas une licence générale de redistribution des dessins dans Zenlo. Couverture locale et droits d’intégration à confirmer. |
| [Izmostock](https://www.izmostock.com/faqs-en-us.htm) | Images et vues intérieures/extérieures, distribution API/FTP, rapprochement par modèle/finition. | Photographies/visuels, pas catalogue universel de silhouettes. Licence à durée limitée, sans licence perpétuelle standard ; il faut obtenir les droits de conserver les rapports historiques. |

Recommandation : qualifier une licence spéciale CCVision pour les extérieurs de la flotte pilote, puis des dessins intérieurs commandés à partir de références autorisées et de la configuration réelle. Izmostock est une alternative pour des visuels intérieurs si ses droits conviennent aux rapports. Il s’agit d’une recommandation de sourcing, pas d’une intégration réalisée. Aucun fournisseur n’a été contacté, aucun compte créé et aucun achat effectué.

Avant un contrat fournisseur, obtenir une liste de modèles disponibles et les droits couvrant : affichage dans un SaaS multi-entreprise, portail client, adaptation/rastérisation et zones de pièces, impressions/PDF, hébergement privé et conservation des constats après fin de licence. Demander séparément le coût des dessins manquants, des deux côtés et des intérieurs. Les tarifs publics d’un abonnement de dessin ne sont pas un devis d’intégration Zenlo.

## Extension : flotte mixte et modèles personnalisés

Dans **Parc automobile → Ajouter un véhicule**, choisir une famille : voiture/utilitaire, camion, moto/scooter, minibus/autocar ou quad. Les quinze silhouettes comprennent camion fourgon, plateau et benne. La recherche propose des marques/modèles adaptés à la famille ; la saisie libre reste disponible. NHTSA enrichit les suggestions automobiles ; les autres familles utilisent le catalogue local.

La section **Schéma du modèle** permet de régler longueur latérale, largeur avant/arrière, hauteur, taille des roues latérales, galerie et nom du schéma. **Enregistrer comme modèle** ajoute un gabarit à la bibliothèque de l'entreprise. Sélectionner ce modèle sur un autre véhicule en copie le schéma ; enregistrer ensuite la fiche véhicule. Un responsable peut modifier, créer une variante ou retirer un modèle de la bibliothèque. Limite : 200 modèles par entreprise.

Chaque inspection conserve sa géométrie et utilise des libellés de contrôle adaptés à la famille. Les anomalies non résolues entraînent la conservation du schéma précédent ; une fois résolues, un nouveau constat peut adopter le schéma courant. Modifier la fiche ou le modèle n'altère jamais un ancien rapport ou le portail client. Les changements de silhouette et de règles de location sont bloqués pendant une location active.

Les familles supplémentaires disposent d'un profil de location propre au véhicule : TVA, timbre, prélèvement, validateur et références d'exploitation. Le prélèvement automobile n'est pas recopié automatiquement. La location réelle exige un profil explicitement vérifié ; la démonstration reste possible. Cette saisie ne certifie pas les permis, l'assurance ou l'autorisation d'exercer, qui restent à contrôler. Un remplacement entre profils fiscaux différents exige un dossier distinct.

Ces personnalisations sont vectorielles et ne fournissent pas de plan constructeur exact. L'import d'images personnalisées est désormais disponible dans l'extension de références décrite plus haut. Les validités assurance/visite et contrôles manuels restent ceux du parcours de location existant.

## Parcours disponibles

1. Configurer le profil de l'entreprise : logo, adresse, fax, matricule fiscal, RNE, contacts, forme juridique, capital, banque, RIB, couleur et pied de page. Les documents figés gardent leur ancien profil lors d'une modification ultérieure.
2. Ajouter un véhicule depuis une recherche marque/modèle, choisir sa carrosserie et renseigner son VIN, compteur, tarifs et validités. Le catalogue local contient 105 marques et 985 suggestions de modèles ; NHTSA vPIC apporte un enrichissement optionnel. La saisie libre reste possible lorsque le catalogue est incomplet ou indisponible. Le catalogue n'est pas présenté comme exhaustif mondialement.
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

- `npm test` : 137 tests réussis, 0 échec ; migrations réelles dans SQLite, services et routes réels, contrôles de concurrence, droits, pièces, portail, rapports, montants et schémas, dont le rendu serveur accessible des quinze silhouettes en quatre et huit vues, les références et leur isolation, les quatre dessins originaux et leurs empreintes immuables.
- `npm run test:browser:original-library` : cinq parcours couvrant la sélection des quatre modèles, la recherche et la validation, les pièces asymétriques, les révisions historiques dans les PDF et le portail client. Données fictives sur serveur local uniquement ; `ZENLO_BUILT_QA=1` active le contexte du build local.
- `npm run typecheck` : interfaces, routes et composants TypeScript.
- `node tests/http.integration.mjs` : parcours de location historique, 14 contrôles HTTP.
- `node tests/http-v2.integration.mjs` : 11 parcours d'extension, fichiers, multi-entreprise, fournisseurs, documents, vrai export PDF et accès client.
- `npm run test:browser` : 28 contrôles des onze rubriques desktop/mobile et formulaires.
- `npm run test:browser:workflows` : huit parcours avec écriture par l'interface, dont profil, fournisseur, charge/règlement, devis, récurrence et isolation d'entreprise.
- `npm run test:browser:mixed-fleet` : neuf parcours de création, bibliothèque, isolation des copies, camion, mobile, constat moto, PDF et portail client. Exécutable aussi sur le build local avec `ZENLO_BUILT_QA=1`.
- `node tests/vehicle-browser.integration.mjs` : six contrôles de recherche, clavier, repères, checklist, kilomètres et mobile.
- `node tests/model-references.integration.mjs` : six parcours de vues détaillées/agrandissement, import des huit références, vérification de modèle, zones de pièces, mobile, reports PDF et portail client ; fixtures dessinées par le test, jamais présentées comme dessins constructeur. Exécutable sur le build local avec `ZENLO_BUILT_QA=1`.

Les tests HTTP utilisent uniquement la base locale fictive. Les images, le PDF d'exemple et les résultats détaillés restent dans `outputs/`. Les migrations 0003 à 0008 ajoutent les données et protections sans remplacer les historiques existants. Les nouveaux parcours de références ont été exécutés sur serveur de développement et build local ; les anciens parcours non liés à cette extension correspondent à la recette V2 précédente.

## Conditions et limites précises

L'accès à un site privé et l'appartenance Zenlo sont deux autorisations. Ajouter un collaborateur ou un client dans l'application ne l'invite pas automatiquement dans Sites ; un propriétaire doit aussi lui donner accès au site. Aucun e-mail ou SMS n'est envoyé par cette livraison. Un e-mail de compte authentifié autorisé est nécessaire au portail.

Les silhouettes sont des outils de repérage adaptés à quinze silhouettes. Elles ne sont pas des plans homologués de chaque modèle. Les photographies du véhicule réel complètent le constat. L'ancien historique conserve ses inspections textuelles : il n'est pas transformé artificiellement en contrôles structurés effectués.

Les pièces acceptées sont JPEG/PNG, 5 Mo par fichier, avec métadonnées identifiantes retirées. Le contrôle est humain, sans OCR, vérification automatique d'identité ni certification d'authenticité. La politique de conservation ne déclenche pas encore une purge automatique.

Les règlements enregistrent des opérations réalisées ailleurs. Il n'y a pas de connecteur bancaire, PSP, compensation de chèque, transmission El Fatoora ni signature qualifiée configurés. Les clôtures de caisse concernent les espèces de location ; les paiements fournisseurs sont enregistrés par banque/carte. Le grand livre, les avoirs fournisseurs, les commandes/réceptions et la paie ne sont pas un module comptable complet livré.

Une entreprise isolée n'est pas une succursale avec transferts internes : ce dernier modèle, les conducteurs multiples, le client payeur distinct, les sinistres complets, les tarifs saisonniers, l'arabe/RTL, les portails publics de réservation et la télématique demeurent des extensions.

La mise en exploitation réelle nécessite les validations fiscales, contractuelles, INPDP/hébergement et techniques recensées dans [REVIEW.md](REVIEW.md), ainsi qu'une restauration réellement exercée et une recette adaptée au volume. Les vues chargent l'historique de l'entreprise ; pagination et archivage doivent être qualifiés pour de longues périodes et de grands réseaux.
