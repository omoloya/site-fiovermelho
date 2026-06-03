# 🧶 Portal Fio Vermelho — Documentação Oficial do Projeto 🖤🩸

Bem-vindo à documentação oficial do **Fio Vermelho**, um portal web premium de leitura de quadrinhos digitais estilo Webtoon vertical contínuo, dotado de uma estética *Noir/Yakuza* imersiva e integrações robustas com o Supabase e Mercado Pago.

Este documento unifica todas as especificações técnicas, decisões arquiteturais, esquemas de dados, regras de segurança RLS, fluxos de controle de maioridade e guias de infraestrutura do sistema.

---

## 🎨 1. Identidade Visual e Estética Noir Premium

O portal foi projetado sob uma estética cinematográfica Yakuza/Noir para garantir uma experiência visual premium e envolvente:
* **Esquema de Cores**: Tons escuros profundos de grafite e preto (`#08080a`, `#0e0e12`), acentuados com tons neon vermelho carmim brilhante (`#ff2a3b`, `#cc1f2d`).
* **Interface Glassmorphism**: Utilização frequente de fundos translúcidos com efeito de vidro embaçado (`backdrop-filter: blur(12px)`) e bordas sutis brilhantes com gradiente carmim para painéis e modais.
* **Tipografia Elegante**: Fontes modernas como *Plus Jakarta Sans* e *Inter* carregadas do Google Fonts, com variações de peso de fonte contrastantes e espaçamento entre letras para títulos.
* **Micro-animações**: Transições suaves e efeitos de glow neon interativos ao passar o mouse (hover) em botões, links de capítulos e controles de entrada.

---

## 📁 2. Arquitetura de Pastas e Componentes

A estrutura de arquivos do repositório está organizada da seguinte forma:

```bash
site-fiovermelho/
├── README.md                 # Hub Central de Documentação do Projeto
├── index.html                # Tela de Entrada / Card de Login / Cadastro / Recuperação
├── dashboard.html            # Grade e Listagem Vertical de Capítulos
├── ler.html                  # Leitor de HQ Vertical com Lupa e Gestos
├── admin.html                # Painel de Upload e Compressão de Páginas
├── css/
│   └── style.css             # CSS Global, Tokens de Estilo e Media Queries
├── js/
│   ├── auth.js               # Lógica de Login, Cadastro, Whitelist e Emergência Admin
│   ├── dashboard.js          # Controle de Rota, Polling, Doação e Listagem Dinâmica
│   ├── ler.js                # Lógica do Leitor, Gestos e Lupa Double-Tap
│   ├── admin.js              # upload de Capítulos e Pré-compressão Canvas
│   ├── supabase-config.js    # Inicializador Central do Supabase Client v2 e Sessão
│   └── services/
│       └── pixService.js     # Serviço Modular de Geração e Consulta do Pix (Mock)
├── assets/                   # Arquivos Estáticos (Imagens, Miniaturas e Configs)
│   ├── capitulo_1.webp
│   ├── capitulo_2.webp
│   └── config.json           # Metadados estáticos adicionais
├── scripts/
│   └── build-env.js          # Script NodeJS automatizado de build para geração do env.js
├── api/                      # Endpoints Serverless (Vercel Functions)
│   ├── criar-pix.js          # Endpoint de geração de cobranças Pix no Mercado Pago
│   ├── checar-pix.js         # Webhook/Endpoint de validação e atualização do perfil
│   └── disparar-newsletter.js# Endpoint de disparo de e-mails para cadastrados
├── env.example.js            # Modelo de chaves do Supabase e configurações locais
└── vercel.json               # Configurações de rotas e redirecionamentos no deploy
```

---

## 🔒 3. Segurança RLS e Banco de Dados (Supabase)

O banco de dados utiliza o PostgreSQL hospedado no Supabase. Após auditorias de segurança críticas, todas as tabelas foram protegidas com Row Level Security (RLS) estrito.

### A. Tabela `profiles` (Perfis de Usuários)
Contém dados sensíveis de acesso e maioridade dos usuários cadastrados:
* **Esquema**:
  * `id` (`uuid`, chave primária ligada à tabela `auth.users`).
  * `email` (`text`, e-mail do usuário).
  * `cpf` (`text`, CPF sanitizado para validação).
  * `status` (`text`, status de acesso: `'pendente_verificacao'`, `'verificado'`).
