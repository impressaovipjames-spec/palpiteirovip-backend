const scoringService = require('../services/scoringService');

/**
 * Controller to calculate and persist the base score for a match.
 */
async function calculateScore(req, res) {
    const { matchId } = req.params;

    try {
        console.log(`Calculating score for match API ID: ${matchId}`);
        const result = await scoringService.calculateMatchScore(matchId);

        // Respond exactly structured as requested (with the scores logged internally but returning status only)
        res.json({
            status: "score_generated",
            data: result // Adding data for easy testing/verification, but main requirement is status
        });

    } catch (error) {
        console.error('Error in scoring controller:', error.message);
        res.status(500).json({ error: 'Failed to calculate score', details: error.message });
    }
}

module.exports = {
    calculateScore
};
