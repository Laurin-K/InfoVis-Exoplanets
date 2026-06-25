// Transit Lab Logic
const state = {
    data: [],
    selectedPlanet: null,
    simPrad: 1.0,
    animationTime: 0 // 0 to 1
};

const selectEl = d3.select("#planet-select");
const pradSlider = d3.select("#prad-slider");
const pradDisplay = d3.select("#prad-display");
const resetBtn = d3.select("#reset-btn");

const tPlanet = document.getElementById("t-planet");
const tStar = document.getElementById("t-star");
const transitViewWidth = document.getElementById("transit-view").clientWidth || 800;

// D3 Setup for Lightcurve
const lcContainer = document.getElementById('lightcurve-view');
const margin = {top: 20, right: 20, bottom: 40, left: 60};
const width = (lcContainer.clientWidth || 800) - margin.left - margin.right;
const height = (lcContainer.clientHeight || 250) - margin.top - margin.bottom;

const svg = d3.select("#lightcurve-view").append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

const xScale = d3.scaleLinear().domain([0, 1]).range([0, width]);
const yScale = d3.scaleLinear().domain([0.95, 1.01]).range([height, 0]);

const xAxis = svg.append("g")
    .attr("transform", `translate(0,${height})`)
    .attr("class", "axis")
    .call(d3.axisBottom(xScale).ticks(5).tickFormat(d => ""));
svg.append("text").attr("x", width/2).attr("y", height + 30).style("fill", "var(--muted)").style("text-anchor", "middle").text("Time →");

const yAxis = svg.append("g")
    .attr("class", "axis")
    .call(d3.axisLeft(yScale).ticks(5).tickFormat(d3.format(".3f")));
svg.append("text").attr("transform", "rotate(-90)").attr("y", -45).attr("x", -height/2).style("fill", "var(--muted)").style("text-anchor", "middle").text("Relative Flux");

const linePath = svg.append("path").attr("class", "line");
const indicatorLine = svg.append("line").attr("class", "indicator").attr("y1", 0).attr("y2", height);
const indicatorDot = svg.append("circle").attr("r", 5).style("fill", "white");

// Load Data
d3.csv("../data/nasa_export_small.csv", d => {
    // Need planet radius and star radius
    const prad = +d.pl_rade;
    const srad = +d.st_rad;
    
    if (prad && srad) {
        return {
            name: d.pl_name,
            prad: prad, // Earth radii
            srad: srad, // Solar radii
        };
    }
    return null;
}).then(data => {
    state.data = data.filter(d => d !== null);
    state.data.sort((a,b) => a.name.localeCompare(b.name));
    
    selectEl.selectAll("option")
        .data([ {name: "-- Select a Planet --", value: ""} ].concat(state.data))
        .enter()
        .append("option")
        .attr("value", d => d.name)
        .text(d => d.name);

    if(state.data.length > 0) {
        let defaultPlanet = state.data.find(d => d.name === "Kepler-10 b") || state.data[0];
        selectEl.property("value", defaultPlanet.name);
        onPlanetSelect(defaultPlanet.name);
    }
});

selectEl.on("change", function() { onPlanetSelect(this.value); });

pradSlider.on("input", function() {
    state.simPrad = +this.value;
    pradDisplay.text(state.simPrad.toFixed(1));
    updateSimulation();
});

resetBtn.on("click", () => {
    if (state.selectedPlanet) {
        state.simPrad = state.selectedPlanet.prad;
        pradSlider.property("value", state.simPrad);
        pradDisplay.text(state.simPrad.toFixed(1));
        updateSimulation();
    }
});

function onPlanetSelect(planetName) {
    if (!planetName) return;
    state.selectedPlanet = state.data.find(d => d.name === planetName);
    
    state.simPrad = state.selectedPlanet.prad;
    pradSlider.property("value", state.simPrad);
    pradDisplay.text(state.simPrad.toFixed(1));

    updateSimulation();
}

let animFrame;

function updateSimulation() {
    cancelAnimationFrame(animFrame);
    
    const p = state.selectedPlanet;
    // Calculate depth: (Rp / Rs)^2
    // Rp is in Earth radii, Rs is in Solar radii. 1 Rs = 109 Re
    const rp_rs = state.simPrad / (p.srad * 109);
    const depth = Math.pow(rp_rs, 2);
    
    // Update Info
    d3.select("#system-info").style("display", "block");
    d3.select("#val-prad").text(`${state.simPrad.toFixed(2)} R_earth`);
    d3.select("#val-srad").text(`${p.srad.toFixed(2)} R_sun`);
    d3.select("#val-depth").text(`${(depth * 100).toFixed(4)} %`);

    // Visual setup
    // Star is 200px diameter.
    // Planet px size:
    const visualPrad = Math.max(2, 100 * rp_rs); // scale so it's visible, Rs is 100px radius
    tPlanet.style.width = `${visualPrad * 2}px`;
    tPlanet.style.height = `${visualPrad * 2}px`;
    
    // Generate light curve data
    // U-shaped curve. Transit happens between 0.3 and 0.7 of the time
    const curveData = [];
    for(let i=0; i<=100; i++) {
        const t = i/100;
        let flux = 1.0;
        // Simple model
        if(t > 0.35 && t < 0.65) {
            // full transit
            flux = 1.0 - depth;
            // add some rounding at ingress/egress
            if (t < 0.4) flux = 1.0 - depth * ((t - 0.35)/0.05);
            if (t > 0.6) flux = 1.0 - depth * ((0.65 - t)/0.05);
        }
        // add tiny noise
        flux += (Math.random() - 0.5) * 0.0001;
        curveData.push({x: t, y: flux});
    }

    // Update Y scale to fit depth
    const minFlux = 1.0 - depth * 1.5;
    yScale.domain([minFlux < 0.9 ? minFlux : 0.99, 1.002]);
    yAxis.call(d3.axisLeft(yScale).ticks(5).tickFormat(d3.format(".4f")));

    const lineGen = d3.line()
        .x(d => xScale(d.x))
        .y(d => yScale(d.y))
        .curve(d3.curveMonotoneX);

    linePath.datum(curveData).attr("d", lineGen);

    // Start Animation loop
    let startTime = null;
    const duration = 5000; // 5 seconds per orbit

    function animate(timestamp) {
        if (!startTime) startTime = timestamp;
        let progress = ((timestamp - startTime) % duration) / duration;
        
        // Move planet
        const px = progress * transitViewWidth;
        tPlanet.style.transform = `translate(${px}px, -50%)`;
        tPlanet.style.top = "50%";
        
        // Move indicator
        const ix = xScale(progress);
        indicatorLine.attr("x1", ix).attr("x2", ix);
        
        // find y on curve
        const dataPoint = curveData[Math.floor(progress * 100)] || curveData[0];
        indicatorDot.attr("cx", ix).attr("cy", yScale(dataPoint.y));

        animFrame = requestAnimationFrame(animate);
    }
    
    animFrame = requestAnimationFrame(animate);
}
