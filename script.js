// --- CONFIGURAÇÃO DO FIREBASE (igual ao anterior) ---
const firebaseConfig = {
    apiKey: "SUA_API_KEY",
    authDomain: "SEU_AUTH_DOMAIN",
    projectId: "SEU_PROJECT_ID",
    // ...resto das suas credenciais
};
const app = firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// --- VARIÁVEIS GLOBAIS ---
const calendarGrid = document.getElementById('calendar-grid');
const currentMonthYearEl = document.getElementById('current-month-year');
const prevMonthBtn = document.getElementById('prev-month-btn');
const nextMonthBtn = document.getElementById('next-month-btn');
const modal = document.getElementById('edit-modal');
const closeModalBtn = document.querySelector('.close-btn');
const editScaleForm = document.getElementById('edit-scale-form');

let currentDate = new Date(); // Começa com a data atual
let corretoresCache = {}; // Cache para não buscar corretores toda hora

// --- FUNÇÕES PRINCIPAIS ---

// 1. Renderiza o Calendário
async function renderCalendar() {
    calendarGrid.innerHTML = ''; // Limpa o grid
    currentDate.setDate(1); // Vai para o primeiro dia do mês

    const month = currentDate.getMonth();
    const year = currentDate.getFullYear();
    
    currentMonthYearEl.textContent = `${currentDate.toLocaleString('pt-BR', { month: 'long' })} ${year}`;

    const firstDayIndex = currentDate.getDay();
    const lastDay = new Date(year, month + 1, 0).getDate();
    const prevLastDay = new Date(year, month, 0).getDate();

    // Busca os dados da escala para o mês atual
    const escalaDoMes = await getEscalaDoMes(year, month);
    
    // Preenche os dias do mês anterior
    for (let i = firstDayIndex; i > 0; i--) {
        calendarGrid.innerHTML += `<div class="calendar-day not-current-month">${prevLastDay - i + 1}</div>`;
    }

    // Preenche os dias do mês atual
    for (let i = 1; i <= lastDay; i++) {
        const diaData = escalaDoMes.dias && escalaDoMes.dias[i] ? escalaDoMes.dias[i] : {};

        // Busca os nomes dos corretores
        const nomeManha = await getCorretorNameById(diaData.manha);
        const nomeTarde = await getCorretorNameById(diaData.tarde);
        const nomeNoite = await getCorretorNameById(diaData.noite);

        calendarGrid.innerHTML += `
            <div class="calendar-day" data-day="${i}">
                <div class="day-number">${i}</div>
                <div class="shifts">
                    ${nomeManha ? `<div class="shift manha">M: ${nomeManha}</div>` : ''}
                    ${nomeTarde ? `<div class="shift tarde">T: ${nomeTarde}</div>` : ''}
                    ${nomeNoite ? `<div class="shift noite">N: ${nomeNoite}</div>` : ''}
                </div>
            </div>
        `;
    }
    
    // Adiciona event listener para cada dia do calendário
    document.querySelectorAll('.calendar-day[data-day]').forEach(day => {
        day.addEventListener('click', () => openEditModal(day.dataset.day));
    });
}

// 2. Busca a escala do mês no Firebase
async function getEscalaDoMes(year, month) {
    const docId = `${year}-${String(month + 1).padStart(2, '0')}`;
    const doc = await db.collection('escala').doc(docId).get();
    return doc.exists ? doc.data() : {};
}

// 3. Busca o nome de um corretor pelo ID (com cache)
async function getCorretorNameById(id) {
    if (!id) return null;
    if (corretoresCache[id]) return corretoresCache[id];
    
    try {
        const doc = await db.collection('corretores').doc(id).get();
        if (doc.exists) {
            const nome = doc.data().nome.split(' ')[0]; // Pega só o primeiro nome
            corretoresCache[id] = nome;
            return nome;
        }
        return null;
    } catch (error) {
        console.error("Erro ao buscar corretor:", error);
        return null;
    }
}

// 4. Abre o Modal de Edição
async function openEditModal(day) {
    const month = currentDate.getMonth();
    const year = currentDate.getFullYear();
    
    document.getElementById('modal-title').innerText = `Editar Escala para ${day}/${month + 1}/${year}`;
    document.getElementById('selected-day').value = day;

    // Popula os selects com os corretores
    const selectManha = document.getElementById('select-manha');
    const selectTarde = document.getElementById('select-tarde');
    const selectNoite = document.getElementById('select-noite');

    const corretoresSnapshot = await db.collection('corretores').get();
    let optionsHtml = '<option value="">Ninguém</option>';
    corretoresSnapshot.forEach(doc => {
        optionsHtml += `<option value="${doc.id}">${doc.data().nome}</option>`;
    });
    selectManha.innerHTML = optionsHtml;
    selectTarde.innerHTML = optionsHtml;
    selectNoite.innerHTML = optionsHtml;

    // Seleciona os corretores já escalados
    const escalaDoMes = await getEscalaDoMes(year, month);
    const diaData = escalaDoMes.dias && escalaDoMes.dias[day] ? escalaDoMes.dias[day] : {};
    selectManha.value = diaData.manha || '';
    selectTarde.value = diaData.tarde || '';
    selectNoite.value = diaData.noite || '';

    modal.style.display = 'block';
}

// 5. Salva a escala no Firebase
editScaleForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const day = document.getElementById('selected-day').value;
    const manha = document.getElementById('select-manha').value;
    const tarde = document.getElementById('select-tarde').value;
    const noite = document.getElementById('select-noite').value;

    const month = currentDate.getMonth();
    const year = currentDate.getFullYear();
    const docId = `${year}-${String(month + 1).padStart(2, '0')}`;
    
    const fieldPath = `dias.${day}`;

    await db.collection('escala').doc(docId).set({
        [fieldPath]: {
            manha: manha,
            tarde: tarde,
            noite: noite
        }
    }, { merge: true }); // 'merge: true' garante que não vamos apagar os outros dias do mês

    modal.style.display = 'none';
    renderCalendar(); // Re-renderiza o calendário para mostrar a atualização
});


// --- EVENT LISTENERS ---
prevMonthBtn.addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() - 1);
    renderCalendar();
});

nextMonthBtn.addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() + 1);
    renderCalendar();
});

closeModalBtn.addEventListener('click', () => modal.style.display = 'none');
window.addEventListener('click', (e) => {
    if (e.target == modal) {
        modal.style.display = 'none';
    }
});


// --- INICIALIZAÇÃO ---
document.addEventListener('DOMContentLoaded', renderCalendar);
