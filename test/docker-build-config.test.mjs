import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("Docker build excludes secret env files from the image context", () => {
  const dockerignore = readFileSync(new URL("../.dockerignore", import.meta.url), "utf8");

  assert.match(dockerignore, /^\.env\*$/m);
});

test("Dockerfile passes only public Supabase env at build time", () => {
  const dockerfile = readFileSync(new URL("../Dockerfile", import.meta.url), "utf8");

  assert.match(dockerfile, /ARG NEXT_PUBLIC_SUPABASE_URL/);
  assert.match(dockerfile, /ARG NEXT_PUBLIC_SUPABASE_ANON_KEY/);
  assert.doesNotMatch(dockerfile, /SUPABASE_SERVICE_ROLE_KEY/);
});
