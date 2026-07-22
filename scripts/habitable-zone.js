// Habitable Zone Explorer Logic
const state = {
  planets: [],
  systems: [],
  selectedSystem: null,
  selectedPlanetName: null,
  simTemp: 5000,
  width: 0,
  height: 0,
  maxAu: 2, // Max AU to display, dynamically adjusted per system
};

// Selectors
const selectEl = d3.select("#planet-select");
const tempSlider = d3.select("#temp-slider");
const tempDisplay = d3.select("#temp-display");
const tempRangeDisplay = d3.select("#temp-range-display");
const resetBtn = d3.select("#reset-btn");
const detailCard = d3.select("#planet-detail-card");
const detailName = d3.select("#detail-name");
const detailContent = d3.select("#detail-content");
const detailCloseBtn = d3.select("#detail-close");
const MIN_ORBIT_GAP = 16;
const MIN_SIM_TEMP = 500;
const MAX_SIM_TEMP = 40000;
const TEMP_SLIDER_STEP = 25;

// D3 Setup
const container = document.getElementById("hz-dataviz");
state.width = container.clientWidth;
state.height = container.clientHeight;
const cx = state.width / 2;
const cy = state.height / 2;

const svg = d3
  .select("#hz-dataviz")
  .append("svg")
  .attr("width", state.width)
  .attr("height", state.height);

const g = svg.append("g").attr("transform", `translate(${cx},${cy})`);

// Layers
const hzLayer = g.append("g").attr("class", "hz-layer");
const orbitLayer = g.append("g").attr("class", "orbit-layer");
const starLayer = g.append("g").attr("class", "star-layer");
const planetLayer = g.append("g").attr("class", "planet-layer");

// Scales
const maxOrbitRadiusPx = Math.min(cx, cy) * 0.9;
let scaleAu = d3.scaleLinear().range([0, maxOrbitRadiusPx]);

// Load Data
d3.csv("../data/nasa_export_full.csv", (d) => {
  // We need planets with valid st_teff, st_rad, and pl_orbsmax
  const st_teff = +d.st_teff;
  const st_rad = +d.st_rad;
  const pl_orbsmax = +d.pl_orbsmax;

  if (d.hostname && st_teff && st_rad && pl_orbsmax) {
    const pl_orbper = +d.pl_orbper;
    const pl_rade = +d.pl_rade;
    const pl_bmasse = +d.pl_bmasse;
    const pl_insol = +d.pl_insol;
    const pl_eqt = +d.pl_eqt;

    return {
      name: d.pl_name,
      host: d.hostname,
      teff: st_teff,
      rad: st_rad,
      orbsmax: pl_orbsmax,
      bmasse: Number.isFinite(pl_bmasse) && pl_bmasse > 0 ? pl_bmasse : null,
      rade: Number.isFinite(pl_rade) && pl_rade > 0 ? pl_rade : null,
      insol: Number.isFinite(pl_insol) && pl_insol > 0 ? pl_insol : null,
      eqt: Number.isFinite(pl_eqt) && pl_eqt > 0 ? pl_eqt : null,
      orbper: Number.isFinite(pl_orbper) && pl_orbper > 0 ? pl_orbper : null,
      systemPlanetCount: +d.sy_pnum || null,
    };
  }
  return null;
}).then((data) => {
  let planets = data.filter((d) => d !== null);

  const saved = localStorage.getItem('selected_planets');
  if (saved) {
      try {
          const selectedSet = new Set(JSON.parse(saved));
          if (selectedSet.size > 0) {
              planets = planets.filter(d => selectedSet.has(d.name));
          }
      } catch(e) {}
  }

  state.planets = planets;
  state.systems = buildSystems(state.planets);

  selectEl
    .selectAll("option")
    .data([{ host: "", label: "-- Select a System --" }].concat(state.systems))
    .enter()
    .append("option")
    .attr("value", (d) => d.host)
    .text((d) => d.label || `${d.host} (${d.planets.length} planets)`);

  if (state.systems.length > 0) {
    const defaultSystem =
      state.systems.find((d) => d.host === "55 Cnc") ||
      state.systems.find((d) => d.host === "Kepler-186") ||
      state.systems[0];

    selectEl.property("value", defaultSystem.host);
    onSystemSelect(defaultSystem.host);
  }
});

