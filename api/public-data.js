module.exports = async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    return res.status(200).json({ token: process.env.MERCADO_PAGO_ACCESS_TOKEN || null });
};
