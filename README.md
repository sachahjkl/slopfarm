# Slopfarm

Slopfarm transforme la boucle impossible des publicités mobiles en vrai jeu WebGPU.

Le prototype contient déjà une île, un personnage, des arbres, une récolte et une caméra pseudo-isométrique.

## Démarrage

```sh
nix develop
pnpm install
pnpm dev
```

Ouvre ensuite l’adresse affichée par Vite. Utilise `ZQSD`, `WASD` ou les flèches pour marcher. Maintiens `Espace` près d’un arbre.

Ouvre `/viewer.html` pour inspecter un fichier GLB et préparer un retour de retouche reproductible.

En développement, le panneau de mise au point fournit trois états jouables, des vues cadrées et des métriques lisibles.

Utilise ces URL pour ouvrir directement un état reproductible :

- `/?debugPreset=early`
- `/?debugPreset=mid&debugZoom=1.55`
- `/?debugPreset=final&debugZoom=2.15`

## Commandes

| Commande          | Fonction                                   |
| ----------------- | ------------------------------------------ |
| `pnpm dev`        | Lance le serveur local.                    |
| `pnpm build`      | Vérifie TypeScript et produit `dist/`.     |
| `pnpm test`       | Exécute les tests.                         |
| `pnpm lint`       | Analyse le code.                           |
| `pnpm format`     | Formate les fichiers.                      |
| `nix flake check` | Exécute tous les contrôles reproductibles. |
| `nix build`       | Produit le site statique dans `result/`.   |

## Documents

- [Spécification produit validée](docs/product-spec.md)
- [Vision et boucle de jeu](docs/gameplay.md)
- [Architecture et plan d’implémentation](docs/implementation.md)
- [Pipeline des modèles 3D](docs/art-pipeline.md)
- [Références visuelles](docs/visual-reference.md)
- [Plan de la forêt](docs/forest-map-plan.md)
- [Outils de développement](tools/README.md)
- [Outils de développement](docs/development-tools.md)
- [Feuille de route](docs/roadmap.md)
