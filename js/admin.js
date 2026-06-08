

document.addEventListener('DOMContentLoaded', () => {
    
    document.body.style.display = 'none';

    
    if (!window.sessionHelper) {
        
        window.location.replace('index.html');
        return;
    }

    const session = window.sessionHelper.getSession();
    if (!session) {
        window.location.replace('index.html');
        return;
    }

    (async () => {
        let isAuthor = false;
        if (window.isOfflineMode) {
            isAuthor = session && session.user && session.user.email.includes("admin");
        } else {
            try {
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
                        isAuthor = adminCheckJson.isAdmin;
                    }
                }
            } catch (e) {
                
            }
        }

        if (!isAuthor) {
            alert("Acesso Negado! Este painel é de uso exclusivo dos administradores e autores de Fio Vermelho.");
            window.location.replace('dashboard.html');
        } else {
            document.body.style.display = ''; 
        }
    })();

    
    const chapterForm = document.getElementById('admin-chapter-form');
    const chapterIdInput = document.getElementById('chapter-id');
    const chapterTitleInput = document.getElementById('chapter-title');
    const chapterDateInput = document.getElementById('chapter-date');
    const btnCancelEdit = document.getElementById('btn-cancel-edit');
    
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

    
    const adminChaptersList = document.getElementById('admin-chapters-list');
    const pageManagerCard = document.getElementById('page-manager-card');
    const pageManagerTitle = document.getElementById('page-manager-title');
    const pageManagerGrid = document.getElementById('page-manager-grid');
    const replacePageFileInput = document.getElementById('replace-page-file-input');

    
    let fileQueue = [];
    let isUploading = false;
    
    
    let isEditMode = false;
    let editingChapterId = null;
    let replacingPageIndex = null;
    let chaptersListCache = [];

    const defaultChapters = [
        { id: 1, title: "O Elo Perdido", pages_count: 4, release_date: "20 de Maio, 2026" },
        { id: 2, title: "Cortes no Destino", pages_count: 4, release_date: "25 de Maio, 2026" },
        { id: 3, title: "O Laço Carmim", pages_count: 4, release_date: "29 de Maio, 2026" }
    ];

    
    if (chapterDateInput) {
        chapterDateInput.value = getFormattedDate();
    }

    
    if (dropZone && fileInput) {
        dropZone.addEventListener('click', () => {
            if (!isUploading) fileInput.click();
        });

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

        fileInput.addEventListener('change', (e) => {
            const files = e.target.files;
            if (files.length > 0) {
                handleSelectedFiles(files);
            }
        });
    }

    function blobToBase64(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }

    
    function handleSelectedFiles(files) {
        queueContainer.style.display = 'block';
        successBanner.style.display = 'none';
        btnViewChapter.style.display = 'none';

        const imageFiles = Array.from(files).filter(file => file.type.startsWith('image/'));

        if (imageFiles.length === 0) {
            alert("Por favor, selecione apenas arquivos de imagem (PNG, JPG, WebP).");
            return;
        }

        imageFiles.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));

        imageFiles.forEach(file => {
            const fileId = 'file_' + Math.random().toString(36).substring(2, 9);
            const tempUrl = URL.createObjectURL(file);

            const queueItem = {
                id: fileId,
                file: file,
                name: file.name,
                tempUrl: tempUrl,
                status: 'compressing',
                originalSize: file.size,
                compressedSize: 0,
                compressedBlob: null,
                reduction: 0,
                width: 0,
                height: 0
            };

            fileQueue.push(queueItem);
            renderQueueItem(queueItem);
            
            
            const addedItemEl = document.getElementById(`queue-item-${fileId}`);
            if (addedItemEl) {
                const btnRemove = addedItemEl.querySelector('.btn-remove-queue-item');
                if (btnRemove) {
                    btnRemove.addEventListener('click', () => {
                        removeQueueItem(fileId);
                    });
                }
            }

            compressImageToWebP(queueItem);
        });

        updateQueueHeader();
    }

    
    async function compressImageToWebP(item) {
        try {
            const img = new Image();
            img.src = item.tempUrl;

            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                const maxWidth = 1600;

                if (width > maxWidth) {
                    height = Math.round((maxWidth * height) / width);
                    width = maxWidth;
                }

                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

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
            
            item.status = 'error';
            updateQueueItemUI(item);
            checkQueueReadyStatus();
        }
    }

    
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
                <div style="display: flex; align-items: center; gap: 12px; margin-left: auto;">
                    <div class="queue-item-status" id="status-icon-${item.id}">
                        <i class="fa-solid fa-circle-notch"></i>
                    </div>
                    <button type="button" class="btn btn-secondary btn-action-icon delete btn-remove-queue-item" data-id="${item.id}" title="Remover da fila" style="width: 28px; height: 28px; min-width: 28px; font-size: 0.8rem;">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>
            </div>
        `;
        fileQueueEl.insertAdjacentHTML('beforeend', itemHtml);
    }

    function removeQueueItem(fileId) {
        if (isUploading) return;
        const item = fileQueue.find(q => q.id === fileId);
        if (!item) return;

        
        if (item.tempUrl) {
            URL.revokeObjectURL(item.tempUrl);
        }

        
        const el = document.getElementById(`queue-item-${fileId}`);
        if (el) el.remove();

        
        fileQueue = fileQueue.filter(q => q.id !== fileId);

        
        updateQueueHeader();
        checkQueueReadyStatus();

        
        if (fileQueue.length === 0) {
            queueContainer.style.display = 'none';
        }
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

    
    btnStartUpload.addEventListener('click', async () => {
        if (isUploading) return;

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

        progressBox.style.display = 'block';
        successBanner.style.display = 'none';
        updateProgressBar(0, "Iniciando processamento e envio...");

        
        let startPageIndex = 0;
        if (isEditMode) {
            const currentEditingChapter = chaptersListCache.find(c => c.id === chapterId);
            if (currentEditingChapter) {
                startPageIndex = currentEditingChapter.pages_count;
            }
        }

        const totalFiles = fileQueue.length;
        let successfulUploadsCount = 0;

        for (let i = 0; i < totalFiles; i++) {
            const item = fileQueue[i];
            if (item.status !== 'compressed') continue;

            item.status = 'uploading';
            updateQueueItemUI(item);

            const pageIndex = startPageIndex + i + 1;
            const fileName = `pagina-${pageIndex}.webp`;
            const filePath = `capitulo-${chapterId}/${fileName}`;

            updateProgressBar(
                Math.round((i / totalFiles) * 100),
                `Enviando página ${pageIndex} de ${startPageIndex + totalFiles}...`
            );

            let uploadSuccess = false;

            if (window.isOfflineMode) {
                
                await delay(500);
                try {
                    const sessionKey = `fio-temp-page-${chapterId}-${pageIndex}`;
                    const tempBlobUrl = URL.createObjectURL(item.compressedBlob);
                    sessionStorage.setItem(sessionKey, tempBlobUrl);
                    uploadSuccess = true;
                } catch (err) {
                    
                }
            } else {
                
                try {
                    const { data: authData } = await window.supabase.auth.getSession();
                    const sessionToken = authData?.session?.access_token;
                    if (!sessionToken) throw new Error("Sessão expirada ou não autenticada.");

                    const base64Data = await blobToBase64(item.compressedBlob);

                    const res = await fetch('/api/admin-operations', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${sessionToken}`
                        },
                        body: JSON.stringify({
                            action: 'upload-page',
                            chapterId: chapterId,
                            pageIndex: pageIndex,
                            fileData: base64Data
                        })
                    });

                    if (!res.ok) {
                        const errJson = await res.json();
                        throw new Error(errJson.error || 'Falha ao enviar página via backend');
                    }

                    uploadSuccess = true;
                } catch (err) {
                    
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

        const finalPagesCount = startPageIndex + successfulUploadsCount;

        if (successfulUploadsCount > 0 || isEditMode) {
            updateProgressBar(90, "Salvando dados do capítulo...");

            if (window.isOfflineMode) {
                let mockChapters = JSON.parse(localStorage.getItem('fio-mock-chapters') || '[]');
                mockChapters = mockChapters.filter(c => c.id !== chapterId);
                
                mockChapters.push({
                    id: chapterId,
                    title: chapterTitleVal,
                    pages_count: isEditMode ? finalPagesCount : successfulUploadsCount,
                    release_date: chapterDateVal || getFormattedDate()
                });

                localStorage.setItem('fio-mock-chapters', JSON.stringify(mockChapters));
                await delay(400);
            } else {
                try {
                    const { data: authData } = await window.supabase.auth.getSession();
                    const sessionToken = authData?.session?.access_token;
                    if (!sessionToken) throw new Error("Sessão expirada ou não autenticada.");

                    const res = await fetch('/api/admin-operations', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${sessionToken}`
                        },
                        body: JSON.stringify({
                            action: 'upsert-chapter',
                            chapterId: chapterId,
                            title: chapterTitleVal,
                            pagesCount: isEditMode ? finalPagesCount : successfulUploadsCount,
                            releaseDate: chapterDateVal || getFormattedDate()
                        })
                    });

                    if (!res.ok) {
                        const errJson = await res.json();
                        throw new Error(errJson.error || 'Falha ao salvar capítulo via backend');
                    }
                } catch (err) {
                    
                    alert("⚠️ Falha ao registrar capítulo no banco: " + err.message);
                }
            }

            updateProgressBar(100, "Publicação concluída!");
            await delay(500);
            progressBox.style.display = 'none';
            successBanner.style.display = 'block';
            
            btnViewChapter.style.display = 'inline-flex';
            btnViewChapter.onclick = () => {
                window.location.href = `ler.html?cap=${chapterId}`;
            };

            
            await loadChaptersList();
            exitEditMode();
        } else {
            alert("❌ Falha crítica: Nenhuma nova página pôde ser publicada.");
            progressBox.style.display = 'none';
        }

        isUploading = false;
        dropZone.style.pointerEvents = '';
        checkQueueReadyStatus();
    });

    

    async function loadChaptersList() {
        let chapters = [];

        if (window.isOfflineMode) {
            
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
            
            try {
                if (window.supabase) {
                    const { data, error } = await window.supabase
                        .from('chapters')
                        .select('id, title, pages_count, release_date')
                        .order('id', { ascending: true });

                    if (!error && data && data.length > 0) {
                        chapters = data;
                    } else {
                        chapters = [...defaultChapters];
                    }
                }
            } catch (err) {
                
                chapters = [...defaultChapters];
            }
        }

        chaptersListCache = chapters;
        renderChaptersListUI(chapters);
        populateNewsletterChapters(chapters);
    }

    function renderChaptersListUI(chapters) {
        if (!adminChaptersList) return;
        adminChaptersList.innerHTML = '';

        if (chapters.length === 0) {
            adminChaptersList.innerHTML = `<div style="text-align: center; color: var(--text-muted); font-size: 0.85rem; padding: 20px 0;">Nenhum capítulo publicado.</div>`;
            return;
        }

        chapters.forEach(chap => {
            const item = document.createElement('div');
            item.className = 'admin-chapter-item';
            item.innerHTML = `
                <div class="admin-chapter-item-info">
                    <div class="admin-chapter-item-title">Cap. ${chap.id.toString().padStart(2, '0')} - ${chap.title}</div>
                    <div class="admin-chapter-item-meta">${chap.pages_count} página(s) • Lançamento: ${chap.release_date}</div>
                </div>
                <div class="admin-chapter-item-actions">
                    <button class="btn btn-secondary btn-action-icon btn-edit-chap" data-id="${chap.id}" title="Editar capítulo e páginas">
                        <i class="fa-solid fa-pen"></i>
                    </button>
                    <button class="btn btn-secondary btn-action-icon delete btn-delete-chap" data-id="${chap.id}" title="Excluir capítulo inteiro">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            `;

            
            item.querySelector('.btn-edit-chap').addEventListener('click', () => {
                enterEditMode(chap.id);
            });

            
            item.querySelector('.btn-delete-chap').addEventListener('click', () => {
                confirmDeleteChapter(chap.id);
            });

            adminChaptersList.appendChild(item);
        });
    }

    
    function enterEditMode(chapterId) {
        const chap = chaptersListCache.find(c => c.id === chapterId);
        if (!chap) return;

        isEditMode = true;
        editingChapterId = chapterId;
        successBanner.style.display = 'none';

        
        chapterIdInput.value = chap.id;
        chapterIdInput.setAttribute('disabled', 'true'); 
        chapterTitleInput.value = chap.title;
        chapterDateInput.value = chap.release_date;

        
        if (btnCancelEdit) btnCancelEdit.style.display = 'block';

        
        const leftCardTitle = document.querySelector('#admin-chapter-data-card .admin-card-title');
        if (leftCardTitle) {
            leftCardTitle.innerHTML = `<i class="fa-solid fa-pen-to-square"></i> Editar Capítulo ${chap.id.toString().padStart(2, '0')}`;
        }

        const rightCardTitle = document.querySelector('#admin-upload-card .admin-card-title');
        if (rightCardTitle) {
            rightCardTitle.innerHTML = `<i class="fa-solid fa-plus"></i> Adicionar Páginas ao Capítulo ${chap.id.toString().padStart(2, '0')}`;
        }

        const dropZoneText = document.querySelector('.drop-zone-text');
        if (dropZoneText) {
            dropZoneText.innerHTML = `Arraste <span style="color: var(--primary-red); font-weight: 600;">páginas adicionais</span> aqui para incluir ao final, ou clique para navegar`;
        }

        btnStartUpload.innerHTML = '<i class="fa-solid fa-floppy-disk" style="margin-right: 8px;"></i> Salvar Alterações';

        
        if (pageManagerCard && pageManagerTitle) {
            pageManagerCard.style.display = 'block';
            pageManagerTitle.innerHTML = `<i class="fa-solid fa-photo-film"></i> Gerenciador de Páginas: Capítulo ${chap.id.toString().padStart(2, '0')}`;
            renderPageManagerGrid(chap.id, chap.pages_count);
        }

        
        chapterForm.scrollIntoView({ behavior: 'smooth' });
    }

    
    function exitEditMode() {
        isEditMode = false;
        editingChapterId = null;

        
        chapterForm.reset();
        chapterIdInput.removeAttribute('disabled');
        if (chapterDateInput) chapterDateInput.value = getFormattedDate();

        
        if (btnCancelEdit) btnCancelEdit.style.display = 'none';

        
        const leftCardTitle = document.querySelector('#admin-chapter-data-card .admin-card-title');
        if (leftCardTitle) {
            leftCardTitle.innerHTML = `<i class="fa-solid fa-folder-plus"></i> Dados do Capítulo`;
        }

        const rightCardTitle = document.querySelector('#admin-upload-card .admin-card-title');
        if (rightCardTitle) {
            rightCardTitle.innerHTML = `<i class="fa-solid fa-images"></i> Upload & Otimização de Páginas`;
        }

        const dropZoneText = document.querySelector('.drop-zone-text');
        if (dropZoneText) {
            dropZoneText.innerHTML = `Arraste as páginas do quadrinho aqui ou <span style="color: var(--primary-red); font-weight: 600;">clique para navegar</span>`;
        }

        btnStartUpload.innerHTML = '<i class="fa-solid fa-upload" style="margin-right: 8px;"></i> Publicar Capítulo';

        
        if (pageManagerCard) {
            pageManagerCard.style.display = 'none';
        }

        
        fileQueue = [];
        fileQueueEl.innerHTML = '';
        queueContainer.style.display = 'none';
        checkQueueReadyStatus();
    }

    if (btnCancelEdit) {
        btnCancelEdit.addEventListener('click', () => {
            exitEditMode();
        });
    }

    

    
    function renderPageManagerGrid(chapterId, pagesCount) {
        if (!pageManagerGrid) return;
        pageManagerGrid.innerHTML = '';

        if (pagesCount === 0) {
            pageManagerGrid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); font-size: 0.85rem; padding: 20px 0;">Este capítulo não possui páginas cadastradas.</div>`;
            return;
        }

        for (let i = 1; i <= pagesCount; i++) {
            
            let thumbUrl = `assets/cap${chapterId}_pag${i}.jpg`; 
            let isUsingSupabase = false;
            
            if (!window.isOfflineMode && window.supabase) {
                try {
                    const res = window.supabase.storage
                        .from('paginas-quadrinho')
                        .getPublicUrl(`capitulo-${chapterId}/pagina-${i}.webp`);
                    if (res && res.data && res.data.publicUrl) {
                        thumbUrl = res.data.publicUrl;
                        isUsingSupabase = true;
                    } else if (res && res.publicURL) {
                        thumbUrl = res.publicURL;
                        isUsingSupabase = true;
                    } else if (typeof res === 'string') {
                        thumbUrl = res;
                        isUsingSupabase = true;
                    }
                } catch (urlErr) {
                    
                }
            } else {
                const sessionKey = `fio-temp-page-${chapterId}-${i}`;
                const tempBlob = sessionStorage.getItem(sessionKey);
                if (tempBlob) thumbUrl = tempBlob;
            }

            const pageItem = document.createElement('div');
            pageItem.className = 'page-manager-item';
            pageItem.id = `page-item-wrapper-${i}`;
            pageItem.innerHTML = `
                <div class="page-manager-thumb-container">
                    <img src="${thumbUrl}" class="page-manager-thumb" alt="Página ${i}" onerror="if (${isUsingSupabase}) { this.onerror=null; this.src='assets/cap${chapterId}_pag${i}.jpg'; } else { this.onerror=null; this.src='assets/chapter1_thumb.jpg'; }">
                </div>
                <div class="page-manager-label" id="page-label-${i}">Página ${i}</div>
                <div class="page-manager-actions" id="page-actions-${i}">
                    <button class="btn btn-secondary btn-page-replace" data-index="${i}" title="Substituir imagem da página">
                        <i class="fa-solid fa-arrows-rotate"></i>
                    </button>
                    <button class="btn btn-secondary btn-page-delete" data-index="${i}" title="Apagar página e reordenar">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            `;

            
            pageItem.querySelector('.btn-page-replace').addEventListener('click', (e) => {
                const index = parseInt(e.currentTarget.getAttribute('data-index'));
                replacingPageIndex = index;
                if (replacePageFileInput) replacePageFileInput.click();
            });

            
            pageItem.querySelector('.btn-page-delete').addEventListener('click', (e) => {
                const index = parseInt(e.currentTarget.getAttribute('data-index'));
                confirmDeletePage(chapterId, index, pagesCount);
            });

            pageManagerGrid.appendChild(pageItem);
        }
    }

    
    if (replacePageFileInput) {
        replacePageFileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file || replacingPageIndex === null || editingChapterId === null) return;

            const chapterId = editingChapterId;
            const pageIndex = replacingPageIndex;

            
            const itemWrapper = document.getElementById(`page-item-wrapper-${pageIndex}`);
            const actionsContainer = document.getElementById(`page-actions-${pageIndex}`);
            const labelContainer = document.getElementById(`page-label-${pageIndex}`);
            
            if (actionsContainer) actionsContainer.style.display = 'none';
            if (labelContainer) {
                labelContainer.innerHTML = '<div class="pix-status-spinner" style="width:16px; height:16px; margin:0 auto; border-top-color:var(--primary-red);"></div> Comprimindo...';
            }

            try {
                
                const tempUrl = URL.createObjectURL(file);
                const compressed = await compressSingleFileWebP(file, tempUrl);

                if (labelContainer) {
                    labelContainer.innerHTML = '<div class="pix-status-spinner" style="width:16px; height:16px; margin:0 auto; border-top-color:var(--primary-red);"></div> Enviando...';
                }

                if (window.isOfflineMode) {
                    
                    await delay(600);
                    const sessionKey = `fio-temp-page-${chapterId}-${pageIndex}`;
                    const tempBlobUrl = URL.createObjectURL(compressed.blob);
                    sessionStorage.setItem(sessionKey, tempBlobUrl);
                } else {
                    
                    const { data: authData } = await window.supabase.auth.getSession();
                    const sessionToken = authData?.session?.access_token;
                    if (!sessionToken) throw new Error("Sessão expirada ou não autenticada.");

                    const base64Data = await blobToBase64(compressed.blob);

                    const res = await fetch('/api/admin-operations', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${sessionToken}`
                        },
                        body: JSON.stringify({
                            action: 'replace-page',
                            chapterId: chapterId,
                            pageIndex: pageIndex,
                            fileData: base64Data
                        })
                    });

                    if (!res.ok) {
                        const errJson = await res.json();
                        throw new Error(errJson.error || 'Falha ao substituir página via backend');
                    }
                }

                
                replacePageFileInput.value = '';
                replacingPageIndex = null;

                
                renderPageManagerGrid(chapterId, chaptersListCache.find(c => c.id === chapterId).pages_count);
                alert(`Página ${pageIndex} substituída com sucesso!`);

            } catch (err) {
                
                alert("Erro ao substituir página: " + err.message);
                if (actionsContainer) actionsContainer.style.display = 'flex';
                if (labelContainer) labelContainer.textContent = `Página ${pageIndex}`;
            }
        });
    }

    
    function compressSingleFileWebP(file, tempUrl) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.src = tempUrl;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                const maxWidth = 1600;

                if (width > maxWidth) {
                    height = Math.round((maxWidth * height) / width);
                    width = maxWidth;
                }

                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                canvas.toBlob((blob) => {
                    if (blob) {
                        resolve({ blob: blob });
                    } else {
                        reject(new Error("Falha ao exportar Blob WebP."));
                    }
                }, 'image/webp', 0.85);
            };
            img.onerror = () => reject(new Error("Erro ao carregar a imagem no Canvas."));
        });
    }

    
    async function confirmDeletePage(chapterId, pageIndex, totalPages) {
        const confirmMsg = `Tem certeza que deseja apagar a Página ${pageIndex}? \n\nO sistema irá reordenar todas as páginas seguintes automaticamente para manter a sequência do leitor íntegra (Evitando quebras visuais!).`;
        
        if (!confirm(confirmMsg)) return;

        
        if (pageManagerGrid) {
            pageManagerGrid.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; color: var(--text-secondary); padding: 40px 0;">
                    <div class="pix-status-spinner" style="margin:0 auto 16px auto; border-top-color:var(--primary-red);"></div>
                    Apagando e Reordenando páginas no Storage...
                </div>
            `;
        }

        try {
            if (window.isOfflineMode) {
                
                await delay(600);
                sessionStorage.removeItem(`fio-temp-page-${chapterId}-${pageIndex}`);
                
                
                for (let i = pageIndex + 1; i <= totalPages; i++) {
                    const tempVal = sessionStorage.getItem(`fio-temp-page-${chapterId}-${i}`);
                    if (tempVal) {
                        sessionStorage.setItem(`fio-temp-page-${chapterId}-${i-1}`, tempVal);
                        sessionStorage.removeItem(`fio-temp-page-${chapterId}-${i}`);
                    }
                }

                
                let mockChapters = JSON.parse(localStorage.getItem('fio-mock-chapters') || '[]');
                const chapIdx = mockChapters.findIndex(c => c.id === chapterId);
                if (chapIdx !== -1) {
                    mockChapters[chapIdx].pages_count = totalPages - 1;
                    localStorage.setItem('fio-mock-chapters', JSON.stringify(mockChapters));
                }
            } else {
                
                const { data: authData } = await window.supabase.auth.getSession();
                const sessionToken = authData?.session?.access_token;
                if (!sessionToken) throw new Error("Sessão expirada ou não autenticada.");

                const res = await fetch('/api/admin-operations', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${sessionToken}`
                    },
                    body: JSON.stringify({
                        action: 'delete-page',
                        chapterId: chapterId,
                        pageIndex: pageIndex,
                        totalPages: totalPages
                    })
                });

                if (!res.ok) {
                    const errJson = await res.json();
                    throw new Error(errJson.error || 'Falha ao deletar página via backend');
                }
            }

            
            await loadChaptersList();
            
            
            const updatedPagesCount = totalPages - 1;
            renderPageManagerGrid(chapterId, updatedPagesCount);

            
            const currentEditingChapter = chaptersListCache.find(c => c.id === chapterId);
            if (currentEditingChapter) {
                enterEditMode(chapterId);
            }

            alert(`Página ${pageIndex} excluída e sequência reordenada com sucesso!`);

        } catch (err) {
            
            alert("Erro na exclusão de página: " + err.message);
            loadChaptersList();
            exitEditMode();
        }
    }

    
    async function confirmDeleteChapter(chapterId) {
        const confirmMsg = `⚠️ ALERTA CRÍTICO: \n\nTem certeza absoluta que deseja excluir o CAPÍTULO ${chapterId.toString().padStart(2, '0')} inteiro? \n\nIsso apagará permanentemente o registro no banco de dados e TODAS as imagens das páginas no storage! Esta ação é irreversível.`;

        if (!confirm(confirmMsg)) return;

        if (adminChaptersList) {
            adminChaptersList.innerHTML = `
                <div style="text-align: center; color: var(--text-secondary); padding: 40px 0;">
                    <div class="pix-status-spinner" style="margin:0 auto 16px auto; border-top-color:var(--primary-red);"></div>
                    Excluindo Capítulo e Purgando arquivos do Storage...
                </div>
            `;
        }

        try {
            if (window.isOfflineMode) {
                
                await delay(800);
                let mockChapters = JSON.parse(localStorage.getItem('fio-mock-chapters') || '[]');
                mockChapters = mockChapters.filter(c => c.id !== chapterId);
                localStorage.setItem('fio-mock-chapters', JSON.stringify(mockChapters));

                
                for (let i = 1; i <= 30; i++) {
                    sessionStorage.removeItem(`fio-temp-page-${chapterId}-${i}`);
                }
            } else {
                
                const { data: authData } = await window.supabase.auth.getSession();
                const sessionToken = authData?.session?.access_token;
                if (!sessionToken) throw new Error("Sessão expirada ou não autenticada.");

                const res = await fetch('/api/admin-operations', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${sessionToken}`
                    },
                    body: JSON.stringify({
                        action: 'delete-chapter',
                        chapterId: chapterId
                    })
                });

                if (!res.ok) {
                    const errJson = await res.json();
                    throw new Error(errJson.error || 'Falha ao excluir capítulo via backend');
                }
            }

            alert(`Capítulo ${chapterId} e todas as suas imagens foram excluídos com sucesso!`);
            
            
            if (isEditMode && editingChapterId === chapterId) {
                exitEditMode();
            }

            await loadChaptersList();

        } catch (err) {
            
            alert("Erro ao excluir capítulo: " + err.message);
            loadChaptersList();
        }
    }

    
    
    
    let newsletterCompressedBlob = null;

    const newsletterForm = document.getElementById('admin-newsletter-form');
    const newsletterArtFile = document.getElementById('newsletter-art-file');
    const newsletterArtPreviewContainer = document.getElementById('newsletter-art-preview-container');
    const newsletterArtPreview = document.getElementById('newsletter-art-preview');
    const newsletterArtInfo = document.getElementById('newsletter-art-info');
    const newsletterChapterSelect = document.getElementById('newsletter-chapter-select');
    const newsletterMessage = document.getElementById('newsletter-message');
    const btnSendNewsletter = document.getElementById('btn-send-newsletter');

    
    if (newsletterArtFile) {
        newsletterArtFile.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            if (newsletterArtInfo) {
                newsletterArtInfo.textContent = "Comprimindo imagem para WebP...";
            }
            if (newsletterArtPreviewContainer) {
                newsletterArtPreviewContainer.style.display = 'block';
            }

            const tempUrl = URL.createObjectURL(file);
            const img = new Image();
            img.src = tempUrl;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                const maxWidth = 1200; 

                if (width > maxWidth) {
                    height = Math.round((maxWidth * height) / width);
                    width = maxWidth;
                }

                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                canvas.toBlob((blob) => {
                    URL.revokeObjectURL(tempUrl);
                    if (blob) {
                        newsletterCompressedBlob = blob;
                        const previewUrl = URL.createObjectURL(blob);
                        if (newsletterArtPreview) {
                            newsletterArtPreview.src = previewUrl;
                        }
                        
                        const origSize = formatBytes(file.size);
                        const compSize = formatBytes(blob.size);
                        const reduction = Math.round(((file.size - blob.size) / file.size) * 100);
                        
                        if (newsletterArtInfo) {
                            newsletterArtInfo.textContent = `Original: ${origSize} | WebP: ${compSize} | Redução: ${reduction}%`;
                        }
                    } else {
                        alert("Falha ao processar imagem.");
                        if (newsletterArtInfo) newsletterArtInfo.textContent = "Erro na compressão.";
                    }
                }, 'image/webp', 0.85);
            };
            img.onerror = () => {
                URL.revokeObjectURL(tempUrl);
                alert("Falha ao carregar imagem no Canvas.");
                if (newsletterArtInfo) newsletterArtInfo.textContent = "Erro ao carregar imagem.";
            };
        });
    }

    
    function populateNewsletterChapters(chapters) {
        if (!newsletterChapterSelect) return;
        newsletterChapterSelect.innerHTML = '<option value="" disabled selected>Selecione um capítulo relacionado...</option>';
        chapters.forEach(chap => {
            const opt = document.createElement('option');
            opt.value = `${window.location.origin}/ler.html?cap=${chap.id}`;
            opt.textContent = `Capítulo ${chap.id.toString().padStart(2, '0')} - ${chap.title}`;
            newsletterChapterSelect.appendChild(opt);
        });
    }

    
    if (newsletterForm) {
        newsletterForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            if (!newsletterCompressedBlob) {
                alert("Por favor, selecione e comprima uma imagem de arte primeiro!");
                return;
            }

            const chapterUrl = newsletterChapterSelect.value;
            const message = newsletterMessage.value.trim();

            if (!chapterUrl || !message) {
                alert("Por favor, preencha todos os campos obrigatórios!");
                return;
            }

            const confirmMsg = "Atenção, kyoudai! Esta ação disparará a newsletter contendo a mensagem e a arte exclusiva para TODOS os inscritos. Deseja prosseguir?";
            if (!confirm(confirmMsg)) return;

            
            if (btnSendNewsletter) {
                btnSendNewsletter.disabled = true;
                btnSendNewsletter.innerHTML = '<div class="pix-status-spinner" style="width:14px; height:14px; margin-right:8px; border-top-color:#fff; display:inline-block; vertical-align:middle;"></div> Disparando...';
            }

            let artUrl = '';

            try {
                if (window.isOfflineMode) {
                    
                    await delay(1000);
                    artUrl = URL.createObjectURL(newsletterCompressedBlob);
                } else {
                    
                    const { data: authData } = await window.supabase.auth.getSession();
                    const sessionToken = authData?.session?.access_token;
                    if (!sessionToken) throw new Error("Sessão expirada ou não autenticada.");

                    const base64Data = await blobToBase64(newsletterCompressedBlob);

                    const uploadRes = await fetch('/api/admin-operations', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${sessionToken}`
                        },
                        body: JSON.stringify({
                            action: 'upload-newsletter-art',
                            fileData: base64Data
                        })
                    });

                    if (!uploadRes.ok) {
                        const errJson = await uploadRes.json();
                        throw new Error(errJson.error || 'Erro ao fazer upload da arte');
                    }

                    const uploadData = await uploadRes.json();
                    artUrl = uploadData.publicUrl;
                }

                
                let sessionToken = '';
                if (!window.isOfflineMode && window.supabase) {
                    const { data: authData } = await window.supabase.auth.getSession();
                    sessionToken = authData?.session?.access_token;
                }

                const dispatchRes = await fetch('/api/disparar-newsletter', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': sessionToken ? `Bearer ${sessionToken}` : ''
                    },
                    body: JSON.stringify({
                        message,
                        artUrl,
                        chapterUrl
                    })
                });

                const dispatchData = await dispatchRes.json();

                if (!dispatchRes.ok) {
                    const errMsg = dispatchData.details 
                        ? `${dispatchData.error}\nDetalhes: ${dispatchData.details}` 
                        : (dispatchData.error || 'Erro ao disparar e-mails.');
                    throw new Error(errMsg);
                }

                alert(`🚀 Newsletter disparada com sucesso para ${dispatchData.recipientsCount || 0} leitores cadastrados!`);
                
                
                newsletterForm.reset();
                newsletterCompressedBlob = null;
                if (newsletterArtPreviewContainer) {
                    newsletterArtPreviewContainer.style.display = 'none';
                }
                if (newsletterArtPreview) {
                    newsletterArtPreview.src = '';
                }
            } catch (err) {
                
                alert("❌ Falha no disparo da newsletter: " + err.message);
            } finally {
                if (btnSendNewsletter) {
                    btnSendNewsletter.disabled = false;
                    btnSendNewsletter.innerHTML = '<i class="fa-solid fa-rocket" style="margin-right: 8px;"></i> Disparar Newsletter para Inscritos';
                }
            }
        });
    }

    
    loadChaptersList();

    
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
