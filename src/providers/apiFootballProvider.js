const apiFootballService = require('../services/apiFootballService');

/**
 * Adaptador para o provedor API-Football (v3.football.api-sports.io)
 */
async function getFixtures(leagueId, date) {
    const fixtures = await apiFootballService.getFixturesByLeague(leagueId, date);

    // Converte para o formato interno
    return (fixtures || []).map(f => ({
        api_id: f.fixture.id,
        home_team: {
            name: f.teams.home.name,
            logo: f.teams.home.logo,
            api_id: f.teams.home.id
        },
        away_team: {
            name: f.teams.away.name,
            logo: f.teams.away.logo,
            api_id: f.teams.away.id
        },
        league: {
            name: f.league.name,
            country: f.league.country,
            logo: f.league.logo,
            api_id: f.league.id
        },
        date: f.fixture.date,
        status: f.fixture.status.short
    }));
}

module.exports = {
    getFixtures
};
