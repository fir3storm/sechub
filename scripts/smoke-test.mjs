const BASE = "http://localhost:3001";

async function main() {
  const results = [];

  async function check(name, url, opts = {}) {
    try {
      const res = await fetch(url, { redirect: "manual", ...opts });
      const ok = res.status >= 200 && res.status < 400;
      results.push({ name, status: res.status, ok });
      return { res, ok };
    } catch (e) {
      results.push({ name, status: "ERR", ok: false, error: e.message });
      return { ok: false };
    }
  }

  // Public routes
  await check("login", `${BASE}/login`);
  await check("api session", `${BASE}/api/auth/session`);

  // Login flow
  const csrfRes = await fetch(`${BASE}/api/auth/csrf`);
  const { csrfToken } = await csrfRes.json();
  const cookies = csrfRes.headers.getSetCookie?.() ?? [];

  const loginBody = new URLSearchParams({
    csrfToken,
    email: "admin@sechub.local",
    password: "admin123",
    callbackUrl: `${BASE}/app`,
    json: "true",
  });

  const loginRes = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: cookies.map((c) => c.split(";")[0]).join("; "),
    },
    body: loginBody.toString(),
    redirect: "manual",
  });

  const loginCookies = [
    ...cookies.map((c) => c.split(";")[0]),
    ...(loginRes.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]),
  ].join("; ");

  const loginOk = loginRes.status === 200 || loginRes.status === 302;
  results.push({ name: "login POST", status: loginRes.status, ok: loginOk });

  const authHeaders = { Cookie: loginCookies };

  // Authenticated routes
  for (const path of [
    "/app",
    "/app/news",
    "/app/advisories",
    "/app/settings",
    "/app/audit",
    "/api/news",
    "/api/advisories",
    "/api/templates",
    "/api/feeds",
    "/api/users",
    "/api/audit",
  ]) {
    await check(path, `${BASE}${path}`, { headers: authHeaders });
  }

  const failed = results.filter((r) => !r.ok);
  console.log(JSON.stringify(results, null, 2));
  if (failed.length) {
    console.error("\nFAILED:", failed.map((f) => `${f.name} (${f.status})`).join(", "));
    process.exit(1);
  }
  console.log("\nAll checks passed.");
}

main();
