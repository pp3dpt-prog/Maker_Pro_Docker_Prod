-- Marcadores de copo — bailarina: generation_schema (2026-11-14).
-- A linha (com o template templates/marcador_copo_bailarina.scad, md5 63359c4d5a2b86e1968b38dead5fd323)
-- foi criada em rascunho na família Decoração, com as mesmas flags dos outros marcadores
-- (acesso gratuito, 1 crédito, CC-BY-NC). Silhueta desenhada de raiz (não é cópia de nenhuma imagem).
-- Para publicar: miniatura (Admin → Miniaturas) e estado = 'ativo'.
with pal as (
  select jsonb_agg(jsonb_build_object('hex', h, 'nome', n) order by o) p
  from (values (1,'#111111','Preto'),(2,'#FFFFFF','Branco'),(3,'#9CA3AF','Cinzento'),
               (4,'#E0A526','Dourado'),(5,'#C0C0C0','Prateado'),(6,'#DC2626','Vermelho'),
               (7,'#F97316','Laranja'),(8,'#FACC15','Amarelo'),(9,'#16A34A','Verde'),
               (10,'#38BDF8','Azul claro'),(11,'#1E3A8A','Azul'),(12,'#7C3AED','Roxo'),
               (13,'#F472B6','Rosa')) v(o,h,n)
),
nomes as (
  select jsonb_object_agg('nome_'||i, jsonb_build_object(
           'ui', jsonb_build_object('label','Nome '||i,'widget','text','maxLength',16,
                   'visible_when', jsonb_build_object('palco', jsonb_build_object('eq','Nome em relevo'))
                     || case when i > 1 then jsonb_build_object('quantidade', jsonb_build_object('min', i)) else '{}'::jsonb end),
           'order', 1 + i/100.0,
           'default', coalesce((array['Marina','Leonor','Beatriz','Sofia','Inês','Matilde'])[i], ''))) j
  from generate_series(1,12) i
),
params as (
  select jsonb_build_object(
    'marcador',   jsonb_build_object('ui', jsonb_build_object('widget','hidden'), 'order', 0, 'default', 'copo_bailarina'),
    'quantidade', jsonb_build_object('ui', jsonb_build_object('label','Quantos marcadores','widget','slider','step',1), 'min',1,'max',12,'type','number','order',1,'default',6),
    'palco',      jsonb_build_object('ui', jsonb_build_object('label','Palco','widget','select','options', jsonb_build_array('Nome em relevo','Rebaixo para etiqueta')), 'order',0.5,'default','Nome em relevo'),
    'fita',       jsonb_build_object('ui', jsonb_build_object('label','Largura da etiqueta (fita de etiquetadora: 6, 9 ou 12 mm)','widget','slider','step',3,
                    'visible_when', jsonb_build_object('palco', jsonb_build_object('eq','Rebaixo para etiqueta'))), 'min',6,'max',12,'type','number','unit','mm','order',2.5,'default',9),
    'fonte',      jsonb_build_object('ui', jsonb_build_object('label','Tipo de letra','widget','select','options', jsonb_build_array(
                    'Pacifico','Lobster','Luckiest Guy','Chewy','Baloo 2','Sigmar One','Anton','Oswald','Racing Sans One','Aladin','Amarante','Gloria Hallelujah','Benne','Press Start 2P','Open Sans'),
                    'visible_when', jsonb_build_object('palco', jsonb_build_object('eq','Nome em relevo'))),
                    'order',2,'default','Pacifico'),
    'tamanho_nome', jsonb_build_object('ui', jsonb_build_object('label','Tamanho das letras','widget','slider','step',0.5,
                    'visible_when', jsonb_build_object('palco', jsonb_build_object('eq','Nome em relevo'))), 'min',4,'max',12,'type','number','unit','mm','order',3,'default',7),
    'largura',      jsonb_build_object('ui', jsonb_build_object('label','Largura do palco (os nomes compridos encolhem)','widget','slider','step',1), 'min',30,'max',80,'type','number','unit','mm','order',4,'default',44),
    'altura_figura', jsonb_build_object('ui', jsonb_build_object('label','Altura da bailarina (dos pés à borda do copo)','widget','slider','step',1), 'min',45,'max',90,'type','number','unit','mm','order',5,'default',62),
    'espessura',    jsonb_build_object('ui', jsonb_build_object('label','Espessura da peça','widget','slider','step',0.2), 'min',2.4,'max',5,'type','number','unit','mm','order',6,'default',3),
    'espessura_vidro', jsonb_build_object('ui', jsonb_build_object('label','Espessura do vidro na borda do copo','widget','slider','step',0.1), 'min',1,'max',6,'type','number','unit','mm','order',7,'default',2.5),
    'afastamento',  jsonb_build_object('ui', jsonb_build_object('label','Afastamento do copo (aumenta para taças com barriga)','widget','slider','step',0.5), 'min',0,'max',15,'type','number','unit','mm','order',8,'default',2),
    'impressao',  jsonb_build_object('ui', jsonb_build_object('label','Impressora','widget','select','options', jsonb_build_array('AMS (3MF multicor)','Sem AMS (troca de cor manual)')), 'order',20,'default','AMS (3MF multicor)'),
    'cor_corpo',  jsonb_build_object('ui', jsonb_build_object('label','Cor da bailarina e do palco','widget','color','paleta',(select p from pal)), 'order',21,'default','#111111'),
    'cor_nome',   jsonb_build_object('ui', jsonb_build_object('label','Cor do nome','widget','color','paleta',(select p from pal),
                    'visible_when', jsonb_build_object('palco', jsonb_build_object('eq','Nome em relevo'))), 'order',22,'default','#F472B6'),
    'info_marcadores', jsonb_build_object('ui', jsonb_build_object('widget','info','text',
       '🩰 Marcadores de copo em forma de bailarina: a mão erguida curva-se num gancho que passa por cima da borda do copo, com uma perna curta por dentro a apertar o vidro — ela fica a "segurar" o copo, espetada para fora. A perna de fora do gancho desce até ao palco, como uma barra de ballet, e deixa a peça rija. Aos pés, um palco com o nome em relevo noutra cor, ou liso com um rebaixo para colar uma etiqueta (fita de etiquetadora de 6, 9 ou 12 mm, ou papel cortado à medida) — dá para imprimir um lote sem nomes e escrevê-los na hora. Imprime-se deitada, sem suportes. Mede a espessura do vidro na borda; em taças com barriga aumenta o afastamento.'),
       'order',99,'default',null)
  ) || (select j from nomes) j
)
update prod_designs set generation_schema = jsonb_build_object(
  'engine', 'openscad', 'version', 1,
  'preview_servidor', true, 'preview_por_partes', true,
  'parameters', (select j from params),
  'multicor', jsonb_build_object(
     'partes', jsonb_build_array(
        jsonb_build_object('modo','corpo','nome','Bailarinas e palcos','cor_param','cor_corpo'),
        jsonb_build_object('modo','nome','nome','Nomes','cor_param','cor_nome','so_quando', jsonb_build_object('palco','Nome em relevo'))),
     'agrupar_por_cor', true,
     'param_impressao', 'impressao',
     'troca_cor_param', 'espessura',
     'texto_sem_ams', jsonb_build_array(
        'Impressão sem AMS (deitada, sem suportes):',
        '  Com o nome em relevo: começa na cor da bailarina e põe uma troca de filamento',
        '  (Color Change / Pause / M600) no início da primeira camada acima da espessura da peça',
        '  (3 mm por omissão) — só o nome está acima dessa altura.',
        '  Com o rebaixo para etiqueta: é tudo numa cor, não há troca de filamento; cola a etiqueta',
        '  no rebaixo do palco.',
        '  Encaixa o gancho na borda do copo com a perna curta por dentro.')),
  'ajuste_texto', jsonb_build_object(
     'campos', (select jsonb_agg('nome_'||i order by i) from generate_series(1,12) i),
     'largura_util', 44, 'largura_util_param', 'largura', 'largura_util_margem', 6,
     'tamanho_param_por_campo', (select jsonb_object_agg('nome_'||i, 'tamanho_nome') from generate_series(1,12) i))
)
where id = 'marcador_copo_bailarina';
