# Quadro de Tarefas - Fio Vermelho 🧶

Lista de tarefas organizada para o desenvolvimento do site do quadrinho digital **Fio Vermelho**.

## 🚀 Fase 1: Estrutura Básica & Design System (Concluída ✅)
- [x] Criar arquivo de controle de tarefas `tasks.md` na raiz.
- [x] Configurar a pasta `css/` e criar o `style.css` com o Design System premium (Dark Mode & Red Accent).
- [x] Criar a tela de entrada `index.html` contendo o aviso 18+, o simulador do Pix e o login/registro.
- [x] Criar o hub do leitor `dashboard.html` com o banner do quadrinho, lista de capítulos e captura de leads.
- [x] Criar a tela de leitura `ler.html` estilizada para rolagem vertical (Webtoon).
- [x] Organizar pastas para scripts JS e configurar o arquivo base do Supabase `js/supabase-config.js`.
- [x] RLS Security Audit & PIX Status Protection
    - [x] Update `js/dashboard.js` (retrieve ID via `supabase.auth.getUser()` in initial check, polling loop, and reverify button action)
    - [x] Update `js/ler.js` (retrieve ID via `supabase.auth.getUser()` in checkProfileStatus)
    - [x] Update `js/auth.js` (wrap admin login metadata queries/updates in try-catch)
    - [x] Validate Vercel compilation and commit changes
- [/] Project Documentation Update
    - [ ] Update `README.md` to reflect the direct link layout, dynamic parameters, and auth mechanisms
    - [ ] Update `developer_handover_guide.md` to match the exact live codebase features
    - [ ] Update `admin_system_specifications.md` to correct the canvas compression specifications (1600px width limit, 0.85 quality)
    - [ ] Delete `chapter_1_technical_specs.md` and `chapter_2_technical_specs.md`
    - [ ] Create `chapters_technical_specs.md` to document Chapters 1-4 with direct links, white styling, and reader properties
- [x] Desenvolver o serviço modular de pagamento `js/services/pixService.js` (com mock expansível para APIs reais).
- [x] Desenvolver o fluxo de autenticação e verificação em `js/auth.js` conectando ao Supabase.
- [x] Implementar a proteção de rotas no `dashboard.html` e `ler.html` via `js/dashboard.js` e `js/ler.js`.
- [x] Adicionar funcionalidade de progresso de leitura e marcação de capítulos lidos salvos no Supabase/localStorage.
- [x] Implementar captura de leads e feedback visual de sucesso na newsletter.
- [x] Carregamento dinâmico e navegação por capítulos em `js/ler.js`.

## ⚙️ Fase 2: Polimento, Mídias e Finalização (Próximo)
- [ ] Gerar/adicionar artes de demonstração realistas para a capa e páginas do quadrinho na pasta `assets/`.
- [ ] Refinar transições de tela e efeitos hover (micro-animações).
- [ ] Otimizações de performance e SEO.
- [ ] Testes finais de usabilidade no fluxo completo (Aviso -> Pix -> Cadastro -> Leitura) conectado ao Supabase remoto.
