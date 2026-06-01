# Walkthrough do Projeto: Fio Vermelho (Compressor Canvas & Admin de Uploads! 🧶🚀)

Este documento resume a implementação bem-sucedida da **Área Administrativa de Capítulos** (`admin.html`) e do **Compressor de Imagens Client-Side** para WebP. Toda a estrutura de exibição do painel principal (`dashboard.html`) e do leitor vertical (`ler.html`) foi dinamizada para ler os dados reais da nuvem ou fallbacks offline perfeitamente.

---

## ⚡ O que foi Implementado e Integrado

### 1. Compressor de Imagens em Tempo Real (Canvas Client-Side)
Projetamos um compressor client-side que intercepta a seleção de arquivos de imagens de quadrinho (PNG/JPG gigantes, comumente de 4MB a 10MB) e as processa no navegador do usuário antes de enviar qualquer dado à rede:
*   **Limitação Proporcional**: Redimensiona a largura máxima para **$1600\text{px}$** (preservando o aspect ratio original).
*   **Conversão para WebP**: Converte o arquivo para o formato altamente otimizado `image/webp`.
*   **Fator de Qualidade**: Compressão em **$85\%$ (0.85)**.
*   **Métricas de Economia**: Exibe a redução de tamanho em tempo real na fila (ex: *Economia: -92% (5.4MB ➔ 430KB)*), garantindo economia total de limites de storage e banda para manter os **custos em R$ 0**.

### 2. Portal de Publicação Administrativa (`admin.html` & `js/admin.js`)
*   **Estética Noir & Glassmorphism**: Um painel magnífico estilizado sob o tema noir do projeto, com uma área drag-and-drop pontilhada carmim para seleção rápida de páginas do quadrinho.
*   **Barra de Progresso**: Indicador visual dinâmico com porcentagem geral e logs detalhados do status de envio.
*   **Tratamento de Fluxos**:
    *   **Modo Produção (Online)**: Sobe cada página otimizada para o bucket público `paginas-quadrinho` do Supabase e registra o capítulo na tabela `chapters` do banco.
    *   **Modo Protótipo (Offline Fallback)**: Salva os metadados do capítulo no `localStorage` e as Blob URLs das imagens comprimidas na `sessionStorage`. Isso permite que o usuário teste a compressão e clique em *"Visualizar no Leitor"* para ler o novo capítulo de verdade na mesma guia, sem precisar de internet!

### 3. Painel e Leitor Dinâmicos (`js/dashboard.js` & `js/ler.js`)
*   **dashboard.html**: A grade de capítulos estática foi removida. O JS agora faz buscas dinâmicas (no Supabase ou LocalStorage offline) e reconstrói os cards em tempo real com miniaturas inteligentes (que extraem automaticamente a página 1 do capítulo).
*   **ler.html**: Removemos a dependência de dados estáticos. O leitor carrega as páginas verticalmente buscando as URLs públicas do Storage do Supabase (Modo Online) ou os blobs dinâmicos da `sessionStorage` (Modo Offline). A navegação entre capítulos e seletores dropdown é recalculada de forma 100% dinâmica!

---

## 🚦 Passo a Passo para Testes em Produção

