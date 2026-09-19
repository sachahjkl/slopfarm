# Plan de la forêt

La zone jouable utilise une lisière irrégulière inscrite dans un territoire de 72 × 72 mètres.

La forêt visuelle continue sur environ 104 × 104 mètres. Une crête rocheuse matérialise la limite jouable avant cette forêt distante.

Le joueur agrandit une enceinte forestière compacte avec six emprises successives.

Les améliorations ouvrent des portes en rondins et tracent progressivement les sentiers vers les massifs.

## Principes

- Donnez une surface, une entrée et un stock à chaque activité.
- Alignez les bâtiments, routes, clôtures et plantations sur deux axes principaux.
- Utilisez les variations organiques dans les silhouettes et les bordures.
- Montrez une activité complète et deux fragments voisins dans un cadrage normal.
- Raccordez chaque porte à une clôture, un talus ou une autre limite continue.
- Gardez les dépôts hors des routes principales.
- Séparez chaque dépôt de son point de collecte.
- Faites passer les travailleurs et les convoyeurs par les ouvertures réelles.
- Bloquez toute la lisière avec une crête visible et une limite physique alignée.

## Croquis

```text
                         NORD

                         SORTIE
                            │
                 ┌────── NOYAU ────── OUVRIERS ── BOIS D
        CLIENTS ─ COMPTOIR    │       │
                 └────────────┼── INDUSTRIE ───── BOIS C
                              │
                         CONVOI ───── BOIS B
                              ╲
                              BOIS A
                         SUD
```

## Implantation

Les coordonnées utilisent le plan `(x, z)`. Le nord correspond à `z` négatif.

| Élément            | Étape | Position d’interaction |        Emprise |
| ------------------ | ----: | ---------------------: | -------------: |
| Clairière initiale |     0 |               `(0, 0)` | rayon `3,45 m` |
| Noyau du camp      |     1 |               `(0, 2)` |  `8,6 × 8,6 m` |
| Aile du marché     |     2 |          `(-5,7, 2,5)` |  `4,2 × 4,8 m` |
| Aile industrielle  |     4 |            `(5,4, -2)` |    `4,2 × 6 m` |
| Aile des ouvriers  |     6 |           `(5,5, 6,5)` |  `6,5 × 3,8 m` |
| Quai du convoi     |     6 |            `(0, -5,5)` |    `6 × 4,4 m` |
| Aile de sortie     |     7 |             `(0, 8,5)` |    `5 × 5,4 m` |

## Parcelles forestières

La carte plante une grille procédurale dense dans la zone jouable et la forêt distante.

La forêt distante reste visible derrière la crête. Le joueur ne peut pas l’atteindre, même après avoir abattu les arbres proches.

La clairière initiale reste vide avant la construction du camp.

Chaque étape défriche son emprise, une marge de cime et son sentier extérieur.

| Parcelle |       Centre | Fonction                        |
| -------- | -----------: | ------------------------------- |
| A        |   `(-23, 2)` | Récolte initiale et vente.      |
| B        | `(-18, -18)` | Réserve manuelle et repousse.   |
| C        |  `(20, -18)` | Récolte des ouvriers.           |
| D        |   `(24, 10)` | Extension et dépôt automatique. |

## Routes

Chaque sentier commence sur une porte ou sur le comptoir.

Une extrémité arrondie recouvre le raccord entre le sentier et la cour.

Le sentier des clients reste hors de l’enceinte et rejoint le comptoir intégré au mur.

## Cibles de déplacement

À cinq mètres par seconde, un trajet utile dure entre deux et cinq secondes.

- Le premier arbre se trouve à environ trois secondes du départ.
- Un bosquet se trouve à deux ou trois secondes de son dépôt naturel.
- Le marché et la scierie restent séparés par environ douze mètres.
- Le dépôt des ouvriers reste à environ deux secondes de la scierie.
- La sortie des planches reste à environ deux secondes du monument.

## Progression visuelle

1. Construisez le noyau et sa porte forestière.
2. Ajoutez l’aile du marché et intégrez le comptoir au mur.
3. Installez le râtelier des haches dans le noyau.
4. Ajoutez l’aile industrielle, la scierie et sa porte.
5. Installez le poste d’automatisation.
6. Ajoutez l’aile des ouvriers et le quai du convoi.
7. Ajoutez l’aile de sortie et ouvrez la dernière porte.

## Références

Little Farm Story sert de référence pour le découpage en parcelles, les routes et les cours de production.

Slopfarm conserve ses outils orbitaux, ses ressources physiques et sa machine monumentale. Il ne copie pas les bâtiments ni les personnages de la référence.
