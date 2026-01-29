// 1. CONFIGURACIÓN DE PLANES (Mantenemos los IDs para usarlos luego con Supabase)
const MIS_PLANES = {
    growth: { id: "growth_content", flowPlanId: "TU_PLAN_ID_750" },
    product: { id: "product_build", flowPlanId: "TU_PLAN_ID_1.5M" },
    tech: { id: "tech_dev", flowPlanId: "TU_PLAN_ID_2.5M" }
};

// 2. FUNCIÓN DE SUSCRIPCIÓN (Versión limpia)
// Nota: Por ahora solo imprime en consola, la conectaremos a Supabase en el siguiente paso
async function iniciarSuscripcion(planKey) {
    console.log("Iniciando proceso para el plan:", planKey);
    // Aquí es donde eliminamos el 'prompt' molesto y usaremos el correo del usuario logueado
    alert("Pronto: Aquí te redirigiremos a Flow automáticamente.");
}

// CONFIGURACIÓN DE SUPABASE
const supabaseUrl = 'https://hcvyalkfuxrvowbleztr.supabase.co'; // Tu URL
const supabaseKey = 'sb_publishable_ywnkSoUqEBPAXYzxyMMuog_Uc28avyb';         // Tu llave anon (public)

// Esta línea crea la conexión oficial
const _supabase = supabase.createClient(supabaseUrl, supabaseKey);

// NOTA DE APRENDIZAJE: Usamos '_supabase' (con un guion bajo o un nombre claro) 
// para llamar a todas las funciones de base de datos a partir de ahora.

// --- TODO LO SIGUIENTE ES TU LÓGICA DE DISEÑO Y ANIMACIÓN (NO TOCAR) ---

// Initialize Lenis
const lenis = new Lenis({
    duration: 1.2,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smooth: true,
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
        if (target) lenis.scrollTo(target);
    });
});

// Intersection Observer (Animaciones al hacer scroll)
const observerOptions = { threshold: 0.3, rootMargin: '0px 0px -100px 0px' };
const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
        }
    });
}, observerOptions);

function initializeAnimations() {
    const animatedElements = document.querySelectorAll('.fade-in-up, .fade-in, .slide-in-left, .slide-in-right, .scale-in');
    animatedElements.forEach(el => observer.observe(el));

    const gridItems = document.querySelectorAll('.portfolio-card, .studio-card, .process-step');
    gridItems.forEach((item, index) => {
        item.style.animationDelay = `${index * 0.15}s`;
    });
}

// Navbar Color Change
function updateNavbarColor() {
    const navbar = document.querySelector('.navbar');
    if (!navbar) return;
    const triggerSections = document.querySelectorAll('[data-navbar-dark="true"]');
    const navbarRect = navbar.getBoundingClientRect();
    const navbarCenter = navbarRect.top + navbarRect.height / 2;

    let shouldBeDark = false;
    triggerSections.forEach(section => {
        const rect = section.getBoundingClientRect();
        if (navbarCenter >= rect.top && navbarCenter <= rect.bottom) shouldBeDark = true;
    });
    shouldBeDark ? navbar.classList.add('navbar-dark') : navbar.classList.remove('navbar-dark');
}

// Menu Mobile
function initializeMobileMenu() {
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const mobileMenu = document.getElementById('mobileMenu');
    if (mobileMenuBtn && mobileMenu) {
        mobileMenuBtn.addEventListener('click', () => mobileMenu.classList.toggle('active'));
    }
    document.querySelectorAll('.mobile-link').forEach(link => {
        link.addEventListener('click', () => mobileMenu?.classList.remove('active'));
    });
}

// FAQ
document.querySelectorAll('.faq-question').forEach(question => {
    question.addEventListener('click', () => {
        const answer = question.parentElement.querySelector('.faq-answer');
        question.classList.toggle('active');
        answer.style.display = (answer.style.display === 'block') ? 'none' : 'block';
    });
});

// Component Loader
async function loadComponents() {
    try {
        const navbarPlaceholder = document.getElementById('navbar-placeholder');
        if (navbarPlaceholder) {
            const response = await fetch('components/navbar.html');
            if (response.ok) {
                navbarPlaceholder.innerHTML = await response.text();
                initializeMobileMenu();
                updateNavbarColor();
            }
        }
    } catch (error) {
        console.error('Error loading components:', error);
    }
}

// Inicialización Global
document.addEventListener('DOMContentLoaded', () => {
    initializeAnimations();
    loadComponents();
});

window.addEventListener('scroll', updateNavbarColor);
window.addEventListener('resize', updateNavbarColor);

// Video Hover en Portfolio
document.querySelectorAll('.portfolio-card').forEach(card => {
    const video = card.querySelector('video');
    if (video) {
        card.addEventListener('mouseenter', () => {
            video.currentTime = 0;
            video.play().catch(e => console.log(e));
        });
        card.addEventListener('mouseleave', () => {
            video.pause();
            video.currentTime = 0;
        });
    }
});