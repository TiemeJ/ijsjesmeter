// Copy this file to firebase-config.js and fill in your own values.
// firebase-config.js does not need to be kept secret (it's client-side config),
// but do use Firestore security rules as described in the README.

const FIREBASE_CONFIG = {
  apiKey: "AIza...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project-id.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
};

// Pick a unique name for your family (e.g. "jansen-ijs-2026").
// Everyone with the same FAMILY_ID shares the same data.
const FAMILY_ID = "my-family";

// Family members need this code when registering (share only with your family).
const FAMILY_ACCESS_CODE = "pick-a-secret-code";
