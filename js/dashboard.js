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
    let totalChaptersCount = 3;

    // Habilita o botão Admin no painel apenas para emails autorizados na whitelist
    const adminEmails = (window.env && window.env.ADMIN_EMAILS) || [];
    const isAdmin = session && session.user && adminEmails.includes(session.user.email);

    const adminBtn = document.getElementById('btn-admin-panel');
    if (adminBtn) {
        if (isAdmin) {
            adminBtn.style.display = 'inline-flex';
        } else {
            adminBtn.style.display = 'none';
        }
    }

    const defaultChapters = [
        { id: 1, title: "O Elo Perdido", pages_count: 4, release_date: "20 de Maio, 2026" },
        { id: 2, title: "Cortes no Destino", pages_count: 4, release_date: "25 de Maio, 2026" },
        { id: 3, title: "O Laço Carmim", pages_count: 4, release_date: "29 de Maio, 2026" }
    ];

    async function loadChaptersAndRenderGrid() {
        let chapters = [];

        if (window.isOfflineMode) {
            // Modo offline: Lê do localStorage 'fio-mock-chapters' e mescla com defaultChapters
            const mockChapters = JSON.parse(localStorage.getItem('fio-mock-chapters') || '[]');
            const merged = [...defaultChapters];
            
            mockChapters.forEach(mc => {
                const idx = merged.findIndex(c => c.id === mc.id);
                if (idx !== -1) {
                    merged[idx] = mc;
                } else {
                    merged.push(mc);
                }
            });
            merged.sort((a, b) => a.id - b.id);
            chapters = merged;
        } else {
            // Modo online: Lê do Supabase 'chapters'
            try {
                if (window.supabase) {
                    const { data, error } = await window.supabase
                        .from('chapters')
                        .select('*')
                        .order('id', { ascending: true });

                    if (!error && data && data.length > 0) {
                        chapters = data;
                    } else {
                        // Se estiver vazio no banco, usa os defaultChapters
                        chapters = [...defaultChapters];
                    }
                } else {
                    chapters = [...defaultChapters];
                }
            } catch (err) {
                console.error("Erro ao buscar capítulos do Supabase:", err);
                chapters = [...defaultChapters];
            }
        }

        totalChaptersCount = chapters.length;
        renderGrid(chapters);
        updateOverallProgress();
        setupStartReadingButton(chapters);
    }

    function renderGrid(chapters) {
        const gridContainer = document.getElementById('chapter-list-container');
        if (!gridContainer) return;
        gridContainer.innerHTML = '';

        chapters.forEach(chap => {
            const chapIdStr = chap.id.toString();
            const isRead = readChapters.includes(chapIdStr);
            
            // Define Thumbnail
            let thumbSrc = `assets/chapter${chap.id}_thumb.jpg`;
            if (!window.isOfflineMode && window.supabase && chap.id > 3) {
                const { data } = window.supabase.storage
                    .from('paginas-quadrinho')
                    .getPublicUrl(`capitulo-${chap.id}/pagina-1.webp`);
                thumbSrc = data.publicUrl;
            } else if (window.isOfflineMode && chap.id > 3) {
                const sessionKey = `fio-temp-page-${chap.id}-1`;
                const tempUrl = sessionStorage.getItem(sessionKey);
                thumbSrc = tempUrl || `assets/chapter1_thumb.jpg`; // Fallback
            }

            const chapterCard = document.createElement('article');
            chapterCard.className = 'chapter-card glass-card';
            chapterCard.style.cursor = 'pointer';
            if (isRead) {
                chapterCard.style.border = "1px solid rgba(16, 185, 129, 0.25)";
            }

            chapterCard.innerHTML = `
                <div class="chapter-card-thumb-container">
                    <span class="chapter-card-status-badge ${isRead ? 'chapter-badge-read' : 'chapter-badge-unread'}" id="badge-cap-${chap.id}">
                        ${isRead ? 'Lido' : 'Não Lido'}
                    </span>
                    <img src="${thumbSrc}" alt="Capítulo ${chap.id} Thumbnail" class="chapter-card-thumb" id="thumb-cap-${chap.id}" onerror="this.src='assets/chapter1_thumb.jpg'">
                </div>
                <div class="chapter-card-info">
                    <div>
                        <div class="chapter-number">Capítulo ${chap.id.toString().padStart(2, '0')}</div>
                        <h3 class="chapter-card-title">${chap.title}</h3>
                    </div>
                    <div class="chapter-card-meta">
                        <span class="chapter-date">${chap.release_date}</span>
                        <label class="read-checkbox-label">
                            <input type="checkbox" class="read-checkbox" data-chapter-id="${chap.id}" ${isRead ? 'checked' : ''}>
                            Lido
                        </label>
                    </div>
                </div>
            `;

            // Clique no card redireciona para a leitura
            const checkbox = chapterCard.querySelector('.read-checkbox');
            const checkboxLabel = chapterCard.querySelector('.read-checkbox-label');

            chapterCard.addEventListener('click', (e) => {
                if (e.target === checkbox || checkboxLabel.contains(e.target)) {
                    return;
                }
                window.location.href = `ler.html?cap=${chap.id}`;
            });

            // Clique no checkbox de marcação de lido
            checkbox.addEventListener('change', (e) => {
                const targetCard = e.target.closest('.chapter-card');
                const targetBadge = targetCard.querySelector('.chapter-card-status-badge');
                
                if (e.target.checked) {
                    if (!readChapters.includes(chapIdStr)) {
                        readChapters.push(chapIdStr);
                    }
                    updateCardStatusVisual(targetCard, targetBadge, true);
                } else {
                    readChapters = readChapters.filter(id => id !== chapIdStr);
                    updateCardStatusVisual(targetCard, targetBadge, false);
                }

                localStorage.setItem(userKey, JSON.stringify(readChapters));
                updateOverallProgress();
            });

            gridContainer.appendChild(chapterCard);
        });
    }

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

    // Calcula e atualiza a barra de progresso do leitor no cabeçalho
    function updateOverallProgress() {
        const count = readChapters.length;
        const percentage = totalChaptersCount > 0 ? Math.round((count / totalChaptersCount) * 100) : 0;
        if (progressIndicator) {
            progressIndicator.textContent = `Lidos: ${count} / ${totalChaptersCount} (${percentage}%)`;
        }
    }

    // Configura o botão "Começar a Ler"
    function setupStartReadingButton(chapters) {
        if (btnStartReading) {
            // Remove listeners antigos substituindo o botão por ele mesmo
            const newBtn = btnStartReading.cloneNode(true);
            btnStartReading.parentNode.replaceChild(newBtn, btnStartReading);
            
            newBtn.addEventListener('click', () => {
                let nextToRead = chapters[0] ? chapters[0].id.toString() : "1";
                for (let i = 0; i < chapters.length; i++) {
                    const cIdStr = chapters[i].id.toString();
                    if (!readChapters.includes(cIdStr)) {
                        nextToRead = cIdStr;
                        break;
                    }
                }
                window.location.href = `ler.html?cap=${nextToRead}`;
            });
        }
    }

    // Dispara a carga inicial dinâmica dos capítulos
    loadChaptersAndRenderGrid();

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
