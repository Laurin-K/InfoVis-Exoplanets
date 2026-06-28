let allDimensions = [
    "sy_snum", "sy_pnum", "disc_year",
    "pl_orbper", "pl_orbsmax",
    "pl_rade", "pl_bmasse",
    "st_teff", "sy_dist"
];
const jupiterReferences = [
    "pl_bmassj", "pl_radj"
];
const earthReferences = [
    "pl_bmasse", "pl_rade"
];
let activeDimensions = [
    "sy_snum", "sy_pnum", "disc_year",
    "pl_orbper", "pl_orbsmax"
];
const brushes = {};

function toggleMassReference(checked) {
    const badgeEarth = document.getElementById('badge-earth');
    const badgeJupiter = document.getElementById('badge-jupiter');
    if (badgeEarth && badgeJupiter) {
        if (!checked) {
            badgeEarth.classList.add('active');
            badgeJupiter.classList.remove('active');
        } else {
            badgeEarth.classList.remove('active');
            badgeJupiter.classList.add('active');
        }
    }
    //Base reference is always earth
    if(!checked){
        //remove earth columns and add jupiter columns
        jupiterReferences.forEach(reference => {
            allDimensions.splice(allDimensions.indexOf(reference), 1,earthReferences[jupiterReferences.indexOf(reference)]);
            if(activeDimensions.indexOf(reference) !== -1){
                activeDimensions.splice(activeDimensions.indexOf(reference), 1, earthReferences[jupiterReferences.indexOf(reference)]);
            }
        })
    }
    else{
        earthReferences.forEach(reference => {
            allDimensions.splice(allDimensions.indexOf(reference), 1,jupiterReferences[earthReferences.indexOf(reference)]);
            if(activeDimensions.indexOf(reference) !== -1){
                activeDimensions.splice(activeDimensions.indexOf(reference), 1, jupiterReferences[earthReferences.indexOf(reference)]);
            }
        })
    }
    createCheckboxes()
    draw(activeDimensions)
}

function createCheckboxes() {

    d3.select("#controls").selectAll("*").remove();
    const container = d3.select("#controls");

    //create checkboxes for every entry in allDimensions
    //call updateDimensions when select has changed
    allDimensions.forEach(dim => {

        const label = container.append("label")
            .style("display", "block");

        label.append("input")
            .attr("type", "checkbox")
            .attr("value", dim)
            .property("checked", activeDimensions.includes(dim))
            .on("change", updateDimensions);

        const dimName = columnExplanations[dim] ? columnExplanations[dim].name : dim;
        label.append("span")
            .text(" " + dimName);
            
        // Setup tooltip if data is already loaded
        if (columnExplanations[dim]) {
            label.attr("title", columnExplanations[dim].name + ": " + columnExplanations[dim].desc);
        }
    });
}

function updateDimensions() {

    activeDimensions = [];

    d3.selectAll("#controls input:checked")
        .each(function() {
            activeDimensions.push(this.value);
        });

    draw(activeDimensions);
}

function initBrushes(dimensions){
    let tempBrushes = {...brushes};
    dimensions.forEach(dim => {
        brushes[dim] = null;
        if(tempBrushes[dim]){
            brushes[dim] = tempBrushes[dim];
        }
    });
}

let fullData = [];
let columnExplanations = {};

Promise.all([
    d3.csv("../data/nasa_export_small.csv", d => {
        // Convert all numeric strings into numbers so newly checked dimensions scale correctly
        Object.keys(d).forEach(key => {
            if (d[key] === "" || d[key].trim() === "") {
                d[key] = null;
            } else if (!isNaN(d[key])) {
                d[key] = +d[key];
            }
        });
        return d;
    }),
    fetch("../data/column_explanation.csv").then(response => response.text())
]).then(([data, explanationsCsv]) => {
    fullData = data;
    parseColumnExplanations(explanationsCsv);
    createTableFromCSV(explanationsCsv);

    createCheckboxes();
    draw(activeDimensions);
});

let tooltip;
function getTooltip() {
    if (!tooltip) {
        tooltip = d3.select("body").append("div")
            .style("position", "absolute")
            .style("visibility", "hidden")
            .style("background-color", "rgba(0, 0, 0, 0.85)")
            .style("color", "#fff")
            .style("padding", "8px 12px")
            .style("border-radius", "4px")
            .style("font-size", "12px")
            .style("pointer-events", "none")
            .style("z-index", "1000")
            .style("line-height", "1.4")
            .style("max-width", "250px")
            .style("box-shadow", "0 4px 8px rgba(0, 0, 0, 0.3)");
    }
    return tooltip;
}

