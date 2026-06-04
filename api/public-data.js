const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Método não permitido. Utilize GET.' });
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
        return res.status(500).json({ error: 'Configuração do Supabase ausente.' });
    }

    try {
        const supabase = createClient(supabaseUrl, supabaseAnonKey);
        const { data, error } = await supabase
            .from('chapters')
            .select('id, title, pages_count, release_date, synopsis')
            .order('id', { ascending: true });

        if (error) throw error;

        res.setHeader('Content-Type', 'application/json');
        return res.status(200).json(data);
    } catch (err) {
        console.error('[public-data] Erro ao buscar capítulos:', err);
        return res.status(500).json({ error: 'Falha ao buscar dados públicos.' });
    }
};
