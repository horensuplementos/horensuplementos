import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const git = (args) => execFileSync("git", args, { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });
const environmentPath = /(?:^|\/)\.env(?:\..*)?$/;
const paths = (output) => output.split("\0").map((path) => path.replace(/^\n+/, "")).filter(Boolean);
const mode = process.argv[2];
let candidates;
if (mode === "--push") {
  const tips = readFileSync(0, "utf8").trim().split("\n").filter(Boolean)
    .map((line) => line.split(/\s+/)[1]).filter((sha) => sha && !/^0+$/.test(sha));
  candidates = tips.flatMap((sha) => paths(git(["log", sha, "--format=", "--name-only", "-z"])));
} else if (mode === "--history") {
  candidates = paths(git(["log", "--all", "--format=", "--name-only", "-z"]));
} else if (mode === "--staged") {
  candidates = paths(git(["diff", "--cached", "--name-only", "--diff-filter=ACMR", "-z"]));
} else {
  candidates = paths(git(["ls-files", "-z"]));
}

const blocked = [...new Set(candidates.filter((path) => environmentPath.test(path)))];
if (blocked.length) {
  console.error("Arquivos de ambiente não podem ser versionados ou enviados no histórico:");
  blocked.forEach((path) => console.error(`- ${path}`));
  console.error("Mantenha os valores no ambiente local ou no provedor de hospedagem.");
  process.exitCode = 1;
} else {
  console.log("Verificação concluída: nenhum arquivo .env rastreado neste escopo.");
}