// Interactions
selectEl.on("change", function () {
  onSystemSelect(this.value);
});

tempSlider.on("input", function () {
  state.simTemp = +this.value;
  tempDisplay.text(state.simTemp);
  updateVisualization();
});

resetBtn.on("click", () => {
  if (state.selectedSystem) {
    state.simTemp = clampTempToSlider(state.selectedSystem.teff);
    tempSlider.property("value", state.simTemp);
    tempDisplay.text(state.simTemp);
    updateVisualization();
  }
});

detailCloseBtn.on("click", hidePlanetDetail);

function buildSystems(planets) {
  return Array.from(d3.group(planets, (d) => d.host), ([host, systemPlanets]) => {
    systemPlanets.sort((a, b) => a.orbsmax - b.orbsmax);
    const teff = d3.median(systemPlanets, (d) => d.teff);
    const rad = d3.median(systemPlanets, (d) => d.rad);

    return {
      host,
      teff,
      rad,
      planets: systemPlanets,
      label: `${host} (${systemPlanets.length} ${systemPlanets.length === 1 ? "planet" : "planets"})`,
    };
  }).sort((a, b) => {
    if (b.planets.length !== a.planets.length) return b.planets.length - a.planets.length;
    return a.host.localeCompare(b.host);
  });
}

function onSystemSelect(hostName) {
  if (!hostName) return;
  state.selectedSystem = state.systems.find((d) => d.host === hostName);
  if (!state.selectedSystem) return;
  state.selectedPlanetName = null;
  hidePlanetDetail();

  // Update Info UI
  const planets = state.selectedSystem.planets;
  const minOrbit = d3.min(planets, (d) => d.orbsmax);
  const maxOrbit = d3.max(planets, (d) => d.orbsmax);

  updateTemperatureSliderRange(state.selectedSystem, minOrbit, maxOrbit);

  // Reset simulation temp to actual star temp after the system-specific range is known.
  state.simTemp = clampTempToSlider(state.selectedSystem.teff);
  tempSlider.property("value", state.simTemp);
  tempDisplay.text(state.simTemp);

  d3.select("#system-info").style("display", "block");
  d3.select("#val-teff").text(`${state.selectedSystem.teff} K`);
  d3.select("#val-rad").text(`${state.selectedSystem.rad} R_sun`);
  d3.select("#val-planets").text(`${planets.length}`);
  d3.select("#val-orb").text(`${minOrbit.toFixed(3)} - ${maxOrbit.toFixed(3)} AU`);

  updateScale();
  updateVisualization();
}

function updateScale() {
  const system = state.selectedSystem;
  if (!system) return;

  const maxSliderTemp = +tempSlider.attr("max") || system.teff;
  const l_sun = Math.pow(system.rad, 2) * Math.pow(maxSliderTemp / 5778, 4);
  const outerHz = Math.sqrt(l_sun / 0.53);
  const maxOrbit = d3.max(system.planets, (d) => d.orbsmax);

  state.maxAu = Math.max(maxOrbit * 1.25, outerHz * 1.25, 0.1);
  scaleAu.domain([0, state.maxAu]);
}

