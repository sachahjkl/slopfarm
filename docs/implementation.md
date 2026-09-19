# Architecture et plan d’implémentation

## Choix techniques

- TypeScript porte la logique et les contrats.
- Three.js fournit WebGPU, le graphe de scène, glTF et l’instanciation.
- Vite fournit le serveur et le paquet de production.
- Vitest teste l’économie et les systèmes sans navigateur.
- pnpm verrouille les dépendances.
- Nix verrouille les outils et exécute les contrôles.

WebGPU est la cible principale. Un rendu WebGL peut arriver après le premier test sur appareils réels.

## Modules prévus

```text
src/
  app/             assemblage, boucle et sauvegarde
  game/            état, commandes et événements
  economy/         prix, vente et améliorations
  world/           biomes, ressources et réapparition
  actors/          joueur, ennemis et employés
  presentation/    Three.js, effets, son et interface
  assets/          catalogue glTF et chargement
```

La logique de jeu ne dépend pas de Three.js. Le rendu lit des instantanés et consomme des événements visuels.

## Modèle d’exécution

La simulation utilise un pas fixe de 60 Hz. Le rendu interpole les transformations.

Les commandes décrivent les intentions du joueur. Les systèmes produisent des événements comme `tree.hit`, `loot.collected` et `upgrade.bought`.

Les effets consomment ces événements. Ils ne modifient jamais l’économie.

## Performance mobile

Le budget initial vise 60 images par seconde sur un appareil Android moyen récent.

- Limite les appels de dessin à 100 dans le premier biome.
- Utilise `InstancedMesh` pour les arbres, les ressources et les pièces.
- Regroupe les textures dans deux atlas au maximum par biome.
- Limite les lumières dynamiques à une lumière directionnelle.
- Utilise des ombres simples ou des ombres projetées pour les petits objets.
- Réutilise les particules et les objets ramassables.
- Charge un biome actif et un anneau voisin.

Le prototype actuel privilégie la lisibilité. L’instanciation arrive avant l’augmentation du nombre d’objets.

## Sauvegarde

La première version écrit une sauvegarde versionnée dans IndexedDB.

La sauvegarde contient les améliorations, les monnaies et les zones ouvertes. Elle ne contient pas les objets visuels temporaires.

Une graine et des compteurs permettent de reconstruire le monde.

## Déploiement

`pnpm build` produit un site statique. `nix build` produit le même site dans le magasin Nix.

Un hébergeur statique avec HTTPS suffit. WebGPU exige un contexte sécurisé hors de `localhost`.

## Contrôles

`nix flake check` construit le jeu et exécute le formatage, le lint, les tests et les hooks.

Les tests navigateur futurs utiliseront Playwright. Ils couvriront le démarrage WebGPU et une boucle récolte-vente-amélioration.
