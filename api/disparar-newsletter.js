const { createClient } = require('@supabase/supabase-js');
const { Resend } = require('resend');

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
            return res.status(405).json({ error: 'Método não permitido. Utilize POST.' });
        }

        // 1. Autenticação e Autorização do Administrador
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'O cabeçalho Authorization com token Bearer é obrigatório.' });
        }

        const token = authHeader.split(' ')[1];
        if (!token) {
            return res.status(401).json({ error: 'Token não fornecido no cabeçalho Authorization.' });
        }

        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!supabaseUrl || !supabaseServiceKey) {
            return res.status(500).json({ error: 'Variáveis de ambiente do Supabase ausentes no servidor.' });
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey, {
            auth: {
                persistSession: false
            }
        });

        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user || !user.email) {
            return res.status(401).json({ error: 'Token inválido ou expirado.' });
        }

        const adminString = process.env.ADMIN_EMAILS || "";
        const adminList = adminString.split(",").map(e => e.trim().toLowerCase());
        const userEmail = user.email.trim().toLowerCase();

        if (!adminList.includes(userEmail)) {
            return res.status(403).json({ error: 'Acesso negado. Usuário não possui permissões administrativas.' });
        }

        // 2. Extrai e valida os campos da newsletter
        const { message, artUrl, chapterUrl } = req.body;
        if (!message || !artUrl || !chapterUrl) {
            return res.status(400).json({ error: 'Todos os campos (message, artUrl, chapterUrl) são obrigatórios.' });
        }

        // 3. Busca todos os e-mails registrados no banco de dados
        let emails = [];
        let isMock = false;

        try {
            // Busca destinatários da tabela newsletter
            const { data: newsData, error: newsErr } = await supabase
                .from('newsletter')
                .select('email');
            
            if (!newsErr && newsData) {
                newsData.forEach(item => {
                    if (item.email) emails.push(item.email.trim().toLowerCase());
                });
            }

            // Busca destinatários da tabela leads
            const { data: leadsData, error: leadsErr } = await supabase
                .from('leads')
                .select('email');
            
            if (!leadsErr && leadsData) {
                leadsData.forEach(item => {
                    if (item.email) emails.push(item.email.trim().toLowerCase());
                });
            }

            // Remove e-mails duplicados
            emails = [...new Set(emails)];
        } catch (dbErr) {
            console.warn("[disparar-newsletter] Falha ao ler do Supabase. Usando fallback de teste:", dbErr.message);
            isMock = true;
            emails = [
                "miles.kensuke@gmail.com",
                "omoloyaartes@gmail.com",
                "leitor.teste@fiovermelho.com"
            ];
        }

        if (emails.length === 0) {
            isMock = true;
            emails = [
                "miles.kensuke@gmail.com",
                "omoloyaartes@gmail.com",
                "leitor.teste@fiovermelho.com"
            ];
        }

        // 4. Monta o template HTML em modo escuro
        const formattedMessage = message.replace(/\n/g, '<br>');
        const emailHtml = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Mimo Exclusivo - Fio Vermelho</title>
