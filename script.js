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

// --- NOVAS ---
const addAgentForm = document.getElementById('add-agent-form');
const agentListEl = document.getElementById('agent-list');

let currentDate = new Date();
let corretoresCache = {};

// --- LÓGICA DE GERENCIAMENTO DE CORRETORES ---

/**
 * Adiciona um novo corretor ao Firestore a partir do formulário.
 */
async function handleAddAgent(e) {
    e.preventDefault();
    const nome = document.getElementById('agent-name').value;
    const email = document.getElementById('agent-email').value;
    const idBitrix = document.getElementById('agent-bitrix-id').value;

    if (!nome || !email || !idBitrix) {
        alert("Por favor, preencha todos os campos.");
        return;
    }

    try {
        await db.collection('corretores').add({
            nome: nome,
            email: email,
            idBitrix: parseInt(idBitrix), // Converte o ID para número
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        addAgentForm.reset();
        alert("Corretor adicionado com sucesso!");
    } catch (error) {
        console.error("Erro ao adicionar corretor: ", error);
        alert("Não foi possível adicionar o corretor.");
    }
}

/**
 * Escuta por mudanças na coleção de corretores e atualiza a lista e o cache.
 */
function listenForAgents() {
    db.collection('corretores').orderBy('nome').onSnapshot(snapshot => {
        agentListEl.innerHTML = '';
        corretoresCache = {}; // Limpa o cache para garantir dados frescos
        
        if (snapshot.empty) {
            agentListEl.innerHTML = "<li>Nenhum corretor cadastrado.</li>";
        }

        snapshot.forEach(doc => {
            const agent = doc.data();
            agentListEl.innerHTML += `
                <li>
                    <div class="agent-info">
                        <span class="agent-name">${agent.nome}</span>
                        <span class="agent-details">Email: ${agent.email} | ID Bitrix: ${agent.idBitrix}</span>
                    </div>
                    <button class="delete-agent-btn" data-id="${doc.id}" title="Excluir Corretor">✖</button>
                </li>
            `;
            // Adiciona ao cache para uso no calendário
            corretoresCache[doc.id] = {
                id: doc.id,
                nome: agent.nome,
                primeiroNome: agent.nome.split(' ')[0]
            };
        });
        // Após atualizar a lista, re-renderiza o calendário caso um nome mude
        renderCalendar();
    });
}

/**
 * Deleta um corretor do Firestore.
 */
async function handleDeleteAgent(e) {
    if (e.target.classList.contains('delete-agent-btn')) {
        const id = e.target.dataset.id;
        if (confirm(`Tem certeza que deseja excluir o corretor?`)) {
            try {
                await db.collection('corretores').doc(id).delete();
                alert("Corretor excluído com sucesso.");
            } catch (error) {
                console.error("Erro ao excluir corretor: ", error);
                alert("Não foi possível excluir o corretor.");
            }
        }
    }
}


// --- LÓGICA DO CALENDÁRIO (CÓDIGO ANTERIOR) ---
// (O restante do código do calendário permanece o mesmo)
async function renderCalendar() {
    calendarGrid.innerHTML = ''; currentDate.setDate(1);
    const month = currentDate.getMonth(), year = currentDate.getFullYear();
    const monthName = currentDate.toLocaleString('pt-BR', { month: 'long' });
    currentMonthYearEl.textContent = `${monthName.charAt(0).toUpperCase() + monthName.slice(1)} de ${year}`;
    const firstDayIndex = currentDate.getDay(), lastDay = new Date(year, month + 1, 0).getDate();
    const escalaDoMes = await getEscalaDoMes(year, month);
    let daysHtml = '';
    for (let i = 0; i < firstDayIndex; i++) { daysHtml += `<div class="calendar-day not-current-month"></div>`; }
    for (let i = 1; i <= lastDay; i++) {
        const diaData = escalaDoMes[i] || {};
        const manhaNomes = (diaData.manha || []).map(id => corretoresCache[id]?.primeiroNome || '?').join(', ');
        const tardeNomes = (diaData.tarde || []).map(id => corretoresCache[id]?.primeiroNome || '?').join(', ');
        const noiteNomes = (diaData.noite || []).map(id => corretoresCache[id]?.primeiroNome || '?').join(', ');
        daysHtml += `<div class="calendar-day" data-day="${i}"><div class="day-number">${i}</div>
            ${manhaNomes ? `<div class="shift-title">Manhã</div><ul class="agent-list-day"><li>${manhaNomes}</li></ul>` : ''}
            ${tardeNomes ? `<div class="shift-title">Tarde</div><ul class="agent-list-day"><li>${tardeNomes}</li></ul>` : ''}
            ${noiteNomes ? `<div class="shift-title">Noite</div><ul class="agent-list-day"><li>${noiteNomes}</li></ul>` : ''}</div>`;
    }
    calendarGrid.innerHTML = daysHtml;
    document.querySelectorAll('.calendar-day[data-day]').forEach(day => {
        day.addEventListener('click', () => openEditModal(day.dataset.day, escalaDoMes));
    });
}
function openEditModal(day, escalaDoMes) {
    const { month, year } = { month: currentDate.getMonth(), year: currentDate.getFullYear() };
    document.getElementById('modal-title').innerText = `Editar Plantão: ${day}/${month + 1}/${year}`;
    document.getElementById('selected-day').value = day;
    const todosCorretores = Object.values(corretoresCache).sort((a,b) => a.nome.localeCompare(b.nome));
    const containers = { manha: document.getElementById('checkbox-container-manha'), tarde: document.getElementById('checkbox-container-tarde'), noite: document.getElementById('checkbox-container-noite') };
    for (const turno in containers) {
        containers[turno].innerHTML = '';
        const escalados = escalaDoMes[day]?.[turno] || [];
        todosCorretores.forEach(corretor => {
            const isChecked = escalados.includes(corretor.id);
            containers[turno].innerHTML += `<div class="checkbox-item"><input type="checkbox" id="${turno}-${corretor.id}" value="${corretor.id}" ${isChecked ? 'checked' : ''}><label for="${turno}-${corretor.id}">${corretor.nome}</label></div>`;
        });
    }
    modal.style.display = 'block';
}
async function handleSaveScale(e) {
    e.preventDefault();
    const day = document.getElementById('selected-day').value;
    const { month, year } = { month: currentDate.getMonth(), year: currentDate.getFullYear() };
    const docId = `${year}-${String(month + 1).padStart(2, '0')}`;
    const escalaDoDia = { manha: [], tarde: [], noite: [] };
    for (const turno of ['manha', 'tarde', 'noite']) {
        const checkedBoxes = document.querySelectorAll(`#checkbox-container-${turno} input[type="checkbox"]:checked`);
        checkedBoxes.forEach(box => escalaDoDia[turno].push(box.value));
    }
    try {
        await db.collection('escala').doc(docId).set({ dias: { [day]: escalaDoDia } }, { merge: true });
        modal.style.display = 'none';
        renderCalendar();
    } catch (error) {
        console.error("Erro ao salvar o plantão: ", error); alert("Não foi possível salvar o plantão.");
    }
}
async function getEscalaDoMes(year, month) {
    const docId = `${year}-${String(month + 1).padStart(2, '0')}`;
    const doc = await db.collection('escala').doc(docId).get();
    return doc.exists ? doc.data().dias || {} : {};
}
prevMonthBtn.addEventListener('click', () => { currentDate.setMonth(currentDate.getMonth() - 1); renderCalendar(); });
nextMonthBtn.addEventListener('click', () => { currentDate.setMonth(currentDate.getMonth() + 1); renderCalendar(); });
closeModalBtn.addEventListener('click', () => modal.style.display = 'none');
window.addEventListener('click', (e) => { if (e.target == modal) modal.style.display = 'none'; });
editScaleForm.addEventListener('submit', handleSaveScale);

// --- NOVOS EVENT LISTENERS ---
addAgentForm.addEventListener('submit', handleAddAgent);
agentListEl.addEventListener('click', handleDeleteAgent);

// --- INICIALIZAÇÃO ---
document.addEventListener('DOMContentLoaded', listenForAgents);
