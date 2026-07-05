-- Clear broken Google Drive image URLs from products table
-- These URLs return HTML viewer pages instead of actual images
UPDATE products
SET image_url = NULL
WHERE image_url LIKE '%drive.google.com%'
   OR image_url LIKE '%docs.google.com%'
   OR image_url LIKE '%sheets.google.com%';

-- Clear broken Google Drive URLs from product_images table
UPDATE product_images
SET image_url = NULL
WHERE image_url LIKE '%drive.google.com%'
   OR image_url LIKE '%docs.google.com%'
   OR image_url LIKE '%sheets.google.com%';

-- Log the changes
SELECT COUNT(*) as cleared_product_images FROM product_images WHERE image_url IS NULL;
SELECT COUNT(*) as cleared_products FROM products WHERE image_url IS NULL;