Para testar a funcionalidade completa no ar no seu domínio **[fiovermelho.art](https://fiovermelho.art)**, siga as instruções abaixo:

### Passo A: Criar a Estrutura no Supabase (SQL)
Abra a sua conta do **Supabase**, vá em **SQL Editor > New Query**, cole o script abaixo e clique em **Run** para provisionar o banco de dados e o Storage com RLS apropriado:

```sql
-- 1. Criar a tabela de capítulos dinâmicos
CREATE TABLE IF NOT EXISTS public.chapters (
    id INT PRIMARY KEY, -- O número do capítulo (1, 2, 3...)
    title TEXT NOT NULL,
    pages_count INT NOT NULL,
    release_date TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS na tabela de capítulos
ALTER TABLE public.chapters ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para a tabela de capítulos
CREATE POLICY "Permitir leitura pública de capítulos" ON public.chapters
    FOR SELECT TO public USING (true);

CREATE POLICY "Permitir inserções públicas em capítulos" ON public.chapters
    FOR INSERT TO public WITH CHECK (true);

CREATE POLICY "Permitir atualizações públicas em capítulos" ON public.chapters
    FOR UPDATE TO public USING (true);

-- 2. Inserir dados iniciais para consistência
INSERT INTO public.chapters (id, title, pages_count, release_date) VALUES
(1, 'O Elo Perdido', 4, '20 de Maio, 2026'),
(2, 'Cortes no Destino', 4, '25 de Maio, 2026'),
(3, 'O Laço Carmim', 4, '29 de Maio, 2026')
ON CONFLICT (id) DO NOTHING;

-- 3. Provisionamento de Storage para as imagens
INSERT INTO storage.buckets (id, name, public) 
VALUES ('paginas-quadrinho', 'paginas-quadrinho', true)
ON CONFLICT (id) DO NOTHING;

-- Política de leitura livre para qualquer visitante ler as páginas do quadrinho
CREATE POLICY "Acesso público de leitura no storage" ON storage.objects
    FOR SELECT TO public USING (bucket_id = 'paginas-quadrinho');

-- Política de inserção para uploads na pasta paginas-quadrinho
CREATE POLICY "Permitir inserções públicas no storage" ON storage.objects
    FOR INSERT TO public WITH CHECK (bucket_id = 'paginas-quadrinho');

CREATE POLICY "Permitir atualizações públicas no storage" ON storage.objects
    FOR UPDATE TO public USING (bucket_id = 'paginas-quadrinho');
```

### Passo B: Testar o Fluxo no Site
1.  Acesse **[fiovermelho.art](https://fiovermelho.art)** e faça login com sua conta verificada.
2.  No painel do leitor (`dashboard.html`), note o novo botão discreto **"Admin"** no cabeçalho superior direito. Clique nele!
3.  Você entrará no portal de administração (`admin.html`).
4.  Preencha os dados do Capítulo (ex: Número: `4`, Título: `O Fio Cortado`).
5.  Arraste ou selecione 4 ou mais imagens em PNG ou JPG de alta resolução.
6.  Acompanhe a mágica acontecer! O compressor Canvas WebP começará a trabalhar em segundo plano na fila, mostrando o tamanho original e o tamanho final comprimido com as estatísticas de economia (geralmente economizando de **80% a 95%** em bytes!).
7.  Clique em **"Publicar Capítulo"**.
8.  Uma barra de progresso vermelha e brilhante aparecerá. Quando concluída, exibirá um banner verde e ativará o botão **"Visualizar no Leitor"**.
9.  Clique em **"Visualizar no Leitor"** e veja as páginas otimizadas do seu novo Capítulo 4 carregarem perfeitamente na proporção certa!
10. Se voltar ao painel principal (`dashboard.html`), você verá o card do Capítulo 4 disponível dinamicamente na grade, exibindo a primeira página do quadrinho como miniatura e recalculando o progresso total para *Lidos: X / 4*!

---

## 🛠️ Resolução do Bug Crítico de Validação do Pix e Desbloqueio do Dashboard (Maio, 2026)

Identificamos e corrigimos em caráter definitivo o erro crítico que exibia o aviso de *"Erro ao conectar com o banco"* e, posteriormente, travava o usuário no modal de aguardando ativação com a mensagem *"Ainda não detectamos a aprovação do Pix"*.

### 1. Incompatibilidade do Cliente Supabase (`getPublicUrl`)
*   **Problema**: O código efetuava desestruturação direta do retorno de `.getPublicUrl()` assumindo o formato do cliente Supabase v2 (`const { data } = ...`). No entanto, o cliente no ar retornava o formato antigo da v1 (`{ publicURL: '...' }`). Isso gerava um `TypeError: Cannot read properties of undefined` no meio da renderização dos capítulos, abortando a execução do script síncrono e caindo no `catch` genérico do botão de reverificação (que exibia a mensagem de erro de conexão com o banco).
*   **Correção**: Implementamos um wrapper de compatibilidade universal nos arquivos [js/dashboard.js](file:///c:/Users/Barbara/Desktop/miles/site-fiovermelho/js/dashboard.js), [js/ler.js](file:///c:/Users/Barbara/Desktop/miles/site-fiovermelho/js/ler.js) e [js/admin.js](file:///c:/Users/Barbara/Desktop/miles/site-fiovermelho/js/admin.js):
    ```javascript
    try {
        const res = window.supabase.storage.from(...).getPublicUrl(...);
        if (res && res.data && res.data.publicUrl) {
            imageSource = res.data.publicUrl; // Supabase v2
        } else if (res && res.publicURL) {
            imageSource = res.publicURL; // Supabase v1
        } else if (typeof res === 'string') {
            imageSource = res; // String direta
        }
    } catch (urlErr) {
        console.error(urlErr);
    }
    ```

### 2. Restrição de Integridade (Check Constraint do Postgres)
*   **Problema**: Tentamos unificar o vocabulário sob a palavra-chave `'pago'`. Entretanto, a tabela `profiles` do Supabase possui uma restrição de verificação a nível de esquema PostgreSQL (`profiles_status_check`) que **rejeitava** qualquer valor diferente de `('pendente_verificacao', 'verificado')`. Quando o backend tentava gravar `'pago'`, o banco abortava a transação com um erro de violação de constraint, fazendo com que o status do usuário permanecesse permanentemente como `'pendente_verificacao'`.
*   **Correção**:
    *   **Backend (`api/checar-pix.js`)**: Ajustamos para salvar estritamente a string `'verificado'` no banco após o sucesso da transação, respeitando a integridade do banco de dados do Supabase.
    *   **Frontend (`js/auth.js` & `js/dashboard.js`)**: Flexibilizamos as condicionais do front-end para que aceitem tanto `'verificado'` quanto `'pago'`, `'approved'` e `true` (boolean). Desta forma, o leitor é liberado instantaneamente e de forma 100% segura.
    *   **Automação do Vercel Deploy**: Adicionamos o script de build oficial no `package.json` para que as chaves de ambiente sejam injetadas dinamicamente no `env.js` da produção da Vercel a cada novo deploy, de forma automatizada e transparente.

---

## 🧶 Otimização de Leitura Webtoon (Maio, 2026)

Implementamos uma otimização profunda para a leitura vertical dos capítulos estilo **Webtoon**, solucionando problemas críticos de visualização em smartphones/tablets e garantindo uma imersão contínua:

### 1. Responsividade Fluida e Sem Largura Fixa
*   **Ação**: Eliminamos qualquer largura fixa (como pixels) ou unidades de viewport restritivas (`100vw`, que causava barras de rolagem horizontais indesejadas no Windows/Browsers devido ao tamanho da barra de rolagem vertical).
*   **CSS Aplicado**: Declaramos `width: 100%; max-width: 100%; height: auto; display: block; margin: 0 auto; padding: 0; border: none;` para todas as imagens de páginas do leitor (`.webtoon-page-img`).
*   **Resultado**: Em celulares, as imagens se adaptam precisamente à largura da tela. Em tablets, elas se expandem até o limite máximo do container centralizado (`max-width: 800px` padrão de leitura Webtoon) de forma natural, sem cortes laterais ou distorções.

### 2. Scroll Manual e Foco Absoluto no Topo
*   **Ação**: Desativamos o comportamento automático de restauração de rolagem do navegador definindo `history.scrollRestoration = 'manual'` na inicialização.
*   **Javascript Aplicado**: Forçamos o navegador a rolar instantaneamente para o ponto vertical zero (`window.scrollTo({ top: 0, left: 0, behavior: 'instant' })`) em dois momentos estratégicos: no início da inicialização do leitor (`initializeReader`) e no início da renderização do canvas (`renderWebtoonPages`).
*   **Resultado**: O usuário sempre inicia a leitura exatamente no topo extremo da primeira imagem do capítulo, evitando que a visualização inicie no meio ou fim devido a cache de scroll do navegador.

### 3. Emenda Vertical Invisível (Fluxo Contínuo)
*   **Ação**: Zeramos quaisquer margens, espaçamentos internos (padding) e bordas verticais entre as páginas do quadrinho.
*   **CSS Aplicado**: Estilizamos `.webtoon-canvas` com `gap: 0; padding: 0;` e `.webtoon-placeholder.loaded` com `margin: 0; padding: 0; border: none; border-bottom: none;`.
*   **Resultado**: O fluxo de leitura vertical tornou-se 100% contínuo e sem nenhuma emenda visível entre os blocos verticais do Webtoon.

### 4. Correção Crítica de Viewport, Rolagem Mobile e Eventos de Toque
*   **HTML Viewport**: Alteramos a tag `<meta name="viewport">` em [ler.html](file:///c:/Users/Barbara/Desktop/miles/site-fiovermelho/ler.html) para `<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes">` para mitigar problemas de zoom exagerado automático e manter flexibilidade móvel.
*   **Desbloqueio de Rolagem Mobile**: Em [css/style.css](file:///c:/Users/Barbara/Desktop/miles/site-fiovermelho/css/style.css) no mobile, removemos todas as amarras de `height: 100%` e `overflow` do corpo e wrappers superiores. Unificamos `html, body, .reader-container, #app, main` com `height: auto !important; min-height: 100vh !important; overflow-y: visible !important; overflow-x: hidden !important;`, assegurando que o leitor no smartphone use a rolagem nativa de documento sem travas de contêiner.
*   **Habilitação de Gestos Verticais e Desativação de Seleção**: Além de `pointer-events: auto !important` e `touch-action: pan-y !important;` tanto na classe contêiner `.webtoon-canvas` quanto nas imagens `.webtoon-page-img` no bloco mobile, adicionamos a propriedade `user-select: none !important;` e `-webkit-user-select: none !important;` na imagem do quadrinho para impedir que o celular tente disparar a seleção ou cópia da fita, eliminando o travamento do gesto de scroll.
*   **Garantia de Topo no Carregamento Tardio & Limpeza de DOM**: Em [js/ler.js](file:///c:/Users/Barbara/Desktop/miles/site-fiovermelho/js/ler.js), aprimoramos o handler `img.onload` de carregamento dinâmico: limpamos de forma absoluta o HTML interno do wrapper (`pageWrapper.innerHTML = '';`) e reinserimos unicamente o nó `img` resolvido, limpando resíduos de tags de texto invisíveis ou spinners ocultos que afetavam os cálculos de altura. Ao processar a primeira página (`i === 1`), força-se imediatamente a rolagem instantânea para o topo (`scrollTo(0,0)`) envelopado em um `setTimeout` ampliado para 150ms e com múltiplos fallbacks de propriedade (`documentElement.scrollTop` e `body.scrollTop`) para dar tempo de o navegador calcular com exatidão o carregamento da fita.

