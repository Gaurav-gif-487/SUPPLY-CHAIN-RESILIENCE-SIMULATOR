from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import networkx as nx
from typing import List, Optional, Dict, Any
import random
import math

app = FastAPI(title="Supply Chain Resilience Simulator V2")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Graph Definition ─────────────────────────────────────────────────────────

NODE_DEFS = [
    # Tier 1: Raw Material Suppliers
    {"id": "RM_China",      "label": "China Raw Materials",   "tier": 0, "region": "Asia",    "type": "Raw Material",  "reliability": 0.88},
    {"id": "RM_Vietnam",    "label": "Vietnam Raw Materials", "tier": 0, "region": "Asia",    "type": "Raw Material",  "reliability": 0.90},
    # Tier 2: Manufacturing
    {"id": "Mfg_India",     "label": "India Factory",         "tier": 1, "region": "Asia",    "type": "Manufacturing", "reliability": 0.85},
    {"id": "Mfg_Thailand",  "label": "Thailand Factory",      "tier": 1, "region": "Asia",    "type": "Manufacturing", "reliability": 0.87},
    # Tier 3: Logistics Hubs / Ports
    {"id": "Suez_Canal",    "label": "Suez Canal",            "tier": 2, "region": "Middle East", "type": "Logistics Hub", "reliability": 0.80},
    {"id": "Port_Rotterdam","label": "Rotterdam Port",        "tier": 2, "region": "Europe",  "type": "Logistics Hub", "reliability": 0.92},
    {"id": "Port_Singapore","label": "Singapore Port",        "tier": 2, "region": "Asia",    "type": "Logistics Hub", "reliability": 0.93},
    # Tier 4: Distribution Centers
    {"id": "DC_NewYork",    "label": "New York DC",           "tier": 3, "region": "US",      "type": "Distribution",  "reliability": 0.95},
    {"id": "DC_Chicago",    "label": "Chicago DC",            "tier": 3, "region": "US",      "type": "Distribution",  "reliability": 0.94},
    {"id": "DC_LA",         "label": "Los Angeles DC",        "tier": 3, "region": "US",      "type": "Distribution",  "reliability": 0.93},
    # Tier 5: End Customers
    {"id": "Retail_East",   "label": "Retail East Coast",     "tier": 4, "region": "US",      "type": "End Customer",  "reliability": 0.99},
    {"id": "Retail_West",   "label": "Retail West Coast",     "tier": 4, "region": "US",      "type": "End Customer",  "reliability": 0.99},
]

EDGE_DEFS = [
    # Raw Material → Manufacturing
    {"source": "RM_China",     "target": "Mfg_India",      "cost": 80,  "lead_time": 5,  "capacity": 500},
    {"source": "RM_China",     "target": "Mfg_Thailand",   "cost": 70,  "lead_time": 3,  "capacity": 600},
    {"source": "RM_Vietnam",   "target": "Mfg_India",      "cost": 90,  "lead_time": 4,  "capacity": 400},
    {"source": "RM_Vietnam",   "target": "Mfg_Thailand",   "cost": 60,  "lead_time": 2,  "capacity": 550},
    # Manufacturing → Logistics Hubs
    {"source": "Mfg_India",    "target": "Suez_Canal",     "cost": 120, "lead_time": 7,  "capacity": 800},
    {"source": "Mfg_India",    "target": "Port_Singapore", "cost": 100, "lead_time": 4,  "capacity": 700},
    {"source": "Mfg_Thailand", "target": "Port_Singapore", "cost": 50,  "lead_time": 2,  "capacity": 900},
    {"source": "Mfg_Thailand", "target": "Suez_Canal",     "cost": 140, "lead_time": 8,  "capacity": 600},
    # Logistics Hubs → Distribution
    {"source": "Suez_Canal",     "target": "Port_Rotterdam", "cost": 90,  "lead_time": 6,  "capacity": 1000},
    {"source": "Port_Singapore", "target": "DC_LA",          "cost": 200, "lead_time": 14, "capacity": 700},
    {"source": "Port_Singapore", "target": "Port_Rotterdam", "cost": 150, "lead_time": 18, "capacity": 500},
    {"source": "Port_Rotterdam", "target": "DC_NewYork",     "cost": 180, "lead_time": 10, "capacity": 800},
    {"source": "Port_Rotterdam", "target": "DC_Chicago",     "cost": 210, "lead_time": 12, "capacity": 600},
    {"source": "DC_LA",          "target": "DC_Chicago",     "cost": 80,  "lead_time": 3,  "capacity": 500},
    # Distribution → End Customers
    {"source": "DC_NewYork",  "target": "Retail_East", "cost": 50,  "lead_time": 2, "capacity": 1200},
    {"source": "DC_Chicago",  "target": "Retail_East", "cost": 70,  "lead_time": 3, "capacity": 900},
    {"source": "DC_Chicago",  "target": "Retail_West", "cost": 90,  "lead_time": 4, "capacity": 800},
    {"source": "DC_LA",       "target": "Retail_West", "cost": 40,  "lead_time": 1, "capacity": 1100},
]

