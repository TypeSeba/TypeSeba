export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ message: 'Método no permitido' });

    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email requerido' });

    const apiKey = process.env.RESEND_API_KEY;

    try {
        // Correo al equipo TypeSeba
        const notifAdmin = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                from: 'TypeSeba <no-reply@typeseba.com>',
                to: ['contact@typeseba.com'],
                subject: `⚠️ Solicitud de cancelación — ${email}`,
                html: `<p>Se ha recibido una solicitud de cancelación de suscripción.</p>
                       <p><strong>Correo del cliente:</strong> ${email}</p>
                       <p>Procesarla dentro de las próximas 3 horas hábiles.</p>`
            })
        });

        if (!notifAdmin.ok) {
            const err = await notifAdmin.json();
            return res.status(500).json({ error: 'Error enviando notificación', details: err });
        }

        // Correo de confirmación al cliente
        const confirmCliente = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                from: 'TypeSeba <contact@typeseba.com>',
                to: [email],
                subject: 'Hemos recibido tu solicitud de cancelación',
                html: `<p>Hola,</p>
                       <p>Hemos recibido tu solicitud de cancelación de suscripción en TypeSeba.</p>
                       <p>Procesaremos tu solicitud en un plazo máximo de <strong>3 horas hábiles</strong>.</p>
                       <p>Tu plan permanecerá activo hasta el fin del período ya pagado.</p>
                       <p>Si tienes alguna duda, responde a este correo o escríbenos a <a href="mailto:contact@typeseba.com">contact@typeseba.com</a>.</p>
                       <br>
                       <p>Equipo TypeSeba</p>`
            })
        });

        if (!confirmCliente.ok) {
            const err = await confirmCliente.json();
            return res.status(500).json({ error: 'Error enviando confirmación al cliente', details: err });
        }

        res.status(200).json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}
