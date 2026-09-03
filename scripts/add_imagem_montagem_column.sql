-- Adiciona uma coluna opcional para uma segunda imagem por design: uma foto/render
-- explicativo (ex: vista explodida a mostrar como as peças encaixam), distinta da
-- thumbnail_url (que é o cartão principal da família em /produtos e /makers).
-- SQL editor do Supabase.

ALTER TABLE prod_designs
  ADD COLUMN IF NOT EXISTS imagem_montagem_url text;
