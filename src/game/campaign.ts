export const CAMPAIGN_STEPS = {
  camp: 0,
  market: 1,
  trade: 2,
  sawmill: 3,
  automation: 4,
  worker: 5,
  convoy: 6,
  departure: 7,
  wildlife: 8,
  defense: 9,
} as const;

export interface CampaignCosts {
  campWood: number;
  marketWood: number;
  sawmillWood: number;
  automationPlanks: number;
  exitPlanks: number;
  customers: number;
  butcherWood: number;
}

export function campaignCosts(): CampaignCosts {
  return {
    campWood: 25,
    marketWood: 35,
    sawmillWood: 50,
    automationPlanks: 20,
    exitPlanks: 35,
    customers: 12,
    butcherWood: 45,
  };
}
