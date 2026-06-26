async function sign(params: Record<string, string | number>, secret: string): Promise<string> {
    const keys = Object.keys(params).sort();
    const str  = keys.map(k => `${k}${params[k]}`).join('');
    const enc  = new TextEncoder();
    const key  = await crypto.subtle.importKey(
        'raw', enc.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false, ['sign']
    );
    const sig = await crypto.subtle.sign('HMAC', key, enc.encode(str));
    return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function flowGet(endpoint: string, params: Record<string, string | number>, secret: string) {
    const s   = await sign(params, secret);
    const url = new URL(`https://sandbox.flow.cl/api/${endpoint}`);
    for (const key in params) url.searchParams.set(key, String(params[key]));
    url.searchParams.set('s', s);
    const res = await fetch(url.toString());
    return res.json();
}

async function flowPost(endpoint: string, params: Record<string, string | number>, secret: string) {
    const s        = await sign(params, secret);
    const formData = new URLSearchParams();
    for (const key in params) formData.append(key, String(params[key]));
    formData.append('s', s);
    const res = await fetch(`https://sandbox.flow.cl/api/${endpoint}`, {
        method: 'POST',
        body: formData,
    });
    return res.json();
}

const THANKS_PAGES: Record<string, string> = {
    'growth-content':   'https://typeseba.com/thanks-growth.html',
    'product-designer': 'https://typeseba.com/thanks-product.html',
    'tech-partner':     'https://typeseba.com/thanks-techpartner.html',
};

const redirect = (url: string) =>
    new Response(null, { status: 302, headers: { 'Location': url } });

Deno.serve(async (req: Request) => {
    const reqUrl = new URL(req.url);
    const planId = reqUrl.searchParams.get('plan');
    const email  = reqUrl.searchParams.get('email');
    const nombre = reqUrl.searchParams.get('nombre') ?? '';

    // token puede venir en query string (redirect GET de Flow) o en body POST
    let token: string | null = reqUrl.searchParams.get('token');
    if (!token && req.method === 'POST') {
        try {
            const contentType = req.headers.get('content-type') ?? '';
            if (contentType.includes('application/x-www-form-urlencoded')) {
                const form = await req.formData();
                token = form.get('token') as string | null;
            } else {
                const body = await req.json();
                token = body?.token ?? null;
            }
        } catch { /* ignorar errores de parseo */ }
    }

    console.log('[confirmar-registro] Inicio →', {
        method: req.method,
        token:  token ? token.slice(0, 8) + '…' : null,
        planId,
        email,
    });

    const thanksPage = THANKS_PAGES[planId ?? ''] ?? 'https://typeseba.com/thanks-growth.html';
    const errorPage  = `${thanksPage}?error=1`;

    if (!token) {
        console.log('[confirmar-registro] Sin token → redirigiendo a error:', errorPage);
        return redirect(errorPage);
    }

    const apiKey = Deno.env.get('FLOW_API_KEY')!;
    const secret = Deno.env.get('FLOW_SECRET')!;

    try {
        // 1. Verificar que la tarjeta quedó registrada
        const status = await flowGet('customer/getRegisterStatus', { apiKey, token }, secret);
        console.log('[confirmar-registro] getRegisterStatus →', JSON.stringify(status));

        // status 1 = tarjeta registrada exitosamente
        if (Number(status.status) !== 1) {
            console.log('[confirmar-registro] Tarjeta no registrada (status≠1) → redirigiendo a error:', errorPage);
            return redirect(errorPage);
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
            const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
            const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

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

            const TEMPLATES: Record<string, string> = {
                'growth-content':   '77b94220-5690-4441-a5df-bbbbe83ea638',
                'product-designer': 'abbc1552-bc0d-4cfd-9abc-e65616e79ad1',
                'tech-partner':     'b1697580-4695-4cbe-9fd9-d9cc38a5f013',
            };
            const templateId = TEMPLATES[planId ?? ''];
            if (templateId) {
                try {
                    const resendRes = await fetch('https://api.resend.com/emails', {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
                            'Content-Type':  'application/json',
                        },
                        body: JSON.stringify({
                            from:        'TypeSeba <contact@typeseba.com>',
                            to:          [{ email, name: nombre }],
                            subject:     'Bienvenido a bordo — tu suscripción está activa',
                            template_id: templateId,
                            variables:   { Nombre: nombre },
                        }),
                    });
                    console.log('[confirmar-registro] Resend status:', resendRes.status);
                } catch (resendErr) {
                    console.error('[confirmar-registro] Resend ERROR:', resendErr);
                }
            }
        }

    } catch (err) {
        console.error('[confirmar-registro] ERROR:', err);
    }

    console.log('[confirmar-registro] Redirigiendo a:', thanksPage);
    return redirect(thanksPage);
});
