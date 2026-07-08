const d3 = window.d3;

const scatterDimensions = [
  "sy_snum",
  "sy_pnum",
  "sy_mnum",
  "disc_year",
  "pl_orbper",
  "pl_orbsmax",
  "pl_rade",
  "pl_radj",
  "pl_bmasse",
  "pl_bmassj",
  "pl_insol",
  "pl_eqt",
  "st_teff",
  "st_rad",
  "st_mass",
  "st_logg",
];

const integerDimensions = new Set([
  "sy_snum",
  "sy_pnum",
  "sy_mnum",
  "disc_year",
]);

const logColorFields = new Set(["pl_bmasse"]);

const discoveryYearMin = 1992;
const discoveryYearMax = 2026;
const discoveryYearPlaybackDelay = 700;

const state = {
  xField: "pl_orbsmax",
  yField: "pl_bmasse",
  colorField: "disc_year",
  discoveryYearUpperBound: discoveryYearMax,
  data: [],
  glossaryRows: [],
  glossaryByColumn: new Map(),
  yearDomain: [],
  resizeTimer: null,
  yearFilterFrame: null,
  yearPlaybackTimer: null,
  isYearPlaybackRunning: false,
  isYearSliderDragging: false,
  interactionMode: "pan",
};

let tooltip = null;

const fallbackDataCsv = `pl_name,hostname,sy_snum,sy_pnum,sy_mnum,disc_year,pl_orbper,pl_orbsmax,pl_rade,pl_radj,pl_bmasse,pl_bmassj,pl_insol,pl_eqt,st_teff,st_rad,st_mass,st_logg
11 Com b,11 Com,2,1,0,2007,323.21,1.178,,,4914.898,15.464,,,4874,13.76,2.09,2.45
51 Peg b,51 Peg,1,1,0,1995,4.230785,0.0527,,,150.009,0.472,,,5758,1.17561,1.03,4.31038
55 Cnc e,55 Cnc,2,7,0,2004,0.7365474,0.01544,1.875,0.1672763,7.99,0.02513923,,,5172,0.943,0.905,4.43
AU Mic b,AU Mic,1,4,0,2020,8.463446,0.07,4.79,0.42733591,8.99,0.0282857,,554.8,3540,0.862,0.635,4.37
Barnard b,Barnard's star,1,4,0,2024,3.1542,0.0229,,,0.299,0.00094076,,438,3195,0.185,0.162,4.9
CoRoT-1 b,CoRoT-1,1,1,0,2008,1.5089557,,16.7,1.49,327.35,1.03,,1898,5950,1.11,0.95,4.25
TRAPPIST-1 e,TRAPPIST-1,1,7,0,2017,6.099615,0.02925,0.92,0.082,0.772,0.00243,0.66,251,2566,0.1192,0.0898,5.21
WASP-76 b,WASP-76,2,1,0,2016,1.80988198,0.033,20.78145,1.854,284.1386,0.894,4104,2228,6329,1.756,1.458,4.196`;

const fallbackGlossaryCsv = `column;name;description
sy_snum;Number of Stars;Number of gravitationally bound stars in the planetary system
sy_pnum;Number of Planets;Number of confirmed planets in the planetary system
sy_mnum;Number of Moons;Number of moons in the planetary system
disc_year;Discovery Year;Year the planet was discovered
pl_orbper;Orbital Period [days];Time the planet takes to make a complete orbit around the host star or system
pl_orbsmax;Orbit Semi-Major Axis [au];The longest radius of an elliptic orbit
pl_rade;Planet Radius [Earth Radius];Planet radius measured in Earth radii
pl_radj;Planet Radius [Jupiter Radius];Planet radius measured in Jupiter radii
pl_bmasse;Planet Mass [Earth Mass];Best planet mass estimate measured in Earth masses
pl_bmassj;Planet Mass [Jupiter Mass];Best planet mass estimate measured in Jupiter masses
pl_insol;Insolation Flux [Earth Flux];Insolation flux relative to Earth
pl_eqt;Equilibrium Temperature [K];Modeled equilibrium temperature
st_teff;Stellar Effective Temperature [K];Temperature of the star
st_rad;Stellar Radius [Solar Radius];Stellar radius measured in solar radii
st_mass;Stellar Mass [Solar mass];Stellar mass measured in solar masses
st_logg;Stellar Surface Gravity;Surface gravity of the star`;

function isValidNumber(value) {
  return value != null && !Number.isNaN(value) && Number.isFinite(value);
}

function parseDataRow(row) {
  scatterDimensions.forEach((field) => {
    row[field] = row[field] === "" ? null : +row[field];
  });

  return row;
}

