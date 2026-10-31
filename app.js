import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut, setPersistence, browserLocalPersistence } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';

const CONFIG = window.GYMTRACK_CONFIG || {};
const API_URL = String(CONFIG.appsScriptUrl || '').trim();
const FIREBASE_CONFIG = CONFIG.firebase || {};
const FIREBASE_READY = !!(FIREBASE_CONFIG.apiKey && !String(FIREBASE_CONFIG.apiKey).includes('CONFIGURAR') && FIREBASE_CONFIG.projectId && !String(FIREBASE_CONFIG.projectId).includes('TU-PROYECTO') && FIREBASE_CONFIG.appId && !String(FIREBASE_CONFIG.appId).includes('CONFIGURAR'));
const API_READY = !!(API_URL.startsWith('https://script.google.com/macros/s/') && API_URL.endsWith('/exec'));
let auth = null;
let currentUser = null;
let appData = null;
let adminData = null;
let selectedRoutineDay = '';
const PAGE_VIEW = { 'index.html':'dashboard', 'control-corporal.html':'body', 'evolt.html':'evolt', 'administracion.html':'admin', 'login.html':'login' };
const PAGE_FILE = { dashboard:'index.html', routine:'index.html', body:'control-corporal.html', evolt:'evolt.html', admin:'administracion.html' };
const PAGE_NAME = location.pathname.split('/').pop() || 'index.html';
let currentView = PAGE_VIEW[PAGE_NAME] || 'dashboard';
let toastTimer = null;

const $ = id => document.getElementById(id);
const MEASURES = [
  ['heightCm','Estatura','cm'],['weightKg','Peso','kg'],['neckCm','Cuello','cm'],['shouldersCm','Hombros','cm'],['chestCm','Pecho','cm'],['underbustCm','Bajo pecho','cm'],['waistCm','Cintura','cm'],['abdomenCm','Abdomen bajo','cm'],['hipsCm','Cadera / glúteos','cm'],['armCm','Brazo','cm'],['forearmCm','Antebrazo','cm'],['wristCm','Muñeca','cm'],['thighCm','Muslo','cm'],['kneeCm','Rodilla','cm'],['calfCm','Pantorrilla','cm'],['ankleCm','Tobillo','cm']
];
const EVOLT_FIELDS = ['edad','estaturaCm','pesoKg','bwi','masaMuscularEsqueleticaKg','masaMagraKg','aguaCorporalL','bmrKcal','teeKcal','grasaPct','masaGrasaKg','grasaSubcutaneaKg','grasaVisceralNivel','areaGrasaVisceralCm2','cinturaCm','ratioCinturaCadera'];
const EVOLT_REFERENCE = { edad:21, estaturaCm:171, pesoKg:77.7, bwi:7.7, masaMuscularEsqueleticaKg:33.2, masaMagraKg:59.8, aguaCorporalL:43.1, bmrKcal:1661, teeKcal:2557, grasaPct:23.0, masaGrasaKg:17.9, grasaSubcutaneaKg:15.5, grasaVisceralNivel:8, areaGrasaVisceralCm2:71, cinturaCm:89.9, ratioCinturaCadera:0.85 };

if (FIREBASE_READY) {
  try { auth = getAuth(initializeApp(FIREBASE_CONFIG)); }
  catch (error) { console.error(error); }
}

function goToView(view) {
  const target = PAGE_FILE[view] || 'index.html';
  if (target !== PAGE_NAME) { location.href = target; return; }
  setView(view);
}

function showSetupNotice() {
  const issues = [];
  if (!API_READY) issues.push('Revisa appsScriptUrl en firebase-config.js.');
  if (!FIREBASE_READY) issues.push('Completa la configuración web de Firebase en firebase-config.js.');
  if (issues.length) {
    $('setupNotice').textContent = 'Configuración pendiente: ' + issues.join(' ');
    $('setupNotice').classList.remove('hidden');
    $('loginBtn').disabled = true;
    $('authMessage').textContent = 'Consulta README.md para configurar Firebase y Apps Script antes de iniciar sesión.';
  }
}
showSetupNotice();

let authStateVersion = 0;

function revealLogin(message = '') {
  $('authScreen').classList.remove('hidden');
  $('appScreen').classList.add('hidden');
  if (message) $('authMessage').textContent = message;
  document.body.classList.remove('auth-pending');
}

function showAuthenticatedLoadError(error, user, version) {
  // La autenticación Firebase sigue activa: un fallo temporal del backend
  // nunca debe cerrar la sesión ni enviar al usuario al login.
  $('authScreen').classList.add('hidden');
  $('appScreen').classList.remove('hidden');
  document.querySelectorAll('.view-section').forEach(section => section.classList.add('hidden'));

  const main = document.querySelector('.main-content');
  let panel = $('authBootstrapError');
  if (!panel) {
    panel = document.createElement('article');
    panel.id = 'authBootstrapError';
    panel.className = 'panel auth-load-error';
    const footer = document.querySelector('.app-footer');
    main.insertBefore(panel, footer || null);
  }

  panel.innerHTML = `
    <div class="auth-load-error-icon">!</div>
    <p class="eyebrow">SESIÓN ACTIVA</p>
    <h2>No se pudieron cargar tus datos</h2>
    <p class="auth-load-error-message"></p>
    <p class="muted">Tu cuenta continúa conectada. Puedes volver a intentarlo sin ingresar nuevamente tu contraseña.</p>
    <div class="auth-load-error-actions">
      <button id="retryBootstrapBtn" class="btn btn-primary" type="button">Reintentar conexión</button>
      <button id="logoutFromErrorBtn" class="btn btn-secondary" type="button">Cerrar sesión</button>
    </div>`;
  panel.querySelector('.auth-load-error-message').textContent =
    error && error.message ? error.message : 'No fue posible comunicarse con el servidor.';

  $('appNav').style.pointerEvents = 'none';
  $('appNav').style.opacity = '.45';
  document.body.classList.remove('auth-pending');

  $('retryBootstrapBtn').addEventListener('click', () => bootstrapAuthenticatedUser(user, version));
  $('logoutFromErrorBtn').addEventListener('click', async () => {
    try { await signOut(auth); } catch (signOutError) { console.error(signOutError); }
  });
}

async function bootstrapAuthenticatedUser(user, version) {
  currentUser = user;
  try {
    document.body.classList.add('busy');
    const data = await api('bootstrap');
    if (version !== authStateVersion || !auth.currentUser) return;
    if (!data || !data.profile) throw new Error('El servidor respondió, pero no devolvió el perfil del usuario.');

    appData = data;
    if (PAGE_NAME === 'login.html') {
      location.replace('index.html');
      return;
    }
    if (PAGE_NAME === 'administracion.html' && !['admin','administrador'].includes(appData.profile.rol)) {
      location.replace('index.html');
      return;
    }

    selectedRoutineDay = appData.todayDay;
    renderAll();
    $('authScreen').classList.add('hidden');
    $('appScreen').classList.remove('hidden');
    $('authMessage').textContent = '';
    $('appNav').style.pointerEvents = '';
    $('appNav').style.opacity = '';
    const oldError = $('authBootstrapError');
    if (oldError) oldError.remove();

    if (appData.profile.rol === 'admin' || appData.profile.rol === 'administrador') $('adminNavBtn').classList.remove('hidden');
    else $('adminNavBtn').classList.add('hidden');
    setView(currentView === 'login' ? 'dashboard' : currentView);
    document.body.classList.remove('auth-pending');
  } catch (error) {
    if (version !== authStateVersion) return;
    console.error('No se pudieron cargar los datos de GymTrack:', error);
    showAuthenticatedLoadError(error, user, version);
  } finally {
    document.body.classList.remove('busy');
  }
}

if (auth) {
  setPersistence(auth, browserLocalPersistence)
    .then(() => onAuthStateChanged(auth, user => {
      const version = ++authStateVersion;
      currentUser = user;
      if (!user) {
        appData = null;
        $('appScreen').classList.add('hidden');
        $('authScreen').classList.remove('hidden');
        $('appNav').style.pointerEvents = '';
        $('appNav').style.opacity = '';
        document.body.classList.remove('auth-pending');
        if (PAGE_NAME !== 'login.html') location.replace('login.html');
        return;
      }
      bootstrapAuthenticatedUser(user, version);
    }))
    .catch(error => {
      console.error('No se pudo restaurar la sesión Firebase:', error);
      revealLogin('No se pudo restaurar la sesión. Verifica que el navegador permita el almacenamiento local e inténtalo de nuevo.');
    });
} else {
  revealLogin();
}

