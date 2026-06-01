-- ============================================================================
-- XL TRADERS — 2-LEVEL CATEGORY MIGRATION + CATEGORY IMAGES
-- Supabase > SQL Editor me paste -> RUN. Safe to re-run. Products todega nahi.
-- ============================================================================
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS group_name  TEXT;
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS group_order INTEGER DEFAULT 0;
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS image_url   TEXT;  -- emoji ki jagah image


-- ===== GROUP 1: Food Containers =====
INSERT INTO public.categories (name, slug, icon_emoji, image_url, group_name, group_order, display_order, is_active)
VALUES ('Round Container','round-container','🥣','https://drive.google.com/thumbnail?id=1QeDLdtIDQXJ8EexCg6acIAEewIVGfD3o&sz=w800','Food Containers',1,1,TRUE)
ON CONFLICT (name) DO UPDATE
  SET group_name=EXCLUDED.group_name, group_order=EXCLUDED.group_order,
      image_url=COALESCE(NULLIF(public.categories.image_url,''), EXCLUDED.image_url),
      icon_emoji=COALESCE(NULLIF(public.categories.icon_emoji,''), EXCLUDED.icon_emoji);
INSERT INTO public.categories (name, slug, icon_emoji, image_url, group_name, group_order, display_order, is_active)
VALUES ('Rectangle Container','rectangle-container','🍱','https://drive.google.com/thumbnail?id=1svsc3RFX5G43wdZzyX4nsotrbn2xcd88&sz=w800','Food Containers',1,2,TRUE)
ON CONFLICT (name) DO UPDATE
  SET group_name=EXCLUDED.group_name, group_order=EXCLUDED.group_order,
      image_url=COALESCE(NULLIF(public.categories.image_url,''), EXCLUDED.image_url),
      icon_emoji=COALESCE(NULLIF(public.categories.icon_emoji,''), EXCLUDED.icon_emoji);
INSERT INTO public.categories (name, slug, icon_emoji, image_url, group_name, group_order, display_order, is_active)
VALUES ('Premium Container','premium-container','🥡','https://drive.google.com/thumbnail?id=1kmgYYeeF3gkfQ6g1HusrdWDVmV0TQym7&sz=w800','Food Containers',1,3,TRUE)
ON CONFLICT (name) DO UPDATE
  SET group_name=EXCLUDED.group_name, group_order=EXCLUDED.group_order,
      image_url=COALESCE(NULLIF(public.categories.image_url,''), EXCLUDED.image_url),
      icon_emoji=COALESCE(NULLIF(public.categories.icon_emoji,''), EXCLUDED.icon_emoji);
INSERT INTO public.categories (name, slug, icon_emoji, image_url, group_name, group_order, display_order, is_active)
VALUES ('Hinged Container','hinged-container','📦','https://drive.google.com/thumbnail?id=1eelOVL0OUK0CzELZi3Dr9Wgwo6G9QWFE&sz=w800','Food Containers',1,4,TRUE)
ON CONFLICT (name) DO UPDATE
  SET group_name=EXCLUDED.group_name, group_order=EXCLUDED.group_order,
      image_url=COALESCE(NULLIF(public.categories.image_url,''), EXCLUDED.image_url),
      icon_emoji=COALESCE(NULLIF(public.categories.icon_emoji,''), EXCLUDED.icon_emoji);
INSERT INTO public.categories (name, slug, icon_emoji, image_url, group_name, group_order, display_order, is_active)
VALUES ('Aluminium Container','aluminium-container','🥘','https://drive.google.com/thumbnail?id=195uyIW625J_5290E-tJfj7Q0LSWPbe3I&sz=w800','Food Containers',1,5,TRUE)
ON CONFLICT (name) DO UPDATE
  SET group_name=EXCLUDED.group_name, group_order=EXCLUDED.group_order,
      image_url=COALESCE(NULLIF(public.categories.image_url,''), EXCLUDED.image_url),
      icon_emoji=COALESCE(NULLIF(public.categories.icon_emoji,''), EXCLUDED.icon_emoji);
