/**
 * GYMTRACK MULTIUSUARIO
 * Backend Google Apps Script + Google Sheets + Firebase Authentication.
 * Las hojas Gym_* se crean aparte para no sobrescribir las hojas del tracker anterior.
 */
const TZ = 'America/Guatemala';
const SPREADSHEET_ID = '12kPiHFHcqU5kndsWo2HpZjacHzJ31rfkUtbAsIwBdV4';
const FIREBASE_API_KEY = 'AIzaSyBSoI9ijz_FCWZ0rQVzrNyO9ysOdNxFvoo'; // La misma API key configurada en firebase-config.js

// Para crear el primer administrador: crea la cuenta en Firebase Console, copia su UID aquí y ejecuta autorizarAdministradorInicial().
const INITIAL_ADMIN_UID = 'PEGA_AQUI_UID_DE_FIREBASE';
const INITIAL_ADMIN_EMAIL = 'admin@ejemplo.com';
const INITIAL_ADMIN_NAME = 'Administrador';

const SHEETS = {
  USERS: 'Gym_Usuarios',
  CATALOG: 'Gym_Catalogo',
  ASSIGNMENTS: 'Gym_Asignaciones',
  SESSIONS: 'Gym_Sesiones',
  LOGS: 'Gym_Registros',
  WEIGHTS: 'Gym_Pesos',
  MEASUREMENTS: 'Gym_Medidas',
  EVOLT: 'Gym_EVOLT360',
  CONFIG: 'Gym_Config',
  GYMS: 'Gym_Gimnasios',
  USER_GYMS: 'Gym_UsuarioGimnasios'
};

const HEADERS = {
  USERS: ['uid','email','nombre','rol','activo','fechaAlta','creadoPor'],
  CATALOG: ['id','nombre','detalle','musculo','cardio','activo','creadoAt','descripcion'],
  ASSIGNMENTS: ['id','uid','dia','orden','ejercicioId','nombre','detalle','musculo','cardio','activo','asignadoPor','fechaAlta','descripcion'],
  SESSIONS: ['id','uid','fecha','dia','estado','lat','lng','distanciaM','precisionM','checkInAt','finishedAt','notas','porcentaje','gymId','gymName'],
  LOGS: ['id','sessionId','uid','fecha','dia','asignacionId','exerciseId','nombre','completado','seriesJSON','pesoKg','reps','notas','updatedAt'],
  WEIGHTS: ['id','uid','fecha','pesoKg','notas','createdAt'],
  MEASUREMENTS: ['id','uid','fecha','heightCm','weightKg','neckCm','shouldersCm','chestCm','underbustCm','waistCm','abdomenCm','hipsCm','armCm','forearmCm','wristCm','thighCm','kneeCm','calfCm','ankleCm','notes','createdAt'],
  EVOLT: ['id','uid','fecha','edad','estaturaCm','pesoKg','bwi','masaMuscularEsqueleticaKg','masaMagraKg','aguaCorporalL','bmrKcal','teeKcal','grasaPct','masaGrasaKg','grasaSubcutaneaKg','grasaVisceralNivel','areaGrasaVisceralCm2','cinturaCm','ratioCinturaCadera','notas','createdAt'],
  CONFIG: ['key','value','updatedAt'],
  GYMS: ['id','nombre','direccion','mapsUrl','lat','lng','radioMetros','precisionMaxMetros','activo','creadoPor','creadoAt'],
  USER_GYMS: ['id','uid','gymId','activo','asignadoPor','fechaAlta']
};

const DAYS = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
const DEFAULT_ROUTINE = [
  ['Lunes',1,'Press de pecho en máquina','3 series x 8-12 repeticiones','Pecho','No'],
  ['Lunes',2,'Press inclinado con barra','3 series x 8-12 repeticiones','Pecho','No'],
  ['Lunes',3,'Press de hombro en máquina','3 series x 8-12 repeticiones','Hombro','No'],
  ['Lunes',4,'Elevaciones laterales en máquina','3 series x 10-15 repeticiones','Hombro','No'],
  ['Lunes',5,'Extensión de tríceps en polea','3 series x 10-15 repeticiones','Tríceps','No'],
  ['Lunes',6,'Extensión de tríceps sobre la cabeza en polea','2 series x 10-15 repeticiones','Tríceps','No'],
  ['Lunes',7,'Abdominal crunch en máquina','3 series x 10-15 repeticiones','Abdomen','No'],
  ['Lunes',8,'Cardio caminadora, bicicleta o elíptica','30 minutos baja intensidad','Cardio','Sí'],

  ['Miércoles',1,'Jalón al pecho en polea alta','3 series x 8-12 repeticiones','Espalda','No'],
  ['Miércoles',2,'Remo sentado en polea','3 series x 8-12 repeticiones','Espalda','No'],
  ['Miércoles',3,'Remo con mancuerna en banca','3 series x 8-12 repeticiones','Espalda','No'],
  ['Miércoles',4,'Curl bíceps con mancuernas','3 series x 10-15 repeticiones','Bíceps','No'],
  ['Miércoles',5,'Curl martillo con mancuernas','3 series x 10-15 repeticiones','Bíceps','No'],
  ['Miércoles',6,'Face pull en polea','2 series x 12-15 repeticiones','Hombro posterior','No'],
  ['Miércoles',7,'Abdominal crunch en máquina','3 series x 10-15 repeticiones','Abdomen','No'],
  ['Miércoles',8,'Cardio caminadora, bicicleta o elíptica','30 minutos baja intensidad','Cardio','Sí'],

  ['Viernes',1,'Prensa de pierna','3 series x 8-12 repeticiones','Pierna','No'],
  ['Viernes',2,'Sentadilla en Smith o multipower','3 series x 8-12 repeticiones','Pierna','No'],
  ['Viernes',3,'Extensión de cuádriceps','3 series x 10-15 repeticiones','Cuádriceps','No'],
  ['Viernes',4,'Curl femoral sentado o acostado','3 series x 10-15 repeticiones','Femoral','No'],
  ['Viernes',5,'Peso muerto rumano con mancuernas','3 series x 8-12 repeticiones','Femoral / glúteo','No'],
  ['Viernes',6,'Pantorrilla en máquina o prensa','3 series x 12-20 repeticiones','Pantorrilla','No'],
  ['Viernes',7,'Abdominal crunch en máquina','3 series x 10-15 repeticiones','Abdomen','No'],
  ['Viernes',8,'Elevación de piernas','3 series x 10-15 repeticiones','Abdomen','No'],
  ['Viernes',9,'Estiramiento suave','5-10 minutos, sin cardio','Recuperación','No'],

  ['Sábado',1,'Press de pecho en máquina','3 series x 10-12 repeticiones','Pecho','No'],
  ['Sábado',2,'Jalón al pecho agarre cerrado','3 series x 10-12 repeticiones','Espalda','No'],
  ['Sábado',3,'Remo en máquina o polea','3 series x 10-12 repeticiones','Espalda','No'],
  ['Sábado',4,'Press de hombro en máquina','2 series x 10-12 repeticiones','Hombro','No'],
  ['Sábado',5,'Curl bíceps en polea','2 series x 10-15 repeticiones','Bíceps','No'],
  ['Sábado',6,'Extensión tríceps en polea','2 series x 10-15 repeticiones','Tríceps','No'],
  ['Sábado',7,'Abdominal crunch en máquina','3 series x 10-15 repeticiones','Abdomen','No'],
  ['Sábado',8,'Cardio caminadora, bicicleta o elíptica','30 minutos baja intensidad','Cardio','Sí']
];

/** Inicializa las hojas nuevas sin borrar las hojas antiguas. Ejecutar manualmente una vez. */
function inicializarSistema() {
  ensureSystem_();
  return 'GymTrack inicializado. Se crearon/verificaron las hojas Gym_* sin borrar las hojas anteriores.';
}

