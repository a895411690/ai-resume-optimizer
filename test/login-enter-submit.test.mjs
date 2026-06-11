import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("login form submits with Enter without triggering secondary actions", () => {
  const source = readFileSync(new URL("../src/app/page.tsx", import.meta.url), "utf8");

  assert.match(source, /<form[^>]+onSubmit=\{\(event\) => \{\s*event\.preventDefault\(\);\s*signIn\(\);\s*\}\}/s);
  assert.match(source, /<button className="login-btn-primary" type="submit" disabled=\{authLoading\}>/);
  assert.doesNotMatch(source, /type="submit" onClick=\{signIn\}/);
  assert.match(source, /<button type="button" className="login-link"/);
  assert.match(source, /<button className="login-btn-demo" type="button" onClick=\{enterDemo\}>/);
});

test("login form requires captcha before Supabase auth calls", () => {
  const source = readFileSync(new URL("../src/app/page.tsx", import.meta.url), "utf8");

  assert.match(source, /function createCaptchaChallenge\(\)/);
  assert.match(source, /const \[captchaChallenge, setCaptchaChallenge\]/);
  assert.match(source, /const \[captchaValue, setCaptchaValue\]/);
  assert.match(source, /placeholder="验证码"/);
  assert.match(source, /aria-label="刷新验证码"/);
  assert.match(source, /请输入验证码。/);
  assert.match(source, /验证码错误，请重新输入。/);
  assert.ok(source.indexOf("if (!captchaValue.trim())") < source.indexOf("supabase.auth.signUp"));
  assert.ok(source.indexOf("if (captchaValue.trim() !== captchaChallenge.answer)") < source.indexOf("supabase.auth.signInWithPassword"));
});

test("registration explains email verification before login", () => {
  const source = readFileSync(new URL("../src/app/page.tsx", import.meta.url), "utf8");

  assert.match(source, /注册成功，请查收邮箱并完成验证后再登录。/);
  assert.match(source, /email not confirmed/);
  assert.match(source, /邮箱尚未验证，请先打开注册邮件完成验证后再登录。/);
  assert.doesNotMatch(source, /注册成功，请切换到登录模式登录/);
});
