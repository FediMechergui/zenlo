# Exploitation de Zenlo

## Préparer le pilote

Faire exécuter à l'équipe les parcours avec les données fictives : réservation, dépôt, départ, prolongation, remplacement, retour, facture, avoir et remboursement. Rapprocher les totaux avec les documents. Tester aussi conflit, insuffisance de caution et kilométrage supplémentaire.

Documenter les règles commerciales, justificatifs, fractions de journée et paramètres fiscaux avec les personnes compétentes. Qualifier pays de stockage, sous-traitants, accès d'assistance et formalités de traitement/transfert avant données réelles. Préparer une agence réelle dans un déploiement distinct.

## Accès

L'appartenance dans Zenlo et l'accès privé au site doivent tous deux autoriser la personne. Tester les rôles agent, comptable et lecteur avant ouverture à l'équipe. L'ajout d'un membre dans l'ERP ne déclenche aucune invitation de plateforme.

Un paiement est une écriture d'un mouvement confirmé à l'extérieur, pas une instruction bancaire. Conserver sa référence. Un chèque ne peut pas être enregistré comme définitivement encaissé tant que le workflow de compensation n'est pas développé.

## Sauvegarde et restauration

Les exports CSV ne remplacent pas une sauvegarde complète de base et de photos. Cette livraison ne configure pas de sauvegarde externe planifiée ni d'engagement RPO/RTO.

Avant production, obtenir les moyens d'administration D1/R2 ou un dispositif équivalent de l'hébergeur et réaliser cet exercice :

1. Exporter la base et un inventaire des objets avec empreintes vers un emplacement privé autorisé.
2. Restaurer dans un environnement distinct avec les mêmes versions applicatives et migrations.
3. Vérifier agences, membres, parc, locations ouvertes, documents, photos et clés d'idempotence.
4. Rapprocher paiements, avoirs, cautions et caisse ; les sommes doivent être identiques.
5. Mesurer délais et perte réelle de données avant de contractualiser la continuité.

Aucune restauration destructive n'est automatisée ici. Un retour arrière après paiements réels exige un rapprochement des événements postérieurs à la sauvegarde.

## Incidents

- Conflit de planning : conserver les engagements existants, constater le mouvement réel et décider explicitement du remplacement ou de l'annulation.
- Résultat d'écriture incertain : réutiliser la même clé d'idempotence et le même contenu ; vérifier dossier et audit avant une nouvelle opération.
- Photo indisponible : contrôler droits et objet ; ne pas rendre le bucket public.
- Écart de caisse : conserver le comptage réel et documenter l'écart. La session clôturée reste immuable.
- Erreur de facture : avoir lié et remboursement séparé, avec conservation de l'original.

Les erreurs API possèdent un identifiant de corrélation. Ne pas journaliser pièces d'identité, secrets ou corps financiers complets.

## Supervision et mise à jour

Définir responsables et alertes : indisponibilité, erreurs, échecs de stockage, latence, volumes, âge des sauvegardes et anomalies de rapprochement. Faire une revue de sécurité et une campagne de charge représentative.

Le pilote charge les données d'une agence pour ses vues. Pagination, archivage et reporting côté serveur doivent être étendus et mesurés avant un historique volumineux ou un réseau d'agences.

Pour une livraison : TypeScript, tests métier, tests HTTP/navigateur pertinents, revue des migrations, build, synchronisation de la source exacte et déploiement de la version privée. Garder les bases locale et distante séparées.

La politique de conservation est déclarative. Purge, gels probatoires et droits des personnes exigent des procédures spécifiques et ne sont pas automatisés par cette livraison.
