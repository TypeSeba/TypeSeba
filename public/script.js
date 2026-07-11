// CONFIGURACIÓN DE SUPABASE
const supabaseUrl = 'https://hcvyalkfuxrvowbleztr.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhjdnlhbGtmdXhydm93YmxlenRyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk3MjA5MjYsImV4cCI6MjA4NTI5NjkyNn0.uf0bZfjp2n1RM6h4XKxQZDXUI51C3_24kFiIbdXD_aQ';
if (window.supabase) {
    window._supabase = window.supabase.createClient(supabaseUrl, supabaseKey, {
        auth: { persistSession: false }
    });
}

let lenis; // Declaración global

// --- INICIALIZACIÓN DE LENIS (CON SEGURIDAD) ---
try {
    if (typeof Lenis !== 'undefined') {
        lenis = new Lenis({
            duration: 1.2,
            easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        });

        function raf(time) {
            lenis.raf(time);
            requestAnimationFrame(raf);
        }
        requestAnimationFrame(raf);
    }
} catch (e) {
    console.error("Error al inicializar Lenis:", e);
}

// --- FUNCIONES DE NAVEGACIÓN Y COMPONENTES ---
function initializeSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                if (lenis) {
                    lenis.scrollTo(target);
                } else {
                    target.scrollIntoView({ behavior: 'smooth' });
                }
            }
        });
    });
}

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

function initializeMobileMenu() {
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const mobileMenu = document.getElementById('mobileMenu');
    const navbar = mobileMenuBtn?.closest('.navbar');

    if (mobileMenuBtn && mobileMenu) {
        mobileMenuBtn.addEventListener('click', () => {
            const isActive = mobileMenu.classList.toggle('active');
            navbar?.classList.toggle('menu-active', isActive);

            if (isActive) {
                document.body.style.overflow = 'hidden';
                if (lenis) lenis.stop();
            } else {
                document.body.style.overflow = '';
                if (lenis) lenis.start();
            }
        });
    }

    document.querySelectorAll('.mobile-link, .mobile-btn').forEach(link => {
        link.addEventListener('click', () => {
            mobileMenu?.classList.remove('active');
            navbar?.classList.remove('menu-active');
            document.body.style.overflow = '';
            if (lenis) lenis.start();
        });
    });
}

async function loadComponents() {
    try {
        const navbarPlaceholder = document.getElementById('navbar-placeholder');
        if (navbarPlaceholder) {
            const response = await fetch('components/navbar.html');
            if (response.ok) {
                navbarPlaceholder.innerHTML = await response.text();
                initializeMobileMenu();
                updateNavbarColor();
                initializeSmoothScroll();
            }
        }
    } catch (error) {
        console.error('Error loading components:', error);
    }
}

// --- EVENT LISTENERS PRINCIPALES ---
document.addEventListener('DOMContentLoaded', () => {
    // 1. Inicializar componentes y animaciones básicas
    loadComponents();
    initializeAnimations();
    initializeSmoothScroll();

    if (document.querySelector('.typewriter-text')) {
        typingEffect();
    }

    // 2. Listener Formulario de Contacto (Página Contacto)
    const contactForm = document.getElementById('contact-form');
    if (contactForm) {
        contactForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            console.log("Formulario interceptado correctamente");

            if (!window._supabase) {
                alert("Error: No se pudo conectar con Supabase. Por favor recarga la página.");
                return;
            }

            const btnSubmit = contactForm.querySelector('.btn-submit');
            const originalText = btnSubmit.innerText;
            btnSubmit.innerText = "ENVIANDO...";
            btnSubmit.disabled = true;

            const datos = {
                nombre: document.getElementById('nombre').value,
                email: document.getElementById('email').value,
                tipo_proyecto: document.getElementById('tipo_proyecto')?.value || null,
                presupuesto: document.getElementById('presupuesto')?.value || null,
                mensaje: document.getElementById('mensaje').value
            };

            const { error } = await window._supabase.from('consultas').insert([datos]);

            if (!error) {
                contactForm.reset();
                btnSubmit.innerText = "¡MENSAJE ENVIADO!";
                btnSubmit.style.backgroundColor = "#4CAF50";
                setTimeout(() => {
                    btnSubmit.innerText = originalText;
                    btnSubmit.style.backgroundColor = "";
                    btnSubmit.disabled = false;
                }, 3000);
                alert("¡Gracias por tu mensaje!");
            } else {
                console.error(error);
                alert("Error al enviar.");
                btnSubmit.innerText = originalText;
                btnSubmit.disabled = false;
            }
        });
    }

});

// --- ANIMACIONES Y EFECTOS (RESTO DEL CÓDIGO) ---
function initializeAnimations() {
    const observerOptions = { threshold: 0.1, rootMargin: '0px 0px -50px 0px' };
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    const animatedElements = document.querySelectorAll('.fade-in-up, .fade-in, .slide-in-left, .slide-in-right, .scale-in');
    animatedElements.forEach(el => observer.observe(el));

    const gridItems = document.querySelectorAll('.portfolio-card, .studio-card, .process-step');
    gridItems.forEach((item, index) => {
        item.style.animationDelay = `${index * 0.15}s`;
    });
}

// FAQ logic
const faqQuestions = document.querySelectorAll('.faq-question');
faqQuestions.forEach(question => {
    question.addEventListener('click', () => {
        const isOpen = question.classList.contains('active');

        faqQuestions.forEach(q => {
            q.classList.remove('active');
            const a = q.parentElement.querySelector('.faq-answer');
            if (a) a.style.display = 'none';
        });

        if (!isOpen) {
            question.classList.add('active');
            const answer = question.parentElement.querySelector('.faq-answer');
            if (answer) answer.style.display = 'block';
        }
    });
});

// Typewriter
const words = ["Growth", "Crecimiento", "Partner"];
let typeIndex = 0;
let typeTimer;

function typingEffect() {
    const el = document.querySelector('.typewriter-text');
    if (!el) return;
    let word = words[typeIndex].split("");
    var loopTyping = function () {
        if (word.length > 0) {
            el.innerHTML += word.shift();
            typeTimer = setTimeout(loopTyping, 120);
        } else {
            setTimeout(deletingEffect, 2000);
        }
    };
    loopTyping();
}

function deletingEffect() {
    const el = document.querySelector('.typewriter-text');
    if (!el) return;
    let word = el.innerHTML.split("");
    var loopDeleting = function () {
        if (word.length > 0) {
            word.pop();
            el.innerHTML = word.join("");
            typeTimer = setTimeout(loopDeleting, 60);
        } else {
            typeIndex = (typeIndex + 1) % words.length;
            typingEffect();
        }
    };
    loopDeleting();
}

window.addEventListener('scroll', updateNavbarColor);
window.addEventListener('resize', updateNavbarColor);

document.querySelectorAll('.portfolio-card').forEach(card => {
    const video = card.querySelector('video');
    if (video) {
        card.addEventListener('mouseenter', () => {
            video.currentTime = 0;
            video.play().catch(() => { });
        });
        card.addEventListener('mouseleave', () => {
            video.pause();
            video.currentTime = 0;
        });
    }
});

