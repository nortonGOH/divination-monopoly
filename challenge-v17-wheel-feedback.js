/* v17 - post-verification wheel feedback, accessible reduced-motion fallback. */
(() => {
'use strict';
const wheel=document.getElementById('skyWheel');
const center=document.getElementById('polaris-layer');
const star=document.getElementById('polaris-trigger');
if(!wheel||!center||!star)return;
const style=document.createElement('style');
style.textContent=`
#skyWheel #polaris-layer{transition:filter .3s ease}
#skyWheel.quiz-answer-wrong #polaris-layer circle{fill:#f34444!important;stroke:#ff8f8f!important;opacity:1!important}
#skyWheel.quiz-answer-wrong #polaris-layer path{stroke:#ff6363!important;opacity:1!important}
#skyWheel.quiz-answer-wrong #polaris-layer{filter:drop-shadow(0 0 15px #ff2626) drop-shadow(0 0 28px #d92828)}
#skyWheel.quiz-answer-wrong #polaris-trigger circle{stroke:#fa4444;stroke-opacity:1;fill:#c42121;fill-opacity:.13}
#skyWheel.quiz-answer-correct #polaris-layer{filter:drop-shadow(0 0 15px #e3faff) drop-shadow(0 0 29px #95dfff)}
#skyWheel.quiz-answer-correct #polaris-layer circle{fill:#efffff!important;stroke:#b2f4ff!important;opacity:1!important}
#skyWheel.quiz-answer-correct #polaris-layer path{stroke:#e1ffff!important;opacity:1!important}
#skyWheel.quiz-answer-correct #polaris-layer .quiz-star-sparkles{animation:quiz-star-sparkle 1.2s ease-in-out infinite alternate;transform-origin:500px 500px}
@keyframes quiz-star-sparkle{0%{opacity:.45;transform:scale(.85) rotate(-8deg)}100%{opacity:1;transform:scale(1.17) rotate(8deg)}}
@media(prefers-reduced-motion:reduce){#skyWheel.quiz-answer-correct #polaris-layer .quiz-star-sparkles{animation:none;opacity:1}}
`;
document.head.append(style);
const svgns='http://www.w3.org/2000/svg';
const sparks=document.createElementNS(svgns,'g');sparks.classList.add('quiz-star-sparkles');
sparks.setAttribute('pointer-events','none');
const segments=['M500 457 L503 484 L500 477 L497 484 Z','M500 543 L503 516 L500 523 L497 516 Z',
'M457 500 L484 497 L477 500 L484 503 Z','M543 500 L516 497 L523 500 L516 503 Z',
'M470 470 L487 487 L481 481 L487 487 Z','M530 470 L513 487 L519 481 L513 487 Z',
'M470 530 L487 513 L481 519 L487 513 Z','M530 530 L513 513 L519 519 L513 513 Z'];
for(const d of segments){const p=document.createElementNS(svgns,'path');p.setAttribute('d',d);p.setAttribute('fill','#fff0b8');p.setAttribute('stroke','#fff8e7');p.setAttribute('stroke-width','2.5');p.setAttribute('stroke-linejoin','round');sparks.append(p);}
center.append(sparks);
sparks.setAttribute('opacity','0');
const reset=()=>{
  wheel.classList.remove('quiz-answer-wrong','quiz-answer-correct');
  sparks.setAttribute('opacity','0');
};
const begin=()=>{if(typeof spinning!=='undefined'&&spinning)return;reset();};
window.addEventListener('quiz-answer-graded',event=>{
  reset();
  if(event.detail?.correct===true){wheel.classList.add('quiz-answer-correct');sparks.setAttribute('opacity','1');}
  else if(event.detail?.correct===false){wheel.classList.add('quiz-answer-wrong');}
});
for(const button of [document.getElementById('spinBtn'),star]){
 if(!button)continue;
 button.addEventListener('click',begin,true);
 button.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' ')begin();},true);
}
})();