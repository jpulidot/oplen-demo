<?php declare(strict_types=1);
require dirname(__DIR__).'/demo/projects-bridge.php';
// Synthetic shell boundary; integration also checked against deployed app V1.58.0.
$source = <<<'JS'
const viewRoutes={home:'inicio'};
function hasAccess(target){return true}
function navigation(){const visible=admin&&data.user.role!=='admin'?primary.filter(Boolean):primary;}
function render(){if(view==='operations')return renderOperations();}
function currentScreenLabel(){return 'Inicio'}
function icon(){const paths={home:'M3 10'};return paths;}
JS;
$patched = oplen_demo_projects_source($source);
if ($patched === $source || !str_contains($patched,"projects:'proyectos'") || !str_contains($patched,'window.OplenProjects.mount')) throw new RuntimeException('Module route was not installed');
if (oplen_demo_projects_source('unknown app source') !== 'unknown app source') throw new RuntimeException('Unknown source must remain intact');
if (oplen_demo_projects_source($patched) !== $patched) throw new RuntimeException('Adapter must not double-patch');
$missing = str_replace('function currentScreenLabel(){','function label(){',$source);
if (oplen_demo_projects_source($missing) !== $missing) throw new RuntimeException('Partial integration must fail closed');
echo "PASS: demo route adapter, fail-closed fallback, idempotence\n";
