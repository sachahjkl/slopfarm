# Direction artistique de l’interface et du terrain

## Kit livré

Le kit contient cinq textures raccordables, quatorze pictogrammes et deux marques au sol. Les dessins SVG sont originaux et autonomes.

Le manifeste décrit les fichiers, leurs dimensions, leurs couleurs et leurs réglages. Les chemins artistiques sont relatifs à `public/art/`.

Le champ `direction` désigne ce document depuis la racine du dépôt.

- [Manifeste](../public/art/manifest.json).
- [Planche de présentation](../public/art/preview.html), accessible à `/art/preview.html` avec Vite.
- [Police Figtree](../public/art/fonts/figtree-variable.ttf).
- [Licence de la police](../public/art/fonts/OFL.txt).

La planche montre une composition 2D. Elle ne représente pas une capture du jeu.

## Sources visuelles et choix

L’inspection couvre `docs/visual-reference.md`, `src/presentation/game-view.ts`, `src/style.css` et `docs/forest-map-plan.md`.

La planche `assets/forest/contact-sheet.png` montre des volumes gonflés, des matières mates et des machines turquoise. Le kit reprend ces propriétés.

L’atlas `assets/forest/forest-atlas.png` fournit les familles de couleurs. Les pictogrammes augmentent leur contraste pour rester lisibles en petite taille.

Les références externes orientent la composition. Aucun fragment de ces images n’entre dans les fichiers livrés.

Le rendu suit trois niveaux de contraste :

1. Les ressources, les titres et les pictogrammes ont des contours sombres francs.
2. Les bâtiments utilisent de grandes masses colorées et des arêtes arrondies.
3. Le terrain utilise des touches larges, peu contrastées et sans contour noir.

Gardez les outils orbitaux visibles autour du personnage. Placez les effets de collecte derrière leur silhouette.

## Palette

| Rôle               | Couleur   | Usage principal                       |
| ------------------ | --------- | ------------------------------------- |
| Contour            | `#30271e` | Texte, silhouette, séparation.        |
| Crème              | `#fff4d6` | Texte, liseré, flèche.                |
| Bois               | `#a9683f` | Écorce et manche.                     |
| Planche            | `#edc483` | Bois coupé.                           |
| Pièce              | `#f6cc55` | Monnaie et dépôt actif.               |
| Acier              | `#9bc1bd` | Hache et lame.                        |
| Turquoise          | `#398f91` | Machines et vêtements.                |
| Ouvrier            | `#e8a265` | Accent du service d’embauche.         |
| Automatisation     | `#ac89ce` | Accent de la chaîne.                  |
| Monument           | `#78c693` | Construction et réussite.             |
| Corail             | `#dc8162` | Réservoir de la machine monumentale.  |
| Herbe              | `#87bd61` | Terrain ouvert et brins clairs.       |
| Humus forestier    | `#4f713d` | Feuilles, brindilles et terre sombre. |
| Terre battue       | `#bc9662` | Cours, pierres et traces d’usure.     |
| Sentier            | `#e5c77f` | Ornières claires de circulation.      |
| Bordure du sentier | `#806746` | Terre sombre et touffes végétales.    |

Le couple crème / contour offre un contraste mesuré de 13,36:1 en sRGB. Le contour sépare le texte du décor variable.

Associez chaque couleur de service à son pictogramme. Gardez le cadenas et la coche pour distinguer les états.

## Police

### Choix et provenance

Figtree est une sans sérif géométrique d’Erik Kennedy. Ses formes ouvertes et ses graisses épaisses conviennent aux titres courts et aux nombres.

Le dépôt officiel n’est pas archivé. Son dernier envoi déclaré date du 4 avril 2025, lors de la vérification du 19 septembre 2026.

Google Fonts distribue la famille avec les sous-ensembles latin et latin étendu. Une famille unique réduit les chargements et les variations de mesure.

- Page officielle : <https://www.erikdkennedy.com/projects/figtree.html>.
- Sources officielles : <https://github.com/erikdkennedy/figtree>.
- Distribution : <https://fonts.google.com/specimen/Figtree>.
- Métadonnées vérifiées : <https://github.com/google/fonts/blob/main/ofl/figtree/METADATA.pb>.
- Révision distribuée : `032dfa7fe219ef3a02890d6d3add84eacc9aebfe`.
- Licence : SIL Open Font License 1.1, fournie dans `public/art/fonts/OFL.txt`.

