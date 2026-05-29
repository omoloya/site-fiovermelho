/* ==========================================================================
   INDEX.HTML AUTHENTICATION, AGE GATE & PIX FLOWS
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
    const btnBackToGate = document.getElementById('btn-back-to-gate');
    
    const pixQrElement = document.getElementById('pix-qr-element');
    const pixCodeField = document.getElementById('pix-code-field');
    const btnCopyPix = document.getElementById('btn-copy-pix');
    
    const pixSpinner = document.getElementById('pix-spinner');
    const pixStatusText = document.getElementById('pix-status-text');
    const pixSuccessText = document.getElementById('pix-success-text');
    
    const signupForm = document.getElementById('signup-form');
    const loginForm = document.getElementById('login-form');

    let activePixListener = null;
    let validatedEmail = ""; // Guarda o e-mail após a validação Pix, se necessário.

    // Redireciona se o usuário já estiver ativo
    if (window.sessionHelper && window.sessionHelper.getSession()) {
        window.location.href = 'dashboard.html';
        return;
    }

    // --- Helper: Alternar Passos da Autenticação ---
    function showStep(stepElement) {
        // Oculta todos
        [stepAgeGate, stepPixPayment, stepSignup, stepLogin].forEach(el => {
            el.classList.remove('active');
        });
        // Ativa o selecionado
        stepElement.classList.add('active');
    }

    // --- Fluxo de Passos e Cliques ---

    // 1. Iniciar Validação Pix (Maioridade)
    if (btnAgreeAge) {
        btnAgreeAge.addEventListener('click', async () => {
            showStep(stepPixPayment);
            await startPixFlow();
        });
    }

    // 2. Ir para a tela de Login Existente
    if (btnGoToLogin) {
        btnGoToLogin.addEventListener('click', () => {
            showStep(stepLogin);
        });
    }

    // 3. Cancelar Pix e Voltar ao Início
    if (btnCancelPix) {
        btnCancelPix.addEventListener('click', () => {
            if (activePixListener) {
                activePixListener.cancel();
            }
            showStep(stepAgeGate);
        });
    }

    // 4. Voltar do Login para o Início
    if (btnBackToGate) {
        btnBackToGate.addEventListener('click', () => {
            showStep(stepAgeGate);
        });
    }

    // --- LÓGICA DO PIX (MOCK INTEGRADO COM O SERVIÇO) ---
    async function startPixFlow() {
        // Reset visual do status do Pix
        pixSpinner.style.display = 'block';
        pixSuccessText.style.display = 'none';
        pixStatusText.style.display = 'inline';
        pixStatusText.textContent = "Aguardando confirmação do pagamento...";
        
        try {
            // Gera a cobrança (0.10 centavos para verificação de maioridade)
            if (window.PixService) {
                const charge = await window.PixService.generatePixCharge(0.10, "verificacao_fio_vermelho");
                
                // Injeta dados no layout
                if (pixQrElement) pixQrElement.src = charge.qrCodeUrl;
                if (pixCodeField) pixCodeField.value = charge.copyPasteCode;
                
                // Escuta o status
                activePixListener = window.PixService.listenToPaymentStatus(charge.transactionId, (status, data) => {
                    if (status === 'APPROVED') {
                        handlePixApproval();
                    }
                });
            } else {
                console.error("Erro: PixService não inicializado.");
                pixStatusText.textContent = "Erro de conexão ao serviço de Pix.";
                pixSpinner.style.display = 'none';
            }
        } catch (error) {
            console.error("Erro ao processar Pix:", error);
            pixStatusText.textContent = "Erro ao gerar cobrança. Tente novamente.";
            pixSpinner.style.display = 'none';
        }
    }

    // Ação: Copiar Código Pix Copia e Cola
    if (btnCopyPix && pixCodeField) {
        btnCopyPix.addEventListener('click', () => {
            pixCodeField.select();
            pixCodeField.setSelectionRange(0, 99999); // Suporte mobile
            
            navigator.clipboard.writeText(pixCodeField.value)
                .then(() => {
                    // Feedback visual dinâmico do botão
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

    // Ação: Quando Pix é Aprovado
    function handlePixApproval() {
        // Atualiza interface do Pix
        if (pixSpinner) pixSpinner.style.display = 'none';
        if (pixStatusText) pixStatusText.style.display = 'none';
        if (pixSuccessText) pixSuccessText.style.display = 'inline';
        
        // Transiciona suavemente para o cadastro pós 2 segundos
        setTimeout(() => {
            showStep(stepSignup);
        }, 1800);
    }

    // --- FORMULÁRIO DE CADASTRO (SUPABASE / OFFLINE) ---
    if (signupForm) {
        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('signup-email').value.trim();
            const password = document.getElementById('signup-password').value;

            const submitBtn = signupForm.querySelector('button[type="submit"]');
            submitBtn.classList.add('btn-disabled');
            submitBtn.innerHTML = '<div class="pix-status-spinner" style="margin-right: 8px;"></div> Cadastrando...';

            if (window.isOfflineMode) {
                // --- MODO OFFLINE (LOCALSTORAGE MOCK) ---
                setTimeout(() => {
                    // Armazena usuário mockado
                    let mockUsers = JSON.parse(localStorage.getItem('fio-mock-users') || '[]');
                    
                    if (mockUsers.some(u => u.email === email)) {
                        alert("Este e-mail já está cadastrado.");
                        resetSubmitButton(submitBtn, '<i class="fa-solid fa-user-plus" style="margin-right: 8px;"></i> Concluir Cadastro & Entrar');
                        return;
                    }

                    mockUsers.push({ email, password, is_verified: true });
                    localStorage.setItem('fio-mock-users', JSON.stringify(mockUsers));
                    
                    // Cria Sessão local
                    if (window.sessionHelper) {
                        window.sessionHelper.setSession(email, true);
                    }
                    window.location.href = 'dashboard.html';
                }, 1000);
            } else {
                // --- MODO SUPABASE REAL ---
                try {
                    if (window.supabase) {
                        const { data, error } = await window.supabase.auth.signUp({
                            email: email,
                            password: password,
                            options: {
                                data: {
                                    is_verified: true // Atributo de usuário indicando maioridade validada
                                }
                            }
                        });

                        if (error) throw error;

                        // Se o cadastro logou direto (e-mail de confirmação desativado no Supabase)
                        if (data.session) {
                            if (window.sessionHelper) {
                                window.sessionHelper.setSession(email, true);
                            }
                            window.location.href = 'dashboard.html';
                        } else {
                            // Se o e-mail de confirmação estiver ativo no Supabase
                            alert("Cadastro efetuado! Um e-mail de confirmação foi enviado para " + email + ". Por favor, confirme a sua conta no seu e-mail antes de fazer login.");
                            showStep(stepLogin);
                            resetSubmitButton(submitBtn, '<i class="fa-solid fa-user-plus" style="margin-right: 8px;"></i> Concluir Cadastro & Entrar');
                        }
                    }
                } catch (err) {
                    console.error("Erro no cadastro Supabase:", err.message);
                    alert("Erro ao efetuar cadastro: " + err.message);
                    resetSubmitButton(submitBtn, '<i class="fa-solid fa-user-plus" style="margin-right: 8px;"></i> Concluir Cadastro & Entrar');
                }
            }
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
                // --- MODO OFFLINE (LOCALSTORAGE MOCK) ---
                setTimeout(() => {
                    const mockUsers = JSON.parse(localStorage.getItem('fio-mock-users') || '[]');
                    const foundUser = mockUsers.find(u => u.email === email && u.password === password);

                    if (foundUser) {
                        if (window.sessionHelper) {
                            window.sessionHelper.setSession(email, foundUser.is_verified);
                        }
                        window.location.href = 'dashboard.html';
                    } else {
                        alert("E-mail ou senha incorretos, ou usuário não validado.");
                        resetSubmitButton(submitBtn, '<i class="fa-solid fa-arrow-right-to-bracket" style="margin-right: 8px;"></i> Entrar no Painel');
                    }
                }, 800);
            } else {
                // --- MODO SUPABASE REAL ---
                try {
                    if (window.supabase) {
                        const { data, error } = await window.supabase.auth.signInWithPassword({
                            email: email,
                            password: password
                        });

                        if (error) throw error;

                        // Confere se o usuário cadastrado possui a flag de verificação
                        const isVerified = data.user.user_metadata?.is_verified === true;
                        
                        if (isVerified) {
                            if (window.sessionHelper) {
                                window.sessionHelper.setSession(email, true);
                            }
                            window.location.href = 'dashboard.html';
                        } else {
                            // Usuário cadastrado mas não passou pelo fluxo de maioridade/Pix
                            alert("Sua conta ainda não está validada com pagamento de maioridade.");
                            if (window.sessionHelper) {
                                window.sessionHelper.clearSession();
                            }
                            showStep(stepPixPayment);
                            await startPixFlow();
                        }
                    }
                } catch (err) {
                    console.error("Erro no login Supabase:", err.message);
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
});