function draw(dimensions)
{
    d3.select("#my_dataviz").selectAll("*").remove();
    let data = fullData;

    // SVG Setup
    const container = document.querySelector("#my_dataviz");
    const containerRect = container.getBoundingClientRect();
    
    // Expand to fit container, with a minimum size fallback
    const targetWidth = Math.max(800, containerRect.width || 800);
    const targetHeight = Math.max(460, containerRect.height || 460);

    const margin = { top: 50, right: 80, bottom: 110, left: 80 };
    const width = targetWidth - margin.left - margin.right;
    const height = targetHeight - margin.top - margin.bottom;

    const svg = d3.select("#my_dataviz")
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // Add transparent background for clicking to deselect
    svg.append("rect")
        .attr("width", width)
        .attr("height", height)
        .style("fill", "none")
        .style("pointer-events", "all")
        .on("click", function() {
            deselectAllDatalines();
        });

    // Y-Axis positions
    const x = d3.scalePoint()
        .domain(dimensions)
        .range([0, width]);

    // Y-Axis data
    const y = {};

    dimensions.forEach(dim => {

        const values = data
            .map(d => d[dim])
            .filter(v => v != null && !isNaN(v));

        const min = d3.min(values);
        const max = d3.max(values);

        const ratio = max / min;

        if (min > 0 && ratio > 50) {

            y[dim] = d3.scaleLog()
                .domain([min, max])
                .range([height, 0])
                .nice();

        } else {

            y[dim] = d3.scaleLinear()
                .domain([min, max])
                .range([height, 0])
                .nice();
        }

    });
    initBrushes(dimensions);

    // create Y-Axis
    const axis = d3.axisLeft();

    // Drag functionality for movable axes
    let dragging = {};
    function position(d) {
        let v = dragging[d];
        return v == null ? x(d) : v;
    }

    const g = svg.selectAll(".dimension")
        .data(dimensions)
        .enter()
        .append("g")
        .attr("class", "dimension")
        .attr("transform", d => `translate(${x(d)})`)
        .call(d3.drag()
            .filter(function(event) {
                // Only allow dragging when clicking the label (text or tspan)
                const tag = event.target.tagName.toLowerCase();
                return event.button === 0 && (tag === 'text' || tag === 'tspan');
            })
            .subject(function(event, d) { return {x: x(d)}; })
            .on("start", function(event, d) {
                dragging[d] = x(d);
                this.parentNode.appendChild(this); // bring to front
            })
            .on("drag", function(event, d) {
                dragging[d] = Math.min(width, Math.max(0, event.x));
                dimensions.sort(function(a, b) { return position(a) - position(b); });
                x.domain(dimensions);
                g.attr("transform", function(d) { return "translate(" + position(d) + ")"; });
                svg.selectAll(".line-dashed").attr("d", backgroundPath);
                svg.selectAll(".line-solid").attr("d", foregroundPath);
            })
            .on("end", function(event, d) {
                delete dragging[d];
                activeDimensions = [...dimensions]; // save new order
                d3.select(this).transition().duration(500).attr("transform", "translate(" + x(d) + ")");
                svg.selectAll(".line-dashed").transition().duration(500).attr("d", backgroundPath);
                svg.selectAll(".line-solid").transition().duration(500).attr("d", foregroundPath);
            })
        )
        .each(function(dim) {

            d3.select(this)
                .call(axis.scale(y[dim]));

        });

    // create labels
    g.append("text")
        .style("text-anchor", "middle")
        .style("fill", "black")
        .style("cursor", "pointer")
        .each(function(d) {
            const el = d3.select(this);
            const rawName = columnExplanations[d] ? columnExplanations[d].name : d;
            const words = rawName.split(/\s+/);
            
            if (words.length > 1) {
                const mid = Math.ceil(words.length / 2);
                const line1 = words.slice(0, mid).join(" ");
                const line2 = words.slice(mid).join(" ");
                el.append("tspan").attr("x", 0).attr("y", -24).text(line1);
                el.append("tspan").attr("x", 0).attr("y", -10).text(line2);
            } else {
                el.attr("y", -10).text(rawName);
            }
        })
        .on("mouseover", function(event, d) {
            d3.select(this)
                .style("font-weight", "bold");

            const expl = columnExplanations[d];
            let content = `<strong>${columnExplanations[d] ? columnExplanations[d].name : d}</strong>`;
            if (expl) {
                content = `<strong>${expl.name}</strong><br/>${expl.desc}`;
            }
            getTooltip().html(content)
                .style("visibility", "visible");
        })
        .on("mousemove", function(event) {
            getTooltip()
                .style("top", (event.pageY + 10) + "px")
                .style("left", (event.pageX + 10) + "px");
        })
        .on("mouseout", function() {
            d3.select(this)
                .style("font-weight", "normal");
            getTooltip().style("visibility", "hidden");
        });

    const brushInputs = g.append("foreignObject")
        .attr("x", -42)
        .attr("y", height + 15)
        .attr("width", 84)
        .attr("height", 85)
        .attr("class", "brush-inputs");

    brushInputs.append("xhtml:div")
        .style("display", "flex")
        .style("flex-direction", "column")
        .style("gap", "4px")
        .html(dim => {
            const domain = y[dim].domain();
            const minDomain = domain[0];
            const maxDomain = domain[1];
            return `
            <input type="number" class="brush-max" data-dim="${dim}" min="${minDomain}" max="${maxDomain}" placeholder="Max" step="any" title="Maximum filter value" />
            <input type="number" class="brush-min" data-dim="${dim}" min="${minDomain}" max="${maxDomain}" placeholder="Min" step="any" title="Minimum filter value" />
            <button class="reset-dim-brush" data-dim="${dim}" disabled title="Reset this filter">Reset</button>
        `});

    g.append("g")
        .attr("class", "brush")
        .each(function(dim) {
            
            const brush = d3.brushY()
                .extent([[-20, 0], [20, height]]) // increased from -10, 10
                .on("start brush end", function(event) {
                    brushed(event, dim, this);
                });

            // Store the brush reference on the DOM node for manual movement later
            this.__brush = brush;
            d3.select(this).call(brush);
            
            // Restore previous brush if it existed
            if (brushes[dim]) {
                const y1 = y[dim](brushes[dim][0]);
                const y0 = y[dim](brushes[dim][1]);
                d3.select(this).call(brush.move, [y0, y1]);
            }

        });

    d3.selectAll(".brush-max, .brush-min").on("change", function(event) {
        // Prevent event from bubbling and causing issues
        event.stopPropagation();
        
        const dim = this.dataset.dim;
        const parentDiv = this.parentElement;
        const maxInput = parentDiv.querySelector(".brush-max");
        const minInput = parentDiv.querySelector(".brush-min");
        
        let maxVal = parseFloat(maxInput.value);
        let minVal = parseFloat(minInput.value);

        const brushGroup = svg.selectAll(".dimension")
            .filter(d => d === dim)
            .select(".brush")
            .node();
        
        if (!brushGroup || !brushGroup.__brush) return;

        if (isNaN(maxVal) && isNaN(minVal)) {
            d3.select(brushGroup).call(brushGroup.__brush.move, null);
        } else {
            const scale = y[dim];
            const maxDomain = scale.domain()[1];
            const minDomain = scale.domain()[0];
            
            // Clamp values to the scale's domain to prevent brushes from going out of view
            if (!isNaN(maxVal)) {
                if (maxVal > maxDomain) maxVal = maxDomain;
                if (maxVal < minDomain) maxVal = minDomain;
                maxInput.value = maxVal;
            }
            if (!isNaN(minVal)) {
                if (minVal > maxDomain) minVal = maxDomain;
                if (minVal < minDomain) minVal = minDomain;
                minInput.value = minVal;
            }

            const effectiveMax = isNaN(maxVal) ? maxDomain : maxVal;
            const effectiveMin = isNaN(minVal) ? minDomain : minVal;
            
            const y0 = scale(effectiveMax);
            const y1 = scale(effectiveMin);
            
            d3.select(brushGroup).call(brushGroup.__brush.move, [Math.min(y0, y1), Math.max(y0, y1)]);
        }
    });

    d3.selectAll(".reset-dim-brush").on("click", function(event) {
        event.stopPropagation();
        const dim = this.dataset.dim;
        const brushGroup = svg.selectAll(".dimension")
            .filter(d => d === dim)
            .select(".brush")
            .node();
        
        if (brushGroup && brushGroup.__brush) {
            d3.select(brushGroup).call(brushGroup.__brush.move, null);
        }
    });

    const line = d3.line();

    function brushed(event, dim, brushNode) {

        const dimGroup = brushNode.parentNode;
        const maxInput = dimGroup.querySelector(".brush-max");
        const minInput = dimGroup.querySelector(".brush-min");
        const resetBtn = dimGroup.querySelector(".reset-dim-brush");

        if (!event.selection) {
            brushes[dim] = null;
            if (maxInput && document.activeElement !== maxInput) maxInput.value = "";
            if (minInput && document.activeElement !== minInput) minInput.value = "";
            if (resetBtn) resetBtn.disabled = true;
            updateLines();
            return;
        }

        const [y0, y1] = event.selection;

        let min = y[dim].invert(y1);
        let max = y[dim].invert(y0);

        if (min > max) [min, max] = [max, min];

        brushes[dim] = [min, max];
        
        // Only update input values if the user is not actively typing in them
        if (maxInput && document.activeElement !== maxInput) {
            maxInput.value = +max.toFixed(3);
        }
        if (minInput && document.activeElement !== minInput) {
            minInput.value = +min.toFixed(3);
        }
        if (resetBtn) resetBtn.disabled = false;

        updateLines();
    }

    function updateLines() {
        svg.selectAll(".line-group")
            .style("display", function(d) {
                return dimensions.every(dim => {
                    if (!brushes[dim]) return true;

                    const value = d[dim];
                    if (value == null) return false; // Hide if missing on brushed axis

                    const [min, max] = brushes[dim];
                    return value >= min && value <= max;
                }) ? null : "none";
            });
    }

    const foregroundLine = d3.line().defined(d => d !== null);
    function foregroundPath(d) {
        return foregroundLine(dimensions.map(dim => {
            if (d[dim] != null) return [position(dim), y[dim](d[dim])];
            return null;
        }));
    }

    const dashedLine = d3.line();
    function backgroundPath(d) {
        let points = [];
        let firstValidY = null;
        let lastValidY = null;
        
        dimensions.forEach((dim) => {
            if (d[dim] != null) {
                let yPos = y[dim](d[dim]);
                if (firstValidY === null) firstValidY = yPos;
                lastValidY = yPos;
                points.push([position(dim), yPos]);
            }
        });

        if (points.length === 0) return "";

        if (d[dimensions[0]] == null) {
            points.unshift([position(dimensions[0]), firstValidY]);
        }
        if (d[dimensions[dimensions.length - 1]] == null) {
            points.push([position(dimensions[dimensions.length - 1]), lastValidY]);
        }

        return dashedLine(points);
    }

    var color = d3.scaleOrdinal()
        .domain(["1", "2", "3", "4", "5"])
        .range([ "#440154ff", "#21908dff", "#fde725ff", "#123456ff", "#abcdefff"]);

    const lineGroups = svg.selectAll(".line-group")
        .data(data)
        .enter()
        .append("g")
        .attr("class", "line-group")
        .on("click", function(event, d) {
            event.stopPropagation();
            selectDataline(d);
        });

    lineGroups.append("path")
        .attr("class", "line-dashed")
        .attr("d", backgroundPath)
        .style("fill", "none")
        .style("stroke", d => color(d.sy_snum))
        .style("stroke-dasharray", "4 4")
        .style("opacity", 0.4);

    lineGroups.append("path")
        .attr("class", "line-solid")
        .attr("d", foregroundPath)
        .style("fill", "none")
        .style("stroke", d => color(d.sy_snum));

    // If a planet was already selected, re-apply the visual classes to the new paths
    if (selectedPlanet) {
        const exists = data.some(d => d.pl_name === selectedPlanet.pl_name);
        if (exists) {
            lineGroups.classed("selected", function(d) { return d.pl_name === selectedPlanet.pl_name; })
                      .classed("dimmed", function(d) { return d.pl_name !== selectedPlanet.pl_name; });
        } else {
            clearInfocard();
            selectedPlanet = null;
        }
    }

    // Apply any existing brushes to the newly created lines
    updateLines();
}

