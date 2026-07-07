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
let scaleMode = "auto";
let colorField = "disc_year";
let colorPalette = "lch-spectrum";

const colorFieldOptions = [
    "sy_snum", "sy_pnum", "disc_year",
    "pl_orbper", "pl_orbsmax",
    "pl_rade", "pl_bmasse",
    "st_teff", "sy_dist"
];

const categoricalColorFields = new Set(["sy_snum", "sy_pnum"]);
const integerCountFields = new Set(["sy_snum", "sy_pnum"]);

function isIntegerCountField(field) {
    return integerCountFields.has(field);
}

function getIntegerTickValues(domain) {
    const min = Math.ceil(domain[0]);
    const max = Math.floor(domain[1]);
    if (max < min) return [];

    return d3.range(min, max + 1);
}

function formatBrushValue(dim, value) {
    return isIntegerCountField(dim) ? Math.round(value) : +value.toFixed(3);
}

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

function createPlotOptionControls() {
    const colorFieldSelect = d3.select("#color-field-select");
    const scaleModeSelect = d3.select("#scale-mode-select");
    const colorPaletteSelect = d3.select("#color-palette-select");

    colorFieldSelect
        .selectAll("option")
        .data(colorFieldOptions)
        .join("option")
        .attr("value", d => d)
        .text(d => columnExplanations[d] ? columnExplanations[d].name : d);

    colorFieldSelect.property("value", colorField);
    scaleModeSelect.property("value", scaleMode);
    colorPaletteSelect.property("value", colorPalette);

    colorFieldSelect.on("change", function() {
        colorField = this.value;
        draw(activeDimensions);
    });

    scaleModeSelect.on("change", function() {
        scaleMode = this.value;
        draw(activeDimensions);
    });

    colorPaletteSelect.on("change", function() {
        colorPalette = this.value;
        draw(activeDimensions);
    });
}

function getReadableFieldName(field) {
    return columnExplanations[field] ? columnExplanations[field].name : field;
}

function createLchColor(hue, lightness = 68, chroma = 64) {
    return d3.hcl(hue, chroma, lightness).formatHex();
}

function buildColorScale(data) {
    const values = data
        .map(d => d[colorField])
        .filter(v => v != null && !isNaN(v));

    if (!values.length) {
        return {
            color: () => "#8fe3c7",
            legendItems: [{ label: "No data", color: "#8fe3c7" }]
        };
    }

    if (categoricalColorFields.has(colorField)) {
        const categories = Array.from(new Set(values.map(String))).sort((a, b) => +a - +b);
        const colorByCategory = new Map(categories.map((category, index) => {
            const ratio = categories.length <= 1 ? 0.5 : index / (categories.length - 1);
            let hue = (index * 360 / Math.max(categories.length, 1) + 25) % 360;

            if (colorPalette === "lch-warm-cool") {
                hue = 260 - ratio * 210;
            }

            if (colorPalette === "lch-categorical") {
                const categoricalHues = [25, 88, 155, 214, 282, 340];
                hue = categoricalHues[index % categoricalHues.length];
            }

            return [category, createLchColor(hue, 68, 62)];
        }));

        return {
            color: d => colorByCategory.get(String(d[colorField])) || "#8fe3c7",
            legendItems: categories.map(category => ({
                label: category,
                color: colorByCategory.get(category)
            }))
        };
    }

    const extent = d3.extent(values);
    const sameValue = extent[0] === extent[1];
    const colorForRatio = ratio => {
        const t = sameValue ? 0.5 : Math.max(0, Math.min(1, ratio));

        if (colorPalette === "lch-warm-cool") {
            return createLchColor(260 - t * 210, 68, 58);
        }

        if (colorPalette === "lch-categorical") {
            const band = Math.min(5, Math.floor(t * 6));
            return createLchColor((band * 58 + 20) % 360, 68, 62);
        }

        return createLchColor((20 + t * 300) % 360, 68, 62);
    };

    return {
        color: d => {
            const value = d[colorField];
            if (value == null || isNaN(value)) return "rgba(165, 184, 217, 0.55)";
            return colorForRatio((value - extent[0]) / (extent[1] - extent[0]));
        },
        legendItems: d3.range(5).map(i => {
            const ratio = i / 4;
            const value = extent[0] + (extent[1] - extent[0]) * ratio;
            return {
                label: formatLegendValue(value),
                color: colorForRatio(ratio)
            };
        })
    };
}

