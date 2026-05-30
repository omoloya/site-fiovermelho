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
            const status = data.status;

            // Se o pagamento estiver aprovado, atualiza o status do perfil no Supabase a partir do servidor
            if (status === 'approved') {
                const supabaseUrl = process.env.SUPABASE_URL;
                // Usamos a Service Role Key para ignorar RLS e garantir a verificação, ou a Anon Key como fallback
                const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

                if (supabaseUrl && supabaseKey) {
                    try {
                        const payerEmail = data.payer && data.payer.email;
                        
                        if (payerEmail) {
                            // Faz a requisição PATCH para a REST API do Supabase de forma nativa e leve
                            const updateResponse = await fetch(`${supabaseUrl}/rest/v1/profiles?email=eq.${encodeURIComponent(payerEmail)}`, {
                                method: 'PATCH',
                                headers: {
                                    'apikey': supabaseKey,
                                    'Authorization': `Bearer ${supabaseKey}`,
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify({ status: 'verificado' })
                            });

                            if (updateResponse.ok) {
                                console.log(`[checar-pix] Perfil de ${payerEmail} atualizado para 'verificado' via REST API.`);
                            } else {
                                const errBody = await updateResponse.text();
                                console.error(`[checar-pix] Falha ao atualizar perfil. Status: ${updateResponse.status}, Resposta: ${errBody}`);
                            }
                        }
                    } catch (dbErr) {
                        console.error("[checar-pix] Erro ao conectar/atualizar no Supabase:", dbErr);
                    }
                }
            }

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