function fieldLabel(field) {
  const entry = state.glossaryByColumn.get(field);
  return entry ? entry.name : field;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return char;
    }
  });
}

function formatValue(field, value) {
  if (!isValidNumber(value)) {
    return "n/a";
  }

  if (field === "disc_year") {
    return d3.format("d")(Math.round(value));
  }

  if (integerDimensions.has(field)) {
    return d3.format(",")(Math.round(value));
  }

  if (Math.abs(value) >= 1000 || Math.abs(value) < 0.01) {
    return d3.format(".4~g")(value);
  }

  return d3.format(".3~f")(value);
}

function createScale(values, range) {
  const finiteValues = values.filter(isValidNumber);
  const min = d3.min(finiteValues);
  const max = d3.max(finiteValues);

  if (!isValidNumber(min) || !isValidNumber(max)) {
    return {
      scale: d3.scaleLinear().domain([0, 1]).range(range),
      type: "linear",
    };
  }

  if (min > 0 && max / min > 50) {
    return {
      scale: d3.scaleLog().domain([min, max]).range(range).nice(),
      type: "log",
    };
  }

  if (min === max) {
    const pad = min === 0 ? 1 : Math.abs(min) * 0.2;
    return {
      scale: d3
        .scaleLinear()
        .domain([min - pad, max + pad])
        .range(range)
        .nice(),
      type: "linear",
    };
  }

  return {
    scale: d3.scaleLinear().domain([min, max]).range(range).nice(),
    type: "linear",
  };
}

function getYearFilteredData() {
  return state.data.filter(
    (d) =>
      isValidNumber(d.disc_year) &&
      d.disc_year >= discoveryYearMin &&
      d.disc_year <= state.discoveryYearUpperBound,
  );
}

function updateHeaderMetric(validCount, filteredCount, totalCount) {
  d3.select("#chart-summary").html(`
            <strong>${d3.format(",")(validCount)}</strong>
            <span>of ${d3.format(",")(filteredCount)} filtered records plotted</span>
            <span>${d3.format(",")(totalCount)} records total</span>
        `);
}

function updatePlotNote(validCount, filteredCount, totalCount, xScaleType, yScaleType) {
  const missingCount = filteredCount - validCount;
  const yearFilteredOutCount = totalCount - filteredCount;
  const notes = [];

  notes.push(
    `Discovery year filter: ${discoveryYearMin} to ${state.discoveryYearUpperBound}.`,
  );

  if (yearFilteredOutCount > 0) {
    notes.push(
      `${d3.format(",")(yearFilteredOutCount)} rows are outside this year range or have no discovery year.`,
    );
  }

  if (missingCount > 0) {
    notes.push(
      `${d3.format(",")(missingCount)} rows were skipped because one or both selected fields are missing.`,
    );
  }

  notes.push(`X axis uses a ${xScaleType} scale.`);
  notes.push(`Y axis uses a ${yScaleType} scale.`);
  notes.push("Point color maps discovery year.");

  d3.select("#plot-note").text(notes.join(" "));
}

function updateLegend(data = state.data) {
  const legend = d3.select("#dynamic-legend");
  legend.html("");

  const field = state.colorField;
  const values = data
    .map((d) => d[field])
    .filter((value) =>
      logColorFields.has(field) ? isValidNumber(value) && value > 0 : isValidNumber(value),
    );
  if (!values.length) {
    legend.html("<div class='legend-caption'>No color data</div>");
    return;
  }

  legend
    .append("div")
    .attr("class", "legend-heading")
    .text("Point color")
    .style("margin-bottom", "10px")
    .style("font-weight", "bold");

  if (field === "sy_snum" || field === "sy_pnum") {
    const unique = Array.from(new Set(values)).sort((a, b) => a - b);
    const colorScale = d3.scaleOrdinal(d3.schemeCategory10).domain(unique);

    const wrap = legend
      .append("div")
      .style("display", "flex")
      .style("gap", "10px")
      .style("flex-wrap", "wrap");
    unique.forEach((val) => {
      const item = wrap
        .append("div")
        .style("display", "flex")
        .style("align-items", "center")
        .style("gap", "5px");
      item
        .append("div")
        .style("width", "12px")
        .style("height", "12px")
        .style("border-radius", "50%")
        .style("background", colorScale(val));
      item.append("span").style("font-size", "12px").text(val);
    });
    legend
      .append("div")
      .attr("class", "legend-caption")
      .style("margin-top", "12px")
      .text(fieldLabel(field));
  } else {
    const [minVal, maxVal] = d3.extent(values);
    const useLogColor = logColorFields.has(field) && minVal > 0 && maxVal > 0;
    const bar = legend.append("div").attr("class", "legend-bar");
    const grad = bar
      .append("div")
      .style("height", "10px")
      .style("border-radius", "4px")
      .style("width", "100%");

    if (minVal === maxVal) {
      grad.style("background", d3.interpolateViridis(0.55));
    } else {
      const logMin = useLogColor ? Math.log10(minVal) : null;
      const logMax = useLogColor ? Math.log10(maxVal) : null;
      const stops = d3.range(0, 1.01, 0.2).map((step) => {
        const value = useLogColor
          ? 10 ** (logMin + (logMax - logMin) * step)
          : minVal + (maxVal - minVal) * step;
        return `${d3.interpolateViridis(step)} ${Math.round(step * 100)}%`;
      });
      grad.style("background", `linear-gradient(90deg, ${stops.join(", ")})`);
    }

    const labels = legend
      .append("div")
      .attr("class", "legend-labels")
      .style("display", "flex")
      .style("justify-content", "space-between")
      .style("font-size", "12px")
      .style("margin-top", "6px");
    labels.append("span").text(formatValue(field, minVal));
    labels.append("span").text(formatValue(field, maxVal));

    legend
      .append("div")
      .attr("class", "legend-caption")
      .style("margin-top", "8px")
      .text(`${fieldLabel(field)}${useLogColor ? " (log scale)" : ""}`);
  }
}

