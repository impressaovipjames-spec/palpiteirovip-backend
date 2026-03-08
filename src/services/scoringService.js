const db = require('./db');
const apiFootballService = require('./apiFootballService');

// Weights
const WEIGHTS = {
    RECENT_FORM: 0.30,
    H2H: 0.20,
    HOME_AWAY_STRENGTH: 0.20,
    GOAL_AVG: 0.15,
    STANDINGS: 0.15
};

/**
 * Normalizes recent form (last 5 matches) to a score out of 100.
 * W=3, D=1, L=0. Max points = 15.
 */
function calculateFormScore(formString) {
    if (!formString) return 50; // Default if no form
    let points = 0;
    for (const char of formString.toUpperCase()) {
        if (char === 'W') points += 3;
        if (char === 'D') points += 1;
    }
    return (points / 15) * 100;
}

/**
 * Normalizes standing position to a score out of 100.
 */
function calculateStandingScore(rank, totalTeams) {
    if (!rank || !totalTeams) return 50;
    // 1st place = 100, last place = 0 approx.
    return ((totalTeams - rank) / (totalTeams - 1)) * 100;
}

/**
 * Normalizes goal average to a score between 0 and 100.
 * A team scoring 2.5+ goals per game gets 100.
 */
function calculateGoalScore(goalsFor, matchesPlayed) {
    if (!matchesPlayed || matchesPlayed === 0) return 50;
    const avg = goalsFor / matchesPlayed;
    return Math.min((avg / 2.5) * 100, 100);
}

/**
 * Fetches required data and calculates the base match score
 * @param {number} matchId 
 */
