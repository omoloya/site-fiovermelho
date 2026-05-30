/* ==========================================================================
   SUPABASE CENTRAL CONFIGURATION & CLIENT INITIALIZATION
   ========================================================================== */

// As credenciais devem ser carregadas a partir do arquivo js/env.js (ignorado no Git).
// Se o arquivo js/env.js não foi criado ou carregado, definimos fallbacks vazios.
if (typeof window.env === 'undefined') window.env = {};
if (typeof window.env.SUPABASE_URL === 'undefined') window.env.SUPABASE_URL = "";
if (typeof window.env.SUPABASE_ANON_KEY === 'undefined') window.env.SUPABASE_ANON_KEY = "";

window.SUPABASE_URL = window.env.SUPABASE_URL;
window.SUPABASE_ANON_KEY = window.env.SUPABASE_ANON_KEY;

// Preserva o objeto global da biblioteca carregado pela CDN
window.supabaseLib = window.supabase;
window.supabase = null;
window.isOfflineMode = true;

// Inicialização segura do cliente Supabase
try {
    console.log("🔍 [Supabase Diagnóstico]:");
    console.log("   - URL:", window.SUPABASE_URL ? "Preenchida (OK)" : "Vazia (MOCK)");
    console.log("   - Key:", window.SUPABASE_ANON_KEY ? "Preenchida (OK)" : "Vazia (MOCK)");
    
    const hasCdn = (typeof window.supabaseLib !== 'undefined' && (typeof window.supabaseLib.createClient === 'function' || typeof window.supabaseLib === 'function')) || typeof supabaseJs !== 'undefined';
    console.log("   - CDN Biblioteca:", hasCdn ? "Carregada (OK)" : "Não detectada (BLOQUEADA ou ERRO)");

    if (window.SUPABASE_URL && window.SUPABASE_ANON_KEY && window.SUPABASE_URL !== "") {
        const creator = (window.supabaseLib && window.supabaseLib.createClient) || (typeof supabaseJs !== 'undefined' && supabaseJs.createClient) || window.supabaseLib;
        if (creator) {
            const clientCreator = typeof creator === 'function' ? creator : creator.createClient;
            window.supabase = clientCreator(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
            window.isOfflineMode = false;
            console.log("🧶 Supabase: Conectado com sucesso ao banco remoto.");
        } else {
            console.warn("⚠️ A biblioteca CDN do Supabase não forneceu o criador de cliente.");
        }
    }
} catch (error) {
    console.warn("⚠️ Falha na inicialização do Supabase remoto. Entrando em modo Offline / LocalStorage:", error);
}

if (window.isOfflineMode) {
    console.log("🔌 Fio Vermelho Rodando em Modo Protótipo (Offline / LocalStorage).");
    console.log("💡 Nota: Para salvar dados reais em produção na Vercel/Netlify, preencha as variáveis 'SUPABASE_URL' e 'SUPABASE_ANON_KEY' em js/supabase-config.js");
}

// Utilitário para salvar informações de sessão mockadas ou reais
window.sessionHelper = {
    setSession: function(userEmail, isVerified = true, userId = null) {
        // Tenta obter o ID existente da sessão anterior para preservá-lo caso não tenha sido fornecido
        let finalUserId = userId;
        if (!finalUserId) {
            const oldSession = this.getSession();
            if (oldSession && oldSession.user && oldSession.user.id) {
                finalUserId = oldSession.user.id;
            }
        }
        
        // Se ainda estiver vazio e não for modo offline, tenta obter do cliente Supabase
        if (!finalUserId && !window.isOfflineMode && window.supabase) {
            try {
                if (typeof window.supabase.auth.user === 'function') {
                    const u = window.supabase.auth.user();
                    if (u) finalUserId = u.id;
                }
                if (!finalUserId && typeof window.supabase.auth.session === 'function') {
                    const s = window.supabase.auth.session();
                    if (s && s.user) finalUserId = s.user.id;
                }
            } catch (e) {
                console.warn("Erro ao ler usuário do Supabase em setSession:", e);
            }
        }

        const sessionData = {
            user: { 
                email: userEmail,
                id: finalUserId
            },
            is_verified: isVerified,
            loginTime: new Date().getTime()
        };
        localStorage.setItem('sb-fiovermelho-session', JSON.stringify(sessionData));
    },
    
    getSession: function() {
        const data = localStorage.getItem('sb-fiovermelho-session');
        return data ? JSON.parse(data) : null;
    },
    
    clearSession: function() {
        localStorage.removeItem('sb-fiovermelho-session');
    }
};

