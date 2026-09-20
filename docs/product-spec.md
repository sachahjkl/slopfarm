# Spécification produit

## Produit

Slopfarm est un jeu Web solo de récolte et d’amélioration. Il transforme la boucle montrée dans les publicités mobiles en jeu complet.

Le jeu complet vise deux heures. Il fonctionne sur ordinateur et Android, en paysage et en portrait.

La distribution prend la forme d’une PWA hors ligne. Chrome, Edge et Firefox récents constituent les navigateurs obligatoires.

WebGPU fournit le rendu principal. Un fallback WebGL réduit les effets sur les appareils incompatibles.

## Expérience

Le joueur déplace directement un aventurier ouvrier. Les outils orbitaux frappent automatiquement les cibles proches.

La boucle privilégie la récolte et les améliorations. La base, les travailleurs et les convoyeurs automatisent progressivement les trajets.

Le jeu ne contient aucune perte punitive. Les créatures repoussent brièvement le joueur sans retirer sa cargaison.

L’optimisation des distances, capacités et débits fournit la difficulté. Aucun système ne produit pendant la fermeture du jeu.

## Progression

La carte continue utilise une base centrale et trois anneaux progressifs.

1. La forêt dure environ 15 minutes.
2. La carrière dure environ 30 minutes.
3. La zone alimentaire dure environ 45 minutes.
4. La construction finale dure environ 30 minutes.

Une infrastructure visible ouvre chaque anneau. Les entrées bloquées annoncent les biomes futurs.

## Ressources et production

La forêt produit du bois et des planches. La carrière produit du minerai et des lingots.

La zone alimentaire produit deux familles distinctes :

- les épis deviennent du pain ;
- les animaux et poissons deviennent des grillades.

Le joueur choisit physiquement entre vente et transformation. Chaque destination possède sa propre zone de dépôt.

Une zone aspire uniquement les ressources compatibles, objet par objet. Les ressources forment une pile visible sur l’établi de réception.

Les ressources proches au sol s’agrègent dans une pile logique unique. La pile conserve sa quantité exacte et limite le nombre d’entités simulées.

Une destination pleine ne consomme jamais sa livraison. Le convoyeur dépose le surplus dans une pile physique adjacente et récupérable.

La campagne ne se termine jamais à distance. Quand tous les prérequis sont prêts, le joueur retourne au monument pour l’activer.

L’activation déclenche une seule célébration de six secondes. Elle combine faisceau, onde au sol, salves hautes et feedback sonore.

La vente produit une pile de pièces sur le comptoir. Le joueur collecte ensuite cette pile.

Les pièces améliorent le personnage et les travailleurs. Les produits transformés construisent les infrastructures et le monument.

## Cargaison

Chaque famille de ressource possède une colonne sur le sac du personnage.

La capacité logique reste illimitée. La hauteur visible possède une limite pour protéger la lisibilité et les performances.

Après cette limite, chaque collecte produit encore un effet visible et met à jour le compteur exact.

Les objets hors caméra utilisent le culling du moteur. Les objets visibles utilisent l’instanciation.

## Outil universel

Le joueur commence avec deux haches orbitales. Les outils frappent le bois, le minerai, les cultures et les créatures.

Les sons, traînées et impacts changent selon la matière touchée. L’outil conserve ainsi une interface de gameplay unique.

La progression se déroule dans une seule forêt persistante. Elle ne réinitialise jamais la base ni les ressources du joueur.

La forêt utilise des haches simples, puis des doubles haches renforcées. Les premières améliorations ajoutent des outils.

Les transformations suivantes privilégient la qualité, la vitesse, la taille, les dégâts et les effets.

## Ressources vivantes

Les arbres, filons et cultures montrent leur repousse pendant 20 à 45 secondes. Le chronomètre continue hors écran.

Les animaux résistent à plusieurs impacts et repoussent brièvement le joueur. Leur disparition produit un nuage sans violence explicite.

Les animaux donnent des cuisses de poulet exagérées. Les poissons rejoignent la même colonne de protéines.

Le joueur récolte les bancs de poissons avec un filet orbital.

## Automatisation

Chaque chaîne progresse séparément par quatre paliers.

1. Le joueur récolte et transporte tout.
2. Les travailleurs récoltent et déposent une pile statique.
3. Les travailleurs déposent les ressources sur un convoyeur prédéfini.
4. La production et la livraison deviennent automatiques.

Une chaîne montre jusqu’à dix agents réels simplifiés. Chaque agent choisit une cible, récolte, porte et dépose.

Les zones d’embauche utilisent des pièces. Les zones de construction aspirent progressivement leurs matériaux et conservent les paiements partiels.

## Base et monument

Les ateliers gagnent taille, animation, stockage et personnel à chaque palier. Quais, lampes, machines et ouvriers densifient aussi la base.

La base devient une industrie forestière lumineuse. Elle ne prend jamais la forme d’un village sombre ou médiéval.

Chaque palier repousse visiblement la forêt. Le sol passe de la clairière brute à des cours organisées, puis à un complexe automatisé.

Les ressources entrent par des portes forestières contrôlées. Une épine logistique relie collecte, tri, stockage, transformation et vente.

