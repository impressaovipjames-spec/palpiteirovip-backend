const apiFootballService = require('./src/services/apiFootballService');
require('dotenv').config();

async function test() {
    const leagueId = 73; // Copa do Brasil
    const date = '2026-03-05';
    console.log(`--- DIAGNÓSTICO SPRINT 25 ---`);
    console.log(`League ID: ${leagueId}`);
    console.log(`Date: ${date}`);

    try {
        const fixtures = await apiFootballService.getFixturesByLeague(leagueId, date);
        console.log(`Quantidade de jogos retornados: ${fixtures.length}`);

        if (fixtures.length === 0) {
            console.log('RESPOSTA BRUTA (VAZIA OU SEM JOGOS):');
            // We can't see the axios response here because apiRequest only returns data.response
            // I should modify apiRequest temporarily or use a raw axios call in this script.
        } else {
            console.log('Primeiro jogo retornado:', JSON.stringify(fixtures[0], null, 2));
        }
    } catch (error) {
        console.error('Erro na chamada:', error.message);
    }
}

test();
