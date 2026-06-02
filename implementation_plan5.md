# Plano de Implementação: Aba Expansiva Integrada para Capítulos (Estilo Netflix / Accordion)

Este plano detalha o redesenho crítico do sistema de exibição de detalhes de capítulos no painel do leitor (`dashboard.html`). Eliminaremos por completo o uso de modais flutuantes, pop-ups ou janelas sobrepostas, substituindo-os por uma **Aba Expansiva Integrada (Drawer/Accordion)** diretamente inserida no fluxo normal da grade de capítulos. Essa alteração destrava o scroll inercial no mobile e aprimora a usabilidade.

---

## 🎨 1. Diretrizes de UX e Design (Aba Expansiva)

1.  **Redesign de Modal para Aba Integrada**:
    *   Criação de um contêiner `.chapter-drawer` posicionado logo após cada card de capítulo.
    *   Ocultação padrão com `max-height: 0`, `overflow: hidden` e `opacity: 0`.
    *   Expansão fluida com transição linear/bezier para `max-height: 600px` e `opacity: 1` quando selecionado.
2.  **Fluxo de Layout Não Bloqueante (In-Flow)**:
    *   O drawer deve empurrar os elementos e capítulos subsequentes de forma natural.
    *   Nenhum uso de `position: fixed` ou `position: absolute` para a aba, mantendo a rolagem da página 100% nativa.
3.  **Destravamento de Scroll no Celular**:
    *   Certificar que `body` mantenha `overflow-y: scroll !important` a todo momento.
    *   Forçar `.chapter-drawer` a ocupar `100%` da largura física disponível no mobile.
    *   Centralização suave do card ativo utilizando `scrollIntoView({ behavior: 'smooth', block: 'nearest' })` com pequeno atraso.

---

## 🛠️ 2. Proposed Changes (Arquitetura e Arquivos)

### [NEW] CSS: Estilização da Aba Expansiva (`css/style.css`)
Substituiremos a seção do modal flutuante (`.chapter-detail-modal` e filhos) pelas novas regras de estilo para a aba integrada:

```css
/* Aba Expansiva Integrada para Capítulos (Estilo Netflix/Accordion) */
.chapter-drawer {
    grid-column: 1 / -1; /* Spans full grid row across columns */
    height: 0;
    max-height: 0;
    overflow: hidden;
    opacity: 0;
    transition: max-height 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease, margin 0.4s ease, padding 0.4s ease, border-width 0.4s ease;
    padding: 0 24px;
    margin: 0;
    border: 0px solid transparent;
    border-radius: var(--radius-sm);
    background: rgba(10, 10, 14, 0.95);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    box-sizing: border-box;
    z-index: 5;
}

.chapter-drawer.active {
    height: auto;
    max-height: 600px;
    opacity: 1;
    padding: 24px;
    margin-top: 16px;
    margin-bottom: 24px;
    border: 1px solid rgba(255, 42, 59, 0.25);
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.8), 0 0 30px rgba(255, 42, 59, 0.15);
}

.chapter-drawer-inner {
    width: 100%;
}

.chapter-drawer-content {
    display: grid;
    grid-template-columns: 1fr;
    gap: 24px;
}

@media (min-width: 769px) {
    .chapter-drawer-content {
        grid-template-columns: 240px 1fr;
    }
}

.chapter-drawer-cover {
    width: 100%;
    aspect-ratio: 16/10;
    overflow: hidden;
    border-radius: var(--radius-sm);
    border: 1px solid rgba(255, 255, 255, 0.05);
}

.chapter-drawer-cover img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.chapter-drawer-info {
    display: flex;
    flex-direction: column;
    justify-content: center;
    text-align: left;
}

.chapter-drawer-meta-row {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 12px;
    margin-bottom: 12px;
}

.chapter-drawer-synopsis {
    font-size: 0.9rem;
    color: var(--text-secondary);
    line-height: 1.6;
    margin-bottom: 20px;
}

.chapter-drawer-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
}

.chapter-drawer-actions .btn {
    padding: 10px 22px;
    font-size: 0.9rem;
    border-radius: var(--radius-sm);
}

/* Modificações Mobile */
@media (max-width: 768px) {
    .chapter-drawer {
        grid-column: 1 / -1 !important;
        width: 100% !important;
    }
    
    .chapter-drawer.active {
        padding: 16px !important;
        margin-top: 12px !important;
        margin-bottom: 16px !important;
    }
    
    .chapter-drawer-content {
        grid-template-columns: 1fr !important;
        gap: 16px !important;
    }
}
```

