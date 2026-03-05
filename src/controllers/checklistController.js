const scoringService = require('../services/scoringService');

/**
 * Controller to generate the base checklist probabilities for a match.
 */
async function generateChecklist(req, res) {
    const { matchId } = req.params;

    try {
        console.log(`Generating base checklist for match API ID: ${matchId}`);
        const result = await scoringService.calculateMatchProbabilities(matchId);

        // Respond exactly structured as requested
        res.json({
            status: "checklist_completo_avancado_gerado",
            data: result // Adding data for easy testing/verification
        });

    } catch (error) {
        console.error('Error generating checklist:', error.message);
        if (error.message.includes('Raw scores not generated yet')) {
            return res.status(400).json({ error: error.message });
        }
        res.status(500).json({ error: 'Failed to generate checklist', details: error.message });
    }
}

module.exports = {
    generateChecklist
};
