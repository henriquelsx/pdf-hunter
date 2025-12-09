// pdf-api/src/services/searchService.js

require('dotenv').config({ path: './.env' });
const axios = require('axios');
const { client: redisClient } = require('./redisService');
const { GoogleSearch } = require('google-search-results-nodejs');

const search = new GoogleSearch(process.env.SERPAPI_KEY);

// Configurações de Busca
const MAX_PAGES = 3;
const RESULTS_PER_PAGE = 20;
const TIMEOUT_MS = 3000;

// Validação Híbrida: Tenta HEAD request, mas aceita extensão .pdf como fallback
async function validatePdfLink(url) {
    const looksLikePdf = /\.pdf$/i.test(url);
    const resultDetails = { url, size: 'Desconhecido', status: 'valid' };

    try {
        const response = await axios.head(url, {
            timeout: TIMEOUT_MS,
            maxRedirects: 2,
            validateStatus: status => status < 500
        });

        const type = response.headers['content-type'];
        const contentLength = response.headers['content-length'];

        // 1. Confirmação estrita do servidor
        if (response.status === 200 && type && type.toLowerCase().includes('application/pdf')) {
            resultDetails.size = contentLength ? (contentLength / 1024 / 1024).toFixed(2) + ' MB' : 'Desconhecido';
            return resultDetails;
        }

        // 2. Servidor bloqueou (403) ou deu erro, mas URL é explicitamente .pdf
        if (response.status !== 200 && looksLikePdf) {
            return resultDetails;
        }

        return null;

    } catch (error) {
        // 3. Erro de rede/timeout, mas visualmente é um PDF
        if (looksLikePdf) return resultDetails;
        return null;
    }
}

// Wrapper Promise para SerpApi
function fetchSerpApiPage(params) {
    return new Promise((resolve, reject) => {
        search.json(params, (data) => {
            if (data.error) return reject(data.error);
            resolve(data.organic_results || []);
        });
    });
}

const LANG_CONFIG = {
    'all':   { lr: '',        gl: 'us' },
    'pt-BR': { lr: 'lang_pt', gl: 'br' },
    'pt-PT': { lr: 'lang_pt', gl: 'pt' },
    'en':    { lr: 'lang_en', gl: 'us' },
    'es':    { lr: 'lang_es', gl: 'es' }
};

async function searchAndValidate(termo, langCode, socket) {
    const config = LANG_CONFIG[langCode] || LANG_CONFIG['all'];
    const cacheKey = `pdf_search:${langCode}:${termo.toLowerCase().trim()}`;

    // 1. Verifica Cache Redis
    try {
        const cachedResults = await redisClient.get(cacheKey);
        if (cachedResults) {
            const results = JSON.parse(cachedResults);
            results.forEach(pdf => socket.emit('new_pdf', pdf));
            return results;
        }
    } catch (err) {
        console.error('Erro cache:', err);
    }

    console.log(`[WEB] Buscando '${termo}' (${langCode})...`);

    const allValidatedPdfs = [];
    const uniqueLinks = new Set();

    // 2. Loop de Paginação (Deep Search)
    for (let page = 0; page < MAX_PAGES; page++) {
        const params = {
            q: `${termo} filetype:pdf`,
            engine: "google",
            num: RESULTS_PER_PAGE,
            start: page * RESULTS_PER_PAGE,
            lr: config.lr,
            gl: config.gl
        };

        try {
            const rawResults = await fetchSerpApiPage(params);
            if (!rawResults.length) break;

            // 3. Validação Paralela
            const pagePromises = rawResults.map(async (item) => {
                if (uniqueLinks.has(item.link)) return null;
                uniqueLinks.add(item.link);

                const pdfData = await validatePdfLink(item.link);
                
                if (pdfData) {
                    const resultObj = {
                        title: item.title,
                        link: pdfData.url,
                        size: pdfData.size,
                        snippet: item.snippet
                    };
                    socket.emit('new_pdf', resultObj); // Emite assim que validar
                    return resultObj;
                }
                return null;
            });

            // Aguarda toda a página ser validada antes de ir para a próxima
            const pageResults = await Promise.all(pagePromises);
            allValidatedPdfs.push(...pageResults.filter(r => r !== null));

        } catch (error) {
            console.error(`Erro na página ${page}:`, error.message);
            continue; 
        }
    }

    // 4. Salva no Cache
    if (allValidatedPdfs.length > 0) {
        await redisClient.set(cacheKey, JSON.stringify(allValidatedPdfs), { EX: 3600 });
    }

    return allValidatedPdfs;
}

module.exports = { searchAndValidate };