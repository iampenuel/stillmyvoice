// SPDX-License-Identifier: AGPL-3.0-or-later
import type { GazeRegion, GazeViewport } from './gaze-logic.mts';
export type Geometry = Readonly<{
  innerWidth:number;innerHeight:number;outerWidth:number;outerHeight:number;pixelRatio:number;
  visual:{width:number;height:number;scale:number;offsetLeft:number;offsetTop:number};
  screen:{width:number;height:number;availableWidth:number;availableHeight:number};fullscreen:boolean;
  document:{width:number;height:number;scrollWidth:number;scrollHeight:number};scroll:{x:number;y:number};regions:readonly GazeRegion[];
}>;
export function geometryViewport(g:Geometry):GazeViewport {
  return {width:g.innerWidth,height:g.innerHeight,key:[g.innerWidth,g.innerHeight,g.pixelRatio,g.visual.width,g.visual.height,g.visual.scale,g.visual.offsetLeft,g.visual.offsetTop].join(':')};
}
export function sameRegions(a:readonly GazeRegion[],b:readonly GazeRegion[]):boolean {
  return a.length===b.length&&a.every((r,i)=>r.id===b[i]?.id&&(['left','top','width','height'] as const).every(k=>Math.abs(r[k]-b[i][k])<=0.5));
}
export function geometryCause(a:Geometry,b:Geometry):string {
  if(a.fullscreen!==b.fullscreen)return 'fullscreen-transition';
  if(a.pixelRatio!==b.pixelRatio||a.visual.scale!==b.visual.scale)return 'zoom-or-display-scale';
  if(a.outerWidth!==b.outerWidth||a.outerHeight!==b.outerHeight)return 'window-size-change-intent-unknown';
  if(a.innerWidth!==b.innerWidth||a.innerHeight!==b.innerHeight)return 'browser-chrome-or-content-viewport-change';
  if(JSON.stringify(a.visual)!==JSON.stringify(b.visual))return 'visual-viewport-change';
  if(a.scroll.x!==b.scroll.x||a.scroll.y!==b.scroll.y)return 'document-scroll';
  if(!sameRegions(a.regions,b.regions)||JSON.stringify(a.document)!==JSON.stringify(b.document))return 'app-layout-change';
  return 'unchanged';
}
export type GeometryEvent=Readonly<{atMs:number;source:string;cause:string;before:Geometry|null;after:Geometry}>;
/** Numeric evidence only; intent and the specific browser toolbar are not exposed by resize events. */
export class GazeGeometryLog {
  private last:Geometry|null=null;private events:GeometryEvent[]=[];private changedAt=0;
  observe(source:string,geometry:Geometry,now:number){
    const cause=this.last?geometryCause(this.last,geometry):'initial';
    if(cause!=='unchanged')this.changedAt=now;
    if(cause!=='unchanged'||!['poll','prediction-completed'].includes(source)){
      this.events.push({atMs:now,source,cause,before:this.last,after:geometry});this.events=this.events.slice(-40);
    }
    this.last=geometry;return cause;
  }
  settled(now:number){return this.last!==null&&now-this.changedAt>=2000;}
  snapshot(){return {last:this.last,events:[...this.events],changedAtMs:this.changedAt};}
}