//Single planet selection
let selectedPlanet = null;

function selectDataline(d) {
    selectedPlanet = d;

    d3.selectAll(".line-group")
        .classed("selected", function(lineData) { return lineData.pl_name === d.pl_name; })
        .classed("dimmed", function(lineData) { return lineData.pl_name !== d.pl_name; });

    updateInfocard(d);
}

function deselectAllDatalines() {
    selectedPlanet = null;

    d3.selectAll(".line-group")
        .classed("selected", false)
        .classed("dimmed", false);

    clearInfocard();
}

//Infocard with selected planet
function updateInfocard(d) {
    const card = document.getElementById("planet-infocard");
    const contentDiv = document.getElementById("infocard-content");

    if (!card || !contentDiv) return;

    let html = `<h2>${d.pl_name || "Unknown Planet"}</h2>`;
    html += `<table>`;

    const fieldsToShow = [
        { key: "hostname", label: "Host Star" },
        { key: "disc_year", label: "Discovery Year" },
        { key: "sy_snum", label: "Number of Stars" },
        { key: "sy_pnum", label: "Number of Planets" },
        { key: "pl_orbper", label: "Orbital Period", unit: "days" },
        { key: "pl_orbsmax", label: "Semi-Major Axis", unit: "AU" },
        { key: "pl_bmasse", label: "Mass (Earth)", unit: "M⊕" },
        { key: "pl_bmassj", label: "Mass (Jupiter)", unit: "M_J" },
        { key: "pl_rade", label: "Radius (Earth)", unit: "R⊕" },
        { key: "pl_radj", label: "Radius (Jupiter)", unit: "R_J" },
        { key: "st_teff", label: "Stellar Temp", unit: "K" },
        { key: "sy_dist", label: "Distance", unit: "pc" }
    ];

    fieldsToShow.forEach(field => {
        const val = d[field.key];
        if (val !== undefined && val !== null && val !== "") {
            const displayVal = typeof val === "number" ? val.toLocaleString() : val;
            const unitSuffix = field.unit ? ` ${field.unit}` : "";
            html += `
                <tr>
                    <td style="font-weight: bold; padding-right: 15px;">${field.label}:</td>
                    <td>${displayVal}${unitSuffix}</td>
                </tr>
            `;
        }
    });

    html += `</table>`;

    contentDiv.innerHTML = html;
    card.style.display = "block";
}

