const screens=[...document.querySelectorAll('.screen')];
let stream=null,facing='environment',timer=null,seconds=0;
let cvReady=false, detector=null, targetGray=null, targetKp=null, targetDesc=null, targetImage=null;
let detecting=false, lastDetection=0, stableHits=0, lostHits=0;

function go(id){screens.forEach(s=>s.classList.toggle('active',s.id===id));window.scrollTo(0,0);if(id==='camera')startAR();else stopCamera();}
document.querySelectorAll('[data-go]').forEach(b=>b.addEventListener('click',()=>go(b.dataset.go)));

window.addEventListener('opencv-ready',()=>{cvReady=true;});
async function waitForCV(){
  const started=Date.now();
  while(!window.cv || !cvReady || typeof cv.Mat==='undefined'){
    if(Date.now()-started>20000) throw new Error('OpenCV no disponible');
    await new Promise(r=>setTimeout(r,200));
  }
}
async function prepareTarget(){
  await waitForCV();
  if(targetDesc) return;
  targetImage=new Image();
  targetImage.src='assets/cruz-del-posito-target.jpg';
  await new Promise((res,rej)=>{targetImage.onload=res;targetImage.onerror=rej;});
  const c=document.createElement('canvas'); c.width=targetImage.naturalWidth;c.height=targetImage.naturalHeight;
  c.getContext('2d').drawImage(targetImage,0,0);
  const mat=cv.imread(c), gray=new cv.Mat();
  cv.cvtColor(mat,gray,cv.COLOR_RGBA2GRAY);
  targetGray=gray;
  detector=new cv.ORB(700);
  targetKp=new cv.KeyPointVector(); targetDesc=new cv.Mat();
  detector.detectAndCompute(targetGray,new cv.Mat(),targetKp,targetDesc);
  mat.delete();
}
async function startAR(){
  const status=document.getElementById('cameraStatus'), pill=document.getElementById('recognitionStatus');
  pill.textContent='Preparando reconocimiento…';
  try{
    await prepareTarget();
    if(!navigator.mediaDevices?.getUserMedia) throw new Error('Cámara no disponible');
    stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:facing}},audio:false});
    const video=document.getElementById('cameraVideo'); video.srcObject=stream; await video.play();
    status.textContent='Apunta a la Cruz. El reconocimiento es automático.';
    pill.textContent='● Buscando imagen';
    detecting=true; requestAnimationFrame(detectionLoop);
  }catch(e){
    pill.textContent='Reconocimiento no disponible';
    status.textContent='Necesitas HTTPS (o localhost), permiso de cámara y conexión para cargar OpenCV.js.';
    console.error(e);
  }
}
function stopCamera(){
  detecting=false;
  if(stream){stream.getTracks().forEach(t=>t.stop());stream=null;}
  document.getElementById('arPanel').classList.add('hidden');
  document.getElementById('arFloat').classList.add('hidden');
  const ctx=document.getElementById('arCanvas').getContext('2d');ctx.clearRect(0,0,innerWidth,innerHeight);
}
document.getElementById('switchCamera').onclick=async()=>{facing=facing==='environment'?'user':'environment';stopCamera();await startAR();};

