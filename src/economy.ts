export interface Economy {
  coins: number;
  wood: number;
  axeLevel: number;
}

export const initialEconomy = (): Economy => ({
  coins: 0,
  wood: 0,
  axeLevel: 1,
});

export const harvestWood = (economy: Economy, amount = 1): Economy => ({
  ...economy,
  wood: economy.wood + amount * economy.axeLevel,
});

export const sellWood = (economy: Economy, price = 2): Economy => ({
  ...economy,
  coins: economy.coins + economy.wood * price,
  wood: 0,
});
