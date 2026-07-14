let db;
let peopleRef;
let entriesRef;
let unsubscribePeople = null;
let unsubscribeEntries = null;

let state = { people: [], entries: [] };
let isReady = false;

function normalizeFlavor(name) {
  return name.trim().toLowerCase();
}

function displayFlavor(flavor) {
  return flavor.trim();
}

function getUniqueFlavors(personId) {
  const flavors = new Set();
  state.entries
    .filter(e => e.personId === personId)
    .forEach(e => flavors.add(normalizeFlavor(e.flavor)));
  return flavors;
}

function getUniqueCount(personId) {
  return getUniqueFlavors(personId).size;
}

function getPersonEntries(personId) {
  return state.entries
    .filter(e => e.personId === personId)
    .sort((a, b) => new Date(b.date) - new Date(a.date));
}

function getLatestEntry(personId, normalizedFlavor) {
  const entries = state.entries
    .filter(e => e.personId === personId && normalizeFlavor(e.flavor) === normalizedFlavor)
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  return entries[0] || null;
}

function getAllUniqueFlavorsAcrossFamily() {
  const map = new Map(); // normalized -> display
  for (const e of state.entries) {
    const norm = normalizeFlavor(e.flavor);
    if (!norm) continue;
    if (!map.has(norm)) map.set(norm, displayFlavor(e.flavor));
  }
  return [...map.entries()]
    .map(([norm, display]) => ({ norm, display }))
    .sort((a, b) => a.display.localeCompare(b.display, 'nl', { sensitivity: 'base' }));
}

function getUniqueFlavorsForPerson(personId) {
  const map = new Map(); // normalized -> display
  for (const e of state.entries) {
    if (e.personId !== personId) continue;
    const norm = normalizeFlavor(e.flavor);
    if (!norm) continue;
    if (!map.has(norm)) map.set(norm, displayFlavor(e.flavor));
  }
  return [...map.entries()]
    .map(([norm, display]) => ({ norm, display }))
    .sort((a, b) => a.display.localeCompare(b.display, 'nl', { sensitivity: 'base' }));
}

function getAverageRating(personId) {
  const entries = state.entries.filter(e => e.personId === personId);
  if (entries.length === 0) return null;
  const sum = entries.reduce((acc, e) => acc + e.rating, 0);
  return (sum / entries.length).toFixed(1);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function setStatus(type, message) {
  const el = document.getElementById('sync-status');
  if (type === 'ok') {
    el.hidden = true;
    return;
  }
  el.hidden = false;
  el.className = `sync-status sync-${type}`;
  el.textContent = message;
}

function setFormsDisabled(disabled) {
  document.querySelectorAll('input, button').forEach(el => {
    el.disabled = disabled;
  });
  const selects = document.querySelectorAll('select');
  selects.forEach(el => {
    el.disabled = disabled;
  });
}

function authErrorMessage(code) {
  const messages = {
    'auth/invalid-email': 'Ongeldig e-mailadres.',
    'auth/user-not-found': 'Geen account gevonden met dit e-mailadres.',
    'auth/wrong-password': 'Onjuist wachtwoord.',
    'auth/invalid-credential': 'Onjuist e-mailadres of wachtwoord.',
    'auth/email-already-in-use': 'Dit e-mailadres is al in gebruik.',
    'auth/weak-password': 'Wachtwoord is te zwak (minimaal 6 tekens).',
    'auth/too-many-requests': 'Te veel pogingen. Probeer het later opnieuw.'
  };
  return messages[code] || 'Er ging iets mis. Probeer het opnieuw.';
}

function showAuthError(el, err) {
  if (!el) return;
  el.hidden = false;
  el.textContent = authErrorMessage(err.code);
}

function clearAuthErrors() {
  ['auth-error', 'signup-error'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.hidden = true;
      el.textContent = '';
    }
  });
}

function showLoginView() {
  document.getElementById('login-card').hidden = false;
  document.getElementById('signup-card').hidden = true;
  document.getElementById('auth-screen').hidden = false;
  document.getElementById('app-content').hidden = true;
  document.getElementById('user-bar').hidden = true;
  clearAuthErrors();
}

