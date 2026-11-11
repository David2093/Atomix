import { createServer } from 'node:http';
import { createHmac, randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const scrypt = promisify(scryptCallback);
loadEnv(resolve(root, '.env'));

const port = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === 'production';
const frontendOrigin = process.env.FRONTEND_ORIGIN || '';
const sessionSecret = process.env.SESSION_SECRET || 'atomix-development-only-session-secret';
if (isProduction && (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32)) throw new Error('SESSION_SECRET must contain at least 32 characters in production.');
const configuredDbPath=process.env.DATABASE_PATH||'./data/atomix.sqlite';
const dbPath=configuredDbPath===':memory:'?configuredDbPath:resolve(root,configuredDbPath);
if(dbPath!==':memory:')mkdirSync(dirname(dbPath),{recursive:true});
const db = new DatabaseSync(dbPath);
db.exec(readFileSync(resolve(here, 'migrations/001_initial.sql'), 'utf8'));
db.exec(readFileSync(resolve(here, 'migrations/002_seed_content.sql'), 'utf8'));
db.exec(readFileSync(resolve(here, 'migrations/003_notifications.sql'), 'utf8'));
db.exec('PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 3000;');

const sessions = db.prepare(`SELECT s.token_hash,s.user_id,s.csrf_token,s.expires_at,u.username,u.email,u.created_at
  FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=?`);
const rateBuckets = new Map();
const COOKIE_SESSION = 'atomix_session';
const COOKIE_CSRF = 'atomix_csrf';
const LEVELS = [[0,'NOVICE'],[150,'RESEARCHER'],[500,'SCIENTIST'],[1000,'PHYSICIST'],[1800,'QUANTUM MASTER']];
const XP_BY_KIND = { element: 20, molecule: 30, lesson: 100, article: 25, quiz: 60 };
const ACHIEVEMENTS = {
  'first-atom': ['First Atom','Study your first chemical element.'],
  'molecule-explorer': ['Molecule Explorer','Explore your first molecular structure.'],
  'quantum-pioneer': ['Quantum Pioneer','Complete a quantum mechanics lesson.'],
  'particle-master': ['Particle Master','Complete a particle physics lesson.'],
  'science-enthusiast': ['Science Enthusiast','Earn 500 experience points.'],
};

function loadEnv(path) {
  try {
    for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!match || Object.hasOwn(process.env, match[1])) continue;
      process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2');
    }
  } catch {}
}

