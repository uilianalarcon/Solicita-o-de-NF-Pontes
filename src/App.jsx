import React, { useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase'
import { BarChart3, ClipboardList, FilePlus2, LogOut, Search, Eye, Pencil, Check, X, Trash2, Users } from 'lucide-react'

const TYPES = ['REMESSA - Locação','REMESSA - Outras Saídas','RETORNO - Locação','RETORNO - Outras Saídas']
const ORIGINS = ['Pontes Cachoeirinha - 89.171.201/0001-65','Pontes Joinville - 89.171.201/0002-46','Pontes SPE Cachoeirinha - 59.413.564/0001-07','Pontes SPE Caxias - 59.413.564/0002-80']
const EMPTY = { type:'', origin:'', requester_name:'', customer_name:'', customer_cnpj:'', model:'', series:'', weight:'', carrier_cnpj:'', freight:'', observation:'', return_nf:'' }

function App(){
  const [session,setSession]=useState(null)
  const [profile,setProfile]=useState(null)
  const [page,setPage]=useState('dashboard')
  const [loading,setLoading]=useState(true)

  useEffect(()=>{
    supabase.auth.getSession().then(({data})=>setSession(data.session))
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_e,s)=>setSession(s))
    return ()=>subscription.unsubscribe()
  },[])

  useEffect(()=>{
    if(!session){setProfile(null);setLoading(false);return}
    supabase.from('profiles').select('*').eq('id',session.user.id).maybeSingle().then(({data,error})=>{setProfile(data||{id:session.user.id,email:session.user.email,name:session.user.email,role:'solicitante'});setLoading(false)})
  },[session])

  if(loading) return <div className="loading">Carregando...</div>
  if(!session) return <Login />
  return <div className="app-shell">
    <aside><div className="brand">PONTES<span>MÁQUINAS</span></div>
      <nav>
        <button className={page==='dashboard'?'active':''} onClick={()=>setPage('dashboard')}><BarChart3/> Dashboard</button>
        <button className={page==='requests'?'active':''} onClick={()=>setPage('requests')}><ClipboardList/> Solicitações</button>
        <button className={page==='new'?'active':''} onClick={()=>setPage('new')}><FilePlus2/> Nova solicitação</button>
        {profile?.role==='administrador' && <button className={page==='users'?'active':''} onClick={()=>setPage('users')}><Users/> Usuários</button>}
      </nav>
      <button className="logout" onClick={()=>supabase.auth.signOut()}><LogOut/> Sair</button>
    </aside>
    <main>
      <header><div><small>Painel operacional</small><h1>{page==='dashboard'?'Dashboard':page==='requests'?'Solicitações':page==='new'?'Nova solicitação':'Usuários'}</h1></div><div className="user"><b>{profile?.name}</b><span>{profile?.role}</span></div></header>
      {page==='dashboard'&&<Dashboard profile={profile} />}
      {page==='requests'&&<Requests profile={profile}/>} 
      {page==='new'&&<RequestForm profile={profile} onSaved={()=>setPage('requests')}/>} 
      {page==='users'&&<UsersPage profile={profile}/>} 
    </main>
  </div>
}

function Login(){
  const [email,setEmail]=useState(''); const [password,setPassword]=useState(''); const [error,setError]=useState(''); const [busy,setBusy]=useState(false)
  async function submit(e){e.preventDefault();setBusy(true);setError('');const {error}=await supabase.auth.signInWithPassword({email,password});if(error)setError('E-mail ou senha inválidos');setBusy(false)}
  return <div className="login-page"><form className="login-card" onSubmit={submit}><div className="login-logo">PONTES<span>MÁQUINAS</span></div><h2>Acesso ao sistema</h2><label>E-mail<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required /></label><label>Senha<input type="password" value={password} onChange={e=>setPassword(e.target.value)} required /></label>{error&&<p className="error">{error}</p>}<button className="primary" disabled={busy}>{busy?'Entrando...':'Entrar'}</button></form></div>
}

