<?php declare(strict_types=1);
require_once __DIR__.'/shared-app.php';
$sharedApp = oplen_demo_app_root();
$oplenDemoMode = true;
$companyName = 'Oplen · Demo';
$faviconHref = 'assets/oplen-favicon.svg';
// Detect actual deployed content, even if an app change keeps its version string.
$fingerprint = hash_init('sha256');
hash_update_file($fingerprint, $sharedApp.'/frontend.php');
foreach (glob($sharedApp.'/assets/*') ?: [] as $asset) {
    if (is_file($asset) && preg_match('/\.(css|js|svg)$/D', $asset)) hash_update_file($fingerprint, $asset);
}
hash_update_file($fingerprint, __DIR__.'/demo/backend.js');
$assetVersion = 'shared-'.substr(hash_final($fingerprint), 0, 16);
header('Cache-Control: no-store');
header("Content-Security-Policy: default-src 'self'; connect-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'");
require $sharedApp.'/frontend.php';
