# Especificação do Projeto: "E se..."

O "E se..." é um party game web open-source e self-hosted onde jogadores competem pela resposta mais criativa para ocasiões hipotéticas.

## 🚀 Stack Tecnológica
- **Runtime:** Bun.js (Backend)
- **Frontend:** TypeScript + Vite (Vanilla CSS Moderno)
- **Comunicação:** WebSockets nativos (Bun.serve)
- **Arquitetura:** Monorepo com pacote `@ese/shared` para tipos comuns.

## 🛠️ Funcionalidades Implementadas

### 1. Sistema de Instância Única
- O servidor gerencia uma única sala global, facilitando o self-hosting para grupos de amigos.
- Configurações via arquivo `.env` (Senha Admin, Rodadas Máximas, Limite de Jogadores).

### 2. Papéis e Permissões
- **Host (Admin):** Único com poder para iniciar partidas, avançar rodadas, resetar o jogo ou expulsar jogadores (via console). Identificado por uma coroa (👑).
- **Mestre da Rodada:** Um jogador sorteado por rodada para criar o "E se...". Ele não participa da fase de respostas, apenas da votação.

### 3. Ciclo de Jogo (Game Loop)
- **LOBBY:** Aguardando jogadores (mínimo definido no `.env`).
- **PROMPT_PHASE:** O Mestre digita a ocasião.
- **RESPONSE_PHASE:** Outros jogadores enviam respostas anônimas.
- **VOTING_PHASE:** Todos votam na melhor resposta (não pode votar em si mesmo).
- **RESULTS_PHASE:** Revelação de quem escreveu o quê e pontuação da rodada (+10 pontos por voto).
- **GAME_OVER:** Ranking final e retorno automático ao lobby.

### 4. Segurança e Moderação
- **Senha de Admin:** Protege os comandos do Host.
- **Console Interativo:** Comandos diretos no terminal do backend (`kick`, `status`, `reset`, `stop`).
- **Sistema de Denúncia (Anti-Jogo):** 
    - Botão de bandeira 🚩 disponível para todos.
    - 3 denúncias de jogadores diferentes resultam em Kick automático.
    - Proteção contra auto-denúncia e denúncia ao Host.
- **Resiliência:** Detecção de saída do Mestre, anulando a rodada e voltando ao Lobby para não travar o jogo.

### 5. Interface Imersiva
- Design responsivo (Mobile-First).
- Background animado (Blue Grid).
- Sistema de notificações flutuantes (Toasts).
- Tratamento de textos longos (Text Wrapping).

## 🔮 Como Continuar (Roadmap)

### Fase 5: Gamificação e Polimento
- **Sons e Efeitos:** Adicionar feedbacks sonoros para mensagens e transições de fase.
- **Animações de Revelação:** Tornar a tela de resultados mais dramática, revelando as respostas uma por uma.
- **Avatares:** Permitir que os jogadores escolham cores ou ícones simples.

### Fase 6: Customização e Conteúdo
- **Banco de Sugestões:** Adicionar uma lista de ocasiões pré-definidas para quando o mestre estiver sem criatividade.
- **Modos de Jogo:** Variantes como "Rodada Relâmpago" (com timer).

### Fase 7: Infraestrutura Open Source
- **Dockerização:** Criar um `Dockerfile` e `docker-compose.yml` para facilitar o deploy.
- **Guia de Contribuição:** Documentar como outros devs podem adicionar novos temas ou traduzir o jogo.
- **Modo Offline:** PWA para que o frontend possa ser instalado no celular.

---
*Documento gerado em 13 de Abril de 2026.*
