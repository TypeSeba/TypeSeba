import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

serve(async (req: Request) => {
  console.log('[notify-contact] Función invocada. Método:', req.method);

  let payload: unknown;
  try {
    payload = await req.json();
    console.log('[notify-contact] Payload recibido:', JSON.stringify(payload));
  } catch (parseErr) {
    console.error('[notify-contact] Error al parsear el body JSON:', parseErr);
    return new Response('Body inválido', { status: 400 });
  }

  // Supabase Database Webhooks send the new row under payload.record
  const record = (payload as Record<string, unknown>)?.record as Record<string, unknown> ?? {};
  const { nombre, email, tipo_proyecto, presupuesto, mensaje } = record;
  console.log('[notify-contact] Campos extraídos — nombre:', nombre, '| email:', email, '| tipo_proyecto:', tipo_proyecto, '| presupuesto:', presupuesto);

  const resendApiKey = Deno.env.get('RESEND_API_KEY');
  if (!resendApiKey) {
    console.error('[notify-contact] RESEND_API_KEY no está configurada en las variables de entorno de esta función.');
    return new Response('RESEND_API_KEY no configurada', { status: 500 });
  }
  console.log('[notify-contact] RESEND_API_KEY presente. Procediendo al fetch...');

  const emailBody = {
    from: 'contact@typeseba.com',
    to: ['se.bluedesign@gmail.com'],
    subject: 'Nueva consulta desde TypeSeba',
    text: `Nombre: ${nombre}\nEmail: ${email}\nTipo de proyecto: ${tipo_proyecto ?? 'No especificado'}\nPresupuesto: ${presupuesto ?? 'No especificado'}\nMensaje: ${mensaje}`,
  };
  console.log('[notify-contact] Payload a Resend (sin API key):', JSON.stringify(emailBody));

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailBody),
    });

    const resBody = await res.text();
    console.log('[notify-contact] Resend status:', res.status, '| body:', resBody);

    if (!res.ok) {
      console.error('[notify-contact] Resend rechazó el email. Status:', res.status, '| body:', resBody);
      return new Response('Error al enviar email', { status: 500 });
    }

    console.log('[notify-contact] Email enviado correctamente.');
    return new Response('OK', { status: 200 });

  } catch (fetchErr) {
    console.error('[notify-contact] Excepción al hacer fetch a Resend:', fetchErr);
    return new Response('Error de red al contactar Resend', { status: 500 });
  }
});
