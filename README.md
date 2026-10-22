# Atlas — Vigilância epidemiológica

Painel local em React e Java inspirado na referência fornecida: globo 3D, tema escuro, marcadores geográficos, indicadores, cadastro, exclusão e exportação CSV.

## Executar no Windows

1. Abra `iniciar-backend.cmd`.
2. Abra `iniciar-frontend.cmd`.
3. Acesse o endereço mostrado pelo frontend (normalmente http://127.0.0.1:5173; se a porta estiver ocupada, o Vite escolhe a próxima).

O frontend usa seu Node **14.21.3**, React 18.2 e Vite 4.5.14. O Node 14 e essa linha do Vite são antigos; a compatibilidade foi preservada para seu ambiente. Planeje atualizar o Node antes de disponibilizar o sistema na internet.

O backend requer **JDK 17+ e Maven 3.6.3+**. Os scripts usam as ferramentas portáteis da pasta `.tools`, quando presentes, sem mudar seu Node ou instalar Java globalmente. Se não estiverem presentes, instale o JDK e Maven e configure JAVA_HOME/PATH.

Alternativa pelo terminal, em duas janelas:

```powershell
cd backend
mvn spring-boot:run
```

```powershell
cd frontend
npm install --registry=https://registry.npmjs.org
npm run dev
```

## Home pública e acesso do proprietário

A home abre diretamente, sem login, e consulta os registros publicados. Use os filtros por país, estado/província e cidade/região. A base real começa vazia; a demonstração pode ser aberta explicitamente e é identificada como fictícia.

Somente o dono do sistema usa **Área do proprietário** (`/#admin`). Na primeira configuração desta área, defina nome, e-mail e uma senha de pelo menos 12 caracteres (máximo de 72 bytes). Não há senha padrão. A configuração inicial é bloqueada assim que a primeira conta é criada.

Nos próximos acessos, use seu e-mail e senha. O botão **Sair** encerra a sessão. As consultas são públicas. O backend protege cadastros, exclusões e importações, com Spring Security, hash BCrypt (custo 12), sessão em cookie HttpOnly/SameSite=Strict e proteção CSRF. A sessão expira após 30 minutos de inatividade no servidor; reiniciar o backend encerra as sessões. Não guardamos senha nem token de autenticação no localStorage.

Há limite de 10 tentativas de login/configuração por minuto e endereço IP. Esta versão tem uma conta administradora e uma base compartilhada; ainda não tem recuperação de senha por e-mail, gestão de usuários ou múltiplos perfis. Guarde sua senha.

## Usar

- A home inicia na **base publicada**, sem exigir conta. O botão **Ver demonstração** apresenta dados fictícios, que não são gravados no banco.
- Use **Consultar dados publicados** para consultar os registros reais. Uma base nova começa vazia.
- Em **Novo registro**, informe país, estado/província (quando disponível), cidade/região, coordenadas, doença, data e totais. O cadastro é persistido pelo Java. Latitude e longitude usam graus decimais.
- Em **Fontes de dados**, use **Importar COVID-19** para consultar https://disease.sh/v3/covid-19/countries. A fonte pode ter dados antigos ou estar indisponível. Sua data original é mostrada na tabela. Não há promessa de tempo real.
- Uma nova importação atualiza o snapshot da mesma data da disease.sh e preserva snapshots de datas anteriores, em uma transação, mantendo também os cadastros manuais. Respostas inválidas não apagam os dados existentes.
- Em **Registros**, exporte os registros filtrados em CSV ou exclua um registro da base real.
- Arraste o globo, use a roda para zoom ou pause a rotação. Clique nos pontos para consultar o local. A tabela oferece a mesma consulta caso WebGL esteja indisponível.

## Interpretação dos dados

A home usa o registro mais recente de cada combinação de local, doença e fonte, dentro do filtro de data. A tabela de Registros mantém todas as datas. Os percentuais comparam cada snapshot com o snapshot anterior da mesma combinação; o intervalo pode variar por local e não é necessariamente diário. A cobertura (locais comparáveis / locais exibidos) aparece abaixo de cada variação. Locais sem histórico não entram no cálculo percentual. Uma base anterior zero é identificada sem calcular uma porcentagem infinita.

Os totais não estimam pessoas únicas. Não misture totais nacionais com suas cidades nem fontes sobrepostas quando quiser medir uma população sem duplicação. Os casos ativos são calculados como confirmados menos recuperados menos óbitos. Uma combinação manual de país, estado, cidade, doença e data não pode ser cadastrada duas vezes. Países, cidades e doenças devem ser escritos de forma consistente.

No modo demonstração, há snapshots fictícios de duas datas para visualizar as variações. Na base real, é necessário cadastrar ou importar datas anteriores. Uma fonte que repete o mesmo snapshot não gera variação nova.

Os pontos indicam registros agregados, não contaminação de toda uma área. O painel não faz inferência de risco clínico. Não cadastre dados pessoais de pacientes.

## Banco e API

H2 em arquivo, salvo em `%USERPROFILE%/.atlas-health/atlas.mv.db`. O banco fica fora da pasta OneDrive para evitar problemas com sincronização e gravação. Os dados sobrevivem a reinicializações. Faça backup do diretório `%USERPROFILE%/.atlas-health` com o servidor parado. O H2 permite testar sem instalar PostgreSQL. Para uso com vários usuários, migrar para PostgreSQL, configurar migrações, gestão de usuários e permissões, HTTPS e backups.

O servidor fica limitado a `127.0.0.1:8085`. A interface usa o proxy `/api` do Vite. O login é obrigatório apenas para administrar. O aplicativo continua destinado ao uso local; uma publicação deve usar HTTPS e cookie Secure.

| Método | Rota | Finalidade |
|---|---|---|
| GET | /api/health | Estado do servidor |
| GET | /api/records | Listar registros |
| POST | /api/records | Cadastrar dados agregados |
| DELETE | /api/records/{id} | Excluir registro |
| POST | /api/imports/covid | Importar totais de países |

Exemplo de cadastro:

```json
{"country":"Brasil","city":"São Paulo","virus":"COVID-19","latitude":-23.55,"longitude":-46.63,"cases":100,"recovered":80,"deaths":2,"date":"2026-01-01"}
```

## Verificação

```powershell
cd frontend
npm run build
node scripts/check-analytics.mjs
```

```powershell
cd backend
mvn test
mvn package
```

Validação realizada: build React no Node 14.21.3 e testes Java de registros e autenticação. Os testes cobrem cadastro e consulta via API, duplicidade, totais inconsistentes, coordenadas obrigatórias, contagens fracionárias, exclusão e importação transacional sem duplicação.

## Fontes e recursos

- Fonte externa opcional: [disease.sh](https://disease.sh/docs/). Nenhuma importação é executada automaticamente.
- Geografia: `frontend/public/countries-110m.json`, [world-atlas 2.0.2](https://github.com/topojson/world-atlas), derivado de Natural Earth (domínio público).
- Ícones: Lucide (ISC). Fontes DM Sans e Space Grotesk via Google Fonts, com fontes locais de fallback.
- Texturas da Terra (superfície, relevo, reflexo e nuvens): [exemplos do Three.js r149](https://github.com/mrdoob/three.js/tree/r149/examples/textures/planets), distribuídas localmente em `frontend/public/textures`. O globo inclui iluminação direcional, atmosfera, nuvens em movimento e estrelas.
- O globo usa Three.js; geometria geográfica é distribuída localmente, sem depender de um serviço de mapas durante a execução.

Ainda não inclui séries históricas com gráficos de evolução, edição de registros, vacinação, recuperação de senha, gestão de usuários nem integração com outras fontes epidemiológicas.

A fonte disease.sh fornece totais por país. Dados por estado e cidade precisam ser cadastrados pelo proprietário ou integrados a uma fonte que ofereça esse detalhamento; o sistema não infere cidades a partir de totais nacionais.

## Importação de doenças e eventos (JSON)

O proprietário entra em **Área do proprietário → Importação e fontes**. Não há credenciais padrão: na primeira configuração, defina seu próprio nome, e-mail e senha. A home permanece pública.

Você pode cadastrar cada local por **Novo registro** ou importar um arquivo JSON. Use **Baixar modelo JSON**, substitua os dados fictícios, selecione o arquivo e informe o nome da fonte/boletim. **Validar e visualizar** não grava dados. Confira a prévia e use **Publicar no globo** para gravar todos os registros em uma transação. Depois, consulte-os na home pública.

O arquivo pode ser um objeto com `source` e `records`, como em `examples/importacao-modelo.json`, ou um array de registros com a fonte preenchida no formulário. A interface aceita até 2 MB e o backend aceita até 2.000 registros por lote.

Campos por registro: `country`, `city`, `virus`, `latitude`, `longitude`, `cases`, `recovered`, `deaths` e `date` (AAAA-MM-DD) são obrigatórios. `state` é opcional; `classification` é opcional e aceita `Doença`, `Surto`, `Epidemia` ou `Pandemia`, com padrão `Doença`. A classificação é declarada pela fonte ou pelo proprietário; nunca é calculada a partir da contagem de casos.

Reimportar a mesma fonte, país, estado, cidade, doença e data atualiza o snapshot. Datas anteriores e fontes diferentes são preservadas. Linhas inválidas ou duplicadas dentro do lote rejeitam a importação inteira. Fontes distintas podem se sobrepor e não representam pessoas únicas ao serem somadas.

Endpoints protegidos por login do proprietário e CSRF: `POST /api/imports/preview` e `POST /api/imports/json`, ambos recebem `{source, records}`. Esse contrato é a entrada para futuros adaptadores de API. Esta alteração não cria uma conexão automática com uma API genérica. A integração COVID-19 existente continua opcional.

Validação da implementação: 18 testes Java aprovados, incluindo prévia sem gravação, reimportação, classificação, preservação de fontes, rejeição integral de lotes inválidos e restrições de acesso.

## Idiomas

A interface oferece Português, English e Deutsch no seletor do topo da home e da tela de acesso. A preferência é salva neste navegador. Datas, números, percentuais, formulários e mensagens acompanham o idioma escolhido. Nomes de doenças, locais e fontes são preservados. As chaves JSON e os valores de classificação do contrato de importação continuam os mesmos, independentemente do idioma da interface.

Verificação das traduções: `node scripts/check-i18n.mjs` na pasta `frontend`.

## Notícias e atualização automática

A home pública consulta `/api/news` e exibe até 30 comunicados recentes da OMS (WHO Disease Outbreak News), com título original, fonte, data e link oficial. A busca é textual nos títulos globais e independente dos filtros do globo; não faz classificação geográfica automática. O backend sincroniza a OMS na inicialização e depois a cada 30 minutos. O cache e as preferências ficam no H2; falhas preservam os dados anteriores e a última sincronização bem-sucedida.

Em **Área do proprietário → Importação e fontes → Atualizações automáticas**, é possível pausar a OMS, buscar notícias imediatamente e habilitar a importação de COVID-19 da disease.sh a cada 6 horas (desativada por padrão). O agendador verifica tarefas vencidas a cada minuto e tenta novamente após 30 minutos em caso de falha. O backend precisa permanecer em execução. A home consulta alterações dos registros a cada minuto e notícias a cada 5 minutos, preservando os filtros.

Notícias não geram contagens de casos. A integração numérica atual cobre somente totais nacionais de COVID-19, preservando a data informada pelo provedor. Outras doenças e dados estaduais/municipais dependem de cadastro, importação JSON ou novos adaptadores estruturados. O sistema não infere casos confirmados, recuperados, coordenadas ou classificação epidemiológica de manchetes. Os comunicados podem falar de suspeitas ou eventos sem risco de epidemia.

API: `GET /api/news` é público. `GET /api/feeds`, `PUT /api/feeds` (`{who: boolean, covid: boolean}`) e `POST /api/feeds/news/refresh` exigem proprietário; mutações exigem CSRF. Fontes externas são fixas (OMS e disease.sh), sem URLs arbitrárias fornecidas pelos visitantes. Reinicie o backend para carregar esta funcionalidade.

Referência oficial da API de comunicados: https://www.who.int/api/emergencies/diseaseoutbreaknews/sfhelp

## Vigilância numérica por fontes oficiais

A home abre em **Dados oficiais**, separada da **Base cadastrada**. O visitante escolhe uma fonte, doença e período; as consultas não somam fontes sobrepostas, anos distintos ou notificações e estimativas. Dados ausentes aparecem como travessão; zero só aparece quando a fonte informa zero. Recuperados, óbitos e casos ativos não são calculados a partir de notificações.

- **OMS / GHO**: `WHS3_62` (sarampo), `WHS3_43` (coqueluche) e `WHS3_41` (difteria). Consulta diária; três anos anteriores completos, totais nacionais anuais, somente dimensão COUNTRY e sem estratificações adicionais. Valores nulos/países sem referência geográfica são omitidos, não convertidos em zero. Anos históricos não são dados em tempo real.
- **InfoDengue**: API pública direta `https://info.dengue.mat.br/api/alertcity`, sem depender da chave exigida pelo Mosqlimate. Dengue, chikungunya e zika; seis municípios iniciais: São Paulo, Rio de Janeiro, Belo Horizonte, Curitiba, Fortaleza e Brasília. Consulta a cada 12 horas para ano corrente e anterior. Usa `casos` (notificações), nunca `casos_est` (estimativa); semanas são preliminares e revisáveis. Somente Localidade_id=0 para evitar somar subdivisões com o total municipal. A cobertura não representa todos os municípios brasileiros.
- **Ministério da Saúde / SINAN**: integração numérica **pendente**. A API oficial encerrou a conexão nesta máquina e sua resposta/paginação não pôde ser validada. Há somente monitoramento de conectividade e status explícito de indisponibilidade; não há importador SINAN implementado. Mesmo se a conexão voltar, o contrato precisa ser validado e o adaptador implementado antes da publicação de números. InfoDengue já utiliza notificações do SINAN: essas fontes não deverão ser somadas.

As duas fontes numéricas operacionais são habilitadas por padrão e consultadas após iniciar o backend. SINAN também tem monitoramento habilitado. Falhas tentam novamente após 30 minutos, preservando cache e última sincronização bem-sucedida. O proprietário pode sincronizar ou pausar cada fonte em Dados oficiais. As consultas externas rodam numa fila em segundo plano, sem bloquear a home. Cada lote validado é publicado atomicamente e reimportações atualizam a mesma observação por fonte/local/doença/período. A home lê o cache a cada 30 segundos.

API pública `GET /api/surveillance?source=gho|infodengue|sinan`. Controles do proprietário com CSRF: `PUT /api/surveillance/{source}` com `{enabled: boolean}` e `POST /api/surveillance/{source}/refresh` (202, enfileirado). Nenhuma chave nem URL arbitrária é recebida dos visitantes.

Localização de países: `country-locations.json`, metadados públicos do Banco Mundial obtidos de `https://api.worldbank.org/v2/country?format=json&per_page=400`. São 208 referências de países/territórios com coordenadas de capital, usadas como marcadores nacionais, não como localização de surtos municipais.

Reinicie AtlasApplication para carregar os conectores e aguarde a primeira sincronização. Testes cobrem períodos, notificações versus estimativas, ausência versus zero, revisão sem duplicação, preservação após falha, agendamento e permissões.
