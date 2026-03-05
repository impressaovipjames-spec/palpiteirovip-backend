const db = require('../services/db');
const statsService = require('../services/statsService');

/**
 * Controller to prepare statistics for a specific match.
 * Fetches team stats and H2H data if not updated in the last 24h.
 */
async function prepareStats(req, res) {
    const { matchId } = req.params;

    try {
        // 1. Identify teams and league from the match
        const matchQuery = await db.query(
            `SELECT m.league_id, m.home_team_id, m.away_team_id, 
                    l.api_id as league_api_id, 
                    t1.api_id as home_api_id, 
                    t2.api_id as away_api_id
             FROM matches m
             JOIN leagues l ON m.league_id = l.id
             JOIN teams t1 ON m.home_team_id = t1.id
             JOIN teams t2 ON m.away_team_id = t2.id
             WHERE m.api_id = $1`,
            [matchId]
        );

        if (matchQuery.rows.length === 0) {
            return res.status(404).json({ error: 'Match not found' });
        }

        const match = matchQuery.rows[0];
        const season = new Date().getFullYear();
        const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

        // 2. Check and update Home Team Stats
        const homeStatsCheck = await db.query(
            'SELECT last_updated FROM team_stats WHERE team_id = $1 AND league_id = $2 AND season = $3',
            [match.home_team_id, match.league_id, season]
        );

        const shouldUpdateHome = homeStatsCheck.rows.length === 0 ||
            (Date.now() - new Date(homeStatsCheck.rows[0].last_updated).getTime() > TWENTY_FOUR_HOURS);

        if (shouldUpdateHome) {
            console.log(`Updating home team stats: ${match.home_api_id}`);
            await statsService.updateTeamStats(match.league_api_id, season, match.home_api_id);
        }

        // 3. Check and update Away Team Stats
        const awayStatsCheck = await db.query(
            'SELECT last_updated FROM team_stats WHERE team_id = $1 AND league_id = $2 AND season = $3',
            [match.away_team_id, match.league_id, season]
        );

        const shouldUpdateAway = awayStatsCheck.rows.length === 0 ||
            (Date.now() - new Date(awayStatsCheck.rows[0].last_updated).getTime() > TWENTY_FOUR_HOURS);

        if (shouldUpdateAway) {
            console.log(`Updating away team stats: ${match.away_api_id}`);
            await statsService.updateTeamStats(match.league_api_id, season, match.away_api_id);
        }

        // 4. Check and update H2H
        const h2hCheck = await db.query(
            'SELECT updated_at FROM h2h_cache WHERE home_team_id = $1 AND away_team_id = $2',
            [match.home_team_id, match.away_team_id]
        );

        const shouldUpdateH2H = h2hCheck.rows.length === 0 ||
            (Date.now() - new Date(h2hCheck.rows[0].updated_at).getTime() > TWENTY_FOUR_HOURS);

        if (shouldUpdateH2H) {
            console.log(`Updating H2H: ${match.home_api_id} vs ${match.away_api_id}`);
            await statsService.updateH2H(match.home_api_id, match.away_api_id);
        }

        res.json({ status: "stats_prepared" });

    } catch (error) {
        console.error('Error preparing stats:', error.message);
        res.status(500).json({ error: 'Failed to prepare stats', details: error.message });
    }
}

module.exports = {
    prepareStats
};