INSERT INTO public.categories (name, slug, icon_emoji, image_url, group_name, group_order, display_order, is_active)
VALUES ('Rice Bowl','rice-bowl','🍚','https://drive.google.com/thumbnail?id=1M5dO0Vegw6kRgvyO6AWRtnXpHoWOp6EB&sz=w800','Food Containers',1,6,TRUE)
ON CONFLICT (name) DO UPDATE
  SET group_name=EXCLUDED.group_name, group_order=EXCLUDED.group_order,
      image_url=COALESCE(NULLIF(public.categories.image_url,''), EXCLUDED.image_url),
      icon_emoji=COALESCE(NULLIF(public.categories.icon_emoji,''), EXCLUDED.icon_emoji);

-- ===== GROUP 2: Tableware & Takeaway =====
INSERT INTO public.categories (name, slug, icon_emoji, image_url, group_name, group_order, display_order, is_active)
VALUES ('Sipper Glasses','sipper-glasses','🥤','https://drive.google.com/thumbnail?id=14MEYKhMp0qFCfhGy5tqGEK6xAm240a6e&sz=w800','Tableware & Takeaway',2,7,TRUE)
ON CONFLICT (name) DO UPDATE
  SET group_name=EXCLUDED.group_name, group_order=EXCLUDED.group_order,
      image_url=COALESCE(NULLIF(public.categories.image_url,''), EXCLUDED.image_url),
      icon_emoji=COALESCE(NULLIF(public.categories.icon_emoji,''), EXCLUDED.icon_emoji);
INSERT INTO public.categories (name, slug, icon_emoji, image_url, group_name, group_order, display_order, is_active)
VALUES ('Meal Tray','meal-tray','🍱','https://drive.google.com/thumbnail?id=1MZVwEjpldV9ugKEv1BraHNgH0f0XZiOD&sz=w800','Tableware & Takeaway',2,8,TRUE)
ON CONFLICT (name) DO UPDATE
  SET group_name=EXCLUDED.group_name, group_order=EXCLUDED.group_order,
      image_url=COALESCE(NULLIF(public.categories.image_url,''), EXCLUDED.image_url),
      icon_emoji=COALESCE(NULLIF(public.categories.icon_emoji,''), EXCLUDED.icon_emoji);
INSERT INTO public.categories (name, slug, icon_emoji, image_url, group_name, group_order, display_order, is_active)
VALUES ('Ripple Cup','ripple-cup','☕','https://drive.google.com/thumbnail?id=1hoU9Djvqe8TSTUFEq3LjGvJOGEJw6SPt&sz=w800','Tableware & Takeaway',2,9,TRUE)
ON CONFLICT (name) DO UPDATE
  SET group_name=EXCLUDED.group_name, group_order=EXCLUDED.group_order,
      image_url=COALESCE(NULLIF(public.categories.image_url,''), EXCLUDED.image_url),
      icon_emoji=COALESCE(NULLIF(public.categories.icon_emoji,''), EXCLUDED.icon_emoji);
INSERT INTO public.categories (name, slug, icon_emoji, image_url, group_name, group_order, display_order, is_active)
VALUES ('Paper Cup','paper-cup','☕','https://drive.google.com/thumbnail?id=1x7zdEch6_bfeUGYFQUeMBFbmf-u69KzC&sz=w800','Tableware & Takeaway',2,10,TRUE)
ON CONFLICT (name) DO UPDATE
  SET group_name=EXCLUDED.group_name, group_order=EXCLUDED.group_order,
      image_url=COALESCE(NULLIF(public.categories.image_url,''), EXCLUDED.image_url),
      icon_emoji=COALESCE(NULLIF(public.categories.icon_emoji,''), EXCLUDED.icon_emoji);
INSERT INTO public.categories (name, slug, icon_emoji, image_url, group_name, group_order, display_order, is_active)
VALUES ('Ice Cream Cup','ice-cream-cup','🍨','https://drive.google.com/thumbnail?id=1PsITl6egilxIKZn7YfPOIXp4cxHDxH8Q&sz=w800','Tableware & Takeaway',2,11,TRUE)
ON CONFLICT (name) DO UPDATE
  SET group_name=EXCLUDED.group_name, group_order=EXCLUDED.group_order,
      image_url=COALESCE(NULLIF(public.categories.image_url,''), EXCLUDED.image_url),
      icon_emoji=COALESCE(NULLIF(public.categories.icon_emoji,''), EXCLUDED.icon_emoji);

