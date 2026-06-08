

document.addEventListener('DOMContentLoaded', () => {
    
    if ('scrollRestoration' in history) {
        history.scrollRestoration = 'manual';
    }

    
    if (!window.sessionHelper) {
        
        window.location.replace('index.html');
        return;
    }

    const session = window.sessionHelper.getSession();
    if (!session) {
        window.location.replace('index.html');
        return;
    }

    
    
    let isSuperAdmin = false;

    function applyIntellectualPropertyProtection() {
        if (!isSuperAdmin) {
            
            document.addEventListener('contextmenu', (e) => {
                if (isSuperAdmin) return;
                e.preventDefault();
                return false;
            });

            
            document.addEventListener('keydown', (e) => {
                if (isSuperAdmin) return;
                
                if (e.key === 'F12' || e.keyCode === 123) {
                    e.preventDefault();
                    return false;
                }
                
                if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                    e.preventDefault();
                    return false;
                }
                
                if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
                    e.preventDefault();
                    return false;
                }
                
                if ((e.ctrlKey && e.shiftKey && e.key === 'I') || (e.metaKey && e.altKey && e.key === 'i')) {
                    e.preventDefault();
                    return false;
                }
                
                if ((e.ctrlKey && e.shiftKey && e.key === 'J') || (e.metaKey && e.altKey && e.key === 'j')) {
                    e.preventDefault();
                    return false;
                }
                
                if ((e.ctrlKey || e.metaKey) && e.key === 'u') {
                    e.preventDefault();
                    return false;
                }
            });

            
            document.addEventListener('dragstart', (e) => {
                if (isSuperAdmin) return;
                if (e.target.tagName === 'IMG') {
                    e.preventDefault();
                    return false;
                }
            });

            
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
    }

    
    applyIntellectualPropertyProtection();

    
    (async () => {
        if (window.isOfflineMode) {
            isSuperAdmin = session && session.user && session.user.email.includes("admin");
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
                        isSuperAdmin = adminCheckJson.isAdmin;
                    } else {
                        const errJson = await adminCheckRes.json().catch(() => ({}));
                        
                    }
                }
            } catch (e) {
                
            }
        }

        
        if (isSuperAdmin) {
            document.querySelectorAll('img').forEach(img => {
                img.classList.remove('protected-image');
                img.removeAttribute('draggable');
            });
        }
    })();

    
    checkProfileStatus();

    async function checkProfileStatus() {
        let status = 'pendente_verificacao';
        let userId = null;

        
        if (!window.isOfflineMode && window.supabase) {
            try {
                if (typeof window.supabase.auth.getUser === 'function') {
                    const { data } = await window.supabase.auth.getUser();
                    if (data && data.user) {
                        userId = data.user.id;
                        
                        if (window.sessionHelper && session) {
                            window.sessionHelper.setSession(session.user.email, session.is_verified, userId);
                        }
                    }
                }
            } catch (e) {
                
            }
        }

        
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
                        
                        status = 'pendente_verificacao';
                    } else {
                        const { data: profile, error } = await window.supabase
                            .from('profiles')
                            .select('status')
                            .eq('id', userId)
                            .maybeSingle();

                        if (!error && profile) {
                            status = profile.status;
                        }
                    }
                }
            } catch (err) {
                
            }
        }

        
        let isUserAdmin = false;
        if (window.isOfflineMode) {
            isUserAdmin = session && session.user && session.user.email.includes("admin");
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
                        isUserAdmin = adminCheckJson.isAdmin;
                    } else {
                        const errJson = await adminCheckRes.json().catch(() => ({}));
                        
                    }
                }
            } catch (e) {
                
            }
        }

        if (isUserAdmin) {
            status = 'verificado';
        }

        
        if (status === 'pendente_verificacao') {
            window.location.replace('dashboard.html');
        }
    }

    
    const defaultChapters = {
        "1": { title: "O Elo Perdido", pagesCount: 4, releaseDate: "20 de Maio, 2026" },
        "2": { title: "Cortes no Destino", pagesCount: 4, releaseDate: "25 de Maio, 2026" },
        "3": { title: "O Laço Carmim", pagesCount: 4, releaseDate: "29 de Maio, 2026" }
    };

    let chaptersData = { ...defaultChapters };

    
    const chapterTitleEl = document.getElementById('current-chapter-title');
    const chapterSelectEl = document.getElementById('reader-chapter-select');
    const canvasContainer = document.getElementById('webtoon-canvas-container');
    
    const btnPrev = document.getElementById('btn-prev-chapter');
    const btnNext = document.getElementById('btn-next-chapter');

    
    const urlParams = new URLSearchParams(window.location.search);
    let currentChapterId = urlParams.get('cap') || "1";

    async function initializeReader() {
        
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
        
        if (window.isOfflineMode) {
            
            const mockChapters = JSON.parse(localStorage.getItem('fio-mock-chapters') || '[]');
            mockChapters.forEach(c => {
                chaptersData[c.id.toString()] = {
                    title: c.title,
                    pagesCount: c.pages_count,
                    releaseDate: c.release_date
                };
            });
        } else {
            
            try {
                if (window.supabase) {
                    const { data, error } = await window.supabase
                        .from('chapters')
                        .select('id, title, pages_count, release_date')
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
                
            }
        }

        
        if (!chaptersData[currentChapterId]) {
            currentChapterId = Object.keys(chaptersData)[0] || "1";
        }

        const currentChapter = chaptersData[currentChapterId];
        

        
        if (chapterTitleEl) {
            chapterTitleEl.textContent = `Capítulo ${currentChapterId.padStart(2, '0')}: ${currentChapter.title}`;
        }

        
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

        
        const userKey = `fio-read-chapters-${session.user.email}`;
        let readChapters = JSON.parse(localStorage.getItem(userKey) || '[]');
        if (!readChapters.includes(currentChapterId)) {
            readChapters.push(currentChapterId);
            localStorage.setItem(userKey, JSON.stringify(readChapters));
            
        }

        
        renderWebtoonPages(currentChapter);

        
        setupNavigation(chaptersData);
    }

    function renderWebtoonPages(currentChapter) {
        if (!canvasContainer) return;
        canvasContainer.innerHTML = '';
        
        
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
        
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
            
            
            let imageSource = `assets/cap${currentChapterId}_pag${i}.jpg`; 
            let isUsingSupabase = false;
            
            if (!window.isOfflineMode && window.supabase) {
                
                try {
                    const res = window.supabase.storage
                        .from('paginas-quadrinho')
                        .getPublicUrl(`capitulo-${currentChapterId}/pagina-${i}.webp`);
                    if (res && res.data && res.data.publicUrl) {
                        imageSource = res.data.publicUrl;
                        isUsingSupabase = true;
                    } else if (res && res.publicURL) {
                        imageSource = res.publicURL;
                        isUsingSupabase = true;
                    } else if (typeof res === 'string') {
                        imageSource = res;
                        isUsingSupabase = true;
                    }
                } catch (urlErr) {
                    
                }
            } else {
                
                const sessionKey = `fio-temp-page-${currentChapterId}-${i}`;
                const tempBlobUrl = sessionStorage.getItem(sessionKey);
                if (tempBlobUrl) {
                    imageSource = tempBlobUrl;
                }
            }

            
            img.onload = function() {
                if (img.dataset.loadedEventFired) return;
                img.dataset.loadedEventFired = "true";
                
                
                pageWrapper.innerHTML = '';
                pageWrapper.appendChild(img);
                
                pageWrapper.classList.add('loaded');
                pageWrapper.style.display = 'block';
                pageWrapper.style.padding = '0';
                pageWrapper.style.margin = '0';
                
                img.classList.add('loaded');

                
                let imgTransX = 0;
                let startX = 0;
                let initTransX = 0;
                let isDragging = false;
                let hasDragged = false;
                let startTouchX = 0;
                let startTouchY = 0;
                let scrollPositionBeforeZoom = 0;
                let clickCount = 0;
                let clickTimeout = null;

                pageWrapper.addEventListener('touchstart', (e) => {
                    startTouchX = e.touches[0].clientX;
                    startTouchY = e.touches[0].clientY;
                    hasDragged = false;

                    if (img.classList.contains('is-zoomed')) {
                        isDragging = true;
                        startX = e.touches[0].clientX;
                        initTransX = imgTransX;
                    }
                }, { passive: true });

                pageWrapper.addEventListener('touchmove', (e) => {
                    const dx = e.touches[0].clientX - startTouchX;
                    const dy = e.touches[0].clientY - startTouchY;

                    if (Math.abs(dx) > Math.abs(dy) + 5) {
                        hasDragged = true;
                        
                        if (isDragging) {
                            if (e.cancelable) e.preventDefault();
                            const rect = pageWrapper.getBoundingClientRect();
                            const limit = rect.width * 0.4;
                            imgTransX = Math.min(Math.max(initTransX + (dx / 1.8), -limit), limit);
                            img.style.transform = `scale(1.8) translate(${imgTransX}px, 0px)`;
                        }
                    }
                }, { passive: false });

                pageWrapper.addEventListener('touchend', (e) => {
                    isDragging = false;
                    if (!hasDragged) {
                        handleTapOrClick(e);
                    }
                });

                pageWrapper.addEventListener('mousedown', (e) => {
                    e.preventDefault();
                    startX = e.clientX;
                    startTouchX = e.clientX;
                    startTouchY = e.clientY;
                    hasDragged = false;

                    if (img.classList.contains('is-zoomed')) {
                        isDragging = true;
                        initTransX = imgTransX;
                    }
                });

                pageWrapper.addEventListener('mousemove', (e) => {
                    if (!isDragging) return;
                    const dx = e.clientX - startX;
                    hasDragged = true;
                    
                    const rect = pageWrapper.getBoundingClientRect();
                    const limit = rect.width * 0.4;
                    imgTransX = Math.min(Math.max(initTransX + (dx / 1.8), -limit), limit);
                    img.style.transform = `scale(1.8) translate(${imgTransX}px, 0px)`;
                });

                pageWrapper.addEventListener('mouseup', (e) => {
                    isDragging = false;
                    if (!hasDragged) {
                        handleTapOrClick(e);
                    }
                });

                pageWrapper.addEventListener('mouseleave', () => {
                    isDragging = false;
                });

                function handleTapOrClick(e) {
                    if (img.classList.contains('is-zoomed')) {
                        
                        toggleZoom(e);
                    } else {
                        
                        clickCount++;
                        if (clickCount === 1) {
                            clickTimeout = setTimeout(() => {
                                clickCount = 0;
                            }, 300);
                        } else if (clickCount === 2) {
                            clearTimeout(clickTimeout);
                            clickCount = 0;
                            toggleZoom(e);
                        }
                    }
                }

                function toggleZoom(e) {
                    const rect = pageWrapper.getBoundingClientRect();
                    let clientX = 0;
                    let clientY = 0;

                    if (e.changedTouches && e.changedTouches[0]) {
                        clientX = e.changedTouches[0].clientX;
                        clientY = e.changedTouches[0].clientY;
                    } else {
                        clientX = e.clientX;
                        clientY = e.clientY;
                    }

                    const touchX = clientX - rect.left;
                    const touchY = clientY - rect.top;

                    if (!img.classList.contains('is-zoomed')) {
                        
                        scrollPositionBeforeZoom = window.scrollY || document.documentElement.scrollTop;

                        
                        document.querySelectorAll('.webtoon-page-img.is-zoomed').forEach(el => {
                            el.style.transform = 'scale(1)';
                            el.style.transformOrigin = 'center center';
                            el.classList.remove('is-zoomed');
                        });

                        img.style.transformOrigin = `${touchX}px ${touchY}px`;
                        imgTransX = 0;
                        img.style.transform = 'scale(1.8) translate(0px, 0px)';
                        img.classList.add('is-zoomed');
                    } else {
                        
                        img.style.transform = 'scale(1)';
                        img.style.transformOrigin = 'center center';
                        img.classList.remove('is-zoomed');
                        
                        window.scrollTo({ top: scrollPositionBeforeZoom, behavior: 'instant' });
                    }
                }

                if (i === 1) {
                    setTimeout(() => {
                        window.scrollTo(0, 0);
                        document.documentElement.scrollTop = 0;
                        document.body.scrollTop = 0;
                    }, 150); 
                }
            };

            img.onerror = function() {
                
                if (isUsingSupabase) {
                    isUsingSupabase = false;
                    img.src = `assets/cap${currentChapterId}_pag${i}.jpg`;
                    return;
                }
                
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

            img.src = imageSource;
            
            
            if (img.complete) {
                img.onload();
            }

            pageWrapper.appendChild(img);
            canvasContainer.appendChild(pageWrapper);
        }
    }

    function setupNavigation(chaptersData) {
        const sortedKeys = Object.keys(chaptersData).sort((a, b) => parseInt(a) - parseInt(b));
        const currentIndex = sortedKeys.indexOf(currentChapterId);
        
        
        if (btnPrev) {
            if (currentIndex <= 0) {
                btnPrev.classList.add('btn-disabled');
                btnPrev.disabled = true;
            } else {
                btnPrev.classList.remove('btn-disabled');
                btnPrev.disabled = false;
                
                if (btnPrev.parentNode) {
                    const newBtnPrev = btnPrev.cloneNode(true);
                    btnPrev.parentNode.replaceChild(newBtnPrev, btnPrev);
                    newBtnPrev.addEventListener('click', () => {
                        const prevId = sortedKeys[currentIndex - 1];
                        window.location.href = `ler.html?cap=${prevId}`;
                    });
                }
            }
        }

        
        if (btnNext && btnNext.parentNode) {
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
        }

        
        if (chapterSelectEl && chapterSelectEl.parentNode) {
            
            const newSelect = chapterSelectEl.cloneNode(true);
            chapterSelectEl.parentNode.replaceChild(newSelect, chapterSelectEl);
            newSelect.addEventListener('change', (e) => {
                const selectedId = e.target.value;
                window.location.href = `ler.html?cap=${selectedId}`;
            });
        }
    }

    
    history.pushState({ reading: true }, '', `#leitura-cap-${currentChapterId}`);
    window.addEventListener('popstate', () => {
        
        window.location.replace('dashboard.html');
    });

    
    let lastScrollTop = 0;
    const readerHeader = document.querySelector('.reader-header');
    
    window.addEventListener('scroll', () => {
        let scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        if (scrollTop > lastScrollTop && scrollTop > 60) {
            
            if (readerHeader) {
                readerHeader.style.transform = 'translateY(-100%)';
                readerHeader.style.transition = 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)';
            }
        } else {
            
            if (readerHeader) {
                readerHeader.style.transform = 'translateY(0)';
                readerHeader.style.transition = 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)';
            }
        }
        lastScrollTop = scrollTop <= 0 ? 0 : scrollTop;
    }, { passive: true });

    
    initializeReader();
});
