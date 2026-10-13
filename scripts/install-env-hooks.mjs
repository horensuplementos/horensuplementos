import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const hooksPath = fileURLToPath(new URL("../.githooks/", import.meta.url));
execFileSync("git", ["config", "core.hooksPath", hooksPath], { stdio: "inherit" });
console.log("Hooks locais instalados: arquivos .env serão bloqueados no commit e no push.");