</head>
<body style="background-color: #000000; color: #ffffff; font-family: 'Plus Jakarta Sans', Arial, sans-serif; margin: 0; padding: 40px 20px; text-align: center;">
    <div style="max-width: 600px; margin: 0 auto; background-color: #0d0d0d; border: 1px solid #222222; border-radius: 12px; padding: 40px 24px; box-sizing: border-box; box-shadow: 0 10px 30px rgba(255, 42, 59, 0.05);">
        
        <!-- Logo -->
        <h1 style="font-size: 24px; margin-bottom: 24px; font-weight: 800; letter-spacing: 1px; color: #ffffff;">
            Fio <span style="color: #ff2a3b;">Vermelho</span>
        </h1>
        
        <!-- Mensagem -->
        <div style="color: #cccccc; font-size: 16px; line-height: 1.7; text-align: left; margin-bottom: 32px; white-space: normal;">
            ${formattedMessage}
        </div>
        
        <!-- Arte Exclusiva -->
        <div style="margin: 32px 0; border-radius: 8px; overflow: hidden; background: #000;">
            <img src="${artUrl}" alt="Arte Exclusiva da Semana" style="width: 100%; max-width: 100%; height: auto; display: block; margin: 0 auto;" />
            <div style="background: rgba(255,42,59,0.05); padding: 12px; color: #ff2a3b; font-size: 12px; font-weight: 600; border-top: 1px solid #222;">
                Arte Exclusiva da Semana • Fio Vermelho
            </div>
        </div>
        
        <!-- Botão para o Capítulo -->
        <div style="margin-top: 32px; margin-bottom: 16px;">
            <a href="${chapterUrl}" target="_blank" style="display: inline-block; background-color: #ff2a3b; color: #ffffff; padding: 14px 32px; font-size: 15px; font-weight: bold; text-decoration: none; border-radius: 6px; box-shadow: 0 4px 14px rgba(255, 42, 59, 0.3); transition: background 0.2s ease;">
                🚀 Acessar Capítulo Exclusivo
            </a>
        </div>
        
        <!-- Rodapé -->
        <hr style="border: 0; border-top: 1px solid #222222; margin: 40px 0 20px 0;">
        <p style="color: #666666; font-size: 11px; line-height: 1.5; margin: 0;">
            Você recebeu este mimo exclusivo porque está cadastrado na newsletter oficial do quadrinho Fio Vermelho.<br>
            &copy; 2026 Fio Vermelho. Ilustrado por Miles. Todos os direitos reservados.
        </p>
    </div>
</body>
</html>
        `.trim();

        // 5. Exibe/Loga o HTML gerado no console do servidor para inspeção/validação
        console.log("======================================== HTML GERADO PARA NEWSLETTER ========================================");
        console.log(emailHtml);
        console.log("============================================================================================================");

        // 6. Envio real via Resend (restringido temporariamente para o administrador ativo por segurança)
        const resendApiKey = process.env.RESEND_API_KEY;
        if (!resendApiKey) {
            return res.status(500).json({ error: 'A variável RESEND_API_KEY não está configurada no painel da Vercel.' });
        }

        let resend;
        try {
            resend = new Resend(resendApiKey);
        } catch (initErr) {
            console.error("[disparar-newsletter] Falha ao inicializar o cliente Resend:", initErr);
            return res.status(500).json({
                error: 'Falha ao inicializar o cliente Resend no servidor.',
                details: initErr.message || String(initErr)
            });
        }

        const targetEmail = userEmail; // miles.kensuke@gmail.com
        console.log(`[disparar-newsletter] Envio real via Resend iniciado para ${targetEmail}`);

        let resendData = null;
        try {
            const result = await resend.emails.send({
                from: "Portal Fio Vermelho <newsletter@send.fiovermelho.art>",
                to: targetEmail,
                subject: "🧶 Mimo Exclusivo - Fio Vermelho",
                html: emailHtml,
                text: message
            });

            if (result.error) {
                console.error("[disparar-newsletter] Resend retornou erro na resposta:", result.error);
                return res.status(400).json({
                    error: 'O Resend recusou o disparo do e-mail de teste.',
                    details: result.error.message || JSON.stringify(result.error),
                    rawError: result.error
                });
            }

            resendData = result.data;
        } catch (sendErr) {
            console.error("[disparar-newsletter] Exceção disparada durante resend.emails.send:", sendErr);
            return res.status(500).json({
                error: 'Erro de execução ou conexão ao chamar o serviço Resend.',
                details: sendErr.message || String(sendErr),
                rawError: sendErr
            });
        }

        console.log(`[disparar-newsletter] Envio real concluído com sucesso para ${targetEmail}. Resend ID: ${resendData?.id}`);

        return res.status(200).json({
            success: true,
            message: `Newsletter enviada com sucesso para o administrador logado ${targetEmail}! (Disparo em massa enviaria para ${emails.length} inscritos)`,
            recipientsCount: 1,
            totalSubscribers: emails.length,
            isMock: false,
            htmlPreview: emailHtml,
            resendId: resendData?.id
        });
    } catch (err) {
        console.error("[disparar-newsletter] Erro crítico:", err);
        return res.status(500).json({ 
            error: 'Erro interno ao processar disparo de newsletter.',
            details: err.message || String(err)
        });
    }
};
