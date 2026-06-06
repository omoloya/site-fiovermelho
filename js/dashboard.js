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

    // --- 1.2 Proteção de Propriedade Intelectual (ECA & Direitos Autorais) ---
    let isSuperAdmin = false;

    function applyIntellectualPropertyProtection() {
        // Bloquear Clique Direito (contextmenu) nas imagens e página
        document.addEventListener('contextmenu', (e) => {
            if (isSuperAdmin) return;
            e.preventDefault();
            return false;
        });

        // Bloquear Atalhos de Cópia e Ferramentas do Desenvolvedor (F12, Ctrl+S, Ctrl+C, Ctrl+Shift+I, Cmd+Option+I)
        document.addEventListener('keydown', (e) => {
            if (isSuperAdmin) return;
            // F12
            if (e.key === 'F12' || e.keyCode === 123) {
                e.preventDefault();
                return false;
            }
            // Ctrl+S / Cmd+S
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                return false;
            }
            // Ctrl+C / Cmd+C
            if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
                e.preventDefault();
                return false;
            }
            // Ctrl+Shift+I / Cmd+Option+I
            if ((e.ctrlKey && e.shiftKey && e.key === 'I') || (e.metaKey && e.altKey && e.key === 'i')) {
                e.preventDefault();
                return false;
            }
            // Ctrl+Shift+J / Cmd+Option+J
            if ((e.ctrlKey && e.shiftKey && e.key === 'J') || (e.metaKey && e.altKey && e.key === 'j')) {
                e.preventDefault();
                return false;
            }
            // Ctrl+U / Cmd+U (View Source)
            if ((e.ctrlKey || e.metaKey) && e.key === 'u') {
                e.preventDefault();
                return false;
            }
        });

        // Bloquear Arrastar (Drag and Drop)
        document.addEventListener('dragstart', (e) => {
            if (isSuperAdmin) return;
            if (e.target.tagName === 'IMG') {
                e.preventDefault();
                return false;
            }
        });

        // Aplicar draggable="false" e classe protected-image periodicamente nas imagens
        const protectInterval = setInterval(() => {
            if (isSuperAdmin) {
                clearInterval(protectInterval);
                return;
            }
            document.querySelectorAll('img').forEach(img => {
                if (!img.classList.contains('protected-image')) {
                    img.classList.add('protected-image');
                    img.setAttribute('draggable', 'false');
                }
            });
        }, 500);
    }

    // Função única e segura para verificar status de admin no backend
    async function verifyAdminStatus() {
        if (window.isOfflineMode) {
            isSuperAdmin = session && session.user && session.user.email && session.user.email.includes("admin");
            return isSuperAdmin;
        }

        try {
            if (window.supabase) {
                const { data: authData } = await window.supabase.auth.getSession();
                const sessionToken = authData?.session?.access_token;
                if (sessionToken) {
                    const adminCheckRes = await fetch('/api/verificar-admin', {
                        method: 'POST',
                        headers: { 
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${sessionToken}`
                        }
                    });
                    if (adminCheckRes.ok) {
                        const adminCheckJson = await adminCheckRes.json();
                        isSuperAdmin = !!adminCheckJson.isAdmin;
                    } else {
                        const errJson = await adminCheckRes.json().catch(() => ({}));
                        console.error("[verifyAdminStatus] Erro ao verificar admin no backend:", adminCheckRes.status, errJson.error || errJson);
                    }
                }
            }
        } catch (e) {
            console.error("Falha ao verificar status de admin no backend:", e);
        }
        return isSuperAdmin;
    }

    // Executa a inicialização de segurança após resolver se é admin
    (async () => {
        await verifyAdminStatus();

        if (isSuperAdmin) {
            // Se for admin, garante que nenhuma trava ou classe protected permaneça ativa
            document.querySelectorAll('img').forEach(img => {
                img.classList.remove('protected-image');
                img.removeAttribute('draggable');
            });
        } else {
            // Ativa proteção apenas para leitores comuns
            applyIntellectualPropertyProtection();
        }

        // Habilita/remove dinamicamente o botão de Admin no painel
        const adminBtn = document.getElementById('btn-admin-panel');
        if (adminBtn) {
            if (isSuperAdmin) {
                adminBtn.classList.add('is-admin');
                adminBtn.style.setProperty('display', 'inline-flex', 'important');
            } else {
                adminBtn.remove(); // Remove completamente do DOM para segurança de leitores comuns
            }
        }

        // --- 1.1 Verificação de Maioridade / Status do Perfil (ECA) ---
        try {
            await checkProfileStatus();
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
    })();

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
        let userId = null;

        // Recuperação estrita do ID autenticado diretamente do Supabase Client
        if (!window.isOfflineMode && window.supabase) {
            try {
                if (typeof window.supabase.auth.getUser === 'function') {
                    const { data } = await window.supabase.auth.getUser();
                    if (data && data.user) {
                        userId = data.user.id;
                        // Sincroniza a sessão local defensivamente se necessário
                        if (window.sessionHelper && session) {
                            window.sessionHelper.setSession(session.user.email, session.is_verified, userId);
                        }
                    }
                }
            } catch (e) {
                console.error("[dashboard.js] Falha ao recuperar usuário autenticado:", e);
            }
        }

        // Fallback para sessão local se offline ou se a chamada falhou
        if (!userId) {
            userId = session && session.user && session.user.id;
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

        // Sobregravação automática de verificação para e-mails administradores autorizados (resolvido na carga inicial)
        if (isSuperAdmin) {
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
                    let pollUserId = null;
                    if (window.supabase && typeof window.supabase.auth.getUser === 'function') {
                        const { data } = await window.supabase.auth.getUser();
                        if (data && data.user) pollUserId = data.user.id;
                    }

                    if (!pollUserId) {
                        console.error("[dashboard.js] Polling: ID do usuário autenticado está undefined.");
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
                        let revUserId = null;
                        if (window.supabase && typeof window.supabase.auth.getUser === 'function') {
                            const { data } = await window.supabase.auth.getUser();
                            if (data && data.user) revUserId = data.user.id;
                        }

                        if (!revUserId) {
                            alert("⚠️ ID do usuário autenticado não encontrado. Por favor, tente fazer login novamente.");
                            btnLockReverify.innerHTML = originalBtnText;
                            btnLockReverify.removeAttribute('disabled');
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

    // O botão de Admin no painel é habilitado/removido dinamicamente no bloco de inicialização inicial

    const defaultChapters = [
        { 
            id: 1, 
            title: "Fim de Turno", 
            pages_count: 4, 
            release_date: "20 de Maio, 2026",
            synopsis: "O chefe dormiu de novo.\nAgora cabe ao resto do grupo levá-lo para casa enquanto caminham pela cidade conversando sobre suas maiores preocupações: tacos de beisebol, gangues rivals, anime e o que vão fazer no próximo dia de folga.\nCochilos inesperados, amizades inabaláveis e uma normalidade completamente quebrada. São adoráveis, mas definitivamente não deveriam ser.",
            price: 1.50,
            cover: "assets/capitulo_2.webp"
        },
        { 
            id: 2, 
            title: "Cortes no Destino", 
            pages_count: 4, 
            release_date: "25 de Maio, 2026",
            synopsis: `Quando o seu pai te liga de madrugada, te chama pelo apelido de criança e pede para você levar um pudim e um estoque de desinfetante, você já sabe que o turno extra vai ser sujo. Sem a ajuda do guarda-costas oficial, o coroa intimou os pirralhos para assumirem o serviço doméstico de emergência. Mas quando o mais velho manda, os mais novos obedecem, por lealdade e, principalmente, amor.`,
            price: 1.50,
            cover: "assets/capitulo_2.webp"
        },
        { 
            id: 3, 
            title: "O Laço Carmim", 
            pages_count: 4, 
            release_date: "29 de Maio, 2026",
            synopsis: "blablablablabla mmahjaaanabak",
            price: 1.50,
            cover: "assets/capitulo_2.webp"
        }
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
            // Modo online: Lê da API de dados públicos /api/public-data
            try {
                const response = await fetch('/api/public-data');
                if (response.ok) {
                    const data = await response.json();
                    if (data && data.length > 0) {
                        chapters = data;
                    } else {
                        chapters = [...defaultChapters];
                    }
                } else {
                    const errJson = await response.json().catch(() => ({}));
                    console.error("[public-data] Erro ao buscar capítulos da API:", response.status, errJson.error || errJson);
                    chapters = [...defaultChapters];
                }
            } catch (err) {
                console.error("Erro ao buscar capítulos da API:", err);
                chapters = [...defaultChapters];
            }
        }

        renderGrid(chapters);
        setupStartReadingButton(chapters);
    }

    function renderGrid(chapters) {
        const gridContainer = document.getElementById('chapter-list-container');
        if (!gridContainer) return;
        gridContainer.innerHTML = '';

        chapters.forEach(chap => {
            const cleanId = String(chap.id).trim();
            
            // Cria um link âncora direto para ler.html
            const itemLink = document.createElement('a');
            itemLink.className = 'chapter-list-item';
            itemLink.href = `ler.html?cap=${cleanId}`;

            let extraTextHTML = '';
            let displayTitle = chap.title;
            if (cleanId === '1') {
                displayTitle = "Fim de Turno";
                extraTextHTML = `
                    <div style="color: #ffffff; font-size: 0.9rem; line-height: 1.5; margin-top: 8px; font-weight: normal; max-width: 100%; white-space: pre-line;">O chefe dormiu de novo. Agora cabe ao resto do grupo levá-lo para casa enquanto caminham pela cidade conversando sobre suas maiores preocupações: tacos de beisebol, gangues rivals, anime e o que vão fazer no próximo dia de folga. Cochilos inesperados, amizades inabaláveis e uma normalidade completamente quebrada. São adoráveis, mas definitivamente não deveriam ser.</div>
                `;
            } else if (cleanId === '2') {
                extraTextHTML = `
                    <div style="color: #ffffff; font-size: 0.9rem; line-height: 1.5; margin-top: 8px; font-weight: normal; max-width: 100%; white-space: pre-line;">Quando o seu pai te liga de madrugada, te chama pelo apelido de criança e pede para você levar um pudim e um estoque de desinfetante, você já sabe que o turno extra vai ser sujo. Sem a ajuda do guarda-costas oficial, o coroa intimou os pirralhos para assumirem o serviço doméstico de emergência. Mas quando o mais velho manda, os mais novos obedecem, por lealdade e, principalmente, amor.</div>
                `;
            } else if (cleanId === '3') {
                extraTextHTML = `
                    <div style="color: #ffffff; font-size: 0.9rem; line-height: 1.5; margin-top: 8px; font-weight: normal; max-width: 100%; white-space: pre-line;">O que um pirulito de cereja, um cosplay de Sailor Moon, Maximum The Hormone no talo, um pudim, velhos tarados e marmanjos enciumados têm em comum? Absolutamente nada, a menos que você faça parte dessa família e o patriarca resolva estragar a sua madrugada. Para o trio principal, o turno extra começou e a estrada vai ser longa, barulhenta e completamente disfuncional.</div>
                `;
            } else if (cleanId === '4') {
                extraTextHTML = `
                    <div style="color: #ffffff; font-size: 0.9rem; line-height: 1.5; margin-top: 8px; font-weight: normal; max-width: 100%; white-space: pre-line;">Neste capítulo: Os seios da novata, aparentemente, são domínio público. Fotos de bebês japoneses fofos em fraldas. Informações aleatórias sobre o cérebro de golfinhos. O chefe dormiu antes de todo mundo, de novo... e corpos cansados estão largados pelo chão de um apartamento pequeno demais em cima de um velho Ramen-ya</div>
                `;
            }

            itemLink.innerHTML = `
                <div style="display: flex; flex-direction: column; align-items: flex-start; flex: 1;">
                    <span class="chapter-number">Capítulo ${chap.id}</span>
                    <span class="chapter-title" style="margin-top: 2px;">${displayTitle}</span>
                    ${extraTextHTML}
                </div>
            `;

            gridContainer.appendChild(itemLink);
        });
    }

    // Configura o botão "Começar a Ler"
    function setupStartReadingButton(chapters) {
        if (btnStartReading && btnStartReading.parentNode) {
            // Remove listeners antigos substituindo o botão por ele mesmo
            const newBtn = btnStartReading.cloneNode(true);
            btnStartReading.parentNode.replaceChild(newBtn, btnStartReading);
            
            newBtn.addEventListener('click', () => {
                let nextToRead = chapters[0] ? chapters[0].id : "1";
                window.location.href = `ler.html?cap=${nextToRead}`;
            });
        } else {
            console.warn("[dashboard.js] Botão 'btn-start-reading' ou seu elemento pai não foi encontrado no DOM.");
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

    // --- 6. Sistema de Apoio / Doação Opcional via PIX Dinâmico ---
    const btnOpenDonation = document.getElementById('btn-open-donation');
    const donationModal = document.getElementById('donation-modal');
    const btnCloseDonationModal = document.getElementById('btn-close-donation-modal');
    const btnGenerateDonationPix = document.getElementById('btn-generate-donation-pix');
    const donationAmountInput = document.getElementById('donation-amount-input');
    const donationModalInputArea = document.getElementById('donation-modal-input-area');
    const donationModalPixArea = document.getElementById('donation-modal-pix-area');
    const donationQrElement = document.getElementById('donation-qr-element');
    const donationPixCodeField = document.getElementById('donation-pix-code-field');
    const btnCopyDonationPix = document.getElementById('btn-copy-donation-pix');

    if (btnOpenDonation && donationModal) {
        btnOpenDonation.addEventListener('click', () => {
            // Reseta o estado do modal antes de abrir
            if (donationAmountInput) donationAmountInput.value = "5.00";
            if (donationModalInputArea) donationModalInputArea.style.display = 'block';
            if (donationModalPixArea) donationModalPixArea.style.display = 'none';
            
            donationModal.style.display = 'flex';
        });
    }

    if (btnCloseDonationModal && donationModal) {
        btnCloseDonationModal.addEventListener('click', () => {
            donationModal.style.display = 'none';
        });
        
        // Fechar clicando fora do card do modal
        donationModal.addEventListener('click', (e) => {
            if (e.target === donationModal) {
                donationModal.style.display = 'none';
            }
        });
    }

    if (btnGenerateDonationPix) {
        btnGenerateDonationPix.addEventListener('click', async () => {
            let amount = parseFloat(donationAmountInput.value);
            if (isNaN(amount) || amount < 1.00) {
                alert("⚠️ Por favor, insira um valor de apoio de no mínimo R$ 1,00.");
                return;
            }

            const originalBtnText = btnGenerateDonationPix.innerHTML;
            btnGenerateDonationPix.innerHTML = '<div class="pix-status-spinner" style="width:14px; height:14px; margin-right:8px; border-top-color:#fff; display:inline-block; vertical-align:middle;"></div> Gerando Pix...';
            btnGenerateDonationPix.setAttribute('disabled', 'true');

            const email = session?.user?.email || "apoiador@fiovermelho.com";
            // O CPF é fictício/simulado para a transação de apoio se não coletado
            const cpf = "000.000.000-00"; 

            try {
                if (window.isOfflineMode) {
                    // --- MODO SIMULADO / OFFLINE ---
                    if (window.PixService) {
                        const charge = await window.PixService.generatePixCharge(amount, "apoio_bando");
                        if (donationQrElement) donationQrElement.src = charge.qrCodeUrl;
                        if (donationPixCodeField) donationPixCodeField.value = charge.copyPasteCode;
                        
                        if (donationModalInputArea) donationModalInputArea.style.display = 'none';
                        if (donationModalPixArea) donationModalPixArea.style.display = 'block';
                    }
                } else {
                    // --- MODO REAL MERCADO PAGO ---
                    const response = await fetch('/api/auth-operations', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: 'criar-pix', email, cpf, amount })
                    });

                    if (response.ok) {
                        const charge = await response.json();
                        if (donationQrElement) donationQrElement.src = `data:image/jpeg;base64,${charge.qrCodeUrl}`;
                        if (donationPixCodeField) donationPixCodeField.value = charge.copyPasteCode;

                        if (donationModalInputArea) donationModalInputArea.style.display = 'none';
                        if (donationModalPixArea) donationModalPixArea.style.display = 'block';
                    } else {
                        const errData = await response.json();
                        throw new Error(errData.error || 'Erro na API');
                    }
                }
            } catch (err) {
                if (window.isOfflineMode) {
                    console.warn("⚠️ API do Mercado Pago indisponível localmente para doações. Iniciando simulação de teste local:", err.message);
                    // Fallback de simulação local caso esteja em ambiente sem serverless
                    if (window.PixService) {
                        const charge = await window.PixService.generatePixCharge(amount, "apoio_bando");
                        if (donationQrElement) donationQrElement.src = charge.qrCodeUrl;
                        if (donationPixCodeField) donationPixCodeField.value = charge.copyPasteCode;
                        
                        if (donationModalInputArea) donationModalInputArea.style.display = 'none';
                        if (donationModalPixArea) donationModalPixArea.style.display = 'block';
                    }
                } else {
                    console.error("Erro na geração do Pix de apoio:", err);
                    alert("⚠️ Ocorreu um erro ao gerar a cobrança Pix de apoio. Por favor, tente novamente mais tarde.");
                }
            } finally {
                btnGenerateDonationPix.innerHTML = originalBtnText;
                btnGenerateDonationPix.removeAttribute('disabled');
            }
        });
    }

    if (btnCopyDonationPix && donationPixCodeField) {
        btnCopyDonationPix.addEventListener('click', () => {
            donationPixCodeField.select();
            donationPixCodeField.setSelectionRange(0, 99999);
            navigator.clipboard.writeText(donationPixCodeField.value)
                .then(() => {
                    const originalHTML = btnCopyDonationPix.innerHTML;
                    btnCopyDonationPix.innerHTML = '<i class="fa-solid fa-check" style="color: var(--success-green);"></i>';
                    setTimeout(() => {
                        btnCopyDonationPix.innerHTML = originalHTML;
                    }, 2000);
                })
                .catch(err => {
                    console.error("Erro ao copiar código Pix: ", err);
                    alert("Não foi possível copiar automaticamente. Selecione o código e copie manualmente!");
                });
        });
    }
});
