document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const email = params.get('email');

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

    // Basic email validation regex
    function isValidEmail(val) {
        if (!val) return false;
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(val.trim());
    }

    if (!email || !isValidEmail(email)) {
        errorMessage.textContent = 'O e-mail fornecido é inválido ou está ausente. Certifique-se de usar o link enviado no rodapé do e-mail.';
        showStep(stepError);
        return;
    }

    // Display the email to be unsubscribed
    emailDisplay.textContent = email.trim();

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
                body: JSON.stringify({ email: email.trim() })
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
