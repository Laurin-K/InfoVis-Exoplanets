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
fetch("../data/column_explanation.csv")
    .then(response => response.text())
    .then(data => createTableFromCSV(data));

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
        .text(d => d);
    const line = d3.line();

    function path(d) {
        return line(dimensions.map(dim => [
            x(dim),
            y[dim](d[dim])
        ]));
    }

    var color = d3.scaleOrdinal()
        .domain(["1", "2", "3", "4", "5"])
        .range([ "#440154ff", "#21908dff", "#fde725ff", "#123456ff", "#abcdefff"])

    svg.selectAll(".line")
        .data(data)
        .enter()
        .append("path")
        .attr("class", "line")
        .attr("d", path)
        .style("fill", "none")
        .style("stroke", function(d){ return( color(d.sy_snum))})
        .style("opacity", 0.8);
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