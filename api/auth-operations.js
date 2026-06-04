const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método não permitido. Utilize POST.' });
    }

    const { action, email, cpf, amount } = req.body;

    if (!action) {
        return res.status(400).json({ error: 'Ação não especificada.' });
    }

    console.log(`[auth-operations] Executando ação: ${action}`);

    if (action === 'criar-pix') {
        const token = process.env.MERCADO_PAGO_ACCESS_TOKEN;
        if (!token) {
            return res.status(500).json({ error: 'MERCADO_PAGO_ACCESS_TOKEN não configurado no painel da Vercel.' });
        }
        if (!email || !cpf) {
            return res.status(400).json({ error: 'Os campos email e cpf são obrigatórios.' });
        }

        try {
            const cleanCpf = cpf.replace(/[^\d]+/g, '');
            const chargeAmount = amount ? Math.max(1.00, parseFloat(amount)) : 1.50;
            const descriptionText = amount ? "Apoio / Doação ao Autor - Fio Vermelho" : "Validação de Maioridade (ECA) - Fio Vermelho";

            const response = await fetch('https://api.mercadopago.com/v1/payments', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'X-Idempotency-Key': 'key_' + Math.random().toString(36).substring(2, 15)
                },
                body: JSON.stringify({
                    transaction_amount: chargeAmount, 
                    description: descriptionText,
                    payment_method_id: "pix",
                    payer: {
                        email: email,
                        identification: {
                            type: "CPF",
                            number: cleanCpf
                        }
                    }
                })
            });

            const data = await response.json();

            if (response.ok) {
                res.setHeader('Content-Type', 'application/json');
                return res.status(200).json({
                    transactionId: data.id.toString(),
                    qrCodeUrl: data.point_of_interaction.transaction_data.qr_code_base64,
                    copyPasteCode: data.point_of_interaction.transaction_data.qr_code
                });
            } else {
                res.setHeader('Content-Type', 'application/json');
                return res.status(400).json({ error: data.message || 'Erro ao gerar Pix no Mercado Pago.' });
            }
        } catch (err) {
            console.error('[auth-operations] Erro crítico no Mercado Pago:', err);
            return res.status(500).json({ error: 'Erro interno ao gerar transação Pix.' });
        }
    }

    return res.status(400).json({ error: `Ação não suportada: ${action}` });
};
