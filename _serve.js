const http=require('http'),fs=require('fs'),path=require('path'),url=require('url');
const root=process.argv[2],port=+process.argv[3];
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.ico':'image/x-icon'};
http.createServer((req,res)=>{
  let p=decodeURIComponent(url.parse(req.url).pathname);
  if(p.endsWith('/')) p+='index.html';
  const f=path.join(root,p);
  if(!f.startsWith(root)){res.writeHead(403);return res.end('forbidden');}
  fs.readFile(f,(e,d)=>{
    if(e){res.writeHead(404);return res.end('404 '+p);}
    res.writeHead(200,{'Content-Type':mime[path.extname(f).toLowerCase()]||'application/octet-stream'});
    res.end(d);
  });
}).listen(port,'0.0.0.0',()=>console.log('serving '+root+' on '+port));