Le fichier livré vient directement du dépôt officiel, à cette révision. Son contenu reste identique au fichier `fonts/variable/Figtree[wght].ttf`.

Le manifeste conserve l’URL exacte et le SHA-256. Le binaire pèse 62 712 octets et couvre les graisses normales 300 à 900.

### Graisses et tailles

Les tailles ci-dessous utilisent des pixels CSS visibles. Elles ne désignent pas les pixels internes d’une texture Canvas.

| Élément               | Graisse | Ordinateur | Android portrait | Android paysage |
| --------------------- | ------- | ---------- | ---------------- | --------------- |
| Titre d’un service    | 900     | 30 px      | 24 px            | 22 px           |
| Compteur de ressource | 900     | 24 px      | 22 px            | 20 px           |
| Objectif proche       | 800     | 20 px      | 18 px            | 18 px           |
| Niveau et coût        | 800     | 18 px      | 16 px            | 16 px           |
| Texte explicatif      | 600     | 16 px      | 16 px            | 16 px           |
| Libellé d’un réglage  | 700     | 16 px      | 16 px            | 16 px           |

- Réservez les capitales aux titres courts.
- Conservez les accents dans les capitales.
- Utilisez un interligne de 1,1 pour les titres.
- Utilisez un interligne de 1,4 pour les explications.
- Utilisez un espacement de `0.025em` pour les titres en capitales.
- Utilisez des chiffres tabulaires pour les compteurs.
- Gardez une taille minimale de 16 px pour une information nécessaire.
- Raccourcissez le libellé avant de réduire sa taille.
- N’étirez pas les lettres pour remplir une largeur.

### Chargement local

```css
@font-face {
  font-family: Figtree;
  src: url("/art/fonts/figtree-variable.ttf") format("truetype");
  font-style: normal;
  font-weight: 300 900;
  font-display: swap;
}

.floating-title {
  font-family: Figtree, sans-serif;
  font-synthesis: none;
  font-weight: 900;
  color: #fff4d6;
  paint-order: stroke fill;
  -webkit-text-stroke: 4px #30271e;
  text-shadow: 0 3px 0 #30271e;
}
```

Le trait CSS est centré sur le bord des lettres. Un trait de 4 px laisse environ 2 px visibles dehors après le remplissage.

Utilisez 5 px de trait pour les titres de 30 px. Utilisez 3 px pour les textes de 16 à 18 px.

Si le texte utilise Canvas, attendez `document.fonts.load('900 48px Figtree')` avant le premier dessin.

Appelez `strokeText` avant `fillText`. Utilisez `lineJoin = "round"`. Réglez la largeur du trait selon le facteur de rasterisation.

Si Vite utilise une sous-route, préfixez les URL avec `import.meta.env.BASE_URL`.

Incluez la police locale et les fichiers artistiques dans le cache hors ligne lors de leur intégration.

## Interface intradiégétique

Une indication intradiégétique reste liée à un lieu ou à un objet du monde. Le sol, la machine et son stock expliquent l’action.

### Composition d’un service

Le service proche utilise cet ordre vertical :

1. Le titre flotte au-dessus du lieu.
2. Le niveau apparaît sous le titre.
3. La recette montre une ressource, une flèche et son résultat.
4. Une courte ligne précise le coût ou l’attente.
5. La marque au sol indique le point de dépôt.

Exemple : **SCIERIE**, **NIV. 2 / 4**, bûche → planche, **3 bûches en attente**.

- Gardez le fond du titre transparent.
- Supprimez les grandes plaques derrière les compteurs et les recettes.
- Réservez les surfaces pleines aux dialogues ouverts volontairement.
- Alignez le centre de l’indication avec le dépôt physique.
- Placez l’indication au-dessus du stock, sans recouvrir sa silhouette.
- Gardez au moins 12 px entre deux indications projetées.
- Si deux indications se chevauchent, réduisez l’indication la plus éloignée à son pictogramme.
- Affichez une seule recette complète en portrait.
- Affichez au maximum deux recettes complètes en paysage.
- Gardez le centre de l’écran libre pour le personnage et ses outils.

Les compteurs persistants montrent seulement pièces, bûches et planches. Leurs nombres restent exacts.

Le titre du jeu appartient à l’accueil. La progression détaillée appartient au service concerné.

### États

