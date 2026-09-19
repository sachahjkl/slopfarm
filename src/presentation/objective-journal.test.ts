import { describe, expect, it } from "vitest";
import { objectiveHistoryEntry } from "./objective-journal";

describe("objectiveHistoryEntry", () => {
  it("enregistre le compteur final lors de la transition 11/12 vers 12/12", () => {
    expect(
      objectiveHistoryEntry(
        {
          icon: "APPROVISIONNE LE COMPTOIR",
          detail: "11 / 12 clients",
        },
        { icon: "AMÉLIORE TES HACHES", detail: "0 / 8 pièces déposées" },
      ),
    ).toBe("✓ APPROVISIONNE LE COMPTOIR — 12 / 12 clients");
  });

  it.each([
    ["CONSTRUIS TON CAMP", "24 / 25 bois", "25 / 25 bois"],
    ["CONSTRUIS LE COMPTOIR", "34 / 35 bois", "35 / 35 bois"],
    [
      "PRODUIS DES PLANCHES · MONTE LA CHAÎNE",
      "19 / 20 planches",
      "20 / 20 planches",
    ],
    [
      "ENGAGE TON PREMIER BÛCHERON",
      "4 / 5 pièces déposées",
      "5 / 5 pièces déposées",
    ],
    ["CHARGE LE CONVOI", "34 / 35 planches", "35 / 35 planches"],
    ["CONSTRUIS LA BOUCHERIE", "44 / 45 bois", "45 / 45 bois"],
    ["INSTALLE UNE TOURELLE", "29 / 30 pièces", "30 / 30 pièces"],
  ])("complète le détail quantifié de %s", (icon, detail, completed) => {
    expect(
      objectiveHistoryEntry(
        { icon, detail },
        { icon: "OBJECTIF SUIVANT", detail: "Détail suivant" },
      ),
    ).toBe(`✓ ${icon} — ${completed}`);
  });

  it("conserve le détail non quantifié", () => {
    expect(
      objectiveHistoryEntry(
        { icon: "LA LISIÈRE EST OUVERTE", detail: "Explore la lisière" },
        { icon: "OBJECTIF SUIVANT", detail: "Détail suivant" },
      ),
    ).toBe("✓ LA LISIÈRE EST OUVERTE — Explore la lisière");
  });
});