-- ===== GROUP 3: Food Packaging & Presentation =====
INSERT INTO public.categories (name, slug, icon_emoji, image_url, group_name, group_order, display_order, is_active)
VALUES ('Pizza Box','pizza-box','🍕','https://drive.google.com/thumbnail?id=1AP2WAzXSvNQSa6m3f1tiqxGFNVc95o7J&sz=w800','Food Packaging & Presentation',3,12,TRUE)
ON CONFLICT (name) DO UPDATE
  SET group_name=EXCLUDED.group_name, group_order=EXCLUDED.group_order,
      image_url=COALESCE(NULLIF(public.categories.image_url,''), EXCLUDED.image_url),
      icon_emoji=COALESCE(NULLIF(public.categories.icon_emoji,''), EXCLUDED.icon_emoji);
INSERT INTO public.categories (name, slug, icon_emoji, image_url, group_name, group_order, display_order, is_active)
VALUES ('Paper Box','paper-box','📦','https://drive.google.com/thumbnail?id=1eW9H2lInMw0zP08FcRnE-X9c56PbmWEg&sz=w800','Food Packaging & Presentation',3,13,TRUE)
ON CONFLICT (name) DO UPDATE
  SET group_name=EXCLUDED.group_name, group_order=EXCLUDED.group_order,
      image_url=COALESCE(NULLIF(public.categories.image_url,''), EXCLUDED.image_url),
      icon_emoji=COALESCE(NULLIF(public.categories.icon_emoji,''), EXCLUDED.icon_emoji);
INSERT INTO public.categories (name, slug, icon_emoji, image_url, group_name, group_order, display_order, is_active)
VALUES ('Burger & Sandwich Box','burger-sandwich-box','🍔','https://drive.google.com/thumbnail?id=1KkR8v1xfOjvp6PJG95RO96v4H2MpgVTP&sz=w800','Food Packaging & Presentation',3,14,TRUE)
ON CONFLICT (name) DO UPDATE
  SET group_name=EXCLUDED.group_name, group_order=EXCLUDED.group_order,
      image_url=COALESCE(NULLIF(public.categories.image_url,''), EXCLUDED.image_url),
      icon_emoji=COALESCE(NULLIF(public.categories.icon_emoji,''), EXCLUDED.icon_emoji);
INSERT INTO public.categories (name, slug, icon_emoji, image_url, group_name, group_order, display_order, is_active)
VALUES ('Cling Wrap','cling-wrap','🎞️','https://drive.google.com/thumbnail?id=1hyh7AJF1m3sElak-yeEKhlxIcsDnrEZJ&sz=w800','Food Packaging & Presentation',3,15,TRUE)
ON CONFLICT (name) DO UPDATE
  SET group_name=EXCLUDED.group_name, group_order=EXCLUDED.group_order,
      image_url=COALESCE(NULLIF(public.categories.image_url,''), EXCLUDED.image_url),
      icon_emoji=COALESCE(NULLIF(public.categories.icon_emoji,''), EXCLUDED.icon_emoji);
INSERT INTO public.categories (name, slug, icon_emoji, image_url, group_name, group_order, display_order, is_active)
VALUES ('Silver Pouch','silver-pouch','🥈','https://drive.google.com/thumbnail?id=1eGYO1d-Cxx1z-gd_dQl81-JzTWXRCCom&sz=w800','Food Packaging & Presentation',3,16,TRUE)
ON CONFLICT (name) DO UPDATE
  SET group_name=EXCLUDED.group_name, group_order=EXCLUDED.group_order,
      image_url=COALESCE(NULLIF(public.categories.image_url,''), EXCLUDED.image_url),
      icon_emoji=COALESCE(NULLIF(public.categories.icon_emoji,''), EXCLUDED.icon_emoji);
INSERT INTO public.categories (name, slug, icon_emoji, image_url, group_name, group_order, display_order, is_active)
VALUES ('Foil','foil','🪙','https://drive.google.com/thumbnail?id=1xgdGjHws7GKrJTd0dvSsb6XROfPue6lw&sz=w800','Food Packaging & Presentation',3,17,TRUE)
ON CONFLICT (name) DO UPDATE
  SET group_name=EXCLUDED.group_name, group_order=EXCLUDED.group_order,
      image_url=COALESCE(NULLIF(public.categories.image_url,''), EXCLUDED.image_url),
      icon_emoji=COALESCE(NULLIF(public.categories.icon_emoji,''), EXCLUDED.icon_emoji);

