<?php
// Simple PHP proxy to forward processing requests to a remote backend.
// Configure $BACKEND_URL to the full base URL of your running backend (e.g. https://example.com)
$BACKEND_URL = '';

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if (empty($BACKEND_URL)) {
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'No backend configured in process_proxy.php']);
    exit;
}

$target = rtrim($BACKEND_URL, '/') . '/process';

$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $target);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HEADER, true);
curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);

// Forward POST fields. For file uploads we'd need to forward multipart; the frontend currently sends videoUrl and fps.
$postFields = [];
if (isset($_POST['videoUrl'])) $postFields['videoUrl'] = $_POST['videoUrl'];
if (isset($_POST['fps'])) $postFields['fps'] = $_POST['fps'];

curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, $postFields);

$response = curl_exec($ch);
if ($response === false) {
    http_response_code(502);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Failed to contact backend', 'details' => curl_error($ch)]);
    curl_close($ch);
    exit;
}

$header_size = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
$header = substr($response, 0, $header_size);
$body = substr($response, $header_size);
$http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

// Forward some headers
foreach (explode("\r\n", $header) as $hline) {
    if (stripos($hline, 'Content-Type:') === 0) header($hline);
    if (stripos($hline, 'Content-Length:') === 0) header($hline);
}

http_response_code($http_code);
echo $body;

?>
