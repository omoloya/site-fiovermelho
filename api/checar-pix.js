// API Serverless Vercel: Consultar status de pagamento Pix no Mercado Pago de forma segura
module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Método não permitido' });
    }

    const { id } = req.query;
    const token = process.env.MERCADO_PAGO_ACCESS_TOKEN;

    if (!token) {
        return res.status(500).json({ 
            error: 'MERCADO_PAGO_ACCESS_TOKEN não configurado no painel da Vercel.' 
        });
    }

    try {
        // Chamada segura de verificação ao Mercado Pago
        const response = await fetch(`https://api.mercadopago.com/v1/payments/${id}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const data = await response.json();

        if (response.ok) {
            return res.status(200).json({
                status: data.status, // approved, pending, rejected, etc.
                statusDetail: data.status_detail
            });
        } else {
            return res.status(400).json({ 
                error: data.message || 'Erro ao consultar Pix no Mercado Pago.' 
            });
        }
    } catch (err) {
        console.error("Erro interno no Vercel Serverless:", err);
        return res.status(500).json({ error: 'Erro interno ao verificar transação.' });
    }
};
