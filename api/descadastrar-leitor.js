const { createClient } = require('@supabase/supabase-js');

// Sincronizado com a migração de tipo ID para UUID no banco de dados
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidID(val) {
    if (!val) return false;
    return val === 'mock-admin-uuid' || uuidRegex.test(val);
}

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
        return res.status(500).json({ error: 'Configurações de ambiente do Supabase ausentes no servidor.' });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
            persistSession: false
        }
    });

    // 1. GET: Validação do ID e busca do e-mail associado
    if (req.method === 'GET') {
        const id = req.query.id;
        if (!id || !isValidID(id)) {
            return res.status(400).json({ error: 'ID inválido ou ausente.' });
        }

        try {
            // Caso de teste para o administrador
            if (id === 'mock-admin-uuid') {
                return res.status(200).json({ success: true, email: 'miles.kensuke@gmail.com (Ambiente de Teste)', exists: true });
            }

            // Busca na tabela 'newsletter'
            const { data: newsData, error: newsError } = await supabaseAdmin
                .from('newsletter')
                .select('email')
                .eq('id', id)
                .maybeSingle();

            if (newsError) {
                console.error('[descadastrar-leitor] Erro ao buscar ID na tabela newsletter:', newsError);
                throw newsError;
            }

            if (newsData && newsData.email) {
                return res.status(200).json({ success: true, email: newsData.email, exists: true });
            }

            // Busca na tabela 'leads'
            const { data: leadsData, error: leadsError } = await supabaseAdmin
                .from('leads')
                .select('email')
                .eq('id', id)
                .maybeSingle();

            if (leadsError) {
                console.error('[descadastrar-leitor] Erro ao buscar ID na tabela leads:', leadsError);
                throw leadsError;
            }

            if (leadsData && leadsData.email) {
                return res.status(200).json({ success: true, email: leadsData.email, exists: true });
            }

            return res.status(404).json({ error: 'Assinatura não encontrada ou já cancelada.' });
        } catch (err) {
            console.error('[descadastrar-leitor] Erro na verificação do ID:', err);
            return res.status(500).json({ error: 'Erro interno ao validar o ID de cadastro.' });
        }
    }

    // 2. POST: Exclusão lógica/física usando o ID do Supabase
    if (req.method === 'POST') {
        const { id } = req.body;

        if (!id || !isValidID(id)) {
            return res.status(400).json({ error: 'ID inválido ou ausente.' });
        }

        try {
            // Caso de teste para o administrador
            if (id === 'mock-admin-uuid') {
                return res.status(200).json({ success: true, message: 'Descadastro de teste concluído com sucesso!' });
            }

            let emailToDelete = null;

            // Busca na tabela 'newsletter' pelo ID para achar o e-mail correspondente
            const { data: newsData, error: newsSearchError } = await supabaseAdmin
                .from('newsletter')
                .select('email')
                .eq('id', id)
                .maybeSingle();

            if (newsSearchError) {
                console.error('[descadastrar-leitor] Erro ao buscar ID na newsletter:', newsSearchError);
                throw newsSearchError;
            }

            if (newsData && newsData.email) {
                emailToDelete = newsData.email;
            } else {
                // Se não achar na newsletter, busca na tabela 'leads' pelo ID para achar o e-mail correspondente
                const { data: leadsData, error: leadsSearchError } = await supabaseAdmin
                    .from('leads')
                    .select('email')
                    .eq('id', id)
                    .maybeSingle();

                if (leadsSearchError) {
                    console.error('[descadastrar-leitor] Erro ao buscar ID em leads:', leadsSearchError);
                    throw leadsSearchError;
                }

                if (leadsData && leadsData.email) {
                    emailToDelete = leadsData.email;
                }
            }

            if (!emailToDelete) {
                return res.status(404).json({ error: 'Inscrição não encontrada ou já cancelada.' });
            }

            const cleanEmail = emailToDelete.trim().toLowerCase();

            // Ação 1: Deleta da newsletter pelo ID correspondente
            const { error: newsDeleteError } = await supabaseAdmin
                .from('newsletter')
                .delete()
                .eq('id', id);

            if (newsDeleteError) {
                console.error('[descadastrar-leitor] Erro ao deletar da newsletter por ID:', newsDeleteError);
                throw newsDeleteError;
            }

            // Ação 2: Deleta da tabela 'leads' pelo e-mail resolvido (vínculo de e-mail)
            const { error: leadsDeleteError } = await supabaseAdmin
                .from('leads')
                .delete()
                .eq('email', cleanEmail);

            if (leadsDeleteError) {
                console.error('[descadastrar-leitor] Erro ao deletar de leads por e-mail:', leadsDeleteError);
                throw leadsDeleteError;
            }

            // Limpeza complementar opcional: Garante remoção total do e-mail da tabela de newsletter também
            await supabaseAdmin
                .from('newsletter')
                .delete()
                .eq('email', cleanEmail);

            res.setHeader('Content-Type', 'application/json');
            return res.status(200).json({ success: true, message: 'Descadastro realizado com sucesso das duas tabelas!' });
        } catch (err) {
            console.error('[descadastrar-leitor] Erro ao realizar descadastro:', err);
            return res.status(500).json({ error: 'Erro interno ao realizar descadastro. Tente novamente mais tarde.' });
        }
    }

    return res.status(405).json({ error: 'Método não permitido.' });
};
