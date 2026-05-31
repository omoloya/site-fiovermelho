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
    try {
        checkProfileStatus();
    } catch (criticalErr) {
        console.error("Erro crítico ao checar status de maioridade:", criticalErr);
        // Garantia de destravamento de emergência caso o usuário já esteja marcado como verificado na sessão local
        if (session && session.is_verified) {
            const lockOverlay = document.getElementById('dashboard-lock-overlay');
            if (lockOverlay) {
                lockOverlay.style.display = 'none';
                lockOverlay.classList.remove('active');
                document.body.style.overflow = '';
            }
            loadChaptersAndRenderGrid();
        }
    }

    async function checkProfileStatus() {
        const lockOverlay = document.getElementById('dashboard-lock-overlay');
        const btnLockReverify = document.getElementById('btn-lock-reverify');
        const btnLockLogout = document.getElementById('btn-lock-logout');

        let status = 'pendente_verificacao';
        let userId = session && session.user && session.user.id;

        // Recuperação defensiva de ID no Supabase caso não esteja na sessão ativa
        if (!userId && !window.isOfflineMode && window.supabase) {
            try {
                if (typeof window.supabase.auth.getUser === 'function') {
                    const { data } = await window.supabase.auth.getUser();
                    if (data && data.user) userId = data.user.id;
                }
                if (!userId && typeof window.supabase.auth.user === 'function') {
                    const u = window.supabase.auth.user();
                    if (u) userId = u.id;
                }
                if (userId && window.sessionHelper) {
                    window.sessionHelper.setSession(session.user.email, session.is_verified, userId);
                }
            } catch (e) {
                console.error("[dashboard.js] Falha ao recuperar ID do usuário:", e);
            }
        }

        if (window.isOfflineMode) {
            const mockUsers = JSON.parse(localStorage.getItem('fio-mock-users') || '[]');
            const foundUser = mockUsers.find(u => u.email === session.user.email);
            status = foundUser ? foundUser.status : 'pendente_verificacao';
        } else {
            try {
                if (window.supabase) {
                    if (!userId) {
                        console.error("[dashboard.js] ID do usuário está undefined na sessão. Bloqueando por segurança.");
                        status = 'pendente_verificacao';
                    } else {
                        const { data: profile, error } = await window.supabase
                            .from('profiles')
                            .select('status')
                            .eq('id', userId)
                            .maybeSingle();

                        const data = profile;
                        if (!error && data && (data.status === 'pago' || data.status === 'approved' || data.status === 'verificado' || data.status === true)) {
                            status = 'pago';
                        } else if (data) {
                            status = data.status;
                        }
                    }
                }
            } catch (err) {
                console.error("Erro ao verificar status no Supabase:", err);
            }
        }

        // Sobregravação automática de verificação para e-mails administradores autorizados!
        const adminEmails = (window.env && window.env.ADMIN_EMAILS) || [];
        if (session && session.user && adminEmails.includes(session.user.email)) {
            status = 'pago';
        }

        // Se o status for pendente_verificacao, bloqueia com o modal e inicia checagem ativa
        if (status !== 'pago') {
            if (lockOverlay) {
                lockOverlay.style.display = 'flex';
                lockOverlay.classList.add('active');
                document.body.style.overflow = 'hidden'; // Impede rolagem
            }

            // Polling periódico seguro a cada 4 segundos no dashboard
            const statusPollInterval = setInterval(async () => {
                if (window.isOfflineMode) return;
                try {
                    let pollUserId = session && session.user && session.user.id;
                    if (!pollUserId && window.supabase && typeof window.supabase.auth.user === 'function') {
                        const u = window.supabase.auth.user();
                        if (u) pollUserId = u.id;
                    }

                    if (!pollUserId) {
                        console.error("[dashboard.js] Polling: ID do usuário está undefined.");
                        return;
                    }

                    if (window.supabase) {
                        const { data: profile, error } = await window.supabase
                            .from('profiles')
                            .select('status')
                            .eq('id', pollUserId)
                            .maybeSingle();

                        const data = profile;
                        // Depuração explícita a cada 4 segundos no polling do dashboard
                        console.log("Rodando Polling...", data);
                        if (!error && data && (data.status === 'pago' || data.status === 'approved' || data.status === 'verificado' || data.status === true)) {
                            // 1. Parar o bombardeio de requisições imediatamente!
                            clearInterval(statusPollInterval);
                            
                            // 2. Atualizar a sessão
                            if (window.sessionHelper) {
                                window.sessionHelper.setSession(session.user.email, true, pollUserId);
                            }
                            
                            // 3. Esconder/remover o modal completamente da tela
                            if (lockOverlay) {
                                lockOverlay.style.display = 'none';
                                lockOverlay.classList.remove('active');
                                document.body.style.overflow = '';
                            }
                            
                            alert("🎉 Pagamento confirmado! Seu acesso de maioridade foi verificado com sucesso.");
                            
                            // 4. Liberar a renderização do painel principal para o leitor
                            loadChaptersAndRenderGrid();
                        }
                    }
                } catch (pollErr) {
                    console.error("Erro no polling de status:", pollErr);
                }
            }, 4000);

            if (btnLockLogout) {
                btnLockLogout.addEventListener('click', () => {
                    clearInterval(statusPollInterval);
                    window.sessionHelper.clearSession();
                    window.location.replace('index.html');
                });
            }

            if (btnLockReverify) {
                btnLockReverify.addEventListener('click', async () => {
                    const originalBtnText = btnLockReverify.innerHTML;
                    btnLockReverify.innerHTML = '<div class="pix-status-spinner" style="width:14px; height:14px; margin-right:8px; border-top-color:#fff; display:inline-block; vertical-align:middle;"></div> Verificando Pix...';
                    btnLockReverify.setAttribute('disabled', 'true');

                    try {
                        let revUserId = session && session.user && session.user.id;
                        if (!revUserId && window.supabase && typeof window.supabase.auth.user === 'function') {
                            const u = window.supabase.auth.user();
                            if (u) revUserId = u.id;
                        }

                        if (!revUserId) {
                            alert("⚠️ ID do usuário não encontrado. Por favor, tente fazer login novamente.");
                            return;
                        }

                        if (window.supabase) {
                            const { data: profile, error } = await window.supabase
                                .from('profiles')
                                .select('status')
                                .eq('id', revUserId)
                                .maybeSingle();

                            const data = profile;
                            if (!error && data && (data.status === 'pago' || data.status === 'approved' || data.status === 'verificado' || data.status === true)) {
                                clearInterval(statusPollInterval);
                                
                                if (window.sessionHelper) {
                                    window.sessionHelper.setSession(session.user.email, true, revUserId);
                                }
                                
                                if (lockOverlay) {
                                    lockOverlay.style.display = 'none';
                                    lockOverlay.classList.remove('active');
                                    document.body.style.overflow = '';
                                }
                                
                                alert("🎉 Pagamento confirmado! Seu acesso de maioridade foi verificado com sucesso.");
                                loadChaptersAndRenderGrid();
                                return;
                            }
                        }
                        alert("⚠️ Ainda não detectamos a aprovação do Pix. \n\nSe você acabou de pagar, o processamento bancário pode levar de 10 a 60 segundos. Por favor, aguarde um momento e tente novamente!");
                    } catch (err) {
                        console.error("Erro na verificação manual:", err);
                        alert("Erro ao conectar com o banco. Tente novamente.");
                    } finally {
                        btnLockReverify.innerHTML = originalBtnText;
                        btnLockReverify.removeAttribute('disabled');
                    }
                });
            }
        } else {
            if (lockOverlay) {
                lockOverlay.style.display = 'none';
                lockOverlay.classList.remove('active');
                document.body.style.overflow = '';
            }
            // Só carrega os capítulos se os dados do perfil indicarem verificação com sucesso
            loadChaptersAndRenderGrid();
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

    // --- 4. Modal de Apresentação de Capítulo (Estilo Netflix) ---
    const detailModal = document.getElementById('chapter-detail-modal');
    
    function openChapterDetailModal(chap, thumbSrc) {
        if (!detailModal) return;

        const modalThumb = document.getElementById('modal-chapter-thumb');
        const modalNumber = document.getElementById('modal-chapter-number');
        const modalDate = document.getElementById('modal-chapter-date');
        const modalStatus = document.getElementById('modal-chapter-status');
        const modalTitle = document.getElementById('modal-chapter-title');
        const modalSynopsisText = document.getElementById('modal-chapter-synopsis-text');
        const modalBtnRead = document.getElementById('modal-btn-read');
        const modalBtnToggleRead = document.getElementById('modal-btn-toggle-read');

        const chapIdStr = chap.id.toString();
        let isRead = readChapters.includes(chapIdStr);

        // Populate basic information
        if (modalThumb) modalThumb.src = thumbSrc;
        if (modalNumber) modalNumber.textContent = `Capítulo ${chap.id.toString().padStart(2, '0')}`;
        if (modalDate) modalDate.textContent = chap.release_date || 'Data não disponível';
        if (modalTitle) modalTitle.textContent = chap.title;
        if (modalBtnRead) modalBtnRead.href = `ler.html?cap=${chap.id}`;

        // Define beautiful custom Yakuza/Yankee-themed synopses for the default chapters!
        const synopses = {
            1: "O destino começa a se mover em Chinatown. Em meio ao som de motores e à poeira das ruas, Kensuke Shinoda e sua gangue se deparam com os primeiros indícios de um elo sombrio que ameaça o frágil equilíbrio do submundo. As respostas podem ser mais perigosas do que as perguntas.",
            2: "A tensão atinge o ponto de ruptura. Quando pendências do passado retornam para cobrar sua parte do sangue, os laços de lealdade são colocados à prova máxima nas vielas escuras. As escolhas feitas hoje definirão quem sobreviverá ao amanhã.",
            3: "A revelação final e o peso do fio de sangue. Kensuke descobre que proteger sua família exige sacrifícios que ele talvez não esteja preparado para fazer. A teia do destino se fecha, restando apenas agir antes que seja tarde demais."
        };
        
        const defaultSynopsis = "[Esta não é uma história sobre heróis ou vilões. Prepare-se para vivenciar os dilemas morais, conflitos bizarros e laços afetivos profundos desta família marginalizada em Chinatown...]";
        if (modalSynopsisText) {
            modalSynopsisText.textContent = synopses[chap.id] || defaultSynopsis;
        }

        // Render status and setup toggle button
        function renderModalStatus() {
            isRead = readChapters.includes(chapIdStr);
            if (modalStatus) {
                modalStatus.textContent = isRead ? 'Lido' : 'Não Lido';
                modalStatus.className = `tag-badge ${isRead ? 'chapter-badge-read' : 'chapter-badge-unread'}`;
                modalStatus.style.background = isRead ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.05)';
                modalStatus.style.color = isRead ? 'var(--success-green)' : 'var(--text-secondary)';
                modalStatus.style.borderColor = isRead ? 'var(--success-green)' : 'rgba(255, 255, 255, 0.1)';
            }

            if (modalBtnToggleRead) {
                modalBtnToggleRead.innerHTML = isRead 
                    ? '<i class="fa-solid fa-circle-xmark" style="margin-right: 8px;"></i> Marcar como Não Lido'
                    : '<i class="fa-regular fa-circle-check" style="margin-right: 8px;"></i> Marcar como Lido';
            }
        }

        renderModalStatus();

        // Setup toggle read click handler
        if (modalBtnToggleRead) {
            const newToggleBtn = modalBtnToggleRead.cloneNode(true);
            modalBtnToggleRead.parentNode.replaceChild(newToggleBtn, modalBtnToggleRead);

            newToggleBtn.addEventListener('click', () => {
                const nowRead = readChapters.includes(chapIdStr);
                const targetCard = document.querySelector(`.chapter-card img[id="thumb-cap-${chap.id}"]`)?.closest('.chapter-card');
                const targetBadge = targetCard?.querySelector('.chapter-card-status-badge');

                if (nowRead) {
                    readChapters = readChapters.filter(id => id !== chapIdStr);
                    if (targetCard && targetBadge) updateCardStatusVisual(targetCard, targetBadge, false);
                } else {
                    readChapters.push(chapIdStr);
                    if (targetCard && targetBadge) updateCardStatusVisual(targetCard, targetBadge, true);
                }

                localStorage.setItem(userKey, JSON.stringify(readChapters));
                updateOverallProgress();
                renderModalStatus();
            });
        }

        // Show Modal
        detailModal.classList.add('active');
        detailModal.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden'; // Avoid scrolling background
    }

    // Close Modal Logic
    if (detailModal) {
        const closeBtn = detailModal.querySelector('.chapter-detail-close-btn');
        const overlay = detailModal.querySelector('.chapter-detail-modal-overlay');

        const closeModal = () => {
            detailModal.classList.remove('active');
            detailModal.setAttribute('aria-hidden', 'true');
            document.body.style.overflow = '';
        };

        if (closeBtn) closeBtn.addEventListener('click', closeModal);
        if (overlay) overlay.addEventListener('click', closeModal);

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && detailModal.classList.contains('active')) {
                closeModal();
            }
        });
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
                try {
                    const res = window.supabase.storage
                        .from('paginas-quadrinho')
                        .getPublicUrl(`capitulo-${chap.id}/pagina-1.webp`);
                    if (res && res.data && res.data.publicUrl) {
                        thumbSrc = res.data.publicUrl;
                    } else if (res && res.publicURL) {
                        thumbSrc = res.publicURL;
                    } else if (typeof res === 'string') {
                        thumbSrc = res;
                    }
                } catch (urlErr) {
                    console.error("Erro ao obter URL publica do storage:", urlErr);
                }
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
                    <img src="${thumbSrc}" alt="Capítulo ${chap.id} Thumbnail" class="chapter-card-thumb" id="thumb-cap-${chap.id}" onerror="this.src='assets/chapter1_thumb.jpg'">
                    <div class="chapter-card-overlay">
                        <div class="chapter-card-overlay-top">
                            <span class="chapter-card-status-badge ${isRead ? 'chapter-badge-read' : 'chapter-badge-unread'}" id="badge-cap-${chap.id}">
                                ${isRead ? 'Lido' : 'Não Lido'}
                            </span>
                        </div>
                        <div class="chapter-card-overlay-bottom">
                            <span class="chapter-number-overlay">Capítulo ${chap.id.toString().padStart(2, '0')}</span>
                            <span class="chapter-title-overlay">${chap.title}</span>
                        </div>
                    </div>
                </div>
            `;

            // Clique no card abre o modal estilo Netflix
            chapterCard.addEventListener('click', (e) => {
                openChapterDetailModal(chap, thumbSrc);
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

    // A carga dos capítulos agora é disparada apenas se o perfil estiver verificado em checkProfileStatus()
    // loadChaptersAndRenderGrid();

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
