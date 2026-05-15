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

// --- Dashboard Logic ---
function initDashboard() {

    dashboard.classList.remove('hidden');

    document.getElementById('nav-username').innerText = currentUser.username;

    document.getElementById('nav-pfp').src =
        currentUser.profilePic ||
        'https://cdn-icons-png.flaticon.com/512/3135/3135715.png';

    if (isAdmin) {

        document.getElementById('admin-add-btn')
            .classList.remove('hidden');

    }

    socket.emit('userLoggedIn', currentUser.username);

    loadTournaments();
    loadUsers();
}

function showView(view) {

    document.querySelectorAll('.view, .main-menu')
        .forEach(v => v.classList.add('hidden'));

    if (view === 'main') {

        document.getElementById('main-menu')
            .classList.remove('hidden');

    } else {

        document.getElementById(`${view}-view`)
            .classList.remove('hidden');

    }
}

async function loadTournaments() {

    const res = await fetch('https://pes-app.onrender.com/api/tournaments', {
        headers: {
            'Authorization': `Bearer ${localStorage.getItem('pes_token')}`
        }
    });

    const tournaments = await res.json();

    tournamentList.innerHTML = tournaments.map(t => `

        <div class="glass-card tournament-card">

            <img 
                src="https://pes-app.onrender.com${t.banner}" 
                class="t-banner" 
                alt="banner"
            >

            <h3>${t.title}</h3>

            <p>
                <i class="fas fa-calendar"></i>
                ${t.date} | ${t.time}
            </p>

            <p>
                <i class="fas fa-map-marker-alt"></i>
                ${t.venue}
            </p>

            <button 
                class="neon-button small"
                onclick="openBracket('${t._id}')"
            >
                VIEW BRACKET
            </button>

            ${isAdmin ? `
                <button 
                    class="delete-btn"
                    onclick="deleteTournament('${t._id}')"
                >
                    <i class="fas fa-trash"></i>
                </button>
            ` : ''}

        </div>

    `).join('');
}

async function loadUsers() {

    const res = await fetch('https://pes-app.onrender.com/api/users', {
        headers: {
            'Authorization': `Bearer ${localStorage.getItem('pes_token')}`
        }
    });

    const users = await res.json();

    userList.innerHTML = users.map(u => `

        <div class="glass-card user-item">

            <img src="${u.profilePic}" class="pfp-large" alt="pfp">

            <div class="status-indicator online"></div>

            <h4>${u.username}</h4>

            <p>Wins: ${u.wins}</p>

            ${isAdmin ? `
                <button 
                    class="neon-button small"
                    onclick="deleteUser('${u._id}')"
                >
                    BAN
                </button>
            ` : ''}

        </div>

    `).join('');
}
