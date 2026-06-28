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
    xField: "pl_orbsmax",
    yField: "pl_bmasse",
    colorField: "disc_year",
    data: [],
    glossaryRows: [],
    glossaryByColumn: new Map(),
    yearDomain: [],
    resizeTimer: null,
    interactionMode: "pan"
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
    const legend = d3.select("#dynamic-legend");
    legend.html("");

    const field = state.colorField;
    const values = state.data.map(d => d[field]).filter(isValidNumber);
    if (!values.length) {
        legend.html("<div class='legend-caption'>No color data</div>");
        return;
    }

    legend.append("div").attr("class", "legend-heading").text("Point color").style("margin-bottom", "10px").style("font-weight", "bold");

    if (field === "sy_snum" || field === "sy_pnum") {
        const unique = Array.from(new Set(values)).sort((a,b)=>a-b);
        const colorScale = d3.scaleOrdinal(d3.schemeCategory10).domain(unique);
        
        const wrap = legend.append("div").style("display", "flex").style("gap", "10px").style("flex-wrap", "wrap");
        unique.forEach(val => {
            const item = wrap.append("div").style("display", "flex").style("align-items", "center").style("gap", "5px");
            item.append("div").style("width", "12px").style("height", "12px").style("border-radius", "50%").style("background", colorScale(val));
            item.append("span").style("font-size", "12px").text(val);
        });
        legend.append("div").attr("class", "legend-caption").style("margin-top", "12px").text(fieldLabel(field));
        
    } else {
        const [minVal, maxVal] = d3.extent(values);
        const bar = legend.append("div").attr("class", "legend-bar");
        const grad = bar.append("div").style("height", "10px").style("border-radius", "4px").style("width", "100%");
        
        if (minVal === maxVal) {
            grad.style("background", d3.interpolateViridis(0.55));
        } else {
            const stops = d3.range(0, 1.01, 0.2).map(step => {
                const value = minVal + (maxVal - minVal) * step;
                return `${d3.interpolateViridis(step)} ${Math.round(step * 100)}%`;
            });
            grad.style("background", `linear-gradient(90deg, ${stops.join(", ")})`);
        }
        
        const labels = legend.append("div").attr("class", "legend-labels").style("display", "flex").style("justify-content", "space-between").style("font-size", "12px").style("margin-top", "6px");
        labels.append("span").text(formatValue(field, minVal));
        labels.append("span").text(formatValue(field, maxVal));
        
        legend.append("div").attr("class", "legend-caption").style("margin-top", "8px").text(fieldLabel(field));
    }
}

