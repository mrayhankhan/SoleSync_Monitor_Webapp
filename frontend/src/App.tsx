
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { SocketProvider } from './context/SocketContext';
import { SettingsProvider } from './context/SettingsContext';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { Settings } from './components/Settings';

function App() {
  return (
    <SocketProvider>
      <SettingsProvider>
        <Router>
          <Layout>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/history" element={<div className="p-6">History View (Coming Soon)</div>} />
              <Route path="/analytics" element={<div className="p-6">Analytics View (Coming Soon)</div>} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </Layout>
        </Router>
      </SettingsProvider>
    </SocketProvider>
  );
}

export default App;
