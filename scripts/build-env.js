const fs = require('fs');
const path = require('path');

// 0. Injeção de variáveis de ambiente no supabase-config.js
function injectEnvVariables() {
    const supabaseUrl = process.env.SUPABASE_URL || '';
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

    if (supabaseUrl || supabaseAnonKey) {
        const configPath = path.join(__dirname, '../js/supabase-config.js');
        if (fs.existsSync(configPath)) {
            let content = fs.readFileSync(configPath, 'utf8');
            if (supabaseUrl) {
                content = content.replace(/const fallbackUrl = ".*?";/, `const fallbackUrl = "${supabaseUrl}";`);
            }
            if (supabaseAnonKey) {
                content = content.replace(/const fallbackAnonKey = ".*?";/, `const fallbackAnonKey = "${supabaseAnonKey}";`);
            }
            fs.writeFileSync(configPath, content, 'utf8');
            console.log('🧶 [build-env] Variáveis injetadas com sucesso em supabase-config.js!');
        }
    }
}

// 1. Minificação de CSS
function minifyCss() {
    console.log('⚡ [build-env] Iniciando minificação de CSS...');
    const cssPath = path.join(__dirname, '../css/style.css');
    const outputPath = path.join(__dirname, '../css/style.min.css');
    
    if (fs.existsSync(cssPath)) {
        const cssContent = fs.readFileSync(cssPath, 'utf8');
        const minifiedCss = cssContent
            .replace(/\/\*[\s\S]*?\*\//g, '') // Remove comments
            .replace(/\s+/g, ' ') // Collapse spaces
            .replace(/\s*([\{\}:;,])\s*/g, '$1') // Remove spaces around delimiters
            .trim();
        
        fs.writeFileSync(outputPath, minifiedCss, 'utf8');
        console.log('   - CSS minificado com sucesso: css/style.min.css');
    } else {
        console.log('⚠️ [build-env] Arquivo css/style.css não encontrado.');
    }
}

// 2. Empacotamento (Bundling) e Minificação JS
async function runBundlingAndMinification() {
    try {
        const { minify } = require('terser');
        console.log('⚡ [build-env] Terser carregado. Iniciando bundling e minificação...');
        
        const jsDir = path.join(__dirname, '../js');
        const configPath = path.join(jsDir, 'supabase-config.js');
        
        // Mapeamento de arquivos para empacotamento
        const bundles = [
            { name: 'auth.bundle.js', files: [configPath, path.join(jsDir, 'auth.js')] },
            { name: 'dashboard.bundle.js', files: [configPath, path.join(jsDir, 'dashboard.js')] },
            { name: 'ler.bundle.js', files: [configPath, path.join(jsDir, 'ler.js')] },
            { name: 'admin.bundle.js', files: [configPath, path.join(jsDir, 'admin.js')] },
            { name: 'descadastrar.bundle.js', files: [path.join(jsDir, 'descadastrar.js')] }
        ];
        
        for (const bundle of bundles) {
            let combinedCode = '';
            for (const file of bundle.files) {
                if (fs.existsSync(file)) {
                    combinedCode += fs.readFileSync(file, 'utf8') + '\n';
                }
            }
            
            try {
                const result = await minify(combinedCode, {
                    compress: {
                        drop_console: true,
                        dead_code: true
                    },
                    mangle: true,
                    format: {
                        comments: false
                    },
                    sourceMap: false
                });
                
                if (result.code) {
                    const outputPath = path.join(jsDir, bundle.name);
                    fs.writeFileSync(outputPath, `// [minified]\n${result.code}`, 'utf8');
                    console.log(`   - Bundle gerado com sucesso: js/${bundle.name}`);
                }
            } catch (minifyErr) {
                console.error(`   ❌ Erro ao minificar o bundle ${bundle.name}:`, minifyErr.message);
                process.exit(1);
            }
        }
    } catch (err) {
        if (err.code === 'MODULE_NOT_FOUND') {
            console.log('⚠️ [build-env] Terser não está instalado. Pulando etapa de bundling (normal em desenvolvimento local).');
        } else {
            console.error('❌ [build-env] Erro durante o bundling:', err);
            process.exit(1);
        }
    }
}

// 3. Atualiza referências nos arquivos HTML com Build ID para controle de cache
function updateHtmlResources(buildId) {
    console.log(`🔧 [build-env] Atualizando referências HTML com Build ID: ${buildId}...`);
    const rootDir = path.join(__dirname, '..');
    const items = fs.readdirSync(rootDir);
    
    for (const item of items) {
        if (item.endsWith('.html')) {
            const filePath = path.join(rootDir, item);
            let content = fs.readFileSync(filePath, 'utf8');
            
            // Substitui style.css por style.min.css com controle de cache
            content = content.replace(/href="css\/style\.css"/g, `href="css/style.min.css?v=${buildId}"`);
            
            // Substitui scripts locais pelo script de bundle minificado
            if (item === 'index.html') {
                content = content.replace(
                    /<script src="js\/supabase-config\.js"><\/script>\s*<script src="js\/auth\.js"><\/script>/g,
                    `<script src="js/auth.bundle.js?v=${buildId}"></script>`
                );
            } else if (item === 'dashboard.html') {
                content = content.replace(
                    /<script src="js\/supabase-config\.js"><\/script>\s*<script src="js\/dashboard\.js.*?"><\/script>/g,
                    `<script src="js/dashboard.bundle.js?v=${buildId}"></script>`
                );
            } else if (item === 'ler.html') {
                content = content.replace(
                    /<script src="js\/supabase-config\.js"><\/script>\s*<script src="js\/ler\.js"><\/script>/g,
                    `<script src="js/ler.bundle.js?v=${buildId}"></script>`
                );
            } else if (item === 'admin.html') {
                content = content.replace(
                    /<script src="js\/supabase-config\.js"><\/script>\s*<script src="js\/admin\.js"><\/script>/g,
                    `<script src="js/admin.bundle.js?v=${buildId}"></script>`
                );
            } else if (item === 'descadastrar.html') {
                content = content.replace(
                    /<script src="js\/descadastrar\.js"><\/script>/g,
                    `<script src="js/descadastrar.bundle.js?v=${buildId}"></script>`
                );
            }
            
            fs.writeFileSync(filePath, content, 'utf8');
            console.log(`   - Referências HTML atualizadas para: ${item}`);
        }
    }
}

// 4. Limpeza de todos os comentários HTML (<!-- -->) dos arquivos da raiz
function cleanHtmlComments() {
    console.log('🧹 [build-env] Iniciando limpeza de comentários nos arquivos HTML...');
    const rootDir = path.join(__dirname, '..');
    const items = fs.readdirSync(rootDir);
    
    for (const item of items) {
        if (item.endsWith('.html')) {
            const filePath = path.join(rootDir, item);
            let content = fs.readFileSync(filePath, 'utf8');
            
            // Remove todos os comentários HTML <!-- ... -->
            const cleanedContent = content.replace(/<!--[\s\S]*?-->/g, '');
            
            if (content !== cleanedContent) {
                fs.writeFileSync(filePath, cleanedContent, 'utf8');
                console.log(`   - Comentários HTML removidos de: ${item}`);
            }
        }
    }
}

// Execução sequencial das tarefas de build
const buildId = Date.now();

(async () => {
    injectEnvVariables();
    minifyCss();
    await runBundlingAndMinification();
    updateHtmlResources(buildId);
    cleanHtmlComments();
    console.log('🎉 [build-env] Processo de build concluído com sucesso!');
})();
