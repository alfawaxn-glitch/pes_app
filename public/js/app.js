const socket = io('https://pes-app.onrender.com');

let currentUser = null;
let isAdmin = false;

// --- DOM Elements ---
const loadingScreen = document.getElementById('loading-screen');
const authContainer = document.getElementById('auth-container');
const dashboard = document.getElementById('dashboard');
const tournamentList = document.getElementById('tournament-list');
const userList = document.getElementById('user-list');

// --- Initialization ---
window.onload = () => {
    setTimeout(() => {
        loadingScreen.style.opacity = '0';

        setTimeout(() => {
            loadingScreen.classList.add('hidden');
            checkAuth();
        }, 1000);

    }, 2500);
};

function checkAuth() {

    const token = localStorage.getItem('pes_token');

    if (token) {

        currentUser = JSON.parse(localStorage.getItem('pes_user'));
        isAdmin = localStorage.getItem('pes_isAdmin') === 'true';

        initDashboard();

    } else {

        authContainer.classList.remove('hidden');

    }
}

// --- Auth Functions ---
function switchTab(tab) {

    document.querySelectorAll('.tab-btn')
        .forEach(b => b.classList.remove('active'));

    document
        .querySelector(`[onclick="switchTab('${tab}')"]`)
        .classList.add('active');

    if (tab === 'login') {

        document.getElementById('login-form')
            .classList.remove('hidden');

        document.getElementById('register-form')
            .classList.add('hidden');

    } else {

        document.getElementById('login-form')
            .classList.add('hidden');

        document.getElementById('register-form')
            .classList.remove('hidden');

    }
}

document.getElementById('login-form').onsubmit = async (e) => {

    e.preventDefault();

    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;

    try {

        const res = await fetch('https://pes-app.onrender.com/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await res.json();

        if (data.token) {

            localStorage.setItem('pes_token', data.token);
            localStorage.setItem('pes_user', JSON.stringify(data));
            localStorage.setItem('pes_isAdmin', data.isAdmin);

            location.reload();

        } else {

            showToast(data.error, 'error');

        }

    } catch (err) {

        showToast('Login Failed', 'error');

    }
};

document.getElementById('register-form').onsubmit = async (e) => {

    e.preventDefault();

    const formData = new FormData();

    formData.append('username', document.getElementById('reg-username').value);
    formData.append('email', document.getElementById('reg-email').value);
    formData.append('password', document.getElementById('reg-password').value);

    const pfp = document.getElementById('reg-pfp').files[0];

    if (pfp) formData.append('profilePic', pfp);

    try {

        const res = await fetch('https://pes-app.onrender.com/api/auth/register', {
            method: 'POST',
            body: formData
        });

        if (res.ok) {

            showToast('Account Created! Please Login');
            switchTab('login');

        } else {

            const data = await res.json();
            showToast(data.error, 'error');

        }

    } catch (err) {

        showToast('Registration Error', 'error');

    }
};

function logout() {

    localStorage.clear();
    location.reload();

}
