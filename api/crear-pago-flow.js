// Este código corre en el servidor de Vercel, nadie puede ver tus llaves aquí.
export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).send('Método no permitido');

    const { planId, email, userId } = req.body;

    // Aquí es donde usaremos tus llaves de Flow
    const FLOW_API_KEY = process.env.FLOW_API_KEY;
    const FLOW_SECRET = process.env.FLOW_SECRET;

    // Nota: Por ahora, este robot solo confirma que recibió los datos.
    // En el siguiente paso le enseñaremos a crear el link de Flow real.
    console.log("Generando pago para:", email, "Plan:", planId);

    res.status(200).json({
        url: "https://www.flow.cl/ejemplo-pago-automatico", // Aquí irá el link real
        mensaje: "Conexión exitosa con el servidor"
    });
}