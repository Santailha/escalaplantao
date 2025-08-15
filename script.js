// Cole aqui as suas credenciais do Firebase que você copiou
const firebaseConfig = {
  apiKey: "SUA_API_KEY",
  authDomain: "SEU_AUTH_DOMAIN",
  projectId: "SEU_PROJECT_ID",
  storageBucket: "SEU_STORAGE_BUCKET",
  messagingSenderId: "SEU_MESSAGING_SENDER_ID",
  appId: "SEU_APP_ID"
};

// Inicializa o Firebase
const app = firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// Referências do DOM
const addAgentForm = document.getElementById('add-agent-form');
const agentList = document.getElementById('agent-list');

// --- LÓGICA DE GERENCIAMENTO DE CORRETORES ---

// Adicionar um novo corretor
addAgentForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const name = document.getElementById('agent-name').value;
    const email = document.getElementById('agent-email').value;
    const idBitrix = document.getElementById('agent-id-bitrix').value;
    const unidade = document.getElementById('agent-unidade').value;
    
    db.collection('corretores').add({
        nome: name,
        email: email,
        idBitrix: parseInt(idBitrix), // Converte para número
        unidade: unidade
    })
    .then(() => {
        console.log("Corretor adicionado com sucesso!");
        addAgentForm.reset();
    })
    .catch((error) => {
        console.error("Erro ao adicionar corretor: ", error);
    });
});

// Exibir a lista de corretores
// A função onSnapshot fica "ouvindo" em tempo real as mudanças na coleção
db.collection('corretores').onSnapshot(snapshot => {
    let html = '';
    snapshot.docs.forEach(doc => {
        const corretor = doc.data();
        html += `
            <li>
                <span>${corretor.nome} (${corretor.unidade})</span>
                <button onclick="deleteAgent('${doc.id}')">Excluir</button>
            </li>
        `;
    });
    agentList.innerHTML = html;
});

// Função para deletar um corretor
function deleteAgent(id) {
    if (confirm("Tem certeza que deseja excluir este corretor?")) {
        db.collection('corretores').doc(id).delete()
        .then(() => console.log("Corretor excluído."))
        .catch(error => console.error("Erro ao excluir: ", error));
    }
}


// --- LÓGICA PARA MOSTRAR PLANTÃO (SIMPLIFICADA) ---
// Esta é uma versão simples. A lógica real buscaria na coleção 'escala'
// pela data de hoje.
function carregarPlantao() {
    // Exemplo: Buscar o primeiro corretor do Centro
    db.collection('corretores').where('unidade', '==', 'Centro').limit(1).get().then(snapshot => {
        if (!snapshot.empty) {
            document.getElementById('corretor-centro').innerText = snapshot.docs[0].data().nome;
        }
    });

    // Exemplo: Buscar o primeiro corretor do Campeche
    db.collection('corretores').where('unidade', '==', 'Campeche').limit(1).get().then(snapshot => {
         if (!snapshot.empty) {
            document.getElementById('corretor-campeche').innerText = snapshot.docs[0].data().nome;
        }
    });
}

// Carrega o plantão quando a página abre
document.addEventListener('DOMContentLoaded', carregarPlantao);
