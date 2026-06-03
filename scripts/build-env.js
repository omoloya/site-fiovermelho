const fs = require('fs');
const path = require('path');

// Obtém as chaves das variáveis de ambiente de produção
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';

// Conteúdo formatado sem risco de aspas quebradas ou injeção de template literals
const fileContent = [
    "/* ==========================================================================",
    "   CONFIGURAÇÕES DE PRODUÇÃO (Geradas de forma robusta no Deploy)",
    "   ========================================================================== */",
    "",
    "window.env = {",
    "    SUPABASE_URL: " + JSON.stringify(supabaseUrl) + ",",
    "    SUPABASE_ANON_KEY: " + JSON.stringify(supabaseAnonKey) + "",
    "};",
    ""
].join("\n");

const destPath = path.join(__dirname, '../env.js');

try {
    fs.writeFileSync(destPath, fileContent, 'utf8');
    console.log('🧶 [build-env] env.js gerado com sucesso na raiz!');
} catch (error) {
    console.error('❌ [build-env] Erro ao gravar o arquivo env.js:', error);
    process.exit(1);
}