async function calculateMatchScore(matchId) {
    try {
        // 1. Fetch match and teams info
        const matchRes = await db.query(
            `SELECT m.id, m.league_id, m.home_team_id, m.away_team_id, 
                    l.api_id as league_api_id, t1.api_id as home_api_id, t2.api_id as away_api_id
             FROM matches m
             JOIN leagues l ON m.league_id = l.id
             JOIN teams t1 ON m.home_team_id = t1.id
             JOIN teams t2 ON m.away_team_id = t2.id
             WHERE m.api_id = $1`,
            [matchId]
        );

        if (matchRes.rows.length === 0) throw new Error('Match not found');
        const match = matchRes.rows[0];
        const season = new Date().getFullYear();

        // 2. Fetch Team Stats
        const homeStatsRes = await db.query(
            'SELECT * FROM team_stats WHERE team_id = $1 AND league_id = $2 AND season = $3',
            [match.home_team_id, match.league_id, season]
        );
        const awayStatsRes = await db.query(
            'SELECT * FROM team_stats WHERE team_id = $1 AND league_id = $2 AND season = $3',
            [match.away_team_id, match.league_id, season]
        );

        const homeStats = homeStatsRes.rows[0] || {};
        const awayStats = awayStatsRes.rows[0] || {};

        // 3. Fetch H2H
        const h2hRes = await db.query(
            'SELECT * FROM h2h_cache WHERE home_team_id = $1 AND away_team_id = $2',
            [match.home_team_id, match.away_team_id]
        );
        const h2h = h2hRes.rows[0] || { home_wins: 0, away_wins: 0, draws: 0, total_matches: 0 };

        // 4. Fetch Standings
        let homeRank = 0, awayRank = 0, totalTeams = 20; // Default assumption
        try {
            const standingsData = await apiFootballService.getStandings(match.league_api_id, season);
            if (standingsData && standingsData[0] && standingsData[0].league && standingsData[0].league.standings) {
                const standings = standingsData[0].league.standings[0];
                totalTeams = standings.length;
                const homeStanding = standings.find(s => s.team.id === match.home_api_id);
                const awayStanding = standings.find(s => s.team.id === match.away_api_id);
                if (homeStanding) homeRank = homeStanding.rank;
                if (awayStanding) awayRank = awayStanding.rank;
            }
        } catch (e) {
            console.error('Failed to fetch standings, using defaults', e.message);
        }

        // --- CALCULATION ---

        // A. Form (30%)
        const homeFormScore = calculateFormScore(homeStats.form_last_5);
        const awayFormScore = calculateFormScore(awayStats.form_last_5);

        // B. H2H (20%)
        let homeH2hScore = 50, awayH2hScore = 50;
        if (h2h.total_matches > 0) {
            homeH2hScore = (h2h.home_wins / h2h.total_matches) * 100;
            awayH2hScore = (h2h.away_wins / h2h.total_matches) * 100;
        }

        // C. Home/Away Strength (20%)
        const homeStrengthScore = Number(homeStats.home_win_rate) || 50;
        const awayStrengthScore = Number(awayStats.away_win_rate) || 50;

        // D. Goals (15%)
        const homeGoalScore = calculateGoalScore(homeStats.goals_for, homeStats.matches_played);
        const awayGoalScore = calculateGoalScore(awayStats.goals_for, awayStats.matches_played);

        // E. Standings (15%)
        const homeStandingsScore = calculateStandingScore(homeRank, totalTeams);
        const awayStandingsScore = calculateStandingScore(awayRank, totalTeams);

        // --- FINAL AGGREGATION ---
        let finalHomeScore =
            (homeFormScore * WEIGHTS.RECENT_FORM) +
            (homeH2hScore * WEIGHTS.H2H) +
            (homeStrengthScore * WEIGHTS.HOME_AWAY_STRENGTH) +
            (homeGoalScore * WEIGHTS.GOAL_AVG) +
            (homeStandingsScore * WEIGHTS.STANDINGS);

        let finalAwayScore =
            (awayFormScore * WEIGHTS.RECENT_FORM) +
            (awayH2hScore * WEIGHTS.H2H) +
            (awayStrengthScore * WEIGHTS.HOME_AWAY_STRENGTH) +
            (awayGoalScore * WEIGHTS.GOAL_AVG) +
            (awayStandingsScore * WEIGHTS.STANDINGS);

        // Calculate a draw score based on how close the teams are in absolute strength
        const diff = Math.abs(finalHomeScore - finalAwayScore);
        // Inverse relationship: closer scores mean higher chance of draw (max 100 if scores equal, drops as diff increases)
        const drawScore = Math.max(100 - (diff * 2), 0);

        console.log(`Calculated Scores for Match ${matchId} -> Home: ${finalHomeScore.toFixed(2)}, Away: ${finalAwayScore.toFixed(2)}, Draw: ${drawScore.toFixed(2)}`);

        // 5. Persist to Database
        await db.query(
            `INSERT INTO match_scoring_raw 
            (match_id, home_score, away_score, draw_score, calculated_at)
            VALUES ($1, $2, $3, $4, NOW())
            ON CONFLICT (match_id) 
            DO UPDATE SET 
                home_score = EXCLUDED.home_score,
                away_score = EXCLUDED.away_score,
                draw_score = EXCLUDED.draw_score,
                calculated_at = EXCLUDED.calculated_at`,
            [match.id, finalHomeScore, finalAwayScore, drawScore]
        );

        return {
            homeScore: Number(finalHomeScore.toFixed(2)),
            awayScore: Number(finalAwayScore.toFixed(2)),
            drawScore: Number(drawScore.toFixed(2))
        };

    } catch (error) {
        console.error(`Error calculating score for match ${matchId}:`, error.message);
        throw error;
    }
}

/**
 * Helper to calculate Poisson distribution probability.
 * @param {number} k - number of occurrences (goals)
 * @param {number} lambda - expected number of occurrences (average goals)
 */
function poisson(k, lambda) {
    let factorial = 1;
    for (let i = 2; i <= k; i++) factorial *= i;
    return (Math.exp(-lambda) * Math.pow(lambda, k)) / factorial;
}

/**
 * Calculates top 5 exact score probabilities based on Poisson distribution.
 */
