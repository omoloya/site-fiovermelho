const { createClient } = require('@supabase/supabase-js');

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

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'O cabeçalho Authorization com token Bearer é obrigatório.' });
    }

    const token = authHeader.split(' ')[1];

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
        return res.status(500).json({ 
            error: 'Variáveis de ambiente do Supabase (URL ou SERVICE_ROLE_KEY) ausentes no painel da Vercel.' 
        });
    }

    try {
        // Inicializa o cliente com privilégios de Service Role para contornar RLS e manipular arquivos no Storage
        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
        
        // 1. Valida a identidade do usuário a partir do token de sessão JWT
        const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
        
        if (authError || !user || !user.email) {
            return res.status(401).json({ error: 'Token inválido, expirado ou usuário não identificado.' });
        }

        // 2. Valida se o usuário é administrador
        const adminEmailsEnv = process.env.ADMIN_EMAILS || '';
        const adminEmails = adminEmailsEnv.split(',').map(e => e.trim().toLowerCase());
        const userEmail = user.email.trim().toLowerCase();

        if (!adminEmails.includes(userEmail)) {
            return res.status(403).json({ error: 'Acesso negado. Usuário não possui permissões administrativas.' });
        }

        // 3. Processa a ação administrativa
        const { action, chapterId, pageIndex, fileData, title, pagesCount, releaseDate, totalPages } = req.body;
        const bucket = 'paginas-quadrinho';

        if (!action) {
            return res.status(400).json({ error: 'Ação administrativa não especificada.' });
        }

        console.log(`[admin-operations] Executando ação: ${action} para capítulo: ${chapterId}`);

        switch (action) {
            case 'upload-page': {
                if (!chapterId || !pageIndex || !fileData) {
                    return res.status(400).json({ error: 'Parâmetros ausentes para upload-page.' });
                }
                const base64Data = fileData.replace(/^data:image\/\w+;base64,/, "");
                const buffer = Buffer.from(base64Data, 'base64');
                const filePath = `capitulo-${chapterId}/pagina-${pageIndex}.webp`;

                const { data, error } = await supabaseAdmin.storage
                    .from(bucket)
                    .upload(filePath, buffer, {
                        contentType: 'image/webp',
                        cacheControl: '3600',
                        upsert: true
                    });

                if (error) throw error;
                return res.status(200).json({ success: true, message: 'Página enviada com sucesso.', data });
            }

            case 'replace-page': {
                if (!chapterId || !pageIndex || !fileData) {
                    return res.status(400).json({ error: 'Parâmetros ausentes para replace-page.' });
                }
                const base64Data = fileData.replace(/^data:image\/\w+;base64,/, "");
                const buffer = Buffer.from(base64Data, 'base64');
                const filePath = `capitulo-${chapterId}/pagina-${pageIndex}.webp`;

                const { data, error } = await supabaseAdmin.storage
                    .from(bucket)
                    .upload(filePath, buffer, {
                        contentType: 'image/webp',
                        cacheControl: '3600',
                        upsert: true
                    });

                if (error) throw error;
                return res.status(200).json({ success: true, message: 'Página substituída com sucesso.', data });
            }

            case 'upsert-chapter': {
                if (!chapterId || !title || pagesCount === undefined) {
                    return res.status(400).json({ error: 'Parâmetros ausentes para upsert-chapter.' });
                }

                const { data, error } = await supabaseAdmin
                    .from('chapters')
                    .upsert({
                        id: parseInt(chapterId),
                        title: title,
                        pages_count: parseInt(pagesCount),
                        release_date: releaseDate
                    });

                if (error) throw error;
                return res.status(200).json({ success: true, message: 'Capítulo registrado/atualizado com sucesso.', data });
            }

            case 'delete-page': {
                if (!chapterId || !pageIndex || !totalPages) {
                    return res.status(400).json({ error: 'Parâmetros ausentes para delete-page.' });
                }

                const targetPath = `capitulo-${chapterId}/pagina-${pageIndex}.webp`;

                // 1. Remove a página alvo
                const { error: removeError } = await supabaseAdmin.storage
                    .from(bucket)
                    .remove([targetPath]);

                if (removeError) throw removeError;

                // 2. Desloca as seguintes
                for (let i = parseInt(pageIndex) + 1; i <= parseInt(totalPages); i++) {
                    const fromPath = `capitulo-${chapterId}/pagina-${i}.webp`;
                    const toPath = `capitulo-${chapterId}/pagina-${i - 1}.webp`;
                    
                    // Supabase Storage move
                    const { error: moveError } = await supabaseAdmin.storage
                        .from(bucket)
                        .move(fromPath, toPath);
                        
                    if (moveError) {
                        console.warn(`[admin-operations] Falha silenciosa ao mover de ${fromPath} para ${toPath}:`, moveError.message);
                    }
                }

                // 3. Decrementa o pages_count
                const { error: dbError } = await supabaseAdmin
                    .from('chapters')
                    .update({ pages_count: parseInt(totalPages) - 1 })
                    .eq('id', parseInt(chapterId));

                if (dbError) throw dbError;

                return res.status(200).json({ success: true, message: 'Página deletada e sequência reordenada com sucesso.' });
            }

            case 'delete-chapter': {
                if (!chapterId) {
                    return res.status(400).json({ error: 'Parâmetros ausentes para delete-chapter.' });
                }

                // 1. Remove do banco
                const { error: dbError } = await supabaseAdmin
                    .from('chapters')
                    .delete()
                    .eq('id', parseInt(chapterId));

                if (dbError) throw dbError;

                // 2. Limpa arquivos no storage
                const { data: files, error: listError } = await supabaseAdmin.storage
                    .from(bucket)
                    .list(`capitulo-${chapterId}`);

                if (listError) throw listError;

                if (files && files.length > 0) {
                    const filesToRemove = files.map(f => `capitulo-${chapterId}/${f.name}`);
                    const { error: storageError } = await supabaseAdmin.storage
                        .from(bucket)
                        .remove(filesToRemove);

                    if (storageError) throw storageError;
                }

                return res.status(200).json({ success: true, message: 'Capítulo e suas páginas removidos com sucesso.' });
            }

            default:
                return res.status(400).json({ error: `Ação não suportada: ${action}` });
        }

    } catch (err) {
        console.error("[admin-operations] Erro crítico:", err);
        return res.status(500).json({ error: 'Falha ao executar operação administrativa.', details: err.message });
    }
};
