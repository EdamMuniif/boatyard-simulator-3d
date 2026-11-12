import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = filename => readFileSync(new URL(filename, import.meta.url), 'utf8');
const html = read('./index.html');
const css = read('./responsive-ui.css');
const game = read('./main.js');

test('every new UI control has one unique ID and a real event handler', () => {
  const ids=['hudPause','hudHelp','helpFromStart','helpFromPause','helpScreen',
    'closeHelp','missionDetailsToggle','mapToggle','missionPanel','minimap',
    'touchAction','touchBrake','touchTurnLeft','touchTurnRight'];
  const matches=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
  assert.equal(matches.length,new Set(matches).size,'duplicate HTML ids');
  for(const id of ids)assert.equal(matches.filter(name=>name===id).length,1,id);
  for(const name of ['hudPause','hudHelp','closeHelp','missionDetailsToggle','mapToggle']){
    assert.match(game,new RegExp(name));
  }
});
test('mobile controls and accessible viewport defaults are retained',()=>{
  assert.doesNotMatch(html,/user-scalable=no/i);
  assert.match(html,/viewport-fit=cover/);
  assert.match(html,/responsive-ui\.css/);
  assert.match(html,/role="dialog" aria-modal="true"/);
  assert.match(html,/aria-expanded="true"/);
  assert.match(html,/id="joystick"/);
  assert.match(html,/id="touchRaise"/);
  assert.match(html,/id="touchLower"/);
  assert.match(html,/id="recoverButton"/);
});
test('safe-area, tablet, phone and landscape rules exist',()=>{
  assert.match(css,/safe-area-inset-(top|bottom)/);
  assert.match(css,/@media\(max-width:700px\),\(pointer:coarse\)/);
  assert.match(css,/@media\(max-width:430px\)/);
  assert.match(css,/@media\(max-height:510px\) and \(orientation:landscape\)/);
  assert.match(css,/\.hoist-turn-controls/);
  assert.match(css,/\.map-wrap\.is-collapsed/);
  assert.match(css,/\.mission-panel\.is-compact/);
  assert.match(css,/min-height:4[4-9]px/);
});
test('help pauses and restores game state, responsive preferences can toggle',()=>{
  assert.match(game,/this\.wasPausedBeforeHelp=this\.paused/);
  assert.match(game,/this\.paused=this\.wasPausedBeforeHelp/);
  assert.match(game,/if\(this\.helpOpen\)/);
  assert.match(game,/setMissionDetails\(/);
  assert.match(game,/setMapExpanded\(/);
  assert.match(game,/this\.compactScreen=window\.matchMedia/);
  assert.match(game,/this\.clearTransientInput\(\)/);
});
test('contextual action labels and mission-phase lift disabling are enforced',()=>{
  assert.match(game,/DISPATCH:'BOARD',SAIL:'SECURE',BOARD_HOIST:'ENTER',POSITION:'ATTACH'/);
  assert.match(game,/\$\('touchRaise'\)\.disabled=this\.phaseId!=='LIFT'/);
  assert.match(game,/\$\('touchLower'\)\.disabled=this\.phaseId!=='LOWER'/);
  assert.match(game,/\$\('hudPause'\)\.addEventListener/);
  assert.match(game,/\[\$\('touchTurnLeft'\),'turnLeft'\]/);
  assert.match(game,/\[\$\('touchTurnRight'\),'turnRight'\]/);
});