function hash(value) { return createHmac('sha256',sessionSecret).update(value).digest('hex'); }
function cookieOptions({ httpOnly = false, maxAge = 60 * 60 * 24 * 30 } = {}) {
  return `Path=/; SameSite=Lax; Max-Age=${maxAge}${httpOnly ? '; HttpOnly' : ''}${isProduction ? '; Secure' : ''}`;
}
function setCookie(res, name, value, options = {}) { const cookie=`${name}=${encodeURIComponent(value)}; ${cookieOptions(options)}`;const current=res.getHeader('Set-Cookie');res.setHeader('Set-Cookie',current==null?cookie:[...(Array.isArray(current)?current:[current]),cookie]); }
function readCookies(req) {
  return Object.fromEntries((req.headers.cookie || '').split(';').map(part => part.trim().split(/=(.*)/s).slice(0, 2)).filter(([key]) => key));
}
function allowedOrigin(origin) {
  if (!origin) return true;
  if (frontendOrigin && origin === frontendOrigin) return true;
  try {
    const url = new URL(origin);
    return !isProduction&&['localhost','127.0.0.1','[::1]'].includes(url.hostname)&&['http:','https:'].includes(url.protocol);
  } catch { return false; }
}
function headers(req, res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cache-Control', 'no-store');
  const origin = req.headers.origin;
  if (origin && allowedOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-CSRF-Token');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
}
function json(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(body) });
  res.end(body);
}
async function body(req) {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 1024 * 1024) throw Object.assign(new Error('Request body is too large.'), { status: 413 });
  }
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { throw Object.assign(new Error('Request body must be valid JSON.'), { status: 400 }); }
}
function limited(req, key, max = 8, windowMs = 15 * 60 * 1000) {
  const now = Date.now(), ip = req.socket.remoteAddress || 'unknown';
  const id = `${key}:${ip}`;
  const current = rateBuckets.get(id);
  if (!current || current.until <= now) rateBuckets.set(id, { count: 1, until: now + windowMs });
  else current.count++;
  const bucket = rateBuckets.get(id);
  if (bucket.count > max) throw Object.assign(new Error('Too many attempts. Please try again later.'), { status: 429 });
  if (rateBuckets.size > 5000) for (const [token, value] of rateBuckets) if (value.until <= now) rateBuckets.delete(token);
}
function currentSession(req) {
  const raw = readCookies(req)[COOKIE_SESSION];
  if (!raw) return null;
  const session = sessions.get(hash(decodeURIComponent(raw)));
  if (!session || session.expires_at < Date.now()) {
    if (session) db.prepare('DELETE FROM sessions WHERE token_hash=?').run(session.token_hash);
    return null;
  }
  return session;
}
function requireSession(session) {
  if (!session) throw Object.assign(new Error('Please sign in to continue.'), { status: 401, code: 'AUTH_REQUIRED' });
}
function requireCsrf(req, session = null) {
  const cookies = readCookies(req);
  const cookie = decodeURIComponent(cookies[COOKIE_CSRF] || '');
  const header = req.headers['x-csrf-token'] || '';
  const expected = session?.csrf_token || cookie;
  if (!cookie || !header || cookie !== header || expected !== header) {
    throw Object.assign(new Error('Your session security token expired. Reload the page and try again.'), { status: 403, code: 'CSRF_INVALID' });
  }
}
function publicUser(session) {
  const xp = db.prepare('SELECT COALESCE(SUM(xp),0) AS xp FROM user_progress WHERE user_id=?').get(session.user_id).xp;
  const level = [...LEVELS].reverse().find(([threshold]) => xp >= threshold);
  const next = LEVELS.find(([threshold]) => threshold > xp);
  return { id: session.user_id, username: session.username, email: session.email, createdAt: session.created_at, xp, level: level[1], nextLevelXp: next?.[0] ?? null };
}
function createSession(res, userId) {
  const token = randomBytes(32).toString('base64url');
  const tokenHash = hash(token), csrf = randomBytes(32).toString('base64url'), expires = Date.now() + 14 * 24 * 60 * 60 * 1000;
  db.prepare('INSERT INTO sessions(token_hash,user_id,csrf_token,expires_at) VALUES(?,?,?,?)').run(tokenHash, userId, csrf, expires);
  setCookie(res, COOKIE_SESSION, token, { httpOnly: true, maxAge: 14 * 24 * 60 * 60 });
  setCookie(res, COOKIE_CSRF, csrf, { maxAge: 14 * 24 * 60 * 60 });
  return sessions.get(tokenHash);
}
function publicProfile(session) {
  const profile = db.prepare('SELECT avatar,bio,theme,notifications FROM user_profiles WHERE user_id=?').get(session.user_id) || {};
  const counts = db.prepare(`SELECT
    SUM(CASE WHEN kind='element' AND completed=1 THEN 1 ELSE 0 END) AS elements,
    SUM(CASE WHEN kind='molecule' AND completed=1 THEN 1 ELSE 0 END) AS molecules,
    SUM(CASE WHEN kind='lesson' AND completed=1 THEN 1 ELSE 0 END) AS lessons
    FROM user_progress WHERE user_id=?`).get(session.user_id);
  const activity = db.prepare('SELECT kind,item_key,completed,xp,updated_at FROM user_progress WHERE user_id=? ORDER BY updated_at DESC LIMIT 8').all(session.user_id);
  const favorites = db.prepare('SELECT item_type,item_key,created_at FROM user_favorites WHERE user_id=? ORDER BY created_at DESC LIMIT 8').all(session.user_id);
  const achievements = db.prepare('SELECT achievement_key,earned_at FROM user_achievements WHERE user_id=? ORDER BY earned_at DESC').all(session.user_id).map(item => ({ key: item.achievement_key, title: ACHIEVEMENTS[item.achievement_key]?.[0], description: ACHIEVEMENTS[item.achievement_key]?.[1], earnedAt: item.earned_at }));
  return { user: publicUser(session), profile, stats: { elements: counts.elements || 0, molecules: counts.molecules || 0, lessons: counts.lessons || 0 }, activity, favorites, achievements };
}
function ensureAchievements(userId, kind, xp) {
  const completed = (type) => db.prepare('SELECT COUNT(*) AS count FROM user_progress WHERE user_id=? AND kind=? AND completed=1').get(userId,type).count;
  const userXp = db.prepare('SELECT COALESCE(SUM(xp),0) AS total FROM user_progress WHERE user_id=?').get(userId).total;
  const awards = [];
  if (completed('element') > 0) awards.push('first-atom');
  if (completed('molecule') > 0) awards.push('molecule-explorer');
  if (kind === 'lesson' && db.prepare("SELECT item_key FROM user_progress WHERE user_id=? AND kind='lesson' AND completed=1").all(userId).some(row => row.item_key.startsWith('quantum-states-'))) awards.push('quantum-pioneer');
  if (kind === 'lesson' && db.prepare("SELECT item_key FROM user_progress WHERE user_id=? AND kind='lesson' AND completed=1").all(userId).some(row => row.item_key.startsWith('particle-zoo-'))) awards.push('particle-master');
  if (userXp >= 500) awards.push('science-enthusiast');
  for (const key of awards) db.prepare('INSERT OR IGNORE INTO user_achievements(user_id,achievement_key) VALUES(?,?)').run(userId,key);
}
function validPassword(value) { return typeof value === 'string' && value.length >= 10 && /[a-z]/.test(value) && /[A-Z]/.test(value) && /\d/.test(value) && /[^A-Za-z0-9]/.test(value); }
async function passwordHash(password) {
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  return `scrypt$${salt.toString('hex')}$${Buffer.from(derived).toString('hex')}`;
}
async function verifyPassword(password, encoded) {
  const [algorithm, saltHex, digestHex] = encoded.split('$');
  if (algorithm !== 'scrypt') return false;
  const digest = Buffer.from(digestHex, 'hex');
  const actual = Buffer.from(await scrypt(password, Buffer.from(saltHex, 'hex'), digest.length, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }));
  return digest.length === actual.length && timingSafeEqual(digest, actual);
}
async function sendResetEmail(email, resetUrl) {
  const smtpHost = process.env.SMTP_HOST;
  if (!smtpHost) {
    if (!isProduction) console.info(`[ATOMIX development password reset] ${email}: ${resetUrl}`);
    return false;
  }
  const { default: nodemailer } = await import('nodemailer');
  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined,
  });
  await transporter.sendMail({ from: process.env.SMTP_FROM || 'ATOMIX <no-reply@example.com>', to: email, subject: 'Reset your ATOMIX password', text: `Use this one-time link within one hour:\n\n${resetUrl}\n\nIf you did not request this message, you can ignore it.` });
  return true;
}

