const dataProvider = require('../providers/dataProvider');
const matchService = require('../services/matchService');
const redisService = require('../services/redisService');

/**
 * Controller to get matches for a specific league and date
 */
async function getMatches(req, res) {
    const { leagueId } = req.params;
    const { date } = req.query; // YYYY-MM-DD

    // CORREÇÃO TIMEZONE BRASIL (America/Sao_Paulo)
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('af-ZA', { // Format YYYY-MM-DD
        timeZone: 'America/Sao_Paulo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
    const brDate = formatter.format(now).replace(/\//g, '-');

    let targetDate = date || brDate;

    console.log(`[matchController] Request: leagueId=${leagueId}, targetDate=${targetDate} (Lógica Dinâmica Sprint 32 ATIVA)`);

    const cacheKey = `league_${leagueId}_dynamic_next`;

    // TEMP: Desabilitar cache para auditoria de dados reais
    const DISABLE_CACHE = true;

    if (!DISABLE_CACHE) {
        const cachedData = await redisService.get(cacheKey);
        if (cachedData) {
            console.log(`Redis Cache hit for ${cacheKey}`);
            return res.json({ data: cachedData });
        }
    } else {
        console.log(`[AUDITORIA] Cache desabilitado para ${cacheKey} (Sprint 32)`);
    }

    try {
        console.log(`[AUDITORIA] Chamando DataProvider com Lógica Dinâmica...`);
        const standardizedFixtures = await dataProvider.getFixtures(leagueId, targetDate);
        console.log(`[AUDITORIA] Recebidos ${standardizedFixtures ? standardizedFixtures.length : 0} jogos do provedor.`);

        // Persist to database in background
        matchService.persistMatches(standardizedFixtures).catch(err => console.error('Error persisting matches:', err));

        const simplifiedMatches = (standardizedFixtures || []).map(f => ({
            api_id: f.api_id,
            home_team: f.home_team.name,
            away_team: f.away_team.name,
            date: f.date,
            status: f.status
        }));

        if (!DISABLE_CACHE) {
            await redisService.set(cacheKey, simplifiedMatches, 1800);
        }

        res.json({ data: simplifiedMatches });
    } catch (error) {
        console.error('Controller Error:', error.message);
        res.status(500).json({ error: 'Failed to fetch matches', details: error.message });
    }
}

module.exports = {
    getMatches
};
