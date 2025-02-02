import TokenManager from "../utils/queue/tokenManager.js";
import secret from "../utils/secret.js";

export const isValidUser = (req, res, next) => {
    const token = req.headers['x-token-key'];
    if (!token) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
    const tokenManager = new TokenManager();
    if(!tokenManager.isTokenExist(token)){
        return res.status(401).json({ message: 'Unauthorized' });
    }
    next();
};

export const isAdmin = (req, res, next) => {
    const tokenKey = req.headers['x-admin-token-key'];
    const apikey = req.headers['x-admin-api-key'];

    if (!tokenKey || !apikey) {
        return res.status(401).json({ message: 'Unauthorized: Admin Access Required!' });
    }
    const adminTokenKey = secret.X_ADMIN_TOKEN_KEY;
    const adminApiKey = secret.X_ADMIN_API_KEY;
    if(!adminTokenKey || !adminApiKey) {
        return res.status(500).json({ message: 'Internal Server Error' });
    }
    if(adminApiKey !== apikey || adminTokenKey !== tokenKey){
        return res.status(401).json({ message: 'Unauthorized: You have no admin Access.' });
    }
    next();
};