$('loginForm').addEventListener('submit', async event => {
  event.preventDefault();
  if (!auth || !API_READY) return showToast('Completa la configuración indicada en README.md.', 'error');
  const email = $('loginEmail').value.trim();
  const password = $('loginPassword').value;
  $('loginBtn').disabled = true;
  $('authMessage').textContent = 'Iniciando sesión…';
  try {
    await signInWithEmailAndPassword(auth, email, password);
    $('loginPassword').value = '';
    $('authMessage').textContent = '';
  } catch (error) {
    $('authMessage').textContent = translateFirebaseError(error);
  } finally { $('loginBtn').disabled = false; }
});

$('logoutBtn').addEventListener('click', async () => {
  if (auth) await signOut(auth);
  currentUser = null;
  appData = null;
  currentView = 'dashboard';
  location.href = 'login.html';
});

async function api(action, payload = {}) {
  if (!API_READY) throw new Error('Configura la URL de Apps Script en firebase-config.js.');
  if (!currentUser && action !== 'health') throw new Error('Inicia sesión para continuar.');
  const idToken = currentUser ? await currentUser.getIdToken() : '';
  const requestId = makeRequestId();
  const body = { action, payload, idToken, requestId };
  try {
    await fetch(API_URL, {
      method: 'POST', mode: 'no-cors', cache: 'no-store',
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      body: JSON.stringify(body)
    });
  } catch (error) {
    // El modo no-cors no expone el cuerpo de respuesta. El resultado se consulta por requestId.
  }
  return pollResult(requestId, 0);
}

function pollResult(requestId, attempt) {
  return new Promise((resolve, reject) => {
    const callbackName = 'gymtrackCb_' + Date.now() + '_' + Math.floor(Math.random() * 1000000);
    const script = document.createElement('script');
    let settled = false;
    const cleanup = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      script.remove();
      try { delete window[callbackName]; } catch (_) { window[callbackName] = undefined; }
    };
    const retry = () => {
      cleanup();
      if (attempt >= 28) return reject(new Error('El servidor tardó demasiado. Verifica la implementación de Apps Script y vuelve a intentarlo.'));
      setTimeout(() => pollResult(requestId, attempt + 1).then(resolve, reject), 600);
    };
    window[callbackName] = response => {
      cleanup();
      if (response && response.data && response.data.pending) {
        if (attempt >= 28) return reject(new Error('El servidor no terminó de procesar la solicitud.'));
        return setTimeout(() => pollResult(requestId, attempt + 1).then(resolve, reject), 600);
      }
      if (!response || response.ok !== true) return reject(new Error(response && response.error ? response.error : 'Respuesta inválida del servidor.'));
      resolve(response.data);
    };
    script.onerror = retry;
    const timeout = setTimeout(retry, 7000);
    const separator = API_URL.includes('?') ? '&' : '?';
    script.src = API_URL + separator + 'action=result&requestId=' + encodeURIComponent(requestId) + '&callback=' + encodeURIComponent(callbackName) + '&_=' + Date.now();
    document.body.appendChild(script);
  });
}

function makeRequestId() {
  if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID().replace(/-/g, '');
  return 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}
function translateFirebaseError(error) {
  const code = String(error && error.code || '');
  if (code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found')) return 'Correo o contraseña incorrectos.';
  if (code.includes('too-many-requests')) return 'Demasiados intentos. Espera un momento y vuelve a intentarlo.';
  if (code.includes('invalid-email')) return 'El correo no tiene un formato válido.';
  if (code.includes('network-request-failed')) return 'No hay conexión a Internet.';
  return error && error.message ? error.message : 'No se pudo iniciar sesión.';
}

function setBusy(isBusy, message = 'Procesando…') {
  document.body.classList.toggle('busy', isBusy);
  if (isBusy && message) showToast(message);
}
function showToast(message, type = '') {
  const toast = $('toast');
  toast.textContent = message;
  toast.className = 'toast show' + (type ? ' ' + type : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.className = 'toast'; }, 3600);
}
function fmt(value, decimals = 1) {
  if (value === '' || value === null || value === undefined || !isFinite(Number(value))) return '—';
  return Number(value).toLocaleString('es-GT', { minimumFractionDigits: 0, maximumFractionDigits: decimals });
}
function formatDate(date) {
  if (!date) return 'Sin fecha';
  const d = new Date(String(date).slice(0,10) + 'T12:00:00');
  return isNaN(d.getTime()) ? String(date) : d.toLocaleDateString('es-GT', { day: '2-digit', month: 'short', year: 'numeric' });
}
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]));
}
function initials(name) { return String(name || 'GT').trim().split(/\s+/).slice(0,2).map(p => p[0] || '').join('').toUpperCase() || 'GT'; }
function todayString() { return appData && appData.dateKey ? appData.dateKey : new Date().toLocaleDateString('en-CA'); }

function renderAll() {
  if (!appData) return;
  const profile = appData.profile || {};
  $('profileName').textContent = profile.nombre || profile.email || 'Usuario';
  $('profileEmail').textContent = profile.email || '';
  $('avatarInitials').textContent = initials(profile.nombre || profile.email);
  $('roleBadge').textContent = (profile.rol === 'admin' || profile.rol === 'administrador') ? 'Administrador' : 'Usuario';
  $('welcomeTitle').textContent = 'Hola, ' + ((profile.nombre || '').split(' ')[0] || 'vamos con todo') + '.';
  $('todayDateLabel').textContent = formatDate(appData.dateKey);
  $('routineDateBadge').textContent = formatDate(appData.dateKey);
  $('weightDate').value ||= appData.dateKey;
  $('measureDate').value ||= appData.dateKey;
  $('e-date').value ||= appData.dateKey;
  renderDashboard(); renderRoutine(); renderBody(); renderEvolt();
}

function setView(view) {
  if (view === 'admin' && !(appData && ['admin','administrador'].includes(appData.profile.rol))) view = 'dashboard';
  currentView = view;
  document.querySelectorAll('.view-section').forEach(section => section.classList.toggle('hidden', section.id !== 'view-' + view));
  document.querySelectorAll('.nav-item[data-view]').forEach(button => button.classList.toggle('active', button.dataset.view === view));
  const titles = { dashboard:'Resumen', routine:'Mi rutina', body:'Control corporal', evolt:'EVOLT 360', admin:'Administración' };
  $('pageTitle').textContent = titles[view] || 'GymTrack';
  $('topEyebrow').textContent = view === 'admin' ? 'CONTROL DE ACCESO' : 'TU ESPACIO PERSONAL';
  if (view === 'admin') loadAdminData().catch(e => showToast(e.message, 'error'));
}
document.querySelectorAll('.nav-item[data-view]').forEach(button => button.addEventListener('click', () => goToView(button.dataset.view)));
document.querySelectorAll('[data-go-view]').forEach(button => button.addEventListener('click', () => goToView(button.dataset.goView)));

