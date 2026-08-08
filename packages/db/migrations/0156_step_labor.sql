ALTER TYPE "activity_labor_type" ADD VALUE IF NOT EXISTS 'recipe_step';
--> statement-breakpoint
ALTER TABLE "activity_labor_assignments" ADD COLUMN IF NOT EXISTS "batch_step_task_id" uuid;
--> statement-breakpoint
ALTER TABLE "activity_labor_assignments" ADD CONSTRAINT "activity_labor_assignments_batch_step_task_id_fk" FOREIGN KEY ("batch_step_task_id") REFERENCES "batch_step_tasks"("id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "activity_labor_step_task_idx" ON "activity_labor_assignments" ("batch_step_task_id");
