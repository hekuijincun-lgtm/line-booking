import { LOGIN_URL } from "../lib/api";

export default function Login(){
  return (
    <div className='min-h-[100dvh] flex items-center justify-center p-6'>
      <div className='w-full max-w-sm rounded-2xl shadow-xl p-6 bg-[var(--card)]'>
        <h1 className='text-2xl font-bold mb-2'>LINEでログイン</h1>
        <p className='text-sm opacity-80 mb-6'>予約を進めるにはLINEログインが必要です。</p>
        <a href={LOGIN_URL}
           className='block text-center rounded-xl py-3 font-semibold bg-[var(--accent)] text-black hover:opacity-90 transition'>
          LINEで続ける
        </a>
      </div>
    </div>
  )
}
