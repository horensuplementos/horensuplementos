import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const checker = fileURLToPath(new URL("./check-env-tracking.mjs", import.meta.url));
const fixture = (callback) => {
  const directory = mkdtempSync(join(tmpdir(), "horen-env-guard-test-"));
  const git = (...args) => execFileSync("git", args, { cwd: directory, encoding: "utf8", stdio: "pipe" });
  const check = (mode, input) => spawnSync(process.execPath, [checker, ...(mode ? [mode] : [])], { cwd: directory, encoding: "utf8", input });
  try {
    git("init", "-q");
    git("config", "user.name", "Guard test");
    git("config", "user.email", "guard@example.invalid");
    git("config", "core.hooksPath", join(directory, ".git", "hooks"));
    callback({ directory, git, check });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
};

test("rejeita .env incluído à força mesmo quando está ignorado", () => fixture(({ directory, git, check }) => {
  writeFileSync(join(directory, ".gitignore"), ".env\n.env.*\n");
  writeFileSync(join(directory, ".env"), "TEST_ONLY=placeholder\n");
  git("add", ".gitignore");
  git("add", "-f", ".env");
  assert.equal(check().status, 1);
  assert.equal(check("--staged").status, 1);
}));

test("permite remover .env do índice mas bloqueia o envio de seu histórico antigo", () => fixture(({ directory, git, check }) => {
  writeFileSync(join(directory, ".env"), "TEST_ONLY=placeholder\n");
  git("add", ".env");
  git("commit", "-qm", "fixture with environment file");
  git("rm", "--cached", ".env");
  assert.equal(check("--staged").status, 0);
  assert.equal(check().status, 0);
  assert.equal(check("--history").status, 1);
  const tip = git("rev-parse", "HEAD").trim();
  assert.equal(check("--push", `refs/heads/main ${tip} refs/heads/main ${"0".repeat(40)}\n`).status, 1);
}));

test("bloqueia variantes aninhadas sem confundir declarações TypeScript", () => fixture(({ directory, git, check }) => {
  mkdirSync(join(directory, "src"));
  mkdirSync(join(directory, "config"));
  writeFileSync(join(directory, "src", "vite-env.d.ts"), "// public declarations\n");
  git("add", "src/vite-env.d.ts");
  assert.equal(check("--staged").status, 0);
  writeFileSync(join(directory, "config", ".env.production"), "TEST_ONLY=placeholder\n");
  git("add", "config/.env.production");
  assert.equal(check("--staged").status, 1);
}));