/** Ejecutar después de completar INITIAL_ADMIN_UID/EMAIL/NAME. No guarda contraseñas. */
function autorizarAdministradorInicial() {
  ensureSystem_();
  if (!INITIAL_ADMIN_UID || INITIAL_ADMIN_UID.indexOf('PEGA_AQUI') >= 0) {
    throw new Error('Primero crea el usuario en Firebase Console y pega su UID en INITIAL_ADMIN_UID.');
  }
  const existing = findObject_(SHEETS.USERS, 'uid', INITIAL_ADMIN_UID);
  const email = String(INITIAL_ADMIN_EMAIL || '').trim().toLowerCase();
  const name = String(INITIAL_ADMIN_NAME || 'Administrador').trim();
  if (existing) {
    updateRow_(SHEETS.USERS, existing._row, { email: email || existing.email, nombre: name || existing.nombre, rol: 'admin', activo: true });
  } else {
    appendObject_(SHEETS.USERS, { uid: INITIAL_ADMIN_UID, email: email, nombre: name, rol: 'admin', activo: true, fechaAlta: now_(), creadoPor: 'configuración inicial' });
  }
  return 'Administrador autorizado: ' + (email || INITIAL_ADMIN_UID);
}

function doGet(e) {
  const p = e && e.parameter ? e.parameter : {};
  if (p.action === 'result') return getResultResponse_(p);
  if (p.action === 'health') return apiResponse_(p.callback, true, { service: 'GymTrack API', status: 'ok', time: now_() }, '');
  return ContentService.createTextOutput('GymTrack API activa. Usa la aplicación web para iniciar sesión.').setMimeType(ContentService.MimeType.TEXT);
}

/** La app envía las operaciones por POST en el cuerpo, nunca en la URL. */
function doPost(e) {
  let req = {};
  try {
    req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'El cuerpo de la solicitud no es JSON válido.' })).setMimeType(ContentService.MimeType.JSON);
  }
  const requestId = String(req.requestId || '');
  if (!/^[a-zA-Z0-9_-]{20,80}$/.test(requestId)) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'requestId inválido.' })).setMimeType(ContentService.MimeType.JSON);
  }
  let result;
  try {
    ensureSystem_();
    const data = processRequest_(req);
    result = { ok: true, data: data, error: '' };
  } catch (err) {
    result = { ok: false, data: null, error: friendlyError_(err) };
  }
  CacheService.getScriptCache().put('result_' + requestId, JSON.stringify(result), 120);
  return ContentService.createTextOutput(JSON.stringify({ accepted: true, requestId: requestId })).setMimeType(ContentService.MimeType.JSON);
}

function processRequest_(req) {
  const action = String(req.action || '');
  const payload = req.payload || {};
  if (action === 'bootstrap' || action === 'getAppData') {
    const user = authenticate_(req.idToken);
    return getAppData_(user);
  }
  if (action === 'saveWeight') return saveWeight_(authenticate_(req.idToken), payload);
  if (action === 'saveMeasurements') return saveMeasurements_(authenticate_(req.idToken), payload);
  if (action === 'saveEvolt') return saveEvolt_(authenticate_(req.idToken), payload);
  if (action === 'checkIn') return checkIn_(authenticate_(req.idToken), payload);
  if (action === 'saveWorkout') return saveWorkout_(authenticate_(req.idToken), payload);
  if (action === 'finishWorkout') return finishWorkout_(authenticate_(req.idToken), payload);
  if (action === 'importBodytrack') return importBodytrack_(authenticate_(req.idToken), payload);

  const admin = requireAdmin_(req.idToken);
  if (action === 'adminGetData') return getAdminData_(admin, payload.uid);
  if (action === 'adminCreateUser') return adminCreateUser_(admin, payload);
  if (action === 'adminCreateExercise') return adminCreateExercise_(admin, payload);
  if (action === 'adminToggleUser') return adminToggleUser_(admin, payload);
  if (action === 'adminAssignTemplate') return adminAssignTemplate_(admin, payload);
  if (action === 'adminAddAssignment') return adminAddAssignment_(admin, payload);
  if (action === 'adminRemoveAssignment') return adminRemoveAssignment_(admin, payload);
  if (action === 'adminSaveGymSettings') return adminSaveGymSettings_(admin, payload);
  if (action === 'adminSetGymLocation') return adminSetGymLocation_(admin, payload);
  if (action === 'adminCreateGym') return adminCreateGym_(admin, payload);
  if (action === 'adminAssignUserGyms') return adminAssignUserGyms_(admin, payload);
  if (action === 'adminToggleGym') return adminToggleGym_(admin, payload);
  if (action === 'adminMigrateLegacyData') return adminMigrateLegacyData_(admin, payload);
  throw new Error('Acción no reconocida.');
}

function getResultResponse_(params) {
  const requestId = String(params.requestId || '');
  const callback = params.callback;
  if (!/^[a-zA-Z0-9_-]{20,80}$/.test(requestId)) return apiResponse_(callback, false, null, 'requestId inválido.');
  const raw = CacheService.getScriptCache().get('result_' + requestId);
  if (!raw) return apiResponse_(callback, true, { pending: true }, '');
  return jsonpResponse_(callback, raw);
}

function apiResponse_(callback, ok, data, error) {
  return jsonpResponse_(callback, JSON.stringify({ ok: ok, data: data, error: error || '' }));
}

function jsonpResponse_(callback, jsonText) {
  const name = String(callback || '').trim();
  if (!/^[a-zA-Z_$][0-9a-zA-Z_$]*$/.test(name)) {
    return ContentService.createTextOutput(jsonText).setMimeType(ContentService.MimeType.JSON);
  }
  return ContentService.createTextOutput(name + '(' + jsonText + ');').setMimeType(ContentService.MimeType.JAVASCRIPT);
}

function authenticate_(idToken) {
  const firebaseUser = verifyFirebaseToken_(String(idToken || ''));
  const row = findObject_(SHEETS.USERS, 'uid', firebaseUser.localId);
  if (!row) throw new Error('Tu cuenta de Firebase todavía no está habilitada en GymTrack. Pide al administrador que te registre.');
  if (!asBool_(row.activo)) throw new Error('Tu usuario está desactivado. Contacta al administrador.');
  if (firebaseUser.email && String(row.email || '').toLowerCase() !== String(firebaseUser.email).toLowerCase()) {
    updateRow_(SHEETS.USERS, row._row, { email: String(firebaseUser.email).toLowerCase() });
    row.email = String(firebaseUser.email).toLowerCase();
  }
  return { uid: String(row.uid), email: String(row.email || firebaseUser.email || ''), nombre: String(row.nombre || ''), rol: String(row.rol || 'usuario').toLowerCase(), activo: true };
}

function requireAdmin_(idToken) {
  const user = authenticate_(idToken);
  if (user.rol !== 'admin' && user.rol !== 'administrador') throw new Error('Esta acción requiere permisos de administrador.');
  return user;
}

function verifyFirebaseToken_(idToken) {
  if (!idToken || idToken.length < 50) throw new Error('Tu sesión no es válida. Inicia sesión nuevamente.');
  if (!FIREBASE_API_KEY || FIREBASE_API_KEY.indexOf('CONFIGURAR_') === 0) throw new Error('Falta configurar FIREBASE_API_KEY en Codigo.gs.');
  const url = 'https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' + encodeURIComponent(FIREBASE_API_KEY);
  const response = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({ idToken: idToken }),
    muteHttpExceptions: true
  });
  const status = response.getResponseCode();
  let data = {};
  try { data = JSON.parse(response.getContentText() || '{}'); } catch (e) {}
  if (status < 200 || status >= 300 || !data.users || !data.users.length) {
    throw new Error('La sesión de Firebase expiró o no se pudo verificar. Vuelve a iniciar sesión.');
  }
  return data.users[0];
}

function firebaseCreateUser_(email, password) {
  if (!FIREBASE_API_KEY || FIREBASE_API_KEY.indexOf('CONFIGURAR_') === 0) throw new Error('Falta configurar FIREBASE_API_KEY en Codigo.gs.');
  const url = 'https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=' + encodeURIComponent(FIREBASE_API_KEY);
  const response = UrlFetchApp.fetch(url, {
    method: 'post', contentType: 'application/json',
    payload: JSON.stringify({ email: email, password: password, returnSecureToken: true }),
    muteHttpExceptions: true
  });
  let data = {};
  try { data = JSON.parse(response.getContentText() || '{}'); } catch (e) {}
  if (response.getResponseCode() < 200 || response.getResponseCode() >= 300 || !data.localId) {
    const message = data && data.error && data.error.message ? data.error.message : 'No se pudo crear la cuenta en Firebase.';
    const translated = message.indexOf('EMAIL_EXISTS') >= 0 ? 'Ese correo ya tiene una cuenta en Firebase.' :
      message.indexOf('WEAK_PASSWORD') >= 0 ? 'La contraseña es demasiado débil. Usa al menos 8 caracteres.' :
      message.indexOf('INVALID_EMAIL') >= 0 ? 'El correo electrónico no es válido.' : message;
    throw new Error(translated);
  }
  return { uid: data.localId, email: data.email || email };
}

