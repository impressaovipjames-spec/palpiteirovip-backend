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

        // Basic error check according to API-Football response structure
        if (response.data.errors && Object.keys(response.data.errors).length > 0) {
            console.error('API-Football Error:', response.data.errors);
            throw new Error('API request failed');
        }

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
    const data = await apiRequest('/teams/statistics', {
        league: leagueId,
        season: season,
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
    const season = new Date().getFullYear();
    return await apiRequest('/fixtures', {
        league: leagueId,
        season: season,
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
    return await apiRequest('/standings', {
        league: leagueId,
        season: season
    });
}

module.exports = {
    apiRequest,
    getFixturesByLeague,
    getTeamStatistics,
    getHeadToHead,
    getStandings
};
