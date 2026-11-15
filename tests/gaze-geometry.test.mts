import test from 'node:test';import assert from 'node:assert/strict';
import {geometryCause,geometryViewport,GazeGeometryLog,sameRegions,type Geometry} from '../src/gaze/gaze-geometry.mts';
const g:Geometry={innerWidth:1440,innerHeight:756,outerWidth:1440,outerHeight:900,pixelRatio:2,visual:{width:1440,height:756,scale:1,offsetLeft:0,offsetTop:0},screen:{width:1440,height:900,availableWidth:1440,availableHeight:900},fullscreen:false,document:{width:1425,height:756,scrollWidth:1425,scrollHeight:1000},scroll:{x:0,y:0},regions:[{id:'Left',left:28,top:350,width:670,height:240},{id:'Right',left:722,top:350,width:670,height:240}]};
test('distinguishes browser chrome, window sizing, zoom and visual viewport evidence without claiming intent',()=>{
 assert.equal(geometryCause(g,{...g,innerHeight:812}),'browser-chrome-or-content-viewport-change');
 assert.equal(geometryCause(g,{...g,innerHeight:812,outerHeight:956}),'window-size-change-intent-unknown');
 assert.equal(geometryCause(g,{...g,pixelRatio:4}),'zoom-or-display-scale');
 assert.equal(geometryCause(g,{...g,visual:{...g.visual,height:700}}),'visual-viewport-change');
 assert.equal(geometryCause(g,{...g,fullscreen:true}),'fullscreen-transition');
});
test('ordinary content changes do not masquerade as a CSS viewport change',()=>{
 const changed={...g,document:{...g.document,scrollHeight:1400}};
 assert.equal(geometryCause(g,changed),'app-layout-change');assert.deepEqual(geometryViewport(g),geometryViewport(changed));
 assert.equal(geometryCause(g,{...g,scroll:{x:0,y:30}}),'document-scroll');
 assert.equal(geometryCause(g,{...g,regions:g.regions.map(r=>({...r,top:r.top+20}))}),'app-layout-change');
});
test('calibration fingerprint includes visual viewport dimensions and offsets',()=>{
 assert.notEqual(geometryViewport(g).key,geometryViewport({...g,visual:{...g.visual,offsetTop:20}}).key);
 assert.notEqual(geometryViewport(g).key,geometryViewport({...g,innerHeight:812}).key);
});
test('geometry must settle for two seconds; real changes reset the gate and no-op events do not',()=>{
 const log=new GazeGeometryLog();log.observe('initial',g,1000);assert.equal(log.settled(2999),false);assert.equal(log.settled(3000),true);
 log.observe('window.resize',g,3100);assert.equal(log.settled(3100),true);
 log.observe('visualViewport.resize',{...g,innerHeight:812},3200);assert.equal(log.settled(5100),false);assert.equal(log.settled(5200),true);
 assert.equal(log.snapshot().events.at(-1)?.source,'visualViewport.resize');
 for(let n=0;n<100;n++)log.observe('window.resize',g,6000+n);assert.equal(log.snapshot().events.length,40);
});
test('target geometry tolerates subpixel rounding but never an actual shifted target',()=>{
 assert.equal(sameRegions(g.regions,g.regions.map(r=>({...r,left:r.left+0.2}))),true);
 assert.equal(sameRegions(g.regions,g.regions.map(r=>({...r,left:r.left+1}))),false);
});
