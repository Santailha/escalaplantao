// PASSO 1: COLE A CONFIGURAÇÃO DO SEU FIREBASE AQUI
const firebaseConfig = {
    apiKey: "SUA_API_KEY",
    authDomain: "SEU_AUTH_DOMAIN",
    projectId: "SEU_PROJECT_ID",
    storageBucket: "SEU_STORAGE_BUCKET",
    messagingSenderId: "SEU_MESSAGING_SENDER_ID",
    appId: "SEU_APP_ID"
};

// --- INICIALIZAÇÃO E VARIÁVEIS GLOBAIS ---
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// ... (variáveis do calendário continuam as mesmas)
const calendarGrid = document.getElementById('calendar-grid');
const currentMonthYearEl = document.getElementById('current-month-year');
const prevMonthBtn = document.getElementById('prev-month-btn');
const nextMonthBtn = document.getElementById('next-month-btn');
const modal = document.getElementById('edit-modal');
const closeModalBtn = document.querySelector('.close-btn');
const editScaleForm = document.getElementById('edit-scale-form');

// NOVAS VARIÁVEIS PARA GERENCIAMENTO DE CORRETORES
const addAgentForm = document.getElementById('add-agent-form');
const agentListEl = document.getElementById('agent-list');

let currentDate = new Date();
let corretoresCache = {};
let escalaCache = {};

// --- LÓGICA DE GERENCIAMENTO DE CORRETORES ---

/**
 * Adiciona um novo corretor ao Firestore
 */
async function handleAddAgent(e) {
    e.preventDefault();
    const nome = document.getElementById('agent-name').value;
    const email = document.getElementById('agent-email').value;
    const unidade = document.getElementById('agent-unidade').value;

    if (!nome || !email) {
        alert("Por favor, preencha o nome e o email.");
        return;
    }

    try {
        await db.collection('corretores').add({
            nome: nome,
            email: email,
            unidade: unidade,
            createdAt: firebase.firestore.FieldValue.serverTimestamp() // Opcional: para saber quando foi criado
        });
        addAgentForm.reset();
    } catch (error) {
        console.error("Erro ao adicionar corretor: ", error);
        alert("Não foi possível adicionar o corretor.");
    }
}

/**
 * Escuta por mudanças na coleção de corretores e atualiza a lista na tela
 */
function listenForAgents() {
    db.collection('corretores').orderBy('nome').onSnapshot(snapshot => {
        agentListEl.innerHTML = '';
        corretoresCache = {}; // Limpa o cache para reconstruir com dados frescos
        const corretores = [];

        snapshot.forEach(doc => {
            const agentData = doc.data();
            agentListEl.innerHTML += `
                <li>
                    <div class="agent-info">
                        <span class="agent-name">${agentData.nome}</span>
                        <span class="agent-unidade">${agentData.unidade}</span>
                    </div>
                    <button class="delete-agent-btn" data-id="${doc.id}" title="Excluir Corretor">✖</button>
                </li>
            `;
            // Atualiza o cache
            corretoresCache[doc.id] = {
                id: doc.id,
                nome: agentData.nome,
                primeiroNome: agentData.nome.split(' ')[0]
            };
            corretores.push(corretoresCache[doc.id]);
        });
        // Após atualizar a lista, re-renderiza o calendário para refletir quaisquer mudanças de nome
        renderCalendar();
    });
}

/**
 * Deleta um corretor do Firestore
 */
async function handleDeleteAgent(e) {
    if (e.target.classList.contains('delete-agent-btn')) {
        const id = e.target.dataset.id;
        if (confirm("Tem certeza que deseja excluir este corretor? Isso não pode ser desfeito.")) {
            try {
                await db.collection('corretores').doc(id).delete();
            } catch (error) {
                console.error("Erro ao excluir corretor: ", error);
                alert("Não foi possível excluir o corretor.");
            }
        }
    }
}


// --- FUNÇÕES DO CALENDÁRIO (CÓDIGO ANTERIOR, SEM MUDANÇAS SIGNIFICATIVAS) ---
// O código para renderCalendar, getEscalaDoMes, openEditModal, etc., continua o mesmo.
// A única diferença é que agora não precisamos mais da função `getAllCorretores`,
// pois o `listenForAgents` já popula o cache de corretores em tempo real.

// (Cole aqui o resto do seu script.js, desde 'async function renderCalendar()' até o final)

