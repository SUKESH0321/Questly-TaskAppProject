import { Navigate, useLocation } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import { LogoMark } from "@/components/shared/Logo";

interface ProtectedRouteProps {
  children: React.ReactNode;
  /** Allow signed-in users who haven't picked a role yet (role selection, onboarding). */
  allowNoRole?: boolean;
  /** Allow users whose mobile number isn't verified yet (the verify-phone screen). */
  allowUnverifiedPhone?: boolean;
  /** Only the company admin account may open this page. */
  adminOnly?: boolean;
}

function SessionSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <LogoMark size={64} />
        <p className="text-sm">Checking your session...</p>
      </div>
    </div>
  );
}

/**
 * Requires a signed-in user. Order of the sign-up journey:
 * verify mobile number -> choose role -> app.
 */
export function ProtectedRoute({ children, allowNoRole = false, allowUnverifiedPhone = false, adminOnly = false }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, user } = useAuthStore();
  const location = useLocation();

  if (isLoading) return <SessionSpinner />;

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // The admin account only ever sees the admin page, and nobody else may open it.
  if (user?.role === "admin" && !adminOnly) return <Navigate to="/admin" replace />;
  if (adminOnly && user?.role !== "admin") return <Navigate to="/home" replace />;
  if (adminOnly) return <>{children}</>;

  if (!allowUnverifiedPhone && user && !user.phoneVerified) {
    return <Navigate to="/verify-phone" replace />;
  }

  if (!allowNoRole && user && user.role === null) {
    return <Navigate to="/role-selection" replace />;
  }

  return <>{children}</>;
}

/** For login/register: signed-in users are sent on to wherever they left off. */
export function GuestRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, user } = useAuthStore();

  if (isLoading) return <SessionSpinner />;

  if (isAuthenticated) {
    if (user?.role === "admin") return <Navigate to="/admin" replace />;
    if (user && !user.phoneVerified) return <Navigate to="/verify-phone" replace />;
    return <Navigate to={user?.role === null ? "/role-selection" : "/home"} replace />;
  }

  return <>{children}</>;
}