-- ===== GROUP 4: Hygiene, Cleaning & Facility Care =====
INSERT INTO public.categories (name, slug, icon_emoji, image_url, group_name, group_order, display_order, is_active)
VALUES ('Tissue & Napkin','tissue-napkin','🧻','https://drive.google.com/thumbnail?id=17A5V8-5FTcIanJMnu2O3s6mg8EtGZUtn&sz=w800','Hygiene, Cleaning & Facility Care',4,18,TRUE)
ON CONFLICT (name) DO UPDATE
  SET group_name=EXCLUDED.group_name, group_order=EXCLUDED.group_order,
      image_url=COALESCE(NULLIF(public.categories.image_url,''), EXCLUDED.image_url),
      icon_emoji=COALESCE(NULLIF(public.categories.icon_emoji,''), EXCLUDED.icon_emoji);
INSERT INTO public.categories (name, slug, icon_emoji, image_url, group_name, group_order, display_order, is_active)
VALUES ('Cap & Gloves','cap-gloves','🧤','https://drive.google.com/thumbnail?id=1q_C_sydbQuWnGvYMyoqgqcfcMZGqJ_zL&sz=w800','Hygiene, Cleaning & Facility Care',4,19,TRUE)
ON CONFLICT (name) DO UPDATE
  SET group_name=EXCLUDED.group_name, group_order=EXCLUDED.group_order,
      image_url=COALESCE(NULLIF(public.categories.image_url,''), EXCLUDED.image_url),
      icon_emoji=COALESCE(NULLIF(public.categories.icon_emoji,''), EXCLUDED.icon_emoji);
INSERT INTO public.categories (name, slug, icon_emoji, image_url, group_name, group_order, display_order, is_active)
VALUES ('Tapes','tapes','🏷️','https://drive.google.com/thumbnail?id=1WAORvuSxJZB_NQ0O9HPnGRHzY5-Vq8BK&sz=w800','Hygiene, Cleaning & Facility Care',4,20,TRUE)
ON CONFLICT (name) DO UPDATE
  SET group_name=EXCLUDED.group_name, group_order=EXCLUDED.group_order,
      image_url=COALESCE(NULLIF(public.categories.image_url,''), EXCLUDED.image_url),
      icon_emoji=COALESCE(NULLIF(public.categories.icon_emoji,''), EXCLUDED.icon_emoji);

-- ===== GROUP 5: Decoration & Party =====
INSERT INTO public.categories (name, slug, icon_emoji, image_url, group_name, group_order, display_order, is_active)
VALUES ('Backdrop','backdrop','🎀','https://image.cdn.shpy.in/407769/48-1777700766541.jpeg?width=600&format=webp','Decoration & Party',5,21,TRUE)
ON CONFLICT (name) DO UPDATE
  SET group_name=EXCLUDED.group_name, group_order=EXCLUDED.group_order,
      image_url=COALESCE(NULLIF(public.categories.image_url,''), EXCLUDED.image_url),
      icon_emoji=COALESCE(NULLIF(public.categories.icon_emoji,''), EXCLUDED.icon_emoji);
INSERT INTO public.categories (name, slug, icon_emoji, image_url, group_name, group_order, display_order, is_active)
VALUES ('Latex Balloons','latex-balloons','🎈','https://image.cdn.shpy.in/407769/d8679a78-43bd-487a-88e5-e30e33e3926e-1773726864130.png?width=600&format=webp','Decoration & Party',5,22,TRUE)
ON CONFLICT (name) DO UPDATE
  SET group_name=EXCLUDED.group_name, group_order=EXCLUDED.group_order,
      image_url=COALESCE(NULLIF(public.categories.image_url,''), EXCLUDED.image_url),
      icon_emoji=COALESCE(NULLIF(public.categories.icon_emoji,''), EXCLUDED.icon_emoji);