async function renderCalendar() {
    // ... (código idêntico ao anterior, mas agora ele usará o corretoresCache que é preenchido pelo listenForAgents)
    calendarGrid.innerHTML = 'Carregando escala...'; 
    currentDate.setDate(1);

    const month = currentDate.getMonth();
    const year = currentDate.getFullYear();
    
    const monthName = currentDate.toLocaleString('pt-BR', { month: 'long' });
    currentMonthYearEl.textContent = `${monthName.charAt(0).toUpperCase() + monthName.slice(1)} de ${year}`;

    const firstDayIndex = currentDate.getDay();
    const lastDay = new Date(year, month + 1, 0).getDate();
    const prevLastDay = new Date(year, month, 0).getDate();
    const lastDayIndex = new Date(year, month + 1, 0).getDay();
    const nextDays = 7 - lastDayIndex - 1;

    const escalaDoMes = await getEscalaDoMes(year, month);
    let daysHtml = '';

    for (let i = firstDayIndex; i > 0; i--) {
        daysHtml += `<div class="calendar-day not-current-month"><div class="day-number">${prevLastDay - i + 1}</div></div>`;
    }

    for (let i = 1; i <= lastDay; i++) {
        const diaData = escalaDoMes[i] || {};
        const nomeManha = corretoresCache[diaData.manha]?.primeiroNome;
        const nomeTarde = corretoresCache[diaData.tarde]?.primeiroNome;
        const nomeNoite = corretoresCache[diaData.noite]?.primeiroNome;

        daysHtml += `
            <div class="calendar-day" data-day="${i}">
                <div class="day-number">${i}</div>
                <div class="shifts">
                    ${nomeManha ? `<div class="shift">☀️ ${nomeManha}</div>` : ''}
                    ${nomeTarde ? `<div class="shift">☀️ ${nomeTarde}</div>` : ''}
                    ${nomeNoite ? `<div class="shift">🌙 ${nomeNoite}</div>` : ''}
                </div>
            </div>
        `;
    }
    
    for (let i = 1; i <= nextDays; i++) {
        daysHtml += `<div class="calendar-day not-current-month"><div class="day-number">${i}</div></div>`;
    }
    
    calendarGrid.innerHTML = daysHtml;
    
    document.querySelectorAll('.calendar-day[data-day]').forEach(day => {
        day.addEventListener('click', () => openEditModal(day.dataset.day, escalaDoMes));
    });
}

async function getEscalaDoMes(year, month) {
    const docId = `${year}-${String(month + 1).padStart(2, '0')}`;
    if (escalaCache[docId]) return escalaCache[docId];
    const doc = await db.collection('escala').doc(docId).get();
    const escala = doc.exists ? doc.data().dias || {} : {};
    escalaCache[docId] = escala;
    return escala;
}

function openEditModal(day, escalaDoMes) {
    const todosCorretores = Object.values(corretoresCache);
    const { month, year } = { month: currentDate.getMonth(), year: currentDate.getFullYear() };
    document.getElementById('modal-title').innerText = `Editar Escala: ${day}/${month + 1}/${year}`;
    document.getElementById('selected-day').value = day;

    let optionsHtml = '<option value="">-- Vazio --</option>';
    todosCorretores.sort((a, b) => a.nome.localeCompare(b.nome)).forEach(corretor => {
        optionsHtml += `<option value="${corretor.id}">${corretor.nome}</option>`;
    });

    const selects = document.querySelectorAll('.corretor-select');
    selects.forEach(select => select.innerHTML = optionsHtml);

    const diaData = escalaDoMes[day] || {};
    document.getElementById('select-manha').value = diaData.manha || '';
    document.getElementById('select-tarde').value = diaData.tarde || '';
    document.getElementById('select-noite').value = diaData.noite || '';

    modal.style.display = 'block';
}

async function handleSaveScale(e) {
    e.preventDefault();
    const day = document.getElementById('selected-day').value;
    const escalaDoDia = {
        manha: document.getElementById('select-manha').value,
        tarde: document.getElementById('select-tarde').value,
        noite: document.getElementById('select-noite').value
    };
    const { month, year } = { month: currentDate.getMonth(), year: currentDate.getFullYear() };
    const docId = `${year}-${String(month + 1).padStart(2, '0')}`;
    const fieldPath = `dias.${day}`;
    try {
        await db.collection('escala').doc(docId).set({ dias: { [day]: escalaDoDia } }, { merge: true });
        if (!escalaCache[docId]) escalaCache[docId] = {};
        escalaCache[docId][day] = escalaDoDia;
        modal.style.display = 'none';
        renderCalendar();
    } catch (error) {
        console.error("Erro ao salvar a escala: ", error);
        alert("Não foi possível salvar a escala.");
    }
}

// --- EVENT LISTENERS ---
prevMonthBtn.addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() - 1);
    escalaCache = {};
    renderCalendar();
});
nextMonthBtn.addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() + 1);
    escalaCache = {};
    renderCalendar();
});
closeModalBtn.addEventListener('click', () => modal.style.display = 'none');
window.addEventListener('click', (e) => {
    if (e.target == modal) modal.style.display = 'none';
});
editScaleForm.addEventListener('submit', handleSaveScale);

// NOVOS EVENT LISTENERS
addAgentForm.addEventListener('submit', handleAddAgent);
agentListEl.addEventListener('click', handleDeleteAgent);

// --- INICIALIZAÇÃO ---
document.addEventListener('DOMContentLoaded', () => {
    listenForAgents(); // Começa a ouvir por corretores assim que a página carrega
    // O renderCalendar() será chamado automaticamente pela primeira vez dentro do listenForAgents
});