function createColorScale(data = state.data) {
  const field = state.colorField;
  const values = data
    .map((d) => d[field])
    .filter((value) =>
      logColorFields.has(field) ? isValidNumber(value) && value > 0 : isValidNumber(value),
    );
  if (!values.length) return () => "#8ea0b8";

  if (field === "sy_snum" || field === "sy_pnum") {
    const unique = Array.from(new Set(values)).sort((a, b) => a - b);
    return d3.scaleOrdinal(d3.schemeCategory10).domain(unique);
  } else {
    const [minVal, maxVal] = d3.extent(values);
    if (minVal === maxVal) return () => d3.interpolateViridis(0.55);

    if (logColorFields.has(field) && minVal > 0 && maxVal > 0) {
      const scale = d3
        .scaleSequential(d3.interpolateViridis)
        .domain([Math.log10(minVal), Math.log10(maxVal)]);
      return (val) => (isValidNumber(val) && val > 0 ? scale(Math.log10(val)) : "#8ea0b8");
    }

    const scale = d3
      .scaleSequential(d3.interpolateViridis)
      .domain([minVal, maxVal]);
    return (val) => scale(val);
  }
}

function syncSelectValues() {
  d3.select("#x-select").property("value", state.xField);
  d3.select("#y-select").property("value", state.yField);
}

function syncDiscoveryYearControl() {
  d3.select("#discovery-year-slider").property(
    "value",
    state.discoveryYearUpperBound,
  );
  d3.select("#discovery-year-value").text(state.discoveryYearUpperBound);
  d3.select("#discovery-year-range-label").text(
    `bis ${state.discoveryYearUpperBound}`,
  );

  d3.select("#discovery-year-play")
    .classed("active", state.isYearPlaybackRunning)
    .text(state.isYearPlaybackRunning ? "Pause" : "Play");
}

function scheduleYearFilterRedraw() {
  if (state.yearFilterFrame) {
    window.cancelAnimationFrame(state.yearFilterFrame);
  }

  state.yearFilterFrame = window.requestAnimationFrame(() => {
    state.yearFilterFrame = null;
    drawScatterplot();
  });
}

function updateDiscoveryYearUpperBound(year) {
  state.discoveryYearUpperBound = Math.max(
    discoveryYearMin,
    Math.min(discoveryYearMax, Math.round(year)),
  );
  syncDiscoveryYearControl();
}

function setDiscoveryYearUpperBound(year) {
  updateDiscoveryYearUpperBound(year);
  scheduleYearFilterRedraw();
}

function commitDiscoveryYearSliderValue(value) {
  stopDiscoveryYearPlayback();
  setDiscoveryYearUpperBound(value);
}

function stopDiscoveryYearPlayback() {
  const wasRunning = state.isYearPlaybackRunning || state.yearPlaybackTimer;

  if (state.yearPlaybackTimer) {
    window.clearInterval(state.yearPlaybackTimer);
    state.yearPlaybackTimer = null;
  }

  state.isYearPlaybackRunning = false;

  if (wasRunning) {
    syncDiscoveryYearControl();
  }
}

