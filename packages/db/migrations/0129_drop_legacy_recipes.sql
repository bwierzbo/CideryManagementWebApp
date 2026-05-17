-- Drops the unused legacy recipe scaffolding (`recipes`, `recipe_ingredients`,
-- `recipe_additives`) so the new recipe schema in 0128_recipes_phase1.sql can
-- own those table names. All three legacy tables had 0 rows; the legacy tRPC
-- router that referenced them is being removed in the same change.
--
-- IF EXISTS makes this idempotent: on a fresh database that never had the
-- legacy schema, this migration is a no-op.
--
-- Note: in this dev environment the file order is 0128 then 0129, but the
-- application order is reversed (0129 must run BEFORE 0128 so 0128's CREATE
-- TABLE recipes doesn't conflict). A fresh DB applies 0128 first cleanly
-- (no legacy to conflict with) and 0129 second as a no-op — same end state.

DROP TABLE IF EXISTS recipe_additives    CASCADE;
DROP TABLE IF EXISTS recipe_ingredients  CASCADE;
DROP TABLE IF EXISTS recipes             CASCADE;
