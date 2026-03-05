require('dotenv').config();
const express = require('express');
const cors = require('cors');
const matchController = require('./controllers/matchController');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
    res.json({ status: "ok" });
});

app.get('/leagues/:leagueId/matches/today', (req, res) => {
    matchController.getTodayMatches(req, res);
});

const statsController = require('./controllers/statsController');
app.post('/matches/:matchId/prepare-stats', statsController.prepareStats);

const scoringController = require('./controllers/scoringController');
app.post('/matches/:matchId/calculate-score', scoringController.calculateScore);

const checklistController = require('./controllers/checklistController');
app.post('/matches/:matchId/generate-checklist', checklistController.generateChecklist);

const highlightsController = require('./controllers/highlightsController');
app.get('/matches/highlights/today', highlightsController.getHighlights);

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