function startDiscoveryYearPlayback() {
  stopDiscoveryYearPlayback();

  if (state.discoveryYearUpperBound >= discoveryYearMax) {
    state.discoveryYearUpperBound = discoveryYearMin;
  }

  state.isYearPlaybackRunning = true;
  syncDiscoveryYearControl();
  scheduleYearFilterRedraw();

  state.yearPlaybackTimer = window.setInterval(() => {
    if (state.discoveryYearUpperBound >= discoveryYearMax) {
      stopDiscoveryYearPlayback();
      return;
    }

    const nextYear = state.discoveryYearUpperBound + 1;
    setDiscoveryYearUpperBound(nextYear);

    if (nextYear >= discoveryYearMax) {
      stopDiscoveryYearPlayback();
    }
  }, discoveryYearPlaybackDelay);
}

function toggleDiscoveryYearPlayback() {
  if (state.isYearPlaybackRunning) {
    stopDiscoveryYearPlayback();
  } else {
    startDiscoveryYearPlayback();
  }
}

function ensureDistinctAxes(changedAxis) {
  if (state.xField !== state.yField) {
    return;
  }

  const replacement = scatterDimensions.find(
    (dim) => dim !== state[changedAxis === "x" ? "xField" : "yField"],
  );

  if (changedAxis === "x" && replacement) {
    state.yField = replacement;
  } else if (changedAxis === "y" && replacement) {
    state.xField = replacement;
  }
}

function buildControls() {
  const controls = d3.select("#controls");
  controls.selectAll("*").remove();

  const fields = scatterDimensions.map((field) => ({
    value: field,
    label: fieldLabel(field),
  }));

  const xBlock = controls.append("div").attr("class", "control-block");
  xBlock.append("label").attr("for", "x-select").text("X axis");
  xBlock.append("select").attr("id", "x-select");

  const yBlock = controls.append("div").attr("class", "control-block");
  yBlock.append("label").attr("for", "y-select").text("Y axis");
  yBlock.append("select").attr("id", "y-select");

  controls
    .append("button")
    .attr("type", "button")
    .attr("class", "swap-btn")
    .attr("id", "swap-axes")
    .text("Swap axes");

  controls
    .append("p")
    .attr("class", "control-copy")
    .text(
      "Axes switch to log scale automatically when the selected values span multiple orders of magnitude.",
    );

  const xSelect = d3.select("#x-select");
  const ySelect = d3.select("#y-select");

  xSelect
    .selectAll("option")
    .data(fields)
    .join("option")
    .attr("value", (d) => d.value)
    .text((d) => d.label);

  ySelect
    .selectAll("option")
    .data(fields)
    .join("option")
    .attr("value", (d) => d.value)
    .text((d) => d.label);

  syncSelectValues();

  xSelect.on("change", function () {
    state.xField = this.value;
    ensureDistinctAxes("x");
    syncSelectValues();
    drawScatterplot();
  });

  ySelect.on("change", function () {
    state.yField = this.value;
    ensureDistinctAxes("y");
    syncSelectValues();
    drawScatterplot();
  });

  d3.select("#swap-axes").on("click", function () {
    const nextX = state.yField;
    state.yField = state.xField;
    state.xField = nextX;
    syncSelectValues();
    drawScatterplot();
  });

  const colorSelect = d3.select("#color-select");
  colorSelect.property("value", state.colorField);
  colorSelect.on("change", function () {
    state.colorField = this.value;
    drawScatterplot();
  });

  const discoveryYearSlider = d3.select("#discovery-year-slider");
  discoveryYearSlider
    .attr("min", discoveryYearMin)
    .attr("max", discoveryYearMax)
    .attr("step", 1);

  syncDiscoveryYearControl();

  discoveryYearSlider.on("pointerdown", function () {
    state.isYearSliderDragging = true;
    stopDiscoveryYearPlayback();
  });

  discoveryYearSlider.on("input", function () {
    const nextYear = +this.value;
    stopDiscoveryYearPlayback();
    setDiscoveryYearUpperBound(nextYear);
  });

  discoveryYearSlider.on("change", function () {
    const nextYear = +this.value;
    state.isYearSliderDragging = false;
    commitDiscoveryYearSliderValue(nextYear);
  });

  discoveryYearSlider.on("pointerup pointercancel", function () {
    if (!state.isYearSliderDragging) return;
    const nextYear = +this.value;
    state.isYearSliderDragging = false;
    commitDiscoveryYearSliderValue(nextYear);
  });

  d3.select("#discovery-year-play").on("click", toggleDiscoveryYearPlayback);
}

