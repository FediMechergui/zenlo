# Zenlo — dossiers Tunisie, 5 novembre 2026

Cette livraison ajoute l’espace **Conformité & opérations** et relie ses dossiers aux locations, pièces privées, contrôles de départ, écritures financières et rapports. Les intégrations externes restent **non configurées**, conformément au choix de l’utilisateur : aucun compte TTN, prestataire de paiement ou politique fiscale approuvée n’a été fourni.

## Parcours livrés

| Sujet | Fonctionnement effectif |
| --- | --- |
| Touristes | CIN ou passeport, numéro, expiration, pays de délivrance, pays et date de délivrance du permis, naissance. La date d’expiration du passeport et la validité de chaque permis sont contrôlées avant une remise réelle. Le verso de CIN n’est pas exigé pour un passeport. |
| Conducteurs et sociétés | Une fiche individuelle par conducteur, jusqu’à huit conducteurs autorisés, signataire individuel et client facturé distincts. La facture utilise le payeur. Un avenant accepté en cours de location recontrôle les pièces et conserve une nouvelle version du contrat. |
| Dossier agence/véhicule | Autorité, déclaration/agrément, exigences applicables, minimum renseigné et flotte éligible contrôlée ; carte grise, première circulation, carte d’exploitation, validité, propriété/leasing/partenaire et agence de rattachement. Aucun minimum réglementaire n’est inventé. |
| Assurance | Police, dates, garanties, exclusions, franchise, conditions des conducteurs, vérificateur et preuves. Les départs réels exigent les dossiers agence, véhicule, assurance, scénarios fiscaux et traitement des données approuvés. |
| Sinistres | Déclaration, expertise, devis, responsabilité, couverture, réponse client, indemnité attendue/reçue et référence de règlement. L’approbation et l’application d’une imputation sont deux opérations distinctes. Un litige ouvert bloque l’imputation. Un repère sur un constat ne crée jamais de charge automatique. |
| Trésorerie | Chèque reçu → vérifié → réservé/remis en banque → compensé, ou rejet/restitution/expiration. Préautorisation autorisée → capturée/libérée/expirée. Seule une compensation/capture confirmée crée un mouvement, atomiquement et une seule fois. Une préautorisation valide jusqu’à la fin prévue peut constituer la garantie de départ sans devenir une recette. |
| Banque | Lignes de relevé et rapprochement avec un mouvement de même montant/sens. Un mouvement et une référence de ligne ne peuvent être rapprochés deux fois. Les références bancaires sont saisies à partir des opérations effectuées ailleurs. |
| Retenue à la source | Facture liée, base, taux, montant arrondi, certificat, date, matricule du payeur, compte comptable et validation. La certification réduit la créance sans augmenter les encaissements. Annuler un certificat produit une contre-écriture distincte, pas un remboursement bancaire. |
| Prélèvement location | Dossier de validation des contrats antérieurs, jours partiels, remplacements, annulations et rapprochement mensuel. Le rapprochement facture/avoir utilise les montants figés et le mois civil de Tunis ; export CSV avec montants négatifs pour les avoirs. Les règles fiscales restent celles validées dans le profil de l’agence. |
| El Fatoora | Qualification de l’applicabilité, préparation, suivi des rejets et de la prochaine action, référence et archive de preuves externes. Export préparatoire JSON avec empreinte et `submitted:false`, sans données de permis/identité. L’émission réelle en circuit électronique reste bloquée tant que TTN n’est pas intégré. |
| Tarification | Grilles de saison, bornes de durée, catégorie, payeur négocié, tarif initial et de prolongation. Le serveur contrôle l’applicabilité et fige la grille dans la réservation. Une grille publiée est remplacée par une nouvelle version, pas modifiée rétroactivement. |
| Livraison | Aéroport/hôtel/agence/autre, vol et horaire, rendez-vous, employé, contact, frais et compte rendu. Une mission réalisée peut appliquer explicitement les frais convenus à une location encore modifiable. |
| Amendes/péages | Avis, autorité, date, montant, échéance, preuve, conducteur identifié et décision. Le rapprochement exige une affectation réelle unique du véhicule à l’instant de l’événement, y compris après remplacement et retour. |
| Agences et partenaires | Succursales de la même entreprise ; partenaires identifiés dans le dossier de provenance du véhicule. Un transfert réserve la capacité, puis met à jour kilométrage et agence à réception. Aucune donnée d’une autre entreprise n’est partagée implicitement. |
| Économie véhicule | Facturé TTC net ventilé selon les durées d’affectation, charges enregistrées, amortissement estimé, intérêts, capital remboursé, durée de maintenance et produit de cession. La marge affichée est indicative ; ce n’est pas un résultat comptable HT et la saisie doit éviter les doublons d’intérêts. |
| Documents client | Sélection FR/EN/AR, présentation RTL en arabe, libellés structurants et contrôles traduits. Une version approuvée de conditions EN/AR est requise ; le texte contractuel et les observations saisis restent verbatim. Les noms de pièces et notes ne sont pas automatiquement traduits. |
| Données personnelles | Dossier des formalités INPDP, hébergeurs, transferts, notice/version, conservation et validation. Gels de suppression par client. Prévisualisation puis suppression effective des copies CIN/passeport/permis éligibles, par lots de 100, avec reprise après panne de stockage. Les dossiers ouverts, sinistres/litiges non clôturés et gels sont exclus. |
| Terrain et reprise | Brouillon de constat/relevés/observations conservé dans la session du navigateur pendant au maximum 24 h de récupération ; l’acceptation du client n’est pas recopiée. Clés de reprise conservées en mémoire lors d’un résultat réseau incertain. Une réussite suivie d’un échec d’actualisation n’invite pas à ressaisir le mouvement. Échecs de mutations journalisés sans copie du corps de requête. |