function renderDashboard() {
  const s = appData.summary || {};
  $('dashWeight').textContent = s.latestWeight ? fmt(s.latestWeight.weightKg) + ' kg' : '—';
  $('dashWaist').textContent = s.latestMeasurement && s.latestMeasurement.waistCm ? fmt(s.latestMeasurement.waistCm) + ' cm' : (s.latestEvolt && s.latestEvolt.cinturaCm ? fmt(s.latestEvolt.cinturaCm) + ' cm' : '—');
  $('dashFat').textContent = s.latestEvolt && s.latestEvolt.grasaPct !== '' ? fmt(s.latestEvolt.grasaPct) + '%' : '—';
  $('dashSessions').textContent = String(s.completedSessionsThisMonth || 0);
  const weights = appData.weights || [];
  drawLineChart('weightChart', weights, 'weightKg', 'kg');
  $('weightChartEmpty').style.display = weights.length >= 2 ? 'none' : 'flex';
  $('weightChart').style.display = weights.length >= 2 ? 'block' : 'none';
  const sessions = appData.sessions || [];
  $('recentSessions').innerHTML = sessions.length ? sessions.slice(0,5).map(session => {
    const d = new Date(session.date + 'T12:00:00');
    const day = d.toLocaleDateString('es-GT', { day:'2-digit' });
    const month = d.toLocaleDateString('es-GT', { month:'short' }).replace('.','');
    const statusText = session.status === 'completada' ? 'Finalizada' : session.status === 'activa' ? 'En curso' : 'Histórica / incompleta';
    return `<div class="session-row"><div class="session-calendar"><strong>${escapeHtml(day)}</strong><small>${escapeHtml(month)}</small></div><div><strong>${escapeHtml(session.day)} · ${escapeHtml(statusText)}</strong><small>${session.checkInAt ? 'Llegada validada ' + escapeHtml(String(session.checkInAt).slice(11,16)) : 'Registro importado o anterior'}</small></div><span class="session-percent">${session.status === 'completada' ? fmt(session.percent,0) + '%' : '—'}</span></div>`;
  }).join('') : '<p class="muted">Todavía no hay sesiones registradas. Entra en Mi rutina para empezar.</p>';
  const weak = appData.weakPoints || [];
  $('weakPoints').innerHTML = weak.length ? weak.map(item => `<div class="weak-row"><div class="weak-name"><strong>${escapeHtml(item.name)}</strong><small>${item.times} ${item.times===1?'registro':'registros'} sin completar</small></div><div class="weak-bar"><span style="width:${Math.max(8,Math.min(100,item.times/Math.max(...weak.map(w=>w.times))*100))}%"></span></div></div>`).join('') : '<p class="muted">Todavía no hay ejercicios marcados como pendientes en los registros guardados.</p>';
}

function drawLineChart(elementId, rows, key, suffix = '') {
  const host = $(elementId);
  if (!host) return;
  const pointsData = (rows || []).filter(r => r && r[key] !== '' && r[key] !== null && isFinite(Number(r[key])));
  if (pointsData.length < 2) { host.innerHTML = ''; return; }
  const W = 560, H = 215, left = 42, right = 16, top = 18, bottom = 38;
  const vals = pointsData.map(r => Number(r[key]));
  let min = Math.min(...vals), max = Math.max(...vals);
  if (min === max) { min -= 1; max += 1; }
  const pad = Math.max((max-min)*.18, .4); min -= pad; max += pad;
  const plotW = W-left-right, plotH = H-top-bottom;
  const x = i => left + (i/(pointsData.length-1))*plotW;
  const y = val => top + ((max-val)/(max-min))*plotH;
  const points = pointsData.map((r,i)=>`${x(i).toFixed(1)},${y(Number(r[key])).toFixed(1)}`).join(' ');
  const grid = [max,(max+min)/2,min].map(v=>`<g><line x1="${left}" y1="${y(v)}" x2="${W-right}" y2="${y(v)}" stroke="#e9edf4" stroke-dasharray="4 5"/><text x="${left-8}" y="${y(v)+4}" fill="#98a1b2" font-size="10" text-anchor="end">${fmt(v,1)}</text></g>`).join('');
  const circles = pointsData.map((r,i)=>`<circle cx="${x(i)}" cy="${y(Number(r[key]))}" r="4" fill="#4769f5" stroke="#fff" stroke-width="2"><title>${escapeHtml(r.date)}: ${fmt(r[key])} ${suffix}</title></circle>`).join('');
  const labels = [0,Math.floor((pointsData.length-1)/2),pointsData.length-1].filter((v,i,a)=>a.indexOf(v)===i).map(i=>`<text x="${x(i)}" y="${H-12}" fill="#98a1b2" font-size="10" text-anchor="${i===0?'start':i===pointsData.length-1?'end':'middle'}">${escapeHtml(String(pointsData[i].date).slice(5))}</text>`).join('');
  host.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Gráfica de evolución">${grid}<polyline points="${points}" fill="none" stroke="#4769f5" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>${circles}${labels}</svg>`;
}

function renderRoutine() {
  if (!appData) return;
  const days = appData.days || ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
  const assignedDays = appData.assignedDays || [];
  if (!selectedRoutineDay) selectedRoutineDay = appData.todayDay;
  $('routineDaySelect').innerHTML = days.map(day => `<option value="${escapeHtml(day)}" ${day===selectedRoutineDay?'selected':''}>${escapeHtml(day)}${assignedDays.includes(day)?' · asignada':''}</option>`).join('');
  const gyms = appData.gyms || [];
  const previousGymId = $('checkInGymSelect').value;
  const gym = gyms[0] || appData.gym || {};
  $('checkInGymSelect').innerHTML = gyms.map(g => `<option value="${escapeHtml(g.id)}">${escapeHtml(g.name)}${g.address ? ' · ' + escapeHtml(g.address) : ''}</option>`).join('');
  if (gyms.some(g => g.id === previousGymId)) $('checkInGymSelect').value = previousGymId;
  $('checkInGymPickerWrap').classList.toggle('hidden', gyms.length < 2);
  $('gymNameLabel').textContent = gyms.length > 1 ? `${gyms.length} gimnasios autorizados` : (gym.name || 'Gimnasio');
  $('gymStatusText').textContent = gyms.length > 1 ? 'Selecciona la sede donde estás y confirma tu llegada.' : gyms.length === 1 ? `Zona activa · radio ${gym.radiusMeters} m · precisión GPS máxima ${gym.maxAccuracyMeters} m.` : 'El administrador debe asignarte al menos un gimnasio autorizado.';
  const session = appData.session;
  const isToday = selectedRoutineDay === appData.todayDay;
  const active = !!(session && session.status === 'activa' && isToday);
  const finished = !!(session && session.status === 'completada' && isToday);
  const assigned = (appData.assignmentsByDay && appData.assignmentsByDay[selectedRoutineDay]) || [];
  const todayLogs = isToday ? new Map((appData.routine || []).map(a => [a.id, a.log])) : new Map();
  const doneCount = assigned.filter(a => { const log = todayLogs.get(a.id); return log && log.completed; }).length;
  const percent = assigned.length ? Math.round(doneCount/assigned.length*100) : 0;
  $('routineProgressText').textContent = percent + '%';
  $('routineProgressFill').style.width = percent + '%';
  if (active) {
    $('sessionStatus').textContent = `Llegada validada · ${session.gymName ? session.gymName + ' · ' : ''}${fmt(session.distanceM,0)} m del punto`; $('sessionStatus').className = 'session-status active';
  } else if (finished) {
    $('sessionStatus').textContent = 'Sesión finalizada'; $('sessionStatus').className = 'session-status done';
  } else {
    $('sessionStatus').textContent = 'Sesión no iniciada'; $('sessionStatus').className = 'session-status';
  }
  $('checkInBtn').disabled = !isToday || !assigned.length || !gyms.length || active || finished;
  $('checkInBtn').innerHTML = active ? 'Llegada validada ✓' : finished ? 'Sesión finalizada' : 'Confirmar llegada <span>→</span>';
  $('saveWorkoutBtn').disabled = !active;
  $('finishWorkoutBtn').disabled = !active;
  $('sessionNotes').disabled = !active;
  if (!assigned.length) {
    $('exerciseList').innerHTML = `<div class="empty-state">No tienes ejercicios asignados para ${escapeHtml(selectedRoutineDay)}. Pide al administrador que te asigne una rutina.</div>`;
  } else {
    $('exerciseList').innerHTML = assigned.map((exercise,index) => renderExerciseCard(exercise, todayLogs.get(exercise.id), active)).join('');
  }
  updateRoutineExerciseSummary();
  const notice = $('routineNotice');
  if (!isToday) { notice.textContent = `Estás consultando ${selectedRoutineDay}. Solo puedes activar la rutina del día actual (${appData.todayDay}).`; notice.className='notice-box'; }
  else if (!gyms.length) { notice.textContent = 'No tienes gimnasios autorizados. Pide al administrador que te asigne una sede.'; notice.className='notice-box error'; }
  else if (active) { notice.textContent = 'Llegada verificada. Ya puedes registrar series, repeticiones y ejercicios completados.'; notice.className='notice-box success'; }
  else if (finished) { notice.textContent = 'Esta sesión ya fue finalizada. Puedes consultar el registro, pero no modificarlo.'; notice.className='notice-box success'; }
  else if (!assigned.length) { notice.textContent = 'No hay ejercicios asignados para hoy.'; notice.className='notice-box error'; }
  else { const selectedGym = gyms.find(g => g.id === $('checkInGymSelect').value) || gyms[0]; notice.textContent = `Para activar los ejercicios, confirma tu llegada dentro del radio de ${selectedGym ? selectedGym.radiusMeters : 150} m y con precisión GPS suficiente.`; notice.className='notice-box'; }
  if (!active && !finished) $('sessionNotes').value = '';
  else if (session) $('sessionNotes').value = session.notes || '';
}

