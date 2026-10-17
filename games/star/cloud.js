// 별의 설화 — 로그인(구글·이메일·게스트) + 클라우드 세이브 (Firebase)
// game.js가 window.Cloud를 쓰고, 로그인 상태가 바뀌면 'cloud-user' 이벤트를 받는다.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, signInAnonymously,
  createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail, linkWithPopup, linkWithCredential, EmailAuthProvider } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc, collection, query, orderBy, limit, getDocs, where, getCountFromServer, onSnapshot } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

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
  guest: () => signInAnonymously(auth),
  emailIn: (email, pw) => signInWithEmailAndPassword(auth, email, pw),
  emailUp: (email, pw) => createUserWithEmailAndPassword(auth, email, pw),
  resetPw: email => sendPasswordResetEmail(auth, email),
  // 게스트 계정을 구글·이메일 계정으로 바꾼다 (진행 그대로)
  linkGoogle: async () => { const r = await linkWithPopup(auth.currentUser, new GoogleAuthProvider()); window.dispatchEvent(new CustomEvent('cloud-user', { detail: r.user })); return r; },
  linkEmail: async (email, pw) => { const r = await linkWithCredential(auth.currentUser, EmailAuthProvider.credential(email, pw)); window.dispatchEvent(new CustomEvent('cloud-user', { detail: r.user })); return r; },
  async load() {
    const snap = await getDoc(saveDoc());
    return snap.exists() ? JSON.parse(snap.data().data) : null;
  },
  // 전투력 랭킹
  rankSave: data => setDoc(doc(db, 'ranking', auth.currentUser.uid), data),
  async rankTop(n) {
    const s = await getDocs(query(collection(db, 'ranking'), orderBy('power', 'desc'), limit(n)));
    return s.docs.map(d => ({ uid: d.id, ...d.data() }));
  },
  async rankOf(power) {
    const c = await getCountFromServer(query(collection(db, 'ranking'), where('power', '>', power)));
    return c.data().count + 1;
  },
  // 결투장: arena/{uid} = { name, leader, star, power, stage, job, team(JSON 글자), pts, w, l, at }
  arenaSave: data => setDoc(doc(db, 'arena', auth.currentUser.uid), data),
  // 내 전투력 근처 (위·아래 각각 최대 15명)
  async arenaNear(power) {
    const col = collection(db, 'arena');
    const [up, down] = await Promise.all([
      getDocs(query(col, where('power', '>=', power), orderBy('power'), limit(15))),
      getDocs(query(col, where('power', '<', power), orderBy('power', 'desc'), limit(15))),
    ]);
    return up.docs.concat(down.docs).map(d => ({ uid: d.id, ...d.data() }));
  },
  async arenaTop(n) {
    const s = await getDocs(query(collection(db, 'arena'), orderBy('pts', 'desc'), limit(n)));
    return s.docs.map(d => ({ uid: d.id, ...d.data() }));
  },
  async save(obj) {
    await setDoc(saveDoc(), { data: JSON.stringify(obj), updatedAt: Date.now() });
  },
};

// 밸런스 덮어쓰기: config/balance = { data: JSON 글자, at, by, note } (개발자 도구 dev.html 이 씀, 누구나 읽음)
// 바뀌면 열려 있는 게임에 바로 전달 → game.js applyTune. 읽기 실패(규칙 미게시 등)면 보관해 둔 값 그대로
onSnapshot(doc(db, 'config', 'balance'),
  snap => window.dispatchEvent(new CustomEvent('star-tune', { detail: snap.exists() ? snap.data() : null })),
  e => console.warn('balance', e && e.code));

onAuthStateChanged(auth, user => {
  window.Cloud.user = user;
  window.Cloud.ready = true;
  window.dispatchEvent(new CustomEvent('cloud-user', { detail: user }));
});
