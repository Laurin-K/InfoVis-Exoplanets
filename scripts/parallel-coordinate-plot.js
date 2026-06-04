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
function toggleMassReference(checked)
{
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
//updates activeDimensions when selection has changed
//call draw
function updateDimensions() {

    activeDimensions = [];

    d3.selectAll("#controls input:checked")
        .each(function() {
            activeDimensions.push(this.value);
        });

    draw(activeDimensions);
}

let activeDimensions = ["sy_snum", "sy_pnum", "disc_year", "pl_orbper", "pl_orbsmax"];

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
let columnExplanations = {};

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

fetch("../data/column_explanation.csv")
    .then(response => response.text())
    .then(data => {
        parseColumnExplanations(data);
        createTableFromCSV(data);
    });

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

    const brushes = {};

    dimensions.forEach(dim => {
        brushes[dim] = null;
    });

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
        console.log(dim, brushes[dim]);
    }

    function updateLines() {

        svg.selectAll(".line")
            .style("display", function(d) {

                return dimensions.every(dim => {

                    if (!brushes[dim]) return true;

                    const value = d[dim];
                    const [min, max] = brushes[dim];

                    return value >= min && value <= max;

                }) ? null : "none";

            });
    }
    function path(d) {
        return line(dimensions.map(dim => [
            x(dim),
            y[dim](d[dim])
        ]));
    }

    var color = d3.scaleOrdinal()
        .domain(["1", "2", "3", "4", "5"])
        .range([ "#440154ff", "#21908dff", "#fde725ff", "#123456ff", "#abcdefff"])

    const paths = svg.selectAll(".line")
        .data(data)
        .enter()
        .append("path")
        .attr("class", "line")
        .attr("d", path)
        .style("fill", "none")
        .style("stroke", function(d){ return( color(d.sy_snum))})
        .style("opacity", 0.8)
        .on("click", function(event, d) {
            event.stopPropagation();
            selectDataline(d);
        });

    // If a planet was already selected, re-apply the visual classes to the new paths
    if (selectedPlanet) {
        const exists = data.some(d => d.pl_name === selectedPlanet.pl_name);
        if (exists) {
            paths.classed("selected", function(d) { return d.pl_name === selectedPlanet.pl_name; })
                 .classed("dimmed", function(d) { return d.pl_name !== selectedPlanet.pl_name; });
        } else {
            clearInfocard();
            selectedPlanet = null;
        }
    }
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

let selectedPlanet = null;

function selectDataline(d) {
    selectedPlanet = d;

    d3.selectAll(".line")
        .classed("selected", function(lineData) { return lineData.pl_name === d.pl_name; })
        .classed("dimmed", function(lineData) { return lineData.pl_name !== d.pl_name; });

    updateInfocard(d);
}

function deselectAllDatalines() {
    selectedPlanet = null;

    d3.selectAll(".line")
        .classed("selected", false)
        .classed("dimmed", false);

    clearInfocard();
}

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