function updateTemperatureSliderRange(system, minOrbit, maxOrbit) {
  const minTemp = tempForOuterHzAtOrbit(minOrbit, system.rad);
  const maxTemp = tempForInnerHzAtOrbit(maxOrbit, system.rad);
  const sliderMin = roundToStep(clamp(minTemp, MIN_SIM_TEMP, MAX_SIM_TEMP), TEMP_SLIDER_STEP, Math.ceil);
  const sliderMax = roundToStep(clamp(maxTemp, MIN_SIM_TEMP, MAX_SIM_TEMP), TEMP_SLIDER_STEP, Math.floor);

  tempSlider
    .attr("min", sliderMin)
    .attr("max", Math.max(sliderMax, sliderMin + TEMP_SLIDER_STEP))
    .attr("step", TEMP_SLIDER_STEP);

  tempRangeDisplay.text(`${sliderMin} - ${Math.max(sliderMax, sliderMin + TEMP_SLIDER_STEP)} K`);
}

function tempForOuterHzAtOrbit(orbitAu, starRadius) {
  return 5778 * Math.sqrt((orbitAu * Math.sqrt(0.53)) / starRadius);
}

function tempForInnerHzAtOrbit(orbitAu, starRadius) {
  return 5778 * Math.sqrt((orbitAu * Math.sqrt(1.1)) / starRadius);
}

function clampTempToSlider(temp) {
  return clamp(temp, +tempSlider.attr("min"), +tempSlider.attr("max"));
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function roundToStep(value, step, roundFn) {
  return roundFn(value / step) * step;
}

function updateVisualization() {
  const system = state.selectedSystem;
  if (!system) return;

  const planets = system.planets;

  // Calculate luminosity based on simulated temp but actual radius (simplification)
  const t_ratio = state.simTemp / 5778;
  const l_sun = Math.pow(system.rad, 2) * Math.pow(t_ratio, 4);

  // Habitable zone boundaries (approximate based on conservative estimates)
  // Inner: ~ sqrt(L / 1.1), Outer: ~ sqrt(L / 0.53)
  const innerHz = Math.sqrt(l_sun / 1.1);
  const outerHz = Math.sqrt(l_sun / 0.53);

  // 1. Draw Star
  const starColor = getStarColor(state.simTemp);
  const starVisualRadius = getStarVisualRadius(system);
  updateScaleRange(starVisualRadius);

  const star = starLayer.selectAll("circle.star").data([state.simTemp]);
  star
    .enter()
    .append("circle")
    .attr("class", "star")
    .attr("r", starVisualRadius)
    .merge(star)
    .transition()
    .duration(500)
    .attr("r", starVisualRadius)
    .style("fill", starColor)
    .style("filter", `drop-shadow(0 0 15px ${starColor})`); // glow

  // 2. Draw Habitable Zone
  const hzRing = hzLayer
    .selectAll("path.hz")
    .data([{ i: innerHz, o: outerHz }]);

  const arcGenerator = d3
    .arc()
    .innerRadius((d) => scaleAu(d.i))
    .outerRadius((d) => scaleAu(d.o))
    .startAngle(0)
    .endAngle(Math.PI * 2);

  hzRing
    .enter()
    .append("path")
    .attr("class", "hz")
    .style("fill", "var(--hz-color)")
    .style("opacity", 0.4)
    .merge(hzRing)
    .transition()
    .duration(500)
    .attr("d", arcGenerator);

  hzRing.exit().remove();

  // 3. Draw all orbits in the selected system
  const planetData = getPlanetDisplayData(planets, innerHz, outerHz);
  const orbit = orbitLayer.selectAll("circle.orbit").data(planetData, (d) => d.name);

  orbit
    .enter()
    .append("circle")
    .attr("class", "orbit")
    .style("fill", "none")
    .style("stroke", "rgba(255,255,255,0.2)")
    .style("stroke-dasharray", "4 4")
    .attr("r", 0)
    .merge(orbit)
    .transition()
    .duration(500)
    .attr("r", (d) => d.visualOrbitR);

  orbit.exit().transition().duration(250).attr("r", 0).remove();

  // 4. Draw all planets
  const planet = planetLayer.selectAll("g.planet").data(planetData, (d) => d.name);
  const planetEnter = planet.enter().append("g").attr("class", "planet");

  planetEnter
    .append("circle")
    .style("stroke", "#fff")
    .style("stroke-width", 1);

  planetEnter
    .append("text")
    .attr("text-anchor", "middle")
    .style("fill", "#fff")
    .style("font-size", "10px")
    .style("text-shadow", "0 0 3px #000");

  const planetMerge = planetEnter.merge(planet);

  planetMerge
    .attr("tabindex", 0)
    .attr("role", "button")
    .attr("aria-label", (d) => `Show details for ${d.name}`)
    .classed("selected", (d) => d.name === state.selectedPlanetName)
    .on("click", (event, d) => showPlanetDetail(d, innerHz, outerHz))
    .on("keydown", (event, d) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        showPlanetDetail(d, innerHz, outerHz);
      }
    });

  planetMerge
    .transition()
    .duration(500)
    .attr("transform", (d) => {
      const x = Math.cos(d.angle) * d.visualOrbitR;
      const y = Math.sin(d.angle) * d.visualOrbitR;
      return `translate(${x}, ${y})`;
    });

  planetMerge
    .select("circle")
    .transition()
    .duration(500)
    .attr("r", (d) => getPlanetVisualRadius(d))
    .style("fill", (d) => d.status.color)
    .style("stroke-width", (d) => d.name === state.selectedPlanetName ? 3 : 1);

  planetMerge
    .select("text")
    .attr("y", (d) => -getPlanetVisualRadius(d) - 18)
    .each(function (d) {
      const label = d3.select(this);

      label.selectAll("tspan").remove();
      label.append("tspan").attr("x", 0).attr("dy", 0).text(d.name);
      label.append("tspan").attr("x", 0).attr("dy", 12).text(formatOrbitalPeriod(d.orbper));
    });

  planet.exit().transition().duration(250).style("opacity", 0).remove();

  updateStatusCard(planetData, innerHz, outerHz);
  refreshSelectedPlanetDetail(planetData, innerHz, outerHz);
}

