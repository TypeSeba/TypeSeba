// CONFIGURACIÓN DE SUPABASE
const supabaseUrl = 'https://hcvyalkfuxrvowbleztr.supabase.co'; // Tu URL
const supabaseKey = 'sb_publishable_ywnkSoUqEBPAXYzxyMMuog_Uc28avyb';         // Tu llave anon (public)

// Usamos una pequeña validación por si la librería tarda en cargar
let _supabase;
if (window.supabase) {
    _supabase = window.supabase.createClient(supabaseUrl, supabaseKey);
} else {
    console.error("La librería de Supabase no ha cargado correctamente.");
}


// 1. CONFIGURACIÓN DE PLANES (Mantenemos los IDs para usarlos luego con Supabase)
const MIS_PLANES = {
    growth_content: { id: "growth_content", flowPlanId: "TU_PLAN_ID_750" },
    product_build: { id: "product_build", flowPlanId: "TU_PLAN_ID_1.5M" },
    tech_dev: { id: "tech_dev", flowPlanId: "TU_PLAN_ID_2.5M" }
};

// 2. FUNCIÓN DE SUSCRIPCIÓN (Versión Definitiva)
let planSeleccionado = ''; // Nota: Variable global para saber qué plan eligió
let emailTemporal = '';

function iniciarSuscripcion(planKey) {
    planSeleccionado = planKey; // Guardamos el plan
    document.getElementById('modal-contacto').style.display = 'flex';
    if (window.lenis) lenis.stop();
    // lenis.stop(); // Nota: Detenemos el scroll de la web mientras el modal está abierto (si no funciona, activar esta linea y eliminar la de arriba)
}

// Asegúrate de tener este evento para cerrar el modal
document.getElementById('close-modal')?.addEventListener('click', () => {
    document.getElementById('modal-contacto').style.display = 'none';
    if (window.lenis) lenis.start();
});

// Lógica del formulario dentro del Pop-up
document.getElementById('form-prospecto')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Guardamos el email en la variable global para que el botón de pago lo use
    emailTemporal = document.getElementById('p-email').value;

    const datos = {
        nombre: document.getElementById('p-nombre').value,
        apellido: document.getElementById('p-apellido').value,
        empresa: document.getElementById('p-empresa').value,
        tipo_cliente: document.getElementById('p-tipo').value,
        email: document.getElementById('p-email').value,
        telefono: document.getElementById('p-whatsapp').value,
        plan_interes: planSeleccionado
    };

    // 1. Guardamos en la tabla 'perfiles' de Supabase
    const { error } = await _supabase.from('perfiles').insert([datos]);

    if (!error) {
        // 2. Cambiamos la vista del modal
        document.getElementById('paso-formulario').style.display = 'none';
        document.getElementById('paso-gracias').style.display = 'block';
    } else {
        alert("Hubo un error al guardar tus datos. Intenta nuevamente.");
    }
});

// Botón "Pagar ahora" (Versión corregida con validación de plan)
document.getElementById('btn-pagar-ahora')?.addEventListener('click', async () => {

    // 1. Verificamos que tengamos el email y el plan
    if (!emailTemporal || !planSeleccionado) {
        alert("Faltan datos para procesar el pago. Por favor, intenta de nuevo.");
        return;
    }

    // 2. Buscamos el plan en tu lista de MIS_PLANES
    const plan = MIS_PLANES[planSeleccionado];

    // AQUÍ ESTABA EL ERROR: Si 'plan' no existe, el código se rompe.
    if (!plan) {
        console.error("El plan seleccionado no existe en MIS_PLANES:", planSeleccionado);
        alert("Error: El plan seleccionado no es válido.");
        return;
    }

    try {
        const response = await fetch('/api/crear-pago-flow', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                planId: plan.flowPlanId, // Ahora sí estará definido
                email: emailTemporal,
                userId: "prospecto_" + Date.now()
            })
        });

        const data = await response.json();
        if (data.url) {
            window.location.href = data.url;
        } else {
            console.error("Error de la API de Flow:", data);
            alert("No se pudo generar el link de pago.");
        }
    } catch (err) {
        console.error("Error en la llamada a la API:", err);
    }
});

// Cerrar modal
document.getElementById('close-modal')?.addEventListener('click', () => {
    document.getElementById('modal-contacto').style.display = 'none';
    lenis.start(); // Nota: Devolvemos el scroll al usuario
});



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