function createColorScale() {
    const field = state.colorField;
    const values = state.data.map(d => d[field]).filter(isValidNumber);
    if (!values.length) return () => "#8ea0b8";

    if (field === "sy_snum" || field === "sy_pnum") {
        const unique = Array.from(new Set(values)).sort((a,b)=>a-b);
        return d3.scaleOrdinal(d3.schemeCategory10).domain(unique);
    } else {
        const [minVal, maxVal] = d3.extent(values);
        if (minVal === maxVal) return () => d3.interpolateViridis(0.55);
        
        const scale = d3.scaleSequential(d3.interpolateViridis).domain([minVal, maxVal]);
        return (val) => scale(val);
    }
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

    const colorSelect = d3.select("#color-select");
    colorSelect.property("value", state.colorField);
    colorSelect.on("change", function() {
        state.colorField = this.value;
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
    const width = Math.max(320, Math.floor(containerWidth));
    
    const maxViewHeight = Math.max(380, window.innerHeight - 250);
    const idealHeight = Math.round(width * 0.60);
    const height = Math.min(idealHeight, maxViewHeight);

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
    const colorScale = createColorScale();

    const svg = d3.select(container)
        .append("svg")
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("preserveAspectRatio", "xMidYMid meet")
        .style("width", "100%")
        .style("height", "auto");

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

    root.append("rect")
        .attr("x", 0)
        .attr("y", 0)
        .attr("width", innerWidth)
        .attr("height", innerHeight)
        .attr("rx", 16)
        .attr("fill", "rgba(5, 11, 21, 0.55)")
        .attr("stroke", "rgba(154, 178, 217, 0.12)");

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

    xAxis.selectAll(".tick line").attr("y2", 8);
    yAxis.selectAll(".tick line").attr("x2", -8);

    root.append("text")
        .attr("class", "axis-label")
        .attr("x", innerWidth / 2)
        .attr("y", innerHeight + 50)
        .attr("text-anchor", "middle")
        .text(fieldLabel(state.xField));

    root.append("text")
        .attr("class", "axis-label")
        .attr("transform", `translate(-56, ${innerHeight / 2}) rotate(-90)`)
        .attr("text-anchor", "middle")
        .text(fieldLabel(state.yField));

    const chart = root.append("g")
        .attr("clip-path", "url(#scatter-clip)");

    const dots = chart.append("g");

    dots.selectAll("circle")
        .data(validData)
        .join("circle")
        .attr("class", "point")
        .attr("cx", d => xScaleInfo.scale(d[state.xField]))
        .attr("cy", d => yScaleInfo.scale(d[state.yField]))
        .attr("r", width < 640 ? 3 : 3.8)
        .attr("fill", d => colorScale && isValidNumber(d[state.colorField]) ? colorScale(d[state.colorField]) : "#8ea0b8")
        .attr("fill-opacity", 0.86)
        .attr("stroke", "rgba(5, 10, 20, 0.72)")
        .attr("stroke-width", 1)
        .on("mouseenter", function(event, datum) {
            d3.select(this)
                .attr("stroke-width", 2);
            showTooltip(event, datum);
        })
        .on("mousemove", function(event, datum) {
            showTooltip(event, datum);
        })
        .on("mouseleave", function() {
            d3.select(this)
                .attr("stroke-width", 1);
            hideTooltip();
        });

    const zoom = d3.zoom()
        .scaleExtent([0.5, 20])
        .extent([[0, 0], [innerWidth, innerHeight]])
        .on("zoom", (event) => {
            dots.attr("transform", event.transform);
            
            const newX = event.transform.rescaleX(xScaleInfo.scale);
            const newY = event.transform.rescaleY(yScaleInfo.scale);
            
            xAxis.call(d3.axisBottom(newX).ticks(6));
            yAxis.call(d3.axisLeft(newY).ticks(6));
            
            xAxis.selectAll(".tick line").attr("y2", 8);
            yAxis.selectAll(".tick line").attr("x2", -8);
            
            dots.selectAll("circle")
                .attr("r", (width < 640 ? 3 : 3.8) / event.transform.k)
                .attr("stroke-width", 1 / event.transform.k);
        });

    svg.call(zoom);

    const brush = d3.brush()
        .extent([[0, 0], [innerWidth, innerHeight]])
        .on("end", function(event) {
            if (!event.selection) return;
            const [[x0, y0], [x1, y1]] = event.selection;
            d3.select(this).call(brush.move, null);
            
            const scaleX = innerWidth / (x1 - x0);
            const scaleY = innerHeight / (y1 - y0);
            const k = Math.min(scaleX, scaleY, 20);
            const transform = d3.zoomIdentity
                .translate(innerWidth / 2, innerHeight / 2)
                .scale(k)
                .translate(-(x0 + x1) / 2, -(y0 + y1) / 2);
            
            svg.transition().duration(750).call(zoom.transform, transform);
            
            // Switch back to pan mode automatically after zoom
            document.getElementById("mode-pan").click();
        });

    const brushGroup = chart.append("g")
        .attr("class", "brush")
        .call(brush);

    // Initial state
    if (state.interactionMode === "box") {
        brushGroup.style("pointer-events", "all");
        svg.on(".zoom", null);
    } else {
        brushGroup.style("pointer-events", "none");
    }

    // Interaction controls event listeners
    document.getElementById("mode-pan").onclick = function() {
        state.interactionMode = "pan";
        this.classList.add("active");
        document.getElementById("mode-box").classList.remove("active");
        brushGroup.style("pointer-events", "none");
        svg.call(zoom);
    };

    document.getElementById("mode-box").onclick = function() {
        state.interactionMode = "box";
        this.classList.add("active");
        document.getElementById("mode-pan").classList.remove("active");
        brushGroup.style("pointer-events", "all");
        svg.on(".zoom", null);
    };

    document.getElementById("reset-zoom").onclick = function() {
        svg.transition().duration(750).call(zoom.transform, d3.zoomIdentity);
    };

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
