/* ==========================================================================
   INDEX.HTML AUTHENTICATION, AGE GATE, CPF VALIDATION & PIX FLOWS
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
    const signupCpfInput = document.getElementById('signup-cpf');
    const loginForm = document.getElementById('login-form');

    let activePixListener = null;

    // Redireciona se o usuário já estiver ativo e verificado
    if (window.sessionHelper && window.sessionHelper.getSession()) {
        window.location.href = 'dashboard.html';
        return;
    }

    // --- 1. Máscara de CPF Dinâmica ---
    if (signupCpfInput) {
        signupCpfInput.addEventListener('input', (e) => {
            let value = e.target.value.replace(/\D/g, ""); // Remove não-dígitos
            if (value.length > 11) value = value.substring(0, 11);
            
            let formatted = "";
            if (value.length > 0) {
                formatted += value.substring(0, 3);
            }
            if (value.length > 3) {
                formatted += "." + value.substring(3, 6);
            }
            if (value.length > 6) {
                formatted += "." + value.substring(6, 9);
            }
            if (value.length > 9) {
                formatted += "-" + value.substring(9, 11);
            }
            
            e.target.value = formatted;
        });
    }

    // --- 2. Algoritmo de Validação de CPF (Dígito Verificador - Módulo 11) ---
    function validateCPF(cpf) {
        cpf = cpf.replace(/[^\d]+/g, ''); // Remove formatação
        if (cpf.length !== 11) return false;
        
        // Elimina CPFs com todos os dígitos iguais (padrão inválido comum)
        if (/^(\d)\1{10}$/.test(cpf)) return false;
        
        // Validação do primeiro dígito verificador
        let add = 0;
        for (let i = 0; i < 9; i++) {
            add += parseInt(cpf.charAt(i)) * (10 - i);
        }
        let rev = 11 - (add % 11);
        if (rev === 10 || rev === 11) rev = 0;
        if (rev !== parseInt(cpf.charAt(9))) return false;
        
        // Validação do segundo dígito verificador
        add = 0;
        for (let i = 0; i < 10; i++) {
            add += parseInt(cpf.charAt(i)) * (11 - i);
        }
        rev = 11 - (add % 11);
        if (rev === 10 || rev === 11) rev = 0;
        if (rev !== parseInt(cpf.charAt(10))) return false;
        
        return true;
    }

    // --- Helper: Alternar Passos da Autenticação ---
    function showStep(stepElement) {
        [stepAgeGate, stepPixPayment, stepSignup, stepLogin].forEach(el => {
            if (el) el.classList.remove('active');
        });
        if (stepElement) stepElement.classList.add('active');
    }

    // --- Fluxo de Cliques ---

    if (btnAgreeAge) {
        btnAgreeAge.addEventListener('click', async () => {
            showStep(stepPixPayment);
            await startPixFlow();
        });
    }

    if (btnGoToLogin) {
        btnGoToLogin.addEventListener('click', () => {
            showStep(stepLogin);
        });
    }

    if (btnCancelPix) {
        btnCancelPix.addEventListener('click', () => {
            if (activePixListener) {
                activePixListener.cancel();
            }
            showStep(stepAgeGate);
        });
    }

    if (btnBackToGate) {
        btnBackToGate.addEventListener('click', () => {
            showStep(stepAgeGate);
        });
    }

    // --- LÓGICA DO PIX (MOCK SIMULADOR) ---
    async function startPixFlow() {
        if (pixSpinner) pixSpinner.style.display = 'block';
        if (pixSuccessText) pixSuccessText.style.display = 'none';
        if (pixStatusText) {
            pixStatusText.style.display = 'inline';
            pixStatusText.textContent = "Aguardando confirmação do pagamento...";
        }
        
        try {
            if (window.PixService) {
                const charge = await window.PixService.generatePixCharge(0.10, "verificacao_fio_vermelho");
                
                if (pixQrElement) pixQrElement.src = charge.qrCodeUrl;
                if (pixCodeField) pixCodeField.value = charge.copyPasteCode;
                
                activePixListener = window.PixService.listenToPaymentStatus(charge.transactionId, (status, data) => {
                    if (status === 'APPROVED') {
                        handlePixApproval();
                    }
                });
            } else {
                console.error("Erro: PixService não inicializado.");
                if (pixStatusText) pixStatusText.textContent = "Erro de conexão ao serviço de Pix.";
                if (pixSpinner) pixSpinner.style.display = 'none';
            }
        } catch (error) {
            console.error("Erro ao processar Pix:", error);
            if (pixStatusText) pixStatusText.textContent = "Erro ao gerar cobrança. Tente novamente.";
            if (pixSpinner) pixSpinner.style.display = 'none';
        }
    }

    // Copiar Código Pix Copia e Cola
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

    function handlePixApproval() {
        if (pixSpinner) pixSpinner.style.display = 'none';
        if (pixStatusText) pixStatusText.style.display = 'none';
        if (pixSuccessText) pixSuccessText.style.display = 'inline';
        
        setTimeout(() => {
            showStep(stepSignup);
        }, 1800);
    }

    // --- FORMULÁRIO DE CADASTRO (SUPABASE / OFFLINE) ---
    if (signupForm) {
        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('signup-email').value.trim();
            const cpfValue = document.getElementById('signup-cpf').value;
            const password = document.getElementById('signup-password').value;

            const submitBtn = signupForm.querySelector('button[type="submit"]');
            
            // 1. Validação de CPF Real
            if (!validateCPF(cpfValue)) {
                alert("❌ CPF Inválido! O dígito verificador está incorreto ou o número é falso. Insira um CPF verdadeiro para validação de maioridade legal (ECA).");
                return;
            }

            const cleanCpf = cpfValue.replace(/[^\d]+/g, '');

            submitBtn.classList.add('btn-disabled');
            submitBtn.innerHTML = '<div class="pix-status-spinner" style="margin-right: 8px;"></div> Cadastrando...';

            if (window.isOfflineMode) {
                // --- MODO OFFLINE (LOCALSTORAGE MOCK) ---
                setTimeout(() => {
                    let mockUsers = JSON.parse(localStorage.getItem('fio-mock-users') || '[]');
                    
                    if (mockUsers.some(u => u.email === email)) {
                        alert("Este e-mail já está cadastrado.");
                        resetSubmitButton(submitBtn, '<i class="fa-solid fa-user-plus" style="margin-right: 8px;"></i> Concluir Cadastro & Entrar');
                        return;
                    }
                    if (mockUsers.some(u => u.cpf === cleanCpf)) {
                        alert("Este CPF já está cadastrado em outra conta.");
                        resetSubmitButton(submitBtn, '<i class="fa-solid fa-user-plus" style="margin-right: 8px;"></i> Concluir Cadastro & Entrar');
                        return;
                    }

                    // Salva como pendente_verificacao
                    mockUsers.push({ 
                        email, 
                        password, 
                        cpf: cleanCpf, 
                        status: 'pendente_verificacao' 
                    });
                    localStorage.setItem('fio-mock-users', JSON.stringify(mockUsers));
                    
                    if (window.sessionHelper) {
                        window.sessionHelper.setSession(email, false); // false = não verificado no banco remoto ainda
                    }
                    window.location.href = 'dashboard.html';
                }, 1000);
            } else {
                // --- MODO SUPABASE REAL ---
                try {
                    if (window.supabase) {
                        // Verifica primeiro se o CPF já existe na tabela de perfis
                        const { data: existingCpf } = await window.supabase
                            .from('profiles')
                            .select('cpf')
                            .eq('cpf', cleanCpf)
                            .maybeSingle();

                        if (existingCpf) {
                            alert("Este CPF já está cadastrado em outra conta.");
                            resetSubmitButton(submitBtn, '<i class="fa-solid fa-user-plus" style="margin-right: 8px;"></i> Concluir Cadastro & Entrar');
                            return;
                        }

                        // Registra o usuário no Supabase Auth
                        const { data, error } = await window.supabase.auth.signUp({
                            email: email,
                            password: password,
                            options: {
                                data: {
                                    is_verified: false // Inicia como falso até a confirmação
                                }
                            }
                        });

                        if (error) throw error;

                        // Grava o perfil associado contendo o CPF e status pendente_verificacao
                        const { error: profileError } = await window.supabase
                            .from('profiles')
                            .insert([{
                                id: data.user.id,
                                email: email,
                                cpf: cleanCpf,
                                status: 'pendente_verificacao'
                            }]);

                        if (profileError) throw profileError;

                        if (data.session) {
                            if (window.sessionHelper) {
                                window.sessionHelper.setSession(email, false);
                            }
                            window.location.href = 'dashboard.html';
                        } else {
                            alert("Cadastro efetuado! Confirme sua conta no seu e-mail, e depois faça login. Sua verificação de maioridade está pendente do Pix.");
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
                            window.sessionHelper.setSession(email, foundUser.status === 'verificado');
                        }
                        window.location.href = 'dashboard.html';
                    } else {
                        alert("E-mail ou senha incorretos.");
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

                        // Consulta o status real na tabela profiles
                        const { data: profile, error: profileError } = await window.supabase
                            .from('profiles')
                            .select('status')
                            .eq('id', data.user.id)
                            .single();

                        if (profileError) throw profileError;

                        const isVerified = profile.status === 'verificado';
                        
                        if (window.sessionHelper) {
                            window.sessionHelper.setSession(email, isVerified);
                        }
                        window.location.href = 'dashboard.html';
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
