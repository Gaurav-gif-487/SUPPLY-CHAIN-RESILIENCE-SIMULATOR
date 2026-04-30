🏭 Supply Chain Resilience Simulator
Enterprise SCRM Stress-Testing & Value-at-Risk Engine — simulate disruptions, find optimal routes, quantify risk.
�
�
�
�
Load image
Load image
Load image
📌 What It Does
The Supply Chain Resilience Simulator lets you model multi-tier supply chain networks, inject disruption scenarios (supplier failures, demand shocks, logistics breakdowns), and instantly see the financial and operational impact — including Value at Risk, resilience scores, and optimal routing.
Built for supply chain professionals, operations students, and risk analysts who want to stress-test procurement decisions before they become real crises.
✨ Features
Interactive Network Topology — Click any node (Raw Material → Manufacturing → Logistics → Distribution → Retail) to toggle disruptions in real time
Monte Carlo Simulation — Run thousands of probabilistic scenarios to model cost variance and tail-risk exposure
Black Swan Presets — One-click extreme scenarios (pandemic, port shutdown, supplier bankruptcy) for rapid stress-testing
Value at Risk (VaR) Engine — Quantifies financial exposure from supply chain disruptions
Optimal Route Finder — Automatically surfaces the lowest-cost viable path when primary routes are severed
Network Redundancy Score — Shows what % of supply paths survive a given disruption
Live KPI Dashboard — Tracks Baseline Cost, Current Cost, VaR, Resilience Score, and Lead Time delta in real time
🛠 Tech Stack
Layer
Technology
Frontend
React
Backend / API
FastAPI (Python)
Simulation Engine
Python, Monte Carlo (NumPy)
Network Modelling
Graph algorithms, pathfinding
Deployment
Render
🚀 Getting Started
Prerequisites
Bash
Backend Setup
Bash
Frontend Setup
Bash
App runs at http://localhost:5173 — API at http://localhost:8000
🎮 How to Use
View the network — 5-tier supply chain is loaded by default (Raw Material → Retail)
Click a node to disrupt it — watch costs, VaR, and resilience score update live
Run Monte Carlo — set simulation parameters and model probabilistic outcomes
Try Black Swan Presets — simulate extreme disruptions instantly
Check Optimal Route — see which alternative path the engine recommends
Reset — restore the network to baseline with one click
📁 Project Structure
Code
📊 Key Metrics Explained
Metric
Description
Baseline Cost
Normal operating cost with no disruptions
Current Cost
Live cost given active disruptions
Value at Risk
Maximum expected loss at 95% confidence
Resilience Score
% of supply chain capacity still functional
Lead Time Δ
Extra days added by disruptions vs. baseline
Network Redundancy
% of paths surviving the current disruption
🎯 Use Cases
Procurement risk assessment before supplier onboarding
Operations and supply chain coursework / case competitions
Board-level scenario planning for supply chain strategy
Teaching SCRM concepts with live, interactive visualisation
👤 Author
Gaurav Prasad
�
�
⭐ If this helped you, drop a star!
