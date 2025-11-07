const CONFIG = {
    API_ENDPOINT: 'api/analyze_uniform.php',
    API_HEADERS: {
    }
};

// Variables globales
let stream = null;
let detections = [];
let stats = { total: 0, compliant: 0, nonCompliant: 0 };
const alarmSound = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBjCJ1O/FdSYFKXzL8diOOwkSbsTv6Jc=');


const video = document.getElementById('video');
const capturedImage = document.getElementById('capturedImage');
const placeholder = document.getElementById('placeholder');
const btnStartCamera = document.getElementById('btnStartCamera');
const btnStopCamera = document.getElementById('btnStopCamera');
const btnAnalyze = document.getElementById('btnAnalyze');
const btnUploadImage = document.getElementById('btnUploadImage');
const fileInput = document.getElementById('fileInput');
const detectionResult = document.getElementById('detectionResult');
const alertModal = document.getElementById('alertModal');
const historyList = document.getElementById('historyList');
const btnDownloadReport = document.getElementById('btnDownloadReport');

// Funcion principal
async function analyzeImage(imageData) {
    try {
        btnAnalyze.disabled = true;
        btnAnalyze.innerHTML = '<div class="loading"></div> Analizando...';

        // Crear FormData para enviar la imagen
        const formData = new FormData();
        formData.append('image', imageData);

        // PHP recibe 
        const response = await fetch(CONFIG.API_ENDPOINT, {
            method: 'POST',
            headers: CONFIG.API_HEADERS,
            body: formData
        });

        if (!response.ok) {
            throw new Error('Error en la respuesta del servidor');
        }
        const result = await response.json();
        displayResult(result);
        addToHistory(result);
        updateStats(result.isCompliant);

        if (!result.isCompliant) {
            triggerAlert();
        }

    } catch (error) {
        console.error('Error al analizar:', error);
        alert('Error al conectar con el modelo. Verifica que el servidor esté activo.');
    } finally {
        btnAnalyze.disabled = false;
        btnAnalyze.innerHTML = `
                    <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                    Analizar Uniforme
                `;
    }
}

// Camara
async function startCamera() {
    try {
        stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment', width: 1280, height: 720 }
        });
        video.srcObject = stream;
        video.style.display = 'block';
        placeholder.style.display = 'none';
        capturedImage.style.display = 'none';
        btnStartCamera.style.display = 'none';
        btnStopCamera.style.display = 'flex';
        btnAnalyze.disabled = false;
    } catch (error) {
        alert('No se pudo acceder a la cámara. Verifica los permisos.');
        console.error(error);
    }
}

function stopCamera() {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        video.style.display = 'none';
        placeholder.style.display = 'block';
        btnStartCamera.style.display = 'flex';
        btnStopCamera.style.display = 'none';
        btnAnalyze.disabled = true;
    }
}

// Capturar frame de video y analizar
function captureAndAnalyze() {
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);

    canvas.toBlob(blob => {
        analyzeImage(blob);
    }, 'image/jpeg', 0.95);
}

// Cargar imagen desde archivo
function handleFileUpload(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            capturedImage.src = event.target.result;
            capturedImage.style.display = 'block';
            video.style.display = 'none';
            placeholder.style.display = 'none';
            btnAnalyze.disabled = false;
            analyzeImage(file);
        };
        reader.readAsDataURL(file);
    }
}

// Mostrar resultado
function displayResult(result) {
    const className = result.isCompliant ? 'compliant' : 'non-compliant';
    const status = result.isCompliant ? '✓ Permitir Paso' : '✗ Detener - Uniforme Incorrecto';
    const confidence = Math.round(result.confidence * 100);

    detectionResult.className = `detection-result ${className}`;
    detectionResult.innerHTML = `
                <h3>${status}</h3>
                <div class="detection-info">
                    <span><strong>Tipo de Uniforme:</strong> ${result.uniform_type}</span>
                    <span><strong>Confianza:</strong> ${confidence}%</span>
                    <span><strong>Hora:</strong> ${result.timestamp || new Date().toLocaleString('es-PE')}</span>
                </div>
            `;
    detectionResult.style.display = 'block';

    document.getElementById('lastUpdate').textContent = new Date().toLocaleTimeString('es-PE');
}

