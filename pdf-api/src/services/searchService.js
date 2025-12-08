// pdf-api/src/services/searchService.js

require('dotenv').config({ path: './.env' });
const axios = require('axios');
const { client: redisClient } = require('./redisService'); 
const { GoogleSearch } = require('google-search-results-nodejs');

// Inicializa a SerpApi
const search = new GoogleSearch(process.env.SERPAPI_KEY);
const CACHE_TTL = 3600; // Tempo de vida do cache: 1 hora

// Função para validar se o link é realmente um PDF acessível
async function validatePdfLink(url) {
    try {
        const response = await axios.head(url, { timeout: 3000, maxRedirects: 2 });
        const type = response.headers['content-type'];

        if (response.status === 200 && type && type.includes('application/pdf')) {
            return {
                url: url,
                size: response.headers['content-length'] ? (response.headers['content-length'] / 1024 / 1024).toFixed(2) + ' MB' : 'Desconhecido',
                status: 'valid'
            };
        }
        return null;
    } catch (error) {
        return null; // Link quebrado ou time-out
    }
}

// Lógica principal: Busca, Cache e Validação
async function searchAndValidate(termo, socket) {
    const cacheKey = `pdf_search:${termo.toLowerCase().trim()}`;

    // 1. Tenta buscar no CACHE
    try {
        const cachedResults = await redisClient.get(cacheKey);
        if (cachedResults) {
            const results = JSON.parse(cachedResults);
            console.log(`[CACHE] Resultados para '${termo}' encontrados no Redis.`);
            
            // Envia todos os resultados do cache de uma vez
            results.forEach(pdf => socket.emit('new_pdf', pdf));
            return results;
        }
    } catch (err) {
        console.error('Erro ao buscar no cache:', err);
    }
    
    // 2. Se não estiver no cache, busca na WEB
    const params = {
        q: `${termo} filetype:pdf`, // Usando Google Dorks!
        engine: "google",
        location: "United States", // Você pode mudar a região aqui
        num: 50 // Número de resultados a buscar
    };

    console.log(`[WEB] Iniciando busca externa para '${termo}'...`);
    
    // Promessa para envolver a busca da SerpApi (que usa callbacks)
    const rawResults = await new Promise((resolve, reject) => {
        search.json(params, (data) => {
            if (data.error) {
                reject(data.error);
            } else {
                resolve(data.organic_results || []);
            }
        });
    });

    // 3. Valida os links e envia em tempo real
    const validatedPdfs = [];
    
    for (const item of rawResults) {
        const pdfData = await validatePdfLink(item.link);
        
        if (pdfData) {
            // Envia resultado válido para o front (Streaming effect!)
            socket.emit('new_pdf', {
                title: item.title,
                link: pdfData.url,
                size: pdfData.size,
                snippet: item.snippet
            });
            validatedPdfs.push({
                title: item.title,
                link: pdfData.url,
                size: pdfData.size,
                snippet: item.snippet
            });
        }
    }

    // 4. Salva no CACHE para buscas futuras
    if (validatedPdfs.length > 0) {
        await redisClient.set(cacheKey, JSON.stringify(validatedPdfs), { EX: CACHE_TTL });
        console.log(`[CACHE] Salvos ${validatedPdfs.length} resultados no Redis.`);
    }

    return validatedPdfs;
}

module.exports = {
    searchAndValidate,
};