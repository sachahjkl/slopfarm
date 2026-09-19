# Vision et boucle de jeu

## Promesse

Le joueur obtient réellement la boucle montrée dans les publicités mobiles.

Chaque action produit un retour visuel immédiat. Chaque retour alimente une amélioration visible dans le monde.

Le jeu évite les menus longs, les délais artificiels et les monnaies opaques.

## Boucle principale

1. Le joueur quitte sa base avec un outil.
2. Il coupe, mine ou combat sans changer de mode.
3. Les ressources forment une pile physique visible sur son dos.
4. Il revient quand la pile devient spectaculaire ou dangereuse.
5. La zone de vente aspire chaque élément vers un établi.
6. La vente remplit une pile de pièces avant de créditer le joueur.
7. Le joueur marche sur une zone d’amélioration et dépense ses pièces.
8. L’amélioration transforme immédiatement le personnage, la base ou la production.
9. Une nouvelle zone devient rentable ou accessible.

Une boucle courte dure entre 45 et 90 secondes.

## Principes d’amélioration

Chaque amélioration doit changer au moins une propriété visible.

| Famille | Effet mécanique           | Effet visible                         |
| ------- | ------------------------- | ------------------------------------- |
| Hache   | Dégâts et largeur du coup | Nouvelle tête, traînée plus large     |
| Sac     | Capacité et stabilité     | Pile plus haute et sangles renforcées |
| Vitesse | Déplacement               | Foulées, poussière et cadence         |
| Atelier | Prix et débit de vente    | Taille, convoyeur et employés         |
| Base    | Services et rayon sûr     | Bâtiments et palissade                |
| Zone    | Ressources plus riches    | Pont, portail ou brouillard retiré    |

Le coût suit une courbe exponentielle modérée. Les paliers visuels arrivent tous les trois niveaux.

## Ressources

Le premier biome utilise trois ressources.

- Le bois sert aux améliorations physiques.
- Les pièces paient les statistiques du personnage.
- Les cristaux rares ouvrent les zones et les machines.

Une ressource au sol existe comme objet visuel. Le compte agrégé reste la source de vérité.

## Pile spectaculaire

La pile utilise des instances rendues, pas une simulation rigide complète.

Les premiers objets occupent des emplacements stables. Les objets suivants ajoutent du balancement, du retard et une courbure.

La pile peut dépasser l’écran. Le moteur supprime naturellement les fragments hors champ.

Une pile instable perd quelques objets lors d’un choc. Cette règle crée un choix entre rendement et retour prudent.

## Combat

Le même bouton et la même animation servent à couper et frapper.

Le ciblage choisit l’objet valide le plus proche dans un cône frontal. Les ennemis annoncent leurs attaques avec une zone au sol.

La défaite retire une partie de la cargaison. Elle ne retire jamais une amélioration permanente.

## Première session de dix minutes

1. Coupe trois arbres.
2. Observe la première pile.
3. Vends le bois.
4. Améliore la hache.
5. Débloque la scierie.
6. Défends la scierie contre un sanglier.
7. Améliore le sac.
8. Transporte une pile qui dépasse le personnage.
9. Répare le pont.
10. Entre dans le biome rocheux.