function renderExerciseCard(exercise, log, enabled) {
  const isCardio = String(exercise.cardio).toLowerCase() === 'sí' || String(exercise.cardio).toLowerCase() === 'si' || /cardio|estiramiento/i.test(exercise.name);
  const setMatch = String(exercise.detail || '').match(/(\d+)\s*series/i);
  const setCount = isCardio ? 0 : Math.max(1, Math.min(6, Number(setMatch ? setMatch[1] : 3)));
  const savedSets = log && Array.isArray(log.sets) ? log.sets : [];
  const checked = !!(log && log.completed);
  let setMarkup = '';
  if (setCount) {
    const rows = Array.from({length:setCount},(_,i)=>{
      const s = savedSets[i] || {};
      return `<span class="set-number">Serie ${i+1}</span><input class="set-weight" type="number" min="0" max="500" step="0.5" placeholder="kg" value="${s.weightKg!==''&&s.weightKg!==undefined?escapeHtml(s.weightKg):''}" ${enabled?'':'disabled'} aria-label="Peso serie ${i+1} de ${escapeHtml(exercise.name)}"><input class="set-reps" type="number" min="0" max="300" step="1" placeholder="reps" value="${s.reps!==''&&s.reps!==undefined?escapeHtml(s.reps):''}" ${enabled?'':'disabled'} aria-label="Repeticiones serie ${i+1} de ${escapeHtml(exercise.name)}">`;
    }).join('');
    setMarkup = `<div class="set-grid"><span></span><span class="set-header">PESO (KG)</span><span class="set-header">REPETICIONES</span>${rows}</div>`;
  }
  const notePlaceholder = isCardio ? 'Minutos realizados, ritmo o comentario…' : 'Nota del ejercicio (opcional)…';
  return `<article class="exercise-card ${checked?'is-done':''}" data-assignment-id="${escapeHtml(exercise.id)}"><div class="exercise-head"><input class="exercise-check" type="checkbox" ${checked?'checked':''} ${enabled?'':'disabled'} aria-label="Marcar ${escapeHtml(exercise.name)} como completado"><div class="exercise-title-wrap"><div class="exercise-title-row"><span class="exercise-order-badge">${escapeHtml(String(exercise.orden || 1).padStart(2,'0'))}</span><h3>${escapeHtml(exercise.name)}</h3><span class="muscle-tag">${escapeHtml(exercise.muscle || 'General')}</span>${isCardio?'<span class="cardio-tag">CARDIO</span>':''}<span class="exercise-status-tag ${checked?'is-complete':''}" data-exercise-status>${checked?'Completado':'Pendiente'}</span></div><p class="exercise-detail">${escapeHtml(exercise.detail || '')}</p>${exercise.description ? `<p class="exercise-description">${escapeHtml(exercise.description)}</p>` : ''}</div></div>${setMarkup}<div class="exercise-notes"><input class="exercise-note" type="text" maxlength="500" placeholder="${notePlaceholder}" value="${escapeHtml(log && log.notes || '')}" ${enabled?'':'disabled'}></div></article>`;
}
function updateRoutineExerciseSummary() {
  const checks = Array.from($('exerciseList').querySelectorAll('.exercise-check'));
  const total = checks.length;
  const done = checks.filter(input => input.checked).length;
  const percent = total ? Math.round(done / total * 100) : 0;
  $('routineExerciseCount').textContent = String(total);
  $('routineCompletedCount').textContent = String(done);
  $('routineProgressText').textContent = `${percent}%`;
  $('routineProgressFill').style.width = `${percent}%`;
}
function indexPad(n) { return String(n || '').trim(); }
$('routineDaySelect').addEventListener('change', event => { selectedRoutineDay = event.target.value; renderRoutine(); });
$('checkInBtn').addEventListener('click', async () => {
  if (!navigator.geolocation) return showToast('Este navegador no permite obtener la ubicación.', 'error');
  if (!confirm('Se usará tu ubicación actual para comprobar que estás dentro de la zona autorizada del gimnasio. ¿Continuar?')) return;
  $('checkInBtn').disabled = true; $('checkInBtn').textContent = 'Comprobando ubicación…';
  navigator.geolocation.getCurrentPosition(async position => {
    try {
      setBusy(true, 'Validando tu llegada…');
      await api('checkIn', { gymId: $('checkInGymSelect').value, latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy });
      await refreshAppData();
      showToast('Llegada validada. Tu rutina está habilitada.', 'success');
    } catch (error) { showToast(error.message, 'error'); }
    finally { setBusy(false); renderRoutine(); }
  }, error => {
    const message = error.code === 1 ? 'Permite el acceso a la ubicación para confirmar tu llegada.' : error.code === 2 ? 'No se pudo determinar la ubicación. Activa el GPS.' : 'Se agotó el tiempo para obtener la ubicación. Inténtalo de nuevo.';
    showToast(message, 'error'); renderRoutine();
  }, { enableHighAccuracy:true, timeout:18000, maximumAge:0 });
});

$('saveWorkoutBtn').addEventListener('click', async () => {
  if (!appData || !appData.session) return;
  const exercises = collectWorkoutPayload();
  try {
    setBusy(true, 'Guardando entrenamiento…');
    appData = await api('saveWorkout', { sessionId: appData.session.id, exercises, notes: $('sessionNotes').value });
    renderAll(); showToast('Avance guardado.', 'success');
  } catch (error) { showToast(error.message, 'error'); }
  finally { setBusy(false); }
});
function collectWorkoutPayload() {
  return [...document.querySelectorAll('.exercise-card')].map(card => ({
    assignmentId: card.dataset.assignmentId,
    done: card.querySelector('.exercise-check')?.checked === true,
    sets: [...card.querySelectorAll('.set-weight')].map((input,i) => ({ weightKg: input.value, reps: card.querySelectorAll('.set-reps')[i]?.value || '' })),
    notes: card.querySelector('.exercise-note')?.value || ''
  }));
}
$('finishWorkoutBtn').addEventListener('click', async () => {
  if (!appData || !appData.session) return;
  if (!confirm('¿Guardar los cambios y finalizar la sesión? Después de finalizar ya no podrás editar sus ejercicios.')) return;
  try {
    setBusy(true, 'Guardando cambios y finalizando…');
    const sessionId = appData.session.id;
    await api('saveWorkout', { sessionId, exercises: collectWorkoutPayload(), notes: $('sessionNotes').value });
    appData = await api('finishWorkout', { sessionId, notes: $('sessionNotes').value });
    renderAll(); showToast('Sesión finalizada y guardada.', 'success');
  } catch (error) { showToast(error.message, 'error'); }
  finally { setBusy(false); }
});
$('exerciseList').addEventListener('change', event => {
  const card = event.target.closest('.exercise-card');
  if (card && event.target.classList.contains('exercise-check')) {
    card.classList.toggle('is-done', event.target.checked);
    const status = card.querySelector('[data-exercise-status]');
    if (status) {
      status.textContent = event.target.checked ? 'Completado' : 'Pendiente';
      status.classList.toggle('is-complete', event.target.checked);
    }
    updateRoutineExerciseSummary();
  }
});

