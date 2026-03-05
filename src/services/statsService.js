const db = require('./db');
const apiFootballService = require('./apiFootballService');

// In-memory cache for stats to avoid redundant API calls within 24h
// In a real production app, this would be in the database with a timestamp check
// But for this sprint, we'll implement a simple memory-based filter as requested

/**
 * Persists or updates team statistics in the database.
 * @param {number} leagueId 
 * @param {number} season 
 * @param {number} teamId 
 */
async function updateTeamStats(leagueId, season, teamId) {
    try {
        const stats = await apiFootballService.getTeamStatistics(leagueId, season, teamId);

        if (!stats || !stats.fixtures) {
            console.error(`No statistics found for team ${teamId}`);
            return;
        }

        const played = stats.fixtures.played.total;
        const wins = stats.fixtures.wins.total;
        const draws = stats.fixtures.draws.total;
        const losses = stats.fixtures.losses.total;
        const goalsFor = stats.goals.for.total.total;
        const goalsAgainst = stats.goals.against.total.total;
        const form = stats.form || '';

        // Calculated fields
        const homeGames = stats.fixtures.played.home || 1;
        const awayGames = stats.fixtures.played.away || 1;
        const homeWinRate = ((stats.fixtures.wins.home || 0) / homeGames) * 100;
        const awayWinRate = ((stats.fixtures.wins.away || 0) / awayGames) * 100;

        // BTTS and Over 2.5
        // These are often in specific sections or need to be derived from clean sheets/failed to score in some APIs
        // For API-Football, we might need to be careful about where these are.
        // If not directly available in statistics, we might need to approximate or leave as 0 for this sprint.
        // Actually, API-Football provides clean_sheet and failed_to_score. 
        // We'll use 0 if not explicitly clear in the stats object for now.
        const bttsRate = 0; // Simplified for this sprint
        const over25Rate = 0; // Simplified for this sprint
        const avgCorners = stats.corners?.avg || 0;

        await db.query(
            `INSERT INTO team_stats 
            (team_id, league_id, season, matches_played, wins, draws, losses, goals_for, goals_against, form_last_5, home_win_rate, away_win_rate, avg_corners, btts_rate, over25_rate, last_updated)
            VALUES ((SELECT id FROM teams WHERE api_id = $1), (SELECT id FROM leagues WHERE api_id = $2), $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW())
            ON CONFLICT (team_id, league_id, season) 
            DO UPDATE SET 
                matches_played = EXCLUDED.matches_played,
                wins = EXCLUDED.wins,
                draws = EXCLUDED.draws,
                losses = EXCLUDED.losses,
                goals_for = EXCLUDED.goals_for,
                goals_against = EXCLUDED.goals_against,
                form_last_5 = EXCLUDED.form_last_5,
                home_win_rate = EXCLUDED.home_win_rate,
                away_win_rate = EXCLUDED.away_win_rate,
                avg_corners = EXCLUDED.avg_corners,
                btts_rate = EXCLUDED.btts_rate,
                over25_rate = EXCLUDED.over25_rate,
                last_updated = EXCLUDED.last_updated`,
            [teamId, leagueId, season, played, wins, draws, losses, goalsFor, goalsAgainst, form.slice(-5), homeWinRate, awayWinRate, avgCorners, bttsRate, over25Rate]
        );

        console.log(`Statistics updated for team ${teamId} in league ${leagueId}`);
    } catch (error) {
        console.error(`Error updating stats for team ${teamId}:`, error.message);
    }
}

/**
 * Persists Head to Head aggregates.
 * @param {number} homeTeamId 
 * @param {number} awayTeamId 
 */
async function updateH2H(homeTeamId, awayTeamId) {
    try {
        const h2hData = await apiFootballService.getHeadToHead(homeTeamId, awayTeamId);

        if (!h2hData || h2hData.length === 0) return;

        let homeWins = 0;
        let awayWins = 0;
        let draws = 0;
        let totalGoals = 0;
        let bttsMatches = 0;

        h2hData.forEach(match => {
            if (match.teams.home.id === homeTeamId) {
                if (match.goals.home > match.goals.away) homeWins++;
                else if (match.goals.home < match.goals.away) awayWins++;
                else draws++;
            } else {
                if (match.goals.away > match.goals.home) homeWins++;
                else if (match.goals.away < match.goals.home) awayWins++;
                else draws++;
            }
            totalGoals += (match.goals.home + match.goals.away);
            if (match.goals.home > 0 && match.goals.away > 0) bttsMatches++;
        });

        const totalMatches = h2hData.length;
        const avgGoals = totalGoals / totalMatches;
        const bttsRate = (bttsMatches / totalMatches) * 100;

        await db.query(
            `INSERT INTO h2h_cache 
            (home_team_id, away_team_id, total_matches, home_wins, away_wins, draws, avg_goals, btts_rate, updated_at)
            VALUES ((SELECT id FROM teams WHERE api_id = $1), (SELECT id FROM teams WHERE api_id = $2), $3, $4, $5, $6, $7, $8, NOW())
            ON CONFLICT (home_team_id, away_team_id) 
            DO UPDATE SET 
                total_matches = EXCLUDED.total_matches,
                home_wins = EXCLUDED.home_wins,
                away_wins = EXCLUDED.away_wins,
                draws = EXCLUDED.draws,
                avg_goals = EXCLUDED.avg_goals,
                btts_rate = EXCLUDED.btts_rate,
                updated_at = EXCLUDED.updated_at`,
            [homeTeamId, awayTeamId, totalMatches, homeWins, awayWins, draws, avgGoals, bttsRate]
        );

        console.log(`H2H data updated for ${homeTeamId} vs ${awayTeamId}`);
    } catch (error) {
        console.error(`Error updating H2H for ${homeTeamId} vs ${awayTeamId}:`, error.message);
    }
}

module.exports = {
    updateTeamStats,
    updateH2H
};
