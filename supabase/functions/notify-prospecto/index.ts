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

  const { nombre, apellido, email, empresa, tipo_cliente, telefono, plan_interes } = await req.json();

  const resendApiKey = Deno.env.get('RESEND_API_KEY');
  if (!resendApiKey) {
    return new Response('RESEND_API_KEY no configurada', { status: 500, headers: corsHeaders });
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'TypeSeba <contact@typeseba.com>',
      to: ['se.bluedesign@gmail.com'],
      subject: `🔥 Nuevo prospecto — ${nombre} ${apellido} (${plan_interes})`,
      text: `Nuevo prospecto registrado en TypeSeba.\n\nNombre: ${nombre} ${apellido}\nEmail: ${email}\nEmpresa: ${empresa}\nTipo de cliente: ${tipo_cliente}\nTeléfono: ${telefono}\nPlan de interés: ${plan_interes}`,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error('Resend error:', err);
    return new Response('Error al enviar email', { status: 500, headers: corsHeaders });
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
