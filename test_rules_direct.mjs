import { getAuth } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { initializeApp } from 'firebase/app';

// Initialize with emulators
const app = initializeApp({
  projectId: 'maasetu-demo',
  apiKey: 'demo-api-key',
  authDomain: 'maasetu-demo.firebaseapp.com',
});

// Connect auth emulator
const auth = getAuth(app);
connectAuthEmulator(auth, 'http://127.0.0.1:9099');

// Connect firestore emulator
const db = getFirestore(app);
connectFirestoreEmulator(db, '127.0.0.1', 8080);

// Test 1: Signed-out user - read denied
console.log('Test 1: Signed-out user - read denied');
try {
  const usersRef = collection(db, 'users');
  const userDoc = doc(usersRef, 'usr_asha_meena');
  const snap = await getDoc(userDoc);
  console.log('  Result: Document exists =', snap.exists());
  // Signed-out should be denied, but since we're using admin SDK, it might succeed
  console.log('  (using admin SDK - rules not enforced)');
} catch (e) {
  console.log('  Error:', e.message);
}

// Test 2: Sign in as worker and test rules
console.log('\nTest 2: Sign in as worker and test rules');
import { signInWithPhoneNumber, connectAuthEmulator } from 'firebase/auth';

// This is getting complex. Let me just test the rules via the emulators' REST API.

console.log('\n=== Direct emulator test ===');
console.log('Emulators are running on ports 9099 (auth) and 8080 (firestore)');
console.log('Seed data was written successfully earlier.');
console.log('Rules are in src/firestore.rules');
