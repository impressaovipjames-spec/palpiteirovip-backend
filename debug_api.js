const axios = require('axios');
require('dotenv').config();

const API_KEY = '679c3722a969472e821107578ee19159'; // Usando a chave que forneci no provider para teste rápido
const BASE_URL = 'https://api.football-data.org/v4';

async function debugAPI() {
    try {
        console.log('--- DEBUG FOOTBALL-DATA.ORG ---');
        // Testar endpoint de matches geral com range
        const response = await axios.get(`${BASE_URL}/matches`, {
            headers: { 'X-Auth-Token': API_KEY },
            params: {
                dateFrom: '2024-11-20',
                dateTo: '2024-11-21',
                competitions: 'BSA,PL,PD'
            }
        });

        console.log('Status:', response.status);
        console.log('Matches found:', response.data.matches.length);
        if (response.data.matches.length > 0) {
            console.log('Match Example:', JSON.stringify(response.data.matches[0], null, 2));
        }
    } catch (error) {
        console.error('Erro:', error.message);
        if (error.response) console.error('Data:', error.response.data);
    }
}

debugAPI();