La façade commerciale ajoute progressivement des échoppes spécialisées. Les convoyeurs et trappes arrière les réapprovisionnent automatiquement.

Les ouvriers restent nombreux et visibles. Ils collectent, chargent, trient, transfèrent, entretiennent et réapprovisionnent les postes de vente.

La base peut déplacer, remplacer ou supprimer un ancien poste pendant une transformation. La disposition ne doit pas figer les premières étapes.

Les nouvelles ailes ajoutent des boutiques et des sources de revenus. Le bois brut, les planches et les produits animaux alimentent des marchés distincts.

Des ours attaquent trois voies depuis la forêt. Le joueur les repousse avec ses outils et vend leur viande à la boucherie.

Les attaques ne détruisent aucun bâtiment. Elles interrompent temporairement le marché, la scierie ou le travail forestier selon la voie.

Chaque vague suit cinq phases : calme, alerte de voie, attaque bornée, résolution et récupération.

L’alerte désigne la voie avant l’arrivée des ours. La vague suivante commence uniquement après la résolution de la vague active.

Chaque palier de défense construit une tourelle sur une nouvelle voie. Chaque tourelle exige des ventes de viande, des planches et des pièces.

La progression alterne les seuils de boucherie et de défense. Elle utilise successivement 6, 8, 18, 24 et 36 viandes vendues.

La boucherie possède trois paliers. La viande vendue débloque un palier, puis les planches construisent son équipement.

Chaque palier de boucherie augmente le prix de la viande.

Le joueur choisit entre vendre la viande et préparer des rations. Les ventes financent la défense. Les rations améliorent les travailleurs.

Chaque palier de ration exige un palier de boucherie. Les rations augmentent la vitesse et la capacité des travailleurs.

Chaque palier de défense augmente la fréquence des attaques, leur résistance et leur rendement en viande.

La boucle animale suit cet ordre :

1. Une alerte désigne une voie.
2. Une vague bornée arrive depuis la forêt distante.
3. Les animaux avancent vers la base et jouent une animation d’attaque.
4. Les haches et les tourelles réduisent leur santé.
5. Chaque animal éliminé laisse tomber de la viande physique.
6. Le joueur vend la viande ou prépare des rations.
7. Les ventes, les planches et les pièces construisent une nouvelle tourelle.
8. Les rations améliorent les travailleurs.
9. La nouvelle tourelle protège une voie supplémentaire et attire une vague plus rentable.

Le monument final est une machine géante construite par étapes. Chaque étape fournit un bonus global visible.

L’activation finale exige le monument, la boucherie, les rations et la défense au niveau maximal. Elle ouvre ensuite le mode libre.

## Présentation

La direction visuelle est cartoon organique. Elle utilise des formes douces, des textures peintes et des proportions exagérées.

Les particules, traînées, secousses et flashes restent riches. Un budget dynamique retire les effets les moins importants pendant les pics.

La musique gagne des couches avec la progression. Les impacts, collectes et achats possèdent des sons et vibrations réglables.

Le tutoriel évite le texte. Des bulles de pictogrammes, balises lumineuses et jauges visuelles indiquent les actions.

La caméra pseudo-isométrique reste fixe. Son zoom conserve une surface de jeu comparable dans chaque orientation.

## Sauvegarde et diagnostic

La sauvegarde locale est continue. Le joueur peut l’exporter et l’importer en JSON.

Un reset exige une confirmation explicite. Le jeu ne transmet aucune télémétrie distante.

Le journal local exportable contient les performances, événements et erreurs. Un replay contient la graine et les commandes.

La simulation déterministe à pas fixe doit reproduire le replay sur toutes les machines prises en charge.

Le développement inclut les outils suivants :

- inspecteur d’état ;
- files de commandes et d’événements ;
- réglages de contenu ;
- éditeur de sauvegarde ;
- capture de replay ;
- métriques du rendu ;
- Model Lab avec annotations 3D.

Le build public retire ces outils. `pnpm dev` les conserve.

## Pipeline artistique

Le premier jalon utilise des modèles définitifs. Blender CLI produit et valide les fichiers reproductibles.

GPT-6 Astra `xhigh` peut piloter les tâches Blender bornées. L’ajout d’un MCP Blender reste reporté.

Les modèles entrent immédiatement dans le jeu. Le Model Lab permet ensuite les annotations et retouches sans bloquer l’intégration.

## Premier jalon publiable

Le premier jalon livre la forêt complète avec une cible de 15 minutes.

Il comprend :

- les six améliorations d’outil et deux formes d’outil ;
- le bois, les planches, la vente et les pièces physiques ;
- les quatre paliers d’automatisation ;
- jusqu’à dix travailleurs ;
- les attaques visuelles d’ours et les ressources de viande ;
- la boucherie et trois paliers de tourelles ;
- les convoyeurs prédéfinis ;
- trois étapes du monument ;
- la sauvegarde, le replay et la suite de debug ;
- les contrôles clavier et tactiles ;
- les deux orientations mobiles ;
- le son, la vibration et les options essentielles ;
- la PWA hors ligne et le fallback WebGL ;
- les modèles cartoon organiques définitifs.

Effect n’entre pas dans la simulation synchrone. Il peut entrer aux seams asynchrones seulement après un besoin mesuré.