* **Políticas de RLS**:
  * **SELECT**: Apenas leitura autenticada é permitida. Um usuário logado só pode consultar sua própria linha (`auth.uid() = id`). Leituras públicas ou anônimas são bloqueadas.
  * **INSERT**: Permitido de forma isolada durante o fluxo de cadastro inicial para o usuário recém-criado.
  * **UPDATE / Proteção de Status do Pix**: Modificações no status do perfil via client-side são bloqueadas para usuários normais para evitar fraudes. O status do usuário para `'verificado'` (ou `'pago'`) só pode ser alterado de duas formas:
    1. **Pelo Backend Serverless**: O webhook `api/checar-pix.js` atua em ambiente isolado de servidor usando a `SUPABASE_SERVICE_ROLE_KEY` (chave master de bypass do RLS).
    2. **Pela Conta de Admin**: Os e-mails da whitelist possuem override em memória.

### B. Tabela `chapters` (Metadados dos Capítulos)
Armazena as informações estruturais do quadrinho:
* **Esquema**:
  * `id` (`int`, número do capítulo como chave primária).
  * `title` (`text`, título do capítulo).
  * `pages_count` (`int`, número total de páginas).
  * `release_date` (`text`, data de lançamento formatada).
  * `synopsis` (`text`, sinopse curta do capítulo).
* **Políticas de RLS**:
  * **SELECT**: Leitura pública permitida para qualquer usuário autenticado.
  * **UPDATE**: Restrito a administradores autenticados via whitelist de e-mails.

### C. Storage Bucket: `paginas-quadrinho`
Bucket de armazenamento que guarda os arquivos WebP das páginas do quadrinho:
* **Políticas de Acesso**:
  * Leitura pública habilitada para que os leitores visualizem as imagens no canvas.
  * Escrita e deleção restritas a uploads efetuados a partir de credenciais autenticadas autorizadas.

---

## ⚡ 4. Fluxos Lógicos e Funcionalidades do Portal

### A. Proteção de Rota Síncrona (`head`)
No topo do `<head>` das páginas protegidas (`dashboard.html`, `ler.html`, `admin.html`), é executado um script inline síncrono que lê a sessão do `localStorage`. Se não houver sessão ativa, o navegador realiza um redirecionamento de rota imediato para `index.html`, evitando "piscar" conteúdo confidencial na tela.

### B. Verificação Autenticada e Polling Ativo de Maioridade (Pix)
Ao acessar o Dashboard, se o usuário estiver com o status `pendente_verificacao`, a interface exibe o modal `#dashboard-lock-overlay` com o QR Code e código Copia e Cola para pagamento do Pix de R$ 1,50.
* **Recuperação de ID Segura**: O script consome estritamente o método assíncrono `window.supabase.auth.getUser()` do Supabase para coletar o ID de sessão ativo direto do JWT verificado na nuvem.
* **Polling de 4 Segundos**: Um loop secundário ativo (`statusPollInterval`) consulta o banco de dados a cada 4 segundos com o filtro `.eq('id', pollUserId)`, onde `pollUserId` é o ID autenticado retornado do Supabase Auth. Assim que o pagamento é aprovado, o loop é interrompido e a listagem é liberada.
* **Botão de Reverificação**: Um botão de ação manual permite disparar a verificação imediata, que também executa de forma síncrona uma consulta ao banco sob o ID autenticado ativo.

### C. Grade de Capítulos com Links Diretos e Descrições Estáticas
A listagem de capítulos em `dashboard.html` renderiza dinamicamente as linhas horizontais como links de navegação simples (`<a>`):
* **Navegação Imediata**: Clicar na linha de um capítulo redireciona o usuário instantaneamente para `ler.html?cap=ID`.
* **Identificadores Chevron**: As linhas exibem à direita o ícone de chevron para a direita (`\f054` do FontAwesome) para indicar links de navegação de página.
* **Descrições Especiais integradas**: Para manter o visual rico, os botões dos Capítulos 1, 2, 3 e 4 exibem blocos de texto estáticos adicionais com suas respectivas sinopses escritas em **branco** (`#ffffff`), posicionadas diretamente abaixo dos títulos de forma responsiva.
  * *Capítulo 1 ("Fim de Turno")*: Texto sobre o cochilo do chefe e o grupo.
  * *Capítulo 2 ("Cortes no Destino")*: Texto sobre o chamado de madrugada do pai.
  * *Capítulo 3 ("O Laço Carmim")*: Texto sobre o pirulito de cereja e o cosplay de Sailor Moon.
  * *Capítulo 4*: Texto sobre os seios da novata, golfinhos e o apartamento em cima do Ramen-ya.

