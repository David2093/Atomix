import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { elementList, elements } from '../src/data/elements.js';
import { molecules } from '../src/data/molecules.js';
import { extraMolecules } from '../src/data/extraMolecules.js';
import { glossary } from '../src/data/glossary.js';

const port=31847,base=`http://127.0.0.1:${port}`;
let server,cookies=new Map(),csrf='';
const password='Atomix-Strong-42!';

async function request(path,{method='GET',body:payload,headers={},withoutCsrf=false}={}){
  if(!withoutCsrf&&!['GET','HEAD','OPTIONS'].includes(method)&&!csrf)await request('/api/auth/csrf',{withoutCsrf:true});
  const allHeaders={...headers};
  if(payload!==undefined)allHeaders['Content-Type']='application/json';
  if(cookies.size)allHeaders.Cookie=[...cookies].map(([key,value])=>`${key}=${value}`).join('; ');
  if(!withoutCsrf&&!['GET','HEAD','OPTIONS'].includes(method)&&csrf)allHeaders['X-CSRF-Token']=csrf;
  const response=await fetch(`${base}${path}`,{method,headers:allHeaders,body:payload===undefined?undefined:JSON.stringify(payload)});
  for(const item of response.headers.getSetCookie?.()||[]){const pair=item.split(';',1)[0],index=pair.indexOf('=');if(index<0)continue;const key=pair.slice(0,index),value=pair.slice(index+1);if(/Max-Age=0/i.test(item))cookies.delete(key);else cookies.set(key,value);}
  let data={};try{data=await response.json();}catch{}
  if(data.csrfToken)csrf=data.csrfToken;
  return {response,data};
}
async function waitForServer(){
  for(let attempt=0;attempt<50;attempt++){
    try{const response=await fetch(`${base}/api/health`);if(response.ok)return;}
    catch{}
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  throw new Error('API test server did not start.');
}

before(async()=>{
  server=spawn(process.execPath,['server/index.js'],{cwd:process.cwd(),env:{...process.env,NODE_ENV:'test',PORT:String(port),DATABASE_PATH:':memory:',SESSION_SECRET:'test-session-secret-that-is-long-enough',FRONTEND_ORIGIN:'http://127.0.0.1:5500'},stdio:['ignore','pipe','pipe']});
  let output='';server.stdout.on('data',chunk=>output+=chunk);server.stderr.on('data',chunk=>output+=chunk);
  server.on('exit',code=>{if(code&&code!==null)console.error(`Test API exited with ${code}: ${output}`);});
  await waitForServer();
});
after(()=>{server?.kill();});

test('the scientific catalogs cover the requested reference collections',()=>{
  assert.equal(elementList.length,118);
  assert.equal(new Set(elementList.map(item=>item.symbol)).size,118);
  for(const item of elementList){assert.equal(item.shells.reduce((sum,count)=>sum+count,0),item.number,`${item.symbol} electron shells`);assert.ok(item.config);assert.ok(item.history);assert.ok(item.uses);}
  assert.ok(elements.Fe);
  assert.ok(Object.keys(molecules).length+Object.keys(extraMolecules).length>=12);
  assert.ok(glossary.length>=20);
});

test('the API migrates SQLite and serves seeded courses and editorial content',async()=>{
  const health=await request('/api/health');assert.equal(health.response.status,200);assert.equal(health.data.database,'sqlite');
  const catalog=await request('/api/catalog');assert.equal(catalog.response.status,200);assert.equal(catalog.data.courses.length,6);assert.equal(catalog.data.articles.length,8);
  const course=await request('/api/courses/quantum-states');assert.equal(course.response.status,200);assert.equal(course.data.lessons.length,3);assert.ok(course.data.lessons[0].quiz.length);
});

test('registration validates fields, stores a secure account and opens a persistent session',async()=>{
  const csrfResponse=await request('/api/auth/csrf');assert.equal(csrfResponse.response.status,200);assert.ok(csrfResponse.data.csrfToken);
  const invalid=await request('/api/auth/register',{method:'POST',body:{username:'ab',email:'bad',password:'weak',confirmPassword:'weak'}});assert.equal(invalid.response.status,400);
  const availability=await request('/api/auth/availability?username=orbit_reader');assert.equal(availability.data.available,true);
  const created=await request('/api/auth/register',{method:'POST',body:{username:'orbit_reader',email:'reader@example.test',password,confirmPassword:password}});
  assert.equal(created.response.status,201);assert.equal(created.data.user.username,'orbit_reader');assert.ok(cookies.has('atomix_session'));assert.ok(cookies.has('atomix_csrf'));
  assert.ok(created.response.headers.getSetCookie().some(cookie=>cookie.startsWith('atomix_session=')&&/HttpOnly/i.test(cookie)));
  const me=await request('/api/auth/me');assert.equal(me.response.status,200);assert.equal(me.data.user.email,'reader@example.test');
  const taken=await request('/api/auth/availability?username=orbit_reader');assert.equal(taken.data.available,false);
  const duplicate=await request('/api/auth/register',{method:'POST',body:{username:'orbit_reader',email:'another@example.test',password,confirmPassword:password}});assert.equal(duplicate.response.status,409);
});

test('progress, XP, achievements, favorites and profile changes belong to the signed-in account',async()=>{
  const first=await request('/api/user/progress',{method:'POST',body:{kind:'element',itemKey:'he',completed:true}});assert.equal(first.response.status,200);assert.equal(first.data.profile.user.xp,20);
  await request('/api/user/progress',{method:'POST',body:{kind:'element',itemKey:'he',completed:true}});
  const notices=await request('/api/user/notifications');assert.equal(notices.data.notifications.length,1);assert.equal(notices.data.unreadCount,1);
  const read=await request('/api/user/notifications/read',{method:'POST',body:{}});assert.equal(read.data.markedRead,1);
  const readNotices=await request('/api/user/notifications');assert.ok(readNotices.data.notifications[0].readAt);assert.equal(readNotices.data.unreadCount,0);
  const profile=await request('/api/user/profile');assert.equal(profile.data.stats.elements,1);assert.equal(profile.data.user.xp,20);assert.ok(profile.data.achievements.some(item=>item.key==='first-atom'));
  const favorite=await request('/api/user/favorites',{method:'POST',body:{itemType:'article',itemKey:'inside-the-electron-cloud'}});assert.equal(favorite.response.status,200);assert.equal(favorite.data.saved,true);
  const favorites=await request('/api/user/favorites');assert.equal(favorites.data.favorites.length,1);
  const removed=await request('/api/user/favorites',{method:'POST',body:{itemType:'article',itemKey:'inside-the-electron-cloud'}});assert.equal(removed.data.saved,false);
  const updated=await request('/api/user/profile',{method:'PATCH',body:{username:'orbit_scientist',avatar:'violet',bio:'I study molecular structures.',theme:'contrast',notifications:false}});assert.equal(updated.response.status,200);assert.equal(updated.data.user.username,'orbit_scientist');assert.equal(updated.data.profile.avatar,'violet');assert.equal(updated.data.profile.notifications,0);
  await request('/api/user/progress',{method:'POST',body:{kind:'molecule',itemKey:'water',completed:true}});
  const optedOut=await request('/api/user/notifications');assert.equal(optedOut.data.notifications.length,1);
});

test('course completions and quizzes add fixed server-side XP',async()=>{
  const lesson=await request('/api/user/progress',{method:'POST',body:{kind:'lesson',itemKey:'quantum-states-01',completed:true,xp:999999}});assert.equal(lesson.data.profile.user.xp,150);
  const quiz=await request('/api/user/progress',{method:'POST',body:{kind:'quiz',itemKey:'quantum-states-01',completed:true,xp:999999}});assert.equal(quiz.data.profile.user.xp,210);
  const achievement=await request('/api/user/achievements');assert.ok(achievement.data.achievements.some(item=>item.key==='quantum-pioneer'));
  const progress=await request('/api/user/progress');assert.equal(progress.data.items.filter(item=>item.completed).length,4);
});

test('password recovery links are one-time, and login errors do not disclose account state',async()=>{
  const invalidLogin=await request('/api/auth/login',{method:'POST',body:{email:'reader@example.test',password:'wrong'}});assert.equal(invalidLogin.response.status,401);
  const recovery=await request('/api/auth/forgot-password',{method:'POST',body:{email:'reader@example.test'}});assert.equal(recovery.response.status,200);assert.ok(recovery.data.developmentResetLink);
  const token=new URL(recovery.data.developmentResetLink).searchParams.get('token');
  const reset=await request('/api/auth/reset-password',{method:'POST',body:{token,password:'New-Atomix-58!',confirmPassword:'New-Atomix-58!'}});assert.equal(reset.response.status,200);
  const reused=await request('/api/auth/reset-password',{method:'POST',body:{token,password:'New-Atomix-58!',confirmPassword:'New-Atomix-58!'}});assert.equal(reused.response.status,400);
  const oldPassword=await request('/api/auth/login',{method:'POST',body:{email:'reader@example.test',password}});assert.equal(oldPassword.response.status,401);
  const newPassword=await request('/api/auth/login',{method:'POST',body:{email:'reader@example.test',password:'New-Atomix-58!'}});assert.equal(newPassword.response.status,200);
  const logout=await request('/api/auth/logout',{method:'POST',body:{}});assert.equal(logout.response.status,200);assert.ok(!cookies.has('atomix_session'));
  const protectedProfile=await request('/api/user/profile');assert.equal(protectedProfile.response.status,401);
});

test('state-changing routes reject requests without a CSRF token',async()=>{
  cookies.clear();csrf='';
  const response=await request('/api/auth/register',{method:'POST',withoutCsrf:true,body:{username:'unsafe',email:'unsafe@example.test',password,confirmPassword:password}});assert.equal(response.response.status,403);
});
