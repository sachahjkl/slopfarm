# Modèles du jalon forêt

Le catalogue contient 30 modèles GLB. Blender produit leurs maillages, leur atlas peint et leurs animations.

## Génération

Exécute le pipeline depuis la racine du dépôt.

```sh
nix develop .#assets --command bash scripts/blender/pipeline.sh --verify-reproducible
```

Le pipeline génère les fichiers dans `assets/forest`. Il réimporte chaque GLB pour contrôler le résultat.

L’option `--verify-reproducible` effectue deux générations indépendantes. Elle compare les 30 GLB, l’atlas et le manifeste octet par octet.

Le pipeline impose un seul thread Blender. Il trie les indices des triangles avant de calculer les empreintes.

Blender `5.1.1` fournit le générateur et le validateur de cette livraison.

## Fichiers

| Fichier                         | Rôle                                                                                |
| ------------------------------- | ----------------------------------------------------------------------------------- |
| `forest/*.glb`                  | Modèles intégrables dans le jeu.                                                    |
| `forest/forest-atlas.png`       | Atlas partagé de 1024 × 1024 pixels.                                                |
| `forest/manifest.json`          | Catalogue, dimensions, budgets, animations, points d’attache et empreintes SHA-256. |
| `forest/validation-report.json` | Résultats du dernier contrôle.                                                      |
| `forest/contact-sheet.png`      | Planche de contrôle des silhouettes et des couleurs.                                |
| `forest/previews/*.png`         | Vues individuelles des GLB réimportés.                                              |
| `sources.json`                  | Origine des sources et brief de génération.                                         |

## Catalogue

| Famille      | Fichiers                                                           | Usage                                                           |
| ------------ | ------------------------------------------------------------------ | --------------------------------------------------------------- |
| Aventurier   | `adventurer.glb`, `adventurer-coral.glb`, `adventurer-leaf.glb`    | Personnage avec grand sac, rouleau et deux points de cargaison. |
| Ouvrier      | `worker.glb`, `worker-coral.glb`, `worker-leaf.glb`                | Ouvrier avec casque et petit sac.                               |
| Outils       | `axe-simple.glb`, `axe-reinforced-double.glb`                      | Deux formes d’outil orbital.                                    |
| Arbres       | `tree-01.glb` à `tree-05.glb`                                      | Cinq silhouettes adultes.                                       |
| Repousse     | `tree-stump.glb`, `tree-regrowth.glb`                              | Souche et jeune pousse.                                         |
| Ressources   | `log.glb`, `plank.glb`, `coin.glb`                                 | Objets empilables et instanciables.                             |
| Vente        | `sale-bench.glb`                                                   | Établi avec réception et plateau de pièces.                     |
| Scierie      | `sawmill-tier-1.glb` à `sawmill-tier-4.glb`                        | Quatre paliers avec scie animée.                                |
| Convoyeurs   | `conveyor-straight.glb`, `conveyor-corner.glb`, `conveyor-end.glb` | Modules droit, angle droit et réception.                        |
| Amélioration | `upgrade-zone.glb`                                                 | Zone avec flèche et balises.                                    |
| Monument     | `monument-stage-1.glb` à `monument-stage-3.glb`                    | Fondation, transmission, puis réacteur et balise.               |

## Direction visuelle

Les personnages utilisent des têtes larges, des mains arrondies et des vêtements épais. Les arbres utilisent des troncs courbes et des feuillages asymétriques.

La palette sépare les fonctions : bois brun, produits clairs, structures turquoise, améliorations dorées et réacteurs corail.

Un seul matériau opaque couvre chaque modèle. Sa rugosité vaut `0.86` et sa métallicité vaut `0`.

L’atlas contient seize teintes avec des variations peintes. Chaque GLB intègre le même PNG pour rester autonome.

Le générateur fusionne les pièces statiques avant l’export. Les scies et les volants restent séparés pour leur animation.

