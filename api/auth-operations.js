const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método não permitido. Utilize POST.' });
    }

    const { action, email, password, cpf, birthdate, amount } = req.body;

    if (!action) {
        return res.status(400).json({ error: 'Ação não especificada.' });
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
        return res.status(500).json({ error: 'Variáveis de ambiente do Supabase ausentes no servidor.' });
    }

    console.log(`[auth-operations] Executando ação: ${action}`);

    if (action === 'cadastro') {
        if (!email || !password || !cpf || !birthdate) {
            return res.status(400).json({ error: 'Todos os campos são obrigatórios.' });
        }

        // 1. Validação de CPF (Módulo 11)
        const cleanCpf = cpf.replace(/[^\d]+/g, '');
        if (cleanCpf.length !== 11 || /^(\d)\1{10}$/.test(cleanCpf)) {
            return res.status(400).json({ error: 'CPF inválido.' });
        }
        let add = 0;
        for (let i = 0; i < 9; i++) add += parseInt(cleanCpf.charAt(i)) * (10 - i);
        let rev = 11 - (add % 11);
        if (rev === 10 || rev === 11) rev = 0;
        if (rev !== parseInt(cleanCpf.charAt(9))) return res.status(400).json({ error: 'CPF inválido.' });

        add = 0;
        for (let i = 0; i < 10; i++) add += parseInt(cleanCpf.charAt(i)) * (11 - i);
        rev = 11 - (add % 11);
        if (rev === 10 || rev === 11) rev = 0;
        if (rev !== parseInt(cleanCpf.charAt(10))) return res.status(400).json({ error: 'CPF inválido.' });

        // 2. Validação da Idade Real (ECA 18+)
        const birthDateObj = new Date(birthdate);
        const today = new Date();
        let age = today.getFullYear() - birthDateObj.getFullYear();
        const m = today.getMonth() - birthDateObj.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDateObj.getDate())) {
            age--;
        }
        if (age < 18) {
            return res.status(400).json({ error: 'O acesso a este conteúdo é restrito para maiores de 18 anos (ECA).' });
        }

        try {
            const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

            // 3. Verifica se o CPF ou E-mail já estão cadastrados
            const { data: existingProfile } = await supabaseAdmin
                .from('profiles')
                .select('cpf, email')
                .or(`cpf.eq.${cleanCpf},email.eq.${email}`)
                .maybeSingle();

            if (existingProfile) {
                if (existingProfile.cpf === cleanCpf) {
                    return res.status(400).json({ error: 'Este CPF já está cadastrado em outra conta.' });
                }
                return res.status(400).json({ error: 'Este e-mail já está cadastrado.' });
            }

            // Checa se o e-mail cadastrado é admin
            const adminEmailsEnv = process.env.ADMIN_EMAILS || '';
            const adminEmails = adminEmailsEnv.split(',').map(e => e.trim().toLowerCase());
            const isAdmin = adminEmails.includes(email.toLowerCase());
            const initialStatus = isAdmin ? 'verificado' : 'pendente_verificacao';

            // 4. Cria o usuário com auto-confirmação no Supabase Auth
            const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
                email: email,
                password: password,
                email_confirm: true
            });

            if (authError) throw authError;

            // 5. Grava os dados na tabela profiles
            const { error: profileError } = await supabaseAdmin
                .from('profiles')
                .insert([{
                    id: authData.user.id,
                    email: email,
                    cpf: cleanCpf,
                    status: initialStatus
                }]);

            if (profileError) throw profileError;

            return res.status(200).json({
                success: true,
                userId: authData.user.id,
                email: email,
                isAdmin: isAdmin,
                status: initialStatus
            });
        } catch (err) {
            console.error('[auth-operations] Erro no cadastro:', err);
            return res.status(500).json({ error: 'Erro interno ao realizar cadastro.', details: err.message });
        }
    }

    if (action === 'criar-pix') {
        const token = process.env.MERCADO_PAGO_ACCESS_TOKEN;
        if (!token) {
            return res.status(500).json({ error: 'MERCADO_PAGO_ACCESS_TOKEN não configurado no painel da Vercel.' });
        }
        if (!email || !cpf) {
            return res.status(400).json({ error: 'Os campos email e cpf são obrigatórios.' });
        }

        try {
            const cleanCpf = cpf.replace(/[^\d]+/g, '');
            const chargeAmount = amount ? Math.max(1.00, parseFloat(amount)) : 1.50;
            const descriptionText = amount ? "Apoio / Doação ao Autor - Fio Vermelho" : "Validação de Maioridade (ECA) - Fio Vermelho";

            const response = await fetch('https://api.mercadopago.com/v1/payments', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'X-Idempotency-Key': 'key_' + Math.random().toString(36).substring(2, 15)
                },
                body: JSON.stringify({
                    transaction_amount: chargeAmount, 
                    description: descriptionText,
                    payment_method_id: "pix",
                    payer: {
                        email: email,
                        identification: {
                            type: "CPF",
                            number: cleanCpf
                        }
                    }
                })
            });

            const data = await response.json();

            if (response.ok) {
                res.setHeader('Content-Type', 'application/json');
                return res.status(200).json({
                    transactionId: data.id.toString(),
                    qrCodeUrl: data.point_of_interaction.transaction_data.qr_code_base64,
                    copyPasteCode: data.point_of_interaction.transaction_data.qr_code
                });
            } else {
                res.setHeader('Content-Type', 'application/json');
                return res.status(400).json({ error: data.message || 'Erro ao gerar Pix no Mercado Pago.' });
            }
        } catch (err) {
            console.error('[auth-operations] Erro crítico no Mercado Pago:', err);
            return res.status(500).json({ error: 'Erro interno ao gerar transação Pix.' });
        }
    }

    return res.status(400).json({ error: `Ação não suportada: ${action}` });
};
