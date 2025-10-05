import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: 'AIzaSyBgsc8dhOoHUzA3GGm7WZCC6G8PtMahBqY',
  authDomain: 'uniexplorer-7e2bc.firebaseapp.com',
  projectId: 'uniexplorer-7e2bc',
  storageBucket: 'uniexplorer-7e2bc.firebasestorage.app',
  messagingSenderId: '361108980037',
  appId: '1:361108980037:web:6cd4fae33b79e5ffdebe2c',
  measurementId: 'G-3KYZ35WKKR',
}

const app = initializeApp(firebaseConfig)

export const auth = getAuth(app)
export const db = getFirestore(app)