function getAppData_(user) {
  const today = todayKey_();
  const day = todayDay_();
  getObjects_(SHEETS.SESSIONS).filter(r => String(r.uid) === user.uid && normalizeDate_(r.fecha) < today && String(r.estado) === 'activa').forEach(r => updateRow_(SHEETS.SESSIONS, r._row, { estado: 'incompleta', finishedAt: now_() }));
  const config = getConfig_();
  const allowedGyms = getUserGyms_(user.uid).map(publicGym_);
  const allAssignments = getObjects_(SHEETS.ASSIGNMENTS).filter(r => String(r.uid) === user.uid && asBool_(r.activo));
  const assignmentsByDay = {};
  DAYS.forEach(d => assignmentsByDay[d] = []);
  allAssignments.forEach(r => {
    if (!assignmentsByDay[r.dia]) assignmentsByDay[r.dia] = [];
    assignmentsByDay[r.dia].push(publicAssignment_(r));
  });
  Object.keys(assignmentsByDay).forEach(d => assignmentsByDay[d].sort((a,b) => Number(a.orden)-Number(b.orden)));

  const sessions = getObjects_(SHEETS.SESSIONS).filter(r => String(r.uid) === user.uid).sort((a,b) => String(b.fecha).localeCompare(String(a.fecha)) || String(b.checkInAt).localeCompare(String(a.checkInAt)));
  const todaySession = sessions.find(r => String(r.fecha) === today && ['activa','completada'].includes(String(r.estado))) || null;
  const activeSession = todaySession && String(todaySession.estado) === 'activa' ? todaySession : null;
  const todayAssignments = assignmentsByDay[day] || [];
  const userLogs = getObjects_(SHEETS.LOGS).filter(r => String(r.uid) === user.uid);
  const todayLogs = todaySession ? userLogs.filter(r => String(r.sessionId) === String(todaySession.id)) : [];
  const logMap = {};
  todayLogs.forEach(r => { logMap[String(r.asignacionId)] = publicLog_(r); });
  const routine = todayAssignments.map(a => Object.assign({}, a, { log: logMap[a.id] || null }));
  const weakCounts = {};
  userLogs.filter(r => !asBool_(r.completado)).forEach(r => { const name = String(r.nombre || 'Ejercicio'); weakCounts[name] = (weakCounts[name] || 0) + 1; });
  const weakPoints = Object.keys(weakCounts).map(name => ({ name: name, times: weakCounts[name] })).sort((a,b) => b.times-a.times).slice(0,5);

  const weights = getObjects_(SHEETS.WEIGHTS).filter(r => String(r.uid) === user.uid).map(r => ({
    id: r.id, date: normalizeDate_(r.fecha), weightKg: toNum_(r.pesoKg), notes: String(r.notas || ''), createdAt: r.createdAt || ''
  })).filter(r => r.date && r.weightKg > 0).sort((a,b) => a.date.localeCompare(b.date));
  const measurements = getObjects_(SHEETS.MEASUREMENTS).filter(r => String(r.uid) === user.uid).map(publicMeasurement_).filter(r => r.date).sort((a,b) => a.date.localeCompare(b.date));
  const evolt = getObjects_(SHEETS.EVOLT).filter(r => String(r.uid) === user.uid).map(publicEvolt_).filter(r => r.date).sort((a,b) => a.date.localeCompare(b.date));
  const monthPrefix = today.slice(0,7);
  const completedSessionsThisMonth = sessions.filter(r => String(r.fecha).slice(0,7) === monthPrefix && String(r.estado) === 'completada').length;

  return {
    profile: { uid: user.uid, email: user.email, nombre: user.nombre, rol: user.rol },
    dateKey: today, todayDay: day, days: DAYS, assignedDays: Object.keys(assignmentsByDay).filter(d => assignmentsByDay[d].length),
    assignmentsByDay: assignmentsByDay, routine: routine,
    session: todaySession ? publicSession_(todaySession) : null,
    gyms: allowedGyms,
    gym: allowedGyms.length ? allowedGyms[0] : { name: '', configured: false, radiusMeters: 150, maxAccuracyMeters: 80 },
    weights: weights.slice(-40), measurements: measurements.slice(-30), evolt: evolt.slice(-20), weakPoints: weakPoints,
    sessions: sessions.slice(0,15).map(publicSession_),
    summary: {
      latestWeight: weights.length ? weights[weights.length-1] : null,
      latestMeasurement: measurements.length ? measurements[measurements.length-1] : null,
      latestEvolt: evolt.length ? evolt[evolt.length-1] : null,
      completedSessionsThisMonth: completedSessionsThisMonth,
      todayTotal: routine.length,
      todayDone: routine.filter(r => r.log && asBool_(r.log.completado)).length
    }
  };
}

function checkIn_(user, payload) {
  const day = todayDay_();
  const assignments = getObjects_(SHEETS.ASSIGNMENTS).filter(r => String(r.uid) === user.uid && String(r.dia) === day && asBool_(r.activo));
  if (!assignments.length) throw new Error('No tienes ejercicios asignados para hoy (' + day + '). Contacta al administrador.');
  const assignedGyms = getUserGyms_(user.uid);
  if (!assignedGyms.length) throw new Error('El administrador todavía no te asignó un gimnasio autorizado.');
  let gymId = String(payload.gymId || '');
  if (!gymId && assignedGyms.length === 1) gymId = String(assignedGyms[0].id);
  const gym = assignedGyms.find(g => String(g.id) === gymId && asBool_(g.activo));
  if (!gym) throw new Error(assignedGyms.length > 1 ? 'Selecciona uno de los gimnasios que tienes autorizados.' : 'El gimnasio seleccionado no está autorizado para tu cuenta.');
  const lat = Number(payload.latitude), lng = Number(payload.longitude), accuracy = Number(payload.accuracy);
  if (!isFinite(lat) || !isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) throw new Error('No se pudo obtener una ubicación válida. Activa el GPS e inténtalo de nuevo.');
  const maxAccuracy = Number(gym.precisionMaxMetros || 80);
  if (!isFinite(accuracy) || accuracy <= 0 || accuracy > maxAccuracy) throw new Error('La precisión del GPS es insuficiente (' + Math.round(accuracy || 0) + ' m). Activa la ubicación precisa e inténtalo otra vez.');
  const distance = haversineMeters_(lat, lng, Number(gym.lat), Number(gym.lng));
  const radius = Number(gym.radioMetros || 150);
  if (distance > radius) throw new Error('Estás fuera de la zona autorizada de ' + gym.nombre + ': aproximadamente ' + Math.round(distance) + ' m. Radio permitido: ' + radius + ' m.');

  const today = todayKey_();
  const existing = getObjects_(SHEETS.SESSIONS).find(r => String(r.uid) === user.uid && String(r.fecha) === today && ['activa','completada'].includes(String(r.estado)));
  if (existing && String(existing.estado) === 'completada') throw new Error('Ya finalizaste una sesión hoy. Puedes consultar el registro, pero no iniciar otra sesión el mismo día.');
  if (existing) return { session: publicSession_(existing), distanceM: Math.round(distance), accuracyM: Math.round(accuracy), alreadyActive: true };
  const session = {
    id: newId_('SES'), uid: user.uid, fecha: today, dia: day, estado: 'activa', lat: lat, lng: lng,
    distanciaM: Math.round(distance), precisionM: Math.round(accuracy), checkInAt: now_(), finishedAt: '', notas: '', porcentaje: 0,
    gymId: String(gym.id), gymName: String(gym.nombre)
  };
  appendObject_(SHEETS.SESSIONS, session);
  return { session: publicSession_(session), distanceM: Math.round(distance), accuracyM: Math.round(accuracy), alreadyActive: false };
}

