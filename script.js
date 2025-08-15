// --- CONFIGURAÇÃO DO FIREBASE (COLE A SUA AQUI) ---
const firebaseConfig = {
    apiKey: "SUA_API_KEY",
    authDomain: "SEU_AUTH_DOMAIN",
    projectId: "SEU_PROJECT_ID",
    storageBucket: "SEU_STORAGE_BUCKET",
    messagingSenderId: "SEU_MESSAGING_SENDER_ID",
    appId: "SEU_APP_ID"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// --- VARIÁVEIS GLOBAIS ---
const calendarGrid = document.getElementById('calendar-grid');
const currentMonthYearEl = document.getElementById('current-month-year');
const prevMonthBtn = document.getElementById('prev-month-btn');
const nextMonthBtn = document.getElementById('next-month-btn');
const modal = document.getElementById('edit-modal');
const closeModalBtn = document.querySelector('.close-btn');
const editScaleForm = document.getElementById('edit-scale-form');

let currentDate = new Date();
let corretoresCache = {};

// --- FUNÇÕES PRINCIPAIS ---

/**
 * Renderiza o calendário, agora mostrando listas de corretores por turno.
 */
async function renderCalendar() {
    // Garante que temos a lista de corretores antes de desenhar o calendário
    if (Object.keys(corretoresCache).length === 0) {
        await getAllCorretores();
    }
    
    calendarGrid.innerHTML = '';
    currentDate.setDate(1);
    const month = currentDate.getMonth();
    const year = currentDate.getFullYear();
    const monthName = currentDate.toLocaleString('pt-BR', { month: 'long' });
    currentMonthYearEl.textContent = `${monthName.charAt(0).toUpperCase() + monthName.slice(1)} de ${year}`;

    const firstDayIndex = currentDate.getDay();
    const lastDay = new Date(year, month + 1, 0).getDate();
    const escalaDoMes = await getEscalaDoMes(year, month);
    let daysHtml = '';

    for (let i = 0; i < firstDayIndex; i++) { daysHtml += `<div class="calendar-day not-current-month"></div>`; }

    for (let i = 1; i <= lastDay; i++) {
        const diaData = escalaDoMes[i] || {};
        
        // Gera a lista de nomes para cada turno
        const manhaNomes = (diaData.manha || []).map(id => corretoresCache[id]?.primeiroNome || '...').join(', ');
        const tardeNomes = (diaData.tarde || []).map(id => corretoresCache[id]?.primeiroNome || '...').join(', ');
        const noiteNomes = (diaData.noite || []).map(id => corretoresCache[id]?.primeiroNome || '...').join(', ');

        daysHtml += `
            <div class="calendar-day" data-day="${i}">
                <div class="day-number">${i}</div>
                ${manhaNomes ? `<div class="shift-title">Manhã</div><ul class="agent-list-day"><li>${manhaNomes}</li></ul>` : ''}
                ${tardeNomes ? `<div class="shift-title">Tarde</div><ul class="agent-list-day"><li>${tardeNomes}</li></ul>` : ''}
                ${noiteNomes ? `<div class="shift-title">Noite</div><ul class="agent-list-day"><li>${noiteNomes}</li></ul>` : ''}
            </div>
        `;
    }
    calendarGrid.innerHTML = daysHtml;
    
    document.querySelectorAll('.calendar-day[data-day]').forEach(day => {
        day.addEventListener('click', () => openEditModal(day.dataset.day, escalaDoMes));
    });
}

/**
 * Abre o modal e popula com checkboxes para todos os corretores.
 */
function openEditModal(day, escalaDoMes) {
    const { month, year } = { month: currentDate.getMonth(), year: currentDate.getFullYear() };
    document.getElementById('modal-title').innerText = `Editar Plantão: ${day}/${month + 1}/${year}`;
    document.getElementById('selected-day').value = day;

    const todosCorretores = Object.values(corretoresCache).sort((a,b) => a.nome.localeCompare(b.nome));
    const containers = {
        manha: document.getElementById('checkbox-container-manha'),
        tarde: document.getElementById('checkbox-container-tarde'),
        noite: document.getElementById('checkbox-container-noite')
    };
    
    // Limpa containers e popula com checkboxes
    for (const turno in containers) {
        containers[turno].innerHTML = '';
        const escalados = escalaDoMes[day]?.[turno] || [];
        todosCorretores.forEach(corretor => {
            const isChecked = escalados.includes(corretor.id);
            containers[turno].innerHTML += `
                <div class="checkbox-item">
                    <input type="checkbox" id="${turno}-${corretor.id}" value="${corretor.id}" ${isChecked ? 'checked' : ''}>
                    <label for="${turno}-${corretor.id}">${corretor.nome}</label>
                </div>
            `;
        });
    }

    modal.style.display = 'block';
}

/**
 * Salva a escala, agora coletando os IDs dos checkboxes marcados.
 */
async function handleSaveScale(e) {
    e.preventDefault();
    const day = document.getElementById('selected-day').value;
    const { month, year } = { month: currentDate.getMonth(), year: currentDate.getFullYear() };
    const docId = `${year}-${String(month + 1).padStart(2, '0')}`;
    
    const escalaDoDia = { manha: [], tarde: [], noite: [] };

    // Coleta os IDs dos corretores marcados para cada turno
    for (const turno of ['manha', 'tarde', 'noite']) {
        const checkedBoxes = document.querySelectorAll(`#checkbox-container-${turno} input[type="checkbox"]:checked`);
        checkedBoxes.forEach(box => escalaDoDia[turno].push(box.value));
    }

    try {
        await db.collection('escala').doc(docId).set({
            dias: { [day]: escalaDoDia }
        }, { merge: true });
        
        modal.style.display = 'none';
        renderCalendar();
    } catch (error) {
        console.error("Erro ao salvar o plantão: ", error);
        alert("Não foi possível salvar o plantão.");
    }
}

// --- Funções Auxiliares (semelhantes às anteriores) ---

async function getAllCorretores() {
    const snapshot = await db.collection('corretores').get();
    snapshot.forEach(doc => {
        const data = doc.data();
        corretoresCache[doc.id] = {
            id: doc.id,
            nome: data.nome,
            primeiroNome: data.nome.split(' ')[0]
        };
    });
}

async function getEscalaDoMes(year, month) {
    const docId = `${year}-${String(month + 1).padStart(2, '0')}`;
    const doc = await db.collection('escala').doc(docId).get();
    return doc.exists ? doc.data().dias || {} : {};
}

// --- Event Listeners ---
prevMonthBtn.addEventListener('click', () => { currentDate.setMonth(currentDate.getMonth() - 1); renderCalendar(); });
nextMonthBtn.addEventListener('click', () => { currentDate.setMonth(currentDate.getMonth() + 1); renderCalendar(); });
closeModalBtn.addEventListener('click', () => modal.style.display = 'none');
window.addEventListener('click', (e) => { if (e.target == modal) modal.style.display = 'none'; });
editScaleForm.addEventListener('submit', handleSaveScale);

// --- Inicialização ---
document.addEventListener('DOMContentLoaded', renderCalendar);
