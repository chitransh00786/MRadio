import axios from 'axios';
import qs from 'querystring';
import fs from 'fs';
import dotenv from 'dotenv';
import { checkSimilarity } from '../utils/utils.js';

dotenv.config();

class SpotifyAPI {
    constructor() {
        this.clientId = process.env.SPOTIFY_CLIEND_ID;
        this.clientSecret = process.env.SPOTIFY_CLIEND_SECRET_ID;
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
            console.log('Fetching new access token...');
            const accessToken = await this.getAccessToken();
            const expiration = Date.now() + 3600 * 1000 - 5000; // Token expires in 1 hour minus 5 seconds
            this.writeTokenToFile(accessToken, expiration);
        } else {
            console.log('Using cached access token...');
        }

        const tokenData = this.readTokenFromFile();
        return tokenData.accessToken;
    }

    async searchTrack(query) {
        try {
            const accessToken = await this.getValidAccessToken();
            const url = `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=10&include_external=audio`;
            console.log("url ", url);
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
