ALTER TYPE "fruit_type" ADD VALUE 'quince';

UPDATE "base_fruit_varieties"
SET "fruit_type" = 'quince', "updated_at" = NOW()
WHERE LOWER("name") = 'quince';
