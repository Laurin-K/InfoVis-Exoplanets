const metrics = [
    { key: "pl_orbper", label: "Orbit Period", unit: "days", scale: "log" },
    { key: "pl_orbsmax", label: "Orbit Size", unit: "au", scale: "log" },
    { key: "pl_rade", label: "Radius", unit: "Earth radii", scale: "log" },
    { key: "pl_bmasse", label: "Mass", unit: "Earth masses", scale: "log" },
    { key: "pl_eqt", label: "Planet Temp.", unit: "K", scale: "linear" },
    { key: "st_teff", label: "Star Temp.", unit: "K", scale: "linear" },
    { key: "st_rad", label: "Star Radius", unit: "Solar radii", scale: "log" },
    { key: "sy_dist", label: "Distance", unit: "pc", scale: "log" }
];

const colors = ["#8fe3c7", "#f2c66d", "#83aaff", "#ff9cba"];
const maxSelection = 4;

const fallbackDataCsv = `pl_name,hostname,disc_year,pl_orbper,pl_orbsmax,pl_rade,pl_bmasse,pl_eqt,st_teff,st_rad,sy_dist
51 Peg b,51 Peg,1995,4.230785,0.0527,,150.009,,5758,1.17561,15.4614
55 Cnc e,55 Cnc,2004,0.7365474,0.01544,1.875,7.99,,5172,0.943,12.5855
AU Mic b,AU Mic,2020,8.463446,0.07,4.79,8.99,554.8,3540,0.862,9.7221
Barnard b,Barnard's star,2024,3.1542,0.0229,,0.299,438,3195,0.185,1.82655
CoRoT-1 b,CoRoT-1,2008,1.5089557,,16.7,327.35,1898,5950,1.11,787.909
TRAPPIST-1 e,TRAPPIST-1,2017,6.099615,0.02925,0.92,0.772,251,2566,0.1192,12.429
WASP-76 b,WASP-76,2016,1.80988198,0.033,20.78145,284.1386,2228,6329,1.756,194.459
Wolf 1069 b,Wolf 1069,2023,15.564,0.0672,,1.26,250.1,3158,0.1813,9.58341`;

const state = {
    allPlanets: [],
    visiblePlanets: [],
    selected: [],
    domains: new Map()
};

