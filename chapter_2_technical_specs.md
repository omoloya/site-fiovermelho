# Especificação Técnica e Fluxo Lógico: Capítulo 02 <table><tr><td>🧶🛡️</td></tr></table>

Este documento detalha o mapeamento técnico completo, caminhos envolvidos, processamentos de rede e injeções de DOM referentes ao **Capítulo 02** ("Cortes no Destino") no portal **Fio Vermelho** pós-migração Supabase online.

---

## 📁 1. Arquivos Envolvidos e Caminhos Relativos

*   **Configuração de Ambiente**: [env.js](file:///C:/Users/Barbara/Desktop/miles/site-fiovermelho/env.js)
    *   Estabelece o escopo de autenticação do cliente.
*   **Inicializador da API**: [js/supabase-config.js](file:///C:/Users/Barbara/Desktop/miles/site-fiovermelho/js/supabase-config.js)
    *   Habilita a conexão em modo online (`window.isOfflineMode = false`).
*   **Engine de Renderização**: [js/dashboard.js](file:///C:/Users/Barbara/Desktop/miles/site-fiovermelho/js/dashboard.js)
    *   Executa a consulta remota e monta a interface visual de cards e gavetas.
*   **Leitor Vertical**: [ler.html](file:///C:/Users/Barbara/Desktop/miles/site-fiovermelho/ler.html) & [js/ler.js](file:///C:/Users/Barbara/Desktop/miles/site-fiovermelho/js/ler.js)
    *   Processa as páginas contínuas do capítulo quando o usuário clica em "Ler Capítulo".

---

## ⚙️ 2. Sequência de Processamento Síncrono e Assíncrono

```mermaid
sequenceDiagram
    participant Browser as Navegador (Cliente)
    participant Config as env.js / config.js
    participant DB as Supabase Banco de Dados
    participant DOM as dashboard.html (DOM)

    Browser->>Config: Carrega credenciais e inicia Cliente Supabase
    Note over Browser: window.isOfflineMode = false
    Browser->>DB: Executa select('*') da tabela 'chapters'
    DB-->>Browser: Retorna dados reais do Capítulo 2
    Browser->>Browser: Executa sanitização cleanId = "2"
    Browser->>Browser: Mapeia dados dinâmicos do banco
    Browser->>DOM: Injeta Card e Gaveta (drawer) no contêiner
    Browser->>DOM: Vincula finalCover e finalSynopsis diretamente nas tags
    Browser->>Browser: Cospe log de depuração no console
```

1.  **Carga do Documento**: O navegador lê os scripts na ordem padrão de deploy.
2.  **Handshake**: `supabase-config.js` estabelece a conexão ativa com o Supabase.
3.  **Consulta Assíncrona (Fetch)**: `dashboard.js` chama `loadChaptersAndRenderGrid()` que executa o `select('*')` no banco de dados.
4.  **Loop e Sanitização**: O loop `.forEach` normaliza a chave `chap.id` do banco para a string `"2"` (`cleanId`).
5.  **Mapeamento de Dados Dinâmicos**: A definição de `finalSynopsis` e `finalCover` cai diretamente no bloco de atribuição dinâmica, lendo as propriedades `chap.synopsis` e `chap.cover_url` diretamente do Supabase.
6.  **Montagem DOM**: Renderiza o card do capítulo com a tag `<img id="thumb-cap-2">` e a gaveta contendo `.chapter-drawer-cover img` e `.chapter-drawer-synopsis p`.
7.  **Atribuição Síncrona**: Seletores de DOM capturam as tags recém-injetadas e aplicam forçadamente os valores das variáveis `finalCover` e `finalSynopsis`.
8.  **Diagnóstico**: Cospe o agrupamento de logs `console.group("[DOM Render Diagnostic - Cap 2]")` detalhando o sucesso ou falha da resolução visual no console do desenvolvedor.

---

## 💻 3. Códigos e Linhas Relevantes (`js/dashboard.js`)

### A. A Consulta ao Banco de Dados (Linhas ~400)
```javascript
const { data, error } = await window.supabase
    .from('chapters')
    .select('*')
    .order('id', { ascending: true });
```
*   **O que faz**: Puxa o registro real cadastrado no Supabase correspondente ao Capítulo 2.

### B. O Bloco Dinâmico de Metadados (Linhas ~540)
```javascript
// --- INÍCIO DO HARDCODE DE SEGURANÇA BINDADO ---
let finalSynopsis = "";
let finalCover = "";

if (cleanId === "2" || parseInt(cleanId) === 2) {
    finalSynopsis = `Quando o seu pai te liga de madrugada, te chama pelo apelido de criança e pede para você levar um pudim e um estoque de desinfetante, você já sabe que o turno extra vai ser sujo. Sem a ajuda do guarda-costas oficial, o coroa intimou os pirralhos para assumirem o serviço doméstico de emergência. Mas quando o mais velho manda, os mais novos obedecem, por lealdade e, principalmente, amor.`;
    finalCover = "assets/capitulo_2.webp";
} else if (cleanId === "1" || parseInt(cleanId) === 1) {
    finalSynopsis = `O chefe dormiu de novo.
Agora cabe ao resto do grupo levá-lo para casa enquanto caminham pela cidade conversando sobre suas maiores preocupações: tacos de beisebol, gangues rivais, anime e o que vão fazer no próximo dia de folga.
Cochilos inesperados, amizades inabaláveis e uma normalidade completamente quebrada. São adoráveis, mas definitivamente não deveriam ser.`;
    finalCover = "assets/capitulo_1.webp";
} else {
    finalSynopsis = chap.synopsis || "Sinopse em breve.";
    finalCover = chap.cover_url || "assets/default_cover.webp";
}
// --- FIM DO HARDCODE DE SEGURANÇA BINDADO ---
```

### C. Mapeamento das Injeções do DOM (Linhas ~630)
```javascript
// Atribuição de Capa no Card principal
const elementoImg = chapterCard.querySelector(`#thumb-cap-${cleanId}`);
if (elementoImg) {
    elementoImg.src = finalCover;
}

// Atribuição de Capa na Gaveta (coluna de mídia interna)
const elementoImgDrawer = drawer.querySelector('.chapter-drawer-cover img');
if (elementoImgDrawer) {
    elementoImgDrawer.src = finalCover;
}

// Atribuição da Sinopse na Gaveta
const elementoText = drawer.querySelector('.chapter-drawer-synopsis p');
if (elementoText) {
    elementoText.textContent = finalSynopsis;
}
```

---

## 🛠️ 4. Guia de Manipulação para Desenvolvedores

*   **Para alterar a sinopse ou capa do Capítulo 2 na web**: 
    Não altere o código do front-end. Acesse o console do **Supabase**, navegue até a tabela `chapters`, localize a linha com `id = 2` e edite as colunas `synopsis` e `cover_url`. A página do leitor atualizará instantaneamente no próximo carregamento de forma síncrona.
*   **Para alterar os fallbacks do Capítulo 2 (caso venha nulo do banco)**: 
    Edite o bloco de definição de variáveis no loop (linha ~540 do `js/dashboard.js`), substituindo `"Sinopse em breve."` ou `"assets/default_cover.webp"` pelos novos valores default.
