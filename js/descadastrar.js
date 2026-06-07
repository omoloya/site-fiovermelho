document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');

    const stepConfirm = document.getElementById('step-confirm');
    const stepSuccess = document.getElementById('step-success');
    const stepError = document.getElementById('step-error');

    const emailDisplay = document.getElementById('unsubscribe-email');
    const btnUnsubscribe = document.getElementById('btn-unsubscribe');
    const errorMessage = document.getElementById('error-message');

    // Helper to switch active step view
    function showStep(stepElement) {
        document.querySelectorAll('.auth-step').forEach(el => {
            el.classList.remove('active');
        });
        stepElement.classList.add('active');
    }

    // Basic UUID validation
    function isValidID(val) {
        if (!val) return false;
        if (val === 'mock-admin-uuid') return true;
        const re = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        return re.test(val.trim());
    }

    if (!id || !isValidID(id)) {
        errorMessage.textContent = 'O identificador de descadastro fornecido é inválido ou está ausente. Certifique-se de usar o link enviado no rodapé do e-mail.';
        showStep(stepError);
        return;
    }

    // Check if the UUID exists on the server and fetch the associated email
    async function verificarCadastro() {
        try {
            const response = await fetch(`/api/descadastrar-leitor?id=${encodeURIComponent(id.trim())}`);
            const data = await response.json();

            if (response.ok && data.success && data.email) {
                emailDisplay.textContent = data.email;
            } else {
                errorMessage.textContent = data.error || 'Identificador de descadastro não encontrado ou já processado.';
                showStep(stepError);
            }
        } catch (err) {
            console.error('Erro ao verificar cadastro por ID:', err);
            errorMessage.textContent = 'Erro de comunicação com o servidor ao carregar seus dados. Tente novamente mais tarde.';
            showStep(stepError);
        }
    }

    // Initiate lookup
    verificarCadastro();

    // Event listener for confirmation
    btnUnsubscribe.addEventListener('click', async () => {
        // Toggle loading state
        btnUnsubscribe.disabled = true;
        btnUnsubscribe.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processando...';

        try {
            const response = await fetch('/api/descadastrar-leitor', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ id: id.trim() })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                showStep(stepSuccess);
            } else {
                errorMessage.textContent = data.error || 'Não foi possível concluir o descadastro no servidor. Tente novamente mais tarde.';
                showStep(stepError);
            }
        } catch (err) {
            console.error('Erro ao realizar descadastro:', err);
            errorMessage.textContent = 'Erro de comunicação com o servidor. Verifique sua conexão e tente novamente.';
            showStep(stepError);
        } finally {
            btnUnsubscribe.disabled = false;
            btnUnsubscribe.innerHTML = '<i class="fa-solid fa-user-minus"></i> Confirmar Descadastro';
        }
    });
});
