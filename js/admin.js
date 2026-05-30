/* ==========================================================================
   ADMIN.HTML PORTAL LOGIC - REAL-TIME WEBP COMPRESSOR & SUPABASE STORAGE UPLOADER
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    // --- 1. Proteção de Rota & Sessão com Whitelist de Email ---
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

    const adminEmails = (window.env && window.env.ADMIN_EMAILS) || [];
    const isAdmin = session && session.user && adminEmails.includes(session.user.email);

    if (!isAdmin) {
        alert("Acesso Negado! Este painel é de uso exclusivo dos administradores e autores de Fio Vermelho.");
        window.location.replace('dashboard.html');
        return;
    }

    // --- DOM Elements ---
    const chapterForm = document.getElementById('admin-chapter-form');
    const chapterIdInput = document.getElementById('chapter-id');
    const chapterTitleInput = document.getElementById('chapter-title');
    const chapterDateInput = document.getElementById('chapter-date');
    
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('upload-file-input');
    const btnStartUpload = document.getElementById('btn-start-upload');
    const btnViewChapter = document.getElementById('btn-view-chapter');
    
    const queueContainer = document.getElementById('queue-container');
    const fileQueueEl = document.getElementById('file-queue');
    const queueCountEl = document.getElementById('queue-count');
    
    const progressBox = document.getElementById('progress-box');
    const progressBarFill = document.getElementById('progress-bar-fill');
    const progressText = document.getElementById('progress-text');
    const progressPercentage = document.getElementById('progress-percentage');
    const successBanner = document.getElementById('success-banner');

    // Fila de arquivos selecionados
    let fileQueue = [];
    let isUploading = false;

    // Inicializa a data atual como valor padrão no input
    if (chapterDateInput) {
        chapterDateInput.value = getFormattedDate();
    }

    // --- 2. Interações de Drag & Drop ---
    if (dropZone && fileInput) {
        // Clicar na zona abre o seletor de arquivos
        dropZone.addEventListener('click', () => {
            if (!isUploading) fileInput.click();
        });

        // Eventos de arrastar
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            if (!isUploading) dropZone.classList.add('dragover');
        });

        dropZone.addEventListener('dragleave', () => {
            dropZone.classList.remove('dragover');
        });

        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('dragover');
            if (isUploading) return;

            const files = e.dataTransfer.files;
            if (files.length > 0) {
                handleSelectedFiles(files);
            }
        });

        // Evento de alteração de arquivo padrão
        fileInput.addEventListener('change', (e) => {
            const files = e.target.files;
            if (files.length > 0) {
                handleSelectedFiles(files);
            }
        });
    }

    // --- 3. Processamento de Arquivos da Fila ---
    function handleSelectedFiles(files) {
        queueContainer.style.display = 'block';
        successBanner.style.display = 'none';
        btnViewChapter.style.display = 'none';

        // Converte FileList para Array e filtra apenas imagens
        const imageFiles = Array.from(files).filter(file => file.type.startsWith('image/'));

        if (imageFiles.length === 0) {
            alert("Por favor, selecione apenas arquivos de imagem (PNG, JPG, WebP).");
            return;
        }

        // Ordena arquivos alfabeticamente pelo nome para garantir ordem correta das páginas
        imageFiles.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));

        imageFiles.forEach(file => {
            const fileId = 'file_' + Math.random().toString(36).substring(2, 9);
            const tempUrl = URL.createObjectURL(file);

            const queueItem = {
                id: fileId,
                file: file,
                name: file.name,
                tempUrl: tempUrl,
                status: 'compressing', // status: compressing, compressed, uploading, success, error
                originalSize: file.size,
                compressedSize: 0,
                compressedBlob: null,
                reduction: 0,
                width: 0,
                height: 0
            };

            fileQueue.push(queueItem);
            renderQueueItem(queueItem);
            
            // Dispara compressão local assíncrona imediatamente em background
            compressImageToWebP(queueItem);
        });

        updateQueueHeader();
    }

    // --- 4. Algoritmo Client-Side de Compressão WebP via HTML5 Canvas ---
    async function compressImageToWebP(item) {
        try {
            const img = new Image();
            img.src = item.tempUrl;

            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                const maxWidth = 1600;

                // Redimensionamento proporcional se passar de 1600px de largura
                if (width > maxWidth) {
                    height = Math.round((maxWidth * height) / width);
                    width = maxWidth;
                }

                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                // Converte para WebP com 85% de qualidade
                canvas.toBlob((blob) => {
                    if (blob) {
                        item.compressedBlob = blob;
                        item.compressedSize = blob.size;
                        item.width = width;
                        item.height = height;
                        item.reduction = Math.round(((item.originalSize - blob.size) / item.originalSize) * 100);
                        item.status = 'compressed';
                        
                        updateQueueItemUI(item);
                        checkQueueReadyStatus();
                    } else {
                        throw new Error("Erro na geração do Blob WebP.");
                    }
                }, 'image/webp', 0.85);
            };

            img.onerror = () => {
                throw new Error("Erro ao carregar a imagem no canvas.");
            };

        } catch (err) {
            console.error("Erro ao comprimir imagem:", err);
            item.status = 'error';
            updateQueueItemUI(item);
            checkQueueReadyStatus();
        }
    }

    // --- 5. Renderização & Atualização Visual da Fila ---
    function renderQueueItem(item) {
        const itemHtml = `
            <div class="queue-item" id="queue-item-${item.id}">
                <img src="${item.tempUrl}" class="queue-item-thumb" alt="Thumbnail">
                <div class="queue-item-details">
                    <div class="queue-item-name">${item.name}</div>
                    <div class="queue-item-metrics" id="metrics-${item.id}">
                        <span class="metric-badge">Tamanho Original: ${formatBytes(item.originalSize)}</span>
                        <span class="metric-badge"><i class="fa-solid fa-circle-notch fa-spin"></i> Otimizando...</span>
                    </div>
                </div>
                <div class="queue-item-status" id="status-icon-${item.id}">
                    <i class="fa-solid fa-circle-notch"></i>
                </div>
            </div>
        `;
        fileQueueEl.insertAdjacentHTML('beforeend', itemHtml);
    }

    function updateQueueItemUI(item) {
        const metricsEl = document.getElementById(`metrics-${item.id}`);
        const statusIconEl = document.getElementById(`status-icon-${item.id}`);
        
        if (!metricsEl || !statusIconEl) return;

        if (item.status === 'compressed') {
            metricsEl.innerHTML = `
                <span class="metric-badge">Original: ${formatBytes(item.originalSize)}</span>
                <span class="metric-badge">WebP Otimizado: ${formatBytes(item.compressedSize)}</span>
                <span class="metric-badge saving">Economia: -${item.reduction}%</span>
                <span class="metric-badge">Dimensões: ${item.width}x${item.height}px</span>
            `;
            statusIconEl.innerHTML = '<i class="fa-solid fa-circle-check"></i>';
        } else if (item.status === 'error') {
            metricsEl.innerHTML = `
                <span class="metric-badge" style="background: rgba(255, 42, 59, 0.1); color: var(--primary-red);">Erro ao processar imagem</span>
            `;
            statusIconEl.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i>';
        } else if (item.status === 'uploading') {
            statusIconEl.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i>';
        } else if (item.status === 'success') {
            statusIconEl.innerHTML = '<i class="fa-solid fa-circle-check" style="color: var(--success-green);"></i>';
        }
    }

    function updateQueueHeader() {
        if (queueCountEl) {
            queueCountEl.textContent = `${fileQueue.length} arquivo(s) na fila`;
        }
    }

    // Libera o botão de Upload apenas se todos os arquivos foram comprimidos
    function checkQueueReadyStatus() {
        const allCompressedOrError = fileQueue.every(item => item.status === 'compressed' || item.status === 'error');
        const hasValidFiles = fileQueue.some(item => item.status === 'compressed');

        if (allCompressedOrError && hasValidFiles && !isUploading) {
            btnStartUpload.classList.remove('btn-disabled');
            btnStartUpload.removeAttribute('disabled');
        } else {
            btnStartUpload.classList.add('btn-disabled');
            btnStartUpload.setAttribute('disabled', 'true');
        }
    }

    // --- 6. Evento de Envio e Publicação do Capítulo ---
    btnStartUpload.addEventListener('click', async () => {
        if (isUploading) return;

        // Validação de Dados Cadastrais
        const chapterIdVal = chapterIdInput.value.trim();
        const chapterTitleVal = chapterTitleInput.value.trim();
        const chapterDateVal = chapterDateInput.value.trim();

        if (!chapterIdVal || !chapterTitleVal) {
            alert("❌ Por favor, preencha o Número e o Título do Capítulo!");
            return;
        }

        const chapterId = parseInt(chapterIdVal);
        isUploading = true;
        btnStartUpload.classList.add('btn-disabled');
        btnStartUpload.setAttribute('disabled', 'true');
        dropZone.style.pointerEvents = 'none';

        // Exibe a barra de progresso
        progressBox.style.display = 'block';
        successBanner.style.display = 'none';
        updateProgressBar(0, "Iniciando processamento e envio...");

        const totalFiles = fileQueue.length;
        let successfulUploadsCount = 0;

        for (let i = 0; i < totalFiles; i++) {
            const item = fileQueue[i];
            if (item.status !== 'compressed') continue;

            item.status = 'uploading';
            updateQueueItemUI(item);

            const pageIndex = i + 1;
            const fileName = `pagina-${pageIndex}.webp`;
            const filePath = `capitulo-${chapterId}/${fileName}`;

            updateProgressBar(
                Math.round((i / totalFiles) * 100),
                `Enviando página ${pageIndex} de ${totalFiles}...`
            );

            let uploadSuccess = false;

            if (window.isOfflineMode) {
                // --- MODO PROTÓTIPO LOCAL (Mock em sessionStorage/localStorage) ---
                await delay(600); // Simula latência de rede
                
                try {
                    // Armazena a Blob URL temporária na sessionStorage para exibição live no mesmo navegador
                    const sessionKey = `fio-temp-page-${chapterId}-${pageIndex}`;
                    const tempBlobUrl = URL.createObjectURL(item.compressedBlob);
                    sessionStorage.setItem(sessionKey, tempBlobUrl);

                    console.log(`🔌 [Mock Storage]: Salvo temporário ${sessionKey} ➔ ${tempBlobUrl}`);
                    uploadSuccess = true;
                } catch (err) {
                    console.error(err);
                }
            } else {
                // --- MODO PRODUÇÃO SUPABASE REAL (Storage Upload) ---
                try {
                    if (window.supabase) {
                        const { data, error } = await window.supabase.storage
                            .from('paginas-quadrinho')
                            .upload(filePath, item.compressedBlob, {
                                contentType: 'image/webp',
                                cacheControl: '3600',
                                upsert: true
                            });

                        if (error) throw error;
                        uploadSuccess = true;
                    } else {
                        throw new Error("Supabase não inicializado.");
                    }
                } catch (err) {
                    console.error(`Erro ao subir página ${pageIndex}:`, err);
                    item.status = 'error';
                    updateQueueItemUI(item);
                }
            }

            if (uploadSuccess) {
                item.status = 'success';
                updateQueueItemUI(item);
                successfulUploadsCount++;
            }
        }

        // --- Salva os metadados do capítulo ---
        if (successfulUploadsCount > 0) {
            updateProgressBar(90, "Salvando dados do capítulo...");

            if (window.isOfflineMode) {
                // Salva metadados no localStorage
                let mockChapters = JSON.parse(localStorage.getItem('fio-mock-chapters') || '[]');
                
                // Remove existente se for re-upload do mesmo ID (Upsert Mock)
                mockChapters = mockChapters.filter(c => c.id !== chapterId);
                
                mockChapters.push({
                    id: chapterId,
                    title: chapterTitleVal,
                    pages_count: successfulUploadsCount,
                    release_date: chapterDateVal || getFormattedDate()
                });

                localStorage.setItem('fio-mock-chapters', JSON.stringify(mockChapters));
                await delay(400);
            } else {
                // Insere ou atualiza (Upsert) no Supabase Database
                try {
                    if (window.supabase) {
                        const { error } = await window.supabase
                            .from('chapters')
                            .upsert({
                                id: chapterId,
                                title: chapterTitleVal,
                                pages_count: successfulUploadsCount,
                                release_date: chapterDateVal || getFormattedDate()
                            });

                        if (error) throw error;
                    }
                } catch (err) {
                    console.error("Erro ao salvar metadados do capítulo no banco:", err);
                    alert("⚠️ Páginas enviadas, mas falha ao registrar o capítulo no banco: " + err.message);
                }
            }

            // --- Conclusão com Sucesso ---
            updateProgressBar(100, "Publicação concluída!");
            await delay(500);
            progressBox.style.display = 'none';
            successBanner.style.display = 'block';
            
            // Exibe e configura o botão de visualização
            btnViewChapter.style.display = 'inline-flex';
            btnViewChapter.onclick = () => {
                window.location.href = `ler.html?cap=${chapterId}`;
            };

            // Reseta formulário e fila após sucesso parcial para novas publicações
            chapterForm.reset();
            if (chapterDateInput) chapterDateInput.value = getFormattedDate();
            fileQueue = [];
            fileQueueEl.innerHTML = '';
            queueContainer.style.display = 'none';
        } else {
            alert("❌ Falha crítica: Nenhuma página pôde ser publicada.");
            progressBox.style.display = 'none';
        }

        isUploading = false;
        dropZone.style.pointerEvents = '';
        checkQueueReadyStatus();
    });

    // --- Auxiliares ---
    function updateProgressBar(percentage, text) {
        if (progressBarFill && progressText && progressPercentage) {
            progressBarFill.style.width = `${percentage}%`;
            progressText.textContent = text;
            progressPercentage.textContent = `${percentage}%`;
        }
    }

    function formatBytes(bytes, decimals = 2) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }

    function getFormattedDate() {
        const today = new Date();
        const day = today.getDate();
        const months = [
            "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
            "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "De Dezembro"
        ];
        const month = months[today.getMonth()];
        const year = today.getFullYear();
        return `${day} de ${month}, ${year}`;
    }

    function delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
});
