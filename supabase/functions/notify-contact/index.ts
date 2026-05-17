import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

serve(async (req: Request) => {
  const payload = await req.json();

  // Supabase Database Webhooks send the new row under payload.record
  const { nombre, email, mensaje } = payload.record ?? {};

  const resendApiKey = Deno.env.get('RESEND_API_KEY');
  if (!resendApiKey) {
    return new Response('RESEND_API_KEY no configurada', { status: 500 });
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'contact@typeseba.com',
      to: ['contact@typeseba.com'],
      subject: 'Nueva consulta desde TypeSeba',
      text: `Nombre: ${nombre}\nEmail: ${email}\nMensaje: ${mensaje}`,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error('Resend error:', err);
    return new Response('Error al enviar email', { status: 500 });
  }

  return new Response('OK', { status: 200 });
});
