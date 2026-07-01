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
    domains: new Map(),
    metricOrder: metrics.map(metric => metric.key),
    hiddenMetricKeys: new Set()
};

function getMetricsByOrder() {
    return state.metricOrder
        .map(key => metrics.find(metric => metric.key === key))
        .filter(Boolean);
}

function getVisibleMetrics() {
    return getMetricsByOrder().filter(metric => !state.hiddenMetricKeys.has(metric.key));
}

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
    const radius = options.radius || size * 0.28;
    const labelRadius = radius + (options.mini ? 18 : 42);
    const chartMetrics = options.metrics || metrics;
    const axisCount = chartMetrics.length;
    const gridLevels = options.mini ? 3 : 5;
    const startAngle = -Math.PI / 2;

    if (!axisCount) {
        return `<div class="empty-state">No axes selected. Turn on at least one metric to draw the spiderplot.</div>`;
    }

    const polygons = Array.from({ length: gridLevels }, (_, level) => {
        const value = (level + 1) / gridLevels;
        const points = chartMetrics.map((_, index) => {
            const angle = startAngle + (Math.PI * 2 * index) / axisCount;
            return polarPoint(center, radius, angle, value);
        });
        return `<polygon class="radar-grid" points="${points.map(point => `${point.x},${point.y}`).join(" ")}"></polygon>`;
    }).join("");

    const axes = chartMetrics.map((metric, index) => {
        const angle = startAngle + (Math.PI * 2 * index) / axisCount;
        const end = polarPoint(center, radius, angle);
        const label = polarPoint(center, labelRadius, angle);
        const anchor = Math.abs(label.x - center) < 8 ? "middle" : label.x > center ? "start" : "end";

        if (options.mini) {
            return `<line class="radar-axis" x1="${center}" y1="${center}" x2="${end.x}" y2="${end.y}"></line>`;
        }

        const [min, max] = state.domains.get(metric.key) || [0, 1];
        
        // Skip fraction 0 to avoid overlapping at the center.
        const allLevels = Array.from({ length: gridLevels }, (_, level) => (level + 1) / gridLevels);
        
        const axisValuesHtml = allLevels.map((fraction) => {
            const pos = polarPoint(center, radius, angle, fraction);
            
            let val;
            if (metric.scale === "log" && min > 0 && max > 0) {
                val = Math.exp(Math.log(min) + fraction * (Math.log(max) - Math.log(min)));
            } else {
                val = min + fraction * (max - min);
            }
            
            let valText;
            if (val >= 1000) {
                valText = Math.round(val).toLocaleString();
            } else if (val >= 10) {
                valText = Number(val.toFixed(1)).toLocaleString();
            } else {
                valText = Number(val.toFixed(3)).toLocaleString();
            }
            
            let textAnchor = pos.x >= center - 1 ? "start" : "end";
            let dx = pos.x >= center - 1 ? 4 : -4;
            let dy = -4;

            return `<text class="radar-axis-value" x="${pos.x}" y="${pos.y}" text-anchor="${textAnchor}" dx="${dx}" dy="${dy}">${valText}</text>`;
        }).join("");

        const minText = min >= 1000 ? Math.round(min).toLocaleString() : min >= 10 ? Number(min.toFixed(1)).toLocaleString() : Number(min.toFixed(3)).toLocaleString();
        const maxText = max >= 1000 ? Math.round(max).toLocaleString() : max >= 10 ? Number(max.toFixed(1)).toLocaleString() : Number(max.toFixed(3)).toLocaleString();
        const subtitle = !options.mini ? `<text class="radar-subtitle" x="${label.x}" y="${label.y + 14}" text-anchor="${anchor}">[${minText} - ${maxText} ${metric.unit}]</text>` : "";

        return `
            <g class="radar-axis-group">
                <line class="radar-axis-hover" x1="${center}" y1="${center}" x2="${end.x}" y2="${end.y}"></line>
                <line class="radar-axis" x1="${center}" y1="${center}" x2="${end.x}" y2="${end.y}"></line>
                ${axisValuesHtml}
                <text class="radar-label" x="${label.x}" y="${label.y}" text-anchor="${anchor}">${metric.label}</text>
                ${subtitle}
            </g>
        `;
    }).join("");

    let allPointCirclesHtml = "";

    const areas = planets.map((planet, index) => {
        const color = options.getColor ? options.getColor(planet) : (options.color || colors[index % colors.length]);

        const validPoints = [];
        const allPoints = [];

        chartMetrics.forEach((metric, metricIndex) => {
            const angle = startAngle + (Math.PI * 2 * metricIndex) / axisCount;
            const rawValue = planet[metric.key];
            const isValid = rawValue != null;
            
            const value = isValid ? Math.max(0, Math.min(1, normalizeValue(metric, rawValue))) : null;
            const point = isValid ? polarPoint(center, radius, angle, value) : null;
            
            allPoints.push(point);
            if (isValid) {
                validPoints.push(point);
            }
        });

        const pointCircles = allPoints.map((point, metricIndex) => {
            if (!point) return "";
            const rawVal = planet[chartMetrics[metricIndex].key];
            const textVal = rawVal.toLocaleString();
            return `<circle cx="${point.x}" cy="${point.y}" r="5" fill="${color}" stroke="#fff" stroke-width="1.5">
                <title>${chartMetrics[metricIndex].label}: ${textVal} ${chartMetrics[metricIndex].unit}</title>
            </circle>`;
        }).join("");
        allPointCirclesHtml += pointCircles;

        // Dashed background connects all valid points (skipping missing axes)
        const dashedPolygon = validPoints.length > 0 ? 
            `<polygon class="radar-dashed" points="${validPoints.map(p => `${p.x},${p.y}`).join(" ")}" fill="${color}" stroke="${color}"></polygon>` : "";

        // Foreground solid lines (only connecting contiguous valid points)
        let solidPathData = "";
        let inSegment = false;
        
        allPoints.forEach((p) => {
            if (p) {
                if (!inSegment) {
                    solidPathData += `M ${p.x},${p.y} `;
                    inSegment = true;
                } else {
                    solidPathData += `L ${p.x},${p.y} `;
                }
            } else {
                inSegment = false;
            }
        });
        
        // Loop closure logic
        if (allPoints[allPoints.length - 1] && allPoints[0]) {
            solidPathData += `L ${allPoints[0].x},${allPoints[0].y} `;
        }
        
        const solidPath = `<path class="radar-solid" d="${solidPathData.trim()}" stroke="${color}"></path>`;

        return `<g class="radar-area-group">
                    ${dashedPolygon}
                    ${solidPath}
                </g>`;
    }).join("");

    const svgWidth = options.mini ? size : size + 300;
    const xOffset = options.mini ? 0 : -150;

    return `
        <svg viewBox="${xOffset} 0 ${svgWidth} ${size}" role="img" aria-label="Spiderplot" style="overflow: visible;">
            ${polygons}
            ${areas}
            ${axes}
            <g class="radar-points">
                ${allPointCirclesHtml}
            </g>
        </svg>
    `;
}

