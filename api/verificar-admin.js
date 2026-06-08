const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
    // Configura headers CORS e de segurança
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        if (req.method !== 'POST') {
            return res.status(405).json({ error: 'Método não permitido. Utilize POST.', isAdmin: false });
        }

        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'O cabeçalho Authorization com token Bearer é obrigatório.', isAdmin: false });
        }

        const token = authHeader.split(' ')[1];
        if (!token) {
            return res.status(401).json({ error: 'Token não fornecido no cabeçalho Authorization.', isAdmin: false });
        }

        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

        if (!supabaseUrl || !supabaseAnonKey) {
            return res.status(500).json({ 
                error: 'Variáveis de ambiente do Supabase ausentes no painel da Vercel.', 
                isAdmin: false 
            });
        }

        // Inicializa o cliente do Supabase impedindo o uso de persistSession (evita uso de localStorage global no servidor)
        const supabase = createClient(supabaseUrl, supabaseAnonKey, {
            auth: {
                persistSession: false
            }
        });
        
        // Obtém o usuário associado ao token JWT enviado do frontend via header
        const { data: { user }, error } = await supabase.auth.getUser(token);
        
        if (error || !user || !user.email) {
            return res.status(401).json({ error: 'Token inválido ou expirado.', isAdmin: false });
        }

        const adminString = process.env.ADMIN_EMAILS || "";
        const adminList = adminString.split(",").map(e => e.trim().toLowerCase());
        const userEmail = user.email.trim().toLowerCase();

        const isAdmin = adminList.includes(userEmail);
        
        return res.status(200).json({ isAdmin });
    } catch (err) {
        console.error("[verificar-admin] Erro crítico no Vercel Serverless:", err);
        return res.status(500).json({ 
            error: err.message || String(err),
            details: err.stack || String(err),
            isAdmin: false 
        });
    }
};
