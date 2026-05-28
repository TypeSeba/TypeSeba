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

const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });

Deno.serve(async (req: Request) => {
    if (req.method !== 'POST') return json({ message: 'Método no permitido' }, 405);

    const { email } = await req.json();
    if (!email) return json({ error: 'Email requerido' }, 400);

    const apiKey      = Deno.env.get('FLOW_API_KEY')!;
    const secret      = Deno.env.get('FLOW_SECRET')!;
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // 1. Buscar flow_subscription_id en Supabase
    const queryUrl = `${supabaseUrl}/rest/v1/perfiles?select=flow_subscription_id,plan_activo&email=eq.${encodeURIComponent(email)}&order=created_at.desc&limit=1`;
    const dbRes = await fetch(queryUrl, {
        headers: {
            'apikey':        supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
        },
    });

    if (!dbRes.ok) return json({ error: 'Error consultando la base de datos.' }, 500);

    const rows = await dbRes.json();
    if (!rows.length || !rows[0].flow_subscription_id) {
        return json({ error: 'No encontramos una suscripción activa para ese correo.' }, 404);
    }

    const subscriptionId = rows[0].flow_subscription_id;

    try {
        // 2. Llamar a Flow para cancelar
        //    NOTA: subscription/cancel requiere un subscriptionId de subscription/create.
        //    Con el flujo actual (payment/create), este paso fallará en Flow pero no bloquea
        //    el proceso. Cuando se migre a subscription/create funcionará automáticamente.
        const params   = { apiKey, at_period_end: 1, subscriptionId };
        const s        = await sign(params, secret);
        const formData = new URLSearchParams();
        for (const key in params) formData.append(key, String(params[key as keyof typeof params]));
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

        return json({ success: true });

    } catch (error) {
        return json({ error: 'Error procesando la cancelación.' }, 500);
    }
});
