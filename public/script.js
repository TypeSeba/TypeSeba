

// Actualización de tus planes en script.js con los IDs reales de la API
const MIS_PLANES = {
    growth: { id: "growth_content", flowPlanId: "TU_PLAN_ID_750" },
    product: { id: "product_build", flowPlanId: "TU_PLAN_ID_1.5M" },
    tech: { id: "tech_dev", flowPlanId: "TU_PLAN_ID_2.5M" }
};

// Esta función llamará a tu servidor (Cloud Function)
async function iniciarSuscripcion(planKey) {
    const plan = MIS_PLANES[planKey];

    // Llamamos a tu función de Firebase (que crearemos a continuación)
    const response = await fetch('https://tuservidor.com/crearSuscripcion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            planId: plan.flowPlanId,
            email: "correo@cliente.com", // Esto vendrá de tu formulario
            nombre: "Nombre Cliente"
        })
    });

    const data = await response.json();

    // Redirigimos al Checkout de Flow usando la data de la API
    if (data.url && data.token) {
        window.location.href = `${data.url}?token=${data.token}`;
    }
}// fin integracion de Flow

// Initialize Lenis (Global to be accessible)
const lenis = new Lenis({
    duration: 1.2,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    direction: 'vertical',
    gestureDirection: 'vertical',
    smooth: true,
    mouseMultiplier: 1,
    smoothTouch: false,
    touchMultiplier: 2,
});

function raf(time) {
    lenis.raf(time);
    requestAnimationFrame(raf);
}

requestAnimationFrame(raf);

// Smooth scroll for anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            lenis.scrollTo(target);
        }
    });
});

// Intersection Observer Setup
const observerOptions = {
    threshold: 0.3,
    rootMargin: '0px 0px -100px 0px'
};

const observer = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
        }
    });
}, observerOptions);

function initializeAnimations() {
    // Observe all animated elements
    const animatedElements = document.querySelectorAll('.fade-in-up, .fade-in, .slide-in-left, .slide-in-right, .scale-in');
    animatedElements.forEach(el => {
        observer.observe(el);
    });

    // Add stagger effect to grid items
    const gridItems = document.querySelectorAll('.portfolio-card, .studio-card, .process-step');
    gridItems.forEach((item, index) => {
        item.style.animationDelay = `${index * 0.15}s`;
    });
}

// Navbar Color Change on Scroll
function updateNavbarColor() {
    const navbar = document.querySelector('.navbar');
    if (!navbar) return;
    const triggerSections = document.querySelectorAll('[data-navbar-dark="true"]');

    const navbarRect = navbar.getBoundingClientRect();
    const navbarCenter = navbarRect.top + navbarRect.height / 2;
    let shouldBeDark = false;
    triggerSections.forEach(section => {
        const rect = section.getBoundingClientRect();
        if (navbarCenter >= rect.top && navbarCenter <= rect.bottom) {
            shouldBeDark = true;
        }
    });
    if (shouldBeDark) {
        navbar.classList.add('navbar-dark');
    } else {
        navbar.classList.remove('navbar-dark');
    }
}

// Menu Functions
function initializeMobileMenu() {
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const mobileMenu = document.getElementById('mobileMenu');

    if (mobileMenuBtn && mobileMenu) {
        mobileMenuBtn.addEventListener('click', () => {
            mobileMenu.classList.toggle('active');
        });
    }

    // Close mobile menu when clicking a link
    const mobileLinks = document.querySelectorAll('.mobile-link');
    mobileLinks.forEach(link => {
        link.addEventListener('click', () => {
            if (mobileMenu) {
                mobileMenu.classList.remove('active');
            }
        });
    });
}

// FAQ Functionality
const faqQuestions = document.querySelectorAll('.faq-question');
faqQuestions.forEach(question => {
    question.addEventListener('click', () => {
        const faqItem = question.parentElement;
        const answer = faqItem.querySelector('.faq-answer');

        question.classList.toggle('active');

        if (answer.style.display === 'block') {
            answer.style.display = 'none';
        } else {
            answer.style.display = 'block';
        }
    });
});

document.querySelectorAll('.faq-answer').forEach(answer => {
    answer.style.display = 'none';
});

// Component Loader
async function loadComponents() {
    console.log("Starting loadComponents...");

    try {
        // Load Navbar
        const navbarPlaceholder = document.getElementById('navbar-placeholder');
        if (navbarPlaceholder) {
            const response = await fetch('components/navbar.html');
            if (response.ok) {
                const html = await response.text();
                navbarPlaceholder.innerHTML = html;
                initializeMobileMenu();
                updateNavbarColor();
            } else {
                console.error('Failed to load navbar:', response.status);
            }
        }

    } catch (error) {
        console.error('Error loading components:', error);
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initializeAnimations(); // For static content
    loadComponents();       // For dynamic content
});

// Event Listeners
window.addEventListener('scroll', updateNavbarColor);
window.addEventListener('resize', updateNavbarColor);

// Portfolio Video Hover
const portfolioCards = document.querySelectorAll('.portfolio-card');
portfolioCards.forEach(card => {
    const video = card.querySelector('video');
    if (video) {
        card.addEventListener('mouseenter', () => {
            video.currentTime = 0;
            const playPromise = video.play();
            if (playPromise !== undefined) text = playPromise.catch(e => console.log(e));
        });
        card.addEventListener('mouseleave', () => {
            video.pause();
            video.currentTime = 0;
        });
    }
});

// Función para iniciar el proceso de suscripción
async function suscribirAlPlan(planKey) {
    // 1. Aquí definimos los IDs de tus planes tal como aparecen en Flow
    // REEMPLAZA los textos en mayúsculas por tus IDs reales de Flow
    const idsFlow = {
        'growth': 'ID_DE_TU_PLAN_750K',
        'product': 'ID_DE_TU_PLAN_1.5M',
        'tech': 'ID_DE_TU_PLAN_2.5M'
    };

    const emailUsuario = prompt("¿A qué correo enviamos tu suscripción?");
    if (!emailUsuario) return; // Si cancela el prompt, no hace nada

    try {
        // Llamamos a la función "robot" que subimos a Firebase
        const crearSuscripcion = firebase.functions().httpsCallable('crearSuscripcion');

        const resultado = await crearSuscripcion({
            planId: idsFlow[planKey],
            email: emailUsuario,
            nombre: "Cliente Pro"
        });

        if (resultado.data.success) {
            // Si todo sale bien, redirigimos a la página de Flow
            window.location.href = `${resultado.data.url}?token=${resultado.data.token}`;
        } else {
            alert("Error: " + resultado.data.error);
        }
    } catch (error) {
        console.error("Error detallado:", error);
        alert("Hubo un problema al conectar con el sistema de pagos.");
    }
}