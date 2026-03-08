const dataProvider = require('./src/providers/dataProvider');
const matchService = require('./src/services/matchService');
require('dotenv').config();

async function testPipeline() {
    console.log('--- TESTE DE PIPELINE: PROVEDOR TEMPORÁRIO ---');

    // Forçar provedor football-data via env para o teste
    process.env.DATA_PROVIDER = 'football-data';

    const leagueId = 13; // Premier League (Mapeado para PL)
    const date = '2024-08-17'; // Data com jogos reais na PL 2024

    try {
        console.log(`Buscando jogos para Liga ${leagueId} em ${date}...`);
        const fixtures = await dataProvider.getFixtures(leagueId, date);

        console.log(`Jogos recebidos: ${fixtures.length}`);

        if (fixtures.length > 0) {
            console.log('Primeiro jogo (Interno):', fixtures[0]);

            console.log('Testando persistência...');
            await matchService.persistMatches(fixtures);
            console.log('Sucesso na persistência!');
        } else {
            console.log('Nenhum jogo encontrado para esta data no football-data.org.');
        }
    } catch (error) {
        console.error('Erro no teste:', error.message);
    }
}

testPipeline();
