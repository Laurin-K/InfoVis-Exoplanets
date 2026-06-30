// Gravity Drop Logic
const state = {
    data: [],
    selectedPlanet: null,
    gEarth: 9.81, // m/s^2
    gExo: 9.81,
    isDropping: false,
    dropHeight: 100 // logical meters
};

const selectEl = d3.select("#planet-select");
const dropBtn = d3.select("#drop-btn");
const resetBtn = d3.select("#reset-btn");

// DOM elements for animation
const probeEarth = document.getElementById("probe-earth");
const probeExo = document.getElementById("probe-exo");
const timerEarth = document.getElementById("timer-earth");
const timerExo = document.getElementById("timer-exo");

d3.csv("../data/nasa_export_small.csv", d => {
    // Need mass and radius in Earth units
    const mass = +d.pl_bmasse;
    const rad = +d.pl_rade;
    
    if (mass && rad) {
        return {
            name: d.pl_name,
            mass: mass,
            rad: rad,
            // g = M / R^2 relative to Earth
            gravityRel: mass / (rad * rad),
            teff: +d.pl_eqt || 300
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
        let defaultPlanet = state.data.find(d => d.name === "HD 209458 b") || state.data[0];
        selectEl.property("value", defaultPlanet.name);
        onPlanetSelect(defaultPlanet.name);
    }
});

selectEl.on("change", function() {
    onPlanetSelect(this.value);
});

dropBtn.on("click", startDrop);
resetBtn.on("click", resetDrop);

function onPlanetSelect(planetName) {
    if (!planetName) return;
    state.selectedPlanet = state.data.find(d => d.name === planetName);
    state.gExo = state.gEarth * state.selectedPlanet.gravityRel;
    
    resetDrop();

    // Update Info
    d3.select("#system-info").style("display", "block");
    d3.select("#val-mass").text(`${state.selectedPlanet.mass.toFixed(2)} M_earth`);
    d3.select("#val-rad").text(`${state.selectedPlanet.rad.toFixed(2)} R_earth`);
    d3.select("#val-grav").text(`${state.gExo.toFixed(2)} m/s² (${state.selectedPlanet.gravityRel.toFixed(2)}g)`);
    d3.select("#exo-title").text(state.selectedPlanet.name).append("span").attr("class", "sub").text(` (${state.selectedPlanet.gravityRel.toFixed(2)}g)`);

    // Update Size Compare
    const sizeCompare = d3.select("#size-compare");
    sizeCompare.html(""); // clear
    
    const svg = sizeCompare.append("svg").attr("width", 200).attr("height", 100);
    // Earth
    svg.append("circle")
        .attr("cx", 50)
        .attr("cy", 50)
        .attr("r", 20)
        .style("fill", "var(--accent-earth)");
    svg.append("text").attr("x", 50).attr("y", 90).text("Earth").style("fill", "white").style("text-anchor", "middle").style("font-size", "12px");
    
    // Exo
    // Scale visual radius, max 40 so it fits in 100px height
    const visualRad = Math.min(40, Math.max(5, 20 * state.selectedPlanet.rad));
    svg.append("circle")
        .attr("cx", 140)
        .attr("cy", 100 - visualRad - 20) // align visually
        .attr("r", visualRad)
        .style("fill", "#ff7e5f");
    svg.append("text").attr("x", 140).attr("y", 90).text("Exo").style("fill", "white").style("text-anchor", "middle").style("font-size", "12px");
}

let animFrameEarth;
let animFrameExo;

function resetDrop() {
    state.isDropping = false;
    cancelAnimationFrame(animFrameEarth);
    cancelAnimationFrame(animFrameExo);
    
    probeEarth.style.top = "10px";
    probeExo.style.top = "10px";
    timerEarth.innerText = "0.00s";
    timerExo.innerText = "0.00s";
    
    probeEarth.style.transform = "translateX(-50%) scale(1)";
    probeExo.style.transform = "translateX(-50%) scale(1)";
}

function startDrop() {
    if (state.isDropping) return;
    
    // Auto-reset if probes are already at the bottom
    if (probeEarth.style.top && parseInt(probeEarth.style.top) > 10) {
        resetDrop();
    }
    
    state.isDropping = true;
    
    const shaftHeight = document.querySelector(".shaft").clientHeight;
    // 30px is probe height, 10px is start top
    const fallDistancePx = shaftHeight - 40; 
    
    // Scale: dropHeight (m) = fallDistancePx (px)
    const timeScale = 2; // Simulation runs slower than reality
    
    let startTsEarth = null;
    let startTsExo = null;
    let finishedEarth = false;
    let finishedExo = false;
    
    function checkDone() {
        if (finishedEarth && finishedExo) {
            state.isDropping = false;
        }
    }
    
    function stepEarth(timestamp) {
        if (!startTsEarth) startTsEarth = timestamp;
        const elapsedReal = (timestamp - startTsEarth) / 1000; 
        const t = elapsedReal * timeScale; 
        
        let s = 0.5 * state.gEarth * (t * t);
        let px = (s / state.dropHeight) * fallDistancePx;
        
        if (px >= fallDistancePx) {
            px = fallDistancePx;
            probeEarth.style.top = (10 + px) + "px";
            timerEarth.innerText = t.toFixed(2) + "s";
            probeEarth.style.transform = "translateX(-50%) scale(1.2, 0.5)";
            finishedEarth = true;
            checkDone();
        } else {
            probeEarth.style.top = (10 + px) + "px";
            timerEarth.innerText = t.toFixed(2) + "s";
            animFrameEarth = requestAnimationFrame(stepEarth);
        }
    }
    
    function stepExo(timestamp) {
        if (!startTsExo) startTsExo = timestamp;
        const elapsedReal = (timestamp - startTsExo) / 1000;
        const t = elapsedReal * timeScale;
        
        let s = 0.5 * state.gExo * (t * t);
        let px = (s / state.dropHeight) * fallDistancePx;
        
        if (px >= fallDistancePx) {
            px = fallDistancePx;
            probeExo.style.top = (10 + px) + "px";
            timerExo.innerText = t.toFixed(2) + "s";
            const squish = Math.max(0.2, Math.min(0.8, 1 - (state.gExo / 50)));
            probeExo.style.transform = `translateX(-50%) scale(1.2, ${squish})`;
            finishedExo = true;
            checkDone();
        } else {
            probeExo.style.top = (10 + px) + "px";
            timerExo.innerText = t.toFixed(2) + "s";
            animFrameExo = requestAnimationFrame(stepExo);
        }
    }
    
    animFrameEarth = requestAnimationFrame(stepEarth);
    animFrameExo = requestAnimationFrame(stepExo);
}
