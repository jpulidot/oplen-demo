<?php
$requestPath = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
if (str_starts_with($requestPath, '/assets/')) {
    $_GET['file'] = substr($requestPath, 8);
    require dirname(__DIR__).'/asset.php';
    return true;
}
if (str_starts_with($requestPath, '/api')) { http_response_code(404); return true; }
return false;
