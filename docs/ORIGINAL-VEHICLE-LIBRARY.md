# Bibliothèque originale Zenlo — Collection 01

Cette collection contient quatre jeux de huit dessins vectoriels originaux : Renault Clio V phase 1 (2019–2022), Peugeot 208 II phase 1 thermique (2019–2022), Iveco Daily fourgon H2 (2019–2020) et Yamaha MT-07 (2021–2022). Les configurations précises, sources documentaires et limites figurent dans `lib/original-vehicles.ts` et dans l'interface.

Ces dessins sont des illustrations de repérage à vérifier, pas des plans constructeur exacts. Ils ne sont ni extraits ni décalqués du catalogue CCVision. Le catalogue de suggestions de marques/modèles est distinct : une suggestion ne signifie pas qu'un dessin spécifique existe. Les autres modèles conservent leurs gabarits génériques ou leurs références importées.

## Utilisation

Dans **Parc automobile → Ajouter/modifier un véhicule → Schéma du modèle**, renseigner l'année puis sélectionner un dessin dans la bibliothèque Zenlo. La sélection renseigne marque, modèle, carrosserie et révision. L'API refuse les incohérences d'identité, de carrosserie et d'année. Les curseurs de proportions sont désactivés pour préserver le dessin.

Chaque jeu comprend avant, arrière, gauche, droite, dessus, habitacle/assises, tableau de bord/commandes et coffre/chargement. Les parties nommées préremplissent la pièce touchée dans le constat. Les asymétries comprennent notamment la trappe carburant, la porte coulissante du Daily et la chaîne/échappement de la moto.

Contrôler la correspondance au véhicule réel avant de cocher la validation : génération, conduite à gauche/droite, équipement intérieur, ouvrants et accessoires. Un nom de vérificateur et une référence du contrôle sont obligatoires. Cette déclaration est propre à la fiche et ne certifie pas l'exactitude constructeur. Les variantes absentes nécessitent un nouveau dessin ou des références importées.

Les constats figent l'identifiant et la révision ; PDF et portail client les reprennent même si la fiche change. Les modèles enregistrés dans la bibliothèque de l'entreprise peuvent réutiliser ces dessins. Aucune requête vers un fournisseur d'images n'est nécessaire à leur affichage.

## Export autonome

Exécuter `npm run export:drawings`. Le dossier `outputs/zenlo-original-library/` contient 32 fichiers SVG, une galerie `index.html` et un `manifest.json` avec sources, limites, révisions et empreintes SHA-256. Les éléments SVG portent leurs noms de pièces. L'export est généré depuis les mêmes composants que l'application.

## Étendre la couverture

1. Prioriser les modèles réellement présents dans les flottes. Recueillir des références utilisables de chaque vue extérieure et intérieure, la génération, le facelift, les années, la carrosserie, le marché et les équipements.
2. Ajouter une identité stable et sa fiche documentée dans le registre. Séparer les variantes qui modifient les pièces ou leur position. Pour les utilitaires/camions, préciser cabine, empattement, hauteur, portes et caisse ; pour les deux-roues, carénage et bagagerie.
3. Créer les huit dessins originaux et les groupes `data-part`, en vérifiant séparément gauche et droite. Ne pas présenter une simple déformation d'un gabarit comme une nouvelle géométrie exacte.
4. Comparer les dessins au véhicule réel et conserver les preuves de contrôle. Garder le statut brouillon tant que les différences ne sont pas résolues.
5. Ajouter les cas de correspondance et inspecter le rendu, les clics de pièces, le mobile, les constats historiques, le PDF et le portail client.

Les révisions publiées sont immuables : `tests/fixtures/original-vehicle-v1.sha256.json` fige les 32 rendus initiaux. Ne jamais remplacer ces empreintes pour faire passer une modification. Ajouter une nouvelle révision au schéma, au registre et au rendu en conservant les branches anciennes. Leurs éventuelles primitives partagées doivent elles aussi rester stables. Ajouter les nouvelles empreintes dans un fichier séparé. Une future extension doit également faire évoluer les assertions de couverture initiale sans retirer la vérification historique.

La couverture mondiale reste un travail de constitution et de vérification de catalogue. Cette livraison établit la première collection et son intégration opérationnelle ; elle ne fournit pas toutes les générations et variantes.
