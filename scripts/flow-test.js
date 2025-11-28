// Lightweight flow test using the global fetch available in modern
// Node versions. This avoids dynamic imports and keeps memory usage
// low. Defaults to the local dev server at port 3005.

const base = process.env.BASE_URL || 'http://localhost:3005';
const TIMEOUT_MS = Number(process.env.FLOW_TIMEOUT_MS) || 8000;

function timeoutController(ms){
  const controller = new AbortController();
  const t = setTimeout(()=>controller.abort(), ms);
  return { controller, clear: () => clearTimeout(t) };
}

async function doFetch(url, opts = {}, name = ''){
  console.log(`-> ${name} ${opts.method||'GET'} ${url}`);
  const { controller, clear } = timeoutController(TIMEOUT_MS);
  opts.signal = controller.signal;
  try {
    const res = await fetch(url, opts);
    console.log(`<-${name} status=${res && res.status}`);
    clear();
    return res;
  } catch (err) {
    clear();
    console.error(`fetch error ${name}:`, err && err.message ? err.message : err);
    throw err;
  }
}

async function readJson(res){
  const t = await res.text();
  try { return JSON.parse(t); } catch(e){ return t; }
}

async function run(){
  console.log('flow-test base=', base);
  if (process.env.RUN_SEED === '1'){
    console.log('Running seed script in child process');
    const { spawn } = require('child_process');
    const path = require('path');
    await new Promise((resolve, reject) => {
      const p = spawn(process.execPath, [path.join(__dirname, '..', 'scripts', 'seed-items.js')], { stdio: 'inherit' });
      p.on('exit', code => code === 0 ? resolve() : reject(new Error('seed failed: ' + code)));
      p.on('error', reject);
    });
  } else {
    console.log('seed skipped (set RUN_SEED=1 to run it)');
  }

  const email = `flow${Date.now()}@example.com`;
  console.log('Registering', email);
  const r1 = await doFetch(base + '/api/auth/register', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ email, password: 'Password123', name: 'Flow' }) }, 'register');
  const j1 = await readJson(r1);
  console.log('register:', j1);
  const token = j1 && j1.token;
  if(!token) { console.error('no token, abort'); return; }

  console.log('Creating task');
  const r2 = await doFetch(base + '/api/tasks', { method: 'POST', headers: {'Content-Type':'application/json','Authorization':`Bearer ${token}`}, body: JSON.stringify({ title: 'FlowTask', description: 'for flow' }) }, 'create-task');
  const j2 = await readJson(r2);
  console.log('create task:', j2);
  const taskId = j2 && j2.id;
  if(!taskId) { console.error('no taskId, abort'); return; }

  console.log('Completing task');
  const r3 = await doFetch(base + `/api/tasks/${taskId}/complete`, { method: 'POST', headers: {'Authorization':`Bearer ${token}`} }, 'complete');
  const j3 = await readJson(r3);
  console.log('complete:', j3);

  console.log('Spinning gacha');
  const r4 = await doFetch(base + '/api/gacha/spin', { method: 'POST', headers: {'Authorization':`Bearer ${token}`} }, 'spin');
  const j4 = await readJson(r4);
  console.log('spin:', j4);

  // Batch spin (10連) test - uses server-side batch endpoint if available
  console.log('Batch spinning (10連)');
  try{
    // ensure we have enough points (assume GACHA_COST=10 per spin)
    const COUNT = 10;
    const GACHA_COST = Number(process.env.GACHA_COST) || 10;
    const need = COUNT * GACHA_COST;
    try{
      const rMe = await doFetch(base + '/api/auth/me', { method: 'GET', headers: {'Authorization':`Bearer ${token}`} }, 'me-before-batch');
      const jMe = await readJson(rMe);
      const have = (jMe && jMe.points) ? Number(jMe.points) : 0;
      if(have < need){
        const deficit = need - have;
        const tasksNeeded = Math.ceil(deficit / 10); // completing a task awards ~10 points
        console.log(`Topping up points: need ${need}, have ${have}, creating ${tasksNeeded} tasks to complete`);
        for(let i=0;i<tasksNeeded;i++){
          const rt = await doFetch(base + '/api/tasks', { method: 'POST', headers: {'Content-Type':'application/json','Authorization':`Bearer ${token}`}, body: JSON.stringify({ title: `TopUp${i}_${Date.now()}` }) }, 'create-topup-task');
          const jrt = await readJson(rt);
          const tid = jrt && jrt.id;
          if(tid){ await doFetch(base + `/api/tasks/${tid}/complete`, { method: 'POST', headers: {'Authorization':`Bearer ${token}`} }, 'complete-topup-task'); }
        }
      }
    }catch(e){ console.warn('could not check/topup points:', e && e.message ? e.message : e); }

    const rBatch = await doFetch(base + '/api/gacha/spin/batch', { method: 'POST', headers: {'Content-Type':'application/json','Authorization':`Bearer ${token}`}, body: JSON.stringify({ count: COUNT }) }, 'spin-batch');
    const jBatch = await readJson(rBatch);
    console.log('spin-batch status=', rBatch.status, 'body=', jBatch);
    if(rBatch.status !== 200){ console.warn('batch spin not supported or failed, status=', rBatch.status); }
    else {
      if(!Array.isArray(jBatch.results)) { console.error('batch spin returned invalid results'); process.exit(1); }
      if(jBatch.results.length !== COUNT){ console.warn('batch results length != expected, got', jBatch.results.length); }
      // basic validation of items
      for(const it of jBatch.results){ if(!it.item || !it.record){ console.error('batch spin entry missing item/record', it); process.exit(1); } }
      // Check history for batchId presence (if DB schema supports GachaBatch)
      try {
        const rHist = await doFetch(base + '/api/gacha/history', { method: 'GET', headers: {'Authorization':`Bearer ${token}`} }, 'gacha-history');
        const jHist = await readJson(rHist);
        console.log('gacha-history:', Array.isArray(jHist) ? `${jHist.length} records` : jHist);
        const found = Array.isArray(jHist) && jHist.some(h => h.batchId);
        if(found) console.log('Found records with batchId (batch persistence enabled)');
        else console.log('No batchId found in history (migration may be pending)');
      } catch (e) { console.warn('could not fetch/inspect gacha history:', e && e.message ? e.message : e); }
    }
  }catch(e){ console.warn('batch spin request failed (ignored):', e && e.message ? e.message : e); }

  // ログインテスト
  console.log('Testing login');
  const rLogin = await doFetch(base + '/api/auth/login', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ email, password: 'Password123' }) }, 'login');
  const jLogin = await readJson(rLogin);
  console.log('login:', jLogin);
  const refreshToken = jLogin && jLogin.refreshToken;

  // リフレッシュトークンテスト
  if(refreshToken){
    console.log('Testing token refresh');
    const rRefresh = await doFetch(base + '/api/auth/refresh', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ refreshToken }) }, 'refresh-token');
    const jRefresh = await readJson(rRefresh);
    console.log('refresh-token:', jRefresh);
    const newToken = jRefresh && jRefresh.token;
    if(newToken){
      console.log('Testing new access token');
      const rMe = await doFetch(base + '/api/auth/me', { method: 'GET', headers: {'Authorization':`Bearer ${newToken}`} }, 'me-with-new-token');
      const jMe = await readJson(rMe);
      console.log('me-with-new-token:', jMe);
    }
    
    // ログアウトテスト
    console.log('Testing logout');
    const rLogout = await doFetch(base + '/api/auth/logout', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ refreshToken }) }, 'logout');
    const jLogout = await readJson(rLogout);
    console.log('logout:', jLogout);
    
    // ログアウト後のリフレッシュ試行（失敗するはず）
    console.log('Testing refresh after logout (should fail)');
    const rRefresh2 = await doFetch(base + '/api/auth/refresh', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ refreshToken }) }, 'refresh-after-logout');
    const jRefresh2 = await readJson(rRefresh2);
    console.log('refresh-after-logout:', jRefresh2);
  }

  // パスワードリセット申請・実行テスト
  console.log('Testing password reset request');
  const rPwReq = await doFetch(base + '/api/passwordReset/request', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ email }) }, 'pw-reset-request');
  const jPwReq = await readJson(rPwReq);
  console.log('pw-reset-request:', jPwReq);
  const resetToken = jPwReq && jPwReq.token;
  if (resetToken) {
    console.log('Testing password reset');
    const rPwReset = await doFetch(base + '/api/passwordReset/reset', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ token: resetToken, newPassword: 'NewPassword123' }) }, 'pw-reset');
    const jPwReset = await readJson(rPwReset);
    console.log('pw-reset:', jPwReset);
  }

  // グループ作成・参加・メンバー一覧テスト
  console.log('Creating group');
  const rGroup = await doFetch(base + '/api/groups', { method: 'POST', headers: {'Content-Type':'application/json','Authorization':`Bearer ${token}`}, body: JSON.stringify({ name: 'FlowGroup', description: 'for flow', isPublic: true }) }, 'create-group');
  const jGroup = await readJson(rGroup);
  console.log('create-group:', jGroup);
  const groupId = jGroup && jGroup.id;
  if(groupId){
    console.log('Joining group');
    const rJoin = await doFetch(base + `/api/groups/${groupId}/join`, { method: 'POST', headers: {'Authorization':`Bearer ${token}`} }, 'join-group');
    const jJoin = await readJson(rJoin);
    console.log('join-group:', jJoin);
    console.log('Listing group members');
    const rMembers = await doFetch(base + `/api/groups/${groupId}/members`, { method: 'GET', headers: {'Authorization':`Bearer ${token}`} }, 'group-members');
    const jMembers = await readJson(rMembers);
    console.log('group-members:', jMembers);
  }

  // ボス作成・開始・攻撃テスト（管理者権限必要な場合はスキップ）
  // ...（必要に応じて追加）

  // ボス開始・攻撃テスト（正常系）
  console.log('Starting boss fight');
  const rBossList = await doFetch(base + '/api/bosses', { method: 'GET' }, 'boss-list');
  const jBossList = await readJson(rBossList);
  const bossId = jBossList && jBossList[0] && jBossList[0].id;
  if(bossId){
    const rStart = await doFetch(base + `/api/bosses/${bossId}/start`, { method: 'POST', headers: {'Authorization':`Bearer ${token}`} }, 'boss-start');
    const jStart = await readJson(rStart);
    console.log('boss-start:', jStart);
    const statusId = jStart && jStart.id;
    if(statusId){
      const rAttack = await doFetch(base + `/api/bosses/${statusId}/attack`, { method: 'POST', headers: {'Authorization':`Bearer ${token}`,'Content-Type':'application/json'}, body: JSON.stringify({ damage: 2 }) }, 'boss-attack');
      const jAttack = await readJson(rAttack);
      console.log('boss-attack:', jAttack);
    }
  }

  // アイテム取得・装備・使用テスト（正常系）
  console.log('Getting items');
  const rItems = await doFetch(base + '/api/items/my', { method: 'GET', headers: {'Authorization':`Bearer ${token}`} }, 'my-items');
  const jItems = await readJson(rItems);
  const ownedId = jItems && jItems[0] && jItems[0].id;
  if(ownedId){
    console.log('Equipping item');
    const rEquip = await doFetch(base + `/api/items/${ownedId}/equip`, { method: 'POST', headers: {'Authorization':`Bearer ${token}`} }, 'equip-item');
    const jEquip = await readJson(rEquip);
    console.log('equip-item:', jEquip);
    console.log('Using item');
    const rUse = await doFetch(base + `/api/items/${ownedId}/use`, { method: 'POST', headers: {'Authorization':`Bearer ${token}`} }, 'use-item');
    const jUse = await readJson(rUse);
    console.log('use-item:', jUse);
  }

  // 権限不足・バリデーション異常系テスト
  console.log('Testing forbidden group delete');
  if(groupId){
    const rDel = await doFetch(base + `/api/groups/${groupId}`, { method: 'DELETE', headers: {'Authorization':'Bearer invalidtoken'} }, 'forbidden-delete');
    const jDel = await readJson(rDel);
    console.log('forbidden-delete:', jDel);
  }
  console.log('Testing invalid task create');
  const rBadTask = await doFetch(base + '/api/tasks', { method: 'POST', headers: {'Content-Type':'application/json','Authorization':`Bearer ${token}`}, body: JSON.stringify({ title: '' }) }, 'bad-task');
  const jBadTask = await readJson(rBadTask);
  console.log('bad-task:', jBadTask);

  // 通知・履歴取得テスト
  console.log('Getting notifications');
  const rNotif = await doFetch(base + '/api/notifications', { method: 'GET', headers: {'Authorization':`Bearer ${token}`} }, 'notifications');
  const jNotif = await readJson(rNotif);
  console.log('notifications:', jNotif);

  console.log('Getting activity log');
  const rLog = await doFetch(base + '/api/activitylog', { method: 'GET', headers: {'Authorization':`Bearer ${token}`} }, 'activitylog');
  const jLog = await readJson(rLog);
  console.log('activitylog:', jLog);

  // ランキング取得テスト
  console.log('Getting rankings');
  const rRank = await doFetch(base + '/api/rankings/points?limit=10', { method: 'GET' }, 'rankings');
  const jRank = await readJson(rRank);
  console.log('rankings:', jRank);

  console.log('Getting my rank');
  const rMyRank = await doFetch(base + '/api/rankings/me', { method: 'GET', headers: {'Authorization':`Bearer ${token}`} }, 'my-rank');
  const jMyRank = await readJson(rMyRank);
  console.log('my-rank:', jMyRank);

  // ダッシュボード取得テスト
  console.log('Getting dashboard');
  const rDash = await doFetch(base + '/api/dashboard', { method: 'GET', headers: {'Authorization':`Bearer ${token}`} }, 'dashboard');
  const jDash = await readJson(rDash);
  console.log('dashboard:', jDash);

  // 実績取得テスト
  console.log('Getting achievements');
  const rAch = await doFetch(base + '/api/achievements', { method: 'GET', headers: {'Authorization':`Bearer ${token}`} }, 'achievements');
  const jAch = await readJson(rAch);
  console.log('achievements:', jAch);

  // --- Assertions for achievements ---
  const assert = (cond, msg) => { if(!cond){ console.error('ASSERT FAIL:', msg); process.exit(1);} };
  try {
    assert(Array.isArray(jAch), 'achievements response should be an array');
    const byCode = new Map(jAch.map(a => [a.code, a]));
    const aTask = byCode.get('first_task');
    const aGacha = byCode.get('first_gacha');
    assert(!!aTask, 'first_task achievement missing');
    assert(!!aGacha, 'first_gacha achievement missing');
    assert(aTask.earned === true, 'first_task should be earned after completing a task');
    assert(aGacha.earned === true, 'first_gacha should be earned after spinning gacha');
    const aBoss = byCode.get('first_boss');
    if (aBoss) {
      // We didn't defeat a boss in this flow; should not be earned yet
      assert(aBoss.earned === false, 'first_boss should not be earned yet in this flow');
    }
  } catch (e) {
    console.error('Assertion error:', e && e.message ? e.message : e);
    process.exit(1);
  }

  // --- Owner-only delete tests for tasks ---
  console.log('Creating task for delete test');
  const rTD = await doFetch(base + '/api/tasks', { method: 'POST', headers: {'Content-Type':'application/json','Authorization':`Bearer ${token}`}, body: JSON.stringify({ title: 'ToDelete', description: 'temp' }) }, 'create-task-delete');
  const jTD = await readJson(rTD);
  console.log('create-task-delete:', jTD);
  const delTaskId = jTD && jTD.id; assert(!!delTaskId, 'failed to create task for delete test');

  console.log('Registering second user for forbidden checks');
  const email2 = `flowB${Date.now()}@example.com`;
  const rReg2 = await doFetch(base + '/api/auth/register', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ email: email2, password: 'Password123', name: 'FlowB' }) }, 'register-2');
  const jReg2 = await readJson(rReg2);
  console.log('register-2:', jReg2);
  const token2 = jReg2 && jReg2.token; assert(!!token2, 'second user token missing');

  console.log('Deleting task with non-owner (should be 403)');
  const rDelForbiddenTask = await doFetch(base + `/api/tasks/${delTaskId}`, { method: 'DELETE', headers: {'Authorization':`Bearer ${token2}`} }, 'delete-task-forbidden');
  const jDelForbiddenTask = await readJson(rDelForbiddenTask);
  console.log('delete-task-forbidden:', rDelForbiddenTask.status, jDelForbiddenTask);
  assert(rDelForbiddenTask.status === 403, 'non-owner task delete should be 403');

  console.log('Deleting task with owner (should be ok)');
  const rDelTask = await doFetch(base + `/api/tasks/${delTaskId}`, { method: 'DELETE', headers: {'Authorization':`Bearer ${token}`} }, 'delete-task');
  const jDelTask = await readJson(rDelTask);
  console.log('delete-task:', jDelTask);
  assert(jDelTask && jDelTask.ok === true, 'owner task delete should return ok:true');

  console.log('Deleting task again (should be 404)');
  const rDelTaskAgain = await doFetch(base + `/api/tasks/${delTaskId}`, { method: 'DELETE', headers: {'Authorization':`Bearer ${token}`} }, 'delete-task-again');
  const jDelTaskAgain = await readJson(rDelTaskAgain);
  console.log('delete-task-again:', rDelTaskAgain.status, jDelTaskAgain);
  assert(rDelTaskAgain.status === 404, 'delete task again should be 404');

  // --- Owner-only delete tests for goals ---
  console.log('Creating goal for delete test');
  const rGD = await doFetch(base + '/api/goals', { method: 'POST', headers: {'Content-Type':'application/json','Authorization':`Bearer ${token}`}, body: JSON.stringify({ title: 'GoalToDelete', description: 'temp' }) }, 'create-goal-delete');
  const jGD = await readJson(rGD);
  console.log('create-goal-delete:', jGD);
  const delGoalId = jGD && jGD.id; assert(!!delGoalId, 'failed to create goal for delete test');

  console.log('Deleting goal with non-owner (should be 403)');
  const rDelForbiddenGoal = await doFetch(base + `/api/goals/${delGoalId}`, { method: 'DELETE', headers: {'Authorization':`Bearer ${token2}`} }, 'delete-goal-forbidden');
  const jDelForbiddenGoal = await readJson(rDelForbiddenGoal);
  console.log('delete-goal-forbidden:', rDelForbiddenGoal.status, jDelForbiddenGoal);
  assert(rDelForbiddenGoal.status === 403, 'non-owner goal delete should be 403');

  console.log('Deleting goal with owner (should be ok)');
  const rDelGoal = await doFetch(base + `/api/goals/${delGoalId}`, { method: 'DELETE', headers: {'Authorization':`Bearer ${token}`} }, 'delete-goal');
  const jDelGoal = await readJson(rDelGoal);
  console.log('delete-goal:', jDelGoal);
  assert(jDelGoal && jDelGoal.ok === true, 'owner goal delete should return ok:true');

  console.log('Deleting goal again (should be 404)');
  const rDelGoalAgain = await doFetch(base + `/api/goals/${delGoalId}`, { method: 'DELETE', headers: {'Authorization':`Bearer ${token}`} }, 'delete-goal-again');
  const jDelGoalAgain = await readJson(rDelGoalAgain);
  console.log('delete-goal-again:', rDelGoalAgain.status, jDelGoalAgain);
  assert(rDelGoalAgain.status === 404, 'delete goal again should be 404');

}

run().catch(e => { console.error('flow error', e && e.message ? e.message : e); process.exit(1); });
