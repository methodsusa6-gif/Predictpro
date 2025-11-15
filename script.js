// -----------------------------
// FIREBASE IMPORTS
// -----------------------------
import {
    signInWithCustomToken,
    signOut,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
    doc,
    setDoc,
    getDoc,
    serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


// -----------------------------
// ELEMENTS
// -----------------------------
const emailInput = document.getElementById("email");
const sendOtpBtn = document.getElementById("sendOtpBtn");
const otpArea = document.getElementById("otp-area");
const otpInput = document.getElementById("otp");
const verifyOtpBtn = document.getElementById("verifyOtpBtn");
const authMessage = document.getElementById("authMessage");

const dashboard = document.getElementById("dashboard");
const authSection = document.getElementById("auth-section");
const userEmailLabel = document.getElementById("userEmail");
const dashboardTitle = document.getElementById("dashboardTitle");
const logoutBtn = document.getElementById("logoutBtn");

// -----------------------------
// ENV VARIABLES
// -----------------------------
const COLLECTION_USERS = import.meta.env.VITE_COLLECTION_USERS;
const SUPER_ADMIN_1 = import.meta.env.SUPER_ADMIN_EMAIL_1;
const SUPER_ADMIN_2 = import.meta.env.SUPER_ADMIN_EMAIL_2;
const ASSISTANT_1 = import.meta.env.ASSISTANT_ADMIN_EMAIL_1;
const ASSISTANT_2 = import.meta.env.ASSISTANT_ADMIN_EMAIL_2;


// -----------------------------
// OTP GENERATOR
// -----------------------------
function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();  
}


// -----------------------------
// SEND OTP
// -----------------------------
sendOtpBtn.addEventListener("click", async () => {
    const email = emailInput.value.trim();

    if (!email) {
        authMessage.textContent = "Enter your email first.";
        return;
    }

    authMessage.textContent = "Sending OTP...";

    const otp = generateOTP();

    // Save OTP in Firestore
    await setDoc(doc(db, "otp_requests", email), {
        otp,
        createdAt: serverTimestamp(),
    });

    // Simulated email delivery
    console.log("💡 Your OTP is:", otp);

    authMessage.textContent = "OTP sent! Check console.";
    otpArea.style.display = "block";
});


// -----------------------------
// VERIFY OTP
// -----------------------------
verifyOtpBtn.addEventListener("click", async () => {
    const email = emailInput.value.trim();
    const enteredOtp = otpInput.value.trim();

    if (!enteredOtp) {
        authMessage.textContent = "Enter OTP.";
        return;
    }

    const otpDoc = await getDoc(doc(db, "otp_requests", email));

    if (!otpDoc.exists()) {
        authMessage.textContent = "OTP not found.";
        return;
    }

    const savedOtp = otpDoc.data().otp;

    if (enteredOtp !== savedOtp) {
        authMessage.textContent = "Invalid OTP.";
        return;
    }

    authMessage.textContent = "OTP verified! Logging in...";

    // -----------------------------
    // ASSIGN ROLE BASED ON EMAIL
    // -----------------------------
    let role = "user";

    if (email === SUPER_ADMIN_1 || email === SUPER_ADMIN_2) {
        role = "superadmin";
    } else if (email === ASSISTANT_1 || email === ASSISTANT_2) {
        role = "assistant";
    }

    // -----------------------------
    // CREATE USER DOC IF NOT EXIST
    // -----------------------------
    const userRef = doc(db, COLLECTION_USERS, email);
    const existingUser = await getDoc(userRef);

    if (!existingUser.exists()) {
        await setDoc(userRef, {
            email,
            role,
            createdAt: serverTimestamp(),
        });
    }

    // -----------------------------
    // MOCK LOGIN USING CUSTOM TOKEN
    // -----------------------------
    const fakeToken = btoa(email + "|token");
    await signInWithCustomToken(auth, fakeToken);

    loadDashboard(email, role);
});


// -----------------------------
// LOAD DASHBOARD
// -----------------------------
function loadDashboard(email, role) {
    authSection.style.display = "none";
    dashboard.style.display = "block";

    userEmailLabel.textContent = email;

    if (role === "superadmin") {
        dashboardTitle.textContent = "Super Admin Dashboard";
    } else if (role === "assistant") {
        dashboardTitle.textContent = "Assistant Dashboard";
    } else {
        dashboardTitle.textContent = "User Dashboard";
    }
}


// -----------------------------
// LOGOUT
// -----------------------------
logoutBtn.addEventListener("click", async () => {
    await signOut(auth);

    dashboard.style.display = "none";
    authSection.style.display = "block";

    otpArea.style.display = "none";
    otpInput.value = "";
    authMessage.textContent = "";
});
