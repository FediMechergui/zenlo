# Zenlo — socle serveur du pilote

## Architecture et isolation

Le serveur utilise les routes Vinext, une base D1 relationnelle et les identités vérifiées par la plateforme Sites. Chaque requête résout l'utilisateur puis son appartenance à une agence. Le navigateur ne choisit jamais le `tenant_id`. Les références métier utilisent des clés étrangères composées `(tenant_id, id)` ; une référence vers une autre agence est refusée même si son identifiant est connu.

Le pilote associe une identité à une agence. Les rôles sont propriétaire, responsable, agent, comptable et lecteur. L'ajout d'un membre prépare son autorisation métier ; il n'envoie pas d'invitation et ne modifie pas le partage Sites. Le propriétaire doit également autoriser l'accès au site par le mécanisme de la plateforme. Les accès accordés par adresse authentifiée sont ensuite liés à l'identifiant utilisateur stable.

Les mutations exigent une origine identique, un corps JSON borné à 128 Kio et une clé `Idempotency-Key`. Le corps, la méthode et le chemin sont condensés en SHA-256. La réponse idempotente, les modifications et l'audit sont enregistrés dans le même lot transactionnel D1. Une même clé avec une demande différente est refusée. Le rôle est revérifié dans la transaction afin qu'une révocation concurrente ne laisse pas passer l'action.

## Disponibilité et opérations

Les plages sont semi-ouvertes. Les réservations confirmées et les immobilisations créent des occupations. Le délai de préparation est compris dans la fin occupée. Deux écritures concurrentes ne peuvent pas contourner les déclencheurs SQLite de chevauchement. Une réservation brouillon ne bloque pas le planning.

Une location active en retard et une maintenance dépassée non terminée restent bloquantes jusqu'au retour ou à la remise en service explicite. Les écritures utilisent les versions attendues du dossier et des véhicules. Les documents requis doivent couvrir la durée prévue. Le départ vérifie le permis, l'état du parc, l'acceptation constatée de l'inspection et la caution constituée. Une confirmation en mode réel exige les validations fiscales, contractuelles et d'hébergement configurées.

Le retour en retard doit pouvoir être constaté même s'il impacte une réservation suivante. Une occupation de préparation créée après un retour peut donc chevaucher une réservation déjà confirmée ; cette exception conserve les faits réels et bloque tout nouveau départ conflictuel. Elle ne déplace jamais automatiquement le contrat suivant. Les équipes doivent résoudre l'impact dans le planning.

Le remplacement exige deux états des lieux réels et l'acceptation du nouveau véhicule. Les affectations successives conservent les relevés de kilométrage ; les kilomètres supplémentaires portent sur la somme des segments. Le prix journalier accepté reste inchangé. Une prolongation recalcule le prix avec le barème fiscal et commercial figé au devis.

## Argent, caisse et factures

Tous les montants sont des entiers en millimes. Les taux sont exprimés en points de base ; la TVA est arrondie au millime sur la base globale calculée. La durée est arrondie à la tranche de 24 heures commencée. Cette convention doit être acceptée et validée pour l'agence ; elle n'est pas présentée comme une règle fiscale universelle.

La contribution journalière est un composant séparé, configurable et figé dans chaque location. Le paramètre proposé est 2 000 millimes par jour, inclus dans la base de TVA. La validation fiscale est désactivée au départ ; aucun taux de TVA ou droit de timbre n'est déclaré validé automatiquement. Un devis antérieur à un changement fiscal ne peut pas être confirmé sans refaire accepter un devis cohérent.

Le sous-registre des cautions est distinct des règlements. Des déclencheurs empêchent restitution ou utilisation au-delà du dépôt détenu, remboursement au-delà des encaissements et règlement au-delà de la créance. L'utilisation d'une caution ne crée pas un mouvement de caisse fictif. Elle exige un retour enregistré, un motif et un rôle financier autorisé. Les chèques non compensés ne sont pas traités comme des recettes : ce canal est refusé tant qu'un véritable cycle d'encaissement/rejet n'est pas intégré.