function parseDelimited(text, delimiter) {
    const rows = [];
    let row = [];
    let cell = "";
    let inQuotes = false;

    for (let index = 0; index < text.length; index += 1) {
        const char = text[index];
        const next = text[index + 1];

        if (char === "\"") {
            if (inQuotes && next === "\"") {
                cell += "\"";
                index += 1;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === delimiter && !inQuotes) {
            row.push(cell);
            cell = "";
        } else if ((char === "\n" || char === "\r") && !inQuotes) {
            if (char === "\r" && next === "\n") {
                index += 1;
            }
            row.push(cell);
            if (row.some(value => value.trim() !== "")) {
                rows.push(row);
            }
            row = [];
            cell = "";
        } else {
            cell += char;
        }
    }

    row.push(cell);
    if (row.some(value => value.trim() !== "")) {
        rows.push(row);
    }

    const headers = rows.shift() || [];
    return rows.map(values => {
        const entry = {};
        headers.forEach((header, index) => {
            entry[header] = values[index] ?? "";
        });
        return entry;
    });
}

function toNumber(value) {
    if (value === "" || value == null) {
        return null;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function loadData() {
    if (Array.isArray(window.SPIDER_PLOT_COLUMNS) && Array.isArray(window.SPIDER_PLOT_ROWS)) {
        return Promise.resolve(window.SPIDER_PLOT_ROWS.map(entry => {
            const values = Array.isArray(entry) ? entry : entry.value;
            const row = {};
            window.SPIDER_PLOT_COLUMNS.forEach((column, index) => {
                row[column] = values[index] ?? "";
            });
            return row;
        }));
    }

    return fetch("../data/nasa_export_large.csv")
        .then(response => {
            if (!response.ok) {
                throw new Error("Could not load CSV file.");
            }
            return response.text();
        })
        .catch(() => fallbackDataCsv)
        .then(text => parseDelimited(text, ","));
}

function preparePlanets(rows) {
    return rows
        .map(row => {
            const planet = {
                pl_name: row.pl_name || "Unnamed planet",
                hostname: row.hostname || "Unknown host",
                disc_year: toNumber(row.disc_year)
            };

            metrics.forEach(metric => {
                planet[metric.key] = toNumber(row[metric.key]);
            });

            return planet;
        })
        .filter(planet => planet.pl_name && metrics.some(metric => planet[metric.key] != null));
}

function calculateDomains(planets) {
    metrics.forEach(metric => {
        const values = planets
            .map(planet => planet[metric.key])
            .filter(value => value != null && Number.isFinite(value) && (metric.scale !== "log" || value > 0));

        if (!values.length) {
            state.domains.set(metric.key, [0, 1]);
            return;
        }

        state.domains.set(metric.key, [Math.min(...values), Math.max(...values)]);
    });
}

function normalizeValue(metric, rawValue) {
    if (rawValue == null || !Number.isFinite(rawValue)) {
        return 0;
    }

    const [min, max] = state.domains.get(metric.key) || [0, 1];
    if (min === max) {
        return 0.5;
    }

    if (metric.scale === "log" && rawValue > 0 && min > 0) {
        return (Math.log(rawValue) - Math.log(min)) / (Math.log(max) - Math.log(min));
    }

    return (rawValue - min) / (max - min);
}

function polarPoint(center, radius, angle, value = 1) {
    return {
        x: center + Math.cos(angle) * radius * value,
        y: center + Math.sin(angle) * radius * value
    };
}

function createSpiderSvg(planets, options = {}) {
    const size = options.size || 620;
    const center = size / 2;
    const radius = options.radius || size * 0.34;
    const labelRadius = radius + (options.mini ? 18 : 42);
    const axisCount = metrics.length;
    const gridLevels = options.mini ? 3 : 5;
    const startAngle = -Math.PI / 2;

    const polygons = Array.from({ length: gridLevels }, (_, level) => {
        const value = (level + 1) / gridLevels;
        const points = metrics.map((_, index) => {
            const angle = startAngle + (Math.PI * 2 * index) / axisCount;
            return polarPoint(center, radius, angle, value);
        });
        return `<polygon class="radar-grid" points="${points.map(point => `${point.x},${point.y}`).join(" ")}"></polygon>`;
    }).join("");

    const axes = metrics.map((metric, index) => {
        const angle = startAngle + (Math.PI * 2 * index) / axisCount;
        const end = polarPoint(center, radius, angle);
        const label = polarPoint(center, labelRadius, angle);
        const anchor = Math.abs(label.x - center) < 8 ? "middle" : label.x > center ? "start" : "end";

        if (options.mini) {
            return `<line class="radar-axis" x1="${center}" y1="${center}" x2="${end.x}" y2="${end.y}"></line>`;
        }

        return `
            <line class="radar-axis" x1="${center}" y1="${center}" x2="${end.x}" y2="${end.y}"></line>
            <text class="radar-label" x="${label.x}" y="${label.y}" text-anchor="${anchor}">${metric.label}</text>
        `;
    }).join("");

    const areas = planets.map((planet, index) => {
        const points = metrics.map((metric, metricIndex) => {
            const angle = startAngle + (Math.PI * 2 * metricIndex) / axisCount;
            const value = Math.max(0, Math.min(1, normalizeValue(metric, planet[metric.key])));
            return polarPoint(center, radius, angle, value);
        });
        const color = options.color || colors[index % colors.length];

        return `<polygon class="radar-area" points="${points.map(point => `${point.x},${point.y}`).join(" ")}" fill="${color}" stroke="${color}"></polygon>`;
    }).join("");

    return `
        <svg viewBox="0 0 ${size} ${size}" role="img" aria-label="Spiderplot">
            ${polygons}
            ${axes}
            ${areas}
        </svg>
    `;
}

function renderMetricList() {
    const container = document.querySelector("#metric-list");
    if (!container) {
        return;
    }

    container.innerHTML = metrics.map(metric => `
        <div class="metric-card">
            <strong>${metric.label}</strong>
            <span>${metric.key} · ${metric.unit} · ${metric.scale}</span>
        </div>
    `).join("");
}

function planetMatches(planet, query) {
    const search = query.trim().toLowerCase();
    if (!search) {
        return true;
    }

    return `${planet.pl_name} ${planet.hostname}`.toLowerCase().includes(search);
}

function updatePlanetSelect() {
    const input = document.querySelector("#planet-search");
    const select = document.querySelector("#planet-select");
    if (!input || !select) {
        return;
    }

    const query = input.value;
    const selectedNames = new Set(state.selected.map(planet => planet.pl_name));
    state.visiblePlanets = state.allPlanets
        .filter(planet => planetMatches(planet, query) && !selectedNames.has(planet.pl_name))
        .slice(0, 250);

    select.innerHTML = state.visiblePlanets
        .map((planet, index) => `<option value="${index}">${planet.pl_name} · ${planet.hostname}</option>`)
        .join("");
}

function renderSelectedPlanets() {
    const container = document.querySelector("#selected-planets");
    const note = document.querySelector("#selection-note");
    const addButton = document.querySelector("#add-planet");
    if (!container || !note || !addButton) {
        return;
    }

    container.innerHTML = state.selected.map((planet, index) => `
        <div class="planet-chip">
            <span class="chip-label">
                <span class="color-dot" style="background:${colors[index]}"></span>
                <span>${planet.pl_name}</span>
            </span>
            <button type="button" data-remove-index="${index}">Remove</button>
        </div>
    `).join("");

    container.querySelectorAll("button").forEach(button => {
        button.addEventListener("click", () => {
            const index = Number(button.dataset.removeIndex);
            state.selected.splice(index, 1);
            updateCompareView();
        });
    });

    if (state.selected.length >= maxSelection) {
        note.textContent = "Maximum of 4 planets reached. Remove one before adding another.";
        note.classList.add("error");
    } else {
        note.textContent = `${state.selected.length} of ${maxSelection} planets selected.`;
        note.classList.remove("error");
    }

    addButton.disabled = state.selected.length >= maxSelection || !state.visiblePlanets.length;
}

function renderCompareChart() {
    const chart = document.querySelector("#spider-chart");
    const legend = document.querySelector("#spider-legend");
    if (!chart || !legend) {
        return;
    }

    const planets = state.selected.length ? state.selected : state.allPlanets.slice(0, 2);
    chart.innerHTML = createSpiderSvg(planets);
    legend.innerHTML = planets.map((planet, index) => `
        <span class="legend-item">
            <span class="color-dot" style="background:${colors[index]}"></span>
            ${planet.pl_name}
        </span>
    `).join("");
}

function updateCompareView() {
    updatePlanetSelect();
    renderSelectedPlanets();
    renderCompareChart();
}

function initCompareView() {
    const search = document.querySelector("#planet-search");
    const addButton = document.querySelector("#add-planet");
    const select = document.querySelector("#planet-select");

    state.selected = state.allPlanets.slice(0, Math.min(2, state.allPlanets.length));
    renderMetricList();
    updateCompareView();

    search.addEventListener("input", updateCompareView);
    addButton.addEventListener("click", () => {
        if (state.selected.length >= maxSelection || !state.visiblePlanets.length) {
            return;
        }

        const planet = state.visiblePlanets[Number(select.value) || 0];
        if (planet) {
            state.selected.push(planet);
            updateCompareView();
        }
    });
}

function renderGallery(query = "") {
    const gallery = document.querySelector("#spider-gallery");
    const count = document.querySelector("#gallery-count");
    if (!gallery || !count) {
        return;
    }

    const planets = state.allPlanets.filter(planet => planetMatches(planet, query));
    count.textContent = `${planets.length} planets shown`;

    if (!planets.length) {
        gallery.innerHTML = `<div class="empty-state">No planets match the current filter.</div>`;
        return;
    }

    gallery.innerHTML = planets.map((planet, index) => `
        <article class="mini-card">
            <h2>${planet.pl_name}</h2>
            <p>${planet.hostname}${planet.disc_year ? ` · ${planet.disc_year}` : ""}</p>
            ${createSpiderSvg([planet], { size: 220, radius: 70, mini: true, color: colors[index % colors.length] })}
        </article>
    `).join("");
}

function initGalleryView() {
    const search = document.querySelector("#gallery-search");
    renderGallery();
    search.addEventListener("input", () => renderGallery(search.value));
}

function init() {
    const view = document.body.dataset.spiderView;

    loadData().then(rows => {
        state.allPlanets = preparePlanets(rows).sort((a, b) => a.pl_name.localeCompare(b.pl_name));
        calculateDomains(state.allPlanets);

        if (view === "gallery") {
            initGalleryView();
        } else {
            initCompareView();
        }
    }).catch(error => {
        document.body.innerHTML = `<main class="spider-page"><div class="panel empty-state">${error.message}</div></main>`;
    });
}

init();