function saveWorkout_(user, payload) {
  const session = findObject_(SHEETS.SESSIONS, 'id', String(payload.sessionId || ''));
  if (!session || String(session.uid) !== user.uid) throw new Error('No se encontró tu sesión de entrenamiento. Confirma tu llegada nuevamente.');
  if (String(session.fecha) !== todayKey_() || String(session.estado) !== 'activa') throw new Error('La sesión ya no está activa. Confirma tu llegada para iniciar una nueva sesión.');
  const assignments = getObjects_(SHEETS.ASSIGNMENTS).filter(r => String(r.uid) === user.uid && String(r.dia) === String(session.dia) && asBool_(r.activo));
  const assignmentMap = {};
  assignments.forEach(a => assignmentMap[String(a.id)] = a);
  const exercises = Array.isArray(payload.exercises) ? payload.exercises : [];
  if (exercises.length > 100) throw new Error('La rutina tiene demasiados ejercicios para guardar.');
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    exercises.forEach(ex => {
      const assignment = assignmentMap[String(ex.assignmentId || '')];
      if (!assignment) return; // No permite escribir ejercicios que no están asignados al usuario.
      const sets = Array.isArray(ex.sets) ? ex.sets.slice(0,10).map((s, i) => ({
        set: i + 1,
        weightKg: validOptionalNumber_(s.weightKg, 0, 500),
        reps: validOptionalNumber_(s.reps, 0, 300)
      })) : [];
      const weightValues = sets.map(s => s.weightKg).filter(v => v !== '' && v !== null && v !== undefined);
      const repsValues = sets.map(s => s.reps).filter(v => v !== '' && v !== null && v !== undefined);
      const existing = getObjects_(SHEETS.LOGS).find(r => String(r.sessionId) === String(session.id) && String(r.asignacionId) === String(assignment.id));
      const row = {
        id: existing ? existing.id : newId_('LOG'), sessionId: session.id, uid: user.uid, fecha: todayKey_(), dia: session.dia,
        asignacionId: assignment.id, exerciseId: assignment.ejercicioId, nombre: assignment.nombre,
        completado: ex.done === true, seriesJSON: JSON.stringify(sets), pesoKg: weightValues.length ? weightValues[weightValues.length-1] : '',
        reps: repsValues.length ? repsValues[repsValues.length-1] : '', notas: cleanText_(ex.notes, 500), updatedAt: now_()
      };
      if (existing) updateRow_(SHEETS.LOGS, existing._row, row); else appendObject_(SHEETS.LOGS, row);
    });
  } finally { lock.releaseLock(); }
  const updatedLogs = getObjects_(SHEETS.LOGS).filter(r => String(r.sessionId) === String(session.id));
  const done = updatedLogs.filter(r => asBool_(r.completado)).length;
  updateRow_(SHEETS.SESSIONS, session._row, { porcentaje: assignments.length ? Math.round(done / assignments.length * 100) : 0, notas: cleanText_(payload.notes, 500) });
  return getAppData_(user);
}

function finishWorkout_(user, payload) {
  const session = findObject_(SHEETS.SESSIONS, 'id', String(payload.sessionId || ''));
  if (!session || String(session.uid) !== user.uid) throw new Error('No se encontró tu sesión activa.');
  if (String(session.fecha) !== todayKey_() || String(session.estado) !== 'activa') throw new Error('Esta sesión ya fue finalizada.');
  const assignments = getObjects_(SHEETS.ASSIGNMENTS).filter(r => String(r.uid) === user.uid && String(r.dia) === String(session.dia) && asBool_(r.activo));
  const logs = getObjects_(SHEETS.LOGS).filter(r => String(r.sessionId) === String(session.id));
  const done = logs.filter(r => asBool_(r.completado)).length;
  const percent = assignments.length ? Math.round(done / assignments.length * 100) : 0;
  updateRow_(SHEETS.SESSIONS, session._row, { estado: 'completada', finishedAt: now_(), notas: cleanText_(payload.notes, 500), porcentaje: percent });
  return getAppData_(user);
}

function saveWeight_(user, payload) {
  const date = validDate_(payload.date || todayKey_());
  const weight = Number(String(payload.weightKg || '').replace(',', '.'));
  if (!date || !isFinite(weight) || weight < 30 || weight > 250) throw new Error('Ingresa una fecha válida y un peso entre 30 y 250 kg.');
  const row = { id: newId_('PES'), uid: user.uid, fecha: date, pesoKg: round1_(weight), notas: cleanText_(payload.notes, 300), createdAt: now_() };
  upsertByUidDate_(SHEETS.WEIGHTS, user.uid, date, row);
  return getAppData_(user);
}

const MEASURE_FIELDS = [
  ['heightCm','Estatura',110,225],['weightKg','Peso',20,330],['neckCm','Cuello',18,70],['shouldersCm','Hombros',60,170],
  ['chestCm','Pecho',50,180],['underbustCm','Bajo pecho',48,170],['waistCm','Cintura',40,170],['abdomenCm','Abdomen bajo',40,180],
  ['hipsCm','Cadera',50,190],['armCm','Brazo',14,70],['forearmCm','Antebrazo',12,60],['wristCm','Muñeca',9,35],
  ['thighCm','Muslo',25,110],['kneeCm','Rodilla',22,75],['calfCm','Pantorrilla',15,75],['ankleCm','Tobillo',10,45]
];

function saveMeasurements_(user, payload) {
  const date = validDate_(payload.date || todayKey_());
  if (!date) throw new Error('La fecha de evaluación no es válida.');
  const row = { id: newId_('MED'), uid: user.uid, fecha: date, notes: cleanText_(payload.notes, 600), createdAt: now_() };
  let filled = 0;
  MEASURE_FIELDS.forEach(f => {
    const raw = payload[f[0]];
    if (raw === '' || raw === null || raw === undefined) { row[f[0]] = ''; return; }
    const n = Number(String(raw).replace(',', '.'));
    if (!isFinite(n) || n < f[2] || n > f[3]) throw new Error(f[1] + ' debe estar entre ' + f[2] + ' y ' + f[3] + '.');
    row[f[0]] = round1_(n); filled++;
  });
  if (!filled) throw new Error('Ingresa al menos una medida corporal.');
  const existingMeasurement = getObjects_(SHEETS.MEASUREMENTS).find(r => String(r.uid) === user.uid && normalizeDate_(r.fecha) === date);
  if (existingMeasurement) {
    MEASURE_FIELDS.forEach(f => { if (row[f[0]] === '' && existingMeasurement[f[0]] !== '' && existingMeasurement[f[0]] !== null) row[f[0]] = existingMeasurement[f[0]]; });
    row.id = existingMeasurement.id;
    row.notes = row.notes || existingMeasurement.notes || '';
  }
  upsertByUidDate_(SHEETS.MEASUREMENTS, user.uid, date, row);
  if (row.weightKg) upsertByUidDate_(SHEETS.WEIGHTS, user.uid, date, { id: newId_('PES'), uid: user.uid, fecha: date, pesoKg: row.weightKg, notas: 'Peso registrado en medidas corporales', createdAt: now_() });
  return getAppData_(user);
}

function saveEvolt_(user, payload) {
  const date = validDate_(payload.date || todayKey_());
  if (!date) throw new Error('La fecha de evaluación EVOLT no es válida.');
  const fields = [
    ['edad','Edad',1,110],['estaturaCm','Estatura',110,225],['pesoKg','Peso',30,250],['bwi','BWI',0,10],
    ['masaMuscularEsqueleticaKg','Masa muscular esquelética',0,150],['masaMagraKg','Masa magra',0,200],['aguaCorporalL','Agua corporal',0,150],
    ['bmrKcal','Metabolismo basal',0,10000],['teeKcal','Gasto energético total',0,15000],['grasaPct','Porcentaje de grasa',0,80],
    ['masaGrasaKg','Masa grasa',0,150],['grasaSubcutaneaKg','Grasa subcutánea',0,150],['grasaVisceralNivel','Nivel de grasa visceral',0,50],
    ['areaGrasaVisceralCm2','Área de grasa visceral',0,1000],['cinturaCm','Cintura',0,250],['ratioCinturaCadera','Relación cintura/cadera',0,3]
  ];
  const row = { id: newId_('EV'), uid: user.uid, fecha: date, notas: cleanText_(payload.notes, 600), createdAt: now_() };
  let filled = 0;
  fields.forEach(f => {
    const raw = payload[f[0]];
    if (raw === '' || raw === null || raw === undefined) { row[f[0]] = ''; return; }
    const n = Number(String(raw).replace(',', '.'));
    if (!isFinite(n) || n < f[2] || n > f[3]) throw new Error(f[1] + ' tiene un valor inválido.');
    row[f[0]] = f[0] === 'edad' || f[0] === 'bmrKcal' || f[0] === 'teeKcal' || f[0] === 'grasaVisceralNivel' ? Math.round(n) : round1_(n);
    filled++;
  });
  if (!filled) throw new Error('Completa al menos un dato de la evaluación EVOLT 360.');
  upsertByUidDate_(SHEETS.EVOLT, user.uid, date, row);
  if (row.pesoKg) upsertByUidDate_(SHEETS.WEIGHTS, user.uid, date, { id: newId_('PES'), uid: user.uid, fecha: date, pesoKg: row.pesoKg, notas: 'Peso importado de EVOLT 360', createdAt: now_() });
  if (row.estaturaCm || row.pesoKg || row.cinturaCm) {
    const existingMeasure = getObjects_(SHEETS.MEASUREMENTS).find(r => String(r.uid) === user.uid && normalizeDate_(r.fecha) === date);
    const m = { id: existingMeasure ? existingMeasure.id : newId_('MED'), uid: user.uid, fecha: date, notes: existingMeasure ? (existingMeasure.notes || 'Datos de la evaluación EVOLT 360') : 'Datos de la evaluación EVOLT 360', createdAt: now_() };
    MEASURE_FIELDS.forEach(f => m[f[0]] = existingMeasure && existingMeasure[f[0]] !== '' && existingMeasure[f[0]] !== null ? existingMeasure[f[0]] : '');
    if (row.estaturaCm) m.heightCm = row.estaturaCm;
    if (row.pesoKg) m.weightKg = row.pesoKg;
    if (row.cinturaCm) m.waistCm = row.cinturaCm;
    upsertByUidDate_(SHEETS.MEASUREMENTS, user.uid, date, m);
  }
  return getAppData_(user);
}

