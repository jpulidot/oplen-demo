<?php declare(strict_types=1);
require_once __DIR__.'/shared-app.php';
$name = (string)($_GET['file'] ?? '');
if (!preg_match('/^[a-zA-Z0-9_-]+\.(css|js|svg)$/D', $name)) { http_response_code(404); exit; }
$directory = oplen_demo_app_root().'/assets';
$file = realpath($directory.'/'.$name);
if ($file === false || dirname($file) !== $directory || !is_file($file)) { http_response_code(404); exit; }
$types = ['css'=>'text/css', 'js'=>'application/javascript', 'svg'=>'image/svg+xml'];
header('Content-Type: '.$types[pathinfo($name, PATHINFO_EXTENSION)].'; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-cache');
$etag = '"'.hash_file('sha256', $file).'"';
header('ETag: '.$etag);
if (($_SERVER['HTTP_IF_NONE_MATCH'] ?? '') === $etag) { http_response_code(304); exit; }
readfile($file);
