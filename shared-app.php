<?php declare(strict_types=1);
// Only filesystem code is shared. Never load installation.php or tenant config.
function oplen_demo_app_candidates(string $demoDirectory): array {
    $configured = getenv('OPLEN_SHARED_APP_ROOT');
    if ($configured !== false && $configured !== '') return [$configured];
    $candidates = [$demoDirectory.'/../app'];
    $directory = $demoDirectory;
    for ($level = 0; $level < 6; $level++) {
        if (basename($directory) === 'domains') {
            $candidates[] = $directory.'/oplen.io/public_html/app';
            break;
        }
        $parent = dirname($directory);
        if ($parent === $directory) break;
        $directory = $parent;
    }
    return array_unique($candidates);
}
function oplen_demo_app_root(): string {
    $missingTemplate = false;
    foreach (oplen_demo_app_candidates(__DIR__) as $root) {
        $real = realpath($root);
        if ($real === false || !is_dir($real.'/assets')) continue;
        if (is_file($real.'/frontend.php')) return $real;
        $missingTemplate = true;
    }
    http_response_code(503);
    header('Content-Type: text/plain; charset=utf-8');
    exit($missingTemplate
        ? 'Falta frontend.php en la carpeta de la app. Sube primero los archivos de app/ del paquete compartido.'
        : 'No se encontró la app compartida. Configura OPLEN_SHARED_APP_ROOT con la ruta absoluta de la app.');
}
