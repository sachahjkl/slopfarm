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
- [Outils de développement](docs/development-tools.md)
- [Feuille de route](docs/roadmap.md)
