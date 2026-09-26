import {contractFor,PART_NAMES,repairHint} from './contracts.js';
export function tutorialFor(game){
 const config=contractFor(game.contractId);
 if(game.stage==='approach'){
  if(!game.tutorial.moved)return {title:'1 / 3 · 짧게 추진하기',text:'W 또는 화면의 전진 버튼을 잠깐 누르세요. 놓아도 관성으로 계속 이동합니다.'};
  if(!game.tutorial.braked)return {title:'2 / 3 · 제동 연습',text:'Space 또는 제동 버튼을 누르세요. 회전하는 결합부의 속도에 맞춰 감속합니다.'};
  return {title:'3 / 3 · 안전하게 포획',text:'거리·속도·방향이 모두 녹색이면 F 또는 포획 시도를 누르세요. 미세 모드로 마지막 위치를 조절할 수 있습니다.'};
 }
 const hints={
  survey:`${config.scans.map(id=>PART_NAMES[id]).join('와 ')}를 차례로 선택하고 스캔하세요. 아래 부품 버튼으로도 선택할 수 있습니다.`,
  diagnose:'측정된 전압과 고장 증상을 비교한 뒤 원인을 선택하세요. 잘못 선택해도 다시 시도할 수 있습니다.',
  isolate:'전원부를 선택해 전원을 분리하세요. 전원이 연결된 동안에는 수리할 수 없습니다.',
  brace:'고정점을 선택하고 작업 팔로 위성을 지지하세요.',release:repairHint(game),
  restore:'전원부를 선택해 전원을 다시 연결하세요.',test:'작동 시험을 시작하고 전력과 신호가 회복되는 것을 확인하세요.',complete:'정비소에서 새 의뢰와 장비를 확인하세요.'
 };
 return {title:'정비 실습 안내',text:hints[game.stage]};
}
