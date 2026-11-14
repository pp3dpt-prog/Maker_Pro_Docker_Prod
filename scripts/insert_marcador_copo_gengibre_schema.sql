-- Marcadores de copo — boneco de gengibre: generation_schema (2026-11-14).
-- Corre depois de insert_marcador_copo_gengibre.sql (que cria a linha com o template).
-- O schema é montado aqui em SQL para não repetir 10 vezes a mesma paleta.
with pal as (
  select jsonb_agg(jsonb_build_object('hex', h, 'nome', n) order by o) p
  from (values (1,'#6B3A1E','Castanho escuro'),(2,'#C8915A','Gengibre'),(3,'#FFFFFF','Branco'),
               (4,'#111111','Preto'),(5,'#9CA3AF','Cinzento'),(6,'#DC2626','Vermelho'),
               (7,'#F97316','Laranja'),(8,'#FACC15','Amarelo'),(9,'#16A34A','Verde'),
               (10,'#38BDF8','Azul claro'),(11,'#1E3A8A','Azul'),(12,'#7C3AED','Roxo'),
               (13,'#F472B6','Rosa')) v(o,h,n)
),
lacos as (select i, (array['#16A34A','#DC2626','#FACC15','#7C3AED','#1E3A8A','#F472B6','#F97316','#38BDF8'])[i] cor
          from generate_series(1,8) i),
nomes as (
  select jsonb_object_agg('nome_'||i, jsonb_build_object(
           'ui', jsonb_build_object('label','Nome '||i||' (opcional, na barriga)','widget','text','maxLength',10)
                 || case when i > 1 then jsonb_build_object('visible_when', jsonb_build_object('quantidade', jsonb_build_object('min', i))) else '{}'::jsonb end,
           'order', 1 + i/10.0, 'default', '')) j
  from generate_series(1,8) i
),
cores_laco as (
  select jsonb_object_agg('cor_laco_'||i, jsonb_build_object(
           'ui', jsonb_build_object('label','Cor do laço '||i,'widget','color','paleta',(select p from pal))
                 || case when i > 1 then jsonb_build_object('visible_when', jsonb_build_object('quantidade', jsonb_build_object('min', i))) else '{}'::jsonb end,
           'order', 22 + i/10.0, 'default', cor)) j
  from lacos
),
params as (
  select jsonb_build_object(
    'marcador',   jsonb_build_object('ui', jsonb_build_object('widget','hidden'), 'order', 0, 'default', 'copo_gengibre'),
    'quantidade', jsonb_build_object('ui', jsonb_build_object('label','Quantos marcadores','widget','slider','step',1), 'min',1,'max',8,'type','number','order',1,'default',4),
    'fonte',      jsonb_build_object('ui', jsonb_build_object('label','Tipo de letra do nome','widget','select','options', jsonb_build_array('Luckiest Guy','Chewy','Baloo 2','Sigmar One','Open Sans')), 'order',2,'default','Luckiest Guy'),
    'altura_boneco', jsonb_build_object('ui', jsonb_build_object('label','Altura do boneco','widget','slider','step',1), 'min',28,'max',55,'type','number','unit','mm','order',3,'default',38),
    'diametro_pe',   jsonb_build_object('ui', jsonb_build_object('label','Diâmetro do pé do copo (onde prende a argola)','widget','slider','step',0.5), 'min',4,'max',14,'type','number','unit','mm','order',4,'default',8),
    'espessura',     jsonb_build_object('ui', jsonb_build_object('label','Espessura do boneco','widget','slider','step',0.2), 'min',2.4,'max',4,'type','number','unit','mm','order',5,'default',3),
    'folga',         jsonb_build_object('ui', jsonb_build_object('label','Folga do encaixe do laço (aumenta se ficar apertado)','widget','slider','step',0.05), 'min',0.05,'max',0.5,'type','number','unit','mm','order',6,'default',0.2),
    'impressao',     jsonb_build_object('ui', jsonb_build_object('label','Impressora','widget','select','options', jsonb_build_array('AMS (3MF multicor)','Sem AMS (troca de cor manual)')), 'order',20,'default','AMS (3MF multicor)'),
    'cor_corpo',     jsonb_build_object('ui', jsonb_build_object('label','Cor do boneco','widget','color','paleta',(select p from pal)), 'order',21,'default','#C8915A'),
    'cor_cobertura', jsonb_build_object('ui', jsonb_build_object('label','Cor da cobertura (cara, linhas e nome)','widget','color','paleta',(select p from pal)), 'order',22,'default','#FFFFFF'),
    'info_marcadores', jsonb_build_object('ui', jsonb_build_object('widget','info','text',
       '🍪 Marcadores de copo em forma de boneco de gengibre: a argola na mão prende no pé do copo e cada boneco leva um laço de cor diferente para se saber de quem é o copo. O laço imprime-se à parte (com o encaixe virado para a mesa), encaixa na saliência do pescoço e cola-se com uma gota de cola. Mede o pé do copo e acerta o diâmetro. Nome opcional na barriga (nomes curtos; encolhem para caber). Com AMS recebes um 3MF com uma peça por cor; sem AMS recebes os bonecos (troca de filamento no fim do corpo) e um STL por laço.'),
       'order',99,'default',null)
  ) || (select j from nomes) || (select j from cores_laco) j
),
multicor as (
  select jsonb_build_object(
    'partes', jsonb_build_array(
        jsonb_build_object('modo','corpo','nome','Bonecos','cor_param','cor_corpo'),
        jsonb_build_object('modo','cobertura','nome','Cobertura','cor_param','cor_cobertura'))
      || (select jsonb_agg(jsonb_build_object('modo','laco_'||i,'nome','Laço '||i,'cor_param','cor_laco_'||i,
                                              'min_param', jsonb_build_object('quantidade', i)) order by i) from lacos),
    'agrupar_por_cor', true,
    'param_impressao', 'impressao',
    'troca_cor_param', 'espessura',
    'sem_ams_ficheiros', jsonb_build_array(jsonb_build_object('nome','bonecos.stl','params', jsonb_build_object('modo','uma_peca')))
      || (select jsonb_agg(jsonb_build_object('nome','laco_'||i||'.stl','params', jsonb_build_object('modo','laco_'||i),
                                              'min_param', jsonb_build_object('quantidade', i)) order by i) from lacos),
    'texto_sem_ams', jsonb_build_array(
      'Impressão sem AMS:',
      '  bonecos.stl — os bonecos com a cobertura em relevo. Começa na cor do boneco e põe uma',
      '  troca de filamento (Color Change / Pause / M600) no início da primeira camada acima da',
      '  espessura do boneco (3 mm por omissão) para a cara, as linhas e o nome saírem noutra cor.',
      '  A saliência do pescoço também fica dessa cor — não faz mal, fica escondida pelo laço.',
      '  laco_1.stl, laco_2.stl, … — um laço por marcador, cada um na sua cor, com o encaixe',
      '  virado para a mesa (já vêm assim). Encaixa cada laço na saliência e cola com uma gota de cola.')
  ) j
)
update prod_designs set generation_schema = jsonb_build_object(
  'engine', 'openscad', 'version', 1,
  'preview_servidor', true, 'preview_por_partes', true,
  'parameters', (select j from params),
  'multicor', (select j from multicor),
  'ajuste_texto', jsonb_build_object(
     'campos', (select jsonb_agg('nome_'||i order by i) from generate_series(1,8) i),
     'largura_util', 11,
     'tamanho_por_campo', (select jsonb_object_agg('nome_'||i, 3.2) from generate_series(1,8) i))
)
where id = 'marcador_copo_gengibre';
