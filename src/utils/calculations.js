export function calculateMetrics(thickness) {
  // Max values based on research
  const maxTempReduction = 4.72; // °C at 80mm
  const maxEfficiencyGain = 2.5; // %
  const maxCoolingReduction = 70; // %
  const maxSavings = 55; // %

  const scale = thickness / 80;

  const tempReduction = Math.min(maxTempReduction * scale, 8); // capped
  const efficiencyGain = Math.min(maxEfficiencyGain * scale, 5);
  const coolingReduction = Math.min(maxCoolingReduction * scale, 100);
  const savings = Math.min(maxSavings * scale, 80);

  // Solar estimation (example realistic formula)
  const baseSolarOutput = 5000; // kWh/year baseline
  const solarOutput = baseSolarOutput * (1 + efficiencyGain / 100);

  const annualSavingsPHP = solarOutput * 10; // ₱10/kWh estimate
  const systemCost = 250000; // ₱ estimated system cost

  const payback = systemCost / annualSavingsPHP;
  const roi = (annualSavingsPHP / systemCost) * 100;

  return {
    tempReduction,
    efficiencyGain,
    coolingReduction,
    solarOutput,
    annualSavingsPHP,
    payback,
    roi,
  };
}