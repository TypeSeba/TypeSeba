// CONFIGURACIÓN DE SUPABASE
const supabaseUrl = 'https://hcvyalkfuxrvowbleztr.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhjdnlhbGtmdXhydm93YmxlenRyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk3MjA5MjYsImV4cCI6MjA4NTI5NjkyNn0.uf0bZfjp2n1RM6h4XKxQZDXUI51C3_24kFiIbdXD_aQ';
window._supabase = window.supabase.createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});
console.log('Supabase client:', window._supabase);
console.log('Supabase URL:', supabaseUrl);
console.log('Supabase Key primeros 20 chars:', supabaseKey.substring(0, 20));

// CONFIGURACIÓN DE PLANES
const MIS_PLANES = {
    growth_content: { id: "growth_content", flowPlanId: "growth-content" },
    product_build: { id: "product_build", flowPlanId: "product-designer" },
    tech_dev: { id: "tech_dev", flowPlanId: "tech-partner" }
};

let planSeleccionado = '';
let emailTemporal = '';
let lenis; // Declaración global

// Funciones de utilidad para el modal
function iniciarSuscripcion(planKey) {
    planSeleccionado = planKey;
    const modal = document.getElementById('modal-contacto');
    if (modal) modal.style.display = 'flex';
    if (lenis) lenis.stop();
}

function cerrarModal() {
    const modal = document.getElementById('modal-contacto');
    if (modal) modal.style.display = 'none';
    if (lenis) lenis.start();

    const pasoForm = document.getElementById('paso-formulario');
    const pasoGracias = document.getElementById('paso-gracias');
    if (pasoForm) pasoForm.style.display = '';
    if (pasoGracias) pasoGracias.style.display = 'none';

    const formProspecto = document.getElementById('form-prospecto');
    if (formProspecto) {
        formProspecto.reset();
        const btnEnviar = formProspecto.querySelector('.btn-modal-enviar');
        if (btnEnviar) { btnEnviar.textContent = 'Enviar información'; btnEnviar.disabled = false; }
        const errEl = formProspecto.querySelector('.modal-form-error');
        if (errEl) errEl.textContent = '';
    }
    emailTemporal = '';
}

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

    // 3. Listener Formulario Prospecto (Pop-up)
    const formProspecto = document.getElementById('form-prospecto');
    if (formProspecto) {
        formProspecto.addEventListener('submit', async (e) => {
            e.preventDefault();

            const btnEnviar = formProspecto.querySelector('.btn-modal-enviar');

            function mostrarErrorModal(msg) {
                let errEl = formProspecto.querySelector('.modal-form-error');
                if (!errEl) {
                    errEl = document.createElement('p');
                    errEl.className = 'modal-form-error';
                    errEl.style.cssText = 'color:#e53e3e;font-size:.875rem;margin:.75rem 0 0;text-align:center;';
                    btnEnviar.insertAdjacentElement('afterend', errEl);
                }
                errEl.textContent = msg;
            }

            console.log('[Modal] Submit disparado. window._supabase:', !!window._supabase, '| planSeleccionado:', planSeleccionado);

            if (!window._supabase) {
                mostrarErrorModal('No se pudo conectar. Por favor recarga la página e intenta de nuevo.');
                return;
            }

            const errEl = formProspecto.querySelector('.modal-form-error');
            if (errEl) errEl.textContent = '';
            btnEnviar.textContent = 'Enviando...';
            btnEnviar.disabled = true;

            emailTemporal = document.getElementById('p-email').value;
            const datos = {
                nombre: document.getElementById('p-nombre').value,
                apellido: document.getElementById('p-apellido').value,
                empresa: document.getElementById('p-empresa').value,
                tipo_cliente: document.getElementById('p-tipo').value,
                email: emailTemporal,
                telefono: document.getElementById('p-whatsapp').value,
                plan_interes: planSeleccionado
            };

            console.log('[Modal] Datos a insertar:', datos);
            console.log('[Modal] Llamando a Supabase insert...');
            console.log('[Modal] Supabase headers:', window._supabase.rest?.headers);

            const { data: insertData, error } = await window._supabase.from('perfiles').insert([datos]);

            console.log('[Modal] Respuesta Supabase → data:', insertData, '| error:', error);

            if (!error) {
                document.getElementById('paso-formulario').style.display = 'none';
                document.getElementById('paso-gracias').style.display = 'block';
            } else {
                console.error('[Modal] Error completo:', JSON.stringify(error, null, 2));
                mostrarErrorModal('Hubo un problema al enviar tus datos. Por favor intenta de nuevo.');
                btnEnviar.textContent = 'Enviar información';
                btnEnviar.disabled = false;
            }
        });
    }

    // 4. Otros listeners
    document.getElementById('close-modal')?.addEventListener('click', cerrarModal);

    // Modal cancelación
    document.getElementById('btn-cancelar-suscripcion')?.addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('modal-cancelacion').style.display = 'flex';
    });

    document.getElementById('close-modal-cancelacion')?.addEventListener('click', () => {
        document.getElementById('modal-cancelacion').style.display = 'none';
    });

    document.getElementById('modal-cancelacion')?.addEventListener('click', (e) => {
        if (e.target === e.currentTarget) e.currentTarget.style.display = 'none';
    });

    document.getElementById('form-cancelacion')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('c-email').value.trim();
        const btn = e.target.querySelector('.btn-modal-enviar');
        btn.disabled = true;
        btn.textContent = 'Enviando...';

        try {
            const res = await fetch('/api/solicitar-cancelacion', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });
            if (res.ok) {
                document.getElementById('cancelacion-formulario').style.display = 'none';
                document.getElementById('cancelacion-gracias').style.display = 'block';
            } else {
                btn.disabled = false;
                btn.textContent = 'Solicitar cancelación';
                alert('Hubo un error. Por favor intenta nuevamente.');
            }
        } catch {
            btn.disabled = false;
            btn.textContent = 'Solicitar cancelación';
            alert('Hubo un error. Por favor intenta nuevamente.');
        }
    });

    if (new URLSearchParams(window.location.search).get('cancelar') === '1') {
        const m = document.getElementById('modal-cancelacion');
        if (m) m.style.display = 'flex';
    }

    document.getElementById('btn-pagar-ahora')?.addEventListener('click', async () => {
        if (!emailTemporal || !planSeleccionado) return;
        const plan = MIS_PLANES[planSeleccionado];
        if (!plan) return;

        try {
            const response = await fetch('/api/crear-pago-flow', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    planId: plan.flowPlanId,
                    email: emailTemporal,
                    userId: "prospecto_" + Date.now()
                })
            });
            const data = await response.json();
            if (data.url) window.location.href = data.url;
        } catch (err) {
            console.error(err);
        }
    });
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

