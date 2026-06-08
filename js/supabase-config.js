


const fallbackUrl = "";
const fallbackAnonKey = "";

if (typeof window.env === 'undefined') window.env = {};

const finalUrl = (window.env && window.env.SUPABASE_URL) || fallbackUrl;
const finalAnonKey = (window.env && window.env.SUPABASE_ANON_KEY) || fallbackAnonKey;

window.SUPABASE_URL = finalUrl;
window.SUPABASE_ANON_KEY = finalAnonKey;


window.supabaseLib = window.supabase;
window.supabase = null;
window.isOfflineMode = false;


try {
    
    
    
    
    const hasCdn = (typeof window.supabaseLib !== 'undefined' && (typeof window.supabaseLib.createClient === 'function' || typeof window.supabaseLib === 'function')) || typeof supabaseJs !== 'undefined';
    

    const isPlaceholder = finalAnonKey === "COLE_AQUI_A_SUA_ANON_KEY_REAL" || finalAnonKey.startsWith("sb_publishable_");

    if (finalUrl && finalAnonKey && finalUrl.trim() !== "" && finalAnonKey.trim() !== "" && !isPlaceholder) {
        const creator = (window.supabaseLib && window.supabaseLib.createClient) || 
                        (typeof supabaseJs !== 'undefined' && supabaseJs.createClient) || 
                        window.supabaseLib;
        if (creator) {
            const clientCreator = typeof creator === 'function' ? creator : creator.createClient;
            window.supabase = clientCreator(finalUrl, finalAnonKey);
            window.isOfflineMode = false;
            
        } else {
            
            window.isOfflineMode = true;
        }
    } else {
        if (!finalUrl || finalUrl.trim() === "") {
            
        }
        if (!finalAnonKey || finalAnonKey.trim() === "" || isPlaceholder) {
            
        }
        window.isOfflineMode = true;
    }
} catch (error) {
    
    window.isOfflineMode = true;
}


if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    window.isOfflineMode = false;
    
}

if (window.isOfflineMode) {
    
}


window.sessionHelper = {
    setSession: function(userEmail, isVerified = true, userId = null) {
        
        let finalUserId = userId;
        if (!finalUserId) {
            const oldSession = this.getSession();
            if (oldSession && oldSession.user && oldSession.user.id) {
                finalUserId = oldSession.user.id;
            }
        }
        
        
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

