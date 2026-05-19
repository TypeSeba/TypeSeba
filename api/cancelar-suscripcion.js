import crypto from 'crypto';

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ message: 'Método no permitido' });

    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email requerido' });

    const apiKey      = process.env.FLOW_API_KEY;
    const secret      = process.env.FLOW_SECRET;
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

    // 1. Buscar flow_subscription_id en Supabase
    const queryUrl = `${supabaseUrl}/rest/v1/perfiles?select=flow_subscription_id,plan_activo&email=eq.${encodeURIComponent(email)}&order=created_at.desc&limit=1`;
    const dbRes = await fetch(queryUrl, {
        headers: {
            'apikey':        supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
        },
    });

    if (!dbRes.ok) return res.status(500).json({ error: 'Error consultando la base de datos.' });

    const rows = await dbRes.json();
    if (!rows.length || !rows[0].flow_subscription_id) {
        return res.status(404).json({ error: 'No encontramos una suscripción activa para ese correo.' });
    }

    const subscriptionId = rows[0].flow_subscription_id;

    try {
        // 2. Llamar a Flow para cancelar
        //    NOTA: subscription/cancel requiere un subscriptionId de subscription/create.
        //    Con el flujo actual (payment/create), este paso fallará en Flow pero no bloquea
        //    el proceso. Cuando se migre a subscription/create funcionará automáticamente.
        const params = { apiKey, at_period_end: 1, subscriptionId };
        const keys   = Object.keys(params).sort();
        const toSign = keys.map(k => `${k}${params[k]}`).join('');
        const s      = crypto.createHmac('sha256', secret).update(toSign).digest('hex');

        const formData = new URLSearchParams();
        for (const key in params) formData.append(key, params[key]);
        formData.append('s', s);

        await fetch('https://sandbox.flow.cl/api/subscription/cancel', {
            method: 'POST',
            body: formData,
        }).catch(() => {});

        // 3. Marcar como cancelado en Supabase
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
                body: JSON.stringify({ plan_activo: null }),
            }
        );

        // 4. Enviar correos de confirmación — fire and forget
        fetch(`${supabaseUrl}/functions/v1/solicitar-cancelacion`, {
            method: 'POST',
            headers: {
                'Content-Type':  'application/json',
                'Authorization': `Bearer ${supabaseKey}`,
            },
            body: JSON.stringify({ email }),
        }).catch(() => {});

        return res.status(200).json({ success: true });

    } catch (error) {
        return res.status(500).json({ error: 'Error procesando la cancelación.' });
    }
}
