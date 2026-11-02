'use client';
import { Trophy, Medal } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
type MemoryPhoto = { src:string; title:string; caption:string; alt:string; date?:string };
const photos: MemoryPhoto[] = [
  {src:'teamwork',date:'2025-03-01',title:'National Mathematics Tournament',caption:'Aniero Stanley and Nwizu Goodluck at the National Mathematics Tournament organised by the Math4Life Foundation.',alt:'Two students discussing at competition microphones'},
  {src:'medal-moment',date:'2026-05',title:'Pan-African Mathematics Olympiad',caption:'Chimfumanya Aghaduno, Nigeria’s highest-ever female PAMO silver medallist.',alt:'A medal recipient holding a Nigerian flag'},
  {src:'trophy-moment',date:'2026-01-15',title:'African Smart Competition',caption:'Chimkwesiri Anyinam won first place in coding at the African Smart Competition 2026.',alt:'A student holding a trophy in front of fellow students'},
  {src:'spak-contestant',date:'2024-08-02',title:'InterswitchSPAK',caption:'Nwizu Goodluck represents Penny International College at InterswitchSPAK.',alt:'A Penny International College contestant on a televised quiz stage'},
  {src:'competition-team',date:'2025-03-01',title:'National Mathematics Tournament',caption:'The PIC delegation at the National Mathematics Tournament.',alt:'Students and accompanying adults at a competition event'},
  {src:'prize-moment-enhanced',date:'2026-09-24',title:'Mathema 3.0 Mathematics Conference and Exhibition',caption:'Chimkwesiri Anyinam won first place at the Mathema 3.0 Mathematics Conference and Exhibition.',alt:'A student at a prize presentation'}
];
export default function MemoryCarousel({ paused }: { paused: boolean }) {
  const track = useRef<HTMLDivElement>(null), section = useRef<HTMLElement>(null), direction = useRef(1), manualUntil=useRef(0), stops = useRef<number[]>([0]);
  const [hovered, setHovered] = useState(false), [focused, setFocused] = useState(false), [visible, setVisible] = useState(false), [reduced, setReduced] = useState(true);
  const [interaction, setInteraction] = useState(0), [navigation, setNavigation] = useState({ index:0, count:1 });
  function nearest(left:number) { return stops.current.reduce((best, value, index) => Math.abs(value-left)<Math.abs(stops.current[best]-left) ? index : best,0); }
  function measure() {
    const el=track.current; if(!el) return;
    const cards=Array.from(el.children).slice(0,photos.length) as HTMLElement[], origin=cards[0]?.offsetLeft || 0, max=Math.max(0,el.scrollWidth-el.clientWidth);
    const positions:number[]=[];
    cards.forEach(card=>{const position=Math.min(max,Math.max(0,card.offsetLeft-origin));if(!positions.length || position-positions[positions.length-1]>3) positions.push(position);});
    stops.current=positions.length ? positions : [0];
    setNavigation({index:nearest(el.scrollLeft),count:stops.current.length});
  }
  function goTo(index:number, manual=true) {
    const el=track.current; if(!el) return;
    const target=Math.max(0,Math.min(stops.current.length-1,index));
    el.scrollTo({left:stops.current[target],behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'});
    if(manual) {manualUntil.current=Date.now()+6000;direction.current=target>=nearest(el.scrollLeft) ? 1 : -1;setInteraction(current=>current+1);}
  }
  useEffect(()=>{
    const preference=window.matchMedia('(prefers-reduced-motion: reduce)'), update=()=>setReduced(preference.matches);
    update();preference.addEventListener('change',update);
    const observer='IntersectionObserver' in window ? new IntersectionObserver(entries=>setVisible(entries[0].isIntersecting),{threshold:.15}) : null;
    if(observer && section.current) observer.observe(section.current);else setVisible(true);
    const resize=new ResizeObserver(measure);if(track.current) resize.observe(track.current);measure();
    return ()=>{preference.removeEventListener('change',update);observer?.disconnect();resize.disconnect();};
  },[]);
  useEffect(()=>{
    if(paused || hovered || focused || !visible || reduced) return;
    let reset:ReturnType<typeof setTimeout>;
    const timer=setInterval(()=>{
      const el=track.current;if(!el||document.hidden||Date.now()<manualUntil.current)return;
      const first=el.children[0] as HTMLElement,copy=el.children[photos.length] as HTMLElement;
      const width=copy&&first?copy.offsetLeft-first.offsetLeft:0;if(!width)return;
      if(el.scrollLeft>=width)el.scrollLeft-=width;
      const index=nearest(el.scrollLeft),next=index+1;
      el.scrollTo({left:next>=photos.length?width:stops.current[next],behavior:'smooth'});
      if(next>=photos.length)reset=setTimeout(()=>{if(track.current&&track.current.scrollLeft>=width-2)track.current.scrollLeft-=width;},1200);
    },5000);
    return()=>{clearInterval(timer);clearTimeout(reset);};
  },[paused,hovered,focused,visible,reduced,interaction]);
  return <section ref={section} className={`competition-memories memories-carousel ${visible?'memories-visible':''}`} aria-label="Competition memories" aria-roledescription="carousel">
    <div className="memories-floaters" aria-hidden="true"><i><Trophy/></i><i><Medal/></i><i><Trophy/></i><i><Medal/></i></div>
    <div className="memories-inner">
      <div className="memories-top"><div className="memories-heading"><span className="eyebrow">BEYOND THE CLASSROOM</span><h2>Focus. Teamwork.<br/>Memorable moments.</h2><p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt.</p></div></div>
      <div id="competition-photo-track" ref={track} className="memories-grid" onMouseEnter={()=>setHovered(true)} onMouseLeave={()=>setHovered(false)} onFocusCapture={()=>setFocused(true)} onBlurCapture={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false);}} onScroll={()=>{const el=track.current;if(!el)return;const index=nearest(el.scrollLeft);setNavigation(current=>current.index===index?current:{...current,index});}} tabIndex={0} aria-label="Competition photo gallery; swipe or scroll to see more">{[...photos,...photos].map((photo,index)=><figure aria-hidden={index>=photos.length?true:undefined} className={`memory-card ${index>=photos.length?'memory-copy':''}`} key={photo.src+index} role="group" aria-label={photo.title}><img src={`/images/${photo.src}.webp`} alt={photo.alt} loading="lazy"/><figcaption>{photo.date && <time className="memory-date" dateTime={photo.date}>{new Date((photo.date.length === 7 ? photo.date+'-01' : photo.date)+'T00:00:00Z').toLocaleDateString('en-GB',{...(photo.date.length === 7 ? {} : {day:'numeric' as const}),month:'long',year:'numeric',timeZone:'UTC'})}</time>}<h3><Medal className="achievement-medal" size={22} aria-hidden="true"/>{photo.title}</h3><p>{photo.caption}</p></figcaption></figure>)}</div>
      <div className="memories-footer"><nav className="memory-dots" aria-label="Photo slideshow pages">{Array.from({length:navigation.count},(_,index)=><button key={index} aria-label={`Show photo group ${index+1} of ${navigation.count}`} aria-current={navigation.index===index ? 'true' : undefined} onClick={()=>goTo(index)}><i/></button>)}</nav></div>
    </div>
  </section>;
}
