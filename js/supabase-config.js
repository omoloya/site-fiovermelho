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

window.supabase = null;
window.isOfflineMode = true;

// Inicialização segura do cliente Supabase
try {
    if (window.SUPABASE_URL && window.SUPABASE_ANON_KEY && window.SUPABASE_URL !== "") {
        // Se as credenciais estiverem preenchidas e a biblioteca CDN estiver disponível
        const creator = (window.supabase && window.supabase.createClient) || (typeof supabaseJs !== 'undefined' && supabaseJs.createClient);
        if (creator) {
            window.supabase = creator(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
            window.isOfflineMode = false;
            console.log("🧶 Supabase: Conectado com sucesso ao banco remoto.");
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
    setSession: function(userEmail, isVerified = true) {
        const sessionData = {
            user: { email: userEmail },
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

