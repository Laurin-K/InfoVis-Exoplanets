# InfoVis Exoplanets — Project Documentation

> **Interactive Information Visualization · SS26 · Technische Hochschule Nürnberg**

---

## 1. Project Overview

This project is an interactive web-based visualization tool for exploring the [NASA Exoplanet Archive](https://exoplanetarchive.ipac.caltech.edu/) dataset. The application enables users — primarily **public audiences and students** (confirmed by expert: "public outreach") — to explore thousands of exoplanets through multiple coordinated and standalone views built with **D3.js**.

The tool is structured around three functional modules:

| Module               | Views                                                                    |
| -------------------- | ------------------------------------------------------------------------ |
| **Main Views**       | Parallel Coordinate Plot, Spiderplot, Spiderplot Gallery, Scatterplot    |
| **Interactive Labs** | Habitable Zone Explorer, Gravity Drop Simulator, Transit Light Curve Lab |
| **Utilities**        | Planet Selector                                                          |

---

## 2. Final Design

### 2.1 Application Architecture

```
InfoVis-Exoplanets/
├── index.html                  # Landing page / navigation hub
├── pages/
│   ├── parallel-coordinate-plot.html
│   ├── scatterplot.html
│   ├── spiderplot.html
│   ├── spiderplot-gallery.html
│   ├── habitable-zone.html
│   ├── gravity-drop.html
│   ├── transit-lab.html
│   └── planet-selector.html
├── scripts/                    # D3.js visualization logic (JS)
├── styling/                    # Per-view CSS + shared base
└── data/                       # NASA CSV exports + Python processing scripts
```

### 2.2 Technology Stack

- **Frontend:** HTML5, Vanilla CSS, JavaScript (ES6+)
- **Visualization:** [D3.js v7](https://d3js.org/)
- **Data Source:** NASA Exoplanet Archive (public API + CSV export)
- **Data Processing:** Python scripts (`fetch_api_data.py`, `merge_datasets.py`)

### 2.3 Views — Final State

#### Parallel Coordinate Plot (`parallel-coordinate-plot.html`)

- Displays multiple numeric dimensions as parallel vertical axes
- Users can select which dimensions to show/hide via a control panel
- **Brushing & filtering** per axis to narrow down planets
- Earth ↔ Jupiter unit toggle for mass and radius
- **Scale mode** selector (Auto / Linear / Log), with per-axis LOG/LIN labels
- **Color-by** selection with LCh equal-lightness color palettes (addressing contrast feedback)
- Hover highlights a single line; click locks a planet and shows an **infocard**
- Fullscreen chart toggle
- Reset All Filters button
- Column Glossary table at the bottom

#### Scatterplot (`scatterplot.html`)

- Two freely selectable numeric axes from the NASA export
- **Pan & Box Zoom** interaction modes with Reset Zoom button
- **Color-by** selector (Discovery Year, Number of Stars, Planet Count, Mass, Temperature, Discovery Method)
- **Solar System overlay** toggle — adds our solar system's planets as reference points
- **Discovery Year slider** with Play animation (planets appear chronologically 1992–2026)
- Planet **infocard** on click (with link to exoplanet archive)
- Data fields & definitions table at the bottom

#### Spiderplot (`spiderplot.html`)

- Radar/spider chart for comparing normalized exoplanet metrics
- Search for planets by name, with live dropdown preview
- Add up to N planets for side-by-side radial comparison
- Configurable dimensions (add/remove axes)
- Hover tooltip showing axis values with units
- Visibility toggle (eye icon) per planet in the legend
- Missing data: "No Data" placeholder per axis

#### Spiderplot Gallery (`spiderplot-gallery.html`)

- Grid view of individual mini spiderplots
- Browseable overview to identify planet shape patterns
- [TODO: describe filtering/sorting state]

#### Habitable Zone Explorer (`habitable-zone.html`)

- Visualizes habitable zone boundaries based on stellar properties
- Selection by planetary system (not individual planet)
- Shows which planets in a system fall within/outside the habitable zone

#### Gravity Drop Simulator (`gravity-drop.html`)

- Simulates dropping an object on different exoplanet surfaces
- Compares surface gravity across selected planets
- Playful/educational: shows drop time relative to Earth

#### Transit Light Curve Lab (`transit-lab.html`)

- Simulates the photometric dip as a planet transits its host star
- Y-axis is stable; multiple transit profiles are overlaid for comparison
- Educational explanation of the transit detection method

#### Planet Selector (`planet-selector.html`)

- Utility tool to build a custom planet dataset for the other visualizations
- Filter and select planets by properties

---

## 3. Process

### 3.1 Week 6 — Initial Ideas & Sketches

> **[TODO: Insert sketches/mockup images from Week 6 here]**

At this stage, the following core views were proposed:

- Parallel Coordinate Plot (main multi-dimensional exploration tool)
- Spiderplot for individual planet comparisons
- Scatterplot for two-variable relationships
- Scatterplot Matrix (discussed but not pursued)
- Multiple Coordinated Views (discussed, evaluated)

**Key open questions at Week 6:**

- What to do with incomplete/missing data rows?
- Who is the target audience — researchers or students?
- Should a Scatterplot Matrix (SPLOM) be added?
- Should PCA be added as a dimension-reduction toggle?

### 3.2 Feedback Round 1 — 2026-06-10

_Source: [`feedback/20260610-Feedback.md`](feedback/20260610-Feedback.md)_

| Topic                      | Feedback                                                                                     |
| -------------------------- | -------------------------------------------------------------------------------------------- |
| General                    | "Insights fehlen" — the app needs clearer takeaways                                          |
| General                    | Expert consultation required ("must do")                                                     |
| General                    | Incomplete data: show dashed lines for partial entries; show completeness % per column       |
| PCP                        | Fullscreen toggle for the chart                                                              |
| PCP                        | PCA toggle option                                                                            |
| Scatterplot Matrix         | Add it; click to focus                                                                       |
| Spiderplot                 | Better handling of 0 values; selectable dimensions                                           |
| Spiderplot Gallery         | Show axis labels/values; make axes selectable; filter; clustering; selection/overlap compare |
| Multiple Coordinated Views | Evaluate whether to add                                                                      |

### 3.3 Feedback Round 2 — 2026-06-24

_Source: [`feedback/20260624-Feedback.md`](feedback/20260624-Feedback.md)_

**App purpose clarification:** _Exploratory_ use needs more onboarding (tutorial, preview slideshow).

| Topic       | Feedback                               | Implemented?      |
| ----------- | -------------------------------------- | ----------------- |
| General     | Add tutorial / help button             | ✅ Tutorial added |
| PCP         | Movable axes                           | ✅                |
| PCP         | Make Earth/Jupiter toggle more visible | ✅                |
| PCP         | Larger brush hit area + Reset brushing | ✅                |
| PCP         | Tooltip for dimension names            | ✅                |
| PCP         | Fullscreen toggle                      | ✅                |
| Spiderplot  | Live search preview in dropdown        | ✅                |
| Spiderplot  | Add planet directly on select          | [TODO]            |
| Spiderplot  | Hover tooltip with values              | ✅                |
| Spiderplot  | Eye-icon hide/show per planet          | ✅                |
| Spiderplot  | "No Data" per quadrant                 | ✅                |
| Scatterplot | Zoom into plot                         | ✅                |
| Scatterplot | Panning                                | ✅                |
| Scatterplot | More color options                     | ✅                |

### 3.4 Expert Feedback — 2026-06-31 (Laura von Zadow)

_Source: [`feedback/20260631-Feedback-Experte.md`](feedback/20260631-Feedback-Experte.md)_

**Key expert insight:** Target audience is **public outreach** (students/enthusiasts), not researchers.

| Topic          | Expert Feedback                                                  | Implemented?                    |
| -------------- | ---------------------------------------------------------------- | ------------------------------- |
| General        | Link planets to NASA exoplanet archive                           | [TODO]                          |
| General        | "Multi-planet systems" visualization (system lines)              | [TODO – mentioned as idea]      |
| Spiderplot     | Show units on axis labels, not just on hover                     | [TODO]                          |
| Spiderplot     | Disclaimer for missing data (with fallback to secondary dataset) | [TODO]                          |
| Spiderplot     | Dimensions add/remove                                            | ✅                              |
| Spiderplot     | Preload 2–4 demo planets                                         | [TODO]                          |
| Scatter        | Solar System planets as reference points                         | ✅                              |
| Scatter        | Default: Orbital Period (days) vs. Jupiter Radius                | [TODO – verify current default] |
| Scatter        | Discovery Year animation/timeline                                | ✅ (Play slider)                |
| Scatter        | Filter/color by Discovery Method                                 | ✅                              |
| Scatter        | Click → planet infocard + link                                   | ✅                              |
| Scatter        | Performance improvements                                         | [TODO]                          |
| PCP            | LCh color space for equal-lightness palettes                     | ✅                              |
| PCP            | Log/Linear labels per axis                                       | ✅                              |
| PCP            | Interesting default dataset                                      | [TODO]                          |
| Habitable Zone | Only show systems with multiple planets (orbit period ≥ 10 days) | [TODO]                          |
| Gravity Drop   | Add it                                                           | ✅                              |
| Transit        | Stable Y-axis; show how drop changes                             | ✅                              |

### 3.5 Feedback Round 3 — 2026-07-01

_Source: [`feedback/20260701-Feedback.md`](feedback/20260701-Feedback.md)_

| Topic              | Feedback                                                       | Implemented? |
| ------------------ | -------------------------------------------------------------- | ------------ |
| General            | Check all axis labels                                          | [TODO]       |
| General            | Add Solar System planets for context                           | ✅           |
| PCP                | Hover → highlight one line, fade others                        | ✅           |
| PCP                | Poor planet visibility when all lines are plotted              | [TODO]       |
| PCP                | LCh color space                                                | ✅           |
| PCP                | Log/Linear labels + toggle + explain why log                   | ✅           |
| Spiderplot         | Re-add example planets                                         | [TODO]       |
| Spiderplot         | Only compare planets in the same system                        | [TODO]       |
| Spiderplot         | Axes start at 0                                                | [TODO]       |
| Spiderplot         | Avoid mixing log/linear scales                                 | [TODO]       |
| Spiderplot Gallery | Clarify purpose                                                | [TODO]       |
| Scatter            | See expert feedback                                            | —            |
| Habitable Zone     | Selection by system, not individual planet                     | [TODO]       |
| System Comparison  | Implement Laura's idea (system lines with multiple attributes) | [TODO]       |

---

## 4. Design Rationale & Alternatives

### 4.1 Why a Parallel Coordinate Plot?

The NASA dataset has 30+ numeric columns. PCP lets users see patterns across all dimensions simultaneously and filter interactively via brushing — something impossible in a standard table.

**Alternative considered:** Scatterplot Matrix (SPLOM). Discussed in Week 6 but not implemented due to complexity and layout constraints. The PCP serves the same multi-dimensional purpose more compactly.

### 4.2 Why a Spiderplot?

Ideal for comparing a small number of planets across normalized metrics at a glance. Complements the PCP by focusing on individual planet profiles rather than trends.

**Alternative considered:** Bar chart comparison panel. Rejected — less visually expressive and harder to compare across many attributes simultaneously.

### 4.3 Why LCh Color Space for the PCP?

Standard HSL palettes produce colors of varying perceived brightness (purple appears much darker than yellow at the same lightness value). LCh (Lightness-Chroma-Hue) keeps all hues perceptually equal-brightness, making every line visible regardless of value. This was directly recommended by the expert and confirmed in the 2026-07-01 feedback.

### 4.4 Why a Scatterplot with Pan + Box Zoom?

The dataset can have extreme outliers. A single zoom mode forces a tradeoff. Two modes (Pan and Box Zoom) let users navigate freely and also zoom precisely into dense clusters without losing context.

### 4.5 Interactive Labs (Habitable Zone, Gravity Drop, Transit)

These were added to lower the barrier for non-expert users. They make abstract astrophysical concepts tangible. Expert feedback confirmed this direction: "Drop simulator can be a cool demo."

### 4.6 Planet Selector as Separate Utility

Separating dataset curation from visualization keeps each view clean. Users can build a focused subset of planets and then explore it across all views consistently.

---

## 5. Who Did What

The entire project was implemented collaboratively as a group. In retrospect, it is very difficult to track who worked on which specific areas and views, as tasks were not strictly divided.

A large part of the development took place in pair programming:
While one team member, for example, actively wrote the code and managed the technical implementation (e.g., using an AI agent), the other team member simultaneously reviewed the feedback notes, formulated improvement suggestions, or developed new concepts.

The entire project was developed in this highly collaborative manner. However, individual contributions, commits, and pushes can still be tracked via the Git repository history.

---

## 6. Data

| File                           | Description                                             |
| ------------------------------ | ------------------------------------------------------- |
| `nasa_export_large.csv`        | Full NASA Exoplanet Archive export (~900 KB)            |
| `nasa_export_small.csv`        | Reduced export for fast loading (~15 KB)                |
| `nasa_export_large_merged.csv` | Large export merged with secondary API data             |
| `nasa_export_small_merged.csv` | Small export merged with secondary API data             |
| `all_exoplanets_2021.csv`      | Historical snapshot dataset (2021)                      |
| `api_only_export.csv`          | Raw API export                                          |
| `column_explanation.csv`       | Human-readable descriptions of all data columns         |
| `fetch_api_data.py`            | Python script to fetch data from the NASA API           |
| `merge_datasets.py`            | Python script to merge/clean the datasets               |
| `spiderplot-data.js`           | Pre-processed JS data file for the spiderplot (~880 KB) |

---

## 7. Open Items / Known Gaps

> Items that were requested in feedback but not yet confirmed as implemented:

- [ ] Link individual planets to their NASA Exoplanet Archive entry
- [ ] Preload 2–4 example planets in the Spiderplot
- [ ] Spiderplot: only allow comparison within the same planetary system
- [ ] Spiderplot: axes start at 0; avoid mixed log/linear scales
- [ ] Spiderplot Gallery: clarify purpose / add filter
- [ ] PCP: improve single-planet visibility when all lines are rendered
- [ ] PCP: curate an interesting default dataset / preset
- [ ] Habitable Zone: filter by system (not individual planet); min. 10-day orbit period
- [ ] Scatterplot: performance improvements for large datasets
- [ ] Scatterplot: default axes = Orbital Period (days) vs. Jupiter Radius
- [ ] Add units to Spiderplot axis labels (not just on hover)
- [ ] "System comparison" visualization (Laura's idea: one line per system, planets on the line)
- [ ] Axis label audit across all views

---

_Last updated: 2026-07-19_
