'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';

/* ═══════════════════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════════════════ */

interface NodeDef {
  id: string; label: string; tier: number; region: string; type: string; reliability: number;
}
interface EdgeDef {
  source: string; target: string; cost: number; lead_time: number; capacity: number;
}
interface Scenario {
  name: string; description: string; broken_nodes: string[];
}
interface GraphData {
  nodes: NodeDef[]; edges: EdgeDef[]; scenarios: Record<string, Scenario>;
}
interface SimResult {
  original_route: string[] | null; original_cost: number; original_lead_time: number;
  new_route: string[] | null; new_cost: number | null; new_lead_time: number | null;
  value_at_risk: number | null; path_found: boolean; broken_nodes: string[];
  resilience_score: number; redundancy_index: number; lead_time_delta: number | null;
}
interface MCResult {
  base_cost: number; base_lead_time: number; num_simulations: number;
  var_95: number | null; var_99: number | null; expected_cost: number | null;
  worst_case_cost: number | null; best_case_cost: number | null;
  expected_lead_time: number | null; disruption_rate: number;
  histogram: { range: string; count: number }[];
}

const API = process.env.NEXT_PUBLIC_API_URL || '/api';

// Fixed node positions for SVG (tier-based horizontal, staggered vertical)
const NODE_POSITIONS: Record<string, { x: number; y: number }> = {
  RM_China: { x: 60, y: 140 },
  RM_Vietnam: { x: 60, y: 310 },
  Mfg_India: { x: 240, y: 120 },
  Mfg_Thailand: { x: 240, y: 330 },
  Suez_Canal: { x: 420, y: 100 },
  Port_Singapore: { x: 420, y: 280 },
  Port_Rotterdam: { x: 420, y: 190 },
  DC_NewYork: { x: 610, y: 100 },
  DC_Chicago: { x: 610, y: 220 },
  DC_LA: { x: 610, y: 340 },
  Retail_East: { x: 790, y: 160 },
  Retail_West: { x: 790, y: 300 },
};

const TIER_LABELS = ['Raw Material', 'Manufacturing', 'Logistics', 'Distribution', 'Retail'];
const TIER_COLORS = ['#a78bfa', '#60a5fa', '#f59e0b', '#34d399', '#f472b6'];

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */

