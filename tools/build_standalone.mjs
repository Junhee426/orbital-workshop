// Development-only packager. The resulting PLAY.html needs no server or installer.
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const {build}=await import(process.env.ESBUILD_MODULE||'esbuild');
const root=fileURLToPath(new URL('../',import.meta.url));
const result=await build({entryPoints:[`${root}web/src/main.js`],bundle:true,format:'iife',target:'es2020',minify:true,write:false,legalComments:'inline'});
let css=await readFile(`${root}web/style.css`,'utf8');
for(const name of ['Regular','SemiBold']){
 const bytes=await readFile(`${root}web/fonts/Pretendard-${name}.woff2`);
 css=css.replace(`./fonts/Pretendard-${name}.woff2`,`data:font/woff2;base64,${bytes.toString('base64')}`);
}
let html=await readFile(`${root}web/index.html`,'utf8');
html=html.replace('<link rel="stylesheet" href="style.css">',`<style>${css}</style>`);
const js=result.outputFiles[0].text.replace(/<\/script/gi,'<\\/script');
html=html.replace(/<script type="module">[\s\S]*?<\/script>/,()=>`<script>try{${js}}catch(error){console.error(error);document.getElementById('boot').innerHTML='<h2>게임을 열지 못했습니다.</h2><p>WebGL 2를 지원하는 브라우저에서 열어 주세요.</p>';}</script>`);
await writeFile(`${root}PLAY.html`,html);
console.log(`PLAY.html created (${Buffer.byteLength(html)} bytes)`);
