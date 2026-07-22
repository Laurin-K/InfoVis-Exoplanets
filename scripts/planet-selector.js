let allPlanets = [];
let filteredPlanets = [];
let selectedPlanetNames = new Set();

document.addEventListener("DOMContentLoaded", () => {
    // Load previously selected planets if any
    const saved = localStorage.getItem('selected_planets');
    if (saved) {
        try {
            const arr = JSON.parse(saved);
            arr.forEach(name => selectedPlanetNames.add(name));
        } catch(e) {}
    }
    updateSelectionCount();

    // Load data
    d3.csv("../data/nasa_export_large_merged.csv").then(data => {
        allPlanets = data;
        filteredPlanets = [...allPlanets];
        renderList();
        
        // Setup listeners after data load
        setupEventListeners();
    });
});

function setupEventListeners() {
    document.getElementById('apply-filters-btn').addEventListener('click', applyFilters);
    document.getElementById('search-input').addEventListener('input', applyFilters);
    
    // Check all visible
    document.getElementById('check-all-visible').addEventListener('change', (e) => {
        const isChecked = e.target.checked;
        filteredPlanets.forEach(p => {
            if (isChecked) selectedPlanetNames.add(p.pl_name);
            else selectedPlanetNames.delete(p.pl_name);
        });
        updateSelectionCount();
        renderList();
    });

    // Presets
    document.getElementById('preset-all').addEventListener('click', () => {
        allPlanets.forEach(p => selectedPlanetNames.add(p.pl_name));
        updateSelectionCount();
        renderList();
    });
    
    document.getElementById('preset-none').addEventListener('click', () => {
        selectedPlanetNames.clear();
        updateSelectionCount();
        renderList();
    });

    document.getElementById('preset-earth').addEventListener('click', () => {
        allPlanets.forEach(p => {
            const r = +p.pl_rade;
            if (r >= 0.5 && r <= 2.0) selectedPlanetNames.add(p.pl_name);
        });
        updateSelectionCount();
        renderList();
    });

    document.getElementById('preset-jupiter').addEventListener('click', () => {
        allPlanets.forEach(p => {
            const r = +p.pl_rade;
            if (r > 5) selectedPlanetNames.add(p.pl_name);
        });
        updateSelectionCount();
        renderList();
    });

    document.getElementById('preset-trappist').addEventListener('click', () => {
        allPlanets.forEach(p => {
            if (p.hostname && p.hostname.includes('TRAPPIST-1')) selectedPlanetNames.add(p.pl_name);
        });
        updateSelectionCount();
        renderList();
    });

    document.getElementById('preset-solar').addEventListener('click', () => {
        // Exoplanet.eu doesn't typically have our solar system, but just in case or if user wants nearby
        alert('Solar System usually not in Exoplanet archives. Try TRAPPIST-1 instead!');
    });

    document.getElementById('preset-recent').addEventListener('click', () => {
        allPlanets.forEach(p => {
            if (+p.disc_year >= 2020) selectedPlanetNames.add(p.pl_name);
        });
        updateSelectionCount();
        renderList();
    });

    // Save Selection
    document.getElementById('save-selection-btn').addEventListener('click', () => {
        localStorage.setItem('selected_planets', JSON.stringify(Array.from(selectedPlanetNames)));
        alert('Selection saved! It will now be applied to all visualizations.');
    });
}

function applyFilters() {
    const search = document.getElementById('search-input').value.toLowerCase();
    const yMin = document.getElementById('year-min').value;
    const yMax = document.getElementById('year-max').value;
    const rMin = document.getElementById('rad-min').value;
    const rMax = document.getElementById('rad-max').value;
    const mMin = document.getElementById('mass-min').value;
    const mMax = document.getElementById('mass-max').value;
    const pMin = document.getElementById('period-min').value;
    const pMax = document.getElementById('period-max').value;
    const dMin = document.getElementById('dist-min').value;
    const dMax = document.getElementById('dist-max').value;
    const tMin = document.getElementById('temp-min').value;
    const tMax = document.getElementById('temp-max').value;

    filteredPlanets = allPlanets.filter(p => {
        // Search
        if (search && !p.pl_name.toLowerCase().includes(search) && !(p.hostname && p.hostname.toLowerCase().includes(search))) {
            return false;
        }
        
        // Year
        if (yMin && +p.disc_year < +yMin) return false;
        if (yMax && +p.disc_year > +yMax) return false;
        
        // Radius
        if (rMin || rMax) {
            if (!p.pl_rade) return false; // Exclude if no radius and we are filtering by it
            const r = +p.pl_rade;
            if (rMin && r < +rMin) return false;
            if (rMax && r > +rMax) return false;
        }
        
        // Mass
        if (mMin || mMax) {
            if (!p.pl_bmasse) return false;
            const m = +p.pl_bmasse;
            if (mMin && m < +mMin) return false;
            if (mMax && m > +mMax) return false;
        }

        // Orbital Period
        if (pMin || pMax) {
            if (!p.pl_orbper) return false;
            const per = +p.pl_orbper;
            if (pMin && per < +pMin) return false;
            if (pMax && per > +pMax) return false;
        }

        // Distance
        if (dMin || dMax) {
            if (!p.sy_dist) return false;
            const d = +p.sy_dist;
            if (dMin && d < +dMin) return false;
            if (dMax && d > +dMax) return false;
        }

        // Stellar Temperature
        if (tMin || tMax) {
            if (!p.st_teff) return false;
            const t = +p.st_teff;
            if (tMin && t < +tMin) return false;
            if (tMax && t > +tMax) return false;
        }
        
        return true;
    });

    // Reset select all checkbox
    document.getElementById('check-all-visible').checked = false;
    
    renderList();
}

