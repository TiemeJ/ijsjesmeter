let db;
let peopleRef;
let entriesRef;

let state = { people: [], entries: [] };
let isReady = false;

function normalizeFlavor(name) {
  return name.trim().toLowerCase();
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
  el.className = `sync-status sync-${type}`;
  el.textContent = message;
}

function setFormsDisabled(disabled) {
  document.querySelectorAll('input, button').forEach(el => {
    el.disabled = disabled;
  });
}

function renderLeaderboard() {
  const list = document.getElementById('leaderboard');
  const ranked = [...state.people]
    .map(p => ({
      ...p,
      uniqueCount: getUniqueCount(p.id),
      avgRating: getAverageRating(p.id),
      totalEntries: state.entries.filter(e => e.personId === p.id).length
    }))
    .sort((a, b) => b.uniqueCount - a.uniqueCount || b.totalEntries - a.totalEntries);

  if (ranked.length === 0) {
    list.innerHTML = '<li class="empty-state">Voeg deelnemers toe om het klassement te starten!</li>';
    return;
  }

  const medals = ['🥇', '🥈', '🥉'];

  list.innerHTML = ranked.map((p, i) => {
    const rankClass = i < 3 ? `rank-${i + 1}` : '';
    const medal = i < 3 ? medals[i] : `${i + 1}.`;
    const avgText = p.avgRating !== null ? `Gem. beoordeling: ${p.avgRating}/10` : '';
    return `
      <li class="${rankClass}">
        <span class="rank-badge">${medal}</span>
        <span class="leader-name">${escapeHtml(p.name)}</span>
        <span class="leader-count">${p.uniqueCount} <span>unieke smaken</span></span>
        ${avgText ? `<span class="leader-avg">${avgText}</span>` : ''}
      </li>
    `;
  }).join('');
}

function renderPeople() {
  const grid = document.getElementById('people-grid');

  if (state.people.length === 0) {
    grid.innerHTML = '<p class="empty-state">Nog geen deelnemers. Voeg hierboven iemand toe!</p>';
    return;
  }

  grid.innerHTML = state.people.map(person => {
    const entries = getPersonEntries(person.id);
    const uniqueCount = getUniqueCount(person.id);

    const flavorItems = entries.length === 0
      ? '<p class="no-flavors">Nog geen ijsjes toegevoegd</p>'
      : `<ul class="flavor-list">${entries.map(e => `
          <li>
            <span class="flavor-name">${escapeHtml(e.flavor)}</span>
            <div class="rating-bar"><div class="rating-bar-fill" style="width:${e.rating * 10}%"></div></div>
            <span class="flavor-rating">${e.rating}/10</span>
            <button class="btn-danger" data-action="remove-entry" data-id="${e.id}" title="Verwijderen">✕</button>
          </li>
        `).join('')}</ul>`;

    return `
      <div class="person-card" data-person-id="${person.id}">
        <div class="person-header">
          <div class="person-info">
            <h3>${escapeHtml(person.name)}</h3>
            <div class="unique-counter">
              Unieke smaken: <span class="count">${uniqueCount}</span>
            </div>
          </div>
          <button class="btn-danger" data-action="remove-person" data-id="${person.id}">Persoon verwijderen</button>
        </div>
        <form class="add-flavor-form" data-person-id="${person.id}">
          <input type="text" placeholder="Smaak / ijsje" required maxlength="80" autocomplete="off">
          <input type="number" min="0" max="10" step="0.5" value="7" required title="Beoordeling 0-10">
          <button type="submit" class="btn-secondary">IJsje toevoegen</button>
        </form>
        ${flavorItems}
      </div>
    `;
  }).join('');
}

function render() {
  if (!isReady) return;
  renderLeaderboard();
  renderPeople();
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
  document.getElementById('add-person-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = document.getElementById('person-name');
    const name = input.value.trim();
    if (!name) return;

    try {
      setStatus('loading', 'Opslaan…');
      await addPerson(name);
      input.value = '';
      setStatus('ok', 'Verbonden – wijzigingen worden gedeeld');
    } catch (err) {
      console.error(err);
      alert('Kon deelnemer niet opslaan. Controleer je Firebase-instellingen.');
      setStatus('error', 'Fout bij opslaan');
    }
  });

  document.getElementById('people-grid').addEventListener('submit', async (e) => {
    if (!e.target.classList.contains('add-flavor-form')) return;
    e.preventDefault();

    const personId = e.target.dataset.personId;
    const flavorInput = e.target.querySelector('input[type="text"]');
    const ratingInput = e.target.querySelector('input[type="number"]');
    const flavor = flavorInput.value.trim();
    const rating = parseFloat(ratingInput.value);

    if (!flavor) return;
    if (isNaN(rating) || rating < 0 || rating > 10) {
      alert('Beoordeling moet tussen 0 en 10 liggen.');
      return;
    }

    try {
      setStatus('loading', 'Opslaan…');
      await addFlavor(personId, flavor, rating);
      flavorInput.value = '';
      ratingInput.value = '7';
      setStatus('ok', 'Verbonden – wijzigingen worden gedeeld');
    } catch (err) {
      console.error(err);
      alert('Kon ijsje niet opslaan.');
      setStatus('error', 'Fout bij opslaan');
    }
  });

  document.getElementById('people-grid').addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;

    const action = btn.dataset.action;
    const id = btn.dataset.id;

    try {
      setStatus('loading', 'Opslaan…');
      if (action === 'remove-entry') {
        await removeEntry(id);
      } else if (action === 'remove-person') {
        await removePerson(id);
      }
      setStatus('ok', 'Verbonden – wijzigingen worden gedeeld');
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

  setStatus('loading', 'Verbinden met Firebase…');
  setFormsDisabled(true);

  try {
    firebase.initializeApp(FIREBASE_CONFIG);
    db = firebase.firestore();

    await firebase.auth().signInAnonymously();

    const familyRef = db.collection('families').doc(FAMILY_ID);
    peopleRef = familyRef.collection('people');
    entriesRef = familyRef.collection('entries');

    peopleRef.onSnapshot(
      (snapshot) => {
        state.people = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        render();
      },
      (err) => {
        console.error(err);
        setStatus('error', 'Kon deelnemers niet laden');
      }
    );

    entriesRef.onSnapshot(
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
    setStatus('ok', 'Verbonden – wijzigingen worden gedeeld');
    render();
  } catch (err) {
    console.error(err);
    setStatus('error', 'Verbinding mislukt – controleer firebase-config.js');
    document.getElementById('config-warning').hidden = false;
  }
}

setupEventListeners();
initFirebase();
