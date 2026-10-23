<?php declare(strict_types=1);
// Demo-only adapter: keep the shared app untouched, and fail closed if its hooks change.
function oplen_demo_projects_source(string $source): string {
    $patches = [
        'const viewRoutes={' => "const viewRoutes={projects:'proyectos',",
        'function hasAccess(target){' => "function hasAccess(target){if(target==='projects')return !!window.OplenProjects;",
        'const visible=admin&&' => "if(window.OplenProjects)primary.splice(1,0,['projects','Proyectos']);const visible=admin&&",
        "if(view==='operations')return" => "if(view==='projects')return window.OplenProjects.mount(document.querySelector('#content'),{user:data.user,readOnly:previewMode()});if(view==='operations')return",
        'function currentScreenLabel(){' => "function currentScreenLabel(){if(view==='projects')return 'Proyectos y tareas';",
        'const paths={home:' => "const paths={projects:'M3 4h7v16H3zM14 4h7v7h-7zM14 15h7v5h-7z',home:",
    ];
    foreach ($patches as $needle => $replacement) {
        if (substr_count($source, $needle) !== 1) return $source;
    }
    return strtr($source, $patches);
}
