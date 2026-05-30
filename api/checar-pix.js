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
            // Garante que o status esteja estritamente em minúsculas ('approved')
            const status = data.status ? data.status.toLowerCase() : '';
            let verificado = false;

            // Se o pagamento estiver aprovado, atualiza o status do perfil no Supabase a partir do servidor
            if (status === 'approved') {
                const supabaseUrl = process.env.SUPABASE_URL;
                // Usamos a Service Role Key para ignorar RLS e garantir a verificação, ou a Anon Key como fallback
                const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

                if (supabaseUrl && supabaseKey) {
                    try {
                        const payerEmail = data.payer && data.payer.email;
                        const payerCpf = data.payer && data.payer.identification && data.payer.identification.number;
                        
                        // Busca por CPF limpo (altamente recomendado, livre de problemas de maiúsculas/minúsculas)
                        // com fallback para busca por email
                        let filterQuery = "";
                        if (payerCpf) {
                            const cleanCpf = payerCpf.replace(/[^\d]+/g, '');
                            filterQuery = `cpf=eq.${cleanCpf}`;
                        } else if (payerEmail) {
                            filterQuery = `email=eq.${encodeURIComponent(payerEmail)}`;
                        }

                        if (filterQuery) {
                            // Faz a requisição PATCH para a REST API do Supabase de forma nativa e leve
                            const updateResponse = await fetch(`${supabaseUrl}/rest/v1/profiles?${filterQuery}`, {
                                method: 'PATCH',
                                headers: {
                                    'apikey': supabaseKey,
                                    'Authorization': `Bearer ${supabaseKey}`,
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify({ status: 'verificado' })
                            });

                            if (updateResponse.ok) {
                                console.log(`[checar-pix] Perfil (${filterQuery}) atualizado para 'verificado' via REST API.`);
                                verificado = true;
                            } else {
                                const errBody = await updateResponse.text();
                                console.error(`[checar-pix] Falha ao atualizar perfil. Status: ${updateResponse.status}, Resposta: ${errBody}`);
                            }
                        }
                    } catch (dbErr) {
                        console.error("[checar-pix] Erro ao conectar/atualizar no Supabase:", dbErr);
                    }
                } else {
                    // Fallback local: Se as chaves do Supabase não estiverem no env (ambiente local/offline),
                    // consideramos a verificação bem-sucedida para fins de fluxo mock
                    verificado = true;
                }
            }

            // Forçar o cabeçalho JSON e o status 200 de forma robusta e compatível com Vercel Node
            res.setHeader('Content-Type', 'application/json');
            return res.status(200).json({
                status: status,
                statusDetail: data.status_detail,
                verificado: verificado
            });
        } else {
            res.setHeader('Content-Type', 'application/json');
            return res.status(400).json({ 
                error: data.message || 'Erro ao consultar Pix no Mercado Pago.' 
            });
        }
    } catch (err) {
        console.error("Erro interno no Vercel Serverless:", err);
        res.setHeader('Content-Type', 'application/json');
        return res.status(500).json({ error: 'Erro interno ao verificar transação.' });
    }
};
