-- Clean up additive product names that have IDs appended
UPDATE additive_purchase_items
SET product_name = TRIM(SUBSTRING(product_name FROM 1 FOR POSITION('(' IN product_name) - 1))
WHERE product_name LIKE '%(%)';