const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        if (req.method !== 'GET') {
            return res.status(405).json({ error: 'Método não permitido. Utilize GET.' });
        }

        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

        if (!supabaseUrl || !supabaseAnonKey) {
            return res.status(500).json({ error: 'Configuração do Supabase ausente no servidor.' });
        }

        // Inicializa o cliente do Supabase impedindo o uso de persistSession (evita uso de localStorage global no servidor)
        const supabase = createClient(supabaseUrl, supabaseAnonKey, {
            auth: {
                persistSession: false
            }
        });

        const { data, error } = await supabase
            .from('chapters')
            .select('id, title, pages_count, release_date, synopsis')
            .order('id', { ascending: true });

        if (error) throw error;

        res.setHeader('Content-Type', 'application/json');
        return res.status(200).json(data);
    } catch (err) {
        console.error('[public-data] Erro ao buscar capítulos:', err);
        return res.status(500).json({ 
            error: err.message || String(err),
            details: err.stack || String(err)
        });
    }
};
