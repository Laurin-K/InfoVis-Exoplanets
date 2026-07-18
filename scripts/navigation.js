document.addEventListener("DOMContentLoaded", () => {
    // Determine the base path based on whether we are in the root or a subdirectory
    const isInPages = window.location.pathname.includes('/pages/');
    const rootPath = isInPages ? '../' : './';
    const pagesPath = isInPages ? './' : 'pages/';

    const navHTML = `
        <nav class="global-navbar">
            <a href="${rootPath}index.html" class="nav-brand">
                <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>
                Exoplanet Explorer
            </a>
            
            <div class="nav-links-container">
                <a href="${rootPath}index.html" class="nav-link" data-path="index.html">Home</a>
                <a href="${pagesPath}planet-selector.html" class="nav-link" data-path="planet-selector.html" style="color: #ffca28;">Planet Selector</a>
                <a href="${pagesPath}parallel-coordinate-plot.html" class="nav-link" data-path="parallel-coordinate-plot.html">Parallel Coordinates</a>
                
                <div class="nav-dropdown">
                    <button class="nav-dropdown-btn">Spiderplots</button>
                    <div class="nav-dropdown-content">
                        <a href="${pagesPath}spiderplot.html" class="nav-link" data-path="spiderplot.html">Compare View</a>
                        <a href="${pagesPath}spiderplot-gallery.html" class="nav-link" data-path="spiderplot-gallery.html">Individual Gallery</a>
                    </div>
                </div>

                <a href="${pagesPath}scatterplot.html" class="nav-link" data-path="scatterplot.html">Scatterplot</a>

                <div class="nav-dropdown">
                    <button class="nav-dropdown-btn">Interactive Labs</button>
                    <div class="nav-dropdown-content">
                        <a href="${pagesPath}habitable-zone.html" class="nav-link" data-path="habitable-zone.html">Habitable Zone</a>
                        <a href="${pagesPath}gravity-drop.html" class="nav-link" data-path="gravity-drop.html">Gravity Drop</a>
                        <a href="${pagesPath}transit-lab.html" class="nav-link" data-path="transit-lab.html">Transit Lab</a>
                    </div>
                </div>            </div>

            <div class="nav-actions">
                <button class="nav-tutorial-btn" onclick="if(window.openTutorial) { window.openTutorial(); } else { alert('Tutorial only available on Home screen for now.'); }">Tutorial & Help</button>
            </div>
        </nav>
    `;

    // Inject as first child of body
    document.body.insertAdjacentHTML('afterbegin', navHTML);

    // Set active link
    const currentPath = window.location.pathname.split('/').pop() || 'index.html';
    const links = document.querySelectorAll('.nav-link');
    
    links.forEach(link => {
        if (link.dataset.path === currentPath) {
            link.classList.add('active');
            
            // If it's inside a dropdown, highlight the dropdown button too
            const dropdown = link.closest('.nav-dropdown');
            if (dropdown) {
                dropdown.querySelector('.nav-dropdown-btn').classList.add('active');
                dropdown.querySelector('.nav-dropdown-btn').style.color = "var(--nav-accent)";
            }
        }
    });
});
