import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { useState } from 'react';
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
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const navItems = [
    { path: '/', label: 'Player Stats' },
    { path: '/rosters', label: 'Rosters' },
    { path: '/matchups', label: 'Matchups' }
  ];

  const NavLink = ({ to, label }) => (
    <Link
      to={to}
      className={`
        px-4 py-2 rounded-lg font-medium transition
        duration-200 ease-in-out text-sm
        ${
          activePath === to
            ? 'bg-[var(--color-primary)] text-white shadow-lg shadow-[var(--color-primary-dark)]'
            : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-primary)] hover:text-white'
        }
      `}
      onClick={() => setIsMenuOpen(false)}
    >
      {label}
    </Link>
  );

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 bg-secondary border-b border-primary">
        <div className="max-w-7xl px-4">
          <div className="flex items-center h-16">
            {/* Logo/Brand */}
            <div className="flex-shrink-0 pr-10">
              <Link to="/" className="flex items-center">
                <img
                  src="/logo192-v2.png"
                  alt="FF Stats Logo"
                  className="h-12 w-12 object-contain"
                />
              </Link>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-4">
              {navItems.map((item) => (
                <NavLink key={item.path} to={item.path} label={item.label} />
              ))}
            </div>

            {/* Mobile menu button */}
            <div className="md:hidden ml-auto">
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="inline-flex items-center justify-center p-2 rounded-md text-primary hover:text-white hover:bg-[var(--color-primary)] focus:outline-none"
              >
                <svg
                  className="h-6 w-6"
                  stroke="currentColor"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  {isMenuOpen ? (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  ) : (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 6h16M4 12h16M4 18h16"
                    />
                  )}
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu backdrop */}
        <div
          className={`md:hidden fixed inset-0 z-40 transition-opacity duration-300 ${
            isMenuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        >
          <div 
            className="fixed inset-0 bg-black bg-opacity-50" 
            onClick={() => setIsMenuOpen(false)}
          />
        </div>

        {/* Mobile menu */}
        <div
          className={`md:hidden fixed inset-y-0 left-0 z-40 w-64 transform transition-transform duration-300 ease-in-out ${
            isMenuOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="fixed inset-y-0 left-0 w-64 bg-secondary shadow-lg">
            <div className="flex flex-col p-4 space-y-4">
              {navItems.map((item) => (
                <NavLink key={item.path} to={item.path} label={item.label} />
              ))}
            </div>
          </div>
        </div>
      </nav>
      {/* Add padding to account for fixed navbar */}
      <div className="h-16" />
    </>
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
          <Route path="/matchups" element={<div>Matchups Page</div>} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
