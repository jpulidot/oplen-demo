<?php declare(strict_types=1);
// Demo-only adapter: keep the shared app untouched, and fail closed if its hooks change.
function oplen_demo_projects_source(string $source): string {
    $patches = [
        'const viewRoutes={' => "const viewRoutes={projects:'proyectos',mywork:'mi-trabajo',",
        'function hasAccess(target){' => "function hasAccess(target){return ['home','projects','mywork','profile'].includes(target); ",
        'const visible=admin&&' => "primary.splice(0,primary.length,['projects','Proyectos'],['mywork','Mi trabajo']);const visible=admin&&",
        "if(view==='operations')return" => "if(['projects','mywork'].includes(view))return window.OplenProjects.mount(document.querySelector('#content'),{user:data.user,readOnly:previewMode(),personal:true,screen:view});if(view==='operations')return",
        'function currentScreenLabel(){' => "function currentScreenLabel(){if(view==='projects')return 'Proyectos';if(view==='mywork')return 'Mi trabajo';",
        'const paths={home:' => "const paths={projects:'M3 4h7v16H3zM14 4h7v7h-7zM14 15h7v5h-7z',home:",
    ];
    foreach ($patches as $needle => $replacement) {
        if (substr_count($source, $needle) !== 1) return $source;
    }
    // Personal shell: shared application files remain untouched.
    $personal = [
        "document.title=company.name+' OS'" => "document.title='Oplen · Espacio personal'",
        'id="open-search" aria-label="Buscar"' => 'id="open-search" aria-label="Abrir proyectos"',
        'function companyMark(){' => "function companyMark(){return 'O';",
        'function routeURL(next,mode=workspace){' => "function routeURL(next,mode=workspace){mode='collaborator';",
        "if(view==='home')return adminMode()?renderAdminHome():renderOSHome();" => "if(view==='home')return window.OplenProjects.mount(document.querySelector('#content'),{user:data.user,readOnly:previewMode(),personal:true,screen:'home'});",
        "if(view==='profile')return renderProfile();" => "if(view==='profile')return window.OplenProjects.profile(document.querySelector('#content'),data.user);",
        "(data.user.role==='admin'||evaluationManager())&&!previewMode()?" => 'false?',
        '<b>${esc(company.name)} OS</b><small>Espacio de trabajo</small>' => '<b>Oplen</b><small>Espacio personal</small>',
        'Inicio de ${esc(company.name)} OS' => 'Inicio de Oplen personal',
        "document.querySelector('#open-search').addEventListener('click',showGlobalSearch)" => "document.querySelector('#open-search').addEventListener('click',()=>navigate('projects'))",
        '<button data-view="company">Empresa</button>' => '<button data-view="profile">Mi perfil</button>',
    ];
    foreach ($personal as $needle => $replacement) {
        if (substr_count($source, $needle) !== 1) return $source;
    }
    return strtr(strtr($source, $patches), $personal);
}
