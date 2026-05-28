async function sign(params: Record<string, string>, secret: string): Promise<string> {
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

Deno.serve(async (req: Request) => {
    if (req.method !== 'POST') return new Response(null, { status: 405 });

    // Flow envía el token como form-urlencoded o JSON
    let token: string | null = null;
    try {
        const contentType = req.headers.get('content-type') ?? '';
        if (contentType.includes('application/x-www-form-urlencoded')) {
            const form = await req.formData();
            token = form.get('token') as string | null;
        } else {
            const body = await req.json();
            token = body?.token ?? null;
        }
    } catch { /* ignorar */ }

    if (!token) return new Response(null, { status: 200 });

    const apiKey = Deno.env.get('FLOW_API_KEY')!;
    const secret = Deno.env.get('FLOW_SECRET')!;

    // Verificar el pago con Flow — llamar a getStatus ES la verificación de autenticidad.
    // Solo quien tenga las keys puede firmar y obtener un resultado válido.
    const s         = await sign({ apiKey, token }, secret);
    const statusUrl = new URL('https://sandbox.flow.cl/api/payment/getStatus');
    statusUrl.searchParams.set('apiKey', apiKey);
    statusUrl.searchParams.set('token', token);
    statusUrl.searchParams.set('s', s);

    try {
        const flowRes = await fetch(statusUrl.toString());
        if (!flowRes.ok) return new Response(null, { status: 200 });

        const payment = await flowRes.json();
        console.log('[confirmar-pago] payment/getStatus →', JSON.stringify(payment));

        // status 2 = pagado confirmado
        if (payment.status !== 2) return new Response(null, { status: 200 });

        const email          = payment.payer;
        const subscriptionId = payment.subscriptionId;
        const plan           = payment.subject?.replace('Suscripción Plan ', '').trim() ?? 'desconocido';

        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

        const patch: Record<string, string> = {
            plan_activo:  plan,
            fecha_inicio: new Date().toISOString(),
        };

        // Solo sobreescribir flow_subscription_id si Flow devuelve uno válido
        if (subscriptionId) patch.flow_subscription_id = subscriptionId;

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
                body: JSON.stringify(patch),
            }
        );
    } catch (err) {
        console.error('[confirmar-pago] ERROR:', err);
    }

    return new Response(null, { status: 200 });
});
