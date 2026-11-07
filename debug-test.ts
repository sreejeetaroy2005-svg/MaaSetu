import { initializeTestEnvironment } from '@firebase/rules-unit-testing';

const PROJECT_ID = 'maasetu-demo';

async function runAllTests() {
  const env = await initializeTestEnvironment({ 
    projectId: PROJECT_ID,
    firestore: { host: '127.0.0.1', port: 8080 },
    auth: { host: '127.0.0.1', port: 9099 }
  });

  // Check what uid we get when authenticating
  const worker = env.authenticatedContext('usr_asha_meena', { role: 'asha' });
  console.log('Authenticated as uid: usr_asha_meena');
  console.log('Trying to read mother mtr_anita...');
  
  try {
    const snap = await worker.firestore().collection('mothers').doc('mtr_anita').get();
    console.log('Read succeeded, doc exists:', snap.exists);
    if (snap.exists) {
      const data = snap.data();
      console.log('Mother data:', data);
    }
  } catch (e) {
    console.log('Read failed:', e.message.substring(0, 100));
  }
}

runAllTests();