import { useEffect, useMemo, useState } from "react";
import { api, type Slot } from "../lib/api";

function toDateInputValue(d: Date){
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,'0');
  const day = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}

export default function Slots(){
  const [date, setDate] = useState(toDateInputValue(new Date()));
  const [loading,setLoading] = useState(false);
  const [slots,setSlots] = useState<Slot[]>([]);
  const [err,setErr] = useState<string|undefined>();

  const iso = useMemo(()=> new Date(date+"T00:00:00").toISOString().slice(0,10), [date]);

  useEffect(()=> {
    (async ()=>{
      setLoading(true); setErr(undefined);
      try{
        const res = await api.slots(iso);
        setSlots(res.slots ?? []);
      }catch(e:any){
        setErr(e?.message ?? "failed to fetch");
      }finally{ setLoading(false) }
    })();
  }, [iso]);

  return (
    <div className='max-w-4xl mx-auto p-6'>
      <div className='flex items-end gap-4 mb-6'>
        <div>
          <label className='text-sm block mb-1 opacity-80'>日付</label>
          <input type='date' value={date} onChange={e=>setDate(e.target.value)}
                 className='bg-[var(--card)] rounded-xl px-4 py-2 outline-none ring-1 ring-white/10 focus:ring-[var(--accent)]'/>
        </div>
      </div>

      {loading && <p className='opacity-80'>読み込み中…</p>}
      {err && <p className='text-red-300'>{err}</p>}

      <div className='grid md:grid-cols-2 gap-4'>
        {slots.map(s => <SlotCard key={s.id} slot={s}/>)}
      </div>

      {!loading && !err && slots.length===0 && (
        <p className='opacity-70 mt-6'>この日に空き枠はありません。</p>
      )}
    </div>
  )
}

function SlotCard({slot}:{slot:Slot}){
  const t = (x:string)=> new Date(x).toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit'});
  const href = `/reserve?slotId=${encodeURIComponent(slot.id)}`;

  return (
    <a href={href} className='rounded-2xl p-4 bg-[var(--card)] hover:outline hover:outline-2 hover:outline-[var(--accent)] transition block'>
      <div className='text-lg font-semibold'>{t(slot.start)} - {t(slot.end)}</div>
      <div className='opacity-80 text-sm'>残り {slot.remaining ?? "?"} / {slot.capacity ?? "?"}</div>
    </a>
  )
}

