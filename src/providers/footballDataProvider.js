const axios = require('axios');
require('dotenv').config();

const API_KEY = process.env.FOOTBALL_DATA_API_KEY;
const BASE_URL = 'https://api.football-data.org/v4';

// Mapeamento de Ligas (Interno -> Football-Data.org)
const LEAGUE_MAP = {
    '39': 'PL',     // Premier League
    '140': 'PD',    // La Liga
    '78': 'BL1',    // Bundesliga
    '135': 'SA',    // Serie A Itália
    '61': 'FL1',    // Ligue 1
    '71': 'BSA'     // Brasileirão
};

/**
 * Adaptador para o provedor Football-Data.org (Free Plan)
 */
async function getFixtures(leagueId, date) {
    const competitionCode = LEAGUE_MAP[leagueId.toString()];

    if (!competitionCode) {
        console.warn(`[footballDataProvider] Liga ${leagueId} não mapeada para Football-Data.org. Ignorando.`);
        return [];
    }

    console.log(`[footballDataProvider] Buscando jogos para ${competitionCode} em ${date}`);

    // Temporada de futebol: se estamos antes de agosto, a temporada começou no ano anterior
    const [year, month] = date.split('-').map(Number);
    const season = month < 8 ? year - 1 : year;
    console.log(`[footballDataProvider] Season calculada: ${season} (data: ${date})`);

    try {
        const response = await axios.get(`${BASE_URL}/competitions/${competitionCode}/matches`, {
            headers: { 'X-Auth-Token': API_KEY },
            params: { season: season }
        });

        const allMatches = response.data.matches || [];

        const now = new Date();

        // 1. Filtrar jogos futuros ou em andamento (utcDate >= agora)
        let matches = allMatches
            .filter(m => new Date(m.utcDate) >= now)
            .sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate))
            .slice(0, 10);

        // 2. FALLBACK: Se não houver jogos futuros, pegar os últimos 10 finalizados
        if (matches.length === 0) {
            console.log(`[footballDataProvider] Sem jogos futuros. Ativando fallback para os últimos 10 finalizados.`);
            matches = allMatches
                .filter(m => m.status === 'FINISHED' || m.status === 'AWARDED')
                .sort((a, b) => new Date(b.utcDate) - new Date(a.utcDate)) // Decrescente (mais recentes primeiro)
                .slice(0, 10);
        }

        console.log(`[footballDataProvider] Retornando ${matches.length} jogos (Lógica Dinâmica Sprint 32).`);

        return matches.map(m => ({
            external_id: m.id,
            api_id: m.id, // Manter api_id para compatibilidade com matchService existente
            home_team: {
                name: m.homeTeam.name,
                logo: m.homeTeam.crest,
                api_id: m.homeTeam.id
            },
            away_team: {
                name: m.awayTeam.name,
                logo: m.awayTeam.crest,
                api_id: m.awayTeam.id
            },
            league: {
                name: response.data.competition ? response.data.competition.name : 'Unknown League',
                country: (response.data.competition && response.data.competition.area) ? response.data.competition.area.name : 'Unknown Country',
                logo: response.data.competition ? response.data.competition.emblem : '',
                api_id: response.data.competition ? response.data.competition.id : 0
            },
            date: m.utcDate,
            status: m.status
        }));

    } catch (error) {
        console.error('[footballDataProvider] Erro na requisição:', error.message);
        if (error.response && error.response.status === 403) {
            console.error('[footballDataProvider] Acesso negado. Verifique se a competição está no plano Free.');
        }
        return [];
    }
}

module.exports = {
    getFixtures
};