function showSignupView() {
  document.getElementById('login-card').hidden = true;
  document.getElementById('signup-card').hidden = false;
  clearAuthErrors();
}

function showApp(user) {
  document.getElementById('auth-screen').hidden = true;
  document.getElementById('app-content').hidden = false;
  document.getElementById('user-bar').hidden = false;
  document.getElementById('user-email').textContent = user.email || '';
}

function stopDataListeners() {
  if (unsubscribePeople) {
    unsubscribePeople();
    unsubscribePeople = null;
  }
  if (unsubscribeEntries) {
    unsubscribeEntries();
    unsubscribeEntries = null;
  }
  isReady = false;
  state = { people: [], entries: [] };
}

function startDataListeners() {
  stopDataListeners();

  const familyRef = db.collection('families').doc(FAMILY_ID);
  peopleRef = familyRef.collection('people');
  entriesRef = familyRef.collection('entries');

  unsubscribePeople = peopleRef.onSnapshot(
    (snapshot) => {
      state.people = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      render();
    },
    (err) => {
      console.error(err);
      setStatus('error', 'Kon deelnemers niet laden');
    }
  );

  unsubscribeEntries = entriesRef.onSnapshot(
    (snapshot) => {
      state.entries = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      render();
    },
    (err) => {
      console.error(err);
      setStatus('error', 'Kon ijsjes niet laden');
    }
  );

  isReady = true;
  setFormsDisabled(false);
  setStatus('ok');
  render();
}

function renderLeaderboard() {
  const list = document.getElementById('leaderboard');
  const ranked = [...state.people]
    .map(p => ({
      ...p,
      uniqueCount: getUniqueCount(p.id),
      totalEntries: state.entries.filter(e => e.personId === p.id).length
    }))
    .sort((a, b) => b.uniqueCount - a.uniqueCount || b.totalEntries - a.totalEntries);

  if (ranked.length === 0) {
    list.innerHTML = '<li class="empty-state">Voeg deelnemers toe om het klassement te starten!</li>';
    return;
  }

  const medals = { 1: '🥇', 2: '🥈', 3: '🥉' };

  // Ranking with ties: equal uniqueCount shares medal/rank group.
  let currentRank = 0; // 1-based, increments per distinct score
  let lastCount = null;

  list.innerHTML = ranked.map((p) => {
    if (lastCount === null || p.uniqueCount !== lastCount) {
      currentRank += 1;
      lastCount = p.uniqueCount;
    }

    const rankClass = currentRank <= 3 ? `rank-${currentRank}` : '';
    const medal = currentRank <= 3 ? medals[currentRank] : `${currentRank}.`;
    return `
      <li class="${rankClass}">
        <span class="rank-badge">${medal}</span>
        <span class="leader-name">${escapeHtml(p.name)}</span>
        <span class="leader-count">${p.uniqueCount} <span>unieke smaken</span></span>
      </li>
    `;
  }).join('');
}

