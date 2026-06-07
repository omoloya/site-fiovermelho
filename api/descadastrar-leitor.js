const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método não permitido. Utilize POST.' });
    }

    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ error: 'O campo e-mail é obrigatório.' });
    }

    const cleanEmail = email.trim().toLowerCase();

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
        return res.status(500).json({ error: 'Configurações de ambiente do Supabase ausentes no servidor.' });
    }

    try {
        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
            auth: {
                persistSession: false
            }
        });

        // 1. Delete from 'newsletter' table
        const { error: newsError } = await supabaseAdmin
            .from('newsletter')
            .delete()
            .eq('email', cleanEmail);

        if (newsError) {
            console.error('[descadastrar-leitor] Erro ao deletar da tabela newsletter:', newsError);
            throw newsError;
        }

        // 2. Delete from 'leads' table
        const { error: leadsError } = await supabaseAdmin
            .from('leads')
            .delete()
            .eq('email', cleanEmail);

        if (leadsError) {
            console.error('[descadastrar-leitor] Erro ao deletar da tabela leads:', leadsError);
            throw leadsError;
        }

        res.setHeader('Content-Type', 'application/json');
        return res.status(200).json({ success: true, message: 'Descadastro realizado com sucesso das duas tabelas!' });
    } catch (err) {
        console.error('[descadastrar-leitor] Erro:', err);
        return res.status(500).json({ error: 'Erro interno ao realizar descadastro. Tente novamente mais tarde.' });
    }
};
