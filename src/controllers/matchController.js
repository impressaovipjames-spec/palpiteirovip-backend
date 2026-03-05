const apiFootballService = require('../services/apiFootballService');
const matchService = require('../services/matchService');
const redisService = require('../services/redisService');

/**
 * Controller to get matches for a specific league and date
 */
async function getMatches(req, res) {
    const { leagueId } = req.params;
    const { date } = req.query; // YYYY-MM-DD

    const targetDate = date || new Date().toISOString().split('T')[0];
    console.log(`Request received for leagueId: ${leagueId}, date: ${targetDate}`);

    const cacheKey = `league_${leagueId}_${targetDate}`;

    // Check Redis Cache
    const cachedData = await redisService.get(cacheKey);
    if (cachedData) {
        console.log(`Redis Cache hit for ${cacheKey}`);
        return res.json({ data: cachedData });
    }

    try {
        console.log(`Redis Cache miss for ${cacheKey}. Calling API-Football...`);
        const fixtures = await apiFootballService.getFixturesByLeague(leagueId, targetDate);
        console.log(`Received ${fixtures.length} fixtures from API`);

        // Persist to database in background
        matchService.persistMatches(fixtures).catch(err => console.error('Error persisting matches:', err));

        const simplifiedMatches = fixtures.map(f => ({
            api_id: f.fixture.id,
            home_team: f.teams.home.name,
            away_team: f.teams.away.name,
            date: f.fixture.date,
            status: f.fixture.status.short
        }));

        // Update Redis Cache (TTL of 1800s / 30 mins)
        await redisService.set(cacheKey, simplifiedMatches, 1800);

        res.json({ data: simplifiedMatches });
    } catch (error) {
        console.error('Controller Error:', error.message);
        res.status(500).json({ error: 'Failed to fetch matches', details: error.message });
    }
}

module.exports = {
    getMatches
};
