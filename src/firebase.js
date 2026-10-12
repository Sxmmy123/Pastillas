import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
const firebaseConfig = {
  apiKey: "AIzaSyB_HJ_CGuec6XGt4TfHT-BXCMr9fvVpB-I",
  authDomain: "regis-b73aa.firebaseapp.com",
  projectId: "regis-b73aa",
  storageBucket: "regis-b73aa.firebasestorage.app",
  messagingSenderId: "789158406674",
  appId: "1:789158406674:web:4ae450d677cc922c3a06cb",
};
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
