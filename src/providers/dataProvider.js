const apiFootballProvider = require('./apiFootballProvider');
const footballDataProvider = require('./footballDataProvider');

/**
 * Interface padronizada de dados para o sistema.
 * Converte diferentes fontes para o formato interno:
 * {
 *   api_id: number,
 *   home_team: { name, logo, api_id },
 *   away_team: { name, logo, api_id },
 *   league: { name, country, logo, api_id },
 *   date: string,
 *   status: string
 * }
 */
async function getFixtures(leagueId, date) {
    const provider = process.env.DATA_PROVIDER || 'football-data';
    console.log(`[dataProvider] PROVIDER ATIVO: ${provider}`);
    console.log(`[dataProvider] Utilizando provedor: ${provider} para Liga: ${leagueId}, Data: ${date}`);

    if (provider === 'api-football') {
        return await apiFootballProvider.getFixtures(leagueId, date);
    } else if (provider === 'football-data') {
        return await footballDataProvider.getFixtures(leagueId, date);
    } else {
        throw new Error(`Provedor de dados desconhecido: ${provider}`);
    }
}

module.exports = {
    getFixtures
};
