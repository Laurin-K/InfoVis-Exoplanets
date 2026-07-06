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

        label.append("span")
            .text(" " + dim);
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
d3.csv("../data/nasa_export_small.csv", d => {

    // convert string into int
    activeDimensions.forEach(dim => {
        d[dim] = d[dim] === "" ? null : +d[dim];
    });

    return d;

}).then(data => {

    fullData = data;

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
    // keep only valid datasets
    let data = fullData.filter(d =>
        dimensions.every(dim => d[dim] != null && !isNaN(d[dim]))
    );

    // SVG Setup
    const margin = { top: 30, right: 50, bottom: 10, left: 50 };
    const width = 800 - margin.left - margin.right;
    const height = 400 - margin.top - margin.bottom;

    const wrapper = d3.select("#my_dataviz")
        .append("div")
        .style("position", "relative")
        .style("width", width + margin.left + margin.right + "px")
        .style("height", height + margin.top + margin.bottom + "px");

    const canvas = wrapper.append("canvas")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .style("position", "absolute")
        .style("top", 0)
        .style("left", 0)
        .style("pointer-events", "none");

    const ctx = canvas.node().getContext("2d");
    ctx.translate(margin.left, margin.top);

    const svg = wrapper.append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .style("position", "absolute")
        .style("top", 0)
        .style("left", 0)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // Add transparent background for clicking to deselect
    function pointToSegmentDistSq(px, py, x1, y1, x2, y2) {
        const l2 = (x1 - x2)**2 + (y1 - y2)**2;
        if (l2 === 0) return (px - x1)**2 + (py - y1)**2;
        let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
        t = Math.max(0, Math.min(1, t));
        return (px - (x1 + t * (x2 - x1)))**2 + (py - (y1 + t * (y2 - y1)))**2;
    }

    svg.append("rect")
        .attr("width", width)
        .attr("height", height)
        .style("fill", "none")
        .style("pointer-events", "all")
        .on("click", function(event) {
            const [mx, my] = d3.pointer(event);
            let closest = null;
            let minDistSq = Infinity;
            
            data.forEach(d => {
                if (!isVisible(d)) return;
                let distSq = Infinity;
                for (let i = 0; i < dimensions.length - 1; i++) {
                    const dim1 = dimensions[i];
                    const dim2 = dimensions[i+1];
                    const x1 = x(dim1), y1 = y[dim1](d[dim1]);
                    const x2 = x(dim2), y2 = y[dim2](d[dim2]);
                    const dSq = pointToSegmentDistSq(mx, my, x1, y1, x2, y2);
                    if (dSq < distSq) distSq = dSq;
                }
                if (distSq < minDistSq) {
                    minDistSq = distSq;
                    closest = d;
                }
            });
            
            if (minDistSq < 25 && closest) {
                selectDataline(closest);
            } else {
                deselectAllDatalines();
            }
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

    const g = svg.selectAll(".dimension")
        .data(dimensions)
        .enter()
        .append("g")
        .attr("class", "dimension")
        .attr("transform", d => `translate(${x(d)})`)
        .each(function(dim) {

            d3.select(this)
                .call(axis.scale(y[dim]));

        });

    // create labels
    g.append("text")
        .attr("y", -10)
        .style("text-anchor", "middle")
        .style("fill", "black")
        .style("cursor", "pointer")
        .text(d => d)
        .on("mouseover", function(event, d) {
            d3.select(this)
                .style("font-weight", "bold");

            const expl = columnExplanations[d];
            let content = `<strong>${d}</strong>`;
            if (expl) {
                content = `<strong>${expl.name} (${d})</strong><br/>${expl.desc}`;
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

    g.append("g")
        .attr("class", "brush")
        .each(function(dim) {

            d3.select(this).call(
                d3.brushY()
                    .extent([[-10, 0], [10, height]])
                    .on("start brush end", function(event) {
                        brushed(event, dim);
                    })
            );

        });
    const line = d3.line();

    function brushed(event, dim) {

        if (!event.selection) {
            brushes[dim] = null;
            updateLines();
            return;
        }

        const [y0, y1] = event.selection;

        let min = y[dim].invert(y1);
        let max = y[dim].invert(y0);

        if (min > max) [min, max] = [max, min];

        brushes[dim] = [min, max];

        updateLines();
    }

    function isVisible(d) {
        return dimensions.every(dim => {
            if (!brushes[dim]) return true;
            const value = d[dim];
            const [min, max] = brushes[dim];
            return value >= min && value <= max;
        });
    }

    var color = d3.scaleOrdinal()
        .domain(["1", "2", "3", "4", "5"])
        .range([ "#440154ff", "#21908dff", "#fde725ff", "#123456ff", "#abcdefff"]);

    function updateLines() {
        ctx.clearRect(-margin.left, -margin.top, canvas.node().width, canvas.node().height);
        
        data.forEach(d => {
            if (!isVisible(d)) return;
            
            let isDimmed = selectedPlanet && selectedPlanet.pl_name !== d.pl_name;
            let isSelected = selectedPlanet && selectedPlanet.pl_name === d.pl_name;

            ctx.beginPath();
            dimensions.forEach((dim, i) => {
                const px = x(dim);
                const py = y[dim](d[dim]);
                if (i === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            });
            
            ctx.lineWidth = isSelected ? 3 : 1;
            ctx.strokeStyle = color(d.sy_snum);
            ctx.globalAlpha = isDimmed ? 0.1 : (isSelected ? 1.0 : 0.8);
            ctx.stroke();
        });
        
        if (selectedPlanet && isVisible(selectedPlanet)) {
            ctx.beginPath();
            dimensions.forEach((dim, i) => {
                const px = x(dim);
                const py = y[dim](selectedPlanet[dim]);
                if (i === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            });
            ctx.lineWidth = 3;
            ctx.strokeStyle = color(selectedPlanet.sy_snum);
            ctx.globalAlpha = 1.0;
            ctx.stroke();
        }
    }

    // Call updateLines initially
    updateLines();

    // If a planet was already selected, update Infocard (visual classes are handled by updateLines)
    if (selectedPlanet) {
        const exists = data.some(d => d.pl_name === selectedPlanet.pl_name);
        if (!exists) {
            clearInfocard();
            selectedPlanet = null;
        }
    }

    // Make selectDataline and deselectAllDatalines redraw canvas
    window.selectDataline = function(d) {
        selectedPlanet = d;
        updateLines();
        updateInfocard(d);
    };

    window.deselectAllDatalines = function() {
        selectedPlanet = null;
        updateLines();
        clearInfocard();
    };
}

//Single planet selection
let selectedPlanet = null;

// selectDataline and deselectAllDatalines are now assigned to window in draw()


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
let columnExplanations = {};

fetch("../data/column_explanation.csv")
    .then(response => response.text())
    .then(data => {
        parseColumnExplanations(data);
        createTableFromCSV(data);
    });

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
    const rows = csv.split("\n").map(row => row.split(";"));

    const tableHead = document.querySelector("#dataTable thead");
    const tableBody = document.querySelector("#dataTable tbody");

    // Header
    const headerRow = document.createElement("tr");
    rows[0].forEach(cell => {
        const th = document.createElement("th");
        th.textContent = cell;
        headerRow.appendChild(th);
    });
    tableHead.appendChild(headerRow);

    // Daten
    rows.slice(1).forEach(row => {
        const tr = document.createElement("tr");

        row.forEach(cell => {
            const td = document.createElement("td");
            td.textContent = cell;
            tr.appendChild(td);
        });

        tableBody.appendChild(tr);
    });
}