import { useEffect, useRef } from 'react'
import { Beam, Dot, Formatter, Renderer, Stave, StaveNote, StaveTie, Voice } from 'vexflow'
import { createEvents, type Level } from '../level'

export default function PuzzleScorePreview({ level }: { level: Level }) {
  const host=useRef<HTMLDivElement>(null)
  useEffect(()=>{
    const element=host.current
    if (!element) return
    let previousWidth=0
    const draw=()=>{
      const width=Math.floor(element.clientWidth)
      if (!width || width===previousWidth) return
      previousWidth=width; element.replaceChildren()
      const columns=width>=760?4:width>=400?2:1
      const barWidth=(width-20)/columns, rowHeight=116
      const renderer=new Renderer(element,Renderer.Backends.SVG)
      renderer.resize(width,Math.ceil(level.bars.length/columns)*rowHeight+20)
      const context=renderer.getContext()
      context.setFillStyle('#34483a');context.setStrokeStyle('#34483a')
      const events=createEvents(level), rendered:StaveNote[]=[]
      let index=0
      level.bars.forEach((bar,barIndex)=>{
        const row=Math.floor(barIndex/columns), column=barIndex%columns
        const x=10+column*barWidth, y=16+row*rowHeight
        const stave=new Stave(x,y,barWidth)
        if (!column) stave.addClef('percussion')
        if (!barIndex) stave.addTimeSignature('4/4')
        stave.setContext(context).draw()
        context.setFont('Arial',10);context.fillText(String(barIndex+1),x+5,y+2)
        const notes=bar.map(()=>{
          const event=events[index++]
          const note=new StaveNote({keys:['b/4'],duration:event.duration+(event.dotted?'d':'')+(event.rest?'r':''),stemDirection:1})
          if(event.dotted)Dot.buildAndAttach([note],{all:true})
          rendered.push(note)
          return note
        })
        const voice=new Voice({numBeats:4,beatValue:4}).addTickables(notes)
        const beams=Beam.generateBeams(notes,{beamRests:false})
        new Formatter().joinVoices([voice]).formatToStave([voice],stave)
        voice.draw(context,stave)
        beams.forEach(beam=>beam.setContext(context).draw())
      })
      events.forEach((event,i)=>{
        if(!event.tie) return
        const crossesRow=Math.floor(event.bar/columns)!==Math.floor(events[i+1].bar/columns)
        const drawTie=(first:StaveNote|null,last:StaveNote|null)=>new StaveTie({firstNote:first,lastNote:last,firstIndexes:[0],lastIndexes:[0]}).setDirection(-1).setContext(context).draw()
        if(crossesRow){drawTie(rendered[i],null);drawTie(null,rendered[i+1])}
        else drawTie(rendered[i],rendered[i+1])
      })
      const svg=element.querySelector('svg')
      if(svg){svg.setAttribute('aria-hidden','true');svg.style.display='block'}
    }
    const observer=new ResizeObserver(draw)
    observer.observe(element);draw()
    return ()=>{observer.disconnect();element.replaceChildren()}
  },[level])
  return <div ref={host} className="puzzle-score" role="img" aria-label={`Eight-bar rhythm score for ${level.title}, ${level.beatsPerBar}/4 at ${level.bpm} BPM`} />
}