const server = createServer(async (req, res) => {
  headers(req, res);
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  if (req.headers.origin && !allowedOrigin(req.headers.origin)) return json(res, 403, { error: 'This website origin is not allowed.' });
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  if (!url.pathname.startsWith('/api/')) return json(res, 404, { error: 'API route not found.' });
  const session = currentSession(req);
  try {
    const path = url.pathname;
    if (req.method === 'GET' && path === '/api/health') return json(res, 200, { ok: true, database: 'sqlite', timestamp: new Date().toISOString() });
    if (req.method === 'GET' && path === '/api/auth/csrf') {
      const csrf = session?.csrf_token || randomBytes(32).toString('base64url');
      setCookie(res, COOKIE_CSRF, csrf, { maxAge: session ? 14 * 24 * 60 * 60 : 60 * 60 });
      return json(res, 200, { csrfToken: csrf });
    }
    if (req.method === 'GET' && path === '/api/auth/availability') {
      const username = (url.searchParams.get('username') || '').trim();
      if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) return json(res, 200, { available: false, reason: 'Use 3–20 letters, numbers or underscores.' });
      return json(res, 200, { available: !db.prepare('SELECT 1 FROM users WHERE username=? COLLATE NOCASE').get(username) });
    }
    if (req.method === 'POST' && path === '/api/auth/register') {
      limited(req,'register',6); requireCsrf(req);
      const data = await body(req), username = String(data.username || '').trim(), email = String(data.email || '').trim().toLowerCase(), password = data.password;
      if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) throw Object.assign(new Error('Username must be 3–20 characters using letters, numbers or underscores.'), { status: 400 });
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw Object.assign(new Error('Enter a valid email address.'), { status: 400 });
      if (!validPassword(password)) throw Object.assign(new Error('Use at least 10 characters with upper and lower case letters, a number and a symbol.'), { status: 400 });
      if (password !== data.confirmPassword) throw Object.assign(new Error('The passwords do not match.'), { status: 400 });
      if (db.prepare('SELECT 1 FROM users WHERE username=? COLLATE NOCASE').get(username)) throw Object.assign(new Error('That username is already taken.'), { status: 409, code: 'USERNAME_TAKEN' });
      if (db.prepare('SELECT 1 FROM users WHERE email=? COLLATE NOCASE').get(email)) throw Object.assign(new Error('An account already uses that email.'), { status: 409, code: 'EMAIL_TAKEN' });
      const id = randomUUID(), encoded = await passwordHash(password);
      db.prepare('INSERT INTO users(id,username,email,password_hash) VALUES(?,?,?,?)').run(id,username,email,encoded);
      db.prepare('INSERT INTO user_profiles(user_id) VALUES(?)').run(id);
      const created = createSession(res,id);
      return json(res, 201, { user: publicUser(created), csrfToken: created.csrf_token });
    }
    if (req.method === 'POST' && path === '/api/auth/login') {
      limited(req,'login',8); requireCsrf(req);
      const data = await body(req), email = String(data.email || '').trim().toLowerCase();
      const user = db.prepare('SELECT id,username,email,created_at,password_hash FROM users WHERE email=? COLLATE NOCASE').get(email);
      const valid = user ? await verifyPassword(String(data.password || ''),user.password_hash) : false;
      if (!valid) throw Object.assign(new Error('Email or password is incorrect.'), { status: 401, code: 'INVALID_CREDENTIALS' });
      const created = createSession(res,user.id);
      return json(res, 200, { user: publicUser(created), csrfToken: created.csrf_token });
    }
    if (req.method === 'POST' && path === '/api/auth/logout') {
      requireSession(session); requireCsrf(req,session);
      db.prepare('DELETE FROM sessions WHERE token_hash=?').run(session.token_hash);
      setCookie(res,COOKIE_SESSION,'',{ httpOnly:true,maxAge:0 }); setCookie(res,COOKIE_CSRF,'',{ maxAge:0 });
      return json(res,200,{ ok:true });
    }
    if (req.method === 'GET' && path === '/api/auth/me') {
      if(!session)return json(res,200,{authenticated:false,user:null});
      return json(res,200,{ ...publicProfile(session), authenticated:true, csrfToken:session.csrf_token });
    }
    if (req.method === 'POST' && path === '/api/auth/forgot-password') {
      limited(req,'forgot-password',5); requireCsrf(req);
      const data = await body(req), email = String(data.email || '').trim().toLowerCase();
      const user = db.prepare('SELECT id,email FROM users WHERE email=? COLLATE NOCASE').get(email);
      if (user) {
        const token = randomBytes(32).toString('base64url');
        db.prepare('INSERT INTO password_resets(token_hash,user_id,expires_at) VALUES(?,?,?)').run(hash(token),user.id,Date.now()+60*60*1000);
        const origin = process.env.PUBLIC_APP_URL || `http://localhost:5500`;
        const resetLink=`${origin.replace(/\/$/,'')}/forgot-password?token=${encodeURIComponent(token)}`;
        const delivered=await sendResetEmail(user.email,resetLink);
        return json(res,200,{ok:true,message:'If an account uses that email, a reset link is on its way.',...(!isProduction&&!delivered?{developmentResetLink:resetLink}:{})});
      }
      return json(res,200,{ ok:true,message:'If an account uses that email, a reset link is on its way.' });
    }
    if (req.method === 'POST' && path === '/api/auth/reset-password') {
      limited(req,'reset-password',6); requireCsrf(req);
      const data = await body(req), token = String(data.token || ''), password = data.password;
      if (!token) throw Object.assign(new Error('The reset link is missing or invalid.'),{status:400});
      if (!validPassword(password)) throw Object.assign(new Error('Use at least 10 characters with upper and lower case letters, a number and a symbol.'),{status:400});
      if (password !== data.confirmPassword) throw Object.assign(new Error('The passwords do not match.'),{status:400});
      const reset = db.prepare('SELECT token_hash,user_id FROM password_resets WHERE token_hash=? AND expires_at>? AND used_at IS NULL').get(hash(token),Date.now());
      if (!reset) throw Object.assign(new Error('This reset link has expired or was already used.'),{status:400});
      const encoded = await passwordHash(password);
      db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(encoded,reset.user_id);
      db.prepare('UPDATE password_resets SET used_at=strftime(\'%Y-%m-%dT%H:%M:%fZ\',\'now\') WHERE token_hash=?').run(reset.token_hash);
      db.prepare('DELETE FROM sessions WHERE user_id=?').run(reset.user_id);
      return json(res,200,{ok:true});
    }

    if (path.startsWith('/api/user/')) { requireSession(session); }
    if (req.method === 'GET' && path === '/api/user/profile') return json(res,200,publicProfile(session));
    if (req.method === 'PATCH' && path === '/api/user/profile') {
      requireCsrf(req,session); const data = await body(req);
      const username = data.username == null ? session.username : String(data.username).trim();
      const avatar = data.avatar == null ? 'cyan' : String(data.avatar);
      const bio = data.bio == null ? '' : String(data.bio).trim();
      const theme = data.theme == null ? 'midnight' : String(data.theme);
      const notifications = data.notifications == null ? 1 : (data.notifications ? 1 : 0);
      if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) throw Object.assign(new Error('Username must be 3–20 characters using letters, numbers or underscores.'),{status:400});
      if (!['cyan','violet','acid','coral'].includes(avatar)) throw Object.assign(new Error('Choose one of the available avatar colors.'),{status:400});
      if (bio.length>180 || !['midnight','contrast'].includes(theme)) throw Object.assign(new Error('Profile settings are not valid.'),{status:400});
      if (db.prepare('SELECT 1 FROM users WHERE username=? COLLATE NOCASE AND id<>?').get(username,session.user_id)) throw Object.assign(new Error('That username is already taken.'),{status:409});
      db.prepare('UPDATE users SET username=? WHERE id=?').run(username,session.user_id);
      db.prepare('UPDATE user_profiles SET avatar=?,bio=?,theme=?,notifications=? WHERE user_id=?').run(avatar,bio,theme,notifications,session.user_id);
      const fresh = sessions.get(session.token_hash);
      return json(res,200,publicProfile(fresh));
    }
    if (req.method === 'PATCH' && path === '/api/user/password') {
      requireCsrf(req,session); const data=await body(req), user=db.prepare('SELECT password_hash FROM users WHERE id=?').get(session.user_id);
      if (!await verifyPassword(String(data.currentPassword||''),user.password_hash)) throw Object.assign(new Error('Current password is incorrect.'),{status:400});
      if (!validPassword(data.password)) throw Object.assign(new Error('Use at least 10 characters with upper and lower case letters, a number and a symbol.'),{status:400});
      if (data.password!==data.confirmPassword) throw Object.assign(new Error('The passwords do not match.'),{status:400});
      db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(await passwordHash(data.password),session.user_id);
      db.prepare('DELETE FROM sessions WHERE user_id=? AND token_hash<>?').run(session.user_id,session.token_hash);
      return json(res,200,{ok:true});
    }
    if (req.method === 'GET' && path === '/api/user/progress') {
      return json(res,200,{ items:db.prepare('SELECT kind,item_key AS itemKey,completed,xp,updated_at AS updatedAt FROM user_progress WHERE user_id=? ORDER BY updated_at DESC').all(session.user_id) });
    }
    if (req.method === 'POST' && path === '/api/user/progress') {
      requireCsrf(req,session); const data=await body(req), kind=String(data.kind||''), itemKey=String(data.itemKey||'');
      if (!Object.hasOwn(XP_BY_KIND,kind) || !/^[a-z0-9][a-z0-9:_-]{0,100}$/i.test(itemKey)) throw Object.assign(new Error('Progress item is not valid.'),{status:400});
      const completed = data.completed === false ? 0 : 1;
      const xp = completed ? XP_BY_KIND[kind] : 0;
      const wasCompleted=Boolean(db.prepare('SELECT completed FROM user_progress WHERE user_id=? AND kind=? AND item_key=?').get(session.user_id,kind,itemKey)?.completed);
      db.prepare(`INSERT INTO user_progress(user_id,kind,item_key,completed,xp) VALUES(?,?,?,?,?)
        ON CONFLICT(user_id,kind,item_key) DO UPDATE SET completed=MAX(user_progress.completed,excluded.completed),xp=MAX(user_progress.xp,excluded.xp),updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')`).run(session.user_id,kind,itemKey,completed,xp);
      ensureAchievements(session.user_id,kind,xp);
      if(completed&&!wasCompleted&&db.prepare('SELECT notifications FROM user_profiles WHERE user_id=?').get(session.user_id)?.notifications){
        const labels={element:'element',molecule:'molecular structure',lesson:'lesson',article:'science story',quiz:'knowledge check'};
        db.prepare('INSERT INTO user_notifications(user_id,kind,title,message) VALUES(?,?,?,?)').run(session.user_id,kind,`You explored a ${labels[kind]}.`,`${itemKey.replaceAll('-',' ')} has been added to your learning activity.`);
      }
      return json(res,200,{profile:publicProfile(sessions.get(session.token_hash))});
    }
    if (req.method === 'GET' && path === '/api/user/achievements') {
      const achievements=db.prepare('SELECT achievement_key,earned_at FROM user_achievements WHERE user_id=? ORDER BY earned_at DESC').all(session.user_id).map(row=>({key:row.achievement_key,title:ACHIEVEMENTS[row.achievement_key]?.[0],description:ACHIEVEMENTS[row.achievement_key]?.[1],earnedAt:row.earned_at}));
      return json(res,200,{achievements});
    }
    if (req.method === 'GET' && path === '/api/user/notifications') {
      const notifications=db.prepare('SELECT id,kind,title,message,created_at AS createdAt,read_at AS readAt FROM user_notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 30').all(session.user_id);
      return json(res,200,{notifications,unreadCount:notifications.filter(item=>!item.readAt).length});
    }
    if (req.method === 'POST' && path === '/api/user/notifications/read') {
      requireCsrf(req,session);
      const result=db.prepare("UPDATE user_notifications SET read_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE user_id=? AND read_at IS NULL").run(session.user_id);
      return json(res,200,{ok:true,markedRead:result.changes});
    }
    if (req.method === 'GET' && path === '/api/user/favorites') return json(res,200,{favorites:db.prepare('SELECT item_type AS itemType,item_key AS itemKey,created_at AS createdAt FROM user_favorites WHERE user_id=? ORDER BY created_at DESC').all(session.user_id)});
    if (req.method === 'POST' && path === '/api/user/favorites') {
      requireCsrf(req,session); const data=await body(req), type=String(data.itemType||''), key=String(data.itemKey||'');
      if (!['article','element','molecule','course'].includes(type) || !/^[a-z0-9][a-z0-9:_-]{0,100}$/i.test(key)) throw Object.assign(new Error('Favorite item is not valid.'),{status:400});
      const existing=db.prepare('SELECT 1 FROM user_favorites WHERE user_id=? AND item_type=? AND item_key=?').get(session.user_id,type,key);
      if (existing) db.prepare('DELETE FROM user_favorites WHERE user_id=? AND item_type=? AND item_key=?').run(session.user_id,type,key);
      else db.prepare('INSERT INTO user_favorites(user_id,item_type,item_key) VALUES(?,?,?)').run(session.user_id,type,key);
      return json(res,200,{saved:!existing});
    }
    if (req.method === 'GET' && path === '/api/catalog') {
      const courses=db.prepare('SELECT id,title,category,level,description,duration_minutes AS durationMinutes,accent FROM courses ORDER BY rowid').all();
      const articles=db.prepare('SELECT id,title,category,excerpt,body,read_minutes AS readMinutes,published_at AS publishedAt,accent FROM articles ORDER BY published_at DESC').all();
      return json(res,200,{courses,articles});
    }
    if (req.method === 'GET' && path.startsWith('/api/courses/')) {
      const id=decodeURIComponent(path.slice('/api/courses/'.length));
      const course=db.prepare('SELECT id,title,category,level,description,duration_minutes AS durationMinutes,accent FROM courses WHERE id=?').get(id);
      if (!course) return json(res,404,{error:'Course not found.'});
      const lessons=db.prepare('SELECT id,title,summary,body,position,quiz_json AS quizJson FROM lessons WHERE course_id=? ORDER BY position').all(id).map(({quizJson,...item})=>({...item,quiz:JSON.parse(quizJson)}));
      return json(res,200,{course,lessons});
    }
    if (req.method === 'GET' && path === '/api/articles') return json(res,200,{articles:db.prepare('SELECT id,title,category,excerpt,body,read_minutes AS readMinutes,published_at AS publishedAt,accent FROM articles ORDER BY published_at DESC').all()});
    return json(res,404,{error:'API route not found.'});
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') return json(res,409,{error:'That username or email is already in use.'});
    const status=error.status || 500;
    if (status>=500) console.error('[ATOMIX API]',error);
    return json(res,status,{error:status>=500?'The server could not complete that request.':error.message,code:error.code});
  }
});

server.listen(port,'0.0.0.0',()=>console.info(`ATOMIX API ready at http://localhost:${port} · SQLite ${dbPath}`));
server.on('close',()=>db.close());
for (const signal of ['SIGINT','SIGTERM']) process.on(signal,()=>server.close(()=>process.exit(0)));