SCENARIO_PRESETS = {
    "suez_blockage": {
        "name": "🚢 Suez Canal Blockage",
        "description": "The Suez Canal is blocked, severing the primary Europe-bound route from Asia.",
        "broken_nodes": ["Suez_Canal"],
    },
    "factory_shutdown": {
        "name": "🏭 India Factory Shutdown",
        "description": "Regulatory or pandemic lockdown shuts down major Indian manufacturing.",
        "broken_nodes": ["Mfg_India"],
    },
    "port_congestion": {
        "name": "🌊 Dual Port Congestion",
        "description": "Rotterdam and Singapore ports face severe congestion / capacity crunch.",
        "broken_nodes": ["Port_Rotterdam", "Port_Singapore"],
    },
    "multi_failure": {
        "name": "⚡ Multi-Point Failure",
        "description": "Cascading failures across Suez Canal, India Factory, and LA Distribution.",
        "broken_nodes": ["Suez_Canal", "Mfg_India", "DC_LA"],
    },
}

def create_base_graph() -> nx.DiGraph:
    G = nx.DiGraph()
    for n in NODE_DEFS:
        G.add_node(n["id"], **{k: v for k, v in n.items() if k != "id"})
    for e in EDGE_DEFS:
        G.add_edge(e["source"], e["target"], weight=e["cost"], lead_time=e["lead_time"], capacity=e["capacity"])
    return G

def calculate_route(G: nx.DiGraph, source: str, target: str):
    try:
        path = nx.shortest_path(G, source=source, target=target, weight='weight')
        cost = nx.shortest_path_length(G, source=source, target=target, weight='weight')
        lead_time = sum(G[path[i]][path[i+1]]['lead_time'] for i in range(len(path)-1))
        return path, cost, lead_time
    except (nx.NetworkXNoPath, nx.NodeNotFound):
        return None, float('inf'), float('inf')

def calc_resilience_score(G: nx.DiGraph, source: str, target: str, broken_nodes: List[str]) -> float:
    """Score 0–100 based on path availability and cost stability."""
    base_G = create_base_graph()
    _, base_cost, _ = calculate_route(base_G, source, target)
    if base_cost == float('inf'):
        return 0
    total_alt = 0
    surviving = 0
    for node_id in [n["id"] for n in NODE_DEFS if n["id"] not in (source, target)]:
        test_G = create_base_graph()
        test_G.remove_node(node_id)
        _, alt_cost, _ = calculate_route(test_G, source, target)
        total_alt += 1
        if alt_cost < float('inf'):
            surviving += 1
    redundancy = (surviving / total_alt * 100) if total_alt > 0 else 0
    _, curr_cost, _ = calculate_route(G, source, target)
    cost_stability = max(0, 100 - ((curr_cost - base_cost) / base_cost * 100)) if curr_cost < float('inf') else 0
    score = (redundancy * 0.6 + cost_stability * 0.4)
    return round(min(100, max(0, score)), 1)

# ── Request Models ───────────────────────────────────────────────────────────

VALID_NODE_IDS = {n["id"] for n in NODE_DEFS}

class SimulationRequest(BaseModel):
    broken_nodes: List[str] = []
    source: str = "RM_China"
    target: str = "Retail_East"

class MonteCarloRequest(BaseModel):
    source: str = "RM_China"
    target: str = "Retail_East"
    num_simulations: int = 1000  # capped at 10000 in endpoint

# ── Endpoints ────────────────────────────────────────────────────────────────

@app.get("/")
def root():
    return {"status": "Supply Chain Simulator V2 API"}

@app.get("/graph")
def get_graph():
    return {"nodes": NODE_DEFS, "edges": EDGE_DEFS, "scenarios": SCENARIO_PRESETS}

