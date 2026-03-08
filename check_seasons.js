const axios = require('axios');
require('dotenv').config();

const API_FOOTBALL_BASE_URL = 'https://v3.football.api-sports.io';
const API_KEY = process.env.API_FOOTBALL_KEY;

async function checkLeagues() {
    const leagueId = 71; // Brasileirão
    console.log(`--- Verificando Seasons Disponíveis para League ${leagueId} ---`);

    try {
        const response = await axios.get(`${API_FOOTBALL_BASE_URL}/leagues`, {
            headers: { 'x-apisports-key': API_KEY },
            params: { id: leagueId }
        });

        if (response.data.response && response.data.response[0]) {
            const seasons = response.data.response[0].seasons;
            console.log('Seasons disponíveis:');
            seasons.forEach(s => {
                console.log(`Year: ${s.year}, Current: ${s.current}`);
            });
        } else {
            console.log('Nenhuma liga encontrada ou erro:', JSON.stringify(response.data.errors));
        }
    } catch (error) {
        console.error('Erro:', error.message);
    }
}

checkLeagues();