INSERT INTO public.categories (name, slug, icon_emoji, image_url, group_name, group_order, display_order, is_active)
VALUES ('Foil Balloon','foil-balloon','🎈','https://image.cdn.shpy.in/407769/ChatGPTImageJul15202502_08_55PM-1752568816062.png?width=600&format=webp','Decoration & Party',5,23,TRUE)
ON CONFLICT (name) DO UPDATE
  SET group_name=EXCLUDED.group_name, group_order=EXCLUDED.group_order,
      image_url=COALESCE(NULLIF(public.categories.image_url,''), EXCLUDED.image_url),
      icon_emoji=COALESCE(NULLIF(public.categories.icon_emoji,''), EXCLUDED.icon_emoji);
INSERT INTO public.categories (name, slug, icon_emoji, image_url, group_name, group_order, display_order, is_active)
VALUES ('BABY BOX FOR DECORATIONS','baby-box-for-decorations','🍼','https://image.cdn.shpy.in/407769/WhatsAppImage2025-06-14at112036-1749881732697.jpeg?width=600&format=webp','Decoration & Party',5,24,TRUE)
ON CONFLICT (name) DO UPDATE
  SET group_name=EXCLUDED.group_name, group_order=EXCLUDED.group_order,
      image_url=COALESCE(NULLIF(public.categories.image_url,''), EXCLUDED.image_url),
      icon_emoji=COALESCE(NULLIF(public.categories.icon_emoji,''), EXCLUDED.icon_emoji);
INSERT INTO public.categories (name, slug, icon_emoji, image_url, group_name, group_order, display_order, is_active)
VALUES ('Curl Ribbon','curl-ribbon','🎀','https://image.cdn.shpy.in/407769/ChatGPTImageJun2202506_47_20PM-1748874326170.png?width=600&format=webp','Decoration & Party',5,25,TRUE)
ON CONFLICT (name) DO UPDATE
  SET group_name=EXCLUDED.group_name, group_order=EXCLUDED.group_order,
      image_url=COALESCE(NULLIF(public.categories.image_url,''), EXCLUDED.image_url),
      icon_emoji=COALESCE(NULLIF(public.categories.icon_emoji,''), EXCLUDED.icon_emoji);
INSERT INTO public.categories (name, slug, icon_emoji, image_url, group_name, group_order, display_order, is_active)
VALUES ('Banners','banners','🚩','https://image.cdn.shpy.in/407769/HAPPYBIRTHDAYDARKBLUEBANNERWHOLESALE-1753437012642.jpeg?width=600&format=webp','Decoration & Party',5,26,TRUE)
ON CONFLICT (name) DO UPDATE
  SET group_name=EXCLUDED.group_name, group_order=EXCLUDED.group_order,
      image_url=COALESCE(NULLIF(public.categories.image_url,''), EXCLUDED.image_url),
      icon_emoji=COALESCE(NULLIF(public.categories.icon_emoji,''), EXCLUDED.icon_emoji);
INSERT INTO public.categories (name, slug, icon_emoji, image_url, group_name, group_order, display_order, is_active)
VALUES ('Party Goggles','party-goggles','🕶️','https://image.cdn.shpy.in/407769/Gemini_Generated_Image_hsrlb2hsrlb2hsrl-1773728666553.png?width=600&format=webp','Decoration & Party',5,27,TRUE)
ON CONFLICT (name) DO UPDATE
  SET group_name=EXCLUDED.group_name, group_order=EXCLUDED.group_order,
      image_url=COALESCE(NULLIF(public.categories.image_url,''), EXCLUDED.image_url),
      icon_emoji=COALESCE(NULLIF(public.categories.icon_emoji,''), EXCLUDED.icon_emoji);
INSERT INTO public.categories (name, slug, icon_emoji, image_url, group_name, group_order, display_order, is_active)
VALUES ('Decorations Net','decorations-net','🕸️','https://image.cdn.shpy.in/407769/WhatsAppImage2025-06-02at120238-1748866905981.jpeg?width=600&format=webp','Decoration & Party',5,28,TRUE)
ON CONFLICT (name) DO UPDATE
  SET group_name=EXCLUDED.group_name, group_order=EXCLUDED.group_order,
      image_url=COALESCE(NULLIF(public.categories.image_url,''), EXCLUDED.image_url),
      icon_emoji=COALESCE(NULLIF(public.categories.icon_emoji,''), EXCLUDED.icon_emoji);