export default function Home() {
  const [graph, setGraph] = useState<GraphData | null>(null);
  const [sim, setSim] = useState<SimResult | null>(null);
  const [mc, setMc] = useState<MCResult | null>(null);
  const [broken, setBroken] = useState<string[]>([]);
  const [source, setSource] = useState('RM_China');
  const [target, setTarget] = useState('Retail_East');
  const [loading, setLoading] = useState(false);
  const [mcLoading, setMcLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'scenario' | 'montecarlo'>('scenario');
  const [error, setError] = useState<string | null>(null);

  const fetchGraph = useCallback(async () => {
    try {
      const r = await fetch(`${API}/graph`);
      if (!r.ok) throw new Error(`Graph API returned ${r.status}`);
      setGraph(await r.json());
    } catch (e) { console.error('fetchGraph error:', e); setError(String(e)); }
  }, []);

  const runSim = useCallback(async (nodes: string[]) => {
    setLoading(true);
    setError(null);
    setBroken(nodes);
    try {
      const r = await fetch(`${API}/simulate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ broken_nodes: nodes, source, target }),
      });
      if (!r.ok) throw new Error(`Simulate API returned ${r.status}`);
      setSim(await r.json());
    } catch (e) { console.error('runSim error:', e); setError(String(e)); }
    setLoading(false);
  }, [source, target]);

  const runMC = useCallback(async () => {
    setMcLoading(true);
    try {
      const r = await fetch(`${API}/monte-carlo`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source, target, num_simulations: 1000 }),
      });
      if (!r.ok) throw new Error(`Monte Carlo API returned ${r.status}`);
      setMc(await r.json());
    } catch (e) { console.error('runMC error:', e); }
    setMcLoading(false);
  }, [source, target]);

  useEffect(() => { fetchGraph(); runSim([]); }, []);
  useEffect(() => { runSim(broken); }, [source, target]);

  const toggleNode = (id: string) => {
    const next = broken.includes(id) ? broken.filter(n => n !== id) : [...broken, id];
    runSim(next);
  };

  const applyScenario = (key: string) => {
    if (!graph) return;
    const s = graph.scenarios[key];
    if (s) runSim(s.broken_nodes);
  };

  const sourceNodes = useMemo(() => graph?.nodes.filter(n => n.tier <= 1) ?? [], [graph]);
  const targetNodes = useMemo(() => graph?.nodes.filter(n => n.tier >= 3) ?? [], [graph]);

  return (
    <div className="min-h-screen bg-[#050507] text-neutral-100">
      {/* ── Gradient Background ── */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-600/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-600/5 rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10 max-w-[1400px] mx-auto px-6 py-6 space-y-6">

        {/* ════════ HEADER ════════ */}
        <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 border-b border-white/5 pb-5">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs uppercase tracking-widest text-neutral-500 font-medium">Live Simulator</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Supply Chain Resilience Simulator</h1>
            <p className="text-neutral-500 text-sm mt-1">Enterprise SCRM Stress-Testing &amp; Value-at-Risk Engine</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <Select label="Source" value={source} onChange={(v) => setSource(v)} options={sourceNodes.map(n => ({ value: n.id, label: n.label }))} />
            <span className="text-neutral-600">→</span>
            <Select label="Target" value={target} onChange={(v) => setTarget(v)} options={targetNodes.map(n => ({ value: n.id, label: n.label }))} />
            <button onClick={() => { setBroken([]); runSim([]); setMc(null); }}
              className="px-4 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider bg-white/5 hover:bg-white/10 border border-white/10 transition-all">
              ↻ Reset
            </button>
          </div>
        </header>

        {/* ════════ TOP METRICS BAR ════════ */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <MetricCard label="Baseline Cost" value={sim ? `$${sim.original_cost}` : '—'} />
          <MetricCard label="Current Cost" value={sim?.new_cost != null ? `$${sim.new_cost}` : 'N/A'} accent={sim && sim.new_cost != null && sim.new_cost > sim.original_cost ? 'orange' : undefined} />
          <MetricCard label="Value at Risk" value={sim?.value_at_risk != null ? `+$${sim.value_at_risk}` : '$0'} accent={sim && sim.value_at_risk != null && sim.value_at_risk > 0 ? 'red' : 'green'} />
          <MetricCard label="Resilience Score" value={sim ? `${sim.resilience_score}/100` : '—'} accent={sim && sim.resilience_score < 60 ? 'red' : sim && sim.resilience_score < 80 ? 'orange' : 'green'} />
          <MetricCard label="Lead Time Δ" value={sim?.lead_time_delta != null ? `+${sim.lead_time_delta} days` : '0 days'} accent={sim && sim.lead_time_delta != null && sim.lead_time_delta > 5 ? 'orange' : undefined} />
        </div>

        {/* ════════ MAIN GRID ════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">

          {/* ── Left Sidebar ── */}
          <div className="lg:col-span-1 space-y-4">
            {/* Tab Switcher */}
            <div className="flex rounded-lg overflow-hidden border border-white/10">
              <button onClick={() => setActiveTab('scenario')}
                className={`flex-1 px-3 py-2 text-xs font-semibold uppercase tracking-wider transition-colors ${activeTab === 'scenario' ? 'bg-blue-600/20 text-blue-400' : 'bg-white/5 text-neutral-500 hover:text-neutral-300'}`}>
                Scenarios
              </button>
              <button onClick={() => { setActiveTab('montecarlo'); if (!mc) runMC(); }}
                className={`flex-1 px-3 py-2 text-xs font-semibold uppercase tracking-wider transition-colors ${activeTab === 'montecarlo' ? 'bg-purple-600/20 text-purple-400' : 'bg-white/5 text-neutral-500 hover:text-neutral-300'}`}>
                Monte Carlo
              </button>
            </div>

            {activeTab === 'scenario' ? (
              <>
                {/* Scenario Presets */}
                <div className="glass rounded-xl p-4 space-y-3">
                  <h3 className="text-xs uppercase tracking-widest text-neutral-500 font-semibold">Black Swan Presets</h3>
                  {graph && Object.entries(graph.scenarios).map(([key, sc]) => (
                    <button key={key} onClick={() => applyScenario(key)}
                      className="w-full text-left p-3 rounded-lg bg-white/[0.02] hover:bg-white/[0.06] border border-white/5 hover:border-white/10 transition-all group">
                      <div className="font-medium text-sm">{sc.name}</div>
                      <div className="text-xs text-neutral-500 mt-1 leading-relaxed">{sc.description}</div>
                    </button>
                  ))}
                </div>

                {/* Route Info */}
                <div className="glass rounded-xl p-4">
                  <h3 className="text-xs uppercase tracking-widest text-neutral-500 font-semibold mb-3">Optimal Route</h3>
                  {!sim?.path_found ? (
                    <div className="text-red-400 text-sm p-3 bg-red-500/10 rounded-lg border border-red-500/20 font-medium">
                      ⚠ No viable path. Supply chain severed.
                    </div>
                  ) : sim?.new_route ? (
                    <div className="space-y-1">
                      {sim.new_route.map((n, i) => (
                        <div key={n} className="flex items-center gap-2 text-xs font-mono">
                          <span className="text-blue-400 w-4">{i + 1}.</span>
                          <span className={broken.includes(n) ? 'text-red-400 line-through' : 'text-neutral-300'}>{n}</span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>

                {/* Redundancy */}
                <div className="glass rounded-xl p-4">
                  <h3 className="text-xs uppercase tracking-widest text-neutral-500 font-semibold mb-3">Network Redundancy</h3>
                  <div className="relative h-3 bg-white/5 rounded-full overflow-hidden">
                    <div className="absolute inset-y-0 left-0 rounded-full transition-all duration-700"
                      style={{ width: `${sim?.redundancy_index ?? 0}%`, background: `linear-gradient(90deg, #3b82f6, #8b5cf6)` }} />
                  </div>
                  <div className="text-right text-xs text-neutral-500 mt-1">{sim?.redundancy_index ?? 0}% paths surviving</div>
                </div>
              </>
            ) : (
              /* Monte Carlo Panel */
              <div className="glass rounded-xl p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs uppercase tracking-widest text-neutral-500 font-semibold">Monte Carlo VaR</h3>
                  <button onClick={runMC} disabled={mcLoading}
                    className="text-xs px-3 py-1 rounded bg-purple-600/20 text-purple-400 hover:bg-purple-600/30 transition-colors disabled:opacity-40">
                    {mcLoading ? 'Running…' : '▶ Run 1K Sims'}
                  </button>
                </div>
                {mc ? (
                  <div className="space-y-3 animate-fade-in">
                    <div className="grid grid-cols-2 gap-2">
                      <MCMetric label="VaR (95%)" value={mc.var_95 != null ? `+$${mc.var_95}` : 'N/A'} />
                      <MCMetric label="VaR (99%)" value={mc.var_99 != null ? `+$${mc.var_99}` : 'N/A'} />
                      <MCMetric label="Expected Cost" value={mc.expected_cost != null ? `$${mc.expected_cost}` : 'N/A'} />
                      <MCMetric label="Worst Case" value={mc.worst_case_cost != null ? `$${mc.worst_case_cost}` : 'N/A'} />
                      <MCMetric label="Disruption Rate" value={`${mc.disruption_rate}%`} />
                      <MCMetric label="Avg Lead Time" value={mc.expected_lead_time != null ? `${mc.expected_lead_time}d` : 'N/A'} />
                    </div>
                    {/* Histogram */}
                    <div>
                      <div className="text-xs text-neutral-500 mb-2">Cost Distribution ({mc.num_simulations} sims)</div>
                      <div className="flex items-end gap-[2px] h-24">
                        {mc.histogram.map((b, i) => {
                          const maxCount = Math.max(...mc.histogram.map(h => h.count), 1);
                          const h = (b.count / maxCount) * 100;
                          return (
                            <div key={i} className="flex-1 group relative">
                              <div className="bg-gradient-to-t from-purple-600/60 to-blue-500/60 rounded-t-sm transition-all hover:from-purple-500 hover:to-blue-400"
                                style={{ height: `${h}%` }} />
                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block bg-neutral-800 text-[10px] px-2 py-1 rounded whitespace-nowrap z-20">
                                {b.range}: {b.count}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-neutral-600">Click ▶ to run Monte Carlo simulation</p>
                )}
              </div>
            )}
          </div>

          {/* ── Network Topology SVG ── */}
          <div className="lg:col-span-3 glass rounded-xl p-5 min-h-[500px] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs uppercase tracking-widest text-neutral-500 font-semibold">Network Topology</h2>
              <div className="flex gap-3">
                {TIER_LABELS.map((l, i) => (
                  <div key={l} className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full" style={{ background: TIER_COLORS[i] }} />
                    <span className="text-[10px] text-neutral-500">{l}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex-1 relative bg-[#08080c] rounded-lg border border-white/5 overflow-hidden">
              <svg viewBox="0 0 870 450" className="w-full h-full" preserveAspectRatio="xMidYMid meet">
                <defs>
                  <marker id="arrow" viewBox="0 0 10 8" refX="10" refY="4" markerWidth="8" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 0 L 10 4 L 0 8 z" fill="rgba(255,255,255,0.15)" />
                  </marker>
                  <marker id="arrow-active" viewBox="0 0 10 8" refX="10" refY="4" markerWidth="8" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 0 L 10 4 L 0 8 z" fill="#3b82f6" />
                  </marker>
                </defs>

                {/* Edges */}
                {graph?.edges.map((e, i) => {
                  const from = NODE_POSITIONS[e.source];
                  const to = NODE_POSITIONS[e.target];
                  if (!from || !to) return null;
                  const isBrokenEdge = broken.includes(e.source) || broken.includes(e.target);
                  const isActive = sim?.new_route && sim.new_route.includes(e.source) && sim.new_route.includes(e.target)
                    && Math.abs(sim.new_route.indexOf(e.target) - sim.new_route.indexOf(e.source)) === 1;
                  return (
                    <g key={`edge-${i}`}>
                      <line x1={from.x + 40} y1={from.y + 18} x2={to.x - 5} y2={to.y + 18}
                        stroke={isBrokenEdge ? 'rgba(239,68,68,0.3)' : isActive ? '#3b82f6' : 'rgba(255,255,255,0.08)'}
                        strokeWidth={isActive ? 2.5 : 1}
                        strokeDasharray={isBrokenEdge ? '6 4' : isActive ? '8 4' : 'none'}
                        markerEnd={isActive ? 'url(#arrow-active)' : 'url(#arrow)'}
                        className={isActive ? 'animate-flow' : ''}
                      />
                      {!isBrokenEdge && (
                        <text x={(from.x + 40 + to.x - 5) / 2} y={(from.y + to.y) / 2 + 14}
                          textAnchor="middle" className="fill-neutral-600 text-[9px]">
                          ${e.cost}
                        </text>
                      )}
                    </g>
                  );
                })}

                {/* Nodes */}
                {graph?.nodes.map(n => {
                  const pos = NODE_POSITIONS[n.id];
                  if (!pos) return null;
                  const isBrk = broken.includes(n.id);
                  const inRoute = sim?.new_route?.includes(n.id) ?? false;
                  const tierColor = TIER_COLORS[n.tier] ?? '#888';
                  return (
                    <g key={n.id} onClick={() => toggleNode(n.id)} className="cursor-pointer" style={{ filter: isBrk ? 'drop-shadow(0 0 8px rgba(239,68,68,0.5))' : inRoute ? 'drop-shadow(0 0 8px rgba(59,130,246,0.4))' : 'none' }}>
                      <rect x={pos.x - 5} y={pos.y} width={90} height={36} rx={8}
                        fill={isBrk ? 'rgba(239,68,68,0.15)' : inRoute ? 'rgba(59,130,246,0.12)' : 'rgba(255,255,255,0.04)'}
                        stroke={isBrk ? '#ef4444' : inRoute ? '#3b82f6' : 'rgba(255,255,255,0.08)'}
                        strokeWidth={isBrk || inRoute ? 1.5 : 0.5} />
                      <circle cx={pos.x + 2} cy={pos.y + 18} r={4} fill={isBrk ? '#ef4444' : tierColor} />
                      <text x={pos.x + 12} y={pos.y + 14} className="text-[9px] fill-neutral-400">{n.type}</text>
                      <text x={pos.x + 12} y={pos.y + 26} className="text-[10px] font-semibold" fill={isBrk ? '#ef4444' : '#e5e5e5'}>
                        {n.id.replace('_', ' ')}
                      </text>
                      {isBrk && (
                        <g>
                          <circle cx={pos.x + 80} cy={pos.y + 4} r={8} fill="#ef4444" />
                          <text x={pos.x + 80} y={pos.y + 8} textAnchor="middle" className="text-[10px] font-bold fill-white">!</text>
                        </g>
                      )}
                    </g>
                  );
                })}
              </svg>
            </div>
            <p className="text-[10px] text-neutral-600 mt-2">Click any node to toggle disruption. Active route shown in blue, broken nodes in red.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   SUB-COMPONENTS
   ═══════════════════════════════════════════════════════════════════════════ */

function MetricCard({ label, value, accent }: { label: string; value: string; accent?: 'red' | 'orange' | 'green' }) {
  const colors: Record<string, string> = { red: 'text-red-400', orange: 'text-amber-400', green: 'text-emerald-400' };
  return (
    <div className="glass rounded-xl px-4 py-3">
      <div className="text-[10px] uppercase tracking-widest text-neutral-500 font-medium">{label}</div>
      <div className={`text-lg font-bold font-mono mt-1 ${accent ? colors[accent] : 'text-white'}`}>{value}</div>
    </div>
  );
}

function MCMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white/[0.02] rounded-lg p-2">
      <div className="text-[9px] uppercase text-neutral-500">{label}</div>
      <div className="text-sm font-mono font-semibold text-neutral-200 mt-0.5">{value}</div>
    </div>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] uppercase tracking-widest text-neutral-500">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-neutral-200 focus:outline-none focus:border-blue-500/50 appearance-none cursor-pointer">
        {options.map(o => <option key={o.value} value={o.value} className="bg-neutral-900">{o.label}</option>)}
      </select>
    </div>
  );
}