Chaque dossier dispose d’un contrôle de rôle côté serveur, d’une version optimiste, de pièces JPEG/PNG privées et d’un export CSV. Les états financiers terminaux ne peuvent pas être simplement réécrits. Le journal conserve les transitions, acteurs et références d’opération.

## Ce qui nécessite encore une activation ou une décision

- **Fiscalité et exploitation :** aucun comptable ni autorité n’a validé les politiques de cette agence. Les dossiers de revue collectent ces décisions ; ils ne les remplacent pas. L’arrondi du moteur reste la tranche de 24 h entamée. Les frais d’annulation/non-présentation sont conservés dans les grilles, mais leur facturation automatique et les reprises de contrats historiques ne sont pas activées. Une nouvelle règle approuvée peut nécessiter une adaptation du moteur.
- **TTN et banque :** pas de soumission TTN, signature réglementaire, vérification/réservation Tunichèque, débit carte, import automatique de relevés ou réception de webhooks. Les traces de preuves externes ne changent pas une facture en « acceptée par TTN ». Les captures de carte sont enregistrées pour le montant entier de l’instrument ; les captures partielles exigent une extension du connecteur et du modèle.
- **Facturation après émission :** un sinistre ou une livraison ne modifie pas une facture existante. Une correction par avoir/réémission reste nécessaire ; les factures complémentaires autonomes et l’imputation automatique d’une amende ne sont pas implémentées.
- **Suppression :** l’exécution est déclenchée par le propriétaire après prévisualisation. Aucun ordonnanceur de production n’est configuré. La suppression couvre les fichiers de copies d’identité/permis ; les fiches clients, contrats, audits, pièces comptables et leurs sauvegardes nécessitent leurs propres durées et procédures approuvées. L’action ne prétend pas supprimer les anciennes sauvegardes externes.
- **Accès client :** l’autorisation Zenlo et l’accès au site privé restent deux contrôles. Un fournisseur d’authentification client indépendant et la configuration d’hébergement correspondante ne sont pas disponibles. Le site n’a pas été rendu public.
- **Sauvegardes :** l’outil décrit ci-dessous vérifie une restauration locale/hors ligne. Aucun stockage distant, ordonnanceur, chiffrement de sauvegarde ou objectif de reprise de production n’est configuré par cette livraison.

