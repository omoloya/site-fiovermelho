# Plano de Implementação: Gerenciador Avançado de Capítulos & Páginas (Supabase Storage & RLS)

Este plano detalha a implementação das funcionalidades avançadas de gerenciamento de capítulos no painel administrativo (`admin.html`), cobrindo a listagem dinâmica de capítulos publicados, edição de metadados, exclusão completa de capítulos (com limpeza de arquivos no storage) e um gerenciador de páginas individuais que permite excluir páginas (com reordenação sequencial automática no bucket) e substituir arquivos (passando pela compressão Canvas/WebP).

---

## 💾 Banco de Dados & Storage (Novas Políticas RLS)

Asseguraremos que o Supabase permita exclusões (`DELETE`) e movimentações de arquivos (`move`) nas políticas de RLS para administradores autorizados.

```sql
-- 🔒 Adicionar políticas de exclusão e atualização de capítulos para os administradores no Banco de Dados
DROP POLICY IF EXISTS "Permitir exclusão de capítulos para administradores" ON public.chapters;

CREATE POLICY "Permitir exclusão de capítulos para administradores" ON public.chapters
    FOR DELETE TO authenticated
    USING ((auth.jwt() ->> 'email') IN ('miles.kensuke@gmail.com', 'omoloyaartes@gmail.com'));

-- 🔒 Adicionar políticas de exclusão e movimentação no Storage de Páginas
DROP POLICY IF EXISTS "Permitir exclusão de páginas no storage" ON storage.objects;

CREATE POLICY "Permitir exclusão de páginas no storage" ON storage.objects
    FOR DELETE TO authenticated
    USING (
        bucket_id = 'paginas-quadrinho' AND 
        ((auth.jwt() ->> 'email') IN ('miles.kensuke@gmail.com', 'omoloyaartes@gmail.com'))
    );
```

---

## 🎨 Layout Visual & Modificações em `admin.html`

