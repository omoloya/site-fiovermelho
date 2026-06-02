# Especificações Técnicas: Painel de Administração do Autor (Fio Vermelho)

Este documento reúne todas as especificações técnicas, regras de negócio e infraestrutura da Área Administrativa (`admin.html` e `js/admin.js`) do projeto **Fio Vermelho** para servir de guia de desenvolvimento e integração.

---

## 🎨 1. Arquitetura de Interface e Estilo (Design Noir)

*   **Identidade Visual**: Paleta noir/Yakuza com preto profundo (`rgba(10, 10, 14, 0.95)`), cinza chumbo, destaques em vermelho primário carmesim (`#FF2A3B` ou `rgba(255, 42, 59, 1)`) e efeitos de brilho ciano/vermelho (`box-shadow` pulsantes).
*   **Aparência Glassmorphism**: Cartões usando `backdrop-filter: blur(12px)`, bordas translúcidas de `1px solid rgba(255, 255, 255, 0.08)` ou `rgba(255, 42, 59, 0.25)`.
*   **Responsividade**: Grid fluido que colapsa de 2 colunas (desktop) para 1 coluna (mobile/tablet), mantendo botões de ação e visualizadores de páginas confortáveis para toque de dedo.

---

## 🔒 2. Controle de Acesso e Segurança (Pre-Rendering Protection)

1.  **Proteção Síncrona do DOM (Inline Shield)**:
    No topo do `<head>` de `admin.html`, roda uma função imediatamente invocada (IIFE) que verifica a sessão de login no `localStorage`/`sessionStorage` sob a chave `sb-fiovermelho-session`. Caso não exista, o usuário é redirecionado instantaneamente para a página de entrada (`index.html`) para evitar "piscadas" de conteúdo administrativo.
2.  **Verificação de Whitelist (Client-Side)**:
    No `DOMContentLoaded` do script `js/admin.js`, é feita a leitura do e-mail contido no token JWT decodificado.
    *   **Whitelist de E-mails**: `miles.kensuke@gmail.com` e `omoloyaartes@gmail.com`.
    *   Se o usuário logado não pertencer à lista de e-mails, o sistema exibe um alerta de "Acesso Negado!" e o redireciona forçadamente para o painel de leitura comum (`dashboard.html`).

---

## ⚙️ 3. Módulo 1: Gerenciamento de Capítulos do Webtoon

Este formulário permite atualizar de forma dinâmica a sinopse e a imagem de capa do Capítulo 1 e Capítulo 2 no front-end, eliminando edições manuais de código.

*   **Campos do Formulário**:
    *   `select id="chapter-manage-selector"`: Permite selecionar entre "Capítulo 1" e "Capítulo 2".
    *   `textarea id="chapter-manage-synopsis"`: Entrada de texto para a sinopse.
    *   `input type="file" id="chapter-manage-cover-input"`: Upload de nova imagem de capa (WebP, PNG, JPG).
    *   `button type="submit" class="btn-save-chapter"`: Dispara a validação e o salvamento.
*   **Lógica de Comportamento Dinâmico**:
    1.  Ao alterar a seleção do dropdown (`chapter-manage-selector`), o campo de texto da sinopse é atualizado em tempo real. O script lê a chave `fio-chapter-X-synopsis` no `localStorage`.
    2.  **Fallbacks Oficiais**: Se não houver dados gravados no `localStorage` pelo administrador, a interface exibe as sinopses padrão ouro:
        *   **Capítulo 1**: *"O chefe dormiu de novo. Agora cabe ao resto do grupo..."*
        *   **Capítulo 2**: *"Quando o seu pai te liga de madrugada, te chama pelo apelido de criança..."*
    3.  Ao salvar as alterações:
        *   Grava a sinopse em `fio-chapter-X-synopsis` no `LocalStorage`.
        *   Se houver nova imagem selecionada, processa e converte para WebP client-side via Canvas (regras de compressão detalhadas na Seção 5) e a grava como Base64 em `fio-chapter-X-cover`.
        *   Gera um número de versão incremental em `fio-chapter-X-cover-version` para estourar o cache do leitor.
        *   Executa um reload instantâneo (`location.reload()`) para atualizar a tela administrativa.

---

## 🛠️ 4. Módulo 2: Upload, Edição e Exclusão de Páginas (Supabase Integration)

Gerencia a listagem e a exclusão dos capítulos do banco de dados, bem como a manipulação física das páginas contidas no Storage.

### A. Criação/Edição de Capítulos
*   **Campos**: Número do Capítulo (`input type="number"`), Título (`input type="text"`) e Data de Lançamento (`input type="text"`).
*   **Lista de Capítulos Publicados**: Tabela dinâmica que lista os registros do banco de dados (`chapters`) com as contagens de páginas. Possui os botões:
    *   `btn-edit-chap` (Editar): Carrega os dados do capítulo no formulário e exibe o Gerenciador de Páginas.
    *   `btn-delete-chap` (Excluir): Apaga permanentemente o registro da tabela de capítulos e purga todos os arquivos da pasta correspondente no bucket do Storage.

### B. Upload de Páginas
*   **Zona de Drop (`#drop-zone`)**: Interface interativa de drag and drop para arquivos de imagem. Ordena os arquivos arrastados numericamente por nome de arquivo (`1.png`, `2.png`...) para preservar a sequência de leitura.
*   **Fila de Upload (`#file-queue`)**: Lista cada página pendente com miniaturas, tamanhos e barras de economia em tempo real.
*   **Publicação**: Dispara o envio. Se for um capítulo existente, anexa novas páginas ao fim da sequência.