function importBodytrack_(user, payload) {
  const records = Array.isArray(payload.records) ? payload.records : [];
  if (!records.length) throw new Error('El respaldo no contiene evaluaciones para importar.');
  if (records.length > 2000) throw new Error('El respaldo supera el máximo de 2,000 evaluaciones.');
  let imported = 0;
  const map = { height:'heightCm', weight:'weightKg', neck:'neckCm', shoulders:'shouldersCm', chest:'chestCm', underbust:'underbustCm', waist:'waistCm', abdomen:'abdomenCm', hips:'hipsCm', arm:'armCm', forearm:'forearmCm', wrist:'wristCm', thigh:'thighCm', knee:'kneeCm', calf:'calfCm', ankle:'ankleCm' };
  records.forEach(rec => {
    const date = validDate_(rec.date);
    const measure = rec.measure || {};
    if (!date) return;
    const row = { id: newId_('MED'), uid: user.uid, fecha: date, notes: cleanText_(rec.notes || 'Importado desde BodyTrack V3', 600), createdAt: now_() };
    let filled = 0;
    MEASURE_FIELDS.forEach(f => row[f[0]] = '');
    Object.keys(map).forEach(k => {
      if (measure[k] === '' || measure[k] === null || measure[k] === undefined) return;
      const field = MEASURE_FIELDS.find(f => f[0] === map[k]);
      const n = Number(String(measure[k]).replace(',', '.'));
      if (!field || !isFinite(n) || n < field[2] || n > field[3]) return;
      row[map[k]] = round1_(n); filled++;
    });
    if (!filled) return;
    const existing = getObjects_(SHEETS.MEASUREMENTS).find(r => String(r.uid) === user.uid && normalizeDate_(r.fecha) === date);
    if (existing) {
      MEASURE_FIELDS.forEach(f => { if (row[f[0]] === '' && existing[f[0]] !== '' && existing[f[0]] !== null) row[f[0]] = existing[f[0]]; });
      row.id = existing.id; row.notes = row.notes || existing.notes || '';
    }
    upsertByUidDate_(SHEETS.MEASUREMENTS, user.uid, date, row);
    if (row.weightKg) upsertByUidDate_(SHEETS.WEIGHTS, user.uid, date, { id: newId_('PES'), uid: user.uid, fecha: date, pesoKg: row.weightKg, notas: 'Importado desde BodyTrack V3', createdAt: now_() });
    imported++;
  });
  if (!imported) throw new Error('No se pudo importar ninguna evaluación. Revisa el respaldo de BodyTrack.');
  return { appData: getAppData_(user), imported: imported };
}

function getAdminData_(admin, selectedUid) {
  const users = getObjects_(SHEETS.USERS).map(r => ({ uid: String(r.uid), email: String(r.email || ''), nombre: String(r.nombre || ''), rol: String(r.rol || 'usuario'), activo: asBool_(r.activo), fechaAlta: r.fechaAlta || '' }));
  const catalog = getObjects_(SHEETS.CATALOG).filter(r => asBool_(r.activo)).map(r => ({ id: String(r.id), nombre: String(r.nombre), descripcion: String(r.descripcion || ''), detalle: String(r.detalle || ''), musculo: String(r.musculo || ''), cardio: String(r.cardio || 'No') })).sort((a,b) => a.nombre.localeCompare(b.nombre));
  const targetUid = users.some(u => u.uid === String(selectedUid || '')) ? String(selectedUid) : (users.some(u => u.uid === admin.uid) ? admin.uid : (users[0] ? users[0].uid : ''));
  const assignments = getObjects_(SHEETS.ASSIGNMENTS).filter(r => String(r.uid) === targetUid && asBool_(r.activo)).map(publicAssignment_);
  const gyms = getObjects_(SHEETS.GYMS).map(publicGym_).sort((a,b) => a.name.localeCompare(b.name));
  const userGymIds = getObjects_(SHEETS.USER_GYMS).filter(r => String(r.uid) === targetUid && asBool_(r.activo)).map(r => String(r.gymId));
  return { users: users, catalog: catalog, assignments: assignments, selectedUid: targetUid, gyms: gyms, userGymIds: userGymIds, currentAdminUid: admin.uid };
}

function adminCreateUser_(admin, payload) {
  const name = cleanText_(payload.name, 100);
  const email = String(payload.email || '').trim().toLowerCase();
  const password = String(payload.password || '');
  const role = String(payload.role || 'usuario').toLowerCase() === 'admin' ? 'admin' : 'usuario';
  if (!name) throw new Error('Escribe el nombre del usuario.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Escribe un correo válido.');
  if (password.length < 8) throw new Error('La contraseña debe tener al menos 8 caracteres.');
  if (getObjects_(SHEETS.USERS).some(r => String(r.email).toLowerCase() === email)) throw new Error('Ese correo ya está registrado en GymTrack.');
  const fb = firebaseCreateUser_(email, password);
  appendObject_(SHEETS.USERS, { uid: fb.uid, email: fb.email, nombre: name, rol: role, activo: true, fechaAlta: now_(), creadoPor: admin.uid });
  return { message: 'Usuario creado. Debe iniciar sesión con el correo y contraseña asignados.', users: getAdminData_(admin, fb.uid).users };
}

function adminCreateExercise_(admin, payload) {
  const name = cleanText_(payload.name, 120);
  const detail = cleanText_(payload.detail, 250);
  const description = cleanText_(payload.description, 800);
  const muscle = cleanText_(payload.muscle || 'General', 80);
  const cardio = String(payload.cardio || 'No').toLowerCase() === 'sí' || String(payload.cardio || '').toLowerCase() === 'si' ? 'Sí' : 'No';
  if (!name) throw new Error('Escribe el nombre del ejercicio.');
  if (!description) throw new Error('Escribe una descripción del ejercicio.');
  if (getObjects_(SHEETS.CATALOG).some(r => String(r.nombre).toLowerCase() === name.toLowerCase())) throw new Error('Ya existe un ejercicio con ese nombre en el catálogo.');
  appendObject_(SHEETS.CATALOG, { id: newId_('EX'), nombre: name, detalle: detail || '3 series x 8-12 repeticiones', musculo: muscle, cardio: cardio, activo: true, creadoAt: now_(), descripcion: description });
  return getAdminData_(admin, admin.uid);
}

function adminToggleUser_(admin, payload) {
  const uid = String(payload.uid || '');
  if (!uid) throw new Error('Selecciona un usuario.');
  if (uid === admin.uid && payload.active === false) throw new Error('No puedes desactivar tu propia cuenta de administrador.');
  const row = findObject_(SHEETS.USERS, 'uid', uid);
  if (!row) throw new Error('No se encontró el usuario.');
  updateRow_(SHEETS.USERS, row._row, { activo: payload.active === true });
  return getAdminData_(admin, admin.uid);
}

