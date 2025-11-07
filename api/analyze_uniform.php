<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json; charset=utf-8');

// Preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Metodo invalido
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Metodo no permitido']);
    exit();
}

// CONFIGURACION

define('PYTHON_EXECUTABLE', 'python3');
define('PYTHON_SCRIPT', realpath(__DIR__ . '/../detect_uniform.py'));
define('TEMP_DIR', __DIR__ . '/temp/');

if (!file_exists(TEMP_DIR)) {
    mkdir(TEMP_DIR, 0755, true);
}

// Limpieza ocasional
if (rand(1, 100) === 1) cleanOldTempFiles();

try {
    if (!file_exists(PYTHON_SCRIPT)) {
        throw new Exception('Modelo no disponible');
    }

    if (!isset($_FILES['image']) || $_FILES['image']['error'] !== UPLOAD_ERR_OK) {
        throw new Exception('No se recibio ninguna imagen valida');
    }

    $file = $_FILES['image'];

    // Validar tipo
    $finfo = finfo_open(FILEINFO_MIME_TYPE);
    $mimeType = finfo_file($finfo, $file['tmp_name']);
    finfo_close($finfo);
    $allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    if (!in_array($mimeType, $allowedTypes)) {
        throw new Exception('Tipo de archivo no permitido');
    }

    // Validar tamaño
    if ($file['size'] > 10 * 1024 * 1024) {
        throw new Exception('La imagen es demasiado grande');
    }

    // Guardar temporal
    $ext = pathinfo($file['name'], PATHINFO_EXTENSION);
    $filename = uniqid('uniform_', true) . '.' . $ext;
    $filepath = TEMP_DIR . $filename;

    if (!move_uploaded_file($file['tmp_name'], $filepath)) {
        throw new Exception('Error al guardar la imagen temporal');
    }

    // Ejecutar modelo
    $command = sprintf('%s %s %s',
        escapeshellcmd(PYTHON_EXECUTABLE),
        escapeshellarg(PYTHON_SCRIPT),
        escapeshellarg($filepath)
    );

    $output = shell_exec($command . ' 2>&1');
    $result = json_decode($output, true);

    if (json_last_error() !== JSON_ERROR_NONE) {
        throw new Exception('Error en salida del modelo: ' . trim($output));
    }

    // Respuesta final
    $response = [
        'success' => true,
        'isCompliant' => $result['isCompliant'] ?? false,
        'confidence' => $result['confidence'] ?? 0.0,
        'uniform_type' => $result['uniform_type'] ?? 'Desconocido',
        'timestamp' => date('Y-m-d H:i:s')
    ];

    if (file_exists($filepath)) unlink($filepath);

    echo json_encode($response, JSON_PRETTY_PRINT);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ], JSON_PRETTY_PRINT);

    if (isset($filepath) && file_exists($filepath)) {
        unlink($filepath);
    }
}

// Funciones Extras

function saveToDatabase($data) {
    try {
        $pdo = new PDO('mysql:host=localhost;dbname=uniformes;charset=utf8', 'usuario', 'password', [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION
        ]);

        $stmt = $pdo->prepare("
            INSERT INTO detecciones (is_compliant, confidence, uniform_type, timestamp)
            VALUES (?, ?, ?, ?)
        ");
        $stmt->execute([
            $data['isCompliant'] ? 1 : 0,
            $data['confidence'],
            $data['uniform_type'],
            $data['timestamp']
        ]);
    } catch (PDOException $e) {
        error_log('Error al guardar en BD: ' . $e->getMessage());
    }
}

function cleanOldTempFiles() {
    foreach (glob(TEMP_DIR . '*') as $file) {
        if (is_file($file) && time() - filemtime($file) >= 3600) {
            unlink($file);
        }
    }
}
?>