function buildGlossaryTable(rows) {
  const tableHead = document.querySelector("#dataTable thead");
  const tableBody = document.querySelector("#dataTable tbody");

  tableHead.innerHTML = "";
  tableBody.innerHTML = "";

  if (!rows.length) {
    return;
  }

  const columns = rows.columns || ["column", "name", "description"];

  const headerRow = document.createElement("tr");
  columns.forEach((column) => {
    const th = document.createElement("th");
    th.textContent = column;
    headerRow.appendChild(th);
  });
  tableHead.appendChild(headerRow);

  rows.forEach((row) => {
    if (!row.column) {
      return;
    }

    const tr = document.createElement("tr");

    columns.forEach((column) => {
      const td = document.createElement("td");
      td.textContent = row[column] ?? "";
      tr.appendChild(td);
    });

    tableBody.appendChild(tr);
  });
}

function setTooltipPosition(event) {
  if (!tooltip) {
    return;
  }

  const node = tooltip.node();
  if (!node) {
    return;
  }

  const padding = 16;
  const tooltipWidth = node.offsetWidth || 240;
  const tooltipHeight = node.offsetHeight || 140;

  let left = event.clientX + padding;
  let top = event.clientY + padding;

  if (left + tooltipWidth > window.innerWidth - 12) {
    left = event.clientX - tooltipWidth - padding;
  }

  if (top + tooltipHeight > window.innerHeight - 12) {
    top = event.clientY - tooltipHeight - padding;
  }

  tooltip
    .style("left", `${Math.max(12, left)}px`)
    .style("top", `${Math.max(12, top)}px`);
}

function showTooltip(event, datum) {
  if (!tooltip) {
    return;
  }

  tooltip.classed("is-visible", true).html(`
            <div class="tooltip-title">${escapeHtml(datum.pl_name || "Unnamed planet")}</div>
            <div class="tooltip-row"><span>Host</span><span>${escapeHtml(datum.hostname || "n/a")}</span></div>
            <div class="tooltip-row"><span>${escapeHtml(fieldLabel(state.xField))}</span><span>${escapeHtml(formatValue(state.xField, datum[state.xField]))}</span></div>
            <div class="tooltip-row"><span>${escapeHtml(fieldLabel(state.yField))}</span><span>${escapeHtml(formatValue(state.yField, datum[state.yField]))}</span></div>
            <div class="tooltip-row"><span>Discovery year</span><span>${escapeHtml(formatValue("disc_year", datum.disc_year))}</span></div>
        `);

  setTooltipPosition(event);
}

function hideTooltip() {
  tooltip.classed("is-visible", false);
}

function drawRoundedRect(context, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);

  context.beginPath();
  context.moveTo(x + r, y);
  context.lineTo(x + width - r, y);
  context.quadraticCurveTo(x + width, y, x + width, y + r);
  context.lineTo(x + width, y + height - r);
  context.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  context.lineTo(x + r, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - r);
  context.lineTo(x, y + r);
  context.quadraticCurveTo(x, y, x + r, y);
  context.closePath();
}

