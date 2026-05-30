/* ==========================================================================
   DASHBOARD.HTML INTERACTIVE LOGIC & SESSION CHECK
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    // --- 1. Proteção de Rota & Verificação de Sessão ---
    if (!window.sessionHelper) {
        console.error("Erro: sessionHelper não foi inicializado.");
        window.location.replace('index.html');
        return;
    }

    const session = window.sessionHelper.getSession();
    if (!session) {
        window.location.replace('index.html');
        return;
    }

    // --- 1.1 Verificação de Maioridade / Status do Perfil (ECA) ---
    checkProfileStatus();

    async function checkProfileStatus() {
        const lockOverlay = document.getElementById('dashboard-lock-overlay');
        const btnLockReverify = document.getElementById('btn-lock-reverify');
        const btnLockLogout = document.getElementById('btn-lock-logout');

        let status = 'pendente_verificacao';

        if (window.isOfflineMode) {
            const mockUsers = JSON.parse(localStorage.getItem('fio-mock-users') || '[]');
            const foundUser = mockUsers.find(u => u.email === session.user.email);
            status = foundUser ? foundUser.status : 'pendente_verificacao';
        } else {
            try {
                if (window.supabase) {
                    const { data: profile, error } = await window.supabase
                        .from('profiles')
                        .select('status')
                        .eq('id', session.user.id)
                        .maybeSingle();

                    if (!error && profile) {
                        status = profile.status;
                    }
                }
            } catch (err) {
                console.error("Erro ao verificar status no Supabase:", err);
            }
        }

        // Se o status for pendente_verificacao, bloqueia com o modal
        if (status === 'pendente_verificacao') {
            if (lockOverlay) {
                lockOverlay.style.display = 'flex';
                document.body.style.overflow = 'hidden'; // Impede rolagem
            }

            if (btnLockLogout) {
                btnLockLogout.addEventListener('click', () => {
                    window.sessionHelper.clearSession();
                    window.location.replace('index.html');
                });
            }

            if (btnLockReverify) {
                btnLockReverify.addEventListener('click', () => {
                    window.sessionHelper.clearSession();
                    window.location.replace('index.html');
                });
            }
        } else {
            if (lockOverlay) {
                lockOverlay.style.display = 'none';
                document.body.style.overflow = '';
            }
        }
    }

    // --- DOM Elements ---
    const userEmailSpan = document.getElementById('user-display-email');
    const btnLogout = document.getElementById('btn-logout');
    const btnStartReading = document.getElementById('btn-start-reading');
    const progressIndicator = document.getElementById('progress-indicator');
    
    const leadForm = document.getElementById('lead-capture-form');
    const leadEmailInput = document.getElementById('lead-email');
    const leadSuccessMsg = document.getElementById('lead-success-message');
    const btnSubscribe = document.getElementById('btn-subscribe');

    // Exibe o email do usuário ativo
    if (userEmailSpan && session.user && session.user.email) {
        userEmailSpan.style.display = 'inline';
        userEmailSpan.innerHTML = `<i class="fa-regular fa-user" style="margin-right: 6px;"></i> ${session.user.email}`;
    }

    // --- 2. Ação de Logout ---
    if (btnLogout) {
        btnLogout.addEventListener('click', () => {
            window.sessionHelper.clearSession();
            window.location.replace('index.html');
        });
    }

    // --- 3. Lógica de Capítulos Lidos & Progresso ---
    const userKey = `fio-read-chapters-${session.user.email}`;
    let readChapters = JSON.parse(localStorage.getItem(userKey) || '[]');

    const totalChapters = 3;
    const checkboxes = document.querySelectorAll('.read-checkbox');

    // Inicializa o estado dos checkboxes e dos cards com base no localStorage
    checkboxes.forEach(chk => {
        const chapterId = chk.getAttribute('data-chapter-id');
        const card = chk.closest('.chapter-card');
        const badge = card.querySelector('.chapter-card-status-badge');
        
        // Se estiver marcado como lido
        if (readChapters.includes(chapterId)) {
            chk.checked = true;
            updateCardStatusVisual(card, badge, true);
        } else {
            chk.checked = false;
            updateCardStatusVisual(card, badge, false);
        }

        // Listener para alteração de estado do checkbox
        chk.addEventListener('change', (e) => {
            const chkId = e.target.getAttribute('data-chapter-id');
            const targetCard = e.target.closest('.chapter-card');
            const targetBadge = targetCard.querySelector('.chapter-card-status-badge');
            
            if (e.target.checked) {
                if (!readChapters.includes(chkId)) {
                    readChapters.push(chkId);
                }
                updateCardStatusVisual(targetCard, targetBadge, true);
            } else {
                readChapters = readChapters.filter(id => id !== chkId);
                updateCardStatusVisual(targetCard, targetBadge, false);
            }

            localStorage.setItem(userKey, JSON.stringify(readChapters));
            updateOverallProgress();
        });
    });

    // Atualiza o progresso visual do card
    function updateCardStatusVisual(card, badge, isRead) {
        if (isRead) {
            badge.textContent = "Lido";
            badge.classList.remove('chapter-badge-unread');
            badge.classList.add('chapter-badge-read');
            card.style.border = "1px solid rgba(16, 185, 129, 0.25)";
        } else {
            badge.textContent = "Não Lido";
            badge.classList.remove('chapter-badge-read');
            badge.classList.add('chapter-badge-unread');
            card.style.border = "";
        }
    }

    // Calculates and updates progress text in the header
    function updateOverallProgress() {
        const count = readChapters.length;
        const percentage = Math.round((count / totalChapters) * 100);
        if (progressIndicator) {
            progressIndicator.textContent = `Lidos: ${count} / ${totalChapters} (${percentage}%)`;
        }
    }

    // Call initial progress
    updateOverallProgress();

    // --- 4. Redirecionamento para Leitura (Links dos Cards) ---
    const cards = document.querySelectorAll('.chapter-card');
    cards.forEach(card => {
        const checkboxLabel = card.querySelector('.read-checkbox-label');
        const checkboxInput = card.querySelector('.read-checkbox');
        const chapterId = checkboxInput.getAttribute('data-chapter-id');
        
        card.addEventListener('click', (e) => {
            if (e.target === checkboxInput || checkboxLabel.contains(e.target)) {
                return;
            }
            window.location.href = `ler.html?cap=${chapterId}`;
        });
        
        card.style.cursor = 'pointer';
    });

    // Começar a Ler: Abre o primeiro capítulo não lido, ou o capítulo 1 por padrão
    if (btnStartReading) {
        btnStartReading.addEventListener('click', () => {
            let nextToRead = "1";
            for (let i = 1; i <= totalChapters; i++) {
                if (!readChapters.includes(i.toString())) {
                    nextToRead = i.toString();
                    break;
                }
            }
            window.location.href = `ler.html?cap=${nextToRead}`;
        });
    }

    // --- 5. Captura de Leads (Newsletter) ---
    if (leadForm) {
        leadForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const leadEmail = leadEmailInput.value.trim();

            btnSubscribe.classList.add('btn-disabled');
            const originalHTML = btnSubscribe.innerHTML;
            btnSubscribe.innerHTML = '<div class="pix-status-spinner" style="margin-right: 8px;"></div> Salvando...';

            if (window.isOfflineMode) {
                // --- MODO OFFLINE (LocalStorage) ---
                setTimeout(() => {
                    let mockLeads = JSON.parse(localStorage.getItem('fio-mock-leads') || '[]');
                    if (!mockLeads.includes(leadEmail)) {
                        mockLeads.push(leadEmail);
                        localStorage.setItem('fio-mock-leads', JSON.stringify(mockLeads));
                    }
                    showLeadSuccess();
                }, 1000);
            } else {
                // --- MODO SUPABASE REAL ---
                try {
                    if (window.supabase) {
                        const { data, error } = await window.supabase
                            .from('leads')
                            .insert([{ email: leadEmail, created_at: new Date() }]);

                        if (error) throw error;
                        showLeadSuccess();
                    } else {
                        throw new Error("Cliente Supabase não inicializado.");
                    }
                } catch (err) {
                    console.error("Erro ao salvar lead no Supabase:", err.message);
                    // Fallback silencioso local
                    let mockLeads = JSON.parse(localStorage.getItem('fio-mock-leads') || '[]');
                    if (!mockLeads.includes(leadEmail)) {
                        mockLeads.push(leadEmail);
                        localStorage.setItem('fio-mock-leads', JSON.stringify(mockLeads));
                    }
                    showLeadSuccess();
                }
            }
        });
    }

    function showLeadSuccess() {
        btnSubscribe.style.display = 'none';
        leadEmailInput.style.display = 'none';
        if (leadForm.querySelector('.input-group')) {
            leadForm.querySelector('.input-group').style.display = 'none';
        }
        leadSuccessMsg.style.display = 'block';
    }
});
