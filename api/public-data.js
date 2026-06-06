module.exports = async (req, res) => {
    const token = process.env.MERCADO_PAGO_ACCESS_TOKEN;
    if (!token) {
        return res.status(500).json({ error: 'MERCADO_PAGO_ACCESS_TOKEN não configurado.' });
    }
    try {
        const response = await fetch('https://api.mercadopago.com/users/me', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        const data = await response.json();
        return res.status(200).json(data);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};