## Repères et intégration

- Les dimensions du manifeste suivent l’ordre `[X, Y, Z]`, en mètres.
- Le sol correspond à `Y = 0` dans glTF.
- L’avant correspond à `+Z` dans glTF.
- Blender travaille avec `Z` vertical et l’avant vers `-Y` avant conversion glTF.
- Chaque racine porte le nom du fichier sans extension.
- Les personnages ont leur origine entre les pieds.
- Les objets statiques ont leur origine au centre de leur emprise, au sol.
- Les points d’attache du manifeste utilisent les coordonnées locales de cette racine.

Utilise `cargo-wood` et `cargo-plank` pour les colonnes du sac. Ces points suivent l’os `body`.

Utilise `grip` pour placer une hache dans une main. Utilise `impact` pour placer ses effets de contact.

Aligne les points `regrowth` pour remplacer un arbre par sa souche ou sa jeune pousse. Cette opération conserve la position du tronc.

Aligne le point `output` du convoyeur précédent avec le point `input` du module suivant. Applique une rotation de 90 degrés aux angles.

Le rouleau supérieur des convoyeurs se trouve à environ `0.62 m`. Les points de connexion fournissent la hauteur exacte utilisée par le transport.

Utilise des instances pour les bûches, les planches et les pièces. Le manifeste fournit six rotations autour de `Y`.

Partage le matériau et la texture entre les instances chargées. Les GLB autonomes intègrent chacun une copie de l’atlas.

## Animations

Les six personnages partagent un squelette de sept os. Chaque personnage fournit `idle`, `walk`, `attack`, `hit` et `death`.

`idle` et `walk` bouclent sur une seconde. `attack`, `hit` et `death` durent une seconde et s’utilisent en lecture unique.

`death` montre une chute sans violence. Le gameplay actuel conserve le personnage et utilise surtout `hit` pour les impacts.

Les scies fournissent une boucle `idle` d’une seconde. Les volants du monument fournissent une boucle `idle` de quatre secondes.

Les arbres possèdent trois états géométriques. Le moteur règle la durée de repousse entre 20 et 45 secondes.

## Budgets

| Famille            | Limite de triangles | Limite de texture |
| ------------------ | ------------------: | ----------------: |
| Personnage         |               8 000 |             1024² |
| Arbre et repousse  |               1 500 |             1024² |
| Outil              |               1 500 |             1024² |
| Objet empilé       |                 200 |             1024² |
| Bâtiment et module |              12 000 |             2048² |

Le manifeste contient les dimensions et les comptes mesurés de chaque export. Le budget des outils complète les catégories du document artistique.

## Validation seule

Exécute le validateur dans l’environnement Blender.

```sh
blender --background --factory-startup --threads 1 --python-exit-code 1 \
  --python scripts/blender/validate_forest.py
```

Le validateur contrôle la structure GLB, les données intégrées, les triangles, les normales, les UV et les matériaux.

Il contrôle aussi les dimensions, les origines, les points d’attache, le squelette, les animations et leur fermeture.

Il réimporte chaque fichier dans Blender. Une erreur produit un code de sortie non nul.

`scripts/blender/check.nix` fournit une dérivation de contrôle pour le flake. Elle compare une génération neuve aux exports livrés.

Expose cette dérivation dans `checks` pour intégrer ce contrôle à `nix flake check`.

```nix
assets = import ./scripts/blender/check.nix {
  inherit pkgs;
  src = inputs.self;
};
```

## Contrôle visuel

Produis les vues depuis les GLB exportés.

```sh
blender --background --factory-startup --threads 4 --python-exit-code 1 \
  --python scripts/blender/render_forest.py
```

La planche normalise les tailles pour comparer les silhouettes. Le manifeste conserve les dimensions réelles.

Ouvre les GLB dans le Model Lab pour vérifier leur échelle dans la scène du jeu.
