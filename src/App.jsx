import { useState, useMemo, useRef, useEffect } from "react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart, ReferenceLine } from "recharts";

// ═══════════════════════════════════════════════════════════════
// SIMULATION ENGINE — Research-validated data
// ═══════════════════════════════════════════════════════════════

const LOCATIONS = {
  manila: { name: "Manila, Philippines", avgTemp: 28.5, peakTemp: 36.2, ghi: 5.1, cdd: 3200, rate: 9.5, humidity: 74, currency: "₱", label: "Tropical – High Irradiance" },
};

// Palitan ang BLDG object
const BLDG = { 
  wallArea: 480, 
  gwCoverage: 0.6, 
  roofArea: 350,  // Binago: 200 → 350 m² (mas realistic para sa building size)
  panelEff: 0.20,  // 20% efficiency (realistic for bifacial)
  bifacialGain: 0.10,  // 10% rear-side gain
  coolingLoad: 85000, 
  sysLoss: 0.14,  // 14% system losses
  panelCostWp: 0.55,  // $0.55/Watt (market rate)
  gwCostSqm: 180,  // $180/m² (green wall installation)
  maintGW: 12,  // $12/m²/year
  maintPV: 8,  // $8/kW/year
};

function sf(t) { const r = 1 - Math.exp(-t / 60); const ref = 1 - Math.exp(-80 / 60); return r / ref; }
function tempReduction(t, loc) { return 4.72 * sf(t) * (loc.avgTemp / 28.5); }
function pvGain(t) { return 2.5 * sf(t); }
function solarGen(t, loc) { return Math.round(BLDG.roofArea * loc.ghi * (BLDG.panelEff + BLDG.bifacialGain + pvGain(t) / 100) * (1 - BLDG.sysLoss) * 365); }
function baselineSolar(loc) { return Math.round(BLDG.roofArea * loc.ghi * (BLDG.panelEff + BLDG.bifacialGain) * (1 - BLDG.sysLoss) * 365); }
function coolingReduction(t, loc) { const f = Math.min(0.70 * sf(t), 0.72); const base = BLDG.coolingLoad * (loc.cdd / 3200); return { pct: Math.round(f * 1000) / 10, saved: Math.round(base * f), baseline: Math.round(base) }; }

function costAnalysis(t, loc) {
  const gwArea = BLDG.wallArea * BLDG.gwCoverage;
  const sysKw = BLDG.roofArea * (BLDG.panelEff + BLDG.bifacialGain) / 5;
  const gwCost = gwArea * BLDG.gwCostSqm * (t / 80);
  const pvCost = sysKw * 1000 * BLDG.panelCostWp;
  const totalInit = gwCost + pvCost;
  const maint = gwArea * BLDG.maintGW + sysKw * BLDG.maintPV;
  const cool = coolingReduction(t, loc);
  const coolSav = cool.saved * loc.rate;
  const solSav = solarGen(t, loc) * loc.rate;
  const totalSav = coolSav + solSav;
  const net = totalSav - maint;
  const payback = net > 0 ? totalInit / net : Infinity;
  const roi = net > 0 ? ((net * 25 - totalInit) / totalInit) * 100 : 0;
  return { gwCost: Math.round(gwCost), pvCost: Math.round(pvCost), totalInit: Math.round(totalInit), maint: Math.round(maint), coolSav: Math.round(coolSav), solSav: Math.round(solSav), totalSav: Math.round(totalSav), net: Math.round(net), payback: Math.round(payback * 10) / 10, roi: Math.round(roi * 10) / 10 };
}

function monthlyTemps(t, loc) {
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const v = [-0.8,-0.4,0.3,1.2,1.8,1.5,1.2,1.0,0.6,0.2,-0.3,-0.7];
  const red = tempReduction(t, loc);
  return months.map((m, i) => {
    const base = loc.avgTemp + v[i] * (loc.peakTemp - loc.avgTemp) / 4;
    return { month: m, without: Math.round(base * 10) / 10, with: Math.round((base - red) * 10) / 10, reduction: Math.round(red * 10) / 10 };
  });
}

