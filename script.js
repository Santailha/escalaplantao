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

const calendarGrid = document.getElementById('calendar-grid');
const currentMonthYearEl = document.getElementById('current-month-year');
const prevMonthBtn = document.getElementById('prev-month-btn');
const nextMonthBtn = document.getElementById('next-month-btn');
const modal = document.getElementById('edit-modal');
const closeModalBtn = document.querySelector('.close-btn');
const editScaleForm = document.getElementById('edit-scale-form');

let currentDate = new Date();
let corretoresCache = {}; // Cache de corretores para performance
let escalaCache = {}; // Cache da escala para evitar buscas repetidas

// --- FUNÇÕES PRINCIPAIS ---

/**
 * Renderiza o calendário para o mês e ano da 'currentDate'
 */
async function renderCalendar() {
    calendarGrid.innerHTML = 'Carregando escala...'; // Feedback para o usuário
    currentDate.setDate(1);

    const month = currentDate.getMonth();
    const year = currentDate.getFullYear();
    
    // Atualiza o título com o nome do mês e ano
    const monthName = currentDate.toLocaleString('pt-BR', { month: 'long' });
    currentMonthYearEl.textContent = `${monthName.charAt(0).toUpperCase() + monthName.slice(1)} de ${year}`;

    // Lógica para calcular os dias a serem exibidos
    const firstDayIndex = currentDate.getDay();
    const lastDay = new Date(year, month + 1, 0).getDate();
    const prevLastDay = new Date(year, month, 0).getDate();
    const lastDayIndex = new Date(year, month + 1, 0).getDay();
    const nextDays = 7 - lastDayIndex - 1;

    // Busca os dados da escala e os corretores em paralelo para agilizar
    const [escalaDoMes, todosCorretores] = await Promise.all([
        getEscalaDoMes(year, month),
        getAllCorretores()
    ]);

    let daysHtml = '';

    // Dias do mês anterior
    for (let i = firstDayIndex; i > 0; i--) {
        daysHtml += `<div class="calendar-day not-current-month"><div class="day-number">${prevLastDay - i + 1}</div></div>`;
    }

    // Dias do mês atual
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
    
    // Dias do próximo mês
    for (let i = 1; i <= nextDays; i++) {
        daysHtml += `<div class="calendar-day not-current-month"><div class="day-number">${i}</div></div>`;
    }
    
    calendarGrid.innerHTML = daysHtml;
    
    // Adiciona o evento de clique a cada dia do mês atual
    document.querySelectorAll('.calendar-day[data-day]').forEach(day => {
        day.addEventListener('click', () => openEditModal(day.dataset.day, todosCorretores, escalaDoMes));
    });
}


/**
 * Busca e armazena em cache todos os corretores da coleção 'corretores'
 * @returns {Array} Lista de corretores
 */
async function getAllCorretores() {
    if (Object.keys(corretoresCache).length > 0) {
        return Object.values(corretoresCache);
    }
    const snapshot = await db.collection('corretores').get();
    const corretores = [];
    snapshot.forEach(doc => {
        const data = doc.data();
        corretoresCache[doc.id] = {
            id: doc.id,
            nome: data.nome,
            primeiroNome: data.nome.split(' ')[0]
        };
        corretores.push(corretoresCache[doc.id]);
    });
    return corretores;
}


/**
 * Busca e armazena em cache a escala de um mês específico
 * @param {number} year - Ano
 * @param {number} month - Mês (0-11)
 * @returns {object} Objeto com os dados da escala do mês
 */
async function getEscalaDoMes(year, month) {
    const docId = `${year}-${String(month + 1).padStart(2, '0')}`;
    if (escalaCache[docId]) {
        return escalaCache[docId];
    }
    const doc = await db.collection('escala').doc(docId).get();
    const escala = doc.exists ? doc.data().dias || {} : {};
    escalaCache[docId] = escala;
    return escala;
}

/**
 * Abre e prepara o modal de edição para um dia específico
 * @param {string} day - O número do dia
 * @param {Array} todosCorretores - Lista de corretores
 * @param {object} escalaDoMes - Objeto da escala do mês
 */
function openEditModal(day, todosCorretores, escalaDoMes) {
    const { month, year } = { month: currentDate.getMonth(), year: currentDate.getFullYear() };
    
    document.getElementById('modal-title').innerText = `Editar Escala: ${day}/${month + 1}/${year}`;
    document.getElementById('selected-day').value = day;

    // Cria as opções do select com base nos corretores buscados
    let optionsHtml = '<option value="">-- Vazio --</option>';
    todosCorretores.sort((a, b) => a.nome.localeCompare(b.nome)).forEach(corretor => {
        optionsHtml += `<option value="${corretor.id}">${corretor.nome}</option>`;
    });

    const selects = document.querySelectorAll('.corretor-select');
    selects.forEach(select => select.innerHTML = optionsHtml);

    // Seleciona os valores atuais da escala para este dia
    const diaData = escalaDoMes[day] || {};
    document.getElementById('select-manha').value = diaData.manha || '';
    document.getElementById('select-tarde').value = diaData.tarde || '';
    document.getElementById('select-noite').value = diaData.noite || '';

    modal.style.display = 'block';
}


/**
 * Salva os dados do formulário do modal no Firebase
 * @param {Event} e - O evento de submit do formulário
 */
async function handleSaveScale(e) {
    e.preventDefault();
    const day = document.getElementById('selected-day').value;
    
    // Coleta os valores selecionados
    const escalaDoDia = {
        manha: document.getElementById('select-manha').value,
        tarde: document.getElementById('select-tarde').value,
        noite: document.getElementById('select-noite').value
    };

    const { month, year } = { month: currentDate.getMonth(), year: currentDate.getFullYear() };
    const docId = `${year}-${String(month + 1).padStart(2, '0')}`;
    
    // Caminho para o dia específico dentro do documento do mês
    const fieldPath = `dias.${day}`;

    try {
        await db.collection('escala').doc(docId).set({
            dias: { [day]: escalaDoDia }
        }, { merge: true }); // 'merge: true' é crucial para não sobrescrever os outros dias

        // Atualiza o cache local e re-renderiza
        if (!escalaCache[docId]) escalaCache[docId] = {};
        escalaCache[docId][day] = escalaDoDia;
        
        modal.style.display = 'none';
        renderCalendar();
    } catch (error) {
        console.error("Erro ao salvar a escala: ", error);
        alert("Não foi possível salvar a escala. Verifique o console para mais detalhes.");
    }
}


// --- EVENT LISTENERS (Comandos do usuário) ---
prevMonthBtn.addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() - 1);
    escalaCache = {}; // Limpa o cache ao trocar de mês
    renderCalendar();
});

nextMonthBtn.addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() + 1);
    escalaCache = {}; // Limpa o cache
    renderCalendar();
});

closeModalBtn.addEventListener('click', () => modal.style.display = 'none');

window.addEventListener('click', (e) => {
    if (e.target == modal) modal.style.display = 'none';
});

editScaleForm.addEventListener('submit', handleSaveScale);


// --- INICIALIZAÇÃO ---
// Inicia o calendário quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', renderCalendar);