function Dashboard({profile}){const [rows,setRows]=useState([]);const [loading,setLoading]=useState(true)
  useEffect(()=>{load()},[])
  async function load(){const {data}=await supabase.from('invoice_requests').select('*').order('created_at',{ascending:false});setRows(data||[]);setLoading(false)}
  const counts={Pendente:rows.filter(r=>r.status==='Pendente').length,Emitida:rows.filter(r=>r.status==='Emitida').length,Reprovada:rows.filter(r=>r.status==='Reprovada').length}
  return <><div className="cards"><Card label="Total" value={rows.length} tone="blue"/><Card label="Pendentes" value={counts.Pendente} tone="orange"/><Card label="Emitidas" value={counts.Emitida} tone="green"/><Card label="Reprovadas" value={counts.Reprovada} tone="red"/></div><Requests profile={profile} dashboard/></>
}
function Card({label,value,tone}){return <div className={'card '+tone}><span>{label}</span><strong>{value}</strong></div>}

function Requests({profile,dashboard=false}){
  const [rows,setRows]=useState([]);const [search,setSearch]=useState('');const [status,setStatus]=useState('');const [date,setDate]=useState('');const [selected,setSelected]=useState(null);const [editing,setEditing]=useState(null)
  useEffect(()=>{load()},[])
  async function load(){const {data}=await supabase.from('invoice_requests').select('*').order('created_at',{ascending:false});setRows(data||[])}
  async function action(id,approval_status, nf_number){await supabase.from('invoice_requests').update({approval_status, ...(nf_number!==undefined?{nf_number}:{})}).eq('id',id);load()}
  async function saveNF(id,nf){await supabase.from('invoice_requests').update({nf_number:nf}).eq('id',id);load()}
  async function remove(id){if(!confirm('Excluir esta solicitação?'))return;await supabase.from('invoice_requests').delete().eq('id',id);load()}
  const filtered=useMemo(()=>rows.filter(r=>(!status||r.status===status)&&(!date||r.created_at?.slice(0,10)===date)&&(!search||JSON.stringify(r).toLowerCase().includes(search.toLowerCase()))),[rows,status,date,search])
  return <><div className="panel"><div className="filters"><div className="search"><Search/><input placeholder="Buscar cliente, CNPJ ou solicitação" value={search} onChange={e=>setSearch(e.target.value)}/></div><select value={status} onChange={e=>setStatus(e.target.value)}><option value="">Todos os status</option><option>Pendente</option><option>Emitida</option><option>Reprovada</option></select><input type="date" title="Data da solicitação" value={date} onChange={e=>setDate(e.target.value)}/></div><div className="table-wrap"><table><thead><tr><th>Data</th><th>Solicitante</th><th>Tipo</th><th>Cliente</th><th>Status</th><th>Nº NF</th><th>Ações</th></tr></thead><tbody>{filtered.map(r=>{const canManage=profile.role==='administrador'||profile.role==='aprovador';const own=r.requester_id===profile.id;return <tr key={r.id}><td>{new Date(r.created_at).toLocaleDateString('pt-BR')}</td><td>{r.requester_name}</td><td>{r.type}</td><td><b>{r.customer_name}</b><small>{r.customer_cnpj}</small></td><td><Status value={r.status}/></td><td>{r.approval_status==='Aprovada'&&(canManage)?<NFInput value={r.nf_number} onSave={v=>saveNF(r.id,v)}/>:<span>{r.nf_number||'—'}</span>}</td><td><div className="actions"><button title="Visualizar" onClick={()=>setSelected(r)}><Eye/></button>{(canManage||((own)&&r.status==='Pendente'))&&<button title="Editar" onClick={()=>setEditing(r)}><Pencil/></button>}{canManage&&r.approval_status!=='Aprovada'&&<button title="Aprovar" className="approve" onClick={()=>action(r.id,'Aprovada')}><Check/></button>}{canManage&&r.approval_status!=='Reprovada'&&<button title="Reprovar" className="reject" onClick={()=>action(r.id,'Reprovada')}><X/></button>}{(profile.role==='administrador'||(own&&r.status==='Pendente'))&&<button title="Excluir" className="reject" onClick={()=>remove(r.id)}><Trash2/></button>}</div></td></tr>})}{!filtered.length&&<tr><td colSpan="7" className="empty">Nenhuma solicitação encontrada</td></tr>}</tbody></table></div></div>{selected&&<ViewModal row={selected} close={()=>setSelected(null)}/>} {editing&&<EditModal row={editing} profile={profile} close={()=>setEditing(null)} saved={()=>{setEditing(null);load()}}/>}</>
}

