import { useEffect, useState } from "react";
import { getAdminSession, logoutAdmin } from "../../api/authApi";
import AdminLoginPage from "./AdminLoginPage";
import AdminPanelPage from "./AdminPanelPage";

export default function AdminAuthPage() {
  const [session, setSession] = useState(null);

  useEffect(() => {
    const existingSession = getAdminSession();
    if (existingSession) {
      setSession(existingSession);
    }
  }, []);

  const handleLoginSuccess = (nextSession) => {
    setSession(nextSession);
  };

  const handleLogout = () => {
    logoutAdmin();
    setSession(null);
  };

  if (!session) {
    return <AdminLoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  return <AdminPanelPage initialRole={session.role} lockRole onLogout={handleLogout} />;
}