function renderMetricList() {
    const container = document.querySelector("#metric-list");
    if (!container) {
        return;
    }

    const orderedMetrics = getMetricsByOrder();

    container.innerHTML = orderedMetrics.map((metric, index) => {
        const isHidden = state.hiddenMetricKeys.has(metric.key);

        return `
        <div class="metric-card axis-card ${isHidden ? "is-hidden" : ""}" draggable="true" data-metric-key="${metric.key}">
            <label class="axis-toggle">
                <input type="checkbox" data-axis-toggle="${metric.key}" ${isHidden ? "" : "checked"}>
                <span>
                    <strong>${metric.label}</strong>
                    <span>${metric.key} &middot; ${metric.unit} &middot; ${metric.scale}</span>
                </span>
            </label>
            <div class="axis-actions" aria-label="Move ${metric.label}">
                <button type="button" data-axis-move="${metric.key}" data-direction="up" ${index === 0 ? "disabled" : ""} title="Move up">Up</button>
                <button type="button" data-axis-move="${metric.key}" data-direction="down" ${index === orderedMetrics.length - 1 ? "disabled" : ""} title="Move down">Down</button>
                <span class="drag-handle" title="Drag to reorder">Drag</span>
            </div>
        </div>
    `;
    }).join("");

    container.querySelectorAll("input[data-axis-toggle]").forEach(input => {
        input.addEventListener("change", () => {
            if (input.checked) {
                state.hiddenMetricKeys.delete(input.dataset.axisToggle);
            } else {
                state.hiddenMetricKeys.add(input.dataset.axisToggle);
            }

            updateCompareView();
        });
    });

    container.querySelectorAll("button[data-axis-move]").forEach(button => {
        button.addEventListener("click", () => {
            moveMetric(button.dataset.axisMove, button.dataset.direction === "up" ? -1 : 1);
            updateCompareView();
        });
    });

    container.querySelectorAll(".axis-card").forEach(card => {
        card.addEventListener("dragstart", event => {
            event.dataTransfer.setData("text/plain", card.dataset.metricKey);
            event.dataTransfer.effectAllowed = "move";
            card.classList.add("is-dragging");
        });

        card.addEventListener("dragend", () => {
            card.classList.remove("is-dragging");
        });

        card.addEventListener("dragover", event => {
            event.preventDefault();
            card.classList.add("is-drop-target");
        });

        card.addEventListener("dragleave", () => {
            card.classList.remove("is-drop-target");
        });

        card.addEventListener("drop", event => {
            event.preventDefault();
            card.classList.remove("is-drop-target");
            const draggedKey = event.dataTransfer.getData("text/plain");
            reorderMetric(draggedKey, card.dataset.metricKey);
            updateCompareView();
        });
    });
}

function moveMetric(metricKey, offset) {
    const currentIndex = state.metricOrder.indexOf(metricKey);
    const nextIndex = currentIndex + offset;

    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= state.metricOrder.length) {
        return;
    }

    const [metric] = state.metricOrder.splice(currentIndex, 1);
    state.metricOrder.splice(nextIndex, 0, metric);
}