function Status({value}){const cls=value==='Emitida'?'green':value==='Reprovada'?'red':'orange';return <span className={'status '+cls}>{value}</span>}
function NFInput({value,onSave}){const [v,setV]=useState(value||'');return <input className="nf-input" inputMode="numeric" placeholder="Informar" value={v} onChange={e=>setV(e.target.value)} onBlur={()=>onSave(v)} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur()}}/>}

function RequestForm({profile,onSaved,row=null,close=null,saved=null}){
  const [form,setForm]=useState(row?{...row}:({...EMPTY,requester_name:profile.name}))
  const [busy,setBusy]=useState(false);const [error,setError]=useState('')
  const isReturn=form.type.startsWith('RETORNO')
  function set(k,v){setForm(f=>({...f,[k]:v}))}
  async function submit(e){e.preventEvent;}
  async function submitReal(e){e.preventDefault();setError('');if(isReturn&&!form.return_nf.trim()){setError('Informe o nº da NF que será retornada.');return}setBusy(true)
    const payload={requester_id:profile.id,requester_name:form.requester_name||profile.name,type:form.type,origin:form.origin,customer_name:form.customer_name,customer_cnpj:form.customer_cnpj,model:form.model,series:form.series,weight:form.weight,carrier_cnpj:form.carrier_cnpj,freight:form.freight,observation:form.observation,return_nf:isReturn?form.return_nf:''}
    let res
    if(row) res=await supabase.from('invoice_requests').update(payload).eq('id',row.id)
    else res=await supabase.from('invoice_requests').insert(payload)
    setBusy(false);if(res.error)setError(res.error.message);else{if(saved)saved();else onSaved()}
  }
  return <div className="panel form-panel"><form onSubmit={submitReal}><h3>{row?'Editar solicitação':'Dados da solicitação'}</h3><div className="form-grid"><Field label="Nome solicitante" value={form.requester_name} onChange={v=>set('requester_name',v)} required/><Select label="Tipo" value={form.type} onChange={v=>set('type',v)} options={TYPES} required/><Select label="Origem" value={form.origin} onChange={v=>set('origin',v)} options={ORIGINS} required/><Field label="Nome cliente" value={form.customer_name} onChange={v=>set('customer_name',v)} required/><Field label="CNPJ cliente" value={form.customer_cnpj} onChange={v=>set('customer_cnpj',v)} required/><Field label="Modelo" value={form.model} onChange={v=>set('model',v)} required/><Field label="Série" value={form.series} onChange={v=>set('series',v)} required/><Field label="Peso" value={form.weight} onChange={v=>set('weight',v)} required/><Field label="CNPJ Transportadora" value={form.carrier_cnpj} onChange={v=>set('carrier_cnpj',v)}/><Select label="Frete" value={form.freight} onChange={v=>set('freight',v)} options={['CIF','FOB','Sem frete']} required/>{isReturn&&<Field label="Nº da NF a ser retornada" value={form.return_nf} onChange={v=>set('return_nf',v)} required/>}</div><label className="obs">OBS<textarea rows="4" value={form.observation||''} onChange={e=>set('observation',e.target.value)}/></label>{error&&<p className="error">{error}</p>}<div className="form-actions">{close&&<button type="button" className="secondary" onClick={close}>Cancelar</button>}<button className="primary" disabled={busy}>{busy?'Salvando...':row?'Salvar alterações':'Solicitar NF'}</button></div></form></div>
}
function Field({label,value,onChange,required=false}){return <label>{label}{required&&<b>*</b>}<input value={value||''} onChange={e=>onChange(e.target.value)} required={required}/></label>}
function Select({label,value,onChange,options,required=false}){return <label>{label}{required&&<b>*</b>}<select value={value||''} onChange={e=>onChange(e.target.value)} required={required}><option value="">Selecione</option>{options.map(o=><option key={o}>{o}</option>)}</select></label>}

