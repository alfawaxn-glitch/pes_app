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
                src="${t.banner}" 
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

// --- Bracket System ---
async function openBracket(id) {

    const res = await fetch('https://pes-app.onrender.com/api/tournaments', {
        headers: {
            'Authorization': `Bearer ${localStorage.getItem('pes_token')}`
        }
    });

    const tournaments = await res.json();

    const t = tournaments.find(x => x._id === id);

    document.getElementById('modal-tournament-title')
        .innerText = t.title;

    renderBracket(t);

    toggleModal('bracket-modal');
}

function renderBracket(t) {

    const container = document.getElementById('bracket-display');
    const s = t.structure;

    let html = `

        <div class="bracket-round">

            <h4 class="neon-text-small">QUARTER FINALS</h4>

            ${renderMatches(s.quarterFinals, 4, t._id, 'semiFinals')}

        </div>

        <div class="bracket-round">

            <h4 class="neon-text-small">SEMI FINALS</h4>

            ${renderMatches(s.semiFinals, 2, t._id, 'final')}

        </div>

        <div class="bracket-round">

            <h4 class="neon-text-small">GRAND FINAL</h4>

            ${renderMatches(s.final, 1, t._id, 'winner')}

        </div>

    `;

    if (s.winner) {

        html += `
            <div class="bracket-round">
                <h4 class="neon-text-small">CHAMPION</h4>
                <div class="glass-card winner-box">${s.winner}</div>
            </div>
        `;
    }

    container.innerHTML = html;
}

function renderMatches(teams, count, tId, nextStage) {

    let matches = '';

    for (let i = 0; i < count; i++) {

        const t1 = teams[i * 2] || 'TBD';
        const t2 = teams[i * 2 + 1] || 'TBD';

        matches += `

            <div class="bracket-match">

                <div 
                    class="team-slot"
                    onclick="advanceTeam('${tId}', '${nextStage}', ${Math.floor(i)}, '${t1}')"
                >
                    ${t1}
                </div>

                <div 
                    class="team-slot"
                    onclick="advanceTeam('${tId}', '${nextStage}', ${Math.floor(i)}, '${t2}')"
                >
                    ${t2}
                </div>

            </div>

        `;
    }

    return matches;
}

async function advanceTeam(tId, nextStage, nextIndex, teamName) {

    if (!isAdmin || teamName === 'TBD') return;

    const res = await fetch('https://pes-app.onrender.com/api/tournaments', {
        headers: {
            'Authorization': `Bearer ${localStorage.getItem('pes_token')}`
        }
    });

    const tournaments = await res.json();

    const t = tournaments.find(x => x._id === tId);

    if (nextStage === 'winner') {

        t.structure.winner = teamName;

    } else {

        t.structure[nextStage][nextIndex] = teamName;

    }

    await fetch(`https://pes-app.onrender.com/api/tournaments/${tId}/bracket`, {

        method: 'PUT',

        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('pes_token')}`
        },

        body: JSON.stringify({ structure: t.structure })

    });
}

// --- Admin ---
document.getElementById('tournament-form').onsubmit = async (e) => {

    e.preventDefault();

    const formData = new FormData();

    formData.append('title', document.getElementById('t-title').value);
    formData.append('description', document.getElementById('t-desc').value);
    formData.append('date', document.getElementById('t-date').value);
    formData.append('time', document.getElementById('t-time').value);
    formData.append('venue', document.getElementById('t-venue').value);

    const banner = document.getElementById('t-banner').files[0];

    if (banner) formData.append('banner', banner);

    await fetch('https://pes-app.onrender.com/api/tournaments', {

        method: 'POST',

        headers: {
            'Authorization': `Bearer ${localStorage.getItem('pes_token')}`
        },

        body: formData

    });

    toggleModal('tournament-modal');

    loadTournaments();
};

async function deleteTournament(id) {

    if (!confirm('Delete this tournament permanently?')) return;

    try {

        const res = await fetch(`https://pes-app.onrender.com/api/tournaments/${id}`, {

            method: 'DELETE',

            headers: {
                'Authorization': `Bearer ${localStorage.getItem('pes_token')}`
            }

        });

        const data = await res.json();

        if (res.ok) {

            showToast('Tournament deleted');

            loadTournaments();

        } else {

            showToast(data.error || 'Delete failed', 'error');

        }

    } catch (err) {

        console.error(err);

        showToast('Server Error', 'error');

    }
}

async function deleteUser(id) {

    if (!confirm('Permanently ban this operative?')) return;

    await fetch(`https://pes-app.onrender.com/api/users/${id}`, {

        method: 'DELETE',

        headers: {
            'Authorization': `Bearer ${localStorage.getItem('pes_token')}`
        }

    });

    loadUsers();
}

// --- Helpers ---
function toggleModal(id) {

    document.getElementById(id).classList.toggle('hidden');

}

function showToast(msg, type = 'success') {

    const toast = document.createElement('div');

    toast.className = `toast ${type}`;

    toast.innerText = msg;

    document.getElementById('toast-container')
        .appendChild(toast);

    setTimeout(() => toast.remove(), 3000);
}

// --- Sockets ---
socket.on('activeCount', count => {

    document.getElementById('active-count').innerText = count;

});

socket.on('tournamentUpdate', () => {

    loadTournaments();

});

socket.on('userUpdate', () => {

    loadUsers();

});
