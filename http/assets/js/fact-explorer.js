/**
 * Fact Explorer - D3.js visualization of fact dependencies
 */

// Color scale for confidence levels
const confidenceColors = {
    'very high': '#28a745',
    'high': '#007bff',
    'medium': '#ffc107',
    'low': '#dc3545'
};

// Get color for confidence level
function getConfidenceColor(confidence) {
    if (!confidence) return '#6c757d';
    const lower = confidence.toLowerCase();
    for (const [key, color] of Object.entries(confidenceColors)) {
        if (lower.includes(key)) return color;
    }
    return '#6c757d';
}

// Load facts data and render graph
async function initFactExplorer() {
    try {
        // Fetch facts from the Jekyll-generated JSON
        const response = await fetch('/assets/data/facts-graph.json');
        if (!response.ok) {
            console.log('No facts-graph.json found, using sample data');
            renderGraph(getSampleData());
            return;
        }
        const data = await response.json();
        renderGraph(data);
    } catch (error) {
        console.log('Using sample data:', error);
        renderGraph(getSampleData());
    }
}

// Sample data for demonstration
function getSampleData() {
    return {
        nodes: [
            { id: 'ScripturalAuthority', name: 'Scriptural Authority', level: 0, confidence: 'Very High' },
            { id: 'HermeneuticalPrinciples', name: 'Hermeneutical Principles', level: 0, confidence: 'Very High' },
            { id: 'CalendarAccessibility', name: 'Calendar Accessibility', level: 0, confidence: 'Very High' },
            { id: 'CelestialAuthority', name: 'Celestial Authority', level: 0, confidence: 'Very High' },
            { id: 'CelestialStability', name: 'Celestial Stability', level: 0, confidence: 'Very High' },
            { id: 'AstronomicalStability', name: 'Astronomical Stability', level: 1, confidence: 'Very High' },
            { id: 'Tiberius15thYear', name: "Tiberius' 15th Year", level: 1, confidence: 'Very High' },
            { id: 'January1BCEclipse', name: 'January 1 BC Eclipse', level: 1, confidence: 'Very High' },
            { id: 'HerodsDeath', name: "Herod's Death", level: 1, confidence: 'Very High' },
            { id: 'Crucifixion32AD', name: 'Crucifixion 32 AD', level: 2, confidence: 'Very High' },
            { id: 'MonthStartsWithFullMoon', name: 'Month Starts With Full Moon', level: 3, confidence: 'Very High' },
            { id: 'LunarSabbathSystem', name: 'Lunar Sabbath System', level: 4, confidence: 'Very High' },
            { id: 'Crucifixion32ADTest', name: 'Crucifixion 32 AD Test', level: 5, confidence: 'Very High' },
        ],
        links: [
            { source: 'CelestialStability', target: 'AstronomicalStability' },
            { source: 'January1BCEclipse', target: 'CelestialStability' },
            { source: 'January1BCEclipse', target: 'AstronomicalStability' },
            { source: 'HerodsDeath', target: 'January1BCEclipse' },
            { source: 'Crucifixion32AD', target: 'Tiberius15thYear' },
            { source: 'Crucifixion32AD', target: 'HerodsDeath' },
            { source: 'MonthStartsWithFullMoon', target: 'ScripturalAuthority' },
            { source: 'MonthStartsWithFullMoon', target: 'HermeneuticalPrinciples' },
            { source: 'MonthStartsWithFullMoon', target: 'CalendarAccessibility' },
            { source: 'MonthStartsWithFullMoon', target: 'CelestialAuthority' },
            { source: 'LunarSabbathSystem', target: 'MonthStartsWithFullMoon' },
            { source: 'LunarSabbathSystem', target: 'Crucifixion32AD' },
            { source: 'Crucifixion32ADTest', target: 'LunarSabbathSystem' },
            { source: 'Crucifixion32ADTest', target: 'Crucifixion32AD' },
        ]
    };
}

