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
        
        const { error } = await supabaseAdmin
            .from('newsletter')
            .insert([{ email: email }]);

        if (error) {
            if (error.code === '23505') {
                return res.status(409).json({ error: 'Este e-mail já está cadastrado na nossa lista!' });
            }
            throw error;
        }

        res.setHeader('Content-Type', 'application/json');
        return res.status(200).json({ success: true, message: 'Inscrição realizada com sucesso!' });
    } catch (err) {
        console.error('[newsletter] Erro:', err);
        return res.status(500).json({ error: 'Erro interno ao realizar inscrição na newsletter.' });
    }
};
