import { useEffect, useState } from "react";
import { getSlots, postReserve } from "./api";
import { AppConfig as AppConfigSchema } from "./schema/config.schema";
import cfgJson from "./config/app.config.json";
import { initLiff } from "./auth/line";

export default function App(){
  const [date, setDate] = useState<string>("");
  const [slots, setSlots] = useState<string[]>([]);
  const [service, setService] = useState<string>("cut");
  const [userId, setUserId] = useState<string>("");

  useEffect(() => { (async () => setUserId(await initLiff()))() }, []);

  async function load(){
    if(!date) return;
    const res = await getSlots({ date, service }, userId);
    setSlots(res.open);
  }

  async function reserve(time: string){
    const ok = await postReserve({ userId, date, time, service }, userId);
    alert("予約完了: " + ok.id);
  }

  const cfg = AppConfigSchema.parse(cfgJson);

  return (
    <div className="max-w-md mx-auto p-4">
      <h1 className="text-xl font-bold mb-3">{cfg.brand.name} 予約</h1>
      <label className="block mb-2">日付</label>
      <input className="border p-2 w-full mb-3" type="date" value={date} onChange={e=>setDate(e.target.value)} />
      <label className="block mb-2">メニュー</label>
      <select className="border p-2 w-full mb-3" value={service} onChange={e=>setService(e.target.value)}>
        {cfg.services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
      <button className="border px-3 py-2 mb-3" onClick={load}>空き枠を表示</button>
      <ul className="space-y-2">
        {slots.map(t =>
          <li key={t}>
            <button className="w-full border px-3 py-2" onClick={()=>reserve(t)}>{t} を予約</button>
          </li>
        )}
      </ul>
    </div>
  );
}
