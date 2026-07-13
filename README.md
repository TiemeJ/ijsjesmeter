# 🍦 Ijsjesmeter

A simple website to track who in the family tries the most new ice cream flavours. Data is shared via **Firebase Firestore** — everyone in the family sees the same standings.

> The app UI is in Dutch. These setup instructions are in English.

## Files

| File | Purpose |
|------|---------|
| `index.html` | The website |
| `app.js` | App logic + Firebase integration |
| `firebase-config.js` | **Your** Firebase settings (must be filled in!) |
| `firebase-config.example.js` | Template |
| `firestore.rules` | Firestore security rules |

---

## Step 1: Create a Firebase project

1. Go to [https://console.firebase.google.com](https://console.firebase.google.com)
2. Click **Add project**
3. Give the project a name, e.g. `ijsjesmeter-family`
4. Google Analytics can be disabled (not needed)
5. Click **Create project**

---

## Step 2: Register a web app

1. In your Firebase project: click the **web icon** (`</>`) → **Add app**
2. Give the app a nickname, e.g. `Ijsjesmeter`
3. Enabling **Firebase Hosting** is optional (you'll use GitHub Pages)
4. Click **Register app**
5. You'll see a `firebaseConfig` object — **save this**, you need it in step 5

---

## Step 3: Enable Firestore Database

1. In the left menu: **Build → Firestore Database**
2. Click **Create database**
3. Choose **Production mode** (we'll adjust the rules right after)
4. Pick a nearby region, e.g. `europe-west1` (Belgium)
5. Click **Enable**

### Set security rules

1. Go to the **Rules** tab
2. Replace the contents with the contents of `firestore.rules` in this project:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /families/{familyId}/{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

3. Click **Publish**

This means: only signed-in users (the app signs in anonymously automatically) can read and write data.

---

## Step 4: Enable Anonymous Authentication

1. In the left menu: **Build → Authentication**
2. Click **Get started**
3. Open the **Sign-in method** tab
4. Click **Anonymous** → enable it → **Save**

Without this step, you'll get an error when connecting.

---

## Step 5: Fill in firebase-config.js

Open `firebase-config.js` and replace the placeholder values with your credentials from step 2:

```javascript
const FIREBASE_CONFIG = {
  apiKey: "AIza...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project-id.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
};

const FAMILY_ID = "jansen-ijs-2026";  // pick your own unique name
```

**FAMILY_ID**: a unique name for your family's database. Everyone using the same `FAMILY_ID` shares the same data. Pick something that's not easy to guess (e.g. `fam-jansen-ijs-2026`).

---

## Step 6: Test locally

Start a local server in the project folder:

```bash
npx serve -l 8080
```

Open [http://localhost:8080](http://localhost:8080).

- Green status bar = connected to Firebase
- Add a participant and check in the Firebase Console under **Firestore Database** that data appears under `families → [your FAMILY_ID] → people`

---

## Step 7: Publish on GitHub Pages

1. Upload all files to a GitHub repository (including `firebase-config.js`)
2. Go to **Settings → Pages**
3. Source: **Deploy from a branch** → `main` → `/ (root)`
4. After a minute: `https://<username>.github.io/<repo-name>/`

The Firebase API key can live in your repository — that's normal for client-side apps. Security is handled by Firestore rules.

---

## Data structure in Firestore

```
families/
  └── {FAMILY_ID}/
        ├── people/
        │     └── {personId}  →  { name, createdAt }
        └── entries/
              └── {entryId}   →  { personId, flavor, rating, date }
```

Changes are synced **in real time**: if someone adds an ice cream on their phone, someone else sees it immediately on their laptop.

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "Firebase niet geconfigureerd" (Firebase not configured) | Fill in `firebase-config.js` (no more `VUL_IN` placeholders) |
| "Verbinding mislukt" (Connection failed) | Check that Anonymous Auth is enabled |
| "Permission denied" in console | Check that Firestore rules have been published |
| Data not visible | Check that `FAMILY_ID` is the same everywhere |
| Blank page locally | Use `npx serve`, don't open via `file://` |
