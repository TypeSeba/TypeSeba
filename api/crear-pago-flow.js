import crypto from 'crypto';

export default async function handler(req, res) {
    // Nota: Solo permitimos peticiones POST (seguridad)
    if (req.method !== 'POST') return res.status(405).json({ message: 'Método no permitido' });

    const { planId, email, userId } = req.body;

    const apiKey = process.env.FLOW_API_KEY;
    const secret = process.env.FLOW_SECRET;

    // Nota: Ajustamos los montos según el plan
    let amount = 750000; // Valor por defecto
    if (planId === 'TU_PLAN_ID_1.5M') amount = 1500000;
    if (planId === 'TU_PLAN_ID_2.5M') amount = 2500000;

    const params = {
        apiKey: apiKey,
        subject: `Suscripción Plan ${planId}`,
        currency: 'CLP',
        amount: amount,
        email: email,
        commerceOrder: `order_${userId.substring(0, 8)}_${Date.now()}`,
        urlReturn: 'https://tu-web.vercel.app/gracias.html',
        urlConfirmation: 'https://tu-web.vercel.app/api/confirmar-pago'
    };

    // Firmar la petición (Seguridad de Flow)
    const keys = Object.keys(params).sort();
    let toSign = keys.map(k => `${k}${params[k]}`).join('');
    const signature = crypto.createHmac('sha256', secret).update(toSign).digest('hex');

    try {
        const formData = new URLSearchParams();
        for (const key in params) formData.append(key, params[key]);
        formData.append('s', signature);

        const response = await fetch('https://www.flow.cl/api/payment/create', {
            method: 'POST',
            body: formData
        });

        const result = await response.json();

        if (result.url && result.token) {
            res.status(200).json({ url: `${result.url}?token=${result.token}` });
        } else {
            res.status(400).json({ error: 'Error de Flow', details: result });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}