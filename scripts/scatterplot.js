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
    "disc_year"
]);

const state = {
    data: [],
    glossaryRows: [],
    glossaryByColumn: new Map(),
    xField: "pl_orbsmax",
    yField: "pl_rade",
    yearDomain: [null, null],
    resizeTimer: null
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
    scatterDimensions.forEach(field => {
        row[field] = row[field] === "" ? null : +row[field];
    });

    return row;
}

function fieldLabel(field) {
    const entry = state.glossaryByColumn.get(field);
    return entry ? entry.name : field;
}

function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, char => {
        switch (char) {
            case "&":
                return "&amp;";
            case "<":
                return "&lt;";
            case ">":
                return "&gt;";
            case "\"":
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
            type: "linear"
        };
    }

    if (min > 0 && max / min > 50) {
        return {
            scale: d3.scaleLog().domain([min, max]).range(range).nice(),
            type: "log"
        };
    }

    if (min === max) {
        const pad = min === 0 ? 1 : Math.abs(min) * 0.2;
        return {
            scale: d3.scaleLinear().domain([min - pad, max + pad]).range(range).nice(),
            type: "linear"
        };
    }

    return {
        scale: d3.scaleLinear().domain([min, max]).range(range).nice(),
        type: "linear"
    };
}

function updateHeaderMetric(validCount, totalCount) {
    d3.select("#chart-summary")
        .html(`
            <strong>${d3.format(",")(validCount)}</strong>
            <span>of ${d3.format(",")(totalCount)} records plotted</span>
        `);
}

function updatePlotNote(validCount, totalCount, xScaleType, yScaleType) {
    const missingCount = totalCount - validCount;
    const notes = [];

    if (missingCount > 0) {
        notes.push(`${d3.format(",")(missingCount)} rows were skipped because one or both selected fields are missing.`);
    }

    notes.push(`X axis uses a ${xScaleType} scale.`);
    notes.push(`Y axis uses a ${yScaleType} scale.`);
    notes.push("Point color maps discovery year.");

    d3.select("#plot-note").text(notes.join(" "));
}

function updateLegend() {
    const [minYear, maxYear] = state.yearDomain;
    const yearGradient = d3.select("#year-gradient");

    if (!isValidNumber(minYear) || !isValidNumber(maxYear)) {
        yearGradient.style("background", "#8895ae");
        d3.select("#year-min").text("-");
        d3.select("#year-max").text("-");
        return;
    }

    if (minYear === maxYear) {
        const color = d3.interpolateViridis(0.55);
        yearGradient.style("background", color);
    } else {
        const colorScale = d3.scaleSequential(d3.interpolateViridis).domain([minYear, maxYear]);
        const stops = d3.range(0, 1.01, 0.2).map(step => {
            const value = minYear + (maxYear - minYear) * step;
            return `${colorScale(value)} ${Math.round(step * 100)}%`;
        });

        yearGradient.style("background", `linear-gradient(90deg, ${stops.join(", ")})`);
    }

    d3.select("#year-min").text(formatValue("disc_year", minYear));
    d3.select("#year-max").text(formatValue("disc_year", maxYear));
}

function createYearColorScale() {
    const [minYear, maxYear] = state.yearDomain;

    if (!isValidNumber(minYear) || !isValidNumber(maxYear)) {
        return null;
    }

    if (minYear === maxYear) {
        return () => d3.interpolateViridis(0.55);
    }

    return d3.scaleSequential(d3.interpolateViridis).domain([minYear, maxYear]);
}

function syncSelectValues() {
    d3.select("#x-select").property("value", state.xField);
    d3.select("#y-select").property("value", state.yField);
}

function ensureDistinctAxes(changedAxis) {
    if (state.xField !== state.yField) {
        return;
    }

    const replacement = scatterDimensions.find(dim => dim !== state[changedAxis === "x" ? "xField" : "yField"]);

    if (changedAxis === "x" && replacement) {
        state.yField = replacement;
    } else if (changedAxis === "y" && replacement) {
        state.xField = replacement;
    }
}

