ALTER TABLE "batch_measurements" ADD COLUMN "created_by" uuid REFERENCES "users"("id");