function renderPersonSelect() {
  const select = document.getElementById('entry-person');
  if (!select) return;

  if (state.people.length === 0) {
    select.innerHTML = '<option value="" selected disabled>Voeg eerst een deelnemer toe…</option>';
    select.disabled = true;
    return;
  }

  const current = select.value;
  select.disabled = false;
  select.innerHTML = state.people
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name, 'nl', { sensitivity: 'base' }))
    .map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`)
    .join('');

  if (current && state.people.some(p => p.id === current)) {
    select.value = current;
  }
}

function renderPersonList() {
  const list = document.getElementById('person-list');
  if (!list) return;

  if (state.people.length === 0) {
    list.innerHTML = '<div class="muted">Nog geen deelnemers.</div>';
    return;
  }

  const peopleSorted = state.people
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name, 'nl', { sensitivity: 'base' }));

  list.innerHTML = peopleSorted.map(p => {
    const unique = getUniqueCount(p.id);
    const total = state.entries.filter(e => e.personId === p.id).length;
    return `
      <div class="person-row">
        <div>
          <div class="name">${escapeHtml(p.name)}</div>
          <div class="muted">${unique} uniek • ${total} totaal</div>
        </div>
        <button class="btn-danger" type="button" data-action="remove-person" data-id="${p.id}">Verwijderen</button>
      </div>
    `;
  }).join('');
}

function renderMatrix() {
  const empty = document.getElementById('matrix-empty');
  const wrap = document.getElementById('matrix-wrap');
  const table = document.getElementById('matrix');
  if (!empty || !wrap || !table) return;

  if (state.people.length === 0 || state.entries.length === 0) {
    empty.hidden = false;
    wrap.hidden = true;
    table.innerHTML = '';
    return;
  }

  empty.hidden = true;
  wrap.hidden = false;

  const peopleSorted = state.people
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name, 'nl', { sensitivity: 'base' }));

  const thead = `
    <thead>
      <tr>
        ${peopleSorted.map(p => `<th>${escapeHtml(p.name)}<div class="muted">(${getUniqueCount(p.id)} uniek)</div></th>`).join('')}
      </tr>
    </thead>
  `;

  const rowCells = peopleSorted.map(p => {
    const uniques = getUniqueFlavorsForPerson(p.id);
    if (uniques.length === 0) {
      return `<td class="list-cell"><span class="dash">—</span></td>`;
    }

    const items = uniques.map(u => {
      const latest = getLatestEntry(p.id, u.norm);
      const rating = latest ? `${latest.rating}/10` : '';
      const entryId = latest ? latest.id : '';
      return `
        <li class="flavor-mini-item">
          <span class="flavor" title="${escapeHtml(u.display)}">${escapeHtml(u.display)}</span>
          <span class="meta">
            ${rating}
            ${entryId ? `<button type="button" data-action="remove-entry" data-id="${entryId}" aria-label="Verwijder">✕</button>` : ''}
          </span>
        </li>
      `;
    }).join('');

    return `<td class="list-cell"><ul class="flavor-mini-list">${items}</ul></td>`;
  }).join('');

  table.innerHTML = `${thead}<tbody><tr>${rowCells}</tr></tbody>`;
}

function render() {
  if (!isReady) return;
  renderLeaderboard();
  renderPersonSelect();
  renderPersonList();
  renderMatrix();
}

async function addPerson(name) {
  const exists = state.people.some(p => p.name.toLowerCase() === name.toLowerCase());
  if (exists) {
    alert('Deze naam bestaat al!');
    return;
  }

  const docRef = peopleRef.doc();
  await docRef.set({
    name,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });
}

async function addFlavor(personId, flavor, rating) {
  const docRef = entriesRef.doc();
  await docRef.set({
    personId,
    flavor,
    rating,
    date: new Date().toISOString()
  });
}

async function removeEntry(entryId) {
  if (!confirm('Dit ijsje verwijderen?')) return;
  await entriesRef.doc(entryId).delete();
}

async function removePerson(personId) {
  const person = state.people.find(p => p.id === personId);
  if (!person) return;
  if (!confirm(`Weet je zeker dat je ${person.name} en alle ijsjes wilt verwijderen?`)) return;

  const batch = db.batch();
  batch.delete(peopleRef.doc(personId));
  state.entries
    .filter(e => e.personId === personId)
    .forEach(e => batch.delete(entriesRef.doc(e.id)));
  await batch.commit();
}

function setupEventListeners() {
  const participantsDialog = document.getElementById('participants-dialog');
  const openParticipants = document.getElementById('open-participants');
  const closeParticipants = document.getElementById('close-participants');

  document.getElementById('show-signup').addEventListener('click', showSignupView);
  document.getElementById('show-login').addEventListener('click', showLoginView);

  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    clearAuthErrors();
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    try {
      await firebase.auth().signInWithEmailAndPassword(email, password);
    } catch (err) {
      console.error(err);
      showAuthError(document.getElementById('auth-error'), err);
    }
  });

  document.getElementById('signup-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    clearAuthErrors();
    const email = document.getElementById('signup-email').value.trim();
    const password = document.getElementById('signup-password').value;
    const code = document.getElementById('signup-code').value.trim();

    if (code !== FAMILY_ACCESS_CODE) {
      const el = document.getElementById('signup-error');
      el.hidden = false;
      el.textContent = 'Onjuiste familiecode.';
      return;
    }

    try {
      await firebase.auth().createUserWithEmailAndPassword(email, password);
    } catch (err) {
      console.error(err);
      showAuthError(document.getElementById('signup-error'), err);
    }
  });

  document.getElementById('logout-btn').addEventListener('click', async () => {
    try {
      await firebase.auth().signOut();
    } catch (err) {
      console.error(err);
      alert('Uitloggen mislukt.');
    }
  });

  if (participantsDialog && openParticipants) {
    openParticipants.addEventListener('click', () => {
      participantsDialog.showModal();
    });
  }
  if (participantsDialog && closeParticipants) {
    closeParticipants.addEventListener('click', () => {
      participantsDialog.close();
    });
  }
  if (participantsDialog) {
    participantsDialog.addEventListener('click', (e) => {
      // Click on backdrop closes dialog
      if (e.target === participantsDialog) participantsDialog.close();
    });
  }

  document.getElementById('add-person-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = document.getElementById('person-name');
    const name = input.value.trim();
    if (!name) return;

    try {
      await addPerson(name);
      input.value = '';
      setStatus('ok');
    } catch (err) {
      console.error(err);
      alert('Kon deelnemer niet opslaan. Controleer je Firebase-instellingen.');
      setStatus('error', 'Fout bij opslaan');
    }
  });

  document.getElementById('add-entry-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const personSelect = document.getElementById('entry-person');
    const flavorInput = document.getElementById('entry-flavor');
    const ratingInput = document.getElementById('entry-rating');

    const personId = personSelect.value;
    const flavor = flavorInput.value.trim();
    const rating = parseFloat(ratingInput.value);

    if (!personId) return;
    if (!flavor) return;
    if (isNaN(rating) || rating < 0 || rating > 10) {
      alert('Beoordeling moet tussen 0 en 10 liggen.');
      return;
    }

    try {
      await addFlavor(personId, flavor, rating);
      flavorInput.value = '';
      ratingInput.value = '7';
      flavorInput.focus();
      setStatus('ok');
    } catch (err) {
      console.error(err);
      alert('Kon ijsje niet opslaan.');
      setStatus('error', 'Fout bij opslaan');
    }
  });

  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;

    const action = btn.dataset.action;
    const id = btn.dataset.id;

    try {
      if (action === 'remove-entry') {
        await removeEntry(id);
      } else if (action === 'remove-person') {
        await removePerson(id);
      }
      setStatus('ok');
    } catch (err) {
      console.error(err);
      alert('Kon niet verwijderen.');
      setStatus('error', 'Fout bij opslaan');
    }
  });
}

async function initFirebase() {
  if (FIREBASE_CONFIG.apiKey === 'VUL_IN') {
    setStatus('error', 'Firebase niet geconfigureerd – vul firebase-config.js in');
    document.getElementById('config-warning').hidden = false;
    return;
  }

  try {
    firebase.initializeApp(FIREBASE_CONFIG);
    db = firebase.firestore();

    firebase.auth().onAuthStateChanged((user) => {
      if (user) {
        showApp(user);
        setStatus('loading', 'Gegevens laden…');
        setFormsDisabled(true);
        startDataListeners();
      } else {
        stopDataListeners();
        setFormsDisabled(false);
        setStatus('ok');
        showLoginView();
      }
    });
  } catch (err) {
    console.error(err);
    setStatus('error', 'Verbinding mislukt – controleer firebase-config.js');
    document.getElementById('config-warning').hidden = false;
  }
}

setupEventListeners();
initFirebase();
