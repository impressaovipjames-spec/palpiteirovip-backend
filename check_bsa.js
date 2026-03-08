const axios = require('axios');
require('dotenv').config();

const API_KEY = '679c3722a969472e821107578ee19159';
const BASE_URL = 'https://api.football-data.org/v4';

async function checkCompetition() {
    try {
        console.log('--- CHECK COMPETITION: BSA ---');
        const response = await axios.get(`${BASE_URL}/competitions/BSA`, {
            headers: { 'X-Auth-Token': API_KEY }
        });

        console.log('Name:', response.data.name);
        console.log('Current Season:', response.data.currentSeason ? response.data.currentSeason.startDate : 'N/A');
        console.log('Seasons count:', response.data.seasons ? response.data.seasons.length : 0);
    } catch (error) {
        console.error('Erro:', error.message);
        if (error.response) console.error('Data:', error.response.data);
    }
}

checkCompetition();