INSERT INTO public.categories (name, slug, icon_emoji, image_url, group_name, group_order, display_order, is_active)
VALUES ('Paper Confetti','paper-confetti','🎊','https://image.cdn.shpy.in/407769/WhatsAppImage2026-02-21at122144PM1-1773729079954.jpeg?width=600&format=webp','Decoration & Party',5,29,TRUE)
ON CONFLICT (name) DO UPDATE
  SET group_name=EXCLUDED.group_name, group_order=EXCLUDED.group_order,
      image_url=COALESCE(NULLIF(public.categories.image_url,''), EXCLUDED.image_url),
      icon_emoji=COALESCE(NULLIF(public.categories.icon_emoji,''), EXCLUDED.icon_emoji);
INSERT INTO public.categories (name, slug, icon_emoji, image_url, group_name, group_order, display_order, is_active)
VALUES ('Danglers','danglers','🎐','https://image.cdn.shpy.in/407769/WhatsAppImage2025-06-14at120353-1749882882574.jpeg?width=600&format=webp','Decoration & Party',5,30,TRUE)
ON CONFLICT (name) DO UPDATE
  SET group_name=EXCLUDED.group_name, group_order=EXCLUDED.group_order,
      image_url=COALESCE(NULLIF(public.categories.image_url,''), EXCLUDED.image_url),
      icon_emoji=COALESCE(NULLIF(public.categories.icon_emoji,''), EXCLUDED.icon_emoji);
INSERT INTO public.categories (name, slug, icon_emoji, image_url, group_name, group_order, display_order, is_active)
VALUES ('Cake Toppers','cake-toppers','🧁','https://image.cdn.shpy.in/407769/H8c8bcb693993429d8dab544ab47383863jpg_720x720q50-1749883892908.jpeg?width=600&format=webp','Decoration & Party',5,31,TRUE)
ON CONFLICT (name) DO UPDATE
  SET group_name=EXCLUDED.group_name, group_order=EXCLUDED.group_order,
      image_url=COALESCE(NULLIF(public.categories.image_url,''), EXCLUDED.image_url),
      icon_emoji=COALESCE(NULLIF(public.categories.icon_emoji,''), EXCLUDED.icon_emoji);
INSERT INTO public.categories (name, slug, icon_emoji, image_url, group_name, group_order, display_order, is_active)
VALUES ('Balloons Accessories','balloons-accessories','🎈','https://image.cdn.shpy.in/407769/11-1749885070824.png?width=600&format=webp','Decoration & Party',5,32,TRUE)
ON CONFLICT (name) DO UPDATE
  SET group_name=EXCLUDED.group_name, group_order=EXCLUDED.group_order,
      image_url=COALESCE(NULLIF(public.categories.image_url,''), EXCLUDED.image_url),
      icon_emoji=COALESCE(NULLIF(public.categories.icon_emoji,''), EXCLUDED.icon_emoji);
INSERT INTO public.categories (name, slug, icon_emoji, image_url, group_name, group_order, display_order, is_active)
VALUES ('Balloon Pump','balloon-pump','🛟','https://image.cdn.shpy.in/407769/OIP-1742477240830.jpeg?width=600&format=webp','Decoration & Party',5,33,TRUE)
ON CONFLICT (name) DO UPDATE
  SET group_name=EXCLUDED.group_name, group_order=EXCLUDED.group_order,
      image_url=COALESCE(NULLIF(public.categories.image_url,''), EXCLUDED.image_url),
      icon_emoji=COALESCE(NULLIF(public.categories.icon_emoji,''), EXCLUDED.icon_emoji);
INSERT INTO public.categories (name, slug, icon_emoji, image_url, group_name, group_order, display_order, is_active)
VALUES ('Birthday Decorations Curtains','birthday-decorations-curtains','🎊','https://image.cdn.shpy.in/407769/12-1752484816956.jpeg?width=600&format=webp','Decoration & Party',5,34,TRUE)
ON CONFLICT (name) DO UPDATE
  SET group_name=EXCLUDED.group_name, group_order=EXCLUDED.group_order,
      image_url=COALESCE(NULLIF(public.categories.image_url,''), EXCLUDED.image_url),
      icon_emoji=COALESCE(NULLIF(public.categories.icon_emoji,''), EXCLUDED.icon_emoji);
