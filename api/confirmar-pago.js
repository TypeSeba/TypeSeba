import crypto from 'crypto';

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end();

    const token = req.body?.token;
    if (!token) return res.status(200).end();

    const apiKey = process.env.FLOW_API_KEY;
    const secret = process.env.FLOW_SECRET;

    // Verificar el pago con Flow — llamar a getStatus ES la verificación de autenticidad.
    // Solo quien tenga las keys puede firmar y obtener un resultado válido.
    const params = { apiKey, token };
    const keys   = Object.keys(params).sort();
    const toSign = keys.map(k => `${k}${params[k]}`).join('');
    const s      = crypto.createHmac('sha256', secret).update(toSign).digest('hex');

    const statusUrl = new URL('https://sandbox.flow.cl/api/payment/getStatus');
    statusUrl.searchParams.set('apiKey', apiKey);
    statusUrl.searchParams.set('token', token);
    statusUrl.searchParams.set('s', s);

    try {
        const flowRes = await fetch(statusUrl.toString());
        if (!flowRes.ok) return res.status(200).end();

        const payment = await flowRes.json();

        // status 2 = pagado confirmado
        if (payment.status !== 2) return res.status(200).end();

        const email     = payment.payer;
        const flowOrder = String(payment.flowOrder);
        const plan      = payment.subject?.replace('Suscripción Plan ', '').trim() ?? 'desconocido';

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
                    plan_activo:          plan,
                    flow_subscription_id: flowOrder,
                    fecha_inicio:         new Date().toISOString(),
                }),
            }
        );
    } catch {
        // nunca devolver 5xx a Flow — reintentaría indefinidamente
    }

    return res.status(200).end();
}
