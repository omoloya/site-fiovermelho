const fs = require('fs');
const path = require('path');

// 1. Minificação e Ofuscação dos Arquivos JS do Frontend (In-place) via Terser
async function runMinification() {
    try {
        const { minify } = require('terser');
        console.log('⚡ [build-env] Terser carregado. Iniciando minificação in-place...');
        
        const jsDir = path.join(__dirname, '../js');
        await minifyDirRecursively(jsDir, minify);
        
        console.log('✅ [build-env] Todos os scripts do frontend foram minificados e ofuscados com sucesso (sem source maps)!');
    } catch (err) {
        if (err.code === 'MODULE_NOT_FOUND') {
            console.log('⚠️ [build-env] Terser não está instalado localmente. Pulando etapa de minificação (normal em ambiente local de desenvolvimento).');
        } else {
            console.error('❌ [build-env] Erro durante a minificação:', err);
            process.exit(1);
        }
    }
}

async function minifyDirRecursively(dir, minify) {
    if (!fs.existsSync(dir)) return;
    
    const items = fs.readdirSync(dir);
    for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
            await minifyDirRecursively(fullPath, minify);
        } else if (item.endsWith('.js')) {
            const originalCode = fs.readFileSync(fullPath, 'utf8');
            
            // Ignora arquivos que já estejam minificados
            if (originalCode.includes('// [minified]') || item.includes('.min.js')) {
                continue;
            }
            
            try {
                const result = await minify(originalCode, {
                    compress: {
                        drop_console: false, // mantém console logs importantes para diagnóstico
                        dead_code: true
                    },
                    mangle: true,
                    sourceMap: false // Garante que NENHUM arquivo .map ou source map seja gerado
                });
                
                if (result.code) {
                    // Adiciona uma flag de minificação no topo para fins informativos
                    const minifiedCode = `// [minified]\n${result.code}`;
                    fs.writeFileSync(fullPath, minifiedCode, 'utf8');
                    console.log(`   - Minificado: ${path.relative(path.join(__dirname, '..'), fullPath)}`);
                }
            } catch (minifyErr) {
                console.error(`   ❌ Erro ao minificar o arquivo ${item}:`, minifyErr.message);
            }
        }
    }
}

// Executa a minificação
runMinification();