## Restauration testable

`scripts/recovery.py` réalise une sauvegarde SQLite cohérente et copie un export d’objets avec inventaire SHA-256. **Arrêter les écritures sur les deux sources** avant `--quiesced`. Le répertoire d’objets doit contenir tous les objets privés et photos correspondant à la base. Pour les émulations Wrangler, inclure les métadonnées de stockage de l’émulateur dans l’export approprié ; une seule base D1 ne suffit pas.

```powershell
python scripts/recovery.py backup --database C:/backup-input/database.sqlite --objects C:/backup-input/objects --destination C:/private-backups/zenlo-2026-11-05 --quiesced
python scripts/recovery.py verify --source C:/private-backups/zenlo-2026-11-05
python scripts/recovery.py restore --source C:/private-backups/zenlo-2026-11-05 --destination C:/restore-test/zenlo-2026-11-05
```

La destination doit être nouvelle : aucune base existante n’est écrasée. Le contrôle vérifie les empreintes, les contraintes étrangères et l’intégrité SQLite avant restauration. Les sauvegardes contiennent des données privées : utiliser le stockage protégé et les durées définis par l’agence. Le test automatisé utilise exclusivement une base et des octets photo fictifs, puis valide leur liaison après restauration.

## Vérification et déploiement

- Migration `0009_common_madame_masque.sql` : métadonnées d’identité, parties et politique commerciale figées, dossiers opérationnels, liens de fichiers et suppression, contraintes de rapprochement/instruments.
- Tests serveur : règles existantes et nouveaux parcours de touristes, parties, chèques, garanties, litiges, retenues, grilles, traductions, pièces privées, conservation, transferts et amendes.
- `npm run test:browser:gaps` : formulaires passeport, dossier avec preuve, chèque, mobile, payeur société/deux conducteurs contrat arabe/PDF et reprise du brouillon de retour sans réutiliser l’accord client.
- `npm run test:recovery` : restauration base + objets, détection de corruption/traversée de chemins, refus d’écrasement.
- Aucune donnée de production n’a été utilisée pour ces tests. La migration conserve les anciennes locations et silhouettes.

## Références et limites de vérification

Les [conditions Hertz Tunisie](https://www.hertz.tn/article/conditions-generales) décrivent notamment conducteurs autorisés, informations de vol, garanties et gestion des dommages ; elles illustrent des pratiques contractuelles, pas une règle universelle. Le [manuel INPDP](https://www.inpdp.tn/Manuel_procedures_INPDP.pdf) et les [textes INPDP](https://www.inpdp.tn/Texte.html) fondent le dossier de formalités et de transferts à compléter.

La [publication ARP du 2 avril 2026](https://arp.tn/blog/1/post/2026-9508) décrit une étape de commission : elle n’est pas utilisée comme preuve d’une exemption entrée en vigueur. L’accès direct à la note DGELF 07/2026 et à la procédure complète du ministère a échoué pendant cette vérification ; aucun seuil de flotte ni changement de régime fiscal n’a été certifié sur cette base. Les sources fournies par l’utilisateur restent à joindre à la revue de l’agence : [DGELF 07/2026](https://jibaya.tn/wp-content/uploads/2026/03/%D9%85%D8%B0%D9%83%D8%B1%D8%A9-%D8%B9%D8%A7%D9%85%D8%A9-%D8%B9%D8%AF%D8%AF-07.pdf), [ministère des Transports](https://www.transport.tn/fr/faq/25/10-quels-sont-les-procedures-pour-lexercice-de-lactivite-dexploitation-dun-etablissement-de-location-de-voitures), [guide BIAT](https://www.biat.tn/biat/Fr/actualites_7_102_D208).
