# Pipeline des modèles 3D

## Direction visuelle

Utilise des volumes simples, des silhouettes larges et des couleurs séparées par fonction.

La caméra réduit les détails. Consacre les polygones aux silhouettes, aux outils et aux améliorations visibles.

## Pipeline recommandé

1. Écris une fiche avec la taille, la silhouette, les variantes et les animations.
2. Génère une image de référence ou un modèle de départ.
3. Corrige la topologie, l’échelle et les pivots dans Blender.
4. Place les matériaux dans un atlas partagé par biome.
5. Crée les animations dans un seul squelette par famille.
6. Exporte en GLB avec les noms définis dans le catalogue.
7. Optimise le GLB avec glTF Transform.
8. Vérifie les limites automatiques avant intégration.

Entre dans l’environnement Blender avec `nix develop .#assets`.

## IA générative

Ne lie pas le pipeline à un nom de modèle non confirmé comme « GPT-6 Astra ».

Définis une interface d’entrée neutre : images, GLB ou maillage brut. Garde Blender comme étape de validation obligatoire.

Un modèle génératif peut produire le concept ou un blocage. Il ne fixe pas seul la topologie, les droits, les pivots ou les performances.

Conserve le prompt, le modèle, la date et la licence avec chaque source générée.

## Convention glTF

- Utilise les mètres et place le sol à `Y = 0`.
- Oriente l’avant vers `+Z`.
- Place l’origine des objets statiques au centre de leur base.
- Nomme les fichiers en `kebab-case`.
- Nomme les animations `idle`, `walk`, `attack`, `hit` et `death`.
- Utilise un matériau opaque quand la transparence n’est pas nécessaire.

## Budgets initiaux

| Ressource    | Triangles |     Texture |     Variantes |
| ------------ | --------: | ----------: | ------------: |
| Personnage   |     8 000 |       1024² |    3 couleurs |
| Ennemi       |     5 000 |        512² |    3 couleurs |
| Arbre        |     1 500 | atlas 1024² | 5 silhouettes |
| Bâtiment     |    12 000 | atlas 2048² |     3 niveaux |
| Objet empilé |       200 | atlas 1024² |   6 rotations |

Les objets empilés utilisent des instances. Les animations évitent les morph targets sauf besoin mesuré.