@app.post("/simulate")
def simulate(req: SimulationRequest):
    # Validate inputs
    if req.source not in VALID_NODE_IDS or req.target not in VALID_NODE_IDS:
        return {"error": "Invalid source or target node."}
    req.broken_nodes = [n for n in req.broken_nodes if n in VALID_NODE_IDS]

    G = create_base_graph()
    orig_path, orig_cost, orig_lt = calculate_route(G, req.source, req.target)

    for node in req.broken_nodes:
        if node in G:
            G.remove_node(node)

    new_path, new_cost, new_lt = calculate_route(G, req.source, req.target)

    # VaR: always apply 40% surcharge when disruption is active
    final_cost = new_cost
    if len(req.broken_nodes) > 0 and new_cost < float('inf'):
        final_cost = new_cost * 1.40

    value_at_risk = (final_cost - orig_cost) if (final_cost < float('inf') and orig_cost < float('inf')) else float('inf')
    if value_at_risk < 0:
        value_at_risk = 0

    resilience = calc_resilience_score(G, req.source, req.target, req.broken_nodes)
    redundancy_index = 0
    base_G = create_base_graph()
    try:
        all_paths = list(nx.all_simple_paths(base_G, req.source, req.target, cutoff=8))
        surviving_paths = list(nx.all_simple_paths(G, req.source, req.target, cutoff=8))
        redundancy_index = round(len(surviving_paths) / max(len(all_paths), 1) * 100, 1)
    except Exception:
        pass

    return {
        "original_route": orig_path,
        "original_cost": orig_cost,
        "original_lead_time": orig_lt,
        "new_route": new_path,
        "new_cost": round(final_cost, 2) if final_cost < float('inf') else None,
        "new_lead_time": new_lt if new_lt < float('inf') else None,
        "value_at_risk": round(value_at_risk, 2) if value_at_risk < float('inf') else None,
        "path_found": new_path is not None,
        "broken_nodes": req.broken_nodes,
        "resilience_score": resilience,
        "redundancy_index": redundancy_index,
        "lead_time_delta": (new_lt - orig_lt) if (new_lt < float('inf') and orig_lt < float('inf')) else None,
    }

@app.post("/monte-carlo")
def monte_carlo(req: MonteCarloRequest):
    # Validate and cap
    if req.source not in VALID_NODE_IDS or req.target not in VALID_NODE_IDS:
        return {"error": "Invalid source or target node."}
    req.num_simulations = min(max(req.num_simulations, 1), 10000)

    base_G = create_base_graph()
    _, base_cost, base_lt = calculate_route(base_G, req.source, req.target)
    if base_cost == float('inf'):
        return {"error": "No baseline path exists."}

    results = []
    node_ids = [n["id"] for n in NODE_DEFS]
    reliabilities = {n["id"]: n["reliability"] for n in NODE_DEFS}

    for _ in range(req.num_simulations):
        G = create_base_graph()
        failed = []
        for nid in node_ids:
            if nid in (req.source, req.target):
                continue
            if random.random() > reliabilities[nid]:
                G.remove_node(nid)
                failed.append(nid)
        _, cost, lt = calculate_route(G, req.source, req.target)
        if cost < float('inf') and len(failed) > 0:
            cost *= 1.40
        results.append({
            "cost": round(cost, 2) if cost < float('inf') else None,
            "lead_time": lt if lt < float('inf') else None,
            "failed_nodes": len(failed),
            "path_exists": cost < float('inf'),
        })

    valid = [r for r in results if r["path_exists"]]
    costs = sorted([r["cost"] for r in valid])
    lead_times = sorted([r["lead_time"] for r in valid if r["lead_time"] is not None])
    
    disruption_rate = sum(1 for r in results if not r["path_exists"]) / len(results) * 100

    # Build histogram buckets
    if costs:
        min_c, max_c = min(costs), max(costs)
        bucket_size = max((max_c - min_c) / 10, 1)
        buckets = []
        for i in range(10):
            lo = min_c + i * bucket_size
            hi = lo + bucket_size
            count = sum(1 for c in costs if lo <= c < hi)
            buckets.append({"range": f"${int(lo)}-${int(hi)}", "count": count})
    else:
        buckets = []

    return {
        "base_cost": base_cost,
        "base_lead_time": base_lt,
        "num_simulations": req.num_simulations,
        "var_95": round(costs[int(len(costs) * 0.95)] - base_cost, 2) if costs else None,
        "var_99": round(costs[int(min(len(costs) * 0.99, len(costs)-1))] - base_cost, 2) if costs else None,
        "expected_cost": round(sum(costs) / len(costs), 2) if costs else None,
        "worst_case_cost": round(max(costs), 2) if costs else None,
        "best_case_cost": round(min(costs), 2) if costs else None,
        "expected_lead_time": round(sum(lead_times) / len(lead_times), 1) if lead_times else None,
        "disruption_rate": round(disruption_rate, 1),
        "histogram": buckets,
    }
