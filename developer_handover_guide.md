# Guia de Transição Técnica e Documentação: Portal Fio Vermelho 🧶🛡️

Este documento reúne todas as especificações técnicas, decisões de design, fluxos lógicos e infraestrutura da plataforma **Fio Vermelho** desde o início das nossas implementações. Ele serve como o guia definitivo de engenharia para que novos desenvolvedores compreendam a arquitetura e saibam exatamente onde e como dar manutenção na programação.

---

## 📖 1. Visão Geral do Projeto

O **Fio Vermelho** é um portal web interativo para leitura de quadrinhos digitais (estilo Webtoon vertical) focado em um público maior de idade. Possui uma estética *Noir/Yakuza*, utilizando tonalidades escuras profundas, efeitos de vidro (glassmorphism) e neon vermelho pulsante.

O sistema integra-se ao **Supabase** para gerenciamento de banco de dados (perfis, capítulos, leads) e armazenamento de arquivos (páginas dos quadrinhos no Storage), oferecendo um fluxo de verificação de maioridade integrado a um gateway de pagamentos via PIX.

---

## 📁 2. Estrutura de Arquivos e Componentes

```bash
site-fiovermelho/
├── index.html                # Tela de Entrada / Login / Registro / Recuperação
├── dashboard.html            # Grid de Capítulos / Painel do Leitor
├── ler.html                  # Leitor Vertical Contínuo de Webtoon
├── admin.html                # Painel de Administração do Autor
├── css/
│   └── style.css             # Folha de Estilos Global (Design Noir)
├── js/
│   ├── auth.js               # Gerenciador de Sessão e Auth (Supabase/Mock)
│   ├── dashboard.js          # Controle de Rota, Polling, Doação e Listagem Dinâmica
│   ├── ler.js                # Lógica do Leitor, Otimização e Scroll
│   ├── admin.js              # Controle de Envio de Páginas e Capítulos
│   ├── supabase-config.js    # Inicialização da API Cliente do Supabase
│   └── services/
│       └── pixService.js     # Serviço Modular de Geração e Consulta do Pix (Mock)
├── assets/                   # Imagens, Capas e Configurações Locais
│   ├── capitulo_1.webp
│   ├── capitulo_2.webp
│   └── config.json           # Definições estáticas adicionais
├── scripts/
│   └── build-env.js          # Script NodeJS para geração de variáveis no Build
└── api/                      # Endpoints Serverless (Mercado Pago / Pix)
```

---

## 🔒 3. Proteção de Rotas, Maioridade e Segurança RLS

O projeto opera sob rígidas validações de acesso para conformidade legal (ECA) e monetização:

### A. Proteção de Rota Síncrona (`head`)
No topo do `<head>` de `dashboard.html`, `ler.html` e `admin.html`, roda um script inline síncrono que verifica a existência de sessão ativa. Se ausente, o usuário é redirecionado instantaneamente para `index.html` antes da renderização do DOM (evitando piscadas de tela).

### B. Whitelist Administrativa
Apenas e-mails específicos possuem acesso à tela `admin.html`:
```javascript
const adminWhitelist = ["miles.kensuke@gmail.com", "omoloyaartes@gmail.com"];
```
Caso outro e-mail autenticado tente acessar a página, o script bloqueia o carregamento e força o redirecionamento para `dashboard.html`.

### C. Bloqueio de Maioridade (ECA) & Polling do PIX
1. Usuários recém-registrados caem sob o status `pendente_verificacao`.
2. Um modal bloqueador absoluto (`#dashboard-lock-overlay`) cobre toda a tela do leitor e impede interações e rolagem do `body`.
3. É iniciado um **Polling periódico seguro a cada 4 segundos** que consulta a tabela `profiles` no Supabase (coluna `status`).
4. **Resolução de Segurança RLS**: A busca de perfil no polling e no botão de reverificação manual é efetuada de forma estrita consultando a sessão autenticada do usuário ativo no Supabase client (`window.supabase.auth.getUser()`) no filtro `.eq('id', userId)`.
5. Quando o pagamento do PIX de verificação é processado no backend, o status altera para `'verificado'` (ou `'pago'`), o intervalo é limpo imediatamente (`clearInterval`), o modal é ocultado e a listagem de capítulos é liberada.

