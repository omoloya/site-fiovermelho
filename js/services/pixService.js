/* ==========================================================================
   SERVIÇO MODULAR DE PAGAMENTO PIX (Produção Segura & Fallback Offline)
   ========================================================================== */

window.PixService = {
    /**
     * Gera uma nova cobrança Pix para validação de idade ou doação.
     * 
     * @param {number} amount Valor em reais (ex: 1.50)
     * @param {string} reference Identificador/Referência interna
     * @returns {Promise<{transactionId: string, qrCodeUrl: string, copyPasteCode: string}>}
     */
    generatePixCharge: async function(amount, reference = "fiovermelho_validation") {
        console.log(`[PixService] Gerando cobrança Pix de R$ ${amount}...`);
        
        if (window.isOfflineMode) {
            // --- MODO SIMULADO / OFFLINE ---
            return new Promise((resolve) => {
                setTimeout(() => {
                    const mockTransactionId = "tx_" + Math.random().toString(36).substring(2, 15);
                    const mockCopyPasteCode = `00020101021226830014br.gov.bcb.pix0114+55119999999995204000053039865802BR5920ECA_DIGITAL_GATEWAY6009SAO_PAULO62290525${mockTransactionId}6304c10a`;
                    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&color=08080a&bgcolor=ffffff&data=${encodeURIComponent(mockCopyPasteCode)}`;
                    
                    resolve({
                        transactionId: mockTransactionId,
                        qrCodeUrl: qrCodeUrl,
                        copyPasteCode: mockCopyPasteCode
                    });
                }, 300);
            });
        }
        
        // --- MODO REAL / PRODUÇÃO ---
        const session = window.sessionHelper ? window.sessionHelper.getSession() : null;
        const email = session?.user?.email || "leitor@fiovermelho.com";
        const cpf = localStorage.getItem('fio-temp-cpf') || "000.000.000-00";

        const response = await fetch('/api/criar-pix', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ amount, email, cpf })
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error || 'Falha ao criar cobrança Pix no gateway.');
        }

        const data = await response.json();
        
        // Formata a imagem do QR Code se for base64 puro retornado pelo Mercado Pago
        let qrCodeUrl = data.qrCodeUrl;
        if (qrCodeUrl && !qrCodeUrl.startsWith('http') && !qrCodeUrl.startsWith('data:')) {
            qrCodeUrl = `data:image/png;base64,${data.qrCodeUrl}`;
        }

        return {
            transactionId: data.transactionId,
            qrCodeUrl: qrCodeUrl,
            copyPasteCode: data.copyPasteCode
        };
    },

    /**
     * Escuta ou consulta o status do pagamento do Pix de forma segura.
     * 
     * @param {string} transactionId ID retornado na geração da cobrança
     * @param {function} onStatusChange Callback que recebe (status, data)
     */
    listenToPaymentStatus: function(transactionId, onStatusChange) {
        console.log(`[PixService] Monitorando transação ${transactionId}...`);
        
        if (window.isOfflineMode) {
            // --- MODO SIMULADO / OFFLINE (Aprovação simulada após 6 segundos para testes locais) ---
            let isApproved = false;
            const intervalTime = 1000;
            let elapsedTime = 0;
            
            const checkStatusInterval = setInterval(() => {
                elapsedTime += intervalTime;
                
                if (elapsedTime >= 6000 && !isApproved) {
                    isApproved = true;
                    clearInterval(checkStatusInterval);
                    console.log("🧶 [PixService] Pagamento simulado confirmado (Modo Offline).");
                    onStatusChange('APPROVED', {
                        transactionId: transactionId,
                        approvedAt: new Date().toISOString(),
                        payerCpf: "***.000.000-**"
                    });
                }
            }, intervalTime);

            return {
                cancel: () => {
                    clearInterval(checkStatusInterval);
                    console.log(`[PixService] Monitoramento offline de ${transactionId} cancelado.`);
                }
            };
        } else {
            // --- MODO REAL / PRODUÇÃO (Polling seguro sem nenhuma simulação de tempo) ---
            const intervalTime = 3000;
            
            const checkStatusInterval = setInterval(async () => {
                try {
                    let userId = null;
                    if (window.supabase) {
                        try {
                            const { data } = await window.supabase.auth.getSession();
                            userId = data?.session?.user?.id;
                        } catch (e) {}
                    }
                    if (!userId && window.sessionHelper) {
                        const session = window.sessionHelper.getSession();
                        userId = session?.user?.id;
                    }

                    const userParam = userId ? `&user_id=${userId}` : '';
                    const res = await fetch(`/api/checar-pix?payment_id=${transactionId}${userParam}&_t=${Date.now()}`);
                    
                    if (res.ok) {
                        const data = await res.json();
                        
                        if (data.status === 'approved' || data.verificado === true) {
                            clearInterval(checkStatusInterval);
                            onStatusChange('APPROVED', {
                                transactionId: transactionId,
                                approvedAt: data.approvedAt || new Date().toISOString(),
                                payerCpf: data.payerCpf || "***.***.***-**"
                            });
                        }
                    }
                } catch (err) {
                    console.error("[PixService] Erro ao verificar pagamento no servidor:", err);
                }
            }, intervalTime);

            return {
                cancel: () => {
                    clearInterval(checkStatusInterval);
                    console.log(`[PixService] Monitoramento de ${transactionId} cancelado.`);
                }
            };
        }
    }
};
