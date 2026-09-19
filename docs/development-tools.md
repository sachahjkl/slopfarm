# Outils de développement

## Model Lab

Lance `pnpm dev`, puis ouvre `/viewer.html`.

Dépose un fichier GLB dans la zone prévue. Le fichier reste dans ton navigateur.

Le viewer affiche les dimensions, triangles, sommets, maillages, matériaux, nœuds et animations.

Utilise la souris pour tourner autour du modèle. Active le maillage filaire pour examiner la topologie.

Écris les retouches dans le champ de retour. Exporte ensuite le fichier JSON.

Envoie ensemble les éléments suivants :

- le fichier GLB ou son chemin dans le dépôt ;
- le fichier `*-review.json` ;
- la capture PNG si le cadrage apporte une information utile.

Le JSON conserve la caméra et les mesures. Je peux ainsi retrouver le point de vue exact.

## Environnement des modèles

Exécute `nix develop .#assets` pour obtenir Blender, ImageMagick et glTF Transform.

Cet environnement reste séparé du développement Web. Blender ne ralentit donc pas le shell principal.
