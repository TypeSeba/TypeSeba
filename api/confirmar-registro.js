import crypto from 'crypto';

function sign(params, secret) {
    const keys = Object.keys(params).sort();
    const str  = keys.map(k => `${k}${params[k]}`).join('');
    return crypto.createHmac('sha256', secret).update(str).digest('hex');
}

async function flowGet(endpoint, params, secret) {
    const s   = sign(params, secret);
    const url = new URL(`https://sandbox.flow.cl/api/${endpoint}`);
    for (const key in params) url.searchParams.set(key, params[key]);
    url.searchParams.set('s', s);
    const res = await fetch(url.toString());
    return res.json();
}

async function flowPost(endpoint, params, secret) {
    const signature = sign(params, secret);
    const formData  = new URLSearchParams();
    for (const key in params) formData.append(key, params[key]);
    formData.append('s', signature);
    const res = await fetch(`https://sandbox.flow.cl/api/${endpoint}`, {
        method: 'POST',
        body: formData,
    });
    return res.json();
}

const THANKS_PAGES = {
    'growth-content':   '/thanks-growth.html',
    'product-designer': '/thanks-product.html',
    'tech-partner':     '/thanks-techpartner.html',
};

export default async function handler(req, res) {
    const token  = req.body?.token  ?? req.query?.token;
    const planId = req.query?.plan;
    const email  = req.query?.email;

    console.log('[confirmar-registro] Inicio →', {
        method: req.method,
        token:  token ? token.slice(0, 8) + '…' : null,
        planId,
        email,
    });

    const thanksPage = THANKS_PAGES[planId] ?? '/thanks-growth.html';
    const errorPage  = `${thanksPage}?error=1`;

    if (!token) {
        console.log('[confirmar-registro] Sin token → redirigiendo a error:', errorPage);
        return res.redirect(302, errorPage);
    }

    const apiKey = process.env.FLOW_API_KEY;
    const secret = process.env.FLOW_SECRET;

    try {
        // 1. Verificar que la tarjeta quedó registrada
        const status = await flowGet('customer/getRegisterStatus', { apiKey, token }, secret);
        console.log('[confirmar-registro] getRegisterStatus →', JSON.stringify(status));

        // status 1 = tarjeta registrada exitosamente
        if (status.status !== 1) {
            console.log('[confirmar-registro] Tarjeta no registrada (status≠1) → redirigiendo a error:', errorPage);
            return res.redirect(302, errorPage);
        }

        // 2. Crear suscripción en Flow
        console.log('[confirmar-registro] Llamando subscription/create con customerId:', status.customerId);
        const subscription = await flowPost('subscription/create', {
            apiKey,
            planId:     `typeseba-${planId}`,
            customerId: status.customerId,
        }, secret);
        console.log('[confirmar-registro] Respuesta subscription/create:', JSON.stringify(subscription));

        // 3. Guardar en Supabase
        if (subscription.subscriptionId && email) {
            const supabaseUrl = process.env.SUPABASE_URL;
            const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

            const patchRes = await fetch(
                `${supabaseUrl}/rest/v1/perfiles?email=eq.${encodeURIComponent(email)}`,
                {
                    method: 'PATCH',
                    headers: {
                        'apikey':        supabaseKey,
                        'Authorization': `Bearer ${supabaseKey}`,
                        'Content-Type':  'application/json',
                        'Prefer':        'return=minimal',
                    },
                    body: JSON.stringify({
                        plan_activo:          planId,
                        flow_subscription_id: subscription.subscriptionId,
                        fecha_inicio:         new Date().toISOString(),
                    }),
                }
            );
            console.log('[confirmar-registro] Supabase PATCH status:', patchRes.status);
        }

    } catch (err) {
        console.error('[confirmar-registro] ERROR:', err);
    }

    console.log('[confirmar-registro] Redirigiendo a:', thanksPage);
    return res.redirect(302, thanksPage);
}