function detectionLoop(ts){
  if(!detecting) return;
  if(ts-lastDetection<650){requestAnimationFrame(detectionLoop);return;}
  lastDetection=ts;
  const video=document.getElementById('cameraVideo');
  if(video.readyState>=2 && video.videoWidth) detectFrame(video);
  requestAnimationFrame(detectionLoop);
}
function detectFrame(video){
  const canvas=document.getElementById('frameCanvas');
  const maxW=720, scale=Math.min(1,maxW/video.videoWidth);
  canvas.width=Math.round(video.videoWidth*scale);canvas.height=Math.round(video.videoHeight*scale);
  canvas.getContext('2d').drawImage(video,0,0,canvas.width,canvas.height);
  const frame=cv.imread(canvas), gray=new cv.Mat();
  cv.cvtColor(frame,gray,cv.COLOR_RGBA2GRAY);
  const kp=new cv.KeyPointVector(), desc=new cv.Mat();
  detector.detectAndCompute(gray,new cv.Mat(),kp,desc);
  if(desc.empty()){gray.delete();frame.delete();kp.delete();desc.delete();registerLost();return;}
  const matcher=new cv.BFMatcher(cv.NORM_HAMMING,true), matches=new cv.DMatchVector();
  matcher.match(targetDesc,desc,matches);
  const arr=[];for(let i=0;i<matches.size();i++)arr.push(matches.get(i).distance);
  arr.sort((a,b)=>a-b);
  const good=arr.filter((d,i)=>i<80 && d<55).length;
  let detected=false, corners=null;
  if(good>=12){
    const srcPts=[],dstPts=[];
    for(let i=0;i<matches.size();i++){
      const m=matches.get(i);
      if(m.distance<55){
        const a=targetKp.get(m.queryIdx).pt,b=kp.get(m.trainIdx).pt;
        srcPts.push(a.x,a.y);dstPts.push(b.x,b.y);
      }
    }
    if(srcPts.length>=24){
      const src=cv.matFromArray(srcPts.length/2,1,cv.CV_32FC2,srcPts);
      const dst=cv.matFromArray(dstPts.length/2,1,cv.CV_32FC2,dstPts);
      const mask=new cv.Mat();const H=cv.findHomography(src,dst,cv.RANSAC,5,mask);
      const inliers=H.empty()?0:cv.countNonZero(mask);
      detected=inliers>=10;
      if(detected){
        const tw=targetGray.cols,th=targetGray.rows;
        const cp=cv.matFromArray(4,1,cv.CV_32FC2,[0,0,tw,0,tw,th,0,th]);
        const out=new cv.Mat();cv.perspectiveTransform(cp,out,H);
        corners=[];for(let i=0;i<4;i++)corners.push({x:out.data32F[i*2]/scale,y:out.data32F[i*2+1]/scale});
        out.delete();cp.delete();
      }
      src.delete();dst.delete();mask.delete();H.delete();
    }
  }
  matcher.delete();matches.delete();gray.delete();frame.delete();kp.delete();desc.delete();
  if(detected) registerHit(corners); else registerLost();
}
function registerHit(corners){
  stableHits++;lostHits=0;
  if(stableHits>=2){showAR(corners);}
}
function registerLost(){
  lostHits++;stableHits=Math.max(0,stableHits-1);
  if(lostHits>=3){hideAR();}
}
function showAR(c){
  document.getElementById('recognitionStatus').textContent='✓ Cruz reconocida';
  document.getElementById('targetMessage').textContent='✓ Imagen reconocida';
  document.getElementById('arPanel').classList.remove('hidden');
  const cx=c.reduce((s,p)=>s+p.x,0)/4, cy=c.reduce((s,p)=>s+p.y,0)/4;
  const f=document.getElementById('arFloat');f.classList.remove('hidden');
  f.style.left=Math.max(10,Math.min(innerWidth-220,cx-100))+'px';
  f.style.top=Math.max(90,Math.min(innerHeight-150,cy-75))+'px';
  drawPolygon(c);
}
function hideAR(){
  document.getElementById('recognitionStatus').textContent='● Buscando imagen';
  document.getElementById('targetMessage').textContent='Buscando la Cruz del Pósito…';
  document.getElementById('arPanel').classList.add('hidden');
  document.getElementById('arFloat').classList.add('hidden');
  const ctx=document.getElementById('arCanvas').getContext('2d');ctx.clearRect(0,0,innerWidth,innerHeight);
}
function drawPolygon(c){
  const canvas=document.getElementById('arCanvas');canvas.width=innerWidth;canvas.height=innerHeight;
  const ctx=canvas.getContext('2d');ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.beginPath();ctx.moveTo(c[0].x,c[0].y);for(let i=1;i<4;i++)ctx.lineTo(c[i].x,c[i].y);ctx.closePath();
  ctx.fillStyle='rgba(125,225,177,.08)';ctx.fill();ctx.strokeStyle='rgba(170,255,214,.95)';ctx.lineWidth=3;ctx.stroke();
}

document.getElementById('closeAr').onclick=()=>document.getElementById('arPanel').classList.add('hidden');
const dlg=document.getElementById('helpDialog');document.getElementById('helpBtn').onclick=()=>dlg.showModal();document.getElementById('closeHelp').onclick=()=>dlg.close();
document.getElementById('playAudio').onclick=()=>{if(timer){clearInterval(timer);timer=null;document.getElementById('playAudio').textContent='▶';return}document.getElementById('playAudio').textContent='Ⅱ';timer=setInterval(()=>{seconds++;document.getElementById('audioProgress').value=seconds;document.getElementById('currentTime').textContent=fmt(seconds);if(seconds>=165){clearInterval(timer);timer=null}},1000)};
document.getElementById('audioProgress').oninput=e=>{seconds=+e.target.value;document.getElementById('currentTime').textContent=fmt(seconds)};
function fmt(s){return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0')}
go('inicio');