INSERT INTO public.categories (name, slug, icon_emoji, image_url, group_name, group_order, display_order, is_active)
VALUES ('Shop Artificial Flowers for Decoration','shop-artificial-flowers-for-decoration','🌸','https://image.cdn.shpy.in/407769/518sd85tDL-1742479178606.jpeg?width=600&format=webp','Decoration & Party',5,35,TRUE)
ON CONFLICT (name) DO UPDATE
  SET group_name=EXCLUDED.group_name, group_order=EXCLUDED.group_order,
      image_url=COALESCE(NULLIF(public.categories.image_url,''), EXCLUDED.image_url),
      icon_emoji=COALESCE(NULLIF(public.categories.icon_emoji,''), EXCLUDED.icon_emoji);
INSERT INTO public.categories (name, slug, icon_emoji, image_url, group_name, group_order, display_order, is_active)
VALUES ('Paper Fan','paper-fan','🪭','https://image.cdn.shpy.in/407769/H317af8a3c70b476ab6058823205cfac3i-1752492277426.jpeg?width=600&format=webp','Decoration & Party',5,36,TRUE)
ON CONFLICT (name) DO UPDATE
  SET group_name=EXCLUDED.group_name, group_order=EXCLUDED.group_order,
      image_url=COALESCE(NULLIF(public.categories.image_url,''), EXCLUDED.image_url),
      icon_emoji=COALESCE(NULLIF(public.categories.icon_emoji,''), EXCLUDED.icon_emoji);
INSERT INTO public.categories (name, slug, icon_emoji, image_url, group_name, group_order, display_order, is_active)
VALUES ('Balloon Metal Stand','balloon-metal-stand','🎈','https://image.cdn.shpy.in/407769/8b3f5df8-330a-43ae-bc48-5db7e714d1f2-1773729655283.jpeg?width=600&format=webp','Decoration & Party',5,37,TRUE)
ON CONFLICT (name) DO UPDATE
  SET group_name=EXCLUDED.group_name, group_order=EXCLUDED.group_order,
      image_url=COALESCE(NULLIF(public.categories.image_url,''), EXCLUDED.image_url),
      icon_emoji=COALESCE(NULLIF(public.categories.icon_emoji,''), EXCLUDED.icon_emoji);
INSERT INTO public.categories (name, slug, icon_emoji, image_url, group_name, group_order, display_order, is_active)
VALUES ('Birthday Decorations Kit','birthday-decorations-kit','🎉','https://image.cdn.shpy.in/407769/WhatsAppImage2025-07-14at114735-1752474583889.jpeg?width=600&format=webp','Decoration & Party',5,38,TRUE)
ON CONFLICT (name) DO UPDATE
  SET group_name=EXCLUDED.group_name, group_order=EXCLUDED.group_order,
      image_url=COALESCE(NULLIF(public.categories.image_url,''), EXCLUDED.image_url),
      icon_emoji=COALESCE(NULLIF(public.categories.icon_emoji,''), EXCLUDED.icon_emoji);
INSERT INTO public.categories (name, slug, icon_emoji, image_url, group_name, group_order, display_order, is_active)
VALUES ('Party Sash','party-sash','🎗️','https://image.cdn.shpy.in/407769/SKU-0979_0-1745840307213.png?width=600&format=webp','Decoration & Party',5,39,TRUE)
ON CONFLICT (name) DO UPDATE
  SET group_name=EXCLUDED.group_name, group_order=EXCLUDED.group_order,
      image_url=COALESCE(NULLIF(public.categories.image_url,''), EXCLUDED.image_url),
      icon_emoji=COALESCE(NULLIF(public.categories.icon_emoji,''), EXCLUDED.icon_emoji);
INSERT INTO public.categories (name, slug, icon_emoji, image_url, group_name, group_order, display_order, is_active)
VALUES ('Snow Spray','snow-spray','❄️','https://image.cdn.shpy.in/407769/whatsapp-image-2023-05-26-at-10-18-46-1--1748712885679.jpeg?width=600&format=webp','Decoration & Party',5,40,TRUE)
ON CONFLICT (name) DO UPDATE
  SET group_name=EXCLUDED.group_name, group_order=EXCLUDED.group_order,
      image_url=COALESCE(NULLIF(public.categories.image_url,''), EXCLUDED.image_url),
      icon_emoji=COALESCE(NULLIF(public.categories.icon_emoji,''), EXCLUDED.icon_emoji);
