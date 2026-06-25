// Tutorial Logic
const tutorialHTML = `
<div class="tutorial-overlay" id="tutorial-overlay">
    <div class="tutorial-modal">
        <button class="tutorial-close" id="tutorial-close" title="Close tutorial">&times;</button>
        <div class="tutorial-slides">
            <div class="tutorial-slide active" data-index="0">
                <h2>Welcome to the Exoplanet Explorer! 🪐</h2>
                <p>This application allows you to <strong>explore</strong> and discover thousands of planets outside our solar system using real NASA data.</p>
                <p>Don't just look—<strong>interact!</strong> You can click, hover, filter, and zoom through the data to find interesting patterns.</p>
            </div>
            <div class="tutorial-slide" data-index="1">
                <h2>Parallel Coordinate Plot</h2>
                <p>Compare many planets across multiple dimensions at once.</p>
                <ul>
                    <li><strong>Filter (Brush):</strong> Click and drag vertically on any axis to filter the data.</li>
                    <li><strong>Move Axes:</strong> Drag the axis titles horizontally to reorder them.</li>
                    <li><strong>Highlight:</strong> Click on a line to view the specific details of that planet.</li>
                </ul>
            </div>
            <div class="tutorial-slide" data-index="2">
                <h2>Spiderplots & Scatterplot</h2>
                <p><strong>Spiderplot:</strong> Compare the exact makeup of 1 to 3 planets simultaneously. Use the search bar to find your favorite exoplanets (like HD 209458 b).</p>
                <p><strong>Scatterplot:</strong> Dive deep into the relationship between two specific metrics. Use your mouse scroll to <strong>zoom in</strong> and click+drag to <strong>pan</strong> around the plot!</p>
            </div>
            <div class="tutorial-slide" data-index="3">
                <h2>Interactive Simulations</h2>
                <p>Experience the physics and discovery methods firsthand!</p>
                <ul>
                    <li><strong>Habitable Zone:</strong> Adjust a star's temperature to see where liquid water could exist.</li>
                    <li><strong>Gravity Drop:</strong> Drop a probe on different planets and compare the fall speed to Earth.</li>
                    <li><strong>Transit Lab:</strong> Watch how astronomers discover planets by observing starlight dips.</li>
                </ul>
            </div>
        </div>
        <div class="tutorial-controls">
            <button class="tutorial-btn" id="tutorial-prev" disabled>Back</button>
            <div class="tutorial-dots" id="tutorial-dots">
                <div class="tutorial-dot active"></div>
                <div class="tutorial-dot"></div>
                <div class="tutorial-dot"></div>
                <div class="tutorial-dot"></div>
            </div>
            <button class="tutorial-btn primary" id="tutorial-next">Next</button>
        </div>
    </div>
</div>
`;

function initTutorial() {
    // Append HTML to body if not exists
    if (!document.getElementById('tutorial-overlay')) {
        document.body.insertAdjacentHTML('beforeend', tutorialHTML);
    }

    const overlay = document.getElementById('tutorial-overlay');
    const closeBtn = document.getElementById('tutorial-close');
    const prevBtn = document.getElementById('tutorial-prev');
    const nextBtn = document.getElementById('tutorial-next');
    const slides = document.querySelectorAll('.tutorial-slide');
    const dots = document.querySelectorAll('.tutorial-dot');
    let currentSlide = 0;

    function showSlide(index) {
        slides.forEach(s => s.classList.remove('active'));
        dots.forEach(d => d.classList.remove('active'));
        
        slides[index].classList.add('active');
        dots[index].classList.add('active');
        
        prevBtn.disabled = index === 0;
        
        if (index === slides.length - 1) {
            nextBtn.textContent = "Let's Explore!";
        } else {
            nextBtn.textContent = "Next";
        }
    }

    nextBtn.addEventListener('click', () => {
        if (currentSlide < slides.length - 1) {
            currentSlide++;
            showSlide(currentSlide);
        } else {
            closeTutorial();
        }
    });

    prevBtn.addEventListener('click', () => {
        if (currentSlide > 0) {
            currentSlide--;
            showSlide(currentSlide);
        }
    });

    closeBtn.addEventListener('click', closeTutorial);

    // Provide a global function to open it
    window.openTutorial = function() {
        currentSlide = 0;
        showSlide(0);
        overlay.classList.add('active');
    };

    function closeTutorial() {
        overlay.classList.remove('active');
        localStorage.setItem('exoplanet_tutorial_seen', 'true');
    }

    // Auto-open if not seen
    if (!localStorage.getItem('exoplanet_tutorial_seen')) {
        // slight delay to let page load
        setTimeout(window.openTutorial, 500);
    }
}

// Ensure it runs after DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTutorial);
} else {
    initTutorial();
}
