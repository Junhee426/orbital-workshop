// Mission content and progression rules. IDs are persisted in save files.
export const PART_NAMES=Object.freeze({power:'전원부',drive:'전개부',brace:'고정점',latch:'래치',battery:'배터리',antenna:'안테나'});
export const CONTRACTS=Object.freeze({
 solar:Object.freeze({id:'solar',number:'01',title:'다시 펼쳐지는 날개',satellite:'METEO-07',description:'접힌 태양전지판의 원인을 진단하고 래치를 해제하세요.',prerequisite:null,scans:['power','drive'],answer:'latch',repairPart:'latch',repairName:'래치 해제',controlName:'토크 조절',range:[0.4,0.6],duration:3,baseReward:400,omega:0.006,voltage:'28.2 V · 정상',evidence:'전류 정상 / 패널 고정',diagnosis:'전압과 전류는 정상인데 패널이 움직이지 않습니다. 기계적인 고착을 찾아보세요.'}),
 battery:Object.freeze({id:'battery',number:'02',title:'밤을 건너는 전력',satellite:'AURORA-12',description:'충전을 유지하지 못하는 배터리 모듈을 교체하세요.',prerequisite:'solar',scans:['power','battery'],answer:'battery',repairPart:'battery',repairName:'배터리 교체',controlName:null,range:null,duration:4,baseReward:550,omega:0.012,voltage:'18.4 V · 저전압',evidence:'용량 12% / 셀 불균형',diagnosis:'발전은 정상이지만 배터리 전압과 저장 용량이 낮습니다. 전원 분리 후 모듈을 교체하세요.'}),
 antenna:Object.freeze({id:'antenna',number:'03',title:'멀어진 목소리',satellite:'RELAY-03',description:'회전하는 통신위성을 포획하고 안테나 지향을 복구하세요.',prerequisite:'battery',scans:['power','antenna'],answer:'antenna',repairPart:'antenna',repairName:'안테나 재정렬',controlName:'지향 조절',range:[0.67,0.77],duration:3.5,baseReward:700,omega:0.022,voltage:'28.2 V · 정상',evidence:'신호 8% / 지향 오차',diagnosis:'전력은 정상인데 수신 신호가 약합니다. 안테나 지향 오차를 보정하세요.'})
});
export const UPGRADES=Object.freeze({
 precision:{name:'정밀 추진기',cost:180,description:'미세 추력 · 강화된 제동'},
 efficiency:{name:'연료 회수 장치',cost:240,description:'추진·제동 연료 소비 35% 감소'},
 shield:{name:'충격 보호 프레임',cost:320,description:'충돌 시 선체 손상 50% 감소'}
});
export const contractFor=id=>Object.hasOwn(CONTRACTS,id)?CONTRACTS[id]:CONTRACTS.solar;
export const isUnlocked=(profile,id)=>Object.hasOwn(CONTRACTS,id)&&(!CONTRACTS[id].prerequisite||profile.completedContracts.includes(CONTRACTS[id].prerequisite));
export function availableParts(game){
 const config=contractFor(game.contractId);
 return {approach:[],survey:config.scans,diagnose:config.scans,isolate:['power'],brace:['brace'],release:[config.repairPart,'brace'],restore:['power'],test:[],complete:[]}[game.stage]??[];
}
export function repairIsSafe(game){const range=contractFor(game.contractId).range;return !range||(game.torque>=range[0]&&game.torque<=range[1]);}
export function repairHint(game){
 const c=contractFor(game.contractId);
 return `${PART_NAMES[c.repairPart]} 선택 → ${c.range?`${c.controlName} ${Math.round(c.range[0]*100)}–${Math.round(c.range[1]*100)}% → `:''}작업 버튼 또는 F 길게 누르기`;
}
