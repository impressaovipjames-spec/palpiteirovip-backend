const axios = require('axios');
require('dotenv').config();

const API_FOOTBALL_BASE_URL = 'https://v3.football.api-sports.io';
const API_KEY = process.env.API_FOOTBALL_KEY;

async function testNoSeason() {
    const leagueId = 73; // Copa do Brasil
    const date = '2026-03-05';
    console.log(`--- Testando /fixtures SEM season ---`);
    console.log(`League ID: ${leagueId}, Date: ${date}`);

    try {
        const response = await axios.get(`${API_FOOTBALL_BASE_URL}/fixtures`, {
            headers: { 'x-apisports-key': API_KEY },
            params: {
                league: leagueId,
                date: date
            }
        });

        console.log(`Status: ${response.status}`);
        console.log(`Erros: ${JSON.stringify(response.data.errors)}`);
        console.log(`Quantidade: ${response.data.results}`);

        if (response.data.response && response.data.response.length > 0) {
            console.log('Sucesso! Primeiros jogos:', response.data.response.map(f => f.teams.home.name + ' vs ' + f.teams.away.name));
        }
    } catch (error) {
        console.error('Erro:', error.message);
    }
}

testNoSeason();
