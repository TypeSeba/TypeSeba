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
    // Flow envía POST (webhook) al url_return; el browser puede llegar como GET
    const token  = req.body?.token  ?? req.query?.token;
    const planId = req.query?.plan;
    const email  = req.query?.email;

    const thanksPage = THANKS_PAGES[planId] ?? '/thanks-growth.html';
    const errorPage  = `${thanksPage}?error=1`;

    if (!token) {
        return req.method === 'GET' ? res.redirect(302, errorPage) : res.status(400).end();
    }

    const apiKey = process.env.FLOW_API_KEY;
    const secret = process.env.FLOW_SECRET;

    try {
        // 1. Verificar que la tarjeta quedó registrada
        const status = await flowGet('customer/getRegisterStatus', { apiKey, token }, secret);

        // status 1 = tarjeta registrada exitosamente
        if (status.status !== 1) {
            return req.method === 'GET' ? res.redirect(302, errorPage) : res.status(200).end();
        }

        // 2. Crear suscripción en Flow
        const subscription = await flowPost('subscription/create', {
            apiKey,
            planId:     `typeseba-${planId}`,
            customerId: status.customerId,
        }, secret);

        // 3. Guardar en Supabase
        if (subscription.subscriptionId && email) {
            const supabaseUrl = process.env.SUPABASE_URL;
            const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

            await fetch(
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
        }

    } catch {
        // no bloquear al usuario — redirigir igual
    }

    if (req.method === 'GET') return res.redirect(302, thanksPage);
    return res.status(200).end();
}
