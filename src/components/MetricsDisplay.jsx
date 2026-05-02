export default function MetricsDisplay({ data }) {
  return (
    <div className="metrics">
      <p>Temp Reduction: {data.tempReduction.toFixed(2)} °C</p>
      <p>Efficiency Gain: {data.efficiencyGain.toFixed(2)} %</p>
      <p>Cooling Reduction: {data.coolingReduction.toFixed(1)} %</p>
      <p>Solar Output: {data.solarOutput.toFixed(0)} kWh/year</p>
      <p>Savings: ₱{data.annualSavingsPHP.toFixed(0)}</p>
      <p>Payback: {data.payback.toFixed(1)} years</p>
      <p>ROI: {data.roi.toFixed(1)} %</p>
    </div>
  );
}