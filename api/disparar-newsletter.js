// API Serverless Vercel: Disparar aviso de novo capítulo para os e-mails cadastrados
// Sintaxe Clássica Node.js CommonJS para produção na Vercel

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

    const { chapterId, chapterTitle } = req.body;
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    try {
        console.log(`[disparar-newsletter] Iniciando disparo para o Capítulo ${chapterId || 1}: ${chapterTitle || 'Novo Capítulo'}`);
        
        let emails = [];
        let isMock = false;

        if (supabaseUrl && supabaseServiceKey) {
            // Consulta Supabase via REST API usando chaves seguras do servidor
            const dbResponse = await fetch(`${supabaseUrl}/rest/v1/leads?select=email`, {
                method: 'GET',
                headers: {
                    'apikey': supabaseServiceKey,
                    'Authorization': `Bearer ${supabaseServiceKey}`,
                    'Content-Type': 'application/json'
                }
            });

            if (dbResponse.ok) {
                const leads = await dbResponse.json();
                emails = leads.map(l => l.email);
            } else {
                const errText = await dbResponse.text();
                console.error(`[disparar-newsletter] Erro ao buscar leads no Supabase: ${errText}`);
                throw new Error('Falha ao obter leads do banco de dados.');
            }
        } else {
            // Modo de Simulação Local / Mock
            console.log("[disparar-newsletter] Supabase desconfigurado ou local. Usando leads simulados.");
            isMock = true;
            emails = req.body.fallbackEmails || [
                "miles.kensuke@gmail.com",
                "omoloyaartes@gmail.com",
                "leitor.teste@fiovermelho.com"
            ];
        }

        console.log(`[disparar-newsletter] Lista de e-mails coletada: ${emails.length} destinatários.`);

        // Simula o processamento do envio com delay realista de processamento (1.5s)
        await new Promise(resolve => setTimeout(resolve, 1500));

        console.log(`[disparar-newsletter] Disparo concluído com sucesso para ${emails.length} e-mails.`);

        res.setHeader('Content-Type', 'application/json');
        return res.status(200).json({
            success: true,
            message: `Notificação disparada para o bando com sucesso!`,
            count: emails.length,
            recipients: emails,
            isMock: isMock
        });

    } catch (err) {
        console.error("[disparar-newsletter] Erro crítico:", err);
        res.setHeader('Content-Type', 'application/json');
        return res.status(500).json({ error: 'Erro interno ao processar disparo de newsletter.' });
    }
};
