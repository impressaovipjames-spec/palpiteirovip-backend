const db = require('./db');

/**
 * Ensures a team exists in the database, inserting it if necessary.
 * @param {object} teamData - Team data from API-Football
 * @returns {Promise<number>} - The internal ID of the team
 */
async function ensureTeamExists(teamData) {
    const { id: apiId, name, logo } = teamData;
    const res = await db.query('SELECT id FROM teams WHERE api_id = $1', [apiId]);

    if (res.rows.length > 0) {
        return res.rows[0].id;
    }

    const insertRes = await db.query(
        'INSERT INTO teams (name, logo_url, api_id) VALUES ($1, $2, $3) RETURNING id',
        [name, logo, apiId]
    );
    return insertRes.rows[0].id;
}

/**
 * Ensures a league exists in the database, inserting it if necessary.
 * @param {object} leagueData - League data from API-Football
 * @returns {Promise<number>} - The internal ID of the league
 */
async function ensureLeagueExists(leagueData) {
    const { id: apiId, name, logo, country } = leagueData;
    const res = await db.query('SELECT id FROM leagues WHERE api_id = $1', [apiId]);

    if (res.rows.length > 0) {
        return res.rows[0].id;
    }

    const insertRes = await db.query(
        'INSERT INTO leagues (name, country, logo_url, api_id) VALUES ($1, $2, $3, $4) RETURNING id',
        [name, country, logo, apiId]
    );
    return insertRes.rows[0].id;
}

/**
 * Persists a list of fixtures to the database.
 * @param {Array} fixtures - Array of fixtures from API-Football
 */
async function persistMatches(fixtures) {
    for (const fixtureObj of fixtures) {
        const { fixture, league, teams } = fixtureObj;

        // Ensure teams and league exist first
        const internalLeagueId = await ensureLeagueExists(league);
        const internalHomeTeamId = await ensureTeamExists(teams.home);
        const internalAwayTeamId = await ensureTeamExists(teams.away);

        // Check if match already exists
        const matchRes = await db.query('SELECT id FROM matches WHERE api_id = $1', [fixture.id]);

        if (matchRes.rows.length === 0) {
            await db.query(
                `INSERT INTO matches (league_id, home_team_id, away_team_id, match_date, status, api_id) 
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [internalLeagueId, internalHomeTeamId, internalAwayTeamId, fixture.date, fixture.status.short, fixture.id]
            );
            console.log(`Match ${fixture.id} inserted into database.`);
        }
    }
}

module.exports = {
    persistMatches
};
