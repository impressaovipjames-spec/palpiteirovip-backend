const axios = require('axios');
require('dotenv').config();

const API_FOOTBALL_BASE_URL = 'https://v3.football.api-sports.io';
const API_KEY = process.env.API_FOOTBALL_KEY;

/**
 * Generic function to make requests to API-Football
 * @param {string} endpoint - The API endpoint (e.g., '/fixtures')
 * @param {object} params - Query parameters for the request
 * @returns {Promise<Array>} - The relevant data from the response
 */
async function apiRequest(endpoint, params) {
    try {
        const response = await axios.get(`${API_FOOTBALL_BASE_URL}${endpoint}`, {
            headers: {
                'x-apisports-key': API_KEY
            },
            params: params
        });

        console.log(`[API-Football] REQUEST ${endpoint} | Params:`, params);

        // Basic error check according to API-Football response structure
        if (response.data.errors && Object.keys(response.data.errors).length > 0) {
            console.error('[API-Football] ERROR Response:', JSON.stringify(response.data.errors));
            throw new Error('API request failed');
        }

        const resultsCount = response.data.results || 0;
        console.log(`[API-Football] SUCCESS | Results: ${resultsCount}`);

        return response.data.response;
    } catch (error) {
        console.error(`Error requesting ${endpoint}:`, error.message);
        throw error;
    }
}

/**
 * Fetch team statistics for a season and league
 * @param {number} leagueId 
 * @param {number} season 
 * @param {number} teamId 
 * @returns {Promise<object>}
 */
async function getTeamStatistics(leagueId, season, teamId) {
    // MODO VALIDAÇÃO (PLANO FREE): Forçar 2024
    const forcedSeason = 2024;
    const data = await apiRequest('/teams/statistics', {
        league: leagueId,
        season: forcedSeason,
        team: teamId
    });
    return data;
}

/**
 * Fetch Head to Head matches between two teams
 * @param {number} homeTeamId 
 * @param {number} awayTeamId 
 * @returns {Promise<Array>}
 */
async function getHeadToHead(homeTeamId, awayTeamId) {
    return await apiRequest('/fixtures/headtohead', {
        h2h: `${homeTeamId}-${awayTeamId}`
    });
}

/**
 * Fetch fixtures by league and date
 * @param {number} leagueId 
 * @param {string} date - Format YYYY-MM-DD
 * @returns {Promise<Array>}
 */
async function getFixturesByLeague(leagueId, date) {
    // MODO VALIDAÇÃO (PLANO FREE): Forçar 2024
    const forcedSeason = 2024;
    console.log(`[getFixturesByLeague] League: ${leagueId}, Date: ${date}, Forcing Season: ${forcedSeason}`);
    return await apiRequest('/fixtures', {
        league: leagueId,
        season: forcedSeason,
        date: date
    });
}

/**
 * Fetch standings for a specific league and season
 * @param {number} leagueId 
 * @param {number} season 
 * @returns {Promise<Array>}
 */
async function getStandings(leagueId, season) {
    // MODO VALIDAÇÃO (PLANO FREE): Forçar 2024
    const forcedSeason = 2024;
    return await apiRequest('/standings', {
        league: leagueId,
        season: forcedSeason
    });
}

module.exports = {
    apiRequest,
    getFixturesByLeague,
    getTeamStatistics,
    getHeadToHead,
    getStandings
};
