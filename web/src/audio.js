export class Sound {
 constructor(){this.ctx=null;this.enabled=true;}
 async unlock(){try{this.ctx??=new (window.AudioContext||window.webkitAudioContext)();if(this.ctx.state==='suspended')await this.ctx.resume();}catch{}}
 tone(freq=440,duration=0.15,type='sine',volume=0.06){
  if(!this.enabled||!this.ctx||this.ctx.state!=='running')return;
  const o=this.ctx.createOscillator(),g=this.ctx.createGain(),t=this.ctx.currentTime;
  o.type=type;o.frequency.setValueAtTime(freq,t);g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(volume,t+0.015);g.gain.exponentialRampToValueAtTime(0.001,t+duration);
  o.connect(g);g.connect(this.ctx.destination);o.start(t);o.stop(t+duration+0.02);
 }
 click(){this.tone(700,.07,'sine',.035);}
 stage(){this.tone(520,.18);setTimeout(()=>this.tone(780,.2),130);}
 complete(){[392,494,587,784].forEach((f,i)=>setTimeout(()=>this.tone(f,.5,'sine',.045),i*160));}
}