---

## ⚡ 4. Lógica da Listagem de Capítulos com Links Diretos

A listagem de capítulos adota um layout vertical simplificado, focado em facilidade de uso e links diretos para leitura.

### A. Links Diretos de Navegação
* Os capítulos no dashboard são criados como links diretos `<a>`. Clicar na linha do capítulo redireciona o leitor diretamente para `ler.html?cap=ID`.
* O visual exibe um ícone de chevron para a direita (`\f054` do FontAwesome) no canto direito de cada linha, sinalizando visualmente que o clique iniciará a navegação.

### B. Descrições Estáticas Integradas
Os botões dos capítulos 1, 2, 3 e 4 possuem blocos de textos estáticos adicionais com suas respectivas sinopses escritas em **branco** (`#ffffff`), localizadas logo abaixo dos títulos:
* **Capítulo 1 ("Fim de Turno")**: Exibe o texto sobre o chefe dormindo de novo e o grupo.
* **Capítulo 2 ("Cortes no Destino")**: Exibe o texto sobre o chamado do pai de madrugada.
* **Capítulo 3 ("O Laço Carmim")**: Exibe o texto sobre o pirulito de cereja e o cosplay de Sailor Moon.
* **Capítulo 4**: Exibe o texto sobre os seios da novata, golfinhos e o ramen-ya.

---

## 📖 5. Otimização Arquitetural do Leitor Webtoon e Lupa Double-Tap (`ler.html`)

O leitor vertical contínuo foi otimizado para lidar com conexões lentas e telas móveis:

### A. Inversão do Ciclo de Carregamento (Race Condition Fix)
Os manipuladores de evento de carregamento (`onload`) são atrelados primeiro, seguidos da atribuição do `src` nas imagens. Um teste defensivo final em `img.complete` cobre qualquer execução síncrona, resolvendo o problema de imagens que ficavam invisíveis com cache ativo.

### B. Lupa de Zoom Localizado (Double-Tap)
* Mapeamos a lupa local para um duplo toque rápido (intervalo menor que `300ms`).
* Ao acionar a ampliação, o sistema calcula as coordenadas relativas do toque e configura o `transform-origin` dinamicamente para o pixel tocado. A imagem amplia na proporção exata de $1.8\times$ (`transform: scale(1.8);`).
* **Memória de Posição de Leitura (Scroll Memory)**: Ao acionar a ampliação, o sistema memoriza a posição de rolagem vertical atual da tela. No segundo toque (zoom out), o sistema remove o zoom e força de forma imediata o navegador a rolar exatamente para o mesmo ponto físico anterior, evitando "pulos" visuais.

---

## 🛠️ 6. Algoritmo Client-Side de Compressão Canvas WebP

Na área de administração, todas as imagens sofrem uma pré-otimização via motor Canvas antes do upload ou gravação em banco:
* **Redimensionamento Proporcional**: A largura máxima das páginas é limitada em **1600px** preservando o aspect ratio original.
* **Otimização de Formato**: O canvas exporta os dados como imagem otimizada no formato **WebP** com um fator de qualidade de **85%** (`image/webp`, `0.85`).
* **Vantagem**: Reduz o tamanho de arquivos em média de **80% a 95%** antes de serem enviados à rede, garantindo que o portal opere dentro dos limites de banda e armazenamento gratuitos (Custo R$ 0).

---

## 🗄️ 7. Modo Dual de Persistência (Online vs. Offline)

O portal é dotado de uma chave de alternância rápida `window.isOfflineMode` (configurada em `js/supabase-config.js`), útil para testes sem conexão ou deploys de demonstração:

| Recurso | Modo Online (Supabase Ativo) | Modo Offline (Local Fallback) |
| :--- | :--- | :--- |
| **Autenticação** | Supabase Auth (`supabase.auth`) | Lista de usuários locais mockados no `LocalStorage` |
| **Capítulos** | Consulta síncrona na tabela `chapters` | Definição local unificada no array `defaultChapters` |
| **Páginas (HQ)** | Armazenadas no Bucket público `paginas-quadrinho` | Session-scoped Object URLs temporárias |
| **Leads** | Inserção direta na tabela `leads` | Array de e-mails em formato JSON no `LocalStorage` |
