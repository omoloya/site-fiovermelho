/* ==========================================================================
   SUPABASE CENTRAL CONFIGURATION & CLIENT INITIALIZATION
   ========================================================================== */

// Configuração central e fallbacks estritos para produção
const fallbackUrl = "https://orckzqifklnlnjulqaxi.supabase.co";
const fallbackAnonKey = "sb_publishable_5YsosEurKym_3CDWTBh_2Q_efWMFY0H";

if (typeof window.env === 'undefined') window.env = {};

const finalUrl = (window.env && window.env.SUPABASE_URL) || fallbackUrl;
const finalAnonKey = (window.env && window.env.SUPABASE_ANON_KEY) || fallbackAnonKey;

window.SUPABASE_URL = finalUrl;
window.SUPABASE_ANON_KEY = finalAnonKey;

// Preserva o objeto global da biblioteca carregado pela CDN
window.supabaseLib = window.supabase;
window.supabase = null;
window.isOfflineMode = false;

// Inicialização segura do cliente Supabase
try {
    console.log("🔍 [Supabase Diagnóstico]:");
    console.log("   - URL:", window.SUPABASE_URL ? "Preenchida (OK)" : "Vazia (MOCK)");
    console.log("   - Key:", window.SUPABASE_ANON_KEY ? "Preenchida (OK)" : "Vazia (MOCK)");
    
    const hasCdn = (typeof window.supabaseLib !== 'undefined' && (typeof window.supabaseLib.createClient === 'function' || typeof window.supabaseLib === 'function')) || typeof supabaseJs !== 'undefined';
    console.log("   - CDN Biblioteca:", hasCdn ? "Carregada (OK)" : "Não detectada (BLOQUEADA ou ERRO)");

    if (finalUrl && finalAnonKey && finalUrl.trim() !== "" && finalAnonKey.trim() !== "") {
        const creator = (window.supabaseLib && window.supabaseLib.createClient) || 
                        (typeof supabaseJs !== 'undefined' && supabaseJs.createClient) || 
                        window.supabaseLib;
        if (creator) {
            const clientCreator = typeof creator === 'function' ? creator : creator.createClient;
            window.supabase = clientCreator(finalUrl, finalAnonKey);
            window.isOfflineMode = false;
            console.log("🧶 Supabase: Conectado com sucesso ao banco remoto.");
        } else {
            console.warn("⚠️ A biblioteca CDN do Supabase não forneceu o criador de cliente.");
            window.isOfflineMode = true;
        }
    } else {
        if (!finalUrl || finalUrl.trim() === "") {
            console.error("❌ Erro de Inicialização do Supabase: SUPABASE_URL está ausente.");
        }
        if (!finalAnonKey || finalAnonKey.trim() === "") {
            console.error("❌ Erro de Inicialização do Supabase: SUPABASE_ANON_KEY está ausente.");
        }
        window.isOfflineMode = true;
    }
} catch (error) {
    console.warn("⚠️ Falha na inicialização do Supabase remoto. Entrando em modo Offline / LocalStorage:", error);
    window.isOfflineMode = true;
}

if (window.isOfflineMode) {
    console.log("🔌 Fio Vermelho Rodando em Modo Protótipo (Offline / LocalStorage).");
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

