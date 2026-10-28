-- =====================================================================
-- Manyam Foods: starting data (run after schema.sql)
-- =====================================================================

-- 1) WHO IS ADMIN: replace with the Google account email(s) that manage the shop
insert into public.admins (email) values
  ('REPLACE_WITH_ADMIN_EMAIL@gmail.com');

-- 2) Shop settings
insert into public.settings (id, upi_id, upi_payee_name, whatsapp_number, delivery_fee, free_delivery_above)
values (1, 'msowjikrishna2003@okicici', 'Manyam Foods', '917207021603', 60, 499);

-- 3) Coupons (same as the old website)
insert into public.coupons (code, kind, value, min_order) values
  ('MANYAM10', 'percent', 10, 0),
  ('FIRST50',  'flat',    50, 0);

-- 4) Products and their weight/price options
create function pg_temp.add_product(
  p_name text, p_desc text, p_cat text, p_badge text, p_hot boolean,
  p_img text, p_featured boolean, p_sort int, p_variants jsonb
) returns void language plpgsql as $$
declare
  v_pid uuid;
  v jsonb;
  i int := 0;
begin
  insert into public.products (name, description, category, badge, badge_hot, image_url, featured, sort_order)
  values (p_name, p_desc, p_cat, p_badge, p_hot, p_img, p_featured, p_sort)
  returning id into v_pid;

  for v in select * from jsonb_array_elements(p_variants) loop
    i := i + 1;
    insert into public.product_variants (product_id, label, price, sort_order)
    values (v_pid, v ->> 0, (v ->> 1)::int, i);
  end loop;
end $$;

select pg_temp.add_product('Millet Crunch', 'No refined sugar. Just Millet, Jaggery, and Pure Joy.', 'snacks', 'Best Seller', true,
  'images/millet crunch.jpeg', true, 1, '[["250g",199],["500g",349],["1 kg",599]]');
select pg_temp.add_product('Turmeric Powder', 'One pinch, infinite aroma. Taste the stone-ground difference.', 'powders', 'Pure', false,
  'images/turmeric.jpeg', true, 2, '[["100g",149],["250g",249],["500g",449]]');
select pg_temp.add_product('Horse Gram Powder', 'The ancient secret to a leaner, fitter you.', 'powders', 'Protein Rich', false,
  'images/powder.jpeg', true, 3, '[["250g",179],["500g",329],["1 kg",579]]');
select pg_temp.add_product('Golden Shield', 'Your daily armor in a single spoonful of golden goodness.', 'powders', 'Immunity', true,
  'images/golden.jpeg', true, 4, '[["100g",299],["200g",549],["500g",999]]');
select pg_temp.add_product('Foxtail Millet', 'Nutritious ancient grain, sun-dried and stone-cleaned for purity.', 'millets', 'Whole Grain', false,
  'images/products/foxtail-millet.webp', false, 5, '[["500g",129],["1 kg",229],["2 kg",419]]');
select pg_temp.add_product('Finger Millet Flour (Ragi)', 'Stone-ground ragi flour — the superfood your family needs daily.', 'millets', 'Calcium Rich', false,
  'images/products/ragi-flour.webp', false, 6, '[["500g",149],["1 kg",269],["2 kg",499]]');
select pg_temp.add_product('Cold Pressed Groundnut Oil', 'Wooden-churner extracted — maximum flavor, zero chemicals.', 'oils', 'Cold Pressed', true,
  'images/products/groundnut-oil.webp', false, 7, '[["500ml",349],["1 L",649],["2 L",1199]]');
select pg_temp.add_product('Pure Cow Ghee (A2)', 'Bilona-churned from desi cow curd — rich, aromatic, nourishing.', 'oils', 'A2 Ghee', false,
  'images/products/ghee.webp', false, 8, '[["250g",499],["500g",899],["1 kg",1699]]');
select pg_temp.add_product('Raw Mango Pickle', 'Sun-pickled in traditional stone jars — grandma''s recipe, preserved.', 'pickles', 'Tangy', true,
  'images/products/mango-pickle.webp', false, 9, '[["250g",199],["500g",369],["1 kg",699]]');
select pg_temp.add_product('Gongura Pickle', 'Fiery sorrel leaves slow-cooked with sesame and mustard.', 'pickles', 'Andhra Special', false,
  'images/products/gongura-pickle.webp', false, 10, '[["250g",219],["500g",399],["1 kg",749]]');
select pg_temp.add_product('Red Chilli Powder', 'Sun-dried Guntur chillies, stone-ground for real heat and color.', 'powders', 'Fiery', true,
  'images/products/red-chilli-powder.webp', false, 11, '[["100g",129],["250g",229],["500g",399]]');
select pg_temp.add_product('Coriander Powder', 'Slow-roasted and freshly ground — brightens every curry.', 'powders', 'Aromatic', false,
  'images/products/coriander-powder.webp', false, 12, '[["100g",99],["250g",179],["500g",329]]');
select pg_temp.add_product('Jaggery Millet Laddoo', 'Hand-rolled energy balls with millets and forest jaggery.', 'snacks', 'No Preservatives', false,
  'images/products/millet-laddoo.webp', false, 13, '[["250g",249],["500g",459],["1 kg",849]]');
select pg_temp.add_product('Pearl Millet (Bajra) Flour', 'Iron-rich bajra flour, stone-ground fresh — perfect for rotis.', 'millets', 'Bajra', false,
  'images/products/bajra-flour.webp', false, 14, '[["500g",119],["1 kg",219],["2 kg",399]]');
select pg_temp.add_product('Cold Pressed Sesame Oil', 'Gingelly oil with deep nutty aroma — traditional south Indian goodness.', 'oils', 'Cold Pressed', false,
  'images/products/sesame-oil.webp', false, 15, '[["250ml",299],["500ml",549],["1 L",999]]');
select pg_temp.add_product('Tamarind Paste', 'Pure tamarind pulp, hand-processed from forest-harvested pods.', 'pickles', 'No Additives', false,
  'images/products/tamarind-paste.webp', false, 16, '[["200g",149],["400g",279],["800g",499]]');