function calculateExactScoreProbabilities(expectedHomeGoals, expectedAwayGoals) {
    const scores = [];
    // Calculate for 0..5 goals for both teams (up to 5x5)
    for (let i = 0; i <= 5; i++) {
        for (let j = 0; j <= 5; j++) {
            const probHome = poisson(i, expectedHomeGoals);
            const probAway = poisson(j, expectedAwayGoals);
            const probMatch = probHome * probAway * 100; // to percentage

            scores.push({
                placar: `${i}-${j}`,
                probabilidade: Number(probMatch.toFixed(2))
            });
        }
    }

    // Sort descending by probability
    scores.sort((a, b) => b.probabilidade - a.probabilidade);

    // Return Top 5
    return scores.slice(0, 5);
}

/**
 * Normalizes raw scores into Portuguese-translated probabilities (1X2), estimates Over/Under goals, BTTS, Corners, and Exact Score.
 * Persists results to match_checklists.
 * @param {number} matchId
 */
async function calculateMatchProbabilities(matchId) {
    try {
        // 1. Fetch match ID and raw scores
        const matchRes = await db.query('SELECT id, league_id, home_team_id, away_team_id FROM matches WHERE api_id = $1', [matchId]);
        if (matchRes.rows.length === 0) throw new Error('Match not found');
        const match = matchRes.rows[0];

        const rawScoreRes = await db.query('SELECT * FROM match_scoring_raw WHERE match_id = $1', [match.id]);
        if (rawScoreRes.rows.length === 0) throw new Error('Raw scores not generated yet. Call calculateMatchScore first.');
        const rawScore = rawScoreRes.rows[0];

        // 2. Normalize 1X2 Probabilities
        let hScore = Number(rawScore.home_score) || 0;
        let dScore = Number(rawScore.draw_score) || 0;
        let aScore = Number(rawScore.away_score) || 0;

        const totalScore = hScore + dScore + aScore;
        let pctHome = 0, pctDraw = 0, pctAway = 0;

        if (totalScore > 0) {
            pctHome = Number(((hScore / totalScore) * 100).toFixed(2));
            pctDraw = Number(((dScore / totalScore) * 100).toFixed(2));
            pctAway = Number(((aScore / totalScore) * 100).toFixed(2));

            // Force sum to exactly 100
            const sum = pctHome + pctDraw + pctAway;
            const diff = Number((100 - sum).toFixed(2));
            if (diff !== 0) {
                // Add diff to the highest value to minimize distortion
                if (pctHome >= pctDraw && pctHome >= pctAway) pctHome = Number((pctHome + diff).toFixed(2));
                else if (pctDraw >= pctHome && pctDraw >= pctAway) pctDraw = Number((pctDraw + diff).toFixed(2));
                else pctAway = Number((pctAway + diff).toFixed(2));
            }
        }

        // 3. Fetch Team Stats & H2H for Goals, BTTS, and Corners
        const season = new Date().getFullYear();
        const homeStatsRes = await db.query('SELECT matches_played, goals_for, goals_against, btts_rate, avg_corners FROM team_stats WHERE team_id = $1 AND league_id = $2 AND season = $3', [match.home_team_id, match.league_id, season]);
        const awayStatsRes = await db.query('SELECT matches_played, goals_for, goals_against, btts_rate, avg_corners FROM team_stats WHERE team_id = $1 AND league_id = $2 AND season = $3', [match.away_team_id, match.league_id, season]);
        const h2hRes = await db.query('SELECT btts_rate FROM h2h_cache WHERE home_team_id = $1 AND away_team_id = $2', [match.home_team_id, match.away_team_id]);

        const hStats = homeStatsRes.rows[0] || { matches_played: 0, goals_for: 0, goals_against: 0, btts_rate: 50, avg_corners: 4.5 };
        const aStats = awayStatsRes.rows[0] || { matches_played: 0, goals_for: 0, goals_against: 0, btts_rate: 50, avg_corners: 4.5 };
        const h2hData = h2hRes.rows[0] || { btts_rate: 50 };

        let totalExpectedGoals = 2.5; // Default fallback
        let expectedHomeGoals = 1.25;
        let expectedAwayGoals = 1.25;

        if (hStats.matches_played > 0 && aStats.matches_played > 0) {
            const homeGoalsForAvg = hStats.goals_for / hStats.matches_played;
            const homeGoalsAgainstAvg = hStats.goals_against / hStats.matches_played;
            const awayGoalsForAvg = aStats.goals_for / aStats.matches_played;
            const awayGoalsAgainstAvg = aStats.goals_against / aStats.matches_played;

            expectedHomeGoals = (homeGoalsForAvg + awayGoalsAgainstAvg) / 2;
            expectedAwayGoals = (awayGoalsForAvg + homeGoalsAgainstAvg) / 2;
            totalExpectedGoals = expectedHomeGoals + expectedAwayGoals;
        }

        // Simple progressive estimation
        const over05 = Math.min(99, Number((totalExpectedGoals * 45).toFixed(2)));
        const over15 = Math.min(85, Number((totalExpectedGoals * 32).toFixed(2)));
        const over25 = Math.min(70, Number((totalExpectedGoals * 20).toFixed(2)));
        const over35 = Math.min(45, Number((totalExpectedGoals * 10).toFixed(2)));

        // 5. BTTS (Ambos Marcam)
        // Weighted average: 40% Home, 40% Away, 20% H2H
        const bttsWeightedAvg = (Number(hStats.btts_rate) * 0.40) + (Number(aStats.btts_rate) * 0.40) + (Number(h2hData.btts_rate) * 0.20);
        const bttsYes = Number(bttsWeightedAvg.toFixed(2));
        const bttsNo = Number((100 - bttsYes).toFixed(2));

        // 6. Corners (Escanteios)
        // Combined average
        const combinedCornersAvg = Number(hStats.avg_corners) + Number(aStats.avg_corners);

        // Very basic progressive estimation based on combined average
        // If combined is 9.5, Over 9.5 is ~50%.
        const cornersOver85 = Math.min(99, Math.max(1, Number(((combinedCornersAvg / 8.5) * 45).toFixed(2))));
        const cornersOver95 = Math.min(90, Math.max(1, Number(((combinedCornersAvg / 9.5) * 40).toFixed(2))));
        const cornersOver105 = Math.min(80, Math.max(1, Number(((combinedCornersAvg / 10.5) * 35).toFixed(2))));

        // 7. Placar Exato (Top 5 com Poisson)
        const topExactScores = calculateExactScoreProbabilities(expectedHomeGoals, expectedAwayGoals);

        // EXTRAIR 0x0
        const prob0x0 = topExactScores.find(s => s.placar === '0-0')?.probabilidade || 5;

        // 8. Primeiro a Marcar (First Scorer)
        // Sem gols é igual a chance de 0x0
        const firstScorerNone = prob0x0;
        let firstScorerHome = 0, firstScorerAway = 0;
        const firstScorerRemaining = 100 - firstScorerNone;

        if (expectedHomeGoals + expectedAwayGoals > 0) {
            firstScorerHome = Number(((expectedHomeGoals / (expectedHomeGoals + expectedAwayGoals)) * firstScorerRemaining).toFixed(2));
            firstScorerAway = Number((firstScorerRemaining - firstScorerHome).toFixed(2));
        }

        // 9. Marcar no 1º Tempo (First Half Goals)
        // Assuming ~45% of matches have goals in the first half for this dynamic
        // Over 0.5 HT typically correlates with full match exact goals.
        // Let's use a heuristic: chance of NO goals in HT is ~ sqrt(chance of no goals in full time) * 10
        // A simpler heuristic requested: None = ~ 30%, remaining divided by offensive strength
        // Adjusting logic: 
        const fhNone = Math.min(60, prob0x0 * 2.5);
        const fhRemaining = 100 - fhNone;
        let fhHome = 0, fhAway = 0;

        if (expectedHomeGoals + expectedAwayGoals > 0) {
            fhHome = Number(((expectedHomeGoals / (expectedHomeGoals + expectedAwayGoals)) * fhRemaining).toFixed(2));
            fhAway = Number((fhRemaining - fhHome).toFixed(2));
        }

        // 10. Indicador de Qualidade dos Dados (Data Quality)
        let dataQuality = 0;

        // Qtd Jogos (30%)
        const totalPlayed = (hStats.matches_played || 0) + (aStats.matches_played || 0);
        dataQuality += Math.min(30, (totalPlayed / 10) * 30);

        // Qtd H2H (25%)
        if (h2hRes.rows.length > 0) dataQuality += 25;

        // Atualização Recente (20%)
        if (totalPlayed > 0) dataQuality += 20;

        // Consistência Estatística (25%)
        if (totalExpectedGoals >= 1.0 && totalExpectedGoals <= 5.0) dataQuality += 25;

        dataQuality = Math.max(1, Math.min(100, Math.floor(dataQuality)));

        console.log(`Checklist Completado Pt-BR Match ${matchId} -> Casa: ${pctHome}%, Empate: ${pctDraw}%, Visitante: ${pctAway}% | Quality: ${dataQuality}`);

        // 11. Persist to match_checklists
        await db.query(
            `INSERT INTO match_checklists 
            (match_id, result_home, result_draw, result_away, over05, over15, over25, over35, btts_yes, btts_no, corners_over85, corners_over95, corners_over105, top_exact_scores, first_scorer_home, first_scorer_away, first_scorer_none, first_half_home, first_half_away, first_half_none, data_quality, generated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, NOW())
            ON CONFLICT (match_id) 
            DO UPDATE SET 
                result_home = EXCLUDED.result_home,
                result_draw = EXCLUDED.result_draw,
                result_away = EXCLUDED.result_away,
                over05 = EXCLUDED.over05,
                over15 = EXCLUDED.over15,
                over25 = EXCLUDED.over25,
                over35 = EXCLUDED.over35,
                btts_yes = EXCLUDED.btts_yes,
                btts_no = EXCLUDED.btts_no,
                corners_over85 = EXCLUDED.corners_over85,
                corners_over95 = EXCLUDED.corners_over95,
                corners_over105 = EXCLUDED.corners_over105,
                top_exact_scores = EXCLUDED.top_exact_scores,
                first_scorer_home = EXCLUDED.first_scorer_home,
                first_scorer_away = EXCLUDED.first_scorer_away,
                first_scorer_none = EXCLUDED.first_scorer_none,
                first_half_home = EXCLUDED.first_half_home,
                first_half_away = EXCLUDED.first_half_away,
                first_half_none = EXCLUDED.first_half_none,
                data_quality = EXCLUDED.data_quality,
                generated_at = EXCLUDED.generated_at`,
            [match.id, pctHome, pctDraw, pctAway, over05, over15, over25, over35, bttsYes, bttsNo, cornersOver85, cornersOver95, cornersOver105, JSON.stringify(topExactScores), firstScorerHome, firstScorerAway, firstScorerNone, fhHome, fhAway, fhNone, dataQuality]
        );

        // Required 100% Portuguese JSON structure
        return {
            resultado: {
                casa: pctHome,
                empate: pctDraw,
                visitante: pctAway
            },
            gols: {
                acima_0_5: over05,
                acima_1_5: over15,
                acima_2_5: over25,
                acima_3_5: over35
            },
            ambos_marcam: {
                sim: bttsYes,
                nao: bttsNo
            },
            escanteios: {
                acima_8_5: cornersOver85,
                acima_9_5: cornersOver95,
                acima_10_5: cornersOver105
            },
            placar_exato: topExactScores,
            primeiro_a_marcar: {
                casa: firstScorerHome,
                visitante: firstScorerAway,
                sem_gols: firstScorerNone
            },
            marcar_primeiro_tempo: {
                casa: fhHome,
                visitante: fhAway,
                nenhum: fhNone
            }
        };

    } catch (error) {
        console.error(`Error calculating probabilities for match ${matchId}:`, error.message);
        throw error;
    }
}

