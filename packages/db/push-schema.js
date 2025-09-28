const { spawn } = require("child_process");

console.log("🚀 Pushing schema to Neon database...");

const child = spawn("npx", ["drizzle-kit", "push:pg"], {
  stdio: ["pipe", "inherit", "inherit"],
  shell: true,
});

// Auto-answer "yes" to the confirmation prompt
setTimeout(() => {
  child.stdin.write("yes\n");
  child.stdin.end();
}, 2000);

child.on("close", (code) => {
  console.log(`\n✅ Schema push completed with code: ${code}`);
  if (code === 0) {
    console.log("🎉 Database schema successfully created in Neon!");
  } else {
    console.log("❌ Schema push failed");
  }
});
