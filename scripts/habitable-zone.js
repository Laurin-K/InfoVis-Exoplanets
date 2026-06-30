// Habitable Zone Explorer Logic
const state = {
    data: [],
    selectedPlanet: null,
    simTemp: 5000,
    width: 0,
    height: 0,
    maxAu: 2 // Max AU to display, will dynamically adjust
};

// Selectors
const selectEl = d3.select("#planet-select");
const tempSlider = d3.select("#temp-slider");
const tempDisplay = d3.select("#temp-display");
const resetBtn = d3.select("#reset-btn");

// D3 Setup
const container = document.getElementById('hz-dataviz');
state.width = container.clientWidth;
state.height = container.clientHeight;
const cx = state.width / 2;
const cy = state.height / 2;

const svg = d3.select("#hz-dataviz").append("svg")
    .attr("width", state.width)
    .attr("height", state.height);

const g = svg.append("g").attr("transform", `translate(${cx},${cy})`);

// Layers
const hzLayer = g.append("g").attr("class", "hz-layer");
const orbitLayer = g.append("g").attr("class", "orbit-layer");
const starLayer = g.append("g").attr("class", "star-layer");
const planetLayer = g.append("g").attr("class", "planet-layer");

// Scales
let scaleAu = d3.scaleLinear().range([0, Math.min(cx, cy) * 0.9]);

// Load Data
d3.csv("../data/nasa_export_small.csv", d => {
    // We need planets with valid st_teff, st_rad, and pl_orbsmax
    const st_teff = +d.st_teff;
    const st_rad = +d.st_rad;
    const pl_orbsmax = +d.pl_orbsmax;
    
    if (st_teff && st_rad && pl_orbsmax) {
        return {
            name: d.pl_name,
            host: d.hostname,
            teff: st_teff,
            rad: st_rad,
            orbsmax: pl_orbsmax,
            bmasse: +d.pl_bmasse || 1, // default visual mass
            rade: +d.pl_rade || 1, // default visual radius
            orbper: +d.pl_orbper || 365
        };
    }
    return null;
}).then(data => {
    state.data = data.filter(d => d !== null);
    
    // Sort alphabetically by planet name
    state.data.sort((a,b) => a.name.localeCompare(b.name));
    
    // Populate select
    selectEl.selectAll("option")
        .data([ {name: "-- Select a Planet --", value: ""} ].concat(state.data))
        .enter()
        .append("option")
        .attr("value", d => d.name)
        .text(d => d.name);

    // Initial setup
    if(state.data.length > 0) {
        // Find Earth or a famous one as default, else first
        let defaultPlanet = state.data.find(d => d.name === "Kepler-186 f") || state.data[0];
        selectEl.property("value", defaultPlanet.name);
        onPlanetSelect(defaultPlanet.name);
    }
});

// Interactions
selectEl.on("change", function() {
    onPlanetSelect(this.value);
});

tempSlider.on("input", function() {
    state.simTemp = +this.value;
    tempDisplay.text(state.simTemp);
    updateVisualization();
});

resetBtn.on("click", () => {
    if (state.selectedPlanet) {
        state.simTemp = state.selectedPlanet.teff;
        tempSlider.property("value", state.simTemp);
        tempDisplay.text(state.simTemp);
        updateVisualization();
    }
});

function onPlanetSelect(planetName) {
    if (!planetName) return;
    state.selectedPlanet = state.data.find(d => d.name === planetName);
    
    // Reset simulation temp to actual star temp
    state.simTemp = state.selectedPlanet.teff;
    tempSlider.property("value", state.simTemp);
    tempDisplay.text(state.simTemp);

    // Update Info UI
    d3.select("#system-info").style("display", "block");
    d3.select("#val-teff").text(`${state.selectedPlanet.teff} K`);
    d3.select("#val-rad").text(`${state.selectedPlanet.rad} R_sun`);
    d3.select("#val-orb").text(`${state.selectedPlanet.orbsmax} AU`);

    // Determine scale based on planet orbit and HZ boundaries
    const l_sun = Math.pow(state.selectedPlanet.rad, 2) * Math.pow(state.selectedPlanet.teff / 5778, 4);
    const outerHz = Math.sqrt(l_sun / 0.53);
    
    let maxAu = Math.max(state.selectedPlanet.orbsmax * 1.5, outerHz * 1.5);
    // Add a minimum scale so very close planets don't zoom in too crazily
    if (maxAu < 0.1) maxAu = 0.1; 
    
    const R_max = Math.min(cx, cy) * 0.9;
    const starVisualRadius = Math.max(10, Math.min(80, state.selectedPlanet.rad * 20));
    
    // Ensure the planet's orbit is drawn outside the star visually
    const minRequiredPx = starVisualRadius + 15;
    const currentPx = (state.selectedPlanet.orbsmax / maxAu) * R_max;
    if (currentPx < minRequiredPx) {
        maxAu = (state.selectedPlanet.orbsmax * R_max) / minRequiredPx;
    }
    
    state.maxAu = maxAu;
    scaleAu.domain([0, state.maxAu]);

    updateVisualization();
}

