# Plano de Implementação: Otimizador de Imagens (Canvas/WebP) & Área Administrativa de Capítulos (Supabase Storage)

Este plano descreve o design técnico para a criação de uma área administrativa de gerenciamento de capítulos e upload de páginas (`admin.html`), equipada com um compressor client-side em tempo real usando HTML5 Canvas para converter imagens de alta qualidade para `.webp` (máx. 1600px de largura com 85% de qualidade). Também descrevemos a dinamização completa do painel do leitor (`dashboard.html`) e da tela de leitura (`ler.html`) para carregar os capítulos de forma 100% dinâmica a partir do banco e do storage do Supabase, mantendo a compatibilidade offline/mockada.

---

## 💾 Banco de Dados & Storage (Supabase SQL)

Para suportar capítulos dinâmicos e upload de páginas com otimização, criaremos a tabela `chapters` no banco de dados e prepararemos o bucket público `paginas-quadrinho` com políticas RLS de leitura pública e escrita restrita.

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

-- 2. Inserir dados iniciais para consistência
INSERT INTO public.chapters (id, title, pages_count, release_date) VALUES
(1, 'O Elo Perdido', 4, '20 de Maio, 2026'),
(2, 'Cortes no Destino', 4, '25 de Maio, 2026'),
(3, 'O Laço Carmim', 4, '29 de Maio, 2026')
ON CONFLICT (id) DO NOTHING;

-- 3. Provisionamento de Storage para as imagens
-- (Executado via Admin do Supabase ou inserção direta no bucket se houver permissão)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('paginas-quadrinho', 'paginas-quadrinho', true)
ON CONFLICT (id) DO NOTHING;

-- Política de leitura livre para qualquer visitante ler as páginas do quadrinho
CREATE POLICY "Acesso público de leitura no storage" ON storage.objects
    FOR SELECT TO public USING (bucket_id = 'paginas-quadrinho');

-- Política de inserção para uploads na pasta paginas-quadrinho
CREATE POLICY "Permitir inserções públicas no storage" ON storage.objects
    FOR INSERT TO public WITH CHECK (bucket_id = 'paginas-quadrinho');
```

---

## 🎨 Design do Painel Administrativo (`admin.html`)

Criaremos a página [admin.html](file:///c:/Users/Barbara/Desktop/miles/site-fiovermelho/admin.html) mantendo a estética noir (preto de fundo, acentos vermelhos brilhantes, cartões glassmorphism e tipografia premium).

### Recursos da Interface de Upload:
*   **Acesso Controlado**: Integra com o status de sessão. Redireciona para o login se deslogado.
*   **Seletores de Capítulos**: Dropdown ou campos numéricos para criar um capítulo novo (Número do Capítulo, Título do Capítulo).
*   **Seleção de Arquivos**: Caixa de upload arrastar-e-soltar (drag & drop) estilizada com linha pontilhada vermelha.
*   **Fila de Upload com Métricas de Otimização**: Mostra cada arquivo selecionado, seu tamanho original, tamanho otimizado (calculado após compressão Canvas), porcentagem de redução (ex: `-87%`) e status individual.
*   **Painel de Progresso Central**: Barra de progresso vermelha brilhante e brilhante com porcentagem geral e status textual.

---

## ⚙️ Alterações Propostas nos Arquivos Existentes

### 1. Dinamização do Painel: [dashboard.html](file:///c:/Users/Barbara/Desktop/miles/site-fiovermelho/dashboard.html) & [dashboard.js](file:///c:/Users/Barbara/Desktop/miles/site-fiovermelho/js/dashboard.js)

*   **HTML**: Limparemos o container `#chapter-list-container` para deixá-lo vazio. O JavaScript se encarregará de renderizar os capítulos dinâmicos nele.
*   **HTML Header**: Adicionar um botão discreto de administração "Painel Admin" no header de navegação se o usuário logado for o autor (`miles@fiovermelho.art` ou similar) ou para conveniência de testes locais.
*   **JS**:
    *   No início do DOMContentLoaded, carregar a lista de capítulos (remota via Supabase `chapters` ou mockada via LocalStorage `fio-mock-chapters`).
    *   Montar os cards dinamicamente mantendo a estrutura exata de classes e comportamentos CSS.
    *   Se estiver em modo online, a thumbnail do card do capítulo será a primeira página otimizada armazenada no storage: `capitulo-${chapterId}/pagina-1.webp`. Em modo offline, fallback automático para `assets/chapterX_thumb.jpg`.
    *   Calcular o progresso dinamicamente com base na quantidade real de capítulos retornados, eliminando o limitador fixo de 3 capítulos.

### 2. Leitor Dinâmico: [ler.js](file:///c:/Users/Barbara/Desktop/miles/site-fiovermelho/js/ler.js)

*   Substituir a constante estática `chaptersData` por um carregamento assíncrono unificado:
    1.  Tentar buscar do banco do Supabase (`chapters`).
    2.  Mesclar com os capítulos mockados locais do LocalStorage `fio-mock-chapters`.
*   Ajustar a lógica do caminho das imagens (`img.src`):
    *   **Online**: Apontar para o bucket público do Supabase:
        `https://orckzqifklnlnjulqaxi.supabase.co/storage/v1/object/public/paginas-quadrinho/capitulo-${chapterId}/pagina-${pageIndex}.webp`
    *   **Offline**: Verificar se existem blobs temporários em `sessionStorage` (Blob URLs gerados na hora do upload na mesma aba pelo `admin.html`) para permitir **pré-visualização instantânea em tempo real** das imagens recém-comprimidas. Caso contrário, fallback físico original.

### 3. Novo Script: [admin.js](file:///c:/Users/Barbara/Desktop/miles/site-fiovermelho/js/admin.js)

Implementará o coração da otimização de imagens na web e a conexão com o Supabase Storage.

#### Algoritmo de Compressão HTML5 Canvas:
```javascript
async function compressImageToWebP(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                const maxWidth = 1600;

                // Redimensionamento proporcional
                if (width > maxWidth) {
                    height = Math.round((maxWidth * height) / width);
                    width = maxWidth;
                }

                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                // Exporta para WebP com qualidade 0.85 (85%)
                canvas.toBlob((blob) => {
                    resolve({
                        blob: blob,
                        width: width,
                        height: height,
                        originalSize: file.size,
                        compressedSize: blob.size
                    });
                }, 'image/webp', 0.85);
            };
        };
    });
}
```

---

## 🚦 Plano de Verificação e Testes

### Testes Manuais de Otimização e Upload
1.  **Validação do Compressor local (Offline Mode)**:
    *   Acessar `admin.html`.
    *   Inserir Capítulo `4`, Título `O Destino Revelado`.
    *   Selecionar 3 imagens grandes (PNG/JPG de 3MB+).
    *   Verificar na fila se o compressor reduziu o tamanho para WebP (ex: exibindo redução de 3MB para ~350KB).
    *   Clicar em "Salvar Capítulo". O sistema deve salvar os metadados no `localStorage` e armazenar as Blob URLs temporárias em `sessionStorage`.
    *   Clicar em "Visualizar no Leitor" e verificar se as imagens reais pré-comprimidas carregam com perfeita resolução no leitor vertical (`ler.html?cap=4`).
2.  **Validação Remota (Online Mode)**:
    *   Executar o upload conectado ao Supabase remoto.
    *   Confirmar na aba Storage do console do Supabase que os arquivos estão organizados como `capitulo-4/pagina-1.webp` e estão realmente em formato WebP.
