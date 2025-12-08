// pdf-api/src/services/redisService.js

require('dotenv').config({ path: './.env' }); // Carrega as variáveis de ambiente

const redis = require('redis');

// Pega as variáveis do .env
const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = process.env.REDIS_PORT || 6379;

// Cria o cliente Redis
const client = redis.createClient({
    url: `redis://${REDIS_HOST}:${REDIS_PORT}`
});

client.on('error', (err) => {
    console.error('❌ Erro de conexão com Redis:', err);
    // Se não for possível conectar, o servidor deve continuar rodando, mas sem cache.
});

// Conecta ao Redis
async function connectRedis() {
    if (!client.isOpen) {
        await client.connect();
        console.log('✅ Conexão com Redis estabelecida!');
    }
}

// Conecta o cliente uma vez ao iniciar
connectRedis();

// Exporta o cliente para ser usado em outras partes do código
module.exports = {
    client,
    connectRedis,
};