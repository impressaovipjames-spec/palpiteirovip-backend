const scoringService = require('../services/scoringService');

/**
 * Controller to fetch Highlights of the Day
 */
async function getHighlights(req, res) {
    try {
        console.log('Fetching highlights of the day...');
        const highlights = await scoringService.getHighlightsOfDay();

        // The specification demands returning the array directly
        res.json(highlights);

    } catch (error) {
        console.error('Error fetching highlights:', error.message);
        res.status(500).json({ error: 'Failed to fetch highlights', details: error.message });
    }
}

module.exports = {
    getHighlights
};