---

### [DELETE] HTML: Remover Modal Flutuante (`dashboard.html`)
Excluiremos por completo o bloco do modal flutuante:
```html
<!-- Modal Expansivo de Apresentação de Capítulo (Estilo Netflix) -->
<div id="chapter-detail-modal" class="chapter-detail-modal" aria-hidden="true">
    ...
</div>
```

---

### [MODIFY] JS: Lógica da Aba Expansiva (`js/dashboard.js`)
1.  **Remover handlers do antigo modal**:
    *   Excluir `openChapterDetailModal`.
    *   Remover listeners do botão fechar, overlay e atalhos de teclado correspondentes.
2.  **Injetar Drawers no Grid dinamicamente**:
    *   Na função `renderGrid(chapters)`, criaremos um elemento `div.chapter-drawer` imediatamente posterior a cada `article.chapter-card`.
    *   Preencheremos o drawer com os dados e sinopses dinâmicas do capítulo, incluindo os botões correspondentes.
3.  **Lógica de Ativação do Drawer (Slide & Scroll)**:
    *   Adicionar função `toggleChapterDrawer(chapterId)` que fecha qualquer drawer aberto, expande o drawer selecionado e, em visualizações móveis, executa o scroll dinâmico com centralização suave:
    ```javascript
    function toggleChapterDrawer(chapterId) {
        const allDrawers = document.querySelectorAll('.chapter-drawer');
        const targetDrawer = document.getElementById(`drawer-cap-${chapterId}`);
        const targetCard = document.querySelector(`.chapter-card img[id="thumb-cap-${chapterId}"]`)?.closest('.chapter-card');
        
        const isCurrentlyActive = targetDrawer && targetDrawer.classList.contains('active');
        
        // Fecha todos
        allDrawers.forEach(d => {
            d.classList.remove('active');
            d.style.maxHeight = '0';
            d.style.padding = '0';
            d.style.margin = '0';
            d.style.borderWidth = '0';
        });
        
        document.querySelectorAll('.chapter-card').forEach(c => {
            c.classList.remove('drawer-open');
        });
        
        if (!isCurrentlyActive && targetDrawer) {
            targetDrawer.classList.add('active');
            targetDrawer.style.maxHeight = '600px';
            targetDrawer.style.padding = '24px';
            targetDrawer.style.marginTop = '16px';
            targetDrawer.style.marginBottom = '24px';
            targetDrawer.style.borderWidth = '1px';
            
            if (targetCard) {
                targetCard.classList.add('drawer-open');
                if (window.innerWidth <= 768) {
                    setTimeout(() => {
                        targetCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    }, 150);
                }
            }
            
            // Controle de histórico para Back gesture do mobile
            history.pushState({ drawerOpen: true, chapterId: chapterId }, '', `#detalhes-capitulo-${chapterId}`);
        } else {
            if (window.location.hash.startsWith('#detalhes-capitulo-')) {
                history.back();
            }
        }
    }
    ```
4.  **Escuta do botão Voltar (`popstate`)**:
    *   Se o usuário efetuar o gesto "Voltar" no celular, fecha o drawer ativo limpando a visualização de forma fluida.

---

## 🚦 3. Plano de Verificação

### Automated & Manual Verification
1.  **Layout e Comportamento Integrado**:
    *   Acessar `dashboard.html` no desktop e redimensionar para mobile.
    *   Clicar em um capítulo e certificar-se de que a aba abre deslizando suavemente para baixo, empurrando os elementos subsequentes.
    *   Certificar-se de que clicar no mesmo capítulo ou em outro fecha o anterior corretamente.
2.  **Destravamento do Scroll Vertical**:
    *   Emular celular com scroll ativo no console do desenvolvedor.
    *   Verificar se a rolagem inercial com o dedo permanece 100% livre e utilizável sobre o card e dentro do drawer, sem camadas ocultas interceptando o toque.
3.  **Validação de Histórico e Gestos**:
    *   Com a aba aberta no mobile, deslizar o dedo na borda (gesto Voltar).
    *   Verificar se a aba se fecha de forma fluida sem deslogar o usuário ou sair do site.
