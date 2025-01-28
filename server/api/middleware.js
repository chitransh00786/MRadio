const express = require('express');

const authenticateUser = (req, res, next) => {
    const token = req.headers['x-token-key'];

    if (!token) {
        return res.status(401).json({ message: 'Unauthorized: No token provided' });
    }

    next();
};

const isAdmin = (req, res, next) => {
    const token = req.headers['x-token-key'];
    const xApikey = req.headers['x-apikey-key'];

    if (!token || !xApikey) {
        return res.status(401).json({ message: 'Unauthorized: No token provided! Admin Access Required!' });
    }
    
    next();
};

module.exports = authenticateUser;