function adminAssignTemplate_(admin, payload) {
  const uid = String(payload.uid || '');
  if (!findObject_(SHEETS.USERS, 'uid', uid)) throw new Error('Selecciona un usuario válido.');
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    getObjects_(SHEETS.ASSIGNMENTS).filter(r => String(r.uid) === uid && asBool_(r.activo)).forEach(r => updateRow_(SHEETS.ASSIGNMENTS, r._row, { activo: false }));
    const catalog = getObjects_(SHEETS.CATALOG);
    DEFAULT_ROUTINE.forEach(r => {
      const [day, order, name, detail, muscle, cardio] = r;
      const cat = catalog.find(c => String(c.nombre).toLowerCase() === name.toLowerCase());
      if (!cat) throw new Error('No se encontró en el catálogo: ' + name);
      appendObject_(SHEETS.ASSIGNMENTS, { id: newId_('ASG'), uid: uid, dia: day, orden: order, ejercicioId: cat.id, nombre: name, detalle: detail, musculo: muscle, cardio: cardio, activo: true, asignadoPor: admin.uid, fechaAlta: now_(), descripcion: String(cat.descripcion || '') });
    });
  } finally { lock.releaseLock(); }
  return { message: 'Rutina base asignada. Las asignaciones anteriores se desactivaron; el historial no se borró.', adminData: getAdminData_(admin, uid) };
}

function adminAddAssignment_(admin, payload) {
  const uid = String(payload.uid || ''), day = String(payload.day || ''), exerciseId = String(payload.exerciseId || '');
  if (!findObject_(SHEETS.USERS, 'uid', uid)) throw new Error('Selecciona un usuario válido.');
  if (DAYS.indexOf(day) < 0) throw new Error('Selecciona un día válido.');
  const cat = findObject_(SHEETS.CATALOG, 'id', exerciseId);
  if (!cat || !asBool_(cat.activo)) throw new Error('Selecciona un ejercicio válido del catálogo.');
  const existing = getObjects_(SHEETS.ASSIGNMENTS).filter(r => String(r.uid) === uid && String(r.dia) === day && asBool_(r.activo));
  const order = existing.reduce((max,r) => Math.max(max, Number(r.orden) || 0), 0) + 1;
  appendObject_(SHEETS.ASSIGNMENTS, { id: newId_('ASG'), uid: uid, dia: day, orden: order, ejercicioId: cat.id, nombre: cat.nombre, detalle: cleanText_(payload.detail || cat.detalle, 250), musculo: cat.musculo, cardio: cat.cardio, activo: true, asignadoPor: admin.uid, fechaAlta: now_(), descripcion: String(cat.descripcion || '') });
  return getAdminData_(admin, uid);
}

function adminRemoveAssignment_(admin, payload) {
  const id = String(payload.assignmentId || '');
  const row = findObject_(SHEETS.ASSIGNMENTS, 'id', id);
  if (!row) throw new Error('No se encontró la asignación.');
  updateRow_(SHEETS.ASSIGNMENTS, row._row, { activo: false });
  return getAdminData_(admin, String(row.uid));
}

function adminSaveGymSettings_(admin, payload) {
  const radius = Number(payload.radiusMeters || 150), accuracy = Number(payload.maxAccuracyMeters || 80);
  if (!isFinite(radius) || radius < 30 || radius > 1000) throw new Error('El radio debe estar entre 30 y 1,000 metros.');
  if (!isFinite(accuracy) || accuracy < 10 || accuracy > 300) throw new Error('La precisión máxima debe estar entre 10 y 300 metros.');
  setConfig_('gymName', cleanText_(payload.name || 'Impulso Fitness · San Cristóbal', 120));
  setConfig_('radiusMeters', radius); setConfig_('maxAccuracyMeters', accuracy);
  const lat = payload.lat === '' || payload.lat === null || payload.lat === undefined ? '' : Number(payload.lat);
  const lng = payload.lng === '' || payload.lng === null || payload.lng === undefined ? '' : Number(payload.lng);
  if (lat !== '' && (!isFinite(lat) || lat < -90 || lat > 90)) throw new Error('Latitud inválida.');
  if (lng !== '' && (!isFinite(lng) || lng < -180 || lng > 180)) throw new Error('Longitud inválida.');
  if ((lat === '') !== (lng === '')) throw new Error('Completa tanto la latitud como la longitud, o deja ambas vacías.');
  if (lat !== '') { setConfig_('gymLat', lat); setConfig_('gymLng', lng); }
  return getAdminData_(admin, admin.uid);
}

function adminSetGymLocation_(admin, payload) {
  const lat = Number(payload.latitude), lng = Number(payload.longitude), accuracy = Number(payload.accuracy);
  if (!isFinite(lat) || !isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) throw new Error('La ubicación recibida no es válida.');
  if (isFinite(accuracy) && accuracy > 100) throw new Error('La precisión GPS actual es de ' + Math.round(accuracy) + ' m. Acércate a una ventana o usa un teléfono con mejor señal.');
  setConfig_('gymLat', lat); setConfig_('gymLng', lng);
  if (!getConfig_().radiusMeters) setConfig_('radiusMeters', 150);
  if (!getConfig_().maxAccuracyMeters) setConfig_('maxAccuracyMeters', 80);
  return getAdminData_(admin, admin.uid);
}

function adminCreateGym_(admin, payload) {
  const name = cleanText_(payload.name, 120);
  const address = cleanText_(payload.address, 240);
  const mapsUrl = cleanText_(payload.mapsUrl, 1000);
  let lat = payload.lat === '' || payload.lat === null || payload.lat === undefined ? '' : Number(payload.lat);
  let lng = payload.lng === '' || payload.lng === null || payload.lng === undefined ? '' : Number(payload.lng);
  if ((lat === '' || lng === '') && mapsUrl) {
    const parsed = parseGoogleMapsCoordinates_(mapsUrl);
    if (parsed) { lat = parsed.lat; lng = parsed.lng; }
  }
  const radius = Number(payload.radiusMeters || 150), accuracy = Number(payload.maxAccuracyMeters || 80);
  if (!name) throw new Error('Escribe el nombre de la sede o gimnasio.');
  if (lat === '' || lng === '' || !isFinite(lat) || !isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) throw new Error('No se encontraron coordenadas válidas. Pega un enlace de Google Maps con coordenadas o ingrésalas manualmente.');
  if (!isFinite(radius) || radius < 30 || radius > 1000) throw new Error('El radio debe estar entre 30 y 1,000 metros.');
  if (!isFinite(accuracy) || accuracy < 10 || accuracy > 300) throw new Error('La precisión máxima debe estar entre 10 y 300 metros.');
  const gym = { id: newId_('GYM'), nombre: name, direccion: address, mapsUrl: mapsUrl, lat: lat, lng: lng, radioMetros: radius, precisionMaxMetros: accuracy, activo: true, creadoPor: admin.uid, creadoAt: now_() };
  appendObject_(SHEETS.GYMS, gym);
  return getAdminData_(admin, '');
}

function adminAssignUserGyms_(admin, payload) {
  const uid = String(payload.uid || '');
  if (!findObject_(SHEETS.USERS, 'uid', uid)) throw new Error('Selecciona un usuario válido.');
  const gymIds = Array.isArray(payload.gymIds) ? payload.gymIds.map(String) : [];
  const activeGyms = getObjects_(SHEETS.GYMS).filter(g => asBool_(g.activo));
  const validIds = [];
  gymIds.forEach(id => {
    if (!activeGyms.some(g => String(g.id) === id)) throw new Error('Una de las sedes seleccionadas no existe o está desactivada.');
    if (validIds.indexOf(id) < 0) validIds.push(id);
  });
  getObjects_(SHEETS.USER_GYMS).filter(r => String(r.uid) === uid && asBool_(r.activo)).forEach(r => updateRow_(SHEETS.USER_GYMS, r._row, { activo: false }));
  validIds.forEach(gymId => {
    const existing = getObjects_(SHEETS.USER_GYMS).find(r => String(r.uid) === uid && String(r.gymId) === gymId);
    if (existing) updateRow_(SHEETS.USER_GYMS, existing._row, { activo: true, asignadoPor: admin.uid, fechaAlta: now_() });
    else appendObject_(SHEETS.USER_GYMS, { id: newId_('UG'), uid: uid, gymId: gymId, activo: true, asignadoPor: admin.uid, fechaAlta: now_() });
  });
  return getAdminData_(admin, uid);
}