| État               | Représentation                                         |
| ------------------ | ------------------------------------------------------ |
| Disponible         | Pictogramme coloré et coût courant.                    |
| Prérequis manquant | Pictogramme plus cadenas, avec le prérequis écrit.     |
| Paiement partiel   | Quantité déposée / quantité requise, puis pictogramme. |
| Terminé            | Pictogramme plus coche, puis libellé de réussite.      |
| Stock à collecter  | Ressources physiques dans la marque de collecte.       |

Ne remplacez pas le pictogramme verrouillé par une masse noire illisible. Superposez le cadenas au coin inférieur droit.

Réservez la coche à un état terminé. Ne l’utilisez pas pour une action seulement disponible.

### Pictogrammes

Les pictogrammes utilisent un carré transparent de 128 × 128 px. Le contour principal mesure généralement 7 ou 8 unités.

Le liseré crème dépasse le contour sombre d’environ 3 unités. Les traits intérieurs mesurent 5 à 7 unités.

Les dessins utilisent des aplats irréguliers et une touche claire. Ils ne dépendent ni des emoji système ni d’une police d’icônes.

| Fichier dans `public/art/icons/` | Fonction actuelle                                |
| -------------------------------- | ------------------------------------------------ |
| `wood.svg`                       | Bûche, clé `wood` des indications.               |
| `plank.svg`                      | Planche, clé `plank`.                            |
| `coin.svg`                       | Pièce, clé `coin`.                               |
| `tool.svg`                       | Hache, clé `tool`.                               |
| `worker.svg`                     | Ouvrier, clé `worker`.                           |
| `gear.svg`                       | Automatisation, clé `gear`.                      |
| `monument.svg`                   | Machine monumentale, clé `monument`.             |
| `sawmill.svg`                    | Repère de scierie.                               |
| `tree.svg`                       | Objectif de récolte.                             |
| `bag.svg`                        | Cargaison du personnage.                         |
| `arrow.svg`                      | Conversion ou destination.                       |
| `lock.svg`                       | Prérequis manquant.                              |
| `check.svg`                      | Construction ou amélioration terminée.           |
| `settings.svg`                   | Réglages, avec des curseurs distincts de `gear`. |

Utilisez 32 px pour les compteurs. Utilisez 48 à 56 px pour les recettes. Réservez 24 px aux indications secondaires.

Gardez les proportions carrées. Ajoutez un nom accessible aux boutons qui utilisent uniquement un pictogramme.

Si le texte adjacent donne déjà le sens, utilisez `alt=""` pour l’image décorative.

## Terrain

Les textures utilisent des tuiles opaques de 256 × 256 px. Chaque motif est recopié aux huit positions voisines dans le SVG.

Cette répétition raccorde les touches qui traversent un bord. Les motifs ne contiennent ni bruit animé ni filtre SVG.

| Fichier dans `public/art/textures/` | Emploi dans `createGround()`        |
| ----------------------------------- | ----------------------------------- |
| `grass.svg`                         | Dessus du terrain principal.        |
| `grove.svg`                         | Surfaces de `FOREST_AREAS`.         |
| `yard.svg`                          | Cours de `FOREST_YARDS`.            |
| `path.svg`                          | Ruban intérieur de `FOREST_PATHS`.  |
| `path-edge.svg`                     | Ruban de bordure de `FOREST_PATHS`. |

La densité cible vaut une tuile pour 4 × 4 mètres. La texture conserve des touches larges pour limiter le scintillement lointain.

- Chargez les textures comme couleurs sRGB.
- Utilisez `RepeatWrapping` sur les deux axes.
- Gardez `roughness = 1` et `metalness = 0`.
- Gardez la couleur du matériau à `#ffffff`.
- Activez les mipmaps et le filtrage linéaire.
- Limitez l’anisotropie à 4, selon la capacité du moteur.
- Utilisez des contours géométriques irréguliers pour les parcelles.
- Gardez les chemins continus à travers les jonctions.
- Évitez les détails noirs sur les surfaces de sol.

Les textures contiennent déjà leur couleur. Multiplier `grove.svg` par la couleur actuelle d’une parcelle assombrit deux fois le sol.

### Coordonnées de texture

Le dessus actuel du terrain mesure 80 × 80 mètres. Avec des UV normalisés, `repeat.set(20, 20)` donne une tuile de 4 mètres.