function renderList() {
    const container = document.getElementById('planet-list');
    document.getElementById('total-count').textContent = filteredPlanets.length;
    
    // Group by hostname
    const groups = {};
    filteredPlanets.forEach(p => {
        const host = p.hostname || 'Unknown System';
        if (!groups[host]) groups[host] = [];
        groups[host].push(p);
    });

    // Optimization: limit rendering if too many (virtualize or slice)
    // For simplicity, we just slice the groups to avoid freezing if user doesn't filter
    const systemNames = Object.keys(groups).sort();
    const MAX_SYSTEMS = 200; 
    let html = '';

    if (systemNames.length > MAX_SYSTEMS) {
        html += `<div style="padding: 1rem; color: #ffab40;">Showing first ${MAX_SYSTEMS} systems. Use filters to narrow down!</div>`;
    }

    const systemsToRender = systemNames.slice(0, MAX_SYSTEMS);

    systemsToRender.forEach(host => {
        const planets = groups[host];
        // Check if all planets in this system are selected
        const allSelected = planets.every(p => selectedPlanetNames.has(p.pl_name));
        
        html += `
        <div class="system-group" data-host="${host}">
            <div class="system-header">
                <label class="checkbox-container">
                    <input type="checkbox" class="system-checkbox" data-host="${host}" ${allSelected ? 'checked' : ''}>
                    <span class="checkmark"></span>
                </label>
                <span>System: ${host} (${planets.length} planets)</span>
            </div>
            <div class="system-planets">
        `;

        planets.forEach(p => {
            const isChecked = selectedPlanetNames.has(p.pl_name);
            const rad = p.pl_rade ? (+p.pl_rade).toFixed(2) + ' R⊕' : '?';
            const year = p.disc_year || '?';
            
            html += `
                <div class="planet-item">
                    <label class="checkbox-container">
                        <input type="checkbox" class="planet-checkbox" data-name="${p.pl_name}" data-host="${host}" ${isChecked ? 'checked' : ''}>
                        <span class="checkmark"></span>
                    </label>
                    <div style="flex:1;"><strong>${p.pl_name}</strong></div>
                    <div class="planet-details">
                        <span>Year: ${year}</span>
                        <span>Radius: ${rad}</span>
                    </div>
                </div>
            `;
        });

        html += `</div></div>`;
    });

    container.innerHTML = html;

    // Attach dynamic listeners
    container.querySelectorAll('.system-checkbox').forEach(cb => {
        cb.addEventListener('change', (e) => {
            const host = e.target.dataset.host;
            const isChecked = e.target.checked;
            
            // Update all planets in this system
            const sysPlanets = groups[host];
            if (sysPlanets) {
                sysPlanets.forEach(p => {
                    if (isChecked) selectedPlanetNames.add(p.pl_name);
                    else selectedPlanetNames.delete(p.pl_name);
                });
            }
            updateSelectionCount();
            
            // Check all child checkboxes
            const parentGroup = e.target.closest('.system-group');
            parentGroup.querySelectorAll('.planet-checkbox').forEach(pcb => pcb.checked = isChecked);
        });
    });

    container.querySelectorAll('.planet-checkbox').forEach(cb => {
        cb.addEventListener('change', (e) => {
            const name = e.target.dataset.name;
            const host = e.target.dataset.host;
            
            if (e.target.checked) selectedPlanetNames.add(name);
            else selectedPlanetNames.delete(name);
            
            updateSelectionCount();
            
            // Update parent system checkbox if needed
            const parentGroup = e.target.closest('.system-group');
            const allChecked = Array.from(parentGroup.querySelectorAll('.planet-checkbox')).every(c => c.checked);
            parentGroup.querySelector('.system-checkbox').checked = allChecked;
        });
    });
}

function updateSelectionCount() {
    document.getElementById('selected-count').textContent = selectedPlanetNames.size;
}