$('weightForm').addEventListener('submit', async event => {
  event.preventDefault();
  try {
    setBusy(true, 'Guardando peso…');
    appData = await api('saveWeight', { date: $('weightDate').value, weightKg: $('weightKg').value, notes: $('weightNotes').value });
    $('weightKg').value = ''; $('weightNotes').value = '';
    renderAll(); showToast('Peso corporal guardado.', 'success');
  } catch (error) { showToast(error.message, 'error'); }
  finally { setBusy(false); }
});

$('measurementsForm').addEventListener('submit', async event => {
  event.preventDefault();
  const payload = { date: $('measureDate').value, notes: $('measureNotes').value };
  MEASURES.forEach(([key]) => payload[key] = $('m-' + key).value);
  try {
    setBusy(true, 'Guardando medidas…');
    appData = await api('saveMeasurements', payload);
    $('measurementsForm').reset(); $('measureDate').value = appData.dateKey;
    renderAll(); showToast('Evaluación corporal guardada.', 'success');
  } catch (error) { showToast(error.message, 'error'); }
  finally { setBusy(false); }
});
$('measureChartSelect').addEventListener('change', renderMeasureChart);
$('importBodytrackInput').addEventListener('change', async event => {
  const file = event.target.files && event.target.files[0]; if (!file) return;
  try {
    if (file.size > 8 * 1024 * 1024) throw new Error('El archivo supera 8 MB. Exporta un respaldo más pequeño.');
    const raw = JSON.parse(await file.text());
    if (!Array.isArray(raw.clients) || !raw.clients.length) throw new Error('No parece ser un respaldo JSON válido de BodyTrack V3.');
    const selected = raw.clients.find(c => c.id === raw.currentId) || raw.clients[0];
    if (!Array.isArray(selected.records) || !selected.records.length) throw new Error('El perfil seleccionado no contiene evaluaciones.');
    if (!confirm(`Se importarán ${selected.records.length} evaluaciones del perfil “${selected.name || 'sin nombre'}” a tu cuenta. ¿Continuar?`)) return;
    setBusy(true, 'Importando evaluaciones…');
    const result = await api('importBodytrack', { records: selected.records.map(r => ({ date:r.date, measure:r.measure, notes:r.notes || 'Importado desde BodyTrack V3' })) });
    appData = result.appData || appData;
    renderAll(); showToast(`Se importaron ${result.imported || 0} evaluaciones.`, 'success');
  } catch (error) { showToast(error.message || 'No se pudo importar el archivo.', 'error'); }
  finally { setBusy(false); event.target.value = ''; }
});

function renderBody() {
  const weights = appData.weights || [];
  $('weightHistory').innerHTML = weights.length ? weights.slice(-8).reverse().map(r => `<div class="history-item"><div><strong>${escapeHtml(formatDate(r.date))}</strong><small>${escapeHtml(r.notes || 'Registro de peso')}</small></div><strong class="history-value">${fmt(r.weightKg)} kg</strong></div>`).join('') : '<p class="muted">Todavía no has guardado tu peso.</p>';
  const measurements = appData.measurements || [];
  $('measureHistory').innerHTML = measurements.length ? `<table class="data-table"><thead><tr><th>Fecha</th><th>Peso</th><th>Cintura</th><th>Cadera</th><th>Pecho</th><th>Notas</th></tr></thead><tbody>${measurements.slice(-12).reverse().map(r => `<tr><td>${escapeHtml(formatDate(r.date))}</td><td>${r.weightKg!==''?fmt(r.weightKg)+' kg':'—'}</td><td>${r.waistCm!==''?fmt(r.waistCm)+' cm':'—'}</td><td>${r.hipsCm!==''?fmt(r.hipsCm)+' cm':'—'}</td><td>${r.chestCm!==''?fmt(r.chestCm)+' cm':'—'}</td><td>${escapeHtml(r.notes || '')}</td></tr>`).join('')}</tbody></table>` : '<p class="muted">Todavía no hay evaluaciones corporales.</p>';
  renderMeasureChart();
}
function renderMeasureChart() {
  if (!appData) return;
  const key = $('measureChartSelect').value || 'waistCm';
  const rows = (appData.measurements || []).filter(r => r[key] !== '' && r[key] !== null);
  drawLineChart('measureChart', rows, key, key === 'weightKg' ? 'kg' : 'cm');
  if (rows.length < 2) $('measureChart').innerHTML = '<div class="empty-chart" style="display:flex">Registra dos evaluaciones con esta medida para ver la tendencia.</div>';
}

