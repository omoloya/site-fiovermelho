module.exports = async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    return res.status(200).json({ ADMIN_EMAILS: process.env.ADMIN_EMAILS || null });
};