function reorderMetric(draggedKey, targetKey) {
    if (!draggedKey || draggedKey === targetKey) {
        return;
    }

    const fromIndex = state.metricOrder.indexOf(draggedKey);
    const toIndex = state.metricOrder.indexOf(targetKey);

    if (fromIndex < 0 || toIndex < 0) {
        return;
    }

    const [metric] = state.metricOrder.splice(fromIndex, 1);
    state.metricOrder.splice(toIndex, 0, metric);
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
    const datalist = document.querySelector("#planet-datalist");
    if (!input || !datalist) {
        return;
    }

    const query = input.value;
    const selectedNames = new Set(state.selected.map(planet => planet.pl_name));
    
    // Auto-add exact match
    const exactMatch = state.allPlanets.find(p => `${p.pl_name} (${p.hostname})` === query && !selectedNames.has(p.pl_name));
    if (exactMatch) {
        if (state.selected.length < maxSelection) {
            state.selected.push(exactMatch);
            input.value = "";
            updateCompareView();
        }
        return;
    }

    state.visiblePlanets = state.allPlanets
        .filter(planet => planetMatches(planet, query) && !selectedNames.has(planet.pl_name))
        .slice(0, 100); // Reduce rendering load for datalist

    datalist.innerHTML = state.visiblePlanets
        .map((planet) => `<option value="${planet.pl_name} (${planet.hostname})"></option>`)
        .join("");
}

function renderSelectedPlanets() {
    const container = document.querySelector("#selected-planets");
    const note = document.querySelector("#selection-note");
    if (!container || !note) {
        return;
    }

    container.innerHTML = state.selected.map((planet, index) => `
        <div class="planet-chip ${planet._hidden ? 'hidden' : ''}">
            <span class="chip-label">
                <span class="color-dot" style="background:${planet._hidden ? '#555' : colors[index]}"></span>
                <span style="opacity: ${planet._hidden ? '0.5' : '1'}">${planet.pl_name}</span>
            </span>
            <div style="display: flex; align-items: center; gap: 4px;">
                <button type="button" class="eye-btn" data-toggle-index="${index}" style="background:none; border:none; color:var(--muted); cursor:pointer; padding: 4px; display: flex; align-items: center; justify-content: center; width: 24px; height: 24px;" title="Toggle visibility">
                    ${planet._hidden ? 
                        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>' : 
                        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>'
                    }
                </button>
                <button type="button" data-remove-index="${index}" style="background:none; border:none; color:#ff6b6b; cursor:pointer; padding: 4px; display: flex; align-items: center; justify-content: center; width: 24px; height: 24px; font-size: 16px; font-weight: bold;" title="Remove">✕</button>
            </div>
        </div>
    `).join("");

    container.querySelectorAll("button[data-remove-index]").forEach(button => {
        button.addEventListener("click", () => {
            const index = Number(button.dataset.removeIndex);
            state.selected.splice(index, 1);
            updateCompareView();
        });
    });

    container.querySelectorAll("button.eye-btn").forEach(button => {
        button.addEventListener("click", () => {
            const index = Number(button.dataset.toggleIndex);
            state.selected[index]._hidden = !state.selected[index]._hidden;
            updateCompareView();
        });
    });

    if (state.selected.length >= maxSelection) {
        note.textContent = "Maximum of 4 planets reached. Remove one before adding another.";
        note.classList.add("error");
    } else {
        note.textContent = `${state.selected.length} of ${maxSelection} planets selected. Search to add.`;
        note.classList.remove("error");
    }
}

function renderCompareChart() {
    const chart = document.querySelector("#spider-chart");
    const legend = document.querySelector("#spider-legend");
    if (!chart || !legend) {
        return;
    }

    const visiblePlanets = state.selected.filter(p => !p._hidden);
    const planets = visiblePlanets;
    const visibleMetrics = getVisibleMetrics();
    
    chart.innerHTML = createSpiderSvg(planets, {
        metrics: visibleMetrics,
        getColor: (p) => {
            let i = state.selected.indexOf(p);
            return colors[i >= 0 ? i : 0];
        }
    });

    legend.innerHTML = state.selected.map((planet, index) => `
        <span class="legend-item" style="opacity: ${planet._hidden ? '0.4' : '1'}">
            <span class="color-dot" style="background:${planet._hidden ? '#555' : colors[index]}"></span>
            ${planet.pl_name}
        </span>
    `).join("");
}

function updateCompareView() {
    updatePlanetSelect();
    renderSelectedPlanets();
    renderMetricList();
    renderCompareChart();
}

function initCompareView() {
    const search = document.querySelector("#planet-search");
    const toggleValues = document.querySelector("#toggle-axis-values");
    const chartPanel = document.querySelector(".chart-panel");

    state.selected = [];

    updateCompareView();

    search.addEventListener("input", updateCompareView);
    
    if (toggleValues && chartPanel) {
        toggleValues.addEventListener("change", (e) => {
            if (e.target.checked) {
                chartPanel.classList.add("show-axis-values");
            } else {
                chartPanel.classList.remove("show-axis-values");
            }
        });
    }
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
