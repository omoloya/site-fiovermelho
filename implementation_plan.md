# Plano de Implementação: Site do Quadrinho Digital "Fio Vermelho" (Final)

Este plano consolida as decisões tomadas e os ajustes finais aprovados pelo autor para o site estático do quadrinho digital **"Fio Vermelho"**.

---

## Novos Ajustes Aprovados

1.  **Tela de Leitura (`ler.html`)**:
    *   Um leitor de rolagem vertical (estilo Webtoon) projetado para carregamento fluido e imersivo das páginas do quadrinho.
    *   Controles de navegação flutuantes ou no rodapé ("Voltar para a Capa", "Capítulo Anterior", "Próximo Capítulo").
    *   Proteção de rota idêntica ao dashboard (exige login e verificação de idade ativos).
    *   Carregamento dinâmico de páginas via query parameters (ex: `ler.html?cap=1`).

2.  **Captura de Leads (Newsletter de Lançamentos)**:
    *   No `dashboard.html`, adicionaremos uma seção de captura de leads integrada ao design.
    *   Lógica no JS para simular ou salvar no Supabase (em uma tabela `leads`) o cadastro de e-mail para receber notificações de novos capítulos.

3.  **Modularização do Pix**:
    *   A lógica do Pix Mockado será isolada em um módulo de serviço (`js/services/pixService.js`).
    *   Toda a comunicação com o gateway de pagamento (geração de QR Code, verificação de status) ocorrerá dentro deste serviço modular, facilitando a substituição futura por gateways reais (como Asaas, Mercado Pago ou Stripe).

---

## Proposta de Arquivos e Estrutura Final

```
site-fiovermelho/
├── index.html              # Tela de Aviso de Maioridade, Login, Registro e Pix
├── dashboard.html          # Capa do quadrinho, sinopse, capítulos e captura de Leads
├── ler.html                # Leitor vertical infinito (estilo Webtoon)
├── tasks.md                # Acompanhamento local das tarefas
├── css/
│   └── style.css           # Estilos globais, Glassmorphism, Red Accent, Player e Leitor Webtoon
├── js/
│   ├── supabase-config.js  # Configuração centralizada do Supabase
│   ├── services/
│   │   └── pixService.js   # Serviço de pagamento modularizado (mockado -> pronto para API)
│   ├── auth.js             # Controle de autenticação e fluxos de index.html
│   ├── dashboard.js        # Lógica da home do leitor e captação de leads
│   └── ler.js              # Lógica do leitor vertical e navegação entre capítulos
└── assets/                 # Imagens da capa, thumbnails e páginas do quadrinho
```

---

## Plano de Verificação

### Testes Manuais & Funcionais
1.  **Fluxo de Novo Usuário**:
    *   Entrar em `index.html` -> aceitar aviso -> ver tela Pix -> simular pagamento -> ver formulário de cadastro -> registrar.
2.  **Proteção de Rotas**:
    *   Tentar entrar em `dashboard.html` ou `ler.html` deslogado e verificar redirecionamento automático para `index.html`.
3.  **Leitor Webtoon (`ler.html`)**:
    *   Testar se o parâmetro `?cap=X` carrega corretamente as imagens correspondentes.
    *   Verificar o funcionamento dos botões de navegação.
4.  **Captura de Leads**:
    *   Assinar a newsletter no dashboard e verificar o feedback visual de sucesso.
