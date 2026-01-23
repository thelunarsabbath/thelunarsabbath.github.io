---
layout: post
title: Fact Explorer
content-type: post
permalink: /explorer/
---

<style>
#fact-graph {
    width: 100%;
    height: 600px;
    border: 1px solid #ddd;
    border-radius: 8px;
    background: #fafafa;
}

.node {
    cursor: pointer;
}

.node circle {
    stroke: #fff;
    stroke-width: 2px;
}

.node text {
    font-size: 10px;
    pointer-events: none;
}

.link {
    stroke: #999;
    stroke-opacity: 0.6;
}

.controls {
    margin-bottom: 1rem;
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
}

.controls select,
.controls input {
    padding: 0.5rem;
    border: 1px solid #ddd;
    border-radius: 4px;
}

.legend {
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
    margin-top: 1rem;
}

.legend-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.85rem;
}

.legend-dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
}

.tooltip-box {
    position: absolute;
    background: white;
    border: 1px solid #ddd;
    border-radius: 6px;
    padding: 1rem;
    max-width: 300px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    pointer-events: none;
    z-index: 1000;
}
</style>

# Fact Explorer

Visualize how the facts in TIME Tested Tradition connect to each other. Each node is a fact, and lines show dependencies.

<div class="controls">
    <select id="level-filter">
        <option value="all">All Levels</option>
        <option value="0">Foundational</option>
        <option value="1">Level 1: Independent Historical</option>
        <option value="2">Level 2: Derived Historical</option>
        <option value="3">Level 3: Scriptural</option>
        <option value="4">Level 4: Calendar System</option>
        <option value="5">Level 5: Validation Tests</option>
    </select>
    <input type="text" id="search-fact" placeholder="Search for a fact...">
</div>

<div id="fact-graph"></div>

<div class="legend">
    <div class="legend-item">
        <span class="legend-dot" style="background: #28a745;"></span>
        Very High Confidence
    </div>
    <div class="legend-item">
        <span class="legend-dot" style="background: #007bff;"></span>
        High Confidence
    </div>
    <div class="legend-item">
        <span class="legend-dot" style="background: #ffc107;"></span>
        Medium Confidence
    </div>
    <div class="legend-item">
        <span class="legend-dot" style="background: #dc3545;"></span>
        Low / Rejected
    </div>
</div>

<div id="tooltip" class="tooltip-box" style="display: none;"></div>

<script src="https://d3js.org/d3.v7.min.js"></script>
<script src="/assets/js/fact-explorer.js"></script>
