'use client';
import { useState } from 'react';
export default function Login(){
 const [phone,setPhone]=useState(''); const [password,setPassword]=useState(''); const [err,setErr]=useState(''); const [loading,setLoading]=useState(false);
 async function submit(e:any){e.preventDefault();setLoading(true);setErr('');const r=await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({phone,password})});const j=await r.json();setLoading(false);if(!r.ok){setErr(j.error||'Login failed');return;} location.href=j.role==='admin'?'/admin':'/dashboard'}
 return <main className="authPage"><form className="authCard" onSubmit={submit}><div className="brand">MESS<span>CORE</span></div><h1>Secure Login</h1><p className="muted">Enter your registered phone and password.</p>{err&&<div className="errorBox">{err}</div>}<label>Phone</label><input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="015..."/><label>Password</label><input value={password} onChange={e=>setPassword(e.target.value)} type="password"/><button className="btn" disabled={loading}>{loading?'Checking...':'Login'}</button><a href="/register">Create account</a></form></main>
}
