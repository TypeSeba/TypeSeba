const PLANES: Record<string, { amount: number; nombre: string }> = {
    'growth-content':   { amount: 900000,  nombre: 'TypeSeba Growth Content' },
    'product-designer': { amount: 1700000, nombre: 'TypeSeba Product Designer' },
    'tech-partner':     { amount: 2700000, nombre: 'TypeSeba Tech Partner' },
};

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

async function flowGet(endpoint: string, params: Record<string, string | number>, secret: string) {
    const s   = await sign(params, secret);
    const url = new URL(`https://sandbox.flow.cl/api/${endpoint}`);
    for (const key in params) url.searchParams.set(key, String(params[key]));
    url.searchParams.set('s', s);
    const res = await fetch(url.toString());
    return res.json();
}

const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });

Deno.serve(async (req: Request) => {
    if (req.method !== 'POST') return json({ message: 'Método no permitido' }, 405);

    const { planId, email, nombre } = await req.json();
    console.log('[crear-pago-flow] Inicio →', { planId, email, nombre: nombre ?? '(sin nombre)' });

    if (!planId || !email) return json({ error: 'planId y email son requeridos' }, 400);

    const plan = PLANES[planId];
    if (!plan) return json({ error: 'Plan no válido' }, 400);

    const apiKey      = Deno.env.get('FLOW_API_KEY')!;
    const secret      = Deno.env.get('FLOW_SECRET')!;
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    try {
        // 1. Crear plan en Flow (ignorar si ya existe)
        console.log('[crear-pago-flow] Paso 1: plans/create →', `typeseba-${planId}`);
        await flowPost('plans/create', {
            apiKey,
            planId:      `typeseba-${planId}`,
            name:        plan.nombre,
            amount:      plan.amount,
            currency:    'CLP',
            interval:    3,
            urlCallback: `${supabaseUrl}/functions/v1/confirmar-pago`,
        }, secret).catch(err => console.log('[crear-pago-flow] plans/create ignorado:', err.message));

        // 2. Obtener o crear cliente en Flow
        let customerId: string | undefined;

        // 2a. Revisar Supabase primero
        console.log('[crear-pago-flow] Paso 2a: buscando flow_customer_id en Supabase para', email);
        const dbRes = await fetch(
            `${supabaseUrl}/rest/v1/perfiles?select=flow_customer_id&email=eq.${encodeURIComponent(email)}&order=created_at.desc&limit=1`,
            { headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` } }
        );
        const rows = await dbRes.json();
        console.log('[crear-pago-flow] Supabase resultado:', JSON.stringify(rows));

        if (rows[0]?.flow_customer_id) {
            customerId = rows[0].flow_customer_id;
            console.log('[crear-pago-flow] Reutilizando customer de Supabase:', customerId);
        } else {
            // 2b. Intentar crear en Flow
            console.log('[crear-pago-flow] Paso 2b: customer/create en Flow');
            const customer = await flowPost('customer/create', {
                apiKey,
                name:       email,
                email,
                externalId: email,
            }, secret);
            console.log('[crear-pago-flow] customer/create respuesta:', JSON.stringify(customer));

            if (customer.customerId) {
                customerId = customer.customerId;
                console.log('[crear-pago-flow] Cliente creado en Flow:', customerId);
            } else {
                // 2c. Cliente ya existe en Flow — buscarlo por externalId con paginación
                console.log('[crear-pago-flow] Paso 2c: customer/create falló, buscando cliente existente');
                let start      = 0;
                const limit    = 25;
                let encontrado: Record<string, string> | null = null;

                while (!encontrado) {
                    const lista = await flowGet('customer/list', { apiKey, start, limit }, secret);
                    console.log(`[crear-pago-flow] customer/list (start=${start}) total=${lista.total} hasMore=${lista.hasMore} items=${lista.data?.length ?? 0}`);

                    encontrado = lista.data?.find((c: Record<string, string>) => c.externalId === email) ?? null;
                    if (encontrado || !lista.hasMore) break;
                    start += limit;
                }

                if (encontrado?.customerId) {
                    customerId = encontrado.customerId;
                    console.log('[crear-pago-flow] Cliente existente encontrado vía list:', customerId);
                } else {
                    console.log('[crear-pago-flow] ERROR: cliente no encontrado en Flow');
                    return json({ error: 'No se pudo registrar el cliente en Flow.', details: customer }, 400);
                }
            }

            // Guardar customerId en Supabase para futuros intentos
            console.log('[crear-pago-flow] Guardando flow_customer_id en Supabase:', customerId);
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
                    body: JSON.stringify({ flow_customer_id: customerId }),
                }
            );
        }

        // 3. Iniciar registro de tarjeta
        const urlReturn = `${supabaseUrl}/functions/v1/confirmar-registro?plan=${encodeURIComponent(planId)}&email=${encodeURIComponent(email)}`;
        console.log('[crear-pago-flow] Paso 3: customer/register, url_return →', urlReturn);

        const registro = await flowPost('customer/register', {
            apiKey,
            customerId: customerId!,
            url_return: urlReturn,
        }, secret);
        console.log('[crear-pago-flow] customer/register respuesta:', JSON.stringify(registro));

        if (!registro.url || !registro.token) {
            console.log('[crear-pago-flow] ERROR: customer/register no devolvió url/token');
            return json({ error: 'Error al iniciar el registro de tarjeta.', details: registro }, 400);
        }

        const redirectUrl = `${registro.url}?token=${registro.token}`;
        console.log('[crear-pago-flow] Éxito → redirigiendo a Flow:', redirectUrl);
        return json({ url: redirectUrl });

    } catch (error) {
        console.log('[crear-pago-flow] ERROR no capturado:', (error as Error).message);
        return json({ error: (error as Error).message }, 500);
    }
});
