import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import PlayerTable from './components/PlayerTable';
import FantasyRosters from './components/FantasyRosters';

// Custom hook to get current location
function useActivePath() {
  const location = useLocation();
  return location.pathname;
}

// Navigation component
function Navigation() {
  const activePath = useActivePath();
  
  return (
    <nav className="p-4 bg-secondary text-primary flex flex-wrap gap-4 items-center justify-center md:justify-start border-b border-primary">
      <Link
        to="/"
        className={`
          px-6 py-2 rounded-lg font-semibold transition
          duration-200 ease-in-out
          ${
            activePath === '/'
              ? 'bg-[var(--color-primary)] text-white shadow-lg shadow-[var(--color-primary-dark)]'
              : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-primary)] hover:text-white hover:scale-105'
          }
        `}
      >
        Player Stats
      </Link>
      <Link
        to="/rosters"
        className={`
          px-6 py-2 rounded-lg font-semibold transition
          duration-200 ease-in-out
          ${
            activePath === '/rosters'
              ? 'bg-[var(--color-primary)] text-white shadow-lg shadow-[var(--color-primary-dark)]'
              : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-primary)] hover:text-white hover:scale-105'
          }
        `}
      >
        Rosters
      </Link>
    </nav>
  );
}

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-primary">
        <Navigation />
        <Routes>
          <Route path="/" element={<PlayerTable />} />
          <Route path="/rosters" element={<FantasyRosters />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
