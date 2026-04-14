import { useState, useEffect, useMemo, useRef } from "react";

const MESES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
const MESES_FULL = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const FORMATOS = [
  "CHECKING PRIVADO PAINEL - 1 PONTO",
  "CHECKING PRIVADO PAINEL - 2 PONTOS",
  "CHECKING PRIVADO PAINEL - 3 PONTOS",
  "CHECKING PRIVADO PAINEL - 5 PONTOS",
  "CHECKING PRIVADO PAINEL - 10 PONTOS",
  "CHECKING PRIVADO ELETROMIDIA - 2 PONTOS",
  "CHECKING PRIVADO TERMINAL - 3 PONTOS",
  "CHECKING COMPLETO SOLICITAÇÃO DO CLIENTE - 100% DAS TELAS",
  "CHECKING PÚBLICO",
];
const STORAGE_KEY = "checking_vol_v1";
const STATUS_ENVIO_MAP = {"CHK-000071": "REENVIADO", "CHK-000082": "REENVIADO", "CHK-000097": "REENVIADO", "CHK-000157": "PENDENTE", "CHK-000159": "PENDENTE"};

const PRACA_ESTADO = {
  "FORTALEZA":"CE","SOBRAL":"CE","JUAZEIRO DO NORTE":"CE","CRATO":"CE",
  "TERESINA":"PI","SÃO LUIS":"MA","BELÉM":"PA","MANAUS":"AM","MACEIO":"AL",
};
const ESTADO_COR = {
  "CE":"#4A90D9","PI":"#F5A623","MA":"#27AE60","PA":"#8B5CF6","AM":"#E74C3C","AL":"#F97316",
};

const hoje = () => new Date().toISOString().split("T")[0];
const anoAtual = new Date().getFullYear();
const mesAtual = new Date().getMonth() + 1;
const fmtDate = (d) => { if(!d) return "—"; const [y,m,dd]=d.split("-"); return `${dd}/${m}/${y.slice(2)}`; };
const diasRestantes = (prazo) =>
  prazo ? Math.ceil((new Date(prazo+"T00:00:00") - new Date(hoje()+"T00:00:00")) / 86400000) : null;

