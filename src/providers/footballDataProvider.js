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

        // Tentar filtro exato primeiro
        let matches = allMatches.filter(m => m.utcDate.startsWith(date));

        // FALLBACK: Se não houver jogos exatamente hoje, vamos pegar os jogos 
        // em um intervalo de -3 a +7 dias para garantir que o app mostre algo.
        if (matches.length === 0) {
            console.log(`[footballDataProvider] Sem jogos para ${date}. Ativando FALLBACK window...`);
            const targetDateObj = new Date(date);
            const startDate = new Date(targetDateObj);
            startDate.setDate(startDate.getDate() - 3);
            const endDate = new Date(targetDateObj);
            endDate.setDate(endDate.getDate() + 7);

            matches = allMatches.filter(m => {
                const matchDate = new Date(m.utcDate).getTime();
                return matchDate >= startDate.getTime() && matchDate <= endDate.getTime();
            });

            // Limitar a no máximo 15 jogos no fallback para não sobrecarregar
            matches = matches.slice(0, 15);
            console.log(`[footballDataProvider] Fallback: Encontrados ${matches.length} jogos próximos.`);
        } else {
            console.log(`[footballDataProvider] Filtro exato: ${matches.length} jogos encontrados.`);
        }

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