function drawScatterplot() {
  const container = document.querySelector("#my_dataviz");
  if (!container || !state.data.length) {
    return;
  }

  d3.select(container).selectAll("*").remove();

  const containerWidth = container.getBoundingClientRect().width || 960;
  const width = Math.max(320, Math.floor(containerWidth));

  const maxViewHeight = Math.max(380, window.innerHeight - 250);
  const idealHeight = Math.round(width * 0.6);
  const height = Math.min(idealHeight, maxViewHeight);

  const margin =
    width < 640
      ? { top: 22, right: 18, bottom: 64, left: 68 }
      : { top: 28, right: 28, bottom: 72, left: 84 };

  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const scaleData = state.data.filter(
    (d) => isValidNumber(d[state.xField]) && isValidNumber(d[state.yField]),
  );
  const filteredData = getYearFilteredData();
  const validData = filteredData.filter(
    (d) => isValidNumber(d[state.xField]) && isValidNumber(d[state.yField]),
  );

  updateHeaderMetric(validData.length, filteredData.length, state.data.length);

  if (!scaleData.length) {
    d3.select("#plot-note").text(
      "No records have values for both selected axes.",
    );
    updateLegend(filteredData);
    return;
  }

  const xScaleInfo = createScale(
    scaleData.map((d) => d[state.xField]),
    [0, innerWidth],
  );
  const yScaleInfo = createScale(
    scaleData.map((d) => d[state.yField]),
    [innerHeight, 0],
  );
  const colorScale = createColorScale(filteredData);
  const pointRadius = width < 640 ? 3 : 3.8;
  const visiblePadding = 24;
  let pendingZoomFrame = null;
  let latestZoomTransform = d3.zoomIdentity;
  let currentVisibleData = [];

  const stage = d3
    .select(container)
    .append("div")
    .attr("class", "scatterplot-stage")
    .style("aspect-ratio", `${width} / ${height}`);

  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  const canvas = stage
    .append("canvas")
    .attr("class", "scatterplot-canvas")
    .attr("width", Math.floor(width * pixelRatio))
    .attr("height", Math.floor(height * pixelRatio))
    .style("width", "100%")
    .style("height", "100%");
  const context = canvas.node().getContext("2d");
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

  const svg = d3
    .select(stage.node())
    .append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("preserveAspectRatio", "xMidYMid meet")
    .style("width", "100%")
    .style("height", "100%");

  const defs = svg.append("defs");
  defs
    .append("clipPath")
    .attr("id", "scatter-clip")
    .append("rect")
    .attr("x", 0)
    .attr("y", 0)
    .attr("width", innerWidth)
    .attr("height", innerHeight)
    .attr("rx", 16);

  const root = svg
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  root
    .append("rect")
    .attr("x", 0)
    .attr("y", 0)
    .attr("width", innerWidth)
    .attr("height", innerHeight)
    .attr("rx", 16)
    .attr("fill", "transparent")
    .attr("stroke", "rgba(154, 178, 217, 0.12)");

  root
    .append("g")
    .attr("class", "grid")
    .call(
      d3
        .axisLeft(yScaleInfo.scale)
        .ticks(6)
        .tickSize(-innerWidth)
        .tickFormat(""),
    );

  root
    .append("g")
    .attr("class", "grid")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(
      d3
        .axisBottom(xScaleInfo.scale)
        .ticks(6)
        .tickSize(-innerHeight)
        .tickFormat(""),
    );

  const xAxis = root
    .append("g")
    .attr("class", "axis")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(d3.axisBottom(xScaleInfo.scale).ticks(6));

  const yAxis = root
    .append("g")
    .attr("class", "axis")
    .call(d3.axisLeft(yScaleInfo.scale).ticks(6));

  xAxis.selectAll(".tick line").attr("y2", 8);
  yAxis.selectAll(".tick line").attr("x2", -8);

  root
    .append("text")
    .attr("class", "axis-label")
    .attr("x", innerWidth / 2)
    .attr("y", innerHeight + 50)
    .attr("text-anchor", "middle")
    .text(fieldLabel(state.xField));

  root
    .append("text")
    .attr("class", "axis-label")
    .attr("transform", `translate(-56, ${innerHeight / 2}) rotate(-90)`)
    .attr("text-anchor", "middle")
    .text(fieldLabel(state.yField));

  const chart = root.append("g").attr("clip-path", "url(#scatter-clip)");

  const plottedData = validData.map((d, index) => ({
    ...d,
    __plotId: `${d.pl_name || d.hostname || "planet"}-${index}`,
    __x: xScaleInfo.scale(d[state.xField]),
    __y: yScaleInfo.scale(d[state.yField]),
    __color:
      colorScale && isValidNumber(d[state.colorField])
        ? colorScale(d[state.colorField])
        : "#8ea0b8",
  }));

  function visibleDataForTransform(transform) {
    const [x0, y0] = transform.invert([-visiblePadding, -visiblePadding]);
    const [x1, y1] = transform.invert([
      innerWidth + visiblePadding,
      innerHeight + visiblePadding,
    ]);
    const minX = Math.min(x0, x1);
    const maxX = Math.max(x0, x1);
    const minY = Math.min(y0, y1);
    const maxY = Math.max(y0, y1);

    return plottedData.filter(
      (d) => d.__x >= minX && d.__x <= maxX && d.__y >= minY && d.__y <= maxY,
    );
  }

  function renderVisiblePoints(transform) {
    const visibleData = visibleDataForTransform(transform);
    currentVisibleData = visibleData;

    context.clearRect(0, 0, width, height);

    context.save();
    drawRoundedRect(context, margin.left, margin.top, innerWidth, innerHeight, 16);
    context.fillStyle = "rgba(5, 11, 21, 0.55)";
    context.fill();
    context.clip();

    context.globalAlpha = 0.86;
    for (const d of visibleData) {
      const x = margin.left + transform.applyX(d.__x);
      const y = margin.top + transform.applyY(d.__y);

      context.beginPath();
      context.arc(x, y, pointRadius, 0, Math.PI * 2);
      context.fillStyle = d.__color;
      context.fill();
    }
    context.restore();
  }

  function nearestPointAt(screenX, screenY, transform) {
    const maxDistance = Math.max(8, pointRadius + 5);
    const maxDistanceSquared = maxDistance * maxDistance;
    let nearest = null;
    let nearestDistance = maxDistanceSquared;

    for (const d of currentVisibleData) {
      const dx = transform.applyX(d.__x) - screenX;
      const dy = transform.applyY(d.__y) - screenY;
      const distance = dx * dx + dy * dy;

      if (distance < nearestDistance) {
        nearest = d;
        nearestDistance = distance;
      }
    }

    return nearest;
  }

  chart
    .append("rect")
    .attr("class", "scatterplot-hit-layer")
    .attr("width", innerWidth)
    .attr("height", innerHeight)
    .on("mousemove", function (event) {
      const [x, y] = d3.pointer(event, this);
      const nearest = nearestPointAt(x, y, latestZoomTransform);

      if (nearest) {
        showTooltip(event, nearest);
      } else {
        hideTooltip();
      }
    })
    .on("mouseleave", hideTooltip);

  const minimapWidth = width < 640 ? 118 : 156;
  const minimapHeight = width < 640 ? 86 : 108;
  const minimapPadding = 12;
  const minimapX = Math.max(8, innerWidth - minimapWidth - 14);
  const minimapY = 14;
  const minimapXScale = xScaleInfo.scale
    .copy()
    .range([minimapPadding, minimapWidth - minimapPadding]);
  const minimapYScale = yScaleInfo.scale
    .copy()
    .range([minimapHeight - minimapPadding, minimapPadding]);
  const minimapSampleStep = Math.max(1, Math.ceil(plottedData.length / 1200));
  const minimapData = plottedData.filter(
    (d, index) => index % minimapSampleStep === 0,
  );

  defs
    .append("clipPath")
    .attr("id", "scatter-minimap-clip")
    .append("rect")
    .attr("x", 0)
    .attr("y", 0)
    .attr("width", minimapWidth)
    .attr("height", minimapHeight)
    .attr("rx", 12);

  const minimap = root
    .append("g")
    .attr("class", "scatter-minimap")
    .attr("transform", `translate(${minimapX},${minimapY})`);

  minimap
    .append("rect")
    .attr("class", "scatter-minimap-bg")
    .attr("width", minimapWidth)
    .attr("height", minimapHeight)
    .attr("rx", 12);

  minimap
    .append("g")
    .attr("clip-path", "url(#scatter-minimap-clip)")
    .selectAll("circle")
    .data(minimapData)
    .join("circle")
    .attr("class", "scatter-minimap-point")
    .attr("cx", (d) => minimapXScale(d[state.xField]))
    .attr("cy", (d) => minimapYScale(d[state.yField]))
    .attr("r", width < 640 ? 1 : 1.25)
    .attr("fill", (d) => d.__color);

  minimap
    .append("text")
    .attr("class", "scatter-minimap-label")
    .attr("x", 10)
    .attr("y", 15)
    .text("Zoom overview");

  const minimapViewport = minimap
    .append("rect")
    .attr("class", "scatter-minimap-viewport")
    .attr("rx", 5);

  function updateMinimapViewport(transform) {
    const [x0, y0] = transform.invert([0, 0]);
    const [x1, y1] = transform.invert([innerWidth, innerHeight]);

    const viewX0 = Math.max(0, Math.min(innerWidth, Math.min(x0, x1)));
    const viewX1 = Math.max(0, Math.min(innerWidth, Math.max(x0, x1)));
    const viewY0 = Math.max(0, Math.min(innerHeight, Math.min(y0, y1)));
    const viewY1 = Math.max(0, Math.min(innerHeight, Math.max(y0, y1)));

    const miniX0 =
      minimapPadding +
      (viewX0 / innerWidth) * (minimapWidth - minimapPadding * 2);
    const miniX1 =
      minimapPadding +
      (viewX1 / innerWidth) * (minimapWidth - minimapPadding * 2);
    const miniY0 =
      minimapPadding +
      (viewY0 / innerHeight) * (minimapHeight - minimapPadding * 2);
    const miniY1 =
      minimapPadding +
      (viewY1 / innerHeight) * (minimapHeight - minimapPadding * 2);

    minimapViewport
      .attr("x", miniX0)
      .attr("y", miniY0)
      .attr("width", Math.max(2, miniX1 - miniX0))
      .attr("height", Math.max(2, miniY1 - miniY0));
  }

  updateMinimapViewport(d3.zoomIdentity);
  renderVisiblePoints(d3.zoomIdentity);

  function renderZoomState(transform) {
    const newX = transform.rescaleX(xScaleInfo.scale);
    const newY = transform.rescaleY(yScaleInfo.scale);

    xAxis.call(d3.axisBottom(newX).ticks(6));
    yAxis.call(d3.axisLeft(newY).ticks(6));

    xAxis.selectAll(".tick line").attr("y2", 8);
    yAxis.selectAll(".tick line").attr("x2", -8);

    renderVisiblePoints(transform);
    updateMinimapViewport(transform);
  }

  function scheduleZoomRender(transform) {
    latestZoomTransform = transform;

    if (pendingZoomFrame) {
      return;
    }

    pendingZoomFrame = window.requestAnimationFrame(() => {
      pendingZoomFrame = null;
      renderZoomState(latestZoomTransform);
    });
  }

  const zoom = d3
    .zoom()
    .scaleExtent([0.5, 20])
    .filter((event) => {
      if (state.interactionMode !== "pan" || event.ctrlKey) {
        return false;
      }

      if (event.type === "wheel") {
        return true;
      }

      return !event.button;
    })
    .extent([
      [0, 0],
      [innerWidth, innerHeight],
    ])
    .on("zoom", (event) => {
      scheduleZoomRender(event.transform);
    });

  svg.call(zoom);

  const brush = d3
    .brush()
    .extent([
      [0, 0],
      [innerWidth, innerHeight],
    ])
    .on("end", function (event) {
      if (!event.selection) return;
      const [[x0, y0], [x1, y1]] = event.selection;
      d3.select(this).call(brush.move, null);

      const currentTransform = d3.zoomTransform(svg.node());

      const p0 = currentTransform.invert([x0, y0]);
      const p1 = currentTransform.invert([x1, y1]);

      const widthOrig = p1[0] - p0[0];
      const heightOrig = p1[1] - p0[1];

      const scaleX = innerWidth / widthOrig;
      const scaleY = innerHeight / heightOrig;
      const k = Math.min(scaleX, scaleY, 20);

      const centerX = (p0[0] + p1[0]) / 2;
      const centerY = (p0[1] + p1[1]) / 2;

      const transform = d3.zoomIdentity
        .translate(innerWidth / 2, innerHeight / 2)
        .scale(k)
        .translate(-centerX, -centerY);

      svg.transition().duration(750).call(zoom.transform, transform);

      // Switch back to pan mode automatically after zoom
      document.getElementById("mode-pan").click();
    });

  const brushGroup = chart.append("g").attr("class", "brush").call(brush);

  // Initial state
  if (state.interactionMode === "box") {
    brushGroup.style("display", null);
    svg.on(".zoom", null);
  } else {
    brushGroup.style("display", "none");
  }

  // Interaction controls event listeners
  document.getElementById("mode-pan").onclick = function () {
    state.interactionMode = "pan";
    this.classList.add("active");
    document.getElementById("mode-box").classList.remove("active");
    brushGroup.style("display", "none");
    svg.call(zoom);
  };

  document.getElementById("mode-box").onclick = function () {
    state.interactionMode = "box";
    this.classList.add("active");
    document.getElementById("mode-pan").classList.remove("active");
    brushGroup.style("display", null);
    svg.on(".zoom", null);
  };

  document.getElementById("reset-zoom").onclick = function () {
    svg.transition().duration(750).call(zoom.transform, d3.zoomIdentity);
  };

  updateLegend(filteredData);
  updatePlotNote(
    validData.length,
    filteredData.length,
    state.data.length,
    xScaleInfo.type,
    yScaleInfo.type,
  );
}