function getPlanetDisplayData(planets, innerHz, outerHz) {
  return planets.map((planet, index) => {
    return {
      ...planet,
      angle: (index / planets.length) * Math.PI * 2 - Math.PI / 2,
      status: getPlanetStatus(planet, innerHz, outerHz),
      visualOrbitR: scaleAu(planet.orbsmax),
    };
  });
}

function getStarVisualRadius(system) {
  return Math.max(10, Math.min(80, system.rad * 20));
}

function updateScaleRange(starVisualRadius) {
  const orbitStartPx = Math.min(starVisualRadius + MIN_ORBIT_GAP, maxOrbitRadiusPx * 0.45);
  scaleAu.range([orbitStartPx, maxOrbitRadiusPx]);
}

function getPlanetVisualRadius(planet) {
  const mass = planet.bmasse || 1;
  return Math.max(4, Math.min(15, Math.pow(mass, 1 / 3) * 2));
}

function formatOrbitalPeriod(periodDays) {
  if (!periodDays) return "Orbit: unknown";

  if (periodDays < 1) {
    return `Orbit: ${(periodDays * 24).toFixed(1)} h`;
  }

  if (periodDays >= 730) {
    return `Orbit: ${(periodDays / 365.25).toFixed(1)} yr`;
  }

  return `Orbit: ${periodDays.toFixed(periodDays < 10 ? 2 : 1)} d`;
}

function getPlanetStatus(planet, innerHz, outerHz) {
  if (planet.orbsmax < innerHz) {
    return { key: "hot", label: "Too Hot", color: "#ff6b6b" };
  }

  if (planet.orbsmax > outerHz) {
    return { key: "cold", label: "Too Cold", color: "#6bc5ff" };
  }

  return { key: "habitable", label: "Habitable Zone", color: "#71eadf" };
}

