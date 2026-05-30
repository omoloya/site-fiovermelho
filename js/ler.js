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
    const chaptersData = {
        "1": {
            title: "O Elo Perdido",
            pagesCount: 4,
            releaseDate: "20 de Maio, 2026"
        },
        "2": {
            title: "Cortes no Destino",
            pagesCount: 4,
            releaseDate: "25 de Maio, 2026"
        },
        "3": {
            title: "O Laço Carmim",
            pagesCount: 4,
            releaseDate: "29 de Maio, 2026"
        }
    };

    // --- DOM Elements ---
    const chapterTitleEl = document.getElementById('current-chapter-title');
    const chapterSelectEl = document.getElementById('reader-chapter-select');
    const canvasContainer = document.getElementById('webtoon-canvas-container');
    
    const btnPrev = document.getElementById('btn-prev-chapter');
    const btnNext = document.getElementById('btn-next-chapter');

    // --- 2. Leitura dos Parâmetros da URL (Query Params) ---
    const urlParams = new URLSearchParams(window.location.search);
    let currentChapterId = urlParams.get('cap');

    // Valida o capítulo da URL, se for inválido ou não existir, joga pro Capítulo 1
    if (!currentChapterId || !chaptersData[currentChapterId]) {
        currentChapterId = "1";
    }

    const currentChapter = chaptersData[currentChapterId];
    console.log(`🧶 [Reader] Lendo Capítulo ${currentChapterId}: ${currentChapter.title}`);

    // --- 3. Atualizar Estado Inicial da Interface ---
    chapterTitleEl.textContent = `Capítulo ${currentChapterId.padStart(2, '0')}: ${currentChapter.title}`;
    chapterSelectEl.value = currentChapterId;

    // --- 4. Marca o Capítulo Atual Como Lido no localStorage Automaticamente ---
    const userKey = `fio-read-chapters-${session.user.email}`;
    let readChapters = JSON.parse(localStorage.getItem(userKey) || '[]');
    if (!readChapters.includes(currentChapterId)) {
        readChapters.push(currentChapterId);
        localStorage.setItem(userKey, JSON.stringify(readChapters));
        console.log(`🧶 [Reader] Capítulo ${currentChapterId} marcado automaticamente como lido.`);
    }

    // --- 5. Renderização Vertical das Páginas do Webtoon ---
    renderWebtoonPages();

    function renderWebtoonPages() {
        // Limpa o container
        canvasContainer.innerHTML = '';
        
        const totalPages = currentChapter.pagesCount;
        
        for (let i = 1; i <= totalPages; i++) {
            // Cria um container para conter a imagem e o placeholder de esqueleto de carregamento
            const pageWrapper = document.createElement('div');
            pageWrapper.className = 'webtoon-placeholder';
            pageWrapper.id = `page-wrapper-${i}`;
            pageWrapper.innerHTML = `
                <div class="pix-status-spinner" id="spinner-page-${i}" style="width: 24px; height: 24px; border-top-color: var(--primary-red);"></div>
                <span id="text-page-${i}" style="font-size: 0.8rem; color: var(--text-muted);">Página ${i} • Carregando...</span>
            `;
            
            // Cria a imagem real
            const img = document.createElement('img');
            img.className = 'webtoon-page-img';
            img.alt = `Página ${i} do Capítulo ${currentChapterId}`;
            
            // Caminho para os arquivos físicos reais que o autor colocará futuramente
            img.src = `assets/cap${currentChapterId}_pag${i}.jpg`;
            
            // Evento: Quando a imagem carregar com sucesso
            img.onload = function() {
                const spinner = document.getElementById(`spinner-page-${i}`);
                const text = document.getElementById(`text-page-${i}`);
                if (spinner) spinner.style.display = 'none';
                if (text) text.style.display = 'none';
                
                // Transiciona a classe do wrapper para ocultar fundos de placeholder
                pageWrapper.style.aspectRatio = 'auto';
                pageWrapper.style.background = 'transparent';
                pageWrapper.style.borderBottom = 'none';
                pageWrapper.style.padding = '0';
                
                img.classList.add('loaded');
            };

            // Evento: Fallback de imagem ausente (ótimo para testes iniciais)
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

    // --- 6. Controle de Navegação entre Capítulos ---
    const totalChaptersCount = Object.keys(chaptersData).length;

    // Configura Botão Anterior
    if (currentChapterId === "1") {
        btnPrev.classList.add('btn-disabled');
        btnPrev.disabled = true;
    } else {
        btnPrev.addEventListener('click', () => {
            const prevId = (parseInt(currentChapterId) - 1).toString();
            window.location.href = `ler.html?cap=${prevId}`;
        });
    }

    // Configura Botão Próximo
    if (parseInt(currentChapterId) === totalChaptersCount) {
        btnNext.textContent = "Finalizar Leitura";
        btnNext.addEventListener('click', () => {
            window.location.href = 'dashboard.html#chapters-list';
        });
    } else {
        btnNext.addEventListener('click', () => {
            const nextId = (parseInt(currentChapterId) + 1).toString();
            window.location.href = `ler.html?cap=${nextId}`;
        });
    }

    // --- 7. Sincronizar Seletor de Capítulos ---
    chapterSelectEl.addEventListener('change', (e) => {
        const selectedId = e.target.value;
        window.location.href = `ler.html?cap=${selectedId}`;
    });
});
