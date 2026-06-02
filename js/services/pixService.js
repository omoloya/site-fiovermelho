/* ==========================================================================
   SERVIÇO MODULAR DE PAGAMENTO PIX (Mockado & Pronto para API Real)
   ========================================================================== */

window.PixService = {
    /**
     * Gera uma nova cobrança Pix para validação de idade.
     * Na versão real, você fará uma requisição POST/Fetch para o seu backend ou gateway (Asaas, Mercado Pago, etc.)
     * 
     * @param {number} amount Valor em reais (ex: 1.50)
     * @param {string} reference Identificador/CPF/Referência interna
     * @returns {Promise<{transactionId: string, qrCodeUrl: string, copyPasteCode: string}>}
     */
    generatePixCharge: async function(amount, reference = "fiovermelho_validation") {
        console.log(`🧶 [PixService] Gerando cobrança Pix de R$ ${amount}...`);
        
        // --- SIMULAÇÃO (MOCK) ---
        // Você pode substituir todo este bloco de retorno pelo Fetch real para seu gateway:
        /*
        const response = await fetch('https://api.seudominio.com/payments/pix', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount, reference })
        });
        return await response.json();
        */
        
        return new Promise((resolve) => {
            setTimeout(() => {
                const mockTransactionId = "tx_" + Math.random().toString(36).substring(2, 15);
                
                // Código Copia e Cola estruturado nos padrões Pix do Banco Central
                const mockCopyPasteCode = `00020101021226830014br.gov.bcb.pix0114+55119999999995204000053039865802BR5920ECA_DIGITAL_GATEWAY6009SAO_PAULO62290525${mockTransactionId}6304c10a`;
                
                // Gerador de QR Code gratuito e confiável por API
                const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&color=08080a&bgcolor=ffffff&data=${encodeURIComponent(mockCopyPasteCode)}`;
                
                resolve({
                    transactionId: mockTransactionId,
                    qrCodeUrl: qrCodeUrl,
                    copyPasteCode: mockCopyPasteCode
                });
            }, 300); // Rápido atraso visual de processamento
        });
    },

    /**
     * Escuta ou consulta o status do pagamento do Pix.
     * Na versão real, isso fará um pooling periódico de GET no seu backend ou escutará um WebSocket.
     * 
     * @param {string} transactionId ID retornado na geração da cobrança
     * @param {function} onStatusChange Callback que recebe (status, data)
     */
    listenToPaymentStatus: function(transactionId, onStatusChange) {
        console.log(`🧶 [PixService] Monitorando status da transação ${transactionId}...`);
        
        // --- SIMULAÇÃO (MOCK) ---
        // Simula uma aprovação de Pix automática após 6 segundos para demonstração
        let isApproved = false;
        const intervalTime = 1000;
        let elapsedTime = 0;
        
        const checkStatusInterval = setInterval(() => {
            elapsedTime += intervalTime;
            
            // --- CÓDIGO DA API REAL (Exemplo de substituição) ---
            /*
            fetch(`https://api.seudominio.com/payments/status/${transactionId}`)
                .then(res => res.json())
                .then(data => {
                    if (data.status === 'APPROVED') {
                        clearInterval(checkStatusInterval);
                        onStatusChange('APPROVED', data);
                    }
                });
            */
            
            // Apenas para testes/demonstração: Aprova em 6 segundos
            if (elapsedTime >= 6000 && !isApproved) {
                isApproved = true;
                clearInterval(checkStatusInterval);
                console.log("🧶 [PixService] Pagamento simulado confirmado via gateway!");
                onStatusChange('APPROVED', {
                    transactionId: transactionId,
                    approvedAt: new Date().toISOString(),
                    payerCpf: "***.482.918-**" // Simula o retorno de CPF validado pelo ECA Digital
                });
            }
        }, intervalTime);

        // Retorna um método para caso precise cancelar o monitoramento
        return {
            cancel: () => {
                clearInterval(checkStatusInterval);
                console.log(`🧶 [PixService] Monitoramento de ${transactionId} cancelado.`);
            }
        };
    }
};