function ViewModal({row,close}){return <div className="modal-backdrop" onMouseDown={close}><div className="modal" onMouseDown={e=>e.stopPropagation()}><button className="modal-close" onClick={close}><X/></button><h2>Solicitação de NF</h2><div className="detail-grid">{[['Solicitante',row.requester_name],['Tipo',row.type],['Origem',row.origin],['Nome cliente',row.customer_name],['CNPJ cliente',row.customer_cnpj],['Modelo',row.model],['Série',row.series],['Peso',row.weight],['CNPJ transportadora',row.carrier_cnpj||'—'],['Frete',row.freight],['Nº NF retornada',row.return_nf||'—'],['Nº da NF',row.nf_number||'—']].map(([k,v])=> <div key={k}><small>{k}</small><b>{v}</b></div>)}<div className="full"><small>OBS</small><b>{row.observation||'—'}</b></div></div></div></div>}
function EditModal({row,profile,close,saved}){return <div className="modal-backdrop"><div className="modal edit-modal"><button className="modal-close" onClick={close}><X/></button><RequestForm profile={profile} row={row} close={close} saved={saved}/></div></div>}

function UsersPage(){
  const [users,setUsers]=useState([]);const [name,setName]=useState('');const [email,setEmail]=useState('');const [password,setPassword]=useState('');const [role,setRole]=useState('solicitante');const [busy,setBusy]=useState(false)
  useEffect(()=>{load()},[])
  async function load(){const {data}=await supabase.from('profiles').select('*').order('name');setUsers(data||[])}
  async function changeRole(id,role){await supabase.from('profiles').update({role}).eq('id',id);load()}
  async function remove(id){if(confirm('Excluir este usuário?')){await supabase.from('profiles').delete().eq('id',id);load()}}
  async function create(e){e.preventDefault();setBusy(true);const {data,error}=await supabase.auth.signUp({email,password,options:{data:{name}}});if(!error&&data.user){await supabase.from('profiles').update({name,role}).eq('id',data.user.id);setName('');setEmail('');setPassword('');load()}else alert(error?.message||'Usuário criado. Confirme o e-mail caso o Supabase exija confirmação.');setBusy(false)}
  return <div className="panel"><h3>Cadastrar usuário</h3><form className="user-form" onSubmit={create}><input placeholder="Nome" value={name} onChange={e=>setName(e.target.value)} required/><input type="email" placeholder="E-mail" value={email} onChange={e=>setEmail(e.target.value)} required/><input type="password" placeholder="Senha" value={password} onChange={e=>setPassword(e.target.value)} required/><select value={role} onChange={e=>setRole(e.target.value)}><option value="administrador">Administrador</option><option value="aprovador">Aprovador</option><option value="solicitante">Solicitante</option></select><button className="primary" disabled={busy}>Cadastrar</button></form><div className="table-wrap"><table><thead><tr><th>Nome</th><th>E-mail</th><th>Perfil</th><th>Ações</th></tr></thead><tbody>{users.map(u=><tr key={u.id}><td>{u.name}</td><td>{u.email}</td><td><select value={u.role} onChange={e=>changeRole(u.id,e.target.value)}><option value="administrador">Administrador</option><option value="aprovador">Aprovador</option><option value="solicitante">Solicitante</option></select></td><td><button className="icon-danger" onClick={()=>remove(u.id)}><Trash2/></button></td></tr>)}</tbody></table></div></div>
}
export default App