function buildControls() {
    const controls = d3.select("#controls");
    controls.selectAll("*").remove();

    const fields = scatterDimensions.map(field => ({
        value: field,
        label: fieldLabel(field)
    }));

    const xBlock = controls.append("div").attr("class", "control-block");
    xBlock.append("label").attr("for", "x-select").text("X axis");
    xBlock.append("select").attr("id", "x-select");

    const yBlock = controls.append("div").attr("class", "control-block");
    yBlock.append("label").attr("for", "y-select").text("Y axis");
    yBlock.append("select").attr("id", "y-select");

    controls.append("button")
        .attr("type", "button")
        .attr("class", "swap-btn")
        .attr("id", "swap-axes")
        .text("Swap axes");

    controls.append("p")
        .attr("class", "control-copy")
        .text("Axes switch to log scale automatically when the selected values span multiple orders of magnitude.");

    const xSelect = d3.select("#x-select");
    const ySelect = d3.select("#y-select");

    xSelect.selectAll("option")
        .data(fields)
        .join("option")
        .attr("value", d => d.value)
        .text(d => d.label);

    ySelect.selectAll("option")
        .data(fields)
        .join("option")
        .attr("value", d => d.value)
        .text(d => d.label);

    syncSelectValues();

    xSelect.on("change", function() {
        state.xField = this.value;
        ensureDistinctAxes("x");
        syncSelectValues();
        drawScatterplot();
    });

    ySelect.on("change", function() {
        state.yField = this.value;
        ensureDistinctAxes("y");
        syncSelectValues();
        drawScatterplot();
    });

    d3.select("#swap-axes").on("click", function() {
        const nextX = state.yField;
        state.yField = state.xField;
        state.xField = nextX;
        syncSelectValues();
        drawScatterplot();
    });
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
    columns.forEach(column => {
        const th = document.createElement("th");
        th.textContent = column;
        headerRow.appendChild(th);
    });
    tableHead.appendChild(headerRow);

    rows.forEach(row => {
        if (!row.column) {
            return;
        }

        const tr = document.createElement("tr");

        columns.forEach(column => {
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

    tooltip
        .classed("is-visible", true)
        .html(`
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

function drawScatterplot() {
    const container = document.querySelector("#my_dataviz");
    if (!container || !state.data.length) {
        return;
    }

    d3.select(container).selectAll("*").remove();

    const containerWidth = container.getBoundingClientRect().width || 960;
    const width = Math.min(1120, Math.max(320, Math.floor(containerWidth)));
    const height = Math.max(380, Math.round(width * 0.66));

    const margin = width < 640
        ? { top: 22, right: 18, bottom: 64, left: 68 }
        : { top: 28, right: 28, bottom: 72, left: 84 };

    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const validData = state.data.filter(d =>
        isValidNumber(d[state.xField]) && isValidNumber(d[state.yField])
    );

    updateHeaderMetric(validData.length, state.data.length);

    if (!validData.length) {
        d3.select("#plot-note").text("No records have values for both selected axes.");
        return;
    }

    const xScaleInfo = createScale(validData.map(d => d[state.xField]), [0, innerWidth]);
    const yScaleInfo = createScale(validData.map(d => d[state.yField]), [innerHeight, 0]);
    const colorScale = createYearColorScale();

    const wrapper = d3.select(container)
        .append("div")
        .style("position", "relative")
        .style("width", "100%")
        .style("height", "auto")
        .style("aspect-ratio", `${width} / ${height}`);

    const canvas = wrapper.append("canvas")
        .attr("width", innerWidth)
        .attr("height", innerHeight)
        .style("position", "absolute")
        .style("top", `${(margin.top / height) * 100}%`)
        .style("left", `${(margin.left / width) * 100}%`)
        .style("width", `${(innerWidth / width) * 100}%`)
        .style("height", `${(innerHeight / height) * 100}%`)
        .style("pointer-events", "none");

    const svg = wrapper.append("svg")
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("preserveAspectRatio", "xMidYMid meet")
        .style("position", "absolute")
        .style("top", "0")
        .style("left", "0")
        .style("width", "100%")
        .style("height", "100%");

    const defs = svg.append("defs");
    defs.append("clipPath")
        .attr("id", "scatter-clip")
        .append("rect")
        .attr("x", margin.left)
        .attr("y", margin.top)
        .attr("width", innerWidth)
        .attr("height", innerHeight)
        .attr("rx", 16);

    const root = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const eventRect = root.append("rect")
        .attr("x", 0)
        .attr("y", 0)
        .attr("width", innerWidth)
        .attr("height", innerHeight)
        .attr("fill", "rgba(5, 11, 21, 0.55)")
        .attr("stroke", "rgba(154, 178, 217, 0.12)")
        .style("cursor", "crosshair");

    root.append("g")
        .attr("class", "grid")
        .call(
            d3.axisLeft(yScaleInfo.scale)
                .ticks(6)
                .tickSize(-innerWidth)
                .tickFormat("")
        );

    root.append("g")
        .attr("class", "grid")
        .attr("transform", `translate(0,${innerHeight})`)
        .call(
            d3.axisBottom(xScaleInfo.scale)
                .ticks(6)
                .tickSize(-innerHeight)
                .tickFormat("")
        );

    const xAxis = root.append("g")
        .attr("class", "axis")
        .attr("transform", `translate(0,${innerHeight})`)
        .call(d3.axisBottom(xScaleInfo.scale).ticks(6));

    const yAxis = root.append("g")
        .attr("class", "axis")
        .call(d3.axisLeft(yScaleInfo.scale).ticks(6));

    xAxis.selectAll(".tick line")
        .attr("y2", 8);

    yAxis.selectAll(".tick line")
        .attr("x2", -8);

    root.append("text")
        .attr("class", "axis-label")
        .attr("x", innerWidth / 2)
        .attr("y", innerHeight + 50)
        .attr("text-anchor", "middle")
        .text(fieldLabel(state.xField));

    root.append("text")
        .attr("class", "axis-subtitle")
        .attr("x", innerWidth / 2)
        .attr("y", innerHeight + 68)
        .attr("text-anchor", "middle")
        .text(state.xField);

    root.append("text")
        .attr("class", "axis-label")
        .attr("transform", `translate(-56, ${innerHeight / 2}) rotate(-90)`)
        .attr("text-anchor", "middle")
        .text(fieldLabel(state.yField));

    root.append("text")
        .attr("class", "axis-subtitle")
        .attr("transform", `translate(-40, ${innerHeight / 2}) rotate(-90)`)
        .attr("text-anchor", "middle")
        .text(state.yField);

    const ctx = canvas.node().getContext("2d");
    const radius = width < 640 ? 3 : 3.8;
    
    validData.forEach(d => {
        const cx = xScaleInfo.scale(d[state.xField]);
        const cy = yScaleInfo.scale(d[state.yField]);
        const color = colorScale && isValidNumber(d.disc_year) ? colorScale(d.disc_year) : "#8ea0b8";

        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
        ctx.globalAlpha = 0.86;
        ctx.fillStyle = color;
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.lineWidth = 1;
        ctx.strokeStyle = "rgba(5, 10, 20, 0.72)";
        ctx.stroke();
    });

    const hoverPoint = root.append("circle")
        .attr("class", "hover-point")
        .style("display", "none")
        .attr("r", width < 640 ? 5 : 5.5)
        .attr("stroke", "rgba(5, 10, 20, 0.72)")
        .attr("stroke-width", 2);

    eventRect.on("mousemove", function(event) {
        const [mx, my] = d3.pointer(event);
        
        let closest = null;
        let minDistSq = Infinity;
        
        for (let i = 0; i < validData.length; i++) {
            const d = validData[i];
            const px = xScaleInfo.scale(d[state.xField]);
            const py = yScaleInfo.scale(d[state.yField]);
            const distSq = (px - mx) ** 2 + (py - my) ** 2;
            
            if (distSq < minDistSq) {
                minDistSq = distSq;
                closest = d;
            }
        }
        
        if (minDistSq < 400 && closest) {
            const cx = xScaleInfo.scale(closest[state.xField]);
            const cy = yScaleInfo.scale(closest[state.yField]);
            const color = colorScale && isValidNumber(closest.disc_year) ? colorScale(closest.disc_year) : "#8ea0b8";
            
            hoverPoint
                .style("display", null)
                .attr("cx", cx)
                .attr("cy", cy)
                .attr("fill", color)
                .attr("fill-opacity", 0.86);
                
            showTooltip(event, closest);
        } else {
            hoverPoint.style("display", "none");
            hideTooltip();
        }
    });

    eventRect.on("mouseleave", function() {
        hoverPoint.style("display", "none");
        hideTooltip();
    });

    updateLegend();
    updatePlotNote(validData.length, state.data.length, xScaleInfo.type, yScaleInfo.type);
}

function scheduleRedraw() {
    window.clearTimeout(state.resizeTimer);
    state.resizeTimer = window.setTimeout(drawScatterplot, 120);
}

function loadCsvText(path, fallbackText, label) {
    return fetch(path).then(response => {
        if (!response.ok) {
            throw new Error(`Failed to load ${label} (${response.status})`);
        }
        return response.text();
    }).catch(() => {
        return fallbackText;
    });
}

Promise.all([
    loadCsvText("../data/nasa_export_large.csv", fallbackDataCsv, "NASA export"),
    loadCsvText("../data/column_explanation.csv", fallbackGlossaryCsv, "glossary")
]).then(([dataText, glossaryText]) => {
    const data = d3.csvParse(dataText, parseDataRow);

    state.data = data;
    state.glossaryRows = d3.dsvFormat(";").parse(glossaryText);
    state.glossaryByColumn = new Map(state.glossaryRows.map(row => [row.column, row]));
    state.yearDomain = d3.extent(
        state.data
            .map(d => d.disc_year)
            .filter(isValidNumber)
    );
    tooltip = d3.select("#tooltip");

    buildControls();
    buildGlossaryTable(state.glossaryRows);
    updateLegend();
    drawScatterplot();

    window.addEventListener("resize", scheduleRedraw);
}).catch(error => {
    d3.select("#chart-summary")
        .html(`
            <strong>Error</strong>
            <span>Could not load the NASA export</span>
        `);
    d3.select("#plot-note").text(error.message);
});
