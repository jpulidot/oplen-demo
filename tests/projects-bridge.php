<?php declare(strict_types=1);
require dirname(__DIR__).'/demo/projects-bridge.php';
// Synthetic shell boundary; integration also checked against deployed app V1.58.0.
$source = <<<'JS'
const viewRoutes={home:'inicio'};
function hasAccess(target){return true}
function navigation(){const visible=admin&&data.user.role!=='admin'?primary.filter(Boolean):primary;}
function render(){if(view==='operations')return renderOperations();}
function currentScreenLabel(){return 'Inicio'}
function companyMark(){return 'H';}
function routeURL(next,mode=workspace){return next;}
if(view==='home')return adminMode()?renderAdminHome():renderOSHome();
if(view==='profile')return renderProfile();
(data.user.role==='admin'||evaluationManager())&&!previewMode()?1:0;
document.title=company.name+' OS';
document.querySelector('#open-search').addEventListener('click',showGlobalSearch);
const markup=`<b>${esc(company.name)} OS</b><small>Espacio de trabajo</small><button aria-label="Inicio de ${esc(company.name)} OS"></button><button data-view="company">Empresa</button><button id="open-search" aria-label="Buscar"></button>`;
function icon(){const paths={home:'M3 10'};return paths;}
JS;
$patched = oplen_demo_projects_source($source);
if ($patched === $source || !str_contains($patched,"projects:'proyectos'") || !str_contains($patched,'window.OplenPersonal.mount')) throw new RuntimeException('Module route was not installed');
if (oplen_demo_projects_source('unknown app source') !== 'unknown app source') throw new RuntimeException('Unknown source must remain intact');
if (oplen_demo_projects_source($patched) !== $patched) throw new RuntimeException('Adapter must not double-patch');
$missing = str_replace('function currentScreenLabel(){','function label(){',$source);
if (oplen_demo_projects_source($missing) !== $missing) throw new RuntimeException('Partial integration must fail closed');
if (!str_contains($patched,"mywork:'mi-trabajo'") || !str_contains($patched,"screen:'home'") || !str_contains($patched,'Espacio personal')) throw new RuntimeException('Personal navigation missing');
$missingPersonal = str_replace('function routeURL(next,mode=workspace){','function changedRoute(){',$source);
if (oplen_demo_projects_source($missingPersonal) !== $missingPersonal) throw new RuntimeException('Partial personal shell must fail closed');
echo "PASS: demo route adapter, fail-closed fallback, idempotence\n";