// Agregar al historial
function addToHistory(result) {
    const detection = {
        id: Date.now(),
        ...result,
        timestamp: result.timestamp || new Date().toLocaleString('es-PE')
    };

    detections.unshift(detection);
    if (detections.length > 50) detections.pop();

    renderHistory();
}

// Renderizar historial
function renderHistory() {
    if (detections.length === 0) {
        historyList.innerHTML = '<p style="text-align: center; color: #999; padding: 20px;">No hay detecciones aún</p>';
        return;
    }

    historyList.innerHTML = detections.map(det => {
        const className = det.isCompliant ? 'compliant' : 'non-compliant';
        const status = det.isCompliant ? '✓ Uniforme Correcto' : '✗ Uniforme Incorrecto';
        return `
                    <div class="history-item ${className}">
                        <div class="time">${det.timestamp}</div>
                        <div class="status">${status}</div>
                        <div style="font-size: 13px; color: #666; margin-top: 5px;">
                            ${det.uniform_type} - ${Math.round(det.confidence * 100)}% confianza
                        </div>
                    </div>
                `;
    }).join('');
}

// Actualizar estadísticas
function updateStats(isCompliant) {
    stats.total++;
    if (isCompliant) {
        stats.compliant++;
    } else {
        stats.nonCompliant++;
    }

    document.getElementById('statTotal').textContent = stats.total;
    document.getElementById('statCompliant').textContent = stats.compliant;
    document.getElementById('statNonCompliant').textContent = stats.nonCompliant;
}

// Disparar alerta visual y sonora
function triggerAlert() {
    alertModal.classList.add('active');
    alarmSound.play().catch(e => console.log('No se pudo reproducir el sonido'));

    setTimeout(() => {
        alertModal.classList.remove('active');
    }, 3000);
}

// Descargar reporte
function downloadReport() {
    if (detections.length === 0) {
        alert('No hay datos para generar el reporte');
        return;
    }

    const report = [
        '==============================================',
        'REPORTE DE CONTROL DE UNIFORMES',
        '==============================================',
        `Generado: ${new Date().toLocaleString('es-PE')}`,
        '',
        'ESTADÍSTICAS GENERALES:',
        `- Total de personas analizadas: ${stats.total}`,
        `- Uniformes correctos: ${stats.compliant}`,
        `- Incidencias (uniformes incorrectos): ${stats.nonCompliant}`,
        `- Tasa de cumplimiento: ${((stats.compliant / stats.total) * 100).toFixed(1)}%`,
        '',
        '==============================================',
        'REGISTRO DETALLADO DE DETECCIONES:',
        '==============================================',
        ''
    ];

    detections.forEach((det, index) => {
        const status = det.isCompliant ? 'CORRECTO' : 'INCIDENCIA';
        report.push(`${index + 1}. [${status}] ${det.timestamp}`);
        report.push(`   Uniforme: ${det.uniform_type}`);
        report.push(`   Confianza: ${Math.round(det.confidence * 100)}%`);
        report.push('');
    });

    const blob = new Blob([report.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reporte_uniformes_${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
}

// Event Listeners
btnStartCamera.addEventListener('click', startCamera);
btnStopCamera.addEventListener('click', stopCamera);
btnAnalyze.addEventListener('click', captureAndAnalyze);
btnUploadImage.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', handleFileUpload);
btnDownloadReport.addEventListener('click', downloadReport);

// Cerrar alerta al hacer clic
alertModal.addEventListener('click', () => {
    alertModal.classList.remove('active');
});