### C. Gerenciador de Páginas (Page Manager Card)
Disponível apenas no modo de edição do capítulo ativo. Renderiza uma grade de todas as páginas existentes no bucket. Cada miniatura possui dois botões rápidos:
1.  **Substituir Imagem (Replace)**:
    Permite escolher um novo arquivo do computador. Comprime o arquivo localmente em WebP a 75% e faz o envio ao Storage usando `upsert: true` no caminho exato da página (ex: `capitulo-X/pagina-Y.webp`), sem alterar as demais páginas.
2.  **Apagar Página e Reordenar Sequência (Delete & Shift)**:
    Se a página `Y` de um total de `N` páginas for excluída, o sistema precisa evitar buracos ou quebras de link na leitura:
    *   Deleta a imagem alvo no Storage.
    *   Renomeia sequencialmente todas as páginas seguintes (`Y+1` passa a ser `Y`, `Y+2` passa a ser `Y+1`...) usando o método de movimentação do Storage `supabase.storage.from(bucket).move()`.
    *   Atualiza o valor da coluna `pages_count` no banco de dados (`chapters`) diminuindo uma unidade.

---

## ⚡ 5. Algoritmo Client-Side de Otimização Canvas WebP (Quality & Performance)

Toda imagem de página de capítulo ou capa inserida no portal passa obrigatoriamente pela engine de renderização em Canvas do navegador antes de ser enviada ao banco de dados ou salva localmente:

1.  **Redimensionamento Proporcional Inteligente**:
    *   O script lê a largura (`width`) e altura (`height`) originais da imagem para identificar o formato.
    *   **Imagens Horizontais/Covers** (Ex: Capas de cards onde a largura é maior que a altura): A largura máxima é restrita a **1920px**.
    *   **Páginas de Leitura Verticais** (Ex: Páginas de quadrinho no estilo Webtoon onde a altura é maior ou igual à largura): A largura máxima é limitada estritamente a **1080px** (largura ideal para dispositivos móveis).
    *   A altura é recalculada proporcionalmente: `height = Math.round((maxWidth * height) / width)`.
2.  **Quality Apex**:
    *   Exporta a imagem desenhada no Canvas como blob WebP usando o parâmetro de compressão de qualidade ajustado exatamente em **`0.75`** (75% de qualidade):
        `canvas.toBlob((blob) => { ... }, 'image/webp', 0.75);`
3.  **Logs de Diagnóstico no Console**:
    No final da otimização, o script calcula e imprime no console as métricas de economia para monitoramento técnico:
    ```javascript
    const origMB = (file.size / (1024 * 1024)).toFixed(2);
    const compMB = (blob.size / (1024 * 1024)).toFixed(2);
    const reduction = Math.round(((file.size - blob.size) / file.size) * 100);
    console.log(`[Canvas Compress] Arquivo: ${file.name} | Original: ${origMB} MB | WebP Comprimido: ${compMB} MB | Redução: ${reduction}%`);
    ```

---

## 🗄️ 6. Modelo de Persistência Dual (Online vs. Offline)

Para permitir testes rápidos em ambiente local (desenvolvimento) sem depender de rede ativa, o painel administrativo opera em modo dual alternando através do flag global `window.isOfflineMode`:

| Recurso | Modo Online (Supabase Real) | Modo Offline (Fallbacks Locais) |
| :--- | :--- | :--- |
| **Metadados dos Capítulos** | Tabela `chapters` do Supabase via REST API / client `supabase.from('chapters')` | Armazenado no `LocalStorage` sob a chave `fio-mock-chapters` |
| **Arquivos das Páginas** | Bucket público de Storage `paginas-quadrinho` | Session-scoped object URLs armazenadas no `SessionStorage` (`fio-temp-page-${chapterId}-${pageIndex}`) |
| **Capas Customizadas** | Bucket público do Storage (página-1.webp) | Armazenado no `LocalStorage` sob a chave `fio-chapter-X-cover` (Base64 WebP) |
| **Sinopses de Capítulos** | Tabela do banco ou config central | Armazenado no `LocalStorage` sob a chave `fio-chapter-X-synopsis` |

---

## 🚦 7. Roteiro de Testes e Validação Técnica

1.  **Teste de Permissão e Rota**:
    *   Tente acessar `admin.html` deslogado. Valide se há redirecionamento imediato para `index.html`.
    *   Logue com um e-mail comum de leitor (ex: `leitor@gmail.com`) e tente acessar `admin.html`. O sistema deve exibir um alerta de "Acesso Negado!" e retornar para `dashboard.html`.
2.  **Teste de Mudança de Sinopse e Capa (Dropdown)**:
    *   No menu "Gerenciamento de Capítulos do Webtoon", selecione "Capítulo 2". Verifique se a sinopse longa preenche o campo.
    *   Altere o texto, adicione uma capa leve e salve. Valide se o console exibe o log de Base64 comprimida.
    *   Retorne ao painel do leitor (`dashboard.html`) e garanta que o Capítulo 2 renderiza a sinopse e a capa novas.
3.  **Teste de Compressão de Arquivos**:
    *   Arraste um PNG ou JPG pesado de 5MB na Drop Zone de upload de páginas.
    *   Abra o DevTools (F12) na aba Console e verifique se as métricas de conversão são exibidas com a largura máxima limitada (1080px) e tamanho final otimizado.
4.  **Teste de Shift de Páginas**:
    *   Entre no modo de edição de um capítulo com 5 páginas cadastradas.
    *   Delete a página 3.
    *   Verifique se o sistema removeu o arquivo correto e renomeou a antiga página 4 para 3, e a página 5 para 4.