function updateVisualization() {
    const p = state.selectedPlanet;
    if (!p) return;

    // Calculate Luminosity based on simulated temp but actual radius (simplification)
    const t_ratio = state.simTemp / 5778;
    const l_sun = Math.pow(p.rad, 2) * Math.pow(t_ratio, 4);

    // Habitable zone boundaries (approximate based on conservative estimates)
    // Inner: ~ sqrt(L / 1.1), Outer: ~ sqrt(L / 0.53)
    const innerHz = Math.sqrt(l_sun / 1.1);
    const outerHz = Math.sqrt(l_sun / 0.53);

    // 1. Draw Star
    const starColor = getStarColor(state.simTemp);
    const starVisualRadius = Math.max(10, Math.min(80, p.rad * 20)); // clamped visual size
    
    const star = starLayer.selectAll("circle.star").data([state.simTemp]);
    star.enter().append("circle")
        .attr("class", "star")
        .attr("r", starVisualRadius)
        .merge(star)
        .transition().duration(500)
        .style("fill", starColor)
        .style("filter", `drop-shadow(0 0 15px ${starColor})`); // glow

    // 2. Draw Habitable Zone
    const hzRing = hzLayer.selectAll("path.hz").data([{i: innerHz, o: outerHz}]);
    
    const arcGenerator = d3.arc()
        .innerRadius(d => scaleAu(d.i))
        .outerRadius(d => scaleAu(d.o))
        .startAngle(0)
        .endAngle(Math.PI * 2);

    hzRing.enter().append("path")
        .attr("class", "hz")
        .style("fill", "var(--hz-color)")
        .style("opacity", 0.4)
        .merge(hzRing)
        .transition().duration(500)
        .attr("d", arcGenerator);

    // 3. Draw Orbit
    const orbit = orbitLayer.selectAll("circle.orbit").data([p.orbsmax]);
    orbit.enter().append("circle")
        .attr("class", "orbit")
        .style("fill", "none")
        .style("stroke", "rgba(255,255,255,0.2)")
        .style("stroke-dasharray", "4 4")
        .merge(orbit)
        .transition().duration(500)
        .attr("r", d => scaleAu(d));

    // 4. Draw Planet
    const orbitR = scaleAu(p.orbsmax);
    // Planet size visualization (clamped)
    const planetVisualRadius = Math.max(4, Math.min(15, Math.pow(p.bmasse, 1/3) * 2)); 
    
    // Determine status
    let status = "Habitable Zone";
    let statusClass = "status-habitable";
    let planetColor = "#71eadf"; // habitable color

    if (p.orbsmax < innerHz) {
        status = "Too Hot! (Burning)";
        statusClass = "status-hot";
        planetColor = "#ff6b6b";
    } else if (p.orbsmax > outerHz) {
        status = "Too Cold! (Frozen)";
        statusClass = "status-cold";
        planetColor = "#6bc5ff";
    }

    // Update Status Card
    const statusCard = d3.select("#status-card");
    statusCard.attr("class", `status-card ${statusClass}`);
    d3.select("#status-title").text(status);
    let desc = "";
    if(status === "Too Hot! (Burning)") desc = `Orbit (${p.orbsmax.toFixed(3)} AU) is inside the inner boundary (${innerHz.toFixed(3)} AU). Water would boil away.`;
    else if(status === "Too Cold! (Frozen)") desc = `Orbit (${p.orbsmax.toFixed(3)} AU) is outside the outer boundary (${outerHz.toFixed(3)} AU). Water would freeze solid.`;
    else desc = `Orbit (${p.orbsmax.toFixed(3)} AU) is within the habitable zone (${innerHz.toFixed(3)} - ${outerHz.toFixed(3)} AU). Liquid water could exist!`;
    d3.select("#status-desc").text(desc);

    const planet = planetLayer.selectAll("g.planet").data([p]);
    const planetEnter = planet.enter().append("g").attr("class", "planet");
    
    planetEnter.append("circle")
        .attr("r", planetVisualRadius)
        .style("stroke", "#fff")
        .style("stroke-width", 1);
        
    planetEnter.append("text")
        .attr("dy", -12)
        .attr("text-anchor", "middle")
        .style("fill", "#fff")
        .style("font-size", "10px")
        .style("text-shadow", "0 0 3px #000");

    const planetMerge = planetEnter.merge(planet);
    
    // Position planet
    planetMerge.transition().duration(500)
        .attr("transform", `translate(${orbitR}, 0)`);
        
    planetMerge.select("circle")
        .transition().duration(500)
        .attr("r", planetVisualRadius)
        .style("fill", planetColor);
        
    planetMerge.select("text")
        .text(p.name);
        
    // Simple continuous rotation animation
    if (planetLayer.attr("data-planet") !== p.name) {
        planetLayer.interrupt();
        planetLayer.attr("transform", "rotate(0)");
        animateOrbit(planetLayer, p.orbper);
        planetLayer.attr("data-planet", p.name);
    }
}

function animateOrbit(element, periodDays) {
    // Speed: 1 earth year = 10 seconds
    const duration = Math.max(2000, Math.min(30000, (periodDays / 365) * 10000)); 
    
    element.transition()
        .duration(duration)
        .ease(d3.easeLinear)
        .attrTween("transform", function() {
            const currentRotation = d3.interpolateString("rotate(0)", "rotate(360)");
            return function(t) {
                return currentRotation(t);
            };
        })
        .on("end", function() {
            animateOrbit(element, periodDays); // loop
        });
}

// Helper: Blackbody color approx
function getStarColor(temp) {
    if (temp < 3000) return "#ff3300"; 
    if (temp < 4000) return "#ff9900"; 
    if (temp < 6000) return "#ffffaa"; 
    if (temp < 7500) return "#ffffff"; 
    return "#aaccff"; 
}
