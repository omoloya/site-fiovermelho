/* ==========================================================================
   LER.HTML INTERACTIVE WEBTOON READER LOGIC
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

        // Se o status for pendente_verificacao, expulsa do leitor de volta para o dashboard lock
        if (status === 'pendente_verificacao') {
            window.location.replace('dashboard.html');
        }
    }

    // --- Dados Dinâmicos dos Capítulos ---
    const defaultChapters = {
        "1": { title: "O Elo Perdido", pagesCount: 4, releaseDate: "20 de Maio, 2026" },
        "2": { title: "Cortes no Destino", pagesCount: 4, releaseDate: "25 de Maio, 2026" },
        "3": { title: "O Laço Carmim", pagesCount: 4, releaseDate: "29 de Maio, 2026" }
    };

    let chaptersData = { ...defaultChapters };

    // --- DOM Elements ---
    const chapterTitleEl = document.getElementById('current-chapter-title');
    const chapterSelectEl = document.getElementById('reader-chapter-select');
    const canvasContainer = document.getElementById('webtoon-canvas-container');
    
    const btnPrev = document.getElementById('btn-prev-chapter');
    const btnNext = document.getElementById('btn-next-chapter');

    // --- 2. Leitura dos Parâmetros da URL (Query Params) ---
    const urlParams = new URLSearchParams(window.location.search);
    let currentChapterId = urlParams.get('cap') || "1";

    async function initializeReader() {
        // 1. Carrega os capítulos de forma assíncrona
        if (window.isOfflineMode) {
            // Mescla capítulos mockados locais
            const mockChapters = JSON.parse(localStorage.getItem('fio-mock-chapters') || '[]');
            mockChapters.forEach(c => {
                chaptersData[c.id.toString()] = {
                    title: c.title,
                    pagesCount: c.pages_count,
                    releaseDate: c.release_date
                };
            });
        } else {
            // Mescla do Supabase Database
            try {
                if (window.supabase) {
                    const { data, error } = await window.supabase
                        .from('chapters')
                        .select('*')
                        .order('id', { ascending: true });

                    if (!error && data && data.length > 0) {
                        const dbChapters = {};
                        data.forEach(c => {
                            dbChapters[c.id.toString()] = {
                                title: c.title,
                                pagesCount: c.pages_count,
                                releaseDate: c.release_date
                            };
                        });
                        chaptersData = dbChapters;
                    }
                }
            } catch (err) {
                console.error("Erro ao carregar capítulos:", err);
            }
        }

        // Valida se o capítulo atual existe nos dados carregados
        if (!chaptersData[currentChapterId]) {
            currentChapterId = Object.keys(chaptersData)[0] || "1";
        }

        const currentChapter = chaptersData[currentChapterId];
        console.log(`🧶 [Reader] Lendo Capítulo ${currentChapterId}: ${currentChapter.title}`);

        // --- 3. Atualizar Estado Inicial da Interface ---
        if (chapterTitleEl) {
            chapterTitleEl.textContent = `Capítulo ${currentChapterId.padStart(2, '0')}: ${currentChapter.title}`;
        }

        // Reconstrói dinamicamente as opções do dropdown para cobrir capítulos extras
        if (chapterSelectEl) {
            chapterSelectEl.innerHTML = '';
            Object.keys(chaptersData).forEach(id => {
                const opt = document.createElement('option');
                opt.value = id;
                opt.textContent = `Capítulo ${id.padStart(2, '0')}: ${chaptersData[id].title}`;
                chapterSelectEl.appendChild(opt);
            });
            chapterSelectEl.value = currentChapterId;
        }

        // --- 4. Marca o Capítulo Atual Como Lido no localStorage Automaticamente ---
        const userKey = `fio-read-chapters-${session.user.email}`;
        let readChapters = JSON.parse(localStorage.getItem(userKey) || '[]');
        if (!readChapters.includes(currentChapterId)) {
            readChapters.push(currentChapterId);
            localStorage.setItem(userKey, JSON.stringify(readChapters));
            console.log(`🧶 [Reader] Capítulo ${currentChapterId} marcado automaticamente como lido.`);
        }

        // --- 5. Renderização Vertical das Páginas do Webtoon ---
        renderWebtoonPages(currentChapter);

        // --- 6. Configurar Navegação Dinâmica ---
        setupNavigation(chaptersData);
    }

    function renderWebtoonPages(currentChapter) {
        if (!canvasContainer) return;
        canvasContainer.innerHTML = '';
        
        const totalPages = currentChapter.pagesCount;
        
        for (let i = 1; i <= totalPages; i++) {
            const pageWrapper = document.createElement('div');
            pageWrapper.className = 'webtoon-placeholder';
            pageWrapper.id = `page-wrapper-${i}`;
            pageWrapper.innerHTML = `
                <div class="pix-status-spinner" id="spinner-page-${i}" style="width: 24px; height: 24px; border-top-color: var(--primary-red);"></div>
                <span id="text-page-${i}" style="font-size: 0.8rem; color: var(--text-muted);">Página ${i} • Carregando...</span>
            `;
            
            const img = document.createElement('img');
            img.className = 'webtoon-page-img';
            img.alt = `Página ${i} do Capítulo ${currentChapterId}`;
            
            // Define o endereço da imagem de acordo com o modo
            let imageSource = `assets/cap${currentChapterId}_pag${i}.jpg`; // Fallback físico original
            
            if (!window.isOfflineMode && window.supabase && parseInt(currentChapterId) > 3) {
                // Modo Produção: URL pública do Storage do Supabase
                const { data } = window.supabase.storage
                    .from('paginas-quadrinho')
                    .getPublicUrl(`capitulo-${currentChapterId}/pagina-${i}.webp`);
                imageSource = data.publicUrl;
            } else {
                // Modo Offline: Verifica sessionStorage para Blob URLs de pré-visualização ao vivo
                const sessionKey = `fio-temp-page-${currentChapterId}-${i}`;
                const tempBlobUrl = sessionStorage.getItem(sessionKey);
                if (tempBlobUrl) {
                    imageSource = tempBlobUrl;
                }
            }

            img.src = imageSource;
            
            img.onload = function() {
                const spinner = document.getElementById(`spinner-page-${i}`);
                const text = document.getElementById(`text-page-${i}`);
                if (spinner) spinner.style.display = 'none';
                if (text) text.style.display = 'none';
                
                pageWrapper.style.aspectRatio = 'auto';
                pageWrapper.style.background = 'transparent';
                pageWrapper.style.borderBottom = 'none';
                pageWrapper.style.padding = '0';
                
                img.classList.add('loaded');
            };

            img.onerror = function() {
                const spinner = document.getElementById(`spinner-page-${i}`);
                const text = document.getElementById(`text-page-${i}`);
                if (spinner) spinner.style.display = 'none';
                if (text) {
                    text.style.color = 'var(--text-secondary)';
                    text.innerHTML = `
                        <div style="font-family: 'Playfair Display', serif; font-size: 1.5rem; color: var(--primary-red); margin-bottom: 8px;">
                            Página ${i} do Capítulo ${currentChapterId}
                        </div>
                        <div style="font-size: 0.85rem; color: var(--text-muted);">
                            Artes do quadrinho indisponíveis no momento.
                        </div>
                    `;
                }
                pageWrapper.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
            };

            pageWrapper.appendChild(img);
            canvasContainer.appendChild(pageWrapper);
        }
    }

    function setupNavigation(chaptersData) {
        const sortedKeys = Object.keys(chaptersData).sort((a, b) => parseInt(a) - parseInt(b));
        const currentIndex = sortedKeys.indexOf(currentChapterId);
        
        // Botão Anterior
        if (currentIndex <= 0) {
            btnPrev.classList.add('btn-disabled');
            btnPrev.disabled = true;
        } else {
            btnPrev.classList.remove('btn-disabled');
            btnPrev.disabled = false;
            // Cria clone para limpar listeners antigos
            const newBtnPrev = btnPrev.cloneNode(true);
            btnPrev.parentNode.replaceChild(newBtnPrev, btnPrev);
            newBtnPrev.addEventListener('click', () => {
                const prevId = sortedKeys[currentIndex - 1];
                window.location.href = `ler.html?cap=${prevId}`;
            });
        }

        // Botão Próximo
        const newBtnNext = btnNext.cloneNode(true);
        btnNext.parentNode.replaceChild(newBtnNext, btnNext);

        if (currentIndex === sortedKeys.length - 1) {
            newBtnNext.textContent = "Finalizar Leitura";
            newBtnNext.addEventListener('click', () => {
                window.location.href = 'dashboard.html#chapters-list';
            });
        } else {
            newBtnNext.innerHTML = 'Próximo Capítulo <i class="fa-solid fa-arrow-right" style="margin-left: 8px;"></i>';
            newBtnNext.addEventListener('click', () => {
                const nextId = sortedKeys[currentIndex + 1];
                window.location.href = `ler.html?cap=${nextId}`;
            });
        }

        // Sincronizar Seletor de Capítulos
        if (chapterSelectEl) {
            // Remove listeners antigos substituindo por ele mesmo
            const newSelect = chapterSelectEl.cloneNode(true);
            chapterSelectEl.parentNode.replaceChild(newSelect, chapterSelectEl);
            newSelect.addEventListener('change', (e) => {
                const selectedId = e.target.value;
                window.location.href = `ler.html?cap=${selectedId}`;
            });
        }
    }

    // Inicializa a carga dinâmica
    initializeReader();
});
