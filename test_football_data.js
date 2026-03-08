const axios = require('axios');
require('dotenv').config();

const API_KEY = process.env.FOOTBALL_DATA_API_KEY;
const BASE_URL = 'https://api.football-data.org/v4';

async function testManual() {
    try {
        console.log('--- TESTANDO API FOOTBALL-DATA DIRETAMENTE ---');
        const competitionCode = 'PL'; // Premier League
        const season = 2024; // Temporada atual (2024/2025)

        console.log(`URL: ${BASE_URL}/competitions/${competitionCode}/matches?season=${season}`);

        const response = await axios.get(`${BASE_URL}/competitions/${competitionCode}/matches`, {
            headers: { 'X-Auth-Token': API_KEY },
            params: { season: season }
        });

        const allMatches = response.data.matches || [];
        console.log(`Sucesso! Total de jogos na temporada: ${allMatches.length}`);

        if (allMatches.length > 0) {
            console.log('Exemplo do primeiro jogo:');
            console.log(JSON.stringify(allMatches[0], null, 2));
        }
    } catch (error) {
        console.error('ERRO NA API:', error.message);
        if (error.response) {
            console.error('STATUS:', error.response.status);
            console.error('DATA:', JSON.stringify(error.response.data, null, 2));
        }
    }
}

testManual();
