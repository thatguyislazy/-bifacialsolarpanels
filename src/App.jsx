import { useState, useMemo } from "react";
import {
  BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Area, AreaChart, ReferenceLine
} from "recharts";

// ═══════════════════════════════════════════════════════════════
// SIMULATION ENGINE
// ═══════════════════════════════════════════════════════════════

const LOCATIONS = {
  manila: {
    name: "Manila, Philippines", avgTemp: 28.5, peakTemp: 36.2,
    ghi: 5.1, cdd: 3200, rate: 9.5, humidity: 74, currency: "₱",
  },
};

const BLDG = {
  wallArea: 480, gwCoverage: 0.6, roofArea: 350,
  panelEff: 0.20, bifacialGain: 0.10, coolingLoad: 85000, sysLoss: 0.14,
  panelCostWp: 0.55, gwCostSqm: 180, maintGW: 12, maintPV: 8,
};

function sf(t) { const r = 1 - Math.exp(-t / 60); const ref = 1 - Math.exp(-80 / 60); return r / ref; }
function tempReduction(t, loc) { return 4.72 * sf(t) * (loc.avgTemp / 28.5); }
function pvGain(t) { return 2.5 * sf(t); }
function solarGen(t, loc) { return Math.round(BLDG.roofArea * loc.ghi * (BLDG.panelEff + BLDG.bifacialGain + pvGain(t) / 100) * (1 - BLDG.sysLoss) * 365); }
function baselineSolar(loc) { return Math.round(BLDG.roofArea * loc.ghi * (BLDG.panelEff + BLDG.bifacialGain) * (1 - BLDG.sysLoss) * 365); }
function coolingReduction(t, loc) {
  const f = Math.min(0.70 * sf(t), 0.72);
  const base = BLDG.coolingLoad * (loc.cdd / 3200);
  return { pct: Math.round(f * 1000) / 10, saved: Math.round(base * f), baseline: Math.round(base) };
}
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
  const net = coolSav + solSav - maint;
  const payback = net > 0 ? totalInit / net : Infinity;
  const roi = net > 0 ? ((net * 25 - totalInit) / totalInit) * 100 : 0;
  return {
    gwCost: Math.round(gwCost), pvCost: Math.round(pvCost),
    totalInit: Math.round(totalInit), maint: Math.round(maint),
    coolSav: Math.round(coolSav), solSav: Math.round(solSav),
    net: Math.round(net), payback: Math.round(payback * 10) / 10,
    roi: Math.round(roi * 10) / 10,
  };
}
function monthlyEnergy(t, loc) {
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const sf2 = [0.85,0.90,1.00,1.10,1.15,1.05,0.95,0.90,0.95,1.00,0.90,0.80];
  const cf  = [0.65,0.70,0.85,1.10,1.25,1.20,1.15,1.10,1.00,0.90,0.75,0.60];
  const sol  = solarGen(t, loc);
  const cool = coolingReduction(t, loc);
  return months.map((m, i) => ({
    month: m,
    solar: Math.round((sol / 12) * sf2[i]),
    coolingSaved: Math.round((cool.saved / 12) * cf[i]),
    baselineCooling: Math.round((cool.baseline / 12) * cf[i]),
  }));
}
function calcAll(t, locKey) {
  const loc  = LOCATIONS[locKey];
  const tr   = tempReduction(t, loc);
  const pg   = pvGain(t);
  const sg   = solarGen(t, loc);
  const bs   = baselineSolar(loc);
  const cool = coolingReduction(t, loc);
  const cost = costAnalysis(t, loc);
  return {
    loc, t,
    tr:  Math.round(tr * 100) / 100,
    pg:  Math.round(pg * 100) / 100,
    sg, bs, extra: sg - bs, cool, cost,
    mEnergy: monthlyEnergy(t, loc),
    co2: Math.round((sg * 0.0007 + cool.saved * 0.0007) * 10) / 10,
  };
}

// ═══════════════════════════════════════════════════════════════
// 3-D VIEWER
// ═══════════════════════════════════════════════════════════════