function monthlyEnergy(t, loc) {
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const sf2 = [0.85,0.90,1.00,1.10,1.15,1.05,0.95,0.90,0.95,1.00,0.90,0.80];
  const cf = [0.65,0.70,0.85,1.10,1.25,1.20,1.15,1.10,1.00,0.90,0.75,0.60];
  const sol = solarGen(t, loc);
  const cool = coolingReduction(t, loc);
  return months.map((m, i) => ({ month: m, solar: Math.round((sol / 12) * sf2[i]), coolingSaved: Math.round((cool.saved / 12) * cf[i]), baselineCooling: Math.round((cool.baseline / 12) * cf[i]) }));
}

function calcAll(t, locKey) {
  const loc = LOCATIONS[locKey];
  const tr = tempReduction(t, loc);
  const pg = pvGain(t);
  const sg = solarGen(t, loc);
  const bs = baselineSolar(loc);
  const cool = coolingReduction(t, loc);
  const cost = costAnalysis(t, loc);
  return { loc, t, tr: Math.round(tr * 100) / 100, pg: Math.round(pg * 100) / 100, sg, bs, extra: sg - bs, cool, cost, mTemps: monthlyTemps(t, loc), mEnergy: monthlyEnergy(t, loc), co2: Math.round((sg * 0.0007 + cool.saved * 0.0007) * 10) / 10 };
}

// ═══════════════════════════════════════════════════════════════
// 3D BUILDING VIEWER - Sketchfab Embed (Your Actual Model)
// ═══════════════════════════════════════════════════════════════

function Building3DViewer({ thickness, greenOn }) {
  return (
    <div style={{ 
      width: "100%", 
      height: "100%", 
      position: "relative",
      background: "radial-gradient(ellipse at center bottom, #0d1f0d 0%, #060c06 100%)",
      borderRadius: "8px",
      overflow: "hidden"
    }}>
      {/* Sketchfab Embed - Your actual BINONDOMINIUM model */}
      <iframe 
        title="BINONDOMINIUM - Bifacial PV + Green Wall Building" 
        frameBorder="0" 
        allowFullScreen
        mozAllowFullScreen="true" 
        webkitAllowFullScreen="true" 
        allow="autoplay; fullscreen; xr-spatial-tracking" 
        src="https://sketchfab.com/models/2d0e2b5fd5474770b953cbf23835624a/embed"
        style={{ 
          width: "100%", 
          height: "100%", 
          border: "none",
          position: "absolute",
          top: 0,
          left: 0
        }}
      />
      
      {/* Green Wall Thickness Indicator Overlay */}
      {greenOn && thickness > 0 && (
        <div style={{
          position: "absolute",
          bottom: 16,
          right: 16,
          background: "rgba(0,0,0,0.7)",
          backdropFilter: "blur(8px)",
          padding: "6px 14px",
          borderRadius: "20px",
          fontSize: "12px",
          fontFamily: "monospace",
          color: "#4ade80",
          border: "1px solid rgba(74,222,128,0.3)",
          pointerEvents: "none",
          zIndex: 10
        }}>
          🌿 Green Wall: {thickness}mm
        </div>
      )}
      
      {/* Instructions */}
      <div style={{
        position: "absolute",
        bottom: 16,
        left: 16,
        background: "rgba(0,0,0,0.5)",
        padding: "4px 10px",
        borderRadius: "16px",
        fontSize: "10px",
        fontFamily: "monospace",
        color: "#aaa",
        pointerEvents: "none",
        zIndex: 10
      }}>
        🖱️ Drag to rotate | Right-click to pan | Scroll to zoom
      </div>
      
      {/* Green wall overlay effect - visual representation of thickness */}
      {greenOn && thickness > 0 && (
        <div style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: `radial-gradient(circle at center, transparent 30%, rgba(74,222,128,${0.03 + thickness / 600}) 100%)`,
          pointerEvents: "none",
          zIndex: 5
        }} />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// CHART TOOLTIP
// ═══════════════════════════════════════════════════════════════

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "rgba(10,20,10,0.95)", border: "1px solid rgba(74,222,128,0.25)", borderRadius: 8, padding: "10px 14px", fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>
      <div style={{ color: "#8faa8f", marginBottom: 6, fontWeight: 600 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 2 }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: p.color, flexShrink: 0 }} />
          <span style={{ color: "#b0c8b0" }}>{p.name}:</span>
          <span style={{ color: "#e4efe4", fontWeight: 600 }}>{typeof p.value === "number" ? p.value.toLocaleString() : p.value}</span>
        </div>
      ))}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// MAIN DASHBOARD