// Render the D3 force-directed graph
function renderGraph(data) {
    const container = document.getElementById('fact-graph');
    if (!container) return;
    
    const width = container.clientWidth;
    const height = 600;
    
    // Clear any existing content
    container.innerHTML = '';
    
    // Create SVG
    const svg = d3.select('#fact-graph')
        .append('svg')
        .attr('width', width)
        .attr('height', height)
        .attr('viewBox', [0, 0, width, height]);
    
    // Add zoom behavior
    const g = svg.append('g');
    
    svg.call(d3.zoom()
        .extent([[0, 0], [width, height]])
        .scaleExtent([0.5, 4])
        .on('zoom', (event) => {
            g.attr('transform', event.transform);
        }));
    
    // Create force simulation
    const simulation = d3.forceSimulation(data.nodes)
        .force('link', d3.forceLink(data.links).id(d => d.id).distance(100))
        .force('charge', d3.forceManyBody().strength(-300))
        .force('center', d3.forceCenter(width / 2, height / 2))
        .force('collision', d3.forceCollide().radius(30));
    
    // Draw links
    const link = g.append('g')
        .attr('class', 'links')
        .selectAll('line')
        .data(data.links)
        .join('line')
        .attr('class', 'link')
        .attr('stroke', '#999')
        .attr('stroke-opacity', 0.6)
        .attr('stroke-width', 1.5)
        .attr('marker-end', 'url(#arrowhead)');
    
    // Add arrowhead marker
    svg.append('defs').append('marker')
        .attr('id', 'arrowhead')
        .attr('viewBox', '-0 -5 10 10')
        .attr('refX', 20)
        .attr('refY', 0)
        .attr('orient', 'auto')
        .attr('markerWidth', 6)
        .attr('markerHeight', 6)
        .append('path')
        .attr('d', 'M 0,-5 L 10,0 L 0,5')
        .attr('fill', '#999');
    
    // Draw nodes
    const node = g.append('g')
        .attr('class', 'nodes')
        .selectAll('g')
        .data(data.nodes)
        .join('g')
        .attr('class', 'node')
        .call(d3.drag()
            .on('start', dragstarted)
            .on('drag', dragged)
            .on('end', dragended));
    
    // Node circles
    node.append('circle')
        .attr('r', d => 8 + (5 - (d.level || 0)))
        .attr('fill', d => getConfidenceColor(d.confidence))
        .attr('stroke', '#fff')
        .attr('stroke-width', 2);
    
    // Node labels
    node.append('text')
        .attr('dy', 20)
        .attr('text-anchor', 'middle')
        .attr('font-size', '10px')
        .attr('fill', '#333')
        .text(d => d.name || d.id);
    
    // Tooltip
    const tooltip = d3.select('#tooltip');
    
    node.on('mouseover', (event, d) => {
        tooltip.style('display', 'block')
            .html(`
                <strong>${d.name || d.id}</strong><br/>
                <span style="color: ${getConfidenceColor(d.confidence)}">${d.confidence || 'Unknown'}</span><br/>
                Level: ${d.level !== undefined ? d.level : 'N/A'}
            `);
    })
    .on('mousemove', (event) => {
        tooltip.style('left', (event.pageX + 15) + 'px')
            .style('top', (event.pageY - 10) + 'px');
    })
    .on('mouseout', () => {
        tooltip.style('display', 'none');
    })
    .on('click', (event, d) => {
        // Navigate to fact page
        window.location.href = `/facts/${d.id.toLowerCase()}/`;
    });
    
    // Update positions on simulation tick
    simulation.on('tick', () => {
        link
            .attr('x1', d => d.source.x)
            .attr('y1', d => d.source.y)
            .attr('x2', d => d.target.x)
            .attr('y2', d => d.target.y);
        
        node.attr('transform', d => `translate(${d.x},${d.y})`);
    });
    
    // Drag functions
    function dragstarted(event, d) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
    }
    
    function dragged(event, d) {
        d.fx = event.x;
        d.fy = event.y;
    }
    
    function dragended(event, d) {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
    }
    
    // Filter controls
    const levelFilter = document.getElementById('level-filter');
    if (levelFilter) {
        levelFilter.addEventListener('change', (e) => {
            const level = e.target.value;
            if (level === 'all') {
                node.style('opacity', 1);
                link.style('opacity', 0.6);
            } else {
                const levelNum = parseInt(level);
                node.style('opacity', d => (d.level === levelNum) ? 1 : 0.2);
                link.style('opacity', 0.2);
            }
        });
    }
    
    // Search
    const searchInput = document.getElementById('search-fact');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            if (!query) {
                node.style('opacity', 1);
                return;
            }
            node.style('opacity', d => {
                const name = (d.name || d.id).toLowerCase();
                return name.includes(query) ? 1 : 0.2;
            });
        });
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFactExplorer);
} else {
    initFactExplorer();
}