INSERT INTO public.categories (name, slug, icon_emoji, image_url, group_name, group_order, display_order, is_active)
VALUES ('Balloon Bag','balloon-bag','👜','https://image.cdn.shpy.in/407769/ChatGPTImageJul14202510_43_41AM-1752470524429.png?width=600&format=webp','Decoration & Party',5,41,TRUE)
ON CONFLICT (name) DO UPDATE
  SET group_name=EXCLUDED.group_name, group_order=EXCLUDED.group_order,
      image_url=COALESCE(NULLIF(public.categories.image_url,''), EXCLUDED.image_url),
      icon_emoji=COALESCE(NULLIF(public.categories.icon_emoji,''), EXCLUDED.icon_emoji);
INSERT INTO public.categories (name, slug, icon_emoji, image_url, group_name, group_order, display_order, is_active)
VALUES ('Birthday Candles','birthday-candles','🕯️','https://image.cdn.shpy.in/407769/2f330c1b-ddfe-407d-ba94-103937658e0d-500x500-1742481390103.webp?width=600&format=webp','Decoration & Party',5,42,TRUE)
ON CONFLICT (name) DO UPDATE
  SET group_name=EXCLUDED.group_name, group_order=EXCLUDED.group_order,
      image_url=COALESCE(NULLIF(public.categories.image_url,''), EXCLUDED.image_url),
      icon_emoji=COALESCE(NULLIF(public.categories.icon_emoji,''), EXCLUDED.icon_emoji);
INSERT INTO public.categories (name, slug, icon_emoji, image_url, group_name, group_order, display_order, is_active)
VALUES ('Party Poppers','party-poppers','🎉','https://image.cdn.shpy.in/407769/WhatsAppImage2024-09-30at141902-1742393844494.jpeg?width=600&format=webp','Decoration & Party',5,43,TRUE)
ON CONFLICT (name) DO UPDATE
  SET group_name=EXCLUDED.group_name, group_order=EXCLUDED.group_order,
      image_url=COALESCE(NULLIF(public.categories.image_url,''), EXCLUDED.image_url),
      icon_emoji=COALESCE(NULLIF(public.categories.icon_emoji,''), EXCLUDED.icon_emoji);
INSERT INTO public.categories (name, slug, icon_emoji, image_url, group_name, group_order, display_order, is_active)
VALUES ('Party Props','party-props','🎭','https://image.cdn.shpy.in/407769/WhatsAppImage2025-06-14at122926-1749884461138.jpeg?width=600&format=webp','Decoration & Party',5,44,TRUE)
ON CONFLICT (name) DO UPDATE
  SET group_name=EXCLUDED.group_name, group_order=EXCLUDED.group_order,
      image_url=COALESCE(NULLIF(public.categories.image_url,''), EXCLUDED.image_url),
      icon_emoji=COALESCE(NULLIF(public.categories.icon_emoji,''), EXCLUDED.icon_emoji);
INSERT INTO public.categories (name, slug, icon_emoji, image_url, group_name, group_order, display_order, is_active)
VALUES ('Balloon set','balloon-set','🎈','https://image.cdn.shpy.in/407769/H9435f62725594070868739b30b789c36wjpg_720x720q50-1749883503550.jpeg?width=600&format=webp','Decoration & Party',5,45,TRUE)
ON CONFLICT (name) DO UPDATE
  SET group_name=EXCLUDED.group_name, group_order=EXCLUDED.group_order,
      image_url=COALESCE(NULLIF(public.categories.image_url,''), EXCLUDED.image_url),
      icon_emoji=COALESCE(NULLIF(public.categories.icon_emoji,''), EXCLUDED.icon_emoji);


-- Verify
SELECT group_order, group_name, COUNT(*) categories,
       COUNT(image_url) FILTER (WHERE image_url <> '') AS with_image
FROM public.categories GROUP BY group_order, group_name ORDER BY group_order;
