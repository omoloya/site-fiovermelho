// API Serverless Vercel: Gerar cobrança Pix dinâmica no Mercado Pago de forma segura
// Sintaxe Clássica Node.js CommonJS para produção na Vercel

const CHAPTER_PRICE = 1.50; // Preço oficial por capítulo para validação

module.exports = async (req, res) => {
    // Configura headers CORS e de segurança
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método não permitido. Utilize POST.' });
    }

    const { email, cpf, amount } = req.body;
    const token = process.env.MERCADO_PAGO_ACCESS_TOKEN;

    if (!email || !cpf) {
        return res.status(400).json({ error: 'Os campos email e cpf são obrigatórios.' });
    }

    // Se o token de produção não estiver configurado na Vercel
    if (!token) {
        return res.status(500).json({ 
            error: 'MERCADO_PAGO_ACCESS_TOKEN não configurado no painel da Vercel.' 
        });
    }

    try {
        const cleanCpf = cpf.replace(/[^\d]+/g, '');
        console.log(`[criar-pix] Gerando cobrança Pix para o e-mail: ${email}`);
        
        const chargeAmount = amount ? Math.max(1.00, parseFloat(amount)) : CHAPTER_PRICE;
        const descriptionText = amount ? "Apoio / Doação ao Autor - Fio Vermelho" : "Validação de Maioridade (ECA) - Fio Vermelho";

        // Chamada oficial à API do Mercado Pago (Segura - Lado do Servidor)
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
            console.log(`[criar-pix] Cobrança Pix gerada com sucesso. ID Transação: ${data.id}`);
            // Retorna os dados do Pix dinâmico gerado pelo Mercado Pago de forma clássica Node.js
            res.setHeader('Content-Type', 'application/json');
            return res.status(200).json({
                transactionId: data.id.toString(),
                qrCodeUrl: data.point_of_interaction.transaction_data.qr_code_base64,
                copyPasteCode: data.point_of_interaction.transaction_data.qr_code
            });
        } else {
            console.error("[criar-pix] Erro retornado pela API do Mercado Pago:", data);
            res.setHeader('Content-Type', 'application/json');
            return res.status(400).json({ 
                error: data.message || 'Erro ao gerar Pix no Mercado Pago.' 
            });
        }
    } catch (err) {
        console.error("[criar-pix] Erro interno crítico no Vercel Serverless:", err);
        res.setHeader('Content-Type', 'application/json');
        return res.status(500).json({ error: 'Erro interno ao gerar transação Pix.' });
    }
};
