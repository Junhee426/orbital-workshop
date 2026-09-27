// Development-only packager. Both games run offline without an installer.
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const {build}=await import(process.env.ESBUILD_MODULE||'esbuild');
const root=fileURLToPath(new URL('../',import.meta.url));
for(const mode of [
 {entry:'main',page:'index',style:'style',output:'PLAY'},
 {entry:'surface-main',page:'surface',style:'surface',output:'SURFACE'}
]){
 const result=await build({entryPoints:[`${root}web/src/${mode.entry}.js`],bundle:true,format:'iife',target:'es2020',minify:true,write:false,legalComments:'inline'});
 let css=await readFile(`${root}web/${mode.style}.css`,'utf8');
 for(const name of ['Regular','SemiBold']){
  const bytes=await readFile(`${root}web/fonts/Pretendard-${name}.woff2`);
  css=css.replace(`./fonts/Pretendard-${name}.woff2`,`data:font/woff2;base64,${bytes.toString('base64')}`);
 }
 let html=await readFile(`${root}web/${mode.page}.html`,'utf8');
 html=html.replace(`<link rel="stylesheet" href="${mode.style}.css">`,`<style>${css}</style>`);
 html=html.replaceAll('href="surface.html"','href="SURFACE.html"').replaceAll('href="index.html"','href="PLAY.html"');
 const js=result.outputFiles[0].text.replace(/<\/script/gi,'<\\/script');
 html=html.replace(/<script type="module">[\s\S]*?<\/script>/,()=>`<script>try{${js}}catch(error){console.error(error);document.getElementById('boot').textContent='WebGL 2를 지원하는 브라우저에서 다시 열어주세요.';}</script>`);
 // Bundled shader strings contain insignificant trailing spaces.
 html=html.replace(/[ \t]+$/gm,'');
 await writeFile(`${root}${mode.output}.html`,html);
 console.log(`${mode.output}.html created (${Buffer.byteLength(html)} bytes)`);
}
