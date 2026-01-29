const { onCall, HttpsError } = require("firebase-functions/v2/https");
const axios = require("axios");
const crypto = require("crypto-js");

// TUS LLAVES DE FLOW (Cámbialas por las tuyas reales)
const API_KEY = "3A2F5167-A59C-4EE7-89B2-1L063D20C63B";
const SECRET_KEY = "c4307378f733bc34ec1217d13253db765fedea68";
const FLOW_URL = "https://sandbox.flow.cl/api"; // Usa https://sandbox.flow.cl/api para pruebas

exports.crearSuscripcion = onCall({ cors: true }, async (request) => {
    try {
        // Extraemos los datos que vienen del frontend
        const { planId, email, nombre } = request.data;

        if (!planId || !email) {
            throw new HttpsError("invalid-argument", "Faltan datos obligatorios.");
        }

        // 1. Parámetros para Flow
        const params = {
            apiKey: API_KEY,
            email: email,
            externalId: "user_" + Date.now(),
            name: nombre || "Cliente Nuevo",
            planId: planId
        };

        // 2. Crear la Firma Digital
        const keys = Object.keys(params).sort();
        let toSign = "";
        keys.forEach(key => {
            toSign += key + params[key];
        });

        const signature = crypto.HmacSHA256(toSign, SECRET_KEY).toString();
        const finalParams = { ...params, s: signature };

        // 3. Llamada a Flow
        const response = await axios.post(`${FLOW_URL}/subscription/create`, null, {
            params: finalParams
        });

        return {
            success: true,
            url: response.data.url,
            token: response.data.token
        };

    } catch (error) {
        console.error("Error en la función:", error);
        return {
            success: false,
            error: error.message || "Error interno del servidor"
        };
    }
});