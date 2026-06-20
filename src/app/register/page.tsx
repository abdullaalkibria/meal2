'use client';
import { useState } from 'react';
export default function Register(){
 const [name,setName]=useState(''); const [phone,setPhone]=useState(''); const [password,setPassword]=useState(''); const [msg,setMsg]=useState(''); const [err,setErr]=useState('');
 async function submit(e:any){e.preventDefault();setErr('');setMsg('');const r=await fetch('/api/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,phone,password})});const j=await r.json();if(!r.ok){setErr(j.error);return;}setMsg(j.message||'Registered');}
 return <main className="authPage"><form className="authCard" onSubmit={submit}><div className="brand">MESS<span>CORE</span></div><h1>Register</h1><p className="muted">Admin authorization is required before login.</p>{err&&<div className="errorBox">{err}</div>}{msg&&<div className="okBox">{msg}</div>}<label>Name</label><input value={name} onChange={e=>setName(e.target.value)}/><label>Phone</label><input value={phone} onChange={e=>setPhone(e.target.value)}/><label>Password</label><input value={password} onChange={e=>setPassword(e.target.value)} type="password"/><button className="btn">Register</button><a href="/login">Back to login</a></form></main>
}
