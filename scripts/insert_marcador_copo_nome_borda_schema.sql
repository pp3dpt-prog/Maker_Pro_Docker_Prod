-- Marcadores de copo — nome na borda: generation_schema (2026-11-14).
-- A linha (com o template templates/marcador_copo_nome_borda.scad, md5 caeb585a6e8393cca0c032af37de8f5c)
-- foi criada em rascunho na família Decoração, com as mesmas flags dos outros marcadores
-- (acesso gratuito, 1 crédito, CC-BY-NC). Precisa de lib/textFit.js com "maiusculas_param".
-- Para publicar: miniatura (Admin → Miniaturas) e estado = 'ativo'.
with pal as (
  select jsonb_agg(jsonb_build_object('hex', h, 'nome', n) order by o) p
  from (values (1,'#FFFFFF','Branco'),(2,'#111111','Preto'),(3,'#9CA3AF','Cinzento'),
               (4,'#E0A526','Dourado'),(5,'#DC2626','Vermelho'),(6,'#F97316','Laranja'),
               (7,'#FACC15','Amarelo'),(8,'#16A34A','Verde'),(9,'#38BDF8','Azul claro'),
               (10,'#1E3A8A','Azul'),(11,'#7C3AED','Roxo'),(12,'#F472B6','Rosa')) v(o,h,n)
),
nomes as (
  select jsonb_object_agg('nome_'||i, jsonb_build_object(
           'ui', jsonb_build_object('label','Nome '||i,'widget','text','maxLength',14)
                 || case when i > 1 then jsonb_build_object('visible_when', jsonb_build_object('quantidade', jsonb_build_object('min', i))) else '{}'::jsonb end,
           'order', 1 + i/100.0,
           'default', coalesce((array['ANA','RITA','TIAGO','SOFIA','MARINA','JOÃO'])[i], ''))) j
  from generate_series(1,12) i
),
params as (
  select jsonb_build_object(
    'marcador',   jsonb_build_object('ui', jsonb_build_object('widget','hidden'), 'order', 0, 'default', 'copo_borda'),
    'quantidade', jsonb_build_object('ui', jsonb_build_object('label','Quantos marcadores','widget','slider','step',1), 'min',1,'max',12,'type','number','order',1,'default',6),
    'maiusculas', jsonb_build_object('ui', jsonb_build_object('label','Só maiúsculas (recomendado: os pontos e acentos das minúsculas saem soltos)','widget','select','options', jsonb_build_array('Sim','Não')), 'order',2,'default','Sim'),
    'fonte',      jsonb_build_object('ui', jsonb_build_object('label','Tipo de letra','widget','select','options', jsonb_build_array(
                    'Luckiest Guy','Anton','Sigmar One','Oswald','Racing Sans One','Baloo 2','Chewy','Pacifico','Lobster','Aladin','Amarante','Press Start 2P','Open Sans')),
                    'order',3,'default','Luckiest Guy'),
    'tamanho_nome', jsonb_build_object('ui', jsonb_build_object('label','Tamanho das letras','widget','slider','step',0.5), 'min',5,'max',16,'type','number','unit','mm','order',4,'default',8),
    'largura',      jsonb_build_object('ui', jsonb_build_object('label','Largura máxima do nome (os nomes compridos encolhem)','widget','slider','step',1), 'min',25,'max',80,'type','number','unit','mm','order',5,'default',45),
    'espessura',    jsonb_build_object('ui', jsonb_build_object('label','Espessura da peça','widget','slider','step',0.2), 'min',2,'max',5,'type','number','unit','mm','order',6,'default',3),
    'espessura_vidro', jsonb_build_object('ui', jsonb_build_object('label','Espessura do vidro na borda do copo','widget','slider','step',0.1), 'min',1,'max',6,'type','number','unit','mm','order',7,'default',2.5),
    'impressao',  jsonb_build_object('ui', jsonb_build_object('label','Impressora','widget','select','options', jsonb_build_array('AMS (3MF multicor)','Sem AMS (uma cor)')), 'order',20,'default','AMS (3MF multicor)'),
    'cor_corpo',  jsonb_build_object('ui', jsonb_build_object('label','Cor da barra e do gancho','widget','color','paleta',(select p from pal)), 'order',21,'default','#FFFFFF'),
    'cor_nome',   jsonb_build_object('ui', jsonb_build_object('label','Cor do nome','widget','color','paleta',(select p from pal),
                    'visible_when', jsonb_build_object('impressao', jsonb_build_object('eq','AMS (3MF multicor)'))), 'order',22,'default','#FFFFFF'),
    'info_marcadores', jsonb_build_object('ui', jsonb_build_object('widget','info','text',
       '🥂 Marcadores de copo com o nome em pé: a barra com o nome fica por fora do copo, o gancho em "U" passa por cima da borda e a perna curta aperta o vidro por dentro — o nome fica espetado para fora, como uma barbatana. Imprime-se deitado, numa só peça e sem suportes. Mede a espessura do vidro na borda e acerta o valor. Os acentos das maiúsculas ficam agarrados à letra; com minúsculas, os pontos dos "i" e os acentos saem soltos, por isso está ligado "Só maiúsculas". Com AMS podes ter o nome noutra cor (3MF com uma peça por cor).'),
       'order',99,'default',null)
  ) || (select j from nomes) j
)
update prod_designs set generation_schema = jsonb_build_object(
  'engine', 'openscad', 'version', 1,
  'preview_servidor', true, 'preview_por_partes', true,
  'parameters', (select j from params),
  'multicor', jsonb_build_object(
     'partes', jsonb_build_array(
        jsonb_build_object('modo','corpo','nome','Barras e ganchos','cor_param','cor_corpo'),
        jsonb_build_object('modo','nome','nome','Nomes','cor_param','cor_nome')),
     'agrupar_por_cor', true,
     'param_impressao', 'impressao',
     'sem_ams_ficheiros', jsonb_build_array(jsonb_build_object('nome','marcadores_copo.stl','params', jsonb_build_object('modo','uma_peca'))),
     'texto_sem_ams', jsonb_build_array(
        'Impressão sem AMS:',
        '  marcadores_copo.stl — os marcadores inteiros numa só cor, deitados e sem suportes.',
        '  Encaixa o gancho na borda do copo com a perna curta por dentro.')),
  'ajuste_texto', jsonb_build_object(
     'campos', (select jsonb_agg('nome_'||i order by i) from generate_series(1,12) i),
     'largura_util', 45, 'largura_util_param', 'largura', 'largura_util_margem', 0,
     'maiusculas_param', 'maiusculas',
     'tamanho_param_por_campo', (select jsonb_object_agg('nome_'||i, 'tamanho_nome') from generate_series(1,12) i))
)
where id = 'marcador_copo_nome_borda';
