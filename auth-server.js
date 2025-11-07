const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const cors = require('cors');
const path = require('path');
const axios = require('axios');

// Firebase Client SDK
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, doc, getDocs, getDoc, setDoc, updateDoc, deleteDoc, query, where, addDoc } = require('firebase/firestore');

const app = express();
const PORT = process.env.PORT || 4000;

// Initialize Firebase
const firebaseConfig = {
  apiKey: "AIzaSyDDtTxl5lZ1Crerbk0C26teR1jNvrHQCR0",
  authDomain: "tiktok-bot-auth.firebaseapp.com",
  projectId: "tiktok-bot-auth",
  storageBucket: "tiktok-bot-auth.firebasestorage.app",
  messagingSenderId: "214610166671",
  appId: "1:214610166671:web:777a51a7663e83e131c1fa",
  measurementId: "G-ZD7VP1L36E"
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

// Middleware
app.use(cors());