function adminToggleGym_(admin, payload) {
  const id = String(payload.gymId || '');
  const row = findObject_(SHEETS.GYMS, 'id', id);
  if (!row) throw new Error('No se encontró el gimnasio.');
  const active = payload.active === true;
  updateRow_(SHEETS.GYMS, row._row, { activo: active });
  if (!active) {
    getObjects_(SHEETS.USER_GYMS).filter(r => String(r.gymId) === id && asBool_(r.activo)).forEach(r => updateRow_(SHEETS.USER_GYMS, r._row, { activo: false }));
  }
  return getAdminData_(admin, '');
}

function parseGoogleMapsCoordinates_(value) {
  let s = String(value || '').trim();
  try { s = decodeURIComponent(s.replace(/\+/g, '%20')); } catch (e) {}
  const patterns = [
    /@(-?\d{1,3}(?:\.\d+)?),\s*(-?\d{1,3}(?:\.\d+)?)/,
    /!3d(-?\d{1,3}(?:\.\d+)?)!4d(-?\d{1,3}(?:\.\d+)?)/,
    /(?:[?&](?:q|query|center|destination|ll)=)(-?\d{1,3}(?:\.\d+)?)[,%2C]+(-?\d{1,3}(?:\.\d+)?)/i,
    /(?:^|\s)(-?\d{1,3}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)(?:\s|$)/
  ];
  for (let i = 0; i < patterns.length; i++) {
    const m = s.match(patterns[i]);
    if (m) {
      const lat = Number(m[1]), lng = Number(m[2]);
      if (isFinite(lat) && isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) return { lat: lat, lng: lng };
    }
  }
  return null;
}

function publicGym_(r) {
  const lat = Number(r.lat), lng = Number(r.lng);
  return { id: String(r.id), name: String(r.nombre || ''), address: String(r.direccion || ''), mapsUrl: String(r.mapsUrl || ''), lat: isFinite(lat) ? lat : '', lng: isFinite(lng) ? lng : '', radiusMeters: Number(r.radioMetros || 150), maxAccuracyMeters: Number(r.precisionMaxMetros || 80), active: asBool_(r.activo), configured: isFinite(lat) && isFinite(lng) && String(r.lat) !== '' && String(r.lng) !== '' };
}

function getUserGyms_(uid) {
  const ids = getObjects_(SHEETS.USER_GYMS).filter(r => String(r.uid) === String(uid) && asBool_(r.activo)).map(r => String(r.gymId));
  return getObjects_(SHEETS.GYMS).filter(g => asBool_(g.activo) && ids.indexOf(String(g.id)) >= 0);
}

/** Migra las hojas del tracker anterior para el usuario elegido. Solo importa datos históricos; no habilita sesiones. */
function adminMigrateLegacyData_(admin, payload) {
  const uid = String(payload.uid || '');
  if (!findObject_(SHEETS.USERS, 'uid', uid)) throw new Error('Selecciona un usuario válido para importar el historial.');
  const ss = getSpreadsheet_();
  let weightsImported = 0, logsImported = 0, sessionsImported = 0;
  const legacyWeights = ss.getSheetByName('Pesos');
  if (legacyWeights && legacyWeights.getLastRow() > 1) {
    const rows = legacyWeights.getDataRange().getValues().slice(1);
    rows.forEach(r => {
      const date = normalizeDate_(r[0]), weight = Number(String(r[1] || '').replace(',', '.'));
      if (!date || !isFinite(weight) || weight < 30 || weight > 250) return;
      const exists = getObjects_(SHEETS.WEIGHTS).some(x => String(x.uid) === uid && normalizeDate_(x.fecha) === date);
      if (!exists) { appendObject_(SHEETS.WEIGHTS, { id: newId_('PES'), uid: uid, fecha: date, pesoKg: round1_(weight), notas: cleanText_(r[4] || 'Migrado del tracker anterior', 300), createdAt: r[5] || now_() }); weightsImported++; }
    });
  }
  const legacySessions = ss.getSheetByName('Sesiones');
  if (legacySessions && legacySessions.getLastRow() > 1) {
    legacySessions.getDataRange().getValues().slice(1).forEach(r => {
      const date = normalizeDate_(r[0]), day = String(r[1] || ''); if (!date || DAYS.indexOf(day) < 0) return;
      const exists = getObjects_(SHEETS.SESSIONS).some(x => String(x.uid) === uid && normalizeDate_(x.fecha) === date && String(x.dia) === day);
      if (!exists) { appendObject_(SHEETS.SESSIONS, { id: 'LEG-' + date + '-' + day.replace(/[^a-zA-Z]/g,''), uid: uid, fecha: date, dia: day, estado: 'historial', lat: '', lng: '', distanciaM: '', precisionM: '', checkInAt: '', finishedAt: r[7] || '', notas: cleanText_(r[6] || '', 500), porcentaje: Number(r[4] || 0) }); sessionsImported++; }
    });
  }
  const legacyLogs = ss.getSheetByName('Registro');
  if (legacyLogs && legacyLogs.getLastRow() > 1) {
    legacyLogs.getDataRange().getValues().slice(1).forEach(r => {
      const date = normalizeDate_(r[0]), day = String(r[1] || ''), oldExerciseId = String(r[2] || '');
      if (!date || DAYS.indexOf(day) < 0 || !oldExerciseId) return;
      const exists = getObjects_(SHEETS.LOGS).some(x => String(x.uid) === uid && normalizeDate_(x.fecha) === date && String(x.dia) === day && String(x.exerciseId) === oldExerciseId);
      if (exists) return;
      let session = getObjects_(SHEETS.SESSIONS).find(x => String(x.uid) === uid && normalizeDate_(x.fecha) === date && String(x.dia) === day);
      if (!session) {
        session = { id: 'LEG-' + date + '-' + day.replace(/[^a-zA-Z]/g,''), uid: uid, fecha: date, dia: day, estado: 'historial', lat: '', lng: '', distanciaM: '', precisionM: '', checkInAt: '', finishedAt: r[13] || '', notas: cleanText_(r[12] || '', 500), porcentaje: '' };
        appendObject_(SHEETS.SESSIONS, session);
        session = findObject_(SHEETS.SESSIONS, 'id', session.id);
        sessionsImported++;
      }
      const weight = Number(String(r[8] || '').replace(',', '.'));
      const reps = Number(r[9] || '');
      const sets = [{ set: 1, weightKg: isFinite(weight) && weight >= 0 ? weight : '', reps: isFinite(reps) && reps >= 0 ? reps : '' }];
      appendObject_(SHEETS.LOGS, { id: newId_('LOG'), sessionId: session.id, uid: uid, fecha: date, dia: day, asignacionId: 'LEG-' + oldExerciseId, exerciseId: oldExerciseId, nombre: String(r[4] || 'Ejercicio histórico'), completado: asBool_(r[7]), seriesJSON: JSON.stringify(sets), pesoKg: isFinite(weight) ? weight : '', reps: isFinite(reps) ? reps : '', notas: cleanText_([r[10],r[11],r[12]].filter(Boolean).join(' · '), 500), updatedAt: r[13] || now_() });
      logsImported++;
    });
  }
  return { message: 'Importación histórica terminada. Las sesiones antiguas no habilitan el entrenamiento actual porque no tienen validación de ubicación.', weightsImported: weightsImported, sessionsImported: sessionsImported, logsImported: logsImported };
}

function ensureSystem_() {
  ensureSheets_();
  seedCatalog_();
  const cfg = getConfig_();
  if (!cfg.gymName) setConfig_('gymName', 'Impulso Fitness · San Cristóbal');
  if (!cfg.radiusMeters) setConfig_('radiusMeters', 150);
  if (!cfg.maxAccuracyMeters) setConfig_('maxAccuracyMeters', 80);
  migrateLegacyGymConfig_();
}

function ensureSheets_() {
  const ss = getSpreadsheet_();
  Object.keys(SHEETS).forEach(key => {
    const name = SHEETS[key];
    let sheet = ss.getSheetByName(name);
    if (!sheet) sheet = ss.insertSheet(name);
    if (sheet.getLastRow() === 0) sheet.appendRow(HEADERS[key]);
    else {
      const current = sheet.getRange(1, 1, 1, Math.max(1, sheet.getLastColumn())).getValues()[0].map(String);
      const missing = HEADERS[key].filter(h => current.indexOf(h) < 0);
      if (missing.length) sheet.getRange(1, current.length + 1, 1, missing.length).setValues([missing]);
    }
    sheet.setFrozenRows(1);
  });
}

