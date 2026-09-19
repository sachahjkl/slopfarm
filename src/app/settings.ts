import type { GameSimulation, SaveData } from "../game/simulation";
import type { FeedbackSettings } from "./sound";
import { SaveStore } from "./save-store";

const SETTINGS_KEY = "slopfarm.settings.v1";

export class SettingsPanel {
  readonly feedback: FeedbackSettings;

  constructor(
    dialog: HTMLDialogElement,
    game: GameSimulation,
    saves: SaveStore,
  ) {
    this.feedback = loadSettings();
    const button = requireElement("#settings-button", HTMLButtonElement);
    const close = requireElement("#settings-close", HTMLButtonElement);
    const sound = requireElement("#setting-sound", HTMLInputElement);
    const vibration = requireElement("#setting-vibration", HTMLInputElement);
    const reducedMotion = requireElement("#setting-motion", HTMLInputElement);
    const quality = requireElement("#setting-quality", HTMLSelectElement);
    const importInput = requireElement("#save-import", HTMLInputElement);
    sound.checked = this.feedback.sound;
    vibration.checked = this.feedback.vibration;
    reducedMotion.checked = this.feedback.reducedMotion;
    quality.value = this.feedback.quality;
    button.addEventListener("click", () => dialog.showModal());
    close.addEventListener("click", () => dialog.close());
    sound.addEventListener("change", () =>
      this.#update({ sound: sound.checked }),
    );
    vibration.addEventListener("change", () =>
      this.#update({ vibration: vibration.checked }),
    );
    reducedMotion.addEventListener("change", () =>
      this.#update({ reducedMotion: reducedMotion.checked }),
    );
    quality.addEventListener("change", () =>
      this.#update({ quality: quality.value === "low" ? "low" : "high" }),
    );
    requireElement("#save-export", HTMLButtonElement).addEventListener(
      "click",
      () => saves.exportSave(game.createSave()),
    );
    requireElement("#replay-export", HTMLButtonElement).addEventListener(
      "click",
      () => saves.exportReplay(game.createReplay()),
    );
    requireElement("#save-reset", HTMLButtonElement).addEventListener(
      "click",
      () => {
        if (confirm("Effacer définitivement la progression locale ?")) {
          saves.reset();
          location.reload();
        }
      },
    );
    importInput.addEventListener("change", () => {
      const file = importInput.files?.[0];
      if (!file) return;
      void saves.importSave(file).then((data: SaveData) => {
        game.enqueue({ type: "save.loaded", data });
        dialog.close();
      });
    });
  }

  #update(change: Partial<FeedbackSettings>): void {
    Object.assign(this.feedback, change);
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.feedback));
    document.documentElement.classList.toggle(
      "reduced-motion",
      this.feedback.reducedMotion,
    );
  }
}

function loadSettings(): FeedbackSettings {
  try {
    const stored = JSON.parse(
      localStorage.getItem(SETTINGS_KEY) ?? "{}",
    ) as Partial<FeedbackSettings>;
    return {
      sound: stored.sound ?? true,
      vibration: stored.vibration ?? true,
      reducedMotion: stored.reducedMotion ?? false,
      quality: stored.quality === "low" ? "low" : "high",
    };
  } catch {
    return {
      sound: true,
      vibration: true,
      reducedMotion: false,
      quality: "high",
    };
  }
}

function requireElement<T extends Element>(
  selector: string,
  constructor: new (...args: never[]) => T,
): T {
  const element = document.querySelector(selector);
  if (!(element instanceof constructor))
    throw new Error(`Élément d’interface absent : ${selector}`);
  return element;
}