function updateStatusCard(planets, innerHz, outerHz) {
  const counts = {
    hot: planets.filter((d) => d.status.key === "hot").length,
    habitable: planets.filter((d) => d.status.key === "habitable").length,
    cold: planets.filter((d) => d.status.key === "cold").length,
  };

  const statusCard = d3.select("#status-card");
  const dominantClass = counts.habitable > 0 ? "status-habitable" : counts.hot >= counts.cold ? "status-hot" : "status-cold";
  statusCard.attr("class", `status-card ${dominantClass}`);

  d3.select("#status-title").text(`${counts.habitable} in Habitable Zone`);

  const habitablePlanets = planets
    .filter((d) => d.status.key === "habitable")
    .map((d) => d.name);

  const summary = `${counts.hot} too hot, ${counts.habitable} in zone, ${counts.cold} too cold.`;
  const hzRange = `HZ: ${innerHz.toFixed(3)} - ${outerHz.toFixed(3)} AU.`;
  const names = habitablePlanets.length
    ? `Potential candidates: ${habitablePlanets.join(", ")}.`
    : "No shown planet currently lies inside the habitable zone.";

  d3.select("#status-desc").text(`${summary} ${hzRange} ${names}`);
}

function showPlanetDetail(planet, innerHz, outerHz) {
  state.selectedPlanetName = planet.name;
  detailCard.attr("hidden", null);
  renderPlanetDetail(planet, innerHz, outerHz);

  planetLayer
    .selectAll("g.planet")
    .classed("selected", (d) => d.name === state.selectedPlanetName)
    .select("circle")
    .style("stroke-width", (d) => d.name === state.selectedPlanetName ? 3 : 1);
}

function hidePlanetDetail() {
  state.selectedPlanetName = null;
  detailCard.attr("hidden", true);
  detailContent.html("");
  planetLayer.selectAll("g.planet").classed("selected", false).select("circle").style("stroke-width", 1);
}

function refreshSelectedPlanetDetail(planets, innerHz, outerHz) {
  if (!state.selectedPlanetName) return;

  const selectedPlanet = planets.find((planet) => planet.name === state.selectedPlanetName);
  if (!selectedPlanet) {
    hidePlanetDetail();
    return;
  }

  renderPlanetDetail(selectedPlanet, innerHz, outerHz);
}

function renderPlanetDetail(planet, innerHz, outerHz) {
  detailName.text(planet.name || "Unknown planet");

  const rows = [
    ["Host star", planet.host],
    ["Status", planet.status.label],
    ["Orbit", formatAu(planet.orbsmax)],
    ["Orbital period", formatPeriodValue(planet.orbper)],
    ["Planet radius", formatNumber(planet.rade, " Earth radii")],
    ["Planet mass", formatNumber(planet.bmasse, " Earth masses")],
    ["Insolation", formatNumber(planet.insol, " Earth flux")],
    ["Equilibrium temp.", formatNumber(planet.eqt, " K")],
    ["Star temp.", formatNumber(planet.teff, " K", 0)],
    ["Star radius", formatNumber(planet.rad, " R_sun")],
    ["Current HZ", `${innerHz.toFixed(3)} - ${outerHz.toFixed(3)} AU`],
  ];

  detailContent.html(
    rows
      .map(([label, value]) => `
        <div class="detail-row">
          <span>${escapeHtml(label)}</span>
          <strong>${escapeHtml(value || "Unknown")}</strong>
        </div>
      `)
      .join("")
  );
}

function formatAu(value) {
  return Number.isFinite(value) ? `${value.toFixed(value < 1 ? 4 : 3)} AU` : "Unknown";
}

function formatPeriodValue(periodDays) {
  return formatOrbitalPeriod(periodDays).replace("Orbit: ", "");
}

function formatNumber(value, unit, digits = 2) {
  if (!Number.isFinite(value)) return "Unknown";
  return `${value.toFixed(digits).replace(/\.?0+$/, "")}${unit}`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Helper: Blackbody color approx
function getStarColor(temp) {
  if (temp < 3000) return "#ff3300";
  if (temp < 4000) return "#ff9900";
  if (temp < 6000) return "#ffffaa";
  if (temp < 7500) return "#ffffff";
  return "#aaccff";
}
