/* ==========================================================================
   INDEX.HTML AUTHENTICATION, AGE GATE, REAL MERCADO PAGO PIX & CO-ORDINATION
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
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

            // 1. Validação de CPF Real
            if (!validateCPF(cpfValue)) {
                alert("❌ CPF Inválido! Por favor, insira um número de CPF verdadeiro para fins de validação jurídica (ECA).");
                return;
            }

            // 2. Validação da Idade Real (ECA 18+)
            const age = getAge(birthdateValue);
            if (age < 18) {
                alert("❌ Acesso Negado! O Estatuto da Criança e do Adolescente (ECA) restringe o acesso deste conteúdo para menores de 18 anos. Cadastro bloqueado.");
                return;
            }

            const cleanCpf = cpfValue.replace(/[^\d]+/g, '');
            const cleanBirthdate = birthdateValue.split('/').reverse().join('-'); // Formato YYYY-MM-DD

            submitBtn.classList.add('btn-disabled');
            submitBtn.innerHTML = '<div class="pix-status-spinner" style="margin-right: 8px;"></div> Gerando Pix...';

            let userId = null;

            // Sobregravação automática de verificação para administradores autorizados no Cadastro!
            const adminEmails = (window.env && window.env.ADMIN_EMAILS) || [];
            const isAdminEmail = adminEmails.includes(email);
            const initialStatus = isAdminEmail ? 'verificado' : 'pendente_verificacao';

            // 3. Cadastra a Conta Primeiro
            if (window.isOfflineMode) {
                // Modo Protótipo Local (Mock)
                userId = "usr_" + Math.random().toString(36).substring(2, 15);
                let mockUsers = JSON.parse(localStorage.getItem('fio-mock-users') || '[]');
                
                if (mockUsers.some(u => u.email === email)) {
                    alert("Este e-mail já está cadastrado.");
                    resetSubmitButton(submitBtn, '<i class="fa-solid fa-qrcode" style="margin-right: 8px;"></i> Gerar Pix de Validação');
                    return;
                }

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
                    // Dispara Geração de Pix (Simulado na raiz se offline)
                    await initiatePixGeneration(email, cleanCpf, userId, submitBtn);
                }
            } else {
                // Modo Produção Remoto (Supabase + Mercado Pago API)
                try {
                    if (window.supabase) {
                        // Verifica se o CPF já está cadastrado no Supabase
                        const { data: existingProfile } = await window.supabase
                            .from('profiles')
                            .select('cpf')
                            .eq('cpf', cleanCpf)
                            .maybeSingle();

                        if (existingProfile) {
                            alert("Este CPF já está cadastrado em outra conta.");
                            resetSubmitButton(submitBtn, '<i class="fa-solid fa-qrcode" style="margin-right: 8px;"></i> Gerar Pix de Validação');
                            return;
                        }

                        // Cria o usuário de autenticação no Supabase Auth
                        const { data: authData, error: authError } = await window.supabase.auth.signUp({
                            email: email,
                            password: password,
                            options: {
                                data: { is_verified: isAdminEmail }
                            }
                        });

                        if (authError) throw authError;
                        userId = authData.user.id;

                        // Grava os dados legais na tabela profiles
                        const { error: profileError } = await window.supabase
                            .from('profiles')
                            .insert([{
                                id: userId,
                                email: email,
                                cpf: cleanCpf,
                                status: initialStatus
                            }]);

                        if (profileError) throw profileError;

                        if (window.sessionHelper) {
                            window.sessionHelper.setSession(email, isAdminEmail, userId);
                        }

                        if (isAdminEmail) {
                            alert("🧶 Bem-vindo, Administrador! Cadastro efetuado com verificação automática.");
                            window.location.href = 'dashboard.html';
                        } else {
                            // Dispara Geração de Pix Real via endpoint do Mercado Pago
                            await initiatePixGeneration(email, cleanCpf, userId, submitBtn);
                        }
                    }
                } catch (err) {
                    console.error("Erro no cadastro:", err.message);
                    alert("Erro no cadastro: " + err.message);
                    resetSubmitButton(submitBtn, '<i class="fa-solid fa-qrcode" style="margin-right: 8px;"></i> Gerar Pix de Validação');
                }
            }
        });
    }

    // --- GERAÇÃO DO PIX DINÂMICO (MERCADO PAGO API / MOCK) ---
    async function initiatePixGeneration(email, cpf, userId, submitBtn) {
        try {
            // Se estiver em produção local sem serverless ou em modo offline, podemos cair no mock,
            // mas tentaremos chamar o endpoint seguro da Vercel /api/criar-pix
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
                // Se der erro (ex: rodando local sem Vercel Serverless), inicia o fallback seguro de teste
                const errData = await response.json();
                throw new Error(errData.error || 'Erro na API');
            }
        } catch (error) {
            console.warn("⚠️ API do Mercado Pago indisponível localmente (Vercel não deployada local). Iniciando simulação de teste local:", error.message);
            
            // Inicia o simulador Pix padrão para testes locais
            if (window.PixService) {
                const charge = await window.PixService.generatePixCharge(0.10, "verificacao_local");
                
                if (pixQrElement) pixQrElement.src = charge.qrCodeUrl;
                if (pixCodeField) pixCodeField.value = charge.copyPasteCode;
                
                showStep(stepPixPayment);
                startMockPixMonitoring(email, userId);
            }
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
                const res = await fetch(`/api/checar-pix?payment_id=${transactionId}`);
                if (res.ok) {
                    const data = await res.json();
                    
                    // Log da resposta no console do navegador para depuração
                    console.log("🧶 [auth.js] Resposta checar-pix:", data);

                    // Restaura o texto original de aguardando se a requisição voltou a funcionar
                    if (pixStatusText) {
                        pixStatusText.innerHTML = 'Aguardando confirmação do pagamento real...';
                    }

                    // Condição de parada flexível (seja por status aprovado ou flag de verificação ativa)
                    if (data.status === 'pago' || data.status === 'approved' || data.status === true) {
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

    // --- MONITORAMENTO MOCK: SIMULAÇÃO PARA TESTES LOCAIS ---
    function startMockPixMonitoring(email, userId) {
        let elapsedTime = 0;
        const intervalTime = 1000;
        
        const interval = setInterval(() => {
            elapsedTime += intervalTime;
            
            if (elapsedTime >= 6000) {
                clearInterval(interval);
                updateMockUserStatus(email, 'verificado');
                handleSuccessfulPayment(email, userId);
            }
        }, intervalTime);

        activePixListener = { cancel: () => clearInterval(interval) };
    }

    // Auxiliar: Altera status no mock local
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
                        const adminEmails = (window.env && window.env.ADMIN_EMAILS) || [];
                        if (adminEmails.includes(email)) {
                            isVerified = true;
                            
                            // Se o profile do admin não existir no banco (ex: criado direto no painel auth), cria agora
                            if (!profile) {
                                await window.supabase
                                    .from('profiles')
                                    .insert([{ id: data.user.id, email: email, status: 'verificado' }]);
                            } else if (profile.status !== 'verificado') {
                                // Se existir mas estiver pendente, promove automaticamente a verificado
                                await window.supabase
                                    .from('profiles')
                                    .update({ status: 'verificado' })
                                    .eq('id', data.user.id);
                            }
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
                // Modo Produção Remoto (Supabase)
                try {
                    if (window.supabase) {
                        // Faz a inserção direta na tabela 'newsletter'
                        const { error } = await window.supabase
                            .from('newsletter')
                            .insert([{ email: email }]);

                        if (error) {
                            // Se for erro de duplicidade (código 23505 no Postgres)
                            if (error.code === '23505') {
                                throw new Error('Este e-mail já está cadastrado na nossa lista!');
                            }
                            throw error;
                        }

                        newsletterMessage.textContent = 'E-mail cadastrado! Você será avisado assim que o primeiro capítulo for liberado.';
                        newsletterMessage.classList.add('success');
                        newsletterForm.reset();
                    } else {
                        throw new Error('Supabase não foi inicializado corretamente.');
                    }
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
});
