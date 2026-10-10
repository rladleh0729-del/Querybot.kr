// 별의 설화 — 구글 로그인 + 클라우드 세이브 (Firebase)
// game.js가 window.Cloud를 쓰고, 로그인 상태가 바뀌면 'cloud-user' 이벤트를 받는다.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

// 공개용 설정값 (보호는 Firestore 보안 규칙이 담당)
const app = initializeApp({
  apiKey: 'AIzaSyDVlaW5De23pc07NII0WvzFwQYNmXYmG_0',
  authDomain: 'star-tale.firebaseapp.com',
  projectId: 'star-tale',
  storageBucket: 'star-tale.firebasestorage.app',
  messagingSenderId: '263953465781',
  appId: '1:263953465781:web:629500db3040b5ec1159fc',
});
const auth = getAuth(app);
const db = getFirestore(app);
const saveDoc = () => doc(db, 'saves', auth.currentUser.uid);

window.Cloud = {
  user: null,
  signIn: () => signInWithPopup(auth, new GoogleAuthProvider()),
  signOut: () => signOut(auth),
  async load() {
    const snap = await getDoc(saveDoc());
    return snap.exists() ? JSON.parse(snap.data().data) : null;
  },
  async save(obj) {
    await setDoc(saveDoc(), { data: JSON.stringify(obj), updatedAt: Date.now() });
  },
};

onAuthStateChanged(auth, user => {
  window.Cloud.user = user;
  window.Cloud.ready = true;
  window.dispatchEvent(new CustomEvent('cloud-user', { detail: user }));
});
