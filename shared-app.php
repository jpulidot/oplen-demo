<?php declare(strict_types=1);
// Only filesystem code is shared. Never load installation.php or tenant config.
function oplen_demo_app_root(): string {
    $root = getenv('OPLEN_SHARED_APP_ROOT') ?: __DIR__.'/../app';
    $real = realpath($root);
    if ($real === false || !is_file($real.'/frontend.php') || !is_dir($real.'/assets')) {
        http_response_code(503);
        header('Content-Type: text/plain; charset=utf-8');
        exit('El demo necesita la plantilla compartida de Oplen. Revisa OPLEN_SHARED_APP_ROOT.');
    }
    return $real;
}
