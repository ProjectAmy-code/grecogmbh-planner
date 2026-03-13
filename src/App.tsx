import React, { useState, useEffect } from 'react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  onAuthStateChanged, 
  signOut,
  User 
} from 'firebase/auth';
import { auth } from './firebase';
import { LogIn, UserPlus, LogOut, LayoutDashboard, Calendar, ListTodo, Settings as SettingsIcon } from 'lucide-react';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

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
    try {
      if (isRegistering) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleLogout = () => signOut(auth);

  if (loading) {
    return <div style={{ color: 'white', textAlign: 'center' }}>Lade...</div>;
  }

  if (!user) {
    return (
      <div className="auth-wrapper">
        <div className="auth-card">
          <div className="auth-header">
            <h1>Greco Planner</h1>
            <p>{isRegistering ? 'Erstelle dein Konto' : 'Willkommen zurück'}</p>
          </div>

          {error && <div className="error-msg">{error}</div>}

          <form onSubmit={handleAuth}>
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
            <button type="submit" className="btn btn-primary">
              {isRegistering ? <UserPlus size={18} /> : <LogIn size={18} />}
              {isRegistering ? 'Registrieren' : 'Anmelden'}
            </button>
          </form>

          <div className="auth-footer">
            <p>
              {isRegistering ? 'Bereits ein Konto?' : 'Noch kein Konto?'}
              <button onClick={() => setIsRegistering(!isRegistering)}>
                {isRegistering ? 'Hier anmelden' : 'Jetzt registrieren'}
              </button>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <nav className="nav">
        <h2>Greco GmbH Planner</h2>
        <button onClick={handleLogout} className="btn" style={{ width: 'auto', background: 'rgba(255,255,255,0.1)', color: 'white' }}>
          <LogOut size={18} /> Abmelden
        </button>
      </nav>

      <div className="auth-header" style={{ textAlign: 'left', marginBottom: '3rem' }}>
        <h1 style={{ fontSize: '2.5rem' }}>Hallo, Mauro</h1>
        <p>Was steht heute in der Planung?</p>
      </div>

      <div className="content-grid">
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
            <Calendar className="text-primary" />
            <h3>Nächste Schritte</h3>
          </div>
          <p style={{ color: 'var(--text-secondary)' }}>Keine anstehenden Termine.</p>
        </div>

        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
            <ListTodo style={{ color: '#fbbf24' }} />
            <h3>Projekte</h3>
          </div>
          <p style={{ color: 'var(--text-secondary)' }}>Greco GmbH Planner (In Entwicklung)</p>
        </div>

        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
            <LayoutDashboard style={{ color: '#10b981' }} />
            <h3>Statistik</h3>
          </div>
          <p style={{ color: 'var(--text-secondary)' }}>Alle Systeme laufen normal.</p>
        </div>
      </div>
    </div>
  );
}

export default App;
