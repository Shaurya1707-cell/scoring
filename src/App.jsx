import { useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Navbar           from './components/Navbar';
import AdminPanel       from './components/AdminPanel';
import RefereePanel     from './components/RefereePanel';
import Home             from './pages/Home';
import TournamentDetail from './pages/TournamentDetail';
import styles           from './App.module.css';

export default function App() {
  const [showAdmin,   setShowAdmin]   = useState(false);
  const [showReferee, setShowReferee] = useState(false);

  return (
    <BrowserRouter>
      <Navbar
        onAdminClick={()   => setShowAdmin(true)}
        onRefereeClick={() => setShowReferee(true)}
      />
      <main className={styles.main}>
        <Routes>
          <Route path="/"               element={<Home />} />
          <Route path="/tournament/:id" element={<TournamentDetail />} />
        </Routes>
      </main>
      {showAdmin   && <AdminPanel   onClose={() => setShowAdmin(false)} />}
      {showReferee && <RefereePanel onClose={() => setShowReferee(false)} />}
    </BrowserRouter>
  );
}
