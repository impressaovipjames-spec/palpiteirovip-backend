const provider = require('./src/providers/footballDataProvider');
require('dotenv').config();

async function test() {
    console.log('--- TESTE LOCAL SPRINT 32 ---');
    try {
        const matches = await provider.getFixtures(39, '2026-03-08');
        console.log('RESULTADO:', JSON.stringify(matches, null, 2));
        console.log('TOTAL ENCONTRADO:', matches.length);
    } catch (e) {
        console.error('ERRO NO TESTE:', e);
    }
}

test();
