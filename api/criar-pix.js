// API Serverless Vercel: Gerar cobrança Pix dinâmica no Mercado Pago de forma segura
module.exports = async (req, res) => {
    // Configura headers CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método não permitido' });
    }

    const { email, cpf } = req.body;
    const token = process.env.MERCADO_PAGO_ACCESS_TOKEN;

    // Se o token de produção não estiver configurado na Vercel
    if (!token) {
        return res.status(500).json({ 
            error: 'MERCADO_PAGO_ACCESS_TOKEN não configurado no painel da Vercel.' 
        });
    }

    try {
        const cleanCpf = cpf.replace(/[^\d]+/g, '');
        
        // Chamada oficial à API do Mercado Pago (Segura - Lado do Servidor)
        const response = await fetch('https://api.mercadopago.com/v1/payments', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'X-Idempotency-Key': 'key_' + Math.random().toString(36).substring(2, 15)
            },
            body: JSON.stringify({
                transaction_amount: 0.10, // Pix simbólico de 10 centavos para KYC de maioridade
                description: "Validação de Maioridade (ECA) - Fio Vermelho",
                payment_method_id: "pix",
                payer: {
                    email: email || "leitor@fiovermelho.com",
                    identification: {
                        type: "CPF",
                        number: cleanCpf
                    }
                }
            })
        });

        const data = await response.json();

        if (response.ok) {
            // Retorna os dados do Pix dinâmico gerado pelo Mercado Pago
            return res.status(200).json({
                transactionId: data.id.toString(),
                qrCodeUrl: data.point_of_interaction.transaction_data.qr_code_base64,
                copyPasteCode: data.point_of_interaction.transaction_data.qr_code
            });
        } else {
            console.error("Erro API Mercado Pago:", data);
            return res.status(400).json({ 
                error: data.message || 'Erro ao gerar Pix no Mercado Pago.' 
            });
        }
    } catch (err) {
        console.error("Erro interno no Vercel Serverless:", err);
        return res.status(500).json({ error: 'Erro interno ao gerar transação Pix.' });
    }
};
