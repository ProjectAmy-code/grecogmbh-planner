import React, { useState, useEffect, useMemo } from 'react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  onAuthStateChanged, 
  signOut,
  sendEmailVerification,
  type User 
} from 'firebase/auth';
import { auth } from './firebase';
import logoImg from './assets/logo.png';
import { 
  LogIn, 
  UserPlus, 
  LogOut, 
  Calendar, 
  ListTodo, 
  RefreshCw, 
  Activity, 
  Home, 
  Building2, 
  Menu, 
  X, 
  Euro,
  Plus,
  Trash2,
  Settings,
  ChevronDown
} from 'lucide-react';

const initialCalcData = {
  bezeichnung: '',
  wohnflaeche: '',
  grundstueck: '',
  wohneinheiten: '1',
  gewerbeheiten: '0',
  baujahr: '',
  kaufpreis: '',
  kaltmiete: '',
  grunderwerbsteuer: '6.5',
  makler: '0',
  notar: '1.5',
  grundbuchamt: '0.5',
  sonstigeNK: '0',
  renovierung: '0',
  darlehenProzent: '100',
  zins: '',
  tilgung: '',
  mietausfall: '3',
  instandhaltungQm: '15',
  hausgeld: '1000',
  bodenrichtwert: '0',
  kaufAls: 'GmbH',
  gebaeudeQuote: '75',
  haltezeit: '10',
  wertsteigerung: '2',
  abschreibung: '2'
};

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [regStep, setRegStep] = useState(1); // 1: Email, 2: Password
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [activeImmoTab, setActiveImmoTab] = useState('portfolio'); // 'portfolio' oder 'akquise'
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState({
    objektdaten: false,
    nebenkosten: true,
    finanzierung: false
  });
  
  const toggleSection = (section: keyof typeof collapsedSections) => {
    setCollapsedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };
  
  // Potential Objects & Calculator States
  const [calcData, setCalcData] = useState(initialCalcData);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [objects, setObjects] = useState<any[]>([]);
  const [newObject, setNewObject] = useState({ address: '', price: '', rent: '', date: '', notes: '' });

  // Portfolio & Task States
  const [portfolio, setPortfolio] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [isLogOpen, setIsLogOpen] = useState(false);
  const [newTask, setNewTask] = useState('');
  
  // Portfolio Detail States
  const [selectedPropertyId, setSelectedPropertyId] = useState<number | null>(null);
  const [isPropertyModalOpen, setIsPropertyModalOpen] = useState(false);
  const [propertyModalTab, setPropertyModalTab] = useState<'calc' | 'tasks' | 'misc'>('calc');
  const [propertyTask, setPropertyTask] = useState('');

  const results = useMemo(() => {
    const kaufpreis = parseFloat(calcData.kaufpreis) || 0;
    const kaltmiete = parseFloat(calcData.kaltmiete) || 0;
    const renovierung = parseFloat(calcData.renovierung) || 0;
    const grundstuecksflaeche = parseFloat(calcData.grundstueck) || 0;
    const sonstigeNK = parseFloat(calcData.sonstigeNK) || 0;
    
    // Nebenkosten Sätze
    const geSteuerSatz = parseFloat(calcData.grunderwerbsteuer) / 100 || 0;
    const maklerSatz = parseFloat(calcData.makler) / 100 || 0;
    const notarSatz = parseFloat(calcData.notar) / 100 || 0;
    const grundbuchSatz = parseFloat(calcData.grundbuchamt) / 100 || 0;

    // C24 – Eigenkapital = C14*(G2+G4+G6+G8)+J6
    // Wir ergänzen Logik für Finanzierung < 100%
    const darlehenProzent = parseFloat(calcData.darlehenProzent) / 100 || 0;
    const nkEuro = kaufpreis * (geSteuerSatz + maklerSatz + notarSatz + grundbuchSatz) + sonstigeNK;
    const eigenkapital = nkEuro + (kaufpreis + renovierung) * (1 - darlehenProzent);

    // C30 – Darlehenssumme = (C14+J2)*J4
    const darlehenssumme = (kaufpreis + renovierung) * darlehenProzent;

    // G24 – Zinsen pro Jahr = C30*G10
    const zinsSatz = parseFloat(calcData.zins) / 100 || 0;
    const zinsenJahr = darlehenssumme * zinsSatz;

    // G26 – Tilgung = C30*G12
    const tilgungSatz = parseFloat(calcData.tilgung) / 100 || 0;
    const tilgungJahr = darlehenssumme * tilgungSatz;

    // G28 – Rücklage Mietausfall = C16*G14
    const mietausfallPct = parseFloat(calcData.mietausfall) / 100 || 0;
    const mietausfallJahr = kaltmiete * mietausfallPct;

    // G30 – Instandhaltung = G16*C6
    const instandhaltungSatz = parseFloat(calcData.instandhaltungQm) || 0;
    // C6 ist in der Vorlage die Grundstücksfläche
    const instandhaltungJahr = instandhaltungSatz * grundstuecksflaeche;

    // Hausgeld (im Sheet als jährlicher Betrag eingegeben)
    const hausgeldJahr = parseFloat(calcData.hausgeld) || 0;

    // J22 – Cashflow NETTO = C16-G24-G26-G28-G30-G22
    // G22 ist das nicht umlagefähige Hausgeld im Sheet (jährlich)
    const cashflowNettoJahr = kaltmiete - zinsenJahr - tilgungJahr - mietausfallJahr - instandhaltungJahr - hausgeldJahr;
    const cashflowNettoMonat = cashflowNettoJahr / 12;

    // Gebäudeanteil & Abschreibung (User-Formel)
    const bodenrichtwert = parseFloat(calcData.bodenrichtwert) || 0;
    const bodenwert = grundstuecksflaeche * bodenrichtwert;
    const gebaeudeanteil = Math.max(0, kaufpreis - bodenwert);
    const abschreibungJahr = gebaeudeanteil * (parseFloat(calcData.abschreibung) / 100 || 0);

    // G38 – Steuermessbetrag = Kaltmiete - Zinsen - AfA
    const steuerMessbetrag = kaltmiete - zinsenJahr - abschreibungJahr;
    
    // G40 – Steuern (GmbH: 15,825%, Privat: 45%)
    const steuerSatz = calcData.kaufAls === 'GmbH' ? 0.15825 : 0.45;
    const steuern = steuerMessbetrag > 0 ? steuerMessbetrag * steuerSatz : 0;
    
    // J36 – CASHFLOW nach Steuer = Cashflow Netto - Steuern
    const cashflowNachSteuerJahr = cashflowNettoJahr - steuern;

    // Renditen
    const bruttorendite = kaufpreis > 0 ? (kaltmiete / kaufpreis) * 100 : 0;
    
    const kaufpreisPlusRenovierung = kaufpreis + renovierung;
    const kaufpreisPlusNK = kaufpreis + nkEuro;
    const nettoRendite = kaufpreisPlusNK > 0 ? ((kaltmiete - mietausfallJahr - instandhaltungJahr - hausgeldJahr) / kaufpreisPlusNK) * 100 : 0;

    return {
      eigenkapital,
      darlehenssumme,
      zinsenJahr,
      tilgungJahr,
      mietausfallJahr,
      instandhaltungJahr,
      hausgeldJahr,
      cashflowNettoJahr,
      cashflowNettoMonat,
      cashflowNachSteuerJahr,
      bruttorendite,
      nettoRendite,
      steuern,
      steuerMessbetrag,
      abschreibungJahr,
      gebaeudeanteil,
      kaufpreisPlusRenovierung,
      kaufpreisPlusNK,
      bodenwert
    };
  }, [calcData]);

  const handleCalcChange = (field: string, value: string) => {
    setCalcData({ ...calcData, [field]: value });
  };

  const handlePercentChange = (field: string, value: string) => {
    let num = parseFloat(value);
    if (num > 100) value = '100';
    if (num < 0) value = '0';
    setCalcData({ ...calcData, [field]: value });
  };

  const addLog = (action: string, details: string) => {
    const newLog = {
      id: Date.now(),
      timestamp: new Date().toLocaleTimeString('de-DE'),
      action,
      details
    };
    setLogs(prev => [newLog, ...prev]);
  };

  const handleEditRequest = (item: any) => {
    setCalcData(item.details);
    setEditingId(item.id);
    setIsModalOpen(true);
  };

  const handleDeleteObject = () => {
    if (!editingId) return;
    const objToDelete = objects.find(o => o.id === editingId);
    if (window.confirm(`Möchtest du das Objekt "${objToDelete?.address}" wirklich aus der Pipeline löschen?`)) {
      setObjects(objects.map(o => o.id === editingId ? { ...o, isDeleted: true } : o));
      addLog('LÖSCHEN', `Objekt "${objToDelete?.address}" wurde in den Papierkorb verschoben.`);
      setIsModalOpen(false);
      setEditingId(null);
      setCalcData(initialCalcData);
    }
  };

  const handleMoveToPortfolio = () => {
    if (!editingId) return;
    const objToMove = objects.find(o => o.id === editingId);
    if (objToMove) {
      const portfolioEntry = {
        ...objToMove,
        id: Date.now(), // Neue ID für Portfolio
        movedFromPipeline: true
      };
      setPortfolio([...portfolio, portfolioEntry]);
      setObjects(objects.map(o => o.id === editingId ? { ...o, isDeleted: true } : o));
      addLog('BESTAND', `Objekt "${objToMove.address}" wurde in den Bestand übernommen.`);
      setIsModalOpen(false);
      setEditingId(null);
      setCalcData(initialCalcData);
    }
  };

  const handleOpenPropertyDetail = (property: any) => {
    setSelectedPropertyId(property.id);
    setCalcData(property.details);
    setIsPropertyModalOpen(true);
    setPropertyModalTab('calc');
  };

  const handleUpdatePortfolioData = () => {
    if (!selectedPropertyId) return;
    setPortfolio(portfolio.map(p => p.id === selectedPropertyId ? { 
      ...p, 
      details: { ...calcData }, 
      results: { ...results },
      address: calcData.bezeichnung || p.address
    } : p));
    addLog('UPDATE', `Daten für Immobilie "${calcData.bezeichnung}" im Bestand aktualisiert.`);
    setIsPropertyModalOpen(false);
    setSelectedPropertyId(null);
    setCalcData(initialCalcData);
  };

  const handleAddPropertyTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!propertyTask.trim() || !selectedPropertyId) return;
    
    setPortfolio(portfolio.map(p => {
      if (p.id === selectedPropertyId) {
        const newTaskItem = { id: Date.now(), text: propertyTask, completed: false };
        return { ...p, tasks: [newTaskItem, ...(p.tasks || [])] };
      }
      return p;
    }));
    
    setPropertyTask('');
    addLog('TASK', `Aufgabe zur Immobilie im Bestand hinzugefügt.`);
  };

  const togglePropertyTask = (propertyId: number, taskId: number) => {
    setPortfolio(portfolio.map(p => {
      if (p.id === propertyId) {
        return { 
          ...p, 
          tasks: (p.tasks || []).map((t: any) => t.id === taskId ? { ...t, completed: !t.completed } : t) 
        };
      }
      return p;
    }));
  };

  const handleAddObject = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const address = calcData.bezeichnung || 'Unbenanntes Objekt';
    
    const entryData = {
      address: address,
      date: newObject.date || 'Kein Termin',
      notes: '',
      rendite: results.bruttorendite,
      details: { ...calcData },
      results: { ...results }
    };

    if (editingId) {
      setObjects(objects.map(o => o.id === editingId ? { ...o, ...entryData } : o));
      addLog('BEARBEITEN', `Objekt "${address}" wurde aktualisiert.`);
      setEditingId(null);
    } else {
      setObjects([...objects, { id: Date.now(), ...entryData, isDeleted: false }]);
      addLog('NEU', `Objekt "${address}" wurde zur Pipeline hinzugefügt.`);
    }
    
    // Reset form
    setCalcData(initialCalcData);
    setNewObject({ address: '', price: '', rent: '', date: '', notes: '' });
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (isRegistering) {
      if (regStep === 1) {
        if (!email) {
          setError('Bitte gib eine E-Mail-Adresse ein.');
          return;
        }
        setRegStep(2);
        return;
      }

      if (password !== confirmPassword) {
        setError('Die Passwörter stimmen nicht überein.');
        return;
      }

      try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await sendEmailVerification(userCredential.user);
        setSuccessMsg('Verifizierungs-E-Mail wurde gesendet! Bitte prüfe dein Postfach.');
      } catch (err: any) {
        setError(err.message);
      }
    } else {
      try {
        await signInWithEmailAndPassword(auth, email, password);
      } catch (err: any) {
        setError(err.message);
      }
    }
  };

  const handleLogout = () => signOut(auth);

  const resetAuth = (registering: boolean) => {
    setIsRegistering(registering);
    setRegStep(1);
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setError('');
    setSuccessMsg('');
  };

  const refreshUser = async () => {
    if (auth.currentUser) {
      await auth.currentUser.reload();
      setUser({ ...auth.currentUser });
    }
  };

  const resendVerification = async () => {
    if (auth.currentUser) {
      try {
        await sendEmailVerification(auth.currentUser);
        setSuccessMsg('E-Mail erneut gesendet!');
      } catch (err: any) {
        setError(err.message);
      }
    }
  };

  if (loading) {
    return <div className="loading-container">Lade...</div>;
  }

  // Not logged in
  if (!user) {
    return (
      <div className="auth-wrapper">
        <div className="auth-card">
          <div className="auth-header">
            <div className="logo-container">
              <img src={logoImg} alt="Greco Gruppe Logo" className="auth-logo" />
            </div>
            <h1>Greco Gruppe</h1>
            <p>{isRegistering ? 'Erstelle deinen Zugang' : 'Business Planner'}</p>
          </div>

          {error && <div className="error-msg">{error}</div>}
          {successMsg && <div className="success-msg">{successMsg}</div>}

          <form onSubmit={handleAuth}>
            {!isRegistering || regStep === 1 ? (
              <div className="form-group">
                <label>Email</label>
                <input 
                  type="email" 
                  placeholder="deine@email.de" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required 
                />
              </div>
            ) : null}

            {!isRegistering || regStep === 2 ? (
              <>
                <div className="form-group">
                  <label>Passwort</label>
                  <input 
                    type="password" 
                    placeholder="••••••••" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required 
                  />
                </div>
                {isRegistering && (
                  <div className="form-group">
                    <label>Passwort bestätigen</label>
                    <input 
                      type="password" 
                      placeholder="••••••••" 
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required 
                    />
                  </div>
                )}
              </>
            ) : null}

            <div className="auth-actions">
              {isRegistering && regStep === 2 && (
                <button type="button" onClick={() => setRegStep(1)} className="btn btn-secondary">
                  Zurück
                </button>
              )}
              <button type="submit" className="btn btn-primary">
                {!isRegistering ? <LogIn size={18} /> : (regStep === 1 ? <RefreshCw size={18} /> : <UserPlus size={18} />)}
                {!isRegistering ? 'Anmelden' : (regStep === 1 ? 'Weiter' : 'Registrieren')}
              </button>
            </div>
          </form>

          <div className="auth-footer">
            <p>
              {isRegistering ? 'Bereits ein Konto?' : 'Noch kein Konto?'}
              <button onClick={() => resetAuth(!isRegistering)}>
                {isRegistering ? 'Hier anmelden' : 'Jetzt registrieren'}
              </button>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Logged in but not verified
  if (user && !user.emailVerified) {
    return (
      <div className="auth-wrapper">
        <div className="auth-card centered">
          <div className="auth-header">
            <img src={logoImg} alt="Logo" className="verification-logo" />
            <h1>Email verifizieren</h1>
            <p>Wir haben dir eine Verifizierungs-E-Mail an <strong>{user.email}</strong> gesendet.</p>
          </div>
          
          {error && <div className="error-msg">{error}</div>}
          {successMsg && <div className="success-msg">{successMsg}</div>}

          <p className="verification-text">
            Bitte klicke auf den Link in der E-Mail, um dein Konto freizuschalten. Falls die E-Mail nicht angekommen ist, kannst du sie hier erneut anfordern.
          </p>

          <div className="verification-actions">
            <button onClick={refreshUser} className="btn btn-primary">
              <RefreshCw size={18} /> Status aktualisieren
            </button>
            <button onClick={resendVerification} className="btn btn-secondary">
              E-Mail erneut senden
            </button>
            <button onClick={handleLogout} className="btn btn-link">
              Abmelden
            </button>
          </div>
        </div>
      </div>
    );
  }

  const renderContent = () => {
    switch(activeTab) {
      case 'dashboard':
        return (
          <div className="page-content">
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h1>Hallo {user?.displayName || 'Mauro'}</h1>
                <p>Willkommen in deinem Business Planner.</p>
              </div>
              <div className="user-info" style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'white', padding: '0.5rem 1rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <span className="user-name" style={{ fontWeight: '600', fontSize: '0.9rem' }}>{user?.displayName || user?.email}</span>
                <button onClick={() => auth.signOut()} className="logout-btn" style={{ background: '#fef2f2', color: '#ef4444', border: 'none', padding: '0.4rem 0.8rem', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', fontWeight: '700' }}>
                  <RefreshCw size={14} /> Abmelden
                </button>
              </div>
            </div>
            <div className="content-grid">
              <div className="card">
                <div className="card-header">
                  <Calendar className="icon-blue" />
                  <h3>Nächste Schritte</h3>
                </div>
                <p className="card-placeholder">Keine anstehenden Termine.</p>
              </div>
              <div className="card">
                <div className="card-header">
                  <ListTodo className="icon-yellow" />
                  <h3>Projekte</h3>
                </div>
                <p className="card-placeholder">Greco GmbH Planner (In Entwicklung)</p>
              </div>
              <div className="card" onClick={() => { setActiveTab('immobilien'); setActiveImmoTab('akquise'); }} style={{ cursor: 'pointer' }}>
                <div className="card-header">
                  <Activity className="icon-green" />
                  <h3>Akquise & Pipeline</h3>
                </div>
                <p className="card-placeholder">Besichtigungen & Kalkulationen verwalten.</p>
              </div>
            </div>
          </div>
        );
      case 'immobilien':
        return (
          <div className="page-content">
            <div className="page-header">
              <h1>Immobilien</h1>
              <p>Bestand {activeImmoTab === 'portfolio' ? 'verwalten' : 'akquirieren & kalkulieren'}.</p>
            </div>

            {/* Tab Navigation */}
            <div className="tab-navigation" style={{ marginBottom: '2rem' }}>
              <button 
                onClick={() => setActiveImmoTab('portfolio')}
                className={`tab-btn ${activeImmoTab === 'portfolio' ? 'active' : ''}`}
              >
                <Building2 size={18} /> Mein Portfolio
              </button>
              <button 
                onClick={() => setActiveImmoTab('akquise')}
                className={`tab-btn ${activeImmoTab === 'akquise' ? 'active' : ''}`}
              >
                <Activity size={18} /> Akquise & Kalkulation
              </button>
            </div>

            {activeImmoTab === 'portfolio' ? (
              <>
                <div className="page-header" style={{ marginBottom: '2rem' }}>
                  <h1>Bestands-Portfolio</h1>
                  <p>Verwalte deine bereits erworbenen Immobilien.</p>
                </div>

                <div className="content-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
                  {portfolio.length === 0 ? (
                    <div className="card large-placeholder" style={{ gridColumn: '1 / -1' }}>
                      <Building2 size={48} className="placeholder-icon" />
                      <p>Du hast noch keine Immobilien im Bestand. Kalkuliere ein Objekt in der Akquise und übernehme es.</p>
                    </div>
                  ) : (
                    portfolio.map(item => (
                      <div 
                        key={item.id} 
                        className="card pipeline-card" 
                        onClick={() => handleOpenPropertyDetail(item)}
                        style={{ cursor: 'pointer' }}
                      >
                        <div className="card-header" style={{ marginBottom: '1.25rem' }}>
                          <div style={{ background: 'rgba(2, 132, 199, 0.1)', padding: '0.6rem', borderRadius: '12px' }}>
                            <Building2 className="icon-primary" size={24} />
                          </div>
                          <div>
                            <h3 style={{ margin: 0, fontSize: '1.1rem' }}>{item.address}</h3>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: '600' }}>
                              {item.details?.baujahr ? `Baujahr ${item.details.baujahr}` : 'Bestandsimmobilie'}
                            </span>
                          </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                          <div className="kpi-tag">
                            <span className="label">CASHFLOW</span>
                            <span className="val" style={{ color: item.results?.cashflowNachSteuerJahr >= 0 ? 'var(--success)' : 'var(--error)' }}>
                              {Math.round((item.results?.cashflowNachSteuerJahr || 0) / 12).toLocaleString('de-DE')} €/Mt
                            </span>
                          </div>
                          <div className="kpi-tag">
                            <span className="label">MIETE IST</span>
                            <span className="val">
                              {Math.round(parseFloat(item.details?.kaltmiete) || 0).toLocaleString('de-DE')} €/Mt
                            </span>
                          </div>
                          <div className="kpi-tag">
                            <span className="label">RENDITE</span>
                            <span className="val">
                              {(item.results?.bruttorendite || 0).toFixed(2)} %
                            </span>
                          </div>
                          <div className="kpi-tag">
                            <span className="label">AUFGABEN</span>
                            <span className="val" style={{ color: (item.tasks || []).filter((t: any) => !t.completed).length > 0 ? 'var(--primary)' : 'var(--text-secondary)' }}>
                              {(item.tasks || []).filter((t: any) => !t.completed).length} offen
                            </span>
                          </div>
                        </div>
                   
                        <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Besitzer: {item.details?.kaufAls || 'GmbH'}</span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: '800' }}>VERWALTEN →</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Portfolio Detail Modal */}
                {isPropertyModalOpen && selectedPropertyId && (
                  <div className="modal-overlay" onClick={() => { setIsPropertyModalOpen(false); setSelectedPropertyId(null); setCalcData(initialCalcData); }}>
                    <div className="modal-content large" onClick={(e) => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column', height: '90vh' }}>
                      <div className="modal-header" style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                            <div style={{ background: 'rgba(2, 132, 199, 0.1)', padding: '0.5rem', borderRadius: '10px' }}>
                               <Building2 size={20} className="icon-primary" />
                            </div>
                            <h2 style={{ margin: 0 }}>{portfolio.find(p => p.id === selectedPropertyId)?.address}</h2>
                          </div>
                          <div className="tab-nav" style={{ display: 'flex', gap: '2rem' }}>
                            <button 
                              className={`tab-link ${propertyModalTab === 'calc' ? 'active' : ''}`}
                              onClick={() => setPropertyModalTab('calc')}
                              style={{ 
                                background: 'none', 
                                border: 'none', 
                                padding: '0.5rem 0', 
                                cursor: 'pointer', 
                                fontSize: '0.9rem', 
                                fontWeight: 700,
                                color: propertyModalTab === 'calc' ? 'var(--primary)' : 'var(--text-secondary)',
                                borderBottom: propertyModalTab === 'calc' ? '3px solid var(--primary)' : '3px solid transparent',
                                transition: 'all 0.2s'
                              }}
                            >
                              KALKULATION
                            </button>
                            <button 
                              className={`tab-link ${propertyModalTab === 'tasks' ? 'active' : ''}`}
                              onClick={() => setPropertyModalTab('tasks')}
                              style={{ 
                                background: 'none', 
                                border: 'none', 
                                padding: '0.5rem 0', 
                                cursor: 'pointer', 
                                fontSize: '0.9rem', 
                                fontWeight: 700,
                                color: propertyModalTab === 'tasks' ? 'var(--primary)' : 'var(--text-secondary)',
                                borderBottom: propertyModalTab === 'tasks' ? '3px solid var(--primary)' : '3px solid transparent',
                                transition: 'all 0.2s'
                              }}
                            >
                              AUFGABEN ({(portfolio.find(p => p.id === selectedPropertyId)?.tasks || []).filter((t: any) => !t.completed).length})
                            </button>
                            <button 
                              className={`tab-link ${propertyModalTab === 'misc' ? 'active' : ''}`}
                              onClick={() => setPropertyModalTab('misc')}
                              style={{ 
                                background: 'none', 
                                border: 'none', 
                                padding: '0.5rem 0', 
                                cursor: 'pointer', 
                                fontSize: '0.9rem', 
                                fontWeight: 700,
                                color: propertyModalTab === 'misc' ? 'var(--primary)' : 'var(--text-secondary)',
                                borderBottom: propertyModalTab === 'misc' ? '3px solid var(--primary)' : '3px solid transparent',
                                transition: 'all 0.2s'
                              }}
                            >
                              SONSTIGES
                            </button>
                          </div>
                        </div>
                        <button onClick={() => { setIsPropertyModalOpen(false); setSelectedPropertyId(null); setCalcData(initialCalcData); }} className="btn-close">
                          <X size={24} />
                        </button>
                      </div>

                      <div className="modal-body" style={{ flex: 1, overflowY: 'auto', padding: '2rem' }}>
                        {propertyModalTab === 'calc' && (
                          <div className="profi-calc-grid">
                            <div style={{ gridColumn: 'span 3' }}>
                              
                              {/* Gruppe 1: Objektdaten */}
                              <div className="accordion-item">
                                <button className="accordion-header" onClick={() => toggleSection('objektdaten')}>
                                  <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                                    <Building2 size={18} /> Objektdaten
                                  </h4>
                                  <ChevronDown size={20} className={`chevron-icon ${!collapsedSections.objektdaten ? 'open' : ''}`} />
                                </button>
                                {!collapsedSections.objektdaten && (
                                  <div className="accordion-content">
                                    <div className="input-with-label" style={{ marginBottom: '1rem' }}>
                                      <label>Bezeichnung</label>
                                      <div className="input-group-text">
                                        <input type="text" placeholder="z.B. Mehrfamilienhaus Berlin" value={calcData.bezeichnung} onChange={(e) => handleCalcChange('bezeichnung', e.target.value)} />
                                      </div>
                                    </div>
                                    <div className="form-row">
                                      <div className="input-with-label">
                                        <label>Wohnfläche</label>
                                        <div className="input-group-text">
                                          <input type="number" value={calcData.wohnflaeche} onChange={(e) => handleCalcChange('wohnflaeche', e.target.value)} />
                                          <span className="unit">qm</span>
                                        </div>
                                      </div>
                                      <div className="input-with-label">
                                        <label>Grundstück</label>
                                        <div className="input-group-text">
                                          <input type="number" value={calcData.grundstueck} onChange={(e) => handleCalcChange('grundstueck', e.target.value)} />
                                          <span className="unit">qm</span>
                                        </div>
                                      </div>
                                    </div>
                                    <div className="form-row">
                                      <div className="input-with-label">
                                        <label>Wohneinheiten</label>
                                        <div className="input-group-text">
                                          <input type="number" value={calcData.wohneinheiten} onChange={(e) => handleCalcChange('wohneinheiten', e.target.value)} />
                                          <span className="unit">WE</span>
                                        </div>
                                      </div>
                                      <div className="input-with-label">
                                        <label>Gewerbeheiten</label>
                                        <div className="input-group-text">
                                          <input type="number" value={calcData.gewerbeheiten} onChange={(e) => handleCalcChange('gewerbeheiten', e.target.value)} />
                                          <span className="unit">GE</span>
                                        </div>
                                      </div>
                                    </div>
                                    <div className="form-row">
                                      <div className="input-with-label">
                                        <label>Baujahr</label>
                                        <div className="input-group-text">
                                          <input type="number" value={calcData.baujahr} onChange={(e) => handleCalcChange('baujahr', e.target.value)} />
                                          <span className="unit">Jahr</span>
                                        </div>
                                      </div>
                                      <div className="input-with-label">
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                          <label>Bodenrichtwert</label>
                                          <a href="https://geoportal.saarland.de/mapbender/frames/index.php?lang=de&gui_id=Geoportal-SL-2020&WMC=3019" target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.65rem', color: 'var(--primary)', fontWeight: '700', textDecoration: 'underline' }}>GEOPORTAL</a>
                                        </div>
                                        <div className="input-group-text">
                                          <input type="number" value={calcData.bodenrichtwert} onChange={(e) => handleCalcChange('bodenrichtwert', e.target.value)} />
                                          <span className="unit">€</span>
                                        </div>
                                      </div>
                                    </div>
                                    <div className="form-row">
                                      <div className="input-with-label">
                                        <label>Kaufpreis</label>
                                        <div className="input-group-text">
                                          <input type="number" value={calcData.kaufpreis} onChange={(e) => handleCalcChange('kaufpreis', e.target.value)} required />
                                          <span className="unit">€</span>
                                        </div>
                                      </div>
                                      <div className="input-with-label">
                                        <label>Kaltmiete / Jahr</label>
                                        <div className="input-group-text">
                                          <input type="number" value={calcData.kaltmiete} onChange={(e) => handleCalcChange('kaltmiete', e.target.value)} required />
                                          <span className="unit">€</span>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* Gruppe 2: Kaufnebenkosten */}
                              <div className="accordion-item">
                                <button className="accordion-header" onClick={() => toggleSection('nebenkosten')}>
                                  <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                                    <Plus size={18} /> Kaufnebenkosten
                                  </h4>
                                  <ChevronDown size={20} className={`chevron-icon ${!collapsedSections.nebenkosten ? 'open' : ''}`} />
                                </button>
                                {!collapsedSections.nebenkosten && (
                                  <div className="accordion-content">
                                    <div className="form-row">
                                      <div className="input-with-label">
                                        <label>Grunderwerbsteuer</label>
                                        <div className="input-group-text">
                                          <input type="number" step="0.01" value={calcData.grunderwerbsteuer} onChange={(e) => handlePercentChange('grunderwerbsteuer', e.target.value)} />
                                          <span className="unit">%</span>
                                        </div>
                                      </div>
                                      <div className="input-with-label">
                                        <label>Maklerprovision</label>
                                        <div className="input-group-text">
                                          <input type="number" step="0.01" value={calcData.makler} onChange={(e) => handlePercentChange('makler', e.target.value)} />
                                          <span className="unit">%</span>
                                        </div>
                                      </div>
                                    </div>
                                    <div className="form-row">
                                      <div className="input-with-label">
                                        <label>Notarkosten</label>
                                        <div className="input-group-text">
                                          <input type="number" step="0.01" value={calcData.notar} onChange={(e) => handlePercentChange('notar', e.target.value)} />
                                          <span className="unit">%</span>
                                        </div>
                                      </div>
                                      <div className="input-with-label">
                                        <label>Grundbuchamt</label>
                                        <div className="input-group-text">
                                          <input type="number" step="0.01" value={calcData.grundbuchamt} onChange={(e) => handlePercentChange('grundbuchamt', e.target.value)} />
                                          <span className="unit">%</span>
                                        </div>
                                      </div>
                                    </div>
                                    <div className="input-with-label" style={{ marginTop: '1rem' }}>
                                      <label>Sonstige Nebenkosten</label>
                                      <div className="input-group-text">
                                        <input type="number" value={calcData.sonstigeNK} onChange={(e) => handleCalcChange('sonstigeNK', e.target.value)} />
                                        <span className="unit">€</span>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* Gruppe 3: Finanzierung & Bewirtschaftung */}
                              <div className="accordion-item">
                                <button className="accordion-header" onClick={() => toggleSection('finanzierung')}>
                                  <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                                    <Euro size={18} /> Finanzierung & Bewirtsch.
                                  </h4>
                                  <ChevronDown size={20} className={`chevron-icon ${!collapsedSections.finanzierung ? 'open' : ''}`} />
                                </button>
                                {!collapsedSections.finanzierung && (
                                  <div className="accordion-content">
                                    <div className="form-row">
                                      <div className="input-with-label">
                                        <label>Zinssatz / Jahr</label>
                                        <div className="input-group-text">
                                          <input type="number" step="0.01" value={calcData.zins} onChange={(e) => handlePercentChange('zins', e.target.value)} />
                                          <span className="unit">%</span>
                                        </div>
                                      </div>
                                      <div className="input-with-label">
                                        <label>Tilgungssatz</label>
                                        <div className="input-group-text">
                                          <input type="number" step="0.01" value={calcData.tilgung} onChange={(e) => handlePercentChange('tilgung', e.target.value)} />
                                          <span className="unit">%</span>
                                        </div>
                                      </div>
                                    </div>
                                    <div className="form-row">
                                      <div className="input-with-label">
                                        <label>Rücklage Mietausfall</label>
                                        <div className="input-group-text">
                                          <input type="number" step="0.01" value={calcData.mietausfall} onChange={(e) => handlePercentChange('mietausfall', e.target.value)} />
                                          <span className="unit">%</span>
                                        </div>
                                      </div>
                                      <div className="input-with-label">
                                        <label>Instandh. / qm</label>
                                        <div className="input-group-text">
                                          <input type="number" step="0.01" value={calcData.instandhaltungQm} onChange={(e) => handleCalcChange('instandhaltungQm', e.target.value)} />
                                          <span className="unit">€</span>
                                        </div>
                                      </div>
                                    </div>
                                    <div className="input-with-label" style={{ marginTop: '0.75rem' }}>
                                      <label>Renovierungskosten</label>
                                      <div className="input-group-text">
                                        <input type="number" value={calcData.renovierung} onChange={(e) => handleCalcChange('renovierung', e.target.value)} />
                                        <span className="unit">€</span>
                                      </div>
                                    </div>
                                    <div className="input-with-label" style={{ marginTop: '0.5rem' }}>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <label>Darlehenshöhe</label>
                                        <span style={{ fontSize: '0.65rem', color: 'var(--primary)', fontWeight: '700' }}>100% = OHNE NEBENKOSTEN</span>
                                      </div>
                                      <div className="input-group-text">
                                        <input type="number" value={calcData.darlehenProzent} onChange={(e) => handlePercentChange('darlehenProzent', e.target.value)} />
                                        <span className="unit">%</span>
                                      </div>
                                    </div>
                                    <div className="form-row" style={{ marginTop: '0.5rem' }}>
                                      <div className="input-with-label">
                                        <label>Abschreibung</label>
                                        <div className="input-group-text">
                                          <input type="number" step="0.1" value={calcData.abschreibung} onChange={(e) => handleCalcChange('abschreibung', e.target.value)} />
                                          <span className="unit">%</span>
                                        </div>
                                      </div>
                                      <div className="input-with-label">
                                        <label>Hausgeld (n. uml.) / Jahr</label>
                                        <div className="input-group-text">
                                          <input type="number" value={calcData.hausgeld} onChange={(e) => handleCalcChange('hausgeld', e.target.value)} />
                                          <span className="unit">€/J</span>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Spalte 2 (KPIs) */}
                            <div style={{ minWidth: '300px' }}>
                              <h4 style={{ fontSize: '0.8rem', fontWeight: '800', color: 'var(--primary)', textTransform: 'uppercase', marginBottom: '1rem' }}>Berechnung Cashflow Netto</h4>
                              
                              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                                <label style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Kauf als...</label>
                                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                                  <button 
                                    onClick={() => handleCalcChange('kaufAls', 'Privat')}
                                    style={{ 
                                      flex: 1, 
                                      padding: '0.6rem', 
                                      borderRadius: '10px', 
                                      border: '2px solid',
                                      borderColor: calcData.kaufAls === 'Privat' ? 'var(--primary)' : '#e2e8f0',
                                      background: calcData.kaufAls === 'Privat' ? 'var(--primary)' : 'white',
                                      color: calcData.kaufAls === 'Privat' ? 'white' : 'var(--text-secondary)',
                                      fontWeight: '700',
                                      cursor: 'pointer',
                                      transition: 'all 0.2s'
                                    }}
                                  >
                                    Privat
                                  </button>
                                  <button 
                                    onClick={() => handleCalcChange('kaufAls', 'GmbH')}
                                    style={{ 
                                      flex: 1, 
                                      padding: '0.6rem', 
                                      borderRadius: '10px', 
                                      border: '2px solid',
                                      borderColor: calcData.kaufAls === 'GmbH' ? 'var(--primary)' : '#e2e8f0',
                                      background: calcData.kaufAls === 'GmbH' ? 'var(--primary)' : 'white',
                                      color: calcData.kaufAls === 'GmbH' ? 'white' : 'var(--text-secondary)',
                                      fontWeight: '700',
                                      cursor: 'pointer',
                                      transition: 'all 0.2s'
                                    }}
                                  >
                                    GmbH
                                  </button>
                                </div>
                              </div>

                              <div className="results-preview-box" style={{ marginTop: '0' }}>
                                  <div className="preview-item highlight">
                                   <span>Cashflow Netto:</span>
                                   <div style={{ textAlign: 'right' }}>
                                     <div style={{ fontSize: '1.2rem', fontWeight: '900', color: results.cashflowNachSteuerJahr >= 0 ? '#4ade80' : '#f87171' }}>
                                       {Math.round(results.cashflowNachSteuerJahr / 12).toLocaleString('de-DE')} € <small style={{ fontSize: '0.7rem', opacity: 0.8 }}>/ Mt</small>
                                     </div>
                                     <div style={{ fontSize: '0.8rem', opacity: 0.9 }}>
                                       {Math.round(results.cashflowNachSteuerJahr).toLocaleString('de-DE')} € <small style={{ opacity: 0.8 }}>/ Jahr</small>
                                     </div>
                                   </div>
                                 </div>
                                 <div className="preview-item">
                                   <span>Eigenkapital nötig:</span>
                                   <span>{Math.round(results.eigenkapital).toLocaleString('de-DE')} €</span>
                                 </div>
                                 <div className="preview-item">
                                   <span>Darlehenssumme:</span>
                                   <span>{Math.round(results.darlehenssumme).toLocaleString('de-DE')} €</span>
                                 </div>
                                 <div className="preview-item">
                                   <span>Steuermessbetrag:</span>
                                   <span>{Math.round(results.steuerMessbetrag).toLocaleString('de-DE')} €</span>
                                 </div>
                                 <div className="preview-item">
                                   <span>Steuern:</span>
                                   <span>{Math.round(results.steuern).toLocaleString('de-DE')} €</span>
                                 </div>
                                 <div className="preview-item">
                                   <span>Gebäudeanteil:</span>
                                   <span>{Math.round(results.gebaeudeanteil).toLocaleString('de-DE')} €</span>
                                 </div>
                                 <div className="preview-item">
                                   <span>Abschreibung / Jahr:</span>
                                   <span style={{ color: '#94a3b8' }}>{Math.round(results.abschreibungJahr).toLocaleString('de-DE')} €</span>
                                 </div>
                                 <div className="preview-item">
                                   <span>Bruttorendite:</span>
                                   <span>{results.bruttorendite.toFixed(2)} %</span>
                                 </div>
                                 <div className="preview-item">
                                   <span>Netto Rendite:</span>
                                   <span style={{ color: '#4ade80' }}>{results.nettoRendite.toFixed(2)} %</span>
                                 </div>

                                 <button onClick={handleUpdatePortfolioData} className="btn btn-primary" style={{ marginTop: '2rem', width: '100%', padding: '1rem' }}>
                                   Änderungen speichern
                                 </button>
                              </div>
                            </div>
                          </div>
                        )}

                        {propertyModalTab === 'tasks' && (
                          <div style={{ maxWidth: '800px', margin: '0 auto' }}>
                            <form onSubmit={handleAddPropertyTask} style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
                              <input 
                                type="text" 
                                placeholder="Neue Aufgabe für dieses Objekt..." 
                                value={propertyTask}
                                onChange={(e) => setPropertyTask(e.target.value)}
                                style={{ flex: 1, padding: '1rem', borderRadius: '14px', border: '1px solid #e2e8f0' }}
                              />
                              <button type="submit" className="btn btn-primary" style={{ width: 'auto' }}>Hinzufügen</button>
                            </form>
                            
                            <div style={{ display: 'grid', gap: '1rem' }}>
                              {(portfolio.find(p => p.id === selectedPropertyId)?.tasks || []).length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '4rem', opacity: 0.5 }}>
                                  <Activity size={48} style={{ marginBottom: '1rem' }} />
                                  <p>Keine Aufgaben für diese Immobilie.</p>
                                </div>
                              ) : (
                                portfolio.find(p => p.id === selectedPropertyId)?.tasks.map((t: any) => (
                                  <div key={t.id} className="card" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', background: t.completed ? '#f8fafc' : 'white' }}>
                                    <input 
                                      type="checkbox" 
                                      checked={t.completed} 
                                      onChange={() => togglePropertyTask(selectedPropertyId!, t.id)}
                                      style={{ width: '22px', height: '22px', cursor: 'pointer' }}
                                    />
                                    <span style={{ flex: 1, fontWeight: 600, textDecoration: t.completed ? 'line-through' : 'none', color: t.completed ? 'var(--text-secondary)' : 'var(--text-primary)' }}>
                                      {t.text}
                                    </span>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        )}

                        {propertyModalTab === 'misc' && (
                          <div style={{ textAlign: 'center', padding: '5rem', opacity: 0.3 }}>
                            <Activity size={64} style={{ marginBottom: '1.5rem' }} />
                            <h3>Zukünftige Erweiterung</h3>
                            <p>Hier kannst du bald Dokumente und Notizen verwalten.</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </>
            ) : (
              // AKQUISE TAB
              <>
                <div className="action-bar" style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'center' }}>
                  <button 
                    className="btn btn-primary" 
                    style={{ 
                      padding: '1.2rem 2.5rem', 
                      borderRadius: '16px', 
                      fontSize: '1.1rem', 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '1rem',
                      boxShadow: '0 10px 25px rgba(14, 165, 233, 0.4)'
                    }}
                    onClick={() => {
                      setEditingId(null);
                      setCalcData(initialCalcData);
                      setIsModalOpen(true);
                    }}
                  >
                    <Plus size={24} /> Neues Objekt kalkulieren
                  </button>
                </div>

                      {/* Modal für den Kalkulator */}
                      {isModalOpen && (
                        <div className="modal-overlay" onClick={() => { setIsModalOpen(false); setEditingId(null); setCalcData(initialCalcData); }}>
                          <div className="modal-content large" onClick={(e) => e.stopPropagation()}>
                            <div className="modal-header">
                              <h2>{editingId ? 'Objekt bearbeiten' : 'Profi-Immobilien-Kalkulator'}</h2>
                              <button onClick={() => { setIsModalOpen(false); setEditingId(null); setCalcData(initialCalcData); }} className="btn-close">
                                <X size={24} />
                              </button>
                            </div>
                            
                            <div className="modal-body">
                              <div className="profi-calc-grid">
                                <div style={{ gridColumn: 'span 3' }}>
                                  
                                  {/* Gruppe 1: Objektdaten */}
                                  <div className="accordion-item">
                                    <button className="accordion-header" onClick={() => toggleSection('objektdaten')}>
                                      <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                                        <Building2 size={18} /> Objektdaten
                                      </h4>
                                      <ChevronDown size={20} className={`chevron-icon ${!collapsedSections.objektdaten ? 'open' : ''}`} />
                                    </button>
                                    {!collapsedSections.objektdaten && (
                                      <div className="accordion-content">
                                        <div className="input-with-label" style={{ marginBottom: '1rem' }}>
                                          <label>Bezeichnung</label>
                                          <div className="input-group-text">
                                            <input type="text" placeholder="z.B. Mehrfamilienhaus Berlin" value={calcData.bezeichnung} onChange={(e) => setCalcData({...calcData, bezeichnung: e.target.value})} />
                                          </div>
                                        </div>
                                        <div className="form-row">
                                          <div className="input-with-label">
                                            <label>Wohnfläche</label>
                                            <div className="input-group-text">
                                              <input type="number" value={calcData.wohnflaeche} onChange={(e) => setCalcData({...calcData, wohnflaeche: e.target.value})} />
                                              <span className="unit">qm</span>
                                            </div>
                                          </div>
                                          <div className="input-with-label">
                                            <label>Grundstück</label>
                                            <div className="input-group-text">
                                              <input type="number" value={calcData.grundstueck} onChange={(e) => setCalcData({...calcData, grundstueck: e.target.value})} />
                                              <span className="unit">qm</span>
                                            </div>
                                          </div>
                                        </div>
                                        <div className="form-row">
                                          <div className="input-with-label">
                                            <label>Wohneinheiten</label>
                                            <div className="input-group-text">
                                              <input type="number" value={calcData.wohneinheiten} onChange={(e) => setCalcData({...calcData, wohneinheiten: e.target.value})} />
                                              <span className="unit">WE</span>
                                            </div>
                                          </div>
                                          <div className="input-with-label">
                                            <label>Gewerbeheiten</label>
                                            <div className="input-group-text">
                                              <input type="number" value={calcData.gewerbeheiten} onChange={(e) => setCalcData({...calcData, gewerbeheiten: e.target.value})} />
                                              <span className="unit">GE</span>
                                            </div>
                                          </div>
                                        </div>
                                        <div className="form-row">
                                          <div className="input-with-label">
                                            <label>Baujahr</label>
                                            <div className="input-group-text">
                                              <input type="number" value={calcData.baujahr} onChange={(e) => setCalcData({...calcData, baujahr: e.target.value})} />
                                              <span className="unit">Jahr</span>
                                            </div>
                                          </div>
                                          <div className="input-with-label">
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                              <label>Bodenrichtwert</label>
                                              <a href="https://geoportal.saarland.de/mapbender/frames/index.php?lang=de&gui_id=Geoportal-SL-2020&WMC=3019" target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.65rem', color: 'var(--primary)', fontWeight: '700', textDecoration: 'underline' }}>GEOPORTAL</a>
                                            </div>
                                            <div className="input-group-text">
                                              <input type="number" value={calcData.bodenrichtwert} onChange={(e) => setCalcData({...calcData, bodenrichtwert: e.target.value})} />
                                              <span className="unit">€</span>
                                            </div>
                                          </div>
                                        </div>
                                        <div className="form-row">
                                          <div className="input-with-label">
                                            <label>Kaufpreis</label>
                                            <div className="input-group-text">
                                              <input type="number" value={calcData.kaufpreis} onChange={(e) => setCalcData({...calcData, kaufpreis: e.target.value})} required />
                                              <span className="unit">€</span>
                                            </div>
                                          </div>
                                          <div className="input-with-label">
                                            <label>Kaltmiete / Jahr</label>
                                            <div className="input-group-text">
                                              <input type="number" value={calcData.kaltmiete} onChange={(e) => setCalcData({...calcData, kaltmiete: e.target.value})} required />
                                              <span className="unit">€</span>
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    )}
                                  </div>

                                  {/* Gruppe 2: Kaufnebenkosten */}
                                  <div className="accordion-item">
                                    <button className="accordion-header" onClick={() => toggleSection('nebenkosten')}>
                                      <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                                        <Plus size={18} /> Kaufnebenkosten
                                      </h4>
                                      <ChevronDown size={20} className={`chevron-icon ${!collapsedSections.nebenkosten ? 'open' : ''}`} />
                                    </button>
                                    {!collapsedSections.nebenkosten && (
                                      <div className="accordion-content">
                                        <div className="form-row">
                                          <div className="input-with-label">
                                            <label>Grunderwerbsteuer</label>
                                            <div className="input-group-text">
                                              <input type="number" step="0.01" value={calcData.grunderwerbsteuer} onChange={(e) => handlePercentChange('grunderwerbsteuer', e.target.value)} />
                                              <span className="unit">%</span>
                                            </div>
                                          </div>
                                          <div className="input-with-label">
                                            <label>Maklerprovision</label>
                                            <div className="input-group-text">
                                              <input type="number" step="0.01" value={calcData.makler} onChange={(e) => handlePercentChange('makler', e.target.value)} />
                                              <span className="unit">%</span>
                                            </div>
                                          </div>
                                        </div>
                                        <div className="form-row">
                                          <div className="input-with-label">
                                            <label>Notarkosten</label>
                                            <div className="input-group-text">
                                              <input type="number" step="0.01" value={calcData.notar} onChange={(e) => handlePercentChange('notar', e.target.value)} />
                                              <span className="unit">%</span>
                                            </div>
                                          </div>
                                          <div className="input-with-label">
                                            <label>Grundbuchamt</label>
                                            <div className="input-group-text">
                                              <input type="number" step="0.01" value={calcData.grundbuchamt} onChange={(e) => handlePercentChange('grundbuchamt', e.target.value)} />
                                              <span className="unit">%</span>
                                            </div>
                                          </div>
                                        </div>
                                        <div className="input-with-label" style={{ marginTop: '1rem' }}>
                                          <label>Sonstige Nebenkosten</label>
                                          <div className="input-group-text">
                                            <input type="number" value={calcData.sonstigeNK} onChange={(e) => setCalcData({...calcData, sonstigeNK: e.target.value})} />
                                            <span className="unit">€</span>
                                          </div>
                                        </div>
                                      </div>
                                    )}
                                  </div>

                                  {/* Gruppe 3: Finanzierung & Bewirtschaftung */}
                                  <div className="accordion-item">
                                    <button className="accordion-header" onClick={() => toggleSection('finanzierung')}>
                                      <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                                        <Euro size={18} /> Finanzierung & Bewirtsch.
                                      </h4>
                                      <ChevronDown size={20} className={`chevron-icon ${!collapsedSections.finanzierung ? 'open' : ''}`} />
                                    </button>
                                    {!collapsedSections.finanzierung && (
                                      <div className="accordion-content">
                                        <div className="form-row">
                                          <div className="input-with-label">
                                            <label>Zinssatz / Jahr</label>
                                            <div className="input-group-text">
                                              <input type="number" step="0.01" value={calcData.zins} onChange={(e) => handlePercentChange('zins', e.target.value)} />
                                              <span className="unit">%</span>
                                            </div>
                                          </div>
                                          <div className="input-with-label">
                                            <label>Tilgungssatz</label>
                                            <div className="input-group-text">
                                              <input type="number" step="0.01" value={calcData.tilgung} onChange={(e) => handlePercentChange('tilgung', e.target.value)} />
                                              <span className="unit">%</span>
                                            </div>
                                          </div>
                                        </div>
                                        <div className="form-row">
                                          <div className="input-with-label">
                                            <label>Rücklage Mietausfall</label>
                                            <div className="input-group-text">
                                              <input type="number" step="0.01" value={calcData.mietausfall} onChange={(e) => handlePercentChange('mietausfall', e.target.value)} />
                                              <span className="unit">%</span>
                                            </div>
                                          </div>
                                          <div className="input-with-label">
                                            <label>Instandh. / qm</label>
                                            <div className="input-group-text">
                                              <input type="number" step="0.01" value={calcData.instandhaltungQm} onChange={(e) => setCalcData({...calcData, instandhaltungQm: e.target.value})} />
                                              <span className="unit">€</span>
                                            </div>
                                          </div>
                                        </div>
                                        <div className="input-with-label" style={{ marginTop: '0.75rem' }}>
                                          <label>Renovierungskosten</label>
                                          <div className="input-group-text">
                                            <input type="number" value={calcData.renovierung} onChange={(e) => setCalcData({...calcData, renovierung: e.target.value})} />
                                            <span className="unit">€</span>
                                          </div>
                                        </div>
                                        <div className="input-with-label" style={{ marginTop: '0.5rem' }}>
                                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <label>Darlehenshöhe</label>
                                            <span style={{ fontSize: '0.65rem', color: 'var(--primary)', fontWeight: '700' }}>100% = OHNE NEBENKOSTEN</span>
                                          </div>
                                          <div className="input-group-text">
                                            <input type="number" value={calcData.darlehenProzent} onChange={(e) => handlePercentChange('darlehenProzent', e.target.value)} />
                                            <span className="unit">%</span>
                                          </div>
                                        </div>
                                        <div className="form-row" style={{ marginTop: '0.5rem' }}>
                                          <div className="input-with-label">
                                            <label>Abschreibung</label>
                                            <div className="input-group-text">
                                              <input type="number" step="0.1" value={calcData.abschreibung} onChange={(e) => setCalcData({...calcData, abschreibung: e.target.value})} />
                                              <span className="unit">%</span>
                                            </div>
                                          </div>
                                          <div className="input-with-label">
                                            <label>Hausgeld (n. uml.) / Jahr</label>
                                            <div className="input-group-text">
                                              <input type="number" value={calcData.hausgeld} onChange={(e) => setCalcData({...calcData, hausgeld: e.target.value})} />
                                              <span className="unit">€/J</span>
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Spalte 4 (KPIs) */}
                                <div style={{ minWidth: '300px' }}>
                                  <h4 style={{ fontSize: '0.8rem', fontWeight: '800', color: 'var(--primary)', textTransform: 'uppercase', marginBottom: '1rem' }}>Berechnung Cashflow Netto</h4>
                                  
                                  <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                                    <label style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Kauf als...</label>
                                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                                      <button 
                                        onClick={() => setCalcData({...calcData, kaufAls: 'Privat'})}
                                        style={{ 
                                          flex: 1, 
                                          padding: '0.6rem', 
                                          borderRadius: '10px', 
                                          border: '2px solid',
                                          borderColor: calcData.kaufAls === 'Privat' ? 'var(--primary)' : '#e2e8f0',
                                          background: calcData.kaufAls === 'Privat' ? 'var(--primary)' : 'white',
                                          color: calcData.kaufAls === 'Privat' ? 'white' : 'var(--text-secondary)',
                                          fontWeight: '700',
                                          cursor: 'pointer',
                                          transition: 'all 0.2s'
                                        }}
                                      >
                                        Privat
                                      </button>
                                      <button 
                                        onClick={() => handleCalcChange('kaufAls', 'GmbH')}
                                        style={{ 
                                          flex: 1, 
                                          padding: '0.6rem', 
                                          borderRadius: '10px', 
                                          border: '2px solid',
                                          borderColor: calcData.kaufAls === 'GmbH' ? 'var(--primary)' : '#e2e8f0',
                                          background: calcData.kaufAls === 'GmbH' ? 'var(--primary)' : 'white',
                                          color: calcData.kaufAls === 'GmbH' ? 'white' : 'var(--text-secondary)',
                                          fontWeight: '700',
                                          cursor: 'pointer',
                                          transition: 'all 0.2s'
                                        }}
                                      >
                                        GmbH
                                      </button>
                                    </div>
                                  </div>

                                  <div className="results-preview-box" style={{ marginTop: '0' }}>
                                      <div className="preview-item highlight">
                                       <span>Cashflow Netto:</span>
                                       <div style={{ textAlign: 'right' }}>
                                         <div style={{ fontSize: '1.2rem', fontWeight: '900', color: results.cashflowNachSteuerJahr >= 0 ? '#4ade80' : '#f87171' }}>
                                           {Math.round(results.cashflowNachSteuerJahr / 12).toLocaleString('de-DE')} € <small style={{ fontSize: '0.7rem', opacity: 0.8 }}>/ Mt</small>
                                         </div>
                                         <div style={{ fontSize: '0.8rem', opacity: 0.9 }}>
                                           {Math.round(results.cashflowNachSteuerJahr).toLocaleString('de-DE')} € <small style={{ opacity: 0.8 }}>/ Jahr</small>
                                         </div>
                                       </div>
                                     </div>
                                     <div className="preview-item">
                                       <span>Eigenkapital nötig:</span>
                                       <span>{Math.round(results.eigenkapital).toLocaleString('de-DE')} €</span>
                                     </div>
                                     <div className="preview-item">
                                       <span>Darlehenssumme:</span>
                                       <span>{Math.round(results.darlehenssumme).toLocaleString('de-DE')} €</span>
                                     </div>
                                     <div className="preview-item">
                                       <span>Steuermessbetrag:</span>
                                       <span>{Math.round(results.steuerMessbetrag).toLocaleString('de-DE')} €</span>
                                     </div>
                                     <div className="preview-item">
                                       <span>Steuern:</span>
                                       <span>{Math.round(results.steuern).toLocaleString('de-DE')} €</span>
                                     </div>
                                     <div className="preview-item">
                                       <span>Gebäudeanteil:</span>
                                       <span>{Math.round(results.gebaeudeanteil).toLocaleString('de-DE')} €</span>
                                     </div>
                                     <div className="preview-item">
                                       <span>Abschreibung / Jahr:</span>
                                       <span style={{ color: '#94a3b8' }}>{Math.round(results.abschreibungJahr).toLocaleString('de-DE')} €</span>
                                     </div>
                                     <div className="preview-item">
                                       <span>Bruttorendite:</span>
                                       <span>{results.bruttorendite.toFixed(2)} %</span>
                                     </div>
                                     <div className="preview-item">
                                       <span>Netto Rendite:</span>
                                       <span style={{ color: '#4ade80' }}>{results.nettoRendite.toFixed(2)} %</span>
                                     </div>
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="modal-footer">
                               <div style={{ display: 'flex', gap: '0.75rem', width: '100%' }}>
                                 {editingId && (
                                   <>
                                     <button 
                                       onClick={handleDeleteObject} 
                                       className="btn btn-secondary" 
                                       style={{ color: 'var(--error)', borderColor: 'var(--error)' }}
                                     >
                                       <Trash2 size={18} /> Objekt löschen
                                     </button>
                                     <button 
                                       onClick={handleMoveToPortfolio} 
                                       className="btn btn-secondary" 
                                       style={{ color: 'var(--success)', borderColor: 'var(--success)' }}
                                     >
                                       <Building2 size={18} /> In den Bestand übernehmen
                                     </button>
                                   </>
                                 )}
                                 <button 
                                   onClick={() => { setIsModalOpen(false); setEditingId(null); setCalcData(initialCalcData); }} 
                                   className="btn btn-secondary" 
                                   style={{ marginLeft: 'auto' }}
                                 >
                                   Abbrechen
                                 </button>
                                 <button 
                                   onClick={() => { handleAddObject(); setIsModalOpen(false); }} 
                                   className="btn btn-primary"
                                 >
                                   {editingId ? 'Änderungen speichern' : 'Objekt zur Pipeline hinzufügen'}
                                 </button>
                               </div>
                            </div>
                          </div>
                        </div>
                      )}


                <div className="content-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
                  {objects.filter(o => !o.isDeleted).length === 0 ? (
                    <div className="card large-placeholder" style={{ gridColumn: '1 / -1' }}>
                      <Activity size={48} className="placeholder-icon" />
                      <p>Keine Objekte in der Akquise-Pipeline. Nutze den Kalkulator oben.</p>
                    </div>
                  ) : (
                    objects.filter(o => !o.isDeleted).map(item => (
                      <div 
                        key={item.id} 
                        className="card pipeline-card" 
                        onClick={() => handleEditRequest(item)}
                        style={{ cursor: 'pointer', transition: 'transform 0.2s, box-shadow 0.2s' }}
                      >
                        <div className="card-header" style={{ marginBottom: '1.25rem' }}>
                          <div style={{ background: 'rgba(2, 132, 199, 0.1)', padding: '0.6rem', borderRadius: '12px' }}>
                            <Building2 className="icon-primary" size={24} />
                          </div>
                          <div>
                            <h3 style={{ margin: 0, fontSize: '1.1rem' }}>{item.address}</h3>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: '600' }}>
                              Zuletzt kalkuliert: {new Date(item.id).toLocaleDateString('de-DE')}
                            </span>
                          </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                          <div className="kpi-tag">
                            <span className="label">CASHFLOW</span>
                            <span className="val" style={{ color: item.results.cashflowNachSteuerJahr >= 0 ? 'var(--success)' : 'var(--error)' }}>
                              {Math.round(item.results.cashflowNachSteuerJahr / 12).toLocaleString('de-DE')} €/Mt
                            </span>
                          </div>
                          <div className="kpi-tag">
                            <span className="label">EK NÖTIG</span>
                            <span className="val">
                              {Math.round(item.results.eigenkapital).toLocaleString('de-DE')} €
                            </span>
                          </div>
                          <div className="kpi-tag">
                            <span className="label">BRUTTO-RENDITE</span>
                            <span className="val">
                              {item.results.bruttorendite.toFixed(2)} %
                            </span>
                          </div>
                          <div className="kpi-tag">
                            <span className="label">GEBÄUDEANTEIL</span>
                            <span className="val">
                              {Math.round(item.results.gebaeudeanteil).toLocaleString('de-DE')} €
                            </span>
                          </div>
                        </div>
                   
                        <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Kauf als {item.details.kaufAls}</span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: '800' }}>DETAILS BEARBEITEN →</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Log-Viewer am Seitenende */}
                <div className={`log-viewer ${isLogOpen ? 'open' : ''}`}>
                  <button className="log-toggle" onClick={() => setIsLogOpen(!isLogOpen)}>
                    <div className="log-summary">
                      <Settings size={14} />
                      <span>Transaktions-Log ({logs.length})</span>
                      <ChevronDown size={14} style={{ transform: isLogOpen ? 'rotate(180deg)' : 'none' }} />
                    </div>
                  </button>
                  {isLogOpen && (
                    <div className="log-content">
                      {logs.length === 0 ? (
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', textAlign: 'center' }}>Keine Einträge vorhanden.</p>
                      ) : (
                        <div className="log-list">
                          {logs.map(log => (
                            <div key={log.id} className="log-item">
                              <span className="log-time">{log.timestamp}</span>
                              <span className="log-action">{log.action}</span>
                              <span className="log-details">{log.details}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        );
      case 'aufgaben':
        return (
          <div className="page-content">
            <div className="page-header">
              <h1>Aufgaben</h1>
              <p>Behalte den Überblick über deine To-Dos.</p>
            </div>

            <div className="card" style={{ marginBottom: '2rem' }}>
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!newTask.trim()) return;
                  setTasks([{ id: Date.now(), text: newTask, completed: false }, ...tasks]);
                  setNewTask('');
                }}
                style={{ display: 'flex', gap: '0.75rem' }}
              >
                <input 
                  type="text" 
                  placeholder="Was steht heute an?" 
                  className="form-group"
                  value={newTask}
                  onChange={(e) => setNewTask(e.target.value)}
                  style={{ flex: 1, margin: 0 }}
                />
                <button type="submit" className="btn btn-primary" style={{ width: 'auto', padding: '0 1.5rem' }}>
                  <Plus size={20} />
                </button>
              </form>
            </div>

            <div style={{ display: 'grid', gap: '0.75rem' }}>
              {tasks.length === 0 ? (
                <div className="card large-placeholder">
                  <ListTodo size={48} className="placeholder-icon" />
                  <p>Keine offenen Aufgaben. Genieße deinen Tag!</p>
                </div>
              ) : (
                tasks.map(task => (
                  <div key={task.id} className="card" style={{ 
                    padding: '1rem 1.5rem', 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '1rem',
                    opacity: task.completed ? 0.6 : 1,
                    transition: 'all 0.2s ease'
                  }}>
                    <button 
                      onClick={() => setTasks(tasks.map(t => t.id === task.id ? { ...t, completed: !t.completed } : t))}
                      style={{ 
                        width: '24px', 
                        height: '24px', 
                        borderRadius: '6px', 
                        border: `2px solid ${task.completed ? 'var(--success)' : '#e2e8f0'}`,
                        background: task.completed ? 'var(--success)' : 'transparent',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white'
                      }}
                    >
                      {task.completed && <Plus size={16} style={{ transform: 'rotate(45deg)' }} />}
                    </button>
                    <span style={{ 
                      flex: 1, 
                      textDecoration: task.completed ? 'line-through' : 'none',
                      fontWeight: '500'
                    }}>
                      {task.text}
                    </span>
                    <button 
                      onClick={() => setTasks(tasks.filter(t => t.id !== task.id))}
                      className="btn-link" 
                      style={{ color: 'var(--error)' }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        );
      case 'einstellungen':
        return (
          <div className="page-content">
            <div className="page-header">
              <h1>Einstellungen</h1>
              <p>Personalisiere deinen Planner.</p>
            </div>
            <div className="card" style={{ textAlign: 'center', padding: '3rem 2rem' }}>
              <div style={{ 
                width: '80px', 
                height: '80px', 
                background: 'var(--logo-gradient)', 
                borderRadius: '50%', 
                margin: '0 auto 1.5rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: '2rem',
                fontWeight: '800'
              }}>
                {user?.email?.charAt(0).toUpperCase() || 'M'}
              </div>
              <h2 style={{ marginBottom: '0.5rem' }}>Mauro Greco</h2>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>{user?.email}</p>
              
              <div style={{ display: 'grid', gap: '1rem', maxWidth: '300px', margin: '0 auto' }}>
                <button className="btn btn-secondary">Passwort ändern</button>
                <button onClick={handleLogout} className="btn-link" style={{ color: 'var(--error)', marginTop: '1rem' }}>
                  <LogOut size={16} style={{ marginRight: '0.5rem' }} />
                  Abmelden
                </button>
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };


  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Home },
    { id: 'immobilien', label: 'Immobilien', icon: Building2 },
    { id: 'aufgaben', label: 'Aufgaben', icon: ListTodo },
    { id: 'einstellungen', label: 'Einstellungen', icon: Settings }
  ] as any[];

  return (
    <div className="app-layout">
      {/* Mobile Top Header */}
      <header className="mobile-header">
        <img src={logoImg} alt="Logo" className="nav-logo" />
        <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="menu-toggle">
          {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </header>

      {/* Navigation (Desktop Sidebar & Mobile Overlay) */}
      <nav className={`sidebar ${isMenuOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <img src={logoImg} alt="Logo" className="nav-logo" />
          <span className="brand-name">Greco Gruppe</span>
        </div>
        
        <div className="nav-links">
          {navItems.map(item => (
            <React.Fragment key={item.id}>
              {item.divider && <div className="nav-divider" />}
              <button 
                onClick={() => {
                  setActiveTab(item.id);
                  setIsMenuOpen(false);
                }}
                className={`nav-item ${activeTab === item.id ? 'active' : ''}`}
              >
                <item.icon size={20} />
                <span>{item.label}</span>
              </button>
            </React.Fragment>
          ))}
        </div>

        <div className="sidebar-footer">
          <button onClick={handleLogout} className="logout-btn">
            <LogOut size={18} />
            <span>Abmelden</span>
          </button>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="main-container">
        {renderContent()}
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="mobile-bottom-nav">
        {navItems.map(item => (
          <button 
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`bottom-nav-item ${activeTab === item.id ? 'active' : ''}`}
          >
            <item.icon size={24} />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

export default App;