Les `ShapeGeometry` actuelles utilisent des coordonnées de forme en mètres. Pour ces surfaces, `repeat.set(0.25, 0.25)` donne la même densité.

Conservez une origine UV commune aux chemins, cours et parcelles. N’appliquez pas `repeat.set(20, 20)` aux UV métriques des formes.

### Marques au sol

| Fichier dans `public/art/decals/` | Usage                        |
| --------------------------------- | ---------------------------- |
| `deposit-ring.svg`                | Cercle or interrompu, dépôt. |
| `stock-ring.svg`                  | Cercle crème, collecte.      |

Les marques sont transparentes et non raccordables. Leur diamètre cible vaut 2,4 mètres.

Posez chaque marque sur un plan horizontal. Orientez la flèche du dépôt vers sa machine.

Placez le plan légèrement au-dessus du sol. Gardez `depthWrite = false` pour éviter une occlusion des objets.

Gardez les piles physiques au centre de la marque de collecte. Séparez cette marque de la zone de dépôt.

## Ordinateur et Android

| Contexte                    | Composition                                            |
| --------------------------- | ------------------------------------------------------ |
| Ordinateur, 1280 × 720      | Compteurs en haut à gauche, réglages en bas à droite.  |
| Android portrait, 360 × 800 | Trois compteurs compacts, une recette proche complète. |
| Android paysage, 800 × 360  | Compteurs sur une ligne, indications moins hautes.     |

- Réservez 16 px aux marges sur ordinateur.
- Réservez 12 px aux marges sur Android.
- Ajoutez les valeurs `env(safe-area-inset-*)` aux marges.
- Gardez une cible tactile minimale de 48 × 48 px.
- Gardez 8 px entre deux cibles tactiles.
- Réservez 120 × 120 px autour du contrôle de déplacement actif.
- Placez les réglages hors de cette zone tactile.
- Si la hauteur est inférieure à 500 px, utilisez les tailles Android paysage.
- Si la largeur est inférieure à 600 px, utilisez la composition portrait.
- Vérifiez les nombres à quatre chiffres dans les trois compteurs.
- Gardez les indications hors des trajectoires orbitales projetées.

Utilisez une animation de collecte de 120 à 180 ms. Limitez son agrandissement à 8 %.

Si la réduction des mouvements est active, gardez seulement le changement de couleur et de quantité.

## Points d’intégration

`drawServiceIcon()` peut utiliser les sept fichiers qui portent ses clés actuelles. Les images conservent leurs couleurs propres.

`drawServiceSign()` conserve les textes dynamiques. La police locale et les pictogrammes remplacent les dessins génériques dans sa texture transparente.

`createGround()` possède déjà les cinq emplacements correspondant aux textures. Les règles UV ci-dessus précisent leur remplacement.

Utilisez `TextureLoader.loadAsync()` pour les SVG de sol. Utilisez des images préchargées pour les dessins Canvas des indications.

Vite sert directement `public/art/icons/wood.svg` à `/art/icons/wood.svg`. Aucun import de dépendance supplémentaire n’est nécessaire.

## Contrôle de livraison

- Analysez tous les SVG comme XML.
- Vérifiez les dimensions et les références internes des SVG.
- Analysez le manifeste comme JSON.
- Vérifiez chaque chemin du manifeste.
- Vérifiez le SHA-256 de la police.
- Rasterisez les SVG pour détecter les erreurs de dessin.
- Vérifiez les tuiles sur au moins deux répétitions par axe.
- Ouvrez la planche en 1280 × 720, 360 × 800 et 800 × 360.
- Vérifiez le formatage du manifeste, de la planche et de ce document.

### Résultats du 19 septembre 2026

Les 21 SVG passent l’analyse XML et la rasterisation. Leurs dimensions, références internes et marges transparentes sont vérifiées.

Les cinq textures passent une comparaison de répétition 3 × 3. Le rendu continu et les neuf tuiles assemblées présentent zéro pixel différent.

Le manifeste passe l’analyse JSON. Vite sert les 25 fichiers publics du kit avec un statut HTTP 200.

La police passe la vérification SHA-256. Ses tables confirment les graisses 300 à 900, les accents français et les chiffres tabulaires.

Firefox sans interface produit les aperçus aux trois dimensions cibles. Ces contrôles utilisent Linux, sans appareil Android physique.

Le formatage et les hooks `prek` passent. Les six contrôles Nix `x86_64-linux` passent également.
