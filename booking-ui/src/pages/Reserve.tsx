import { useEffect, useState } from "react";
import { api, type ReserveInput } from "../lib/api";

function useQuery(){
  const p = new URLSearchParams(location.search);
  return (k:string)=> p.get(k) ?? "";
}

export default function Reserve(){
  const q = useQuery();
  const slotId = q("slotId");
  const [name,setName] = useState("");
  const [phone,setPhone] = useState("");
  const [note,setNote] = useState("");
  const [busy,setBusy] = useState(false);
  const [ok,setOk] = useState<string|undefined>();
  const [err,setErr] = useState<string|undefined>();

  useEffect(()=>{ if(!slotId) setErr("slotId がありません"); }, [slotId]);

  async function submit(){
    setBusy(true); setErr(undefined); setOk(undefined);
    try{
      const body: ReserveInput = { slotId, name, phone, note };
      const r = await api.reserve(body);
      setOk(`予約を受け付けました (id: ${r.id})`);
    }catch(e:any){
      setErr(e?.message ?? "予約に失敗しました");
    }finally{ setBusy(false) }
  }

  return (
    <div className='max-w-lg mx-auto p-6'>
      <div className='rounded-2xl p-6 bg-[var(--card)]'>
        <h1 className='text-2xl font-bold mb-4'>予約情報</h1>
        <div className='space-y-3'>
          <Field label='お名前'>
            <input value={name} onChange={e=>setName(e.target.value)} className='i'/>
          </Field>
          <Field label='電話番号（任意）'>
            <input value={phone} onChange={e=>setPhone(e.target.value)} className='i'/>
          </Field>
          <Field label='メモ（任意）'>
            <textarea value={note} onChange={e=>setNote(e.target.value)} className='i min-h-28'></textarea>
          </Field>
          <button onClick={submit} disabled={busy||!slotId||!name}
                  className='w-full rounded-xl py-3 font-semibold bg-[var(--accent)] text-black disabled:opacity-40'>
            {busy ? "送信中…" : "予約する"}
          </button>
          {ok && <p className='text-green-300 mt-2'>{ok}</p>}
          {err && <p className='text-red-300 mt-2'>{err}</p>}
        </div>
      </div>
    </div>
  )
}

function Field(props:{label:string, children:any}){
  return (
    <label className='block'>
      <div className='text-sm mb-1 opacity-80'>{props.label}</div>
      <div className='[&_.i]:w-full [&_.i]:rounded-xl [&_.i]:px-4 [&_.i]:py-2 [&_.i]:bg-black/20
                      [&_.i]:outline-none [&_.i]:ring-1 [&_.i]:ring-white/10
                      [&_.i]:focus:ring-[var(--accent)]'>
        {props.children}
      </div>
    </label>
  )
}

