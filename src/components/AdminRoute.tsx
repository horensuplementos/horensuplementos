import { useAdmin } from "@/hooks/useAdmin";
import { Navigate, Outlet, useLocation } from "react-router-dom";

const AdminRoute = () => {
  const { isAdmin, loading, userId } = useAdmin();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!isAdmin && userId) {
    return <Navigate to="/" replace />;
  }

  if (!isAdmin) {
    return <Navigate to="/auth" replace state={{ redirectTo: location.pathname }} />;
  }

  return <Outlet />;
};

export default AdminRoute;
