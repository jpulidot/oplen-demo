<?php declare(strict_types=1);
require_once __DIR__.'/shared-app.php';
$sharedApp = oplen_demo_app_root();
$demoBackendHref = null;
foreach (['demo/backend.js', 'demo/demo/backend.js'] as $candidate) {
    if (is_file(__DIR__.'/'.$candidate)) { $demoBackendHref = $candidate; break; }
}
if ($demoBackendHref === null) {
    http_response_code(503);
    header('Content-Type: text/plain; charset=utf-8');
    exit('Faltan los datos ficticios del demo: sube demo/backend.js dentro de la carpeta del demo.');
}
$oplenDemoMode = true;
$companyName = 'Oplen · Demo';
$faviconHref = 'assets/oplen-favicon.svg';
// Detect actual deployed content, even if an app change keeps its version string.
$fingerprint = hash_init('sha256');
hash_update_file($fingerprint, $sharedApp.'/frontend.php');
foreach (glob($sharedApp.'/assets/*') ?: [] as $asset) {
    if (is_file($asset) && preg_match('/\.(css|js|svg)$/D', $asset)) hash_update_file($fingerprint, $asset);
}
hash_update_file($fingerprint, __DIR__.'/'.$demoBackendHref);
$assetVersion = 'shared-'.substr(hash_final($fingerprint), 0, 16);
header('Cache-Control: no-store');
header("Content-Security-Policy: default-src 'self'; connect-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'");
ob_start();
require $sharedApp.'/frontend.php';
$frontendHtml = ob_get_clean();
// Keep the shared UI intact; resolve only the local mock script location.
echo str_replace('src="demo/backend.js?', 'src="'.htmlspecialchars($demoBackendHref, ENT_QUOTES, 'UTF-8').'?', $frontendHtml);