function Building3DViewer({ thickness, greenOn }) {
  return (
    <div style={{ width:"100%", height:"100%", position:"relative",
      background:"radial-gradient(ellipse at center bottom,#0d1f0d,#060c06)",
      borderRadius:8, overflow:"hidden" }}>
      <iframe
        title="BINONDOMINIUM"
        frameBorder="0" allowFullScreen
        allow="autoplay; fullscreen; xr-spatial-tracking"
        src="https://sketchfab.com/models/6f5216d1af3541329d8537b7e738ef30/embed"
        style={{ width:"100%", height:"100%", border:"none", position:"absolute", top:0, left:0 }}
      />
      {greenOn && thickness > 0 && (
        <div style={{ position:"absolute", bottom:16, right:16,
          background:"rgba(0,0,0,0.7)", backdropFilter:"blur(8px)",
          padding:"6px 14px", borderRadius:20, fontSize:12,
          fontFamily:"monospace", color:"#4ade80",
          border:"1px solid rgba(74,222,128,0.3)", pointerEvents:"none", zIndex:10 }}>
          🌿 Green Wall: {thickness}mm
        </div>
      )}
      <div style={{ position:"absolute", bottom:16, left:16,
        background:"rgba(0,0,0,0.5)", padding:"4px 10px", borderRadius:16,
        fontSize:10, fontFamily:"monospace", color:"#aaa",
        pointerEvents:"none", zIndex:10 }}>
        🖱️ Drag to rotate | Right-click to pan | Scroll to zoom
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// SHARED UI PIECES
// ═══════════════════════════════════════════════════════════════

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:"rgba(10,20,10,0.97)", border:"1px solid rgba(74,222,128,0.25)",
      borderRadius:8, padding:"10px 14px", fontFamily:"'JetBrains Mono',monospace", fontSize:11 }}>
      <div style={{ color:"#8faa8f", marginBottom:6, fontWeight:600 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ display:"flex", gap:10, alignItems:"center", marginBottom:2 }}>
          <span style={{ width:8, height:8, borderRadius:2, background:p.color, flexShrink:0 }} />
          <span style={{ color:"#b0c8b0" }}>{p.name}:</span>
          <span style={{ color:"#e4efe4", fontWeight:600 }}>
            {typeof p.value === "number" ? p.value.toLocaleString() : p.value}
          </span>
        </div>
      ))}
    </div>
  );
};

const LegendRow = ({ items }) => (
  <div style={{ display:"flex", justifyContent:"center", gap:24, marginBottom:16, flexWrap:"wrap" }}>
    {items.map(([color, label]) => (
      <span key={label} style={{ display:"flex", alignItems:"center", gap:6, fontSize:12, color:"#8faa8f" }}>
        <span style={{ width:10, height:10, borderRadius:2, background:color }} />{label}
      </span>
    ))}
  </div>
);

const SummaryBox = ({ children }) => (
  <div style={{ textAlign:"center", fontSize:13, color:"#8faa8f",
    padding:"12px 16px", background:"#1e2e1e", borderRadius:8, marginTop:12 }}>
    {children}
  </div>
);

const Hi = ({ color, children }) => (
  <strong style={{ color, fontFamily:"'JetBrains Mono'" }}>{children}</strong>
);

// ═══════════════════════════════════════════════════════════════
// TEMPERATURE CHART — two bars, always-visible labels, Cell colors
// ═══════════════════════════════════════════════════════════════