Les espèces exigent une caisse ouverte. Le solde théorique de clôture est calculé atomiquement depuis ses mouvements ; une sortie ne peut rendre la caisse négative. Les mouvements et les sessions clôturées sont immuables. Les dépenses enregistrées sont des charges ; elles ne constituent pas automatiquement un décaissement de caisse.

La facture finale est préparée après le retour. Les paiements précédents restent des règlements anticipés du dossier ; la facturation d'acompte réglementaire n'est pas encore un flux distinct. L'émission attribue un numéro transactionnel par année/série et fige les coordonnées de l'émetteur et du client. La facture émise se corrige par avoir intégral lié. Un avoir intégral ramène la créance facturée à zéro jusqu'à l'émission d'une facture de remplacement ; un simple nouveau brouillon ne recrée pas de dette. L'avoir ne rembourse pas automatiquement le client.

Le statut externe `not_configured` est explicite. Un document local n'est jamais une preuve d'acceptation El Fatoora. En mode réel, le circuit de facturation non qualifié bloque l'émission ; un circuit électronique la bloque également tant que le connecteur n'est pas disponible. Le circuit papier exige une décision documentée du comptable avec validation fiscale. Le logiciel n'infère pas lui-même une exemption. L'export de contribution est un état de rapprochement par mois d'émission, avec références d'avoirs ; il n'est pas une déclaration fiscale officielle.

## Documents et données

Les documents contractuels sont des instantanés versionnés avec empreinte SHA-256. Les inspections, paiements, avoirs, factures émises et traces d'audit sont protégés contre la modification ou la suppression silencieuse. L'accord d'inspection est constaté par l'agent ; aucune signature qualifiée n'est simulée. Les photos sont gérées par les routes R2 privées du projet.

Les exports CSV respectent l'agence et les rôles, neutralisent les cellules pouvant être interprétées comme formules et expriment les montants dans des colonnes en millimes. Ils n'exportent pas les numéros de permis dans la liste des clients. Les jeux de démonstration sont chargés uniquement après le choix explicite du mode démonstration. Les clients, coordonnées, plaques et opérations de ce mode sont fictifs.

La durée de conservation proposée au premier démarrage est zéro, ce qui signifie « à qualifier ». La validation du traitement et de l'hébergement exige une durée positive et une politique documentée. Ce paramètre ne remplace pas une analyse par catégorie de pièce et ne lance aucun effacement automatique. Les imports CSV sont contrôlés avant application, limités à 100 lignes et à 750 Ko, puis appliqués atomiquement avec détection des doublons. Les imports et uploads sont revérifiés contre les autorisations et la version des paramètres au moment de l'écriture.

## Frontière du pilote et mises en production

Ce serveur est un socle fonctionnel testé ; la conformité d'une agence précise nécessite les validations indiquées dans le dossier réglementaire du projet. Ne pas importer de données personnelles réelles dans le déploiement privé avant validation de l'hébergement, des transferts éventuels, des durées et des formalités applicables.

Les extensions suivantes restent à réaliser et à recetter avant d'en faire une promesse commerciale : connecteur TTN/El Fatoora avec signatures et acceptation ; prestataire de paiement et webhooks ; préautorisation bancaire et chèques avec compensation ; factures d'acompte ; conducteurs multiples et payeur distinct ; réservation de capacité par catégorie sans véhicule attribué ; multi-agences et transferts ; saisons et politiques commerciales avancées ; comptabilité générale et exports homologués au logiciel du comptable ; collecte de signature probante ; gestion complète des sinistres, assurances et achats ; traitements automatiques de conservation ; notifications délivrées ; supervision, restauration et procédures d'incident validées.

Le mode de démonstration est isolé par agence mais ne se transforme pas automatiquement en production. La mise en service utilise un espace réel préparé avec les validations, imports contrôlés et accès nécessaires. Aucun test local ne prouve à lui seul un engagement de disponibilité, un RPO/RTO ou la certification réglementaire du produit.

Les migrations appliquées sont immuables. Les scripts `db/*invariants.sql` sont des sources de lecture des invariants ; seules les migrations versionnées du dossier `drizzle/` doivent être appliquées. Les ajustements de déclencheurs se livrent par nouvelle migration après le premier déploiement.