### D. Leitor Vertical e Lupa de Toque / Magnifier
O leitor em `ler.html` renderiza as páginas do quadrinho de forma vertical e contínua. Para garantir imersão:
* **Scroll-to-Top**: O leitor limpa o DOM e força a janela a rolar de forma absoluta para o topo vertical (`0,0`) ao carregar novas páginas para assegurar que a leitura comece no início físico da HQ.
* **Lupa de Zoom Localizado (Double-Tap)**:
  * **Ativação**: Um toque duplo rápido (dois cliques dentro de `300ms`) ativa o zoom na imagem no ponto físico tocado, definindo o `transform-origin` para as coordenadas relativas e ampliando a escala em $1.8\times$ (`transform: scale(1.8)`).
  * **Navegação no Zoom**: Enquanto o zoom está ativo (`.is-zoomed`), o usuário pode arrastar o dedo horizontalmente para mover a janela visível sobre os balões e artes. A rolagem vertical padrão do navegador continua ativa para deslizar a HQ para baixo.
  * **Desativação**: Um toque simples em qualquer parte da imagem ampliada retira o zoom e restaura de forma instantânea a rolagem do navegador para a exata posição de leitura anterior (memória de scroll), evitando desvios ou saltos de tela.

### E. Apoio Financeiro e Checkout de Doação Pix
O Dashboard conta com uma seção de apoio opcional ("Fortalecer o Bando").
* Clicar no botão abre o modal `#donation-modal` (glassmorphism/blur) com um input numérico (mínimo de R$ 1,00).
* Submeter o valor faz uma requisição para a rota `/api/criar-pix` enviando o valor no corpo (`amount`). A API Serverless comunica com o Mercado Pago de forma segura no backend e devolve o QR Code em Base64 e o código Copia e Cola.
* O modal exibe um aviso de agradecimento e ativa o botão de cópia com feedback tátil e visual de check verde.

---

## 🛠️ 5. Painel de Administração e Pré-Compressão Canvas

O portal de publicação de capítulos (`admin.html` e `js/admin.js`) possui uma interface Noir carmim para upload de novas páginas:
* **Canvas Compression**: As imagens selecionadas pelo autor (frequentemente arquivos PNG ou JPG gigantes de alta definição) são interceptadas no navegador e desenhadas em um elemento `<canvas>` invisível.
* **Redimensionamento Proporcional**: A largura máxima das páginas é limitada em **1600px** preservando o aspect ratio original.
* **Otimização de Formato**: O canvas exporta os dados como imagem otimizada no formato **WebP** com um fator de qualidade de **85%** (`image/webp`, `0.85`).
* **Vantagem**: Reduz o tamanho de arquivos em média de **80% a 95%** antes de serem enviados à rede, garantindo que o portal opere dentro dos limites de banda e armazenamento gratuitos (Custo R$ 0).

---

## 🔌 6. Desenvolvimento Local e Modo Offline

Para desenvolvedores testarem alterações sem depender de conexões de internet ou contas do Supabase ativas:
* O arquivo `js/supabase-config.js` possui o sinalizador global `window.isOfflineMode = true`.
* Em modo offline, o sistema simula o banco de dados e autenticações utilizando fallbacks de mock no `localStorage` e arquivos Blob no `sessionStorage`.
* Para alternar para produção, configure as variáveis `SUPABASE_URL` e `SUPABASE_ANON_KEY` no arquivo local `env.js` (gerado de forma robusta no deploy da Vercel).

---

## 🚀 7. Instruções de Deploy e Variáveis de Ambiente

O projeto é hospedado na **Vercel**, integrado a cada commit na branch `main`.

### Variáveis de Ambiente Requeridas (Vercel Dashboard)
Para o correto funcionamento do site e do backend serverless, defina as seguintes chaves de ambiente nas configurações da Vercel:
* `SUPABASE_URL`: URL de referência do projeto Supabase.
* `SUPABASE_ANON_KEY`: Chave anônima pública do Supabase Client para acesso frontend.
* `SUPABASE_SERVICE_ROLE_KEY`: Chave master do Supabase para bypass de RLS no webhook serverless (`api/checar-pix.js`).
* `MERCADO_PAGO_ACCESS_TOKEN`: Token de autenticação de produção do gateway Mercado Pago.
* `ADMIN_EMAILS`: E-mails dos administradores autorizados separados por vírgula (ex: `miles.kensuke@gmail.com, omoloyaartes@gmail.com`).

### Ciclo de Compilação (Build Script)
Durante o deploy, a Vercel executa o comando `npm run build`, que dispara o script NodeJS [build-env.js](file:///C:/Users/Barbara/Desktop/miles/site-fiovermelho/scripts/build-env.js). Este script consome de forma segura as variáveis de ambiente fornecidas pelo painel da Vercel e escreve dinamicamente o arquivo `env.js` na raiz do projeto, disponibilizando as variáveis públicas para o cliente JS de forma robusta.