function TempChart({ d, thickness }) {
  const COLORS = ["#ef4444", "#4ade80"];
  const data = [
    { label: "Without GW", temp: d.loc.avgTemp },
    { label: "With GW",    temp: Math.round((d.loc.avgTemp - d.tr) * 10) / 10 },
  ];

  const renderLabel = ({ x, y, width, value, index }) => (
    <text
      x={x + width / 2} y={y - 12}
      textAnchor="middle" dominantBaseline="auto"
      fontSize={17} fontWeight={700}
      fontFamily="'JetBrains Mono', monospace"
      fill={COLORS[index]}
    >
      {value}°C
    </text>
  );

  return (
    <div>
      <LegendRow items={[["#ef4444","Without Green Wall"],["#4ade80","With Green Wall"]]} />
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} barCategoryGap="55%"
          margin={{ top:40, right:30, left:10, bottom:10 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label"
            tick={{ fill:"#8faa8f", fontSize:13, fontFamily:"'JetBrains Mono'", fontWeight:600 }}
            axisLine={false} tickLine={false} />
          <YAxis
            domain={[20, Math.ceil(d.loc.avgTemp + 6)]}
            tick={{ fill:"#5a7a5a", fontSize:11, fontFamily:"'JetBrains Mono'" }}
            tickFormatter={v => `${v}°C`}
            axisLine={false} tickLine={false} />
          <Tooltip content={<CustomTooltip />} cursor={{ fill:"rgba(74,222,128,0.05)" }} />
          <Bar dataKey="temp" name="Temperature" radius={[8,8,0,0]}
            isAnimationActive label={renderLabel}>
            {data.map((_, i) => <Cell key={i} fill={COLORS[i]} opacity={0.85} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <SummaryBox>
        Reduction: <Hi color="#4ade80">{d.tr}°C</Hi> at {thickness}mm
        &nbsp;·&nbsp;
        <Hi color="#ef4444">{d.loc.avgTemp}°C</Hi> → <Hi color="#4ade80">{(d.loc.avgTemp - d.tr).toFixed(1)}°C</Hi>
      </SummaryBox>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// ENERGY CHART
// ═══════════════════════════════════════════════════════════════

function EnergyChart({ d }) {
  return (
    <div>
      <LegendRow items={[
        ["#fbbf24","Solar Generation"],
        ["#38bdf8","Cooling Saved"],
        ["rgba(239,68,68,0.45)","Baseline Cooling"],
      ]} />
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={d.mEnergy} barCategoryGap="20%" barGap={2}
          margin={{ top:10, right:20, left:10, bottom:10 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="month"
            tick={{ fill:"#5a7a5a", fontSize:11, fontFamily:"'JetBrains Mono'" }}
            axisLine={false} tickLine={false} />
          <YAxis
            tick={{ fill:"#5a7a5a", fontSize:11, fontFamily:"'JetBrains Mono'" }}
            tickFormatter={v => `${(v/1000).toFixed(0)}k`}
            axisLine={false} tickLine={false} />
          <Tooltip content={<CustomTooltip />} cursor={{ fill:"rgba(74,222,128,0.05)" }} />
          <Bar dataKey="solar"           name="Solar (kWh)"            fill="#fbbf24" radius={[4,4,0,0]} opacity={0.85} />
          <Bar dataKey="coolingSaved"    name="Cooling Saved (kWh)"    fill="#38bdf8" radius={[4,4,0,0]} opacity={0.85} />
          <Bar dataKey="baselineCooling" name="Baseline Cooling (kWh)" fill="#ef4444" radius={[4,4,0,0]} opacity={0.30} />
        </BarChart>
      </ResponsiveContainer>
      <SummaryBox>
        Annual: <Hi color="#fbbf24">{(d.sg/1000).toFixed(1)} MWh</Hi> solar
        &nbsp;+&nbsp;
        <Hi color="#38bdf8">{(d.cool.saved/1000).toFixed(1)} MWh</Hi> cooling saved
      </SummaryBox>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// COST CHART
// ═══════════════════════════════════════════════════════════════

function CostChart({ d, cashflow, cur, fmt }) {
  return (
    <div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:20 }}>
        <div style={{ padding:14, borderRadius:10,
          border:"1px solid rgba(239,68,68,0.18)", background:"rgba(239,68,68,0.04)" }}>
          <div style={{ fontSize:10, fontWeight:600, textTransform:"uppercase",
            letterSpacing:"0.05em", color:"#5a7a5a", marginBottom:10 }}>Initial Investment</div>
          {[["Green Wall System",d.cost.gwCost],["Bifacial Solar Panels",d.cost.pvCost]].map(([l,v]) => (
            <div key={l} style={{ display:"flex", justifyContent:"space-between",
              padding:"4px 0", fontSize:13, color:"#8faa8f" }}>
              <span>{l}</span>
              <span style={{ fontFamily:"'JetBrains Mono'" }}>{cur}{fmt(v)}</span>
            </div>
          ))}
          <div style={{ display:"flex", justifyContent:"space-between",
            borderTop:"1px solid rgba(74,140,74,0.12)", marginTop:8, paddingTop:8,
            fontWeight:600, fontSize:14 }}>
            <span>Total</span>
            <span style={{ fontFamily:"'JetBrains Mono'", color:"#ef4444" }}>{cur}{fmt(d.cost.totalInit)}</span>
          </div>
        </div>
        <div style={{ padding:14, borderRadius:10,
          border:"1px solid rgba(74,222,128,0.18)", background:"rgba(74,222,128,0.04)" }}>
          <div style={{ fontSize:10, fontWeight:600, textTransform:"uppercase",
            letterSpacing:"0.05em", color:"#5a7a5a", marginBottom:10 }}>Annual Returns</div>
          {[["Cooling Savings",d.cost.coolSav,true],["Solar Savings",d.cost.solSav,true],["Maintenance",d.cost.maint,false]].map(([l,v,pos]) => (
            <div key={l} style={{ display:"flex", justifyContent:"space-between",
              padding:"4px 0", fontSize:13, color:"#8faa8f" }}>
              <span>{l}</span>
              <span style={{ fontFamily:"'JetBrains Mono'", color:pos?"#4ade80":"#ef4444" }}>
                {pos?"+":"-"}{cur}{fmt(v)}
              </span>
            </div>
          ))}
          <div style={{ display:"flex", justifyContent:"space-between",
            borderTop:"1px solid rgba(74,140,74,0.12)", marginTop:8, paddingTop:8,
            fontWeight:600, fontSize:14 }}>
            <span>Net Annual</span>
            <span style={{ fontFamily:"'JetBrains Mono'", color:"#4ade80" }}>+{cur}{fmt(d.cost.net)}</span>
          </div>
        </div>
      </div>

      <h3 style={{ fontSize:13, fontWeight:600, color:"#8faa8f", marginBottom:10 }}>
        Cumulative Cash Flow (25 Years)
      </h3>
      <ResponsiveContainer width="100%" height={240}>
        <AreaChart data={cashflow} margin={{ top:10, right:20, left:10, bottom:10 }}>
          <defs>
            <linearGradient id="cashGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#4ade80" stopOpacity={0.28} />
              <stop offset="60%"  stopColor="#4ade80" stopOpacity={0.04} />
              <stop offset="100%" stopColor="#ef4444" stopOpacity={0.12} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="year"
            tick={{ fill:"#5a7a5a", fontSize:10, fontFamily:"'JetBrains Mono'" }}
            tickFormatter={v => `Y${v}`} axisLine={false} tickLine={false} />
          <YAxis
            tick={{ fill:"#5a7a5a", fontSize:10, fontFamily:"'JetBrains Mono'" }}
            tickFormatter={v => v >= 0
              ? `${cur}${(v/1000).toFixed(0)}k`
              : `-${cur}${(Math.abs(v)/1000).toFixed(0)}k`}
            axisLine={false} tickLine={false} />
          <Tooltip content={<CustomTooltip />} cursor={{ stroke:"rgba(74,222,128,0.2)" }} />
          <ReferenceLine y={0} stroke="rgba(255,255,255,0.18)" strokeDasharray="5 4"
            label={{ value:"Break-even", position:"insideTopRight", fill:"#5a7a5a", fontSize:10 }} />
          <Area type="monotone" dataKey="value" name={`Cumulative (${cur})`}
            stroke="#4ade80" fill="url(#cashGrad)" strokeWidth={2} dot={false} />
        </AreaChart>
      </ResponsiveContainer>

      <SummaryBox>
        Payback in <Hi color="#a78bfa">{d.cost.payback} years</Hi>
        &nbsp;·&nbsp;25-year ROI: <Hi color="#4ade80">{d.cost.roi}%</Hi>
      </SummaryBox>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN DASHBOARD
// ═══════════════════════════════════════════════════════════════

export default function GreenWallDashboard() {
  const [thickness, setThickness] = useState(80);
  const [locKey,    setLocKey]    = useState("manila");
  const [greenOn,   setGreenOn]   = useState(true);
  const [chartTab,  setChartTab]  = useState("temp");

  const d   = useMemo(() => calcAll(thickness, locKey), [thickness, locKey]);
  const fmt = n => n?.toLocaleString() ?? "—";
  const cur = d.loc.currency;

  const cashflow = useMemo(() => {
    let cum = -d.cost.totalInit;
    const arr = [{ year:0, value: cum }];
    for (let y = 1; y <= 25; y++) { cum += d.cost.net; arr.push({ year:y, value: Math.round(cum) }); }
    return arr;
  }, [d]);

  const metrics = [
    { icon:"🌡️", label:"Temperature Reduction",  value:`${d.tr}°C`,                    sub:`Building: ${(d.loc.avgTemp-d.tr).toFixed(1)}°C (from ${d.loc.avgTemp}°C)`,   accent:"#38bdf8" },
    { icon:"❄️", label:"Cooling Energy Saved",    value:`${d.cool.pct}%`,               sub:`${fmt(d.cool.saved)} kWh/year saved`,                                         accent:"#60a5fa" },
    { icon:"☀️", label:"Solar Generation",        value:`${(d.sg/1000).toFixed(1)} MWh`,sub:`+${fmt(d.extra)} kWh from GW cooling`,                                        accent:"#fbbf24" },
    { icon:"⚡", label:"PV Efficiency Boost",     value:`+${d.pg}%`,                    sub:`Total efficiency: ${(30+d.pg).toFixed(1)}%`,                                  accent:"#f59e0b" },
    { icon:"💰", label:"Annual Net Savings",      value:`${cur}${fmt(d.cost.net)}`,     sub:`Cooling: ${cur}${fmt(d.cost.coolSav)} · Solar: ${cur}${fmt(d.cost.solSav)}`,  accent:"#34d399" },
    { icon:"📈", label:"Payback Period",          value:`${d.cost.payback} yrs`,        sub:`25-year ROI: ${d.cost.roi}%`,                                                 accent:"#a78bfa" },
    { icon:"🌍", label:"CO₂ Avoided",             value:`${d.co2} t/yr`,               sub:`${(d.co2*25).toFixed(0)} tonnes over lifetime`,                               accent:"#4ade80" },
    { icon:"🏗️", label:"Total Investment",        value:`${cur}${fmt(d.cost.totalInit)}`,sub:`GW: ${cur}${fmt(d.cost.gwCost)} · PV: ${cur}${fmt(d.cost.pvCost)}`,         accent:"#fb923c" },
  ];

  return (
    <div style={{ minHeight:"100vh", background:"#0a0f0a", color:"#e4efe4",
      fontFamily:"'DM Sans','Segoe UI',sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');
        *{margin:0;padding:0;box-sizing:border-box}
        ::-webkit-scrollbar{width:5px}
        ::-webkit-scrollbar-thumb{background:#2a4a2a;border-radius:3px}
        @keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
        .card{background:#141e14;border:1px solid rgba(74,140,74,0.15);border-radius:12px;transition:all .25s}
        .card:hover{border-color:rgba(74,140,74,0.3);box-shadow:0 8px 32px rgba(0,0,0,0.3)}
        .mcard{position:relative;overflow:hidden;animation:fadeUp .4s ease-out both}
        .mcard::before{content:'';position:absolute;top:0;left:0;width:3px;height:100%;background:var(--accent);opacity:.7;border-radius:3px 0 0 3px}
        .slider{-webkit-appearance:none;width:100%;height:6px;border-radius:3px;background:linear-gradient(90deg,#1e2e1e,rgba(74,222,128,0.2));outline:none;cursor:pointer}
        .slider::-webkit-slider-thumb{-webkit-appearance:none;width:22px;height:22px;border-radius:50%;background:#4ade80;box-shadow:0 0 14px rgba(74,222,128,0.45);cursor:grab;transition:transform .15s}
        .slider::-webkit-slider-thumb:hover{transform:scale(1.15)}
        .loc-btn{padding:8px 12px;border:1px solid rgba(74,140,74,0.15);border-radius:8px;background:transparent;color:#8faa8f;cursor:pointer;font-family:inherit;font-size:12px;transition:all .2s;text-align:left;width:100%}
        .loc-btn:hover{background:#1e2e1e;color:#e4efe4;border-color:rgba(74,140,74,0.3)}
        .loc-btn.active{background:rgba(74,222,128,0.1);border-color:rgba(74,222,128,0.35);color:#4ade80}
        .tab-btn{padding:7px 16px;border:none;border-radius:7px;background:transparent;color:#5a7a5a;font-family:inherit;font-size:12px;font-weight:500;cursor:pointer;transition:all .2s}
        .tab-btn:hover{color:#e4efe4}
        .tab-btn.active{background:rgba(74,222,128,0.12);color:#4ade80}
        .toggle{width:42px;height:24px;border-radius:12px;background:#1e2e1e;border:1px solid rgba(74,140,74,0.2);cursor:pointer;position:relative;transition:all .25s}
        .toggle.on{background:rgba(74,222,128,0.15);border-color:rgba(74,222,128,0.4)}
        .tdot{width:18px;height:18px;border-radius:50%;background:#5a7a5a;position:absolute;top:2px;left:2px;transition:all .25s}
        .toggle.on .tdot{left:20px;background:#4ade80;box-shadow:0 0 10px rgba(74,222,128,0.5)}
        .recharts-cartesian-grid-horizontal line{stroke:rgba(74,140,74,0.1)}
        iframe{pointer-events:auto}
      `}</style>

      {/* HEADER */}
      <header style={{ position:"sticky", top:0, zIndex:50,
        background:"rgba(10,15,10,0.9)", backdropFilter:"blur(20px)",
        borderBottom:"1px solid rgba(74,140,74,0.15)", padding:"12px 24px" }}>
        <div style={{ maxWidth:1400, margin:"0 auto", display:"flex",
          alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:12 }}>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <div style={{ width:38, height:38, borderRadius:10,
              background:"rgba(74,222,128,0.12)", display:"flex",
              alignItems:"center", justifyContent:"center", fontSize:18 }}>🌿</div>
            <div>
              <h1 style={{ fontSize:16, fontWeight:700, letterSpacing:"-0.02em" }}>
                Integrating Vertical Green Walls with Bifacial Solar Panels
              </h1>
              <p style={{ fontSize:11, color:"#5a7a5a", marginTop:1 }}>
                Interactive Performance Dashboard — Research-Validated Simulation
              </p>
            </div>
          </div>
          <span style={{ padding:"4px 10px", borderRadius:6, fontSize:10, fontWeight:600,
            textTransform:"uppercase", letterSpacing:"0.05em",
            background:"#1e2e1e", color:"#8faa8f", border:"1px solid rgba(74,140,74,0.15)" }}>
            Simulation
          </span>
        </div>
      </header>

      <main style={{ maxWidth:1400, margin:"0 auto", padding:"20px 24px",
        display:"flex", flexDirection:"column", gap:20 }}>

        {/* TOP ROW */}
        <div style={{ display:"grid", gridTemplateColumns:"300px 1fr", gap:16, alignItems:"start" }}>

          {/* Controls */}
          <div className="card" style={{ padding:20, display:"flex", flexDirection:"column", gap:18 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <span style={{ fontSize:14 }}>⚙</span>
              <h2 style={{ fontSize:12, fontWeight:600, textTransform:"uppercase",
                letterSpacing:"0.06em", color:"#8faa8f" }}>Simulation Controls</h2>
            </div>
            <div>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                <span style={{ fontSize:13, fontWeight:500 }}>Green Wall Thickness</span>
                <span style={{ fontFamily:"'JetBrains Mono'", fontSize:14, fontWeight:600,
                  color:"#4ade80", background:"rgba(74,222,128,0.12)",
                  padding:"2px 10px", borderRadius:6 }}>{thickness} mm</span>
              </div>
              <input type="range" min="0" max="200" step="5"
                value={thickness} onChange={e => setThickness(+e.target.value)} className="slider" />
              <div style={{ display:"flex", justifyContent:"space-between",
                fontSize:10, color:"#5a7a5a", fontFamily:"'JetBrains Mono'", marginTop:4 }}>
                <span>0 mm</span>
                <span style={{ color:"rgba(74,222,128,0.6)" }}>80 mm (ref.)</span>
                <span>200 mm</span>
              </div>
            </div>
            <div>
              <div style={{ fontSize:13, fontWeight:500, marginBottom:8 }}>Location</div>
              <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                {Object.entries(LOCATIONS).map(([k,v]) => (
                  <button key={k} className={`loc-btn ${locKey===k?"active":""}`} onClick={() => setLocKey(k)}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                      <span style={{ fontWeight:500 }}>{v.name.split(",")[0]}</span>
                      <span style={{ fontFamily:"'JetBrains Mono'", fontSize:10, opacity:0.7 }}>{v.ghi} kWh/m²/d</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <span style={{ fontSize:13, fontWeight:500 }}>Show Green Walls</span>
              <div className={`toggle ${greenOn?"on":""}`} onClick={() => setGreenOn(!greenOn)}>
                <div className="tdot" />
              </div>
            </div>
          </div>

          {/* 3D Viewer */}
          <div className="card" style={{ overflow:"hidden" }}>
            <div style={{ padding:"12px 16px", borderBottom:"1px solid rgba(74,140,74,0.12)",
              display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <h2 style={{ fontSize:14, fontWeight:600 }}>🏢 Building 3D Model (BINONDOMINIUM)</h2>
              <div style={{ display:"flex", gap:8 }}>
                {[`🌿 ${thickness}mm`,`☀️ ${(d.sg/1000).toFixed(1)} MWh/yr`].map(t => (
                  <span key={t} style={{ padding:"3px 10px", borderRadius:6, fontSize:10,
                    fontFamily:"'JetBrains Mono'", background:"#1e2e1e",
                    border:"1px solid rgba(74,140,74,0.12)", color:"#8faa8f" }}>{t}</span>
                ))}
              </div>
            </div>
            <div style={{ height:450 }}>
              <Building3DViewer thickness={thickness} greenOn={greenOn} />
            </div>
          </div>
        </div>

        {/* METRICS */}
        <div>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
            <h2 style={{ fontSize:16, fontWeight:700 }}>Performance Metrics</h2>
            <span style={{ padding:"4px 12px", borderRadius:6, fontSize:11,
              fontFamily:"'JetBrains Mono'", background:"#141e14",
              border:"1px solid rgba(74,140,74,0.12)", color:"#5a7a5a" }}>
              {thickness}mm · {d.loc.name}
            </span>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))", gap:12 }}>
            {metrics.map((c,i) => (
              <div key={i} className="card mcard"
                style={{ "--accent":c.accent, padding:16, display:"flex", gap:12, animationDelay:`${i*50}ms` }}>
                <div style={{ fontSize:22, flexShrink:0, marginTop:2 }}>{c.icon}</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:10, fontWeight:500, color:"#5a7a5a",
                    textTransform:"uppercase", letterSpacing:"0.04em", marginBottom:4 }}>{c.label}</div>
                  <div style={{ fontFamily:"'JetBrains Mono'", fontSize:22,
                    fontWeight:700, color:c.accent, lineHeight:1.1 }}>{c.value}</div>
                  <div style={{ fontSize:11, color:"#5a7a5a", marginTop:5, lineHeight:1.4 }}>{c.sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CHARTS */}
        <div className="card" style={{ overflow:"hidden" }}>
          <div style={{ padding:"14px 18px", borderBottom:"1px solid rgba(74,140,74,0.12)",
            display:"flex", justifyContent:"space-between", alignItems:"center",
            flexWrap:"wrap", gap:10 }}>
            <h2 style={{ fontSize:14, fontWeight:600 }}>Performance Analysis</h2>
            <div style={{ display:"flex", gap:4, background:"#0a0f0a", padding:3, borderRadius:8 }}>
              {[["temp","Temperature"],["energy","Energy"],["cost","Cost Analysis"]].map(([id,label]) => (
                <button key={id} className={`tab-btn ${chartTab===id?"active":""}`}
                  onClick={() => setChartTab(id)}>{label}</button>
              ))}
            </div>
          </div>
          <div style={{ padding:20 }}>
            {chartTab === "temp"   && <TempChart d={d} thickness={thickness} />}
            {chartTab === "energy" && <EnergyChart d={d} />}
            {chartTab === "cost"   && <CostChart d={d} cashflow={cashflow} cur={cur} fmt={fmt} />}
          </div>
        </div>
      </main>

      <footer style={{ textAlign:"center", padding:24,
        borderTop:"1px solid rgba(74,140,74,0.12)", background:"#0d120d" }}>
        <p style={{ fontSize:13, color:"#8faa8f", fontWeight:500 }}>
          Integrating Vertical Green Walls with Bifacial Solar Panels — Simulation Dashboard
        </p>
        <p style={{ fontSize:10, color:"#3a5a3a", marginTop:6, maxWidth:700, margin:"6px auto 0" }}>
          Data from published research. Values scale with substrate thickness (0–200mm)
          using exponential saturation model. For academic demonstration only.
        </p>
      </footer>
    </div>
  );
}