function scheduleRedraw() {
  window.clearTimeout(state.resizeTimer);
  state.resizeTimer = window.setTimeout(drawScatterplot, 120);
}

function loadCsvText(path, fallbackText, label) {
  return fetch(path)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Failed to load ${label} (${response.status})`);
      }
      return response.text();
    })
    .catch(() => {
      return fallbackText;
    });
}

Promise.all([
  loadCsvText("../data/nasa_export_large.csv", fallbackDataCsv, "NASA export"),
  loadCsvText(
    "../data/column_explanation.csv",
    fallbackGlossaryCsv,
    "glossary",
  ),
])
  .then(([dataText, glossaryText]) => {
    const data = d3.csvParse(dataText, parseDataRow);

    state.data = data;
    state.glossaryRows = d3.dsvFormat(";").parse(glossaryText);
    state.glossaryByColumn = new Map(
      state.glossaryRows.map((row) => [row.column, row]),
    );
    state.yearDomain = d3.extent(
      state.data.map((d) => d.disc_year).filter(isValidNumber),
    );
    tooltip = d3.select("#tooltip");

    buildControls();
    buildGlossaryTable(state.glossaryRows);
    updateLegend();
    drawScatterplot();

    window.addEventListener("resize", scheduleRedraw);
  })
  .catch((error) => {
    d3.select("#chart-summary").html(`
            <strong>Error</strong>
            <span>Could not load the NASA export</span>
        `);
    d3.select("#plot-note").text(error.message);
  });
