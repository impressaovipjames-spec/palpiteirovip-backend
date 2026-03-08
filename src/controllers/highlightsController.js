const scoringService = require('../services/scoringService');

/**
 * Controller to fetch Highlights of the Day (two blocks: highConfidence + valueOpportunity)
 */
async function getHighlights(req, res) {
    try {
        console.log('Fetching highlights of the day...');
        const highlights = await scoringService.getHighlightsOfDay();

        // Return the structured two-block response directly
        res.json({
            data: highlights
        });

    } catch (error) {
        console.error('Error fetching highlights:', error.message);
        // Graceful fallback — never cause infinite loading
        res.json({
            data: { highConfidence: null, valueOpportunity: null }
        });
    }
}

module.exports = {
    getHighlights
};