/**
 * Retrieves the Highlights of the Day — two smart blocks:
 * 1. highConfidence: "Aposta Segura" — probability >= 85, data_quality >= 80
 * 2. valueOpportunity: "Zebra Inteligente" — underdog 20-35%, draw >= 30%, data_quality >= 70
 */
async function getHighlightsOfDay() {
    try {
        const query = `
            SELECT 
                m.api_id as match_id,
                t1.name as home_team,
                t2.name as away_team,
                l.name as league,
                c.data_quality,
                c.result_home,
                c.result_away,
                c.result_draw
            FROM match_checklists c
            JOIN matches m ON c.match_id = m.id
            JOIN teams t1 ON m.home_team_id = t1.id
            JOIN teams t2 ON m.away_team_id = t2.id
            JOIN leagues l ON m.league_id = l.id
        `;
        const res = await db.query(query);

        let highConfidence = null;
        let valueOpportunity = null;

        const highConfidenceCandidates = [];
        const valueCandidates = [];

        res.rows.forEach(row => {
            const pHome = Number(row.result_home) || 0;
            const pAway = Number(row.result_away) || 0;
            const pDraw = Number(row.result_draw) || 0;
            const dq = Number(row.data_quality) || 0;

            // --- BLOCO 1: APOSTA SEGURA ---
            // criteria: any outcome >= 85% AND data_quality >= 80
            if (dq >= 80) {
                const maxProb = Math.max(pHome, pAway);
                if (maxProb >= 85) {
                    const prediction = pHome >= pAway ? 'Vitória Casa' : 'Vitória Visitante';
                    highConfidenceCandidates.push({
                        matchId: row.match_id,
                        league: row.league,
                        homeTeam: row.home_team,
                        awayTeam: row.away_team,
                        prediction,
                        probability: maxProb,
                        data_quality: dq
                    });
                }
            }

            // --- BLOCO 2: ZEBRA INTELIGENTE ---
            // criteria: underdog between 20-35%, draw >= 30%, data_quality >= 70
            if (dq >= 70 && pDraw >= 30) {
                const underdog = Math.min(pHome, pAway);
                if (underdog >= 20 && underdog <= 35) {
                    const underdogTeam = pHome < pAway ? 'Casa' : 'Visitante';
                    valueCandidates.push({
                        matchId: row.match_id,
                        league: row.league,
                        homeTeam: row.home_team,
                        awayTeam: row.away_team,
                        underdogTeam,
                        underdogProbability: underdog,
                        drawProbability: pDraw,
                        data_quality: dq
                    });
                }
            }
        });

        // Pick best candidates
        if (highConfidenceCandidates.length > 0) {
            // Sort: highest probability first, then data_quality
            highConfidenceCandidates.sort((a, b) =>
                b.probability - a.probability || b.data_quality - a.data_quality
            );
            highConfidence = highConfidenceCandidates[0];
        }

        if (valueCandidates.length > 0) {
            // Sort: draw probability highest first (best value), then data_quality
            valueCandidates.sort((a, b) =>
                b.drawProbability - a.drawProbability || b.data_quality - a.data_quality
            );
            valueOpportunity = valueCandidates[0];
        }

        console.log(`Highlights of Day -> highConfidence: ${highConfidence ? highConfidence.matchId : 'none'}, valueOpportunity: ${valueOpportunity ? valueOpportunity.matchId : 'none'}`);

        return { highConfidence, valueOpportunity };

    } catch (error) {
        console.error('Error fetching highlights:', error.message);
        // Never block the app — return null blocks gracefully
        return { highConfidence: null, valueOpportunity: null };
    }
}

module.exports = {
    calculateMatchScore,
    calculateMatchProbabilities,
    getHighlightsOfDay
};
