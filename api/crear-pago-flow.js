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

const PLANES = {
    'growth-content':   { amount: 900000,  nombre: 'TypeSeba Growth Content' },
    'product-designer': { amount: 1700000, nombre: 'TypeSeba Product Designer' },
    'tech-partner':     { amount: 2700000, nombre: 'TypeSeba Tech Partner' },
};

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ message: 'Método no permitido' });

    const { planId, email, nombre } = req.body;
    if (!planId || !email) return res.status(400).json({ error: 'planId y email son requeridos' });

    const plan = PLANES[planId];
    if (!plan) return res.status(400).json({ error: 'Plan no válido' });

    const apiKey      = process.env.FLOW_API_KEY;
    const secret      = process.env.FLOW_SECRET;
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

    try {
        // 1. Crear plan en Flow (ignorar si ya existe)
        await flowPost('plans/create', {
            apiKey,
            planId:      `typeseba-${planId}`,
            name:        plan.nombre,
            amount:      plan.amount,
            currency:    'CLP',
            interval:    3,   // mensual
            urlCallback: 'https://typeseba.com/api/confirmar-pago',
        }, secret).catch(() => {});

        // 2. Obtener o crear cliente en Flow
        let customerId;

        // Reutilizar si ya existe en Supabase (evita duplicados en Flow)
        const dbRes = await fetch(
            `${supabaseUrl}/rest/v1/perfiles?select=flow_customer_id&email=eq.${encodeURIComponent(email)}&order=created_at.desc&limit=1`,
            { headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` } }
        );
        const rows = await dbRes.json();

        if (rows[0]?.flow_customer_id) {
            customerId = rows[0].flow_customer_id;
        } else {
            const customer = await flowPost('customer/create', {
                apiKey,
                name:       nombre ?? email,
                email,
                externalId: email,
            }, secret);

            if (!customer.customerId) {
                return res.status(400).json({
                    error:   'No se pudo registrar el cliente en Flow.',
                    details: customer,
                });
            }
            customerId = customer.customerId;

            // Guardar para no crear duplicados en el futuro
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

        // 3. Iniciar registro de tarjeta — redirige al usuario al formulario de Flow
        const urlReturn = `https://typeseba.com/api/confirmar-registro?plan=${encodeURIComponent(planId)}&email=${encodeURIComponent(email)}`;

        const registro = await flowPost('customer/register', {
            apiKey,
            customerId,
            url_return: urlReturn,
        }, secret);

        if (!registro.url || !registro.token) {
            return res.status(400).json({
                error:   'Error al iniciar el registro de tarjeta.',
                details: registro,
            });
        }

        return res.status(200).json({ url: `${registro.url}?token=${registro.token}` });

    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
