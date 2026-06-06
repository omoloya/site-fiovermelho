/* ==========================================================================
   INDEX.HTML AUTHENTICATION, AGE GATE, REAL MERCADO PAGO PIX & CO-ORDINATION
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    // --- Trava de Segurança Estrita: Forçar Modo Online em Produção ---
    if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        window.isOfflineMode = false;
    }

    // --- Configurações Globais de Checkout ---
    const CHAPTER_PRICE = 1.50; // Preço oficial do capítulo/validação

    // --- DOM Elements ---
    const stepAgeGate = document.getElementById('step-age-gate');
    const stepPixPayment = document.getElementById('step-pix-payment');
    const stepSignup = document.getElementById('step-signup');
    const stepLogin = document.getElementById('step-login');

    const btnAgreeAge = document.getElementById('btn-agree-age');
    const btnGoToLogin = document.getElementById('btn-go-to-login');
    const btnCancelPix = document.getElementById('btn-cancel-pix');
    const btnSignupBack = document.getElementById('btn-signup-back');
    const btnBackToGate = document.getElementById('btn-back-to-gate');
    
    const pixQrElement = document.getElementById('pix-qr-element');
    const pixCodeField = document.getElementById('pix-code-field');
    const btnCopyPix = document.getElementById('btn-copy-pix');
    
    const pixSpinner = document.getElementById('pix-spinner');
    const pixStatusText = document.getElementById('pix-status-text');
    const pixSuccessText = document.getElementById('pix-success-text');
    
    const signupForm = document.getElementById('signup-form');
    const signupCpfInput = document.getElementById('signup-cpf');
    const signupBirthdateInput = document.getElementById('signup-birthdate');
    const loginForm = document.getElementById('login-form');

    let activePixListener = null;

    // Redireciona se o usuário já estiver ativo e verificado
    if (window.sessionHelper && window.sessionHelper.getSession()) {
        const session = window.sessionHelper.getSession();
        if (session.is_verified) {
            window.location.href = 'dashboard.html';
            return;
        }
    }

    // --- 1. Máscara Dinâmica de CPF (000.000.000-00) ---
    if (signupCpfInput) {
        signupCpfInput.addEventListener('input', (e) => {
            let value = e.target.value.replace(/\D/g, "");
            if (value.length > 11) value = value.substring(0, 11);
            
            let formatted = "";
            if (value.length > 0) formatted += value.substring(0, 3);
            if (value.length > 3) formatted += "." + value.substring(3, 6);
            if (value.length > 6) formatted += "." + value.substring(6, 9);
            if (value.length > 9) formatted += "-" + value.substring(9, 11);
            
            e.target.value = formatted;
        });
    }

    // --- 2. Máscara Dinâmica de Data de Nascimento (DD/MM/AAAA) ---
    if (signupBirthdateInput) {
        signupBirthdateInput.addEventListener('input', (e) => {
            let value = e.target.value.replace(/\D/g, "");
            if (value.length > 8) value = value.substring(0, 8);
            
            let formatted = "";
            if (value.length > 0) formatted += value.substring(0, 2);
            if (value.length > 2) formatted += "/" + value.substring(2, 4);
            if (value.length > 4) formatted += "/" + value.substring(4, 8);
            
            e.target.value = formatted;
        });
    }

    // --- 3. Algoritmo de Validação de CPF (Módulo 11) ---
    function validateCPF(cpf) {
        cpf = cpf.replace(/[^\d]+/g, '');
        if (cpf.length !== 11) return false;
        if (/^(\d)\1{10}$/.test(cpf)) return false;
        
        let add = 0;
        for (let i = 0; i < 9; i++) {
            add += parseInt(cpf.charAt(i)) * (10 - i);
        }
        let rev = 11 - (add % 11);
        if (rev === 10 || rev === 11) rev = 0;
        if (rev !== parseInt(cpf.charAt(9))) return false;
        
        add = 0;
        for (let i = 0; i < 10; i++) {
            add += parseInt(cpf.charAt(i)) * (11 - i);
        }
        rev = 11 - (add % 11);
        if (rev === 10 || rev === 11) rev = 0;
        if (rev !== parseInt(cpf.charAt(10))) return false;
        
        return true;
    }

    // --- 4. Algoritmo de Checagem de Idade (ECA 18+) ---
    function getAge(birthDateString) {
        const parts = birthDateString.split('/');
        if (parts.length !== 3) return 0;
        
        const birthDate = new Date(parts[2], parts[1] - 1, parts[0]);
        const today = new Date();
        
        let age = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        return age;
    }

    // --- Helper: Alternar Passos da Autenticação ---
    function showStep(stepElement) {
        [stepAgeGate, stepPixPayment, stepSignup, stepLogin].forEach(el => {
            if (el) el.classList.remove('active');
        });
        if (stepElement) stepElement.classList.add('active');
    }

    // --- Navegação entre passos ---
    if (btnAgreeAge) {
        btnAgreeAge.addEventListener('click', () => {
            showStep(stepSignup); // Vai direto para Cadastro no novo fluxo!
        });
    }

    if (btnGoToLogin) {
        btnGoToLogin.addEventListener('click', () => {
            showStep(stepLogin);
        });
    }

    if (btnSignupBack) {
        btnSignupBack.addEventListener('click', () => {
            showStep(stepAgeGate);
        });
    }

    if (btnCancelPix) {
        btnCancelPix.addEventListener('click', () => {
            if (activePixListener) activePixListener.cancel();
            showStep(stepSignup);
        });
    }

    if (btnBackToGate) {
        btnBackToGate.addEventListener('click', () => {
            showStep(stepAgeGate);
        });
    }

    // --- FORMULÁRIO DE CADASTRO E GERAÇÃO PIX REAL ---
    if (signupForm) {
        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('signup-email').value.trim();
            const cpfValue = document.getElementById('signup-cpf').value;
            const birthdateValue = document.getElementById('signup-birthdate').value;
            const password = document.getElementById('signup-password').value;

            const submitBtn = signupForm.querySelector('button[type="submit"]');

            const cleanCpf = cpfValue.replace(/[^\d]+/g, '');
            const cleanBirthdate = birthdateValue.split('/').reverse().join('-'); // Formato YYYY-MM-DD

            submitBtn.classList.add('btn-disabled');
            submitBtn.innerHTML = '<div class="pix-status-spinner" style="margin-right: 8px;"></div> Gerando Pix...';

            let userId = null;

            if (window.isOfflineMode) {
                // Modo Protótipo Local (Mock)
                userId = "usr_" + Math.random().toString(36).substring(2, 15);
                let mockUsers = JSON.parse(localStorage.getItem('fio-mock-users') || '[]');
                
                if (mockUsers.some(u => u.email === email)) {
                    alert("Este e-mail já está cadastrado.");
                    resetSubmitButton(submitBtn, '<i class="fa-solid fa-qrcode" style="margin-right: 8px;"></i> Gerar Pix de Validação');
                    return;
                }

                const isAdminEmail = email.includes("admin");
                const initialStatus = isAdminEmail ? 'verificado' : 'pendente_verificacao';

                mockUsers.push({
                    id: userId,
                    email,
                    password,
                    cpf: cleanCpf,
                    birthdate: cleanBirthdate,
                    status: initialStatus
                });
                localStorage.setItem('fio-mock-users', JSON.stringify(mockUsers));
                
                if (window.sessionHelper) {
                    window.sessionHelper.setSession(email, isAdminEmail, userId);
                }
                
                if (isAdminEmail) {
                    alert("🧶 Bem-vindo, Administrador! Cadastro efetuado com verificação automática.");
                    window.location.href = 'dashboard.html';
                } else {
                    // Dispara Geração de Pix
                    await initiatePixGeneration(email, cleanCpf, userId, submitBtn);
                }
            } else {
                // Modo Produção Remoto (Validação centralizada na API do servidor)
                try {
                    const response = await fetch('/api/auth-operations', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            action: 'cadastro',
                            email,
                            password,
                            cpf: cleanCpf,
                            birthdate: cleanBirthdate
                        })
                    });

                    const data = await response.json();

                    if (!response.ok) {
                        throw new Error(data.error || 'Erro ao realizar cadastro.');
                    }

                    userId = data.userId;

                    // Efetua login automático do usuário no Supabase para iniciar sessão
                    if (window.supabase) {
                        const { error: loginError } = await window.supabase.auth.signInWithPassword({
                            email: email,
                            password: password
                        });
                        if (loginError) console.warn("Aviso: Login automático pós-cadastro falhou, mas cadastro foi criado.");
                    }

                    if (window.sessionHelper) {
                        window.sessionHelper.setSession(email, data.isAdmin, userId);
                    }

                    if (data.isAdmin) {
                        alert("🧶 Bem-vindo, Administrador! Cadastro efetuado com verificação automática.");
                        window.location.href = 'dashboard.html';
                    } else {
                        // Dispara Geração de Pix Real
                        await initiatePixGeneration(email, cleanCpf, userId, submitBtn);
                    }
                } catch (err) {
                    console.error("Erro no cadastro:", err.message);
                    alert("Erro no cadastro: " + err.message);
                    resetSubmitButton(submitBtn, '<i class="fa-solid fa-qrcode" style="margin-right: 8px;"></i> Gerar Pix de Validação');
                }
            }
        });
    }

    // --- GERAÇÃO DO PIX DINÂMICO (MERCADO PAGO API) ---
    async function initiatePixGeneration(email, cpf, userId, submitBtn) {
        try {
            // Em produção ou local, chama o endpoint da Vercel /api/criar-pix
            const response = await fetch('/api/criar-pix', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, cpf })
            });

            if (response.ok) {
                const charge = await response.json();
                
                // Renderiza o QR Code e código real retornados pelo Mercado Pago
                if (pixQrElement) pixQrElement.src = `data:image/jpeg;base64,${charge.qrCodeUrl}`;
                if (pixCodeField) pixCodeField.value = charge.copyPasteCode;
                
                showStep(stepPixPayment);
                startProductionPixMonitoring(charge.transactionId, email, userId);
            } else {
                const errData = await response.json();
                throw new Error(errData.error || 'Erro na API');
            }
        } catch (error) {
            console.error("❌ Erro ao gerar Pix no gateway Mercado Pago:", error.message);
            alert("⚠️ Não foi possível gerar a cobrança Pix de validação de maioridade no momento: " + error.message);
        } finally {
            resetSubmitButton(submitBtn, '<i class="fa-solid fa-qrcode" style="margin-right: 8px;"></i> Gerar Pix de Validação');
        }
    }

    // --- MONITORAMENTO PROD: POLLING REAL NA API DO MERCADO PAGO ---
    function startProductionPixMonitoring(transactionId, email, userId) {
        if (pixSpinner) pixSpinner.style.display = 'block';
        if (pixSuccessText) pixSuccessText.style.display = 'none';
        if (pixStatusText) {
            pixStatusText.style.display = 'inline';
            pixStatusText.textContent = "Aguardando confirmação do pagamento real...";
        }

        const interval = setInterval(async () => {
            try {
                const res = await fetch(`/api/checar-pix?payment_id=${transactionId}&user_id=${userId}&_t=${Date.now()}`);
                if (res.ok) {
                    const data = await res.json();
                    
                    // Depuração explícita a cada 3 segundos para acompanhar a batida do relógio
                    console.log("Rodando Polling...", data);

                    // Restaura o texto original de aguardando se a requisição voltou a funcionar
                    if (pixStatusText) {
                        pixStatusText.innerHTML = 'Aguardando confirmação do pagamento real...';
                    }

                    // Condição de parada flexível (seja por status aprovado ou flag de verificação ativa)
                    if (data.status === 'pago' || data.status === 'approved' || data.status === 'verificado' || data.status === true) {
                        // Limpa o intervalo IMEDIATAMENTE para evitar chamadas órfãs
                        clearInterval(interval);
                        
                        // Atualiza localmente no mock caso esteja em modo offline
                        if (window.isOfflineMode) {
                            updateMockUserStatus(email, 'pago');
                        }

                        // Redireciona e libera o acesso de forma segura com o ID do usuário
                        handleSuccessfulPayment(email, userId);
                    } else if (data.status === 'rejected' || data.status === 'cancelled') {
                        clearInterval(interval);
                        alert("O pagamento Pix foi cancelado ou recusado pelo banco. Tente novamente.");
                        showStep(stepSignup);
                    }
                } else {
                    const errData = await res.json().catch(() => ({}));
                    const errMsg = errData.error || "Erro na conexão com o gateway de pagamento.";
                    console.error("Erro retornado pelo backend:", errMsg);
                    if (pixStatusText) {
                        pixStatusText.innerHTML = `<span style="color: var(--primary-red); font-weight: 600;"><i class="fa-solid fa-triangle-exclamation" style="margin-right: 6px;"></i> Erro Vercel: ${errMsg}</span>`;
                    }
                }
            } catch (err) {
                console.error("Erro ao verificar Pix no backend:", err);
                if (pixStatusText) {
                    pixStatusText.innerHTML = `<span style="color: var(--primary-red); font-weight: 600;"><i class="fa-solid fa-triangle-exclamation" style="margin-right: 6px;"></i> Falha de rede. Tentando reconectar...</span>`;
                }
            }
        }, 3000); // Polling a cada 3 segundos

        activePixListener = { cancel: () => clearInterval(interval) };
    }

    // Auxiliar: Altera status no mock local (Apenas em modo offline)
    function updateMockUserStatus(email, newStatus) {
        let mockUsers = JSON.parse(localStorage.getItem('fio-mock-users') || '[]');
        const idx = mockUsers.findIndex(u => u.email === email);
        if (idx !== -1) {
            mockUsers[idx].status = newStatus;
            localStorage.setItem('fio-mock-users', JSON.stringify(mockUsers));
        }
    }

    // Ação: Sucesso no Pagamento e Redirecionamento
    async function handleSuccessfulPayment(email, userId = null) {
        let finalUserId = userId;
        
        // Se o userId não foi passado ou está ausente, tenta recuperar direto da sessão ativa do Supabase
        if (!finalUserId && !window.isOfflineMode && window.supabase) {
            try {
                if (typeof window.supabase.auth.getUser === 'function') {
                    const { data } = await window.supabase.auth.getUser();
                    if (data && data.user) finalUserId = data.user.id;
                }
                if (!finalUserId && typeof window.supabase.auth.getSession === 'function') {
                    const { data } = await window.supabase.auth.getSession();
                    if (data && data.session && data.session.user) finalUserId = data.session.user.id;
                }
                if (!finalUserId && typeof window.supabase.auth.user === 'function') {
                    const u = window.supabase.auth.user();
                    if (u) finalUserId = u.id;
                }
            } catch (e) {
                console.error("Erro ao recuperar ID do usuário logado na verificação do pagamento:", e);
            }
        }

        if (window.sessionHelper) {
            window.sessionHelper.setSession(email, true, finalUserId); // true = verificado!
        }
        
        if (pixSpinner) pixSpinner.style.display = 'none';
        if (pixStatusText) pixStatusText.style.display = 'none';
        if (pixSuccessText) pixSuccessText.style.display = 'inline';
        
        setTimeout(() => {
            window.location.href = 'dashboard.html';
        }, 1800);
    }

    // Copiar Código de barras / Copia e Cola
    if (btnCopyPix && pixCodeField) {
        btnCopyPix.addEventListener('click', () => {
            pixCodeField.select();
            pixCodeField.setSelectionRange(0, 99999);
            
            navigator.clipboard.writeText(pixCodeField.value)
                .then(() => {
                    const originalIcon = btnCopyPix.innerHTML;
                    btnCopyPix.innerHTML = '<i class="fa-solid fa-check"></i>';
                    btnCopyPix.style.backgroundColor = 'var(--success-green)';
                    
                    setTimeout(() => {
                        btnCopyPix.innerHTML = originalIcon;
                        btnCopyPix.style.backgroundColor = '';
                    }, 2000);
                })
                .catch(err => {
                    console.error("Falha ao copiar:", err);
                });
        });
    }

    // --- FORMULÁRIO DE LOGIN (SUPABASE / OFFLINE) ---
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('login-email').value.trim();
            const password = document.getElementById('login-password').value;

            const submitBtn = loginForm.querySelector('button[type="submit"]');
            submitBtn.classList.add('btn-disabled');
            submitBtn.innerHTML = '<div class="pix-status-spinner" style="margin-right: 8px;"></div> Autenticando...';

            if (window.isOfflineMode) {
                // Modo Protótipo Local (Mock)
                setTimeout(async () => {
                    const mockUsers = JSON.parse(localStorage.getItem('fio-mock-users') || '[]');
                    const foundUser = mockUsers.find(u => u.email === email && u.password === password);

                    if (foundUser) {
                        const rawStatus = foundUser.status ? foundUser.status.toLowerCase().trim() : '';
                        const isVerified = rawStatus === 'verificado' || rawStatus === 'pago' || rawStatus === 'approved';

                        if (!isVerified) {
                            resetSubmitButton(submitBtn, '<i class="fa-solid fa-arrow-right-to-bracket" style="margin-right: 8px;"></i> Entrar no Painel');
                            alert("ℹ️ Sua conta já está cadastrada, mas a validação de maioridade via Pix está pendente. \n\nVamos reexibir o Pix de validação para que você conclua seu acesso!");
                            await initiatePixGeneration(email, foundUser.cpf, foundUser.id, submitBtn);
                            return;
                        }

                        if (window.sessionHelper) {
                            window.sessionHelper.setSession(email, true, foundUser.id);
                        }
                        window.location.href = 'dashboard.html';
                    } else {
                        alert("E-mail ou senha incorretos.");
                        resetSubmitButton(submitBtn, '<i class="fa-solid fa-arrow-right-to-bracket" style="margin-right: 8px;"></i> Entrar no Painel');
                    }
                }, 800);
            } else {
                // Modo Produção Remoto (Supabase)
                try {
                    if (window.supabase) {
                        const { data, error } = await window.supabase.auth.signInWithPassword({
                            email: email,
                            password: password
                        });

                        if (error) throw error;

                        // Consulta o status e o CPF de forma tolerante a falhas usando maybeSingle
                        const { data: profile, error: profileError } = await window.supabase
                            .from('profiles')
                            .select('status, cpf')
                            .eq('id', data.user.id)
                            .maybeSingle();

                        if (profileError) throw profileError;

                        // Se o perfil existe mas o pagamento está pendente, intercepta e reexibe o Pix com Polling
                        const rawStatus = profile && profile.status ? profile.status.toLowerCase().trim() : '';
                        const isVerifiedStatus = rawStatus === 'verificado' || rawStatus === 'pago' || rawStatus === 'approved';

                        if (profile && !isVerifiedStatus) {
                            resetSubmitButton(submitBtn, '<i class="fa-solid fa-arrow-right-to-bracket" style="margin-right: 8px;"></i> Entrar no Painel');
                            alert("ℹ️ Sua conta já está cadastrada, mas a validação de maioridade via Pix está pendente. \n\nVamos reexibir o Pix de validação para que você conclua seu acesso!");
                            await initiatePixGeneration(email, profile.cpf, data.user.id, submitBtn);
                            return;
                        }

                        let isVerified = false;
                        if (profile && isVerifiedStatus) {
                            isVerified = true;
                        }

                        // Sobregravação/Override de Conveniência e Segurança para administradores!
                        let isUserAdmin = false;
                        if (window.isOfflineMode) {
                            isUserAdmin = email.includes("admin");
                        } else {
                            try {
                                const sessionToken = data.session?.access_token;
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
                                    }
                                }
                            } catch (e) {
                                console.error("Falha ao verificar status de admin no login:", e);
                            }
                        }

                        if (isUserAdmin) {
                            isVerified = true;
                        } else {
                            if (!profile) throw new Error("Perfil de usuário não encontrado. Por favor, registre-se primeiro.");
                        }
                        
                        if (window.sessionHelper) {
                            window.sessionHelper.setSession(email, isVerified);
                        }
                        window.location.href = 'dashboard.html';
                    }
                } catch (err) {
                    console.error("Erro no login:", err.message);
                    alert("Erro de autenticação: " + err.message);
                    resetSubmitButton(submitBtn, '<i class="fa-solid fa-arrow-right-to-bracket" style="margin-right: 8px;"></i> Entrar no Painel');
                }
            }
        });
    }

    function resetSubmitButton(btn, originalHTML) {
        btn.classList.remove('btn-disabled');
        btn.innerHTML = originalHTML;
    }

    // --- FORMULÁRIO DA NEWSLETTER (SUPABASE / LOCAL STORAGE) ---
    const newsletterForm = document.getElementById('newsletter-form');
    const newsletterEmailInput = document.getElementById('newsletter-email');
    const newsletterMessage = document.getElementById('newsletter-message');
    const btnNewsletterSubscribe = document.getElementById('btn-newsletter-subscribe');

    if (newsletterForm && newsletterEmailInput && newsletterMessage && btnNewsletterSubscribe) {
        newsletterForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = newsletterEmailInput.value.trim();
            if (!email) return;

            // Feedback visual de carregamento
            btnNewsletterSubscribe.classList.add('btn-disabled');
            const originalBtnHTML = btnNewsletterSubscribe.innerHTML;
            btnNewsletterSubscribe.innerHTML = '<div class="pix-status-spinner" style="margin-right: 8px; width: 14px; height: 14px;"></div>';

            newsletterMessage.style.display = 'none';
            newsletterMessage.className = 'newsletter-message';
            newsletterMessage.textContent = '';

            if (window.isOfflineMode) {
                // Modo Protótipo Local (Mock)
                setTimeout(() => {
                    let mockNewsletter = JSON.parse(localStorage.getItem('fio-mock-newsletter') || '[]');
                    
                    if (mockNewsletter.includes(email)) {
                        newsletterMessage.textContent = 'Este e-mail já está cadastrado na nossa lista!';
                        newsletterMessage.classList.add('error');
                    } else {
                        mockNewsletter.push(email);
                        localStorage.setItem('fio-mock-newsletter', JSON.stringify(mockNewsletter));
                        
                        newsletterMessage.textContent = 'E-mail cadastrado! Você será avisado assim que o primeiro capítulo for liberado.';
                        newsletterMessage.classList.add('success');
                        newsletterForm.reset();
                    }
                    
                    btnNewsletterSubscribe.classList.remove('btn-disabled');
                    btnNewsletterSubscribe.innerHTML = originalBtnHTML;
                }, 800);
            } else {
                // Modo Produção Remoto (API Serverless)
                try {
                    const response = await fetch('/api/newsletter', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ email })
                    });

                    const data = await response.json();

                    if (!response.ok) {
                        throw new Error(data.error || 'Falha ao cadastrar e-mail.');
                    }

                    newsletterMessage.textContent = 'E-mail cadastrado! Você será avisado assim que o primeiro capítulo for liberado.';
                    newsletterMessage.classList.add('success');
                    newsletterForm.reset();
                } catch (err) {
                    console.error("Erro na inscrição da newsletter:", err);
                    newsletterMessage.textContent = err.message || 'Falha ao cadastrar e-mail. Tente novamente mais tarde.';
                    newsletterMessage.classList.add('error');
                } finally {
                    btnNewsletterSubscribe.classList.remove('btn-disabled');
                    btnNewsletterSubscribe.innerHTML = originalBtnHTML;
                }
            }
        });
    }

    // --- Alternar Visibilidade da Senha (Olhinho) ---
    const togglePasswordButtons = document.querySelectorAll('.btn-toggle-password');
    togglePasswordButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.getAttribute('data-target');
            const passwordInput = document.getElementById(targetId);
            const icon = btn.querySelector('i');
            
            if (passwordInput && icon) {
                if (passwordInput.type === 'password') {
                    passwordInput.type = 'text';
                    icon.classList.remove('fa-eye-slash');
                    icon.classList.add('fa-eye');
                } else {
                    passwordInput.type = 'password';
                    icon.classList.remove('fa-eye');
                    icon.classList.add('fa-eye-slash');
                }
            }
        });
    });

    // --- 7. Recuperação de Senha (Esqueceu a Senha) ---
    const btnForgot = document.getElementById('btn-forgot-password');
    const forgotModal = document.getElementById('forgot-password-modal');
    const btnCloseForgotModal = document.getElementById('btn-close-forgot-modal');
    const btnCloseForgotSuccess = document.getElementById('btn-close-forgot-success');
    const forgotForm = document.getElementById('forgot-password-form');
    const forgotEmailInput = document.getElementById('forgot-email-input');
    const forgotInputArea = document.getElementById('forgot-modal-input-area');
    const forgotMessageArea = document.getElementById('forgot-modal-message-area');
    const forgotStatusBox = document.getElementById('forgot-status-box');
    const btnSubmitForgot = document.getElementById('btn-submit-forgot');

    if (btnForgot && forgotModal) {
        btnForgot.addEventListener('click', (e) => {
            e.preventDefault();
            if (forgotEmailInput) forgotEmailInput.value = "";
            if (forgotInputArea) forgotInputArea.style.display = 'block';
            if (forgotMessageArea) forgotMessageArea.style.display = 'none';
            forgotModal.style.display = 'flex';
        });
    }

    function closeForgotModal() {
        if (forgotModal) {
            forgotModal.style.display = 'none';
        }
    }

    if (btnCloseForgotModal) {
        btnCloseForgotModal.addEventListener('click', (e) => {
            e.preventDefault();
            closeForgotModal();
        });
    }
    if (btnCloseForgotSuccess) {
        btnCloseForgotSuccess.addEventListener('click', (e) => {
            e.preventDefault();
            closeForgotModal();
        });
    }

    if (forgotModal) {
        forgotModal.addEventListener('click', (e) => {
            if (e.target === forgotModal) {
                closeForgotModal();
            }
        });
    }

    if (forgotForm) {
        forgotForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = forgotEmailInput.value.trim();
            if (!email) return;

            const originalBtnHTML = btnSubmitForgot.innerHTML;
            btnSubmitForgot.innerHTML = '<div class="pix-status-spinner" style="width:14px; height:14px; margin-right:8px; border-top-color:#fff; display:inline-block; vertical-align:middle;"></div> Enviando...';
            btnSubmitForgot.setAttribute('disabled', 'true');

            try {
                if (window.isOfflineMode) {
                    // --- MODO SIMULADO / OFFLINE ---
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    if (forgotStatusBox) {
                        forgotStatusBox.style.color = 'var(--success-green)';
                        forgotStatusBox.style.backgroundColor = 'rgba(16, 185, 129, 0.05)';
                        forgotStatusBox.style.borderColor = 'rgba(16, 185, 129, 0.2)';
                        forgotStatusBox.innerHTML = '<i class="fa-solid fa-paper-plane" style="margin-right: 6px;"></i> Oe, kyoudai! Enviamos um corvo com as instruções de recuperação para seu e-mail. Checa sua caixa de entrada! 🦅📬';
                    }
                    if (forgotInputArea) forgotInputArea.style.display = 'none';
                    if (forgotMessageArea) forgotMessageArea.style.display = 'block';
                } else {
                    // --- MODO REAL SUPABASE ---
                    if (window.supabase) {
                        const { error } = await window.supabase.auth.resetPasswordForEmail(email, {
                            redirectTo: window.location.origin + '/index.html'
                        });

                        if (error) throw error;

                        if (forgotStatusBox) {
                            forgotStatusBox.style.color = 'var(--success-green)';
                            forgotStatusBox.style.backgroundColor = 'rgba(16, 185, 129, 0.05)';
                            forgotStatusBox.style.borderColor = 'rgba(16, 185, 129, 0.2)';
                            forgotStatusBox.innerHTML = '<i class="fa-solid fa-paper-plane" style="margin-right: 6px;"></i> Oe, kyoudai! Enviamos um corvo com as instruções de recuperação para seu e-mail. Checa sua caixa de entrada! 🦅📬';
                        }
                        if (forgotInputArea) forgotInputArea.style.display = 'none';
                        if (forgotMessageArea) forgotMessageArea.style.display = 'block';
                    } else {
                        throw new Error('Cliente Supabase não inicializado.');
                    }
                }
            } catch (err) {
                console.error("Erro ao enviar recuperação de senha:", err);
                if (forgotStatusBox) {
                    forgotStatusBox.style.color = 'var(--primary-red)';
                    forgotStatusBox.style.backgroundColor = 'rgba(255, 42, 59, 0.05)';
                    forgotStatusBox.style.borderColor = 'rgba(255, 42, 59, 0.2)';
                    forgotStatusBox.innerHTML = `<i class="fa-solid fa-circle-exclamation" style="margin-right: 6px;"></i> Falha ao enviar: ${err.message || 'Erro inesperado'}`;
                }
                if (forgotInputArea) forgotInputArea.style.display = 'none';
                if (forgotMessageArea) forgotMessageArea.style.display = 'block';
            } finally {
                btnSubmitForgot.innerHTML = originalBtnHTML;
                btnSubmitForgot.removeAttribute('disabled');
            }
        });
    }
});