function migrateLegacyGymConfig_() {
  if (getObjects_(SHEETS.GYMS).length) return;
  const cfg = getConfig_();
  const lat = Number(cfg.gymLat), lng = Number(cfg.gymLng);
  if (!cfg.gymLat || !cfg.gymLng || !isFinite(lat) || !isFinite(lng)) return;
  const id = 'GYM-LEGACY';
  appendObject_(SHEETS.GYMS, { id: id, nombre: String(cfg.gymName || 'Impulso Fitness · San Cristóbal'), direccion: '', mapsUrl: '', lat: lat, lng: lng, radioMetros: Number(cfg.radiusMeters || 150), precisionMaxMetros: Number(cfg.maxAccuracyMeters || 80), activo: true, creadoPor: 'migración automática', creadoAt: now_() });
  getObjects_(SHEETS.USERS).filter(u => asBool_(u.activo)).forEach(u => {
    if (!getObjects_(SHEETS.USER_GYMS).some(m => String(m.uid) === String(u.uid) && String(m.gymId) === id)) appendObject_(SHEETS.USER_GYMS, { id: newId_('UG'), uid: String(u.uid), gymId: id, activo: true, asignadoPor: 'migración automática', fechaAlta: now_() });
  });
}

function seedCatalog_() {
  const existing = getObjects_(SHEETS.CATALOG);
  const seen = {};
  existing.forEach(r => seen[String(r.nombre || '').toLowerCase()] = true);
  DEFAULT_ROUTINE.forEach(r => {
    const name = r[2];
    if (seen[name.toLowerCase()]) return;
    appendObject_(SHEETS.CATALOG, { id: newId_('EX'), nombre: name, detalle: r[3], musculo: r[4], cardio: r[5], activo: true, creadoAt: now_(), descripcion: '' });
    seen[name.toLowerCase()] = true;
  });
}

function getConfig_() {
  const rows = getObjects_(SHEETS.CONFIG), out = {};
  rows.forEach(r => out[String(r.key)] = r.value);
  return out;
}

function setConfig_(key, value) {
  const row = findObject_(SHEETS.CONFIG, 'key', key);
  if (row) updateRow_(SHEETS.CONFIG, row._row, { value: value, updatedAt: now_() });
  else appendObject_(SHEETS.CONFIG, { key: key, value: value, updatedAt: now_() });
}

function getSpreadsheet_() { return SpreadsheetApp.openById(SPREADSHEET_ID); }
function getObjects_(sheetName) {
  const sh = getSpreadsheet_().getSheetByName(sheetName);
  if (!sh || sh.getLastRow() < 2) return [];
  const data = sh.getDataRange().getValues(), headers = data[0].map(String);
  return data.slice(1).map((row, i) => {
    const obj = { _row: i + 2 };
    headers.forEach((h, j) => obj[h] = row[j]);
    return obj;
  }).filter(obj => Object.keys(obj).some(k => k !== '_row' && obj[k] !== '' && obj[k] !== null));
}
function appendObject_(sheetName, obj) {
  const sh = getSpreadsheet_().getSheetByName(sheetName);
  const headers = sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0].map(String);
  const row = headers.map(h => Object.prototype.hasOwnProperty.call(obj, h) ? obj[h] : '');
  sh.appendRow(row);
}
function findObject_(sheetName, key, value) { return getObjects_(sheetName).find(r => String(r[key]) === String(value)) || null; }
function updateRow_(sheetName, rowNumber, updates) {
  const sh = getSpreadsheet_().getSheetByName(sheetName);
  const headers = sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0].map(String);
  const row = sh.getRange(rowNumber,1,1,headers.length).getValues()[0];
  Object.keys(updates).forEach(k => { const idx = headers.indexOf(k); if (idx >= 0) row[idx] = updates[k]; });
  sh.getRange(rowNumber,1,1,headers.length).setValues([row]);
}
function upsertByUidDate_(sheetName, uid, date, row) {
  const existing = getObjects_(sheetName).find(r => String(r.uid) === String(uid) && normalizeDate_(r.fecha) === date);
  if (existing) updateRow_(sheetName, existing._row, row); else appendObject_(sheetName, row);
}
function publicAssignment_(r) { return { id: String(r.id), uid: String(r.uid), day: String(r.dia), orden: Number(r.orden) || 0, exerciseId: String(r.ejercicioId), name: String(r.nombre), description: String(r.descripcion || ''), detail: String(r.detalle || ''), muscle: String(r.musculo || ''), cardio: String(r.cardio || 'No') }; }
function publicLog_(r) {
  let sets = []; try { sets = JSON.parse(String(r.seriesJSON || '[]')); } catch (e) {}
  return { id: r.id, assignmentId: r.asignacionId, completed: asBool_(r.completado), sets: sets, weightKg: r.pesoKg, reps: r.reps, notes: String(r.notas || '') };
}
function publicSession_(r) { return { id: String(r.id), date: normalizeDate_(r.fecha), day: String(r.dia), status: String(r.estado), distanceM: r.distanciaM === '' ? '' : Number(r.distanciaM), accuracyM: r.precisionM === '' ? '' : Number(r.precisionM), checkInAt: r.checkInAt || '', finishedAt: r.finishedAt || '', notes: String(r.notas || ''), percent: Number(r.porcentaje || 0), gymId: String(r.gymId || ''), gymName: String(r.gymName || '') }; }
function publicMeasurement_(r) {
  const out = { id: r.id, date: normalizeDate_(r.fecha), notes: String(r.notes || '') };
  MEASURE_FIELDS.forEach(f => out[f[0]] = r[f[0]] === '' || r[f[0]] === null ? '' : toNum_(r[f[0]]));
  return out;
}
function publicEvolt_(r) {
  const out = { id: r.id, date: normalizeDate_(r.fecha), notes: String(r.notas || '') };
  ['edad','estaturaCm','pesoKg','bwi','masaMuscularEsqueleticaKg','masaMagraKg','aguaCorporalL','bmrKcal','teeKcal','grasaPct','masaGrasaKg','grasaSubcutaneaKg','grasaVisceralNivel','areaGrasaVisceralCm2','cinturaCm','ratioCinturaCadera'].forEach(k => out[k] = r[k] === '' || r[k] === null ? '' : toNum_(r[k]));
  return out;
}
function todayKey_() { return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd'); }
function todayDay_() { const n = Number(Utilities.formatDate(new Date(), TZ, 'u')); return DAYS[Math.max(1,Math.min(7,n))-1]; }
function now_() { return Utilities.formatDate(new Date(), TZ, "yyyy-MM-dd'T'HH:mm:ss"); }
function newId_(prefix) { return prefix + '-' + Utilities.getUuid().replace(/-/g,'').slice(0,20); }
function normalizeDate_(value) {
  if (value instanceof Date && !isNaN(value.getTime())) return Utilities.formatDate(value, TZ, 'yyyy-MM-dd');
  const s = String(value || '').trim();
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (m) return m[1];
  return '';
}
function validDate_(value) { const s = String(value || '').trim(); if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return ''; const d = new Date(s + 'T12:00:00'); return !isNaN(d.getTime()) && Utilities.formatDate(d, TZ, 'yyyy-MM-dd') === s ? s : ''; }
function asBool_(v) { return v === true || String(v).toLowerCase() === 'true' || String(v).toLowerCase() === 'sí' || String(v).toLowerCase() === 'si' || String(v) === '1'; }
function toNum_(v) { const n = Number(String(v === undefined || v === null ? '' : v).replace(',','.')); return isFinite(n) ? n : 0; }
function validOptionalNumber_(v, min, max) { if (v === '' || v === null || v === undefined) return ''; const n = Number(String(v).replace(',','.')); if (!isFinite(n) || n < min || n > max) return ''; return round1_(n); }
function round1_(n) { return Math.round(Number(n) * 10) / 10; }
function cleanText_(v, max) { return String(v || '').replace(/[<>]/g,'').trim().slice(0, max || 500); }
function haversineMeters_(lat1, lon1, lat2, lon2) {
  const R = 6371000, rad = x => x * Math.PI / 180;
  const dLat = rad(lat2-lat1), dLon = rad(lon2-lon1);
  const a = Math.sin(dLat/2)**2 + Math.cos(rad(lat1))*Math.cos(rad(lat2))*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}
function friendlyError_(err) { return err && err.message ? String(err.message) : String(err || 'Error desconocido.'); }
