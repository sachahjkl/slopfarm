import { describe, expect, it } from "vitest";
import { CAMPAIGN_STEPS, campaignCosts } from "./campaign";
import { GameSimulation, type TreeState } from "./simulation";
import type { Vector2, WorkerState } from "./model";
import { runReplay } from "./replay";
import {
  FOREST,
  MONUMENT_CONVEYOR_PATH,
  SALE_OUTPUT,
  SAWMILL_BUILDING,
  SAWMILL_OUTPUT,
  TURRET_BUILDINGS,
  WORKER_CONVEYOR_PATH,
  ZONES,
  zonePosition,
} from "./content";
import {
  FOREST_BOUNDARY,
  FOREST_FENCES,
  FOREST_PATHS,
  FOREST_TREE_POSITIONS,
  PLAYABLE_BOUNDARY,
  PROGRESSION_GATES,
  isPointCleared,
} from "./forest-map";

describe("GameSimulation", () => {
  it("normalise les commandes de déplacement", () => {
    const game = new GameSimulation();
    game.enqueue({ type: "movement.changed", direction: { x: 10, z: 0 } });
    game.advance(1 / 60);
    expect(game.state.player.position.x).toBeCloseTo(5 / 60);
  });

  it("accumule de l’élan sur les sentiers puis le perd hors mouvement", () => {
    const game = new GameSimulation();
    game.enqueue({ type: "movement.changed", direction: { x: 1, z: 0 } });
    advance(game, 0.5);
    expect(game.state.player.trailMomentum).toBe(0);

    const save = game.createSave();
    save.state.campaign.step = 1;
    save.state.player.position = { x: -10, z: 1.05 };
    game.restore(save);
    game.enqueue({ type: "movement.changed", direction: { x: -1, z: 0.7 } });
    for (let index = 0; index < 30; index += 1) game.advance(1 / 60);
    expect(game.state.player.trailMomentum).toBeGreaterThan(0.1);

    const before = { ...game.state.player.position };
    game.advance(1 / 60);
    expect(
      Math.hypot(
        game.state.player.position.x - before.x,
        game.state.player.position.z - before.z,
      ),
    ).toBeGreaterThan(FOREST.playerSpeed / 60);

    game.enqueue({ type: "movement.changed", direction: { x: 0, z: 0 } });
    for (let index = 0; index < 60; index += 1) game.advance(1 / 60);
    expect(game.state.player.trailMomentum).toBe(0);
  });

  it("centre toujours l’orbite des haches sur le personnage", () => {
    const game = new GameSimulation();
    const initialTool = { ...game.state.tool.positions[0]! };
    game.enqueue({ type: "movement.changed", direction: { x: 1, z: 0.4 } });
    advance(game, 2);
    const center = game.state.tool.positions.reduce(
      (result, position) => ({
        x: result.x + position.x / game.state.tool.positions.length,
        z: result.z + position.z / game.state.tool.positions.length,
      }),
      { x: 0, z: 0 },
    );
    expect(center.x).toBeCloseTo(game.state.player.position.x);
    expect(center.z).toBeCloseTo(game.state.player.position.z);
    expect(game.state.tool.positions[0]).not.toEqual(initialTool);
  });

  it("utilise la même implantation forestière pour toutes les parties", () => {
    const first = new GameSimulation(1);
    const second = new GameSimulation(999);
    expect(first.state.trees.map(({ position }) => position)).toEqual(
      second.state.trees.map(({ position }) => position),
    );
    expect(first.state.trees).toHaveLength(FOREST_TREE_POSITIONS.length);
  });

  it("garde tous les arbres dans la lisière organique", () => {
    const trees = new GameSimulation().state.trees;
    expect(
      trees.every(({ position }) => isInsidePolygon(position, FOREST_BOUNDARY)),
    ).toBe(true);
  });

  it("prolonge la forêt au-delà de la limite jouable", () => {
    const trees = new GameSimulation().state.trees;
    expect(
      trees.some(
        ({ position }) => !isInsidePolygon(position, PLAYABLE_BOUNDARY),
      ),
    ).toBe(true);
  });

  it("bloque le joueur sur la crête au bout des sentiers", () => {
    const game = new GameSimulation();
    const save = game.createSave();
    save.state.campaign.step = 7;
    save.state.player.position = { x: -2, z: 30 };
    for (const tree of save.state.trees) {
      tree.health = 0;
      tree.cleared = true;
    }
    game.restore(save);
    game.enqueue({ type: "movement.changed", direction: { x: 0, z: 1 } });
    advance(game, 2);
    expect(game.state.player.position.z).toBeLessThan(32.5);
  });

  it("fait passer les convoyeurs par les ouvertures des murs", () => {
    for (const path of [WORKER_CONVEYOR_PATH, MONUMENT_CONVEYOR_PATH]) {
      for (let index = 1; index < path.length; index += 1) {
        const from = path[index - 1]!;
        const to = path[index]!;
        for (let sample = 0; sample <= 20; sample += 1) {
          const amount = sample / 20;
          const point = {
            x: from.x + (to.x - from.x) * amount,
            z: from.z + (to.z - from.z) * amount,
          };
          const crossedWall = FOREST_FENCES.find(
            ({
              from: wallFrom,
              to: wallTo,
              width,
              minimumStep = 0,
              maximumStep = Infinity,
            }) =>
              6 >= minimumStep &&
              6 <= maximumStep &&
              segmentDistance(point, wallFrom, wallTo) < width + 0.36,
          );
          expect(
            crossedWall,
            `segment ${String(index)} sample ${String(sample)} at ${JSON.stringify(point)}`,
          ).toBeUndefined();
        }
      }
    }
  });

  it("forme une forêt trop dense pour passer entre tous les troncs", () => {
    const trees = new GameSimulation().state.trees;
    let minimum = Number.POSITIVE_INFINITY;
    for (let left = 0; left < trees.length; left += 1) {
      for (let right = left + 1; right < trees.length; right += 1) {
        const first = trees[left]!.position;
        const second = trees[right]!.position;
        minimum = Math.min(
          minimum,
          Math.hypot(first.x - second.x, first.z - second.z),
        );
      }
    }
    expect(minimum).toBeGreaterThan(1.1);
    expect(minimum).toBeLessThan(1.8);
  });

  it("défriche les sentiers uniquement après leur déverrouillage", () => {
    const game = new GameSimulation();
    expect(
      game.state.trees.some(({ position }) =>
        FOREST_PATHS.some((path) =>
          path.points
            .slice(1)
            .some(
              (point, index) =>
                pointSegmentDistance(position, path.points[index]!, point) <=
                path.width / 2 + 0.8,
            ),
        ),
      ),
    ).toBe(true);
    const save = game.createSave();
    save.state.campaign.step = CAMPAIGN_STEPS.defense;
    game.restore(save);
    const trees = game.state.trees.filter(({ health }) => health > 0);
    for (const path of FOREST_PATHS) {
      let minimumDistance = Number.POSITIVE_INFINITY;
      for (const tree of trees) {
        for (let index = 1; index < path.points.length; index += 1) {
          minimumDistance = Math.min(
            minimumDistance,
            pointSegmentDistance(
              tree.position,
              path.points[index - 1]!,
              path.points[index]!,
            ),
          );
        }
      }
      expect(minimumDistance).toBeGreaterThan(path.width / 2 + 0.79);
    }
  });

  it("place chaque spot de progression dans une emprise défrichée", () => {
    for (const [zone, step] of [
      ["sale", 1],
      ["sawmill", 3],
      ["automation", 4],
      ["worker", 5],
      ["monument", 6],
      ["departure", 7],
      ["butcher", 8],
      ["turret", 9],
    ] as const) {
      expect(isPointCleared(zonePosition(zone, step), step)).toBe(true);
    }
  });

  it("dégage les cimes autour des murs construits", () => {
    expect(isPointCleared({ x: 6.7, z: 0 }, 1)).toBe(true);
    expect(isPointCleared({ x: 7, z: 0 }, 1)).toBe(false);
  });

  it("limite chaque porte à la largeur d’un passage simple", () => {
    for (const gate of PROGRESSION_GATES)
      expect(
        Math.hypot(gate.to.x - gate.from.x, gate.to.z - gate.from.z),
      ).toBeCloseTo(1.8);
  });

  it("frappe plusieurs arbres avec plusieurs haches", () => {
    const game = new GameSimulation();
    const trees = axeTestTrees(game, 2);
    trees[0]!.position = { x: 1.623, z: 0.325 };
    trees[1]!.position = { x: -1.623, z: -0.325 };
    game.advance(1 / 60);
    expect(trees[0]!.health).toBe(FOREST.treeHealth - 1);
    expect(trees[1]!.health).toBe(FOREST.treeHealth - 1);
  });

  it("une tête de hache peut frapper plusieurs arbres", () => {
    const game = new GameSimulation();
    const trees = axeTestTrees(game, 3);
    trees[0]!.position = { x: 1.623, z: 0.1 };
    trees[1]!.position = { x: 1.623, z: 0.325 };
    trees[2]!.position = { x: 1.623, z: 0.55 };
    game.advance(1 / 60);
    expect(trees.map(({ health }) => health)).toEqual([
      FOREST.treeHealth - 1,
      FOREST.treeHealth - 1,
      FOREST.treeHealth - 1,
    ]);
  });

  it("frappe avec le manche et la lame entière", () => {
    const game = new GameSimulation();
    const trees = axeTestTrees(game, 2);
    trees[0]!.position = { x: 1.05, z: 0 };
    trees[1]!.position = { x: 1.623, z: 0.5 };
    game.advance(1 / 60);
    expect(trees[0]!.health).toBe(FOREST.treeHealth - 1);
    expect(trees[1]!.health).toBe(FOREST.treeHealth - 1);
  });

  it("ne frappe pas un arbre avec le centre du personnage", () => {
    const game = new GameSimulation();
    const save = game.createSave();
    save.state.trees[0]!.position = { ...save.state.player.position };
    game.restore(save);
    game.advance(1 / 60);
    expect(game.state.trees[0]!.health).toBe(FOREST.treeHealth);
  });

  it("bloque le joueur contre les bâtiments", () => {
    const game = new GameSimulation();
    const save = game.createSave();
    save.state.player.position = { x: -6, z: 2 };
    save.state.campaign.step = 2;
    game.restore(save);
    game.enqueue({ type: "movement.changed", direction: { x: -1, z: 0 } });
    advance(game, 1);
    expect(game.state.player.position.x).toBeGreaterThan(-6.9);
    expect(game.state.player.position.x).toBeLessThan(-6.8);
  });

  it("bloque le joueur contre les arbres debout", () => {
    const game = new GameSimulation();
    const tree = game.state.trees[0]!;
    const save = game.createSave();
    save.state.player.position = { x: tree.position.x - 2, z: tree.position.z };
    game.restore(save);
    game.enqueue({ type: "movement.changed", direction: { x: 1, z: 0 } });
    advance(game, 1);
    expect(game.state.player.position.x).toBeLessThan(tree.position.x);
    expect(
      Math.hypot(
        game.state.player.position.x - tree.position.x,
        game.state.player.position.z - tree.position.z,
      ),
    ).toBeGreaterThanOrEqual(0.89);
  });

  it("laisse le joueur sortir s’il se trouve dans un arbre", () => {
    const game = new GameSimulation();
    const tree = game.state.trees.find(
      ({ position }) => Math.abs(position.x) < 20 && Math.abs(position.z) < 20,
    )!;
    game.state.player.position = { ...tree.position };
    game.enqueue({ type: "movement.changed", direction: { x: 1, z: 0 } });
    for (let index = 0; index < 20; index += 1) game.advance(1 / 60);
    expect(
      Math.hypot(
        game.state.player.position.x - tree.position.x,
        game.state.player.position.z - tree.position.z,
      ),
    ).toBeGreaterThan(0.6);
  });

  it("retire le mur intérieur quand le quai du convoi apparaît", () => {
    const game = new GameSimulation();
    const save = game.createSave();
    save.state.campaign.step = 5;
    save.state.player.position = { x: 0, z: -2.5 };
    game.restore(save);
    game.enqueue({ type: "movement.changed", direction: { x: 0, z: -1 } });
    advance(game, 0.5);
    expect(game.state.player.position.z).toBeGreaterThan(-3.5);

    const unlocked = game.createSave();
    unlocked.state.campaign.step = 6;
    unlocked.state.player.position = { x: 0, z: -2.5 };
    game.restore(unlocked);
    game.enqueue({ type: "movement.changed", direction: { x: 0, z: -1 } });
    advance(game, 0.5);
    expect(game.state.player.position.z).toBeLessThan(-4.5);
  });

  it("laisse libre l’ancien collider surdimensionné de la scierie", () => {
    const game = new GameSimulation();
    const save = game.createSave();
    save.state.campaign.step = 4;
    save.state.player.position = { x: 3.4, z: -2.1 };
    game.restore(save);
    game.enqueue({ type: "movement.changed", direction: { x: 1, z: 0 } });
    advance(game, 0.12);
    expect(game.state.player.position.x).toBeGreaterThan(3.9);
  });

  it("laisse le joueur passer entre la scierie et la porte est", () => {
    const game = new GameSimulation();
    const save = game.createSave();
    save.state.campaign.step = 4;
    save.state.player.position = { x: 7, z: -0.8 };
    game.restore(save);
    game.enqueue({ type: "movement.changed", direction: { x: 1, z: 0 } });
    advance(game, 0.5);
    expect(game.state.player.position.x).toBeGreaterThan(8.7);
  });

  it("produit les planches sur le dépôt physique", () => {
    const game = new GameSimulation();
    game.state.sawmill.wood = 1;
    game.advance(1 / 60);
    const plank = game.state.pickups.find(({ kind }) => kind === "plank");
    expect(plank?.fixed).toBe(true);
    expect(plank?.position.x).toBeCloseTo(SAWMILL_OUTPUT.x);
    expect(plank?.position.z).toBeCloseTo(SAWMILL_OUTPUT.z, 1);
  });

  it("laisse le joueur atteindre le dépôt du chargement", () => {
    const game = new GameSimulation();
    const save = game.createSave();
    save.state.campaign.step = 6;
    save.state.player.position = { x: 0, z: -4.2 };
    game.restore(save);
    game.enqueue({ type: "movement.changed", direction: { x: 0, z: -1 } });
    advance(game, 0.35);
    expect(game.state.player.position.z).toBeLessThan(-5.5);
  });

  it("applique les améliorations dans l’ordre de la file", () => {
    const game = new GameSimulation();
    game.enqueue({ type: "tool.upgrade-requested" });
    game.enqueue({ type: "tool.upgrade-requested" });
    game.advance(1 / 60);
    expect(game.state.tool.level).toBe(3);
    expect(game.state.tool.positions).toHaveLength(4);
    expect(game.drainEvents()).toEqual([
      { type: "tool.upgraded", level: 2 },
      { type: "tool.upgraded", level: 3 },
    ]);
  });

  it("vide la file d’événements après lecture", () => {
    const game = new GameSimulation();
    game.enqueue({ type: "tool.upgrade-requested" });
    game.advance(1 / 60);
    expect(game.drainEvents()).toHaveLength(1);
    expect(game.drainEvents()).toEqual([]);
  });

  it("reproduit une simulation avec la même graine", () => {
    const first = new GameSimulation(42);
    const second = new GameSimulation(42);
    const command = {
      type: "movement.changed" as const,
      direction: { x: -1, z: -1 },
    };
    first.enqueue(command);
    second.enqueue(command);
    for (let index = 0; index < 600; index += 1) {
      first.advance(1 / 60);
      second.advance(1 / 60);
    }
    expect(second.state).toEqual(first.state);
    expect(second.drainEvents()).toEqual(first.drainEvents());
  });

  it("approvisionne un comptoir puis sert les clients dans l’ordre", () => {
    const game = gameAtZone("sale", { wood: 3, campaignStep: 2 });
    advance(game, 9);
    expect(game.state.inventory.wood).toBe(0);
    expect(game.state.inventory.coins).toBe(0);
    expect(game.state.campaign.customersServed).toBe(3);
    expect(
      game.state.pickups.filter(({ kind }) => kind === "coin"),
    ).toHaveLength(6);
    const coins = game.state.pickups.filter(({ kind }) => kind === "coin");
    expect(
      new Set(coins.map(({ position }) => position.x)).size,
    ).toBeGreaterThan(1);
    expect(
      coins.every(
        ({ position }) =>
          Math.abs(position.x - SALE_OUTPUT.x) <= 0.04 &&
          Math.abs(position.z - SALE_OUTPUT.z) <= 0.04,
      ),
    ).toBe(true);
    expect(coins.at(-1)!.position.y - coins[0]!.position.y).toBeGreaterThan(
      0.5,
    );
    const save = game.createSave();
    save.state.player.position = { ...SALE_OUTPUT };
    game.restore(save);
    advance(game, 1);
    expect(game.state.inventory.coins).toBe(6);
  });

  it("accélère exponentiellement la dépose continue", () => {
    const game = gameAtZone("sale", { wood: 100, campaignStep: 2 });
    advance(game, 0.5);
    const firstHalf = 100 - game.state.inventory.wood;
    advance(game, 0.5);
    const secondHalf = 100 - firstHalf - game.state.inventory.wood;
    expect(secondHalf).toBeGreaterThan(firstHalf);
    expect(game.state.campaign.marketStock).toBeGreaterThan(0);
  });

  it("restaure une sauvegarde", () => {
    const original = new GameSimulation(99);
    original.enqueue({ type: "debug.grant", coins: 12, wood: 7, planks: 4 });
    original.enqueue({ type: "tool.upgrade-requested" });
    original.advance(1 / 60);
    const restored = new GameSimulation(99);
    restored.enqueue({ type: "save.loaded", data: original.createSave() });
    restored.advance(1 / 60);
    expect(restored.state.inventory).toEqual({
      coins: 12,
      wood: 7,
      planks: 4,
      meat: 0,
    });
    restored.enqueue({ type: "tool.upgrade-requested" });
    restored.advance(1 / 60);
    expect(restored.state.tool.positions).toHaveLength(4);
  });

  it("attribue de nouveaux identifiants après le chargement", () => {
    const source = new GameSimulation(22);
    source.enqueue({ type: "debug.progress", worker: true });
    source.advance(1 / 60);
    const restored = new GameSimulation(22);
    restored.restore(source.createSave());
    restored.enqueue({ type: "debug.progress", worker: true });
    restored.advance(1 / 60);
    const ids = restored.state.workers.map(({ id }) => id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("conserve toujours la carte forestière canonique au chargement", () => {
    const game = new GameSimulation();
    const canonicalFirstTree = { ...game.state.trees[0]!.position };
    const save = game.createSave();
    save.state.trees = save.state.trees.slice(0, 96);
    save.state.trees[0]!.position = { x: 0, z: 0 };
    game.restore(save);
    expect(game.state.trees).toHaveLength(FOREST_TREE_POSITIONS.length);
    expect(game.state.trees[0]!.position).toEqual(canonicalFirstTree);
  });

  it("rejoue les commandes depuis l’état initial", () => {
    const game = new GameSimulation(7);
    game.enqueue({ type: "movement.changed", direction: { x: 1, z: 0 } });
    advance(game, 1);
    game.enqueue({ type: "movement.changed", direction: { x: 0, z: 0 } });
    game.advance(1 / 60);
    const replay = game.createReplay();
    const replayed = runReplay(replay, 61);
    expect(replayed.state.player).toEqual(game.state.player);
  });

  it("construit le premier palier d’automatisation", () => {
    const game = gameAtZone("automation", {
      planks: 20,
      campaignStep: 4,
    });
    advance(game, 2);
    expect(game.state.automationLevel).toBe(1);
    expect(game.state.inventory.planks).toBe(0);
  });

  it("débloque puis engage un travailleur", () => {
    const game = gameAtZone("worker", {
      coins: FOREST.workerCosts[0],
      automationLevel: 1,
      campaignStep: 5,
    });
    advance(game, 2);
    expect(game.state.workers).toHaveLength(1);
    expect(game.state.inventory.coins).toBe(0);
  });

  it("sépare les paiements des zones d’amélioration", () => {
    const game = gameAtZone("worker", {
      coins: 3,
      automationLevel: 1,
      campaignStep: 5,
    });
    advance(game, 1);
    expect(game.state.payments).toEqual({ toolCoins: 0, workerCoins: 3 });
  });

  it("fait livrer un travailleur par convoyeur", () => {
    const game = gameAtZone("worker", { automationLevel: 2 });
    game.enqueue({ type: "debug.progress", worker: true });
    game.advance(1 / 60);
    advance(game, 18);
    expect(
      game.state.conveyorItems.length +
        game.state.sawmill.wood +
        game.state.pickups.filter(({ kind }) => kind === "plank").length,
    ).toBeGreaterThan(0);
  });

  it("fait passer les travailleurs par les ouvertures des murs", () => {
    const game = gameAtZone("worker", {
      automationLevel: 2,
      campaignStep: 6,
    });
    game.enqueue({ type: "debug.progress", worker: true });
    game.advance(1 / 60);
    for (let frame = 0; frame < 20 * 60; frame += 1) {
      game.advance(1 / 60);
      for (const worker of game.state.workers) {
        const crossesWall = FOREST_FENCES.some(
          ({ from, to, width, minimumStep = 0, maximumStep = Infinity }) =>
            game.state.campaign.step >= minimumStep &&
            game.state.campaign.step <= maximumStep &&
            segmentDistance(worker.position, from, to) < width + 0.28,
        );
        expect(crossesWall).toBe(false);
      }
    }
  });

  it("charge le convoi puis ouvre la sortie", () => {
    const game = gameAtZone("monument", {
      planks: 35,
      campaignStep: 6,
    });
    advance(game, 3);
    expect(game.state.campaign.step).toBe(7);
    expect(game.state.campaign.exitPlanks).toBe(35);
  });

  it("ouvre l’extension animale sans réinitialiser la base", () => {
    const game = gameAtZone("departure", { campaignStep: 7 });
    const before = game.createSave().state;
    game.advance(1 / 60);
    expect(game.state.campaign.completed).toBe(false);
    expect(game.state.campaign.step).toBe(8);
    expect(game.state.tool.level).toBe(before.tool.level);
    expect(game.state.automationLevel).toBe(before.automationLevel);
    expect(game.state.workers).toHaveLength(before.workers.length);
  });

  it("ne déclenche aucune attaque avant l’ouverture de l’extension animale", () => {
    const game = new GameSimulation(22);
    const save = game.createSave();
    save.state.campaign.step = CAMPAIGN_STEPS.departure;
    game.restore(save);
    advance(game, FOREST.animalSpawnSeconds + 1);
    expect(game.state.animals).toHaveLength(0);
  });

  it("transforme un ours éliminé en viande physique", () => {
    const game = new GameSimulation(22);
    const save = game.createSave();
    save.state.campaign.step = CAMPAIGN_STEPS.wildlife;
    game.restore(save);
    game.enqueue({
      type: "debug.spawn-animal",
      position: { x: 1.2, z: 0 },
    });
    advance(game, 10);
    expect(game.state.animals).toHaveLength(0);
    expect(game.state.inventory.meat).toBe(FOREST.bearMeat);
  });

  it("laisse au joueur le temps de voir un ours avant sa défaite", () => {
    const game = new GameSimulation(22);
    const save = game.createSave();
    save.state.campaign.step = CAMPAIGN_STEPS.wildlife;
    save.state.tool.level = 6;
    game.restore(save);
    game.enqueue({
      type: "debug.spawn-animal",
      position: { x: 1.2, z: 0 },
    });
    advance(game, 1);
    expect(game.state.turret.level).toBe(0);
    expect(game.state.animals).toHaveLength(1);
  });

  it("repousse légèrement le joueur au contact d’un ours", () => {
    const game = new GameSimulation(22);
    const save = game.createSave();
    save.state.campaign.step = CAMPAIGN_STEPS.wildlife;
    game.restore(save);
    game.enqueue({
      type: "debug.spawn-animal",
      position: { x: 0.7, z: 0 },
      route: 0,
    });
    game.advance(1 / 60);
    expect(game.state.player.position.x).toBeLessThan(0);
  });

  it("met la scierie en pause pendant une attaque sans détruire son stock", () => {
    const game = new GameSimulation(22);
    const save = game.createSave();
    save.state.campaign.step = CAMPAIGN_STEPS.wildlife;
    save.state.sawmill.wood = 1;
    game.restore(save);
    game.enqueue({
      type: "debug.spawn-animal",
      position: { ...SAWMILL_BUILDING },
      route: 1,
    });
    advance(game, 2);
    expect(game.state.sawmill).toEqual({ wood: 1, planks: 0 });
  });

  it("arrête les ouvriers pendant une attaque de leur voie", () => {
    const game = new GameSimulation(22);
    const save = game.createSave();
    save.state.campaign.step = CAMPAIGN_STEPS.defense;
    save.state.automationLevel = 1;
    game.restore(save);
    game.enqueue({ type: "debug.progress", worker: true });
    game.enqueue({
      type: "debug.spawn-animal",
      position: { x: -0.35, z: 10.4 },
      route: 2,
    });
    game.advance(1 / 60);
    const before = { ...game.state.workers[0]!.position };
    advance(game, 1);
    expect(game.state.workers[0]!.position).toEqual(before);
  });

  it("construit la boucherie puis vend la viande", () => {
    const game = gameAtZone("butcher", {
      wood: campaignCosts().butcherWood,
      campaignStep: CAMPAIGN_STEPS.wildlife,
    });
    advance(game, 3);
    expect(game.state.campaign.step).toBe(CAMPAIGN_STEPS.defense);
    game.enqueue({ type: "debug.grant", meat: 1 });
    game.advance(1 / 60);
    advance(game, 0.5);
    expect(game.state.inventory.meat).toBe(0);
    expect(
      game.state.pickups.filter(({ kind }) => kind === "coin"),
    ).toHaveLength(FOREST.meatPrice);
  });

  it("construit la première tourelle sans arrêter la progression", () => {
    const game = gameAtZone("turret", {
      coins: FOREST.turretCosts[0],
      planks: FOREST.turretPlankCosts[0],
      campaignStep: CAMPAIGN_STEPS.defense,
      meatSold: FOREST.turretMeatRequirements[0],
    });
    advance(game, 3);
    expect(game.state.turret.level).toBe(1);
    expect(game.state.campaign.completed).toBe(false);
  });

  it("exige des planches et des pièces pour construire une tourelle", () => {
    const game = gameAtZone("turret", {
      coins: FOREST.turretCosts[0],
      campaignStep: CAMPAIGN_STEPS.defense,
      meatSold: FOREST.turretMeatRequirements[0],
    });
    advance(game, 3);
    expect(game.state.turret.level).toBe(0);
    expect(game.state.inventory.coins).toBe(FOREST.turretCosts[0]);
  });

  it("ouvre une nouvelle voie de défense à chaque tourelle", () => {
    const firstLevel = new GameSimulation(22);
    const firstSave = firstLevel.createSave();
    firstSave.state.campaign.step = CAMPAIGN_STEPS.defense;
    firstSave.state.turret.level = 1;
    firstLevel.restore(firstSave);
    firstLevel.enqueue({
      type: "debug.spawn-animal",
      position: { ...TURRET_BUILDINGS[1]! },
      route: 1,
    });
    advance(firstLevel, 1);
    expect(firstLevel.state.animals[0]!.health).toBe(
      firstLevel.state.animals[0]!.maximumHealth,
    );

    const secondLevel = new GameSimulation(22);
    const secondSave = secondLevel.createSave();
    secondSave.state.campaign.step = CAMPAIGN_STEPS.defense;
    secondSave.state.turret.level = 2;
    secondLevel.restore(secondSave);
    secondLevel.enqueue({
      type: "debug.spawn-animal",
      position: { ...TURRET_BUILDINGS[1]! },
      route: 1,
    });
    advance(secondLevel, 1);
    expect(secondLevel.state.animals[0]!.health).toBeLessThan(
      secondLevel.state.animals[0]!.maximumHealth,
    );
  });

  it("augmente le rendement en viande avec les défenses", () => {
    const game = new GameSimulation(22);
    const save = game.createSave();
    save.state.campaign.step = CAMPAIGN_STEPS.defense;
    save.state.tool.level = 6;
    save.state.turret.level = 2;
    game.restore(save);
    game.enqueue({
      type: "debug.spawn-animal",
      position: { x: 1.2, z: 0 },
      route: 0,
    });
    advance(game, 10);
    expect(game.state.inventory.meat).toBe(FOREST.bearMeat + 2);
  });

  it("exige des ventes de viande avant chaque nouvelle tourelle", () => {
    const game = gameAtZone("turret", {
      coins: FOREST.turretCosts[0],
      planks: FOREST.turretPlankCosts[0],
      campaignStep: CAMPAIGN_STEPS.defense,
      meatSold: FOREST.turretMeatRequirements[0] - 1,
    });
    advance(game, 3);
    expect(game.state.turret.level).toBe(0);
    expect(game.state.inventory).toMatchObject({
      coins: FOREST.turretCosts[0],
      planks: FOREST.turretPlankCosts[0],
    });
  });

  it("améliore la boucherie avec la viande vendue et les planches", () => {
    const game = gameAtZone("butcher", {
      planks: FOREST.butcherPlankCosts[1],
      campaignStep: CAMPAIGN_STEPS.defense,
      butcherLevel: 1,
      meatSold: FOREST.butcherMeatRequirements[1],
    });
    advance(game, 3);
    expect(game.state.butcher.level).toBe(2);
    expect(game.state.inventory.planks).toBe(0);
  });

  it("continue à vendre la viande si les planches de boucherie manquent", () => {
    const game = gameAtZone("butcher", {
      meat: 1,
      campaignStep: CAMPAIGN_STEPS.defense,
      butcherLevel: 1,
      meatSold: FOREST.butcherMeatRequirements[1],
    });
    advance(game, 0.5);
    expect(game.state.inventory).toMatchObject({ meat: 0, planks: 0 });
    expect(game.state.butcher).toEqual({ level: 1, planks: 0 });
  });

  it("transforme les améliorations de boucherie en capacité ouvrière", () => {
    const game = new GameSimulation(22);
    const save = game.createSave();
    save.state.campaign.step = CAMPAIGN_STEPS.defense;
    save.state.automationLevel = 2;
    save.state.butcher.level = 3;
    game.restore(save);
    game.enqueue({ type: "debug.progress", worker: true });
    game.advance(1 / 60);
    for (let frame = 0; frame < 20 * 60; frame += 1) {
      game.advance(1 / 60);
      if (game.state.conveyorItems.length > 0) break;
    }
    expect(game.state.conveyorItems).toHaveLength(
      FOREST.workerCapacity + FOREST.butcherWorkerCapacityBonuses[2],
    );
  });

  it("termine la progression après le monument, la boucherie et les tourelles", () => {
    const game = new GameSimulation(22);
    const save = game.createSave();
    save.state.campaign.step = CAMPAIGN_STEPS.defense;
    save.state.monument.stage = 3;
    save.state.butcher.level = 3;
    save.state.turret.level = 2;
    save.state.campaign.meatSold = FOREST.turretMeatRequirements[2];
    save.state.turret.planks = FOREST.turretPlankCosts[2];
    save.state.turret.coins = FOREST.turretCosts[2] - 1;
    save.state.inventory.coins = 1;
    save.state.player.position = { ...ZONES.turret };
    game.restore(save);
    game.advance(1 / 60);
    expect(game.state.turret.level).toBe(3);
    expect(game.state.campaign.completed).toBe(true);
  });

  it("attend le monument final avant de terminer la campagne", () => {
    const game = new GameSimulation(22);
    const save = game.createSave();
    save.state.campaign.step = CAMPAIGN_STEPS.defense;
    save.state.monument.stage = 2;
    save.state.butcher.level = 3;
    save.state.turret.level = 2;
    save.state.campaign.meatSold = FOREST.turretMeatRequirements[2];
    save.state.turret.planks = FOREST.turretPlankCosts[2];
    save.state.turret.coins = FOREST.turretCosts[2] - 1;
    save.state.inventory.coins = 1;
    save.state.player.position = { ...ZONES.turret };
    game.restore(save);
    game.advance(1 / 60);
    expect(game.state.turret.level).toBe(3);
    expect(game.state.campaign.completed).toBe(false);
  });

  it("recalcule le trajet d’un ouvrier qui a perdu son chemin", () => {
    const game = new GameSimulation(22);
    const initial = game.createSave();
    initial.state.campaign.step = CAMPAIGN_STEPS.worker;
    initial.state.automationLevel = 1;
    game.restore(initial);
    game.enqueue({ type: "debug.progress", worker: true });
    game.advance(1 / 60);
    const save = game.createSave();
    const worker = save.state.workers[0]! as WorkerState & {
      path: Vector2[];
      pathIndex: number;
    };
    worker.position = { ...ZONES.worker };
    worker.phase = "delivering";
    worker.carriedWood = 1;
    worker.path = [];
    worker.pathIndex = 0;
    game.restore(save);
    advance(game, 3);
    expect(game.state.workers[0]).toMatchObject({
      carriedWood: 0,
      phase: "seeking",
    });
  });

  it("laisse un ouvrier sortir d’un arbre qui a repoussé", () => {
    const game = new GameSimulation(22);
    const initial = game.createSave();
    initial.state.campaign.step = CAMPAIGN_STEPS.worker;
    initial.state.automationLevel = 1;
    game.restore(initial);
    game.enqueue({ type: "debug.progress", worker: true });
    game.advance(1 / 60);
    const save = game.createSave();
    const tree = save.state.trees
      .filter(({ health }) => health > 0)
      .sort(
        (left, right) =>
          Math.hypot(
            left.position.x - ZONES.worker.x,
            left.position.z - ZONES.worker.z,
          ) -
          Math.hypot(
            right.position.x - ZONES.worker.x,
            right.position.z - ZONES.worker.z,
          ),
      )[0]!;
    const worker = save.state.workers[0]! as WorkerState & {
      path: Vector2[];
      pathIndex: number;
    };
    worker.position = { ...tree.position };
    worker.phase = "delivering";
    worker.carriedWood = 1;
    worker.path = [];
    worker.pathIndex = 0;
    game.restore(save);
    advance(game, 12);
    expect(game.state.workers[0]).toMatchObject({
      carriedWood: 0,
      phase: "seeking",
    });
  });
});

function advance(game: GameSimulation, seconds: number): void {
  for (let index = 0; index < seconds * 60; index += 1) game.advance(1 / 60);
}

function segmentDistance(
  point: { x: number; z: number },
  from: { x: number; z: number },
  to: { x: number; z: number },
): number {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const lengthSquared = dx * dx + dz * dz;
  const amount =
    lengthSquared === 0
      ? 0
      : Math.max(
          0,
          Math.min(
            1,
            ((point.x - from.x) * dx + (point.z - from.z) * dz) / lengthSquared,
          ),
        );
  return Math.hypot(
    point.x - (from.x + dx * amount),
    point.z - (from.z + dz * amount),
  );
}

function axeTestTrees(game: GameSimulation, count: number): TreeState[] {
  return game.state.trees
    .filter(
      ({ position }) =>
        position.x >= -3 &&
        position.x < 6 &&
        position.z >= -3 &&
        position.z < 6,
    )
    .slice(0, count);
}

function gameAtZone(
  zone: keyof typeof ZONES,
  options: {
    coins?: number;
    wood?: number;
    planks?: number;
    meat?: number;
    automationLevel?: number;
    campaignStep?: number;
    turretLevel?: number;
    butcherLevel?: number;
    meatSold?: number;
  },
): GameSimulation {
  const game = new GameSimulation(22);
  const save = game.createSave();
  const campaignStep = options.campaignStep ?? 0;
  save.state.player.position = { ...zonePosition(zone, campaignStep) };
  save.state.inventory.coins = options.coins ?? 0;
  save.state.inventory.wood = options.wood ?? 0;
  save.state.inventory.planks = options.planks ?? 0;
  save.state.inventory.meat = options.meat ?? 0;
  save.state.automationLevel = options.automationLevel ?? 0;
  save.state.campaign.step = campaignStep;
  save.state.campaign.meatSold = options.meatSold ?? 0;
  save.state.butcher.level = options.butcherLevel ?? 0;
  save.state.turret.level = options.turretLevel ?? 0;
  game.restore(save);
  return game;
}

function pointSegmentDistance(
  point: { x: number; z: number },
  from: { x: number; z: number },
  to: { x: number; z: number },
): number {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const lengthSquared = dx * dx + dz * dz;
  const amount = Math.max(
    0,
    Math.min(
      1,
      ((point.x - from.x) * dx + (point.z - from.z) * dz) / lengthSquared,
    ),
  );
  return Math.hypot(
    point.x - (from.x + dx * amount),
    point.z - (from.z + dz * amount),
  );
}

function isInsidePolygon(
  point: { x: number; z: number },
  polygon: readonly { x: number; z: number }[],
): boolean {
  let inside = false;
  for (let index = 0; index < polygon.length; index += 1) {
    const current = polygon[index]!;
    const previous = polygon[(index + polygon.length - 1) % polygon.length]!;
    if (
      current.z > point.z !== previous.z > point.z &&
      point.x <
        ((previous.x - current.x) * (point.z - current.z)) /
          (previous.z - current.z) +
          current.x
    ) {
      inside = !inside;
    }
  }
  return inside;
}
