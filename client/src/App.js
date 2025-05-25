import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import PlayerTable from './components/PlayerTable';
import FantasyRosters from './components/FantasyRosters';

function App() {
  return (
    <Router>
      <nav className="p-4 bg-gray-800 text-white flex gap-4">
        <Link to="/">Player Stats</Link>
        <Link to="/rosters">Fantasy Rosters</Link>
      </nav>
      <Routes>
        <Route path="/" element={<PlayerTable />} />
        <Route path="/rosters" element={<FantasyRosters />} />
      </Routes>
    </Router>
  );
}

export default App;
