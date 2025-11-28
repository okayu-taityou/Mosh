// Simple check to ensure password reset API does not return tokens in production-like env
let fetchLib;
(async ()=>{
  try { fetchLib = global.fetch; } catch (e) { fetchLib = null; }
  if (!fetchLib) {
    try { fetchLib = (await import('node-fetch')).default; } catch (e) { /* ignore */ }
  }
  const fetch = fetchLib || (()=>{ throw new Error('fetch not available'); });
  const base = process.env.BASE_URL || 'http://localhost:3000';
  const email = `pwcheck${Date.now()}@example.com`;
  console.log('Registering', email);
  let res = await fetch(base + '/api/auth/register', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ email, password: 'Password123', name: 'PWCheck' }) });
  if (res.status !== 200) { console.error('register failed', res.status); process.exit(2); }
  const j = await res.json();
  const token = j && j.token;
  if(!token){ console.error('no token from register'); process.exit(2); }
  console.log('Requesting password reset');
  res = await fetch(base + '/api/passwordReset/request', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ email }) });
  const body = await res.json();
  console.log('passwordReset response:', body);
  if(body && body.token){
    console.error('ERROR: password reset returned token in response. This should not happen in CI/production.');
    process.exit(1);
  }
  console.log('OK: password reset did not return token');
  process.exit(0);
})();