Adicionaremos duas novas seções em [admin.html](file:///c:/Users/Barbara/Desktop/miles/site-fiovermelho/admin.html) mantendo o design noir glassmorphism:

1.  **Lista de Capítulos Publicados**: Card posicionado abaixo do formulário de dados do capítulo (Coluna Esquerda). Exibirá a listagem em formato de lista minimalista com título, páginas, data e botões de ação:
    *   `Botão Editar` (<i class="fa-solid fa-pen"></i>) - Entra no modo de edição do capítulo.
    *   `Botão Excluir` (<i class="fa-solid fa-trash"></i>) - Exclui o capítulo e limpa seus arquivos.
2.  **Gerenciador de Páginas do Capítulo (Modo Edição)**: Card dinâmico `#page-manager-card` posicionado abaixo do card de upload (Coluna Direita), exibido apenas quando o administrador estiver editando um capítulo. Exibirá as páginas em um grid horizontal ou vertical contendo:
    *   Miniatura real da página direto do Storage.
    *   `Botão Apagar` (<i class="fa-solid fa-trash"></i>) - Remove a página e reordena as seguintes.
    *   `Botão Substituir` (<i class="fa-solid fa-arrows-rotate"></i>) - Dispara a seleção de um arquivo, comprime via Canvas e sobrescreve no mesmo caminho.

---

## ⚙️ Algoritmos de Lógica Avançada em `js/admin.js`

### 1. Algoritmo de Exclusão de Capítulo Completo
Remove o registro na tabela `chapters` e faz uma varredura recursiva no Supabase Storage para apagar todas as imagens contidas no diretório `capitulo-${chapterId}/`.

```javascript
async function deleteChapterComplete(chapterId) {
    if (window.isOfflineMode) {
        // Mock: Remove do localStorage e sessionStorage Blobs
        let mockChapters = JSON.parse(localStorage.getItem('fio-mock-chapters') || '[]');
        mockChapters = mockChapters.filter(c => c.id !== chapterId);
        localStorage.setItem('fio-mock-chapters', JSON.stringify(mockChapters));
        
        // Remove blobs da sessão
        for (let i = 1; i <= 20; i++) {
            sessionStorage.removeItem(`fio-temp-page-${chapterId}-${i}`);
        }
    } else {
        // Produção Supabase
        // 1. Deleta registro no banco
        await window.supabase.from('chapters').delete().eq('id', chapterId);
        
        // 2. Lista arquivos na pasta capitulo-X no storage
        const { data: files } = await window.supabase.storage
            .from('paginas-quadrinho')
            .list(`capitulo-${chapterId}`);
            
        if (files && files.length > 0) {
            const filesToRemove = files.map(f => `capitulo-${chapterId}/${f.name}`);
            // 3. Deleta arquivos em lote
            await window.supabase.storage.from('paginas-quadrinho').remove(filesToRemove);
        }
    }
}
```

### 2. Algoritmo de Exclusão de Página Individual com Reordenação Sequencial
Quando a página `p` é excluída de um capítulo com `N` páginas:
1.  Apaga `capitulo-${chapterId}/pagina-${p}.webp`.
2.  Desloca cada arquivo seguinte no Storage:
    Renomeia/Move `pagina-${i}.webp` para `pagina-${i-1}.webp` para todos os `i` de `p + 1` até `N`.
3.  Atualiza `pages_count` do capítulo para `N - 1` na tabela `chapters`.

Este algoritmo previne buracos na paginação, garantindo que o leitor vertical (`ler.html`) carregue a história de forma contínua e sem quebras visuais!

```javascript
async function deletePageAndRenumber(chapterId, pageIndex, totalPages) {
    const bucket = 'paginas-quadrinho';
    
    if (window.isOfflineMode) {
        // Mock deslocamento no sessionStorage
        sessionStorage.removeItem(`fio-temp-page-${chapterId}-${pageIndex}`);
        for (let i = pageIndex + 1; i <= totalPages; i++) {
            const val = sessionStorage.getItem(`fio-temp-page-${chapterId}-${i}`);
            if (val) {
                sessionStorage.setItem(`fio-temp-page-${chapterId}-${i-1}`, val);
                sessionStorage.removeItem(`fio-temp-page-${chapterId}-${i}`);
            }
        }
    } else {
        // Produção Supabase
        // 1. Apaga a página selecionada
        const targetPath = `capitulo-${chapterId}/pagina-${pageIndex}.webp`;
        await window.supabase.storage.from(bucket).remove([targetPath]);
        
        // 2. Desloca as subsequentes usando .move()
        for (let i = pageIndex + 1; i <= totalPages; i++) {
            const fromPath = `capitulo-${chapterId}/pagina-${i}.webp`;
            const toPath = `capitulo-${chapterId}/pagina-${i-1}.webp`;
            await window.supabase.storage.from(bucket).move(fromPath, toPath);
        }
    }
}
```

### 3. Substituição Direta de Página
Permite escolher um novo arquivo, compactar via Canvas para WebP em tempo real e fazer um upload direto sobrepondo (`upsert: true`) a imagem na rota `capitulo-${chapterId}/pagina-${pageIndex}.webp`.

---

## 🚦 Plano de Verificação e Testes

### Testes Manuais
1.  **Excluir Capítulo**: Criar um capítulo de testes (Capítulo 99), preencher com imagens, confirmar que ele aparece listado, e em seguida excluí-lo. Confirmar no Supabase que a pasta de storage e os metadados foram totalmente removidos.
2.  **Substituir Página**: Entrar na edição do Capítulo 1, selecionar a página 2, enviar uma nova imagem. Verificar se a nova imagem carregada reflete a alteração imediatamente.
3.  **Apagar Página & Reordenação**:
    *   Criar capítulo 5 com 3 páginas (pág 1, pág 2, pág 3).
    *   Excluir a página 2 (do meio).
    *   Verificar se a página 3 antiga foi movida para a posição 2 e o total de páginas foi reduzido para 2.
    *   Visualizar no leitor e verificar se as duas páginas carregam sem erros de imagem.