// ═══════════════════════════════════════════════════════════════

export default function GreenWallDashboard() {
  const [thickness, setThickness] = useState(80);
  const [locKey, setLocKey] = useState("manila");
  const [greenOn, setGreenOn] = useState(true);
  const [chartTab, setChartTab] = useState("temp");

  const d = useMemo(() => calcAll(thickness, locKey), [thickness, locKey]);
  const fmt = (n) => n?.toLocaleString() ?? "—";
  const cur = d.loc.currency;

  const cashflow = useMemo(() => {
    const arr = [];
    let cum = -d.cost.totalInit;
    arr.push({ year: 0, value: cum });
    for (let y = 1; y <= 25; y++) { cum += d.cost.net; arr.push({ year: y, value: Math.round(cum) }); }
    return arr;
  }, [d]);

  return (
    <div style={{ minHeight: "100vh", background: "#0a0f0a", color: "#e4efe4", fontFamily: "'DM Sans', 'Segoe UI', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-thumb { background: #2a4a2a; border-radius: 3px; }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        .card { background: #141e14; border: 1px solid rgba(74,140,74,0.15); border-radius: 12px; transition: all 0.25s; }
        .card:hover { border-color: rgba(74,140,74,0.3); box-shadow: 0 8px 32px rgba(0,0,0,0.3); }
        .metric-card { position: relative; overflow: hidden; animation: fadeUp 0.4s ease-out both; }
        .metric-card::before { content: ''; position: absolute; top: 0; left: 0; width: 3px; height: 100%; background: var(--accent); opacity: 0.7; border-radius: 3px 0 0 3px; }
        .slider { -webkit-appearance: none; width: 100%; height: 6px; border-radius: 3px; background: linear-gradient(90deg, #1e2e1e, rgba(74,222,128,0.2)); outline: none; cursor: pointer; }
        .slider::-webkit-slider-thumb { -webkit-appearance: none; width: 22px; height: 22px; border-radius: 50%; background: #4ade80; box-shadow: 0 0 14px rgba(74,222,128,0.45); cursor: grab; transition: transform 0.15s; }
        .slider::-webkit-slider-thumb:hover { transform: scale(1.15); }
        .loc-btn { padding: 8px 12px; border: 1px solid rgba(74,140,74,0.15); border-radius: 8px; background: transparent; color: #8faa8f; cursor: pointer; font-family: inherit; font-size: 12px; transition: all 0.2s; text-align: left; width: 100%; }
        .loc-btn:hover { background: #1e2e1e; color: #e4efe4; border-color: rgba(74,140,74,0.3); }
        .loc-btn.active { background: rgba(74,222,128,0.1); border-color: rgba(74,222,128,0.35); color: #4ade80; }
        .tab-btn { padding: 7px 16px; border: none; border-radius: 7px; background: transparent; color: #5a7a5a; font-family: inherit; font-size: 12px; font-weight: 500; cursor: pointer; transition: all 0.2s; }
        .tab-btn:hover { color: #e4efe4; }
        .tab-btn.active { background: rgba(74,222,128,0.12); color: #4ade80; }
        .toggle { width: 42px; height: 24px; border-radius: 12px; background: #1e2e1e; border: 1px solid rgba(74,140,74,0.2); cursor: pointer; position: relative; transition: all 0.25s; }
        .toggle.on { background: rgba(74,222,128,0.15); border-color: rgba(74,222,128,0.4); }
        .toggle-dot { width: 18px; height: 18px; border-radius: 50%; background: #5a7a5a; position: absolute; top: 2px; left: 2px; transition: all 0.25s; }
        .toggle.on .toggle-dot { left: 20px; background: #4ade80; box-shadow: 0 0 10px rgba(74,222,128,0.5); }
        .recharts-cartesian-grid-horizontal line, .recharts-cartesian-grid-vertical line { stroke: rgba(74,140,74,0.1); }
        iframe { pointer-events: auto; }
      `}</style>

      {/* HEADER */}
      <header style={{ position: "sticky", top: 0, zIndex: 50, background: "rgba(10,15,10,0.88)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(74,140,74,0.15)", padding: "12px 24px" }}>
        <div style={{ maxWidth: 1400, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(74,222,128,0.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🌿</div>
            <div>
              <h1 style={{ fontSize: 16, fontWeight: 700, letterSpacing: "-0.02em" }}>Integrating Vertical Green walls with Bifacial Solar Panels</h1>
              <p style={{ fontSize: 11, color: "#5a7a5a", marginTop: 1 }}>Interactive Performance Dashboard — Research-Validated Simulation</p>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <span style={{ padding: "4px 10px", borderRadius: 6, fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", background: "#1e2e1e", color: "#8faa8f", border: "1px solid rgba(74,140,74,0.15)" }}>Simulation</span>
            {/* <span style={{ padding: "4px 10px", borderRadius: 6, fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", background: "rgba(74,222,128,0.1)", color: "#4ade80", border: "1px solid rgba(74,222,128,0.2)" }}>Research Data</span> */}
          </div>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main style={{ maxWidth: 1400, margin: "0 auto", padding: "20px 24px", display: "flex", flexDirection: "column", gap: 20 }}>

        {/* TOP ROW: Controls + Building */}
        <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 16, alignItems: "start" }}>

          {/* Controls Panel */}
          <div className="card" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 14 }}>⚙</span>
              <h2 style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "#8faa8f" }}>Simulation Controls</h2>
            </div>

            {/* Thickness Slider */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 500 }}>Green Wall Thickness</span>
                <span style={{ fontFamily: "'JetBrains Mono'", fontSize: 14, fontWeight: 600, color: "#4ade80", background: "rgba(74,222,128,0.12)", padding: "2px 10px", borderRadius: 6 }}>{thickness} mm</span>
              </div>
              <input type="range" min="0" max="200" step="5" value={thickness} onChange={e => setThickness(+e.target.value)} className="slider" />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#5a7a5a", fontFamily: "'JetBrains Mono'", marginTop: 4 }}>
                <span>0 mm</span>
                <span style={{ color: "rgba(74,222,128,0.6)" }}>80 mm (ref.)</span>
                <span>200 mm</span>
              </div>
            </div>

            {/* Location */}
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>Location</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {Object.entries(LOCATIONS).map(([k, v]) => (
                  <button key={k} className={`loc-btn ${locKey === k ? "active" : ""}`} onClick={() => setLocKey(k)}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontWeight: 500 }}>{v.name.split(",")[0]}</span>
                      <span style={{ fontFamily: "'JetBrains Mono'", fontSize: 10, opacity: 0.7 }}>{v.ghi} kWh/m²/d</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Toggle */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 13, fontWeight: 500 }}>Show Green Walls</span>
              <div className={`toggle ${greenOn ? "on" : ""}`} onClick={() => setGreenOn(!greenOn)}><div className="toggle-dot" /></div>
            </div>

            {/* Data source
            <div style={{ padding: 12, borderRadius: 8, background: "rgba(74,222,128,0.04)", border: "1px dashed rgba(74,222,128,0.15)" }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: "#4ade80", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 5 }}>Research Data Sources</div>
              {["Temp reduction: 4.72°C @ 80mm", "PV efficiency: +2.5% @ 80mm", "Cooling reduction: up to 70%", "Lifecycle savings: up to 55%"].map((t, i) => (
                <div key={i} style={{ fontSize: 10, color: "#5a7a5a", fontFamily: "'JetBrains Mono'", paddingLeft: 10, position: "relative", lineHeight: 1.8 }}>
                  <span style={{ position: "absolute", left: 0, color: "#4ade80" }}>·</span>{t}
                </div>
              ))}
            </div> */}
          </div>

          {/* Building Visualization - YOUR ACTUAL SKETCHFAB MODEL */}
          <div className="card" style={{ overflow: "hidden" }}>
            <div style={{ padding: "12px 16px", borderBottom: "1px solid rgba(74,140,74,0.12)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ fontSize: 14, fontWeight: 600 }}>🏢 Building 3D Model (BINONDOMINIUM)</h2>
              <div style={{ display: "flex", gap: 8 }}>
                <span style={{ padding: "3px 10px", borderRadius: 6, fontSize: 10, fontFamily: "'JetBrains Mono'", background: "#1e2e1e", border: "1px solid rgba(74,140,74,0.12)", color: "#8faa8f" }}>🌿 {thickness}mm</span>
                <span style={{ padding: "3px 10px", borderRadius: 6, fontSize: 10, fontFamily: "'JetBrains Mono'", background: "#1e2e1e", border: "1px solid rgba(74,140,74,0.12)", color: "#8faa8f" }}>☀️ {(d.sg / 1000).toFixed(1)} MWh/yr</span>
              </div>
            </div>
            <div style={{ height: 450 }}>
              <Building3DViewer thickness={thickness} greenOn={greenOn} />
            </div>
          </div>
        </div>

        {/* METRICS CARDS */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700 }}>Performance Metrics</h2>
            <span style={{ padding: "4px 12px", borderRadius: 6, fontSize: 11, fontFamily: "'JetBrains Mono'", background: "#141e14", border: "1px solid rgba(74,140,74,0.12)", color: "#5a7a5a" }}>{thickness}mm · {d.loc.name}</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 }}>
            {[
              { icon: "🌡️", label: "Temperature Reduction", value: `${d.tr}°C`, sub: `Building: ${(d.loc.avgTemp - d.tr).toFixed(1)}°C (from ${d.loc.avgTemp}°C)`, accent: "#38bdf8" },
              { icon: "❄️", label: "Cooling Energy Saved", value: `${d.cool.pct}%`, sub: `${fmt(d.cool.saved)} kWh/year saved`, accent: "#60a5fa" },
              { icon: "☀️", label: "Solar Generation", value: `${(d.sg / 1000).toFixed(1)} MWh`, sub: `+${fmt(d.extra)} kWh from GW cooling`, accent: "#fbbf24" },
              { icon: "⚡", label: "PV Efficiency Boost", value: `+${d.pg}%`, sub: `Total efficiency: ${(30 + d.pg).toFixed(1)}%`, accent: "#f59e0b" },
              { icon: "💰", label: "Annual Net Savings", value: `${cur}${fmt(d.cost.net)}`, sub: `Cooling: ${cur}${fmt(d.cost.coolSav)} · Solar: ${cur}${fmt(d.cost.solSav)}`, accent: "#34d399" },
              { icon: "📈", label: "Payback Period", value: `${d.cost.payback} yrs`, sub: `25-year ROI: ${d.cost.roi}%`, accent: "#a78bfa" },
              { icon: "🌍", label: "CO₂ Avoided", value: `${d.co2} t/yr`, sub: `${(d.co2 * 25).toFixed(0)} tonnes over lifetime`, accent: "#4ade80" },
              { icon: "🏗️", label: "Total Investment", value: `${cur}${fmt(d.cost.totalInit)}`, sub: `GW: ${cur}${fmt(d.cost.gwCost)} · PV: ${cur}${fmt(d.cost.pvCost)}`, accent: "#fb923c" },
            ].map((c, i) => (
              <div key={i} className="card metric-card" style={{ "--accent": c.accent, padding: 16, display: "flex", gap: 12, animationDelay: `${i * 50}ms` }}>
                <div style={{ fontSize: 22, flexShrink: 0, marginTop: 2 }}>{c.icon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 10, fontWeight: 500, color: "#5a7a5a", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>{c.label}</div>
                  <div style={{ fontFamily: "'JetBrains Mono'", fontSize: 22, fontWeight: 700, color: c.accent, lineHeight: 1.1 }}>{c.value}</div>
                  <div style={{ fontSize: 11, color: "#5a7a5a", marginTop: 5, lineHeight: 1.4 }}>{c.sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CHARTS */}
        <div className="card" style={{ overflow: "hidden" }}>
          <div style={{ padding: "14px 18px", borderBottom: "1px solid rgba(74,140,74,0.12)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
            <h2 style={{ fontSize: 14, fontWeight: 600 }}>Performance Analysis</h2>
            <div style={{ display: "flex", gap: 4, background: "#0a0f0a", padding: 3, borderRadius: 8 }}>
              {[["temp", "Temperature"], ["energy", "Energy"], ["cost", "Cost Analysis"]].map(([id, label]) => (
                <button key={id} className={`tab-btn ${chartTab === id ? "active" : ""}`} onClick={() => setChartTab(id)}>{label}</button>
              ))}
            </div>
          </div>

          <div style={{ padding: 20 }}>
            {chartTab === "temp" && (
              <div>
                <div style={{ display: "flex", justifyContent: "center", gap: 24, marginBottom: 16, flexWrap: "wrap" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#8faa8f" }}><span style={{ width: 10, height: 10, borderRadius: 2, background: "#ef4444" }} /> Without Green Wall</span>
                  <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#8faa8f" }}><span style={{ width: 10, height: 10, borderRadius: 2, background: "#4ade80" }} /> With Green Wall</span>
                </div>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={d.mTemps} barCategoryGap="20%" barGap={2}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" tick={{ fill: "#5a7a5a", fontSize: 11, fontFamily: "'JetBrains Mono'" }} />
                    <YAxis domain={["dataMin - 2", "dataMax + 1"]} tick={{ fill: "#5a7a5a", fontSize: 11, fontFamily: "'JetBrains Mono'" }} tickFormatter={v => `${v}°C`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="without" name="Without GW (°C)" fill="#ef4444" radius={[3, 3, 0, 0]} opacity={0.75} />
                    <Bar dataKey="with" name="With GW (°C)" fill="#4ade80" radius={[3, 3, 0, 0]} opacity={0.8} />
                  </BarChart>
                </ResponsiveContainer>
                <div style={{ textAlign: "center", fontSize: 13, color: "#8faa8f", padding: "12px 16px", background: "#1e2e1e", borderRadius: 8, marginTop: 12 }}>
                  Average reduction: <strong style={{ color: "#4ade80", fontFamily: "'JetBrains Mono'" }}>{d.tr}°C</strong> across all months
                </div>
              </div>
            )}

            {chartTab === "energy" && (
              <div>
                <div style={{ display: "flex", justifyContent: "center", gap: 24, marginBottom: 16, flexWrap: "wrap" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#8faa8f" }}><span style={{ width: 10, height: 10, borderRadius: 2, background: "#fbbf24" }} /> Solar Generation</span>
                  <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#8faa8f" }}><span style={{ width: 10, height: 10, borderRadius: 2, background: "#38bdf8" }} /> Cooling Saved</span>
                  <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#8faa8f" }}><span style={{ width: 10, height: 10, borderRadius: 2, background: "rgba(239,68,68,0.3)" }} /> Baseline Cooling</span>
                </div>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={d.mEnergy} barCategoryGap="15%" barGap={1}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" tick={{ fill: "#5a7a5a", fontSize: 11, fontFamily: "'JetBrains Mono'" }} />
                    <YAxis tick={{ fill: "#5a7a5a", fontSize: 11, fontFamily: "'JetBrains Mono'" }} tickFormatter={v => `${v}`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="solar" name="Solar (kWh)" fill="#fbbf24" radius={[3, 3, 0, 0]} opacity={0.8} />
                    <Bar dataKey="coolingSaved" name="Cooling Saved (kWh)" fill="#38bdf8" radius={[3, 3, 0, 0]} opacity={0.8} />
                    <Bar dataKey="baselineCooling" name="Baseline Cooling (kWh)" fill="#ef4444" radius={[3, 3, 0, 0]} opacity={0.25} />
                  </BarChart>
                </ResponsiveContainer>
                <div style={{ textAlign: "center", fontSize: 13, color: "#8faa8f", padding: "12px 16px", background: "#1e2e1e", borderRadius: 8, marginTop: 12 }}>
                  Annual: <strong style={{ color: "#fbbf24", fontFamily: "'JetBrains Mono'" }}>{(d.sg / 1000).toFixed(1)} MWh</strong> solar + <strong style={{ color: "#38bdf8", fontFamily: "'JetBrains Mono'" }}>{(d.cool.saved / 1000).toFixed(1)} MWh</strong> cooling saved
                </div>
              </div>
            )}

            {chartTab === "cost" && (
              <div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
                  <div style={{ padding: 14, borderRadius: 10, border: "1px solid rgba(239,68,68,0.15)", background: "rgba(239,68,68,0.04)" }}>
                    <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "#5a7a5a", marginBottom: 10 }}>Initial Investment</div>
                    {[["Green Wall System", d.cost.gwCost], ["Bifacial Solar Panels", d.cost.pvCost]].map(([l, v], i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 13, color: "#8faa8f" }}>
                        <span>{l}</span><span style={{ fontFamily: "'JetBrains Mono'" }}>{cur}{fmt(v)}</span>
                      </div>
                    ))}
                    <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid rgba(74,140,74,0.12)", marginTop: 8, paddingTop: 8, fontWeight: 600, fontSize: 14 }}>
                      <span>Total</span><span style={{ fontFamily: "'JetBrains Mono'", color: "#ef4444" }}>{cur}{fmt(d.cost.totalInit)}</span>
                    </div>
                  </div>
                  <div style={{ padding: 14, borderRadius: 10, border: "1px solid rgba(74,222,128,0.15)", background: "rgba(74,222,128,0.04)" }}>
                    <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "#5a7a5a", marginBottom: 10 }}>Annual Returns</div>
                    {[["Cooling Savings", d.cost.coolSav, true], ["Solar Savings", d.cost.solSav, true], ["Maintenance", d.cost.maint, false]].map(([l, v, pos], i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 13, color: "#8faa8f" }}>
                        <span>{l}</span><span style={{ fontFamily: "'JetBrains Mono'", color: pos ? "#4ade80" : "#ef4444" }}>{pos ? "+" : "-"}{cur}{fmt(v)}</span>
                      </div>
                    ))}
                    <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid rgba(74,140,74,0.12)", marginTop: 8, paddingTop: 8, fontWeight: 600, fontSize: 14 }}>
                      <span>Net Annual</span><span style={{ fontFamily: "'JetBrains Mono'", color: "#4ade80" }}>+{cur}{fmt(d.cost.net)}</span>
                    </div>
                  </div>
                </div>

                <div style={{ marginBottom: 12 }}>
                  <h3 style={{ fontSize: 13, fontWeight: 600, color: "#8faa8f", marginBottom: 10 }}>Cumulative Cash Flow (25 Years)</h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <AreaChart data={cashflow}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="year" tick={{ fill: "#5a7a5a", fontSize: 10, fontFamily: "'JetBrains Mono'" }} tickFormatter={v => `Y${v}`} />
                      <YAxis tick={{ fill: "#5a7a5a", fontSize: 10, fontFamily: "'JetBrains Mono'" }} tickFormatter={v => v >= 0 ? `${cur}${(v/1000).toFixed(0)}k` : `-${cur}${(Math.abs(v)/1000).toFixed(0)}k`} />
                      <Tooltip content={<CustomTooltip />} />
                      <ReferenceLine y={0} stroke="rgba(255,255,255,0.2)" strokeDasharray="4 4" label={{ value: "Break-even", position: "right", fill: "#5a7a5a", fontSize: 10 }} />
                      <defs>
                        <linearGradient id="cashGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#4ade80" stopOpacity={0.3} />
                          <stop offset="50%" stopColor="#4ade80" stopOpacity={0.05} />
                          <stop offset="100%" stopColor="#ef4444" stopOpacity={0.15} />
                        </linearGradient>
                      </defs>
                      <Area type="monotone" dataKey="value" name={`Cumulative (${cur})`} stroke="#4ade80" fill="url(#cashGrad)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                <div style={{ textAlign: "center", fontSize: 13, color: "#8faa8f", padding: "12px 16px", background: "#1e2e1e", borderRadius: 8 }}>
                  Payback in <strong style={{ color: "#a78bfa", fontFamily: "'JetBrains Mono'" }}>{d.cost.payback} years</strong> · 25-year ROI: <strong style={{ color: "#4ade80", fontFamily: "'JetBrains Mono'" }}>{d.cost.roi}%</strong>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* FOOTER */}
      <footer style={{ textAlign: "center", padding: 24, borderTop: "1px solid rgba(74,140,74,0.12)", background: "#0d120d" }}>
        <p style={{ fontSize: 13, color: "#8faa8f", fontWeight: 500 }}>Integrating Vertical Green Walls with Bifacial Solar Panels — Simulation Dashboard</p>
        <p style={{ fontSize: 10, color: "#3a5a3a", marginTop: 6, maxWidth: 700, margin: "6px auto 0" }}>
          Data from published research. Values scale with substrate thickness (0–200mm) using exponential saturation model. For academic demonstration only.
        </p>
      </footer>
    </div>
  );
}