function clearInfocard() {
    const card = document.getElementById("planet-infocard");
    if (card) {
        card.style.display = "none";
    }
}

//Table for column explanation

function parseColumnExplanations(csv) {
    const lines = csv.split(/\r?\n/);
    lines.slice(1).forEach(line => {
        if (!line.trim()) return;
        const parts = line.split(";");
        if (parts.length >= 3) {
            const col = parts[0].trim();
            const name = parts[1].trim();
            const desc = parts[2].trim();
            columnExplanations[col] = { name, desc };
        }
    });
}

function createTableFromCSV(csv) {
    const rows = csv.split(/\r?\n/).map(row => row.split(";")).filter(row => row.length >= 3);

    const tableHead = document.querySelector("#dataTable thead");
    const tableBody = document.querySelector("#dataTable tbody");

    // Clear existing content
    tableHead.innerHTML = "";
    tableBody.innerHTML = "";

    // Header (skip first column)
    const headerRow = document.createElement("tr");
    rows[0].slice(1).forEach(cell => {
        const th = document.createElement("th");
        th.textContent = cell;
        headerRow.appendChild(th);
    });
    tableHead.appendChild(headerRow);

    // Daten (skip first column)
    rows.slice(1).forEach(row => {
        const tr = document.createElement("tr");

        row.slice(1).forEach(cell => {
            const td = document.createElement("td");
            td.textContent = cell;
            tr.appendChild(td);
        });

        tableBody.appendChild(tr);
    });
}

function resetBrushing() {
    for (let dim in brushes) {
        brushes[dim] = null;
    }
    d3.selectAll(".brush").call(d3.brushY().move, null);
    d3.selectAll(".brush-max, .brush-min").property("value", "");
    d3.selectAll(".line").style("display", null);
}

function toggleFullscreen() {
    const chartPanel = document.getElementById('chart-panel');
    if (chartPanel) {
        chartPanel.classList.toggle('fullscreen');
        if (activeDimensions.length > 0) {
            setTimeout(() => draw(activeDimensions), 50);
        }
    }
}