export default function App() {
  const [os, setOs] = useState([]);
  const [view, setView] = useState("dashboard");
  const [toast, setToast] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dashMes, setDashMes] = useState(mesAtual);
  const [dashAno, setDashAno] = useState(anoAtual);
  const [selectedId, setSelectedId] = useState(null);
  const [lBusca, setLBusca] = useState("");
  const [lCliente, setLCliente] = useState("");
  const [lPraca, setLPraca] = useState("");
  const [form, setForm] = useState({});
  const [editId, setEditId] = useState(null);
  const [pdfState, setPdfState] = useState("idle");
  const [pdfMsg, setPdfMsg] = useState("");
  const [showBaixa, setShowBaixa] = useState(false);
  const [baixaInput, setBaixaInput] = useState("");
  const fileRef = useRef(null);
  const importRef = useRef(null);

  // Carregar dados de localStorage ao iniciar
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const data = JSON.parse(saved);
        setOs(Array.isArray(data) ? data : data.os || []);
      } catch (err) {
        console.error("Erro ao carregar localStorage:", err);
      }
    }
  }, []);

  // Salvar dados em localStorage sempre que mudam
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(os));
  }, [os]);

  // Detector de resize
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const showToast = (msg, tipo = "sucesso") => {
    setToast({ msg, tipo });
    setTimeout(() => setToast(null), 3000);
  };

  const emptyForm = {
    id: "",
    campanha: "",
    nrCampanha: "",
    cliente: "",
    praca: "",
    opec: "",
    atendimento: "",
    formato: FORMATOS[0],
    qtdPontos: "1",
    inicio: "",
    fim: "",
    prazoEntrega: "",
    dataSolicitacao: hoje(),
    obs: "",
  };

  // Funções de CRUD
  const handleSave = () => {
    if (!form.id || !form.cliente || !form.prazoEntrega) {
      showToast("Preencha ID, Cliente e Prazo", "erro");
      return;
    }

    if (editId) {
      // Editar
      setOs(prev => prev.map(o => o.id === editId ? { ...form } : o));
      showToast("OS atualizada com sucesso");
    } else {
      // Criar
      if (os.find(o => o.id === form.id)) {
        showToast("ID já existe", "erro");
        return;
      }
      setOs(prev => [...prev, { ...form }]);
      showToast("OS criada com sucesso");
    }

    setForm(emptyForm);
    setEditId(null);
    setPdfState("idle");
    setView("lista");
  };

  const handleEdit = (osItem) => {
    setForm(osItem);
    setEditId(osItem.id);
    setView("nova");
    window.scrollTo(0, 0);
  };

  const handleDel = (id) => {
    setOs(prev => prev.filter(o => o.id !== id));
    showToast("OS removida");
    setSelectedId(null);
    setView("lista");
  };

  const handleBaixa = () => {
    const nums = baixaInput.split(",").map(s => s.trim()).filter(Boolean);
    if (!nums.length) return;
    const ids = nums.map(n => "CHK-" + n.replace(/[^0-9]/g, "").padStart(6, "0"));
    const encontradas = ids.filter(id => os.find(o => o.id === id));
    if (encontradas.length > 0) {
      setOs(prev => prev.filter(o => !encontradas.includes(o.id)));
      showToast(`${encontradas.length} OS marcadas como entregues`);
      setBaixaInput("");
      setShowBaixa(false);
    } else {
      showToast("Nenhuma OS encontrada", "erro");
    }
  };

  const handleExport = () => {
    const dados = { versao: "1.0", exportado: new Date().toISOString(), total: os.length, os };
    const blob = new Blob([JSON.stringify(dados, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const mes = new Date().toISOString().slice(0, 7);
    a.download = `checking-backup-${mes}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast(`Backup exportado · ${os.length} OS`);
  };

  const handleImport = (file) => {
    if (!file) return;
    const r = new FileReader();
    r.onload = (e) => {
      try {
        const dados = JSON.parse(e.target.result);
        const lista = dados.os || dados;
        if (!Array.isArray(lista) || lista.length === 0) {
          showToast("Arquivo inválido ou vazio", "erro");
          return;
        }
        setOs(prev => {
          const ids = new Set(prev.map(o => o.id));
          const novas = lista.filter(o => !ids.has(o.id));
          showToast(`${novas.length} OS importadas`);
          return [...prev, ...novas];
        });
      } catch {
        showToast("Erro ao ler arquivo JSON", "erro");
      }
    };
    r.readAsText(file);
  };

  const handlePdf = async (file) => {
    setPdfState("reading");
    setPdfMsg("");

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = e.target.result.split(",")[1];
        
        try {
          const response = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "claude-sonnet-4-20250514",
              max_tokens: 1000,
              messages: [
                {
                  role: "user",
                  content: [
                    {
                      type: "document",
                      source: { type: "base64", media_type: "application/pdf", data: base64 }
                    },
                    {
                      type: "text",
                      text: `Extraia os dados do PDF de solicitação de checking em JSON com as seguintes chaves exatas (use apenas o que tiver no documento):
{
  "id": "CHK-XXXXXX",
  "campanha": "nome da campanha",
  "nrCampanha": "número",
  "cliente": "nome do cliente",
  "praca": "praça (ex: FORTALEZA)",
  "opec": "nome do responsável OPEC",
  "atendimento": "nome do atendimento",
  "formato": "tipo de checking",
  "qtdPontos": "quantidade",
  "inicio": "YYYY-MM-DD",
  "fim": "YYYY-MM-DD",
  "prazoEntrega": "YYYY-MM-DD",
  "dataSolicitacao": "YYYY-MM-DD",
  "obs": "observações"
}

Retorne APENAS o JSON válido, sem markdown ou explicações.`
                    }
                  ]
                }
              ],
            }),
          });

          const data = await response.json();
          const text = data.content?.[0]?.text || "";
          
          try {
            const extracted = JSON.parse(text);
            setForm(prev => ({ ...prev, ...extracted }));
            setPdfState("done");
            setPdfMsg("Dados extraídos com sucesso");
          } catch {
            setPdfState("error");
            setPdfMsg("Erro ao processar JSON do PDF");
          }
        } catch (err) {
          setPdfState("error");
          setPdfMsg("Erro ao chamar API Claude");
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setPdfState("error");
      setPdfMsg("Erro ao ler arquivo");
    }
  };

  // Computações
  const clientes = useMemo(() => [...new Set(os.map(o => o.cliente))], [os]);
  const pracas = useMemo(() => [...new Set(os.map(o => o.praca))], [os]);
  const sel = useMemo(() => os.find(o => o.id === selectedId), [os, selectedId]);
  const isMesAtual = dashMes === mesAtual && dashAno === anoAtual;

  const filtrado = useMemo(() => {
    return os.filter(o => {
      const matchBusca = lBusca === "" || o.id.includes(lBusca) || o.campanha?.toLowerCase().includes(lBusca.toLowerCase()) || o.cliente?.toLowerCase().includes(lBusca.toLowerCase());
      const matchCliente = lCliente === "" || o.cliente === lCliente;
      const matchPraca = lPraca === "" || o.praca === lPraca;
      return matchBusca && matchCliente && matchPraca;
    });
  }, [os, lBusca, lCliente, lPraca]);

  const lista = useMemo(() => {
    return filtrado.map(o => ({
      ...o,
      dias: diasRestantes(o.prazoEntrega),
    })).sort((a, b) => (a.dias ?? 999) - (b.dias ?? 999));
  }, [filtrado]);

  const navItems = [
    { key: "dashboard", icon: "📊", label: "Dashboard" },
    { key: "consulta", icon: "🔍", label: "Consulta" },
    { key: "lista", icon: "📋", label: "Solicitações" },
  ];

  const goNova = () => {
    setForm(emptyForm);
    setEditId(null);
    setView("nova");
  };

  const navegarMes = (delta) => {
    let newMes = dashMes + delta;
    let newAno = dashAno;
    if (newMes > 12) { newMes = 1; newAno++; }
    if (newMes < 1) { newMes = 12; newAno--; }
    setDashMes(newMes);
    setDashAno(newAno);
  };

  // Estilos inline
  const card = {
    background: "#fff",
    borderRadius: 12,
    border: "1px solid #E0E4EC",
    padding: 20,
  };
  const btn = (bg, fg) => ({
    padding: "10px 16px",
    borderRadius: 8,
    border: "none",
    background: bg,
    color: fg,
    fontWeight: 700,
    fontSize: 13,
    cursor: "pointer",
    fontFamily: "inherit",
    transition: "all 0.2s",
  });
  const inp = {
    padding: "10px 12px",
    border: "1px solid #E0E4EC",
    borderRadius: 8,
    fontSize: 13,
    fontFamily: "inherit",
    marginTop: 8,
  };
  const lbl = {
    fontSize: 12,
    fontWeight: 700,
    color: "#6B7A99",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  };

  // Componentes helpers
  const KpiCard = ({ icon, value, label, color }) => (
    <div style={{ ...card, textAlign: "center" }}>
      <div style={{ fontSize: 32, marginBottom: 8 }}>{icon}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color, marginBottom: 4 }}>{value}</div>
      <div style={{ fontSize: 12, color: "#6B7A99" }}>{label}</div>
    </div>
  );

  const F = ({ label, k, ph, type = "text", dis = false, span = 1 }) => (
    <div style={{ gridColumn: span > 1 ? `span ${span}` : "auto" }}>
      <label style={lbl}>{label}</label>
      <input
        type={type}
        placeholder={ph}
        disabled={dis}
        value={form[k] || ""}
        onChange={e => setForm(p => ({ ...p, [k]: e.target.value }))}
        style={{ ...inp, width: "100%", opacity: dis ? 0.6 : 1 }}
      />
    </div>
  );

  // Renderização
  return (
    <div style={{ background: "#F5F6F8", minHeight: "100vh", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed",
          top: 24,
          right: 24,
          padding: "12px 20px",
          borderRadius: 10,
          background: toast.tipo === "erro" ? "#E74C3C" : "#27AE60",
          color: "#fff",
          fontWeight: 700,
          fontSize: 13,
          zIndex: 999,
          boxShadow: "0 4px 20px rgba(0,0,0,0.2)"
        }}>
          {toast.msg}
        </div>
      )}

      {/* Sidebar */}
      {isMobile && sidebarOpen && (
        <div onClick={() => setSidebarOpen(false)} style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.5)",
          zIndex: 99
        }} />
      )}

      {isMobile && (
        <button onClick={() => setSidebarOpen(v => !v)} style={{
          position: "fixed",
          top: 12,
          left: 12,
          zIndex: 201,
          width: 44,
          height: 44,
          borderRadius: 10,
          background: "#1A1A2E",
          border: "none",
          cursor: "pointer",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 5
        }}>
          <div style={{ width: 20, height: 2, background: "#fff", borderRadius: 2 }} />
          <div style={{ width: 20, height: 2, background: "#fff", borderRadius: 2 }} />
          <div style={{ width: 20, height: 2, background: "#fff", borderRadius: 2 }} />
        </button>
      )}

      <div style={{
        position: "fixed",
        left: isMobile ? (sidebarOpen ? 0 : -220) : 0,
        top: 0,
        bottom: 0,
        width: 220,
        background: "#1A1A2E",
        display: "flex",
        flexDirection: "column",
        zIndex: 100,
        transition: "left 0.25s ease"
      }}>
        <div style={{ padding: "28px 20px 20px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          <div style={{ fontSize: 10, letterSpacing: 3, color: "#6B7A99", fontWeight: 700, marginBottom: 4 }}>ELETROMIDIA</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>Checking</div>
          <div style={{ fontSize: 12, color: "#6B7A99", marginTop: 2 }}>Volumetria de OS</div>
        </div>

        <nav style={{ padding: "16px 12px", flex: 1 }}>
          {navItems.map(item => (
            <button key={item.key} onClick={() => {
              setView(item.key);
              if (isMobile) setSidebarOpen(false);
            }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                width: "100%",
                padding: "10px 12px",
                borderRadius: 8,
                border: "none",
                cursor: "pointer",
                marginBottom: 4,
                fontSize: 14,
                fontFamily: "inherit",
                textAlign: "left",
                fontWeight: view === item.key ? 700 : 400,
                background: view === item.key ? "rgba(74,144,217,0.18)" : "transparent",
                color: view === item.key ? "#4A90D9" : "#8899BB"
              }}>
              <span style={{ fontSize: 15 }}>{item.icon}</span>{item.label}
            </button>
          ))}
        </nav>

        <div style={{ padding: "12px", display: "flex", flexDirection: "column", gap: 8 }}>
          <button onClick={() => setShowBaixa(true)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              width: "100%",
              padding: "11px 12px",
              borderRadius: 8,
              border: "none",
              cursor: "pointer",
              fontFamily: "inherit",
              fontSize: 13,
              fontWeight: 700,
              background: "rgba(245,166,35,0.15)",
              color: "#F5A623"
            }}>
            ✅ Baixar OS
          </button>
          <button onClick={handleExport}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              width: "100%",
              padding: "11px 12px",
              borderRadius: 8,
              border: "none",
              cursor: "pointer",
              fontFamily: "inherit",
              fontSize: 13,
              fontWeight: 700,
              background: "rgba(74,144,217,0.12)",
              color: "#4A90D9"
            }}>
            💾 Exportar
          </button>
          <button onClick={() => importRef.current?.click()}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              width: "100%",
              padding: "11px 12px",
              borderRadius: 8,
              border: "none",
              cursor: "pointer",
              fontFamily: "inherit",
              fontSize: 13,
              fontWeight: 700,
              background: "rgba(74,144,217,0.06)",
              color: "#6B7A99"
            }}>
            📂 Importar
          </button>
        </div>

        <div style={{ padding: "16px 20px", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
          <div style={{ fontSize: 11, color: "#6B7A99" }}>Total de OS</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: "#fff" }}>{os.length}</div>
        </div>
      </div>

      {/* Conteúdo Principal */}
      <div style={{ marginLeft: isMobile ? 0 : 220, padding: isMobile ? "16px 12px 16px 12px" : "32px", paddingTop: isMobile ? 64 : 32, minHeight: "100vh" }}>
        {view === "lista" && (
          <div>
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 24, fontWeight: 700 }}>Solicitações</div>
              <div style={{ fontSize: 13, color: "#6B7A99", marginTop: 2 }}>
                {lista.length} OS encontrada{lista.length !== 1 ? "s" : ""}
              </div>
            </div>

            <div style={{ ...card, padding: "14px 20px", marginBottom: 16, display: "flex", gap: 12, flexWrap: "wrap" }}>
              <input placeholder="Buscar ID, campanha, cliente..." value={lBusca} onChange={e => setLBusca(e.target.value)} style={{ ...inp, marginTop: 0, flex: 1, minWidth: 200 }} />
              <select value={lCliente} onChange={e => setLCliente(e.target.value)} style={{ ...inp, marginTop: 0, width: "auto" }}><option value="">Todos clientes</option>{clientes.map(c => <option key={c} value={c}>{c}</option>)}</select>
              <select value={lPraca} onChange={e => setLPraca(e.target.value)} style={{ ...inp, marginTop: 0, width: "auto" }}><option value="">Todas praças</option>{pracas.map(p => <option key={p} value={p}>{p}</option>)}</select>
            </div>

            <div style={{ ...card, padding: 0, overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead><tr style={{ background: "#F8F9FB", borderBottom: "1px solid #E0E4EC" }}>{["ID", "Cliente", "Praça", "Atendimento", "Prazo", "Dias", ""].map(h => <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontWeight: 700, color: "#6B7A99", fontSize: 11, letterSpacing: 0.8 }}>{h}</th>)}</tr></thead>
                <tbody>
                  {lista.length === 0 ? <tr><td colSpan={7} style={{ padding: 32, textAlign: "center", color: "#6B7A99" }}>Nenhuma OS encontrada</td></tr> :
                    lista.map((o, i) => (
                      <tr key={o.id} style={{ borderBottom: "1px solid #F0F2F5", background: i % 2 === 0 ? "#fff" : "#FAFBFC" }}>
                        <td style={{ padding: "12px 16px" }}><span onClick={() => { setSelectedId(o.id); setView("detalhe"); }} style={{ fontWeight: 700, color: "#4A90D9", cursor: "pointer", fontFamily: "DM Mono,monospace", fontSize: 12 }}>{o.id}</span></td>
                        <td style={{ padding: "12px 16px", fontWeight: 600 }}>{o.cliente}</td>
                        <td style={{ padding: "12px 16px", color: "#6B7A99" }}>{o.praca}</td>
                        <td style={{ padding: "12px 16px", color: "#6B7A99" }}>{o.atendimento || "—"}</td>
                        <td style={{ padding: "12px 16px" }}>{fmtDate(o.prazoEntrega)}</td>
                        <td style={{ padding: "12px 16px" }}>{o.dias === null ? "—" : <span style={{ fontWeight: 700, color: o.dias < 0 ? "#E74C3C" : o.dias <= 3 ? "#F5A623" : "#27AE60" }}>{o.dias}d</span>}</td>
                        <td style={{ padding: "12px 16px" }}><button onClick={() => handleEdit(o)} style={{ background: "none", border: "1px solid #E0E4EC", borderRadius: 6, padding: "4px 10px", fontSize: 12, cursor: "pointer", color: "#4A90D9", fontFamily: "inherit" }}>Editar</button></td>
                      </tr>
                    ))
                  }
                </tbody>
              </table>
            </div>
          </div>
        )}

        {view === "nova" && (
          <div style={{ maxWidth: 740 }}>
            <div style={{ marginBottom: 24 }}><div style={{ fontSize: 24, fontWeight: 700 }}>{editId ? `Editar — ${editId}` : "Nova Solicitação"}</div><div style={{ fontSize: 13, color: "#6B7A99" }}>Importe um PDF ou preencha manualmente</div></div>
            {!editId && <div style={{ ...card, marginBottom: 20, border: "2px dashed #C8D0E0", textAlign: "center", padding: 32, cursor: "pointer", background: pdfState === "reading" ? "#F8F9FB" : "#fff" }} onClick={() => fileRef.current?.click()} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); handlePdf(e.dataTransfer.files[0]); }}>
              {pdfState === "idle" && <><div style={{ fontSize: 36, marginBottom: 8 }}>📄</div><div style={{ fontWeight: 700, fontSize: 15 }}>Arraste o PDF ou clique</div><div style={{ fontSize: 12, color: "#8899BB", marginTop: 4 }}>A IA extrai os dados automaticamente</div></>}
              {pdfState === "reading" && <><div style={{ fontSize: 36, marginBottom: 8 }}>⏳</div><div style={{ fontWeight: 700, fontSize: 15 }}>Lendo PDF...</div></>}
              {pdfState === "done" && <><div style={{ fontSize: 36, marginBottom: 8 }}>✅</div><div style={{ fontWeight: 700, fontSize: 15, color: "#27AE60" }}>{pdfMsg}</div><div style={{ fontSize: 12, color: "#8899BB", marginTop: 4 }}>Confira os campos abaixo</div></>}
              {pdfState === "error" && <><div style={{ fontSize: 36, marginBottom: 8 }}>❌</div><div style={{ fontWeight: 700, fontSize: 15, color: "#E74C3C" }}>{pdfMsg}</div></>}
            </div>}
            <div style={card}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <F label="ID da OS *" k="id" ph="CHK-000000" dis={!!editId} /><F label="Nº Campanha" k="nrCampanha" ph="460000" />
                <F label="Cliente *" k="cliente" ph="Nome do cliente" /><F label="Praça Exibidora" k="praca" ph="FORTALEZA" />
                <F label="OPEC Solicitante" k="opec" ph="Nome" /><F label="Atendimento" k="atendimento" ph="Nome" />
                <F label="Data Solicitação" k="dataSolicitacao" type="date" /><F label="Qtd. Pontos" k="qtdPontos" type="number" ph="1" />
                <F label="Início da Campanha" k="inicio" type="date" /><F label="Fim da Campanha" k="fim" type="date" />
                <F label="Prazo Entrega *" k="prazoEntrega" type="date" />
                <div style={{ gridColumn: "span 2" }}><label style={lbl}>Formato de Checking</label><select value={form.formato} onChange={e => setForm(p => ({ ...p, formato: e.target.value }))} style={inp}>{FORMATOS.map(f => <option key={f} value={f}>{f}</option>)}</select></div>
                <F label="Nome da Campanha" k="campanha" ph="Nome completo" span={2} />
                <div style={{ gridColumn: "span 2" }}><label style={lbl}>Observações</label><textarea value={form.obs} onChange={e => setForm(p => ({ ...p, obs: e.target.value }))} rows={3} style={{ ...inp, resize: "vertical", width: "100%" }} /></div>
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
                <button onClick={handleSave} style={btn("#4A90D9", "#fff")}>{editId ? "Salvar Alterações" : "Cadastrar OS"}</button>
                <button onClick={() => { setView("lista"); setForm(emptyForm); setEditId(null); setPdfState("idle"); }} style={btn("#F0F2F5", "#6B7A99")}>Cancelar</button>
              </div>
            </div>
          </div>
        )}

        {view === "detalhe" && sel && (
          <div style={{ maxWidth: 680 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
              <button onClick={() => setView("lista")} style={btn("#F0F2F5", "#6B7A99")}>← Voltar</button>
              <div><div style={{ fontSize: 20, fontWeight: 700, fontFamily: "DM Mono,monospace" }}>{sel.id}</div><div style={{ fontSize: 13, color: "#6B7A99" }}>{sel.cliente} · {sel.praca}</div></div>
              {sel.dias !== null && <span style={{ marginLeft: "auto", background: sel.dias < 0 ? "#FDEDEC" : sel.dias <= 3 ? "#FFF8EC" : "#EAFAF1", color: sel.dias < 0 ? "#E74C3C" : sel.dias <= 3 ? "#F5A623" : "#27AE60", padding: "5px 14px", borderRadius: 20, fontSize: 12, fontWeight: 700 }}>{sel.dias < 0 ? `Vencido há ${Math.abs(sel.dias)}d` : sel.dias === 0 ? "Prazo hoje" : `${sel.dias}d restantes`}</span>}
            </div>
            <div style={{ ...card, marginBottom: 16 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                {[["Campanha", sel.campanha], ["Nº Campanha", sel.nrCampanha], ["Cliente", sel.cliente], ["Praça", sel.praca], ["OPEC", sel.opec], ["Atendimento", sel.atendimento], ["Formato", sel.formato], ["Qtd. Pontos", sel.qtdPontos], ["Início", fmtDate(sel.inicio)], ["Fim", fmtDate(sel.fim)], ["Prazo Entrega", fmtDate(sel.prazoEntrega)], ["Solicitado em", fmtDate(sel.dataSolicitacao)]].map(([k, v]) => (
                  <div key={k}><div style={lbl}>{k}</div><div style={{ fontSize: 14, fontWeight: 500, marginTop: 4 }}>{v || "—"}</div></div>
                ))}
              </div>
              {sel.obs && <div style={{ marginTop: 20, padding: "12px 16px", background: "#FFF8EC", borderRadius: 8, borderLeft: "3px solid #F5A623" }}><div style={{ fontSize: 11, fontWeight: 700, color: "#F5A623", marginBottom: 4 }}>OBSERVAÇÕES</div><div style={{ fontSize: 13 }}>{sel.obs}</div></div>}
              <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
                <button onClick={() => handleEdit(sel)} style={btn("#4A90D9", "#fff")}>Editar OS</button>
                <button onClick={() => { if (window.confirm("Remover esta OS?")) handleDel(sel.id); }} style={btn("#FDEDEC", "#E74C3C")}>Remover</button>
              </div>
            </div>
          </div>
        )}

        {view === "dashboard" && (
          <div>
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 24, fontWeight: 700 }}>Dashboard</div>
              <div style={{ fontSize: 13, color: "#6B7A99", marginTop: 2 }}>Visão geral de todas as OS</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2,1fr)" : "repeat(4,1fr)", gap: isMobile ? 10 : 16, marginBottom: 24 }}>
              <KpiCard icon="📋" value={os.length} label="Total de OS" color="#4A90D9" />
              <KpiCard icon="✅" value={os.filter(o => diasRestantes(o.prazoEntrega) >= 0).length} label="Dentro do Prazo" color="#27AE60" />
              <KpiCard icon="⏰" value={os.filter(o => diasRestantes(o.prazoEntrega) < 0).length} label="Vencidas" color="#E74C3C" />
              <KpiCard icon="📊" value={os.length > 0 ? Math.round(os.filter(o => diasRestantes(o.prazoEntrega) >= 0).length / os.length * 100) + "%" : "—"} label="Taxa no Prazo" color="#F5A623" />
            </div>
            <div style={{ ...card, textAlign: "center", padding: 40 }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📊</div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>Dashboard em construção</div>
              <div style={{ fontSize: 13, marginTop: 4, color: "#6B7A99" }}>Gráficos e análises virão em breve</div>
            </div>
          </div>
        )}

        {view === "consulta" && (
          <div>
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 24, fontWeight: 700 }}>Consulta</div>
              <div style={{ fontSize: 13, color: "#6B7A99", marginTop: 2 }}>Filtros avançados</div>
            </div>
            <div style={{ ...card }}>
              <div style={{ fontSize: 13, color: "#6B7A99" }}>Funcionalidade em desenvolvimento</div>
            </div>
          </div>
        )}

        {showBaixa && (
          <div style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 200
          }}>
            <div style={{ ...card, maxWidth: 400, padding: 24 }}>
              <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Baixar OS Entregues</div>
              <div style={{ marginBottom: 16 }}>
                <label style={lbl}>IDs ou últimos 6 dígitos (separados por vírgula)</label>
                <textarea value={baixaInput} onChange={e => setBaixaInput(e.target.value)} placeholder="CHK-003145, CHK-003146 ou 003145, 003146" rows={3} style={{ ...inp, width: "100%", marginTop: 8 }} />
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={handleBaixa} style={btn("#27AE60", "#fff")}>Confirmar Baixa</button>
                <button onClick={() => setShowBaixa(false)} style={btn("#F0F2F5", "#6B7A99")}>Cancelar</button>
              </div>
            </div>
          </div>
        )}
      </div>

      <input ref={fileRef} type="file" accept="application/pdf" style={{ display: "none" }} onChange={e => { if (e.target.files[0]) { handlePdf(e.target.files[0]); setView("nova"); } }} />
      <input ref={importRef} type="file" accept="application/json" style={{ display: "none" }} onChange={e => { if (e.target.files[0]) handleImport(e.target.files[0]); e.target.value = ""; }} />
    </div>
  );
}
