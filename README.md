# 🔍 PDF Search Engine (Full Stack)

Uma aplicação Full Stack robusta para localizar, validar e listar arquivos PDF disponíveis publicamente na web. O sistema utiliza uma arquitetura orientada a eventos para entregar resultados em tempo real.

## 🚀 Funcionalidades Principais

- **Deep Search:** O sistema não busca apenas a primeira página do Google. Ele "cava" múltiplas páginas (paginação automática) para encontrar resultados mais profundos.
- **Real-time Streaming:** Os resultados aparecem na tela assim que são encontrados e validados, sem necessidade de esperar a busca completa terminar (via **Socket.io** e **RxJS**).
- **Validação Híbrida Inteligente:**
  - Verifica a existência real do arquivo (Status 200).
  - Analisa Headers HTTP (Content-Type).
  - *Fallback:* Aceita links bloqueados por bots (403) se a extensão for explicitamente `.pdf`.
- **Cache de Performance:** Utiliza **Redis** para armazenar buscas recentes (TTL 1 hora), entregando resultados instantâneos para termos repetidos.
- **Interface Moderna:** Frontend construído com **Angular Material** (Tema Teal), focado em usabilidade e design limpo.

## 🛠️ Tecnologias Utilizadas

### Backend (Node.js)
- **Express:** API REST.
- **Socket.io:** Comunicação bidirecional em tempo real.
- **SerpApi (Google Search):** Motor de busca.
- **Redis:** Caching de alta performance.
- **Axios:** Requisições HTTP e validação de links (HEAD requests).

### Frontend (Angular)
- **Angular 17+:** Framework SPA.
- **Angular Material:** Componentes de UI (Cards, Inputs, Progress Bars).
- **RxJS:** Manipulação reativa de fluxos de dados e prevenção de duplicatas.
- **SCSS:** Estilização customizada (Tema Teal & Orange).

## ⚙️ Como Rodar Localmente

### Pré-requisitos
- Node.js
- Servidor Redis rodando
- Chave de API (SerpApi)

### 1. Backend
bash
cd pdf-api
npm install
# Crie um arquivo .env com: SERPAPI_KEY=sua_chave e REDIS_URL=...
npm start

### 2. Frontend
cd pdf-app
npm install
ng serve
