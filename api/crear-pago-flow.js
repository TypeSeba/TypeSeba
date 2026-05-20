import crypto from 'crypto';

function sign(params, secret) {
    const keys = Object.keys(params).sort();
    const str  = keys.map(k => `${k}${params[k]}`).join('');
    return crypto.createHmac('sha256', secret).update(str).digest('hex');
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

async function flowGet(endpoint, params, secret) {
    const s   = sign(params, secret);
    const url = new URL(`https://sandbox.flow.cl/api/${endpoint}`);
    for (const key in params) url.searchParams.set(key, params[key]);
    url.searchParams.set('s', s);
    const res = await fetch(url.toString());
    return res.json();
}

const PLANES = {
    'growth-content':   { amount: 900000,  nombre: 'TypeSeba Growth Content' },
    'product-designer': { amount: 1700000, nombre: 'TypeSeba Product Designer' },
    'tech-partner':     { amount: 2700000, nombre: 'TypeSeba Tech Partner' },
};

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ message: 'Método no permitido' });

    const { planId, email, nombre } = req.body;
    console.log('[crear-pago-flow] Inicio →', { planId, email, nombre: nombre ?? '(sin nombre)' });

    if (!planId || !email) return res.status(400).json({ error: 'planId y email son requeridos' });

    const plan = PLANES[planId];
    if (!plan) return res.status(400).json({ error: 'Plan no válido' });

    const apiKey      = process.env.FLOW_API_KEY;
    const secret      = process.env.FLOW_SECRET;
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

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
            urlCallback: 'https://typeseba.com/api/confirmar-pago',
        }, secret).catch(err => console.log('[crear-pago-flow] plans/create ignorado:', err.message));

        // 2. Obtener o crear cliente en Flow
        let customerId;

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
                // 2c. Cliente ya existe en Flow — buscarlo por externalId
                console.log('[crear-pago-flow] Paso 2c: customer/create falló, buscando cliente existente');
                const lista = await flowGet('customer/list', {
                    apiKey,
                    filter: email,
                    start:  0,
                    limit:  25,
                }, secret);
                console.log('[crear-pago-flow] customer/list respuesta:', JSON.stringify(lista));

                const encontrado = lista.data?.find(c => c.externalId === email);
                if (encontrado?.customerId) {
                    customerId = encontrado.customerId;
                    console.log('[crear-pago-flow] Cliente existente encontrado vía list:', customerId);
                } else {
                    console.log('[crear-pago-flow] ERROR: cliente no encontrado en Flow');
                    return res.status(400).json({
                        error:   'No se pudo registrar el cliente en Flow.',
                        details: customer,
                    });
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
        const urlReturn = `https://typeseba.com/api/confirmar-registro?plan=${encodeURIComponent(planId)}&email=${encodeURIComponent(email)}`;
        console.log('[crear-pago-flow] Paso 3: customer/register, url_return →', urlReturn);

        const registro = await flowPost('customer/register', {
            apiKey,
            customerId,
            url_return: urlReturn,
        }, secret);
        console.log('[crear-pago-flow] customer/register respuesta:', JSON.stringify(registro));

        if (!registro.url || !registro.token) {
            console.log('[crear-pago-flow] ERROR: customer/register no devolvió url/token');
            return res.status(400).json({
                error:   'Error al iniciar el registro de tarjeta.',
                details: registro,
            });
        }

        const redirectUrl = `${registro.url}?token=${registro.token}`;
        console.log('[crear-pago-flow] Éxito → redirigiendo a Flow:', redirectUrl);
        return res.status(200).json({ url: redirectUrl });

    } catch (error) {
        console.log('[crear-pago-flow] ERROR no capturado:', error.message);
        return res.status(500).json({ error: error.message });
    }
}