$('exportMeasuresCsvBtn').addEventListener('click', () => {
  const rows = appData && appData.measurements || [];
  if (!rows.length) return showToast('No hay medidas para exportar.', 'error');
  const headers = ['Fecha', ...MEASURES.map(([key,label])=>label), 'Notas'];
  const csvRows = [headers, ...rows.map(r => [r.date, ...MEASURES.map(([key])=>r[key] ?? ''), r.notes || ''])];
  const csv = '\ufeff' + csvRows.map(row => row.map(csvEscape).join(';')).join('\r\n');
  downloadFile('GymTrack_medidas_' + todayString() + '.csv', csv, 'text/csv;charset=utf-8');
  showToast('CSV de medidas descargado.', 'success');
});
$('exportMyDataBtn').addEventListener('click', () => {
  if (!appData) return;
  const backup = { version:1, exportedAt:new Date().toISOString(), profile:{ nombre:appData.profile.nombre, email:appData.profile.email }, weights:appData.weights || [], measurements:appData.measurements || [], evolt:appData.evolt || [], sessions:appData.sessions || [] };
  downloadFile('GymTrack_datos_' + todayString() + '.json', JSON.stringify(backup,null,2), 'application/json;charset=utf-8');
  showToast('Archivo JSON descargado. Guárdalo en un lugar privado.', 'success');
});
function csvEscape(value) { const s = String(value ?? ''); return '"' + s.replace(/"/g,'""') + '"'; }
function downloadFile(filename, content, mime) {
  const blob = new Blob([content], {type:mime});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

$('evoltForm').addEventListener('submit', async event => {
  event.preventDefault();
  const payload = { date:$('e-date').value, notes:$('e-notes').value };
  EVOLT_FIELDS.forEach(key => payload[key] = $('e-' + key).value);
  try {
    setBusy(true, 'Guardando evaluación EVOLT…');
    appData = await api('saveEvolt', payload);
    renderAll(); showToast('Evaluación EVOLT 360 guardada.', 'success');
  } catch (error) { showToast(error.message, 'error'); }
  finally { setBusy(false); }
});
$('resetEvoltFormBtn').addEventListener('click', () => {
  EVOLT_FIELDS.forEach(key => { $('e-' + key).value = EVOLT_REFERENCE[key]; });
  $('e-date').value = appData ? appData.dateKey : todayString();
  $('e-notes').value = 'Valores de referencia del reporte EVOLT 360; confirma la fecha antes de guardar.';
});
function renderEvolt() {
  const rows = appData.evolt || [];
  const latest = rows.length ? rows[rows.length-1] : null;
  $('evoltLatestDate').textContent = latest ? formatDate(latest.date) : 'Sin registros';
  $('evoltLatestFat').textContent = latest && latest.grasaPct !== '' ? fmt(latest.grasaPct) + '%' : '—';
  $('evoltLatestMuscle').textContent = latest && latest.masaMuscularEsqueleticaKg !== '' ? fmt(latest.masaMuscularEsqueleticaKg) + ' kg' : '—';
  $('evoltHistory').innerHTML = rows.length ? `<table class="data-table"><thead><tr><th>Fecha</th><th>Peso</th><th>Grasa</th><th>Músculo esquelético</th><th>Masa magra</th><th>Visceral</th><th>Cintura</th></tr></thead><tbody>${rows.slice().reverse().map(r => `<tr><td>${escapeHtml(formatDate(r.date))}</td><td>${r.pesoKg!==''?fmt(r.pesoKg)+' kg':'—'}</td><td>${r.grasaPct!==''?fmt(r.grasaPct)+'%':'—'}</td><td>${r.masaMuscularEsqueleticaKg!==''?fmt(r.masaMuscularEsqueleticaKg)+' kg':'—'}</td><td>${r.masaMagraKg!==''?fmt(r.masaMagraKg)+' kg':'—'}</td><td>${r.grasaVisceralNivel!==''?fmt(r.grasaVisceralNivel,0):'—'}</td><td>${r.cinturaCm!==''?fmt(r.cinturaCm)+' cm':'—'}</td></tr>`).join('')}</tbody></table>` : '<p class="muted">Todavía no has guardado una evaluación EVOLT 360.</p>';
}

async function refreshAppData() { appData = await api('getAppData'); renderAll(); }

/* Administrador */
async function loadAdminData(uid = '') {
  if (!appData || !['admin','administrador'].includes(appData.profile.rol)) return;
  adminData = await api('adminGetData', { uid: uid || $('assignUserSelect').value || '' });
  renderAdmin();
}
function renderAdmin() {
  if (!adminData) return;
  const users = adminData.users || [];
  $('userCount').textContent = String(users.length);
  $('adminUsers').innerHTML = users.length ? users.map(user => `<div class="admin-user-row"><div class="admin-user-avatar">${escapeHtml(initials(user.nombre || user.email))}</div><div class="admin-user-info"><strong>${escapeHtml(user.nombre || 'Sin nombre')} ${user.uid===adminData.currentAdminUid?'<span class="role-badge">Tú</span>':''}</strong><small>${escapeHtml(user.email)} · ${escapeHtml(user.rol)}</small></div><span class="user-status ${user.activo?'':'inactive'}">${user.activo?'Activo':'Inactivo'}</span><button class="mini-action" data-toggle-user="${escapeHtml(user.uid)}" data-active="${user.activo?'false':'true'}">${user.activo?'Desactivar':'Activar'}</button></div>`).join('') : '<p class="muted">No hay usuarios.</p>';
  const options = users.map(u => `<option value="${escapeHtml(u.uid)}">${escapeHtml(u.nombre || u.email)} · ${escapeHtml(u.email)}</option>`).join('');
  const previousAssign = $('assignUserSelect').value;
  const previousMigrate = $('migrateUserSelect').value;
  $('assignUserSelect').innerHTML = options;
  $('migrateUserSelect').innerHTML = options;
  const chosenUid = users.some(u=>u.uid===previousAssign) ? previousAssign : (users.some(u=>u.uid===adminData.selectedUid) ? adminData.selectedUid : (users[0] ? users[0].uid : ''));
  if (chosenUid) $('assignUserSelect').value = chosenUid;
  if (users.some(u=>u.uid===previousMigrate)) $('migrateUserSelect').value = previousMigrate;
  else if (users[0]) $('migrateUserSelect').value = users[0].uid;
  $('assignExercise').innerHTML = (adminData.catalog || []).map(e => `<option value="${escapeHtml(e.id)}">${escapeHtml(e.nombre)}</option>`).join('');
  renderAdminGyms();
  renderAdminUserGyms();
  renderAssignExercisePreview();
  renderAdminAssignments();
  renderAdminCatalog();
}
function renderAssignExercisePreview() {
  const host = $('assignExercisePreview');
  if (!host) return;
  const exercise = (adminData && adminData.catalog || []).find(e => e.id === $('assignExercise').value);
  if (!exercise) {
    host.innerHTML = '<span class="preview-empty">No hay ejercicios disponibles. Crea uno en el catálogo.</span>';
    return;
  }
  const isCardio = /^(sí|si)$/i.test(String(exercise.cardio || '')) || /cardio/i.test(String(exercise.nombre || ''));
  host.innerHTML = `<div class="preview-topline"><span class="preview-label">Vista previa</span><span class="${isCardio?'cardio-tag':'muscle-tag'}">${isCardio?'CARDIO':escapeHtml(exercise.musculo || 'General')}</span></div><strong>${escapeHtml(exercise.nombre)}</strong><p>${escapeHtml(exercise.descripcion || 'Este ejercicio todavía no tiene descripción.')}</p><small>${escapeHtml(exercise.detalle || 'Define las series y repeticiones para esta rutina.')}</small>`;
}
function renderAdminAssignments() {
  if (!adminData) return;
  const uid = $('assignUserSelect').value;
  const assignments = (adminData.assignments || []).filter(a => a.uid === uid).sort((a,b) => {
    const dayOrder = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
    return dayOrder.indexOf(a.day) - dayOrder.indexOf(b.day) || Number(a.orden || 0) - Number(b.orden || 0);
  });
  const activeDays = new Set(assignments.map(a => a.day)).size;
  $('assignedExerciseCount').textContent = String(assignments.length);
  $('assignedDayCount').textContent = `${activeDays}/7`;
  $('catalogExerciseCount').textContent = String((adminData.catalog || []).length);

  const query = String($('assignmentSearch').value || '').trim().toLocaleLowerCase('es');
  const selectedDay = $('assignmentDayFilter').value;
  const filtered = assignments.filter(a => {
    const matchesDay = !selectedDay || a.day === selectedDay;
    const haystack = [a.name, a.muscle, a.description, a.detail, a.day].join(' ').toLocaleLowerCase('es');
    return matchesDay && (!query || haystack.includes(query));
  });
  $('assignmentCount').textContent = filtered.length === assignments.length
    ? `${assignments.length} ${assignments.length === 1 ? 'ejercicio' : 'ejercicios'}`
    : `${filtered.length} de ${assignments.length}`;

  if (!assignments.length) {
    $('adminAssignments').innerHTML = '<div class="exercise-empty-state"><span class="exercise-empty-icon">＋</span><strong>Esta rutina todavía está vacía</strong><p>Añade ejercicios arriba o asigna la rutina base para empezar.</p></div>';
    return;
  }
  if (!filtered.length) {
    $('adminAssignments').innerHTML = '<div class="exercise-empty-state"><strong>No encontramos coincidencias</strong><p>Prueba con otro nombre o cambia el filtro de día.</p></div>';
    return;
  }

  const dayOrder = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
  const groupedDays = [...new Set(filtered.map(a => a.day))].sort((a,b) => dayOrder.indexOf(a) - dayOrder.indexOf(b));
  $('adminAssignments').innerHTML = groupedDays.map(day => {
    const dayAssignments = filtered.filter(a => a.day === day);
    return `<section class="assignment-day-group"><div class="assignment-day-heading"><div><span class="assignment-day-marker"></span><h4>${escapeHtml(day)}</h4></div><span>${dayAssignments.length} ${dayAssignments.length === 1 ? 'ejercicio' : 'ejercicios'}</span></div><div class="assignment-card-list">${dayAssignments.map(a => {
      const isCardio = /^(sí|si)$/i.test(String(a.cardio || '')) || /cardio/i.test(String(a.name || ''));
      return `<article class="assignment-admin-card"><div class="assignment-order-badge">${escapeHtml(String(a.orden || 1).padStart(2,'0'))}</div><div class="assignment-card-main"><div class="assignment-card-title"><strong>${escapeHtml(a.name)}</strong><span class="muscle-tag">${escapeHtml(a.muscle || 'General')}</span>${isCardio?'<span class="cardio-tag">CARDIO</span>':''}</div><p class="assignment-card-description">${escapeHtml(a.description || 'Sin descripción registrada.')}</p><div class="assignment-card-prescription"><span>Series / detalle</span><strong>${escapeHtml(a.detail || 'Sin prescripción')}</strong></div></div><button class="mini-action assignment-remove-btn" data-remove-assignment="${escapeHtml(a.id)}" type="button" aria-label="Quitar ${escapeHtml(a.name)}">Quitar</button></article>`;
    }).join('')}</div></section>`;
  }).join('');
}
function renderAdminCatalog() {
  if (!adminData) return;
  const catalog = adminData.catalog || [];
  const query = String($('catalogSearch').value || '').trim().toLocaleLowerCase('es');
  const filtered = catalog.filter(exercise => [exercise.nombre, exercise.musculo, exercise.descripcion, exercise.detalle, exercise.cardio]
    .join(' ').toLocaleLowerCase('es').includes(query));
  $('catalogCount').textContent = filtered.length === catalog.length
    ? `${catalog.length} ${catalog.length === 1 ? 'ejercicio' : 'ejercicios'}`
    : `${filtered.length} de ${catalog.length}`;
  $('adminCatalogList').innerHTML = filtered.length ? filtered.map(exercise => {
    const isCardio = /^(sí|si)$/i.test(String(exercise.cardio || '')) || /cardio/i.test(String(exercise.nombre || ''));
    return `<article class="catalog-exercise-card"><div class="catalog-exercise-icon">${isCardio?'↗':'✦'}</div><div class="catalog-exercise-main"><div class="catalog-exercise-title"><strong>${escapeHtml(exercise.nombre)}</strong><span class="muscle-tag">${escapeHtml(exercise.musculo || 'General')}</span>${isCardio?'<span class="cardio-tag">CARDIO</span>':''}</div><p>${escapeHtml(exercise.descripcion || 'Sin descripción registrada.')}</p><div class="catalog-exercise-detail">${escapeHtml(exercise.detalle || 'Sin series predeterminadas')}</div></div><button class="btn btn-secondary catalog-use-btn" data-use-catalog="${escapeHtml(exercise.id)}" type="button">Usar</button></article>`;
  }).join('') : '<div class="exercise-empty-state"><strong>No hay resultados en el catálogo</strong><p>Intenta otra búsqueda o crea un ejercicio nuevo.</p></div>';
}
$('refreshAdminBtn').addEventListener('click', () => loadAdminData().then(()=>showToast('Datos de administración actualizados.', 'success')).catch(e=>showToast(e.message,'error')));
$('createUserForm').addEventListener('submit', async event => {
  event.preventDefault();
  const payload = { name:$('newUserName').value, email:$('newUserEmail').value, password:$('newUserPassword').value, role:$('newUserRole').value };
  try {
    setBusy(true, 'Creando cuenta…');
    const result = await api('adminCreateUser', payload);
    $('createUserForm').reset(); await loadAdminData(); showToast(result.message || 'Usuario creado.', 'success');
  } catch (error) { showToast(error.message, 'error'); }
  finally { setBusy(false); }
});
$('catalogForm').addEventListener('submit', async event => {
  event.preventDefault();
  try {
    setBusy(true, 'Guardando ejercicio…');
    await api('adminCreateExercise', { name:$('newExerciseName').value, description:$('newExerciseDescription').value, muscle:$('newExerciseMuscle').value, detail:$('newExerciseDetail').value, cardio:$('newExerciseCardio').value });
    $('catalogForm').reset(); await loadAdminData($('assignUserSelect').value); showToast('Ejercicio añadido al catálogo.', 'success');
  } catch (error) { showToast(error.message, 'error'); }
  finally { setBusy(false); }
});
$('adminUsers').addEventListener('click', async event => {
  const button = event.target.closest('[data-toggle-user]'); if (!button) return;
  const active = button.dataset.active === 'true';
  if (!confirm(`${active?'¿Activar':'¿Desactivar'} esta cuenta?`)) return;
  try { setBusy(true, 'Actualizando usuario…'); await api('adminToggleUser', { uid:button.dataset.toggleUser, active }); await loadAdminData($('assignUserSelect').value); showToast('Estado de usuario actualizado.', 'success'); }
  catch (error) { showToast(error.message,'error'); }
  finally { setBusy(false); }
});
$('assignUserSelect').addEventListener('change', () => loadAdminData($('assignUserSelect').value).catch(e => showToast(e.message, 'error')));
$('assignExercise').addEventListener('change', () => {
  const exercise = (adminData && adminData.catalog || []).find(e=>e.id===$('assignExercise').value);
  if (exercise) $('assignDetail').value = exercise.detalle || '';
  renderAssignExercisePreview();
});
$('assignmentSearch').addEventListener('input', renderAdminAssignments);
$('assignmentDayFilter').addEventListener('change', renderAdminAssignments);
$('catalogSearch').addEventListener('input', renderAdminCatalog);
$('adminCatalogList').addEventListener('click', event => {
  const button = event.target.closest('[data-use-catalog]');
  if (!button) return;
  const exercise = (adminData && adminData.catalog || []).find(item => item.id === button.dataset.useCatalog);
  if (!exercise) return;
  $('assignExercise').value = exercise.id;
  $('assignDetail').value = exercise.detalle || '';
  renderAssignExercisePreview();
  $('assignExerciseForm').scrollIntoView({ behavior: 'smooth', block: 'center' });
  showToast(`“${exercise.nombre}” seleccionado. Elige el día y añádelo a la rutina.`, 'success');
});
$('assignTemplateBtn').addEventListener('click', async () => {
  const uid = $('assignUserSelect').value; if (!uid) return showToast('Selecciona un usuario.', 'error');
  const user = (adminData.users || []).find(u=>u.uid===uid);
  if (!confirm(`Se asignará la rutina base a ${user ? user.nombre : 'este usuario'} y se desactivarán sus asignaciones actuales. El historial se conservará. ¿Continuar?`)) return;
  try { setBusy(true, 'Asignando rutina base…'); const result = await api('adminAssignTemplate', { uid }); adminData = result.adminData; renderAdmin(); showToast(result.message || 'Rutina base asignada.', 'success'); }
  catch (error) { showToast(error.message,'error'); }
  finally { setBusy(false); }
});
$('assignExerciseForm').addEventListener('submit', async event => {
  event.preventDefault();
  try { setBusy(true, 'Asignando ejercicio…'); adminData = await api('adminAddAssignment', { uid:$('assignUserSelect').value, day:$('assignDay').value, exerciseId:$('assignExercise').value, detail:$('assignDetail').value }); $('assignDetail').value=''; renderAdmin(); showToast('Ejercicio asignado.', 'success'); }
  catch (error) { showToast(error.message,'error'); }
  finally { setBusy(false); }
});
$('adminAssignments').addEventListener('click', async event => {
  const button = event.target.closest('[data-remove-assignment]'); if (!button) return;
  if (!confirm('¿Quitar este ejercicio de la rutina activa? Los registros históricos no se borrarán.')) return;
  try { setBusy(true, 'Quitando ejercicio…'); adminData = await api('adminRemoveAssignment', { assignmentId:button.dataset.removeAssignment }); renderAdmin(); showToast('Asignación desactivada.', 'success'); }
  catch (error) { showToast(error.message,'error'); }
  finally { setBusy(false); }
});
function parseGoogleMapsLink(raw) {
  let value = String(raw || '').trim();
  try { value = decodeURIComponent(value.replace(/\+/g, '%20')); } catch (_) {}
  const patterns = [
    /@(-?\d{1,3}(?:\.\d+)?),\s*(-?\d{1,3}(?:\.\d+)?)/,
    /!3d(-?\d{1,3}(?:\.\d+)?)!4d(-?\d{1,3}(?:\.\d+)?)/,
    /(?:[?&](?:q|query|center|destination|ll)=)(-?\d{1,3}(?:\.\d+)?)[,%2C]+(-?\d{1,3}(?:\.\d+)?)/i,
    /(?:^|\s)(-?\d{1,3}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)(?:\s|$)/
  ];
  for (const pattern of patterns) {
    const match = value.match(pattern);
    if (match) {
      const lat = Number(match[1]), lng = Number(match[2]);
      if (Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) return {lat,lng};
    }
  }
  return null;
}
function tryParseGymMapsUrl(showMessage = true) {
  const raw = $('newGymMapsUrl').value.trim();
  const coords = parseGoogleMapsLink(raw);
  if (coords) {
    $('newGymLat').value = coords.lat;
    $('newGymLng').value = coords.lng;
    $('gymMapsHelp').textContent = `Coordenadas detectadas: ${coords.lat}, ${coords.lng}. Verifica que el punto sea la entrada del gimnasio.`;
    if (showMessage) showToast('Coordenadas extraídas del enlace de Google Maps.', 'success');
    return true;
  }
  $('gymMapsHelp').textContent = 'Este enlace no muestra coordenadas directamente (suele ocurrir con enlaces cortos maps.app.goo.gl). Abre el punto en Google Maps, haz clic derecho sobre la entrada y copia las coordenadas que aparecen.';
  if (showMessage) showToast('No se pudieron extraer coordenadas del enlace. Puedes ingresarlas manualmente.', 'error');
  return false;
}
$('newGymMapsUrl').addEventListener('change', () => tryParseGymMapsUrl(false));
$('newGymMapsUrl').addEventListener('paste', () => setTimeout(() => tryParseGymMapsUrl(false), 0));
$('parseMapsBtn').addEventListener('click', () => tryParseGymMapsUrl(true));
$('openMapsBtn').addEventListener('click', () => {
  const url = $('newGymMapsUrl').value.trim();
  const address = $('newGymAddress').value.trim() || $('newGymName').value.trim();
  const target = url || ('https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(address));
  if (!/^https:\/\/(?:www\.google\.[^/]+\/maps|maps\.google\.[^/]+|maps\.app\.goo\.gl|goo\.gl\/maps)/i.test(target)) return showToast('Usa un enlace válido de Google Maps o deja el campo vacío para buscar por dirección.', 'error');
  window.open(target, '_blank', 'noopener,noreferrer');
});
$('useCurrentGymLocationBtn').addEventListener('click', async () => {
  if (!navigator.geolocation) return showToast('Este navegador no permite obtener ubicación.', 'error');
  if (!confirm('Usa esta opción solo si estás físicamente en la sede que estás registrando. Se rellenarán las coordenadas del formulario; todavía tendrás que guardar la sede. ¿Continuar?')) return;
  const button = $('useCurrentGymLocationBtn'); button.disabled = true; button.textContent = 'Obteniendo GPS…';
  navigator.geolocation.getCurrentPosition(position => {
    $('newGymLat').value = position.coords.latitude;
    $('newGymLng').value = position.coords.longitude;
    $('gymMapsHelp').textContent = `Coordenadas tomadas del dispositivo (precisión aproximada ${Math.round(position.coords.accuracy)} m). Verifica que el punto corresponda a la entrada del gimnasio.`;
    showToast('Coordenadas cargadas. Pulsa Guardar nueva sede.', 'success');
    button.disabled = false; button.textContent = '⌖ Usar mi ubicación actual como coordenadas';
  }, error => {
    showToast(error.code === 1 ? 'Permite el acceso a la ubicación.' : 'No se pudo obtener el GPS. Inténtalo otra vez.', 'error');
    button.disabled = false; button.textContent = '⌖ Usar mi ubicación actual como coordenadas';
  }, {enableHighAccuracy:true, timeout:18000, maximumAge:0});
});
$('gymCreateForm').addEventListener('submit', async event => {
  event.preventDefault();
  try {
    setBusy(true, 'Guardando sede…');
    await api('adminCreateGym', { name:$('newGymName').value, address:$('newGymAddress').value, mapsUrl:$('newGymMapsUrl').value, lat:$('newGymLat').value, lng:$('newGymLng').value, radiusMeters:$('newGymRadius').value, maxAccuracyMeters:$('newGymAccuracy').value });
    $('gymCreateForm').reset(); $('newGymRadius').value = 150; $('newGymAccuracy').value = 80;
    await loadAdminData($('assignUserSelect').value); await refreshAppData();
    showToast('Nueva sede guardada. Ahora asígnala a los usuarios autorizados.', 'success');
  } catch (error) { showToast(error.message, 'error'); }
  finally { setBusy(false); }
});
function renderAdminGyms() {
  const gyms = adminData.gyms || [];
  $('adminGymList').innerHTML = gyms.length ? gyms.map(g => {
    const candidate = String(g.mapsUrl || ''); const maps = /^https:\/\/(?:www\.google\.[^/]+\/maps|maps\.google\.[^/]+|maps\.app\.goo\.gl|goo\.gl\/maps)/i.test(candidate) ? candidate : `https://www.google.com/maps?q=${encodeURIComponent(g.lat + ',' + g.lng)}`;
    return `<div class="admin-gym-row"><div class="admin-gym-info"><strong>${escapeHtml(g.name)}</strong><small>${escapeHtml(g.address || 'Sin dirección')} · Radio ${escapeHtml(g.radiusMeters)} m</small><small>${escapeHtml(g.lat)}, ${escapeHtml(g.lng)}</small><a href="${escapeHtml(maps)}" target="_blank" rel="noopener noreferrer">Abrir en Google Maps ↗</a></div><span class="user-status ${g.active?'':'inactive'}">${g.active?'Activa':'Inactiva'}</span><button class="mini-action" data-toggle-gym="${escapeHtml(g.id)}" data-active="${g.active?'false':'true'}">${g.active?'Desactivar':'Activar'}</button></div>`;
  }).join('') : '<p class="empty-state">Todavía no hay gimnasios registrados. Agrega la primera sede arriba.</p>';
}
function renderAdminUserGyms() {
  const gyms = adminData.gyms || [];
  const allowed = new Set(adminData.userGymIds || []);
  $('adminUserGymAssignments').innerHTML = gyms.length ? gyms.map(g => `<label class="gym-check-row ${g.active?'':'is-inactive'}"><input type="checkbox" data-user-gym="${escapeHtml(g.id)}" ${allowed.has(g.id)?'checked':''} ${g.active?'':'disabled'}><span><strong>${escapeHtml(g.name)}</strong><small>${escapeHtml(g.address || 'Sin dirección')} · ${g.active?'Disponible':'Desactivada'}</small></span></label>`).join('') : '<p class="muted">Primero registra al menos un gimnasio.</p>';
  const selected = (adminData.users || []).find(u => u.uid === $('assignUserSelect').value);
  $('userGymStatus').textContent = selected ? `Permisos de ubicación para ${selected.nombre || selected.email}. Marca una o varias sedes y guarda los cambios.` : 'Selecciona un usuario en el apartado de planificación.';
}
$('adminGymList').addEventListener('click', async event => {
  const button = event.target.closest('[data-toggle-gym]'); if (!button) return;
  const active = button.dataset.active === 'true';
  const gym = (adminData.gyms || []).find(g => g.id === button.dataset.toggleGym);
  if (!confirm(`${active?'Activar':'Desactivar'} la sede ${gym ? gym.name : ''}? ${active?'':'Los usuarios dejarán de poder validar llegada en esta sede.'}`)) return;
  try { setBusy(true, 'Actualizando sede…'); await api('adminToggleGym', {gymId:button.dataset.toggleGym, active}); await loadAdminData($('assignUserSelect').value); await refreshAppData(); showToast('Estado de la sede actualizado.', 'success'); }
  catch (error) { showToast(error.message, 'error'); }
  finally { setBusy(false); }
});
$('saveUserGymsBtn').addEventListener('click', async () => {
  const uid = $('assignUserSelect').value;
  if (!uid) return showToast('Selecciona un usuario.', 'error');
  const gymIds = [...document.querySelectorAll('[data-user-gym]:checked')].map(el => el.dataset.userGym);
  const user = (adminData.users || []).find(u => u.uid === uid);
  if (!confirm(`Guardar ${gymIds.length} sede(s) permitida(s) para ${user ? user.nombre : 'este usuario'}?`)) return;
  try { setBusy(true, 'Guardando permisos de ubicación…'); adminData = await api('adminAssignUserGyms', {uid, gymIds}); renderAdmin(); showToast('Gimnasios autorizados actualizados.', 'success'); }
  catch (error) { showToast(error.message, 'error'); }
  finally { setBusy(false); }
});
$('migrateLegacyBtn').addEventListener('click', async () => {
  const uid = $('migrateUserSelect').value; if (!uid) return showToast('Selecciona un usuario destino.', 'error');
  if (!confirm('Importarás las hojas antiguas “Pesos”, “Registro” y “Sesiones” para el usuario seleccionado. Hazlo una sola vez. Las hojas antiguas no se borrarán. ¿Continuar?')) return;
  try { setBusy(true, 'Importando historial anterior…'); const result = await api('adminMigrateLegacyData', { uid }); await refreshAppData(); showToast(`${result.message} Pesos: ${result.weightsImported}; sesiones: ${result.sessionsImported}; ejercicios: ${result.logsImported}.`, 'success'); }
  catch (error) { showToast(error.message,'error'); }
  finally { setBusy(false); }
});

// Evita que el usuario pierda accidentalmente la sesión por un cambio de vista: la API sigue siendo la autoridad.
window.addEventListener('resize', () => {
  if (appData && currentView === 'dashboard') drawLineChart('weightChart', appData.weights || [], 'weightKg', 'kg');
  if (appData && currentView === 'body') renderMeasureChart();
});
