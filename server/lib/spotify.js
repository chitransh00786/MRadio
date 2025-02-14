import axios from 'axios';
import qs from 'querystring';
import fs from 'fs';
import { checkSimilarity } from '../utils/utils.js';
import logger from '../utils/logger.js';
import secret from '../utils/secret.js';


class SpotifyAPI {
    constructor() {
        this.clientId = secret.SPOTIFY_CLIEND_ID;
        this.clientSecret = secret.SPOTIFY_CLIEND_SECRET_ID;
        this.authHeader = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
        this.tokenUrl = 'https://accounts.spotify.com/api/token';
        this.tokenFilePath = './config/token.json';
    }

    async getAccessToken() {
        const data = qs.stringify({ grant_type: 'client_credentials' });
        const config = {
            headers: {
                'Authorization': `Basic ${this.authHeader}`,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
        };

        try {
            const response = await axios.post(this.tokenUrl, data, config);
            const accessToken = response.data.access_token;
            return accessToken;
        } catch (error) {
            console.error('Error fetching access token:', error.response ? error.response.data : error.message);
            throw error;
        }
    }

    tokenFileExists() {
        return fs.existsSync(this.tokenFilePath);
    }

    readTokenFromFile() {
        const data = fs.readFileSync(this.tokenFilePath, 'utf8');
        return JSON.parse(data);
    }

    writeTokenToFile(token, expiration) {
        const tokenData = {
            accessToken: token,
            expiration: expiration,
        };
        fs.writeFileSync(this.tokenFilePath, JSON.stringify(tokenData, null, 2));
    }

    isTokenValid() {
        if (this.tokenFileExists()) {
            const tokenData = this.readTokenFromFile();
            return Date.now() < tokenData.expiration;
        }
        return false;
    }

    async getValidAccessToken() {
        if (!this.isTokenValid()) {
            const accessToken = await this.getAccessToken();
            const expiration = Date.now() + 3600 * 1000 - 5000;
            this.writeTokenToFile(accessToken, expiration);
        }

        const tokenData = this.readTokenFromFile();
        return tokenData.accessToken;
    }

    async searchTrack(query) {
        try {
            const accessToken = await this.getValidAccessToken();
            const url = `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=10&include_external=audio`;
            const response = await axios.get(url, {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
            });
            const foundMusic = response.data.tracks.items.find(track => checkSimilarity(query, track.name) > 60);
            return foundMusic;
        } catch (error) {
            console.error('Error searching for track:', error.response ? error.response.data : error.message);
            throw error;
        }
    }

}

export default SpotifyAPI;