function formatLegendValue(value) {
    if (colorField === "disc_year") return d3.format("d")(Math.round(value));
    if (Math.abs(value) >= 1000) return d3.format(".2s")(value);
    if (Math.abs(value) >= 10) return d3.format(".0f")(value);
    return d3.format(".2~f")(value);
}

function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, char => {
        switch (char) {
            case "&": return "&amp;";
            case "<": return "&lt;";
            case ">": return "&gt;";
            case '"': return "&quot;";
            case "'": return "&#39;";
            default: return char;
        }
    });
}

function formatDimensionValue(dim, value) {
    if (value === undefined || value === null || value === "") return "n/a";
    if (typeof value !== "number" || Number.isNaN(value)) return String(value);
    if (dim === "disc_year" || isIntegerCountField(dim)) return d3.format("d")(Math.round(value));
    if (Math.abs(value) >= 1000 || Math.abs(value) < 0.01) return d3.format(".4~g")(value);
    return d3.format(".3~f")(value);
}

function updateColorLegend(colorConfig) {
    const legend = d3.select("#color-legend");
    legend.selectAll("*").remove();

    legend.append("div")
        .attr("class", "legend-title")
        .text(`Color: ${getReadableFieldName(colorField)}`);

    const items = legend.selectAll(".legend-item")
        .data(colorConfig.legendItems)
        .join("div")
        .attr("class", "legend-item");

    items.append("span")
        .attr("class", "legend-swatch")
        .style("background", d => d.color);

    items.append("span")
        .text(d => d.label);
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
    createPlotOptionControls();
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
    const scaleTypes = {};

    dimensions.forEach(dim => {

        const values = data
            .map(d => d[dim])
            .filter(v => v != null && !isNaN(v));

        const min = d3.min(values);
        const max = d3.max(values);

        const ratio = max / min;
        const canUseLog = min > 0 && max > 0;
        const shouldUseLog =
            !isIntegerCountField(dim) &&
            canUseLog &&
            (scaleMode === "log" || (scaleMode === "auto" && ratio > 50));

        if (shouldUseLog) {

            y[dim] = d3.scaleLog()
                .domain([min, max])
                .range([height, 0])
                .nice();
            scaleTypes[dim] = "LOG";

        } else {

            y[dim] = d3.scaleLinear()
                .domain([min, max])
                .range([height, 0])
                .nice();
            scaleTypes[dim] = "LIN";
        }

    });
    initBrushes(dimensions);

    // create Y-Axis
    function createAxis(dim) {
        const dimAxis = d3.axisLeft(y[dim]);

        if (isIntegerCountField(dim)) {
            dimAxis
                .tickValues(getIntegerTickValues(y[dim].domain()))
                .tickFormat(d3.format("d"));
        }

        return dimAxis;
    }

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
                .call(createAxis(dim));

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
            el.append("tspan")
                .attr("class", `scale-tag scale-tag-${scaleTypes[d].toLowerCase()}`)
                .attr("x", 0)
                .attr("y", -42)
                .text(scaleTypes[d]);
            
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
            const step = isIntegerCountField(dim) ? "1" : "any";
            return `
            <input type="number" class="brush-max" data-dim="${dim}" min="${minDomain}" max="${maxDomain}" placeholder="Max" step="${step}" title="Maximum filter value" />
            <input type="number" class="brush-min" data-dim="${dim}" min="${minDomain}" max="${maxDomain}" placeholder="Min" step="${step}" title="Minimum filter value" />
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

            if (isIntegerCountField(dim)) {
                if (!isNaN(maxVal)) maxVal = Math.round(maxVal);
                if (!isNaN(minVal)) minVal = Math.round(minVal);
            }
            
            // Clamp values to the scale's domain to prevent brushes from going out of view
            if (!isNaN(maxVal)) {
                if (maxVal > maxDomain) maxVal = maxDomain;
                if (maxVal < minDomain) maxVal = minDomain;
                maxInput.value = formatBrushValue(dim, maxVal);
            }
            if (!isNaN(minVal)) {
                if (minVal > maxDomain) minVal = maxDomain;
                if (minVal < minDomain) minVal = minDomain;
                minInput.value = formatBrushValue(dim, minVal);
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

        if (isIntegerCountField(dim)) {
            const midpoint = (min + max) / 2;
            min = Math.ceil(min);
            max = Math.floor(max);

            if (min > max) {
                min = Math.round(midpoint);
                max = min;
            }
        }

        brushes[dim] = [min, max];
        
        // Only update input values if the user is not actively typing in them
        if (maxInput && document.activeElement !== maxInput) {
            maxInput.value = formatBrushValue(dim, max);
        }
        if (minInput && document.activeElement !== minInput) {
            minInput.value = formatBrushValue(dim, min);
        }
        if (resetBtn) resetBtn.disabled = false;

        updateLines();
    }

    function updateLines() {
        svg.selectAll(".line-group")
            .style("display", function(d) {
                return passesActiveBrushes(d) ? null : "none";
            });
    }

    function passesActiveBrushes(d) {
        return dimensions.every(dim => {
            if (!brushes[dim]) return true;

            const value = d[dim];
            if (value == null) return false; // Hide if missing on brushed axis

            const [min, max] = brushes[dim];
            return value >= min && value <= max;
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

    function foregroundPoints(d) {
        return dimensions
            .map(dim => {
                if (d[dim] != null) return [position(dim), y[dim](d[dim])];
                return null;
            })
            .filter(Boolean);
    }

    const projectedForegroundPoints = new WeakMap();
    function getForegroundPoints(d) {
        if (!projectedForegroundPoints.has(d)) {
            projectedForegroundPoints.set(d, foregroundPoints(d));
        }
        return projectedForegroundPoints.get(d);
    }

    function distanceToLine(points, px, py) {
        if (points.length === 1) {
            return Math.hypot(px - points[0][0], py - points[0][1]);
        }

        let minDistance = Infinity;
        for (let i = 1; i < points.length; i++) {
            minDistance = Math.min(minDistance, distanceToSegment(px, py, points[i - 1], points[i]));
        }
        return minDistance;
    }

    function distanceToSegment(px, py, a, b) {
        const dx = b[0] - a[0];
        const dy = b[1] - a[1];
        const lengthSquared = dx * dx + dy * dy;

        if (lengthSquared === 0) return Math.hypot(px - a[0], py - a[1]);

        const t = Math.max(0, Math.min(1, ((px - a[0]) * dx + (py - a[1]) * dy) / lengthSquared));
        const closestX = a[0] + t * dx;
        const closestY = a[1] + t * dy;
        return Math.hypot(px - closestX, py - closestY);
    }

    function updateHoverFromPointer(event) {
        if (selectedPlanet) return;

        const [px, py] = d3.pointer(event, svg.node());

        if (px < 0 || px > width || py < 0 || py > height) {
            clearHoverFocus();
            return;
        }

        let nearest = null;
        let nearestDistance = Infinity;
        let currentHovered = null;
        let currentHoveredDistance = Infinity;

        data.forEach(d => {
            if (!passesActiveBrushes(d)) return;
            const points = getForegroundPoints(d);
            if (points.length === 0) return;

            const distance = distanceToLine(points, px, py);
            if (hoveredPlanetName && d.pl_name === hoveredPlanetName) {
                currentHovered = d;
                currentHoveredDistance = distance;
            }

            if (distance < nearestDistance) {
                nearestDistance = distance;
                nearest = d;
            }
        });

        if (
            currentHovered &&
            currentHoveredDistance <= 12 &&
            nearestDistance + 4 >= currentHoveredDistance
        ) {
            focusDatalineOnHover(currentHovered);
            return;
        }

        if (nearest && nearestDistance <= 7) {
            focusDatalineOnHover(nearest);
        } else {
            clearHoverFocus();
        }
    }

    const colorConfig = buildColorScale(data);
    updateColorLegend(colorConfig);

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
        .style("stroke", d => colorConfig.color(d))
        .style("stroke-dasharray", "4 4")
        .style("opacity", 0.4);

    lineGroups.append("path")
        .attr("class", "line-solid")
        .attr("d", foregroundPath)
        .style("fill", "none")
        .style("stroke", d => colorConfig.color(d));

    const hoverLayer = svg.append("g")
        .attr("class", "hover-highlight-layer")
        .style("pointer-events", "none")
        .style("display", "none");

    const hoverHaloPath = hoverLayer.append("path")
        .attr("class", "hover-halo-line")
        .style("fill", "none")
        .style("stroke", "rgba(255, 255, 255, 0.9)")
        .style("stroke-linecap", "round")
        .style("stroke-linejoin", "round")
        .style("stroke-width", "7px")
        .style("opacity", 0.78);

    const hoverDashedPath = hoverLayer.append("path")
        .attr("class", "line-dashed")
        .style("fill", "none")
        .style("stroke-dasharray", "4 4")
        .style("stroke-linecap", "round")
        .style("stroke-linejoin", "round")
        .style("stroke-width", "5px")
        .style("opacity", 0.82);

    const hoverSolidPath = hoverLayer.append("path")
        .attr("class", "line-solid")
        .style("fill", "none")
        .style("stroke-linecap", "round")
        .style("stroke-linejoin", "round")
        .style("stroke-width", "5px")
        .style("opacity", 1);

    hoverRenderer = {
        focus(d) {
            const stroke = colorConfig.color(d);
            const dashedPath = backgroundPath(d);
            const solidPath = foregroundPath(d);
            hoverLayer.style("display", null);
            hoverHaloPath
                .attr("d", solidPath);
            hoverDashedPath
                .attr("d", dashedPath)
                .style("stroke", stroke);
            hoverSolidPath
                .attr("d", solidPath)
                .style("stroke", stroke);
        },
        clear() {
            hoverLayer.style("display", "none");
        }
    };

    const selectedValueLayer = svg.append("g")
        .attr("class", "selected-value-layer")
        .style("pointer-events", "none");

    selectedValueRenderer = {
        render(d) {
            const valueData = dimensions
                .map(dim => ({
                    dim,
                    label: formatDimensionValue(dim, d[dim]),
                    value: d[dim]
                }))
                .filter(item => item.value !== undefined && item.value !== null && item.value !== "");

            const markers = selectedValueLayer
                .selectAll(".selected-value-marker")
                .data(valueData, item => item.dim)
                .join(
                    enter => {
                        const marker = enter.append("g")
                            .attr("class", "selected-value-marker");

                        marker.append("circle")
                            .attr("r", 4.5);

                        marker.append("rect")
                            .attr("class", "selected-value-box")
                            .attr("rx", 5)
                            .attr("ry", 5);

                        marker.append("text")
                            .attr("x", 8)
                            .attr("y", -8);

                        return marker;
                    },
                    update => update,
                    exit => exit.remove()
                );

            markers
                .attr("transform", item => `translate(${position(item.dim)},${y[item.dim](item.value)})`);

            markers.select("text")
                .text(item => item.label)
                .attr("text-anchor", item => position(item.dim) > width - 70 ? "end" : "start")
                .attr("x", item => position(item.dim) > width - 70 ? -8 : 8);

            markers.each(function() {
                const marker = d3.select(this);
                const textNode = marker.select("text").node();
                if (!textNode) return;

                const bbox = textNode.getBBox();
                marker.select(".selected-value-box")
                    .attr("x", bbox.x - 5)
                    .attr("y", bbox.y - 3)
                    .attr("width", bbox.width + 10)
                    .attr("height", bbox.height + 6);
            });

            const selectedPoints = foregroundPoints(d);
            const firstSelectedPoint = selectedPoints.length ? selectedPoints[0] : [0, 18];
            const namePoint = [-margin.left + 8, Math.max(20, Math.min(height - 18, firstSelectedPoint[1]))];

            const nameLabel = selectedValueLayer
                .selectAll(".selected-planet-name")
                .data([d]);

            const nameEnter = nameLabel.enter()
                .append("g")
                .attr("class", "selected-planet-name");

            nameEnter.append("rect")
                .attr("rx", 7)
                .attr("ry", 7);

            nameEnter.append("text")
                .attr("y", 4)
                .text(planet => planet.pl_name || "Unknown Planet");

            const mergedNameLabel = nameEnter.merge(nameLabel);
            mergedNameLabel
                .attr("transform", () => {
                    return `translate(${namePoint[0]},${namePoint[1]})`;
                });

            mergedNameLabel.select("text")
                .text(planet => planet.pl_name || "Unknown Planet");

            mergedNameLabel.each(function() {
                const label = d3.select(this);
                const textNode = label.select("text").node();
                if (!textNode) return;

                const bbox = textNode.getBBox();
                const labelWidth = bbox.width + 18;
                const offsetX = 0;

                label.select("text")
                    .attr("x", offsetX + 9);

                label.select("rect")
                    .attr("x", offsetX)
                    .attr("y", bbox.y - 6)
                    .attr("width", labelWidth)
                    .attr("height", bbox.height + 12);
            });
        },
        clear() {
            selectedValueLayer.selectAll("*").remove();
        }
    };

    // If a planet was already selected, re-apply the visual classes to the new paths
    if (selectedPlanet) {
        const exists = data.some(d => d.pl_name === selectedPlanet.pl_name);
        if (exists) {
            lineGroups.classed("selected", function(d) { return d.pl_name === selectedPlanet.pl_name; })
                      .classed("dimmed", function(d) { return d.pl_name !== selectedPlanet.pl_name; });
            const currentSelected = data.find(d => d.pl_name === selectedPlanet.pl_name);
            selectedPlanet = currentSelected;
            updateInfocard(currentSelected);
            selectedValueRenderer.render(currentSelected);
        } else {
            clearInfocard();
            if (selectedValueRenderer) selectedValueRenderer.clear();
            selectedPlanet = null;
        }
    }

    // Apply any existing brushes to the newly created lines
    updateLines();

    let hoverFrame = null;
    let latestHoverEvent = null;

    svg
        .on("mousemove.hover", function(event) {
            latestHoverEvent = event;
            if (hoverFrame) return;

            hoverFrame = requestAnimationFrame(() => {
                hoverFrame = null;
                if (latestHoverEvent) {
                    updateHoverFromPointer(latestHoverEvent);
                }
            });
        })
        .on("mouseleave.hover", function() {
            if (hoverFrame) {
                cancelAnimationFrame(hoverFrame);
                hoverFrame = null;
            }
            latestHoverEvent = null;
            clearHoverFocus();
        });
}

//Single planet selection
let selectedPlanet = null;
let hoveredPlanetName = null;
let hoverClearTimeout = null;
let hoverRenderer = null;
let selectedValueRenderer = null;

function focusDatalineOnHover(d) {
    if (hoverClearTimeout) {
        clearTimeout(hoverClearTimeout);
        hoverClearTimeout = null;
    }

    if (hoveredPlanetName === d.pl_name) {
        if (hoverRenderer) hoverRenderer.focus(d);
        return;
    }
    hoveredPlanetName = d.pl_name;

    if (hoverRenderer) hoverRenderer.focus(d);
}

function clearHoverFocus(force = false) {
    if (!hoveredPlanetName && !selectedPlanet) {
        if (hoverRenderer) hoverRenderer.clear();
        return;
    }

    if (hoverClearTimeout) clearTimeout(hoverClearTimeout);

    const clear = () => {
        hoveredPlanetName = null;
        if (hoverRenderer) hoverRenderer.clear();

        if (selectedPlanet) {
            d3.selectAll(".line-group")
                .classed("selected", function(lineData) { return lineData.pl_name === selectedPlanet.pl_name; })
                .classed("dimmed", function(lineData) { return lineData.pl_name !== selectedPlanet.pl_name; });
        }
    };

    if (force) {
        clear();
    } else {
        hoverClearTimeout = setTimeout(clear, 80);
    }
}

function selectDataline(d) {
    selectedPlanet = d;
    clearHoverFocus(true);

    d3.selectAll(".line-group")
        .classed("selected", function(lineData) { return lineData.pl_name === d.pl_name; })
        .classed("dimmed", function(lineData) { return lineData.pl_name !== d.pl_name; });

    if (selectedValueRenderer) selectedValueRenderer.render(d);
    updateInfocard(d);
}

function deselectAllDatalines() {
    selectedPlanet = null;
    hoveredPlanetName = null;

    d3.selectAll(".line-group")
        .classed("selected", false)
        .classed("dimmed", false);

    if (selectedValueRenderer) selectedValueRenderer.clear();
    clearInfocard();
}

//Infocard with selected planet
function updateInfocard(d) {
    const card = document.getElementById("planet-infocard");
    const contentDiv = document.getElementById("infocard-content");

    if (!card || !contentDiv) return;

    const dataFields = fullData.columns || Object.keys(d);
    const safeFields = dataFields.filter(key => !key.startsWith("__"));

    let selectedHtml = `
        <div class="infocard-layout">
            <aside class="infocard-planet-name">
                <p class="infocard-kicker">Selected planet</p>
                <h2>${escapeHtml(d.pl_name || "Unknown Planet")}</h2>
                <p>${escapeHtml(d.hostname || "Unknown host")}</p>
            </aside>
            <div class="infocard-data">
                <p class="infocard-note">All available data fields for the selected planet.</p>
                <table>
    `;

    safeFields.forEach(dim => {
        const label = columnExplanations[dim] ? columnExplanations[dim].name : dim;
        selectedHtml += `
            <tr>
                <td>${escapeHtml(label)}</td>
                <td>${escapeHtml(formatDimensionValue(dim, d[dim]))}</td>
            </tr>
        `;
    });

    selectedHtml += `
                </table>
            </div>
        </div>
    `;

    contentDiv.innerHTML = selectedHtml;
    card.style.display = "block";
    return;

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
