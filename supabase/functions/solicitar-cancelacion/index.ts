import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response('Método no permitido', { status: 405, headers: corsHeaders });
  }

  const { email } = await req.json();
  if (!email) {
    return new Response('Email requerido', { status: 400, headers: corsHeaders });
  }

  const resendApiKey = Deno.env.get('RESEND_API_KEY');
  if (!resendApiKey) {
    return new Response('RESEND_API_KEY no configurada', { status: 500, headers: corsHeaders });
  }

  // Notificación al equipo TypeSeba
  const notifAdmin = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'TypeSeba <no-reply@typeseba.com>',
      to: ['contact@typeseba.com'],
      subject: `⚠️ Solicitud de cancelación — ${email}`,
      text: `Se ha recibido una solicitud de cancelación.\n\nCorreo del cliente: ${email}\n\nProcesarla dentro de las próximas 3 horas hábiles.`,
    }),
  });

  if (!notifAdmin.ok) {
    const err = await notifAdmin.text();
    console.error('Resend error (admin):', err);
    return new Response('Error enviando notificación', { status: 500, headers: corsHeaders });
  }

  // Confirmación al cliente
  const confirmCliente = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'TypeSeba <contact@typeseba.com>',
      to: [email],
      subject: 'Hemos recibido tu solicitud de cancelación',
      text: `Hola,\n\nHemos recibido tu solicitud de cancelación de suscripción en TypeSeba.\n\nProcesaremos tu solicitud en un plazo máximo de 3 horas hábiles.\nTu plan permanecerá activo hasta el fin del período ya pagado.\n\nSi tienes alguna duda, escríbenos a contact@typeseba.com.\n\nEquipo TypeSeba`,
    }),
  });

  if (!confirmCliente.ok) {
    const err = await confirmCliente.text();
    console.error('Resend error (cliente):', err);
    return new Response('Error enviando confirmación al cliente', { status: 500, headers: corsHeaders });
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
