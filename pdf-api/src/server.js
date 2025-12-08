// pdf-api/src/server.js

const express = require('express');
const http = require('http'); // Necessário para criar o servidor HTTP que o Socket.io usa
const cors = require('cors'); // Para permitir a conexão do Angular (Front)
const { Server } = require("socket.io"); // <--- CORREÇÃO: A classe 'Server' é importada aqui
const { connectRedis } = require('./services/redisService'); // Importa o serviço Redis
const { searchAndValidate } = require('./services/searchService'); // Importa o serviço de busca

const app = express();
const server = http.createServer(app);

// Configuração do CORS para permitir o Front (Angular) se conectar
// O Angular rodará em http://localhost:4200 (porta padrão)
app.use(cors({ origin: "http://localhost:4200" })); 
app.use(express.json());

// ----------------------------------------------------
// 1. Configuração do Socket.io (para o real-time)
// ----------------------------------------------------
const io = new Server(server, { cors: { origin: "http://localhost:4200" } });

io.on('connection', (socket) => {
    console.log(` Cliente conectado: ${socket.id}`);

    // Rota do Socket para iniciar a busca
    socket.on('search_pdfs', async (termo) => {
        // Verifica se o termo existe e se a chave SerpApi está configurada
        if (!termo || !process.env.SERPAPI_KEY) {
            socket.emit('error', 'Chave de busca ausente ou termo vazio.');
            return;
        }

        try {
            await searchAndValidate(termo, socket);
            socket.emit('search_complete', { message: 'Busca finalizada' });
        } catch (error) {
            console.error('Erro fatal na busca:', error);
            socket.emit('error', `Erro ao buscar: ${error.message || error}`);
        }
    });

    socket.on('disconnect', () => {
        console.log(` Cliente desconectado: ${socket.id}`);
    });
});

// ----------------------------------------------------
// 2. Inicia o Servidor
// ----------------------------------------------------

async function startServer() {
    // Tenta conectar ao Redis antes de iniciar a API
    await connectRedis(); 

    const PORT = 3000;
    server.listen(PORT, () => {
        console.log(`🟢 Servidor Node.js rodando na porta ${PORT}`);
    });
}

startServer();

// Endpoint de Teste Rápido (para ver se a API está de pé)
app.get('/health', (req, res) => {
    res.json({ status: 'API OK', redis: 'CONNECTED' });
});