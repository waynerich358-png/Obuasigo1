const fs=require('fs');const path=require('path');
const root=path.join(__dirname,'public');
const required=['privacy.html','terms.html','refunds.html','cookies.html','404.html','robots.txt','sitemap.xml','security.txt','launch.js','launch.css','og-image.jpg','favicon-512.png','obuasigo-icon.png','obuasigo-icon.webp','obuasigo-flyer.webp','manifest.webmanifest'];
let ok=true;for(const f of required){const exists=fs.existsSync(path.join(root,f));console.log(`${exists?'PASS':'FAIL'} ${f}`);if(!exists)ok=false}
const html=fs.readdirSync(root).filter(f=>f.endsWith('.html')).map(f=>fs.readFileSync(path.join(root,f),'utf8')).join('\n');
for(const check of [
 ['privacy link',html.includes('href="/privacy"')||html.includes('/privacy')||fs.readFileSync(path.join(root,'launch.js'),'utf8').includes('/privacy')],
 ['terms link',html.includes('href="/terms"')||html.includes('/terms')||fs.readFileSync(path.join(root,'launch.js'),'utf8').includes('/terms')],
 ['launch.js',html.includes('src="/launch.js"')],
 ['launch.css',html.includes('href="/launch.css"')],
 ['alt text on logo',!/<img src="\/obuasigo-icon\.png">/.test(html)],
 ['meta description on customer',fs.readFileSync(path.join(root,'index.html'),'utf8').includes('name="description"')],
]){console.log(`${check[1]?'PASS':'FAIL'} ${check[0]}`);if(!check[1])ok=false}
console.log(ok?'\nLaunch audit: PASS (static checks).':'\nLaunch audit: FAIL (fix the items above).');process.exit(ok?0:1);
